// real-server.mjs — 浏览器「真数据」预览服务器（零依赖）
// 用法: node scripts/real-server.mjs  → http://127.0.0.1:30082/dist/index.html
// 与 uTools preload.js 的区别: 把 preload 里的 Node 能力搬到本进程，浏览器通过 /api 调用。
import http from 'http';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DB_FILE = path.join(ROOT, '.pilot-dev-db.json');
const SEED_DIR = 'D:/project';
const PORT = Number(process.env.PORT || 30082);
const HOST = '127.0.0.1';
const MAX_BUF = 256 * 1024;
const isWin = process.platform === 'win32';

// 单次请求异常不拖垮整个服务
process.on('uncaughtException', (e) => console.error('[uncaughtException]', (e && e.stack) || e));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', (e && (e.stack || e.message)) || e));
process.on('exit', (code) => console.error(`[exit] 进程退出 code=${code} ${new Date().toLocaleString()}`));
process.on('SIGINT', () => { console.error('[sigint] 收到中断'); process.exit(130); });
process.on('SIGTERM', () => { console.error('[sigterm] 收到终止'); process.exit(143); });

// ---------- 进程执行 ----------
function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, {
      cwd: opts.cwd, timeout: opts.timeout || 30000, maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'en_US.UTF-8' },
    }, (err, stdout, stderr) => {
      resolve({ code: err && err.code != null ? err.code : (err ? 1 : 0), stdout: stdout || '', stderr: stderr || (err && err.message) || '' });
    });
  });
}
function cut(s) { return s.length <= MAX_BUF ? s : s.slice(0, MAX_BUF) + `\n... [输出超长，已截断 ${s.length - MAX_BUF} 字符]\n`; }
async function git(cwd, args) {
  const r = await runCmd('git', args, { cwd, timeout: 60000 });
  if (r.code !== 0) throw new Error((r.stderr || `git ${args[0]} 退出码 ${r.code}`).trim());
  return r.stdout;
}

