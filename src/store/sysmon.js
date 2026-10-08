// store/sysmon.js — 系统监测域：内存/CPU 轮询 / 服务健康探测 / 端口归属
// 前后台暂停用 isBgPaused()/setBackgroundPaused() 函数接口共享（gitsync 也要读），不裸传变量。
import { store } from './state.js';
import { pushNotification } from './workspace.js';
import { detectServiceName, isHttpPort, portUrl, pathContains, normalizePath } from '../ports.js';
import { serviceTransitions } from '../health.js';

// 插件收起（onPluginOut）时置 true：暂停监控类轮询（端口/系统/git），回前台立即刷新一轮。
// 崩溃监测（procWatch）与自动任务不受影响——隐藏期间服务崩了仍要能通知。
let bgPaused = false;
let sysPoll = null; // { fast, slow } 由 startSysMonitor 注入
export function isBgPaused() { return bgPaused; }

export function setBackgroundPaused(v) {
  bgPaused = v;
  if (!v && sysPoll) { sysPoll.fast(); sysPoll.slow(); }
}

export function startSysMonitor() {
  if (!window.pilot?.sys) return;
  store.sys = { mem: null, cpu: null, self: null, ports: [], portsLoading: false, portsError: '', memHistory: [], cpuHistory: [], selfHistory: [], health: {} };
  const pollFast = async () => {
    if (bgPaused) return;
    try {
      const mem = window.pilot.sys.memory();
      const cpu = window.pilot.sys.cpu();
      store.sys.mem = mem;
      store.sys.cpu = cpu;
      if (typeof window.pilot.sys.self === 'function') store.sys.self = window.pilot.sys.self();
      // 保留最近 60 个采样点用于走势图
      const push = (arr, v) => { arr.push(v); if (arr.length > 60) arr.shift(); };
      if (!Array.isArray(store.sys.memHistory)) store.sys.memHistory = [];
      if (!Array.isArray(store.sys.cpuHistory)) store.sys.cpuHistory = [];
      if (!Array.isArray(store.sys.selfHistory)) store.sys.selfHistory = [];
      push(store.sys.memHistory, mem.pct);
      if (cpu.pct != null) push(store.sys.cpuHistory, cpu.pct);
      if (store.sys.self?.rss) push(store.sys.selfHistory, store.sys.self.rss);
    } catch (e) { /* 忽略单次失败 */ }
  };
  const pollSlow = async () => {
    if (bgPaused) return;
    store.sys.portsLoading = true;
    try { store.sys.ports = await window.pilot.sys.ports(); store.sys.portsError = ''; }
    catch (e) { store.sys.portsError = String(e.message || e); store.sys.portsLoading = false; return; }
    store.sys.portsLoading = false;
    refreshServiceHealth().catch(() => {});
  };
  sysPoll = { fast: pollFast, slow: pollSlow };
  pollFast();
  pollSlow();
  setInterval(pollFast, 3000);
  setInterval(pollSlow, 15000);
}

// ---------- 服务健康探测 + 外部服务上下线通知 ----------
// HTTP 开发端口每轮探活（延迟/超时写入 store.sys.health，供端口弹窗与运行时面板显示）；
// 外部服务（VSCode / 终端里启动的）从在线到消失 → 通知一次，重新出现即清除标记。
// 内部脚本的崩溃由 procWatch 实时覆盖（更精准），这里只管外部服务。
const healthState = { seen: {}, lastScanAt: 0 };

