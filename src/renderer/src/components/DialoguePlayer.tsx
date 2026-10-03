import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store.ts'
import { api } from '../api.ts'
import type { SentenceView, WordPreviewView } from '../../../preload/index.ts'

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
    <div className="player">
      {/* 播放控制 */}
      <div className="player-bar">
        <button onClick={playing ? stop : playAll} className="btn">
          <svg className="i">
            <use href={playing ? '#i-stop' : '#i-play'} />
          </svg>
          {playing ? '停止' : '连续播放'}
        </button>

        <button
          onClick={toggleSlow}
          aria-pressed={slow}
          className="chip"
          title="放慢语速朗读（换用慢速音频）"
        >
          <span className="chip-dot" />
          <svg className="i i-sm">
            <use href="#i-speed" />
          </svg>
          慢速
        </button>

        <button
          onClick={() => setLoop(!loop)}
          aria-pressed={loop}
          className="chip"
          title="当前句循环播放"
        >
          <span className="chip-dot" />
          <svg className="i i-sm">
            <use href="#i-loop" />
          </svg>
          单句循环
        </button>

        <span className="sent-count ml-auto">
          共 <b>{sentences.length}</b> 句
        </span>
      </div>

      {/* 句子列表：一整份带发丝线分隔，不再是各自带边框的小卡片 */}
      <div className="sent-list">
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
  const [preview, setPreview] = useState<WordPreviewView | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  // 快速连点不同的词时，用序号丢弃过期响应 —— 否则先发的慢请求回来会把新词的释义盖掉
  const previewSeqRef = useRef(0)
  // 本句是否已经预取过：只在第一次点词时发一次批量请求
  const prefetchedRef = useRef(false)
  const addWord = useAppStore((s) => s.addWord)

  const words = sentence.english.split(' ')
  const hasAudio = Boolean(sentence.audioUrl || sentence.slowAudioUrl)

  /** 把句子里所有可点的词提出来（去掉标点），供预取用 */
  function sentenceWords(): string[] {
    return words.map((w) => w.replace(/[^a-zA-Z'-]/g, '')).filter(Boolean)
  }

  // 卸载后不再回写状态
  useEffect(() => () => {
    previewSeqRef.current++
  }, [])

  // 点击单词会浮出「加入单词本」，点到别处就该收起。
  // 只在有选中词时挂监听，所以同时最多存在一个监听器。
  // 单词本体与「加入单词本」按钮带 data-word-pick，点它们不算「点到别处」。
  useEffect(() => {
    if (!selectedWord) return
    function onDocMouseDown(e: MouseEvent): void {
      const el = e.target as HTMLElement | null
      if (el && typeof el.closest === 'function' && el.closest('[data-word-pick]')) return
      setSelectedWord(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [selectedWord])

  /** 点词：立刻选中并浮出动作条，同时把这个词的意思查出来展示 */
  function pickWord(clean: string): void {
    setSelectedWord(clean)
    setAdded(false)
    setAddError(null)
    setPreview(null)
    setPreviewError(null)

    // 顺手把整句的词预取进缓存。用户点了一个不认识的词，大概率还会点第二个，
    // 那一个就不用再等一次网络了。只发一次，失败也不打扰用户。
    if (!prefetchedRef.current) {
      prefetchedRef.current = true
      void api.prefetchWords(sentenceWords()).catch(() => {})
    }

    const seq = ++previewSeqRef.current
    setPreviewLoading(true)
    api
      .previewWord(clean)
      .then((r) => {
        if (seq === previewSeqRef.current) setPreview(r)
      })
      .catch((e: unknown) => {
        if (seq === previewSeqRef.current) setPreviewError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (seq === previewSeqRef.current) setPreviewLoading(false)
      })
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
    <div className={`sent${current ? ' playing' : ''}`}>
      {/* 纯黑白区分说话人：A 实心 / B 描边 */}
      <span className={`badge ${sentence.speaker === 'A' ? 'badge-a' : 'badge-b'}`}>
        {sentence.speaker}
      </span>

      <div className="sent-body">
        <div className="en">
          {words.map((w, i) => {
            const clean = w.replace(/[^a-zA-Z'-]/g, '')
            if (!clean) return null
            return (
              <span
                key={i}
                data-word-pick
                onClick={() => pickWord(clean)}
                className={`w${selectedWord === clean ? ' picked' : ''}`}
              >
                {w}
              </span>
            )
          })}
        </div>

        {showChinese && <div className="zh">{sentence.chinese}</div>}

        {selectedWord && (
          <div className="pickbar">
            <span className="pick-word">{selectedWord}</span>
            {preview?.phonetic && <span className="pick-phon">{preview.phonetic}</span>}

            {/* 点词就把意思摆出来，不用先加进单词本才知道它是什么 */}
            {previewLoading && <span className="pick-mean pick-mean-wait">查询中…</span>}
            {!previewLoading && previewError && (
              <span className="pick-mean pick-mean-miss" title={previewError}>
                释义获取失败
              </span>
            )}
            {!previewLoading && !previewError && preview?.meaning && (
              <span className="pick-mean">{preview.meaning}</span>
            )}
            {!previewLoading && !previewError && preview && !preview.meaning && (
              <span className="pick-mean pick-mean-miss">未查到释义</span>
            )}

            {preview?.inBook ? (
              <span className="pick-note">已在单词本</span>
            ) : (
              <button data-word-pick onClick={handleAddWord} className="btn btn-xs btn-primary">
                <svg className="i i-xs">
                  <use href="#i-plus" />
                </svg>
                加入单词本
              </button>
            )}
          </div>
        )}

        {added && (
          <div className="toast-inline mt-2">
            <svg className="i i-sm">
              <use href="#i-check" />
            </svg>
            已加入单词本
          </div>
        )}

        {addError && (
          <div className="note note-danger mt-2">
            <svg className="i i-sm">
              <use href="#i-alert" />
            </svg>
            <span>{addError}</span>
          </div>
        )}
      </div>

      <div className="sent-actions">
        {current && (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <button
          onClick={onPlay}
          disabled={!hasAudio}
          className="icon-btn"
          title={hasAudio ? '播放' : '音频未就绪'}
          aria-label={hasAudio ? '播放这一句' : '音频未就绪'}
        >
          <svg className="i">
            <use href="#i-play" />
          </svg>
        </button>
        <button
          onClick={onToggleChinese}
          className="icon-btn"
          aria-pressed={showChinese}
          title="翻译"
          aria-label="展开或收起中文翻译"
        >
          <svg className="i">
            <use href="#i-trs" />
          </svg>
        </button>
      </div>
    </div>
  )
}
