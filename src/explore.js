// explore.js — 探索模式：项目功能推荐 + 完成度评分
// 上下文采集 → AI 深度分析（无 AI 时回退规则评分）
import { store } from './store.js';

const README_CAP = 4000;
const PKG_CAP = 2000;
const FILES_CAP = 120;
const COMMITS_N = 30;

// ---------- 上下文采集（任一来源失败不阻塞整体） ----------
export async function collectExploreContext(proj) {
  const ctx = {
    name: proj.name, path: proj.path,
    framework: '', files: [], readme: '', pkgSummary: '',
    commits: [], commitStats: '', scripts: [], tasks: [], notes: '',
    gitStatus: null,
  };
  const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };

  const [ident, rootFiles, commits, gitSt] = await Promise.all([
    safe(() => window.pilot.identify(proj.path)),
    safe(() => window.pilot.fs.listDir(proj.path)),
    safe(() => window.pilot.git.log(proj.path, COMMITS_N)),
    Promise.resolve(store.gitCache[proj.id]?.status || null),
  ]);
  ctx.framework = ident?.framework || '';
  ctx.commits = Array.isArray(commits) ? commits : [];
  ctx.gitStatus = gitSt;

  ctx.files = (rootFiles || []).slice(0, FILES_CAP).map((f) => (f.dir ? f.name + '/' : f.name));

  // 深一层 src/ 结构（前端/后端代码组织）
  const hasSrc = (rootFiles || []).some((f) => f.dir && ['src', 'app', 'lib', 'server', 'backend', 'api'].includes(f.name));
  if (hasSrc) {
    const srcDir = (rootFiles || []).find((f) => f.dir && ['src', 'app', 'lib', 'server', 'backend', 'api'].includes(f.name));
    const sub = await safe(() => window.pilot.fs.listDir(proj.path + '/' + srcDir.name));
    if (Array.isArray(sub)) {
      const subNames = sub.slice(0, 30).map((f) => (f.dir ? srcDir.name + '/' + f.name + '/' : srcDir.name + '/' + f.name));
      ctx.files = [...ctx.files.filter((n) => !n.endsWith('/')), ...subNames].slice(0, FILES_CAP);
    }
  }

  // README（多命名兼容）
  const readmeName = (rootFiles || []).map((f) => f.name).find((n) => /^readme(\.\w+)?$/i.test(n));
  if (readmeName) {
    const t = await safe(() => window.pilot.fs.readText(proj.path + '/' + readmeName));
    if (t) ctx.readme = String(t).slice(0, README_CAP);
  }

  // package.json 摘要（name/scripts/deps，不喂整份长内容）
  if ((rootFiles || []).some((f) => f.name === 'package.json')) {
    const t = await safe(() => window.pilot.fs.readText(proj.path + '/package.json'));
    if (t) {
      try {
        const j = JSON.parse(String(t).slice(0, 20000));
        const parts = [];
        if (j.name) parts.push('name: ' + j.name);
        if (j.description) parts.push('描述: ' + String(j.description).slice(0, 80));
        if (j.scripts) parts.push('scripts: ' + Object.keys(j.scripts).join(', '));
        if (j.dependencies) parts.push('依赖: ' + Object.keys(j.dependencies).slice(0, 20).join(', '));
        if (j.devDependencies) parts.push('开发依赖: ' + Object.keys(j.devDependencies).slice(0, 15).join(', '));
        ctx.pkgSummary = parts.join('\n').slice(0, PKG_CAP);
      } catch (e) { /* package.json 解析失败就算了 */ }
    }
  }

  ctx.scripts = (proj.scripts || []).map((s) => `${s.name} = ${s.cmd}`).slice(0, 10);
  ctx.tasks = (proj.tasks || []).filter((t) => t.enabled).map((t) => t.name).slice(0, 10);
  ctx.notes = String(proj.notes || '').slice(0, 800);

  // 提交活跃度统计
  const now = Date.now();
  const in14 = ctx.commits.filter((c) => now - new Date(c.date).getTime() < 14 * 864e5).length;
  const in90 = ctx.commits.filter((c) => now - new Date(c.date).getTime() < 90 * 864e5).length;
  const lastSubject = ctx.commits[0]?.subject || '';
  ctx.commitStats = `近14天 ${in14} 次提交，近90天 ${in90} 次（采样最近${ctx.commits.length}条）` + (lastSubject ? `，最新: ${lastSubject}` : '');

  return ctx;
}

