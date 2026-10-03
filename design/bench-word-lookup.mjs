/**
 * 「点词即显释义」链路耗时实测（走真实 AppService + 真实 Deepseek 网络）。
 *
 * 为什么需要它：这个功能的体验完全由「点下去到出结果」的毫秒数决定，
 * 光看代码看不出慢在哪。上一版的 6 秒卡顿就是靠这个脚本测出来的
 * （免费词典在国内 3/3 请求卡满 6 秒超时）。
 *
 * 用法: node design/bench-word-lookup.mjs
 * 注意: 会先把真实数据库复制到临时目录再测，不动用户数据。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppDatabase } from '../src/main/db.ts'
import { AppService } from '../src/main/service.ts'

const realDb = join(homedir(), 'AppData/Roaming/nacl-english-listening/app.db')
if (!existsSync(realDb)) {
  console.error('找不到数据库：' + realDb)
  process.exit(2)
}

const workDir = join(tmpdir(), 'saltalk-bench-' + Date.now())
mkdirSync(workDir, { recursive: true })
const dbCopy = join(workDir, 'app.db')
copyFileSync(realDb, dbCopy)

const db = new AppDatabase(dbCopy)
const apiKey = db.getConfig('deepseek_api_key')
console.log('API Key:', apiKey ? '已读到' : '缺失（后面测不了）')

const svc = new AppService(db, workDir)

async function timed(label, fn) {
  const t0 = performance.now()
  const out = await fn()
  const ms = Math.round(performance.now() - t0)
  console.log(`  ${label.padEnd(46)} ${String(ms).padStart(6)} ms   ${out}`)
  return { ms, out }
}

const SENTENCE = ['I', 'would', 'like', 'to', 'negotiate', 'the', 'reception', 'schedule']

console.log('\n=== 场景 1：冷启动点第一个词（无缓存）===')
const { ms: first } = await timed('previewWord("negotiate")', async () => {
  const p = await svc.previewWord('negotiate')
  return `${p.phonetic ?? '-'} ${p.meaning ?? '(无释义)'}`
})

console.log('\n=== 场景 2：再点同一个词（应命中缓存 ≈ 0ms）===')
const { ms: again } = await timed('previewWord("negotiate")', async () => {
  const p = await svc.previewWord('negotiate')
  return `${p.phonetic ?? '-'} ${p.meaning ?? '(无释义)'}`
})

console.log('\n=== 场景 3：点整句里另一个没查过的词（无预取时应是新请求）===')
const { ms: cold } = await timed('previewWord("schedule")', async () => {
  const p = await svc.previewWord('schedule')
  return `${p.phonetic ?? '-'} ${p.meaning ?? '(无释义)'}`
})

console.log('\n=== 场景 4：预取整句 → 之后点句中任何词 ===')
const { out: foundCount } = await timed(`prefetchWords(整句 ${SENTENCE.length} 个词)`, () =>
  svc.prefetchWords(SENTENCE)
)
console.log(`  （一次请求查到 ${foundCount} 个词）`)
const { ms: afterPrefetch } = await timed('previewWord("reception") ← 预取过的词', async () => {
  const p = await svc.previewWord('reception')
  return `${p.phonetic ?? '-'} ${p.meaning ?? '(无释义)'}`
})
const { ms: afterPrefetch2 } = await timed('previewWord("colleague") ← 未在句中的词', async () => {
  const p = await svc.previewWord('colleague')
  return `${p.phonetic ?? '-'} ${p.meaning ?? '(无释义)'}`
})

console.log('\n=== 汇总 ===')
console.log(`  冷启动首次点词            : ${first} ms   （旧版 ≈ 6500 ms：先白等免费词典 6 秒超时）`)
console.log(`  二次查询命中缓存          : ${again} ms`)
console.log(`  未预取的另一个词          : ${cold} ms`)
console.log(`  预取过的词                : ${afterPrefetch} ms`)
console.log(`  未在句中、需现查的词      : ${afterPrefetch2} ms`)
console.log(
  `\n  首次点词相对旧版提速约 ${(6500 / Math.max(first, 1)).toFixed(1)} 倍；预取后的词 ≈ 瞬时。`
)

db.close()
rmSync(workDir, { recursive: true, force: true })
