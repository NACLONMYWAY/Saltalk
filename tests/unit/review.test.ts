import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DAY_MS, initialNextReview, reviewWord, REVIEW_INTERVALS_DAYS } from '../../shared/review.ts'

const NOW = 1_700_000_000_000

describe('initialNextReview', () => {
  it('新词 1 天后复习', () => {
    assert.equal(initialNextReview(NOW), NOW + DAY_MS)
  })
})

describe('reviewWord - 记得', () => {
  it('第一次记得：count 0→1，2 天后复习', () => {
    const r = reviewWord(NOW, 0, true)
    assert.equal(r.reviewCount, 1)
    assert.equal(r.nextReviewAt, NOW + 2 * DAY_MS)
    assert.equal(r.status, 'learning')
  })

  it('间隔随复习次数递增', () => {
    const r1 = reviewWord(NOW, 1, true)
    assert.equal(r1.nextReviewAt, NOW + 4 * DAY_MS)
    const r2 = reviewWord(NOW, 2, true)
    assert.equal(r2.nextReviewAt, NOW + 7 * DAY_MS)
    const r3 = reviewWord(NOW, 3, true)
    assert.equal(r3.nextReviewAt, NOW + 15 * DAY_MS)
  })

  it('第 5 次记得后变为 mastered，30 天后复习', () => {
    const r = reviewWord(NOW, 4, true)
    assert.equal(r.reviewCount, 5)
    assert.equal(r.nextReviewAt, NOW + 30 * DAY_MS)
    assert.equal(r.status, 'mastered')
  })

  it('已 mastered 再记得仍保持 mastered', () => {
    const r = reviewWord(NOW, 5, true)
    assert.equal(r.status, 'mastered')
    assert.equal(r.nextReviewAt, NOW + REVIEW_INTERVALS_DAYS[5] * DAY_MS)
  })
})

describe('reviewWord - 忘记', () => {
  it('忘记后 count 重置为 0，1 天后复习，回到 learning', () => {
    const r = reviewWord(NOW, 4, false)
    assert.equal(r.reviewCount, 0)
    assert.equal(r.nextReviewAt, NOW + DAY_MS)
    assert.equal(r.status, 'learning')
  })
})
