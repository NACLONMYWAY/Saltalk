import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AppDatabase } from '../../src/main/db.ts'
import { AppService, normalizeWord } from '../../src/main/service.ts'
import type { WordRecord } from '../../shared/types.ts'
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

/**
 * 造一个「查词」用的 fetch mock：按词返回音标 + 中文释义。
 *
 * 查词现在只走 Deepseek 一次请求（以前是免费词典 + 翻译两步串行，
 * 而那个免费词典在国内必然卡满 6 秒超时，已在 1.4.6 移除）。
 */
function glossFetch(glosses: Record<string, { phonetic?: string; meaning?: string }>): {
  fetch: typeof fetch
  calls: () => number
  asked: () => string[]
} {
  let calls = 0
  let asked: string[] = []
  const fetchImpl = (async (_u: string | URL | Request, init?: RequestInit) => {
    calls++
    const prompt = String(
      (JSON.parse(String(init?.body)) as { messages: { content: string }[] }).messages[0].content
    )
    asked = (prompt.split('单词：')[1] ?? '').split('\n')[0].split(',').map((s) => s.trim()).filter(Boolean)
    const words = asked.map((w) => ({
      word: w,
      phonetic: glosses[w]?.phonetic ?? null,
      meaning: glosses[w]?.meaning ?? null
    }))
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ words }) } }] })
    } as unknown as Response
  }) as unknown as typeof fetch
  return { fetch: fetchImpl, calls: () => calls, asked: () => asked }
}

/** 查词一路全失败（网络不可用） */
function deadFetch(): typeof fetch {
  return (async () => {
    throw new Error('network down')
  }) as unknown as typeof fetch
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
    const mockFetch = glossFetch({ coffee: { phonetic: '/ˈkɒfi/', meaning: '咖啡' } })
    const svc = new AppService(db, '/tmp/audio', mockFetch.fetch)

    const record = await svc.addWordToBook('coffee', null, null, null)
    await new Promise((r) => setTimeout(r, 20))
    const w = db.getWord(record.id)
    assert.equal(w!.meaning, '咖啡')
    assert.equal(w!.phonetic, '/ˈkɒfi/')
    // 音标与释义来自同一次请求 —— 不再有「先等免费词典超时」那一步
    assert.equal(mockFetch.calls(), 1)
  })
})

describe('enrichMissingWords', () => {
  it('补齐只有例句、没有释义的词（老数据 / 加入时还没查到）', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mockFetch = glossFetch({ coffee: { phonetic: '/ˈkɒfi/', meaning: '咖啡' } })
    const svc = new AppService(db, '/tmp/audio', mockFetch.fetch)

    // 直接插一条「有例句、无释义」的记录：这正是背单词卡片变成空卡的那种数据
    const record: WordRecord = {
      id: 'w-null-mean',
      word: 'coffee',
      meaning: null,
      phonetic: null,
      example: 'I ordered a coffee.',
      exampleTranslation: '我点了一杯咖啡',
      wordAudioPath: null,
      exampleAudioPath: null,
      sourceSentenceId: null,
      addedAt: Date.now(),
      reviewCount: 0,
      nextReviewAt: Date.now(),
      status: 'learning'
    }
    db.addWord(record)

    const done = await svc.enrichMissingWords()
    assert.equal(done, 1)
    const w = db.getWord('w-null-mean')!
    assert.equal(w.meaning, '咖啡')
    assert.equal(w.phonetic, '/ˈkɒfi/')
    // 例句不该被释义流程动过
    assert.equal(w.example, 'I ordered a coffee.')
  })

  it('单词本里没有缺释义的词时返回 0', async () => {
    const svc = new AppService(db, '/tmp/audio', glossFetch({}).fetch)
    assert.equal(await svc.enrichMissingWords(), 0)
  })

  it('查词网络失败时不写入空释义、也不抛错', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const svc = new AppService(db, '/tmp/audio', deadFetch())

    db.addWord({
      id: 'w-fail',
      word: 'coffee',
      meaning: null,
      phonetic: null,
      example: null,
      exampleTranslation: null,
      wordAudioPath: null,
      exampleAudioPath: null,
      sourceSentenceId: null,
      addedAt: Date.now(),
      reviewCount: 0,
      nextReviewAt: Date.now(),
      status: 'learning'
    })

    const done = await svc.enrichMissingWords()
    assert.equal(done, 1)
    assert.equal(db.getWord('w-fail')!.meaning, null)
  })
})

