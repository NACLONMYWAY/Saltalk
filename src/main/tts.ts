import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { voiceFingerprint } from '../../shared/voices.ts'
import type { Speaker } from '../../shared/types.ts'

/**
 * 缓存文件名：{conversationId}_{seq}_{speaker}_{音色指纹}[_slow].mp3
 *
 * 音色指纹是刻意加进来的：1.4.0 之前文件名不含音色，用户一换音色，旧文件就会被
 * 当成新音色的音频直接复用，出现「设置改了但声音没变」的串音问题。
 * 加入指纹后，换音色 ⇒ 换文件名 ⇒ 自动重新合成，老对话的音频仍按原文件名命中，互不干扰。
 */
export function audioCacheKey(
  conversationId: string,
  seq: number,
  speaker: Speaker,
  voiceId: string,
  slow = false
): string {
  const suffix = slow ? '_slow' : ''
  return `${conversationId}_${seq}_${speaker}_${voiceFingerprint(voiceId)}${suffix}.mp3`
}

/** 四六级题干朗读音频的缓存文件名 */
export function questionCacheKey(conversationId: string, seq: number, voiceId: string): string {
  return `q_${conversationId}_${seq}_${voiceFingerprint(voiceId)}.mp3`
}

/** 语速参数：慢速 -20%，正常 +0% */
export function rateValue(slow: boolean): string {
  return slow ? '-20%' : '+0%'
}

export interface SynthesizeOptions {
  text: string
  voice: string
  rate: string
  outDir: string
  fileName: string
}

/**
 * 用 edge-tts 合成语音并写入指定文件，返回文件绝对路径。
 * 网络调用，失败时抛错。
 */
export async function synthesize(opts: SynthesizeOptions): Promise<string> {
  await mkdir(opts.outDir, { recursive: true })
  const tts = new MsEdgeTTS()
  try {
    await tts.setMetadata(opts.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioFilePath } = await tts.toFile(opts.outDir, opts.text, { rate: opts.rate })
    const targetPath = join(opts.outDir, opts.fileName)
    await rm(targetPath, { force: true })
    await rename(audioFilePath, targetPath)
    return targetPath
  } finally {
    tts.close()
  }
}
