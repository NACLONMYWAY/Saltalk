import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CET_SPECS,
  DEFAULT_LEVELS,
  EXAM_SYSTEMS,
  SYSTEM_LABEL,
  cetSpecOf,
  isExamLevel,
  isExamSystem,
  levelDisplay,
  levelOption,
  levelsOf,
  modeOf,
  normalizeLevel
} from '../../shared/exams.ts'
import {
  ACCENT_GROUPS,
  DEFAULT_NARRATOR_VOICE,
  DEFAULT_VOICES,
  FALLBACK_VOICE,
  VOICE_LIBRARY,
  isKnownVoice,
  voiceFingerprint,
  voicesByAccent
} from '../../shared/voices.ts'

describe('难度体系', () => {
  it('提供 CEFR / 雅思 / 四六级 三套体系', () => {
    assert.deepEqual(EXAM_SYSTEMS, ['cefr', 'ielts', 'cet'])
    assert.equal(SYSTEM_LABEL.ielts, '雅思')
    assert.equal(SYSTEM_LABEL.cet, '四六级')
  })

  it('只有四六级走考试听力题模式', () => {
    assert.equal(modeOf('cefr'), 'conversation')
    assert.equal(modeOf('ielts'), 'conversation')
    assert.equal(modeOf('cet'), 'exam')
  })

  it('isExamSystem 能挡住非法值', () => {
    assert.ok(isExamSystem('cet'))
    assert.ok(isExamSystem('cefr'))
    assert.ok(!isExamSystem('toefl'))
    assert.ok(!isExamSystem(null))
    assert.ok(!isExamSystem(undefined))
  })
})

describe('CEFR 等级', () => {
  it('是 A1–C2 六级', () => {
    assert.deepEqual(
      levelsOf('cefr').map((l) => l.id),
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    )
  })

  it('默认档为 B1', () => {
    assert.equal(DEFAULT_LEVELS.cefr, 'B1')
  })
})

describe('雅思等级', () => {
  it('4.0–9.0 且每 0.5 分一档，共 11 档', () => {
    const ids = levelsOf('ielts').map((l) => l.id)
    assert.equal(ids.length, 11)
    assert.equal(ids[0], '4.0')
    assert.equal(ids[ids.length - 1], '9.0')
    for (let i = 0; i < ids.length; i++) {
      assert.equal(Number(ids[i]), 4 + i * 0.5)
    }
  })

  it('每档都有难度描述', () => {
    for (const opt of levelsOf('ielts')) {
      assert.ok(opt.desc.length > 0, `${opt.id} 缺少描述`)
    }
  })

  it('默认档为 6.0', () => {
    assert.equal(DEFAULT_LEVELS.ielts, '6.0')
  })
})

describe('四六级等级', () => {
  it('只有四级与六级两档', () => {
    assert.deepEqual(
      levelsOf('cet').map((l) => l.id),
      ['CET4', 'CET6']
    )
  })

  it('长对话规格与真题一致：四级 240–280 词 / 六级 280–320 词，均 4 题', () => {
    assert.deepEqual(CET_SPECS.CET4.words, [240, 280])
    assert.deepEqual(CET_SPECS.CET6.words, [280, 320])
    assert.deepEqual(CET_SPECS.CET4.wpm, [120, 140])
    assert.deepEqual(CET_SPECS.CET6.wpm, [140, 160])
    assert.equal(CET_SPECS.CET4.questions, 4)
    assert.equal(CET_SPECS.CET6.questions, 4)
  })

  it('每档都写明词汇带、语域、答案策略与题型配比（决定生成难度的核心）', () => {
    for (const spec of [CET_SPECS.CET4, CET_SPECS.CET6]) {
      assert.ok(spec.vocab.length > 20, `${spec.label} 缺少词汇带说明`)
      assert.ok(spec.register.length > 20, `${spec.label} 缺少语域说明`)
      assert.ok(spec.answerStyle.length > 20, `${spec.label} 缺少答案与干扰项策略`)
      assert.ok(spec.questionMix.length > 10, `${spec.label} 缺少题型配比`)
      assert.ok(spec.summary.length > 10, `${spec.label} 缺少设置页摘要`)
    }
  })

  it('六级难度定位高于四级（词汇量与同义替换要求）', () => {
    // 四级「所听即所得」，六级需要同义替换与推理
    assert.ok(CET_SPECS.CET4.answerStyle.includes('90%'))
    assert.ok(CET_SPECS.CET6.answerStyle.includes('70%'))
    assert.ok(CET_SPECS.CET6.answerStyle.includes('同义'))
    // 六级明确要求熟词僻义
    assert.ok(CET_SPECS.CET6.vocab.includes('熟词僻义'))
    assert.ok(CET_SPECS.CET4.vocab.includes('4500'))
    assert.ok(CET_SPECS.CET6.vocab.includes('5500'))
  })

  it('未知等级回落到四级规格', () => {
    assert.equal(cetSpecOf('CET4').id, 'CET4')
    assert.equal(cetSpecOf('CET6').id, 'CET6')
    assert.equal(cetSpecOf('???').id, 'CET4')
  })

  it('isExamLevel 只对四六级等级成立', () => {
    assert.ok(isExamLevel('cet', 'CET4'))
    assert.ok(isExamLevel('cet', 'CET6'))
    assert.ok(!isExamLevel('cet', 'B1'))
    assert.ok(!isExamLevel('cefr', 'CET4'))
  })
})

