import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AppDatabase } from './db.ts'
import { generateDialogue, generateExamDialogue, translateWord } from './deepseek.ts'
import { synthesize, audioCacheKey, questionCacheKey, introCacheKey, rateValue } from './tts.ts'
import { lookupWord } from './dictionary.ts'
import { resolveNarratorVoice, resolveVoices } from './voiceConfig.ts'
import { modeOf } from '../../shared/exams.ts'
import { examIntroText, spokenStem } from '../../shared/examFlow.ts'
import { CONFIG_KEYS } from '../../shared/configKeys.ts'
import { initialNextReview, reviewWord } from '../../shared/review.ts'
import { computeWordStats, type WordStats } from '../../shared/stats.ts'
import type {
  Dialogue,
  DifficultyId,
  ExamSystem,
  GenerateMode,
  QuestionRecord,
  SentenceRecord,
  TtsStatus,
  WordRecord
} from '../../shared/types.ts'

export interface GeneratedConversation {
  conversationId: string
  system: ExamSystem
  mode: GenerateMode
  dialogue: Dialogue
  /** 仅四六级模式非空 */
  questions: QuestionRecord[]
}

/** 清洗用户选中的词：去首尾标点与空白（保留词内撇号与连字符） */
export function normalizeWord(raw: string): string {
  return raw.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
}

export class AppService {
  private db: AppDatabase
  private audioDir: string
  private fetcher: typeof fetch

  constructor(db: AppDatabase, audioDir: string, fetcher: typeof fetch = fetch) {
    this.db = db
    this.audioDir = audioDir
    this.fetcher = fetcher
  }

  /**
   * 生成并持久化。按难度体系分流：
   * cefr / ielts → 双人对话；cet → 长对话 + 四选一选择题。
   */
  async generateAndSave(
    topic: string,
    system: ExamSystem,
    level: DifficultyId,
    apiKey: string
  ): Promise<GeneratedConversation> {
    const mode = modeOf(system)
    const dialogue =
      mode === 'exam'
        ? await generateExamDialogue({ apiKey, topic, level, system }, this.fetcher)
        : await generateDialogue({ apiKey, topic, level, system }, this.fetcher)

    const conversationId = randomUUID()
    this.db.createConversation(conversationId, topic, system, level, dialogue.title, Date.now())
    dialogue.dialogue.forEach((line, seq) => {
      this.db.insertSentence(randomUUID(), conversationId, seq, line.speaker, line.english, line.chinese)
    })

    const questions: QuestionRecord[] = []
    if (mode === 'exam' && dialogue.questions) {
      dialogue.questions.forEach((q, seq) => {
        const record: QuestionRecord = {
          id: randomUUID(),
          conversationId,
          seq,
          stem: q.stem,
          stemChinese: q.stemChinese,
          options: q.options,
          answerIndex: q.answerIndex,
          explanation: q.explanation,
          stemAudioPath: null,
          ttsStatus: 'pending'
        }
        this.db.insertQuestion(record)
        questions.push(record)
      })
    }

    return { conversationId, system, mode, dialogue, questions }
  }

  /** 合成一个对话全部句子的语音（正常 + 慢速两套）；单句失败标记 failed 不影响其他句 */
  async synthesizeAll(conversationId: string): Promise<void> {
    const conv = this.db.getConversation(conversationId)
    const system = conv?.system ?? 'cefr'
    const voices = resolveVoices(this.db)

    for (const s of this.db.getSentences(conversationId)) {
      const voice = voices[s.speaker]
      let normalPath: string | null = null
      let slowPath: string | null = null
      try {
        normalPath = await this.synthesizeSentence(conversationId, s, voice, false)
      } catch {
        // 忽略单句失败
      }
      try {
        slowPath = await this.synthesizeSentence(conversationId, s, voice, true)
      } catch {
        // 忽略单句失败
      }
      const status: TtsStatus = normalPath && slowPath ? 'done' : 'failed'
      this.db.updateSentenceAudio(s.id, normalPath, slowPath, status)
    }

    // 四六级：题干要能被朗读出来（试卷上不印题干），并预热材料前的引导语
    if (modeOf(system) === 'exam') {
      const narrator = resolveNarratorVoice(this.db)
      const questions = this.db.getQuestions(conversationId)
      try {
        await this.synthesizeExamIntro(questions.length)
      } catch {
        // 引导语合成失败不影响答题
      }
      for (const q of questions) {
        try {
          const path = await this.synthesizeStem(conversationId, q, narrator)
          this.db.updateQuestionAudio(q.id, path, 'done')
        } catch {
          this.db.updateQuestionAudio(q.id, null, 'failed')
        }
      }
    }
  }

  private async synthesizeSentence(
    conversationId: string,
    s: SentenceRecord,
    voice: string,
    slow: boolean
  ): Promise<string> {
    const fileName = audioCacheKey(conversationId, s.seq, s.speaker, voice, slow)
    const targetPath = join(this.audioDir, fileName)
    // 缓存命中：文件已存在且非空，直接复用
    if (existsSync(targetPath) && statSync(targetPath).size > 0) {
      return targetPath
    }
    return synthesize({
      text: s.english,
      voice,
      rate: rateValue(slow),
      outDir: this.audioDir,
      fileName
    })
  }

