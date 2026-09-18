import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AppDatabase } from '../../src/main/db.ts'
import { AppService, normalizeWord } from '../../src/main/service.ts'
import { cetJson as cetFixture } from './helpers/cetFixture.ts'

const VALID_JSON = JSON.stringify({
  title: 'At the cafe',
  difficulty: 'B1',
  dialogue: [
    { speaker: 'A', english: 'Hi, what would you like?', chinese: '你好，你想要点什么？' },
    { speaker: 'B', english: 'A coffee, please.', chinese: '请来一杯咖啡。' }
  ]
})

/** 词数达标的四六级听力题（词数不足会被 parseCetResponse 拦下） */
function cetJson(questionCount = 4): string {
  return cetFixture({ questionCount })
}

let db: AppDatabase
let service: AppService

beforeEach(() => {
  db = new AppDatabase(':memory:')
  service = new AppService(db, '/tmp/audio')
})

afterEach(() => {
  db.close()
})

describe('normalizeWord', () => {
  it('去除首尾标点与空白', () => {
    assert.equal(normalizeWord('  coffee.  '), 'coffee')
    assert.equal(normalizeWord('"hello",'), 'hello')
    assert.equal(normalizeWord("'world'"), 'world')
  })

  it('保留词内连字符与撇号', () => {
    assert.equal(normalizeWord("don't"), "don't")
    assert.equal(normalizeWord('well-known'), 'well-known')
  })

  it('纯标点返回空串', () => {
    assert.equal(normalizeWord('...'), '')
  })
})

describe('generateAndSave - 对话模式（CEFR / 雅思）', () => {
  it('生成对话并持久化，system 一并落库', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: VALID_JSON } }] })
      }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    const result = await svc.generateAndSave('coffee', 'cefr', 'B1', 'sk-test')
    assert.ok(result.conversationId)
    assert.equal(result.mode, 'conversation')
    assert.equal(result.dialogue.dialogue.length, 2)
    assert.deepEqual(result.questions, [])

    const sentences = db.getSentences(result.conversationId)
    assert.equal(sentences.length, 2)
    assert.equal(sentences[0].speaker, 'A')
    assert.equal(sentences[1].speaker, 'B')

    const conv = db.getConversation(result.conversationId)
    assert.equal(conv!.topic, 'coffee')
    assert.equal(conv!.system, 'cefr')
    assert.equal(conv!.level, 'B1')
  })

  it('雅思体系使用雅思分档作为 level', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: VALID_JSON } }] })
      }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    const result = await svc.generateAndSave('travel', 'ielts', '6.5', 'sk-test')
    assert.equal(result.system, 'ielts')
    assert.equal(result.mode, 'conversation')
    assert.equal(db.getConversation(result.conversationId)!.level, '6.5')
  })
})

describe('generateAndSave - 考试模式（四六级）', () => {
  it('生成对话 + 4 道选择题并落库', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: cetJson(4) } }] })
      }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    const result = await svc.generateAndSave('图书馆借书', 'cet', 'CET4', 'sk-test')
    assert.equal(result.mode, 'exam')
    assert.equal(result.system, 'cet')
    assert.equal(result.questions.length, 4)
    assert.equal(result.dialogue.questions!.length, 4)

    const stored = db.getQuestions(result.conversationId)
    assert.equal(stored.length, 4)
    assert.equal(stored[0].seq, 0)
    assert.equal(stored[3].seq, 3)
    assert.deepEqual(stored[1].options, ['a1', 'b1', 'c1', 'd1'])
    assert.equal(stored[1].answerIndex, 1)
    assert.equal(stored[0].ttsStatus, 'pending')

    assert.equal(db.getConversation(result.conversationId)!.system, 'cet')
  })

  it('题目数量不对时自动重试，重试仍不对则抛错', async () => {
    let calls = 0
    const mockFetch = (async () => {
      calls++
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: cetJson(3) } }] })
      } as unknown as Response
    }) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    await assert.rejects(() => svc.generateAndSave('t', 'cet', 'CET4', 'sk'), /题目数量/)
    assert.equal(calls, 2, '应当刚好重试一次')
    assert.equal(db.listConversations().length, 0, '失败时不应写入任何对话')
  })

  it('选项重复时视为不合规', async () => {
    const bad = cetFixture({ options: ['same', 'same', 'x', 'y'] })
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: bad } }] })
      }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    await assert.rejects(() => svc.generateAndSave('t', 'cet', 'CET4', 'sk'), /重复/)
  })

  it('对话词数不足时视为不合规（难度会偏低）', async () => {
    const short = cetFixture({ minWords: 40 })
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: short } }] })
      }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    await assert.rejects(() => svc.generateAndSave('t', 'cet', 'CET4', 'sk'), /过短/)
    assert.equal(db.listConversations().length, 0)
  })
})