describe('normalizeLevel', () => {
  it('等级属于当前体系时原样保留', () => {
    assert.equal(normalizeLevel('cefr', 'C1'), 'C1')
    assert.equal(normalizeLevel('ielts', '7.5'), '7.5')
    assert.equal(normalizeLevel('cet', 'CET6'), 'CET6')
  })

  it('跨体系的残留等级会被收敛到默认档', () => {
    assert.equal(normalizeLevel('ielts', 'B1'), '6.0')
    assert.equal(normalizeLevel('cet', 'B1'), 'CET4')
    assert.equal(normalizeLevel('cefr', 'CET6'), 'B1')
    assert.equal(normalizeLevel('cefr', '6.5'), 'B1')
  })

  it('空值回落到默认档', () => {
    assert.equal(normalizeLevel('cefr', null), 'B1')
    assert.equal(normalizeLevel('ielts', undefined), '6.0')
    assert.equal(normalizeLevel('cet', ''), 'CET4')
  })
})

describe('levelDisplay', () => {
  it('CEFR / 雅思带体系名前缀，四六级直接用级别名', () => {
    assert.equal(levelDisplay('cefr', 'B2'), 'CEFR B2')
    assert.equal(levelDisplay('ielts', '6.5'), '雅思 6.5')
    assert.equal(levelDisplay('cet', 'CET4'), '四级')
  })

  it('未知等级也能给出可读文本', () => {
    assert.equal(levelDisplay('ielts', 'x'), '雅思 x')
  })
})

describe('levelOption', () => {
  it('命中时返回描述，未命中返回 null', () => {
    assert.ok(levelOption('cefr', 'A1')!.desc.includes('入门'))
    assert.ok(levelOption('cefr', 'C2')!.desc.includes('精通'))
    assert.equal(levelOption('cet', 'B1'), null)
  })
})

describe('音色池', () => {
  it('数量足够多，不再只有两种', () => {
    assert.ok(VOICE_LIBRARY.length >= 20, `音色数量偏少：${VOICE_LIBRARY.length}`)
  })

  it('音色 id 全局唯一，且都是英语音色', () => {
    const ids = new Set(VOICE_LIBRARY.map((v) => v.id))
    assert.equal(ids.size, VOICE_LIBRARY.length)
    for (const v of VOICE_LIBRARY) {
      assert.ok(v.id.startsWith('en-'), `${v.id} 不是英语音色`)
      assert.ok(v.id.endsWith('Neural'), `${v.id} 命名异常`)
    }
  })

  it('每个音色都有显示名与特征描述', () => {
    for (const v of VOICE_LIBRARY) {
      assert.ok(v.label.length > 0)
      assert.ok(v.note.length > 0)
    }
  })

  it('口音分组覆盖到库中所有音色', () => {
    const grouped = new Set(voicesByAccent().flatMap((g) => g.voices.map((v) => v.id)))
    assert.equal(grouped.size, VOICE_LIBRARY.length)
    assert.deepEqual(
      ACCENT_GROUPS[0],
      { accent: 'en-US', label: '美音' }
    )
  })

  it('中国香港的英语音色标注为中国香港', () => {
    const hk = VOICE_LIBRARY.filter((v) => v.accent === 'en-HK')
    assert.ok(hk.length > 0)
    for (const v of hk) {
      assert.ok(v.note.includes('中国香港'), `${v.id} 未标注中国香港`)
    }
  })

  it('isKnownVoice 能挡住非法值', () => {
    assert.ok(isKnownVoice('en-US-GuyNeural'))
    assert.ok(isKnownVoice('en-GB-SoniaNeural'))
    assert.ok(!isKnownVoice('zh-CN-XiaoxiaoNeural'))
    assert.ok(!isKnownVoice(''))
    assert.ok(!isKnownVoice(null))
  })
})

describe('音色指纹', () => {
  it('短、稳定、可用于文件名', () => {
    const fp = voiceFingerprint('en-US-GuyNeural')
    assert.ok(fp.length > 0 && fp.length <= 5)
    assert.match(fp, /^[a-z0-9]+$/)
    assert.equal(fp, voiceFingerprint('en-US-GuyNeural'))
  })

  it('不同音色指纹不同（决定换音色后会重新合成）', () => {
    const prints = new Set(VOICE_LIBRARY.map((v) => voiceFingerprint(v.id)))
    // 允许极小概率碰撞，但绝不能大面积相同
    assert.ok(prints.size >= VOICE_LIBRARY.length - 1, `指纹区分度不足：${prints.size}/${VOICE_LIBRARY.length}`)
  })
})

describe('默认音色', () => {
  it('CEFR / 雅思维持美音男女（Guy + Jenny）', () => {
    assert.equal(DEFAULT_VOICES.cefr.a, 'en-US-GuyNeural')
    assert.equal(DEFAULT_VOICES.cefr.b, 'en-US-JennyNeural')
    assert.equal(DEFAULT_VOICES.ielts.a, 'en-US-GuyNeural')
    assert.equal(DEFAULT_VOICES.ielts.b, 'en-US-JennyNeural')
  })

  it('四六级默认美音 + 英音混搭，贴近真题口音分布', () => {
    assert.equal(DEFAULT_VOICES.cet.a, 'en-US-GuyNeural')
    assert.equal(DEFAULT_VOICES.cet.b, 'en-GB-SoniaNeural')
    assert.notEqual(DEFAULT_VOICES.cet.a, DEFAULT_VOICES.cet.b)
  })

  it('所有默认音色都在音色池内', () => {
    for (const system of EXAM_SYSTEMS) {
      assert.ok(isKnownVoice(DEFAULT_VOICES[system].a), `${system} 的 A 音色不在池内`)
      assert.ok(isKnownVoice(DEFAULT_VOICES[system].b), `${system} 的 B 音色不在池内`)
    }
    assert.ok(isKnownVoice(DEFAULT_NARRATOR_VOICE))
    assert.ok(isKnownVoice(FALLBACK_VOICE))
  })
})
