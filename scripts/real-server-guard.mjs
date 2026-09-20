// real-server-guard.mjs — real-server 自动重启护栏（Node 版，无编码/命令冲突）
// 用法: node scripts/real-server-guard.mjs
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'real-server.mjs');
function start() {
  const c = spawn(process.execPath, [serverPath], { stdio: 'inherit' });
  c.on('exit', (code, signal) => {
    console.error(`[guard] 服务器退出 code=${code} signal=${signal}，1 秒后重启...`);
    setTimeout(start, 1000);
  });
}
start();
