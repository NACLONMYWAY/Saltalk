export interface WordLookup {
  word: string
  phonetic: string | null
  meaning: string | null
  example: string | null
}

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/'

interface DictionaryEntry {
  word?: string
  phonetic?: string
  meanings?: Array<{
    partOfSpeech?: string
    definitions?: Array<{ definition?: string; example?: string }>
  }>
}

/**
 * 解析 Free Dictionary API 的响应（数组形式）。
 * 返回 null 表示该词查不到。
 */
export function parseDictionaryResponse(data: unknown): WordLookup | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const entry = data[0] as DictionaryEntry
  if (!entry || typeof entry.word !== 'string') return null

  const firstMeaning = entry.meanings?.[0]
  const firstDef = firstMeaning?.definitions?.[0]

  return {
    word: entry.word,
    phonetic: entry.phonetic ?? null,
    meaning: firstDef?.definition ?? null,
    example: firstDef?.example ?? null
  }
}

/**
 * 查询单词释义（Free Dictionary API，英英）。
 * 网络调用，测试时注入 fetcher。
 * 单词不存在返回 null；网络错误抛错。
 */
export async function lookupWord(word: string, fetcher: typeof fetch = fetch): Promise<WordLookup | null> {
  const res = await fetcher(API_BASE + encodeURIComponent(word))
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`词典查询失败：HTTP ${res.status}`)
  }
  const data: unknown = await res.json()
  return parseDictionaryResponse(data)
}
