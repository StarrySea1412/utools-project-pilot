// preload/inspect.cjs — 体检采集域：项目工程卫生的确定性数据采集（不花 AI 调用）
// 产出 deps（audit/outdated）、TODO 债、文档、测试、git 卫生五路硬数据，供规则评分与 AI 深度分析。
// npm 命令走 shell（PATH 解析 npm.cmd）；git 卫生直接复用 git.cjs，不复制 porcelain 解析。
// 任一子项失败只记 note 不阻塞整体——体检不能比被体检的项目更脆。
const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { isWin, shellArgs } = require('./env.cjs');
const { git, gitApi } = require('./git.cjs');

// ---------- shell 执行（npm 这类 .cmd 必须走 shell） ----------
function runShell(cmd, cwd, timeoutMs) {
  const { file, args } = shellArgs(cmd);
  return new Promise((resolve) => {
    execFile(file, args, { cwd, timeout: timeoutMs || 30000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => resolve({ code: err && err.code != null ? err.code : (err ? 1 : 0), stdout: stdout || '', stderr: stderr || (err && err.message) || '' }));
  });
}

async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { return fallback; }
}

// ---------- package.json 摘要 ----------
async function collectPkg(root) {
  const raw = await safe(() => fsp.readFile(path.join(root, 'package.json'), 'utf8'), null);
  if (raw == null) return null;
  try {
    const j = JSON.parse(raw);
    const scripts = j.scripts ? Object.keys(j.scripts) : [];
    return {
      name: j.name || '',
      deps: Object.keys(j.dependencies || {}),
      devDeps: Object.keys(j.devDependencies || {}),
      scripts,
      hasTestScript: scripts.some((s) => /^(test|test:.*)$/.test(s) || /\b(vitest|jest|mocha|playwright|cypress)\b/.test(j.scripts[s] || '')),
      hasLintScript: scripts.some((s) => /^(lint|lint:.*)$/.test(s)),
      packageManager: j.packageManager || '',
    };
  } catch (e) { return { name: '', deps: [], devDeps: [], scripts: [], hasTestScript: false, hasLintScript: false, parseError: true }; }
}

// ---------- 依赖：outdated + audit（无 node_modules/lockfile 时跳过） ----------
async function collectDeps(root, pkg) {
  const out = { outdated: null, audit: null, npmAvailable: null, notes: [] };
  const hasLock = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].some((f) => fs.existsSync(path.join(root, f)));
  out.hasLockfile = hasLock;
  if (!hasLock) out.notes.push('未发现 lockfile，依赖未锁定');
  out.npmAvailable = await safe(async () => {
    const r = await runShell('npm --version', root, 15000);
    return r.code === 0 && /^\d/.test(r.stdout.trim());
  }, false);
  if (!out.npmAvailable) { out.notes.push('npm 不可用，跳过依赖检查'); return out; }
  if (!pkg) { out.notes.push('非 Node 项目，跳过依赖检查'); return out; }

  if (hasLock) {
    // audit 只需要 lockfile：--package-lock-only 免装 node_modules
    const a = await runShell('npm audit --json --package-lock-only', root, 40000);
    const j = safeJson(a.stdout);
    if (j && j.metadata && j.metadata.vulnerabilities) out.audit = j.metadata.vulnerabilities;
    else out.notes.push('漏洞扫描失败' + (a.code ? `（退出码 ${a.code}）` : ''));

    // outdated 需要 node_modules 实际安装
    const nm = fs.existsSync(path.join(root, 'node_modules'));
    if (nm) {
      const o = await runShell('npm outdated --json', root, 40000);
      const j2 = safeJson(o.stdout);
      if (j2 && typeof j2 === 'object') {
        out.outdated = Object.entries(j2).map(([name, v]) => ({ name, current: v.current, wanted: v.wanted, latest: v.latest })).slice(0, 60);
      } else if (o.code > 1) out.notes.push(`依赖过期检查失败（退出码 ${o.code}）`);
    } else out.notes.push('依赖未安装（node_modules 不存在），跳过过期检查');
  }
  return out;
}
function safeJson(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ---------- TODO / FIXME 债务扫描 ----------
const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b/g;
const TEXT_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|vue|css|scss|less|py|go|rs|java|kt|swift|rb|php|c|h|cpp|cs|sh|ps1|bat|md|ya?ml|toml|json|html|htm|sql|dart|txt)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'target', 'vendor', 'min', 'docs']);

