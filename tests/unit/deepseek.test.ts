import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, parseDialogueResponse, extractJson, generateDialogue, translateWord } from '../../src/main/deepseek.ts'

const VALID_JSON = JSON.stringify({
  title: 'At the cafe',
  difficulty: 'B1',
  dialogue: [
    { speaker: 'A', english: 'Hi, what would you like?', chinese: '你好，你想要点什么？' },
    { speaker: 'B', english: 'A coffee, please.', chinese: '请来一杯咖啡。' }
  ]
})

describe('buildPrompt', () => {
  it('包含主题与难度', () => {
    const p = buildPrompt('点咖啡', 'B1')
    assert.ok(p.includes('点咖啡'))
    assert.ok(p.includes('B1'))
    assert.ok(p.includes('A') && p.includes('B'))
  })

  it('不同难度对应不同描述', () => {
    const a1 = buildPrompt('t', 'A1')
    const c2 = buildPrompt('t', 'C2')
    assert.ok(a1.includes('入门'))
    assert.ok(c2.includes('精通'))
    assert.notEqual(a1, c2)
  })
})

describe('parseDialogueResponse', () => {
  it('解析合法 JSON', () => {
    const d = parseDialogueResponse(VALID_JSON)
    assert.equal(d.title, 'At the cafe')
    assert.equal(d.dialogue.length, 2)
    assert.equal(d.dialogue[0].speaker, 'A')
    assert.equal(d.dialogue[0].english, 'Hi, what would you like?')
    assert.equal(d.dialogue[1].chinese, '请来一杯咖啡。')
  })

  it('兼容 markdown 代码块包裹', () => {
    const d = parseDialogueResponse('```json\n' + VALID_JSON + '\n```')
    assert.equal(d.title, 'At the cafe')
  })

  it('兼容前后杂散文字', () => {
    const d = parseDialogueResponse('好的，这是对话：' + VALID_JSON + ' 希望对你有帮助')
    assert.equal(d.title, 'At the cafe')
  })

  it('对非法 JSON 抛错', () => {
    assert.throws(() => parseDialogueResponse('这不是 JSON'), /JSON/)
  })

  it('对缺少 title 抛错', () => {
    const bad = JSON.stringify({ dialogue: [{ speaker: 'A', english: 'x', chinese: 'y' }, { speaker: 'B', english: 'z', chinese: 'w' }] })
    assert.throws(() => parseDialogueResponse(bad), /title/)
  })

  it('对空 dialogue 抛错', () => {
    const bad = JSON.stringify({ title: 't', dialogue: [] })
    assert.throws(() => parseDialogueResponse(bad), /dialogue/)
  })

  it('对非法 speaker 抛错', () => {
    const bad = JSON.stringify({
      title: 't',
      dialogue: [
        { speaker: 'A', english: 'x', chinese: 'y' },
        { speaker: 'C', english: 'z', chinese: 'w' }
      ]
    })
    assert.throws(() => parseDialogueResponse(bad), /格式错误/)
  })

  it('对单人对话抛错', () => {
    const bad = JSON.stringify({
      title: 't',
      dialogue: [
        { speaker: 'A', english: 'x', chinese: 'y' },
        { speaker: 'A', english: 'z', chinese: 'w' }
      ]
    })
    assert.throws(() => parseDialogueResponse(bad), /双人/)
  })
})

describe('extractJson', () => {
  it('提取纯 JSON', () => {
    assert.equal(extractJson('{"a":1}'), '{"a":1}')
  })
  it('提取代码块内 JSON', () => {
    assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}')
  })
  it('提取前后缀包裹的 JSON', () => {
    assert.equal(extractJson('前缀{"a":1}后缀'), '{"a":1}')
  })
})

describe('generateDialogue', () => {
  it('成功时返回解析后的对话', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: VALID_JSON } }] })
      }) as unknown as Response) as typeof fetch
    const d = await generateDialogue({ apiKey: 'sk-test', topic: 'coffee', level: 'B1' }, mockFetch)
    assert.equal(d.title, 'At the cafe')
  })

  it('HTTP 非 2xx 时抛错', async () => {
    const mockFetch = (async () =>
      ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response) as typeof fetch
    await assert.rejects(
      () => generateDialogue({ apiKey: 'bad', topic: 'coffee', level: 'B1' }, mockFetch),
      /401/
    )
  })

  it('内容为空时抛错', async () => {
    const mockFetch = (async () =>
      ({ ok: true, json: async () => ({ choices: [] }) }) as unknown as Response) as typeof fetch
    await assert.rejects(
      () => generateDialogue({ apiKey: 'sk', topic: 'coffee', level: 'B1' }, mockFetch),
      /为空/
    )
  })
})

describe('translateWord', () => {
  it('返回中文释义', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '咖啡' } }] })
      }) as unknown as Response) as typeof fetch
    const zh = await translateWord('coffee', 'sk-test', mockFetch)
    assert.equal(zh, '咖啡')
  })

  it('HTTP 错误时抛错', async () => {
    const mockFetch = (async () =>
      ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response) as typeof fetch
    await assert.rejects(() => translateWord('coffee', 'bad', mockFetch), /401/)
  })
})
