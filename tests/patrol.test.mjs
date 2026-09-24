// patrol.test.mjs — 静默巡检通知去重逻辑单测
import { describe, it, expect, beforeEach } from 'vitest';

const memdb = new Map();
const sysNotifies = [];
globalThis.window = {
  pilot: {
    dbGet: (k) => memdb.get(k) ?? null,
    dbPut: (k, v) => { memdb.set(k, v); },
    notify: (t) => sysNotifies.push(t),
    // 巡检依赖 git.status：可编程返回
    git: {
      async status() { return patrolStatus; },
      async log() { return []; },
    },
  },
};

let patrolStatus = { dirty: 0, ahead: 0, behind: 0, branch: 'main' };

const { store, patrolOnce, pushNotification, notifUnread } = await import('../src/store.js');

beforeEach(() => {
  memdb.clear();
  sysNotifies.length = 0;
  store.projects = [];
  store.gitCache = {};
  store.notifications = [];
  patrolStatus = { dirty: 0, ahead: 0, behind: 0, branch: 'main' };
});

describe('patrolOnce 静默巡检', () => {
  it('落后远程的项目进通知中心', async () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [] }];
    patrolStatus = { dirty: 0, ahead: 0, behind: 3, branch: 'main' };
    await patrolOnce(true);
    // 巡检走 refreshAllGit → checkGit → pilot.git.status；直接校验通知产生了
    expect(store.notifications.some((n) => n.text.includes('落后远程 3'))).toBe(true);
    expect(notifUnread()).toBe(1);
  });

  it('同一项目一小时内不重复通知（节流去重）', async () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [] }];
    patrolStatus = { dirty: 0, ahead: 0, behind: 3, branch: 'main' };
    await patrolOnce(true);
    const first = notifUnread();
    await patrolOnce(true); // 立刻再巡检：同一 key 应被去重
    expect(notifUnread()).toBe(first);
  });

  it('领先 >5 才提醒推送', async () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [] }];
    patrolStatus = { dirty: 0, ahead: 5, behind: 0, branch: 'main' };
    await patrolOnce(true);
    expect(store.notifications.some((n) => n.text.includes('未推送'))).toBe(false);
  });

  it('启用的失败任务进通知，禁用的不进', async () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [
      { id: 't1', name: 'deploy', enabled: true, log: [{ ok: false }] },
      { id: 't2', name: 'old', enabled: false, log: [{ ok: false }] },
    ] }];
    await patrolOnce(true);
    expect(store.notifications.some((n) => n.text.includes('deploy'))).toBe(true);
    expect(store.notifications.some((n) => n.text.includes('「old」'))).toBe(false);
  });

  it('干净项目不产生任何巡检通知', async () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [] }];
    await patrolOnce(true);
    expect(notifUnread()).toBe(0);
  });
});