// ---------- Git（与 preload.js 完全一致的解析） ----------
async function gitStatus(cwd) {
  const out = await git(cwd, ['status', '--porcelain=v2', '--branch']);
  const st = { branch: '', upstream: '', ahead: 0, behind: 0, detached: false, entries: [], stagedCount: 0, unstagedCount: 0, untrackedCount: 0 };
  for (const line of out.split('\n')) {
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
      const x = e.x, y = e.y;
      if (x !== '.' && x !== '?') st.stagedCount++;
      if (y !== '.' && y !== '?') st.unstagedCount++;
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
  function addEntry(st, xy, file, orig) {
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
  if (file.untracked) {
    try {
      const c = await fsp.readFile(path.join(cwd, file.path), 'utf8');
      return cut(`+++ 新文件: ${file.path}\n` + c.split('\n').map((l) => '+' + l).join('\n'));
    } catch (e) { return '（无法读取文件）'; }
  }
  const args = ['diff', '--no-color', '-U3'];
  if (staged) args.push('--cached');
  args.push('--', file.path);
  return cut((await git(cwd, args)) || '（无差异）');
}
async function gitLog(cwd, n = 60) {
  // 分隔符用控制字符：Node execFile 禁止参数含 \u0000，故用 \u0001/\u001f
  const sep = '\u001f', fld = '\u0001';
  const out = await git(cwd, ['log', `--pretty=format:%H${fld}%h${fld}%an${fld}%aI${fld}%s${fld}%b${fld}%P${sep}`, '-n', String(n)]);
  return out.split(sep).filter((r) => r.trim()).map((r) => {
    const [hash, short, author, date, subject, body, parents] = r.split(fld);
    // --pretty=format 会在记录间插 \n，hash/parents 必须 trim 才能参与拓扑比对
    return { hash: (hash || '').trim(), short, author, date, subject: subject || '', body: (body || '').trim(), parents: (parents || '').trim() };
  });
}
async function gitBranches(cwd) {
  const out = await git(cwd, ['branch', '--format=%(HEAD)%00%(refname:short)%00%(upstream:short)']);
  return out.split('\n').filter(Boolean).map((l) => {
    const [head, name, upstream] = l.split('\u0000');
    return { current: head.trim() === '*', name, upstream: upstream || '' };
  });
}
// 每个提交行的分支/tag 标签（git graph 风）：用 %D 引用串解析，去重
async function gitCommitBranches(cwd, limit = 200) {
  const sep = '\u001f', fld = '\u0001';
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
}
async function gitCheckout(cwd, ref) {
  await git(cwd, ['checkout', ref]);
  return true;
}

// ---------- 进程/脚本 ----------
const procs = new Map();
let procSeq = 0;
function shellArgs(cmd) {
  return isWin ? { file: 'cmd.exe', args: ['/d', '/s', '/c', cmd] } : { file: '/bin/bash', args: ['-lc', cmd] };
}
function startScript(cwd, script) {
  const id = `p${++procSeq}_${Date.now()}`;
  const { file, args } = shellArgs(script.cmd);
  const proc = spawn(file, args, { cwd, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
  const handle = { id, out: '', running: true, code: null, scriptName: script.name || script.cmd, scriptId: script.id, cwd, pid: proc.pid, startedAt: Date.now() };
  const push = (chunk) => {
    handle.out += chunk.toString();
    if (handle.out.length > MAX_BUF) handle.out = handle.out.slice(-MAX_BUF + 1024);
  };
  proc.stdout.on('data', push);
  proc.stderr.on('data', push);
  proc.on('exit', (code) => { handle.running = false; handle.code = code; });
  proc.on('error', (err) => { handle.out += `[启动失败] ${err.message}\n`; handle.running = false; handle.code = -1; });
  procs.set(id, { proc, handle });
  return { id, running: true };
}
function stopProc(id) {
  const rec = procs.get(id);
  if (!rec) return { ok: false, error: '进程不存在' };
  rec.handle.running = false;
  return new Promise((resolve) => {
    if (isWin) execFile('taskkill', ['/pid', String(rec.proc.pid), '/T', '/F'], { windowsHide: true }, () => resolve({ ok: true }));
    else { try { process.kill(-rec.proc.pid, 'SIGTERM'); } catch (e) { try { rec.proc.kill('SIGTERM'); } catch (e2) {} } resolve({ ok: true }); }
  });
}
function runOnce(cwd, cmd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const { file, args } = shellArgs(cmd);
    let out = '', done = false;
    const proc = spawn(file, args, { cwd, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
    const kill = () => {
      if (isWin) execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else { try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { try { proc.kill('SIGKILL'); } catch (e2) {} } }
    };
    const timer = setTimeout(() => { if (done) return; done = true; kill(); resolve({ code: -1, output: cut(out) + '\n[执行超时，已终止]' }); }, timeoutMs);
    const collect = (c) => { out += c; if (out.length > 40000) out = out.slice(-40000); };
    proc.stdout.on('data', collect);
    proc.stderr.on('data', collect);
    proc.on('exit', (code) => { if (!done) { done = true; clearTimeout(timer); resolve({ code, output: cut(out) }); } });
    proc.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); resolve({ code: -1, output: cut(out) + '\n' + e.message }); } });
  });
}

// ---------- 文件 ----------
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.venv', 'venv', '__pycache__', 'target', '.cache', 'coverage']);
const TEXT_EXT = new Set(['.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.less', '.html', '.htm', '.vue', '.py', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.sh', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.env', '.xml', '.sql', '.log', '.gitignore', '.editorconfig', '.lock', '.mjs', '.cjs', '.bat', '.ps1', '.dart', '.kt', '.swift', '.rb', '.php']);
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

