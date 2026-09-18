import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  OPTION_COUNT,
  buildCetPrompt,
  buildPrompt,
  countEnglishWords,
  extractJson,
  generateDialogue,
  generateExamDialogue,
  parseCetResponse,
  parseDialogueResponse,
  translateWord
} from '../../src/main/deepseek.ts'
import { cetDialogue, cetJson, countWords } from './helpers/cetFixture.ts'

const VALID_JSON = JSON.stringify({
  title: 'At the cafe',
  difficulty: 'B1',
  dialogue: [
    { speaker: 'A', english: 'Hi, what would you like?', chinese: '你好，你想要点什么？' },
    { speaker: 'B', english: 'A coffee, please.', chinese: '请来一杯咖啡。' }
  ]
})

/** 词数达标的四六级听力题（词数不足会被新的校验拦下） */
function cetPayload(questionCount = 4): string {
  return cetJson({ questionCount })
}

describe('buildPrompt（CEFR / 雅思对话）', () => {
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

  it('雅思等级也能生成对应的难度描述', () => {
    const p = buildPrompt('travel', '6.5', 'ielts')
    assert.ok(p.includes('雅思 6.5'))
    assert.ok(p.includes('合格使用者'))
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

describe('buildCetPrompt（四六级听力题）', () => {
  it('写入四级真题规格：词数区间与题量', () => {
    const p = buildCetPrompt('图书馆借书', 'CET4')
    assert.ok(p.includes('四级'))
    assert.ok(p.includes('240–280'))
    assert.ok(p.includes('四选一'))
    assert.ok(p.includes('4 题') || p.includes('共 4 题'))
  })

  it('六级使用更长的对话与更快的语速', () => {
    const p4 = buildCetPrompt('t', 'CET4')
    const p6 = buildCetPrompt('t', 'CET6')
    assert.ok(p6.includes('六'))
    assert.ok(p6.includes('280–320'))
    assert.notEqual(p4, p6)
  })

  it('明确要求题干不印在试卷上、只由录音朗读', () => {
    const p = buildCetPrompt('t', 'CET4')
    assert.ok(p.includes('录音朗读'))
    assert.ok(p.includes('不会印在试卷上'))
  })

  it('明确要求出题顺序与对话推进顺序一致', () => {
    const p = buildCetPrompt('t', 'CET4')
    assert.ok(p.includes('出题顺序与对话推进顺序'))
  })

  it('写入决定难度的四项：词汇带、语域、答案策略、题型配比', () => {
    const p4 = buildCetPrompt('t', 'CET4')
    assert.ok(p4.includes('4500'), '四级应写明大纲词汇量')
    assert.ok(p4.includes('所听即所得'), '四级应写明「所听即所得」的答案策略')
    assert.ok(p4.includes('细节题'), '四级应写明题型配比')

    const p6 = buildCetPrompt('t', 'CET6')
    assert.ok(p6.includes('5500'), '六级应写明大纲词汇量')
    assert.ok(p6.includes('熟词僻义'), '六级应要求熟词僻义')
    assert.ok(p6.includes('同义'), '六级应要求同义替换')
    assert.ok(p6.includes('推理'), '六级应包含推理题要求')
  })

  it('关键回归：不再出现「不要写难」的表述', () => {
    const p = buildCetPrompt('t', 'CET4')
    assert.ok(
      !p.includes('不要出现明显超纲的艰深词汇'),
      '旧版这句会主动把难度拉低，是「难度严重不符」的主因之一'
    )
    assert.ok(p.includes('必须达到真题的真实难度'))
  })

  it('写入信号词与答案位置规律（真题定位依据）', () => {
    const p = buildCetPrompt('t', 'CET6')
    assert.ok(p.includes('however'), '应点明转折信号词')
    assert.ok(p.includes('开头两个回合内'), '应点明第 1 题答案的位置规律')
  })

  it('要求复合句式与信息密度，避免通篇短句', () => {
    const p = buildCetPrompt('t', 'CET4')
    assert.ok(p.includes('复合结构'))
    assert.ok(p.includes('不要通篇短句'))
  })
})

describe('countEnglishWords', () => {
  it('按空白切分并忽略纯标点片段', () => {
    assert.equal(countEnglishWords([{ english: 'one two three' }]), 3)
    assert.equal(countEnglishWords([{ english: 'one two three' }, { english: 'four five' }]), 5)
    assert.equal(countEnglishWords([{ english: '— ... !' }]), 0)
  })

  it('多空格与首尾空白不影响计数', () => {
    assert.equal(countEnglishWords([{ english: '  a   b  ' }]), 2)
  })
})

describe('parseCetResponse', () => {
  it('解析合法的四六级听力题', () => {
    const d = parseCetResponse(cetPayload(4), 4, 'CET4')
    assert.equal(d.title, '图书馆借书')
    assert.equal(d.difficulty, 'CET4')
    assert.equal(d.dialogue.length, cetDialogue().length)
    assert.equal(d.questions!.length, 4)
    assert.deepEqual(d.questions![1].options, ['a1', 'b1', 'c1', 'd1'])
    assert.equal(d.questions![1].answerIndex, 1)
    assert.equal(d.questions![0].stemChinese, '女士关于第 1 项说了什么？')
    assert.equal(d.questions![0].explanation, '依据第 1 句。')
  })

  it('题量不符抛错', () => {
    assert.throws(() => parseCetResponse(cetPayload(3), 4, 'CET4'), /题目数量/)
  })

  it('缺少 questions 抛错', () => {
    const bad = JSON.stringify({ title: 't', dialogue: cetDialogue() })
    assert.throws(() => parseCetResponse(bad, 4, 'CET4'), /questions/)
  })

  it('关键回归：对话词数不足时抛错（否则难度会明显偏低）', () => {
    const tooShort = JSON.stringify({
      title: 't',
      dialogue: [
        { speaker: 'A', english: 'How long can I keep this book?', chinese: '这本书我能借多久？' },
        { speaker: 'B', english: 'Two weeks.', chinese: '两周。' }
      ],
      questions: JSON.parse(cetPayload(4)).questions
    })
    assert.throws(() => parseCetResponse(tooShort, 4, 'CET4'), /过短/)
  })

  it('对话词数远超真题区间时抛错', () => {
    const tooLong = cetJson({ minWords: 700 })
    assert.throws(() => parseCetResponse(tooLong, 4, 'CET4'), /过长/)
  })

  it('词数刚好达标时不报错（边界）', () => {
    const lines = cetDialogue(210)
    assert.ok(countWords(lines) >= Math.floor(240 * 0.85), '夹具本身要达标')
    assert.doesNotThrow(() => parseCetResponse(cetJson({ minWords: 210 }), 4, 'CET4'))
  })

  it('选项数量不是 4 个抛错', () => {
    const bad = JSON.parse(cetPayload(4))
    bad.questions[2].options = ['only', 'three', 'here']
    assert.throws(() => parseCetResponse(JSON.stringify(bad), 4, 'CET4'), /选项数量/)
  })

  it('选项重复抛错', () => {
    const bad = JSON.parse(cetPayload(4))
    bad.questions[0].options = ['x', 'x', 'y', 'z']
    assert.throws(() => parseCetResponse(JSON.stringify(bad), 4, 'CET4'), /重复/)
  })

  it('答案下标越界抛错', () => {
    const bad = JSON.parse(cetPayload(4))
    bad.questions[0].answerIndex = 4
    assert.throws(() => parseCetResponse(JSON.stringify(bad), 4, 'CET4'), /answerIndex/)
  })

  it('答案下标不是整数抛错', () => {
    const bad = JSON.parse(cetPayload(4))
    bad.questions[0].answerIndex = 1.5
    assert.throws(() => parseCetResponse(JSON.stringify(bad), 4, 'CET4'), /answerIndex/)
  })

  it('题干为空抛错', () => {
    const bad = JSON.parse(cetPayload(4))
    bad.questions[0].stem = '   '
    assert.throws(() => parseCetResponse(JSON.stringify(bad), 4, 'CET4'), /题干/)
  })

  it('对话不是双人抛错', () => {
    const bad = JSON.parse(cetPayload(4))
    bad.dialogue = [
      { speaker: 'A', english: 'a', chinese: '甲' },
      { speaker: 'A', english: 'b', chinese: '乙' }
    ]
    assert.throws(() => parseCetResponse(JSON.stringify(bad), 4, 'CET4'), /双人/)
  })

  it('缺失中文解析时降级为 null 而不是报错', () => {
    const ok = JSON.parse(cetPayload(4))
    ok.questions[0].explanation = ''
    ok.questions[0].stemChinese = ''
    const d = parseCetResponse(JSON.stringify(ok), 4, 'CET4')
    assert.equal(d.questions![0].explanation, null)
    assert.equal(d.questions![0].stemChinese, '')
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

describe('generateExamDialogue', () => {
  it('首次就合规时不重试', async () => {
    let calls = 0
    const mockFetch = (async () => {
      calls++
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: cetPayload(4) } }] })
      } as unknown as Response
    }) as typeof fetch
    const d = await generateExamDialogue({ apiKey: 'sk', topic: 't', level: 'CET4' }, mockFetch)
    assert.equal(d.questions!.length, 4)
    assert.equal(calls, 1)
  })

  it('首次不合规时自动重试并成功', async () => {
    let calls = 0
    const mockFetch = (async () => {
      calls++
      const content = calls === 1 ? cetPayload(3) : cetPayload(4)
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] })
      } as unknown as Response
    }) as typeof fetch
    const d = await generateExamDialogue({ apiKey: 'sk', topic: 't', level: 'CET4' }, mockFetch)
    assert.equal(calls, 2)
    assert.equal(d.questions!.length, 4)
  })

  it('两次都不合规时抛错并说明已重试', async () => {
    const mockFetch = (async () =>
      ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: cetPayload(2) } }] })
      }) as unknown as Response) as typeof fetch
    await assert.rejects(
      () => generateExamDialogue({ apiKey: 'sk', topic: 't', level: 'CET4' }, mockFetch),
      /已自动重试一次仍失败/
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
