// mock/utools-mock.js — 仅用于浏览器预览；在 uTools 内（window.utools 已存在）自动不生效
(() => {
  if (window.utools) return;

  // ---------- 内存 DB ----------
  const seedProjects = [
    {
      id: 'prj_demo1', name: 'axonhub', path: 'D:/demo/axonhub', tags: ['tool', 'dev'], color: 0,
      notes: '# axonhub\n\n- 启动前先启动 redis\n- 数据库迁移: npm run migrate',
      scripts: [
        { id: 'sc_1', name: 'start', cmd: 'npm run start', persistent: true },
        { id: 'sc_2', name: 'stop', cmd: 'taskkill /f /im node.exe', persistent: false },
        { id: 'sc_3', name: 'upgrade', cmd: 'npm run upgrade', persistent: false },
      ],
      tasks: [
        { id: 'tk_1', name: '每日拉取更新', cmd: 'git pull --rebase', type: 'daily', atTime: '09:00', everyMinutes: 60, enabled: true, lastRun: Date.now() - 3600e3, log: [{ time: Date.now() - 3600e3, ok: true, output: 'Already up to date.' }] },
      ],
      createdAt: Date.now() - 20 * 864e5, lastOpened: Date.now() - 18 * 36e5,
    },
    {
      id: 'prj_demo2', name: 'utools-project-pilot', path: 'D:/demo/utools-project-pilot', tags: ['utools'], color: 1,
      notes: '', scripts: [
        { id: 'sc_4', name: 'build', cmd: 'npm run build', persistent: false },
        { id: 'sc_5', name: 'dev', cmd: 'npm run dev', persistent: false },
        { id: 'sc_6', name: 'preview', cmd: 'npm run preview', persistent: false },
      ], tasks: [], createdAt: Date.now() - 5 * 864e5, lastOpened: Date.now() - 5 * 36e5,
    },
    {
      id: 'prj_demo3', name: 'ai-learning-platform', path: 'D:/demo/ai-learning-platform', tags: ['dev'], color: 3,
      notes: '', scripts: [
        { id: 'sc_7', name: 'front:dev', cmd: 'npm run dev --workspace=web', persistent: true },
        { id: 'sc_8', name: 'back:run', cmd: 'python manage.py runserver', persistent: true },
      ], tasks: [], createdAt: Date.now() - 30 * 864e5, lastOpened: Date.now() - 2 * 864e5,
    },
    {
      id: 'prj_demo4', name: 'smart-gallery', path: 'D:/demo/smart-gallery', tags: ['color'], color: 2,
      notes: '', scripts: [{ id: 'sc_9', name: 'build', cmd: 'npm run build', persistent: false }], tasks: [],
      createdAt: Date.now() - 60 * 864e5, lastOpened: Date.now() - 8 * 864e5,
    },
    {
      id: 'prj_demo5', name: 'latex-notes', path: 'D:/demo/latex-notes', tags: ['dev'], color: 4,
      notes: '', scripts: [{ id: 'sc_10', name: 'build', cmd: 'make' }], tasks: [],
      createdAt: Date.now() - 90 * 864e5, lastOpened: Date.now() - 8 * 864e5,
    },
  ];

  const fakeStatuses = {
    'prj_demo1': {
      branch: 'master', upstream: 'origin/master', ahead: 1, behind: 0, detached: false,
      stagedCount: 2, unstagedCount: 2, untrackedCount: 1, dirty: 5,
      entries: [
        { x: 'M', y: 'M', path: 'src/renderer/git/GitView.tsx' },
        { x: 'M', y: '.', path: 'src/renderer/App.tsx' },
        { x: '.', y: 'M', path: 'src/main/ipc/git.ts' },
        { x: '.', y: 'D', path: 'src/renderer/legacy.js' },
        { x: '?', y: '?', path: 'docs/notes.md', untracked: true },
      ],
    },
    'prj_demo2': { branch: 'main', upstream: '', ahead: 0, behind: 0, detached: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, dirty: 0, entries: [] },
    'prj_demo3': { branch: 'feat/gallery-ui', upstream: 'origin/feat/gallery-ui', ahead: 0, behind: 2, detached: false, stagedCount: 1, unstagedCount: 0, untrackedCount: 0, dirty: 1, entries: [{ x: 'A', y: '.', path: 'src/components/GlassCard.vue' }] },
    'prj_demo4': { branch: 'dev', upstream: 'origin/dev', ahead: 0, behind: 0, detached: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, dirty: 0, entries: [] },
    'prj_demo5': { branch: 'master', upstream: '', ahead: 0, behind: 0, detached: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, dirty: 0, entries: [] },
  };

  const fakeLog = [
    { hash: 'f501e9c1', short: 'f501e9c', author: 'wyxa', date: new Date(Date.now() - 5 * 36e5).toISOString(), subject: 'chore: record journal', body: '' },
    { hash: '3946918a', short: '3946918', author: 'wyxa', date: new Date(Date.now() - 5 * 36e5).toISOString(), subject: 'chore(task): archive 08-07-plugin-cold-start-perf', body: '' },
    { hash: 'e84517af', short: 'e84517a', author: 'wyxa', date: new Date(Date.now() - 6 * 36e5).toISOString(), subject: 'perf(startup): 优化插件冷启动首帧', body: '- 增加 preload、renderer、首帧和项目加载阶段计时\n- 首帧先显示 Dashboard 骨架，再挂载项目卡片\n- 将路径检查和自动化计划重试移到首帧后并补回归测试' },
    { hash: '920132ab', short: '920132a', author: 'wyxa', date: new Date(Date.now() - 18 * 36e5).toISOString(), subject: 'feat(project): 添加项目关联跳转功能', body: '' },
    { hash: 'feaf680d', short: 'feaf680', author: 'wyxa', date: new Date(Date.now() - 20 * 36e5).toISOString(), subject: 'feat(git): 优化 remote 管理菜单布局', body: '' },
    { hash: 'fa0951f4', short: 'fa09514', author: 'wyxa', date: new Date(Date.now() - 21 * 36e5).toISOString(), subject: 'fix(GitTab): 修复分支菜单宽度自适应问题', body: '' },
    { hash: '93aa2677', short: '93aa267', author: 'wyxa', date: new Date(Date.now() - 26 * 36e5).toISOString(), subject: 'chore: 更新版本号为 v1.7.5', body: '' },
    { hash: 'e9cf7812', short: 'e9cf781', author: 'wyxa', date: new Date(Date.now() - 30 * 36e5).toISOString(), subject: 'feat(git): 增加按状态刷新与提交历史稳定性', body: '' },
    { hash: 'a0cfaf3f', short: 'a0cfaf3', author: 'wyxa', date: new Date(Date.now() - 48 * 36e5).toISOString(), subject: 'feat(git): 添加提交短哈希展示与筛选', body: '' },
    { hash: '8c0cc677', short: '8c0cc67', author: 'wyxa', date: new Date(Date.now() - 53 * 36e5).toISOString(), subject: 'docs: 更新项目文档', body: '' },
  ];
  // 拓扑演示：线性链 + 一次分支合并（e84517af 合入 3946918a）
  fakeLog.forEach((c, i) => { c.parents = fakeLog[i + 1] ? fakeLog[i + 1].hash : ''; });
  fakeLog[2].parents = fakeLog[3].hash + ' ' + fakeLog[1].hash;

  const fakeDiff = `diff --git a/src/renderer/git/GitView.tsx b/src/renderer/git/GitView.tsx
index 3a2f1bc..8d91e2f 100644
--- a/src/renderer/git/GitView.tsx
+++ b/src/renderer/git/GitView.tsx
@@ -12,6 +12,9 @@ export function GitView({ projectId }: Props) {
   const [loading, setLoading] = useState(true);
   const [changes, setChanges] = useState<ChangeEntry[]>([]);
+  const [stagedFiles, setStagedFiles] = useState<string[]>([]);
+  const [aiMessage, setAiMessage] = useState('');
 
   useEffect(() => {
     void refreshStatus();
+    window.pilot.git.watch(projectId, refreshStatus);
   }, [projectId]);
@@ -44,10 +47,14 @@ export function GitView({ projectId }: Props) {
   const handleCommit = async () => {
-    await commit(message);
+    const finalMessage = aiMessage || message;
+    await commit(finalMessage);
+    setAiMessage('');
   };
 
   return (
     <div className="git-changes">
-      {changes.map(c => <ChangeRow key={c.path} change={c} />)}
+      {changes.map(c => <ChangeRow key={c.path} change={c}
+        onStage={stageFile} onUnstage={unstageFile} />)}
     </div>
   );
 }`;

  const db = {
    'pilot:projects': { value: { projects: JSON.parse(JSON.stringify(seedProjects)) } },
    'pilot:settings': { value: { settings: { ai: { baseUrl: 'https://mock.local/v1', apiKey: 'sk-mock', model: 'mock-model' } } } },
  };

  // ---------- utools stub ----------
  window.utools = {
    isMock: true,
    dbGet(id) { const d = db[id]; return d ? { _id: id, value: d.value ?? d } : null; },
    dbPut(doc) { db[doc._id] = { value: doc.value }; return { ok: true }; },
    dbRemove(doc) { delete db[doc._id]; },
    showOpenDialog() { return ['D:/demo/new-project']; },
    shellOpenPath() {}, shellShowItemInFolder() {}, shellOpenExternal() {},
    copyText() {}, showNotification() {}, isDarkColors() { return false; },
    onPluginEnter() {},
  };

  // ---------- pilot stub ----------
  const projById = (path) => seedProjects.find((p) => p.path === path) || seedProjects[0];

  window.pilot = {
    platform: 'mock', home: 'D:/demo', defaultCommitPrompt: '默认提交提示词（mock）',
    dbGet(key) { return db[key]?.value ?? null; },
    dbPut(key, value) { db[key] = { value }; },
    selectFolder() { return ['D:/demo/new-project']; },
    openPath() {}, showItemInFolder() {}, openInBrowser() {}, copyText() {},
    notify() {}, isDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; },
    openTerminal() {},
    async killPid() { return { ok: true }; },
    git: {
      async status(path) { return JSON.parse(JSON.stringify(fakeStatuses[projById(path).id] || fakeStatuses['prj_demo2'])); },
      async diffFile(_path, file, staged) { return file.untracked ? '+++ 新文件: ' + file.path + '\n+# 新增内容示例' : fakeDiff; },
      async log(_path, n = 60) { return fakeLog.slice(0, n); },
      async branches(path) { return [{ current: true, name: fakeStatuses[projById(path).id]?.branch || 'main', upstream: 'origin/main' }, { current: false, name: 'develop', upstream: '' }]; },
      async stage() {}, async unstage() {}, async discard() {}, async discardUntracked() {},
      async commit(_path, msg) { fakeLog.unshift({ hash: Math.random().toString(16).slice(2), short: Math.random().toString(16).slice(2, 9), author: 'you', date: new Date().toISOString(), subject: msg.split('\n')[0], body: '' }); return Math.random().toString(16).slice(2, 9); },
      async push() {}, async pull() {}, async fetch() {}, async hasRemote() { return true; },
      async commitFileNames() { return [{ ins: 'M', path: 'src/renderer/App.tsx' }, { ins: 'M', path: 'src/renderer/git/GitView.tsx' }]; },
    },
    runScript(_path, script) {
      const id = 'mock_' + Date.now();
      setTimeout(() => window.pilot.onProcOutput && emit(script, id), 300);
      return { id };
    },
    stopProc() { return { ok: true }; },
    getProc(id) { return { id, out: procOut[id] || '', running: true, code: null }; },
    onProcOutput(id, cb) { listeners.push({ id, cb }); },
    runOnce(_path, cmd) { return Promise.resolve({ code: 0, output: `[mock] 已执行: ${cmd}\nAlready up to date.` }); },
    fs: {
      async listDir(path) {
        return [
          { name: 'src', dir: true, size: null, mtime: Date.now() - 36e5 },
          { name: 'docs', dir: true, size: null, mtime: Date.now() - 864e5 },
          { name: 'package.json', dir: false, size: 1240, mtime: Date.now() - 72e5 },
          { name: 'README.md', dir: false, size: 5320, mtime: Date.now() - 864e5 },
          { name: 'vite.config.ts', dir: false, size: 890, mtime: Date.now() - 26e6 },
        ];
      },
      isTextFile: (n) => /\.(md|json|ts|js|txt|css|html)$/i.test(n),
      async readText() { return '# ' + (this._file || '文件') + '\n\n这是 mock 文件内容。\n'; },
      async writeText() {}, async mkdir() {}, async rm() {}, async rename() {},
      async exists() { return true; },
    },
    // system monitor (mock)
    sys: {
      memory() { const total = 34.4e9, used = 21.8e9 + Math.random() * 0.4e9; return { total, free: total - used, used, pct: used / total }; },
      cpu() { return { pct: 0.16 + Math.random() * 0.12, cores: 16 }; },
      async ports() {
        return [
          { port: 135, pids: [1234], names: ['svchost.exe'] },
          { port: 445, pids: [1234], names: ['svchost.exe'] },
          { port: 3000, pids: [8640], names: ['node.exe'] },
          { port: 5173, pids: [9124], names: ['node.exe'] },
          { port: 8000, pids: [14520], names: ['python.exe'] },
          { port: 3306, pids: [6216], names: ['mysqld.exe'] },
          { port: 5040, pids: [3812], names: ['svchost.exe'] },
          { port: 7681, pids: [22004], names: ['Code.exe'] },
        ];
      },
    },
    // ---------- 项目身份识别（mock：无图标，按项目给技术栈演示） ----------
    async identify(p) {
      const fw = { 'axonhub': 'Electron', 'utools-project-pilot': 'Vue', 'ai-learning-platform': 'Django', 'smart-gallery': 'React', 'latex-notes': '' };
      const name = (p || '').split('/').pop();
      return { icon: null, framework: fw[name] || 'Vite' };
    },

    // ---------- AI ----------
    async aiChat({ messages }) {
      await new Promise((r) => setTimeout(r, 900));
      const last = messages[messages.length - 1].content || '';
      if (/commit|提交/.test(last) && /diff/.test(last.toLowerCase())) return 'feat(git): 集成 AI 生成提交信息并优化变更视图';
      return `**阶段总结（最近提交）**\n\n1. 持续打磨 Git 视图：修复分支菜单宽度自适应，增加提交短哈希展示与筛选，提升提交历史的稳定性。\n2. 启动性能优化：针对插件冷启动首帧做了系统性的 perf(startup) 工作。\n3. 项目管理能力增强：新增项目关联跳转，改进 remote 管理菜单布局。\n\n**建议关注**：连续多次 git 相关改动集中在渲染层，建议补充 e2e 测试覆盖分支切换场景。`;
    },
  };

  const listeners = [];
  const procOut = {};
  function emit(script, id) {
    procOut[id] = procOut[id] || '';
    const line = `[${script.name}] running… mock output line ${procOut[id].split('\n').length}\n`;
    procOut[id] += line;
    listeners.filter((l) => l.id === id).forEach((l) => l.cb(line));
    setTimeout(() => emit(script, id), 1200);
  }
})();
