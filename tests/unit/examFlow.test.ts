import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANSWER_SECONDS,
  OPTION_LABELS,
  countCorrect,
  examIntroText,
  isAnswered,
  isCorrect,
  nextQuestionIndex,
  optionLabel,
  spokenStem
} from '../../shared/examFlow.ts'

describe('ANSWER_SECONDS', () => {
  it('与真题一致：每题 15 秒', () => {
    assert.equal(ANSWER_SECONDS, 15)
  })
})

describe('OPTION_LABELS', () => {
  it('四选一标号 A–D', () => {
    assert.deepEqual(OPTION_LABELS, ['A', 'B', 'C', 'D'])
  })
})

describe('nextQuestionIndex', () => {
  it('还有下一题时返回下一题题号', () => {
    assert.equal(nextQuestionIndex(0, 4), 1)
    assert.equal(nextQuestionIndex(1, 4), 2)
    assert.equal(nextQuestionIndex(2, 4), 3)
  })

  it('最后一题返回 null（本轮结束）', () => {
    assert.equal(nextQuestionIndex(3, 4), null)
    assert.equal(nextQuestionIndex(0, 1), null)
  })

  it('没有题目时返回 null，不会推进', () => {
    assert.equal(nextQuestionIndex(0, 0), null)
    assert.equal(nextQuestionIndex(-1, 0), null)
  })

  it('题号为负时从头开始', () => {
    assert.equal(nextQuestionIndex(-1, 4), 0)
  })
})

describe('isAnswered', () => {
  it('整数选项视为已作答（含 0）', () => {
    assert.ok(isAnswered(0))
    assert.ok(isAnswered(3))
  })

  it('未作答的各种表示都判为否', () => {
    assert.ok(!isAnswered(null))
    assert.ok(!isAnswered(undefined))
    assert.ok(!isAnswered(1.5))
    assert.ok(!isAnswered(NaN))
  })
})

describe('isCorrect', () => {
  it('答对与答错', () => {
    assert.ok(isCorrect(0, 0))
    assert.ok(isCorrect(3, 3))
    assert.ok(!isCorrect(1, 0))
  })

  it('未作答一律算错', () => {
    assert.ok(!isCorrect(null, 0))
    assert.ok(!isCorrect(undefined, 0))
  })

  it('关键回归：答案下标非法时不算答对', () => {
    assert.ok(!isCorrect(0, 4), '下标 4 越界，不能算对')
    assert.ok(!isCorrect(0, -1))
    assert.ok(!isCorrect(0, 1.5))
  })

  it('支持自定义选项数量', () => {
    assert.ok(!isCorrect(3, 3, 3))
    assert.ok(isCorrect(2, 2, 3))
  })
})

describe('countCorrect', () => {
  const questions = [{ answerIndex: 0 }, { answerIndex: 1 }, { answerIndex: 2 }, { answerIndex: 3 }]

  it('全部答对', () => {
    assert.equal(countCorrect([0, 1, 2, 3], questions), 4)
  })

  it('部分答对', () => {
    assert.equal(countCorrect([0, 3, 2, 0], questions), 2)
  })

  it('关键回归：全部未作答时得 0 分', () => {
    // 早期实现写成 a === questions[i].answerIndex，undefined === undefined 会被误判为答对
    assert.equal(countCorrect([null, null, null, null], questions), 0)
    assert.equal(countCorrect([undefined, undefined, undefined, undefined], questions), 0)
    assert.equal(countCorrect([], questions), 0)
  })

  it('超时未答的题目算错，已答的照常计分', () => {
    assert.equal(countCorrect([0, null, 2, undefined], questions), 2)
  })

  it('多余的作答被忽略（以题目数量为准）', () => {
    assert.equal(countCorrect([0, 1, 2, 3, 0, 1, 2, 3], questions), 4)
  })

  it('没有题目时得 0 分', () => {
    assert.equal(countCorrect([0, 1], []), 0)
  })
})

describe('spokenStem', () => {
  it('题干朗读文本带题号（真题里播音员连题号一起念）', () => {
    assert.equal(
      spokenStem(0, 'What does the man suggest the woman do?'),
      'Question 1. What does the man suggest the woman do?'
    )
    assert.equal(spokenStem(3, 'Why does the woman prefer the bus?'), 'Question 4. Why does the woman prefer the bus?')
  })

  it('题号从 1 开始，不与数组下标混淆', () => {
    assert.ok(spokenStem(0, 'x').startsWith('Question 1.'))
    assert.ok(spokenStem(1, 'x').startsWith('Question 2.'))
  })

  it('题干首尾空白被清理，不会念出多余停顿', () => {
    assert.equal(spokenStem(0, '  What time is it?  '), 'Question 1. What time is it?')
  })
})

describe('examIntroText', () => {
  it('与真题引导语一致', () => {
    assert.equal(examIntroText(4), 'Questions 1 to 4 are based on the conversation you have just heard.')
    assert.equal(examIntroText(8), 'Questions 1 to 8 are based on the conversation you have just heard.')
  })

  it('题量非法时兜底为 1，不会产出「1 to 0」这种病句', () => {
    assert.ok(examIntroText(0).includes('Questions 1 to 1'))
    assert.ok(examIntroText(-3).includes('Questions 1 to 1'))
  })
})

describe('optionLabel', () => {
  it('正常下标映射到 A–D', () => {
    assert.equal(optionLabel(0), 'A')
    assert.equal(optionLabel(1), 'B')
    assert.equal(optionLabel(2), 'C')
    assert.equal(optionLabel(3), 'D')
  })

  it('未作答或越界回落为 ?，不会渲染出 undefined', () => {
    assert.equal(optionLabel(null), '?')
    assert.equal(optionLabel(undefined), '?')
    assert.equal(optionLabel(9), '?')
    assert.equal(optionLabel(-1), '?')
  })
})
