import { useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '../store.ts'
import { api } from '../api.ts'
import { EXAM_SYSTEMS, SYSTEM_HINT, SYSTEM_LABEL, levelOption, levelsOf } from '../../../../shared/exams.ts'
import { voicesByAccent } from '../../../../shared/voices.ts'
import type { ExamSystem } from '../../../../shared/types.ts'

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
    <div className="wrap wrap-mid">
      <div>
        <h2 className="page-title">设置</h2>
        <p className="page-sub">所有配置只保存在本机，不会随安装包分发。</p>
      </div>

      {error && (
        <div className="note note-danger">
          <svg className="i">
            <use href="#i-alert" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* 难度 */}
      <section className="grp-card">
        <div className="set-head">
          <svg className="i i-sm">
            <use href="#i-sliders" />
          </svg>
          <span className="sect-title">难度</span>
        </div>

        <div className="set-row">
          <span className="set-label">难度体系</span>
          <span className="set-ctrl">
            <div className="seg" role="tablist" aria-label="难度体系">
              {EXAM_SYSTEMS.map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={system === s}
                  onClick={() => handleSystem(s)}
                  className="seg-btn"
                >
                  {SYSTEM_LABEL[s]}
                </button>
              ))}
            </div>
          </span>
        </div>

        <div className="set-row">
          <span className="set-label">默认难度</span>
          <span className="set-ctrl">
            <SelectBox value={level} onChange={setLevel}>
              {levels.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {system === 'cet' ? opt.label : `${SYSTEM_LABEL[system]} ${opt.label}`}
                </option>
              ))}
            </SelectBox>
          </span>
        </div>

        <div className="set-row stack">
          <span className="set-hint">{SYSTEM_HINT[system]}</span>
          {currentLevel && <span className="set-hint">{currentLevel.desc}</span>}
        </div>
      </section>

      {/* 音色 */}
      <section className="grp-card">
        <div className="set-head">
          <svg className="i i-sm">
            <use href="#i-vol" />
          </svg>
          <span className="sect-title">音色</span>
        </div>

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
            label="题干朗读音色"
            value={voiceNarrator}
            excluded={[]}
            previewing={previewing === voiceNarrator}
            onChange={(id) => handleVoice('narrator', id)}
            onPreview={() => handlePreview(voiceNarrator)}
          />
        )}

        <div className="set-row stack">
          <span className="set-hint">
            音色变更只影响<b className="hl">新生成</b>的对话；已生成的对话保留其原有音频，不会串音。
            {system === 'cet' && ' 四六级模式下题干由指定的朗读音色念出，选项不朗读（与真题一致）。'}
          </span>
        </div>
      </section>

      {/* API Key */}
      <section className="grp-card">
        <div className="set-head">
          <svg className="i i-sm">
            <use href="#i-lock" />
          </svg>
          <span className="sect-title">Deepseek API Key</span>
        </div>

        <div className="set-row">
          <span className="set-label">API Key</span>
          <span className="set-ctrl">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="sk-..."
              className="input"
            />
            <button onClick={handleSaveKey} className="btn btn-primary shrink-0">
              {saved ? '已保存' : '保存'}
            </button>
          </span>
        </div>

        <div className="set-row stack">
          <span className="set-hint">Key 仅保存在本机，用于生成对话与题目。</span>
        </div>
      </section>

      {/* 数据管理 */}
      <section className="grp-card">
        <div className="set-head">
          <svg className="i i-sm">
            <use href="#i-trash" />
          </svg>
          <span className="sect-title">数据管理</span>
        </div>

        <div className="set-row stack">
          {confirmClear ? (
            <>
              <span className="set-hint">
                确定清空所有对话、题目和单词本数据？此操作不可恢复。
              </span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleClearAll} className="btn btn-sm btn-danger-ghost">
                  <svg className="i i-sm">
                    <use href="#i-trash" />
                  </svg>
                  确认清空
                </button>
                <button onClick={() => setConfirmClear(false)} className="btn btn-sm">
                  取消
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="btn btn-sm self-start">
              <svg className="i i-sm">
                <use href="#i-trash" />
              </svg>
              清空所有数据
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

/** 原生 select 的统一外皮：保留原生下拉行为，只统一外观 */
function SelectBox({
  value,
  onChange,
  children
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <span className="sel">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {children}
      </select>
      <svg className="i i-sm sel-chev">
        <use href="#i-chev" />
      </svg>
    </span>
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
    <div className="set-row">
      <span className="set-label">{label}</span>
      <span className="set-ctrl">
        <SelectBox value={value} onChange={onChange}>
          {groups.map((g) => (
            <optgroup key={g.accent} label={g.label}>
              {g.voices.map((v) => (
                <option key={v.id} value={v.id} disabled={excluded.includes(v.id)}>
                  {v.label} — {v.note}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectBox>
        <button onClick={onPreview} disabled={previewing} className="btn shrink-0">
          {previewing ? '合成中…' : '试听'}
        </button>
      </span>
    </div>
  )
}
