import { cetSpecOf, levelDisplay, levelOption } from '../../shared/exams.ts'
import type {
  DifficultyId,
  Dialogue,
  DialogueLine,
  ExamSystem,
  QuestionPayload,
  Speaker
} from '../../shared/types.ts'

const API_URL = 'https://api.deepseek.com/chat/completions'

/** 四六级选项数量固定为四选一 */
export const OPTION_COUNT = 4

function describeLevel(system: ExamSystem, level: DifficultyId): string {
  const opt = levelOption(system, level)
  if (!opt) return `${levelDisplay(system, level)}`
  return `${levelDisplay(system, level)}（${opt.desc}）`
}

export function buildPrompt(topic: string, level: DifficultyId, system: ExamSystem = 'cefr'): string {
  return [
    '你是一名专业的英语口语教材编写者。请根据要求生成一段双人日常对话。',
    '',
    `主题：${topic}`,
    `难度：${describeLevel(system, level)}`,
    '要求：',
    '1. 一段自然的双人对话，共 12~16 句，角色固定为 A 和 B，交替发言。',
    '2. 词汇与句式难度严格符合上述等级水平。',
    '3. 每句英文都要地道，并附准确的中文翻译。',
    '',
    '只返回 JSON，不要任何其他文字，格式如下：',
    '{',
    '  "title": "对话标题",',
    `  "difficulty": "${level}",`,
    '  "dialogue": [',
    '    {"speaker": "A", "english": "...", "chinese": "..."},',
    '    {"speaker": "B", "english": "...", "chinese": "..."}',
    '  ]',
    '}'
  ].join('\n')
}

/**
 * 四六级听力真题形式的命题指令。
 * 关键还原点：题干不印在试卷上、由录音朗读；四选一；出题顺序与对话推进顺序一致。
 */
export function buildCetPrompt(topic: string, level: DifficultyId): string {
  const spec = cetSpecOf(level)
  const [wMin, wMax] = spec.words
  const [sMin, sMax] = spec.wpm
  const q = spec.questions

  return [
    `你是一名大学英语${spec.label}考试（CET）的命题专家。请命制一段听力「长对话（Long Conversation）」及配套选择题。`,
    '',
    `主题/场景：${topic}`,
    `级别：大学英语${spec.label}（长对话约 ${wMin}–${wMax} 词，语速约 ${sMin}–${sMax} 词/分钟，共 ${q} 题）`,
    '',
    '命题要求：',
    `1. 写一段自然的双人英语对话，角色固定为 A 和 B 交替发言，英语总词数控制在 ${wMin}–${wMax} 个单词。`,
    '2. 场景贴近四六级真题：校园生活、学习选课、求职面试、租房、旅行、社会交往、服务咨询等。',
    `3. 词汇与句式严格符合大学英语${spec.label}水平，不要出现明显超纲的艰深词汇。`,
    '4. 对话要有清晰的信息链：开头交代背景，中间用问答推进并给出关键细节（时间、地点、价格、数量、原因、建议、态度），结尾常有总结或建议。',
    `5. 对话中必须埋入 ${q} 个可被提问的关键信息，且出题顺序与对话推进顺序完全一致。`,
    '6. 为每个关键信息命制一道四选一单选题：',
    '   - 题干是完整的特殊疑问句（以 What / Why / How / Where / When / Who / Which 开头），符合四六级题干习惯，例如「What does the man suggest the woman do?」',
    '   - 四个选项必须互不相同、长度接近、尽量简短（每个选项 2–8 个单词），且语法上都能与题干搭配；干扰项要合理但确属错误',
    '   - 正确答案必须能且只能由对话原文推出，不能依赖常识或外部知识',
    `   - 注意（重要）：题干不会印在试卷上，只会由录音朗读，因此题干必须独立、明确，不依赖任何书面上下文`,
    `7. 为每句英文给出准确的中文翻译；为每道题给出中文解析，点明答案依据的是对话中的哪一句。`,
    '',
    '只返回 JSON，不要任何其他文字，格式如下：',
    '{',
    '  "title": "对话标题（中文，10 字以内）",',
    `  "level": "${spec.id}",`,
    '  "dialogue": [',
    '    {"speaker": "A", "english": "...", "chinese": "..."},',
    '    {"speaker": "B", "english": "...", "chinese": "..."}',
    '  ],',
    '  "questions": [',
    '    {',
    '      "stem": "What does the man suggest the woman do?",',
    '      "stemChinese": "男士建议女士做什么？",',
    '      "options": ["选项一", "选项二", "选项三", "选项四"],',
    '      "answerIndex": 0,',
    '      "explanation": "男士说……，因此选 A。"',
    '    }',
    '  ]',
    '}'
  ].join('\n')
}