// ---------- 规则评分（离线回退 + AI 对照参考） ----------
// 五个维度各 0~25：文档 / 测试 / CI / 工程化 / 活跃度
export function ruleScore(ctx) {
  const filesLower = (ctx.files || []).map((f) => f.toLowerCase());
  const has = (re) => filesLower.some((f) => re.test(f));
  const dims = [];

  // 1) 文档：README 内容长度 + LICENSE/CHANGELOG/docs
  let doc = 0;
  if ((ctx.readme || '').length > 400) doc += 16;
  else if ((ctx.readme || '').length > 0) doc += 8;
  if (has(/(^|\/)(license|changelog|contributing)(\.\w+)?$/)) doc += 5;
  if (has(/(^|\/)(docs|doc)(\/|$)/)) doc += 4;
  dims.push({ name: '文档', score: Math.min(25, doc), note: ctx.readme ? (ctx.readme.length > 400 ? 'README 详尽' : 'README 较简') : '缺 README' });

  // 2) 测试：tests/目录 / 测试框架依赖 / CI 测试
  let test = 0;
  if (has(/(^|\/)(tests?|__tests__|spec)(\/|$)/)) test += 12;
  if ((ctx.pkgSummary || '').match(/(vitest|jest|mocha|pytest|junit|unittest|playwright|cypress)/i)) test += 8;
  if (has(/\.(test|spec)\./)) test += 5;
  dims.push({ name: '测试', score: Math.min(25, test), note: test >= 12 ? '有测试目录或框架' : '测试覆盖不明' });

  // 3) CI/CD：.github/workflows、.gitlab-ci、Jenkinsfile、docker
  let ci = 0;
  if (has(/\.github\/workflows\//)) ci += 15;
  if (has(/(^|\/)(\.gitlab-ci\.yml|jenkinsfile|azure-pipelines)/)) ci += 13;
  if (has(/(^|\/)(dockerfile|docker-compose\.ya?ml)$/)) ci += 8;
  if (has(/(^|\/)\.github(\/|$)/)) ci += 2;
  dims.push({ name: 'CI/CD', score: Math.min(25, ci), note: ci >= 13 ? '有 CI 配置' : ci > 0 ? '有部署配置' : '未见 CI' });

  // 4) 工程化：lint/format/ts 配置、锁文件、类型定义
  let eng = 0;
  if (has(/(^|\/)(\.eslintrc|eslint\.config|\.prettierrc|prettier\.config|ruff\.toml|pyproject\.toml)/)) eng += 8;
  if (has(/(^|\/)(tsconfig\.json|jsconfig\.json)/)) eng += 6;
  if (has(/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|cargo\.lock|go\.sum)$/)) eng += 6;
  if (has(/(^|\/)(\.gitignore|\.editorconfig|\.env\.example)/)) eng += 5;
  dims.push({ name: '工程化', score: Math.min(25, eng), note: eng >= 14 ? '配置较全' : eng > 0 ? '有基础配置' : '配置缺失' });

  // 5) 活跃度：近期提交频率 + Git 状态
  let act = 0;
  const m = String(ctx.commitStats || '').match(/近14天 (\d+) 次提交/);
  const n14 = m ? +m[1] : 0;
  if (n14 >= 10) act += 18; else if (n14 >= 3) act += 12; else if (n14 >= 1) act += 6;
  if ((ctx.commits || []).length >= 20) act += 4;
  if ((ctx.scripts || []).length) act += 3;
  dims.push({ name: '活跃度', score: Math.min(25, act), note: n14 ? `近两周 ${n14} 次提交` : '近期不活跃' });

  const totalRaw = dims.reduce((n, d) => n + d.score, 0);
  const score = Math.round(Math.min(100, totalRaw));
  return { score, grade: gradeOf(score), dims, summary: '规则扫描基础评估（离线）' };
}

// ---------- 等级映射 ----------
export function gradeOf(score) {
  const s = Number(score) || 0;
  if (s >= 80) return '完善';
  if (s >= 60) return '成熟';
  if (s >= 40) return '成长';
  return '起步';
}

// ---------- AI 深度分析 ----------
export async function exploreAdvice(proj) {
  const ctx = await collectExploreContext(proj);
  const rule = ruleScore(ctx); // 始终先算规则分：AI 失败也有兜底展示

  const sys =
    '你是资深技术顾问，负责评估开发项目的完成度并提出下一步功能建议。只依据给出的项目信息分析，不要编造。' +
    '输出 JSON（不要 markdown 代码围栏、不要多余文字），格式：' +
    '{"score":0到100的整数,"grade":"起步|成长|成熟|完善","summary":"一句话总评，不超过50字",' +
    '"dims":[{"name":"维度名","score":0到25,"note":"一句话说明"}],' +
    '"ideas":[{"text":"具体可落地的功能建议，一句话","level":0到2,"why":"推荐理由，一句话"}]}。' +
    '维度包含：文档、测试、CI/CD、工程化、活跃度、功能完成度（按项目实际情况增删，4~6 个）。' +
    'ideas 3~6 条，按价值排序。level：2=强烈推荐尽快做，1=值得做，0=锦上添花。';

  const user =
    `项目：${ctx.name}（${ctx.path}）\n` +
    (ctx.framework ? `技术栈：${ctx.framework}\n` : '') +
    `提交活跃度：${ctx.commitStats || '未知'}\n` +
    (ctx.gitStatus ? `Git 状态：分支 ${ctx.gitStatus.branch || 'HEAD'}，未提交 ${ctx.gitStatus.dirty || 0} 个文件\n` : '') +
    (ctx.scripts.length ? `已有脚本：\n${ctx.scripts.join('\n')}\n` : '') +
    (ctx.tasks.length ? `启用中的自动任务：${ctx.tasks.join('、')}\n` : '') +
    (ctx.notes ? `项目备忘：${ctx.notes}\n` : '') +
    (ctx.pkgSummary ? `\npackage.json 摘要：\n${ctx.pkgSummary}\n` : '') +
    (ctx.readme ? `\nREADME（截断）：\n${ctx.readme}\n` : '') +
    `\n项目根目录与源码结构：\n${ctx.files.join('\n') || '（未读取到）'}\n\n` +
    `本地规则扫描参考分：${rule.score}（${rule.grade}），各维度：${rule.dims.map((d) => `${d.name} ${d.score}`).join('、')}。` +
    `请综合以上信息，尤其结合源码结构与 README 判断功能完成度，给出你的独立评估（可以与规则分不同）。`;

  const { ai } = await import('./store.js');
  const raw = await ai([{ role: 'system', content: sys }, { role: 'user', content: user }]);
  const parsed = parseExploreJson(raw);
  return { ...parsed, ruleScore: rule.score, ruleDims: rule.dims, ruleGrade: rule.grade };
}

// ---------- JSON 解析与矫正（仿 advisor.parseAdviceJson） ----------
export function parseExploreJson(raw) {
  const s = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  const j = JSON.parse(m ? m[0] : s);
  if (!j || typeof j !== 'object') throw new Error('AI 返回格式异常');

  const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
  const dims = (Array.isArray(j.dims) ? j.dims : []).slice(0, 8).map((d) => ({
    name: String(d?.name || '').slice(0, 12),
    score: Math.max(0, Math.min(25, Math.round(Number(d?.score) || 0))),
    note: String(d?.note || '').slice(0, 60),
  })).filter((d) => d.name);
  const ideas = (Array.isArray(j.ideas) ? j.ideas : []).slice(0, 6).map((it, i) => ({
    id: 'ex-' + i,
    text: String(it?.text || '').slice(0, 140),
    level: [0, 1, 2].includes(Number(it?.level)) ? Number(it.level) : 1,
    why: String(it?.why || '').slice(0, 80),
  })).filter((it) => it.text);
  ideas.sort((a, b) => b.level - a.level);

  return {
    score,
    grade: ['起步', '成长', '成熟', '完善'].includes(j.grade) ? j.grade : gradeOf(score),
    summary: String(j.summary || '').slice(0, 80),
    dims, ideas,
  };
}
