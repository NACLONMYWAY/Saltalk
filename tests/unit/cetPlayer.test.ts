import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * CetPlayer 是纯 React 组件，项目目前没有 DOM 测试环境，所以它的播放/答题流程
 * 没法用「渲染后断言」的方式测。但其中两类错误是可以静态守住的，而且都真实发生过：
 *
 *  1. 音频播放漏掉 `audio.src = url` —— 题干根本不会发声（类型检查抓不到，
 *     因为 JS 不会报「你设了 url 变量却没用」）
 *  2. 题目卡片被 phase 条件门控 —— 不点「开始听力」屏幕上没有任何题目和选项
 *
 * 这里做源码级不变量断言，属于过渡手段；正解是引入 jsdom + @testing-library
 * 做真正的组件测试（记在 STATUS.md 待办）。
 */
const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(join(here, '../../src/renderer/src/components/CetPlayer.tsx'), 'utf8')

function functionBody(name: string): string {
  const start = SOURCE.indexOf(`function ${name}(`)
  assert.ok(start !== -1, `找不到函数 ${name}`)
  // 取到下一个顶层 function 声明或文件末尾
  const rest = SOURCE.slice(start + 1)
  const nextIdx = rest.indexOf('\n  function ')
  return nextIdx === -1 ? rest : rest.slice(0, nextIdx)
}

describe('CetPlayer 源码不变量', () => {
  it('playStem 必须先设置音频源再播放（否则题干不发声）', () => {
    const body = functionBody('playStem')
    assert.ok(
      body.includes('audio.src = url'),
      'playStem 里漏了 `audio.src = url`，题干音频不会播放'
    )
    assert.ok(body.includes('audio.play()'), 'playStem 应当调用 audio.play()')
  })

  it('每一处 audio.play() 都要有 .catch 兜底', () => {
    const all = SOURCE.match(/audio\.play\(/g) ?? []
    const guarded = SOURCE.match(/audio\.play\(\)\.catch\(/g) ?? []
    assert.ok(all.length > 0, '没有找到任何 audio.play() 调用')
    assert.equal(
      all.length,
      guarded.length,
      `有 ${all.length - guarded.length} 处 audio.play() 没接 .catch，播放失败会变成未处理的 rejection 并卡住流程`
    )
  })

  it('题干只从 audio 元素读取，不硬编码路径', () => {
    const body = functionBody('playStem')
    assert.ok(
      body.includes('questionsRef.current[i]?.stemAudioUrl'),
      'playStem 应当从题目数据里取 stemAudioUrl'
    )
  })

  it('所有题目卡片不带 phase 门控（刚生成时就要能看到题目和选项）', () => {
    // 回归：曾经写成 `{current && (phase === 'answering' || ...) && (...)}`，
    // 结果不点「开始听力」屏幕上没有任何可选的题。
    // 这里只匹配 JSX 表达式形式的门控（花括号紧跟 current），
    // 避免误伤 `pick` 里 `i === qIndexRef.current && (...)` 这类答题逻辑判断。
    assert.ok(
      !/\{\s*current\s*&&/.test(SOURCE),
      '题目卡片又被 JSX 门控了：应当始终渲染全部题目'
    )
    // 题目卡片的渲染入口：应当无条件遍历全部题目
    const cardBlocks = SOURCE.match(/questions\.map\(/g) ?? []
    assert.ok(cardBlocks.length >= 1, '应当遍历渲染全部题目')
    assert.ok(
      SOURCE.includes('<QuestionCard'),
      '应当使用 QuestionCard 渲染每一题'
    )
  })

  it('作答后不再重开答题窗口（避免白送一次机会）', () => {
    const body = functionBody('enterAnswerWindow')
    assert.ok(
      body.includes('isAnswered(answersRef.current[i])'),
      'enterAnswerWindow 应当先判断该题是否已作答'
    )
    const startAnswer = functionBody('startAnswer')
    assert.ok(
      startAnswer.includes('isAnswered(answersRef.current[i])'),
      'startAnswer 也应当对已作答的题短路'
    )
  })
})
