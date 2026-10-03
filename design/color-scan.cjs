#!/usr/bin/env node
/**
 * 对 design/app-shots/*.png 做逐像素配色审计。
 *
 * 为什么要在浏览器里跑：本机没有 Pillow / sharp，而 1200×860 的图用 Python 逐像素
 * 反 filter 慢到不可用。借无头 Chrome 的 canvas + getImageData，一次遍历就出结果。
 *
 * 审计两项：
 *   blue   —— B 通道明显高于 R/G。纯黑白设计里这属于「不该出现的杂色」，
 *             上一轮的 3px 蓝色方框就是靠这一项抓出来的，应当恒为 0。
 *   chroma —— max-min > 25 的像素数。成绩页的答对绿 / 答错红是有意保留的语义色，
 *             其余页面应当为 0。
 *
 * 用法：node design/color-scan.cjs
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const { execFile } = require('child_process')
const { promisify } = require('util')
const run = promisify(execFile)

const SHOTS = path.join(__dirname, 'app-shots')
const TMP = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'nacl-color-scan')

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(1)
}

const files = fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png'))
if (files.length === 0) {
  console.error('app-shots 里没有图，先跑 node design/app-shots.cjs')
  process.exit(1)
}

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PENDING</title></head><body>
<script>
var FILES = ${JSON.stringify(files)};
function load(src){ return new Promise(function(res, rej){
  var i = new Image(); i.onload = function(){ res(i) }; i.onerror = function(){ rej(new Error(src)) }; i.src = src; }); }
(async function(){
  var out = [];
  var errs = [];
  for (var k = 0; k < FILES.length; k++) {
    var f = FILES[k];
    try {
      var img = await load('/app-shots/' + f);
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var blue = 0, chroma = 0;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], gg = d[i+1], b = d[i+2];
        var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        if (b - Math.max(r, gg) > 40) blue++;
        if (mx - mn > 25) chroma++;
      }
      out.push({ f: f, w: c.width, h: c.height, blue: blue, chroma: chroma, total: c.width * c.height });
    } catch (e) { errs.push(f + ': ' + e.message); }
  }
  document.title = 'SCAN ' + JSON.stringify({ rows: out, errs: errs });
})();
</script></body></html>`

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
  fs.writeFileSync(path.join(TMP, 'index.html'), PAGE)

  const types = { '.html': 'text/html', '.png': 'image/png' }
  // 一个服务器同时提供页面与图片（两个端口的话，页面里的 <img src="/app-shots/...">
  // 会打到页面所在端口上，404）
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0])
    const file =
      url === '/'
        ? path.join(TMP, 'index.html')
        : url.startsWith('/app-shots/')
          ? path.join(SHOTS, path.basename(url))
          : path.join(TMP, url)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404)
      res.end('nope')
      return
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(fs.readFileSync(file))
  })

  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port

  const { stdout } = await run(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--user-data-dir=' + path.join(TMP, 'chrome-profile').replace(/\\/g, '/'),
      '--virtual-time-budget=25000',
      `--dump-dom`,
      `http://127.0.0.1:${port}/`
    ],
    { maxBuffer: 1 << 28 }
  )
  server.close()


  const raw = (stdout.match(/<title>SCAN ([\s\S]*?)<\/title>/) || [])[1]
  if (!raw) {
    console.error('没拿到扫描结果')
    process.exit(1)
  }
  const { rows, errs } = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))

  let bad = 0
  console.log('文件'.padEnd(38) + '尺寸'.padEnd(12) + 'blue'.padEnd(10) + 'chroma')
  for (const r of rows) {
    const flag = r.blue > 0 ? '  ← 杂色！' : ''
    if (r.blue > 0) bad++
    console.log(
      r.f.padEnd(36) + `${r.w}x${r.h}`.padEnd(12) + String(r.blue).padEnd(10) + String(r.chroma) + flag
    )
  }
  for (const e of errs) console.log('  !! ' + e)
  console.log(`\n共 ${rows.length} 张；带蓝色杂色 ${bad} 张`)
  process.exit(bad > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
