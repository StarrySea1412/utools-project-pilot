# Seewrok · 迭代计划

> 基线：v1.1.0（已发布标签）+ 一轮未提交的界面迭代（图标系统 / 三视图仪表盘 / 工作台面板 / AI 今日建议）。
> 节奏：小步快跑，每个 minor 版本 1~2 周；优先级排序原则 = **稳定性 > 日常使用频次 > 锦上添花**。
> 工作量标记：S（半天内）/ M（1~2 天）/ L（3 天以上）。

---

## v1.1.1 · 收尾（进行中，0.5 天）

把工作区里攒着的一轮改动落库、发一个小版本。

| 事项 | 量 | 验收 |
|---|---|---|
| 跑 `npm run dev` 走查：卡片/紧凑/列表三视图切换、排序持久化、工作台面板子页签、AI 今日建议 JSON 渲染、`/` 聚焦搜索 | S | 三视图无布局错位，刷新后视图/排序/折叠状态保持 |
| 拆分提交：① lucide 图标系统迁移 ② 仪表盘三视图+排序 ③ 工作台面板合并+AI 今日建议 | S | 三个 commit，各自可独立回滚 |
| 补 `.gitattributes`（`* text=auto eol=lf`），消除全仓库 LF/CRLF 警告 | S | git diff 不再刷换行符警告 |
| plugin.json 升 1.1.1，`npm run build` 产物自测后打包 | S | uTools 内加载正常 |

## v1.2.0 · 工程化与数据安全（约 1 周）

主题：这个版本不加新功能，把「敢快速迭代」的地基打好。

| 事项 | 量 | 说明 |
|---|---|---|
| Vitest 单元测试 | M | 覆盖纯逻辑层：`advisor.js` 规则引擎各条建议的触发条件、store 排序/筛选、preload 的 git status/diff 解析函数（纯字符串处理可测） |
| GitHub Actions CI | S | push/PR 跑 `vitest + vite build`，产物存在性检查；防止「改崩了才发现」 |
| 数据导出 / 导入 | M | 项目列表、设置、待办、备忘一键导出 JSON → 从文件恢复；uTools `dbPut` 无云同步，这是用户换机唯一出路 |
| mock 契约防漂移 | S | 写一个单测：枚举 `window.pilot` 的方法名，逐一断言 `public/mock/utools-mock.js` 有对应实现（现在靠人肉同步，已经漂移过一次） |
| preload.js 拆模块 | M | 按命名空间拆成 `preload/git.cjs`、`preload/proc.cjs`、`preload/sys.cjs` 等再聚合，为后续 Git 功能铺路 |

**验收**：CI 绿；`npm test` 通过；导出→清库→导入后项目/待办/设置完整还原。

## v1.3.0 · Git 深水区（1~2 周）

主题：Git 工作台从「查看 + 提交」升级为「日常 Git 客户端」。v1.1 已对标 Git Graph 做了历史视图，这版补操作能力。

| 事项 | 量 | 说明 |
|---|---|---|
| 分支管理 | M | 切换 / 新建 / 删除分支，卡片与 Git 页显示当前分支可点击切换 |
| stash | S | 暂存 / 恢复 / 查看 stash 列表——切分支救急刚需 |
| 聚合变更总览 | M | 新增跨项目页：所有项目的未提交文件聚合列表，支持按项目批量提交；回答「我今天改了哪些东西」 |
| 单文件历史 + blame 视图 | M | 从变更列表的文件进入，看该文件的提交线和行级作者 |
| 冲突解决辅助 | L | 冲突文件标出 `<<<<<<<` 区块，支持「采用我 / 采用他们 / 跳到编辑器」 |

**验收**：不开 IDE / 命令行能完成一次完整的「切分支 → 改代码 → stash → 提交 → 推送」流程。

## v1.4.0 · AI 从建议到执行（1 周）

主题：v1.1 未提交改动里 `aiAdvice()` 已经输出结构化 `{text, level, project, action}`，这版把 `action` 真正接到操作上，AI 从「说」到「做」。

| 事项 | 量 | 说明 |
|---|---|---|
| 建议动作直达 | M | action 支持参数化：`{type:'run-script', projectId, scriptId}` 等，点击即执行/跳转，而不只是跳详情页 |
| 巡检自动化 | S | 打开插件时静默刷新一轮 git 态势 + 重新生成当日建议（有缓存按天复用）；失败任务/落后远程主动进通知中心 |
| AI 周报定时生成 | M | 结合自动任务：每周五把本周全部提交主题 + 变更量交给模型生成周报，存备忘或导出 md |
| AI 对话工作台（可选） | L | 工作台里加一个轻量对话入口，可就单个项目的态势追问；依赖流式输出（preload 已有 `stream`） |

**验收**：一条「落后远程」建议点击后直接完成 pull；周报一键生成可复制。

## v1.5.0 · 效率与个性化（1 周）

主题：高频使用者的顺手度。

