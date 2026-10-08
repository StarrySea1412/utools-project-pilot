// doctor.test.mjs — 体检规则评分 / AI 报告解析 / store 动作（按天缓存）
import { describe, it, expect, beforeEach } from 'vitest';

// 先布 window.pilot stub（同 algo.test.mjs 手法）
const memdb = new Map();
globalThis.window = {
  pilot: {
    dbGet: (k) => memdb.get(k) ?? null,
    dbPut: (k, v) => { memdb.set(k, v); },
  },
};

const { ruleCheckup, parseDoctorJson, gradeOf, buildDoctorPrompt, SEV_LABEL } = await import('../src/doctor.js');

// ---------- 采集样本构造 ----------
const mkData = (over = {}) => ({
  ok: true, root: 'D:/demo/proj',
  pkg: { name: 'demo', deps: ['vue'], devDeps: ['vitest'], scripts: ['dev', 'test'], hasTestScript: true, hasLintScript: false, packageManager: '' },
  deps: { outdated: [], audit: null, hasLockfile: true, npmAvailable: true, notes: [] },
  todos: { total: 0, byType: {}, samples: [], scannedFiles: 10, truncated: false },
  docs: { readme: { name: 'README.md', bytes: 5000, mtime: Date.now() - 30 * 864e5 }, license: true, changelog: true, docsDir: true },
  tests: { testFiles: 12, dirs: ['tests'] },
  git: { available: true, branch: 'main', ahead: 0, behind: 0, staged: 0, unstaged: 0, untracked: 0, dirty: 0, lastCommitTs: Date.now() - 864e5 },
  notes: [],
  ...over,
});

describe('ruleCheckup 规则评分', () => {
  it('全绿项目 → 高分 + 零改进项', () => {
    const r = ruleCheckup(mkData());
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe('健康');
    expect(r.items).toHaveLength(0);
  });

  it('critical 漏洞 → 依赖健康重扣 + severity=2 改进项', () => {
    const r = ruleCheckup(mkData({ deps: { ...mkData().deps, audit: { critical: 2, high: 0, moderate: 0, low: 0, total: 2 }, outdated: [], hasLockfile: true } }));
    const depDim = r.dims.find((d) => d.name === '依赖健康');
    expect(depDim.score).toBe(17); // 25 - 2×4
    const auditItem = r.items.find((i) => i.id === 'audit');
    expect(auditItem.severity).toBe(2);
    expect(auditItem.title).toContain('2 个依赖漏洞');
  });

  it('缺 lockfile → 扣分 + 1 级改进项', () => {
    const r = ruleCheckup(mkData({ deps: { ...mkData().deps, hasLockfile: false, audit: null } }));
    const lk = r.items.find((i) => i.id === 'lockfile');
    expect(lk).toBeTruthy();
    expect(lk.severity).toBe(1);
  });

  it('无测试 → severity=2 的补测试项，测试维度零分', () => {
    const d = mkData();
    d.tests = { testFiles: 0, dirs: [] };
    d.pkg = { ...d.pkg, hasTestScript: false };
    const r = ruleCheckup(d);
    expect(r.dims.find((x) => x.name === '测试保障').score).toBe(0);
    expect(r.items.find((i) => i.id === 'no-tests')?.severity).toBe(2);
  });

  it('TODO 债 >20 → 评分降级', () => {
    const r = ruleCheckup(mkData({ todos: { total: 30, byType: { TODO: 20, FIXME: 10 }, samples: [{ file: 'a.js', line: 1, type: 'TODO', text: 'x' }], scannedFiles: 50, truncated: false } }));
    expect(r.dims.find((x) => x.name === '代码债').score).toBe(12);
    expect(r.items.find((i) => i.id === 'todos')?.title).toContain('30');
  });

  it('git 卫生：落后远程 → 加分扣减 + 1 级项', () => {
    const r = ruleCheckup(mkData({ git: { available: true, branch: 'main', ahead: 0, behind: 8, staged: 0, unstaged: 0, untracked: 0, dirty: 0, lastCommitTs: Date.now() - 864e5 } }));
    const g = r.dims.find((x) => x.name === 'Git 卫生');
    expect(g.score).toBeLessThan(25);
    expect(r.items.find((i) => i.id === 'behind')?.title).toContain('8');
  });

  it('90 天无提交 → 触发停滞提醒', () => {
    const r = ruleCheckup(mkData({ git: { available: true, branch: 'main', ahead: 0, behind: 0, staged: 0, unstaged: 0, untracked: 0, dirty: 0, lastCommitTs: Date.now() - 100 * 864e5 } }));
    expect(r.items.find((i) => i.id === 'stale')).toBeTruthy();
  });

  it('非 git 仓库 → git 维度给中性 15 分', () => {
    const r = ruleCheckup(mkData({ git: { available: false } }));
    expect(r.dims.find((x) => x.name === 'Git 卫生')).toEqual({ name: 'Git 卫生', score: 15, note: '非 git 仓库' });
  });
});

describe('parseDoctorJson 防御式解析', () => {
  it('JSON 被代码围栏包裹 → 正常解析', () => {
    const j = parseDoctorJson('```json\n{"score": 82, "grade": "良好", "summary": "ok", "dims": [], "items": []}\n```');
    expect(j.score).toBe(82);
  });

  it('score 越界被钳制；非法 severity/effort 回落默认', () => {
    const j = parseDoctorJson(JSON.stringify({
      score: 150, grade: '随便', summary: '', dims: [],
      items: [{ title: 'a', severity: 9, effort: 'XXL', area: 'unknown', detail: '', reason: '' }],
    }));
    expect(j.score).toBe(100);
    expect(j.grade).toBe('健康'); // 非法 grade 用 gradeOf(score) 回推
    expect(j.items[0].severity).toBe(1);
    expect(j.items[0].effort).toBe('M');
    expect(j.items[0].area).toBe('general');
  });

  it('items 按 severity 降序；无 title 的被过滤', () => {
    const j = parseDoctorJson(JSON.stringify({
      score: 50, grade: '', summary: '', dims: [],
      items: [
        { title: '低', severity: 0 }, { title: '', severity: 2 }, { title: '高', severity: 2 }, { title: '中', severity: 1 },
      ],
    }));
    expect(j.items.map((i) => i.title)).toEqual(['高', '中', '低']);
  });

  it('非 JSON → 抛异常', () => {
    expect(() => parseDoctorJson('not json')).toThrow();
  });
});

describe('buildDoctorPrompt / gradeOf / SEV_LABEL', () => {
  it('prompt 里要塞入规则分作为参考', () => {
    const rule = ruleCheckup(mkData());
    const { sys, user } = buildDoctorPrompt(mkData(), rule);
    expect(user).toContain(`本地规则评分参考：${rule.score}`);
    expect(user).toContain('依赖漏洞');
    expect(sys).toContain('JSON');
  });

  it('gradeOf 分档', () => {
    expect(gradeOf(90)).toBe('健康');
    expect(gradeOf(70)).toBe('良好');
    expect(gradeOf(45)).toBe('注意');
    expect(gradeOf(10)).toBe('告急');
  });

  it('SEV_LABEL 齐全', () => {
    expect(Object.keys(SEV_LABEL).sort().join(',')).toBe('0,1,2');
  });
});
