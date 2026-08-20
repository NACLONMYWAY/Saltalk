import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store.ts'
import type { SentenceView } from '../../../preload/index.ts'

interface DialoguePlayerProps {
  sentences: SentenceView[]
}

export default function DialoguePlayer({ sentences }: DialoguePlayerProps) {
  const [currentSeq, setCurrentSeq] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [slow, setSlow] = useState(false)
  const [loop, setLoop] = useState(false)
  const [showChinese, setShowChinese] = useState<Set<number>>(new Set())

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentSeqRef = useRef(-1)
  const sentencesRef = useRef<SentenceView[]>([])
  const slowRef = useRef(false)

  useEffect(() => {
    sentencesRef.current = sentences
  }, [sentences])

  useEffect(() => {
    slowRef.current = slow
  }, [slow])

  useEffect(() => {
    audioRef.current = new Audio()
    const audio = audioRef.current
    audio.onended = () => {
      setPlaying((prev) => {
        if (!prev) return prev
        if (loop) {
          audio.currentTime = 0
          audio.play()
          return true
        }
        const next = currentSeqRef.current + 1
        if (next < sentencesRef.current.length) {
          playAt(next)
          return true
        }
        return false
      })
    }
    return () => {
      audio.onended = null
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop])

  function playAt(seq: number): void {
    const s = sentencesRef.current[seq]
    const url = slowRef.current ? s?.slowAudioUrl : s?.audioUrl
    if (!url) return
    currentSeqRef.current = seq
    setCurrentSeq(seq)
    const audio = audioRef.current!
    audio.src = url
    audio.playbackRate = 1
    audio.play()
    setPlaying(true)
  }

  function playAll(): void {
    const start = currentSeqRef.current >= 0 ? currentSeqRef.current : 0
    playAt(start)
  }

  function stop(): void {
    audioRef.current?.pause()
    setPlaying(false)
  }

  function toggleChinese(seq: number): void {
    setShowChinese((prev) => {
      const next = new Set(prev)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* 播放控制 */}
      <div className="flex gap-2 items-center text-sm">
        <button
          onClick={playing ? stop : playAll}
          className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
        >
          {playing ? '停止' : '连续播放'}
        </button>
        <button
          onClick={() => setSlow(!slow)}
          className={`px-3 py-1.5 rounded-md border ${
            slow ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          慢速
        </button>
        <button
          onClick={() => setLoop(!loop)}
          className={`px-3 py-1.5 rounded-md border ${
            loop ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          单句循环
        </button>
      </div>

      {/* 句子列表 */}
      <div className="space-y-2">
        {sentences.map((s, seq) => (
          <SentenceItem
            key={s.id}
            sentence={s}
            current={seq === currentSeq}
            showChinese={showChinese.has(seq)}
            onPlay={() => playAt(seq)}
            onToggleChinese={() => toggleChinese(seq)}
          />
        ))}
      </div>
    </div>
  )
}

interface SentenceItemProps {
  sentence: SentenceView
  current: boolean
  showChinese: boolean
  onPlay: () => void
  onToggleChinese: () => void
}

function SentenceItem({ sentence, current, showChinese, onPlay, onToggleChinese }: SentenceItemProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const addWord = useAppStore((s) => s.addWord)

  const words = sentence.english.split(' ')

  function pickWord(clean: string): void {
    setSelectedWord(clean)
    setAdded(false)
    setAddError(null)
  }

  async function handleAddWord(): Promise<void> {
    if (!selectedWord) return
    setAddError(null)
    try {
      await addWord(selectedWord, sentence.id, sentence.english, sentence.chinese)
      setSelectedWord(null)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div
      className={`rounded-lg p-3 border transition-colors ${
        current ? 'bg-zinc-800 border-zinc-500' : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            sentence.speaker === 'A' ? 'bg-sky-600' : 'bg-emerald-600'
          }`}
        >
          {sentence.speaker}
        </span>

        <button
          onClick={onPlay}
          className="shrink-0 mt-0.5 text-zinc-400 hover:text-zinc-100 text-base leading-none"
          title="播放"
        >
          ▶
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-baseline leading-relaxed">
            {words.map((w, i) => {
              const clean = w.replace(/[^a-zA-Z'-]/g, '')
              if (!clean) return null
              return (
                <span
                  key={i}
                  onClick={() => pickWord(clean)}
                  className={`cursor-pointer px-0.5 rounded text-zinc-100 ${
                    selectedWord === clean ? 'bg-yellow-600/60' : 'hover:bg-zinc-700'
                  }`}
                >
                  {w}
                </span>
              )
            })}
          </div>

          {showChinese && <div className="text-zinc-400 text-sm mt-1">{sentence.chinese}</div>}

          {selectedWord && (
            <button
              onClick={handleAddWord}
              className="mt-2 px-2 py-0.5 rounded bg-yellow-500 text-zinc-900 text-xs font-medium"
            >
              + 加入单词本「{selectedWord}」
            </button>
          )}

          {added && <span className="ml-2 text-xs text-emerald-400">已加入 ✓</span>}
          {addError && <div className="mt-1 text-xs text-red-400">{addError}</div>}
        </div>

        <button
          onClick={onToggleChinese}
          className="shrink-0 text-zinc-500 hover:text-zinc-200 text-sm"
          title="翻译"
        >
          译
        </button>
      </div>
    </div>
  )
}
