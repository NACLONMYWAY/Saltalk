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
  [4.0, '有限使用者（≈A2–B1）：仅熟悉场景能基本沟通；词汇限于高频基础词，多为简单句'],
  [4.5, '有限使用者（≈B1）：熟悉场景可基本交流；表达复杂内容仍明显吃力'],
  [5.0, '基础使用者（≈B1）：能把握总体意思但错误较多；以日常词汇为主，句型简单'],
  [5.5, '基础使用者（≈B1+）：日常话题可顺畅交流；开始出现少量半正式与地道搭配'],
  [6.0, '合格使用者（≈B2）：能有效应对日常与校园话题；句型有复合结构，偶有不准'],
  [6.5, '合格使用者（≈B2）：可处理较复杂话题；出现成规模的同义替换与地道搭配'],
  [7.0, '良好使用者（≈B2+/C1）：语速自然、表达地道；含习语与委婉语，观点有层次和让步'],
  [7.5, '良好使用者（≈C1）：讨论抽象话题流畅；大量地道搭配与同义替换，需靠推断'],
  [8.0, '优秀使用者（≈C1）：接近母语；含低频搭配与隐含语义，信息需要整合推理'],
  [8.5, '优秀使用者（≈C2）：母语水平；语义微妙，语速快且有弱读、连读、口头修正'],
  [9.0, '专家使用者（≈C2）：完全准确流畅；含俚语、文化暗示与高度压缩的表达']
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
  /** 词汇带：大纲词汇量与实际用词层次 */
  vocab: string
  /** 语域与题材：说话人身份、讨论内容性质 */
  register: string
  /** 答案与干扰项策略（四级「所听即所得」，六级需同义替换+推理） */
  answerStyle: string
  /** 题型配比 */
  questionMix: string
  /** 设置页展示用的一句话说明 */
  summary: string
}

export const CET_SPECS: Record<string, CetSpec> = {
  CET4: {
    id: 'CET4',
    label: '四级',
    words: [240, 280],
    wpm: [120, 140],
    questions: 4,
    vocab:
      '大学英语四级词汇带（大纲约 4500 词）。以高频基础词与常用义为主，可自然使用半正式的校园与职场词汇，' +
      '如 deadline、proposal、appointment、refund、scholarship、questionnaire、schedule、budget、' +
      'application、interview、certificate、insurance。不要出现纯学术生僻词。',
    register:
      '说话人是同学、室友、学长、老师、同事、客服或房东，双方在讨论具体事务（选课、论文、求职、租房、报修、理赔），' +
      '有明确的信息交换与因果说明，而不是寒暄客套。',
    answerStyle:
      '四级听力约 90% 的答案能在原文直接找到对应表达（所听即所得）。' +
      '干扰项应使用「对话中出现过、但答非所问」的词句，让学生必须听清问题本身而非听到原词就选。',
    questionMix: '以细节题为主（4 题中 3 题），可含 1 道主旨或推理题。',
    summary:
      '长对话 240–280 词 · 语速 120–140 词/分 · 4 道四选一；词汇约 4500 词，答案多为「所听即所得」，以细节题为主'
  },
  CET6: {
    id: 'CET6',
    label: '六级',
    words: [280, 320],
    wpm: [140, 160],
    questions: 4,
    vocab:
      '大学英语六级词汇带（大纲约 5500–6000 词）。在四级词汇基础上加入学术与抽象词，' +
      '如 bureaucracy、quantitative、incentive、infrastructure、plausible、correlate、' +
      'sustainable、implement、criterion、allocate、consensus。' +
      '并刻意使用熟词僻义（如 address 表「处理」、current 表「电流」、novel 表「新颖的」、' +
      'mean 表「平均的」），以及固定搭配与介词短语。',
    register:
      '场景偏半学术与职场：课题研究、学术会议、公司项目决策、政策讨论、社会议题评论、专业访谈。' +
      '说话人以研究者、管理者、专家、资深同事为主，讨论观点、因果与权衡，句间有明确逻辑关系。',
    answerStyle:
      '六级听力约 70% 的答案能在原文找到，其余需要同义替换识别或推理判断。' +
      '正确选项常是原文的**同义改写**（不重复原词）；干扰项更隐蔽：与原文高度相关，但偷换主体、' +
      '程度、时间或因果方向（例如把「部分有效」说成「普遍有效」，把「建议」说成「已实施」）。',
    questionMix: '细节题与推理/主旨/态度题大致各半（4 题中 2 题细节、2 题需推断或概括）。',
    summary:
      '长对话 280–320 词 · 语速 140–160 词/分 · 4 道四选一；词汇 5500–6000 词并考熟词僻义，需同义替换与推理'
  }
}

const CET_OPTIONS: LevelOption[] = Object.values(CET_SPECS).map((s) => ({
  id: s.id,
  label: s.label,
  desc: `大学英语${s.label}：${s.summary}`
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
