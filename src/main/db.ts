import Database from 'better-sqlite3'
import { SCHEMA } from './schema.ts'
import { isExamSystem } from '../../shared/exams.ts'
import type {
  ConversationRecord,
  DifficultyId,
  ExamSystem,
  QuestionPayload,
  QuestionRecord,
  SentenceRecord,
  Speaker,
  TtsStatus,
  WordRecord,
  WordStatus
} from '../../shared/types.ts'

interface ConversationRow {
  id: string
  topic: string
  system: string | null
  level: string
  title: string | null
  created_at: number
}

interface SentenceRow {
  id: string
  conversation_id: string
  seq: number
  speaker: string
  english: string
  chinese: string
  audio_path: string | null
  slow_audio_path: string | null
  tts_status: string
}

interface QuestionRow {
  id: string
  conversation_id: string
  seq: number
  stem: string
  stem_chinese: string | null
  options: string
  answer_index: number
  explanation: string | null
  stem_audio_path: string | null
  tts_status: string
}

interface WordRow {
  id: string
  word: string
  meaning: string | null
  phonetic: string | null
  example: string | null
  example_translation: string | null
  word_audio_path: string | null
  example_audio_path: string | null
  source_sentence_id: string | null
  added_at: number
  review_count: number
  next_review_at: number
  status: string
}

