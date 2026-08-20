import type { WordStatus } from './types.ts'

export const DAY_MS = 24 * 60 * 60 * 1000

/** 艾宾浩斯间隔序列（天），索引 0 用于初始/忘记后重置 */
export const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30]

/** 新词加入时的首次复习时间（1 天后） */
export function initialNextReview(now: number): number {
  return now + REVIEW_INTERVALS_DAYS[0] * DAY_MS
}

export interface ReviewOutcome {
  reviewCount: number
  nextReviewAt: number
  status: WordStatus
}

/**
 * 计算一次复习后的新状态。
 * @param now 当前时间戳
 * @param currentCount 当前已连续「记得」次数
 * @param remembered 本次是否记得
 */
export function reviewWord(now: number, currentCount: number, remembered: boolean): ReviewOutcome {
  if (remembered) {
    const nextCount = currentCount + 1
    const interval = REVIEW_INTERVALS_DAYS[Math.min(nextCount, REVIEW_INTERVALS_DAYS.length - 1)]
    const status: WordStatus = nextCount >= 5 ? 'mastered' : 'learning'
    return { reviewCount: nextCount, nextReviewAt: now + interval * DAY_MS, status }
  }
  return {
    reviewCount: 0,
    nextReviewAt: now + REVIEW_INTERVALS_DAYS[0] * DAY_MS,
    status: 'learning'
  }
}
