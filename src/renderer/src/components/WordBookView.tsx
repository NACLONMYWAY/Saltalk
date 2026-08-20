import { useEffect } from 'react'
import { useAppStore } from '../store.ts'

export default function WordBookView() {
  const words = useAppStore((s) => s.words)
  const refreshWords = useAppStore((s) => s.refreshWords)
  const deleteWord = useAppStore((s) => s.deleteWord)

  useEffect(() => {
    refreshWords()
  }, [refreshWords])

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-2">
      {words.map((w) => (
        <div key={w.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-lg font-semibold text-zinc-100">{w.word}</span>
                {w.phonetic && <span className="text-sm text-zinc-500">{w.phonetic}</span>}
              </div>
              {w.meaning && <div className="text-sm text-zinc-400 mt-1">{w.meaning}</div>}
              {w.example && <div className="text-sm text-zinc-500 mt-1 italic">{w.example}</div>}
              {w.exampleTranslation && (
                <div className="text-sm text-zinc-500 mt-0.5">{w.exampleTranslation}</div>
              )}
            </div>
            <button
              onClick={() => deleteWord(w.id)}
              className="shrink-0 px-2 py-1 rounded text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
              title="删除"
            >
              删除
            </button>
          </div>
        </div>
      ))}
      {words.length === 0 && <div className="text-zinc-500 text-center py-8">单词本为空</div>}
    </div>
  )
}