// ---------- AI ----------
function aiChat(cfg) {
  const base = (cfg.baseUrl || '').replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const payload = JSON.stringify({ model: cfg.model, messages: cfg.messages, temperature: cfg.temperature != null ? cfg.temperature : 0.6, stream: false });
  const u = new URL(url);
  const mod = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, {
      method: 'POST', timeout: 120000,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey || ''}`, 'Content-Length': Buffer.byteLength(payload) },
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
import https from 'https';

// ---------- 系统监测 ----------
let lastCpus = os.cpus();
function sysMemory() {
  const total = os.totalmem(), free = os.freemem();
  return { total, free, used: total - free, pct: (total - free) / total };
}
function sysCpu() {
  const now = os.cpus();
  let idle = 0, total = 0;
  for (let i = 0; i < now.length; i++) {
    const a = lastCpus[i], b = now[i];
    if (!a) break;
    total += Object.keys(b.times).reduce((s, k) => s + b.times[k] - a.times[k], 0);
    idle += b.times.idle - a.times.idle;
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

let procInfoCache = new Map(); // pid -> { at, name, commandLine, executablePath, ppid }

async function queryProcessesWin(pids) {
  const res = new Map();
  if (!pids || !pids.length) return res;
  const filter = pids.map((id) => `ProcessId = ${id}`).join(' OR ');
  const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ([wmisearcher]"SELECT ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath FROM Win32_Process WHERE ${filter}").Get() | Select-Object ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath | ConvertTo-Json -Compress`;
  const r = await new Promise((resolve) => {
    execFile('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psCmd,
    ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 8000 }, (err, stdout) => resolve(err ? null : stdout));
  });
  if (!r) return res;
  try {
    const parsed = JSON.parse(r.trim());
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of list) {
      if (!item || !item.ProcessId) continue;
      res.set(item.ProcessId, {
        pid: item.ProcessId,
        ppid: item.ParentProcessId ?? null,
        name: item.Name || '',
        commandLine: item.CommandLine || '',
        executablePath: item.ExecutablePath || '',
      });
    }
  } catch (e) {}
  return res;
}

async function queryProcessesUnix(pids) {
  const res = new Map();
  if (!pids || !pids.length) return res;
  if (process.platform === 'linux') {
    for (const pid of pids) {
      try {
        const cmdRaw = await fsp.readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
        const commandLine = cmdRaw.split('\0').filter(Boolean).join(' ');
        const exe = await fsp.readlink(`/proc/${pid}/exe`).catch(() => '');
        res.set(pid, { pid, ppid: null, name: path.basename(exe) || '', commandLine, executablePath: exe });
      } catch (e) {}
    }
    return res;
  }
  const r = await new Promise((resolve) => {
    execFile('ps', ['-p', pids.join(','), '-o', 'pid=,ppid=,comm=,command='], { timeout: 5000 }, (err, stdout) => resolve(err ? '' : stdout));
  });
  for (const line of (r || '').split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4) {
      const pid = +parts[0];
      const ppid = +parts[1];
      const name = parts[2];
      const commandLine = parts.slice(3).join(' ');
      if (pid) res.set(pid, { pid, ppid, name, commandLine, executablePath: name });
    }
  }
  return res;
}

