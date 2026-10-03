import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConversationRecord,
  Dialogue,
  DifficultyId,
  ExamSystem,
  GenerateMode,
  QuestionRecord,
  SentenceRecord,
  WordRecord
} from '../../shared/types.ts'
import type { WordStats } from '../../shared/stats.ts'

export interface SentenceView extends SentenceRecord {
  audioUrl: string | null
  slowAudioUrl: string | null
}

export interface QuestionView extends QuestionRecord {
  stemAudioUrl: string | null
}

export interface WordView extends WordRecord {
  wordAudioUrl: string | null
  exampleAudioUrl: string | null
}

/** 点词预览：只给界面看一眼，不写库 */
export interface WordPreviewView {
  word: string
  meaning: string | null
  phonetic: string | null
  inBook: boolean
}

export interface GenerateResult {
  conversationId: string
  system: ExamSystem
  mode: GenerateMode
  dialogue: Dialogue
}

const api = {
  // config
  getConfig: (key: string): Promise<string | null> => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: string): Promise<void> => ipcRenderer.invoke('config:set', key, value),

  // 难度体系与音色
  setSystem: (system: ExamSystem): Promise<DifficultyId> => ipcRenderer.invoke('system:set', system),
  setVoice: (slot: 'a' | 'b' | 'narrator', voiceId: string): Promise<void> =>
    ipcRenderer.invoke('voice:set', slot, voiceId),
  previewVoice: (voiceId: string): Promise<string> => ipcRenderer.invoke('voice:preview', voiceId),

  // dialogue
  generateDialogue: (
    topic: string,
    system: ExamSystem,
    level: DifficultyId
  ): Promise<GenerateResult> => ipcRenderer.invoke('dialogue:generate', topic, system, level),

  // conversations
  listConversations: (): Promise<ConversationRecord[]> => ipcRenderer.invoke('conversation:list'),
  getConversation: (id: string): Promise<ConversationRecord | null> =>
    ipcRenderer.invoke('conversation:get', id),
  deleteConversation: (id: string): Promise<void> => ipcRenderer.invoke('conversation:delete', id),
  listSentences: (conversationId: string): Promise<SentenceView[]> =>
    ipcRenderer.invoke('sentence:list', conversationId),
  listQuestions: (conversationId: string): Promise<QuestionView[]> =>
    ipcRenderer.invoke('question:list', conversationId),
  /** 四六级引导语音频 URL（材料播放前播报），无题目或合成失败时为 null */
  getExamIntro: (conversationId: string): Promise<string | null> =>
    ipcRenderer.invoke('exam:intro', conversationId),

  // tts
  synthesizeAll: (conversationId: string): Promise<void> =>
    ipcRenderer.invoke('tts:synthesizeAll', conversationId),

  // data
  clearAllData: (): Promise<void> => ipcRenderer.invoke('data:clearAll'),

  // word
  addWord: (
    rawWord: string,
    sourceSentenceId: string | null,
    example: string | null,
    exampleTranslation: string | null
  ): Promise<WordRecord> =>
    ipcRenderer.invoke('word:add', rawWord, sourceSentenceId, example, exampleTranslation),
  listWords: (): Promise<WordView[]> => ipcRenderer.invoke('word:list'),
  /** 点词预览：拿到这个词的意思（不落库） */
  previewWord: (rawWord: string): Promise<WordPreviewView> => ipcRenderer.invoke('word:preview', rawWord),
  /** 预取一批词的释义进缓存（不落库），让之后点词瞬时出结果 */
  prefetchWords: (rawWords: string[]): Promise<number> => ipcRenderer.invoke('word:prefetch', rawWords),
  getDueWords: (): Promise<WordRecord[]> => ipcRenderer.invoke('word:due'),
  deleteWord: (id: string): Promise<void> => ipcRenderer.invoke('word:delete', id),
  markWordMastered: (id: string, mastered: boolean): Promise<void> =>
    ipcRenderer.invoke('word:markMastered', id, mastered),
  reviewWord: (id: string, remembered: boolean): Promise<void> =>
    ipcRenderer.invoke('word:review', id, remembered),
  /** 补齐释义为空的单词，返回补齐条数 */
  enrichMissingWords: (limit?: number): Promise<number> =>
    ipcRenderer.invoke('word:enrichMissing', limit),

  // stats
  getStats: (): Promise<WordStats> => ipcRenderer.invoke('stats:get'),

  // topic
  randomTopic: (system: ExamSystem): Promise<string> => ipcRenderer.invoke('topic:random', system)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
