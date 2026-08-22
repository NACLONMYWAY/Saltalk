import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AppDatabase } from './db.ts'
import { generateDialogue, translateWord } from './deepseek.ts'
import { synthesize, SPEAKER_VOICE, audioCacheKey, rateValue } from './tts.ts'
import { lookupWord } from './dictionary.ts'
import { initialNextReview, reviewWord } from '../../shared/review.ts'
import { computeWordStats, type WordStats } from '../../shared/stats.ts'
import type { CEFRLevel, Dialogue, SentenceRecord, TtsStatus, WordRecord } from '../../shared/types.ts'

export interface GeneratedConversation {
  conversationId: string
  dialogue: Dialogue
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

  /** 生成对话并持久化，返回带 conversationId 的结果 */
  async generateAndSave(topic: string, level: CEFRLevel, apiKey: string): Promise<GeneratedConversation> {
    const dialogue = await generateDialogue({ apiKey, topic, level }, this.fetcher)
    const conversationId = randomUUID()
    this.db.createConversation(conversationId, topic, level, dialogue.title, Date.now())
    dialogue.dialogue.forEach((line, seq) => {
      this.db.insertSentence(randomUUID(), conversationId, seq, line.speaker, line.english, line.chinese)
    })
    return { conversationId, dialogue }
  }

  /** 合成一个对话全部句子的语音（正常 + 慢速两套）；单句失败标记 failed 不影响其他句 */
  async synthesizeAll(conversationId: string): Promise<void> {
    const sentences = this.db.getSentences(conversationId)
    for (const s of sentences) {
      let normalPath: string | null = null
      let slowPath: string | null = null
      try {
        normalPath = await this.synthesizeOne(conversationId, s, false)
      } catch {
        // 忽略单句失败
      }
      try {
        slowPath = await this.synthesizeOne(conversationId, s, true)
      } catch {
        // 忽略单句失败
      }
      const status: TtsStatus = normalPath && slowPath ? 'done' : 'failed'
      this.db.updateSentenceAudio(s.id, normalPath, slowPath, status)
    }
  }

  private async synthesizeOne(
    conversationId: string,
    s: SentenceRecord,
    slow: boolean
  ): Promise<string> {
    const fileName = audioCacheKey(conversationId, s.seq, s.speaker, slow)
    const targetPath = join(this.audioDir, fileName)
    // 缓存命中：文件已存在且非空，直接复用
    if (existsSync(targetPath) && statSync(targetPath).size > 0) {
      return targetPath
    }
    const voice = SPEAKER_VOICE[s.speaker]
    const rate = rateValue(slow)
    return synthesize({ text: s.english, voice, rate, outDir: this.audioDir, fileName })
  }

  /** 加入单词本：中文释义用 Deepseek，音标用英文词典，例句取来源句子英文 */
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

    const apiKey = this.db.getConfig('deepseek_api_key')
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
        voice: SPEAKER_VOICE.B,
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
