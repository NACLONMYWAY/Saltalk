import { ipcMain } from 'electron'
import { pathToFileURL } from 'node:url'
import { AppDatabase } from './db.ts'
import { AppService } from './service.ts'
import { normalizeLevel, isExamSystem } from '../../shared/exams.ts'
import { isKnownVoice } from '../../shared/voices.ts'
import { CONFIG_KEYS } from '../../shared/configKeys.ts'
import { randomTopic } from '../../shared/topics.ts'
import type { DifficultyId, ExamSystem, QuestionRecord, SentenceRecord, WordRecord } from '../../shared/types.ts'

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

function toSentenceView(s: SentenceRecord): SentenceView {
  return {
    ...s,
    audioUrl: s.audioPath ? pathToFileURL(s.audioPath).href : null,
    slowAudioUrl: s.slowAudioPath ? pathToFileURL(s.slowAudioPath).href : null
  }
}

function toQuestionView(q: QuestionRecord): QuestionView {
  return {
    ...q,
    stemAudioUrl: q.stemAudioPath ? pathToFileURL(q.stemAudioPath).href : null
  }
}

function toWordView(w: WordRecord): WordView {
  return {
    ...w,
    wordAudioUrl: w.wordAudioPath ? pathToFileURL(w.wordAudioPath).href : null,
    exampleAudioUrl: w.exampleAudioPath ? pathToFileURL(w.exampleAudioPath).href : null
  }
}

export function registerIpc(db: AppDatabase, service: AppService): void {
  // ---------- config ----------
  ipcMain.handle('config:get', (_e, key: string) => db.getConfig(key))
  ipcMain.handle('config:set', (_e, key: string, value: string) => db.setConfig(key, value))

  /** 设置页保存难度体系：顺带把非法等级收敛到该体系的合法值 */
  ipcMain.handle('system:set', (_e, system: ExamSystem) => {
    if (!isExamSystem(system)) {
      throw new Error(`未知难度体系：${system}`)
    }
    db.setConfig(CONFIG_KEYS.system, system)
    const next = normalizeLevel(system, db.getConfig(CONFIG_KEYS.level))
    db.setConfig(CONFIG_KEYS.level, next)
    return next
  })

  /** 设置页保存音色：A/B 允许相同则拒绝，避免两个角色听不出区别 */
  ipcMain.handle('voice:set', (_e, slot: 'a' | 'b' | 'narrator', voiceId: string) => {
    if (!isKnownVoice(voiceId)) {
      throw new Error(`未知音色：${voiceId}`)
    }
    const key =
      slot === 'a' ? CONFIG_KEYS.voiceA : slot === 'b' ? CONFIG_KEYS.voiceB : CONFIG_KEYS.voiceNarrator
    if (slot !== 'narrator') {
      const otherKey = slot === 'a' ? CONFIG_KEYS.voiceB : CONFIG_KEYS.voiceA
      if (db.getConfig(otherKey) === voiceId) {
        throw new Error('A、B 两个角色不能使用同一个音色')
      }
    }
    db.setConfig(key, voiceId)
  })

  /** 试听音色，返回可直接播放的文件 URL */
  ipcMain.handle('voice:preview', async (_e, voiceId: string) => {
    if (!isKnownVoice(voiceId)) {
      throw new Error(`未知音色：${voiceId}`)
    }
    const path = await service.previewVoice(voiceId)
    return pathToFileURL(path).href
  })

  // ---------- dialogue ----------
  ipcMain.handle(
    'dialogue:generate',
    async (_e, topic: string, system: ExamSystem, level: DifficultyId) => {
      const apiKey = db.getConfig(CONFIG_KEYS.apiKey)
      if (!apiKey) {
        throw new Error('请先在设置中配置 Deepseek API Key')
      }
      const result = await service.generateAndSave(topic, system, level, apiKey)
      return {
        conversationId: result.conversationId,
        system: result.system,
        mode: result.mode,
        dialogue: result.dialogue
      }
    }
  )

  // ---------- conversations ----------
  ipcMain.handle('conversation:list', () => db.listConversations())
  ipcMain.handle('conversation:get', (_e, id: string) => db.getConversation(id))
  ipcMain.handle('conversation:delete', (_e, id: string) => db.deleteConversation(id))
  ipcMain.handle('sentence:list', (_e, conversationId: string) =>
    db.getSentences(conversationId).map(toSentenceView)
  )
  ipcMain.handle('question:list', (_e, conversationId: string) =>
    db.getQuestions(conversationId).map(toQuestionView)
  )

  // ---------- tts ----------
  ipcMain.handle('tts:synthesizeAll', (_e, conversationId: string) =>
    service.synthesizeAll(conversationId)
  )

  // ---------- data ----------
  ipcMain.handle('data:clearAll', () => db.clearAllData())

  // ---------- word ----------
  ipcMain.handle(
    'word:add',
    (_e, rawWord: string, sourceSentenceId: string | null, example: string | null, exampleTranslation: string | null) =>
      service.addWordToBook(rawWord, sourceSentenceId, example, exampleTranslation)
  )
  ipcMain.handle('word:list', () => db.listWords().map(toWordView))
  ipcMain.handle('word:due', () => db.getDueWords(Date.now()))
  ipcMain.handle('word:delete', (_e, id: string) => db.deleteWord(id))
  ipcMain.handle('word:markMastered', (_e, id: string, mastered: boolean) =>
    db.markWordMastered(id, mastered)
  )
  ipcMain.handle('word:review', (_e, id: string, remembered: boolean) =>
    service.reviewWord(id, remembered)
  )

  // ---------- stats ----------
  ipcMain.handle('stats:get', () => service.getWordStats())

  // ---------- topic ----------
  ipcMain.handle('topic:random', () => randomTopic())
}
