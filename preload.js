// preload.js — 项目领航员 (ProjectPilot)
// Node 桥接层：Git / 脚本进程 / 文件系统 / uTools DB / AI(OpenAI 兼容)
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const isWin = process.platform === 'win32';
const MAX_BUF = 256 * 1024;

function cut(s) {
  if (s.length <= MAX_BUF) return s;
  return s.slice(0, MAX_BUF) + `\n... [输出超长，已截断 ${s.length - MAX_BUF} 字符]\n`;
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, {
      cwd: opts.cwd,
      timeout: opts.timeout || 30000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'en_US.UTF-8' },
    }, (err, stdout, stderr) => {
      resolve({ code: err && err.code != null ? err.code : (err ? 1 : 0), stdout: stdout || '', stderr: stderr || err && err.message || '' });
    });
  });
}

// ---------- Git ----------
async function git(cwd, args) {
  const r = await runCmd('git', args, { cwd, timeout: 60000 });
  if (r.code !== 0) throw new Error((r.stderr || `git ${args[0]} 退出码 ${r.code}`).trim());
  return r.stdout;
}

async function gitStatus(cwd) {
  const out = await git(cwd, ['status', '--porcelain=v2', '--branch']);
  const lines = out.split('\n');
  const st = { branch: '', upstream: '', ahead: 0, behind: 0, detached: false, entries: [], stagedCount: 0, unstagedCount: 0, untrackedCount: 0 };
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('# branch.head ')) { st.branch = line.slice(14); if (st.branch === '(detached)') st.detached = true; }
    else if (line.startsWith('# branch.upstream ')) st.upstream = line.slice(18);
    else if (line.startsWith('# branch.ab ')) {
      const m = line.slice(12).match(/\+(\d+)\s+-(\d+)/);
      if (m) { st.ahead = +m[1]; st.behind = +m[2]; }
    } else if (line.startsWith('1 ')) {
      // 1 <XY> <sub> <mH> <mI> <mU> <oidH> <oidI> <path…>
      const sp = line.split(' ');
      addEntry(st, sp[1], sp.slice(8).join(' '));
    } else if (line.startsWith('2 ')) {
      // 2 <XY> <sub> <mH> <mI> <mU> <mH'> <mI'> <X><score> <newPath>\t<origPath>
      const parts = line.split('\t');
      const head = parts[0].split(' ');
      const e = { x: head[1][0], y: head[1][1], path: parts[1] || '' };
      if (parts[2]) { e.orig = parts[2]; e.renamed = true; }
      if (e.x !== '.' && e.x !== '?') st.stagedCount++;
      if (e.y !== '.' && e.y !== '?') st.unstagedCount++;
      st.entries.push(e);
    } else if (line.startsWith('u ')) {
      // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path…>
      const sp = line.split(' ');
      st.entries.push({ x: 'U', y: 'U', path: sp.slice(10).join(' '), unmerged: true });
      st.unstagedCount++;
    } else if (line.startsWith('? ')) {
      st.entries.push({ x: '?', y: '?', path: line.slice(2), untracked: true });
      st.untrackedCount++;
    }
  }
  function addEntry(st, xy, file, orig, extra) {
    const x = xy[0], y = xy[1];
    if (x !== '.' && x !== '?') st.stagedCount++;
    if (y !== '.' && y !== '?') st.unstagedCount++;
    const e = { x, y, path: file };
    if (orig) { e.orig = orig.split(' ').slice(8).join(' '); e.renamed = true; }
    st.entries.push(e);
  }
  st.dirty = st.stagedCount + st.unstagedCount + st.untrackedCount;
  return st;
}

async function gitDiffFile(cwd, file, staged) {
  let out;
  if (file.untracked) {
    try {
      const c = await fsp.readFile(path.join(cwd, file.path), 'utf8');
      out = `+++ 新文件: ${file.path}\n` + c.split('\n').map(l => '+' + l).join('\n');
    } catch (e) { out = '（无法读取文件）'; }
  } else {
    const args = ['diff', '--no-color', '-U3'];
    if (staged) args.push('--cached');
    args.push('--', file.path);
    out = await git(cwd, args);
  }
  return cut(out || '（无差异）');
}

