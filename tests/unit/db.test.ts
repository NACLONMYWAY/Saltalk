import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AppDatabase } from '../../src/main/db.ts'
import type { WordRecord } from '../../shared/types.ts'

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
    db.createConversation('c1', '点咖啡', 'B1', 'At the cafe', 1700000000000)
    const conv = db.getConversation('c1')
    assert.ok(conv)
    assert.equal(conv!.topic, '点咖啡')
    assert.equal(conv!.level, 'B1')
    assert.equal(conv!.title, 'At the cafe')
    assert.equal(conv!.createdAt, 1700000000000)
  })

  it('returns null for missing conversation', () => {
    assert.equal(db.getConversation('nope'), null)
  })

  it('lists conversations ordered by created_at desc', () => {
    db.createConversation('c1', 't1', 'A1', 'one', 1000)
    db.createConversation('c2', 't2', 'A1', 'two', 2000)
    const list = db.listConversations()
    assert.deepEqual(
      list.map((c) => c.id),
      ['c2', 'c1']
    )
  })

  it('deletes a conversation and its sentences', () => {
    db.createConversation('c1', 't1', 'A1', 'one', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.deleteConversation('c1')
    assert.equal(db.getConversation('c1'), null)
    assert.equal(db.getSentences('c1').length, 0)
  })

  it('clears all data', () => {
    db.createConversation('c1', 't1', 'A1', 'one', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.addWord({
      id: 'w1',
      word: 'coffee',
      meaning: '咖啡',
      phonetic: null,
      example: null,
      exampleTranslation: null,
      wordAudioPath: null,
      exampleAudioPath: null,
      sourceSentenceId: null,
      addedAt: 1000,
      reviewCount: 0,
      nextReviewAt: 1000,
      status: 'learning'
    })
    db.clearAllData()
    assert.equal(db.listConversations().length, 0)
    assert.equal(db.listWords().length, 0)
  })
})

describe('AppDatabase - sentence', () => {
  it('inserts and reads sentences in seq order', () => {
    db.createConversation('c1', 't', 'A2', 'title', 1000)
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
    db.createConversation('c1', 't', 'A2', 'title', 1000)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    db.updateSentenceAudio('s1', '/audio/s1.mp3', '/audio/s1_slow.mp3', 'done')
    const [s] = db.getSentences('c1')
    assert.equal(s.audioPath, '/audio/s1.mp3')
    assert.equal(s.slowAudioPath, '/audio/s1_slow.mp3')
    assert.equal(s.ttsStatus, 'done')
  })
})

describe('AppDatabase - word', () => {
  const baseWord = (overrides: Partial<WordRecord> = {}): WordRecord => ({
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
  })

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
    db.createConversation('c1', 't', 'A1', 'title', 1)
    db.insertSentence('s1', 'c1', 0, 'A', 'Hello', '你好')
    assert.equal(db.countWords(), 2)
    assert.equal(db.countSentences(), 1)
  })
})