describe('addWordToBook', () => {
  it('快速插入单词（释义后台补全）', async () => {
    const mockFetch = (async () =>
      ({ ok: true, status: 200, json: async () => [] }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    const record = await svc.addWordToBook('coffee.', 's1', 'I ordered a coffee.', '我点了一杯咖啡')
    assert.equal(record.word, 'coffee')
    assert.equal(record.example, 'I ordered a coffee.')
    assert.equal(record.exampleTranslation, '我点了一杯咖啡')
    assert.equal(record.meaning, null)
    assert.equal(record.status, 'learning')
  })

  it('重复单词抛错', async () => {
    const mockFetch = (async () => ({ ok: true }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)
    await svc.addWordToBook('coffee', null, null, null)
    await assert.rejects(() => svc.addWordToBook('coffee', null, null, null), /已有该单词/)
  })

  it('无效单词抛错', async () => {
    const mockFetch = (async () => ({ ok: true }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)
    await assert.rejects(() => svc.addWordToBook('...', null, null, null), /无效/)
  })

  it('后台补全中文释义与音标', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mockFetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('dictionaryapi')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { word: 'coffee', phonetic: '/ˈkɒfi/', meanings: [{ definitions: [{ definition: 'a hot drink' }] }] }
          ]
        } as unknown as Response
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '咖啡' } }] })
      } as unknown as Response
    }) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    const record = await svc.addWordToBook('coffee', null, null, null)
    await new Promise((r) => setTimeout(r, 20))
    const w = db.getWord(record.id)
    assert.equal(w!.meaning, '咖啡')
    assert.equal(w!.phonetic, '/ˈkɒfi/')
  })
})

describe('reviewWord', () => {
  it('记得后复习次数递增', async () => {
    const mockFetch = (async () => ({ ok: true }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)
    const record = await svc.addWordToBook('coffee', null, null, null)

    svc.reviewWord(record.id, true)
    const after = db.getWord(record.id)
    assert.equal(after!.reviewCount, 1)
    assert.equal(after!.status, 'learning')
  })

  it('忘记后复习次数重置', async () => {
    const mockFetch = (async () => ({ ok: true }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)
    const record = await svc.addWordToBook('coffee', null, null, null)
    svc.reviewWord(record.id, true)
    svc.reviewWord(record.id, false)

    const after = db.getWord(record.id)
    assert.equal(after!.reviewCount, 0)
  })

  it('不存在的单词抛错', () => {
    assert.throws(() => service.reviewWord('nope', true), /不存在/)
  })
})

describe('getWordStats', () => {
  it('返回统计结果', async () => {
    const mockFetch = (async () => ({ ok: true }) as unknown as Response) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)
    await svc.addWordToBook('coffee', null, null, null)

    const stats = svc.getWordStats()
    assert.equal(stats.totalWords, 1)
    assert.equal(stats.learningWords, 1)
    assert.equal(stats.masteredWords, 0)
  })
})