async function gitLog(cwd, n = 60) {
  // 分隔符用控制字符：Node execFile 禁止参数含 \u0000，故用 \u0001/\u001f
  const sep = '\u001f', fld = '\u0001';
  const out = await git(cwd, ['log', `--pretty=format:%H${fld}%h${fld}%an${fld}%aI${fld}%s${fld}%b${fld}%P${sep}`, '-n', String(n)]);
  return out.split(sep).filter(r => r.trim()).map(r => {
    const [hash, short, author, date, subject, body, parents] = r.split(fld);
    // --pretty=format 会在记录间插 \n，hash/parents 必须 trim 才能参与拓扑比对
    return { hash: (hash || '').trim(), short, author, date, subject: subject || '', body: (body || '').trim(), parents: (parents || '').trim() };
  });
}

async function gitBranches(cwd) {
  const out = await git(cwd, ['branch', '--format=%(HEAD)%00%(refname:short)%00%(upstream:short)']);
  return out.split('\n').filter(Boolean).map(l => {
    const [head, name, upstream] = l.split('\u0000');
    return { current: head.trim() === '*', name, upstream: upstream || '' };
  });
}

async function gitCommit(cwd, message) {
  await git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', '--short', 'HEAD']);
}

async function gitHasRemote(cwd) {
  const r = await runCmd('git', ['remote'], { cwd });
  return r.stdout.trim().length > 0;
}

// ---------- 进程/脚本 ----------
const procs = new Map(); // id -> {proc, out:[], running, cmd, cwd, scriptName}
let procSeq = 0;

function shellArgs(cmd) {
  return isWin ? { file: 'cmd.exe', args: ['/d', '/s', '/c', cmd] } : { file: '/bin/bash', args: ['-lc', cmd] };
}

function runScript(projectPath, script) {
  const id = `p${++procSeq}_${Date.now()}`;
  const { file, args } = shellArgs(script.cmd);
  const proc = spawn(file, args, { cwd: projectPath, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
  const handle = { id, out: [], running: true, code: null, scriptName: script.name || script.cmd, cwd: projectPath, startedAt: Date.now(), listeners: [] };
  const push = (chunk) => {
    const s = chunk.toString();
    handle.out.push(s);
    if (handle.out.join('').length > MAX_BUF) handle.out.splice(0, handle.out.length - 10);
    handle.listeners.forEach(cb => { try { cb(s); } catch (e) {} });
  };
  proc.stdout.on('data', push);
  proc.stderr.on('data', push);
  proc.on('exit', (code) => { handle.running = false; handle.code = code; });
  proc.on('error', (err) => { handle.out.push(`[启动失败] ${err.message}\n`); handle.running = false; handle.code = -1; });
  procs.set(id, { proc, handle });
  return { id, running: true };
}

function stopProc(id) {
  const rec = procs.get(id);
  if (!rec) return { ok: false, error: '进程不存在' };
  rec.handle.running = false;
  return new Promise((resolve) => {
    if (isWin) {
      execFile('taskkill', ['/pid', String(rec.proc.pid), '/T', '/F'], { windowsHide: true }, () => resolve({ ok: true }));
    } else {
      try { process.kill(-rec.proc.pid, 'SIGTERM'); } catch (e) { try { rec.proc.kill('SIGTERM'); } catch (e2) {} }
      resolve({ ok: true });
    }
  });
}

// 一次性运行命令并收集输出（自动任务用），超时强杀进程树
function runOnce(cwd, cmd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const { file, args } = shellArgs(cmd);
    let out = '', done = false;
    const proc = spawn(file, args, { cwd, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
    const kill = () => {
      if (isWin) execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else { try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { try { proc.kill('SIGKILL'); } catch (e2) {} } }
    };
    const timer = setTimeout(() => {
      if (done) return; done = true; kill();
      resolve({ code: -1, output: cut(out) + '\n[执行超时，已终止]' });
    }, timeoutMs);
    const collect = (c) => { out += c; if (out.length > 40000) out = out.slice(-40000); };
    proc.stdout.on('data', collect);
    proc.stderr.on('data', collect);
    proc.on('exit', (code) => { if (!done) { done = true; clearTimeout(timer); resolve({ code, output: cut(out) }); } });
    proc.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); resolve({ code: -1, output: cut(out) + '\n' + e.message }); } });
  });
}

// ---------- 文件 ----------
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.venv', 'venv', '__pycache__', 'target', '.cache', 'coverage']);

async function listDir(dir) {
  const names = await fsp.readdir(dir, { withFileTypes: true });
  const items = [];
  for (const d of names) {
    if (IGNORE_DIRS.has(d.name) && d.isDirectory()) continue;
    const full = path.join(dir, d.name);
    let size = null, mtime = null;
    try { const s = await fsp.stat(full); size = s.size; mtime = s.mtimeMs; } catch (e) {}
    items.push({ name: d.name, dir: d.isDirectory(), size, mtime, link: d.isSymbolicLink() });
  }
  items.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'zh'));
  return items;
}

