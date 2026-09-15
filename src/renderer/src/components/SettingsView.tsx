import { useRef, useState } from 'react'
import { useAppStore } from '../store.ts'
import { api } from '../api.ts'
import { EXAM_SYSTEMS, SYSTEM_HINT, SYSTEM_LABEL, levelOption, levelsOf } from '../../../../shared/exams.ts'
import { voicesByAccent } from '../../../../shared/voices.ts'
import type { ExamSystem } from '../../../../shared/types.ts'

const inputClass =
  'bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-500 transition-colors'

const primaryBtn =
  'px-4 py-2 rounded-lg text-sm bg-zinc-900 text-zinc-50 font-medium hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors'

const ghostBtn =
  'px-3 py-1.5 rounded-lg text-sm bg-white border border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors'

export default function SettingsView() {
  const system = useAppStore((s) => s.system)
  const level = useAppStore((s) => s.level)
  const setLevel = useAppStore((s) => s.setLevel)
  const changeSystem = useAppStore((s) => s.changeSystem)
  const changeVoice = useAppStore((s) => s.changeVoice)
  const voiceA = useAppStore((s) => s.voiceA)
  const voiceB = useAppStore((s) => s.voiceB)
  const voiceNarrator = useAppStore((s) => s.voiceNarrator)
  const apiKey = useAppStore((s) => s.apiKey)
  const saveApiKey = useAppStore((s) => s.saveApiKey)

  const [draft, setDraft] = useState(apiKey)
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const levels = levelsOf(system)
  const currentLevel = levelOption(system, level)

  async function handleSystem(next: ExamSystem): Promise<void> {
    if (next === system) return
    setError(null)
    try {
      await changeSystem(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleVoice(slot: 'a' | 'b' | 'narrator', id: string): Promise<void> {
    setError(null)
    try {
      await changeVoice(slot, id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handlePreview(id: string): Promise<void> {
    setError(null)
    setPreviewing(id)
    try {
      const url = await api.previewVoice(id)
      if (!audioRef.current) audioRef.current = new Audio()
      const audio = audioRef.current
      audio.pause()
      audio.src = url
      await audio.play()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPreviewing(null)
    }
  }

  async function handleSaveKey(): Promise<void> {
    await saveApiKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleClearAll(): Promise<void> {
    await api.clearAllData()
    setConfirmClear(false)
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-6 space-y-7">
      <h2 className="text-lg font-semibold">设置</h2>

      {error && <div className="text-sm text-red-500 dark:text-red-400">{error}</div>}

      {/* 难度体系 */}
      <section className="space-y-2">
        <label className="text-sm text-zinc-500 dark:text-zinc-400">难度体系</label>
        <div className="flex gap-2">
          {EXAM_SYSTEMS.map((s) => (
            <button
              key={s}
              onClick={() => handleSystem(s)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                system === s
                  ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                  : 'bg-white border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'
              }`}
            >
              {SYSTEM_LABEL[s]}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{SYSTEM_HINT[system]}</p>
      </section>

      {/* 默认难度 */}
      <section className="space-y-2">
        <label className="text-sm text-zinc-500 dark:text-zinc-400">默认难度</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className={`w-full ${inputClass}`}
        >
          {levels.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {system === 'cet' ? opt.label : `${SYSTEM_LABEL[system]} ${opt.label}`}
            </option>
          ))}
        </select>
        {currentLevel && <p className="text-xs text-zinc-400 dark:text-zinc-500">{currentLevel.desc}</p>}
      </section>

      {/* 音色配置 */}
      <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
        <h3 className="text-sm text-zinc-700 dark:text-zinc-300">音色</h3>

        <VoicePicker
          label="角色 A 音色"
          value={voiceA}
          excluded={[voiceB]}
          previewing={previewing === voiceA}
          onChange={(id) => handleVoice('a', id)}
          onPreview={() => handlePreview(voiceA)}
        />
        <VoicePicker
          label="角色 B 音色"
          value={voiceB}
          excluded={[voiceA]}
          previewing={previewing === voiceB}
          onChange={(id) => handleVoice('b', id)}
          onPreview={() => handlePreview(voiceB)}
        />

        {system === 'cet' && (
          <VoicePicker
            label="题干朗读音色（四六级）"
            value={voiceNarrator}
            excluded={[]}
            previewing={previewing === voiceNarrator}
            onChange={(id) => handleVoice('narrator', id)}
            onPreview={() => handlePreview(voiceNarrator)}
          />
        )}

        <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
          音色变更只影响<span className="font-medium text-zinc-500 dark:text-zinc-400">新生成</span>的对话；
          已生成的对话保留其原有音频，不会串音。
          {system === 'cet' && ' 四六级模式下题干由指定的朗读音色念出，选项不朗读（与真题一致）。'}
        </p>
      </section>

      {/* API Key */}
      <section className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-5">
        <label className="text-sm text-zinc-500 dark:text-zinc-400">Deepseek API Key</label>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-..."
          className={`w-full ${inputClass}`}
        />
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Key 仅保存在本机，用于生成对话与题目。</p>
        <button onClick={handleSaveKey} className={primaryBtn}>
          {saved ? '已保存' : '保存'}
        </button>
      </section>

      {/* 数据管理 */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-2">
        <h3 className="text-sm text-zinc-700 dark:text-zinc-300">数据管理</h3>
        {confirmClear ? (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              确定清空所有对话、题目和单词本数据？此操作不可恢复。
            </span>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-lg text-sm bg-red-500 hover:bg-red-400 text-white font-medium transition-colors"
            >
              确认清空
            </button>
            <button onClick={() => setConfirmClear(false)} className={ghostBtn}>
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-3 py-1.5 rounded-lg text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
          >
            清空所有数据
          </button>
        )}
      </section>
    </div>
  )
}

interface VoicePickerProps {
  label: string
  value: string
  /** 已被其他角色占用的音色，禁止重复选择 */
  excluded: string[]
  previewing: boolean
  onChange: (id: string) => void
  onPreview: () => void
}

function VoicePicker({ label, value, excluded, previewing, onChange, onPreview }: VoicePickerProps) {
  const groups = voicesByAccent()
  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 min-w-0 ${inputClass}`}
        >
          {groups.map((g) => (
            <optgroup key={g.accent} label={g.label}>
              {g.voices.map((v) => (
                <option key={v.id} value={v.id} disabled={excluded.includes(v.id)}>
                  {v.label} — {v.note}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button onClick={onPreview} disabled={previewing} className={`shrink-0 ${ghostBtn} disabled:opacity-50`}>
          {previewing ? '合成中…' : '试听'}
        </button>
      </div>
    </div>
  )
}
