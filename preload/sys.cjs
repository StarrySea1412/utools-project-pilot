// preload/sys.cjs — 系统监测域：内存 / CPU / 端口监听 / 进程信息 / HTTP 探活
// 端口归属需要内部脚本注册表 → 经 proc.listActiveInternal() 这一条显式通道拿（唯一跨域依赖）。
const { execFile } = require('child_process');
const os = require('os');
const http = require('http');
const fsp = require('fs').promises;
const path = require('path');
const { isWin } = require('./env.cjs');
const { listActiveInternal } = require('./proc.cjs');

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

// 本插件自身（uTools 渲染宿主 Node 进程）的资源占用
function sysSelf() {
  const mu = process.memoryUsage();
  return {
    pid: process.pid,
    rss: mu.rss, heapUsed: mu.heapUsed, heapTotal: mu.heapTotal, external: mu.external,
    uptime: process.uptime(),
    totalMem: os.totalmem(),
    pct: mu.rss / os.totalmem(),
  };
}

let procInfoCache = new Map(); // pid -> { at, name, commandLine, executablePath, ppid, mem }
let winInfoRefreshedAt = 0;    // 上次 WMI 全量刷新时间（内存占用 30s 周期刷新）

async function queryProcessesWin(pids) {
  const res = new Map();
  if (!pids || !pids.length) return res;
  const filter = pids.map((id) => `ProcessId = ${id}`).join(' OR ');
  const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ([wmisearcher]"SELECT ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath,WorkingSetSize FROM Win32_Process WHERE ${filter}").Get() | Select-Object ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath,WorkingSetSize | ConvertTo-Json -Compress`;
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
        mem: +item.WorkingSetSize || 0,
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
        const statRaw = await fsp.readFile(`/proc/${pid}/status`, 'utf8').catch(() => '');
        const mm = statRaw.match(/^VmRSS:\s+(\d+)\s*kB/m);
        res.set(pid, { pid, ppid: null, name: path.basename(exe) || '', commandLine, executablePath: exe, mem: mm ? +mm[1] * 1024 : 0 });
      } catch (e) {}
    }
    return res;
  }
  const r = await new Promise((resolve) => {
    execFile('ps', ['-p', pids.join(','), '-o', 'pid=,ppid=,comm=,rss=,command='], { timeout: 5000 }, (err, stdout) => resolve(err ? '' : stdout));
  });
  for (const line of (r || '').split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const pid = +parts[0];
      const ppid = +parts[1];
      const name = parts[2];
      const mem = +parts[3] * 1024 || 0;
      const commandLine = parts.slice(4).join(' ');
      if (pid) res.set(pid, { pid, ppid, name, commandLine, executablePath: name, mem });
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

  // Windows：一条 WMI 查询拉齐 名称/命令行/内存——增量补新 PID，30s 周期刷新内存
  // （替代原 tasklist + WMI 双进程轮询；实测 tasklist 单次 ~2s，WMI ~0.65s）
  if (isWin) {
    const missingPids = [...allListeningPids].filter((pid) => !procInfoCache.has(pid));
    if (allListeningPids.size > 0 && (missingPids.length > 0 || Date.now() - winInfoRefreshedAt > 30000)) {
      try {
        const queried = await queryProcessesWin([...allListeningPids]);
        for (const [pid, info] of queried) {
          procInfoCache.set(pid, { at: Date.now(), ...info });
        }
        winInfoRefreshedAt = Date.now();
      } catch (e) {}
    }
  } else {
    // unix：/proc 与 ps 读取廉价，每轮全量刷新（含内存）
    if (allListeningPids.size > 0) {
      try {
        const queried = await queryProcessesUnix([...allListeningPids]);
        for (const [pid, info] of queried) {
          procInfoCache.set(pid, { at: Date.now(), ...info });
        }
      } catch (e) {}
    }
  }

  const activeInternal = listActiveInternal();
  // 内部脚本进程树：从 shell 根 pid 沿 ppid 向下收全后代
  // cmd.exe → (npm/vite.cmd) → 实际监听进程 可能隔多层，一层 ppid 不够
  const descendantsOf = new Map(); // rootPid -> Set(全后代 pid)
  const pidPpid = new Map(); // pid -> ppid（用已知进程信息构建）
  for (const [, info] of procInfoCache) if (info.ppid != null) pidPpid.set(info.pid, info.ppid);
  for (const intProc of activeInternal) {
    const set = new Set([intProc.pid]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [pid, ppid] of pidPpid) {
        if (set.has(ppid) && !set.has(pid)) { set.add(pid); grew = true; }
      }
      // 也收 shell 根的直接后代（可能不在监听列表缓存里）
      for (const [, info] of procInfoCache) {
        if (set.has(info.ppid) && !set.has(info.pid)) { set.add(info.pid); grew = true; }
      }
    }
    descendantsOf.set(intProc.pid, set);
  }

  const result = [];
  for (const [port, pidsSet] of rawPorts.entries()) {
    const pids = [...pidsSet];
    const processes = pids.map((pid) => procInfoCache.get(pid) || { pid, name: '', commandLine: '', executablePath: '', ppid: null, mem: 0 });
    const names = [...new Set(processes.map((p) => p.name).filter(Boolean))];
    const mem = processes.reduce((n, p) => n + (p.mem || 0), 0);

    let isInternal = false;
    let internalScriptName = null;
    let internalCwd = null;

    for (const intProc of activeInternal) {
      const tree = descendantsOf.get(intProc.pid) || new Set([intProc.pid]);
      const inTree = pids.some((pid) => tree.has(pid));
      if (inTree) {
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
      mem,
      processes,
    });
  }

  return result.sort((a, b) => a.port - b.port);
}

// 服务健康探测：对 HTTP 开发端口发一次 GET /，收到任何响应头即算存活（404/500 也算活着），
// 测量首包延迟。只连 127.0.0.1，不发往外部。
function probePort(port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = http.get({ host: '127.0.0.1', port, path: '/', agent: false, timeout: timeoutMs, headers: { Connection: 'close', 'User-Agent': 'Seewrok-Health/1.0' } }, (res) => {
      const ms = Date.now() - started;
      res.resume(); // 不读 body，排空后连接自动关闭
      resolve({ ok: true, ms, code: res.statusCode || 0 });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, ms: Date.now() - started, error: 'timeout' }); });
    req.on('error', (e) => resolve({ ok: false, ms: Date.now() - started, error: e.code || String(e.message || e) }));
  });
}

async function probePorts(ports, timeoutMs = 2500) {
  const list = (ports || []).map((p) => Number(p)).filter((p) => p > 0 && p < 65536);
  const results = await Promise.all(list.map((port) => probePort(port, timeoutMs)));
  return list.map((port, i) => ({ port, ...results[i] }));
}

// window.pilot.sys 的完整命名空间
const sysApi = { memory: sysMemory, cpu: sysCpu, ports: sysPorts, self: sysSelf, probe: probePorts };

module.exports = { sysApi };
