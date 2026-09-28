// ports.js — 端口业务归类：常见服务注释 + 进程分类（SysBar / PortsModal 共用）
const KNOWN = {
  53: 'DNS', 135: 'RPC', 139: 'NetBIOS', 445: 'SMB 文件共享', 1900: 'SSDP',
  3000: 'Node/Next', 3001: 'Node', 3306: 'MySQL', 3389: '远程桌面',
  4173: 'Vite Preview', 4174: 'Vite Preview', 4200: 'Angular',
  5000: 'Flask/HTTP', 5173: 'Vite', 5174: 'Vite', 5353: 'mDNS', 5432: 'PostgreSQL',
  6379: 'Redis', 7001: 'Egg.js', 7680: '传递优化', 7890: '代理',
  8000: 'HTTP', 8080: 'HTTP', 8081: 'HTTP', 8090: 'HTTP', 8630: 'Uvicorn',
  8765: 'SeeFlow', 8888: 'HTTP/Jupyter', 9000: 'HTTP/PHP', 9528: 'Vue Admin', 27017: 'MongoDB',
};
// Windows 系统关键进程（这些端口的占用者不是"业务"）
const SYS_PROC = /(^|[,\s])(system|svchost|lsass|services|wininit|spoolsv|winlogon|smss|csrss|dwm|fontdrvhost|msmpeng|conhost|memcompression|sihost|tabtip)(\.exe)?\b/i;
// 开发/数据库运行时 → 业务端口
const DEV_PROC = /(^|[,\s])(node|pythonw?|java|javaw|uvicorn|gunicorn|postgres|mysqld|redis-server|mongod|dotnet|php|ruby|deno|bun|vite|next|webpack)(\.exe)?\b/i;

export function portLabel(port) { return KNOWN[port] || ''; }

// 是否大概率为 HTTP/Web 开发服务端口
export function isHttpPort(port) {
  const p = Number(port);
  if ([80, 443, 3000, 3001, 4000, 4173, 4174, 4175, 4200, 5000, 5173, 5174, 5175, 7001, 8000, 8001, 8008, 8080, 8081, 8090, 8630, 8765, 8888, 9000, 9528].includes(p)) return true;
  // 3000~9999 之间的端口多数为开发 Web 服务
  return p >= 3000 && p <= 9999 && ![3306, 5432, 6379, 7680, 7890].includes(p);
}

export function portUrl(port) {
  return isHttpPort(port) ? `http://localhost:${port}` : null;
}

// 统一路径格式（全小写、统一正斜杠、去掉末尾斜杠）
export function normalizePath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
}

// 字节数 → 可读内存（<1MB 显示 KB，否则 MB/GB 一位小数）
export function fmtMem(bytes) {
  const b = Number(bytes) || 0;
  if (b <= 0) return '';
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

// 边界安全的路径包含检测（避免 /project/app 误判到 /project/app-plus）
export function pathContains(parent, childOrCmd) {
  const p = normalizePath(parent);
  const c = normalizePath(childOrCmd);
  if (!p || !c) return false;
  const idx = c.indexOf(p);
  if (idx === -1) return false;
  const after = c[idx + p.length];
  return !after || after === '/' || after === '"' || after === "'" || after === ' ' || after === '\\';
}

// 从命令行/进程名/端口推断正在运行的服务类型与友好名称
export function detectServiceName(cmd = '', names = [], scriptName = '', port = null) {
  const c = String(cmd || '').toLowerCase();
  const n = (names || []).map((x) => String(x || '').toLowerCase()).join(' ');

  // 1. 优先按命令行关键特征识别具体框架
  if (/(^|[\\/\s"'])vite(\.js)?\b/i.test(c)) return 'Vite';
  if (/(^|[\\/\s"'])next(\.js)?\b/i.test(c)) return 'Next.js';
  if (/(^|[\\/\s"'])nuxt\b/i.test(c)) return 'Nuxt';
  if (/(^|[\\/\s"'])webpack\b/i.test(c)) return 'Webpack';
  if (/(^|[\\/\s"'])astro\b/i.test(c)) return 'Astro';
  if (/(^|[\\/\s"'])svelte-kit\b/i.test(c)) return 'SvelteKit';
  if (/(^|[\\/\s"'])remix\b/i.test(c)) return 'Remix';
  if (/(^|[\\/\s"'])umi\b/i.test(c)) return 'Umi';
  if (/(^|[\\/\s"'])vue-cli-service\b/i.test(c)) return 'Vue CLI';
  if (/(^|[\\/\s"'])uvicorn\b/i.test(c)) return 'Uvicorn';
  if (/(^|[\\/\s"'])gunicorn\b/i.test(c)) return 'Gunicorn';
  if (/(^|[\\/\s"'])fastapi\b/i.test(c)) return 'FastAPI';
  if (/(^|[\\/\s"'])flask\b/i.test(c)) return 'Flask';
  if (/(^|[\\/\s"'])(django|manage\.py)\b/i.test(c)) return 'Django';
  if (/(^|[\\/\s"'])(spring-boot|springboot)\b/i.test(c)) return 'Spring Boot';
  if (/(^|[\\/\s"'])nest\b/i.test(c)) return 'NestJS';
  if (/(^|[\\/\s"'])express\b/i.test(c)) return 'Express';
  if (/(^|[\\/\s"'])seeflow\b/i.test(c)) return 'SeeFlow';
  if (/(^|[\\/\s"'])electron\b/i.test(c)) return 'Electron';
  if (/(^|[\\/\s"'])tauri\b/i.test(c)) return 'Tauri';

  // 2. 如果存在关联的内部脚本名称（如 dev / start / serve / api / web）
  if (scriptName) return scriptName;

  // 3. 从已知端口标签识别
  const label = port ? portLabel(port) : '';
  if (label && label !== 'HTTP') return label;

  // 4. 从进程名识别常见运行时
  if (/mysqld/i.test(n)) return 'MySQL';
  if (/postgres/i.test(n)) return 'PostgreSQL';
  if (/redis/i.test(n)) return 'Redis';
  if (/mongod/i.test(n)) return 'MongoDB';
  if (/node/i.test(n)) return 'Node';
  if (/python/i.test(n)) return 'Python';
  if (/java/i.test(n)) return 'Java';
  if (/go/i.test(n)) return 'Go';

  return label || (names[0] ? names[0].replace(/\.exe$/i, '') : 'Service');
}

// system=Windows 系统服务 / dev=开发与数据库业务 / app=第三方应用
export function portKind(p) {
  const names = (p.names || []).join(', ');
  if (!names) return 'unknown';
  if (SYS_PROC.test(names)) return 'system';
  if (DEV_PROC.test(names)) return 'dev';
  return 'app';
}
export const KIND_LABEL = { system: '系统', dev: '业务', app: '应用', unknown: '?' };

// SysBar 摘要：优先展示非系统端口，带进程/服务名
export function portText(p) {
  const label = portLabel(p.port);
  if (label) return ':' + p.port + ' ' + label;
  const short = ((p.names || [])[0] || '').replace(/\.exe$/i, '');
  return ':' + p.port + (short ? ' ' + short : '');
}
export function topPorts(list, n = 4) {
  const biz = list.filter((p) => portKind(p) !== 'system');
  return (biz.length ? biz : list).slice(0, n);
}
