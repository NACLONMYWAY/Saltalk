import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { useAppStore } from '../store.ts'
import type { SentenceView, QuestionView } from '../../../preload/index.ts'
import { SYSTEM_LABEL, levelDisplay, modeOf } from '../../../../shared/exams.ts'
import DialoguePlayer from './DialoguePlayer.tsx'
import CetPlayer from './CetPlayer.tsx'

export default function HistoryView() {
  const conversations = useAppStore((s) => s.conversations)
  const refreshConversations = useAppStore((s) => s.refreshConversations)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sentences, setSentences] = useState<SentenceView[]>([])
  const [questions, setQuestions] = useState<QuestionView[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  async function toggleExpand(id: string): Promise<void> {
    if (expandedId === id) {
      setExpandedId(null)
      setSentences([])
      setQuestions([])
      return
    }
    setExpandedId(id)
    setLoading(true)
    try {
      const [s, q] = await Promise.all([api.listSentences(id), api.listQuestions(id)])
      setSentences(s)
      setQuestions(q)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    await api.deleteConversation(id)
    if (expandedId === id) {
      setExpandedId(null)
      setSentences([])
      setQuestions([])
    }
    await refreshConversations()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-2">
      {conversations.map((c) => (
        <div key={c.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-2 p-3">
            <button onClick={() => toggleExpand(c.id)} className="flex-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded p-1 -m-1 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate">
                  {c.title || c.topic}
                </span>
                <span className="shrink-0 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[11px] bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {SYSTEM_LABEL[c.system]}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {levelDisplay(c.system, c.level)}
                  </span>
                </span>
              </div>
              <div className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 truncate">
                {c.title ? `${c.topic} · ` : ''}
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
              {loading ? (
                <div className="text-zinc-400 dark:text-zinc-500 text-sm py-4 text-center">加载中…</div>
              ) : modeOf(c.system) === 'exam' && questions.length > 0 ? (
                <CetPlayer sentences={sentences} questions={questions} />
              ) : (
                <DialoguePlayer sentences={sentences} />
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
