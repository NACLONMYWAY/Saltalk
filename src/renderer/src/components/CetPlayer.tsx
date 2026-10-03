import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
  /** 引导语音频 URL（材料播放前播报）；可为 null，此时直接进对话 */
  introUrl?: string | null
}

/** 真题节奏的四个阶段，只用于展示「现在走到哪一步」 */
const RAIL = ['考试说明', '对话材料', '朗读题干', '作答']

/** 当前处于第几步；finished = 4 表示全程走完。idle 时返回 -1（都不高亮） */
function railIndex(phase: Phase): number {
  switch (phase) {
    case 'intro':
      return 0
    case 'dialogue':
      return 1
    case 'stem':
      return 2
    case 'answering':
    case 'answered':
      return 3
    case 'finished':
      return 4
    default:
      return -1
  }
}

/** 环形倒计时的几何参数 */
const RING_R = 13
const RING_C = 2 * Math.PI * RING_R

export default function CetPlayer({ sentences, questions, introUrl = null }: CetPlayerProps) {
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
  const introAudioRef = useRef<HTMLAudioElement | null>(null)
  const sentencesRef = useRef<SentenceView[]>([])
  const questionsRef = useRef<QuestionView[]>([])
  const qIndexRef = useRef(0)
  const answersRef = useRef<Array<number | null>>([])
  const slowRef = useRef(false)
  const introUrlRef = useRef<string | null>(null)

  useEffect(() => {
    introUrlRef.current = introUrl
  }, [introUrl])

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
    const introAudio = new Audio()
    dialogueAudioRef.current = dialogueAudio
    stemAudioRef.current = stemAudio
    introAudioRef.current = introAudio
    return () => {
      dialogueAudio.onended = null
      stemAudio.onended = null
      introAudio.onended = null
      dialogueAudio.pause()
      stemAudio.pause()
      introAudio.pause()
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
    playIntro()
  }

  /** 真题流程：先播报引导语（"Questions 1 to 4 are based on ..."），再放对话 */
  function playIntro(): void {
    const audio = introAudioRef.current
    const url = introUrlRef.current
    if (!audio || !url) {
      startDialogue()
      return
    }
    setPhase('intro')
    audio.pause()
    audio.src = url
    audio.onended = () => startDialogue()
    audio.play().catch(() => startDialogue())
  }

  function startDialogue(): void {
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
    introAudioRef.current?.pause()
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
    introAudioRef.current?.pause()
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
  const running =
    phase === 'intro' || phase === 'dialogue' || phase === 'stem' || phase === 'answering' || phase === 'answered'
  const rail = railIndex(phase)

  if (total === 0) {
    return (
      <div className="note note-warn">
        <svg className="i">
          <use href="#i-alert" />
        </svg>
        <span>当前内容不是四六级听力题（没有题目数据）。请点上方「生成听力题」重新生成。</span>
      </div>
    )
  }

  return (
    <div className="cet">
      {/* 工具栏 */}
      <div className="toolbar">
        {phase === 'idle' && (
          <button onClick={startListening} className="btn btn-primary">
            <svg className="i">
              <use href="#i-play" />
            </svg>
            开始听力
          </button>
        )}
        {running && (
          <button onClick={stopAll} className="btn">
            <svg className="i">
              <use href="#i-stop" />
            </svg>
            停止
          </button>
        )}
        {phase === 'finished' && (
          <button onClick={startListening} className="btn">
            <svg className="i">
              <use href="#i-undo" />
            </svg>
            重做一遍
          </button>
        )}

        <label className="chip">
          <input type="checkbox" checked={allowReplay} onChange={(e) => setAllowReplay(e.target.checked)} />
          <span className="chip-dot" />
          允许重听材料
        </label>

        <label className="chip">
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
          <span className="chip-dot" />
          慢速
        </label>
      </div>

      {/* 真题节奏：走到哪一步 */}
      <div className="rail">
        {RAIL.map((label, i) => (
          <Fragment key={label}>
            <span className={`rail-step${i < rail ? ' done' : ''}${i === rail ? ' active' : ''}`}>
              <span className="rail-dot">
                {i < rail ? (
                  <svg className="i i-xs">
                    <use href="#i-check" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              {label}
            </span>
            {i < RAIL.length - 1 && <span className="rail-line" />}
          </Fragment>
        ))}
      </div>

      {/* 进度与成绩 */}
      <div className="meta">
        <span>
          共 <b>{total}</b> 题
        </span>
        <span className="meta-sep" />
        <span>
          已答 <b>{answeredCount}</b>
        </span>
        {phase !== 'idle' && (
          <>
            <span className="meta-sep" />
            <span>
              当前第 <b>{Math.min(qIndex + 1, total)}</b> 题
            </span>
          </>
        )}
        {phase === 'finished' && (
          <>
            <span className="meta-sep" />
            <span>
              正确{' '}
              <b className="strong">
                {correctCount} / {total}
              </b>
            </span>
          </>
        )}
      </div>

      {/* 播放状态 */}
      {phase === 'intro' && (
        <div className="playstate">
          <span className="pulse" />
          正在播放考试说明…
        </div>
      )}
      {phase === 'dialogue' && (
        <div className="playstate">
          <span className="pulse" />
          正在播放对话材料（第 {playingSeq + 1} 句）…
          {allowReplay && (
            <button onClick={() => playSentence(0)} className="btn btn-xs ml-1">
              <svg className="i i-xs">
                <use href="#i-undo" />
              </svg>
              重听
            </button>
          )}
        </div>
      )}
      {phase === 'stem' && (
        <div className="playstate">
          <span className="pulse pulse-o" />
          正在朗读第 {qIndex + 1} 题题干…
        </div>
      )}

      {phase === 'idle' && (
        <div className="note">
          <svg className="i">
            <use href="#i-info" />
          </svg>
          <span>
            选项已全部列在下面（同真题：试卷上只有选项、没有问题，题干由录音读出）。
            点「开始听力」按真题节奏走：先播考试说明 → 放对话 → 逐题朗读题干（带题号）并留 15 秒；
            也可以直接点选项作答。
          </span>
        </div>
      )}

      {/* 全部题目：选项始终可见 */}
      <div className="q-list">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            total={total}
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
        <div className="card card-pad">
          <div className="big-score">
            <span className="n">{correctCount}</span>
            <span className="d">/ {total} 题答对</span>
          </div>
          <div className="mt-3">
            {questions.map((q, i) => {
              const ok = isCorrect(answers[i], q.answerIndex)
              return (
                <div key={q.id} className="score-row">
                  <span className="sr-no">第 {i + 1} 题</span>
                  <span className="sr-you">
                    你选 {isAnswered(answers[i]) ? optionLabel(answers[i]) : '未作答'}
                  </span>
                  <span className="sr-right">正确 {optionLabel(q.answerIndex)}</span>
                  <span className="score-bar">
                    <i style={{ width: ok ? '100%' : '0%' }} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 原文与翻译（答完或手动展开） */}
      <div className="transcript">
        <button onClick={() => setShowTranscript((v) => !v)} className="btn btn-sm btn-quiet">
          <svg className="i i-sm">
            <use href={showTranscript ? '#i-chev' : '#i-chev-r'} />
          </svg>
          {showTranscript ? '收起原文与翻译' : '查看原文与翻译（会揭露答案）'}
        </button>
        {showTranscript && <DialoguePlayer sentences={sentences} />}
      </div>
    </div>
  )
}

interface QuestionCardProps {
  index: number
  total: number
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
  total,
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
    <div className={`q${active ? ' active' : ''}`}>
      <div className="q-head">
        <span className="q-no">
          第 {index + 1} 题 <span>/ {total}</span>
        </span>

        {counting && (
          // 注意 1：类名必须叫 cd-ring，不能叫 ring —— ring 是 Tailwind 的工具类，
          //   会给元素加一层 3px 蓝色 box-shadow（--tw-ring-shadow），纯黑白体系里是明显杂色。
          //   诊断依据：getComputedStyle(.ring).boxShadow === "rgba(59,130,246,0.5) 0 0 0 3px"。
          // 注意 2：不要给这个非交互的 span 加 title（会用系统 tooltip 方框），
          //   也无障碍信息走 aria-label；秒数本身已经画在环里了。
          <span className="cd-ring" role="timer" aria-label={`剩余 ${countdown} 秒`}>
            <svg width="30" height="30" viewBox="0 0 30 30">
              <circle className="rb" cx="15" cy="15" r={RING_R} />
              <circle
                className="rf"
                cx="15"
                cy="15"
                r={RING_R}
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - countdown / ANSWER_SECONDS)}
              />
            </svg>
            <span className="cd-ring-num">{countdown}</span>
          </span>
        )}

        {answered && (
          <span className={`tag ${correct ? 'tag-ok' : 'tag-no'}`}>
            <svg className="i i-xs">
              <use href={correct ? '#i-check' : '#i-x'} />
            </svg>
            {correct ? '答对' : `答错 · 正确答案 ${optionLabel(question.answerIndex)}`}
          </span>
        )}

        <div className="q-tools">
          {!answered && (
            <button onClick={onToggleReveal} className="btn btn-xs">
              <svg className="i i-xs">
                <use href={stemVisible ? '#i-chev' : '#i-text'} />
              </svg>
              {stemVisible ? '收起题干' : '显示题干'}
            </button>
          )}
          {question.stemAudioUrl ? (
            <button onClick={onReplayStem} className="btn btn-xs" title="重听题干朗读">
              <svg className="i i-xs">
                <use href="#i-vol" />
              </svg>
              重听题干
            </button>
          ) : (
            <span className="dim">题干音频未就绪</span>
          )}
        </div>
      </div>

      {stemVisible && (
        <div className="stem">
          {question.stem}
          {question.stemChinese && <span className="zh-inline"> {question.stemChinese}</span>}
        </div>
      )}

      <div className="opts">
        {question.options.map((opt, i) => {
          const chosen = answered && answer === i
          const isAnswer = answered && question.answerIndex === i
          // 对错只靠文字 / 边框 / 左侧状态轨表达；语义色可整体关成纯黑白
          const state = isAnswer ? 'correct' : chosen ? 'wrong' : 'plain'
          return (
            <button
              key={i}
              data-state={state}
              onClick={() => onPick(i)}
              disabled={answered}
              className="opt"
            >
              <span className="opt-key">{OPTION_LABELS[i] ?? i + 1}.</span>
              <span className="opt-text">{opt}</span>
              {isAnswer && <span className="opt-tag">正确答案</span>}
              {chosen && !isAnswer && <span className="opt-tag">你的选择</span>}
            </button>
          )
        })}
      </div>

      {answered && question.explanation && (
        <div className="exp">
          <div className="exp-h">解析</div>
          {question.explanation}
        </div>
      )}

      {showNext && (
        <button onClick={onNext} className="btn btn-primary mt-3">
          {isLast ? '查看结果' : '下一题'}
        </button>
      )}
    </div>
  )
}
