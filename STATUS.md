# STATUS — 项目状态

> 单一来源：快速了解项目现在在哪、还有什么没做。每次迭代后更新。

## 当前版本
**v1.4.0**

## 项目是什么
Saltalk —— 自用英语听力口语学习桌面应用（Electron）。输入主题 → AI 生成学习材料 → 语音精听 → 点词加入单词本 → 背单词卡片复习。

支持**三套难度体系**：CEFR（A1–C2，双人对话）、雅思（4.0–9.0 / 0.5 分一档，双人对话）、四六级（四级/六级，**考试听力题形式**：一段长对话 + 4 道四选一选择题）。

## 技术栈
- Electron + React + TypeScript
- better-sqlite3（本地数据库，WAL）
- edge-tts（微软免费 TTS）
- Deepseek API（对话生成 / 四六级命题 / 单词中文翻译）
- Tailwind CSS（暗色 class 模式）+ Zustand
- electron-vite 构建 + electron-builder 打包
- 测试：node:test，**154 个单元测试 / 49 个套件**

## 已完成功能
- [x] 主题对话生成（Deepseek，CEFR 分级）
- [x] 双语速语音（正常 + 慢速，预生成，切换即时）
- [x] 连续播放 / 单句循环 / 慢速切换
- [x] 点词加入单词本（去重、中文释义、音标）
- [x] 单词本：单词 + 例句语音播放、删除、例句中文翻译
- [x] 背单词卡片模式（未背 / 已背分类）
- [x] 历史记录（展开播放、单条删除）
- [x] 设置（API Key、清空数据）
- [x] 黑白主题切换（极简风）
- [x] **应用图标**（`resources/icons/app-icon.ico`，已配 `win.icon`）
- [x] 数据库增量迁移（升级保留单词本 / 历史 / API Key）

### v1.4.0 新增
- [x] **三套难度体系**：CEFR / 雅思 / 四六级，设置页切换，练习页难度下拉只显示当前体系等级
- [x] **四六级听力题模式**：对齐真题形式（试卷只印选项不印题干、题干录音朗读、只播一遍、每题 15 秒、四选一、出题顺序 = 对话顺序）
- [x] 四六级答题：选完立即判分 + 正确答案 + 中文解析 + 本轮成绩 + 原文对照
- [x] **音色可配置**：32 个英语音色（13 种口音），A/B 分别可选 + 试听；四六级额外配「题干朗读音色」
- [x] 雅思档位 4.0–9.0（0.5 分一档，共 11 档）

### v1.4.0 修复
- [x] 换音色后声音不变的串音问题（音频缓存文件名加入音色指纹）
- [x] 删除对话后句子残留的孤儿数据（开启 `PRAGMA foreign_keys` + 显式删除 + 迁移清理）
- [x] 补齐 README 引用但不存在的 STATUS.md / DECISIONS.md

## 进行中 / 待办
- [ ] **四六级语速调档**：真题四级 120–150 wpm、六级 140–160 wpm，当前仍与 CEFR/雅思共用 ±0%/-20% 两档（1.4.0 已知还原度缺口）
- [ ] **四六级 Directions 引导语音**：真题开头会播报考试说明，v1.4.0 未做
- [ ] 单词本「今日待复习」入口（`dueWords` / `stats` 已在 store 计算，UI 未使用）
- [ ] 背单词卡片的「还不会」未接艾宾浩斯间隔（`reviewWord` 未被调用，间隔逻辑目前不生效）
- [ ] 历史记录「继续练习」（`loadConversation` 已实现，未接入历史页）
- [ ] 对话 / 单词本导出（JSON / CSV）
- [ ] 打包体积优化：`better-sqlite3/prebuilds/` 会带上 darwin/linux 二进制（约 18MB 冗余），Windows 专用可用 `files` 白名单裁掉
- [ ] **手机端 Android**（已确认方案：Capacitor + 自用，暂缓）
  - 前置：装 Android SDK / Android Studio，JDK 17
  - 需改造：数据库、语音、文件、通信四层
- [ ] 代码签名（去 SmartScreen 警告）
- [ ] GitHub Releases 发布安装包

## 已知问题 / 限制
- 推送 GitHub 需用户本机终端（WorkBuddy 沙箱访问 GitHub 有证书问题）
- 播放逻辑（React 组件）无自动化测试，靠手动验证；四六级答题流水线的纯逻辑（判分 / 推进 / 超时）已抽到 `shared/examFlow.ts` 并覆盖测试，但**音频时序仍需手动听验**
- 单词发音在加词后后台合成，刚加的词需稍等才有声音
- edge-tts 是网络服务，首次合成需联网；单句失败会标记「音频未就绪」，不影响其他句子
- 音色变更只影响**新生成**的对话，已有对话保留原音色音频（刻意设计，避免重合成耗时）

## 数据迁移
- v1.4.0 相对 v1.3.3 是**纯增量迁移**：新增 `conversation.system` 列与 `question` 表，老记录自动视为 CEFR
- 单词本、对话历史、API Key **全部保留**，升级不清库

## 打包 / 发布
- 命令：`npm run build && npm run dist`（即 `electron-vite build` + `electron-builder --win`）
- 产物：`dist/Saltalk Setup <version>.exe`
- 版本号在 `package.json`；**bump 版本不会清空数据**（走增量迁移）

### Windows 环境注意（本机特有）
本机没有 Visual Studio C++ 工具链，直接 `npm install` 会因为 `better-sqlite3` 存在 `binding.gyp`
被 npm 自动触发 `node-gyp rebuild` 而失败。但它其实是 N-API + 预编译二进制、并不需要编译：

```bash
npm install --ignore-scripts          # 跳过无用的 node-gyp，并补上缺失的可选原生依赖
node node_modules/electron/install.js # 手动下 electron 运行时（约 235MB）
npm run build && npm run dist
```

- 另需注意：安装中断会触发 npm 的可选依赖 bug（npm/cli#4828），导致
  `@rollup/rollup-win32-x64-msvc`、`@esbuild/win32-x64` 缺失，`electron-vite build` 会报找不到模块
- `electron-builder` 需在**无沙箱**环境运行，否则 fs shim 会污染 `npm list` 的输出，
  报 `No JSON content found in output`
