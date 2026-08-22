import Database from 'better-sqlite3'
import { SCHEMA } from './schema.ts'
import type {
  CEFRLevel,
  ConversationRecord,
  SentenceRecord,
  Speaker,
  TtsStatus,
  WordRecord,
  WordStatus
} from '../../shared/types.ts'

interface ConversationRow {
  id: string
  topic: string
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
    this.db.exec(SCHEMA)
    this.migrate()
  }

  /** 为旧库补充新增列 */
  private migrate(): void {
    const sentCols = this.db.prepare('PRAGMA table_info(sentence)').all() as Array<{ name: string }>
    const sentNames = new Set(sentCols.map((c) => c.name))
    if (!sentNames.has('slow_audio_path')) {
      this.db.exec('ALTER TABLE sentence ADD COLUMN slow_audio_path TEXT')
    }

    const wordCols = this.db.prepare('PRAGMA table_info(word)').all() as Array<{ name: string }>
    const wordNames = new Set(wordCols.map((c) => c.name))
    if (!wordNames.has('example_translation')) {
      this.db.exec('ALTER TABLE word ADD COLUMN example_translation TEXT')
    }
    if (!wordNames.has('word_audio_path')) {
      this.db.exec('ALTER TABLE word ADD COLUMN word_audio_path TEXT')
    }
    if (!wordNames.has('example_audio_path')) {
      this.db.exec('ALTER TABLE word ADD COLUMN example_audio_path TEXT')
    }
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
  createConversation(id: string, topic: string, level: CEFRLevel, title: string, createdAt: number): void {
    this.db
      .prepare('INSERT INTO conversation (id, topic, level, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, topic, level, title, createdAt)
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
    this.db.prepare('DELETE FROM conversation WHERE id = ?').run(id)
  }

  clearAllData(): void {
    this.db.exec('DELETE FROM sentence; DELETE FROM conversation; DELETE FROM word;')
  }

  /** 清空所有数据（含 config），用于版本升级时的彻底重置 */
  clearEverything(): void {
    this.db.exec('DELETE FROM sentence; DELETE FROM conversation; DELETE FROM word; DELETE FROM config;')
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

  /** 查询句子的正常语速音频路径 */
  getSentenceAudioPath(id: string): string | null {
    const row = this.db.prepare('SELECT audio_path FROM sentence WHERE id = ?').get(id) as
      | { audio_path: string | null }
      | undefined
    return row ? row.audio_path : null
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
}

function rowToConversation(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    topic: row.topic,
    level: row.level as CEFRLevel,
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
