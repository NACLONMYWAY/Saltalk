import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TOPIC_LIBRARY, allTopics, randomTopic } from '../../shared/topics.ts'

describe('TOPIC_LIBRARY', () => {
  it('包含多个分类且每个分类有主题', () => {
    assert.ok(TOPIC_LIBRARY.length >= 3)
    for (const c of TOPIC_LIBRARY) {
      assert.ok(c.category.length > 0)
      assert.ok(c.topics.length > 0)
      assert.ok(c.topics.every((t) => typeof t === 'string' && t.length > 0))
    }
  })

  it('主题不重复', () => {
    const all = allTopics()
    assert.equal(new Set(all).size, all.length)
  })
})

describe('allTopics', () => {
  it('返回扁平化后的全部主题', () => {
    const all = allTopics()
    const expectedCount = TOPIC_LIBRARY.reduce((sum, c) => sum + c.topics.length, 0)
    assert.equal(all.length, expectedCount)
  })
})

describe('randomTopic', () => {
  it('返回主题库中的某个主题', () => {
    const all = allTopics()
    for (let i = 0; i < 50; i++) {
      assert.ok(all.includes(randomTopic()))
    }
  })

  it('注入固定随机数时返回确定结果', () => {
    const all = allTopics()
    assert.equal(randomTopic(() => 0), all[0])
    assert.equal(randomTopic(() => 0.999), all[all.length - 1])
  })

  it('越界随机数被安全夹取到有效范围', () => {
    const all = allTopics()
    assert.equal(randomTopic(() => -1), all[0])
    assert.equal(randomTopic(() => 2), all[all.length - 1])
  })
})
