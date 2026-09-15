import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store.ts'
import type { WordView } from '../../../preload/index.ts'

export default function WordBookView() {
  const words = useAppStore((s) => s.words)
  const refreshWords = useAppStore((s) => s.refreshWords)
  const deleteWord = useAppStore((s) => s.deleteWord)
  const markWordMastered = useAppStore((s) => s.markWordMastered)

  const [filter, setFilter] = useState<'unlearned' | 'mastered'>('unlearned')
  const [studying, setStudying] = useState(false)

  useEffect(() => {
    refreshWords()
  }, [refreshWords])

  const unlearned = words.filter((w) => w.status === 'learning')
  const mastered = words.filter((w) => w.status === 'mastered')
  const shown = filter === 'unlearned' ? unlearned : mastered

  if (studying) {
    return (
      <StudyCards
        words={unlearned}
        onClose={() => {
          setStudying(false)
          refreshWords()
        }}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
      {/* 分类 tab + 背单词入口 */}
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setFilter('unlearned')}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            filter === 'unlearned'
              ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
              : 'bg-white border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'
          }`}
        >
          未背（{unlearned.length}）
        </button>
        <button
          onClick={() => setFilter('mastered')}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            filter === 'mastered'
              ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
              : 'bg-white border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'
          }`}
        >
          已背（{mastered.length}）
        </button>
        {unlearned.length > 0 && (
          <button
            onClick={() => setStudying(true)}
            className="ml-auto px-4 py-1.5 rounded-lg text-sm bg-yellow-400 text-zinc-900 font-medium hover:bg-yellow-300 dark:bg-yellow-500 dark:hover:bg-yellow-400 transition-colors"
          >
            开始背单词
          </button>
        )}
      </div>

      {/* 单词列表 */}
      <div className="space-y-2">
        {shown.map((w) => (
          <WordItem
            key={w.id}
            word={w}
            onDelete={deleteWord}
            onToggleMastered={(id, mastered) => markWordMastered(id, mastered)}
          />
        ))}
        {shown.length === 0 && (
          <div className="text-zinc-500 text-center py-8">
            {filter === 'unlearned' ? '暂无未背单词' : '暂无已背单词'}
          </div>
        )}
      </div>
    </div>
  )
}

interface WordItemProps {
  word: WordView
  onDelete: (id: string) => void
  onToggleMastered: (id: string, mastered: boolean) => void
}

function WordItem({ word, onDelete, onToggleMastered }: WordItemProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function play(url: string | null): void {
    if (!url) return
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.src = url
    audio.play().catch(() => {})
  }

  const mastered = word.status === 'mastered'

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{word.word}</span>
            {word.phonetic && <span className="text-sm text-zinc-400 dark:text-zinc-500">{word.phonetic}</span>}
            <button
              onClick={() => play(word.wordAudioUrl)}
              disabled={!word.wordAudioUrl}
              className={`text-sm ${word.wordAudioUrl ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`}
              title="播放单词发音"
            >
              🔊
            </button>
          </div>
          {word.meaning && <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{word.meaning}</div>}
          {word.example && (
            <div className="text-sm text-zinc-500 mt-1 italic">
              {word.example}
              <button
                onClick={() => play(word.exampleAudioUrl)}
                disabled={!word.exampleAudioUrl}
                className={`ml-2 text-xs not-italic ${word.exampleAudioUrl ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`}
                title="播放例句发音"
              >
                🔊
              </button>
            </div>
          )}
          {word.exampleTranslation && (
            <div className="text-sm text-zinc-500 mt-0.5">{word.exampleTranslation}</div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-1 items-end">
          <button
            onClick={() => onToggleMastered(word.id, !mastered)}
            className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={mastered ? '移回未背' : '标记已背'}
          >
            {mastered ? '移回未背' : '标记已背'}
          </button>
          <button
            onClick={() => onDelete(word.id)}
            className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="删除"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

interface StudyCardsProps {
  words: WordView[]
  onClose: () => void
}

function StudyCards({ words, onClose }: StudyCardsProps) {
  const markWordMastered = useAppStore((s) => s.markWordMastered)
  // 进入背单词时对单词列表做本地快照，避免标记"会背"后 store 刷新导致列表变短，
  // 从而出现跳词、提前"背完"的问题
  const [queue, setQueue] = useState<WordView[]>(words)
  const [revealed, setRevealed] = useState(false)
  const busyRef = useRef(false)

  const word = queue[0]

  async function handleResult(mastered: boolean): Promise<void> {
    const current = queue[0]
    if (!current || busyRef.current) return
    busyRef.current = true
    try {
      setRevealed(false)
      // 从队头移除当前词；"还不会"的词移到队尾，稍后再次复习
      setQueue((q) => {
        const [, ...rest] = q
        if (!mastered) rest.push(current)
        return rest
      })
      if (mastered) {
        await markWordMastered(current.id, true)
      }
    } finally {
      busyRef.current = false
    }
  }

  if (!word) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center text-zinc-500">
        全部背完，太棒了！
        <button onClick={onClose} className="block mx-auto mt-4 px-4 py-2 rounded-lg text-sm bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors">
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10 space-y-6">
      {/* 进度 */}
      <div className="text-center text-sm text-zinc-400 dark:text-zinc-500">
        还剩 {queue.length} 个单词
      </div>

      {/* 单词卡 */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-700 dark:shadow-none">
        <div className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">{word.word}</div>
        {word.phonetic && <div className="text-zinc-400 dark:text-zinc-500">{word.phonetic}</div>}

        {revealed ? (
          <div className="space-y-2">
            {word.meaning && <div className="text-xl text-zinc-800 dark:text-zinc-200">{word.meaning}</div>}
            {word.example && <div className="text-sm text-zinc-500 italic">{word.example}</div>}
            {word.exampleTranslation && <div className="text-sm text-zinc-400 dark:text-zinc-500">{word.exampleTranslation}</div>}
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="px-4 py-2 rounded-lg text-sm bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
          >
            显示中文
          </button>
        )}
      </div>

      {/* 操作按钮 */}
      {revealed && (
        <div className="flex gap-3">
          <button
            onClick={() => handleResult(false)}
            className="flex-1 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 font-medium dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
          >
            还不会
          </button>
          <button
            onClick={() => handleResult(true)}
            className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors"
          >
            会背
          </button>
        </div>
      )}

      <button onClick={onClose} className="w-full text-center text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
        退出背单词
      </button>
    </div>
  )
}
