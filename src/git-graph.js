// git-graph.js — 轻量提交拓扑分道（lazygit 风格）
// 输入：git log 出的提交数组（需含 parents 空格分隔的父哈希，可缺省）
// 输出：每行的 {lane 点位, tops 顶部入线, edges 底部出线, merges 收束源} + maxLanes
const PALETTE = ['#6ea8fe', '#3fb27f', '#e8a13a', '#c678dd', '#e05e5e', '#45c5c8'];
export const graphColor = (lane) => PALETTE[((lane % PALETTE.length) + PALETTE.length) % PALETTE.length];

export function computeGraph(commits) {
  const heads = []; // lane -> 下一行期待的 hash（null = 本行刚被占用/已释放）
  const free = [];  // 可复用的道
  const rows = [];
  let maxLanes = 1;
  const alloc = () => {
    while (free.length) { const i = free.pop(); heads[i] = null; return i; }
    heads.push(null);
    return heads.length - 1;
  };
  for (const c of commits) {
    const parents = String(c.parents || '').split(' ').filter(Boolean);
    const tops = heads.map((h, t) => ({ t, merge: false }));
    // 汇聚到本提交的所有道（合并提交时多条收束为一条）
    const mine = [];
    heads.forEach((h, t) => { if (h === c.hash) mine.push(t); });
    let lane;
    if (mine.length) {
      lane = mine[0];
      for (const t of mine.slice(1)) { tops[t].merge = true; free.push(t); heads[t] = null; }
    } else {
      lane = alloc(); // 截断显示时中途出现的提交：新开道
    }
    const edges = [];
    if (parents[0]) edges.push({ from: lane, to: lane });
    // 第二父：入已有道（对角线）或开新道（分支）
    if (parents[1]) {
      const ex = heads.findIndex((h, t) => h === parents[1] && t !== lane);
      if (ex >= 0) edges.push({ from: lane, to: ex });
      else { const l = alloc(); heads[l] = parents[1]; edges.push({ from: lane, to: l }); }
    }
    // 第一父继承本道；无父（根提交）释放本道
    if (parents[0]) heads[lane] = parents[0];
    else { heads[lane] = null; free.push(lane); }
    // 等待中的其它道：纵向贯穿
    heads.forEach((h, t) => {
      if (h !== null && !edges.some((e) => e.to === t)) edges.push({ from: t, to: t });
    });
    maxLanes = Math.max(maxLanes, heads.length);
    rows.push({ hash: c.hash, lane, tops, edges });
  }
  return { rows, maxLanes: Math.max(1, maxLanes, heads.length) };
}