describe('previewWord', () => {
  const coffee = () => glossFetch({ coffee: { phonetic: '/ˈkɒfi/', meaning: '咖啡' } })

  it('未收录的词一次请求就拿到音标 + 中文释义，且不落库', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = coffee()
    const svc = new AppService(db, '/tmp/audio', mock.fetch)

    const p = await svc.previewWord('coffee.')
    assert.equal(p.word, 'coffee') // 首尾标点被清掉
    assert.equal(p.meaning, '咖啡')
    assert.equal(p.phonetic, '/ˈkɒfi/')
    assert.equal(p.inBook, false)
    // 关键：音标与释义来自同一次请求。以前是「免费词典 → 翻译」两步串行，
    // 而那个免费词典在国内必然卡满 6 秒超时，这才是点词慢的根因。
    assert.equal(mock.calls(), 1)
    assert.equal(db.listWords().length, 0, '预览不应该写库')
  })

  it('已在单词本里的词直接读本地，不再走网络', async () => {
    let calls = 0
    const mockFetch = (async () => {
      calls++
      return { ok: true, status: 200, json: async () => [] } as unknown as Response
    }) as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mockFetch)

    const record: WordRecord = {
      id: 'w-known',
      word: 'coffee',
      meaning: '咖啡',
      phonetic: '/ˈkɒfi/',
      example: null,
      exampleTranslation: null,
      wordAudioPath: null,
      exampleAudioPath: null,
      sourceSentenceId: null,
      addedAt: Date.now(),
      reviewCount: 0,
      nextReviewAt: Date.now(),
      status: 'learning'
    }
    db.addWord(record)

    const p = await svc.previewWord('coffee')
    assert.equal(p.meaning, '咖啡')
    assert.equal(p.inBook, true)
    assert.equal(calls, 0, '已在单词本里的词不该再发请求')
  })

  it('同一个词第二次查询命中缓存，只发一次请求', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = coffee()
    const svc = new AppService(db, '/tmp/audio', mock.fetch)

    await svc.previewWord('coffee')
    await svc.previewWord('coffee')
    assert.equal(mock.calls(), 1)
  })

  it('查不到的词短期里不反复打网络（负缓存）', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = glossFetch({})
    const svc = new AppService(db, '/tmp/audio', mock.fetch)

    const first = await svc.previewWord('zzzz')
    assert.equal(first.meaning, null)
    const second = await svc.previewWord('zzzz')
    assert.equal(second.meaning, null)
    // 以前「查不到就不缓存」→ 连点同一个生僻词会一次次重打网络
    assert.equal(mock.calls(), 1, '第二次应该命中负缓存')
  })

  it('无效单词抛错', async () => {
    const svc = new AppService(db, '/tmp/audio', coffee().fetch)
    await assert.rejects(() => svc.previewWord('...'), /无效/)
  })
})

