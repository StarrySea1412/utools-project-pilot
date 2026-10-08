// preload.js — Seewrok
// Node 桥接层入口：只做两件事——聚合 preload/ 各域模块 + 挂载 window.pilot。
// 模块职责与依赖方向见 docs/ARCHITECTURE.md；API 面由 tests/mock-contract.test.mjs 守门，
// 三端（uTools / Electron desktop / 浏览器桥）共用本入口。
const os = require('os');
const env = require('./preload/env.cjs');
const { gitApi } = require('./preload/git.cjs');
const proc = require('./preload/proc.cjs');
const { fsApi } = require('./preload/fs.cjs');
const { aiChat } = require('./preload/ai.cjs');
const { sysApi } = require('./preload/sys.cjs');
const { identify } = require('./preload/identify.cjs');
const utools = require('./preload/utools.cjs');

if (typeof window !== 'undefined') {
  window.pilot = {
    platform: process.platform,
    home: os.homedir(),
    // db / dialogs / shell
    dbGet: utools.dbGet,
    dbPut: utools.dbPut,
    selectFolder: utools.selectFolder,
    exportJson: utools.exportJson,
    importJson: utools.importJson,
    openPath: utools.openPath,
    showItemInFolder: utools.showItemInFolder,
    openInBrowser: utools.openInBrowser,
    copyText: utools.copyText,
    notify: utools.notify,
    isDark: utools.isDark,
    openTerminal: utools.openTerminal,
    openWithEditor: utools.openWithEditor,
    hasInPath: utools.hasInPath,
    // git
    git: gitApi,
    // process
    runScript: proc.runScript,
    stopProc: proc.stopProc,
    runOnce: proc.runOnce,
    getProc: proc.getProc,
    onProcOutput: proc.onProcOutput,
    killPid: proc.killPid,
    // fs
    fs: fsApi,
    // ai
    aiChat,
    // 项目身份识别：logo 图标（dataURL）+ 技术栈
    identify,
    // system monitor
    sys: sysApi,
    // misc
    defaultCommitPrompt: '你是资深工程师。根据我提供的 git 暂存区变更，生成一条简洁规范的中文 commit message，遵循 Conventional Commits（如 feat/fix/docs/refactor/perf/chore/test(scope): 描述）。只输出消息本身，不要任何解释、代码块或引号，50 字以内。',
  };
}