| 事项 | 量 | 说明 |
|---|---|---|
| 命令面板 | M | `Ctrl+K` 模糊搜索：项目 / 脚本 / 页签 / 设置项，全键盘操作；符合 uTools 用户心智 |
| 项目置顶与拖拽排序 | S | 手动排序覆盖默认排序；置顶项目忽略排序规则 |
| 项目分组 | M | 标签升级为分组/文件夹，侧栏按组折叠（配合已有的标签筛选） |
| 活跃度热力图 | M | GitInsights 加 GitHub 风格贡献热力图（近 26 周，按项目或聚合） |
| 快捷键体系 | S | j/k 列表导航、Enter 打开、Esc 逐级返回；设置页快捷键说明卡片 |

## v2.0 · 远期探索（不定期）

- **数据同步**：WebDAV / 指定网盘目录同步导出文件，多机一致。
- **远程项目**：SSH 连到开发机列项目、跑脚本、看日志——量大，先做技术预研（uTools preload 对 ssh2 的兼容性）。
- **插件化能力**：把「领航建议」规则引擎开放自定义规则（用户写简单 JSON 条件），社区可共享规则包。

---

## 横切约束（每个版本都检查）

1. **双主题回归**：每个新界面浅色/深色都过一遍（浅色 chips 踩过坑）。
2. **mock 同步**：新增 preload API 必须同步 `utools-mock.js`，v1.2 起由契约测试兜底。
3. **降级可用**：`?flat` 模式和低配机器上不因 backdrop-filter 卡顿。
4. **性能红线**：项目数 ≥ 30 时仪表盘刷新不卡（必要时列表虚拟化）。
5. **AI 可选性**：所有 AI 功能在未配置 API 时优雅降级，不阻塞非 AI 功能。

## 风险与依赖

- uTools 插件机制限制后台常驻，「巡检自动化」只能在插件打开期间轮询——不要宣传为后台监控。
- AI 功能依赖用户自备 key，成本与隐私提示要在设置页写清。
- Git 操作（分支/stash/冲突）涉及写操作，preload 侧要做命令白名单与错误兜底，避免误伤用户仓库。

---

## v1.9.3 · 稳定性与轻量化（2026-10，已完成）

主题：一轮代码审查 + 同类产品调研（Raycast / Fork·Sublime Merge / Dockge·Uptime Kuma / Dev Home）后的修正版，不加新功能，把缺陷清掉、把常驻开销压到最低。

| 事项 | 说明 |
|---|---|
| git status rename 解析修正 | porcelain v2 重命名行 `2 R. … R100 <newPath>\t<origPath>` 旧实现把旧路径当 path、`renamed` 永远置不上；已修正并新增真实 git 仓库集成测试（tests/git-status.test.mjs） |
| mock 契约测试修复 | 旧正则抽取实际抽出 0 个方法名、防漂移形同虚设；改为 VM 加载 preload 全量比对（54 项，含 git./sys./fs. 命名空间） |
| 移除 tasklist 轮询 | 进程名/内存并入已有的 WMI 查询（WorkingSetSize）。实测 tasklist 单次 1.4~2.8s、每 30s 一次，是监控开销的 ~80%；合并后单次 ~0.65s，常驻开销约降 75% |
| 插件收起暂停监控 | onPluginOut 暂停端口/系统/git 轮询，onPluginEnter 恢复并即时刷新一轮；崩溃监测与自动任务保持运行 |
| 结束外部进程二次确认 | RuntimePanel 与 PortsModal 两击确认对齐 |
| 其余修正 | GitChanges 增量更新 gitCache（不再丢 lastCommitAt）；重启脚本回收上一轮进程日志；Git 子页签与待办视图切换补图标 |

### 下一步候选（按调研优先级）

1. **Git 深水区**（v1.3 遗留）：blame → 冲突辅助 → hunk 级暂存（成本递增）
2. **无 UI 看门进程**：独立小进程承载 24h 端口探活/自动任务/通知，UI 仍是 uTools 插件（桌面化路径 C）
3. **桌面版增强**：sys 轮询挪主进程（renderer 定时器被 Chromium 节流，托盘态监控不如主进程稳）；开机自启设置；代码签名

---

## v1.13.0 · 独立桌面版（2026-10，已完成）

主题：解压 → 双击 exe → 运行。同一套 dist 产物与 preload 桥接层，加一层 Electron 壳（约 280 行），渲染层与 Node 桥零改动复用。

