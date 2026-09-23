// store.js — Vue reactive 全局状态：项目、设置、Git 缓存、进程句柄、自动任务调度、AI
import { reactive } from 'vue';

const DEFAULT_SETTINGS = {
  theme: 'auto',
  cardView: 'card',      // 仪表盘密度：card 卡片 / compact 紧凑 / list 列表
  sort: 'recent',        // 仪表盘排序：recent 最近使用 / updated 最近更新 / dirty 变更最多 / tag 按标签 / name 名称
  ai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  commitPrompt: '',
  analysisModes: [
    { id: 'summary', name: '变更总结', builtin: true, prompt: '根据这批提交记录，总结本阶段完成了哪些工作。用简体中文，输出 3~6 条要点，每条一句话，突出新增能力和重要修复。' },
    { id: 'weekly', name: '周报生成', builtin: true, prompt: '把提交记录整理成一封简洁的中文周报：先一句话概括本周主题，再用列表列出「已完成」「进行中」，语气专业。' },
    { id: 'risk', name: '风险审查', builtin: true, prompt: '从提交记录中识别工程风险：哪些提交可能引入回归、哪些模块改动过于频繁、建议补充哪些测试。中文输出，按风险从高到低排序，最多 6 条。' },
  ],
};

export const store = reactive({
  view: 'dashboard',
  activeProjectId: null,
  detailTab: 'overview',
  gitSubTab: 'changes',
  projects: [],
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  search: '',
  tagFilter: '全部',
  sort: 'recent',
  gitCache: {},          // projectId -> {status, error, notRepo, loading, at}
  procHandles: {},       // scriptId -> {id, running, scriptName, projectId}
  procLogs: {},          // procId -> reactive string（控制台）
  consoleOpen: null,     // 打开控制台的 scriptId
  commitMsg: '',
  insightMode: null,
  selCommit: null,
  insightResult: '', insightBusy: false, insightError: '',
  fileCwd: null,
  dropActive: false,
  sys: null,               // {mem, cpu, ports, portsLoading, portsError, memHistory, cpuHistory}
  sysOpen: false,          // 系统状态面板折叠状态（默认折叠，让位给项目）
  workOpen: false,         // 工作台面板（建议+待办）折叠状态
  workTab: 'sug',          // 工作台面牌子页：sug 建议 / todo 待办
  notifOpen: false,        // 通知中心弹窗
  todos: [],               // 全局待办：{id, text, projectId?, q(0-3 四象限), done, createdAt, doneAt}
  notifications: [],       // 通知中心：{id, icon, text, time, read, projectId?}
  aiAdvice: { date: '', at: 0, summary: '', items: [] },  // AI 今日建议（按天持久化）
});

export function load() {
  try {
    const p = window.pilot?.dbGet('pilot:projects');
    store.projects = (p && p.projects) || [];
    const s = window.pilot?.dbGet('pilot:settings');
    if (s && s.settings) store.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), s.settings);
    store.sort = store.settings.sort || 'recent';
    const t = window.pilot?.dbGet('pilot:todos');
    store.todos = (t && t.todos) || [];
    const n = window.pilot?.dbGet('pilot:notifications');
    store.notifications = (n && n.notifications) || [];
    const a = window.pilot?.dbGet('pilot:aiAdvice');
    if (a && a.date === today()) store.aiAdvice = a;
  } catch (e) { console.error(e); }
  const have = new Set(store.settings.analysisModes.map((m) => m.id));
  for (const m of DEFAULT_SETTINGS.analysisModes) if (!have.has(m.id)) store.settings.analysisModes.push(m);
}