const TEXT_EXT = new Set(['.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.less', '.html', '.htm', '.vue', '.py', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.sh', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.env', '.xml', '.sql', '.log', '.gitignore', '.editorconfig', '.lock', '.mjs', '.cjs', '.bat', '.ps1', '.dart', '.kt', '.swift', '.rb', '.php']);

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  return TEXT_EXT.has(ext) || !ext && true;
}

async function readText(file) {
  const buf = await fsp.readFile(file);
  if (buf.length > 1024 * 512) throw new Error('文件过大（>512KB），请在系统中打开');
  if (buf.includes(0)) throw new Error('二进制文件，不支持预览');
  return buf.toString('utf8');
}

// ---------- AI (OpenAI 兼容) ----------
function aiChat(cfg) {
  const base = (cfg.baseUrl || '').replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const payload = JSON.stringify({
    model: cfg.model,
    messages: cfg.messages,
    temperature: cfg.temperature != null ? cfg.temperature : 0.6,
    stream: false,
  });
  const u = new URL(url);
  const mod = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, {
      method: 'POST',
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey || ''}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; if (body.length > 4 * 1024 * 1024) req.destroy(); });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${(j.error && j.error.message) || body.slice(0, 300)}`));
          const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (!content) return reject(new Error('响应中没有内容: ' + body.slice(0, 200)));
          resolve(content.trim());
        } catch (e) { reject(new Error('响应解析失败: ' + body.slice(0, 200))); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时（120s）')); });
    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

// ---------- 系统监测（内存 / CPU / 端口） ----------
let lastCpus = os.cpus();

function sysMemory() {
  const total = os.totalmem(), free = os.freemem();
  const used = total - free;
  return { total, free, used, pct: used / total };
}

function sysCpu() {
  const now = os.cpus();
  let idle = 0, total = 0;
  for (let i = 0; i < now.length; i++) {
    const a = lastCpus[i], b = now[i];
    if (!a) break;
    const t = Object.keys(b.times).reduce((s, k) => s + b.times[k] - a.times[k], 0);
    idle += b.times.idle - a.times.idle;
    total += t;
  }
  lastCpus = now;
  return total > 0 ? { pct: 1 - idle / total, cores: now.length } : { pct: null, cores: now.length };
}

let tasklistCache = { at: 0, map: new Map() };
async function pidNameMap() {
  if (Date.now() - tasklistCache.at < 30000) return tasklistCache.map;
  const r = await new Promise((resolve) => {
    // tasklist 输出为 GBK，必须按 GBK 解码，否则中文进程名变乱码
    execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 15000, encoding: 'buffer' }, (err, stdout) => resolve(err ? null : stdout));
  });
  const text = r ? new TextDecoder('gbk').decode(r) : '';
  const map = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^"([^"]+)","(\d+)"/);
    if (m) map.set(+m[2], m[1]);
  }
  tasklistCache = { at: Date.now(), map };
  return map;
}

async function sysPorts() {
  const r = await new Promise((resolve) => {
    execFile('cmd.exe', ['/d', '/c', 'netstat', '-ano', '-p', 'tcp'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 15000 },
      (err, stdout) => resolve(err ? '' : stdout));
  });
  const names = await pidNameMap();
  const ports = new Map(); // port -> {port, pids:Set, names:Set}
  for (const line of r.split('\n')) {
    if (!/LISTENING/.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const local = parts[1], pid = +parts[parts.length - 1];
    const pm = local.match(/:(\d+)$/);
    if (!pm) continue;
    const port = +pm[1];
    if (!ports.has(port)) ports.set(port, { port, pids: new Set(), names: new Set() });
    const rec = ports.get(port);
    if (pid) rec.pids.add(pid);
    const name = names.get(pid);
    if (name) rec.names.add(name);
  }
  return [...ports.values()]
    .map((p) => ({ port: p.port, pids: [...p.pids], names: [...p.names] }))
    .sort((a, b) => a.port - b.port);
}

// ---------- 挂载 ----------
if (typeof window !== 'undefined') {
  window.pilot = {
    platform: process.platform,
    home: os.homedir(),
    // db — 兼容 uTools 真实 API（utools.db.get/put/remove）
    dbGet(key) {
      const u = window.utools;
      if (!u) return null;
      if (typeof u.db?.get === 'function') { const d = u.db.get(key); return d ? d.value : null; }
      if (typeof u.dbGet === 'function') { const d = u.dbGet(key); return d ? d.value : null; }
      return null;
    },
    dbPut(key, value) {
      const u = window.utools;
      if (!u) return;
      const doc = { _id: key, value };
      const raw = (typeof u.db?.get === 'function' ? u.db.get(key) : (typeof u.dbGet === 'function' ? u.dbGet(key) : null));
      if (raw && raw._rev) doc._rev = raw._rev;
      const res = typeof u.db?.put === 'function' ? u.db.put(doc) : (typeof u.dbPut === 'function' ? u.dbPut(doc) : null);
      if (res && res.error) throw new Error('保存失败: ' + res.message);
    },
    // dialogs / shell
    selectFolder() {
      if (typeof window.utools?.showOpenDialog !== 'function') return [];
      const r = window.utools.showOpenDialog({
        title: '选择项目文件夹',
        buttonLabel: '添加',
        properties: ['openDirectory', 'multiSelections'],
      });
      return r || [];
    },
    openPath(p) {
      const err = window.utools && window.utools.shellOpenPath(p);
      return err || null;
    },
    showItemInFolder(p) { if (window.utools) window.utools.shellShowItemInFolder(p); },
    openInBrowser(url) { if (window.utools) window.utools.shellOpenExternal(url); },
    copyText(t) { if (window.utools) window.utools.copyText(t); },
    notify(body) { if (window.utools && window.utools.showNotification) window.utools.showNotification(body); },
    isDark() { return window.utools ? !!window.utools.isDarkColors() : false; },
    killPid(pid) {
      return new Promise((resolve) => {
        const done = (ok, err) => resolve(ok ? { ok: true } : { ok: false, error: err || '结束进程失败' });
        if (isWin) {
          execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, (err, stdout, stderr) => done(!err, err && (stderr || err.message)));
        } else {
          try { process.kill(-pid, 'SIGKILL'); done(true); } catch (e) { try { process.kill(pid, 'SIGKILL'); done(true); } catch (e2) { done(false, e2.message); } }
        }
      });
    },
    openTerminal(cwd) {
      if (isWin) {
        // 优先 Windows Terminal，回退 cmd
        const p = spawn('cmd.exe', ['/d', '/c', 'wt.exe', '-d', cwd], { windowsHide: true, detached: true, stdio: 'ignore' });
        p.on('error', () => {
          const c = spawn('cmd.exe', ['/k'], { cwd, windowsHide: false, detached: true, stdio: 'ignore', shell: true });
          c.unref();
        });
        p.unref();
      } else {
        const p = spawn('x-terminal-emulator', [], { cwd, detached: true, stdio: 'ignore' });
        p.on('error', () => { const q = spawn('xterm', [], { cwd, detached: true, stdio: 'ignore' }); q.unref(); });
        p.unref();
      }
    },
    // git
    git: {
      status: gitStatus,
      diffFile: gitDiffFile,
      log: gitLog,
      branches: gitBranches,
      // 提交行引用标签（分支/tag，git graph 风）：hash -> [label…]
      async commitBranches(cwd, limit = 200) {
        const sep = '\u0001', fld = '\u0002';
        const out = await git(cwd, ['log', `--pretty=format:%H${fld}%D${sep}`, '-n', String(limit)]);
        const map = {};
        for (const row of out.split(sep).filter((r) => r.trim())) {
          const [hash, refs] = row.split(fld);
          const labels = String(refs || '').split(',').map((s) => s.trim()).filter(Boolean)
            .map((r) => r.replace(/^HEAD -> /, '').replace(/^tag: /, ''))
            .map((r) => (r.startsWith('origin/') ? 'Ω ' + r.slice(7) : r));
          if (labels.length) map[(hash || '').trim()] = [...new Set(labels)];
        }
        return map;
      },
      checkout: async (cwd, ref) => { await git(cwd, ['checkout', ref]); return true; },
      stage: (cwd, files) => git(cwd, ['add', '--', ...files]),
      unstage: (cwd, files) => git(cwd, ['reset', 'HEAD', '--', ...files]),
      discard: (cwd, files) => git(cwd, ['checkout', '--', ...files]),
      discardUntracked: async (cwd, files) => {
        for (const f of files) { try { await fsp.rm(path.join(cwd, f), { recursive: true }); } catch (e) {} }
      },
      commit: gitCommit,
      push: (cwd) => git(cwd, ['push']),
      pull: (cwd) => git(cwd, ['pull', '--no-rebase']),
      fetch: (cwd) => git(cwd, ['fetch', '--all', '--prune']),
      hasRemote: gitHasRemote,
      commitFileNames: async (cwd, hash) => {
        const out = await git(cwd, ['show', '--name-status', '--format=', hash]);
        return out.split('\n').filter(Boolean).map((l) => {
          const parts = l.split('\t');
          return { ins: parts[0], path: parts[parts.length - 1] };
        });
      },
    },
    // process
    runScript,
    stopProc,
    runOnce,
    getProc(id) {
      const rec = procs.get(id);
      if (!rec) return null;
      return { ...rec.handle, out: rec.handle.out.join('') };
    },
    onProcOutput(id, cb) {
      const rec = procs.get(id);
      if (rec) rec.handle.listeners.push(cb);
    },
    // fs
    fs: {
      listDir,
      isTextFile,
      readText,
      writeText: (file, content) => fsp.writeFile(file, content, 'utf8'),
      mkdir: (dir) => fsp.mkdir(dir, { recursive: true }),
      rm: (p) => fsp.rm(p, { recursive: true }),
      rename: (a, b) => fsp.rename(a, b),
      exists: (p) => fsp.stat(p).then(() => true, () => false),
    },
    // ai
    aiChat,
    // 项目身份识别：logo 图标（dataURL）+ 技术栈
    async identify(base) {
      let icon = null, framework = '';
      for (const rel of ['logo.png', 'logo.svg', 'logo.jpg', 'logo.jpeg', 'icon.png', 'icon.svg', 'favicon.ico', 'favicon.png', 'public/favicon.ico', 'public/favicon.png', 'public/logo.png', 'public/logo.svg', 'public/icon.png', 'src/assets/logo.png', 'src/assets/logo.svg', 'assets/logo.png', 'assets/logo.svg', 'assets/icon.png', 'static/logo.png', 'docs/logo.png', 'static/favicon.ico', 'src-tauri/icons/icon.png', 'src-tauri/icons/32x32.png', 'resources/icon.png']) {
        const full = path.join(base, rel);
        try {
          const st = fs.statSync(full);
          if (!st.isFile() || st.size < 64 || st.size > 512 * 1024) continue;
          const buf = fs.readFileSync(full);
          if (!buf.includes(0) && !/\.svg$/.test(rel)) continue;
          const ext = path.extname(full).toLowerCase();
          const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.ico' ? 'image/x-icon' : ext === '.png' ? 'image/png' : 'image/jpeg';
          icon = `data:${mime};base64,${buf.toString('base64')}`;
          break;
        } catch (e) {}
      }
      const read = (f) => { try { return fs.readFileSync(path.join(base, f), 'utf8'); } catch (e) { return null; } };
      const deps = {};
      try { const pkg = JSON.parse(read('package.json') || '{}'); Object.assign(deps, pkg.dependencies || {}, pkg.devDependencies || {}); } catch (e) {}
      const has = (k) => Object.keys(deps).some((d) => d === k || d.startsWith('@' + k + '/'));
      if (has('next')) framework = 'Next';
      else if (has('nuxt')) framework = 'Nuxt';
      else if (has('vite')) framework = 'Vite';
      else if (has('vue')) framework = 'Vue';
      else if (has('react')) framework = 'React';
      else if (has('svelte')) framework = 'Svelte';
      else if (has('electron')) framework = 'Electron';
      else if (has('express')) framework = 'Express';
      if (!framework) {
        const py = read('pyproject.toml') || read('requirements.txt') || '';
        const exists = (f) => { try { fs.statSync(path.join(base, f)); return true; } catch (e) { return false; } };
        if (/django/i.test(py)) framework = 'Django';
        else if (/fastapi/i.test(py)) framework = 'FastAPI';
        else if (/flask/i.test(py)) framework = 'Flask';
        else if (exists('go.mod')) framework = 'Go';
        else if (exists('Cargo.toml')) framework = 'Rust';
        else if (exists('pom.xml') || exists('build.gradle')) framework = 'Java';
      }
      return { icon, framework };
    },
    // system monitor
    sys: { memory: sysMemory, cpu: sysCpu, ports: sysPorts },
    // misc
    defaultCommitPrompt: '你是资深工程师。根据我提供的 git 暂存区变更，生成一条简洁规范的中文 commit message，遵循 Conventional Commits（如 feat/fix/docs/refactor/perf/chore/test(scope): 描述）。只输出消息本身，不要任何解释、代码块或引号，50 字以内。',
  };
}
