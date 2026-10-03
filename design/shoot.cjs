#!/usr/bin/env node
/**
 * 为 ui-preview.html 的关键状态批量出图。
 *
 * 为什么是两步：
 *   Chrome 的 --screenshot 会在页面脚本执行前抢拍（实测 12 张图的 md5 完全一致，
 *   而 --dump-dom 能正确看到 data-theme="light"）。所以先用 --dump-dom 把「状态已生效」
 *   的真实 DOM 导出，剥掉 <script>（防止重新加载时 init() 把状态重置回默认），
 *   写成一个静态探针文件，再去截图。静态文件不需要任何 JS 时序，所见即所得。
 *
 * 用法： node design/shoot.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const SRC = path.join(DIR, 'ui-preview.html');
const OUT = path.join(DIR, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome/Edge');
  process.exit(1);
}

const base = fs.readFileSync(SRC, 'utf8');
const href = 'file:///' + SRC.replace(/\\/g, '/');

// 状态名 -> 深链（:noanim 关掉动效，避免截到过渡中间帧）
const CASES = [
  ['01-practice-light', '#practice:light:noanim'],
  ['02-practice-dark', '#practice:dark:noanim'],
  ['03-practice-busy-dark', '#practice-busy:dark:noanim'],
  ['04-cet-answering-light', '#cet-answering:light:noanim'],
  ['05-cet-finished-dark', '#cet-finished:dark:noanim'],
  ['06-words-study-light', '#words-study:light:noanim'],
  ['07-words-study-back-light', '#words-study-back:light:noanim'],
  ['08-words-anno-dark', '#words:dark:anno:fold:noanim'],
  ['09-history-open-light', '#history-open:light:noanim'],
  ['10-settings-light', '#settings:light:noanim'],
  ['11-annotated-practice-light', '#practice:light:anno:fold:noanim'],
  ['12-empty-dark', '#practice-empty:dark:noanim'],
];

const chrome = (args) =>
  execFileSync(CHROME, args, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString();

const strip = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

const probe = path.join(DIR, '_probe.html');
let ok = 0;

for (const [name, hash] of CASES) {
  // 1) 渲染出「状态已生效」的真实 DOM
  const dom = chrome([
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=5000', '--window-size=1180,820',
    '--dump-dom', href + hash,
  ]);
  if (!dom || dom.length < 5000) {
    console.error(`  !! ${name} 渲染失败（DOM 只有 ${dom.length} 字节）`);
    continue;
  }
  const baked = strip(dom);
  fs.writeFileSync(probe, baked);

  // 2) 截图这份静态探针：无 JS、无时序，抓到什么就是什么
  chrome([
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1180,820', '--virtual-time-budget=2000',
    '--screenshot=' + path.join(OUT, name + '.png'),
    'file:///' + probe.replace(/\\/g, '/'),
  ]);
  const sz = fs.statSync(path.join(OUT, name + '.png')).size;
  console.log(`  -> ${name}.png  (${(sz / 1024).toFixed(0)} KB)`);
  ok++;
}

fs.rmSync(probe, { force: true });

// 3) 自检：不同状态的图不能是同一张（防止再次出现「抢拍」静默失效）
const crypto = require('crypto');
const sums = fs.readdirSync(OUT).filter((f) => f.endsWith('.png'))
  .map((f) => crypto.createHash('md5').update(fs.readFileSync(path.join(OUT, f))).digest('hex'));
const uniq = new Set(sums).size;
console.log(`\n生成 ${ok} 张；不同内容 ${uniq} 张（${sums.length === uniq ? 'OK，状态确实生效' : '警告：存在重复图片'}）`);
console.log('目录：' + OUT);
