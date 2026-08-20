import { useEffect } from 'react'
import { useAppStore, type Tab } from './store.ts'
import PracticeView from './components/PracticeView.tsx'
import WordBookView from './components/WordBookView.tsx'
import HistoryView from './components/HistoryView.tsx'
import SettingsView from './components/SettingsView.tsx'

const TABS: { key: Tab; label: string }[] = [
  { key: 'practice', label: '练习' },
  { key: 'words', label: '单词本' },
  { key: 'history', label: '历史' },
  { key: 'settings', label: '设置' }
]

export default function App() {
  const tab = useAppStore((s) => s.tab)
  const setTab = useAppStore((s) => s.setTab)
  const loadApiKey = useAppStore((s) => s.loadApiKey)

  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-wide">Saltalk</h1>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                tab === t.key ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto">
        {tab === 'practice' && <PracticeView />}
        {tab === 'words' && <WordBookView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
