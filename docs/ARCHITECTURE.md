# Seewrok · 架构一页纸与框架梳理规划

> 基线：v1.14.0（9ccd6ec），129 tests / 14 files 全绿，`vite build` 干净。
> 定稿：2026-10-06。
> 一句话定位：**三端同构的本地项目领航台**——同一套 Vue 渲染层 + 同一个 `window.pilot` API 面，跑在 uTools、Electron 桌面版、浏览器三个宿主里。

---

## 一、架构一页纸（现状）

### 1.1 三端桥数据流

```
┌─────────────────────────────────────────────────────────────┐
│                      渲染层（三端完全同一套）                   │
│   src/App.vue + components/ + store.js（Vue3 reactive 单向流） │
└──────────────────────────┬──────────────────────────────────┘
                           │ window.pilot.*（唯一 API 面，mock-contract 测试守门）
        ┌──────────────────┼──────────────────────┐
        ▼                  ▼                      ▼
┌───────────────┐  ┌────────────────┐  ┌─────────────────────┐
│  uTools 宿主   │  │ Electron 桌面版 │  │  浏览器（开发预览）    │
│  preload.js   │  │ desktop/       │  │  30081: mock shim    │
│  （Node 桥）   │  │  main.cjs      │  │  30082: real-server  │
│               │  │  preload.cjs   │  │  scripts/real-server │
│               │  │  （utools shim │  │  .mjs（/api/* 代理）  │
│               │  │   + require    │  │                      │
│               │  │   根 preload） │  │                      │
└───────┬───────┘  └───────┬────────┘  └──────────┬──────────┘
        ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│         操作系统：git / 进程 spawn / fs / netstat+PS / HTTP    │
└─────────────────────────────────────────────────────────────┘
```

**设计要点**：新宿主 = 新写一个 shim 挂 `window.pilot`，渲染层零改动（v1.13.0 桌面版验证了这条路：`desktop/preload.cjs` 只实现 utools shim + require 根 preload，渲染层与 Node 桥一行没改）。

**API 面三实现，双契约测试守门**：`window.pilot` 有三份实现——preload.js（uTools/桌面版）、`public/mock/utools-mock.js`（浏览器 mock）、`scripts/pilot-bridge.js`（浏览器真数据）。`tests/mock-contract.test.mjs` 守前两者、`tests/bridge-contract.test.mjs` 守 bridge ↔ preload，任何一侧加减方法都会在 CI 红掉（bridge 曾在 v1.12~v1.14 期间漂移，v1.14.1 补齐后加锁）。

### 1.2 渲染层模块职责（src/）

| 模块 | 职责 |
|---|---|
| `store.js` | Vue reactive 全局状态 + 持久化 + 全部领域动作（**772 行，待拆**） |
| `advisor.js` | 领航建议规则引擎（纯函数，有单测） |
| `ports.js` | 端口业务归类 / 服务名识别 / 路径归属（纯函数，有单测） |
| `health.js` | 服务上下线状态机（纯函数，有单测） |
| `git-deep.js` | blame/冲突/hunk 解析（纯函数，有单测） |
| `git-graph.js` | 提交拓扑分道（纯函数） |
| `changelog.js` | Changelog 生成（纯函数，有单测） |
| `editors.js` / `explore.js` | 编辑器模板 / 探索模式评估（有单测） |
| `ui.js` / `components/` / `modals/` | 视图与交互 |

### 1.3 Node 桥职责（preload.js，**827 行单文件，待拆**）

按源码段落：`runCmd/cut` 工具 → Git（14 个函数）→ 进程/脚本 → 文件 → AI → 系统监测（内存/CPU/端口/探活）→ `window.pilot` 挂载（含 db 兼容、对话框、identify）。

---

## 二、为什么要梳理（2026-10 体检结论）

1. **功能长快于骨架**：功能迭代到 v1.14.0（Git 深水区、服务归属、AI 周报），但 `preload.js` 还是 v1.1 时代的单文件；`store.js` 里状态、持久化、进程、调度、Git 刷新、系统监控 30+ 个导出混居一屋。
2. **ROADMAP 自己早就开了药方**：v1.2.0 就写了「preload.js 拆模块……为后续 Git 功能铺路」，一直欠着。
3. **安全网正好齐备**：14 个测试文件（含真实 git 仓库集成测试、mock 契约测试）+ CI。**重构窗口期就是现在**——测试再欠两年，这活就没人敢干了。
4. **下一步功能的地基**：v1.15+ 要接 Docker（见第五节），`docker.cjs` 得有干净的命名空间可挂。

---

## 三、目标结构

### 3.1 preload 拆分：1 入口 + 8 模块

```
preload.js            # 只剩一件事：require 各模块 + 挂载 window.pilot（~60 行）
preload/
  env.cjs             # isWin / MAX_BUF / cut / runCmd / shellArgs（所有人共用的底座）
  git.cjs             # 全部 git 函数，导出就绪的 gitApi 对象
  proc.cjs            # procs 注册表 / runScript / stopProc / runOnce / killPid；导出 listActiveInternal()
  fs.cjs              # listDir / isTextFile / readText / writeText…，导出 fsApi
  ai.cjs              # aiChat（OpenAI 兼容）
  sys.cjs             # memory / cpu / self / ports / probe；依赖 proc.listActiveInternal 做内部脚本归属
  identify.cjs        # logo 探测 + 技术栈识别
  utools.cjs          # db 兼容 / 对话框 / shell 打开 / 通知 / 终端 / PATH 探测（uTools API 封装层）
```

