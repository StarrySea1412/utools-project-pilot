// store/procs.js — 进程域：脚本启停 / 日志接管 / 崩溃监测 + 自动任务调度
import { store, saveProjects } from './state.js';
import { pushNotification } from './workspace.js';

export function watchProc(scriptId) {
  const h = store.procHandles[scriptId];
  if (!h) return;
  window.pilot.onProcOutput(h.id, (chunk) => {
    store.procLogs[h.id] = (store.procLogs[h.id] || '') + chunk;
    if (store.procLogs[h.id].length > 120000) store.procLogs[h.id] = store.procLogs[h.id].slice(-100000);
  });
}

export function startScript(proj, script) {
  const prev = store.procHandles[script.id];
  if (prev) delete store.procLogs[prev.id]; // 回收上一轮进程日志，重启只保留最新一份
  const r = window.pilot.runScript(proj.path, script);
  store.procHandles[script.id] = { id: r.id, running: true, scriptName: script.name, projectId: proj.id, pid: r.pid || null, startedAt: Date.now() };
  store.procLogs[r.id] = '';
  proj.lastOpened = Date.now();
  saveProjects();
  watchProc(script.id);
  store.consoleOpen = script.id;
  startProcWatch(proj, script, r.id);
  return r;
}

// 服务退出监测：轮询后端真实状态；非手动停止的退出 → 通知中心 + 系统通知
const procWatchTimers = {};
function startProcWatch(proj, script, procId) {
  clearInterval(procWatchTimers[script.id]);
  procWatchTimers[script.id] = setInterval(async () => {
    const h = store.procHandles[script.id];
    if (!h || h.id !== procId) { clearInterval(procWatchTimers[script.id]); return; }
    try {
      const rec = window.pilot.getProc(procId);
      if (!rec) { // 进程不存在（插件重启等）：按停止处理，不告警
        clearInterval(procWatchTimers[script.id]);
        return;
      }
      if (!rec.running && h.running) {
        h.running = false; // 同步真实退出状态
        clearInterval(procWatchTimers[script.id]);
        if (!h.stopping) { // 用户主动 stopScript 会预先置 stopping
          const code = rec.code == null ? '' : `（退出码 ${rec.code}）`;
          pushNotification('TriangleAlert', `服务「${script.name}」已退出${code} — ${proj.name}`, { projectId: proj.id });
        }
      }
    } catch (e) { clearInterval(procWatchTimers[script.id]); }
  }, 5000);
}

export async function stopScript(script) {
  const h = store.procHandles[script.id];
  if (!h) return;
  h.stopping = true; // 标记主动停止：退出监测不再告警
  h.running = false; // 先置：按钮立即回弹，避免轮询期间 UI 卡在「停止中」
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
    if (proj.archived) continue; // 归档项目：自动任务暂停（含 boot 型），恢复后重新生效
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
