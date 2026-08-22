# 决策记录（DECISIONS.md）

> 记录项目中的**有意决策**（新增 / 删除 / 取舍 / 技术选型）。任何 agent 开工前必读，防止把已删除的功能重新加回来。
>
> **规则**：每次会话若产生新决策（含口头决定"删掉 / 以后不用 / 别做这个"），追加一条，格式：日期 / 决定 / 原因 / 影响。

---

## 2026-08-20 技术选型：Electron + electron-vite（放弃 Tauri）

- **决定**：桌面框架用 Electron + electron-vite，不用 Tauri
- **原因**：edge-tts 有成熟 Node 库（msedge-tts），集成最省事；全 TS 栈开发效率高；自用不在乎包体积
- **影响**：Tauri 方案放弃；如更换仅影响工程化部分

## 2026-08-20 测试框架：node:test 直跑 .ts（不用 vitest）

- **决定**：用 node:test（Node 22 type stripping），不用 vitest
- **原因**：避免额外依赖 + 网络问题
- **影响**：测试命令为 `npm test`，测试文件在 `tests/unit/`

## 2026-08-20 词典：先 Free Dictionary API，中文释义 Deepseek 兜底

- **决定**：英英释义用 Free Dictionary API；中文释义用 Deepseek 翻译兜底；正式接 ECDICT 本地词库待定
- **原因**：最快跑通闭环
- **影响**：单词释义目前是英英为主，中文质量依赖 Deepseek

## 2026-08-21 移除艾宾浩斯间隔复习

- **决定**：删掉间隔复习引擎，单词本改为「卡片式背诵」，「会背/还不会」直接标记已背（`learning`/`mastered`）
- **原因**：自用场景复习提醒价值低，流程越简单越好
- **影响**：`shared/review.ts`、IPC `word:review`、`store.reviewWord`、`word` 表 `review_count`/`next_review_at` 成为死代码；**PRD F5.3/F5.4 作废**

## 2026-08-21 版本升级自动清空数据（含 API key）——已撤销

- **决定**：启动时检测版本号变化则清空全部数据（sentence/conversation/word/config）
- **原因**：希望朋友拿到干净应用、用自己的 key
- **影响**：本人每次升级也被清空；该决策已于下一条撤销

## 2026-08-22 撤销「版本升级清库」，升级/卸载保留用户数据（v1.3.3）

- **决定**：移除 `src/main/index.ts` 的版本比对清库逻辑（只记录 `app_version`，不删数据）；`package.json` 的 `deleteAppDataOnUninstall` 改回 `false`
- **原因**：新装时数据库本就是空的，不需要清；升级清库反而清掉本人和朋友的数据。且 NSIS 升级路径会先运行旧版卸载器，`deleteAppDataOnUninstall: true` 会在升级时删除 `userData`
- **影响**：升级后单词本/历史/API key 全部保留；`db.ts` 的 `clearEverything()` 失去调用方（死代码，可留作"恢复出厂设置"用）

## 2026-08-22 数据分发策略：不依赖服务器，直接发安装包

- **决定**：更新分发用「直接把新安装包发给朋友覆盖安装」，暂不做自动更新（electron-updater / GitHub Releases 为备选，待定）
- **原因**：无服务器；朋友数量少；避免引入 electron-updater 依赖
- **影响**：版本号 bump 很重要，否则朋友无法区分新旧安装包（v1.3.2 → v1.3.3 即此原因）

---

## 非目标（长期有效，勿让 agent 加回来）

- 不录音、不做发音评分、不做 AI 实时对话接话（口语形式 = 听 + 口头跟读模仿）
- 不做云端同步、多用户、社交分享、广告付费
- 不做手机端（仅 Windows 桌面，自用 + 少量朋友）
