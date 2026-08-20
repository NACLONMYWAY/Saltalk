import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SPEAKER_VOICE, audioCacheKey, rateValue } from '../../src/main/tts.ts'

describe('SPEAKER_VOICE', () => {
  it('A 角色使用美式男声', () => {
    assert.equal(SPEAKER_VOICE.A, 'en-US-GuyNeural')
  })

  it('B 角色使用美式女声', () => {
    assert.equal(SPEAKER_VOICE.B, 'en-US-JennyNeural')
  })

  it('A/B 发音人不同', () => {
    assert.notEqual(SPEAKER_VOICE.A, SPEAKER_VOICE.B)
  })

  it('发音人都是美式 en-US', () => {
    assert.ok(SPEAKER_VOICE.A.startsWith('en-US-'))
    assert.ok(SPEAKER_VOICE.B.startsWith('en-US-'))
  })
})

describe('audioCacheKey', () => {
  it('生成稳定且唯一的缓存文件名', () => {
    assert.equal(audioCacheKey('c1', 0, 'A'), 'c1_0_A.mp3')
    assert.equal(audioCacheKey('c1', 1, 'B'), 'c1_1_B.mp3')
  })

  it('不同句子/角色产生不同文件名', () => {
    const keys = new Set([
      audioCacheKey('c1', 0, 'A'),
      audioCacheKey('c1', 0, 'B'),
      audioCacheKey('c1', 1, 'A')
    ])
    assert.equal(keys.size, 3)
  })

  it('慢速与正常语速用不同文件名', () => {
    assert.equal(audioCacheKey('c1', 0, 'A', false), 'c1_0_A.mp3')
    assert.equal(audioCacheKey('c1', 0, 'A', true), 'c1_0_A_slow.mp3')
    assert.notEqual(audioCacheKey('c1', 0, 'A', false), audioCacheKey('c1', 0, 'A', true))
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
