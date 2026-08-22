# STATUS — 项目当前状态

> 给任何接手此项目的 agent / 人：**先读本文件**了解现状，再读 `PRD.md`（需求）、`开发计划.md`（计划）、`DECISIONS.md`（决策历史）。发现文档与代码不一致时，先问再改。

## 一句话

Saltalk：自用英语听力口语学习 Windows 桌面应用（Electron）。核心闭环：AI 生成对话 → 逐句精听 → 口头跟读模仿 → 生词积累。

## 当前版本

- 版本：**1.3.3**（git tag：`v1.3.3`）
- 安装包：`dist/Saltalk Setup 1.3.3.exe`

## 技术栈

Electron 43 + electron-vite 5 + React 19 + TypeScript 5 + Tailwind 3 + Zustand 5 + better-sqlite3 + msedge-tts

- 主进程/preload 输出 CJS（electron 43 ESM 对 electron 模块 named export 不兼容，勿改回 ESM）
- 测试：node:test（Node 22 type stripping 直跑 .ts），不用 vitest
- 语音：msedge-tts（免费），角色 A = `en-US-GuyNeural` 男声，B = `en-US-JennyNeural` 女声
- 文本生成：Deepseek API（OpenAI 兼容，fetch 直调，`response_format: json_object`）

## 已实现功能（对照 PRD）

| 功能 | 状态 |
|------|------|
| F1 对话生成（Deepseek + CEFR A1–C2 + JSON 解析校验） | ✅ |
| 随机主题（10 个分类主题库） | ✅ |
| F2 edge-tts 合成，正常 + 慢速双份缓存（`{convId}_{seq}_{speaker}[_slow].mp3`） | ✅ |
| F3 逐句点读 / 连续播放（高亮当前句）/ 单句循环 / 慢速切换 | ✅ |
| F4 中英对照（默认只显示英文，点「译」展开/收起中文） | ✅ |
| F5 单词本（选词加词、释义/音标后台补全、单词/例句发音、卡片背诵） | ✅（间隔复习已移除，见 DECISIONS） |
| F6 本地 SQLite 存储 + 对话历史回放 | ✅ |
| 明暗主题切换、设置（API key、清空数据） | ✅ |

## 已移除 / 刻意不做

- **艾宾浩斯间隔复习** → 已移除，改为卡片背诵 +「会背/还不会」直接标记已背（2026-08-21，详见 DECISIONS.md）
- **版本升级自动清库** → 已移除，升级保留所有数据（2026-08-22，v1.3.3）
- 非目标（长期有效）：不录音、不发音评分、不 AI 实时接话；不做云端同步、多用户、社交分享；不做手机端

## 已知问题 / 待办（agent 接手时注意，勿重复引入）

1. **死代码残留**（移除间隔复习后）：`shared/review.ts`、IPC `word:review`、`store.reviewWord`、`word` 表 `review_count`/`next_review_at` 字段 —— 可清理或留作备用
2. `db.ts` 的 `clearEverything()` 无调用方（原版本清库逻辑移除后遗留）
3. **SQLite 未开启 foreign_keys**，删除对话会残留孤儿 sentence 行（schema 的 `ON DELETE CASCADE` 未生效）→ 建议 `db.ts` 加 `PRAGMA foreign_keys = ON`
4. 删除对话/清空数据不清理 `audio/` 目录下的 mp3 缓存，磁盘只增不减
5. 中文释义依赖 Deepseek 兜底（Free Dictionary API 是英英释义），未接 ECDICT
6. 无应用图标（打包用默认 Electron 图标）
7. Deepseek 调用无超时/取消（`signal` 参数已定义但未接 AbortController）
8. 无单实例锁（未调用 `app.requestSingleInstanceLock()`）
9. UI 组件无自动化测试（核心逻辑 77 个单测覆盖）
10. 设置页 API key 的 draft 与异步加载不同步（`useState(apiKey)` 初始化时机问题）

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run typecheck` | 类型检查（tsc --noEmit） |
| `npm test` | 单元测试（node:test，77 个） |
| `npm run build` | 编译到 `out/` |
| `npm run dist` | electron-builder 打 NSIS 安装包（需先 build） |

- 数据位置：`%APPDATA%/Saltalk`（`app.db` + `audio/` mp3 缓存）
- 数据在打包时不进安装包，朋友新装即为干净状态

## 目录结构

```
src/main/      主进程：db / deepseek / tts / dictionary / service / ipc / schema
src/preload/   contextBridge API（window.api）
src/renderer/  React UI（store.ts + components/）
shared/        类型 / 复习算法 / 统计 / 主题库（主进程与渲染进程共用）
tests/unit/    单元测试
```
