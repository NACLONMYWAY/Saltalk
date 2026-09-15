import { DEFAULT_NARRATOR_VOICE, DEFAULT_VOICES, FALLBACK_VOICE, isKnownVoice } from '../../shared/voices.ts'
import { CONFIG_KEYS } from '../../shared/configKeys.ts'
import { isExamSystem } from '../../shared/exams.ts'
import type { AppDatabase } from './db.ts'
import type { ExamSystem, Speaker } from '../../shared/types.ts'

export function resolveSystem(db: AppDatabase): ExamSystem {
  const raw = db.getConfig(CONFIG_KEYS.system)
  return isExamSystem(raw) ? raw : 'cefr'
}

function readVoice(db: AppDatabase, key: string): string | null {
  const raw = db.getConfig(key)
  return isKnownVoice(raw) ? (raw as string) : null
}

/**
 * 解析 A/B 两个角色的发音人。
 * 同一音色不能同时给两个角色，否则听不出说话人差别，这里做一次兜底纠正。
 */
export function resolveVoices(db: AppDatabase): Record<Speaker, string> {
  const def = DEFAULT_VOICES[resolveSystem(db)]
  const a = readVoice(db, CONFIG_KEYS.voiceA) ?? def.a
  let b = readVoice(db, CONFIG_KEYS.voiceB) ?? def.b
  if (b === a) {
    b =
      [def.b, def.a, 'en-US-JennyNeural', 'en-GB-SoniaNeural'].find((v) => v !== a) ?? FALLBACK_VOICE
  }
  return { A: a, B: b }
}

export function resolveNarratorVoice(db: AppDatabase): string {
  return readVoice(db, CONFIG_KEYS.voiceNarrator) ?? DEFAULT_NARRATOR_VOICE
}