// ---------- 全局待办 ----------
export function saveTodos() {
  try { window.pilot?.dbPut('pilot:todos', { todos: store.todos }); } catch (e) { console.error('保存待办失败', e); }
}
let todoSeq = 0;
export function addTodo(text, projectId = null, q = 1) {
  const t = text.trim();
  if (!t) return null;
  store.todos.unshift({ id: 'td_' + Date.now().toString(36) + (++todoSeq), text: t, projectId, q, done: false, createdAt: Date.now(), doneAt: 0 });
  saveTodos();
  return store.todos[0];
}
// 四象限：0 紧急·重要 / 1 重要·不紧急 / 2 紧急·不重要 / 3 都不（旧数据无 q 视为 1）
export function setTodoQuad(id, q) {
  const t = store.todos.find((x) => x.id === id);
  if (!t) return;
  t.q = ((q % 4) + 4) % 4;
  saveTodos();
}
export function toggleTodo(id) {
  const t = store.todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : 0;
  saveTodos();
}
export function removeTodo(id) {
  store.todos = store.todos.filter((x) => x.id !== id);
  saveTodos();
}
export function clearDoneTodos() {
  store.todos = store.todos.filter((x) => !x.done);
  saveTodos();
}

// ---------- AI 今日建议（按天持久化，一天一份） ----------
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function saveAiAdvice(data) {
  store.aiAdvice = { date: today(), at: Date.now(), ...data };
  try { window.pilot?.dbPut('pilot:aiAdvice', store.aiAdvice); } catch (e) { console.error('保存 AI 建议失败', e); }
}

// ---------- 通知中心 ----------
export function saveNotifications() {
  try { window.pilot?.dbPut('pilot:notifications', { notifications: store.notifications }); } catch (e) { console.error('保存通知失败', e); }
}
let notifSeq = 0;
export function pushNotification(icon, text, { projectId = null, save = true, silent = false } = {}) {
  const n = { id: 'nt_' + Date.now().toString(36) + (++notifSeq), icon: icon || 'Bell', text, time: Date.now(), read: false, projectId };
  store.notifications.unshift(n);
  store.notifications = store.notifications.slice(0, 50); // 上限 50 条
  if (save) saveNotifications();
  if (!silent) window.pilot?.notify?.(text); // 系统通知（uTools 环境真弹）
  return n;
}
export function markNotifRead(id) {
  const n = store.notifications.find((x) => x.id === id);
  if (n && !n.read) { n.read = true; saveNotifications(); }
}
export function markAllNotifRead() {
  let dirty = false;
  for (const n of store.notifications) if (!n.read) { n.read = true; dirty = true; }
  if (dirty) saveNotifications();
}
export function clearNotifs() {
  store.notifications = [];
  saveNotifications();
}
export const notifUnread = () => store.notifications.filter((n) => !n.read).length;

export function saveProjects() {
  try { window.pilot?.dbPut('pilot:projects', { projects: store.projects }); }
  catch (e) { console.error('保存项目失败', e); }
}
export function saveSettings() {
  try { window.pilot?.dbPut('pilot:settings', { settings: store.settings }); }
  catch (e) { console.error('保存设置失败', e); }
}

export const activeProject = () => store.projects.find((p) => p.id === store.activeProjectId) || null;

export function addProject(pathStr) {
  if (store.projects.some((p) => p.path.toLowerCase() === pathStr.toLowerCase())) return null;
  const proj = {
    id: 'prj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: pathStr.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || pathStr,
    path: pathStr, tags: [], color: Math.floor(Math.random() * 6),
    scripts: [], tasks: [], notes: '', createdAt: Date.now(), lastOpened: 0,
  };
  store.projects.unshift(proj);
  saveProjects();
  return proj;
}
export function removeProject(id) {
  store.projects = store.projects.filter((p) => p.id !== id);
  saveProjects();
}

// ---------- AI ----------
export function ai(messages) {
  const { baseUrl, apiKey, model } = store.settings.ai || {};
  if (!baseUrl || !apiKey || !model) throw new Error('请先在设置中配置 AI 服务（Base URL / API Key / 模型）');
  return window.pilot.aiChat({ baseUrl, apiKey, model, messages });
}

const MAX_DIFF_CHARS = 14000, MAX_LOG_CHARS = 12000;