export class AppDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    // 开启外键约束，删除对话时句子/题目随 ON DELETE CASCADE 一并清理
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA)
    this.migrate()
  }

  /** 为旧库补充新增列（纯增量，不丢数据） */
  private migrate(): void {
    const tableColumns = (table: string): Set<string> => {
      const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      return new Set(cols.map((c) => c.name))
    }

    const sentNames = tableColumns('sentence')
    if (!sentNames.has('slow_audio_path')) {
      this.db.exec('ALTER TABLE sentence ADD COLUMN slow_audio_path TEXT')
    }

    // 1.4.0：对话新增「难度体系」列，老记录一律视为 cefr
    const convNames = tableColumns('conversation')
    if (convNames.size > 0 && !convNames.has('system')) {
      this.db.exec("ALTER TABLE conversation ADD COLUMN system TEXT NOT NULL DEFAULT 'cefr'")
    }
    if (convNames.has('system')) {
      this.db.exec("UPDATE conversation SET system = 'cefr' WHERE system IS NULL OR system = ''")
    }

    const wordNames = tableColumns('word')
    if (!wordNames.has('example_translation')) {
      this.db.exec('ALTER TABLE word ADD COLUMN example_translation TEXT')
    }
    if (!wordNames.has('word_audio_path')) {
      this.db.exec('ALTER TABLE word ADD COLUMN word_audio_path TEXT')
    }
    if (!wordNames.has('example_audio_path')) {
      this.db.exec('ALTER TABLE word ADD COLUMN example_audio_path TEXT')
    }

    // 1.4.0 之前的库里，删对话不会级联删句子，这里补一次清理
    this.db.exec(
      'DELETE FROM sentence WHERE conversation_id NOT IN (SELECT id FROM conversation)'
    )
    this.db.exec(
      'DELETE FROM question WHERE conversation_id NOT IN (SELECT id FROM conversation)'
    )
  }

  close(): void {
    this.db.close()
  }

  // ---------- config ----------
  getConfig(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row ? row.value : null
  }

  setConfig(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  // ---------- conversation ----------
  createConversation(
    id: string,
    topic: string,
    system: ExamSystem,
    level: DifficultyId,
    title: string,
    createdAt: number
  ): void {
    this.db
      .prepare(
        'INSERT INTO conversation (id, topic, system, level, title, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, topic, system, level, title, createdAt)
  }

  getConversation(id: string): ConversationRecord | null {
    const row = this.db.prepare('SELECT * FROM conversation WHERE id = ?').get(id) as
      | ConversationRow
      | undefined
    return row ? rowToConversation(row) : null
  }

  listConversations(): ConversationRecord[] {
    const rows = this.db.prepare('SELECT * FROM conversation ORDER BY created_at DESC').all() as ConversationRow[]
    return rows.map(rowToConversation)
  }

  deleteConversation(id: string): void {
    this.db.prepare('DELETE FROM sentence WHERE conversation_id = ?').run(id)
    this.db.prepare('DELETE FROM question WHERE conversation_id = ?').run(id)
    this.db.prepare('DELETE FROM conversation WHERE id = ?').run(id)
  }

  clearAllData(): void {
    this.db.exec('DELETE FROM sentence; DELETE FROM question; DELETE FROM conversation; DELETE FROM word;')
  }

  /** 清空所有数据（含 config），用于需要彻底重置的场景 */
  clearEverything(): void {
    this.db.exec(
      'DELETE FROM sentence; DELETE FROM question; DELETE FROM conversation; DELETE FROM word; DELETE FROM config;'
    )
  }

  // ---------- sentence ----------
  insertSentence(
    id: string,
    conversationId: string,
    seq: number,
    speaker: Speaker,
    english: string,
    chinese: string
  ): void {
    this.db
      .prepare(
        'INSERT INTO sentence (id, conversation_id, seq, speaker, english, chinese) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, conversationId, seq, speaker, english, chinese)
  }

  getSentences(conversationId: string): SentenceRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM sentence WHERE conversation_id = ? ORDER BY seq')
      .all(conversationId) as SentenceRow[]
    return rows.map(rowToSentence)
  }

  updateSentenceAudio(id: string, audioPath: string | null, slowAudioPath: string | null, ttsStatus: TtsStatus): void {
    this.db
      .prepare('UPDATE sentence SET audio_path = ?, slow_audio_path = ?, tts_status = ? WHERE id = ?')
      .run(audioPath, slowAudioPath, ttsStatus, id)
  }

  /** 查询句子的正常语速音频路径 */
  getSentenceAudioPath(id: string): string | null {
    const row = this.db.prepare('SELECT audio_path FROM sentence WHERE id = ?').get(id) as
      | { audio_path: string | null }
      | undefined
    return row ? row.audio_path : null
  }

  // ---------- question（四六级听力题） ----------
  insertQuestion(record: QuestionRecord): void {
    this.db
      .prepare(
        `INSERT INTO question
         (id, conversation_id, seq, stem, stem_chinese, options, answer_index, explanation, stem_audio_path, tts_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.conversationId,
        record.seq,
        record.stem,
        record.stemChinese,
        JSON.stringify(record.options),
        record.answerIndex,
        record.explanation,
        record.stemAudioPath,
        record.ttsStatus
      )
  }

  getQuestions(conversationId: string): QuestionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM question WHERE conversation_id = ? ORDER BY seq')
      .all(conversationId) as QuestionRow[]
    return rows.map(rowToQuestion)
  }

  updateQuestionAudio(id: string, stemAudioPath: string | null, ttsStatus: TtsStatus): void {
    this.db
      .prepare('UPDATE question SET stem_audio_path = ?, tts_status = ? WHERE id = ?')
      .run(stemAudioPath, ttsStatus, id)
  }

  countQuestions(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM question').get() as { c: number }
    return row.c
  }

  // ---------- word ----------
  addWord(record: WordRecord): void {
    this.db
      .prepare(
        `INSERT INTO word
         (id, word, meaning, phonetic, example, example_translation, word_audio_path, example_audio_path, source_sentence_id, added_at, review_count, next_review_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.word,
        record.meaning,
        record.phonetic,
        record.example,
        record.exampleTranslation,
        record.wordAudioPath,
        record.exampleAudioPath,
        record.sourceSentenceId,
        record.addedAt,
        record.reviewCount,
        record.nextReviewAt,
        record.status
      )
  }

  getWord(id: string): WordRecord | null {
    const row = this.db.prepare('SELECT * FROM word WHERE id = ?').get(id) as WordRow | undefined
    return row ? rowToWord(row) : null
  }

  getWordByText(word: string): WordRecord | null {
    const row = this.db.prepare('SELECT * FROM word WHERE word = ?').get(word) as WordRow | undefined
    return row ? rowToWord(row) : null
  }

  listWords(): WordRecord[] {
    const rows = this.db.prepare('SELECT * FROM word ORDER BY added_at DESC').all() as WordRow[]
    return rows.map(rowToWord)
  }

  deleteWord(id: string): void {
    this.db.prepare('DELETE FROM word WHERE id = ?').run(id)
  }

  /** 后台补全单词释义（查词典/翻译完成后更新） */
  updateWordMeaning(id: string, meaning: string | null, phonetic: string | null): void {
    this.db.prepare('UPDATE word SET meaning = ?, phonetic = ? WHERE id = ?').run(meaning, phonetic, id)
  }

  /** 更新单词读音路径（合成完成后） */
  updateWordAudio(id: string, audioPath: string): void {
    this.db.prepare('UPDATE word SET word_audio_path = ? WHERE id = ?').run(audioPath, id)
  }

  /** 标记单词已背/未背 */
  markWordMastered(id: string, mastered: boolean): void {
    this.db
      .prepare('UPDATE word SET status = ? WHERE id = ?')
      .run(mastered ? 'mastered' : 'learning', id)
  }

  getDueWords(now: number): WordRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM word WHERE next_review_at <= ? AND status = ? ORDER BY next_review_at')
      .all(now, 'learning') as WordRow[]
    return rows.map(rowToWord)
  }

  updateWordReview(id: string, reviewCount: number, nextReviewAt: number, status: WordStatus): void {
    this.db
      .prepare('UPDATE word SET review_count = ?, next_review_at = ?, status = ? WHERE id = ?')
      .run(reviewCount, nextReviewAt, status, id)
  }

  countWords(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM word').get() as { c: number }
    return row.c
  }

  countSentences(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM sentence').get() as { c: number }
    return row.c
  }

  countConversations(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM conversation').get() as { c: number }
    return row.c
  }
}

function rowToConversation(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    topic: row.topic,
    system: isExamSystem(row.system) ? row.system : 'cefr',
    level: row.level,
    title: row.title ?? '',
    createdAt: row.created_at
  }
}

