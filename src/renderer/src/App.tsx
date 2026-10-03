import { useEffect, useLayoutEffect, useState } from 'react'
import { useAppStore, type Tab } from './store.ts'
import PracticeView from './components/PracticeView.tsx'
import WordBookView from './components/WordBookView.tsx'
import HistoryView from './components/HistoryView.tsx'
import SettingsView from './components/SettingsView.tsx'
import IconSprite from './components/Icons.tsx'

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
  const loadSettings = useAppStore((s) => s.loadSettings)

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme(): void {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="shell">
      <IconSprite />

      <header className="appbar">
        <div className="brand">
          <span className="brand-name">Saltalk</span>
          <span className="brand-sub">Listening</span>
        </div>

        {/* 下划线式导航：指示线挂在当前项自己的 ::after 上，不做位置测量，零抖动 */}
        <nav className="nav" role="tablist" aria-label="主导航">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="nav-btn"
            >
              {t.label}
            </button>
          ))}
        </nav>

        <span className="appbar-sep" />

        <button
          onClick={toggleTheme}
          className="theme-sw"
          aria-label="切换主题"
          title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
        >
          <span className="theme-knob">
            <svg className="i">
              <use href={theme === 'dark' ? '#i-moon' : '#i-sun'} />
            </svg>
          </span>
        </button>
      </header>

      <main className="main">
        {/* key 让切页时重放入场动效；仅动画，不改变任何渲染逻辑 */}
        <div className="view" key={tab}>
          {tab === 'practice' && <PracticeView />}
          {tab === 'words' && <WordBookView />}
          {tab === 'history' && <HistoryView />}
          {tab === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  )
}