async function sysPorts() {
  const r = await new Promise((resolve) => {
    if (isWin) {
      execFile('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 15000 },
        (err, stdout) => {
          if (!err && stdout) return resolve(stdout);
          execFile('cmd.exe', ['/d', '/c', 'netstat', '-ano', '-p', 'tcp'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 15000 },
            (e2, out2) => resolve(e2 ? '' : out2));
        });
    } else {
      execFile('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], { timeout: 15000 }, (err, stdout) => {
        if (!err && stdout) return resolve(stdout);
        execFile('ss', ['-lptn'], { timeout: 15000 }, (e2, out2) => resolve(e2 ? '' : out2));
      });
    }
  });

  const rawPorts = new Map();
  if (isWin) {
    for (const line of r.split('\n')) {
      if (!/LISTENING/.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const local = parts[1], pid = +parts[parts.length - 1];
      const pm = local.match(/:(\d+)$/);
      if (!pm) continue;
      const port = +pm[1];
      if (!rawPorts.has(port)) rawPorts.set(port, new Set());
      if (pid) rawPorts.get(port).add(pid);
    }
  } else {
    for (const line of r.split('\n')) {
      const m = line.match(/^(\S+)\s+(\d+).*?:(\d+)\s+\(LISTEN\)/);
      if (m) {
        const pid = +m[2], port = +m[3];
        if (!rawPorts.has(port)) rawPorts.set(port, new Set());
        if (pid) rawPorts.get(port).add(pid);
      }
    }
  }

  const allListeningPids = new Set();
  for (const pids of rawPorts.values()) {
    for (const pid of pids) {
      if (pid > 4) allListeningPids.add(pid);
    }
  }

  for (const cachedPid of procInfoCache.keys()) {
    if (!allListeningPids.has(cachedPid)) procInfoCache.delete(cachedPid);
  }

  const missingPids = [...allListeningPids].filter((pid) => !procInfoCache.has(pid));
  if (missingPids.length > 0) {
    try {
      const queried = isWin ? await queryProcessesWin(missingPids) : await queryProcessesUnix(missingPids);
      for (const [pid, info] of queried) {
        procInfoCache.set(pid, { at: Date.now(), ...info });
      }
    } catch (e) {}
  }

  const needNamePids = [...allListeningPids].filter((pid) => !procInfoCache.get(pid)?.name);
  if (needNamePids.length > 0 && isWin) {
    try {
      const nameMap = await pidNameMap();
      for (const pid of needNamePids) {
        const n = nameMap.get(pid);
        if (n) {
          const cur = procInfoCache.get(pid) || { pid, ppid: null, commandLine: '', executablePath: '' };
          cur.name = n;
          procInfoCache.set(pid, cur);
        }
      }
    } catch (e) {}
  }

  const activeInternal = [];
  for (const rec of procs.values()) {
    if (rec.handle?.running && rec.proc?.pid) {
      activeInternal.push({
        pid: rec.proc.pid,
        scriptName: rec.handle.scriptName,
        scriptId: rec.handle.scriptId,
        cwd: rec.handle.cwd,
      });
    }
  }

  const result = [];
  for (const [port, pidsSet] of rawPorts.entries()) {
    const pids = [...pidsSet];
    const processes = pids.map((pid) => procInfoCache.get(pid) || { pid, name: '', commandLine: '', executablePath: '', ppid: null });
    const names = [...new Set(processes.map((p) => p.name).filter(Boolean))];

    let isInternal = false;
    let internalScriptName = null;
    let internalCwd = null;

    for (const intProc of activeInternal) {
      const matchDirect = pids.includes(intProc.pid);
      const matchParent = processes.some((pr) => pr.ppid === intProc.pid);
      if (matchDirect || matchParent) {
        isInternal = true;
        internalScriptName = intProc.scriptName;
        internalCwd = intProc.cwd;
        break;
      }
    }

    const primary = processes.find((p) => p.commandLine) || processes[0] || {};

    result.push({
      port,
      pids,
      names,
      commandLine: primary.commandLine || '',
      executablePath: primary.executablePath || '',
      isInternal,
      scriptName: internalScriptName,
      cwd: internalCwd,
      processes,
    });
  }

  return result.sort((a, b) => a.port - b.port);
}

