// git-deep.js — Git 深水区纯逻辑：blame 解析 / 冲突块解析与合并 / hunk 拆分（全部可单测）
// preload 只负责跑 git 命令拿原始输出，解析规则集中在这里。

// ---------- blame ----------
// git blame --porcelain 输出解析：
//   <hash> <origLine> <finalLine> [<numLines>]
//   author / author-mail / author-time / summary …，下一个 hash 行属于下一块
// 聚合为行级：lines: [{ no, code, hash, short, author, date, summary }] + 按作者/提交的统计
export function parseBlame(porcelain) {
  const lines = String(porcelain || '').split('\n');
  const out = [];
  let cur = null;
  for (const line of lines) {
    const head = line.match(/^([0-9a-f]{40}) (\d+) (\d+)(?: (\d+))?$/);
    if (head) {
      cur = { hash: head[1], no: +head[3], author: '', time: 0, summary: '', count: +head[4] || 1 };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('\t')) {
      out.push({ no: cur.no, code: line.slice(1), hash: cur.hash, short: cur.hash.slice(0, 8), author: cur.author, date: cur.time ? new Date(cur.time * 1000).toISOString().slice(0, 10) : '', summary: cur.summary });
      cur.no++;
    } else if (line.startsWith('author ')) cur.author = line.slice(7);
    else if (line.startsWith('author-time ')) cur.time = +line.slice(12) || 0;
    else if (line.startsWith('summary ')) cur.summary = line.slice(8);
  }
  // 统计：作者行数占比 + 最近改动热度
  const byAuthor = new Map();
  for (const l of out) byAuthor.set(l.author, (byAuthor.get(l.author) || 0) + 1);
  const authors = [...byAuthor.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { lines: out, total: out.length, authors };
}

// ---------- 冲突块 ----------
// 统一 diff 冲突标记（<<<<<<< ours / ======= / >>>>>>> theirs）解析成块列表；
// base 段（||||||| base，diff3 风格）可能存在也可能没有。
export function parseConflicts(text) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let state = 0; // 0 无冲突 1 ours 2 base 3 theirs
  let cur = null;
  let no = 1;
  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) { cur = { start: no, ours: [], base: [], theirs: [], oursEnd: 0, sep: 0 }; state = 1; no++; continue; }
    if (cur && line.startsWith('|||||||')) { state = 2; no++; continue; }
    if (cur && line.startsWith('=======') && state !== 0) {
      // 只在冲突标记语境认分隔符：非冲突状态下的 ======= 是普通文本行
      if (state === 1) cur.oursEnd = no - 1;
      cur.sep = no; state = 3; no++; continue;
    }
    if (cur && line.startsWith('>>>>>>>')) { cur.end = no; blocks.push(cur); cur = null; state = 0; no++; continue; }
    if (cur) {
      if (state === 1) cur.ours.push(line);
      else if (state === 2) cur.base.push(line);
      else if (state === 3) cur.theirs.push(line);
    }
    no++;
  }
  return blocks;
}

// 冲突文件文本按块决议重写：resolution: 'ours' | 'theirs' | 'base'（块序号对齐 parseConflicts 返回顺序）
export function resolveConflicts(text, blocks, picks) {
  if (!blocks.length) return String(text || '');
  const lines = String(text || '').split('\n');
  // 从后往前替换，避免行号位移
  const ordered = blocks.map((b, i) => ({ b, pick: picks[i] })).sort((x, y) => y.b.start - x.b.start);
  for (const { b, pick } of ordered) {
    if (!pick) continue;
    const chosen = pick === 'ours' ? b.ours : pick === 'theirs' ? b.theirs : b.base;
    // start 是 '<<<<<<<' 行号（1 基），end 是 '>>>>>>>' 行号；替换为所选内容（无标记行）
    lines.splice(b.start - 1, b.end - b.start + 1, ...chosen);
  }
  return lines.join('\n');
}

// ---------- hunk 拆分（暂存部分变更用） ----------
// unified diff 文本 → [{ header, lines: string[] }]；header 为 @@ 行
export function splitHunks(diffText) {
  const lines = String(diffText || '').split('\n');
  const hunks = [];
  let cur = null;
  for (const l of lines) {
    if (l.startsWith('@@')) { cur = { header: l, lines: [] }; hunks.push(cur); }
    else if (cur) cur.lines.push(l);
  }
  return hunks;
}

// 选中的 hunk 子集 → 可直接喂 git apply --cached 的补丁文本
// 要求保留 diff 头（diff --git / index / --- / +++），后接所选 hunk
export function buildPatch(fileHeader, hunks, pickedIdx) {
  const chosen = hunks.filter((_, i) => pickedIdx.includes(i));
  if (!chosen.length) return '';
  return [fileHeader, ...chosen.map((h) => [h.header, ...h.lines].join('\n'))].join('\n') + '\n';
}

// hunk 里的行分类渲染辅助：add / del / ctx
export function hunkLineCls(l) {
  if (l.startsWith('+')) return 'add';
  if (l.startsWith('-')) return 'del';
  return '';
}
