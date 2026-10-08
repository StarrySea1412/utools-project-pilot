// store/projects.js — 仪表盘域：项目增删 / 归档 / 置顶 / 排序
import { store, saveProjects } from './state.js';
import { isProjectRunning } from './sysmon.js';

// ---------- 排序 / 置顶 ----------
// 纯函数：项目列表 + git 缓存 + 排序键 → 排序结果（置顶恒浮到最前，组内保持相对顺序），便于单测
export function sortProjects(projects, gitCache, sortKey) {
  const list = projects.slice();
  if (sortKey === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'dirty') list.sort((a, b) => (gitCache[b.id]?.status?.dirty || 0) - (gitCache[a.id]?.status?.dirty || 0));
  else if (sortKey === 'updated') list.sort((a, b) => (gitCache[b.id]?.lastCommitAt || 0) - (gitCache[a.id]?.lastCommitAt || 0));
  else if (sortKey === 'tag') list.sort((a, b) => ((a.tags || [])[0] || '\ufffd').localeCompare((b.tags || [])[0] || '\ufffd') || a.name.localeCompare(b.name));
  else if (sortKey === 'running') list.sort((a, b) => (isProjectRunning(b) ? 1 : 0) - (isProjectRunning(a) ? 1 : 0));
  else list.sort((a, b) => (b.lastOpened || b.createdAt || 0) - (a.lastOpened || a.createdAt || 0));
  return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
}

export function togglePin(id) {
  const p = store.projects.find((x) => x.id === id);
  if (!p) return;
  p.pinned = !p.pinned;
  saveProjects();
  return p.pinned;
}

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

// ---------- 项目归档：移出仪表盘但保留配置（脚本/任务/备忘都在），可随时恢复 ----------
export function archiveProject(id) {
  const p = store.projects.find((x) => x.id === id);
  if (!p) return false;
  p.archived = true;
  saveProjects();
  return true;
}
export function unarchiveProject(id) {
  const p = store.projects.find((x) => x.id === id);
  if (!p) return false;
  p.archived = false;
  if ((p.lastOpened || 0) === 0) p.lastOpened = Date.now(); // 恢复后浮到最近使用前列
  saveProjects();
  return true;
}
