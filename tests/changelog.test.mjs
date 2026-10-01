// changelog.test.mjs — Changelog 生成纯逻辑单测（区间切片 / 分组 / 提示词 / 解析）
import { describe, it, expect } from 'vitest';
import { commitType, groupByType, filterForChangelog, pickRange, formatForPrompt, changelogPrompt, parseChangelog } from '../src/changelog.js';

// commits：新→旧（模拟 git log）
const mk = (hash, subject, extra = {}) => ({ hash, subject, author: 'you', date: '2026-10-01T10:00:00+08:00', body: '', ...extra });
const LOG = [
  mk('h9', 'feat(v1.12): changelog 生成'),
  mk('h8', 'fix: 下拉遮挡'),
  mk('h7', 'chore: 版本对齐'),
  mk('h6', 'Merge branch "feature/x" into main'),
  mk('h5', 'feat(archive): 归档'),
  mk('h4', 'docs: readme'),
  mk('h3', 'feat(v1.10): 健康探测'),
  mk('h2', 'refactor: store'),
  mk('h1', 'init'),
];
const TAGS = [
  { name: 'v1.12', hash: 'h9' },
  { name: 'v1.11', hash: 'h5' },
  { name: 'v1.10', hash: 'h3' },
];

describe('commitType / groupByType', () => {
  it('识别带 scope 与不带的 Conventional Commits', () => {
    expect(commitType('feat(x): a')).toBe('feat');
    expect(commitType('FIX: b')).toBe('fix');
    expect(commitType('refactor!: c')).toBe('refactor');
    expect(commitType('随便写的提交')).toBe('other');
  });

  it('分组按 TYPE_ORDER rank 排序，组内保持原顺序', () => {
    const g = groupByType(LOG);
    expect(g.map((x) => x.type)).toEqual(['feat', 'fix', 'refactor', 'docs', 'chore', 'other']);
    const feat = g.find((x) => x.type === 'feat');
    expect(feat.commits.map((c) => c.hash)).toEqual(['h9', 'h5', 'h3']);
    expect(g.find((x) => x.type === 'other').commits.map((c) => c.hash)).toEqual(['h6', 'h1']);
  });

  it('filterForChangelog 丢弃 merge 提交', () => {
    const kept = filterForChangelog(LOG);
    expect(kept.some((c) => c.hash === 'h6')).toBe(false);
    expect(kept).toHaveLength(LOG.length - 1);
  });
});

describe('pickRange tag 区间切片', () => {
  it('from v1.11 → to v1.12：左开右闭，含 h9 不含 h5', () => {
    const r = pickRange(LOG, TAGS, { from: 'v1.11', to: 'v1.12' });
    expect(r.map((c) => c.hash)).toEqual(['h9', 'h8', 'h7', 'h6']);
  });

  it('from 空 → to v1.11：从头（含 h1）到 v1.11（含）', () => {
    const r = pickRange(LOG, TAGS, { from: '', to: 'v1.11' });
    expect(r.map((c) => c.hash)).toEqual(['h5', 'h4', 'h3', 'h2', 'h1']);
  });

  it('from v1.10 → to 空：v1.10 之后到最新', () => {
    const r = pickRange(LOG, TAGS, { from: 'v1.10', to: '' });
    expect(r.map((c) => c.hash)).toEqual(['h9', 'h8', 'h7', 'h6', 'h5', 'h4']);
  });

  it('from = to：只剩 to 所指一条', () => {
    const r = pickRange(LOG, TAGS, { from: 'v1.12', to: 'v1.12' });
    expect(r.map((c) => c.hash)).toEqual(['h9']);
  });

  it('无 tag / tag 名不存在：全给（保护行为，UI 侧另有空提示）', () => {
    expect(pickRange(LOG, [], { from: '', to: '' }).map((c) => c.hash)).toEqual(LOG.map((c) => c.hash));
    const r = pickRange(LOG, [], { from: 'nope', to: 'nope' });
    expect(r.map((c) => c.hash)).toEqual(LOG.map((c) => c.hash));
  });

  it('空提交列表安全', () => {
    expect(pickRange([], TAGS, { from: 'v1.10', to: 'v1.12' })).toEqual([]);
  });
});

describe('formatForPrompt / changelogPrompt / parseChangelog', () => {
  it('formatForPrompt：带 [type] 前缀、无 merge、截断 body', () => {
    const s = formatForPrompt([mk('h1', 'feat: x', { body: '很长的说明'.repeat(30) }), mk('h2', 'Merge branch "x"'), mk('h3', '普通提交')]);
    const lines = s.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('- [feat] feat: x')).toBe(true);
    expect(lines[1].startsWith('- 普通')).toBe(true);
    expect(lines[0].length).toBeLessThan(160);
  });

  it('提示词包含范围与版本号', () => {
    const p = changelogPrompt({ from: 'v1.11', to: 'v1.12', version: 'v1.12.0' });
    expect(p.sys).toContain('Release Notes');
    expect(p.user).toContain('v1.12');
    const p2 = changelogPrompt({ from: '', to: '', version: '' });
    expect(p2.user).toContain('项目开始以来');
    // 无版本号时范围要带出 from/to
    const p3 = changelogPrompt({ from: 'v1.11', to: 'v1.12', version: '' });
    expect(p3.user).toContain('v1.11');
    expect(p3.user).toContain('v1.12');
  });

  it('parseChangelog 剥代码围栏，空内容报错', () => {
    expect(parseChangelog('```markdown\n## v1\n- a\n```')).toBe('## v1\n- a');
    expect(parseChangelog('## v1\n- a')).toBe('## v1\n- a');
    expect(() => parseChangelog('  \n')).toThrow();
  });
});
