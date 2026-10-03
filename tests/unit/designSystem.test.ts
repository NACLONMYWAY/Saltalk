import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 设计系统的类名和 Tailwind 的工具类共用一个 className 命名空间。
 * 一旦撞名，Tailwind 的样式就会和我的样式叠在一起 —— 而 Tailwind 的产物在 CSS 里
 * 排在前面，我又只覆盖了自己写过的属性，结果就是「线上冒出一条我没写过的样式」，
 * 类型检查、单测、肉眼 review 全都抓不到。
 *
 * 真实发生过的 bug：倒计时环写了 class="ring"。Tailwind 的 .ring 会加
 *   box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)
 * 其中 --tw-ring-shadow 默认是 0 0 0 3px rgba(59,130,246,.5) ——
 * 于是纯黑白的环外面多出一个 3px 蓝色方框，最后是靠截图逐像素扫色才定位到的。
 *
 * 这个文件就是那道闸：用到的类名一旦落进 Tailwind 的「会注入视觉」名单，测试直接红。
 */

const here = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(here, '../../src/renderer/src')

/** 会注入「我没写的视觉」的 Tailwind 工具类 —— 真要用的，先加进 ALLOW 并写清理由 */
const TAILWIND_INTRUSIVE = new RegExp(
  '^(?:' +
    [
      'ring',
      'ring-\\d+',
      'ring-inset',
      'ring-offset(?:-\\d+)?',
      'shadow(?:-[a-z0-9]+)?',
      'outline(?:-[a-z0-9]+)?',
      'blur(?:-[a-z0-9]+)?',
      'brightness-\\d+',
      'contrast-\\d+',
      'grayscale',
      'invert',
      'sepia',
      'saturate-\\d+',
      'hue-rotate-\\d+',
      'drop-shadow(?:-[a-z0-9]+)?',
      'backdrop-[a-z-]+',
      'mix-blend-[a-z-]+',
      'rounded(?:-[a-z0-9]+)?',
      'border',
      'border-\\d+',
      'divide-[a-z0-9-]+',
      'space-[xy]-\\d+',
      'italic',
      'not-italic',
      'underline',
      'overline',
      'line-through',
      'no-underline',
      'uppercase',
      'lowercase',
      'capitalize',
      'normal-case',
      'truncate',
      'text-ellipsis',
      'text-clip',
      'sr-only',
      'not-sr-only',
      'antialiased',
      'subpixel-antialiased',
      'resize(?:-[a-z]+)?',
      'appearance-none',
      'isolate',
      'container',
      'transform',
      'transform-gpu',
      'transition',
      'filter'
    ].join('|') +
    ')$'
)

/** 故意放行的：这两个在 main.css 里另有定义，语义与 Tailwind 版本一致、顺序上也由我这边胜出 */
const ALLOW = new Set(['grow', 'inline'])

/** 会跟设计系统抢「布局语义」的裸工具类（不注入颜色，但会改 display/position） */
const BARE_LAYOUT_UTILITY =
  /^(?:block|inline-block|inline|flex|inline-flex|table|inline-grid|grid|contents|hidden|static|fixed|absolute|relative|sticky|visible|invisible|collapse)$/

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  )
}

/** 抓出全部 JSX/TSX 里 className 用到的 class token */
function usedClassTokens(): { file: string; token: string }[] {
  const out: { file: string; token: string }[] = []
  for (const file of walk(RENDERER)) {
    if (!/\.tsx?$/.test(file)) continue
    const src = readFileSync(file, 'utf8')
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      for (const token of (m[1] || m[2] || '').split(/[^a-zA-Z0-9_-]+/)) {
        if (/^[a-z][a-z0-9-]*$/.test(token)) out.push({ file, token })
      }
    }
  }
  return out
}

/** 抓出 main.css 里「单独一个类名」形式的选择器（`.foo {` / `.foo,`），排除 `.a.b`、`.a .b` */
function bareSelectors(): string[] {
  const css = readFileSync(join(RENDERER, 'assets/main.css'), 'utf8')
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const names: string[] = []
  for (const part of withoutComments.split(/[,{}]/)) {
    const m = part.trim().match(/^\.([a-z][a-z0-9-]*)$/)
    if (m) names.push(m[1])
  }
  return names
}

/** 抓出 JSX 里以「条件状态类」形式出现的短类名，例如 `... ? ' picked' : ''` */
function conditionalClassTokens(): { file: string; token: string }[] {
  const out: { file: string; token: string }[] = []
  for (const file of walk(RENDERER)) {
    if (!/\.tsx$/.test(file)) continue
    const src = readFileSync(file, 'utf8')
    const re = /\?\s*'([^']*)'\s*:\s*''/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      for (const token of m[1].split(/[^a-zA-Z0-9_-]+/)) {
        if (/^[a-z][a-z0-9-]*$/.test(token)) out.push({ file, token })
      }
    }
  }
  return out
}

/**
 * main.css 里承担「容器 / 结构」职责的类名：它们带着 position / display / flex
 * 这类会改变盒子形态的属性。拿它们当别处的状态标记，那处就会凭空变形。
 *
 * 真实发生过的 bug：对话里的可点单词选中态写成 class="w sel"。而 .sel 是原生
 * select 的包装器（display:inline-flex; flex:1），于是被点中的那个词在 flex 行里
 * 吃掉整行剩余空间，表现成「点哪个词，哪个词就拉成一条长条」——
 * 练习页看起来像乱码，历史页看起来像右边多了一大段空白。
 */
