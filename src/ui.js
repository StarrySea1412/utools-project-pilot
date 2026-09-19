// ui.js — toast / modal / confirm / 工具函数（Vue reactive）
import { reactive } from 'vue';

export const ui = reactive({
  toasts: [],
  modal: null,     // { component, props, title, wide }
  confirm: null,   // { title, msg, okText, danger, onOk }
});

let toastSeq = 0;
export function toast(msg, type = 'ok') {
  const id = ++toastSeq;
  ui.toasts.push({ id, msg, type });
  setTimeout(() => {
    const i = ui.toasts.findIndex((t) => t.id === id);
    if (i >= 0) ui.toasts.splice(i, 1);
  }, 2600);
}

export function openModal(component, props = {}, { title = '', wide = false } = {}) {
  ui.modal = { component, props, title, wide };
}
export function closeModal() { ui.modal = null; }

export function confirmBox(title, msg, onOk, { okText = '确定', danger = true } = {}) {
  ui.confirm = { title, msg, okText, danger, onOk };
}

export function esc(s) {
  return String(s == null ? '' : s);
}

export const PROJECT_COLORS = [
  ['#5b8fd9', '#6f9de3'], ['#4cb782', '#5aa895'], ['#d9a13d', '#cf8a4a'],
  ['#c96f8f', '#b072a8'], ['#8f7bd9', '#a58ad9'], ['#5aa8b8', '#6d97c4'],
];

export function projectIconStyle(color) {
  const [c1, c2] = PROJECT_COLORS[(color || 0) % PROJECT_COLORS.length];
  return { background: `linear-gradient(135deg, ${c1}, ${c2})` };
}

export function timeAgo(ts) {
  if (!ts) return '从未';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
export function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
export function shortPath(p) {
  const parts = String(p).replace(/[\\/]+$/, '').split(/[\\/]/);
  if (parts.length <= 3) return parts.join('/');
  return parts[0] + '/…/' + parts.slice(-2).join('/');
}
export function applyTheme() {
  const mode = store2.settings.theme || 'auto';
  let dark;
  if (mode === 'auto') dark = window.pilot?.isDark() || (window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  else dark = mode === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
// 避免循环依赖：store 在 store.js 中，这里只取
import { store as store2 } from './store.js';

export function commitType(subject) {
  const m = String(subject).match(/^\s*(\w+)[\s(:]/);
  const t = m ? m[1].toLowerCase() : 'other';
  return ['feat', 'fix', 'docs', 'refactor', 'perf', 'chore', 'test', 'style', 'build', 'ci'].includes(t) ? t : 'other';
}
