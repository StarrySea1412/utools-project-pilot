// store/backup.js — 数据导出 / 导入（换机迁移的唯一出路，uTools db 无云同步）
import { store, today, saveProjects, saveSettings, DEFAULT_SETTINGS } from './state.js';
import { saveTodos, saveNotifications } from './workspace.js';

const DATA_KEYS = ['pilot:projects', 'pilot:settings', 'pilot:todos', 'pilot:notifications', 'pilot:aiAdvice', 'pilot:explore'];

export function exportAll() {
  const data = { app: 'project-pilot', version: 1, exportedAt: new Date().toISOString() };
  for (const k of DATA_KEYS) data[k] = window.pilot?.dbGet(k) ?? null;
  const name = `project-pilot-backup-${today()}.json`;
  const file = window.pilot?.exportJson?.(name, JSON.stringify(data, null, 2));
  return file || null;
}

// 导入并覆盖本地数据；mode: merge 以路径去重合并项目 / replace 全量覆盖
export async function importAll(mode = 'merge') {
  const raw = await window.pilot?.importJson?.();
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch (e) { throw new Error('文件不是有效的 JSON'); }
  if (!data || data.app !== 'project-pilot') throw new Error('不是Seewrok的备份文件');

  const imported = {};
  if (data['pilot:projects']?.projects) {
    if (mode === 'replace') {
      store.projects = data['pilot:projects'].projects;
    } else {
      const lower = new Set(store.projects.map((p) => p.path.toLowerCase()));
      for (const p of data['pilot:projects'].projects) {
        if (!lower.has(String(p.path).toLowerCase())) { store.projects.unshift(p); lower.add(String(p.path).toLowerCase()); }
      }
    }
    saveProjects();
    imported.projects = data['pilot:projects'].projects.length;
  }
  if (data['pilot:settings']?.settings) {
    store.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), data['pilot:settings'].settings);
    saveSettings();
    imported.settings = true;
  }
  if (data['pilot:todos']?.todos) {
    const have = new Set(store.todos.map((t) => t.text));
    if (mode === 'replace') store.todos = data['pilot:todos'].todos;
    else for (const t of data['pilot:todos'].todos) if (!have.has(t.text)) store.todos.push(t);
    saveTodos();
    imported.todos = data['pilot:todos'].todos.length;
  }
  if (data['pilot:notifications']?.notifications) {
    store.notifications = data['pilot:notifications'].notifications;
    saveNotifications();
  }
  if (data['pilot:aiAdvice']?.date === today()) {
    store.aiAdvice = data['pilot:aiAdvice'];
    try { window.pilot?.dbPut('pilot:aiAdvice', store.aiAdvice); } catch (e) {}
  }
  if (data['pilot:explore'] && typeof data['pilot:explore'] === 'object') {
    store.explore = Object.assign({}, store.explore, data['pilot:explore']);
    try { window.pilot?.dbPut('pilot:explore', store.explore); } catch (e) {}
  }
  return imported;
}
