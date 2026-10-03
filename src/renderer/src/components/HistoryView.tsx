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
  const [introUrl, setIntroUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  async function toggleExpand(id: string): Promise<void> {
    if (expandedId === id) {
      setExpandedId(null)
      setSentences([])
      setQuestions([])
      setIntroUrl(null)
      return
    }
    setExpandedId(id)
    setLoading(true)
    try {
      const [s, q] = await Promise.all([api.listSentences(id), api.listQuestions(id)])
      setSentences(s)
      setQuestions(q)
      setIntroUrl(q.length > 0 ? await api.getExamIntro(id) : null)
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
      setIntroUrl(null)
    }
    await refreshConversations()
  }

  return (
    <div className="wrap">
      <div className="list">
        {conversations.map((c) => (
          <div key={c.id} className={`hist${expandedId === c.id ? ' open' : ''}`}>
            <div className="hist-head">
              <button onClick={() => toggleExpand(c.id)} className="hist-main">
                <svg className="i hist-chev">
                  <use href="#i-chev-r" />
                </svg>
                <span className="hist-txt">
                  <span className="hist-title">{c.title || c.topic}</span>
                  <span className="hist-sub">
                    <span className="tag">{SYSTEM_LABEL[c.system]}</span>
                    <span>{levelDisplay(c.system, c.level)}</span>
                    <span>·</span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </span>
                </span>
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="act-text act-del"
                title="删除这条记录"
              >
                删除
              </button>
            </div>

            {expandedId === c.id && (
              <div className="hist-body">
                {loading ? (
                  <div className="busy justify-center">
                    <span className="spin" />
                    <span className="busy-label">加载中…</span>
                  </div>
                ) : modeOf(c.system) === 'exam' && questions.length > 0 ? (
                  <CetPlayer sentences={sentences} questions={questions} introUrl={introUrl} />
                ) : (
                  <DialoguePlayer sentences={sentences} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {conversations.length === 0 && (
        <div className="empty">
          <span className="empty-ico">
            <svg className="i i-lg">
              <use href="#i-clock" />
            </svg>
          </span>
          <span className="empty-t">暂无历史对话</span>
          <span className="empty-d">在练习页生成过的对话与听力题，都会自动存在这里。</span>
        </div>
      )}
    </div>
  )
}
