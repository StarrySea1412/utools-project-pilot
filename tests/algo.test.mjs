// algo.test.mjs — 刷题领航纯逻辑直测（streak / 每日推荐 / 统计）+ store 动作（内存 stub）
import { describe, it, expect, beforeEach } from 'vitest';

// 先布好 window.pilot stub（同 store.test.mjs 手法）
const memdb = new Map();
globalThis.window = {
  pilot: {
    dbGet: (k) => memdb.get(k) ?? null,
    dbPut: (k, v) => { memdb.set(k, v); },
    notify() {},
  },
};

const { store, markDone, toggleRedo, setNote, setGoal, algoStreak, pickDaily, algoStats } = await import('../src/store.js');
const { BANK } = await import('../src/algo/bank.js');

describe('algoStreak 连续打卡', () => {
  it('连续 N 天有记录 → N', () => {
    const log = { '2026-10-04': 2, '2026-10-05': 1, '2026-10-06': 1 };
    expect(algoStreak(log, '2026-10-06')).toBe(3);
  });

  it('今天还没刷不断签：从昨天起算', () => {
    const log = { '2026-10-04': 2, '2026-10-05': 1 };
    expect(algoStreak(log, '2026-10-06')).toBe(2);
  });

  it('中间断一天即归零', () => {
    const log = { '2026-10-02': 1, '2026-10-04': 1, '2026-10-05': 1 };
    expect(algoStreak(log, '2026-10-05')).toBe(2);
  });

  it('空记录为 0', () => {
    expect(algoStreak({}, '2026-10-06')).toBe(0);
  });
});

describe('pickDaily 每日推荐', () => {
  it('同一天重复调用结果稳定', () => {
    const a = pickDaily(BANK, {}, [], '2026-10-06', 2);
    const b = pickDaily(BANK, {}, [], '2026-10-06', 2);
    expect(a.map((p) => p.slug)).toEqual(b.map((p) => p.slug));
  });

  it('不推荐已完成的题', () => {
    const progress = Object.fromEntries(BANK.slice(0, 20).map((p) => [p.slug, { done: true }]));
    const picks = pickDaily(BANK, progress, [], '2026-10-06', 3);
    expect(picks).toHaveLength(3);
    for (const p of picks) expect(progress[p.slug]?.done).toBeFalsy();
  });

  it('重做队列优先（占一半名额），且完成后移出推荐', () => {
    const redo = [BANK[50].slug];
    const picks = pickDaily(BANK, {}, redo, '2026-10-06', 2);
    expect(picks[0].slug).toBe(BANK[50].slug);
  });

  it('不同日期推荐有变化（分类轮转）', () => {
    const s1 = pickDaily(BANK, {}, [], '2026-10-06', 2).map((p) => p.slug).join();
    const s2 = pickDaily(BANK, {}, [], '2026-10-07', 2).map((p) => p.slug).join();
    expect(s1).not.toEqual(s2);
  });

  it('推荐数量不超过 goal，且题库耗尽时不越界', () => {
    expect(pickDaily(BANK, {}, [], '2026-10-06', 5)).toHaveLength(5);
    const tiny = BANK.slice(0, 1);
    expect(pickDaily(tiny, {}, [], '2026-10-06', 5)).toHaveLength(1);
  });
});

describe('algoStats 统计', () => {
  it('总数与分类计数正确', () => {
    const s = algoStats({}, BANK);
    expect(s.total).toBe(BANK.length);
    const hashCat = BANK.filter((p) => p.c === 'hash').length;
    expect(s.byType.hash.total).toBe(hashCat);
    expect(s.byType.hash.done).toBe(0);
  });

  it('完成计入对应分类', () => {
    const target = BANK.find((p) => p.c === 'hash');
    const s = algoStats({ [target.slug]: { done: true } }, BANK);
    expect(s.done).toBe(1);
    expect(s.byType.hash.done).toBe(1);
  });
});

describe('store 动作（内存 stub）', () => {
  beforeEach(() => {
    store.algo = { progress: {}, log: {}, redo: [], goal: 2 };
    memdb.clear();
  });

  it('markDone 写进度 + 今日 log + 持久化', () => {
    const slug = BANK[0].slug;
    markDone(slug);
    expect(store.algo.progress[slug].done).toBe(true);
    expect(Object.values(store.algo.log).reduce((a, b) => a + b, 0)).toBe(1);
    expect(memdb.get('pilot:algo').progress[slug].done).toBe(true);
  });

  it('undo 只回退当天完成的计数', () => {
    const slug = BANK[0].slug;
    markDone(slug);
    markDone(slug, false);
    expect(store.algo.progress[slug].done).toBe(false);
    // 今日计数归零（而不是删掉今天的键）
    const todayStr = Object.keys(store.algo.log)[0];
    expect(todayStr).toBeTruthy();
    expect(store.algo.log[todayStr]).toBe(0);
  });

  it('完成自动移出重做队列', () => {
    const slug = BANK[3].slug;
    toggleRedo(slug);
    expect(store.algo.redo).toContain(slug);
    markDone(slug);
    expect(store.algo.redo).not.toContain(slug);
  });

  it('setNote / setGoal 持久化且 goal 有边界', () => {
    setNote(BANK[1].slug, '双指针收缩');
    expect(store.algo.progress[BANK[1].slug].note).toBe('双指针收缩');
    setGoal(99);
    expect(store.algo.goal).toBe(5);
    setGoal(0);
    expect(store.algo.goal).toBe(1);
  });
});
