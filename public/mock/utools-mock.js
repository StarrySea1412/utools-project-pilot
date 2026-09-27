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
  let mockBranches = [];   // mock 新建分支累积
  let mockStashes = [];    // mock stash 栈

  window.pilot = {
    platform: 'mock', home: 'D:/demo', defaultCommitPrompt: '默认提交提示词（mock）',
    dbGet(key) { return db[key]?.value ?? null; },
    dbPut(key, value) { db[key] = { value }; },
    // 导入导出 mock：导出记住最近文件名，导入回放导出时的 db 快照（含种子数据）
    exportJson(name) { db['__lastExportName'] = { value: name }; db['__exportSnapshot'] = { value: JSON.stringify({ app: 'project-pilot', version: 1, exportedAt: new Date().toISOString(), 'pilot:projects': db['pilot:projects']?.value ?? null, 'pilot:settings': db['pilot:settings']?.value ?? null, 'pilot:todos': db['pilot:todos']?.value ?? null, 'pilot:notifications': db['pilot:notifications']?.value ?? null, 'pilot:aiAdvice': db['pilot:aiAdvice']?.value ?? null }) }; return 'D:/demo/' + name; },
    async importJson() { return db['__exportSnapshot']?.value ?? null; },
    selectFolder() { return ['D:/demo/new-project']; },
    openPath() {}, showItemInFolder() {}, openInBrowser() {}, copyText() {},
    notify() {}, isDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; },
    openTerminal() {},
    async killPid() { return { ok: true }; },
    git: {
      async status(path) { return JSON.parse(JSON.stringify(fakeStatuses[projById(path).id] || fakeStatuses['prj_demo2'])); },
      async diffFile(_path, file, staged) { return file.untracked ? '+++ 新文件: ' + file.path + '\n+# 新增内容示例' : fakeDiff; },
      async log(_path, n = 60) { return fakeLog.slice(0, n); },
      async branches(path) {
        const cur = fakeStatuses[projById(path).id]?.branch || 'main';
        return [{ current: true, name: cur, upstream: 'origin/main' }, { current: false, name: 'develop', upstream: '' }, ...mockBranches.filter((b) => b.name !== cur)];
      },
      async commitBranches() { return { '920132ab': ['main'], 'e84517af': ['main', 'feature/perf'], '93aa2677': ['v1.7.5'] }; },
      async checkout() {},
      async createBranch(_cwd, name) { mockBranches.push({ current: false, name, upstream: '' }); },
      async deleteBranch(_cwd, name) { mockBranches = mockBranches.filter((b) => b.name !== name); },
      async stashPush() { mockStashes.unshift({ hash: 'ab12cd', label: 'stash@{0}', subject: 'WIP on main: 测试暂存' }); },
      async stashPop() { mockStashes.shift(); },
      async stashDrop() { mockStashes.shift(); },
      async stashList() { return mockStashes.slice(); },
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
      self() { return { pid: 1892, rss: 96 * 1024 * 1024, heapUsed: 38 * 1024 * 1024, heapTotal: 56 * 1024 * 1024, external: 4 * 1024 * 1024, uptime: 3612, totalMem: 34.4e9, pct: 96 * 1024 * 1024 / 34.4e9 }; },
      async ports() {
        return [
          { port: 135, pids: [1234], names: ['svchost.exe'], commandLine: '', executablePath: 'C:/Windows/System32/svchost.exe', isInternal: false, processes: [{ pid: 1234, name: 'svchost.exe', commandLine: '', executablePath: 'C:/Windows/System32/svchost.exe', ppid: null }] },
          { port: 445, pids: [1234], names: ['svchost.exe'], commandLine: '', executablePath: 'C:/Windows/System32/svchost.exe', isInternal: false, processes: [{ pid: 1234, name: 'svchost.exe', commandLine: '', executablePath: 'C:/Windows/System32/svchost.exe', ppid: null }] },
          { port: 3000, pids: [8640], names: ['node.exe'], commandLine: 'node D:/project/axonhub/node_modules/next/dist/bin/next dev', executablePath: 'C:/Program Files/nodejs/node.exe', isInternal: false, processes: [{ pid: 8640, name: 'node.exe', commandLine: 'node D:/project/axonhub/node_modules/next/dist/bin/next dev', executablePath: 'C:/Program Files/nodejs/node.exe', ppid: null }] },
          { port: 5173, pids: [9124], names: ['node.exe'], commandLine: 'node D:/project/utools-project-pilot/node_modules/vite/bin/vite.js', executablePath: 'C:/Program Files/nodejs/node.exe', isInternal: false, processes: [{ pid: 9124, name: 'node.exe', commandLine: 'node D:/project/utools-project-pilot/node_modules/vite/bin/vite.js', executablePath: 'C:/Program Files/nodejs/node.exe', ppid: null }] },
          { port: 8000, pids: [14520], names: ['python.exe'], commandLine: 'python -m uvicorn app.main:app --port 8000', executablePath: 'D:/project/ai-learning-platform/.venv/Scripts/python.exe', isInternal: false, processes: [{ pid: 14520, name: 'python.exe', commandLine: 'python -m uvicorn app.main:app --port 8000', executablePath: 'D:/project/ai-learning-platform/.venv/Scripts/python.exe', ppid: null }] },
          { port: 3306, pids: [6216], names: ['mysqld.exe'], commandLine: 'mysqld.exe', executablePath: 'C:/Program Files/MySQL/bin/mysqld.exe', isInternal: false, processes: [{ pid: 6216, name: 'mysqld.exe', commandLine: 'mysqld.exe', executablePath: 'C:/Program Files/MySQL/bin/mysqld.exe', ppid: null }] },
          { port: 5040, pids: [3812], names: ['svchost.exe'], commandLine: '', executablePath: 'C:/Windows/System32/svchost.exe', isInternal: false, processes: [{ pid: 3812, name: 'svchost.exe', commandLine: '', executablePath: 'C:/Windows/System32/svchost.exe', ppid: null }] },
          { port: 7681, pids: [22004], names: ['Code.exe'], commandLine: '', executablePath: 'C:/Users/user/AppData/Local/Programs/Microsoft VS Code/Code.exe', isInternal: false, processes: [{ pid: 22004, name: 'Code.exe', commandLine: '', executablePath: 'C:/Users/user/AppData/Local/Programs/Microsoft VS Code/Code.exe', ppid: null }] },
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
      // AI 今日建议：返回结构化 JSON，走通解析/持久化/可执行动作全流程
      if (/项目态势/.test(last)) {
        return JSON.stringify({
          summary: '先处理 axonhub 的 5 个未提交变更',
          items: [
            { text: '提交 axonhub 的 5 个未提交变更，避免丢失上下文', level: 2, project: 'axonhub', action: 'git' },
            { text: 'ai-learning-platform 落后远程 2 个提交，先拉取再继续', level: 1, project: 'ai-learning-platform', action: 'git' },
            { text: 'latex-notes 已 8 天未打开，考虑归档或补充备忘', level: 0, project: 'latex-notes', action: 'detail' },
          ],
        });
      }
      // 探索模式：返回完成度评分 + 功能推荐 JSON
      if (/评估开发项目的完成度|探索/.test(last) || /评估开发项目的完成度/.test(messages[0]?.content || '')) {
        return JSON.stringify({
          score: 68,
          grade: '成熟',
          summary: '功能骨架完整，补齐自动化测试与用户文档即可迈上新台阶',
          dims: [
            { name: '文档', score: 14, note: 'README 有基础说明，缺使用示例' },
            { name: '测试', score: 8, note: '有测试框架但覆盖不足' },
            { name: 'CI/CD', score: 10, note: '有构建流水线，缺发布自动化' },
            { name: '工程化', score: 18, note: 'lint/锁文件齐备' },
            { name: '活跃度', score: 22, note: '近两周高频提交' },
            { name: '功能完成度', score: 16, note: '核心路径可用，边缘场景待补' },
          ],
          ideas: [
            { text: '为核心流程补 vitest 单测，覆盖率提到 60%', level: 2, why: '当前改动集中，回归风险随功能膨胀上升' },
            { text: 'README 增加快速上手示例与截图', level: 2, why: '新用户 3 分钟内跑不起来就会流失' },
            { text: '把手动发布步骤固化为 CI 任务', level: 1, why: '减少发版时的手工失误' },
            { text: '增加数据导入的容错与回滚', level: 1, why: '导入失败目前会留半态数据' },
            { text: '支持自定义主题色', level: 0, why: '个性化需求在用户反馈中出现过两次' },
          ],
        });
      }
      if (/commit|提交/.test(last) && /diff/.test(last.toLowerCase())) return 'feat(git): 集成 AI 生成提交信息并优化变更视图';
      if (/周报/.test(messages[0]?.content || '')) {
        return '**本周主题**：Git 工作台深度打磨与界面一致性提升。\n\n## axonhub\n- 完成分支管理弹窗与 stash 快捷操作\n- 修复切换分支后的状态回弹问题\n\n## ai-learning-platform\n- 图库页 UI 迭代，新增筛选能力\n\n**风险与建议**\n- 多项目并发刷新逻辑改动较多，建议观察一周内任务失败率。';
      }
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
