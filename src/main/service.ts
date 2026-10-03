import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AppDatabase } from './db.ts'
import { generateDialogue, generateExamDialogue, lookupWords } from './deepseek.ts'
import { synthesize, audioCacheKey, questionCacheKey, introCacheKey, rateValue } from './tts.ts'
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

/** 点词预览：只给界面看一眼，不写库 */
export interface WordPreview {
  word: string
  meaning: string | null
  phonetic: string | null
  /** 是否已在单词本里（界面据此决定还要不要显示「加入单词本」） */
  inBook: boolean
}

/** 清洗用户选中的词：去首尾标点与空白（保留词内撇号与连字符） */
export function normalizeWord(raw: string): string {
  return raw.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
}

/**
 * 单次查词的网络上限。Deepseek 实测 0.4–0.8s，8 秒只是防呆上限，
 * 正常情况不会摸到 —— 和以前「词典必然卡满 6 秒」是两回事。
 */
const LOOKUP_TIMEOUT_MS = 8000

/** 预取是批量请求，给宽一点 */
const PREFETCH_TIMEOUT_MS = 12000

/** 查到结果的缓存时长（一次使用内有效；重启即清空） */
const CACHE_TTL_OK = 30 * 60 * 1000

/**
 * 没查到时的短期缓存时长。
 *
 * 以前的做法是「查不到就不缓存」，本意是别把一次网络抖动钉死，
 * 但副作用是连点同一个生僻词会一次次重打网络 —— 每次都要等一个来回。
 * 折中成短 TTL：既不会反复打网络，过一分钟又能重试。
 */
const CACHE_TTL_MISS = 60 * 1000

/** 一次预取最多查多少个词（够覆盖一句话，又不至于把 prompt 撑爆） */
const PREFETCH_LIMIT = 24

type Gloss = { meaning: string | null; phonetic: string | null }

export class AppService {
  private db: AppDatabase
  private audioDir: string
  private fetcher: typeof fetch
  /** 补齐释义任务互斥锁：避免反复切页时并发重复查询同一批词 */
  private enriching = false
  /** 点词预览的释义缓存：同一个词在一次使用里只查一次网络 */
  private meaningCache = new Map<string, { value: Gloss; expiresAt: number }>()

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

  /** 后台补全释义与单词读音（加入单词本时用，保持「快速插入」语义） */
  private async enrichWord(word: string, id: string): Promise<void> {
    await this.enrichWordMeaning(word, id)
    await this.enrichWordAudio(word, id)
  }

  /** 补齐释义为空的词时只补释义，不合成读音（读音慢，会把自愈拖成几十秒） */
  private async enrichWordMeaning(word: string, id: string): Promise<void> {
    const { meaning, phonetic } = await this.resolveMeaning(word)
    this.db.updateWordMeaning(id, meaning, phonetic)
  }

  /** 写缓存：查到结果按长 TTL，没查到按短 TTL（见 CACHE_TTL_MISS 的说明） */
  private rememberWord(key: string, value: Gloss): void {
    const found = Boolean(value.meaning || value.phonetic)
    this.meaningCache.set(key, {
      value,
      expiresAt: Date.now() + (found ? CACHE_TTL_OK : CACHE_TTL_MISS)
    })
  }

  /**
   * 查释义（音标 + 中文），不落库，带内存缓存。
   *
   * 点词预览、预取、「加入单词本」后的补全都走这里。
   * 走 Deepseek 一次拿回音标与释义 —— 以前是「免费词典 + 翻译」两步串行，
   * 而免费词典在国内必然卡满 6 秒超时，等于每次点词都先白等 6 秒。
   */
  private async resolveMeaning(word: string): Promise<Gloss> {
    const key = word.toLowerCase()
    const cached = this.meaningCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    let result: Gloss = { meaning: null, phonetic: null }
    const apiKey = this.db.getConfig(CONFIG_KEYS.apiKey)
    if (apiKey) {
      try {
        const glosses = await lookupWords(
          [key],
          apiKey,
          this.fetcher,
          AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
        )
        const hit = glosses.find((g) => g.word === key)
        if (hit) result = { meaning: hit.meaning, phonetic: hit.phonetic }
      } catch {
        // 网络失败：留给下面的短 TTL 负缓存兜住，界面照常显示「未查到释义」
      }
    }

    this.rememberWord(key, result)
    return result
  }

