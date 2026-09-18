import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { AppDatabase } from '../../src/main/db.ts'
import type { QuestionRecord, WordRecord } from '../../shared/types.ts'

let db: AppDatabase

beforeEach(() => {
  db = new AppDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

describe('AppDatabase - config', () => {
  it('returns null for missing key', () => {
    assert.equal(db.getConfig('missing'), null)
  })

  it('writes and reads a value', () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    assert.equal(db.getConfig('deepseek_api_key'), 'sk-test')
  })

  it('upserts an existing key', () => {
    db.setConfig('deepseek_api_key', 'sk-first')
    db.setConfig('deepseek_api_key', 'sk-second')
    assert.equal(db.getConfig('deepseek_api_key'), 'sk-second')
  })
})

describe('AppDatabase - conversation', () => {
  it('creates and reads a conversation', () => {
    db.createConversation('c1', '点咖啡', 'cefr', 'B1', 'At the cafe', 1700000000000)
    const conv = db.getConversation('c1')
    assert.ok(conv)
    assert.equal(conv!.topic, '点咖啡')
    assert.equal(conv!.system, 'cefr')
    assert.equal(conv!.level, 'B1')
    assert.equal(conv!.title, 'At the cafe')
    assert.equal(conv!.createdAt, 1700000000000)
  })

  it('keeps the difficulty system for ielts / cet', () => {
    db.createConversation('c1', 't', 'ielts', '6.5', 'x', 1)
    db.createConversation('c2', 't', 'cet', 'CET4', 'y', 2)
    assert.equal(db.getConversation('c1')!.system, 'ielts')
    assert.equal(db.getConversation('c1')!.level, '6.5')
    assert.equal(db.getConversation('c2')!.system, 'cet')
    assert.equal(db.getConversation('c2')!.level, 'CET4')
  })

  it('returns null for missing conversation', () => {
    assert.equal(db.getConversation('nope'), null)
  })

  it('lists conversations ordered by created_at desc', () => {
    db.createConversation('c1', 't1', 'cefr', 'A1', 'one', 1000)
    db.createConversation('c2', 't2', 'cefr', 'A1', 'two', 2000)
    const list = db.listConversations()
    assert.deepEqual(
      list.map((c) => c.id),
      ['c2', 'c1']
    )
  })

  it('deletes a conversation together with its sentences and questions', () => {
    db.createConversation('c1', 't1', 'cet', 'CET4', 'one', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.insertQuestion(questionRecord({ id: 'q1', conversationId: 'c1' }))
    db.deleteConversation('c1')
    assert.equal(db.getConversation('c1'), null)
    assert.equal(db.getSentences('c1').length, 0)
    assert.equal(db.getQuestions('c1').length, 0)
  })

  it('clears all data', () => {
    db.createConversation('c1', 't1', 'cet', 'CET4', 'one', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.insertQuestion(questionRecord({ id: 'q1', conversationId: 'c1' }))
    db.addWord(baseWord())
    db.clearAllData()
    assert.equal(db.listConversations().length, 0)
    assert.equal(db.listWords().length, 0)
    assert.equal(db.countQuestions(), 0)
  })
})

describe('AppDatabase - sentence', () => {
  it('inserts and reads sentences in seq order', () => {
    db.createConversation('c1', 't', 'cefr', 'A2', 'title', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.insertSentence('s2', 'c1', 1, 'B', 'Hi there', '嗨')
    const sentences = db.getSentences('c1')
    assert.equal(sentences.length, 2)
    assert.equal(sentences[0].id, 's1')
    assert.equal(sentences[0].seq, 0)
    assert.equal(sentences[0].speaker, 'A')
    assert.equal(sentences[0].english, 'Hello')
    assert.equal(sentences[0].chinese, '你好')
    assert.equal(sentences[0].ttsStatus, 'pending')
    assert.equal(sentences[1].speaker, 'B')
  })

  it('updates sentence audio status', () => {
    db.createConversation('c1', 't', 'cefr', 'A2', 'title', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.updateSentenceAudio('s1', '/audio/s1.mp3', '/audio/s1_slow.mp3', 'done')
    const [s] = db.getSentences('c1')
    assert.equal(s.audioPath, '/audio/s1.mp3')
    assert.equal(s.slowAudioPath, '/audio/s1_slow.mp3')
    assert.equal(s.ttsStatus, 'done')
  })
})

describe('AppDatabase - question', () => {
  it('inserts and reads questions in seq order with options intact', () => {
    db.createConversation('c1', 't', 'cet', 'CET4', 'title', 1000)
    db.insertQuestion(
      questionRecord({
        id: 'q2',
        conversationId: 'c1',
        seq: 1,
        stem: 'What does the man suggest?',
        stemChinese: '男士建议什么？',
        options: ['Take a bus', 'Walk home', 'Call a taxi', 'Stay longer'],
        answerIndex: 2,
        explanation: '男士说…'
      })
    )
    db.insertQuestion(questionRecord({ id: 'q1', conversationId: 'c1', seq: 0 }))
    const qs = db.getQuestions('c1')
    assert.equal(qs.length, 2)
    assert.equal(qs[0].id, 'q1')
    assert.equal(qs[0].seq, 0)
    assert.equal(qs[1].id, 'q2')
    assert.deepEqual(qs[1].options, ['Take a bus', 'Walk home', 'Call a taxi', 'Stay longer'])
    assert.equal(qs[1].answerIndex, 2)
    assert.equal(qs[1].stemChinese, '男士建议什么？')
    assert.equal(qs[1].explanation, '男士说…')
    assert.equal(qs[1].ttsStatus, 'pending')
    assert.equal(qs[1].stemAudioPath, null)
  })

  it('updates stem audio status', () => {
    db.createConversation('c1', 't', 'cet', 'CET4', 'title', 1000)
    db.insertQuestion(questionRecord({ id: 'q1', conversationId: 'c1' }))
    db.updateQuestionAudio('q1', '/audio/q_c1_0.mp3', 'done')
    const [q] = db.getQuestions('c1')
    assert.equal(q.stemAudioPath, '/audio/q_c1_0.mp3')
    assert.equal(q.ttsStatus, 'done')
  })

  it('returns an empty list when the conversation has no questions', () => {
    db.createConversation('c1', 't', 'cefr', 'B1', 'title', 1000)
    assert.deepEqual(db.getQuestions('c1'), [])
  })
})

describe('AppDatabase - 全新安装必须是空库', () => {
  it('首次创建的库不含任何用户数据（单词本/历史/题目/句子）', () => {
    // 把「朋友装完拿到的是干净 APP」这个保证固化成测试：
    // 任何人都不能往 schema 或启动流程里塞种子数据，否则这里会红
    assert.equal(db.countConversations(), 0)
    assert.equal(db.countSentences(), 0)
    assert.equal(db.countQuestions(), 0)
    assert.equal(db.countWords(), 0)
    assert.deepEqual(db.listConversations(), [])
    assert.deepEqual(db.listWords(), [])
    assert.deepEqual(db.getDueWords(Date.now()), [])
  })

  it('首次创建的库不含 API Key，也不含任何配置项', () => {
    assert.equal(db.getConfig('deepseek_api_key'), null)
    assert.equal(db.getConfig('exam_system'), null)
    assert.equal(db.getConfig('last_level'), null)
    assert.equal(db.getConfig('voice_a'), null)
    assert.equal(db.getConfig('voice_b'), null)
    assert.equal(db.getConfig('voice_narrator'), null)
  })

  it('全新库的句子/题目查询返回空数组而不是报错', () => {
    assert.deepEqual(db.getSentences('nope'), [])
    assert.deepEqual(db.getQuestions('nope'), [])
    assert.equal(db.getConversation('nope'), null)
  })
})

describe('AppDatabase - 清空数据不会误伤配置', () => {
  it('clearAllData 清掉内容但保留 API Key（刻意设计）', () => {
    db.setConfig('deepseek_api_key', 'sk-keepme')
    db.createConversation('c1', 't', 'cefr', 'A1', 'x', 1)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hi', '你好')
    db.addWord(baseWord())

    db.clearAllData()

    assert.equal(db.countConversations(), 0)
    assert.equal(db.countWords(), 0)
    assert.equal(db.getConfig('deepseek_api_key'), 'sk-keepme', '清空数据不应清掉 API Key')
  })

  it('clearEverything 才会连配置一起清掉', () => {
    db.setConfig('deepseek_api_key', 'sk-keepme')
    db.clearEverything()
    assert.equal(db.getConfig('deepseek_api_key'), null)
  })
})

describe('AppDatabase - migration', () => {
  it('旧版库（无 system 列）升级后补列，且老记录一律视为 cefr', () => {
    const dir = mkdtempSync(join(tmpdir(), 'saltalk-migrate-'))
    const file = join(dir, 'app.db')

    // 用裸 sqlite 造一个 1.3.x 结构的旧库
    const raw = new Database(file)
    raw.exec(`
      CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE conversation (
        id TEXT PRIMARY KEY, topic TEXT NOT NULL, level TEXT NOT NULL, title TEXT, created_at INTEGER NOT NULL
      );
      CREATE TABLE sentence (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, seq INTEGER NOT NULL, speaker TEXT NOT NULL,
        english TEXT NOT NULL, chinese TEXT NOT NULL, audio_path TEXT, slow_audio_path TEXT,
        tts_status TEXT DEFAULT 'pending'
      );
      CREATE TABLE word (
        id TEXT PRIMARY KEY, word TEXT NOT NULL, meaning TEXT, phonetic TEXT, example TEXT,
        example_translation TEXT, word_audio_path TEXT, example_audio_path TEXT, source_sentence_id TEXT,
        added_at INTEGER NOT NULL, review_count INTEGER DEFAULT 0, next_review_at INTEGER NOT NULL,
        status TEXT DEFAULT 'learning'
      );
    `)
    raw
      .prepare('INSERT INTO conversation (id, topic, level, title, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('old1', '点咖啡', 'B1', 'At the cafe', 1000)
    raw
      .prepare('INSERT INTO sentence (id, conversation_id, seq, speaker, english, chinese) VALUES (?, ?, ?, ?, ?, ?)')
      .run('s1', 'old1', 0, 'A', 'Hi', '你好')
    raw.close()

    const migrated = new AppDatabase(file)

    const conv = migrated.getConversation('old1')
    assert.ok(conv)
    assert.equal(conv!.system, 'cefr')
    assert.equal(conv!.level, 'B1')
    assert.equal(conv!.topic, '点咖啡')

    // 老数据无损
    assert.equal(migrated.getSentences('old1').length, 1)
    // 新表已建好
    assert.deepEqual(migrated.getQuestions('old1'), [])
    assert.equal(migrated.countConversations(), 1)

    migrated.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('迁移时清理孤儿句子（旧版删对话不级联）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'saltalk-orphan-'))
    const file = join(dir, 'app.db')

    const raw = new Database(file)
    raw.exec(`
      CREATE TABLE conversation (id TEXT PRIMARY KEY, topic TEXT NOT NULL, level TEXT NOT NULL, title TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE sentence (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, seq INTEGER NOT NULL, speaker TEXT NOT NULL, english TEXT NOT NULL, chinese TEXT NOT NULL, audio_path TEXT, slow_audio_path TEXT, tts_status TEXT DEFAULT 'pending');
    `)
    raw
      .prepare('INSERT INTO sentence (id, conversation_id, seq, speaker, english, chinese) VALUES (?, ?, ?, ?, ?, ?)')
      .run('orphan', 'ghost-conversation', 0, 'A', 'Hello', '你好')
    raw.close()

    const migrated = new AppDatabase(file)
    assert.equal(migrated.countSentences(), 0)
    migrated.close()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('AppDatabase - word', () => {
  it('adds and reads a word', () => {
    db.addWord(baseWord())
    const w = db.getWord('w1')
    assert.ok(w)
    assert.equal(w!.word, 'coffee')
    assert.equal(w!.meaning, '咖啡')
    assert.equal(w!.phonetic, '/ˈkɒfi/')
  })

  it('deletes a word', () => {
    db.addWord(baseWord())
    db.deleteWord('w1')
    assert.equal(db.getWord('w1'), null)
  })

  it('returns only due words that are still learning', () => {
    db.addWord(baseWord({ id: 'due1', nextReviewAt: 500, status: 'learning' }))
    db.addWord(baseWord({ id: 'future', nextReviewAt: 9999, status: 'learning' }))
    db.addWord(baseWord({ id: 'mastered', nextReviewAt: 500, status: 'mastered' }))
    const due = db.getDueWords(1000)
    assert.deepEqual(
      due.map((w) => w.id),
      ['due1']
    )
  })

  it('updates review state', () => {
    db.addWord(baseWord())
    db.updateWordReview('w1', 3, 9000, 'mastered')
    const w = db.getWord('w1')
    assert.equal(w!.reviewCount, 3)
    assert.equal(w!.nextReviewAt, 9000)
    assert.equal(w!.status, 'mastered')
  })

  it('marks word mastered / unmastered', () => {
    db.addWord(baseWord())
    db.markWordMastered('w1', true)
    assert.equal(db.getWord('w1')!.status, 'mastered')
    db.markWordMastered('w1', false)
    assert.equal(db.getWord('w1')!.status, 'learning')
  })

  it('counts words and sentences', () => {
    db.addWord(baseWord({ id: 'w1' }))
    db.addWord(baseWord({ id: 'w2', word: 'tea' }))
    db.createConversation('c1', 't', 'cefr', 'A1', 'title', 1)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    assert.equal(db.countWords(), 2)
    assert.equal(db.countSentences(), 1)
  })
})

function baseWord(overrides: Partial<WordRecord> = {}): WordRecord {
  return {
    id: 'w1',
    word: 'coffee',
    meaning: '咖啡',
    phonetic: '/ˈkɒfi/',
    example: 'I ordered a coffee.',
    exampleTranslation: '我点了一杯咖啡',
    wordAudioPath: null,
    exampleAudioPath: null,
    sourceSentenceId: 's1',
    addedAt: 1000,
    reviewCount: 0,
    nextReviewAt: 1000,
    status: 'learning',
    ...overrides
  }
}

function questionRecord(overrides: Partial<QuestionRecord> = {}): QuestionRecord {
  return {
    id: 'q1',
    conversationId: 'c1',
    seq: 0,
    stem: 'What are the speakers mainly discussing?',
    stemChinese: '说话人主要在讨论什么？',
    options: ['A trip plan', 'A job offer', 'A new project', 'A class schedule'],
    answerIndex: 0,
    explanation: '对话开头提到…',
    stemAudioPath: null,
    ttsStatus: 'pending',
    ...overrides
  }
}