// ---------- DB（JSON 文件持久化） + 种子 ----------
async function loadDb() {
  try { return JSON.parse(await fsp.readFile(DB_FILE, 'utf8')); }
  catch (e) {
    const db = {};
    try { await seedProjects(db); } catch (e2) { console.error('种子生成失败', e2); }
    await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
}
async function seedProjects(db) {
  const dirents = await fsp.readdir(SEED_DIR, { withFileTypes: true });
  const dirs = [];
  for (const d of dirents) {
    if (!d.isDirectory() || d.name.startsWith('_') || d.name.startsWith('.')) continue;
    const full = path.join(SEED_DIR, d.name);
    if (!fs.existsSync(path.join(full, '.git'))) continue;
    let st = null;
    try { st = await fsp.stat(full); } catch (e) { continue; }
    dirs.push({ name: d.name, full, mtime: st.mtimeMs });
  }
  dirs.sort((a, b) => b.mtime - a.mtime);
  db['pilot:projects'] = {
    projects: dirs.slice(0, 8).map((d, i) => {
      let scripts = [];
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(d.full, 'package.json'), 'utf8'));
        scripts = Object.keys(pkg.scripts || {}).slice(0, 5).map((name) => ({
          id: 'sc_' + Math.random().toString(36).slice(2, 8), name,
          cmd: 'npm run ' + name, persistent: /^(dev|start|serve|preview)$/.test(name),
        }));
      } catch (e) {}
      return {
        id: 'prj_' + Math.random().toString(36).slice(2, 8), name: d.name,
        path: SEED_DIR + '/' + d.name, tags: [], color: i % 6, scripts, tasks: [],
        notes: '', createdAt: d.mtime, lastOpened: 0,
      };
    }),
  };
}

// ---------- 项目身份识别：logo 图标 + 技术栈 ----------
const ICON_CANDIDATES = ['logo.png', 'logo.svg', 'logo.jpg', 'logo.jpeg', 'icon.png', 'icon.svg', 'favicon.ico', 'favicon.png', 'public/favicon.ico', 'public/favicon.png', 'public/logo.png', 'public/logo.svg', 'public/icon.png', 'src/assets/logo.png', 'src/assets/logo.svg', 'assets/logo.png', 'assets/logo.svg', 'assets/icon.png', 'static/logo.png', 'docs/logo.png', 'static/favicon.ico', 'src-tauri/icons/icon.png', 'src-tauri/icons/32x32.png', 'resources/icon.png'];
const identCache = new Map(); // path -> {at, result}
async function identify(base) {
  const hit = identCache.get(base);
  if (hit && Date.now() - hit.at < 600000) return hit.result;
  let icon = null, framework = '';
  for (const rel of ICON_CANDIDATES) {
    const full = path.join(base, rel);
    try {
      const st = await fsp.stat(full);
      if (!st.isFile() || st.size < 64 || st.size > 512 * 1024) continue;
      const buf = await fsp.readFile(full);
      if (buf.includes(0) === false && !/\.svg$/.test(rel)) continue; // 纯文本当不了二进制图标
      const ext = path.extname(full).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.ico' ? 'image/x-icon' : ext === '.png' ? 'image/png' : 'image/jpeg';
      icon = `data:${mime};base64,${buf.toString('base64')}`;
      break;
    } catch (e) { /* 候选不存在，继续 */ }
  }
  const read = async (f) => fsp.readFile(path.join(base, f), 'utf8').catch(() => null);
  const deps = {};
  try {
    const pkg = JSON.parse(await read('package.json') || '{}');
    Object.assign(deps, pkg.dependencies || {}, pkg.devDependencies || {});
  } catch (e) {}
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
    const py = (await read('pyproject.toml')) || (await read('requirements.txt')) || '';
    if (/django/i.test(py)) framework = 'Django';
    else if (/fastapi/i.test(py)) framework = 'FastAPI';
    else if (/flask/i.test(py)) framework = 'Flask';
    else if (await fsp.stat(path.join(base, 'go.mod')).then(() => true, () => false)) framework = 'Go';
    else if (await fsp.stat(path.join(base, 'Cargo.toml')).then(() => true, () => false)) framework = 'Rust';
    else if (await fsp.stat(path.join(base, 'pom.xml')).then(() => true, () => false)) framework = 'Java';
    else if (await fsp.stat(path.join(base, 'build.gradle')).then(() => true, () => false)) framework = 'Java';
  }
  const result = { icon, framework };
  identCache.set(base, { at: Date.now(), result });
  return result;
}

// ---------- HTTP 基础 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 8 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function rewriteIndex(html) {
  return html
    .replace(/<script[^>]*utools-mock[^>]*><\/script>/, '<script src="./__pilot-bridge.js"></script>')
    .replace(/<title>/, '<title>[真数据] ');
}

