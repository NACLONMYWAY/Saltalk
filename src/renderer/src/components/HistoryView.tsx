import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import type { ConversationRecord } from '../../../../shared/types.ts'
import type { SentenceView } from '../../../preload/index.ts'
import DialoguePlayer from './DialoguePlayer.tsx'

export default function HistoryView() {
  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSentences, setExpandedSentences] = useState<SentenceView[]>([])
  const [loadingSentences, setLoadingSentences] = useState(false)

  async function load(): Promise<void> {
    setConversations(await api.listConversations())
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleExpand(id: string): Promise<void> {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedSentences([])
      return
    }
    setExpandedId(id)
    setLoadingSentences(true)
    try {
      const s = await api.listSentences(id)
      setExpandedSentences(s)
    } finally {
      setLoadingSentences(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    await api.deleteConversation(id)
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedSentences([])
    }
    await load()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-2">
      {conversations.map((c) => (
        <div key={c.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-2 p-3">
            <button onClick={() => toggleExpand(c.id)} className="flex-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded p-1 -m-1 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{c.topic}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{c.level}</span>
              </div>
              <div className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                {new Date(c.createdAt).toLocaleString()}
              </div>
            </button>
            <button
              onClick={() => handleDelete(c.id)}
              className="shrink-0 px-2 py-1 rounded text-xs text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="删除"
            >
              删除
            </button>
          </div>

          {expandedId === c.id && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
              {loadingSentences ? (
                <div className="text-zinc-400 dark:text-zinc-500 text-sm py-4 text-center">加载中…</div>
              ) : (
                <DialoguePlayer sentences={expandedSentences} />
              )}
            </div>
          )}
        </div>
      ))}
      {conversations.length === 0 && (
        <div className="text-zinc-400 dark:text-zinc-500 text-center py-8">暂无历史对话</div>
      )}
    </div>
  )
}
