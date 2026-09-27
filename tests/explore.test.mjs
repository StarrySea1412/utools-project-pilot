// explore.test.mjs — 探索模式核心逻辑单测（规则评分 / JSON 解析 / 等级映射）
import { describe, it, expect, beforeEach } from 'vitest';

// 先布好 window.pilot stub（collectExploreContext 会调 identify/fs/git）
globalThis.window = {
  pilot: {
    dbGet: () => null,
    dbPut: () => {},
    notify() {},
    async identify() { return { icon: null, framework: 'Vue' }; },
    fs: {
      async listDir(dir) {
        if (dir.endsWith('src')) return [{ name: 'main.js', dir: false }, { name: 'App.vue', dir: false }];
        return [
          { name: 'package.json', dir: false },
          { name: 'README.md', dir: false },
          { name: 'LICENSE', dir: false },
          { name: 'tests', dir: true },
          { name: 'src', dir: true },
          { name: '.github', dir: true },
          { name: '.eslintrc.json', dir: false },
          { name: 'pnpm-lock.yaml', dir: false },
          { name: '.gitignore', dir: false },
        ];
      },
      async readText(file) {
        if (/README/i.test(file)) return '# 项目\n' + 'x'.repeat(600); // 长 README → 文档高分
        if (/package\.json$/.test(file)) return JSON.stringify({
          name: 'demo', scripts: { dev: 'vite', test: 'vitest' },
          dependencies: { vue: '^3' }, devDependencies: { vitest: '^2', eslint: '^9' },
        });
        return '';
      },
    },
    git: {
      async log() {
        const now = Date.now();
        return Array.from({ length: 12 }, (_, i) => ({ hash: 'h' + i, subject: 'commit ' + i, author: 'a', date: new Date(now - i * 864e5).toISOString() }));
      },
    },
  },
};

const { store, saveExplore } = await import('../src/store.js');
const { collectExploreContext, ruleScore, gradeOf, parseExploreJson } = await import('../src/explore.js');

function mkProj(id = 'p1', extra = {}) {
  return { id, name: 'demo', path: 'D:/project/demo', tags: [], scripts: [], tasks: [], notes: '', createdAt: 0, lastOpened: 0, ...extra };
}

beforeEach(() => {
  store.projects = [];
  store.gitCache = {};
  store.explore = {};
});

describe('等级映射 gradeOf', () => {
  it('分数段映射到四个等级', () => {
    expect(gradeOf(0)).toBe('起步');
    expect(gradeOf(39)).toBe('起步');
    expect(gradeOf(40)).toBe('成长');
    expect(gradeOf(59)).toBe('成长');
    expect(gradeOf(60)).toBe('成熟');
    expect(gradeOf(79)).toBe('成熟');
    expect(gradeOf(80)).toBe('完善');
    expect(gradeOf(100)).toBe('完善');
  });
  it('非数字输入归零起步', () => {
    expect(gradeOf(null)).toBe('起步');
    expect(gradeOf('abc')).toBe('起步');
  });
});

describe('规则评分 ruleScore', () => {
  it('完整项目（README/测试/CI/工程化/活跃）得高分且维度齐全', async () => {
    const ctx = await collectExploreContext(mkProj());
    const r = ruleScore(ctx);
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.grade).toBe(gradeOf(r.score));
    expect(r.dims.map((d) => d.name)).toEqual(['文档', '测试', 'CI/CD', '工程化', '活跃度']);
    // 各维度有 note 说明
    r.dims.forEach((d) => expect(d.note.length).toBeGreaterThan(0));
  });

  it('空项目低分起步', () => {
    const r = ruleScore({ files: [], readme: '', pkgSummary: '', commits: [], commitStats: '', scripts: [] });
    expect(r.score).toBe(0);
    expect(r.grade).toBe('起步');
  });

  it('规则评分上限 100，不因单项超配溢出', () => {
    const r = ruleScore({
      files: ['readme.md', 'license', 'changelog', 'docs/', 'tests/', 'vitest.config.js', 'a.test.js',
        '.github/workflows/ci.yml', 'dockerfile', '.eslintrc', 'tsconfig.json', 'pnpm-lock.yaml', '.gitignore', '.editorconfig'],
      readme: 'x'.repeat(1000), pkgSummary: '依赖: vitest', commits: new Array(30).fill({}),
      commitStats: '近14天 20 次提交', scripts: ['dev = vite'],
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('AI 返回解析 parseExploreJson', () => {
  it('标准 JSON 完整解析', () => {
    const raw = JSON.stringify({
      score: 72, grade: '成熟', summary: '总评',
      dims: [{ name: '文档', score: 20, note: 'n' }, { name: '测试', score: 10, note: 'n' }],
      ideas: [{ text: '建议A', level: 2, why: 'w' }, { text: '建议B', level: 1, why: 'w' }],
    });
    const j = parseExploreJson(raw);
    expect(j.score).toBe(72);
    expect(j.grade).toBe('成熟');
    expect(j.dims).toHaveLength(2);
    expect(j.ideas).toHaveLength(2);
    expect(j.ideas[0].level).toBeGreaterThanOrEqual(j.ideas[1].level); // 按 level 降序
  });

  it('带 markdown 围栏与前后噪声也能解出', () => {
    const raw = '好的，以下是评估：\n```json\n{"score":55,"grade":"成长","summary":"s","dims":[],"ideas":[]}\n```\n希望有帮助';
    const j = parseExploreJson(raw);
    expect(j.score).toBe(55);
    expect(j.grade).toBe('成长');
  });

  it('字段越界被矫正（分数钳制 0-100，维度分钳制 0-25，level 钳制 0-2）', () => {
    const j = parseExploreJson(JSON.stringify({
      score: 150, grade: '超神', summary: 'x'.repeat(200),
      dims: [{ name: 'D', score: 99, note: 'n' }, {}],
      ideas: [{ text: 't', level: 9, why: 'w' }, { level: 1 }],
    }));
    expect(j.score).toBe(100);
    expect(j.grade).toBe('完善'); // 非法 grade 按分数推导
    expect(j.summary.length).toBeLessThanOrEqual(80);
    expect(j.dims[0].score).toBe(25);
    expect(j.dims).toHaveLength(1); // 空 name 的维度被过滤
    // level=9 不在白名单 → 归一为 1；排序后 level=1 的在前
    expect(j.ideas[0].level).toBe(1);
    expect(j.ideas).toHaveLength(1); // 无 text 的 idea 被过滤
  });

  it('非 JSON 输入抛错', () => {
    expect(() => parseExploreJson('完全不是 JSON')).toThrow();
  });
});

describe('探索结果持久化 saveExplore', () => {
  it('按项目写入 store.explore 并落库', () => {
    saveExplore('p1', { score: 66, grade: '成熟', summary: 's', dims: [], ideas: [], ruleScore: 50 });
    expect(store.explore.p1.score).toBe(66);
    expect(store.explore.p1.date).toBeTruthy();
    expect(store.explore.p1.at).toBeGreaterThan(0);
  });
});
