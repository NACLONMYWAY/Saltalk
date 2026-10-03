import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseDictionaryResponse, lookupWord } from '../../src/main/dictionary.ts'

describe('parseDictionaryResponse', () => {
  it('解析完整响应', () => {
    const data = [
      {
        word: 'coffee',
        phonetic: '/ˈkɒfi/',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'a hot drink made from roasted beans', example: 'I had a coffee.' }]
          }
        ]
      }
    ]
    const r = parseDictionaryResponse(data)
    assert.ok(r)
    assert.equal(r!.word, 'coffee')
    assert.equal(r!.phonetic, '/ˈkɒfi/')
    assert.equal(r!.meaning, 'a hot drink made from roasted beans')
    assert.equal(r!.example, 'I had a coffee.')
  })

  it('空数组返回 null', () => {
    assert.equal(parseDictionaryResponse([]), null)
  })

  it('缺失可选字段时用 null 填充', () => {
    const data = [{ word: 'x' }]
    const r = parseDictionaryResponse(data)
    assert.ok(r)
    assert.equal(r!.phonetic, null)
    assert.equal(r!.meaning, null)
  })

  it('非数组返回 null', () => {
    assert.equal(parseDictionaryResponse({}), null)
  })
})

describe('lookupWord', () => {
  it('查词成功返回释义', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [{ word: 'coffee', phonetic: '/ˈkɒfi/', meanings: [{ definitions: [{ definition: 'a drink' }] }] }]
      }) as unknown as Response) as typeof fetch
    const r = await lookupWord('coffee', mockFetch)
    assert.ok(r)
    assert.equal(r!.meaning, 'a drink')
  })

  it('404 返回 null', async () => {
    const mockFetch = (async () =>
      ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response) as typeof fetch
    assert.equal(await lookupWord('notaword', mockFetch), null)
  })

  it('网络错误抛错', async () => {
    const mockFetch = (async () =>
      ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response) as typeof fetch
    await assert.rejects(() => lookupWord('coffee', mockFetch), /500/)
  })
})
