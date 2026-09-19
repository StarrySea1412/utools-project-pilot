// ports.js — 端口业务归类：常见服务注释 + 进程分类（SysBar / PortsModal 共用）
const KNOWN = {
  53: 'DNS', 135: 'RPC', 139: 'NetBIOS', 445: 'SMB 文件共享', 1900: 'SSDP',
  3000: 'Node', 3001: 'Node', 3306: 'MySQL', 3389: '远程桌面', 5173: 'Vite',
  5174: 'Vite', 5353: 'mDNS', 5432: 'PostgreSQL', 6379: 'Redis', 7680: '传递优化',
  7890: '代理', 8000: 'HTTP', 8080: 'HTTP', 8888: 'HTTP', 27017: 'MongoDB',
};
// Windows 系统关键进程（这些端口的占用者不是"业务"）
const SYS_PROC = /(^|[,\s])(system|svchost|lsass|services|wininit|spoolsv|winlogon|smss|csrss|dwm|fontdrvhost|msmpeng|conhost|memcompression|sihost|tabtip)(\.exe)?\b/i;
// 开发/数据库运行时 → 业务端口
const DEV_PROC = /(^|[,\s])(node|pythonw?|java|javaw|uvicorn|gunicorn|postgres|mysqld|redis-server|mongod|dotnet|php|ruby|deno|bun|vite|next|webpack)(\.exe)?\b/i;

export function portLabel(port) { return KNOWN[port] || ''; }

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
