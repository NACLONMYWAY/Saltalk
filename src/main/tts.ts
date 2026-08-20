import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Speaker } from '../../shared/types.ts'

/** 角色 → 美式英语发音人（A 男声 / B 女声） */
export const SPEAKER_VOICE: Record<Speaker, string> = {
  A: 'en-US-GuyNeural',
  B: 'en-US-JennyNeural'
}

/** 缓存文件名：{conversationId}_{seq}_{speaker}[_slow].mp3 */
export function audioCacheKey(conversationId: string, seq: number, speaker: Speaker, slow = false): string {
  const suffix = slow ? '_slow' : ''
  return `${conversationId}_${seq}_${speaker}${suffix}.mp3`
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
