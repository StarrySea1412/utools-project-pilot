// advisor.test.mjs — 规则引擎建议触发条件单测
// advisor.js 依赖 Vue reactive store 与 window.pilot；测试中用最小 stub 注入
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 动态导入被测模块前先布置好 store 种子（advisor 只读 store 字段）
const { store } = await import('../src/store.js');
const { buildSuggestions } = await import('../src/advisor.js');

const daysAgo = (n) => Date.now() - n * 864e5;

function seedProject(over = {}) {
  return Object.assign({
    id: 'p1', name: 'demo', path: 'D:/demo', tags: [], scripts: [], tasks: [],
    notes: '', createdAt: daysAgo(30), lastOpened: daysAgo(1),
  }, over);
}

beforeEach(() => {
  store.projects = [];
  store.gitCache = {};
  store.procHandles = {};
  store.sys = null;
  store.todos = [];
});

describe('buildSuggestions 规则引擎', () => {
  it('无项目时不产出 clean 建议', () => {
    expect(buildSuggestions()).toEqual([]);
  });

  it('未提交变更触发 dirty 建议，>8 个升级为紧急', () => {
    store.projects = [seedProject()];
    store.gitCache.p1 = { status: { dirty: 3, ahead: 0, behind: 0, branch: 'main' } };
    const out = buildSuggestions();
    const dirty = out.find((s) => s.id === 'dirty-p1');
    expect(dirty).toBeTruthy();
    expect(dirty.level).toBe(1);
    expect(dirty.action.type).toBe('git');

    store.gitCache.p1 = { status: { dirty: 9, ahead: 0, behind: 0, branch: 'main' } };
    expect(buildSuggestions().find((s) => s.id === 'dirty-p1').level).toBe(2);
  });

  it('落后/领先远程触发对应建议', () => {
    store.projects = [seedProject()];
    store.gitCache.p1 = { status: { dirty: 0, ahead: 5, behind: 3, branch: 'main' } };
    const out = buildSuggestions();
    expect(out.find((s) => s.id === 'behind-p1').level).toBe(1);
    expect(out.find((s) => s.id === 'ahead-p1').level).toBe(1);
  });

  it('领先 ≤2 不建议，避免噪音', () => {
    store.projects = [seedProject()];
    store.gitCache.p1 = { status: { dirty: 0, ahead: 2, behind: 0, branch: 'main' } };
    expect(buildSuggestions().find((s) => s.id === 'ahead-p1')).toBeUndefined();
  });

  it('服务运行中给出建议，有端口时 action 为打开页面', () => {
    // projectPorts 依赖真实端口扫描的进程名；这里直接把匹配逻辑的最小事实摆好：
    // 脚本 cmd 为 npm run dev → names 集合 {npm}，端口进程名包含 npm 才会命中
    store.projects = [seedProject({
      scripts: [{ id: 's1', name: 'dev', cmd: 'npm run dev', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true };
    store.sys = { ports: [{ port: 3000, names: ['npm'] }] };
    const out = buildSuggestions();
    const run = out.find((s) => s.id === 'run-p1');
    expect(run).toBeTruthy();
    expect(run.action.type).toBe('open');
    expect(run.action.url).toBe('http://localhost:3000');
  });

  it('服务运行但端口无法关联时 action 为查看项目', () => {
    store.projects = [seedProject({
      scripts: [{ id: 's1', name: 'dev', cmd: 'npm run dev', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true };
    store.sys = { ports: [{ port: 3000, names: ['java'] }] };
    const run = buildSuggestions().find((s) => s.id === 'run-p1');
    expect(run.action.type).toBe('detail');
  });

  it('自动任务最近失败触发紧急建议', () => {
    store.projects = [seedProject({
      tasks: [{ id: 't1', name: 'deploy', enabled: true, log: [{ ok: false }] }],
    })];
    const out = buildSuggestions();
    const fail = out.find((s) => s.id === 'taskfail-p1');
    expect(fail.level).toBe(2);
    expect(fail.action.type).toBe('tasks');
  });

  it('14 天未打开且无服务运行时提示整理', () => {
    store.projects = [seedProject({ lastOpened: daysAgo(20), createdAt: daysAgo(20) })];
    const out = buildSuggestions();
    const idle = out.find((s) => s.id === 'idle-p1');
    expect(idle).toBeTruthy();
    expect(idle.level).toBe(0);
  });

  it('有运行中服务时不提示长期未动', () => {
    store.projects = [seedProject({
      lastOpened: daysAgo(20),
      scripts: [{ id: 's1', name: 'dev', cmd: 'node server.js', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true };
    expect(buildSuggestions().find((s) => s.id === 'idle-p1')).toBeUndefined();
  });

  it('全部干净时输出 clean 汇总建议', () => {
    store.projects = [seedProject(), seedProject({ id: 'p2', name: 'b' })];
    store.gitCache.p1 = { status: { dirty: 0, ahead: 0, behind: 0, branch: 'main' } };
    store.gitCache.p2 = { status: { dirty: 0, ahead: 0, behind: 0, branch: 'main' } };
    store.sys = { ports: [] };
    const out = buildSuggestions();
    expect(out.find((s) => s.id === 'clean')).toBeTruthy();
  });

  it('建议按等级排序（紧急在前）且最多 8 条', () => {
    const projects = [];
    for (let i = 0; i < 12; i++) {
      const id = 'p' + i;
      projects.push(seedProject({ id, name: 'n' + i, lastOpened: daysAgo(20), createdAt: daysAgo(20) }));
      store.gitCache[id] = { status: { dirty: 10, ahead: 0, behind: 2, branch: 'main' } };
    }
    store.projects = projects;
    const out = buildSuggestions();
    expect(out.length).toBeLessThanOrEqual(8);
    const levels = out.map((s) => s.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });
});
