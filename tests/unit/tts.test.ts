import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { audioCacheKey, introCacheKey, questionCacheKey, rateValue } from '../../src/main/tts.ts'

const GUY = 'en-US-GuyNeural'

describe('audioCacheKey', () => {
  it('文件名包含对话、序号、角色、音色指纹', () => {
    const key = audioCacheKey('c1', 0, 'A', GUY)
    assert.match(key, /^c1_0_A_[a-z0-9]+\.mp3$/)
  })

  it('同一入参生成完全相同的文件名（缓存可命中）', () => {
    assert.equal(audioCacheKey('c1', 0, 'A', GUY), audioCacheKey('c1', 0, 'A', GUY))
  })

  it('不同句子/角色产生不同文件名', () => {
    const keys = new Set([
      audioCacheKey('c1', 0, 'A', GUY),
      audioCacheKey('c1', 0, 'B', GUY),
      audioCacheKey('c1', 1, 'A', GUY)
    ])
    assert.equal(keys.size, 3)
  })

  it('换音色会产生不同的文件名（这是修掉串音问题的关键）', () => {
    const withGuy = audioCacheKey('c1', 0, 'A', GUY)
    const withChristopher = audioCacheKey('c1', 0, 'A', 'en-US-ChristopherNeural')
    assert.notEqual(withGuy, withChristopher)
  })

  it('慢速与正常语速用不同文件名', () => {
    const normal = audioCacheKey('c1', 0, 'A', GUY, false)
    const slow = audioCacheKey('c1', 0, 'A', GUY, true)
    assert.notEqual(normal, slow)
    assert.ok(slow.includes('_slow'))
    assert.ok(!normal.includes('_slow'))
  })
})

describe('questionCacheKey', () => {
  it('题干音频以 q_ 前缀命名，并与音色绑定', () => {
    const a = questionCacheKey('c1', 0, 'en-US-AriaNeural')
    const b = questionCacheKey('c1', 0, GUY)
    assert.match(a, /^q_c1_0_[a-z0-9]+\.mp3$/)
    assert.notEqual(a, b)
  })

  it('不会与句子音频混淆', () => {
    assert.notEqual(questionCacheKey('c1', 0, GUY), audioCacheKey('c1', 0, 'A', GUY))
  })
})

describe('introCacheKey', () => {
  it('引导语按题量+音色缓存，不同对话可共用同一个文件', () => {
    const a = introCacheKey(4, 'en-US-AriaNeural')
    const b = introCacheKey(4, 'en-US-AriaNeural')
    assert.equal(a, b, '同样的题量与音色必须命中同一文件')
    assert.match(a, /^intro_4_[a-z0-9]+\.mp3$/)
  })

  it('题量不同或音色不同则不共用', () => {
    assert.notEqual(introCacheKey(4, GUY), introCacheKey(8, GUY))
    assert.notEqual(introCacheKey(4, GUY), introCacheKey(4, 'en-US-AriaNeural'))
  })

  it('不与句子音频、题干音频混淆', () => {
    assert.notEqual(introCacheKey(4, GUY), questionCacheKey('c1', 0, GUY))
    assert.notEqual(introCacheKey(4, GUY), audioCacheKey('c1', 0, 'A', GUY))
  })
})

describe('rateValue', () => {
  it('慢速返回 -20%', () => {
    assert.equal(rateValue(true), '-20%')
  })

  it('正常返回 +0%', () => {
    assert.equal(rateValue(false), '+0%')
  })
})
