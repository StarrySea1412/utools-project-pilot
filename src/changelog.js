// changelog.js — Changelog / Release notes 生成：tag 区间收集 + 分组 + AI 提示词（纯逻辑可测）

// Conventional Commits type → {label, 顺序}：feat 放最前，其余固定序，未知类型沉底
const TYPE_ORDER = {
  feat: { label: '新增', rank: 0 },
  fix: { label: '修复', rank: 1 },
  perf: { label: '性能', rank: 2 },
  refactor: { label: '重构', rank: 3 },
  docs: { label: '文档', rank: 4 },
  test: { label: '测试', rank: 5 },
  build: { label: '构建', rank: 6 },
  ci: { label: 'CI', rank: 7 },
  chore: { label: '杂项', rank: 8 },
  style: { label: '样式', rank: 9 },
};

export function commitType(subject) {
  const m = String(subject || '').match(/^\s*(\w+)(?:\([^)]*\))?\s*[:!]/);
  const t = m ? m[1].toLowerCase() : '';
  return TYPE_ORDER[t] ? t : 'other';
}

// 把一段提交按 type 分组并排序；每组保留原始顺序（新→旧）
export function groupByType(commits) {
  const groups = new Map(); // type -> commits[]
  for (const c of commits || []) {
    const t = commitType(c.subject);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(c);
  }
  return [...groups.entries()]
    .map(([type, list]) => ({ type, label: TYPE_ORDER[type]?.label || '其他', commits: list }))
    .sort((a, b) => (TYPE_ORDER[a.type]?.rank ?? 99) - (TYPE_ORDER[b.type]?.rank ?? 99));
}

// 选出 changelog 用的提交：过滤 merge/chore 噪声（chore 保留，merge 丢弃）
export function filterForChangelog(commits) {
  return (commits || []).filter((c) => !/^merge (branch|pull request|remote-tracking)/i.test(String(c.subject || '').trim()));
}

// tag 区间：tags = [{name, hash}]（新→旧）；range = { from: tag名|'', to: tag名|'' }
// commits 必须是新→旧排序（git log 默认）。语义与 git log from..to 一致：(from, to]
//   to 为空 = 最新提交；from 为空 = 一直到底（只受 to 限制）
export function pickRange(commits, tags, range) {
  const list = commits || [];
  if (!list.length) return [];
  const tagHashes = new Map((tags || []).map((t) => [t.name, t.hash]));
  const to = range?.to ? (tagHashes.get(range.to) || null) : null;
  const from = range?.from ? (tagHashes.get(range.from) || null) : null;
  const idxOf = (hash) => (hash ? list.findIndex((c) => c.hash === hash) : -1);
  const toIdx = idxOf(to);
  const fromIdx = idxOf(from);
  // 列表是新→旧。区间 (from, to]：含 to 所指提交、不含 from 所指提交
  const start = toIdx >= 0 ? toIdx : 0;
  // from === to：用户想表达「只看这个 tag 本身的提交」→ 单条
  // from 比 to 新（选反了）或 from 无效：下界到底
  let end;
  if (fromIdx < 0) end = list.length;
  else if (fromIdx === toIdx) end = toIdx + 1;
  else if (fromIdx < toIdx) end = list.length; // 反选保护
  else end = fromIdx;
  return end <= start ? [] : list.slice(start, end);
}

// 组织给 AI 的提交清单文本（带 type 标注，方便模型分组）
export function formatForPrompt(commits, { cap = 300 } = {}) {
  const list = filterForChangelog(commits).slice(0, cap);
  return list.map((c) => {
    const t = commitType(c.subject);
    const tag = t !== 'other' ? `[${t}] ` : '';
    const scope = c.body ? ` — ${String(c.body).replace(/\s+/g, ' ').slice(0, 100)}` : '';
    return `- ${tag}${c.subject} (${c.author}, ${String(c.date).slice(0, 10)})${scope}`;
  }).join('\n');
}

// AI 提示词
export function changelogPrompt({ from, to, version }) {
  const scope = version ? `版本 ${version}` : (from ? `自 ${from} 之后` : '项目开始以来');
  const upper = to ? `到 ${to}` : '至今';
  const sys =
    '你是负责开源项目 Release Notes 的技术写作助手。根据给出的提交记录，输出一份中文 Changelog（Markdown）。要求：' +
    '1) 按类型分组（🚀 新增 / 🐛 修复 / ⚡ 性能 / 🧹 其他），只保留对使用者有意义的条目，合并重复项；' +
    '2) 每条一句话说清「做了什么、带来什么」，面向使用者而非开发者流水账；' +
    '3) 没有提交的类型整组省略，不要输出空标题；' +
    '4) 只依据给出的记录，不要编造。第一行是 `## ' + (version || 'Changelog') + '` 标题。';
  const user = `范围：${scope}的提交${upper}。请生成 Changelog。`;
  return { sys, user };
}

// 解析模型返回：剥掉可能的代码围栏，标题不替换（保留模型写的版本号行）
export function parseChangelog(raw) {
  let s = String(raw || '').replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!s) throw new Error('AI 返回为空');
  return s;
}
