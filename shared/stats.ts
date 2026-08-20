import type { WordRecord } from './types.ts'

export interface WordStats {
  totalWords: number
  learningWords: number
  masteredWords: number
  dueWords: number
}

/** 计算单词本统计：总数、学习中、已掌握、今日待复习 */
export function computeWordStats(words: WordRecord[], now: number): WordStats {
  let learning = 0
  let mastered = 0
  let due = 0
  for (const w of words) {
    if (w.status === 'mastered') {
      mastered++
    } else {
      learning++
      if (w.nextReviewAt <= now) due++
    }
  }
  return { totalWords: words.length, learningWords: learning, masteredWords: mastered, dueWords: due }
}
