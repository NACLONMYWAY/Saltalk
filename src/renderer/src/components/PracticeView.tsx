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
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      {/* 顶部栏 */}
      <div className="flex gap-2 items-center flex-wrap">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && run()}
          placeholder={isExam ? '输入场景（如：图书馆借书、求职面试）' : '输入主题'}
          className="flex-1 min-w-[200px] bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-500 transition-colors"
        />
        <button onClick={pickRandomTopic} className="px-3 py-2 rounded-lg text-sm bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">
          随机
        </button>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="bg-white border border-zinc-300 rounded-lg px-2 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
        >
          {levelsOf(system).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {system === 'cet' ? opt.label : `${SYSTEM_LABEL[system]} ${opt.label}`}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm bg-zinc-900 text-zinc-50 font-medium disabled:opacity-50 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
        >
          {generating ? '生成中…' : hasContent ? '重新生成' : isExam ? '生成听力题' : '生成对话'}
        </button>
      </div>

      {isExam && !hasContent && !busy && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          四六级模式按真题形式生成：一段长对话 + 4 道四选一选择题。题干不会显示在屏幕上，由录音朗读。
        </p>
      )}

      {error && (
        <div className="flex items-center gap-3 text-sm text-red-500 dark:text-red-400">
          <span className="flex-1">{error}</span>
          {topic.trim() && (
            <button onClick={run} disabled={busy} className="shrink-0 px-3 py-1 rounded-lg border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors">
              重试
            </button>
          )}
        </div>
      )}

      {busy && (
        <div className="text-zinc-500 dark:text-zinc-400 text-sm flex items-center gap-2 py-4">
          <span className="inline-block w-3 h-3 border-2 border-zinc-400 dark:border-zinc-500 border-t-transparent rounded-full animate-spin" />
          {generating ? (isExam ? '正在命题…' : '正在生成对话…') : `正在合成语音…（共 ${sentences.length} 句${isExam ? ` + ${questions.length} 道题干` : ''}）`}
        </div>
      )}

      {hasContent && (isExam ? <CetPlayer sentences={sentences} questions={questions} /> : <DialoguePlayer sentences={sentences} />)}
    </div>
  )
}
