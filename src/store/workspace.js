// store/workspace.js — 工作台域：全局待办（四象限）+ 通知中心
import { store } from './state.js';

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
