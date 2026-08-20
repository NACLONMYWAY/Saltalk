import { contextBridge, ipcRenderer } from 'electron'
import type { CEFRLevel, ConversationRecord, Dialogue, SentenceRecord, WordRecord } from '../../shared/types.ts'
import type { WordStats } from '../../shared/stats.ts'

export interface SentenceView extends SentenceRecord {
  audioUrl: string | null
  slowAudioUrl: string | null
}

const api = {
  // config
  getConfig: (key: string): Promise<string | null> => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: string): Promise<void> => ipcRenderer.invoke('config:set', key, value),

  // dialogue
  generateDialogue: (
    topic: string,
    level: CEFRLevel
  ): Promise<{ conversationId: string; dialogue: Dialogue }> =>
    ipcRenderer.invoke('dialogue:generate', topic, level),

  // conversations
  listConversations: (): Promise<ConversationRecord[]> => ipcRenderer.invoke('conversation:list'),
  getConversation: (id: string): Promise<ConversationRecord | null> =>
    ipcRenderer.invoke('conversation:get', id),
  deleteConversation: (id: string): Promise<void> => ipcRenderer.invoke('conversation:delete', id),
  listSentences: (conversationId: string): Promise<SentenceView[]> =>
    ipcRenderer.invoke('sentence:list', conversationId),

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
  listWords: (): Promise<WordRecord[]> => ipcRenderer.invoke('word:list'),
  getDueWords: (): Promise<WordRecord[]> => ipcRenderer.invoke('word:due'),
  deleteWord: (id: string): Promise<void> => ipcRenderer.invoke('word:delete', id),
  reviewWord: (id: string, remembered: boolean): Promise<void> =>
    ipcRenderer.invoke('word:review', id, remembered),

  // stats
  getStats: (): Promise<WordStats> => ipcRenderer.invoke('stats:get'),

  // topic
  randomTopic: (): Promise<string> => ipcRenderer.invoke('topic:random')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
