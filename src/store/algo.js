// store/algo.js — 刷题领航域：进度持久化 / 每日推荐 / 连续打卡 / 分类统计
// 纯逻辑（algoStreak / pickDaily / algoStats）不碰 store，导出给 tests/algo.test.mjs 直测。
import { store, today } from './state.js';
import { BANK } from '../algo/bank.js';

const dayOf = (ts) => {
  const x = new Date(ts);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function saveAlgo() {
  try { window.pilot?.dbPut('pilot:algo', { progress: store.algo.progress, log: store.algo.log, redo: store.algo.redo, goal: store.algo.goal }); }
  catch (e) { console.error('保存刷题进度失败', e); }
}

export function markDone(slug, done = true) {
  const rec = store.algo.progress[slug] || {};
  if (!!rec.done === done) return;
  if (done) {
    store.algo.progress[slug] = { ...rec, done: true, doneAt: Date.now() };
    const d = today();
    store.algo.log = { ...store.algo.log, [d]: (store.algo.log[d] || 0) + 1 };
    // 完成后自动移出重做队列
    if (store.algo.redo.includes(slug)) store.algo.redo = store.algo.redo.filter((s) => s !== slug);
  } else {
    store.algo.progress[slug] = { ...rec, done: false, doneAt: 0 };
    // 只有当天完成的题才回退今日计数（昨天完成的 Undo 不动昨天）
    if (rec.doneAt && dayOf(rec.doneAt) === today()) {
      const d = today();
      store.algo.log = { ...store.algo.log, [d]: Math.max(0, (store.algo.log[d] || 0) - 1) };
    }
  }
  saveAlgo();
}

export function toggleRedo(slug) {
  const redo = store.algo.redo;
  store.algo.redo = redo.includes(slug) ? redo.filter((s) => s !== slug) : [...redo, slug];
  saveAlgo();
}

export function setNote(slug, note) {
  store.algo.progress[slug] = { ...(store.algo.progress[slug] || {}), note: String(note || '') };
  saveAlgo();
}

export function setGoal(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return;
  store.algo.goal = Math.max(1, Math.min(5, v));
  saveAlgo();
}

// ---------- 纯逻辑（直测） ----------

// 连续打卡：从 refDate 往前数 log 有完成记录的连续天数；今天还没刷不算断（从昨天起算）
export function algoStreak(log, refDate) {
  const set = new Set(Object.keys(log || {}).filter((k) => (log[k] || 0) > 0));
  const step = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  let cur = step(refDate);
  if (!set.has(fmt(cur))) cur = new Date(cur.getTime() - 86400e3);
  let n = 0;
  while (set.has(fmt(cur))) { n++; cur = new Date(cur.getTime() - 86400e3); }
  return n;
}

// 每日推荐：同一天结果稳定（重复打开不换题）；重做队列优先（最多占一半名额），其余按
// 「日期种子决定起始分类 + 分类轮转」选取——保证跨天有变化、长期覆盖各分类。
export function pickDaily(bank, progress, redo, dateStr, goal = 2) {
  const done = (s) => !!progress?.[s]?.done;
  const redoSet = new Set(redo || []);
  const pool = bank.filter((p) => !done(p.slug));
  const pick = [];

  const redoSorted = pool.filter((p) => redoSet.has(p.slug)).sort((a, b) => a.n - b.n);
  pick.push(...redoSorted.slice(0, Math.min(redoSorted.length, Math.max(1, Math.floor(goal / 2)))));

  const byCat = new Map();
  for (const p of pool) {
    if (redoSet.has(p.slug) || pick.includes(p)) continue;
    if (!byCat.has(p.c)) byCat.set(p.c, []);
    byCat.get(p.c).push(p);
  }
  const cats = [...byCat.keys()];
  const seed = [...dateStr].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  let i = cats.length ? seed % cats.length : 0;
  for (let round = 0; round < cats.length && pick.length < goal; round++) {
    const next = byCat.get(cats[i]).sort((a, b) => a.n - b.n)[0];
    if (next) pick.push(next);
    i = (i + 1) % cats.length;
  }
  // 分类耗尽（极小题库场景）：任意未做补位
  if (pick.length < goal) {
    for (const p of pool.sort((a, b) => a.n - b.n)) {
      if (pick.length >= goal) break;
      if (!pick.includes(p)) pick.push(p);
    }
  }
  return pick.slice(0, goal);
}

export function algoStats(progress, bank = BANK) {
  const byType = {};
  for (const p of bank) {
    const t = (byType[p.c] = byType[p.c] || { total: 0, done: 0 });
    t.total++;
    if (progress?.[p.slug]?.done) t.done++;
  }
  return { total: bank.length, done: bank.filter((p) => progress?.[p.slug]?.done).length, byType };
}
