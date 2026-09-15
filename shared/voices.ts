import type { ExamSystem } from './types.ts'

export type VoiceGender = 'male' | 'female'

export interface AccentGroup {
  /** 口音代码，如 en-US */
  accent: string
  /** 口音显示名，如「美音」 */
  label: string
}

/**
 * 口音分组。注意：en-HK 一律标注为中国香港。
 */
export const ACCENT_GROUPS: AccentGroup[] = [
  { accent: 'en-US', label: '美音' },
  { accent: 'en-GB', label: '英音' },
  { accent: 'en-AU', label: '澳音' },
  { accent: 'en-CA', label: '加拿大音' },
  { accent: 'en-IE', label: '爱尔兰音' },
  { accent: 'en-NZ', label: '新西兰音' },
  { accent: 'en-IN', label: '印度音' },
  { accent: 'en-SG', label: '新加坡音' },
  { accent: 'en-ZA', label: '南非音' },
  { accent: 'en-PH', label: '菲律宾音' },
  { accent: 'en-KE', label: '肯尼亚音' },
  { accent: 'en-NG', label: '尼日利亚音' },
  { accent: 'en-HK', label: '英语（中国香港）' }
]

export interface VoiceOption {
  /** edge-tts 音色名，直接用于 setMetadata */
  id: string
  /** 显示名 */
  label: string
  gender: VoiceGender
  /** 口音代码 */
  accent: string
  /** 一句话特征描述 */
  note: string
}

