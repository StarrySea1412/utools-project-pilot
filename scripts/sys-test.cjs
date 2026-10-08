// sys-test.cjs — preload 系统监测域真机烟测（node scripts/sys-test.cjs）
// 注意：package.json type:module 下普通 Node require 不了 preload.js（CJS 源码），
// 它只能被 uTools / Electron 的 preload 加载器或 VM 沙箱执行——这里用后者。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

const require_ = createRequire(__dirname);
const code = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
const sandbox = {
  window: {},
  require: (id) => require_(id.startsWith('.') ? path.resolve(__dirname, '..', id) : id),
  process, console, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const p = sandbox.window.pilot;
(async () => {
  const mem = p.sys.memory();
  p.sys.cpu();
  await new Promise((r) => setTimeout(r, 600));
  const cpu = p.sys.cpu();
  const ports = await p.sys.ports();
  console.log(`内存: ${(mem.used / 2 ** 30).toFixed(1)} / ${(mem.total / 2 ** 30).toFixed(1)} GB（${Math.round(mem.pct * 100)}%）`);
  console.log(`CPU: ${cpu.pct == null ? '—' : Math.round(cpu.pct * 100) + '%'}（${cpu.cores} 核）`);
  console.log(`监听端口: ${ports.length} 个`);
  console.log('前 12: ' + ports.slice(0, 12).map((x) => `:${x.port}(${x.names[0] || '?'})`).join('  '));
  process.exit(0);
})();
