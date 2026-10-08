// store.js — 门面（纯 re-export，不写逻辑）
// 2026-10 拆分：原 772 行单文件按领域拆到 src/store/，组件侧 import 路径与导出面保持不变。
// 模块职责与依赖方向见 docs/ARCHITECTURE.md。
export * from './store/state.js';
export * from './store/projects.js';
export * from './store/workspace.js';
export * from './store/ai.js';
export * from './store/procs.js';
export * from './store/gitsync.js';
export * from './store/sysmon.js';
export * from './store/backup.js';
export * from './store/algo.js';
export * from './store/doctor.js';
