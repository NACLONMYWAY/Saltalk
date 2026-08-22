import { useAppStore } from '../store.ts'
import { CEFR_LEVELS } from '../../../../shared/types.ts'
import DialoguePlayer from './DialoguePlayer.tsx'

export default function PracticeView() {
  const topic = useAppStore((s) => s.topic)
  const level = useAppStore((s) => s.level)
  const sentences = useAppStore((s) => s.sentences)
  const generating = useAppStore((s) => s.generating)
  const synthing = useAppStore((s) => s.synthing)
  const error = useAppStore((s) => s.error)
  const setTopic = useAppStore((s) => s.setTopic)
  const setLevel = useAppStore((s) => s.setLevel)
  const generate = useAppStore((s) => s.generate)
  const pickRandomTopic = useAppStore((s) => s.pickRandomTopic)
  const synthesize = useAppStore((s) => s.synthesize)

  async function handleGenerate(): Promise<void> {
    await generate()
    await synthesize()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      {/* 顶部栏 */}
      <div className="flex gap-2 items-center">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="输入主题"
          className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-500 transition-colors"
        />
        <button
          onClick={pickRandomTopic}
          className="px-3 py-2 rounded-lg text-sm bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
        >
          随机
        </button>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as typeof level)}
          className="bg-white border border-zinc-300 rounded-lg px-2 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
        >
          {CEFR_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg text-sm bg-zinc-900 text-zinc-50 font-medium disabled:opacity-50 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
        >
          {generating ? '生成中…' : '生成对话'}
        </button>
      </div>

      {error && <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>}

      {(generating || synthing) && (
        <div className="text-zinc-500 dark:text-zinc-400 text-sm flex items-center gap-2 py-4">
          <span className="inline-block w-3 h-3 border-2 border-zinc-400 dark:border-zinc-500 border-t-transparent rounded-full animate-spin" />
          {generating ? '正在生成对话…' : '正在合成语音…'}
        </div>
      )}

      {sentences.length > 0 && <DialoguePlayer sentences={sentences} />}
    </div>
  )
}
