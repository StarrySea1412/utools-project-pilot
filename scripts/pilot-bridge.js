// pilot-bridge.js — 浏览器「真数据」桥接层（由 real-server.mjs 注入，替代 mock）
// 实现 window.pilot 与 preload.js 相同的接口：同步方法走阻塞 XHR，异步方法走 fetch。
(() => {
  if (window.__pilotBridge) return;
  window.__pilotBridge = true;

  // 同步 XHR（仅启动期与少量同步接口使用）
  const xhr = (method, url, body) => {
    const x = new XMLHttpRequest();
    x.open(method, url, false);
    if (body != null) x.setRequestHeader('Content-Type', 'application/json');
    x.send(body == null ? null : JSON.stringify(body));
    if (x.status !== 200) throw new Error(`桥接请求失败 ${x.status}: ${url}`);
    return x.responseText ? JSON.parse(x.responseText) : null;
  };
  const post = (url, body) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
  }).then(async (r) => {
    const t = await r.text();
    const j = t ? JSON.parse(t) : null;
    if (!r.ok) throw new Error((j && j.message) || t || r.statusText);
    return j;
  });
  const shell = (op, arg) => { fetch('/api/shell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, arg }) }).catch(() => {}); };

  const meta = xhr('GET', '/api/meta');

  // ---------- db（启动时同步拉取，之后写穿透） ----------
  let db = xhr('GET', '/api/db') || {};

  // ---------- 系统监测（同步缓存 + 后台刷新） ----------
  let fast = xhr('GET', '/api/sys/fast') || { memory: null, cpu: null };
  const refreshFast = () => fetch('/api/sys/fast').then((r) => r.json()).then((j) => { fast = j; }).catch(() => {});
  setInterval(refreshFast, 3000);

  window.pilot = {
    platform: meta.platform,
    home: meta.home,
    dbGet(key) { return key in db ? db[key] : null; },
    dbPut(key, value) { db[key] = value; fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) }).catch(() => {}); },

    // ---------- 对话框 / shell ----------
    selectFolder() {
      const p = window.prompt('输入要添加的项目文件夹完整路径\n（例如 D:\\project\\foo）', 'D:\\project');
      const t = p && p.trim();
      return t ? [t.replace(/\\/g, '/').replace(/\/+$/, '')] : [];
    },
    openPath(p) { shell('openPath', p); return null; },
    showItemInFolder(p) { shell('showItemInFolder', p); },
    openInBrowser(url) { shell('openInBrowser', url); },
    copyText(t) { shell('copyText', t); },
    notify(body) { shell('notify', body); },
    isDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; },
    openTerminal(cwd) { shell('openTerminal', cwd); },
    killPid: (pid) => post('/api/shell', { op: 'killPid', arg: pid }),

    // ---------- git ----------
    git: {
      status: (cwd) => post('/api/git/status', { cwd }),
      diffFile: (cwd, file, staged) => post('/api/git/diffFile', { cwd, file, staged }),
      log: (cwd, n) => post('/api/git/log', { cwd, n }),
      branches: (cwd) => post('/api/git/branches', { cwd }),
      stage: (cwd, files) => post('/api/git/stage', { cwd, files }),
      unstage: (cwd, files) => post('/api/git/unstage', { cwd, files }),
      discard: (cwd, files) => post('/api/git/discard', { cwd, files }),
      discardUntracked: (cwd, files) => post('/api/git/discardUntracked', { cwd, files }),
      commit: (cwd, message) => post('/api/git/commit', { cwd, message }),
      push: (cwd) => post('/api/git/push', { cwd }),
      pull: (cwd) => post('/api/git/pull', { cwd }),
      fetch: (cwd) => post('/api/git/fetch', { cwd }),
      hasRemote: (cwd) => post('/api/git/hasRemote', { cwd }),
      commitBranches: (cwd, limit) => post('/api/git/commitBranches', { cwd, limit }),
      checkout: (cwd, ref) => post('/api/git/checkout', { cwd, ref }),
      commitFileNames: (cwd, hash) => post('/api/git/commitFileNames', { cwd, hash }),
    },

    // ---------- 进程/脚本 ----------
    runScript(cwd, script) {
      try { return xhr('POST', '/api/proc/start', { cwd, script }); }
      catch (e) { return { id: 'err', running: false }; }
    },
    stopProc: (id) => post(`/api/proc/${encodeURIComponent(id)}/stop`),
    runOnce: (cwd, cmd, timeoutMs) => post('/api/run-once', { cwd, cmd, timeoutMs }),
    getProc(id) {
      try { return xhr('GET', `/api/proc/${encodeURIComponent(id)}`); }
      catch (e) { return null; }
    },
    onProcOutput(id, cb) {
      let sent = '';
      const timer = setInterval(async () => {
        try {
          const r = await fetch(`/api/proc/${encodeURIComponent(id)}`);
          if (!r.ok) { clearInterval(timer); return; }
          const j = await r.json();
          if (j.out.length > sent.length) { const add = j.out.slice(sent.length); sent = j.out; cb(add); }
          if (!j.running && j.out.length <= sent.length) clearInterval(timer);
        } catch (e) { clearInterval(timer); }
      }, 400);
    },

    // ---------- fs ----------
    fs: {
      listDir: (dir) => post('/api/fs/listDir', { args: [dir] }),
      isTextFile(name) {
        const m = /\.(md|json|js|mjs|cjs|ts|jsx|tsx|css|scss|less|vue|html|htm|txt|py|go|rs|java|c|h|cpp|sh|ya?ml|toml|ini|cfg|conf|env|xml|sql|log|gitignore|editorconfig|lock|bat|ps1|dart|kt|swift|rb|php)$/i;
        return m.test(name) || !/\.[^.\\/]+$/.test(name);
      },
      readText: (file) => post('/api/fs/readText', { args: [file] }),
      writeText: (file, content) => post('/api/fs/writeText', { args: [file, content] }),
      mkdir: (dir) => post('/api/fs/mkdir', { args: [dir] }),
      rm: (p) => post('/api/fs/rm', { args: [p] }),
      rename: (a, b) => post('/api/fs/rename', { args: [a, b] }),
      exists: (p) => post('/api/fs/exists', { args: [p] }),
    },

    // ---------- AI ----------
    aiChat: (cfg) => post('/api/ai', cfg),

    // ---------- 项目身份识别 ----------
    identify: (p) => post('/api/ident', { args: [p] }),

    // ---------- 系统监测 ----------
    sys: {
      memory() { return fast.memory; },
      cpu() { return fast.cpu; },
      self() { return fast.self || null; },
      ports: () => post('/api/sys/ports'),
    },

    defaultCommitPrompt: '你是资深工程师。根据我提供的 git 暂存区变更，生成一条简洁规范的中文 commit message，遵循 Conventional Commits（如 feat/fix/docs/refactor/perf/chore/test(scope): 描述）。只输出消息本身，不要任何解释、代码块或引号，50 字以内。',
  };

  console.log('[pilot-bridge] 真数据桥接已挂载 → /api（real-server.mjs）');
})();
