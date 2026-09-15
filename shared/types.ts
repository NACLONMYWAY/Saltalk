export type Speaker = 'A' | 'B'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** 难度体系：CEFR / 雅思 / 四六级 */
export type ExamSystem = 'cefr' | 'ielts' | 'cet'

/**
 * 生成模式。
 * conversation —— 普通双人对话（CEFR / 雅思）
 * exam         —— 考试听力题（四六级）：一段材料 + 若干四选一选择题
 */
export type GenerateMode = 'conversation' | 'exam'

/**
 * 等级标识。CEFR 为 'A1'..'C2'，雅思为 '4.0'..'9.0'，四六级为 'CET4' / 'CET6'。
 * 存库统一用 string，避免每新增一套体系就要改一次表结构。
 */
export type DifficultyId = string

export interface DialogueLine {
  speaker: Speaker
  english: string
  chinese: string
}

/** 四六级听力选择题（不含存储字段） */
export interface QuestionPayload {
  /** 题干英文——试卷上不印，由录音朗读 */
  stem: string
  /** 题干中文，仅用于学习复盘 */
  stemChinese: string
  /** 四个选项，顺序即 A/B/C/D */
  options: string[]
  /** 正确选项下标 0..3 */
  answerIndex: number
  /** 中文解析，可为空 */
  explanation: string | null
}

export interface Dialogue {
  title: string
  difficulty: DifficultyId
  dialogue: DialogueLine[]
  /** 仅四六级模式返回 */
  questions?: QuestionPayload[]
}

export interface ConversationRecord {
  id: string
  topic: string
  /** 难度体系，老记录迁移后为 'cefr' */
  system: ExamSystem
  level: DifficultyId
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

export interface QuestionRecord extends QuestionPayload {
  id: string
  conversationId: string
  seq: number
  /** 题干朗读音频路径（试卷上不印题干，靠它播出来） */
  stemAudioPath: string | null
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
  wordAudioPath: string | null
  exampleAudioPath: string | null
  sourceSentenceId: string | null
  addedAt: number
  reviewCount: number
  nextReviewAt: number
  status: WordStatus
}
