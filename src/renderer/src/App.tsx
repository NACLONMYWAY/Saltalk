import { useEffect, useLayoutEffect, useState } from 'react'
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

type Theme = 'light' | 'dark'

export default function App() {
  const tab = useAppStore((s) => s.tab)
  const setTab = useAppStore((s) => s.setTab)
  const loadApiKey = useAppStore((s) => s.loadApiKey)

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme(): void {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-wide">Saltalk</h1>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  tab === t.key
                    ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <button
            onClick={toggleTheme}
            className="ml-2 w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
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
