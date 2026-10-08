// doctor.js — 项目体检：工程卫生规则评分 + AI 结构化改进项（离线兜底）
// 定位与探索模式错开：探索问「该长什么新功能」，体检答「工程质量有什么要修」。
// 数据来自 preload/inspect.cjs 硬采集（audit/outdated/TODO/文档/测试/git 卫生）。
const AREAS = ['deps', 'todos', 'tests', 'docs', 'git', 'general'];
const EFFORTS = ['S', 'M', 'L'];
export const SEV_LABEL = { 2: '立即处理', 1: '建议处理', 0: '顺手可做' };

export function gradeOf(score) {
  const s = Number(score) || 0;
  if (s >= 80) return '健康';
  if (s >= 60) return '良好';
  if (s >= 40) return '注意';
  return '告急';
}

// ---------- 规则评分：五维度各 0~25 + 规则改进项 ----------
export function ruleCheckup(data) {
  const dims = [];
  const items = [];
  const deps = data.deps || {}, todos = data.todos || {}, docs = data.docs || {};
  const tests = data.tests || {}, git = data.git || {};

  // 1) 依赖健康：audit 漏洞按严重度扣分，outdated 按数量扣
  let dep = 25;
  const av = deps.audit && deps.audit.total ? deps.audit : null;
  if (av) {
    dep -= (av.critical || 0) * 4 + (av.high || 0) * 3 + (av.moderate || 0) * 2 + (av.low || 0) * 1;
    items.push({
      id: 'audit', area: 'deps', severity: (av.critical || 0) + (av.high || 0) > 0 ? 2 : 1, effort: 'S',
      title: `修复 ${av.total} 个依赖漏洞`,
      detail: `critical ${av.critical || 0} / high ${av.high || 0} / moderate ${av.moderate || 0} / low ${av.low || 0}`,
      reason: 'npm audit 扫出的已知漏洞，critical/high 可能有运行时风险',
    });
  }
  const od = deps.outdated || [];
  if (od.length) {
    dep -= od.length >= 5 ? 6 : od.length >= 3 ? 4 : 2;
    items.push({
      id: 'outdated', area: 'deps', severity: od.length >= 5 ? 1 : 0, effort: 'M',
      title: `升级 ${od.length} 个过期依赖`,
      detail: od.slice(0, 4).map((p) => `${p.name} ${p.current || '?'} → ${p.latest}`).join('，') + (od.length > 4 ? ` 等 ${od.length} 个` : ''),
      reason: '落后最新大版本过多会积累升级债，平时顺手升最省力',
    });
  }
  if (deps.hasLockfile === false) {
    items.push({ id: 'lockfile', area: 'deps', severity: 1, effort: 'S', title: '提交 lockfile 锁定依赖版本', detail: '未发现 package-lock.json / pnpm-lock.yaml / yarn.lock', reason: '无 lockfile 时团队与 CI 的依赖版本不可复现' });
    dep -= 4;
  }
  dims.push({ name: '依赖健康', score: Math.max(0, Math.min(25, dep)), note: av ? `漏洞 ${av.total}` : od.length ? `过期 ${od.length}` : '依赖健康' });

  // 2) 代码债：TODO/FIXME 总量（FIXME/HACK 额外提醒）
  let td = 25;
  const tt = todos.total || 0;
  if (tt > 50) td = 8; else if (tt > 20) td = 12; else if (tt > 5) td = 16; else if (tt > 0) td = 20;
  if (tt >= 5) {
    items.push({
      id: 'todos', area: 'todos', severity: tt > 20 ? 1 : 0, effort: 'M',
      title: `清点 ${tt} 处 TODO/FIXME 债务`,
      detail: `TODO ${todos.byType?.TODO || 0} / FIXME ${todos.byType?.FIXME || 0} / HACK ${todos.byType?.HACK || 0} / XXX ${todos.byType?.XXX || 0}` +
        (todos.samples && todos.samples.length ? `，如 ${todos.samples[0].file}:${todos.samples[0].line}` : ''),
      reason: '未处理的待办注释是隐性需求池，定期清点防止遗忘',
    });
  }
  dims.push({ name: '代码债', score: Math.max(0, Math.min(25, td)), note: tt ? `${tt} 处待办注释` : '无待办注释' });

  // 3) 测试保障：有无 test 脚本 + 测试文件量
  let ts = 0;
  if (data.pkg && data.pkg.hasTestScript) ts += 12;
  if (tests.testFiles > 0) ts += 8;
  if (tests.testFiles >= 10) ts += 5;
  if (ts === 0) {
    items.push({ id: 'no-tests', area: 'tests', severity: 2, effort: 'L', title: '补基础测试', detail: '没有 test 脚本，也没有发现任何 *.test.* / *.spec.* 文件', reason: '无测试的改动全靠手感，回归风险不可控' });
  } else if (tests.testFiles > 0 && tests.testFiles < 5) {
    items.push({ id: 'few-tests', area: 'tests', severity: 0, effort: 'M', title: `测试偏少（${tests.testFiles} 个测试文件）`, detail: '核心路径建议至少覆盖冒烟级用例', reason: '测试是重构的底气，少量高价值用例也有用' });
  }
  dims.push({ name: '测试保障', score: Math.max(0, Math.min(25, ts)), note: ts === 0 ? '未见测试' : `${tests.testFiles || 0} 个测试文件` });

  // 4) 文档：README 大小与新鲜度 + LICENSE/CHANGELOG
  let dc = 0;
  const rm = docs.readme;
  if (rm && rm.bytes > 1000) dc += 16; else if (rm) dc += 8;
  if (docs.license) dc += 3;
  if (docs.changelog) dc += 3;
  if (docs.docsDir) dc += 3;
  if (rm && rm.mtime) {
    const age = (Date.now() - rm.mtime) / 864e5;
    if (age < 90) dc += 3;
    else if (age > 365 && rm.bytes > 1000) items.push({ id: 'stale-readme', area: 'docs', severity: 0, effort: 'S', title: 'README 已超过一年未更新', detail: `最后修改于 ${new Date(rm.mtime).toLocaleDateString('zh-CN')}`, reason: '文档与代码长期脱节会误导新读者' });
  }
  if (!rm) {
    items.push({ id: 'no-readme', area: 'docs', severity: 1, effort: 'S', title: '补一份 README', detail: '项目根目录未发现 README', reason: '没有入口文档的项目，两周后的自己也会读不懂' });
  }
  dims.push({ name: '文档', score: Math.max(0, Math.min(25, dc)), note: rm ? `README ${(rm.bytes / 1024).toFixed(1)}KB` : '缺 README' });


  // 5) git 卫生：未提交堆积 / 落后远程 / 停滞
  let gh = 25;
  if (git.available) {
    if (git.dirty > 15) { gh -= 10; } else if (git.dirty > 5) { gh -= 6; } else if (git.dirty > 0) { gh -= 3; }
    if (git.behind > 0) {
      gh -= 4;
      items.push({ id: 'behind', area: 'git', severity: 1, effort: 'S', title: `落后远程 ${git.behind} 个提交`, detail: `分支 ${git.branch || 'HEAD'} 落后 upstream`, reason: '长期不拉取会让最终合并变成大工程' });
    }
    if (git.lastCommitTs) {
      const days = Math.floor((Date.now() - git.lastCommitTs) / 864e5);
      if (days > 90) {
        gh = Math.min(gh, 10);
        items.push({ id: 'stale', area: 'git', severity: 0, effort: 'S', title: `项目已 ${days} 天没有提交`, detail: `最后提交 ${new Date(git.lastCommitTs).toLocaleDateString('zh-CN')}`, reason: '长期未动的项目建议归档或标注状态，减少注意力税' });
      }
    }
    if (git.dirty > 10) {
      items.push({ id: 'dirty', area: 'git', severity: 1, effort: 'S', title: `${git.dirty} 个未提交变更在堆积`, detail: `暂存 ${git.staged} / 未暂存 ${git.unstaged} / 未跟踪 ${git.untracked}`, reason: '变更堆得越久，提交粒度越难拆，回滚单元越粗' });
    }
  } else {
    gh = 15;
  }
  dims.push({ name: 'Git 卫生', score: Math.max(0, Math.min(25, gh)), note: !git.available ? '非 git 仓库' : git.dirty ? `${git.dirty} 个未提交` : '工作区干净' });

  items.sort((a, b) => b.severity - a.severity);
  const score = dims.reduce((n, d) => n + d.score, 0);
  return { score: Math.max(0, Math.min(100, score)), grade: gradeOf(score), dims, items };
}