| 事项 | 说明 |
|---|---|
| 架构 | desktop/main.cjs 主进程（窗口/托盘/热键/单实例）+ desktop/preload.cjs（window.utools shim + require 根 preload.js 挂 window.pilot）。mock 因 shim 先行注入自动失效；type:module 与 CommonJS 冲突以 .cjs 解决 |
| utools shim | 12 个方法：db 三件套 → userData JSON（同步 IPC 单通道 pilot-call）；对话框 → dialog.showXxxSync（同步变体完美映射 preload 的同步期望）；isDark → nativeTheme；通知/壳操作 → Electron 主进程；copyText → renderer clipboard；onPluginEnter/Out → 窗口 show/hide 事件（v1.9.3 收起暂停轮询免费生效）；getDragFilePaths → []（HTML5 拖拽 File.path 兜底） |
| 壳行为 | 980×640 与 pluginSetting 一致；关 X = 隐藏到托盘（真退出走托盘菜单）；全局热键 Alt+Shift+S；单实例锁聚焦；dist 缺失弹错误框 |
| 打包 | electron-builder zip（国内镜像 npmmirror）；files 只含 desktop/ + dist/ + preload.js + logo，产物 111MB |
| 验证 | 开发态与解压双击两路实测：窗口出现、UI 渲染（区域采样 492 色）、打包版 4 进程 377MB |
| 代价（已知） | Electron 税：解压 307MB / 常驻 ~380MB；无签名 SmartScreen 提示；隐藏 ≠ 24h 监控（与插件一致） |

---

## v1.12.0 · Changelog 生成（2026-10，已完成）

主题：调研清单的最后一项轻量功能。Git 分析页新增 Changelog 面板——选 tag 区间，AI 写 Release Notes。

| 事项 | 说明 |
|---|---|
| preload `git.tags` | `git tag --sort=-creatordate`，轻量/附注 tag 都收，带锚点 hash 供区间切片；mock 已同步（契约测试强制） |
| 区间语义 | 与 `git log from..to` 一致：(from, to] 左开右闭；from 空 = 从头，to 空 = 最新提交；from=to 单条；反选保护。列表新→旧方向上的切片实现（纯函数 pickRange，测试 7 用例覆盖） |
| AI 生成 | Conventional Commits 按 feat/fix/perf/… 分组排序给提示；输出面向使用者的分组 Release Notes；可填版本号；**AI 未配置/失败时离线兜底**：type 分组直接渲染，并提示错误原因 |
| 入口 | Git 页 → AI 分析子页内嵌 Changelog 面板（分析结果下方）；复制 / 保存 .md |
| 测试 | tests/changelog.test.mjs 12 用例：commitType 识别 / 分组排序 / merge 过滤 / 区间切片全语义 / 提示词 / 围栏解析 |

---

## v1.11.0 · 编辑器打开 + 项目归档（2026-10，已完成）

主题：调研清单里的两个高频小功能，把「建议可执行」闭环补全——建议引擎早就在说「考虑归档」，现在产品里真的有归档了。

| 事项 | 说明 |
|---|---|
| 用编辑器打开 | 右键菜单 / 详情页顶栏 / Ctrl+K 命令面板三个入口；自定义命令模板（`{path}` 占位）优先，留空自动探测 PATH（where.exe 探测 code 及 .cmd/.exe 扩展）；设置页可配置 + 「试一下」验证。新增 preload `openWithEditor` / `hasInPath`，mock 已同步（契约测试强制） |
| 项目归档 | 右键「归档项目」：移出仪表盘，Git 轮询 / 巡检 / 建议 / AI 上下文 / 跨项目变更 / 运行时面板全部排除，自动任务暂停；**数据全保留**（脚本/任务/备忘/配置），设置页「归档管理」一键恢复（恢复后浮到最近使用前列） |
| 纯逻辑 | 新增 src/editors.js（编辑器探测 + 命令模板，可测）；归档为 `proj.archived` 标记 + `activeProjects()`/`archivedProjects()` 选择器，全消费方贯通 |
| 测试 | tests/editors.test.mjs：命令模板 / 探测回退 / 归档往返 / 幂等 / lastOpened 补偿，共 12 用例 |

---

## v1.10.0 · 服务健康探测（2026-10，已完成）

主题：Uptime Kuma 验证过的差异化能力，且与「项目领航员」定位最契合——不只看见端口，还要知道服务活不活。

| 事项 | 说明 |
|---|---|
| preload `sys.probe` | 对 127.0.0.1 的 HTTP 开发端口发一次 GET /，收到任何响应头即存活（404 也算活着），测量首包延迟；2.5s 超时 |
| 上下线状态机 | 新增 src/health.js 纯函数 `serviceTransitions`：上一轮在、这一轮不在 = 下线（通知一次）；重启恢复自动清除标记。基线机制：插件收起恢复 / 休眠唤醒后的首轮扫描静默吞掉长间隔内的消失（不刷屏），服务再次上线后恢复正常检测 |
| 通知 | **外部启动的 dev server 停止响应 → 通知中心 + 系统通知**（内部脚本崩溃 v1.8.1 已由 procWatch 覆盖，此处只管外部服务）；空扫描（netstat 失灵）不产事件 |
| UI | 端口弹窗 / 运行时面板：HTTP 端口显示 `12ms`（绿）或「超时」（红），无数据时回退原静态圆点 |
| 测试 | tests/health.test.mjs（状态机 6 用例）+ tests/probe.test.mjs（真实 http server 集成 5 用例）；mock 契约自动覆盖 sys.probe |
