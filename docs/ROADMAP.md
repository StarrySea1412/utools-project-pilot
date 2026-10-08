# Seewrok · 迭代计划

> 基线：v1.15.0。2026-10-06 完成框架梳理（详见 [docs/ARCHITECTURE.md](./ARCHITECTURE.md)）：Node 桥拆为 8 个域模块、前端状态拆为 7 个领域模块 + 门面；同日新增「刷题领航」模块。
> 节奏：小步快跑，每个 minor 版本 1~2 周；优先级排序原则 = **稳定性 > 日常使用频次 > 锦上添花**。
> 工作量标记：S（半天内）/ M（1~2 天）/ L（3 天以上）。
> 架构约定：新 Node 能力进 `preload/<域>.cjs` 并在入口挂载；新领域状态进 `src/store/<域>.js` 并在 `src/store.js` 门面 re-export；任何结构变动同步 `docs/ARCHITECTURE.md`。

---

## v1.14.1 · 梳理收尾（0.5 天）

| 事项 | 量 | 说明 |
|---|---|---|
| ✅ 桌面版打包冒烟 | S | 2026-10-06 完成：`desktop:build` 产出 Seewrok-1.14.0-win.zip，asar 内确认含 preload.js + preload/ 八模块 + desktop/preload.cjs |
| ✅ 修复 sys-test 死脚本 | S | 2026-10-06 完成：`scripts/sys-test.cjs` 改用 VM 沙箱加载 preload（type:module 下普通 Node require 不了 CJS 的 preload.js——这正是原脚本死掉的原因），真机烟测通过（内存/CPU/45 端口+WMI 归属正常） |
| ✅ 浏览器桥漂移修复 | M | 2026-10-06 完成：pilot-bridge 缺失 v1.12~v1.14 的十来个方法（tags/fileLog/blameRaw/applyStaged/分支删除/stash×4/备份导入导出/openWithEditor/hasInPath/sys.probe），real-server 补齐路由（新增能力直接复用 preload/*.cjs，为 v1.16 打样）；新增 `tests/bridge-contract.test.mjs` 把三实现 API 面锁死（131 tests） |
| uTools 加载冒烟 | S | 待用户：uTools 开发者模式重载插件，过一遍仪表盘 / Git / 服务控制台 |

## v1.15.0 · 刷题领航（✅ 2026-10-06 已实现）

主题：把面试刷题计划长进日常工具——学习载体即产品功能（与 Docker 桥同一模式）。

| 事项 | 量 | 说明 |
|---|---|---|
| ✅ 题库数据 `src/algo/bank.js` | S | LeetCode 热题 100 口径整 100 题、14 分类（哈希/双指针/滑动窗口/链表/二叉树/DP…），slug 指向 leetcode.cn，数据表可自行维护 |
| ✅ 领域模块 `src/store/algo.js` | M | 进度 / 重做队列 / 每日打卡 log 持久化（`pilot:algo`）；纯逻辑直测：连续 streak（今天没刷不断签）、每日推荐（同日稳定 + 重做优先占半 + 分类轮转保证覆盖）、分类统计——15 个新单测 |
| ✅ 工作台「刷题」页签 | M | 今日推荐卡（配额 + 打卡火焰）、分类进度 chips（点击筛选）、题库清单（完成/重做/笔记/跳转 LeetCode） |
| ✅ 回归 | S | 146 tests / 16 files 全绿；未新增 `window.pilot` 方法，双契约测试不受影响 |

**验收（达成）**：每日打开工作台即见今日题与连击；完成标记持久化；重做队列构成隔日复习流。

## v1.16.0 · Docker 桥（1~2 周）

主题：服务控制台从「本机进程」长到「容器」。**这版同时是 Docker 学习的载体**——docker.cjs 怎么设计、容器怎么归属到项目，学了就用。

| 事项 | 量 | 说明 |
|---|---|---|
| `preload/docker.cjs` | M | `docker ps --format` 列容器 / logs / start / stop / inspect；容器 → 项目归属沿用 sysmon 的思路（binds 挂载路径 / compose 项目 label / 镜像名匹配） |
| 服务面板容器页签 | M | Dockge 式列表：容器名 / 镜像 / 状态 / 端口映射，启停按钮，日志抽屉复用 ConsoleDrawer |
| compose 项目识别 | S | 项目根有 `docker-compose.yml` → 卡片挂徽标，详情页一键 up / down |
| mock 降级 | S | 浏览器 mock 补假容器数据；无 Docker 环境（或命令不存在）UI 自动隐藏，不报错 |

**验收**：无 Docker 时零感知；有 Docker 时容器可见、可控、日志可看；归属正确（哪个项目跑着哪个容器）。

## v1.17.0 · 消除双实现（1 周）

主题：`scripts/real-server.mjs` 至今手工镜像了 preload 的全部解析逻辑（git porcelain / 端口 / 进程），两份代码必然漂移。Node 桥拆成 `.cjs` 后，ESM 侧可用 `createRequire` 直接复用。

| 事项 | 量 | 说明 |
|---|---|---|
| real-server 复用 preload/*.cjs | M | `/api/*` 只留 HTTP 壳，解析与执行全部转发到 `preload/` 模块。**v1.14.1 已打样**：git 深水区 10 个 op 与 sys.probe 已走 createRequire 复用，剩 status/diff/log/branches 等旧 op 与 sys/proc/fs 域待迁移 |
| 解析单一来源守卫 | S | grep 断言（CI）：porcelain v2 / netstat 解析函数在仓库中只存在一份 |

**验收**：`npm run dev:real` 浏览器全功能走查不回归；重复实现清零。

## v1.18.0+ · 远景池（不承诺时间）

- **远程主机探针**：SSH 采集远端端口 / 服务 / 容器，归属协议与本地一致——这份「哪个项目跑着什么服务」的 JSON 协议就是 hermes-director-studio（机群可视化）的单机版对接点。
- **uTools 插件市场上架**：截图 / GIF / 关键词 / 隐私说明。
- **性能纵深**：收起暂停轮询已有；下一步考虑 Git 轮询增量（只刷脏项目）与端口扫描节流。
