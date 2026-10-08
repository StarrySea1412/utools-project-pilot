// store/gitsync.js — Git 态势域：状态刷新 / 后台并发队列 / 静默巡检
import { store, activeProjects } from './state.js';
import { pushNotification } from './workspace.js';
import { isBgPaused } from './sysmon.js';

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
  const queue = store.projects.filter((p) => !p.archived); // 归档项目不刷 Git 态势
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
    if (store.view === 'dashboard' && document.visibilityState !== 'hidden' && !isBgPaused()) refreshAllGit();
  }, 90000);
}

// ---------- 静默巡检：打开插件时跑一轮，落后远程/任务失败主动进通知中心 ----------
const patrolState = { done: false, notifiedAt: {} }; // notifiedAt: key(通知去重) -> ts

export async function patrolOnce(force = false) {
  if (patrolState.done && !force) return;
  patrolState.done = true;
  try { await refreshAllGit(force); } catch (e) { return; }
  const now = Date.now();
  for (const proj of activeProjects()) {
    const st = store.gitCache[proj.id]?.status;
    if (!st) continue;
    // 落后远程：同一项目一小时只提醒一次
    if (st.behind > 0) {
      const key = `behind:${proj.id}`;
      if (now - (patrolState.notifiedAt[key] || 0) > 3600e3) {
        patrolState.notifiedAt[key] = now;
        pushNotification('ArrowDown', `「${proj.name}」落后远程 ${st.behind} 个提交，建议先拉取`, { projectId: proj.id });
      }
    }
    if (st.ahead > 5) {
      const key = `ahead:${proj.id}`;
      if (now - (patrolState.notifiedAt[key] || 0) > 3600e3) {
        patrolState.notifiedAt[key] = now;
        pushNotification('ArrowUp', `「${proj.name}」本地领先 ${st.ahead} 个提交未推送`, { projectId: proj.id });
      }
    }
    // 任务失败（执行路径已有通知，这里兜底巡检一遍启动前的失败）
    for (const t of proj.tasks || []) {
      if (t.enabled && t.log?.[0] && !t.log[0].ok) {
        const key = `taskfail:${t.id}`;
        if (now - (patrolState.notifiedAt[key] || 0) > 3600e3) {
          patrolState.notifiedAt[key] = now;
          pushNotification('TriangleAlert', `任务「${t.name}」最近一次执行失败（${proj.name}）`, { projectId: proj.id });
        }
      }
    }
  }
}
