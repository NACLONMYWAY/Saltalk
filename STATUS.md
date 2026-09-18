# STATUS — 项目状态

> 单一来源：快速了解项目现在在哪、还有什么没做。每次迭代后更新。

## 当前版本
**v1.4.2**

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
- 测试：node:test，**184 个单元测试 / 55 个套件**

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

### v1.4.2 更新（难度校准 + 真题流程细节）
- [x] **四六级难度校准**（原来「生成难度与真实难度严重不符」）。调研真实考卷与大纲后，把决定难度的
  四项写进 `CET_SPECS`：**词汇带**（四级约 4500 词常用义 / 六级 5500–6000 词且考熟词僻义）、
  **语域**（校园事务·求职职场·社会议题，而非点单寒暄）、**答案与干扰项策略**
  （四级约 90% 所听即所得；六级约 70% 原文、其余需同义替换与推理，干扰项偷换主体/程度/时间）、
  **题型配比**（四级 3 细节 + 1 主旨/推理；六级细节与推理各半）
- [x] 删掉旧 prompt 里「不要出现明显超纲的艰深词汇」这句 —— 它会主动把难度拉低
- [x] **主题库按体系分开**：新增四六级题库（选课/论文/求职/租房/理赔/城市交通/人口老龄化…）与
  雅思题库（租房咨询·小组作业·导师辅导…），不再共用 CEFR 的「点咖啡/问路」
- [x] **词数校验**：四六级对话词数必须落在真题区间（四级 240–280 / 六级 280–320，容差 85%–150%），
  过短判定「信息量不足、难度偏低」并自动重试
- [x] **题干朗读带题号**：改为 `Question 1. <题干>`。取自真实考卷听力原文
  （"Question 1, what does the man say he did before buying the blender?"），原来只念题干听不出第几题
- [x] **新增真题引导语**：材料播放前先播报
  "Questions 1 to 4 are based on the conversation you have just heard."（按题量缓存，跨对话复用）
- [x] **雅思难度描述细化**：11 个档位补上词汇/句法/地道度/推理要求，并在对话 prompt 中要求
  英式表达、具体细节、**自我修正陷阱**、观点分歧与自然缩略
- [x] **点词弹窗可收起**：点击单词浮出「加入单词本」后，点其他地方即收起（原来会一直挂着）

### v1.4.1 修复（四六级题目看不到）
- [x] **题目与选项全程可见**：原来题目卡片被 phase 门控，不点「开始听力」屏幕上没有任何题目，
  等于「没有能让我选择的题」。现在四道题的选项从一开始就全部列出（真题里选项本就印在试卷上），
  可直接点选作答；点「开始听力」则按真题节奏走（播对话 → 逐题读题干 → 每题 15 秒）
- [x] **切换难度体系时清空练习页旧内容**：原来只改 `system`/`level`，旧对话（无题目数据）
  会被当成四六级内容渲染成空壳。现在切换即清空，旧内容仍可在「历史」里找回
- [x] **题干音频播放补上 `audio.src = url`**：否则题干只走到答题窗口、不出声
- [x] **已作答的题不再重开答题窗口**：用户可能在题干还没念完时就选了，音频结束后不该再给 15 秒
- [x] 练习页兜底：四六级模式下若内容是旧的（无题目数据），回退到普通对话并提示重新生成

## 进行中 / 待办
- [ ] **雅思听力尚未做成真实题型**：真实雅思听力是 4 个 Section / 40 题（S1 生活对话填空、
      S2 独白+地图题、S3 学术讨论、S4 学术讲座），题型含填空、匹配、地图标注。当前雅思走的是
      「双人对话 + 逐句精听」，只校准了难度，**没有还原题型**。要做需按四六级的方式新增一套题目类型
- [ ] **给 React 组件引入 DOM 测试环境**（jsdom + @testing-library/react）。
  当前 `CetPlayer` 的播放/答题流程没有真正的组件测试，只能靠 `tests/unit/cetPlayer.test.ts`
  里的「源码级不变量」兜底（能挡住漏设音频源、题目被门控这类问题，但挡不住时序类问题）
- [ ] **四六级语速调档未做**：真题四级 120–140 wpm、六级 140–160 wpm。1.4.2 已把区间写进规格，
  但**未实际调整 edge-tts 语速** —— 本机 edge-tts 连不上网络（合成返回空数据），实测不出真实 wpm，
  凭感觉调等于瞎调。需在能联网的环境实测后再定 rate
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

## 安全与隐私（分发前必看）

**API Key 不会随安装包分发。** 2026-09-18 用**本机真实的 Key** 对全部交付物做过全量字节搜索验证：

| 交付物 | 是否含真实 Key |
|---|---|
| `dist/Saltalk Setup 1.4.2.exe`（发给别人的就是这个） | **否**（0 命中） |
| `dist/win-unpacked/Saltalk.exe` | 否 |
| `dist/win-unpacked/resources/app.asar` | 否 |
| `out/**` 全部构建产物 | 否 |
| 源码 `src/`、`shared/`、`package.json` | 否 |

- 验证方法带**阳性/阴性对照**：拿 Key 去搜 `app.db` 自身命中 1（证明搜法有效），搜
  `package-lock.json` 命中 0（证明不会误报）
- `win-unpacked/Saltalk.exe` 里出现的 21 个 `sk-` 串是 **Skia 图形引擎的内部标识符**
  （`sk-box-image-repeat`、`sk-SampleMask-04357` 等），与 API Key 无关
- 交付物内**不存在** `app.db` / `.db-wal` / `.env` / `.sqlite` 等任何数据文件（asar 内也没有）
- 渲染层 `localStorage` 只存 `theme`，不存 Key

**数据实际存放位置：`%APPDATA%\nacl-english-listening\`**（注意不是 `Saltalk`）

- 原因：`app.getName()` 取的是 `package.json` 顶层的 `name`（`nacl-english-listening`），
  `productName: "Saltalk"` 写在 `build` 字段下、**不是顶层字段**，所以不生效
- 目录内含 `app.db`（Key、体系、音色、单词本、历史）、`audio/`（音频缓存）
- ⚠️ **不要把 `%APPDATA%\nacl-english-listening\` 整个打包发给别人** —— 那会连 API Key、
  单词本、历史一起发出去。别人装安装包得到的是**全新空库**，不需要任何清理
- ⚠️ 同理，直接分享 `app.db`（比如想共享单词本）也会泄露 API Key
- `clearAllData()`（设置页「清空所有数据」）**不会**清除 config，所以 Key 会保留 —— 这是刻意的，
  但如果哪天想让 Key 也清掉，要另外加逻辑

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