**依赖规则（单向，禁止环）**：

```
env  ←  git / proc / fs / ai / sys / identify / utools
proc  →  sys（sys 需要内部脚本注册表做端口归属，仅此一条跨域依赖）
```

**四条硬约束**（摸底时确认的坑，逐条对应验收）：

| # | 约束 | 原因 |
|---|---|---|
| 1 | 拆分文件一律 `.cjs` | `package.json` 是 `"type": "module"`；Electron/uTools 的 preload 走 CJS require，`.js` 相对引用会撞 ERR_REQUIRE_ESM，`.cjs` 永远安全 |
| 2 | `window.pilot` API 面一个都不能变 | mock-contract 测试全量比对 preload 与 mock 的方法树，它是守门员 |
| 3 | electron-builder `files` 数组必须加 `"preload/**/*"` | 现在只打包 `preload.js`；漏了这条，桌面版 zip 里 Node 桥直接残废 |
| 4 | 3 个 VM 测试的沙箱 `require` 要把相对路径解析到项目根 | `git-status / probe / mock-contract` 用 `createRequire(import.meta.url)` 从 tests/ 目录解析，拆分后 `require('./preload/git.cjs')` 会找去 `tests/preload/` |

### 3.2 store 拆分：state + 6 领域模块 + 门面

`src/store.js` 变成**纯 re-export 门面**（`export * from …`），几十个组件的 `import { store, xxx } from './store.js'` 一行不改。

```
src/store.js            # 门面：只 re-export，不写逻辑
src/store/
  state.js              # reactive 根 + DEFAULT_SETTINGS + load() + saveProjects/saveSettings + activeProject(s)
  projects.js           # 增删 / 归档 / 置顶 / sortProjects（仪表盘域）
  workspace.js          # 待办四象限 + 通知中心（工作台域）
  procs.js              # 脚本启停 / 日志接管 / 崩溃监测 + 自动任务调度（进程域）
  gitsync.js            # checkGit / refreshAllGit / 静默巡检 patrolOnce（Git 态势域）
  sysmon.js             # 系统轮询 / 服务健康探测 / 端口归属（matchProjectForPort / projectServices / portProject）
  ai.js                 # ai() / genCommitMessage / analyzeHistory / saveAiAdvice / saveExplore
```

**依赖规则**：`state ← 所有`；`workspace ← procs / gitsync / sysmon`（通知）；`sysmon → gitsync`（`isBgPaused()` 导出为函数，不共享裸变量）。两个 Vue 已知雷（档案在案）：reactive 缓存必须先判空取代理再写入；拆分不改变任何 reactive 引用结构。

### 3.3 执行顺序与安全网

| 步骤 | 内容 | 验收 |
|---|---|---|
| 0 | 基线：`npm test` + `npm run build` 全绿 | ✅ 已完成（129/129） |
| 1 | preload 拆分（含约束 1/3/4 的三处配套修改） | `npm test` 全绿；`npm run build`；`git diff` 里 `window.pilot` 挂载面逐键比对 |
| 2 | store 拆分 | `npm test` 全绿（store.test/sort.test/services.test 直测领域函数，天然回归） |
| 3 | ROADMAP 重写（v1.14.0 基线 + Docker 桥入计划） | 文档评审 |
| 4 | README 修正 + 链接本文档 | 目视 |

每步一个独立 commit，出问题单步回滚。**不做的事**：不改任何功能、不动 mock/real-server 的 API、不顺手“优化”逻辑——梳理期间逻辑漂移等于埋雷。

---

## 四、框架梳理 × 个人能力提升的映射

1. **在测试保护下做结构性重构**——先读测试、再动代码、每步全量回归。这是后端/任何工程岗的核心日常，语言无关。
2. **边界划分 = 服务分层的思维预演**：`env 底座 / 领域模块 / 门面` 与后端的 `middleware / service / controller` 同构；「依赖单向、跨域只留一条显式通道」就是后端说的依赖方向治理。
3. **模块化是给 Docker 桥腾地基**（见下节）——学 Docker/K8s 不去刷课，而是让学习直接变成功能。

---

## 五、下一步：Docker 桥（v1.15+ 展望，本档不动工）

拆分完成后，Node 桥加一个 `preload/docker.cjs` 就是顺手的事：

1. **v1.15 · 容器控制台**：`docker ps / logs / start / stop` 进服务面板，Dockge 式 UI 已有先例（本插件的服务控制台就是对标它做的）；用户机器上 Docker Desktop + WSL2 现成，学习载体即产品功能。
2. **v1.16 · 消除双实现**：`scripts/real-server.mjs` 目前手工镜像了 preload 的全部能力；拆成 `.cjs` 后 real-server 可用 `createRequire` 直接复用 `preload/*.cjs`，`/api/*` 只做 HTTP 壳。
3. **远景 · 对接 director-studio**：端口/服务/容器归属协议（本插件已在做的「哪个项目跑着什么服务」）正是机群可视化 Agent 的单机版——这里打磨的识别与归属逻辑，直接喂给那个天花板更高的项目。