async function scanTodos(root, limits = { maxFiles: 900, maxFileBytes: 512 * 1024 }) {
  const res = { total: 0, byType: {}, samples: [], scannedFiles: 0, truncated: false };
  let files = [];
  async function walk(dir, depth) {
    if (depth > 6 || files.length >= limits.maxFiles) { if (depth > 6) res.truncated = true; return; }
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (files.length >= limits.maxFiles) { res.truncated = true; return; }
      if (e.name.startsWith('.') && e.name !== '.github') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(full, depth + 1); continue; }
      if (!e.isFile() || !TEXT_EXT.test(e.name) || e.name.endsWith('.json') || e.name.endsWith('.lock')) continue;
      files.push(full);
    }
  }
  await walk(root, 0);
  for (const f of files) {
    let st;
    try { st = await fsp.stat(f); } catch (e) { continue; }
    if (st.size > limits.maxFileBytes) continue;
    let text;
    try { text = await fsp.readFile(f, 'utf8'); } catch (e) { continue; }
    res.scannedFiles++;
    const rel = path.relative(root, f).replace(/\\/g, '/');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      TODO_RE.lastIndex = 0;
      let m;
      while ((m = TODO_RE.exec(lines[i]))) {
        const t = m[1];
        res.total++;
        res.byType[t] = (res.byType[t] || 0) + 1;
        if (res.samples.length < 6) res.samples.push({ file: rel, line: i + 1, type: t, text: lines[i].trim().slice(0, 80) });
      }
    }
  }
  return res;
}

// ---------- 文档与测试文件 ----------
async function collectDocs(root) {
  const d = { readme: null, license: false, changelog: false, docsDir: false };
  const names = await safe(() => fsp.readdir(root), []);
  const readme = names.find((n) => /^readme(\.\w+)?$/i.test(n));
  if (readme) {
    const p = path.join(root, readme);
    const st = await safe(() => fsp.stat(p), null);
    d.readme = { name: readme, bytes: st ? st.size : 0, mtime: st ? st.mtimeMs : 0 };
  }
  d.license = names.some((n) => /^licen[cs]e(\.\w+)?$/i.test(n));
  d.changelog = names.some((n) => /^changelog(\.\w+)?$/i.test(n));
  d.docsDir = names.some((n) => /^docs?$/i.test(n) && fs.existsSync(path.join(root, n)) && fs.statSync(path.join(root, n)).isDirectory());
  return d;
}

async function collectTests(root) {
  const t = { testFiles: 0, dirs: [] };
  const names = await safe(() => fsp.readdir(root), []);
  for (const d of ['tests', 'test', '__tests__', 'spec']) {
    if (names.includes(d)) t.dirs.push(d);
  }
  let count = 0;
  async function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (!e.isDirectory() && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name)) continue;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) await walk(path.join(dir, e.name), depth + 1); continue; }
      count++;
      if (count > 999) return;
    }
  }
  await walk(root, 0);
  t.testFiles = count;
  return t;
}

// ---------- git 卫生（组合 git.cjs，不复制解析） ----------
async function collectGit(root) {
  const st = await safe(() => gitApi.status(root), null);
  if (!st) return { available: false };
  let lastTs = null;
  const out = await safe(() => git(root, ['log', '-1', '--format=%ct']), '');
  if (out && /^\d+$/.test(out.trim())) lastTs = +out.trim() * 1000;
  return {
    available: true,
    branch: st.branch || '',
    ahead: st.ahead || 0, behind: st.behind || 0,
    staged: st.stagedCount || 0, unstaged: st.unstagedCount || 0, untracked: st.untrackedCount || 0,
    dirty: (st.stagedCount || 0) + (st.unstagedCount || 0) + (st.untrackedCount || 0),
    lastCommitTs: lastTs,
  };
}

// ---------- 汇总入口 ----------
async function inspect(root) {
  const t0 = Date.now();
  root = String(root || '');
  const notes = [];
  if (!root || !fs.existsSync(root)) return { ok: false, error: '项目路径不存在: ' + root, notes, tookMs: Date.now() - t0 };

  const pkg = await collectPkg(root);
  const [deps, todos, docs, tests, gitH] = await Promise.all([
    collectDeps(root, pkg), scanTodos(root), collectDocs(root), collectTests(root), collectGit(root),
  ]);
  if (pkg && pkg.parseError) notes.push('package.json 解析失败');
  if (!pkg) notes.push('未发现 package.json（非 Node 项目，依赖检查跳过）');
  return { ok: true, root, pkg, deps, todos, docs, tests, git: gitH, notes, tookMs: Date.now() - t0 };
}

const inspectApi = { inspect };

module.exports = { inspect, inspectApi };
