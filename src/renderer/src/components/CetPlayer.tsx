import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuestionView, SentenceView } from '../../../preload/index.ts'
import {
  ANSWER_SECONDS,
  OPTION_LABELS,
  countCorrect,
  isAnswered,
  isCorrect,
  nextQuestionIndex,
  optionLabel,
  type ExamPhase
} from '../../../../shared/examFlow.ts'
import DialoguePlayer from './DialoguePlayer.tsx'

type Phase = ExamPhase

interface CetPlayerProps {
  sentences: SentenceView[]
  questions: QuestionView[]
}

export default function CetPlayer({ sentences, questions }: CetPlayerProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [qIndex, setQIndex] = useState(0)
  const [countdown, setCountdown] = useState(ANSWER_SECONDS)
  const [answers, setAnswers] = useState<Array<number | null>>([])
  const [revealedStem, setRevealedStem] = useState<Set<number>>(new Set())
  const [playingSeq, setPlayingSeq] = useState(-1)
  const [slow, setSlow] = useState(false)
  const [allowReplay, setAllowReplay] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const dialogueAudioRef = useRef<HTMLAudioElement | null>(null)
  const stemAudioRef = useRef<HTMLAudioElement | null>(null)
  const sentencesRef = useRef<SentenceView[]>([])
  const questionsRef = useRef<QuestionView[]>([])
  const qIndexRef = useRef(0)
  const answersRef = useRef<Array<number | null>>([])
  const slowRef = useRef(false)

  useEffect(() => {
    sentencesRef.current = sentences
  }, [sentences])
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])
  useEffect(() => {
    slowRef.current = slow
  }, [slow])

  // 题目集合变化（新生成 / 切换对话）时重置整场
  const signature = useMemo(() => questions.map((q) => q.id).join('|'), [questions])
  useEffect(() => {
    setPhase('idle')
    setQIndex(0)
    qIndexRef.current = 0
    setCountdown(ANSWER_SECONDS)
    const empty = new Array<number | null>(questionsRef.current.length).fill(null)
    answersRef.current = empty
    setAnswers(empty)
    setRevealedStem(new Set())
    setShowTranscript(false)
    setPlayingSeq(-1)
    dialogueAudioRef.current?.pause()
    stemAudioRef.current?.pause()
  }, [signature])

  useEffect(() => {
    const dialogueAudio = new Audio()
    const stemAudio = new Audio()
    dialogueAudioRef.current = dialogueAudio
    stemAudioRef.current = stemAudio
    return () => {
      dialogueAudio.onended = null
      stemAudio.onended = null
      dialogueAudio.pause()
      stemAudio.pause()
    }
  }, [])

  // ---------- 真题节奏：对话 → 逐题读题干 → 每题 15 秒 ----------

  function onDialogueEnd(): void {
    dialogueAudioRef.current?.pause()
    setPlayingSeq(-1)
    playStem(0)
  }

  function playSentence(seq: number): void {
    const audio = dialogueAudioRef.current
    if (!audio) return
    const s = sentencesRef.current[seq]
    if (!s) {
      onDialogueEnd()
      return
    }
    const url = slowRef.current ? (s.slowAudioUrl ?? s.audioUrl) : (s.audioUrl ?? s.slowAudioUrl)
    if (!url) {
      playSentence(seq + 1)
      return
    }
    audio.pause()
    audio.src = url
    audio.onended = () => {
      if (seq + 1 < sentencesRef.current.length) playSentence(seq + 1)
      else onDialogueEnd()
    }
    setPlayingSeq(seq)
    audio.play().catch(() => {
      if (seq + 1 < sentencesRef.current.length) playSentence(seq + 1)
      else onDialogueEnd()
    })
  }

  function startListening(): void {
    if (questionsRef.current.length === 0) return
    const empty = new Array<number | null>(questionsRef.current.length).fill(null)
    answersRef.current = empty
    setAnswers(empty)
    setRevealedStem(new Set())
    setQIndex(0)
    qIndexRef.current = 0
    setShowTranscript(false)
    setPhase('dialogue')
    playSentence(0)
  }

  /** 朗读某题题干；无音频时直接进入答题窗口（不影响其他题） */
  function playStem(i: number): void {
    const audio = stemAudioRef.current
    setQIndex(i)
    qIndexRef.current = i
    // 之前已自由作答过的题跳过，直接进下一题
    if (isAnswered(answersRef.current[i])) {
      const next = nextQuestionIndex(i, questionsRef.current.length)
      if (next !== null) {
        playStem(next)
        return
      }
      finish()
      return
    }
    setPhase('stem')
    const url = questionsRef.current[i]?.stemAudioUrl
    if (!audio || !url) {
      enterAnswerWindow(i)
      return
    }
    audio.pause()
    audio.src = url
    audio.onended = () => enterAnswerWindow(i)
    audio.play().catch(() => enterAnswerWindow(i))
  }

  /**
   * 进入某题的答题窗口。
   * 已作答就直接返回：用户可能在题干还没念完时就选了答案，
   * 这时音频结束不该再开一个 15 秒窗口，否则等于多给一次机会。
   */
  function enterAnswerWindow(i: number): void {
    if (isAnswered(answersRef.current[i])) return
    startAnswer(i)
  }

  function startAnswer(i: number): void {
    if (isAnswered(answersRef.current[i])) return
    setQIndex(i)
    qIndexRef.current = i
    setCountdown(ANSWER_SECONDS)
    setPhase('answering')
  }

  // 真题行为：15 秒内没作答也进入下一题
  useEffect(() => {
    if (phase !== 'answering') return
    if (countdown > 0) {
      const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => window.clearTimeout(t)
    }
    const i = qIndexRef.current
    const next = nextQuestionIndex(i, questionsRef.current.length)
    if (next !== null) playStem(next)
    else finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  function finish(): void {
    dialogueAudioRef.current?.pause()
    stemAudioRef.current?.pause()
    setPlayingSeq(-1)
    setPhase('finished')
    setShowTranscript(true)
  }

  /**
   * 作答。选项从一开头就全部可见（真题里选项本就印在试卷上），
   * 所以不强制「必须等念到这一题」才能选。
   */
  function pick(i: number, optionIndex: number): void {
    if (isAnswered(answersRef.current[i])) return
    const next = [...answersRef.current]
    next[i] = optionIndex
    answersRef.current = next
    setAnswers(next)

    if (i === qIndexRef.current && (phase === 'answering' || phase === 'stem')) {
      // 答完当前题就停表，让人有时间看解析（学习场景优先于还原度）
      setPhase('answered')
    }
    if (next.every((a) => isAnswered(a))) finish()
  }

  function goNext(): void {
    const next = nextQuestionIndex(qIndexRef.current, questionsRef.current.length)
    if (next !== null) playStem(next)
    else finish()
  }

  /** 重听某题题干：不改变当前状态，仅重播音频 */
  function replayStem(i: number): void {
    const audio = stemAudioRef.current
    const url = questionsRef.current[i]?.stemAudioUrl
    if (!audio || !url) return
    audio.pause()
    audio.onended = null
    audio.src = url
    audio.play().catch(() => {})
  }

  function stopAll(): void {
    dialogueAudioRef.current?.pause()
    stemAudioRef.current?.pause()
    setPlayingSeq(-1)
    setPhase('idle')
  }

  function toggleReveal(i: number): void {
    setRevealedStem((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // ---------- 渲染 ----------

  const total = questions.length
  const answeredCount = answers.filter(isAnswered).length
  const correctCount = countCorrect(answers, questions)
  const running = phase === 'dialogue' || phase === 'stem' || phase === 'answering' || phase === 'answered'

  if (total === 0) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        当前内容不是四六级听力题（没有题目数据）。请点上方「生成听力题」重新生成。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex gap-2 items-center flex-wrap text-sm">
        {phase === 'idle' && (
          <button
            onClick={startListening}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 text-zinc-50 font-medium hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
          >
            开始听力
          </button>
        )}
        {running && (
          <button
            onClick={stopAll}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
          >
            停止
          </button>
        )}
        {phase === 'finished' && (
          <button
            onClick={startListening}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
          >
            重做一遍
          </button>
        )}
        <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
          <input type="checkbox" checked={allowReplay} onChange={(e) => setAllowReplay(e.target.checked)} />
          允许重听材料（真题只播一遍）
        </label>
        <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
          慢速
        </label>
      </div>

      {/* 进度与成绩 */}
      <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500 flex-wrap">
        <span>共 {total} 题</span>
        <span>已答 {answeredCount}</span>
        {phase !== 'idle' && <span>当前第 {Math.min(qIndex + 1, total)} 题</span>}
        {phase === 'finished' && (
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
            正确 {correctCount} / {total}
          </span>
        )}
      </div>

      {/* 播放状态 */}
      {phase === 'dialogue' && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          正在播放对话材料（第 {playingSeq + 1} 句）…
          {allowReplay && (
            <button
              onClick={() => playSentence(0)}
              className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              重听
            </button>
          )}
        </div>
      )}
      {phase === 'stem' && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          正在朗读第 {qIndex + 1} 题题干…
        </div>
      )}

      {phase === 'idle' && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
          选项已全部列在下面（同真题：试卷上只有选项、没有问题，题干由录音读出）。
          点「开始听力」按真题节奏做：先播对话，再逐题朗读题干并留 15 秒；也可以直接点选项作答。
        </p>
      )}

      {/* 全部题目：选项始终可见 */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            question={q}
            answer={answers[i]}
            active={running && i === qIndex}
            counting={phase === 'answering' && i === qIndex}
            countdown={countdown}
            revealStem={revealedStem.has(i)}
            showNext={phase === 'answered' && i === qIndex}
            isLast={i + 1 >= total}
            onPick={(opt) => pick(i, opt)}
            onToggleReveal={() => toggleReveal(i)}
            onReplayStem={() => replayStem(i)}
            onNext={goNext}
          />
        ))}
      </div>

      {/* 成绩明细 */}
      {phase === 'finished' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-900 dark:text-zinc-100 font-medium">
            本轮完成：答对 {correctCount} / {total} 题
          </div>
          <div className="mt-2 space-y-1">
            {questions.map((q, i) => (
              <div key={q.id} className="text-xs text-zinc-500 dark:text-zinc-400">
                第 {i + 1} 题 · 你选 {isAnswered(answers[i]) ? optionLabel(answers[i]) : '未作答'} · 正确{' '}
                {optionLabel(q.answerIndex)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 原文与翻译（答完或手动展开） */}
      <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          {showTranscript ? '收起原文与翻译' : '查看原文与翻译（会揭露答案）'}
        </button>
        {showTranscript && <DialoguePlayer sentences={sentences} />}
      </div>
    </div>
  )
}

interface QuestionCardProps {
  index: number
  question: QuestionView
  answer: number | null | undefined
  /** 是否为真题节奏中正在处理的那一题 */
  active: boolean
  counting: boolean
  countdown: number
  revealStem: boolean
  showNext: boolean
  isLast: boolean
  onPick: (optionIndex: number) => void
  onToggleReveal: () => void
  onReplayStem: () => void
  onNext: () => void
}

function QuestionCard({
  index,
  question,
  answer,
  active,
  counting,
  countdown,
  revealStem,
  showNext,
  isLast,
  onPick,
  onToggleReveal,
  onReplayStem,
  onNext
}: QuestionCardProps) {
  const answered = isAnswered(answer)
  const correct = isCorrect(answer, question.answerIndex)
  const stemVisible = revealStem || answered

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-colors ${
        active
          ? 'border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">第 {index + 1} 题</span>
        {counting && <span className="text-xs text-amber-600 dark:text-amber-400">剩余 {countdown} 秒</span>}
        {answered && (
          <span
            className={`text-xs font-medium ${
              correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            }`}
          >
            {correct ? '答对 ✓' : `答错，正确答案 ${optionLabel(question.answerIndex)}`}
          </span>
        )}

        <div className="ml-auto flex gap-2">
          {!answered && (
            <button
              onClick={onToggleReveal}
              className="px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {stemVisible ? '收起题干' : '显示题干'}
            </button>
          )}
          {question.stemAudioUrl ? (
            <button
              onClick={onReplayStem}
              className="px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="重听题干朗读"
            >
              重听题干
            </button>
          ) : (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">题干音频未就绪</span>
          )}
        </div>
      </div>

      {stemVisible && (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          {question.stem}
          {question.stemChinese && (
            <span className="text-zinc-400 dark:text-zinc-500"> {question.stemChinese}</span>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {question.options.map((opt, i) => {
          const chosen = answered && answer === i
          const isAnswer = answered && question.answerIndex === i
          let cls =
            'bg-white border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 dark:hover:bg-zinc-800'
          if (isAnswer) {
            cls = 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700'
          } else if (chosen) {
            cls = 'bg-red-50 border-red-400 dark:bg-red-950/40 dark:border-red-700'
          }
          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              disabled={answered}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors disabled:cursor-default flex items-start gap-2 ${cls}`}
            >
              <span className="shrink-0 font-medium text-zinc-400 dark:text-zinc-500">
                {OPTION_LABELS[i] ?? i + 1}.
              </span>
              <span className="flex-1 text-zinc-800 dark:text-zinc-200">{opt}</span>
              {isAnswer && <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">正确答案</span>}
              {chosen && !isAnswer && <span className="shrink-0 text-xs text-red-500 dark:text-red-400">你的选择</span>}
            </button>
          )
        })}
      </div>

      {answered && question.explanation && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{question.explanation}</div>
      )}

      {showNext && (
        <button
          onClick={onNext}
          className="px-3 py-1.5 rounded-lg text-sm bg-zinc-900 text-zinc-50 font-medium hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
        >
          {isLast ? '查看结果' : '下一题'}
        </button>
      )}
    </div>
  )
}
