import { create } from 'zustand'
import { api } from './api.ts'
import type { SentenceView, WordView } from '../../preload/index.ts'
import type { CEFRLevel, Dialogue, WordRecord } from '../../../shared/types.ts'
import type { WordStats } from '../../../shared/stats.ts'

export type Tab = 'practice' | 'words' | 'history' | 'settings'

interface AppState {
  tab: Tab
  setTab: (tab: Tab) => void

  // practice
  topic: string
  level: CEFRLevel
  dialogue: Dialogue | null
  sentences: SentenceView[]
  conversationId: string | null
  generating: boolean
  synthing: boolean
  error: string | null
  setTopic: (topic: string) => void
  setLevel: (level: CEFRLevel) => void
  generate: () => Promise<void>
  pickRandomTopic: () => Promise<void>
  synthesize: () => Promise<void>
  loadConversation: (id: string) => Promise<void>

  // words
  words: WordView[]
  dueWords: WordRecord[]
  stats: WordStats | null
  refreshWords: () => Promise<void>
  addWord: (rawWord: string, sourceSentenceId: string | null, example: string | null, exampleTranslation: string | null) => Promise<void>
  deleteWord: (id: string) => Promise<void>
  markWordMastered: (id: string, mastered: boolean) => Promise<void>
  reviewWord: (id: string, remembered: boolean) => Promise<void>

  // settings
  apiKey: string
  loadApiKey: () => Promise<void>
  saveApiKey: (key: string) => Promise<void>
}

export const useAppStore = create<AppState>()((set, get) => ({
  tab: 'practice',
  setTab: (tab) => set({ tab }),

  topic: '',
  level: 'B1',
  dialogue: null,
  sentences: [],
  conversationId: null,
  generating: false,
  synthing: false,
  error: null,
  setTopic: (topic) => set({ topic }),
  setLevel: (level) => set({ level }),

  generate: async () => {
    const { topic } = get()
    if (!topic.trim()) {
      set({ error: '请输入主题' })
      return
    }
    set({ generating: true, error: null, sentences: [], conversationId: null, dialogue: null })
    try {
      const result = await api.generateDialogue(topic.trim(), get().level)
      set({ dialogue: result.dialogue, conversationId: result.conversationId })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ generating: false })
    }
  },

  pickRandomTopic: async () => {
    const t = await api.randomTopic()
    set({ topic: t })
  },

  synthesize: async () => {
    const { conversationId } = get()
    if (!conversationId) return
    set({ synthing: true })
    try {
      await api.synthesizeAll(conversationId)
      const sentences = await api.listSentences(conversationId)
      set({ sentences })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ synthing: false })
    }
  },

  loadConversation: async (id) => {
    const conv = await api.getConversation(id)
    const sentences = await api.listSentences(id)
    if (conv) {
      set({
        conversationId: id,
        topic: conv.topic,
        level: conv.level,
        sentences,
        dialogue: null
      })
    }
  },

  words: [],
  dueWords: [],
  stats: null,
  refreshWords: async () => {
    const [words, dueWords, stats] = await Promise.all([
      api.listWords(),
      api.getDueWords(),
      api.getStats()
    ])
    set({ words, dueWords, stats })
  },

  addWord: async (rawWord, sourceSentenceId, example, exampleTranslation) => {
    await api.addWord(rawWord, sourceSentenceId, example, exampleTranslation)
    await get().refreshWords()
  },

  deleteWord: async (id) => {
    await api.deleteWord(id)
    await get().refreshWords()
  },

  markWordMastered: async (id, mastered) => {
    await api.markWordMastered(id, mastered)
    await get().refreshWords()
  },

  reviewWord: async (id, remembered) => {
    await api.reviewWord(id, remembered)
    await get().refreshWords()
  },

  apiKey: '',
  loadApiKey: async () => {
    const key = await api.getConfig('deepseek_api_key')
    set({ apiKey: key ?? '' })
  },
  saveApiKey: async (key) => {
    await api.setConfig('deepseek_api_key', key)
    set({ apiKey: key })
  }
}))