const STRUCTURAL_CLASSES = new Set([
  'sel',
  'sel-fixed',
  'sel-chev',
  'wrap',
  'wrap-narrow',
  'wrap-mid',
  'list',
  'sent',
  'sent-body',
  'en',
  'zh',
  'grow',
  'note',
  'ex',
  'mean',
  'eq',
  'w'
])

describe('设计系统 · Tailwind 类名撞车防线', () => {
  it('JSX 里没有用到会注入视觉的 Tailwind 工具类', () => {
    const bad = usedClassTokens().filter(
      (t) => TAILWIND_INTRUSIVE.test(t.token) && !ALLOW.has(t.token)
    )
    assert.deepEqual(
      [...new Set(bad.map((b) => `${b.token}  (${b.file.replace(/\\/g, '/').split('/src/')[1]})`))],
      [],
      '这些类名会命中 Tailwind 工具类并注入样式；要么换名（建议加 cd- / 语义前缀），要么进 ALLOW'
    )
  })

  it('main.css 没有定义与 Tailwind 裸工具类同名的选择器', () => {
    const clashes = [...new Set(bareSelectors())].filter(
      (n) => !ALLOW.has(n) && (BARE_LAYOUT_UTILITY.test(n) || TAILWIND_INTRUSIVE.test(n))
    )
    assert.deepEqual(
      clashes,
      [],
      'main.css 里定义了和 Tailwind 同名的裸类，两边会互相叠加／互相覆盖'
    )
  })

  it('倒计时环用 cd-ring，不是 ring（回归：ring 会带上 3px 蓝色 box-shadow）', () => {
    const cet = readFileSync(join(RENDERER, 'components/CetPlayer.tsx'), 'utf8')
    assert.ok(cet.includes('className="cd-ring"'), 'CetPlayer 应该用 className="cd-ring"')
    assert.ok(
      !/className="ring"/.test(cet) && !/className="ring-num"/.test(cet),
      'CetPlayer 里不能再出现裸的 ring / ring-num —— 会被 Tailwind 抢走'
    )
    const css = readFileSync(join(RENDERER, 'assets/main.css'), 'utf8')
    assert.ok(/\.cd-ring\s*\{/.test(css), 'main.css 应该定义 .cd-ring')
  })

  it('可点单词的选中态用 picked，不是 sel（回归：sel 是 select 包装器，会把词撑成一条长条）', () => {
    const css = readFileSync(join(RENDERER, 'assets/main.css'), 'utf8')
    const dp = readFileSync(join(RENDERER, 'components/DialoguePlayer.tsx'), 'utf8')

    assert.ok(
      !/\.w\.sel\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
      'main.css 里不能再出现 .w.sel —— .sel 属于原生 select 包装器'
    )
    assert.ok(/\.w\.picked\s*\{/.test(css), 'main.css 应该定义 .w.picked')
    assert.ok(/' picked'/.test(dp), 'DialoguePlayer 的单词选中态应使用 picked')
    assert.ok(!/' sel'/.test(dp), 'DialoguePlayer 不能再把 sel 当单词选中态')
  })

  it('条件状态类不许复用 main.css 里的结构类名', () => {
    const bad = conditionalClassTokens().filter((t) => STRUCTURAL_CLASSES.has(t.token))
    assert.deepEqual(
      [...new Set(bad.map((b) => `${b.token}  (${b.file.replace(/\\/g, '/').split('/src/')[1]})`))],
      [],
      '这些名字在 main.css 里是「容器角色」，借去当状态标记会把容器的 display/flex 一起带过来'
    )
  })
})

describe('设计系统 · 纯黑白硬约束', () => {
  it('所有硬编码颜色要么无彩色，要么只挂在 --ok / --bad / --warn 语义变量上', () => {
    const raw = readFileSync(join(RENDERER, 'assets/main.css'), 'utf8')
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

    const chroma = (lit: string): boolean => {
      const hex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.exec(lit)
      if (hex) {
        const v = hex[1]
        const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
        return Math.max(r, g, b) - Math.min(r, g, b) > 25
      }
      const fn = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(lit)
      if (fn) {
        const [r, g, b] = [+fn[1], +fn[2], +fn[3]]
        return Math.max(r, g, b) - Math.min(r, g, b) > 25
      }
      return false
    }

    const violations: string[] = []

    // 1) 变量定义：彩色只允许挂在语义变量名下（--ok* / --bad* / --warn*）
    for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
      const [, name, value] = m
      if (!chroma(value)) continue
      if (/^--(ok|bad|danger|warn)(-|$)/.test(name)) continue
      violations.push(`变量 ${name}: ${value.trim()}`)
    }

    // 2) 直接写在属性里的颜色：必须无彩色
    const stripped = css.replace(/--[a-z0-9-]+\s*:\s*[^;}]+/gi, '')
    for (const m of stripped.matchAll(/(?:color|background(?:-color)?|border(?:-color)?|stroke|fill|outline-color)\s*:\s*([^;}]+)/gi)) {
      if (chroma(m[1])) violations.push(`属性 ${m[1].trim()}`)
    }

    assert.deepEqual(
      violations,
      [],
      '硬编码彩色只允许挂在 --ok / --bad / --warn 语义变量上（这样 data-semantic="off" 才关得掉）'
    )
  })
})