export async function refreshServiceHealth() {
  if (!window.pilot?.sys?.probe) return;
  const httpPorts = (store.sys.ports || []).filter((p) => isHttpPort(p.port));
  if (!httpPorts.length) {
    store.sys.health = {};
    // 全空扫描可能是 netstat 失灵：保住 seen 重建基线，等服务真下线时下一轮再通知
    if (Object.keys(healthState.seen).length) healthState.lastScanAt = Date.now();
    return;
  }
  let results;
  try { results = await window.pilot.sys.probe(httpPorts.map((p) => p.port)); }
  catch (e) { return; }
  const health = {};
  for (const r of results) health[r.port] = { ok: r.ok, ms: r.ms, code: r.code || 0, at: Date.now() };
  store.sys.health = health;

  const matched = [];
  for (const p of httpPorts) {
    if (p.isInternal) continue;
    const proj = matchProjectForPort(p, store.projects);
    if (!proj) continue;
    matched.push({
      key: `${proj.id}:${p.port}`,
      projectId: proj.id,
      port: p.port,
      service: detectServiceName(p.commandLine, p.names, p.scriptName, p.port),
    });
  }
  const now = Date.now();
  // 两轮扫描间隔过长（收起恢复 / 休眠唤醒）：只重建基线不产事件，避免恢复瞬间刷屏
  const baseline = !!healthState.lastScanAt && now - healthState.lastScanAt > 60000;
  const { next, downs } = serviceTransitions(healthState.seen, matched, now, { baseline });
  healthState.seen = next;
  healthState.lastScanAt = now;
  for (const d of downs) {
    const proj = store.projects.find((x) => x.id === d.projectId);
    pushNotification('TriangleAlert', `「${proj?.name || d.projectId}」的外部服务 ${d.service} :${d.port} 已停止响应`, { projectId: d.projectId });
  }
}

