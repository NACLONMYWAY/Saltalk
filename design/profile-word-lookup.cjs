// 诊断脚本：实测「点词」链路两段网络的真实耗时（不打印 API Key）
const path = require('node:path')
const os = require('node:os')

const dbPath = path.join(os.homedir(), 'AppData/Roaming/nacl-english-listening/app.db')
const Database = require(path.join(__dirname, '..', 'node_modules/better-sqlite3'))

const db = new Database(dbPath, { readonly: true })
const row = db.prepare('SELECT value FROM config WHERE key = ?').get('deepseek_api_key')
const apiKey = row && row.value
console.log('读取到 API Key:', apiKey ? `是（长度 ${apiKey.length}）` : '否 —— 后面翻译测不了')
db.close()

async function timeIt(label, fn) {
  const t0 = Date.now()
  try {
    const r = await fn()
    console.log(`  ${label}: ${Date.now() - t0} ms -> ${r}`)
    return Date.now() - t0
  } catch (e) {
    console.log(`  ${label}: ${Date.now() - t0} ms -> 失败: ${e.message}`)
    return Date.now() - t0
  }
}

const words = ['negotiate', 'reception', 'colleague']

;(async () => {
  console.log('\n=== 第 1 段：dictionaryapi.dev（当前串行执行的第一步）===')
  for (const w of words) {
    await timeIt(`lookupWord(${w}) 超时上限 6000ms`, async () => {
      const f = (await import('node:fs')).default
      void f
      const res = await fetch(
        'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w),
        { signal: AbortSignal.timeout(6000) }
      )
      return 'HTTP ' + res.status
    })
  }

  if (!apiKey) return

  console.log('\n=== 第 2 段：Deepseek translateWord（当前串行执行的第二步）===')
  for (const w of words) {
    await timeIt(`translateWord(${w})`, async () => {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: `请将英文单词"${w}"翻译成中文，只返回最常用的中文释义（2-6个字），不要任何解释或标点。如果该词有多个常见词性，返回最多 2 个释义，用中文分号「；」分隔。`
            }
          ],
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(20000)
      })
      const j = await res.json()
      return JSON.stringify(j.choices?.[0]?.message?.content ?? j)
    })
  }
})()
