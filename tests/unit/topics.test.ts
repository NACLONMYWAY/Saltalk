import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CET_TOPIC_LIBRARY,
  IELTS_TOPIC_LIBRARY,
  SYSTEM_TOPICS,
  TOPIC_LIBRARY,
  allTopics,
  randomTopic
} from '../../shared/topics.ts'
import { EXAM_SYSTEMS } from '../../shared/exams.ts'

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
    assert.equal(randomTopic('cefr', () => 0), all[0])
    assert.equal(randomTopic('cefr', () => 0.999), all[all.length - 1])
  })

  it('越界随机数被安全夹取到有效范围', () => {
    const all = allTopics()
    assert.equal(randomTopic('cefr', () => -1), all[0])
    assert.equal(randomTopic('cefr', () => 2), all[all.length - 1])
  })

  it('按体系取题：四六级不会拿到 CEFR 的日常题库', () => {
    const cet = allTopics('cet')
    assert.ok(cet.includes('选课与退课'))
    assert.ok(!cet.includes('点咖啡'))
    assert.ok(cet.every((t) => cet.includes(t)))
    for (let i = 0; i < 50; i++) {
      assert.ok(cet.includes(randomTopic('cet')))
    }
  })

  it('雅思题库偏生活事务与学术讨论', () => {
    const ielts = allTopics('ielts')
    assert.ok(ielts.includes('租房咨询'))
    assert.ok(ielts.includes('小组作业分工'))
    assert.ok(!ielts.includes('点咖啡'))
  })
})

describe('SYSTEM_TOPICS', () => {
  it('三套体系各有独立题库且分类合法', () => {
    assert.deepEqual(Object.keys(SYSTEM_TOPICS).sort(), [...EXAM_SYSTEMS].sort())
    for (const system of EXAM_SYSTEMS) {
      const lib = SYSTEM_TOPICS[system]
      assert.ok(lib.length >= 2, `${system} 题库分类过少`)
      for (const c of lib) {
        assert.ok(c.category.length > 0)
        assert.ok(c.topics.length > 0)
      }
    }
  })

  it('同一体系内主题不重复', () => {
    for (const system of EXAM_SYSTEMS) {
      const all = allTopics(system)
      assert.equal(new Set(all).size, all.length, `${system} 题库存在重复主题`)
    }
  })

  it('CEFR / 雅思 / 四六级 题库互不相同', () => {
    assert.notDeepEqual(allTopics('cefr'), allTopics('cet'))
    assert.notDeepEqual(allTopics('cefr'), allTopics('ielts'))
    assert.notDeepEqual(allTopics('cet'), allTopics('ielts'))
    assert.notEqual(TOPIC_LIBRARY, CET_TOPIC_LIBRARY)
    assert.notEqual(TOPIC_LIBRARY, IELTS_TOPIC_LIBRARY)
  })
})