// ---------- 服务与端口智能探测与项目归属 ----------
export function matchProjectForPort(portRecord, projects = store.projects) {
  if (!portRecord || !projects || !projects.length) return null;

  // 1. 内部进程标记：若为 Seewrok 启动脚本记录的工作目录匹配
  if (portRecord.isInternal && portRecord.cwd) {
    const matched = projects.find((p) => normalizePath(p.path) === normalizePath(portRecord.cwd));
    if (matched) return matched;
  }

  // 2. 检查 store.procHandles 中记录的内部脚本 PID 对应项目
  for (const handle of Object.values(store.procHandles || {})) {
    if (handle?.running && handle.projectId && handle.pid) {
      if ((portRecord.pids || []).includes(handle.pid)) {
        const matched = projects.find((p) => p.id === handle.projectId);
        if (matched) return matched;
      }
    }
  }

  // 3. 命令行 / 可执行路径 / 探测 cwd 包含检测
  const candidates = [];
  for (const proj of projects) {
    if (!proj.path) continue;
    let matched = false;

    if (pathContains(proj.path, portRecord.commandLine) ||
        pathContains(proj.path, portRecord.executablePath) ||
        (portRecord.cwd && pathContains(proj.path, portRecord.cwd))) {
      matched = true;
    }

    if (!matched && Array.isArray(portRecord.processes)) {
      for (const pr of portRecord.processes) {
        if (pathContains(proj.path, pr.commandLine) || pathContains(proj.path, pr.executablePath)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) candidates.push(proj);
  }

  if (candidates.length > 0) {
    // 优先匹配路径最具体/最长者（如 monorepo 或子目录场景）
    candidates.sort((a, b) => (b.path || '').length - (a.path || '').length);
    return candidates[0];
  }

  // 4. 回退兼容（针对无完整命令行信息或测试桩环境）：
  // 项目有运行中的持续脚本，且脚本运行时家族与端口进程名家族一致
  // （如 npm run dev 实际跑在 node 上；npm/node 同家族，python/pip 同家族）
  const FAMILY = {
    npm: 'node', node: 'node', npx: 'node', vite: 'node', next: 'node', yarn: 'node', pnpm: 'node',
    python: 'python', python3: 'python', pip: 'python', uvicorn: 'python', gunicorn: 'python', flask: 'python',
    java: 'java', gradle: 'java', go: 'go', php: 'php', ruby: 'ruby',
  };
  for (const proj of projects) {
    const runningScripts = (proj.scripts || []).filter((s) => s.persistent && store.procHandles?.[s.id]?.running);
    if (!runningScripts.length) continue;
    const families = new Set((portRecord.names || []).map((n) => FAMILY[String(n).toLowerCase().replace(/\.exe$/, '')]).filter(Boolean));
    const matched = runningScripts.some((s) => {
      const m = String(s.cmd || '').toLowerCase().match(/\b(npm|npx|yarn|pnpm|node|vite|next|python3?|pip|uvicorn|gunicorn|flask|java|gradle|go|php|ruby)\b/);
      return m && families.has(FAMILY[m[1]]);
    });
    if (matched) return proj;
  }

  return null;
}

// 获取某个项目当前正在运行的所有服务（无论内部启动还是外部启动）
export function projectServices(proj) {
  if (!proj) return [];
  const list = [];
  const matchedPorts = new Set();

  // 1. 内部持续脚本：正在运行即计入（端口随后由匹配补充进同一条目）
  for (const s of proj.scripts || []) {
    if (s.persistent && store.procHandles[s.id]?.running) {
      matchedPorts.add(null);
      list.push({
        port: null,
        service: s.name,
        name: s.name,
        pids: store.procHandles[s.id]?.pid ? [store.procHandles[s.id].pid] : [],
        pid: store.procHandles[s.id]?.pid || null,
        cmd: s.cmd || '',
        isInternal: true,
        url: null,
      });
    }
  }

  // 2. 从当前系统扫描到的监听端口中匹配属于本项目的服务
  if (Array.isArray(store.sys?.ports)) {
    for (const p of store.sys.ports) {
      const matched = matchProjectForPort(p, store.projects);
      if (matched && matched.id === proj.id) {
        if (matchedPorts.has(p.port)) continue;
        matchedPorts.add(p.port);
        const serviceName = detectServiceName(p.commandLine, p.names, p.scriptName, p.port);
        const internalEntry = list.find((item) => item.isInternal);
        if (internalEntry && !internalEntry.port && p.isInternal) {
          // 内部脚本已监听端口：合并到同一条目
          internalEntry.port = p.port;
          internalEntry.service = serviceName;
          internalEntry.pids = p.pids || internalEntry.pids;
          internalEntry.pid = (p.pids || [])[0] || internalEntry.pid;
          internalEntry.url = portUrl(p.port);
          internalEntry.mem = p.mem || internalEntry.mem || 0;
        } else {
          list.push({
            port: p.port,
            service: serviceName,
            name: p.scriptName || serviceName,
            pids: p.pids || [],
            pid: (p.pids || [])[0] || null,
            cmd: p.commandLine || '',
            isInternal: !!p.isInternal,
            url: portUrl(p.port),
            mem: p.mem || 0,
          });
        }
      }
    }
  }

  return list;
}

// 判断项目是否正在跑任何服务（内部脚本或外部服务）
export function isProjectRunning(proj) {
  if (!proj) return false;
  if ((proj.scripts || []).some((s) => s.persistent && store.procHandles[s.id]?.running)) return true;
  return projectServices(proj).length > 0;
}

// 项目路径 → 运行中的相关端口（精确定位属于该项目的监听端口）
export function projectPorts(proj) {
  if (!store.sys?.ports || !proj) return [];
  const services = projectServices(proj);
  const servicePorts = new Set(services.filter((s) => s.port).map((s) => s.port));
  return store.sys.ports.filter((p) => servicePorts.has(p.port));
}

// 反查端口所属项目及服务信息
export function portProject(portNumber) {
  if (!store.sys?.ports || !store.projects) return null;
  const p = store.sys.ports.find((x) => x.port === Number(portNumber));
  if (!p) return null;
  const proj = matchProjectForPort(p, store.projects);
  if (!proj) return null;
  const service = detectServiceName(p.commandLine, p.names, p.scriptName, p.port);
  return {
    project: proj,
    service,
    url: portUrl(p.port),
    port: p.port,
    pids: p.pids || [],
    cmd: p.commandLine || '',
    mem: p.mem || 0,
  };
}
