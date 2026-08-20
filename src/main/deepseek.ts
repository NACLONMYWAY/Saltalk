import type { CEFRLevel, Dialogue, DialogueLine, Speaker } from '../../shared/types.ts'

const API_URL = 'https://api.deepseek.com/chat/completions'

export const LEVEL_DESC: Record<CEFRLevel, string> = {
  A1: '入门（简单词汇、短句、慢速日常表达）',
  A2: '基础（常用词汇、简单句、日常场景）',
  B1: '中级（中等词汇、复合句、熟悉话题的流畅表达）',
  B2: '中高级（较丰富词汇、复杂句、抽象话题）',
  C1: '高级（丰富词汇、复杂句式、专业与抽象话题）',
  C2: '精通（接近母语、习语、微妙语义）'
}

export function buildPrompt(topic: string, level: CEFRLevel): string {
  return [
    '你是一名专业的英语口语教材编写者。请根据要求生成一段双人日常对话。',
    '',
    `主题：${topic}`,
    `难度：CEFR ${level}（${LEVEL_DESC[level]}）`,
    '要求：',
    '1. 一段自然的双人对话，共 12~16 句，角色固定为 A 和 B，交替发言。',
    `2. 词汇与句式难度严格符合 CEFR ${level} 水平。`,
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

/**
 * 解析并校验 Deepseek 返回的 JSON 文本。
 * 兼容被 ```json ... ``` 包裹或前后有杂散文字的情况。
 * 校验失败时抛出 Error。
 */
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
    difficulty: (obj.difficulty as CEFRLevel) ?? 'B1',
    dialogue: obj.dialogue as DialogueLine[]
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
  level: CEFRLevel
  signal?: AbortSignal
}

/** 调用 Deepseek 生成对话（网络调用，测试时通过注入 fetch 模拟） */
export async function generateDialogue(
  opts: GenerateOptions,
  fetcher: typeof fetch = fetch
): Promise<Dialogue> {
  const res = await fetcher(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: buildPrompt(opts.topic, opts.level) }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      stream: false
    }),
    signal: opts.signal
  })

  if (!res.ok) {
    throw new Error(`Deepseek API 请求失败：HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Deepseek API 返回内容为空')
  }
  return parseDialogueResponse(content)
}

/** 用 Deepseek 把英文单词翻译成中文释义（网络调用，测试时注入 fetch） */
export async function translateWord(
  word: string,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  const res = await fetcher(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: `请将英文单词"${word}"翻译成中文，只返回最常用的中文释义（2-6个字），不要任何解释或标点。如果该词有多个常见词性，返回最多 2 个释义，用中文分号「；」分隔。`
        }
      ],
      temperature: 0.2,
      stream: false
    })
  })

  if (!res.ok) {
    throw new Error(`Deepseek API 请求失败：HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Deepseek API 返回内容为空')
  }
  return content.trim()
}