// ---------- AI 结构化体检：提示词组装 ----------
export function buildDoctorPrompt(data, rule) {
  const sys =
    '你是资深工程效率顾问，对开发项目做工程卫生体检。只依据给出的采集数据分析，不要编造。' +
    '输出 JSON（不要 markdown 代码围栏、不要多余文字），格式：' +
    '{"score":0到100的整数健康分,"grade":"健康|良好|注意|告急","summary":"一句话总评，不超过50字",' +
    '"dims":[{"name":"维度名","score":0到25,"note":"一句话说明"}],' +
    '"items":[{"title":"改进项一句话","severity":0到2,"effort":"S|M|L","area":"deps|todos|tests|docs|git|general","detail":"具体数据或位置","reason":"为什么值得做，一句话"}]}。' +
    '维度参考：依赖健康、代码债、测试保障、文档、Git 卫生（可按项目实际增删，4~6 个）。' +
    'items 按优先级排序，3~7 条；severity：2=立即处理 1=建议处理 0=顺手可做。没有问题就说没有，不要硬凑。';

  const d = data.deps || {}, todos = data.todos || {}, docs = data.docs || {}, tests = data.tests || {}, git = data.git || {};
  const user =
    `项目：${(data.pkg && data.pkg.name) || ''}（${data.root || ''}）\n` +
    (data.pkg ? `scripts：${data.pkg.scripts.join(', ') || '无'}\n` : '') +
    (d.audit ? `依赖漏洞（npm audit）：critical ${d.audit.critical || 0} / high ${d.audit.high || 0} / moderate ${d.audit.moderate || 0} / low ${d.audit.low || 0}\n` : '依赖漏洞：未扫描到\n') +
    (d.outdated && d.outdated.length ? `过期依赖 ${d.outdated.length} 个：${d.outdated.slice(0, 8).map((p) => `${p.name}(${p.current || '?'}→${p.latest})`).join('、')}\n` : '过期依赖：无或未安装\n') +
    (d.hasLockfile === false ? 'lockfile：缺失\n' : '') +
    `TODO 债：共 ${todos.total || 0} 处（${JSON.stringify(todos.byType || {})}）${todos.samples && todos.samples.length ? `，样例：${todos.samples.slice(0, 3).map((s) => `${s.file}:${s.line}`).join('、')}` : ''}\n` +
    `测试：${tests.testFiles || 0} 个测试文件，目录 ${JSON.stringify(tests.dirs || [])}\n` +
    `文档：${docs.readme ? `README ${(docs.readme.bytes / 1024).toFixed(1)}KB` : '无 README'}，license ${docs.license ? '有' : '无'}，changelog ${docs.changelog ? '有' : '无'}，docs/ ${docs.docsDir ? '有' : '无'}\n` +
    (git.available ? `Git：分支 ${git.branch}，未提交 ${git.dirty}（暂存 ${git.staged}/未暂存 ${git.unstaged}/未跟踪 ${git.untracked}），ahead ${git.ahead}/behind ${git.behind}${git.lastCommitTs ? `，最后提交 ${new Date(git.lastCommitTs).toLocaleDateString('zh-CN')}` : ''}\n` : 'Git：非仓库或不可用\n') +
    (data.notes && data.notes.length ? `采集备注：${data.notes.join('；')}\n` : '') +
    `\n本地规则评分参考：${rule.score}（${rule.grade}），各维度：${rule.dims.map((x) => `${x.name} ${x.score}`).join('、')}。` +
    `请给出你的独立评估与改进项（可以与规则分不同），优先指出数据里真实存在的问题。`;
  return { sys, user };
}

// ---------- AI 返回的防御式解析（仿 parseExploreJson） ----------
export function parseDoctorJson(raw) {
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
  const items = (Array.isArray(j.items) ? j.items : []).slice(0, 10).map((it, i) => ({
    id: 'dr-' + i,
    title: String(it?.title || '').slice(0, 100),
    severity: [0, 1, 2].includes(Number(it?.severity)) ? Number(it.severity) : 1,
    effort: EFFORTS.includes(it?.effort) ? it.effort : 'M',
    area: AREAS.includes(it?.area) ? it.area : 'general',
    detail: String(it?.detail || '').slice(0, 200),
    reason: String(it?.reason || '').slice(0, 120),
  })).filter((it) => it.title);
  items.sort((a, b) => b.severity - a.severity);

  return {
    score,
    grade: ['健康', '良好', '注意', '告急'].includes(j.grade) ? j.grade : gradeOf(score),
    summary: String(j.summary || '').slice(0, 100),
    dims, items,
  };
}