const apiHandlers = {
  'GET /api/meta': () => ({ platform: process.platform, home: os.homedir() }),
  'GET /api/db': () => dbCache,
  'GET /api/sys/fast': () => ({ memory: sysMemory(), cpu: sysCpu() }),
  'POST /api/sys/ports': () => sysPorts(),
  'POST /api/run-once': ({ cwd, cmd, timeoutMs }) => runOnce(cwd, cmd, timeoutMs),
  'POST /api/proc/start': ({ cwd, script }) => startScript(cwd, script || {}),
  'POST /api/ai': (cfg) => aiChat(cfg),
};

const gitOps = {
  status: (b) => gitStatus(b.cwd),
  commitBranches: (b) => gitCommitBranches(b.cwd, b.limit),
  checkout: (b) => gitCheckout(b.cwd, b.ref),
  diffFile: (b) => gitDiffFile(b.cwd, b.file, b.staged),
  log: (b) => gitLog(b.cwd, b.n),
  branches: (b) => gitBranches(b.cwd),
  stage: (b) => git(b.cwd, ['add', '--', ...b.files]),
  unstage: (b) => git(b.cwd, ['reset', 'HEAD', '--', ...b.files]),
  discard: (b) => git(b.cwd, ['checkout', '--', ...b.files]),
  discardUntracked: async (b) => { for (const f of b.files) { try { await fsp.rm(path.join(b.cwd, f), { recursive: true }); } catch (e) {} } },
  commit: async (b) => { await git(b.cwd, ['commit', '-m', b.message]); return git(b.cwd, ['rev-parse', '--short', 'HEAD']); },
  push: (b) => git(b.cwd, ['push']),
  pull: (b) => git(b.cwd, ['pull', '--no-rebase']),
  fetch: (b) => git(b.cwd, ['fetch', '--all', '--prune']),
  hasRemote: async (b) => (await runCmd('git', ['remote'], { cwd: b.cwd })).stdout.trim().length > 0,
  commitFileNames: async (b) => {
    const out = await git(b.cwd, ['show', '--name-status', '--format=', b.hash]);
    return out.split('\n').filter(Boolean).map((l) => {
      const parts = l.split('\t');
      return { ins: parts[0], path: parts[parts.length - 1] };
    });
  },
};

const fsOps = {
  listDir: (a) => listDir(a[0]),
  readText: async (a) => {
    const buf = await fsp.readFile(a[0]);
    if (buf.length > 1024 * 512) throw new Error('文件过大（>512KB），请在系统中打开');
    if (buf.includes(0)) throw new Error('二进制文件，不支持预览');
    return buf.toString('utf8');
  },
  writeText: (a) => fsp.writeFile(a[0], a[1], 'utf8'),
  mkdir: (a) => fsp.mkdir(a[0], { recursive: true }),
  rm: (a) => fsp.rm(a[0], { recursive: true }),
  rename: (a) => fsp.rename(a[0], a[1]),
  exists: (a) => fsp.stat(a[0]).then(() => true, () => false),
};