  private async synthesizeStem(
    conversationId: string,
    q: QuestionRecord,
    voice: string
  ): Promise<string> {
    const fileName = questionCacheKey(conversationId, q.seq, voice)
    const targetPath = join(this.audioDir, fileName)
    if (existsSync(targetPath) && statSync(targetPath).size > 0) {
      return targetPath
    }
    return synthesize({
      text: spokenStem(q.seq, q.stem),
      voice,
      rate: rateValue(false),
      outDir: this.audioDir,
      fileName
    })
  }

  /**
   * 四六级引导语（材料播放前先播这一段）。
   * 文本只取决于题量，因此按题量缓存、不同对话共用同一个音频文件。
   */
  async synthesizeExamIntro(questionCount: number): Promise<string> {
    const voice = resolveNarratorVoice(this.db)
    const fileName = introCacheKey(questionCount, voice)
    const targetPath = join(this.audioDir, fileName)
    if (existsSync(targetPath) && statSync(targetPath).size > 0) {
      return targetPath
    }
    return synthesize({
      text: examIntroText(questionCount),
      voice,
      rate: rateValue(false),
      outDir: this.audioDir,
      fileName
    })
  }

  /** 取某对话的引导语音频路径（缓存优先）；无题目或合成失败时返回 null */
  async getExamIntroPath(conversationId: string): Promise<string | null> {
    const count = this.db.getQuestions(conversationId).length
    if (count === 0) return null
    try {
      return await this.synthesizeExamIntro(count)
    } catch {
      return null
    }
  }

  /** 音色试听：合成一句固定文本，返回音频路径（同一音色复用缓存） */
  async previewVoice(voiceId: string): Promise<string> {
    const fileName = `preview_${voiceId.replace(/[^a-zA-Z0-9-]/g, '')}.mp3`
    const targetPath = join(this.audioDir, fileName)
    if (existsSync(targetPath) && statSync(targetPath).size > 0) {
      return targetPath
    }
    return synthesize({
      text: 'Hello, this is how I sound. Let us start practising English listening together.',
      voice: voiceId,
      rate: rateValue(false),
      outDir: this.audioDir,
      fileName
    })
  }

  /**
   * 加入单词本：先快速插入（含例句及翻译，无释义），后台异步补中文释义与音标。
   * 重复单词抛错。
   */
  async addWordToBook(
    rawWord: string,
    sourceSentenceId: string | null,
    example: string | null,
    exampleTranslation: string | null
  ): Promise<WordRecord> {
    const word = normalizeWord(rawWord)
    if (!word) {
      throw new Error('无效的单词')
    }
    if (this.db.getWordByText(word)) {
      throw new Error('单词本已有该单词')
    }

    const now = Date.now()
    const exampleAudioPath = sourceSentenceId ? this.db.getSentenceAudioPath(sourceSentenceId) : null
    const record: WordRecord = {
      id: randomUUID(),
      word,
      meaning: null,
      phonetic: null,
      example,
      exampleTranslation,
      wordAudioPath: null,
      exampleAudioPath,
      sourceSentenceId,
      addedAt: now,
      reviewCount: 0,
      nextReviewAt: initialNextReview(now),
      status: 'learning'
    }
    this.db.addWord(record)

    // 后台异步补全释义与单词读音，不阻塞加入操作
    void this.enrichWord(word, record.id)

    return record
  }

  /** 后台查词典 + 翻译 + 合成单词读音 */
  private async enrichWord(word: string, id: string): Promise<void> {
    let meaning: string | null = null
    let phonetic: string | null = null

    try {
      const lookup = await lookupWord(word, this.fetcher)
      if (lookup) {
        phonetic = lookup.phonetic
        meaning = lookup.meaning
      }
    } catch {
      // 词典不可用
    }

    const apiKey = this.db.getConfig(CONFIG_KEYS.apiKey)
    if (apiKey) {
      try {
        const zh = await translateWord(word, apiKey, this.fetcher)
        if (zh) meaning = zh
      } catch {
        // 翻译失败保留英文释义
      }
    }

    this.db.updateWordMeaning(id, meaning, phonetic)

    // 合成单词读音（缓存复用）
    try {
      const audioPath = await synthesize({
        text: word,
        voice: resolveVoices(this.db).B,
        rate: rateValue(false),
        outDir: this.audioDir,
        fileName: `word_${word}.mp3`
      })
      this.db.updateWordAudio(id, audioPath)
    } catch {
      // 读音合成失败忽略
    }
  }

  /** 复习单词并更新间隔计划 */
  reviewWord(wordId: string, remembered: boolean): void {
    const word = this.db.getWord(wordId)
    if (!word) {
      throw new Error('单词不存在')
    }
    const outcome = reviewWord(Date.now(), word.reviewCount, remembered)
    this.db.updateWordReview(wordId, outcome.reviewCount, outcome.nextReviewAt, outcome.status)
  }

  /** 单词本统计 */
  getWordStats(): WordStats {
    return computeWordStats(this.db.listWords(), Date.now())
  }
}
