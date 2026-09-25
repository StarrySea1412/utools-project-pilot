// sort.test.mjs — 排序 / 置顶纯函数单测
import { describe, it, expect } from 'vitest';

const { sortProjects, togglePin } = await import('../src/store.js');

// store.js 顶层会碰 window.pilot（import 时 store 定义不执行 IO），测试里给个空 stub
globalThis.window = globalThis.window || {};
globalThis.window.pilot = globalThis.window.pilot || { dbGet() { return null; }, dbPut() {} };

const mk = (id, name, over = {}) => Object.assign({ id, name, tags: [], scripts: [], tasks: [], lastOpened: 0, createdAt: 0, pinned: false }, over);
const hoursAgo = (h) => Date.now() - h * 3600e3;

describe('sortProjects 排序', () => {
  it('recent：按最近使用倒序', () => {
    const ps = [mk('a', 'a', { lastOpened: hoursAgo(5) }), mk('b', 'b', { lastOpened: hoursAgo(1) }), mk('c', 'c', { lastOpened: hoursAgo(9) })];
    expect(sortProjects(ps, {}, 'recent').map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('name：按名称', () => {
    const ps = [mk('x', 'zeta'), mk('y', 'alpha'), mk('z', 'mid')];
    expect(sortProjects(ps, {}, 'name').map((p) => p.name)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('dirty：变更多的在前', () => {
    const ps = [mk('a', 'a'), mk('b', 'b'), mk('c', 'c')];
    const gc = { a: { status: { dirty: 1 } }, b: { status: { dirty: 9 } }, c: { status: { dirty: 4 } } };
    expect(sortProjects(ps, gc, 'dirty').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('updated：按最后提交时间', () => {
    const ps = [mk('a', 'a'), mk('b', 'b')];
    const gc = { a: { lastCommitAt: 100 }, b: { lastCommitAt: 900 } };
    expect(sortProjects(ps, gc, 'updated').map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('tag：按第一个标签，无标签排最后', () => {
    const ps = [mk('a', 'a'), mk('b', 'b', { tags: ['dev'] }), mk('c', 'c', { tags: ['alpha'] })];
    expect(sortProjects(ps, {}, 'tag').map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('置顶', () => {
  it('pinned 项目浮到最前，其余保持排序', () => {
    const ps = [
      mk('a', 'a', { lastOpened: hoursAgo(1) }),
      mk('b', 'b', { lastOpened: hoursAgo(2), pinned: true }),
      mk('c', 'c', { lastOpened: hoursAgo(3) }),
    ];
    expect(sortProjects(ps, {}, 'recent').map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('多个置顶按当前排序键排，仍全部在前', () => {
    const ps = [
      mk('a', 'a', { pinned: true, lastOpened: hoursAgo(9) }),
      mk('b', 'b', { pinned: true, lastOpened: hoursAgo(1) }),
      mk('c', 'c'),
    ];
    // recent 排序下，置顶组内也按最近使用排序（b 更近）
    expect(sortProjects(ps, {}, 'recent').map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
});
