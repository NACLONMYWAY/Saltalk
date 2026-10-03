// 安装包/应用 exe 的图标完整性校验：把 sources ICO 的每一档图片，
// 逐字节反向比对是否真的嵌进了 PE（安装包 + win-unpacked 的 exe）。
// 用法: node design/verify-icon.cjs [version=1.4.5]
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const version = process.argv[2] || require(path.join(ROOT, 'package.json')).version
const icoPath = path.join(ROOT, 'resources/icons/app-icon.ico')

function readIco(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('not an ICO')
  const count = buf.readUInt16LE(4)
  const out = []
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16
    const w = buf[off] || 256
    const h = buf[off + 1] || 256
    const size = buf.readUInt32LE(off + 8)
    const offset = buf.readUInt32LE(off + 12)
    out.push({ w, h, size, data: buf.subarray(offset, offset + size) })
  }
  return out
}

const entries = readIco(fs.readFileSync(icoPath))
console.log(`ICO: ${entries.map((e) => `${e.w}x${e.h}`).join(', ')}`)

const targets = [
  ['installer', path.join(ROOT, `dist/Saltalk Setup ${version}.exe`)],
  ['app-exe', path.join(ROOT, 'dist/win-unpacked/Saltalk.exe')]
]

let failed = 0
for (const [label, p] of targets) {
  if (!fs.existsSync(p)) {
    console.log(`-- ${label}: 不存在 ${p}`)
    failed++
    continue
  }
  const blob = fs.readFileSync(p)
  const miss = entries.filter((e) => !blob.includes(e.data))
  const hit = entries.length - miss.length
  console.log(`-- ${label}: ${hit}/${entries.length} 图标档位命中 (${(blob.length / 1048576).toFixed(1)} MB)`)
  for (const e of miss) console.log(`     MISS ${e.w}x${e.h} (${e.size}B)`)
  if (miss.length) failed++
}

// 反向对照组：electron-builder 自带的 elevate.exe 用的是它自己的图标，
// 必须一本档都不命中；否则说明「命中」只是短字节序列的巧合，正向结论不成立。
const negPath = path.join(ROOT, 'dist/win-unpacked/resources/elevate.exe')
if (fs.existsSync(negPath)) {
  const blob = fs.readFileSync(negPath)
  const hit = entries.filter((e) => blob.includes(e.data)).length
  console.log(`-- 对照组 elevate.exe: ${hit}/${entries.length} 命中（预期 0）`)
  if (hit !== 0) failed++
} else {
  console.log(`-- 对照组 elevate.exe: 不存在，跳过（${negPath}）`)
}

console.log(failed === 0 ? 'ICON-OK' : `ICON-FAIL (${failed})`)
process.exit(failed === 0 ? 0 : 1)