  /**
   * 预取一批词的释义，让「点词即显」真正变成瞬时。
   *
   * 切词后先批量查好整句，之后点句中任何一个词都直接命中内存缓存（0 网络往返）。
   * 只写缓存、不落库，也不阻塞界面；失败就当没发生过 —— 用户真去点那个词时
   * 会走一次正常查询，不会因为预取失败而查不到。
   */
  async prefetchWords(rawWords: string[], limit = PREFETCH_LIMIT): Promise<number> {
    const apiKey = this.db.getConfig(CONFIG_KEYS.apiKey)
    if (!apiKey) return 0

    const now = Date.now()
    const pending: string[] = []
    for (const raw of rawWords) {
      const word = normalizeWord(raw)
      if (!word) continue
      const key = word.toLowerCase()
      if (pending.includes(key)) continue

      const cached = this.meaningCache.get(key)
      if (cached && cached.expiresAt > now) continue

      // 已在单词本里的词直接读本地，不必花网络
      const existing = this.db.getWordByText(word)
      if (existing) {
        this.rememberWord(key, { meaning: existing.meaning, phonetic: existing.phonetic })
        continue
      }

      pending.push(key)
      if (pending.length >= limit) break
    }
    if (pending.length === 0) return 0

    try {
      const glosses = await lookupWords(
        pending,
        apiKey,
        this.fetcher,
        AbortSignal.timeout(PREFETCH_TIMEOUT_MS)
      )
      const byWord = new Map(glosses.map((g) => [g.word, g]))
      for (const key of pending) {
        const hit = byWord.get(key)
        // 模型偶尔会漏返回个别词。漏掉的不写负缓存 —— 否则用户点它时会看到
        // 「未查到释义」整整一分钟，而它其实查得到。留给用户点它时现查。
        if (hit) this.rememberWord(key, { meaning: hit.meaning, phonetic: hit.phonetic })
      }
      return glosses.length
    } catch {
      // 预取失败不记负缓存：那是网络问题，不该让这 24 个词在用户点它时直接显示「查不到」
      return 0
    }
  }

  /**
   * 点词预览：拿到这个词的意思，不落库。
   * 已在单词本里的词直接读本地（省一次网络），未收录的走词典 + 翻译。
   */
  async previewWord(rawWord: string): Promise<WordPreview> {
    const word = normalizeWord(rawWord)
    if (!word) {
      throw new Error('无效的单词')
    }

    const existing = this.db.getWordByText(word)
    if (existing) {
      return { word, meaning: existing.meaning, phonetic: existing.phonetic, inBook: true }
    }

    const { meaning, phonetic } = await this.resolveMeaning(word)
    return { word, meaning, phonetic, inBook: false }
  }

  /** 合成单词读音（缓存复用） */
  private async enrichWordAudio(word: string, id: string): Promise<void> {
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

  /**
   * 补齐「释义为空」的单词，供单词本/背单词进入时自愈。
   *
   * 为什么需要它：加入单词本时是「先快速插入、后台异步补释义」，用户如果加完
   * 立刻去背，卡片背面就会是一张没有中文释义的空卡（只剩例句）。历史数据里也
   * 可能残留 meaning 为空的词。这里主动把缺口补上。
   *
   * 串行执行并限制条数，避免一次性打爆网络；同一时刻只允许一个补齐任务在跑。
   */
  async enrichMissingWords(limit = 5): Promise<number> {
    if (this.enriching) return 0
    this.enriching = true
    try {
      const missing = this.db
        .listWords()
        .filter((w) => !w.meaning || !w.meaning.trim())
        .slice(0, limit)
      let done = 0
      for (const w of missing) {
        // 只补释义（不合成读音），避免把一次自愈拖成几十秒；
        // enrichWordMeaning 内部已吞掉网络异常，不会中断后面的词
        await this.enrichWordMeaning(w.word, w.id)
        done++
      }
      return done
    } finally {
      this.enriching = false
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
