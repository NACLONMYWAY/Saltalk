import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeWordStats } from '../../shared/stats.ts'
import type { WordRecord } from '../../shared/types.ts'

const NOW = 1_700_000_000_000

function word(overrides: Partial<WordRecord> = {}): WordRecord {
  return {
    id: 'w',
    word: 'test',
    meaning: null,
    phonetic: null,
    example: null,
    exampleTranslation: null,
    wordAudioPath: null,
    exampleAudioPath: null,
    sourceSentenceId: null,
    addedAt: 0,
    reviewCount: 0,
    nextReviewAt: NOW + 1000,
    status: 'learning',
    ...overrides
  }
}

describe('computeWordStats', () => {
  it('空列表返回全 0', () => {
    assert.deepEqual(computeWordStats([], NOW), {
      totalWords: 0,
      learningWords: 0,
      masteredWords: 0,
      dueWords: 0
    })
  })

  it('统计混合状态', () => {
    const words = [
      word({ id: 'a', status: 'learning', nextReviewAt: NOW - 1 }),
      word({ id: 'b', status: 'learning', nextReviewAt: NOW + 1 }),
      word({ id: 'c', status: 'mastered' })
    ]
    const s = computeWordStats(words, NOW)
    assert.equal(s.totalWords, 3)
    assert.equal(s.learningWords, 2)
    assert.equal(s.masteredWords, 1)
    assert.equal(s.dueWords, 1)
  })

  it('复习时间恰等于 now 视为到期', () => {
    const words = [word({ id: 'a', nextReviewAt: NOW })]
    assert.equal(computeWordStats(words, NOW).dueWords, 1)
  })
})