function shellAction(op, arg) {
  const quiet = (cmd, args) => execFile(cmd, args, { windowsHide: true, timeout: 10000 }, () => {});
  try {
    if (op === 'openPath') isWin ? quiet('cmd.exe', ['/d', '/c', 'start', '', arg]) : quiet('xdg-open', [arg]);
    else if (op === 'showItemInFolder') quiet('explorer.exe', ['/select,', arg]);
    else if (op === 'openInBrowser') isWin ? quiet('cmd.exe', ['/d', '/c', 'start', '', arg]) : quiet('xdg-open', [arg]);
    else if (op === 'openTerminal') isWin ? quiet('cmd.exe', ['/d', '/c', 'wt.exe', '-d', arg]) : null;
    else if (op === 'copyText') { const c = spawn('clip', { windowsHide: true }); c.stdin.end(String(arg)); }
    else if (op === 'notify') console.log(`[通知] ${arg}`);
    else if (op === 'killPid') return new Promise((resolve) => {
      execFile('taskkill', ['/pid', String(arg), '/T', '/F'], { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) => {
        resolve(err ? { ok: false, error: (stderr || err.message).trim() } : { ok: true });
      });
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

let dbCache = {};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const p = url.pathname;
  try {
    // ----- API -----
    if (p.startsWith('/api/')) {
      const key = `${req.method} ${p}`;
      if (key === 'GET /api/meta' || key === 'GET /api/db' || key === 'GET /api/sys/fast') {
        return sendJson(res, 200, apiHandlers[key]());
      }
      const body = await readBody(req);
      if (key === 'POST /api/db') { dbCache[body.key] = body.value; await fsp.writeFile(DB_FILE, JSON.stringify(dbCache, null, 2)); return sendJson(res, 200, { ok: true }); }
      // 注意：/api/proc/start 必须先于 /api/proc/:id 匹配，否则 start 被当成进程 id 走 stopProc
      if (p === '/api/proc/start' && req.method === 'POST') return sendJson(res, 200, startScript(body.cwd, body.script || {}));
      let m;
      if ((m = p.match(/^\/api\/proc\/([^/]+)$/))) {
        if (req.method === 'GET') {
          const rec = procs.get(m[1]);
          if (!rec) return sendJson(res, 404, { message: '进程不存在' });
          return sendJson(res, 200, { id: rec.handle.id, out: rec.handle.out, running: rec.handle.running, code: rec.handle.code, scriptName: rec.handle.scriptName });
        }
        if (req.method === 'POST') return sendJson(res, 200, await stopProc(m[1]));
      }
      if (p === '/api/sys/ports' && req.method === 'POST') return sendJson(res, 200, await sysPorts());
      if (p === '/api/run-once') return sendJson(res, 200, await runOnce(body.cwd, body.cmd, body.timeoutMs));
      if (p === '/api/ai') return sendJson(res, 200, await aiChat(body));
      if (p === '/api/shell') return sendJson(res, 200, await shellAction(body.op, body.arg));
      if ((m = p.match(/^\/api\/git\/(\w+)$/)) && req.method === 'POST') {
        const fn = gitOps[m[1]];
        if (!fn) return sendJson(res, 404, { message: '未知 git 操作' });
        return sendJson(res, 200, await fn(body));
      }
      if ((m = p.match(/^\/api\/fs\/(\w+)$/)) && req.method === 'POST') {
        const fn = fsOps[m[1]];
        if (!fn) return sendJson(res, 404, { message: '未知 fs 操作' });
        return sendJson(res, 200, await fn(body.args));
      }
      if (p === '/api/ident' && req.method === 'POST') return sendJson(res, 200, await identify(body.args[0]));
      return sendJson(res, 404, { message: `未实现的接口: ${key}` });
    }
    // ----- 桥接脚本 -----
    if (p === '/dist/__pilot-bridge.js') {
      const src = await fsp.readFile(path.join(__dirname, 'pilot-bridge.js'), 'utf8');
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
      return res.end(src);
    }
    // ----- 静态文件 -----
    const rel = (p === '/' || p === '/dist' || p === '/dist/') ? 'index.html' : decodeURIComponent(p.replace(/^\/dist\//, ''));
    const file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) return sendJson(res, 403, { message: 'forbidden' });
    const data = await fsp.readFile(file);
    let out = data;
    if (file.endsWith('index.html')) out = Buffer.from(rewriteIndex(data.toString('utf8')), 'utf8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(out);
  } catch (e) {
    const msg = String(e.message || e);
    if (/ENOENT/.test(msg)) { res.writeHead(404); return res.end('Not Found'); }
    sendJson(res, 500, { message: msg });
  }
});

dbCache = await loadDb();
server.listen(PORT, HOST, () => {
  console.log(`[真数据预览] http://${HOST}:${PORT}/dist/index.html`);
  console.log(`[真数据预览] DB 文件: ${DB_FILE}（种子自 ${SEED_DIR} 的 git 仓库）`);
});
