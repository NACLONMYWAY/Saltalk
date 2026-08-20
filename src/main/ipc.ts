import { ipcMain } from 'electron'
import { pathToFileURL } from 'node:url'
import { AppDatabase } from './db.ts'
import { AppService } from './service.ts'
import { randomTopic } from '../../shared/topics.ts'
import type { CEFRLevel, SentenceRecord } from '../../shared/types.ts'

export interface SentenceView extends SentenceRecord {
  audioUrl: string | null
  slowAudioUrl: string | null
}

function toSentenceView(s: SentenceRecord): SentenceView {
  return {
    ...s,
    audioUrl: s.audioPath ? pathToFileURL(s.audioPath).href : null,
    slowAudioUrl: s.slowAudioPath ? pathToFileURL(s.slowAudioPath).href : null
  }
}

export function registerIpc(db: AppDatabase, service: AppService): void {
  // ---------- config ----------
  ipcMain.handle('config:get', (_e, key: string) => db.getConfig(key))
  ipcMain.handle('config:set', (_e, key: string, value: string) => db.setConfig(key, value))

  // ---------- dialogue ----------
  ipcMain.handle('dialogue:generate', async (_e, topic: string, level: CEFRLevel) => {
    const apiKey = db.getConfig('deepseek_api_key')
    if (!apiKey) {
      throw new Error('请先在设置中配置 Deepseek API Key')
    }
    return service.generateAndSave(topic, level, apiKey)
  })

  // ---------- conversations ----------
  ipcMain.handle('conversation:list', () => db.listConversations())
  ipcMain.handle('conversation:get', (_e, id: string) => db.getConversation(id))
  ipcMain.handle('conversation:delete', (_e, id: string) => db.deleteConversation(id))
  ipcMain.handle('sentence:list', (_e, conversationId: string) =>
    db.getSentences(conversationId).map(toSentenceView)
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
  ipcMain.handle('word:list', () => db.listWords())
  ipcMain.handle('word:due', () => db.getDueWords(Date.now()))
  ipcMain.handle('word:delete', (_e, id: string) => db.deleteWord(id))
  ipcMain.handle('word:review', (_e, id: string, remembered: boolean) =>
    service.reviewWord(id, remembered)
  )

  // ---------- stats ----------
  ipcMain.handle('stats:get', () => service.getWordStats())

  // ---------- topic ----------
  ipcMain.handle('topic:random', () => randomTopic())
}