describe('prefetchWords', () => {
  it('整句一次查完，之后点句中任何词都命中缓存（0 次新请求）', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = glossFetch({
      negotiate: { phonetic: '/nɪˈɡoʊʃieɪt/', meaning: '谈判；协商' },
      reception: { phonetic: '/rɪˈsepʃn/', meaning: '接待；前台' },
      colleague: { phonetic: '/ˈkɒliːɡ/', meaning: '同事' }
    })
    const svc = new AppService(db, '/tmp/audio', mock.fetch)

    const n = await svc.prefetchWords(['negotiate', 'reception', 'colleague'])
    assert.equal(n, 3)
    assert.equal(mock.calls(), 1, '三个词应该只发一次请求')

    // 预取之后再点词：不该再有任何网络请求
    const mock2 = mock.calls()
    const p = await svc.previewWord('reception')
    assert.equal(p.meaning, '接待；前台')
    assert.equal(p.phonetic, '/rɪˈsepʃn/')
    assert.equal(mock.calls(), mock2, '预取过的词点开必须是瞬时的')
    assert.equal(db.listWords().length, 0, '预取不应该写库')
  })

  it('已在单词本里的词直接读本地，不占用预取名额', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = glossFetch({ reception: { phonetic: '/rɪˈsepʃn/', meaning: '接待' } })
    const svc = new AppService(db, '/tmp/audio', mock.fetch)

    db.addWord({
      id: 'w-coffee',
      word: 'coffee',
      meaning: '咖啡',
      phonetic: '/ˈkɒfi/',
      example: null,
      exampleTranslation: null,
      wordAudioPath: null,
      exampleAudioPath: null,
      sourceSentenceId: null,
      addedAt: Date.now(),
      reviewCount: 0,
      nextReviewAt: Date.now(),
      status: 'learning'
    })

    await svc.prefetchWords(['coffee', 'reception'])
    // 只查了 reception，coffee 走本地
    assert.deepEqual(mock.asked(), ['reception'])
    // 本地那条也进了缓存：点开同样瞬时
    const p = await svc.previewWord('coffee')
    assert.equal(p.meaning, '咖啡')
    assert.equal(p.inBook, true)
  })

  it('去重、清理标点，且不重复查已经缓存过的词', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = glossFetch({ coffee: { meaning: '咖啡' } })
    const svc = new AppService(db, '/tmp/audio', mock.fetch)

    await svc.prefetchWords(['coffee', 'coffee.', 'COFFEE', '  '])
    assert.deepEqual(mock.asked(), ['coffee'])

    const before = mock.calls()
    await svc.prefetchWords(['coffee'])
    assert.equal(mock.calls(), before, '已缓存的词不该再发请求')
  })

  it('预取失败不写负缓存：用户真点它时仍会重新查一次', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    let calls = 0
    let broken = true
    const flaky = (async (_u: string | URL | Request, init?: RequestInit) => {
      calls++
      if (broken) throw new Error('network down')
      const prompt = String(
        (JSON.parse(String(init?.body)) as { messages: { content: string }[] }).messages[0].content
      )
      const w = (prompt.split('单词：')[1] ?? '').split('\n')[0].trim()
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ words: [{ word: w, phonetic: null, meaning: '咖啡' }] }) } }]
        })
      } as unknown as Response
    }) as unknown as typeof fetch
    const svc = new AppService(db, '/tmp/audio', flaky)

    assert.equal(await svc.prefetchWords(['coffee']), 0)
    assert.equal(calls, 1)

    broken = false
    const p = await svc.previewWord('coffee')
    assert.equal(calls, 2, '预取失败不该把这次失败当成「查不到」钉死')
    assert.equal(p.meaning, '咖啡')
  })

  it('模型漏返回的词不写负缓存（否则会误显示「查不到」）', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    let phase = 0
    const mock = (async (_u: string | URL | Request, init?: RequestInit) => {
      phase++
      const prompt = String(
        (JSON.parse(String(init?.body)) as { messages: { content: string }[] }).messages[0].content
      )
      const asked = (prompt.split('单词：')[1] ?? '')
        .split('\n')[0]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      // 第一次（预取）模型只回了 coffee，漏掉 tea
      const words = (
        phase === 1
          ? asked.filter((w) => w === 'coffee').map((w) => ({ word: w, phonetic: '/ˈkɒfi/', meaning: '咖啡' }))
          : asked.map((w) => ({ word: w, phonetic: '/tiː/', meaning: '茶' }))
      )
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ words }) } }] })
      } as unknown as Response
    }) as unknown as typeof fetch
    const svc = new AppService(db, '/tmp/audio', mock)

    assert.equal(await svc.prefetchWords(['coffee', 'tea']), 1)

    // 点漏掉的那个词：必须重新查，而不是拿负缓存说「查不到」
    const p = await svc.previewWord('tea')
    assert.equal(p.meaning, '茶')
    assert.equal(phase, 2)
  })

  it('没有 apiKey 时直接返回 0，不发请求', async () => {
    let calls = 0
    const spy = (async () => {
      calls++
      return { ok: true, json: async () => ({}) } as unknown as Response
    }) as unknown as typeof fetch
    const svc = new AppService(db, '/tmp/audio', spy)
    assert.equal(await svc.prefetchWords(['coffee']), 0)
    assert.equal(calls, 0)
  })

  it('空列表不发请求', async () => {
    db.setConfig('deepseek_api_key', 'sk-test')
    const mock = glossFetch({})
    const svc = new AppService(db, '/tmp/audio', mock.fetch)
    assert.equal(await svc.prefetchWords([]), 0)
    assert.equal(await svc.prefetchWords(['  ', '...']), 0)
    assert.equal(mock.calls(), 0)
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
