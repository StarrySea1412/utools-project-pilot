// preload/proc.cjs — 进程域：脚本常驻进程 / 一次性命令 / 进程树终止
// procs 注册表是全桥唯一进程台账；sys.cjs 通过 listActiveInternal() 做端口归属（唯一跨域通道）。
const { execFile, spawn } = require('child_process');
const { isWin, MAX_BUF, cut, shellArgs } = require('./env.cjs');

const procs = new Map(); // id -> {proc, out:[], running, cmd, cwd, scriptName}
let procSeq = 0;

function runScript(projectPath, script) {
  const id = `p${++procSeq}_${Date.now()}`;
  const { file, args } = shellArgs(script.cmd);
  const proc = spawn(file, args, { cwd: projectPath, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
  const handle = { id, out: [], running: true, code: null, scriptName: script.name || script.cmd, scriptId: script.id, cwd: projectPath, pid: proc.pid, startedAt: Date.now(), listeners: [] };
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
  return { id, running: true, pid: proc.pid };
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

function getProc(id) {
  const rec = procs.get(id);
  if (!rec) return null;
  return { ...rec.handle, out: rec.handle.out.join('') };
}

function onProcOutput(id, cb) {
  const rec = procs.get(id);
  if (rec) rec.handle.listeners.push(cb);
}

function killPid(pid) {
  return new Promise((resolve) => {
    const done = (ok, err) => resolve(ok ? { ok: true } : { ok: false, error: err || '结束进程失败' });
    if (isWin) {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, (err, stdout, stderr) => done(!err, err && (stderr || err.message)));
    } else {
      try { process.kill(-pid, 'SIGKILL'); done(true); } catch (e) { try { process.kill(pid, 'SIGKILL'); done(true); } catch (e2) { done(false, e2.message); } }
    }
  });
}

// 正在运行的内部脚本进程（sys.cjs 端口归属用）
function listActiveInternal() {
  const out = [];
  for (const rec of procs.values()) {
    if (rec.handle?.running && rec.proc?.pid) {
      out.push({
        pid: rec.proc.pid,
        scriptName: rec.handle.scriptName,
        scriptId: rec.handle.scriptId,
        cwd: rec.handle.cwd,
      });
    }
  }
  return out;
}

module.exports = { runScript, stopProc, runOnce, getProc, onProcOutput, killPid, listActiveInternal };
