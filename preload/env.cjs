// preload/env.cjs — 所有 Node 桥模块共用的底座：平台判断 / 输出截断 / 命令执行 / shell 解析
// 依赖方向见 docs/ARCHITECTURE.md：env 被所有模块依赖，自身不依赖任何兄弟模块。
const { execFile } = require('child_process');

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

function shellArgs(cmd) {
  return isWin ? { file: 'cmd.exe', args: ['/d', '/s', '/c', cmd] } : { file: '/bin/bash', args: ['-lc', cmd] };
}

module.exports = { isWin, MAX_BUF, cut, runCmd, shellArgs };
