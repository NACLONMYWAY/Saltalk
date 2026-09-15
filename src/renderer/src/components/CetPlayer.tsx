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

  // 题目集合变化（新生成/切换对话）时重置整场考试
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

  // ---------- 状态流转 ----------

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
    setPhase('stem')
    const url = questionsRef.current[i]?.stemAudioUrl
    if (!audio || !url) {
      startAnswer(i)
      return
    }
    audio.pause()
    audio.src = url
    audio.onended = () => startAnswer(i)
    audio.play().catch(() => startAnswer(i))
  }

  function startAnswer(i: number): void {
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
    stemAudioRef.current?.pause()
    setPlayingSeq(-1)
    setPhase('finished')
    setShowTranscript(true)
  }

  function pick(optionIndex: number): void {
    const i = qIndexRef.current
    if (isAnswered(answersRef.current[i])) return
    const next = [...answersRef.current]
    next[i] = optionIndex
    answersRef.current = next
    setAnswers(next)
    setPhase('answered')
  }

  function goNext(): void {
    const next = nextQuestionIndex(qIndexRef.current, questionsRef.current.length)
    if (next !== null) playStem(next)
    else finish()
  }

  /** 重听题干：不改变当前状态，仅重播音频 */
  function replayStem(): void {
    const audio = stemAudioRef.current
    const url = questionsRef.current[qIndexRef.current]?.stemAudioUrl
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
  const current = questions[qIndex]
  const currentAnswered = isAnswered(answers[qIndex])
  const running = phase === 'dialogue' || phase === 'stem' || phase === 'answering' || phase === 'answered'

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex gap-2 items-center flex-wrap text-sm">
        {phase === 'idle' && (
          <button onClick={startListening} className="px-4 py-1.5 rounded-lg bg-zinc-900 text-zinc-50 font-medium hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors">
            开始听力
          </button>
        )}
        {running && (
          <button onClick={stopAll} className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">
            停止
          </button>
        )}
        {phase === 'finished' && (
          <button onClick={startListening} className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">
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

      {/* 进度 */}
      {phase !== 'idle' && (
        <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>
            第 {Math.min(qIndex + 1, total)} / {total} 题
          </span>
          <span>已答 {answeredCount}</span>
          {phase === 'finished' && (
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              正确 {correctCount} / {total}
            </span>
          )}
        </div>
      )}

      {/* 播放状态提示 */}
      {phase === 'dialogue' && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          正在播放对话材料（第 {playingSeq + 1} 句）…
          {allowReplay && (
            <button onClick={() => playSentence(0)} className="ml-2 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
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

      {/* 答题区：题干不在试卷上，只给选项 */}
      {current && (phase === 'answering' || phase === 'answered' || phase === 'finished') && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">第 {qIndex + 1} 题</span>

            {phase === 'answering' && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                剩余 {countdown} 秒
              </span>
            )}

            <div className="ml-auto flex gap-2">
              {!currentAnswered && (
                <button
                  onClick={() => toggleReveal(qIndex)}
                  className="px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {revealedStem.has(qIndex) ? '收起题干' : '显示题干'}
                </button>
              )}
              {current.stemAudioUrl ? (
                <button
                  onClick={replayStem}
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

          {(revealedStem.has(qIndex) || currentAnswered) && (
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              {current.stem}
              {current.stemChinese && (
                <span className="text-zinc-400 dark:text-zinc-500"> {current.stemChinese}</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {current.options.map((opt, i) => {
              const chosen = currentAnswered && answers[qIndex] === i
              const isAnswer = currentAnswered && current.answerIndex === i
              let cls = 'bg-white border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 dark:hover:bg-zinc-800'
              if (isAnswer) {
                cls = 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700'
              } else if (chosen) {
                cls = 'bg-red-50 border-red-400 dark:bg-red-950/40 dark:border-red-700'
              }
              return (
                <button
                  key={i}
                  onClick={() => phase === 'answering' && pick(i)}
                  disabled={phase !== 'answering'}
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

          {currentAnswered && (
            <div className="space-y-2 pt-1">
              <div className="text-sm">
                {isCorrect(answers[qIndex], current.answerIndex) ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">答对了 ✓</span>
                ) : (
                  <span className="text-red-500 dark:text-red-400 font-medium">
                    答错了，正确答案是 {optionLabel(current.answerIndex)}
                  </span>
                )}
              </div>
              {current.explanation && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{current.explanation}</div>
              )}
              {phase === 'answered' && (
                <button onClick={goNext} className="px-3 py-1.5 rounded-lg text-sm bg-zinc-900 text-zinc-50 font-medium hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors">
                  {qIndex + 1 < total ? '下一题' : '查看结果'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 成绩 */}
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

      {/* 原文与翻译：答题后默认展开，也支持单词本与逐句精听 */}
      {(phase === 'finished' || phase === 'idle') && (
        <div className="space-y-2">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {showTranscript ? '收起原文与翻译' : '查看原文与翻译（会揭露答案）'}
          </button>
        </div>
      )}
      {showTranscript && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <DialoguePlayer sentences={sentences} />
        </div>
      )}
    </div>
  )
}