export async function genCommitMessage(proj, stagedFiles) {
  const parts = [];
  let total = 0;
  for (const f of stagedFiles.slice(0, 30)) {
    const d = await window.pilot.git.diffFile(proj.path, f, true);
    const add = d.length > MAX_DIFF_CHARS ? d.slice(0, MAX_DIFF_CHARS) + '\n...[截断]' : d;
    parts.push(`### ${f.path}\n${add}`);
    total += add.length;
    if (total > MAX_DIFF_CHARS) break;
  }
  if (!parts.length) throw new Error('暂存区没有文件，请先暂存要提交的变更');
  const sys = store.settings.commitPrompt || window.pilot.defaultCommitPrompt;
  const text = await ai([
    { role: 'system', content: sys },
    { role: 'user', content: `变更文件列表：\n${stagedFiles.map((f) => f.path).join('\n')}\n\n以下是 git diff（已暂存）：\n\n${parts.join('\n\n')}` },
  ]);
  return text.replace(/^[`"'\s]+|[`"'\s]+$/g, '').split('\n').filter(Boolean).slice(0, 3).join('\n');
}

export async function analyzeHistory(proj, mode, commits) {
  const lines = commits.map((c) => {
    let s = `- ${c.subject} (${c.short}, ${c.author}, ${c.date.slice(0, 10)})`;
    if (c.body) s += `\n  ${c.body.replace(/\n+/g, ' / ').slice(0, 160)}`;
    return s;
  }).join('\n');
  return ai([
    { role: 'system', content: '你是软件工程分析助手，只依据给出的提交记录做分析，用简体中文输出，条理清晰，不要编造记录之外的信息。' },
    { role: 'user', content: `项目：${proj.name}\n\n最近的提交记录：\n${lines.slice(0, MAX_LOG_CHARS)}\n\n分析任务：${mode.prompt}` },
  ]);
}

// ---------- 进程 ----------
export function watchProc(scriptId) {
  const h = store.procHandles[scriptId];
  if (!h) return;
  window.pilot.onProcOutput(h.id, (chunk) => {
    store.procLogs[h.id] = (store.procLogs[h.id] || '') + chunk;
    if (store.procLogs[h.id].length > 120000) store.procLogs[h.id] = store.procLogs[h.id].slice(-100000);
  });
}

export function startScript(proj, script) {
  const r = window.pilot.runScript(proj.path, script);
  store.procHandles[script.id] = { id: r.id, running: true, scriptName: script.name, projectId: proj.id };
  store.procLogs[r.id] = '';
  proj.lastOpened = Date.now();
  saveProjects();
  watchProc(script.id);
  store.consoleOpen = script.id;
  return r;
}

export async function stopScript(script) {
  const h = store.procHandles[script.id];
  if (!h) return;
  h.running = false; // 先置：按钮立即回弹，避免 10s 轮询期间 UI 卡在「停止中」
  try { await window.pilot.stopProc(h.id); } catch (e) { /* 后端已死无所谓 */ }
  if (store.consoleOpen === script.id) store.consoleOpen = null;
}

// ---------- 自动任务 ----------
const taskState = { bootedIds: new Set(), timer: null };

function taskDue(task, now) {
  if (!task.enabled) return false;
  if (task.type === 'boot') return !taskState.bootedIds.has(task.id);
  if (task.type === 'interval') {
    const every = Math.max(1, task.everyMinutes || 60) * 60000;
    return !task.lastRun || (now - task.lastRun) >= every;
  }
  if (task.type === 'daily') {
    const [h, m] = String(task.atTime || '09:00').split(':').map(Number);
    const d = new Date(now);
    if (d.getHours() !== h || d.getMinutes() !== m) return false;
    return !task.lastRun || (now - task.lastRun) >= 6 * 3600 * 1000;
  }
  return false;
}

export async function execAndLog(proj, task) {
  const entry = { time: Date.now(), ok: true, output: '' };
  try {
    const res = await window.pilot.runOnce(proj.path, task.cmd, 120000);
    entry.ok = res.code === 0;
    entry.output = res.output.slice(-800);
  } catch (e) { entry.ok = false; entry.output = String(e.message || e); }
  task.lastRun = entry.time;
  task.log = task.log || [];
  task.log.unshift(entry);
  task.log = task.log.slice(0, 20);
  saveProjects();
  if (!entry.ok) {
    const text = `任务「${task.name}」执行失败（${proj.name}）`;
      pushNotification('TriangleAlert', text, { projectId: proj.id });
  }
  return entry;
}

function tick() {
  const now = Date.now();
  for (const proj of store.projects) {
    for (const task of proj.tasks || []) {
      if (taskDue(task, now)) {
        if (task.type === 'boot') taskState.bootedIds.add(task.id);
        execAndLog(proj, task).catch((e) => console.error(e));
      }
    }
  }
}

export function startScheduler() {
  if (taskState.timer) clearInterval(taskState.timer);
  taskState.timer = setInterval(tick, 20000);
  setTimeout(tick, 3000);
}

// ---------- Git 状态刷新 ----------
export async function checkGit(proj, force = false) {
  if (!store.gitCache[proj.id]) store.gitCache[proj.id] = {};
  const cache = store.gitCache[proj.id]; // 取 reactive 代理，写入才能触发视图更新
  if (cache.loading && !force) return;
  cache.loading = true;
  try {
    cache.status = await window.pilot.git.status(proj.path);
    cache.notRepo = false; cache.error = null;
    // 顺带取最后一次提交时间，供「最近更新」排序
    try {
      const last = await window.pilot.git.log(proj.path, 1);
      cache.lastCommitAt = last?.[0]?.date ? new Date(last[0].date).getTime() : 0;
    } catch (e) { /* 空仓库等情况忽略 */ }
  } catch (e) {
    const msg = String(e.message || e);
    cache.notRepo = /not a git repository/i.test(msg);
    cache.error = cache.notRepo ? null : msg;
    cache.status = null;
  }
  cache.loading = false; cache.at = Date.now();
}

let refreshing = false;
export async function refreshAllGit(force = false) {
  if (refreshing) return;
  refreshing = true;
  const queue = store.projects.slice();
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      await checkGit(p, force);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  refreshing = false;
}

export function startAutoRefresh() {
  setInterval(() => {
    if (store.view === 'dashboard' && document.visibilityState !== 'hidden') refreshAllGit();
  }, 90000);
}

// ---------- 系统监测 ----------
export function startSysMonitor() {
  if (!window.pilot?.sys) return;
  store.sys = { mem: null, cpu: null, ports: [], portsLoading: false, portsError: '', memHistory: [], cpuHistory: [] };
  const pollFast = async () => {
    try {
      const mem = window.pilot.sys.memory();
      const cpu = window.pilot.sys.cpu();
      store.sys.mem = mem;
      store.sys.cpu = cpu;
      // 保留最近 60 个采样点用于走势图
      const push = (arr, v) => { arr.push(v); if (arr.length > 60) arr.shift(); };
      if (!Array.isArray(store.sys.memHistory)) store.sys.memHistory = [];
      if (!Array.isArray(store.sys.cpuHistory)) store.sys.cpuHistory = [];
      push(store.sys.memHistory, mem.pct);
      if (cpu.pct != null) push(store.sys.cpuHistory, cpu.pct);
    } catch (e) { /* 忽略单次失败 */ }
  };
  const pollSlow = async () => {
    store.sys.portsLoading = true;
    try { store.sys.ports = await window.pilot.sys.ports(); store.sys.portsError = ''; }
    catch (e) { store.sys.portsError = String(e.message || e); }
    store.sys.portsLoading = false;
  };
  pollFast();
  pollSlow();
  setInterval(pollFast, 3000);
  setInterval(pollSlow, 15000);
}

// 项目路径 → 运行中的相关端口（按进程名粗关联 node/python/java 等 + 已知脚本端口）
export function projectPorts(proj) {
  if (!store.sys?.ports) return [];
  const names = new Set((proj.scripts || []).flatMap((s) => {
    const m = String(s.cmd).match(/\b(node|npm|python|python3|uvicorn|java|go|php|ruby)\b/i);
    return m ? [m[1].toLowerCase()] : [];
  }));
  const pkgLike = /node|npm|vite|next|webpack/i;
  return store.sys.ports.filter((p) => p.names.some((n) => {
    const ln = n.toLowerCase();
    if (names.size && [...names].some((x) => ln.includes(x))) return true;
    return names.size === 0 && pkgLike.test(ln);
  })).slice(0, 6);
}
