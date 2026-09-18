import type { DialogueLine } from '../../../shared/types.ts'

/**
 * 四六级测试用的对话夹具。
 *
 * 1.4.2 起 `parseCetResponse` 会校验对话词数是否落在真题区间（四级 240–280 词），
 * 词数不足会判定「信息量不足、难度偏低」并抛错。所以测试里的对话必须写够长度，
 * 否则测的就不是原本要测的东西了。
 */
const SENTENCE =
  'I was wondering whether the department has finally approved the revised proposal that we ' +
  'submitted last month, because the original budget estimate no longer reflects the additional ' +
  'equipment costs we discussed at the meeting.'

export function countWords(lines: ReadonlyArray<{ english: string }>): number {
  return lines.reduce(
    (n, l) => n + l.english.trim().split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).length,
    0
  )
}

/** 造一段词数达标的双人对话，默认满足四级 240 词的下限要求 */
export function cetDialogue(minWords = 250): DialogueLine[] {
  const lines: DialogueLine[] = []
  let i = 0
  while (countWords(lines) < minWords) {
    lines.push({
      speaker: i % 2 === 0 ? 'A' : 'B',
      english: SENTENCE,
      chinese: `第 ${i + 1} 句的中文翻译`
    })
    i++
  }
  return lines
}

export interface CetJsonOptions {
  questionCount?: number
  minWords?: number
  options?: string[]
}

/** 构造一份合法的四六级听力题 JSON 文本 */
export function cetJson(opts: CetJsonOptions = {}): string {
  const { questionCount = 4, minWords = 250, options } = opts
  return JSON.stringify({
    title: '图书馆借书',
    level: 'CET4',
    dialogue: cetDialogue(minWords),
    questions: Array.from({ length: questionCount }, (_, i) => ({
      stem: `What does the woman say about item ${i + 1}?`,
      stemChinese: `女士关于第 ${i + 1} 项说了什么？`,
      options: options ?? [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
      answerIndex: i % 4,
      explanation: `依据第 ${i + 1} 句。`
    }))
  })
}
