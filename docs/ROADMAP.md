# Seewrok · 迭代计划

> 基线：v1.16.0。2026-10-08 完成两连发：**v1.15.0** 框架梳理落地（Node 桥 8 模块 + store 门面）+ 刷题领航；**v1.16.0** 把 AI 从「文本生成器」升级为「体检 Agent」——确定性采集 + 结构化报告。
> 节奏：小步快跑，1~2 周一个 minor；优先级 **稳定性 > 个性化诊断 > 锦上添花**。
> 工作量标记：S（半天内）/ M（1~2 天）/ L（3 天以上）。
> 架构约定：新 Node 能力进 `preload/<域>.cjs` 并在入口挂载 + 同步三实现（real-server/pilot-bridge/mock）+ 双契约测试锁死；新领域状态进 `src/store/<域>.js`；结构变动同步 `docs/ARCHITECTURE.md`。

---

## v1.16.0 · 项目体检 Agent（✅ 2026-10-08 已实现）

主题：AI 不再是「生成文字的工具」，而是**读得懂项目、说得清优先级**的诊断入口。

| 事项 | 量 | 说明 |
|---|---|---|
| ✅ `preload/inspect.cjs` 体检采集域 | M | 五路硬数据：依赖（`npm audit --package-lock-only` 不装包 / `outdated` 只在装了 node_modules 时跑）/ TODO+FIXME+HACK 全量扫描 / 文档新鲜度 + LICENSE/CHANGELOG / 测试文件计数 + test 脚本 / Git 卫生（复用 git.cjs，不复制 porcelain）。npm 走 shell（npm.cmd），audit/outdated 解耦 |
| ✅ `src/doctor.js` 规则评分 + 报告解析 | M | 五维各 0~25（依赖健康 / 代码债 / 测试保障 / 文档 / Git 卫生）+ 离线兜底 items；`parseDoctorJson` 防御式解析（围栏剥离 / score 钳制 / severity 降序 / 非法值回默认） |
| ✅ 项目新增「体检」页签 | S | Detail.vue 第 8 页签（第一个项目级 agent 入口）；评分环 + 维度条 + 改进清单（severity/effort 双标签），AI 结果按天缓存（`store/doctor.js`） |
| ✅ 三实现同步 + 双契约 | S | real-server 经 createRequire 复用 preload/inspect.cjs（**第三个打样点**，head 段 sticker 兑现）；pilot-bridge 与 mock 对齐（mock 返回带漏洞/TODO/文档缺项的演示数据）；bridge-contract + mock-contract 双锁 |

**验收（达成）**：没 AI 也能跑（offline-first）；真实样例（本项目自身）→ 依赖健康 0/25（26 漏洞）、总分 73「良好」、改进项按严重度排序；一键转待办入口预留。

## v1.17.0 · 体检项闭环（行动级）

主题：从「看诊」（体检报告）到「治病」（agent 动手修）。Report → Action。

| 事项 | 量 | 说明 |
|---|---|---|
| 改进项 playbook | M | 内置 4 类可执行：①修复依赖漏洞 → `npm audit fix` → 跑 `npm test` → 展示 diff 确认 → 提交；②清点 TODO → 列出全部污点 → 逐个标记清理/忽略；③补 README/CHANGELOG 骨架模板；④git 提交提示助记。共用执行管线 `preload/playbook.cjs` |
| 执行确认门 | S | dry-run 预览所有 step → 用户一键批准 → 执行后校验（diff/test 不过则回滚报告）；每个 step 日志留痕 |
| `ai.cjs` 升级 | S | 支持 tool_calls 与 JSON mode（`response_format: {type:'json_object'}`），为 agent 接管工具做准备 |

**验收**：「修复依赖漏洞」一条命令走完从扫描到提交的闭环，全程只需确认两次（plan 确认 + diff 确认）。

## v1.18.0 · Docker 桥 + agent 感知面扩容

主题：服务控制台从「本机进程」长到「容器」，同时把 docker.cjs 并到 agent 的感知面（叙事复用）。

| 事项 | 量 | 说明 |
|---|---|---|
| `preload/docker.cjs` | M | `docker ps --format` / logs / start / stop / inspect；容器 → 项目归属沿用 sysmon 思路（binds / compose label / 镜像名） |
| 服务面板容器页签 | M | Dockge 式列表 + 日志抽屉复用 ConsoleDrawer；compose 项目根有 `docker-compose.yml` → 一键 up/down |
| 体检对接 | S | 容器脱离项目根也提示（「镜像挂了但项目没有对应启动脚本」）；与体检报告维度对齐 |
| mock 降级 | S | 浏览器 mock 补假容器数据；无 Docker 环境 UI 隐藏不报错 |

## v1.19.0 · 消除双实现（收尾）

主题：real-server.mjs 只剩 HTTP 壳；重复解析清零。

| 事项 | 量 | 说明 |
|---|---|---|
| real-server 全量复用 preload/*.cjs | M | 只剩 `/api/proc/*`（进程注册表）与 `/api/db` 自有；解析单一来源 CI 守卫已经有（v1.16.0 起） |

## 远景池（不承诺时间）

- **远程主机探针**：SSH 采集远端服务/容器，对接 hermes-director-studio 机群可视化的单机版入口
- **远程 agent 执行**：体检 playbook 经 SSH 落到远端（安全性决定这个必须排在远程探针成熟之后）
- **uTools 市场上架**：截图/GIF/关键词/隐私说明；等体检 + 行动 agent 跑顺再上
- **性能纵深**：收起暂停轮询已有；下一步看 Git 增量轮询（只刷脏项目）
