import { create } from 'zustand'
import { api } from './api.ts'
import type { QuestionView, SentenceView, WordView } from '../../preload/index.ts'
import type { ConversationRecord, Dialogue, ExamSystem, WordRecord } from '../../../shared/types.ts'
import type { WordStats } from '../../../shared/stats.ts'
import { normalizeLevel } from '../../../shared/exams.ts'
import { CONFIG_KEYS } from '../../../shared/configKeys.ts'
import { DEFAULT_NARRATOR_VOICE, DEFAULT_VOICES, isKnownVoice } from '../../../shared/voices.ts'

export type Tab = 'practice' | 'words' | 'history' | 'settings'

interface AppState {
  tab: Tab
  setTab: (tab: Tab) => void

  // practice
  topic: string
  system: ExamSystem
  level: string
  dialogue: Dialogue | null
  sentences: SentenceView[]
  questions: QuestionView[]
  conversationId: string | null
  generating: boolean
  synthing: boolean
  error: string | null
  setTopic: (topic: string) => void
  setLevel: (level: string) => void
  generate: () => Promise<boolean>
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
  voiceA: string
  voiceB: string
  voiceNarrator: string
  loadSettings: () => Promise<void>
  saveApiKey: (key: string) => Promise<void>
  changeSystem: (system: ExamSystem) => Promise<void>
  changeVoice: (slot: 'a' | 'b' | 'narrator', voiceId: string) => Promise<void>

  // history
  conversations: ConversationRecord[]
  refreshConversations: () => Promise<void>
}

export const useAppStore = create<AppState>()((set, get) => ({
  tab: 'practice',
  setTab: (tab) => set({ tab }),

  topic: '',
  system: 'cefr',
  level: 'B1',
  dialogue: null,
  sentences: [],
  questions: [],
  conversationId: null,
  generating: false,
  synthing: false,
  error: null,
  setTopic: (topic) => set({ topic }),
  setLevel: (level) => {
    set({ level })
    // 记住上次选择的等级，下次启动直接恢复
    void api.setConfig(CONFIG_KEYS.level, level)
  },

  generate: async () => {
    const { topic, system, level } = get()
    if (!topic.trim()) {
      set({ error: '请输入主题' })
      return false
    }
    set({ generating: true, error: null, sentences: [], questions: [], conversationId: null, dialogue: null })
    try {
      const result = await api.generateDialogue(topic.trim(), system, level)
      const questions = result.mode === 'exam' ? await api.listQuestions(result.conversationId) : []
      set({ dialogue: result.dialogue, conversationId: result.conversationId, questions })
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return false
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
      const [sentences, questions] = await Promise.all([
        api.listSentences(conversationId),
        api.listQuestions(conversationId)
      ])
      set({ sentences, questions })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ synthing: false })
    }
  },

  loadConversation: async (id) => {
    const conv = await api.getConversation(id)
    const [sentences, questions] = await Promise.all([api.listSentences(id), api.listQuestions(id)])
    if (conv) {
      set({
        conversationId: id,
        topic: conv.topic,
        system: conv.system,
        level: conv.level,
        sentences,
        questions,
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
  voiceA: DEFAULT_VOICES.cefr.a,
  voiceB: DEFAULT_VOICES.cefr.b,
  voiceNarrator: DEFAULT_NARRATOR_VOICE,

  loadSettings: async () => {
    const [systemRaw, levelRaw, voiceARaw, voiceBRaw, voiceNRaw, key] = await Promise.all([
      api.getConfig(CONFIG_KEYS.system),
      api.getConfig(CONFIG_KEYS.level),
      api.getConfig(CONFIG_KEYS.voiceA),
      api.getConfig(CONFIG_KEYS.voiceB),
      api.getConfig(CONFIG_KEYS.voiceNarrator),
      api.getConfig(CONFIG_KEYS.apiKey)
    ])
    const system: ExamSystem = systemRaw === 'ielts' || systemRaw === 'cet' ? systemRaw : 'cefr'
    const def = DEFAULT_VOICES[system]
    set({
      system,
      level: normalizeLevel(system, levelRaw),
      voiceA: isKnownVoice(voiceARaw) ? (voiceARaw as string) : def.a,
      voiceB: isKnownVoice(voiceBRaw) ? (voiceBRaw as string) : def.b,
      voiceNarrator: isKnownVoice(voiceNRaw) ? (voiceNRaw as string) : DEFAULT_NARRATOR_VOICE,
      apiKey: key ?? ''
    })
  },

  saveApiKey: async (key) => {
    await api.setConfig(CONFIG_KEYS.apiKey, key)
    set({ apiKey: key })
  },

  changeSystem: async (system) => {
    const prev = get().system
    const level = await api.setSystem(system)
    set({ system, level })

    // 若用户没有自定义过音色，则跟随体系切换默认搭配
    // （CEFR/雅思：美音男女；四六级：美音 + 英音，贴近真题口音分布）
    const prevDef = DEFAULT_VOICES[prev]
    const nextDef = DEFAULT_VOICES[system]
    const untouched = get().voiceA === prevDef.a && get().voiceB === prevDef.b
    if (untouched && (nextDef.a !== prevDef.a || nextDef.b !== prevDef.b)) {
      await api.setVoice('a', nextDef.a)
      await api.setVoice('b', nextDef.b)
      set({ voiceA: nextDef.a, voiceB: nextDef.b })
    }
  },

  changeVoice: async (slot, voiceId) => {
    await api.setVoice(slot, voiceId)
    if (slot === 'a') set({ voiceA: voiceId })
    else if (slot === 'b') set({ voiceB: voiceId })
    else set({ voiceNarrator: voiceId })
  },

  conversations: [],
  refreshConversations: async () => {
    set({ conversations: await api.listConversations() })
  }
}))