function isSpeaker(v: unknown): v is Speaker {
  return v === 'A' || v === 'B'
}

function isDialogueLine(v: unknown): v is DialogueLine {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    isSpeaker(o.speaker) &&
    typeof o.english === 'string' &&
    o.english.trim().length > 0 &&
    typeof o.chinese === 'string' &&
    o.chinese.trim().length > 0
  )
}

/** 解析并校验对话类返回值（CEFR / 雅思） */
export function parseDialogueResponse(text: string): Dialogue {
  const json = extractJson(text)
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('模型返回内容不是合法的 JSON')
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('模型返回内容格式错误：应为 JSON 对象')
  }
  const obj = data as Record<string, unknown>

  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    throw new Error('模型返回内容缺少 title 字段')
  }
  if (!Array.isArray(obj.dialogue) || obj.dialogue.length === 0) {
    throw new Error('模型返回内容缺少非空的 dialogue 数组')
  }
  if (obj.dialogue.some((line) => !isDialogueLine(line))) {
    throw new Error('模型返回的对话中存在格式错误的句子')
  }

  const speakers = new Set((obj.dialogue as DialogueLine[]).map((l) => l.speaker))
  if (speakers.size < 2) {
    throw new Error('对话不是双人对话（缺少 A/B 两个角色）')
  }

  return {
    title: obj.title.trim(),
    difficulty: typeof obj.difficulty === 'string' ? obj.difficulty : 'B1',
    dialogue: obj.dialogue as DialogueLine[]
  }
}

function parseQuestion(v: unknown, index: number): QuestionPayload {
  const where = `第 ${index + 1} 题`
  if (typeof v !== 'object' || v === null) {
    throw new Error(`${where}格式错误：应为 JSON 对象`)
  }
  const o = v as Record<string, unknown>

  if (typeof o.stem !== 'string' || o.stem.trim().length === 0) {
    throw new Error(`${where}缺少题干 stem`)
  }
  if (!Array.isArray(o.options)) {
    throw new Error(`${where}缺少选项数组 options`)
  }
  const options = o.options
  if (options.length !== OPTION_COUNT) {
    throw new Error(`${where}选项数量应为 ${OPTION_COUNT} 个，实际 ${options.length} 个`)
  }
  if (options.some((x) => typeof x !== 'string' || x.trim().length === 0)) {
    throw new Error(`${where}存在空选项`)
  }
  const normalized = options.map((x) => (x as string).trim())
  if (new Set(normalized).size !== OPTION_COUNT) {
    throw new Error(`${where}四个选项存在重复`)
  }
  if (
    typeof o.answerIndex !== 'number' ||
    !Number.isInteger(o.answerIndex) ||
    o.answerIndex < 0 ||
    o.answerIndex >= OPTION_COUNT
  ) {
    throw new Error(`${where}答案下标 answerIndex 必须是 0–${OPTION_COUNT - 1} 之间的整数`)
  }

  return {
    stem: o.stem.trim(),
    stemChinese: typeof o.stemChinese === 'string' ? o.stemChinese.trim() : '',
    options: normalized,
    answerIndex: o.answerIndex,
    explanation: typeof o.explanation === 'string' && o.explanation.trim() ? o.explanation.trim() : null
  }
}

/**
 * 解析并校验四六级听力题返回值。
 * 任何一项不合规都抛错，交由上层决定是否重试，避免把废数据写进库里。
 */
