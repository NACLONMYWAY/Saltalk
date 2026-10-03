import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store.ts'
import type { WordView } from '../../../preload/index.ts'

export default function WordBookView() {
  const words = useAppStore((s) => s.words)
  const refreshWords = useAppStore((s) => s.refreshWords)
  const deleteWord = useAppStore((s) => s.deleteWord)
  const markWordMastered = useAppStore((s) => s.markWordMastered)
  const enrichMissingWords = useAppStore((s) => s.enrichMissingWords)

  const [filter, setFilter] = useState<'unlearned' | 'mastered'>('unlearned')
  const [studying, setStudying] = useState(false)

  useEffect(() => {
    refreshWords()
  }, [refreshWords])

  // 释义是背单词卡片的正面内容。历史数据、以及「加入单词本时词典/翻译还没回来」的词
  // 会缺它，卡片就只剩例句、看起来像「没有中文意思」。这里在进入单词本时后台补一次，
  // 补完由 store 自动刷新，卡片与列表随之填上释义。
  useEffect(() => {
    void enrichMissingWords()
  }, [enrichMissingWords])

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
    <div className="wrap">
      {/* 分类 tab + 背单词入口 */}
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="单词分类">
          <button
            role="tab"
            aria-selected={filter === 'unlearned'}
            onClick={() => setFilter('unlearned')}
            className="seg-btn"
          >
            未背 <em>{unlearned.length}</em>
          </button>
          <button
            role="tab"
            aria-selected={filter === 'mastered'}
            onClick={() => setFilter('mastered')}
            className="seg-btn"
          >
            已背 <em>{mastered.length}</em>
          </button>
        </div>

        {unlearned.length > 0 && (
          <button onClick={() => setStudying(true)} className="btn btn-primary ml-auto">
            <svg className="i">
              <use href="#i-layers" />
            </svg>
            开始背单词
          </button>
        )}
      </div>

      {/* 单词列表 */}
      <div className="list">
        {shown.map((w) => (
          <WordItem
            key={w.id}
            word={w}
            onDelete={deleteWord}
            onToggleMastered={(id, mastered) => markWordMastered(id, mastered)}
          />
        ))}
        {shown.length === 0 && (
          <div className="empty">
            <span className="empty-ico">
              <svg className="i i-lg">
                <use href="#i-book" />
              </svg>
            </span>
            <span className="empty-t">{filter === 'unlearned' ? '暂无未背单词' : '暂无已背单词'}</span>
            <span className="empty-d">
              {filter === 'unlearned'
                ? '在练习页点对话里的任意单词，就能把它收进这里。'
                : '背单词时点「会背」，单词就会移到这个分类。'}
            </span>
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
    <div className="row-word">
      <div className="grow">
        <div className="row-word-head">
          <span className="word-term">{word.word}</span>
          {word.phonetic && <span className="phon">{word.phonetic}</span>}
          <button
            onClick={() => play(word.wordAudioUrl)}
            disabled={!word.wordAudioUrl}
            className="icon-btn"
            title="播放单词发音"
            aria-label="播放单词发音"
          >
            <svg className="i i-sm">
              <use href="#i-vol" />
            </svg>
          </button>
        </div>

        {word.meaning ? (
          <div className="mean">{word.meaning}</div>
        ) : (
          <div className="mean mean-pending">释义获取中…</div>
        )}

        {word.example && (
          <div className="ex">
            {word.example}
            <button
              onClick={() => play(word.exampleAudioUrl)}
              disabled={!word.exampleAudioUrl}
              className="icon-btn inline ml-1"
              title="播放例句发音"
              aria-label="播放例句发音"
            >
              <svg className="i i-sm">
                <use href="#i-vol" />
              </svg>
            </button>
          </div>
        )}

        {word.exampleTranslation && <div className="ex-zh">{word.exampleTranslation}</div>}
      </div>

      <div className="row-acts">
        <button
          onClick={() => onToggleMastered(word.id, !mastered)}
          className="act-text"
          title={mastered ? '移回未背' : '标记已背'}
        >
          {mastered ? '移回未背' : '标记已背'}
        </button>
        <button onClick={() => onDelete(word.id)} className="act-text act-del" title="删除">
          删除
        </button>
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
  // 卡片内容从 store 实时取（而不是进来那一刻的快照）：
  // 后台补齐释义后卡片会自己更新，否则会永远停在「加入时还没有释义」的空卡上。
  const liveWords = useAppStore((s) => s.words)
  // 队列只记 id 与顺序：这样「标记会背后 store 列表变短」不会让队列对象失配，
  // 也不会出现跳词、提前「背完」。
  const [queue, setQueue] = useState<string[]>(() => words.map((w) => w.id))
  const [revealed, setRevealed] = useState(false)
  const busyRef = useRef(false)
  // 本轮的起始词数：只用于进度条分母。必须冻结，否则分母会随队列缩短而缩小，
  // 出现「0 / 4 → 0 / 3」这种看起来永远背不完的假象。
  const totalRef = useRef(words.length)

  const wordId = queue[0]
  const word = liveWords.find((w) => w.id === wordId) ?? words.find((w) => w.id === wordId)
  const total = totalRef.current
  const done = Math.max(0, total - queue.length)

  async function handleResult(mastered: boolean): Promise<void> {
    const current = word
    if (!current || busyRef.current) return
    busyRef.current = true
    try {
      setRevealed(false)
      // 从队头移除当前词；"还不会"的词移到队尾，稍后再次复习
      setQueue((q) => {
        const [, ...rest] = q
        if (!mastered) rest.push(current.id)
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
      <div className="wrap wrap-narrow">
        <div className="empty">
          <span className="empty-ico">
            <svg className="i i-lg">
              <use href="#i-check" />
            </svg>
          </span>
          <span className="empty-t">全部背完，太棒了！</span>
          <span className="empty-d">这一轮的单词都已标记为会背，可以在「已背」里回看。</span>
          <button onClick={onClose} className="btn btn-primary mt-2">
            返回单词本
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap wrap-narrow">
      {/* 进度：分母冻结在开局词数，纹丝不动 */}
      <div className="study-head">
        <button onClick={onClose} className="icon-btn" title="退出背单词" aria-label="退出背单词">
          <svg className="i">
            <use href="#i-chev-l" />
          </svg>
        </button>
        <span className="study-prog">
          <span className="bar">
            <i style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }} />
          </span>
        </span>
        <span className="study-count">
          {done} / {total}
        </span>
      </div>

      {/* 单词卡：点卡片翻面看中文 */}
      <div className={`flip${revealed ? ' back' : ''}`}>
        <div className="flip-in">
          <div className="face">
            <div className="face-word">{word.word}</div>
            {word.phonetic && <div className="face-phon">{word.phonetic}</div>}
            <div className="face-hint">先想想意思，再点下面看中文</div>
          </div>
          <div className="face face-back">
            {word.meaning ? (
              <div className="face-mean">{word.meaning}</div>
            ) : (
              // 释义没到位时只报「获取中」，不把例句顶上来当释义 ——
              // 否则用户会看到「一段话 + 这段话的中文」，误以为那就是单词释义。
              <div className="face-mean face-mean-pending">释义获取中…</div>
            )}
            {word.meaning && word.example && <div className="face-ex">{word.example}</div>}
            {word.meaning && word.exampleTranslation && (
              <div className="face-ex-zh">{word.exampleTranslation}</div>
            )}
          </div>
        </div>
      </div>

      {!revealed && (
        <button onClick={() => setRevealed(true)} className="btn btn-primary btn-block">
          显示中文
        </button>
      )}

      {/* 操作按钮 */}
      {revealed && (
        <div className="study-acts">
          <button onClick={() => handleResult(false)} className="btn">
            <svg className="i">
              <use href="#i-undo" />
            </svg>
            还不会
          </button>
          <button onClick={() => handleResult(true)} className="btn btn-primary">
            <svg className="i">
              <use href="#i-check" />
            </svg>
            会背
          </button>
        </div>
      )}

      <button onClick={onClose} className="btn btn-quiet self-center">
        退出背单词
      </button>
    </div>
  )
}
