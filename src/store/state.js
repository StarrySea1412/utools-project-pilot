// store/state.js — reactive 根：全局状态、默认设置、加载与基础持久化
// 拆分约定见 docs/ARCHITECTURE.md：所有领域模块只从这里拿 store，禁止互相持有可变状态。
import { reactive } from 'vue';

export const DEFAULT_SETTINGS = {
  theme: 'auto',
  cardView: 'card',      // 仪表盘密度：card 卡片 / compact 紧凑 / list 列表
  sort: 'recent',        // 仪表盘排序：recent 最近使用 / updated 最近更新 / dirty 变更最多 / tag 按标签 / name 名称
  ai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  editorCmd: '',         // 「用编辑器打开」自定义命令模板，{path} 占位（如 code {path}）；空 = 自动探测
  archive: [],           // 归档项目路径（路径去重，项目本体从列表移除时不删数据）
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
  explore: {},             // 探索模式：projectId -> {date, at, score, grade, summary, dims, ideas, ruleScore...}
  algo: { progress: {}, log: {}, redo: [], goal: 2 }, // 刷题领航：progress slug->{done,doneAt,note} / log 日期->完成数 / redo 重做队列 / goal 每日题量
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
    const ex = window.pilot?.dbGet('pilot:explore');
    if (ex) store.explore = ex; // 按项目缓存，UI 侧按日期判断是否过期
    const ag = window.pilot?.dbGet('pilot:algo');
    if (ag) store.algo = Object.assign({ progress: {}, log: {}, redo: [], goal: 2 }, ag);
  } catch (e) { console.error(e); }
  const have = new Set(store.settings.analysisModes.map((m) => m.id));
  for (const m of DEFAULT_SETTINGS.analysisModes) if (!have.has(m.id)) store.settings.analysisModes.push(m);
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function saveProjects() {
  try { window.pilot?.dbPut('pilot:projects', { projects: store.projects }); }
  catch (e) { console.error('保存项目失败', e); }
}
export function saveSettings() {
  try { window.pilot?.dbPut('pilot:settings', { settings: store.settings }); }
  catch (e) { console.error('保存设置失败', e); }
}

export const activeProject = () => store.projects.find((p) => p.id === store.activeProjectId) || null;
export const activeProjects = () => store.projects.filter((p) => !p.archived);
export const archivedProjects = () => store.projects.filter((p) => p.archived);
