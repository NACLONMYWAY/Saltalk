import { useAppStore } from '../store.ts'
import { SYSTEM_LABEL, levelsOf } from '../../../../shared/exams.ts'
import DialoguePlayer from './DialoguePlayer.tsx'
import CetPlayer from './CetPlayer.tsx'

export default function PracticeView() {
  const topic = useAppStore((s) => s.topic)
  const system = useAppStore((s) => s.system)
  const level = useAppStore((s) => s.level)
  const sentences = useAppStore((s) => s.sentences)
  const questions = useAppStore((s) => s.questions)
  const examIntroUrl = useAppStore((s) => s.examIntroUrl)
  const generating = useAppStore((s) => s.generating)
  const synthing = useAppStore((s) => s.synthing)
  const error = useAppStore((s) => s.error)
  const setTopic = useAppStore((s) => s.setTopic)
  const setLevel = useAppStore((s) => s.setLevel)
  const generate = useAppStore((s) => s.generate)
  const pickRandomTopic = useAppStore((s) => s.pickRandomTopic)
  const synthesize = useAppStore((s) => s.synthesize)

  const busy = generating || synthing
  const isExam = system === 'cet'
  const hasContent = sentences.length > 0

  async function run(): Promise<void> {
    const ok = await generate()
    if (ok) await synthesize()
  }

  return (
    <div className="wrap">
      {/* 工具栏：随机按钮收进输入框内部，同级控件从 4 个降到 3 个 */}
      <div className="toolbar">
        <div className="field">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && run()}
            placeholder={isExam ? '输入场景（如：图书馆借书、求职面试）' : '输入主题'}
            className="input"
          />
          <button
            onClick={pickRandomTopic}
            className="icon-btn field-suffix"
            title="随机换一个主题"
            aria-label="随机换一个主题"
          >
            <svg className="i">
              <use href="#i-shuffle" />
            </svg>
          </button>
        </div>

        <span className="sel sel-fixed">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="input">
            {levelsOf(system).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {system === 'cet' ? opt.label : `${SYSTEM_LABEL[system]} ${opt.label}`}
              </option>
            ))}
          </select>
          <svg className="i i-sm sel-chev">
            <use href="#i-chev" />
          </svg>
        </span>

        <button onClick={run} disabled={busy} className="btn btn-primary">
          <svg className="i">
            <use href="#i-spark" />
          </svg>
          {generating ? '生成中…' : hasContent ? '重新生成' : isExam ? '生成听力题' : '生成对话'}
        </button>
      </div>

      {isExam && !hasContent && !busy && (
        <div className="note">
          <svg className="i">
            <use href="#i-info" />
          </svg>
          <span>
            四六级模式按真题形式生成：一段长对话 + 4 道四选一选择题。录音流程与真题一致 —
            先播报考试说明，再放对话，最后逐题朗读题干（带题号）并留 15 秒作答；题干不显示在屏幕上。
          </span>
        </div>
      )}

      {error && (
        <div className="note note-danger">
          <svg className="i">
            <use href="#i-alert" />
          </svg>
          <span className="grow">{error}</span>
          {topic.trim() && (
            <button onClick={run} disabled={busy} className="btn btn-xs">
              重试
            </button>
          )}
        </div>
      )}

      {busy && (
        <div className="busy-box">
          <div className="busy">
            <span className="spin" />
            <span className="busy-label">
              {generating
                ? isExam
                  ? '正在命题…'
                  : '正在生成对话…'
                : '正在合成语音…'}
            </span>
            {!generating && (
              <span className="busy-count">
                共 {sentences.length} 句{isExam ? ` + ${questions.length} 道题干` : ''}
              </span>
            )}
          </div>
          <div className="bar" />
        </div>
      )}

      {isExam && hasContent && questions.length === 0 && (
        <div className="note note-warn">
          <svg className="i">
            <use href="#i-alert" />
          </svg>
          <span>当前内容是旧的（不含题目数据），已按普通对话显示。点「重新生成」按四六级形式出题。</span>
        </div>
      )}

      {hasContent &&
        (isExam && questions.length > 0 ? (
          <CetPlayer sentences={sentences} questions={questions} introUrl={examIntroUrl} />
        ) : (
          <DialoguePlayer sentences={sentences} />
        ))}
    </div>
  )
}