export const VOICE_LIBRARY: VoiceOption[] = [
  // ---------- 美音 ----------
  { id: 'en-US-GuyNeural', label: 'Guy', gender: 'male', accent: 'en-US', note: '标准美音男声，清晰' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher', gender: 'male', accent: 'en-US', note: '沉稳权威，适合新闻' },
  { id: 'en-US-EricNeural', label: 'Eric', gender: 'male', accent: 'en-US', note: '理性克制' },
  { id: 'en-US-RogerNeural', label: 'Roger', gender: 'male', accent: 'en-US', note: '活泼有起伏' },
  { id: 'en-US-SteffanNeural', label: 'Steffan', gender: 'male', accent: 'en-US', note: '理性平稳' },
  { id: 'en-US-AndrewNeural', label: 'Andrew', gender: 'male', accent: 'en-US', note: '温暖自信，对话自然' },
  { id: 'en-US-BrianNeural', label: 'Brian', gender: 'male', accent: 'en-US', note: '随意亲切，像日常聊天' },
  { id: 'en-US-JennyNeural', label: 'Jenny', gender: 'female', accent: 'en-US', note: '标准美音女声，友好' },
  { id: 'en-US-AriaNeural', label: 'Aria', gender: 'female', accent: 'en-US', note: '自信，适合播报' },
  { id: 'en-US-MichelleNeural', label: 'Michelle', gender: 'female', accent: 'en-US', note: '温和悦耳' },
  { id: 'en-US-AnaNeural', label: 'Ana', gender: 'female', accent: 'en-US', note: '童声，适合少儿内容' },
  { id: 'en-US-AvaNeural', label: 'Ava', gender: 'female', accent: 'en-US', note: '生动有表现力' },
  { id: 'en-US-EmmaNeural', label: 'Emma', gender: 'female', accent: 'en-US', note: '明快清晰，对话自然' },

  // ---------- 英音 ----------
  { id: 'en-GB-RyanNeural', label: 'Ryan', gender: 'male', accent: 'en-GB', note: '标准英音男声' },
  { id: 'en-GB-ThomasNeural', label: 'Thomas', gender: 'male', accent: 'en-GB', note: '英音，略显正式' },
  { id: 'en-GB-LibbyNeural', label: 'Libby', gender: 'female', accent: 'en-GB', note: '亲切自然' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia', gender: 'female', accent: 'en-GB', note: '标准英音女声，清晰' },
  { id: 'en-GB-MaisieNeural', label: 'Maisie', gender: 'female', accent: 'en-GB', note: '少女音，轻快' },

  // ---------- 澳音 ----------
  { id: 'en-AU-WilliamNeural', label: 'William', gender: 'male', accent: 'en-AU', note: '澳洲男声' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha', gender: 'female', accent: 'en-AU', note: '澳洲女声' },

  // ---------- 加拿大音 ----------
  { id: 'en-CA-LiamNeural', label: 'Liam', gender: 'male', accent: 'en-CA', note: '加拿大男声' },
  { id: 'en-CA-ClaraNeural', label: 'Clara', gender: 'female', accent: 'en-CA', note: '加拿大女声' },

  // ---------- 爱尔兰音 ----------
  { id: 'en-IE-ConnorNeural', label: 'Connor', gender: 'male', accent: 'en-IE', note: '爱尔兰男声' },
  { id: 'en-IE-EmilyNeural', label: 'Emily', gender: 'female', accent: 'en-IE', note: '爱尔兰女声' },

  // ---------- 新西兰音 ----------
  { id: 'en-NZ-MitchellNeural', label: 'Mitchell', gender: 'male', accent: 'en-NZ', note: '新西兰男声' },
  { id: 'en-NZ-MollyNeural', label: 'Molly', gender: 'female', accent: 'en-NZ', note: '新西兰女声' },

  // ---------- 印度音 ----------
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat', gender: 'male', accent: 'en-IN', note: '印度男声' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja', gender: 'female', accent: 'en-IN', note: '印度女声' },

  // ---------- 新加坡音 ----------
  { id: 'en-SG-WayneNeural', label: 'Wayne', gender: 'male', accent: 'en-SG', note: '新加坡男声' },
  { id: 'en-SG-LunaNeural', label: 'Luna', gender: 'female', accent: 'en-SG', note: '新加坡女声' },

  // ---------- 英语（中国香港） ----------
  { id: 'en-HK-SamNeural', label: 'Sam', gender: 'male', accent: 'en-HK', note: '英语（中国香港）男声' },
  { id: 'en-HK-YanNeural', label: 'Yan', gender: 'female', accent: 'en-HK', note: '英语（中国香港）女声' }
]

const VOICE_INDEX = new Map(VOICE_LIBRARY.map((v) => [v.id, v]))

export function isKnownVoice(id: string | null | undefined): boolean {
  return typeof id === 'string' && VOICE_INDEX.has(id)
}

/** 取音色显示名，未知音色直接回显原值，便于排查 */
export function voiceLabel(id: string): string {
  const v = VOICE_INDEX.get(id)
  return v ? `${v.label}（${v.note}）` : id
}

export function voiceAccent(id: string): string {
  return VOICE_INDEX.get(id)?.accent ?? 'en-US'
}

export function accentLabel(accent: string): string {
  return ACCENT_GROUPS.find((a) => a.accent === accent)?.label ?? accent
}

/** 按口音分组，供设置页下拉渲染 */
export function voicesByAccent(): Array<{ accent: string; label: string; voices: VoiceOption[] }> {
  return ACCENT_GROUPS.map((g) => ({
    accent: g.accent,
    label: g.label,
    voices: VOICE_LIBRARY.filter((v) => v.accent === g.accent)
  })).filter((g) => g.voices.length > 0)
}

/**
 * 音色指纹：短、稳定、可用于文件名。
 * 换音色后缓存文件名随之变化，避免旧音色的音频被当成新音色复用（串音）。
 */
export function voiceFingerprint(voiceId: string): string {
  let hash = 5381
  for (let i = 0; i < voiceId.length; i++) {
    hash = ((hash << 5) + hash + voiceId.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36).slice(0, 5)
}

/** 各体系的默认音色。四六级贴近真题（英音澳音约占三成），默认美音 + 英音搭配。 */
export const DEFAULT_VOICES: Record<ExamSystem, { a: string; b: string }> = {
  cefr: { a: 'en-US-GuyNeural', b: 'en-US-JennyNeural' },
  ielts: { a: 'en-US-GuyNeural', b: 'en-US-JennyNeural' },
  cet: { a: 'en-US-GuyNeural', b: 'en-GB-SoniaNeural' }
}

/** 兜底音色，保证任何异常配置都有声音可用 */
export const FALLBACK_VOICE = 'en-US-GuyNeural'

/**
 * 四六级题干朗读音色。
 * 真题里念题干的是播音员，与对话双方音色不同，因此单独留一个槽位。
 */
export const DEFAULT_NARRATOR_VOICE = 'en-US-AriaNeural'
