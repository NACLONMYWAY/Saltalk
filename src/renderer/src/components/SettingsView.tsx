import { useState } from 'react'
import { useAppStore } from '../store.ts'
import { api } from '../api.ts'

export default function SettingsView() {
  const apiKey = useAppStore((s) => s.apiKey)
  const saveApiKey = useAppStore((s) => s.saveApiKey)
  const [draft, setDraft] = useState(apiKey)
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function handleSave(): Promise<void> {
    await saveApiKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleClearAll(): Promise<void> {
    await api.clearAllData()
    setConfirmClear(false)
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-6 space-y-6">
      <h2 className="text-lg font-semibold">设置</h2>

      <div className="space-y-2">
        <label className="text-sm text-zinc-400">Deepseek API Key</label>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        />
        <p className="text-xs text-zinc-500">Key 仅保存在本机，用于生成对话文本。</p>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-md text-sm bg-zinc-100 text-zinc-900 font-medium"
        >
          {saved ? '已保存' : '保存'}
        </button>
      </div>

      <div className="text-sm text-zinc-500 space-y-1">
        <p>语音合成：edge-tts（微软免费 TTS，美式发音）</p>
        <p>角色 A：en-US-GuyNeural（男声）</p>
        <p>角色 B：en-US-JennyNeural（女声）</p>
      </div>

      <div className="border-t border-zinc-800 pt-4 space-y-2">
        <h3 className="text-sm text-zinc-300">数据管理</h3>
        {confirmClear ? (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-zinc-400">确定清空所有对话和单词本数据？此操作不可恢复。</span>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-md text-sm bg-red-600 hover:bg-red-500 font-medium"
            >
              确认清空
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-3 py-1.5 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            清空所有数据
          </button>
        )}
      </div>
    </div>
  )
}
