#!/usr/bin/env bash
# Saltalk UI 原型 · 交互回归测试
#
# 用真实的点击驱动原型页面，断言「功能行为没变」且没有未捕获异常。
# 覆盖：四六级答题全流程（含超时推进/判分/成绩）、逐句播放焦点与降调、
#       点词入单词本、背单词翻面与进度、体系与等级切换、历史展开删除、
#       单词本分类计数与增删、主题与标注开关。
#
# 用法：  bash design/run-preview-tests.sh
# 依赖：  Chrome 或 Edge（自动探测，可用 CHROME=... 覆盖）、node
set -uo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-}"
for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/usr/bin/google-chrome" "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  [ -x "$c" ] && CHROME="$c" && break
done
[ -n "$CHROME" ] && [ -x "$CHROME" ] || { echo "找不到 Chrome/Edge，请设置 CHROME 环境变量"; exit 1; }
command -v node >/dev/null || { echo "需要 node 在 PATH 中"; exit 1; }

# 测试脚本必须「内联」进副本：file:// 页面下外部 <script src> 不会被执行。
node -e "
const fs=require('fs');
const suite=fs.readFileSync('preview-tests.js','utf8');
if (suite.includes('</scr'+'ipt>')) { console.error('测试脚本里不能出现 script 结束标签'); process.exit(1); }
fs.writeFileSync('_test.html',
  fs.readFileSync('ui-preview.html','utf8')
    .replace('</body>', '<script>\n'+suite+'\n</scr'+'ipt></body>'));
" || exit 1

# 关键：Git Bash 的 \$(pwd) 是 /c/... 这种 MSYS 路径，拼成 file:///c/... 在
# Windows 上无效，Chrome 只会返回一个 neterror 页。必须用 pwd -W 的 C:/... 形式。
WD="$(pwd -W 2>/dev/null || pwd)"
URL="file:///${WD}/_test.html#practice:noanim"

# :noanim 关掉全部动效与过渡 —— 否则断言/截图会卡在过渡的中间帧
RAW="$("$CHROME" --headless=new --disable-gpu --no-sandbox \
  --virtual-time-budget=240000 --window-size=1000,800 --dump-dom "$URL" 2>/dev/null)"

rm -f _test.html

if printf '%s' "$RAW" | grep -q 'neterror'; then
  echo "页面没加载成功（Chrome 返回了错误页）。检查路径：$URL"; exit 1
fi

OUT="$(printf '%s' "$RAW" | grep -o 'data-test="[^"]*"' | head -1 \
  | sed 's/data-test="//; s/"$//' | tr '~' '\n' \
  | sed 's/&gt;/>/g; s/&lt;/</g; s/&quot;/"/g' | grep -v '^$')"

if [ -z "$OUT" ]; then
  echo "没有拿到测试结果 —— 页面里的脚本可能报错了。"
  echo "排查：在浏览器里打开 design/ui-preview.html 看控制台输出。"
  exit 1
fi

printf '%s\n' "$OUT"
printf '%s\n' "$OUT" | grep -q 'FAIL' && { echo "有失败用例"; exit 1; }
exit 0
