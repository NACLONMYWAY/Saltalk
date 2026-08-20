export type Speaker = 'A' | 'B'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export interface DialogueLine {
  speaker: Speaker
  english: string
  chinese: string
}

export interface Dialogue {
  title: string
  difficulty: CEFRLevel
  dialogue: DialogueLine[]
}

export interface ConversationRecord {
  id: string
  topic: string
  level: CEFRLevel
  title: string
  createdAt: number
}

export type TtsStatus = 'pending' | 'done' | 'failed'

export interface SentenceRecord {
  id: string
  conversationId: string
  seq: number
  speaker: Speaker
  english: string
  chinese: string
  audioPath: string | null
  slowAudioPath: string | null
  ttsStatus: TtsStatus
}

export type WordStatus = 'learning' | 'mastered'

export interface WordRecord {
  id: string
  word: string
  meaning: string | null
  phonetic: string | null
  example: string | null
  exampleTranslation: string | null
  sourceSentenceId: string | null
  addedAt: number
  reviewCount: number
  nextReviewAt: number
  status: WordStatus
}
