import type { ExamSystem, GenerateMode, DifficultyId } from './types.ts'

export const EXAM_SYSTEMS: ExamSystem[] = ['cefr', 'ielts', 'cet']

export const SYSTEM_LABEL: Record<ExamSystem, string> = {
  cefr: 'CEFR',
  ielts: '雅思',
  cet: '四六级'
}

export const SYSTEM_HINT: Record<ExamSystem, string> = {
  cefr: '欧洲语言共同参考框架，A1–C2 六级，生成普通双人对话',
  ielts: '雅思 0–9 分制，0.5 分一档，生成普通双人对话',
  cet: '大学英语四六级，按听力真题形式生成：一段长对话 + 4 道四选一选择题'
}

/** 四六级走「考试听力题」模式，其余走普通对话模式 */
export function modeOf(system: ExamSystem): GenerateMode {
  return system === 'cet' ? 'exam' : 'conversation'
}

export function isExamSystem(v: unknown): v is ExamSystem {
  return v === 'cefr' || v === 'ielts' || v === 'cet'
}

export interface LevelOption {
  id: DifficultyId
  label: string
  /** 生成时交给模型的难度说明 */
  desc: string
}

const CEFR_OPTIONS: LevelOption[] = [
  { id: 'A1', label: 'A1', desc: '入门：简单词汇、短句、慢速日常表达' },
  { id: 'A2', label: 'A2', desc: '基础：常用词汇、简单句、日常场景' },
  { id: 'B1', label: 'B1', desc: '中级：中等词汇、复合句、熟悉话题的流畅表达' },
  { id: 'B2', label: 'B2', desc: '中高级：较丰富词汇、复杂句、抽象话题' },
  { id: 'C1', label: 'C1', desc: '高级：丰富词汇、复杂句式、专业与抽象话题' },
  { id: 'C2', label: 'C2', desc: '精通：接近母语、习语、微妙语义' }
]

/** 雅思 4.0–9.0，0.5 分一档；4.0 以下官方定性为「极其有限」，学习工具无实际意义，故不纳入 */
const IELTS_BANDS: Array<[number, string]> = [
  [4.0, '有限使用者：基本能力限于熟悉场景，理解和表达常有困难'],
  [4.5, '有限使用者：熟悉场景可基本沟通，复杂语言无法应对'],
  [5.0, '基础使用者：多数场合能把握大致意思，但错误较多'],
  [5.5, '基础使用者：可应对熟悉话题的日常交流，偶有卡顿'],
  [6.0, '合格使用者：能有效使用英语，尽管仍有不准与误解'],
  [6.5, '合格使用者：可较好处理较复杂语言，满足多数本科入学要求'],
  [7.0, '良好使用者：能熟练处理复杂语言，理解详细论证'],
  [7.5, '良好使用者：表达流畅，仅有零星不准确，满足多数研究生要求'],
  [8.0, '优秀使用者：表达自如准确，仅偶有不系统的不准确'],
  [8.5, '优秀使用者：接近母语水平，处理复杂论证游刃有余'],
  [9.0, '专家使用者：完全准确、流利，理解无误']
]

const IELTS_OPTIONS: LevelOption[] = IELTS_BANDS.map(([band, desc]) => ({
  id: band.toFixed(1),
  label: band.toFixed(1),
  desc
}))

/** 四六级长对话的真题规格 */
export interface CetSpec {
  id: DifficultyId
  label: string
  /** 长对话词数区间（真题：四级 240–280，六级 280–320） */
  words: [number, number]
  /** 语速区间，词/分钟 */
  wpm: [number, number]
  /** 题量，真题长对话为每篇 4 题 */
  questions: number
}

export const CET_SPECS: Record<string, CetSpec> = {
  CET4: { id: 'CET4', label: '四级', words: [240, 280], wpm: [120, 150], questions: 4 },
  CET6: { id: 'CET6', label: '六级', words: [280, 320], wpm: [140, 160], questions: 4 }
}

const CET_OPTIONS: LevelOption[] = Object.values(CET_SPECS).map((s) => ({
  id: s.id,
  label: s.label,
  desc: `大学英语${s.label}：长对话 ${s.words[0]}–${s.words[1]} 词，语速 ${s.wpm[0]}–${s.wpm[1]} 词/分，${s.questions} 道四选一选择题`
}))

export const SYSTEM_LEVELS: Record<ExamSystem, LevelOption[]> = {
  cefr: CEFR_OPTIONS,
  ielts: IELTS_OPTIONS,
  cet: CET_OPTIONS
}

export const DEFAULT_LEVELS: Record<ExamSystem, DifficultyId> = {
  cefr: 'B1',
  ielts: '6.0',
  cet: 'CET4'
}

export function levelsOf(system: ExamSystem): LevelOption[] {
  return SYSTEM_LEVELS[system] ?? SYSTEM_LEVELS.cefr
}

export function levelOption(system: ExamSystem, level: DifficultyId): LevelOption | null {
  return levelsOf(system).find((l) => l.id === level) ?? null
}

export function isValidLevel(system: ExamSystem, level: DifficultyId): boolean {
  return levelOption(system, level) !== null
}

/**
 * 把可能已失效的等级收敛到该体系的合法值。
 * 用于「切换难度体系后，原来选的等级不属于新体系」的场景。
 */
export function normalizeLevel(system: ExamSystem, level: DifficultyId | null | undefined): DifficultyId {
  if (level && isValidLevel(system, level)) return level
  return DEFAULT_LEVELS[system]
}

/** 该体系的等级是否走考试听力题模式 */
export function isExamLevel(system: ExamSystem, level: DifficultyId): boolean {
  return modeOf(system) === 'exam' && level in CET_SPECS
}

export function cetSpecOf(level: DifficultyId): CetSpec {
  return CET_SPECS[level] ?? CET_SPECS.CET4
}

/** 展示用全称，如「雅思 6.5」「四级」 */
export function levelDisplay(system: ExamSystem, level: DifficultyId): string {
  const opt = levelOption(system, level)
  if (!opt) return `${SYSTEM_LABEL[system]} ${level}`
  return system === 'cet' ? opt.label : `${SYSTEM_LABEL[system]} ${opt.label}`
}

/** 雅思档位对应的 CEFR 参考值，仅用于给模型补充说明 */
export const IELTS_CEFR_REFERENCE: Record<string, string> = {
  '4.0': 'A2-B1',
  '4.5': 'B1',
  '5.0': 'B1',
  '5.5': 'B1+',
  '6.0': 'B2',
  '6.5': 'B2',
  '7.0': 'B2+/C1',
  '7.5': 'C1',
  '8.0': 'C1',
  '8.5': 'C2',
  '9.0': 'C2'
}
