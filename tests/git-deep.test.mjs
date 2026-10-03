// git-deep.test.mjs — Git 深水区纯逻辑单测：blame 解析 / 冲突块解析与决议 / hunk 拆分与补丁
import { describe, it, expect } from 'vitest';
import { parseBlame, parseConflicts, resolveConflicts, splitHunks, buildPatch, hunkLineCls } from '../src/git-deep.js';

// ---------- fixture：真实 porcelain blame 的最小样例 ----------
const BLAME = [
  'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e 1 1 2',
  'author 张三',
  'author-time 1750000000',
  'summary 初始提交',
  '\tconst a = 1;',
  '\tconst b = 2;',
  'f1e2d3c4b5a6978869706152434445464748494a 3 3 1',
  'author 李四',
  'author-time 1760000000',
  'summary 改 b 的语义',
  '\tconst b = 3;',
].join('\n');

describe('parseBlame porcelain 解析', () => {
  it('行级聚合：行号连续、作者/日期/摘要就位', () => {
    const r = parseBlame(BLAME);
    expect(r.total).toBe(3);
    expect(r.lines[0]).toMatchObject({ no: 1, code: 'const a = 1;', author: '张三', summary: '初始提交' });
    expect(r.lines[1]).toMatchObject({ no: 2, code: 'const b = 2;', author: '张三' });
    expect(r.lines[2]).toMatchObject({ no: 3, code: 'const b = 3;', author: '李四', summary: '改 b 的语义' });
    expect(r.lines[0].short).toBe('a1b2c3d4');
  });

  it('作者统计按行数排序', () => {
    const r = parseBlame(BLAME);
    expect(r.authors).toEqual([{ name: '张三', count: 2 }, { name: '李四', count: 1 }]);
  });

  it('空输入安全', () => {
    const r = parseBlame('');
    expect(r.total).toBe(0);
    expect(r.lines).toEqual([]);
  });
});

// ---------- fixture：两块冲突（含 diff3 base 段） ----------
const CONFLICT = [
  '正常行 A',
  '<<<<<<< HEAD',
  '我们的实现',
  '第二行',
  '||||||| merged common ancestors',
  '旧的实现',
  '=======',
  '他们的实现',
  '>>>>>>> feature',
  '正常行 B',
].join('\n');

describe('parseConflicts / resolveConflicts', () => {
  const blocks = parseConflicts(CONFLICT);
  it('识别冲突块：ours/base/theirs 内容与边界', () => {
    expect(blocks).toHaveLength(1);
    const b = blocks[0];
    expect(b.ours).toEqual(['我们的实现', '第二行']);
    expect(b.base).toEqual(['旧的实现']);
    expect(b.theirs).toEqual(['他们的实现']);
    expect(b.start).toBe(2);   // '<<<<<<<' 在第 2 行
    expect(b.end).toBe(9);      // '>>>>>>>' 在第 9 行
  });

  it('采用 ours：标记行消失、内容替换', () => {
    const out = resolveConflicts(CONFLICT, blocks, ['ours']);
    const lines = out.split('\n');
    expect(lines).toEqual(['正常行 A', '我们的实现', '第二行', '正常行 B']);
    expect(out.includes('<<<')).toBe(false);
  });

  it('采用 theirs / base：各自内容', () => {
    expect(resolveConflicts(CONFLICT, blocks, ['theirs']).split('\n')).toEqual(['正常行 A', '他们的实现', '正常行 B']);
    expect(resolveConflicts(CONFLICT, blocks, ['base']).split('\n')).toEqual(['正常行 A', '旧的实现', '正常行 B']);
  });

  it('无冲突文本原样返回；无决议（pick 空）不动', () => {
    expect(resolveConflicts('abc\ndef', [], [])).toBe('abc\ndef');
    expect(resolveConflicts(CONFLICT, blocks, [null])).toBe(CONFLICT);
  });

  it('多块冲突：块间互不影响（从后往前替换防位移）', () => {
    const TWO = ['x', '<<<<<<< H', 'o1', '=======', 't1', '>>>>>>> f', 'y', '<<<<<<< H', 'o2', '=======', 't2', '>>>>>>> f', 'z'].join('\n');
    const bs = parseConflicts(TWO);
    expect(bs).toHaveLength(2);
    const out = resolveConflicts(TWO, bs, ['ours', 'theirs']);
    expect(out.split('\n')).toEqual(['x', 'o1', 'y', 't2', 'z']);
  });

  it('无冲突文本 parseConflicts 返回空数组', () => {
    expect(parseConflicts('正常内容')).toEqual([]);
  });
});

// ---------- fixture：两个 hunk 的 diff ----------
const DIFF = [
  'diff --git a/src/app.js b/src/app.js',
  'index 1234567..89abcde 100644',
  '--- a/src/app.js',
  '+++ b/src/app.js',
  '@@ -1,3 +1,4 @@',
  ' const a = 1;',
  '+const b = 2;',
  ' const c = 3;',
  '@@ -10,2 +11,2 @@',
  '-const old = 1;',
  '+const new1 = 1;',
  ' const tail;',
].join('\n');

describe('splitHunks / buildPatch / hunkLineCls', () => {
  const hunks = splitHunks(DIFF);
  it('按 @@ 拆 hunk，头 4 行不进 hunk', () => {
    expect(hunks).toHaveLength(2);
    expect(hunks[0].header).toBe('@@ -1,3 +1,4 @@');
    expect(hunks[0].lines).toEqual([' const a = 1;', '+const b = 2;', ' const c = 3;']);
    expect(hunks[1].lines).toEqual(['-const old = 1;', '+const new1 = 1;', ' const tail;']);
  });

  it('buildPatch：选中 hunk 拼回完整补丁（含 diff 头）', () => {
    const header = DIFF.split('\n').slice(0, 4).join('\n');
    const p1 = buildPatch(header, hunks, [0]);
    expect(p1.startsWith('diff --git')).toBe(true);
    expect(p1.includes('@@ -1,3 +1,4 @@')).toBe(true);
    expect(p1.includes('@@ -10,2')).toBe(false);
    const p2 = buildPatch(header, hunks, [0, 1]);
    expect(p2.includes('@@ -10,2 +11,2 @@')).toBe(true);
  });

  it('空选择返回空串', () => {
    expect(buildPatch('diff --git', hunks, [])).toBe('');
  });

  it('行分类：+add / -del / 其余 ctx', () => {
    expect(hunkLineCls('+x')).toBe('add');
    expect(hunkLineCls('-y')).toBe('del');
    expect(hunkLineCls(' z')).toBe('');
  });
});
