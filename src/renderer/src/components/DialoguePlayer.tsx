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
  const loopRef = useRef(false)
  const playingRef = useRef(false)

  useEffect(() => {
    sentencesRef.current = sentences
  }, [sentences])

  useEffect(() => {
    slowRef.current = slow
  }, [slow])

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.onended = () => {
      if (loopRef.current) {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      if (!playingRef.current) return
      const next = currentSeqRef.current + 1
      if (next < sentencesRef.current.length) {
        playAt(next)
      } else {
        playingRef.current = false
        setPlaying(false)
        setCurrentSeq(-1)
      }
    }
    return () => {
      audio.onended = null
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function playAt(seq: number): void {
    const s = sentencesRef.current[seq]
    const url = slowRef.current ? s?.slowAudioUrl : s?.audioUrl
    if (!url) return
    const audio = audioRef.current!
    audio.pause()
    audio.src = url
    audio.playbackRate = 1
    currentSeqRef.current = seq
    setCurrentSeq(seq)
    playingRef.current = true
    setPlaying(true)
    audio.play().catch(() => {
      playingRef.current = false
      setPlaying(false)
    })
  }

  function playAll(): void {
    const start =
      currentSeqRef.current >= 0 && currentSeqRef.current < sentencesRef.current.length
        ? currentSeqRef.current
        : 0
    playAt(start)
  }

  function stop(): void {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    playingRef.current = false
    setPlaying(false)
    setCurrentSeq(-1)
  }

  function toggleSlow(): void {
    stop()
    setSlow(!slow)
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
          className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
        >
          {playing ? '停止' : '连续播放'}
        </button>
        <button
          onClick={toggleSlow}
          className={`px-3 py-1.5 rounded-lg border transition-colors ${
            slow
              ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
              : 'bg-white border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'
          }`}
        >
          慢速
        </button>
        <button
          onClick={() => setLoop(!loop)}
          className={`px-3 py-1.5 rounded-lg border transition-colors ${
            loop
              ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
              : 'bg-white border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'
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
  const hasAudio = Boolean(sentence.audioUrl || sentence.slowAudioUrl)

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
      className={`rounded-xl p-3 border transition-colors ${
        current
          ? 'bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-zinc-500'
          : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
            sentence.speaker === 'A' ? 'bg-sky-500' : 'bg-emerald-500'
          }`}
        >
          {sentence.speaker}
        </span>

        <button
          onClick={onPlay}
          disabled={!hasAudio}
          className={`shrink-0 mt-0.5 text-base leading-none ${
            hasAudio
              ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-100'
              : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
          }`}
          title={hasAudio ? '播放' : '音频未就绪'}
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
                  className={`cursor-pointer px-0.5 rounded transition-colors ${
                    selectedWord === clean
                      ? 'bg-yellow-300/70 dark:bg-yellow-600/60'
                      : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {w}
                </span>
              )
            })}
          </div>

          {showChinese && <div className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{sentence.chinese}</div>}

          {selectedWord && (
            <button
              onClick={handleAddWord}
              className="mt-2 px-2 py-0.5 rounded bg-yellow-400 text-zinc-900 text-xs font-medium hover:bg-yellow-300 dark:bg-yellow-500 dark:hover:bg-yellow-400 transition-colors"
            >
              + 加入单词本「{selectedWord}」
            </button>
          )}

          {added && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">已加入 ✓</span>}
          {addError && <div className="mt-1 text-xs text-red-500 dark:text-red-400">{addError}</div>}
        </div>

        <button
          onClick={onToggleChinese}
          className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm transition-colors"
          title="翻译"
        >
          译
        </button>
      </div>
    </div>
  )
}