function rowToSentence(row: SentenceRow): SentenceRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    seq: row.seq,
    speaker: row.speaker as Speaker,
    english: row.english,
    chinese: row.chinese,
    audioPath: row.audio_path,
    slowAudioPath: row.slow_audio_path,
    ttsStatus: row.tts_status as TtsStatus
  }
}

/** 选项在库里存 JSON 字符串；解析失败时降级为空数组，避免整条记录读不出来 */
export function parseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((o): o is string => typeof o === 'string') : []
  } catch {
    return []
  }
}

function rowToQuestion(row: QuestionRow): QuestionRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    seq: row.seq,
    stem: row.stem,
    stemChinese: row.stem_chinese ?? '',
    options: parseOptions(row.options),
    answerIndex: row.answer_index,
    explanation: row.explanation,
    stemAudioPath: row.stem_audio_path,
    ttsStatus: row.tts_status as TtsStatus
  }
}

function rowToWord(row: WordRow): WordRecord {
  return {
    id: row.id,
    word: row.word,
    meaning: row.meaning,
    phonetic: row.phonetic,
    example: row.example,
    exampleTranslation: row.example_translation,
    wordAudioPath: row.word_audio_path,
    exampleAudioPath: row.example_audio_path,
    sourceSentenceId: row.source_sentence_id,
    addedAt: row.added_at,
    reviewCount: row.review_count,
    nextReviewAt: row.next_review_at,
    status: row.status as WordStatus
  }
}

export type { QuestionPayload }