export function parseCetResponse(text: string, expectedQuestions: number, level: DifficultyId): Dialogue {
  const json = extractJson(text)
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('模型返回内容不是合法的 JSON')
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('模型返回内容格式错误：应为 JSON 对象')
  }
  const obj = data as Record<string, unknown>

  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    throw new Error('模型返回内容缺少 title 字段')
  }
  if (!Array.isArray(obj.dialogue) || obj.dialogue.length === 0) {
    throw new Error('模型返回内容缺少非空的 dialogue 数组')
  }
  if (obj.dialogue.some((line) => !isDialogueLine(line))) {
    throw new Error('模型返回的对话中存在格式错误的句子')
  }
  const speakers = new Set((obj.dialogue as DialogueLine[]).map((l) => l.speaker))
  if (speakers.size < 2) {
    throw new Error('对话不是双人对话（缺少 A/B 两个角色）')
  }

  if (!Array.isArray(obj.questions)) {
    throw new Error('模型返回内容缺少 questions 数组')
  }
  if (obj.questions.length !== expectedQuestions) {
    throw new Error(`题目数量应为 ${expectedQuestions} 道，实际 ${obj.questions.length} 道`)
  }
  const questions = obj.questions.map((q, i) => parseQuestion(q, i))

  return {
    title: obj.title.trim(),
    difficulty: level,
    dialogue: obj.dialogue as DialogueLine[],
    questions
  }
}

/** 从文本中提取第一个 JSON 对象字符串（兼容 markdown 代码块与杂散前后缀） */
export function extractJson(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1)
  }
  return trimmed
}

export interface GenerateOptions {
  apiKey: string
  topic: string
  level: DifficultyId
  /** 难度体系，默认 cefr，保证旧调用不受影响 */
  system?: ExamSystem
  signal?: AbortSignal
}

/** 统一的一次 Deepseek 调用，返回模型文本内容 */
async function requestContent(
  apiKey: string,
  prompt: string,
  fetcher: typeof fetch,
  opts: { temperature: number; jsonMode: boolean; signal?: AbortSignal }
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature,
    stream: false
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetcher(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: opts.signal
  })

  if (!res.ok) {
    throw new Error(`Deepseek API 请求失败：HTTP ${res.status}`)
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Deepseek API 返回内容为空')
  }
  return content
}

/** 调用 Deepseek 生成对话（网络调用，测试时通过注入 fetch 模拟） */
export async function generateDialogue(
  opts: GenerateOptions,
  fetcher: typeof fetch = fetch
): Promise<Dialogue> {
  const system = opts.system ?? 'cefr'
  const content = await requestContent(opts.apiKey, buildPrompt(opts.topic, opts.level, system), fetcher, {
    temperature: 0.8,
    jsonMode: true,
    signal: opts.signal
  })
  return parseDialogueResponse(content)
}

/**
 * 生成四六级听力题。校验不通过时自动重试一次（附上纠正提示），
 * 两次都失败才抛错，避免生成半成品写入数据库。
 */
export async function generateExamDialogue(
  opts: GenerateOptions,
  fetcher: typeof fetch = fetch
): Promise<Dialogue> {
  const spec = cetSpecOf(opts.level)
  const basePrompt = buildCetPrompt(opts.topic, opts.level)
  const correction = [
    '',
    '注意：上一次返回的内容不符合要求，请严格检查后重新返回：',
    `- 必须恰好 ${spec.questions} 道题，questions 数组长度不得多也不得少`,
    `- 每题 options 必须恰好 ${OPTION_COUNT} 个互不相同的非空字符串`,
    `- answerIndex 必须是 0–${OPTION_COUNT - 1} 的整数，对应正确选项的下标`,
    '- 题干必须是完整的特殊疑问句英文，不要留空',
    '- 只输出 JSON，不要任何解释文字或 markdown 代码块'
  ].join('\n')

  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? basePrompt : basePrompt + correction
    const content = await requestContent(opts.apiKey, prompt, fetcher, {
      temperature: attempt === 0 ? 0.7 : 0.4,
      jsonMode: true,
      signal: opts.signal
    })
    try {
      return parseCetResponse(content, spec.questions, opts.level)
    } catch (e) {
      lastError = e
    }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`生成的听力题不符合真题格式，已自动重试一次仍失败：${reason}`)
}

/** 用 Deepseek 把英文单词翻译成中文释义（网络调用，测试时注入 fetch） */
export async function translateWord(
  word: string,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  const content = await requestContent(
    apiKey,
    `请将英文单词"${word}"翻译成中文，只返回最常用的中文释义（2-6个字），不要任何解释或标点。如果该词有多个常见词性，返回最多 2 个释义，用中文分号「；」分隔。`,
    fetcher,
    { temperature: 0.2, jsonMode: false }
  )
  return content.trim()
}
