global.window = {};
require('./_preload-copy.cjs');
const p = window.pilot;
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
