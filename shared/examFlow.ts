/**
 * 四六级答题流程的纯逻辑。
 *
 * 之所以单独抽出来：题目播放、15 秒倒计时、判分、推进这几步是整场考试最容易出错的地方
 * （越界、漏答、把未作答算成答对），但它们本身与 React 无关。
 * 抽成纯函数后可以直接单元测试，而不需要起一个 GUI 才能验证。
 */

/** 真题：每个问题后留 15 秒答题时间 */
export const ANSWER_SECONDS = 15

/** 四选一的选项标号 */
export const OPTION_LABELS = ['A', 'B', 'C', 'D']

export type ExamPhase = 'idle' | 'dialogue' | 'stem' | 'answering' | 'answered' | 'finished'

/**
 * 由当前题号推下一题题号；已经是最后一题时返回 null（表示本轮结束）。
 * 用 null 而不是 -1 / 题总数 之类的哨兵值，避免调用方忘记判断边界。
 */
export function nextQuestionIndex(current: number, total: number): number | null {
  if (total <= 0) return null
  if (current < 0) return 0
  const next = current + 1
  return next < total ? next : null
}

/** 是否已作答（未作答/null/undefined 都算没答） */
export function isAnswered(answer: number | null | undefined): boolean {
  return typeof answer === 'number' && Number.isInteger(answer)
}

/** 判分。未作答一律算错，不能因为两边都是 undefined 就判对 */
export function isCorrect(
  answer: number | null | undefined,
  correctIndex: number,
  optionCount = OPTION_LABELS.length
): boolean {
  if (!isAnswered(answer)) return false
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionCount) return false
  return answer === correctIndex
}

/**
 * 统计答对题数。
 * 以题目为准遍历，多余的作答会被忽略；缺失的作答按未答处理。
 */
export function countCorrect(
  answers: ReadonlyArray<number | null | undefined>,
  questions: ReadonlyArray<{ answerIndex: number }>,
  optionCount = OPTION_LABELS.length
): number {
  let n = 0
  for (let i = 0; i < questions.length; i++) {
    if (isCorrect(answers[i], questions[i].answerIndex, optionCount)) n++
  }
  return n
}

/** 选项标号，越界时回落到 "?"，避免界面上出现 undefined */
export function optionLabel(index: number | null | undefined): string {
  if (!isAnswered(index)) return '?'
  return OPTION_LABELS[index as number] ?? '?'
}
