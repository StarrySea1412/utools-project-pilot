// git-status.test.mjs — preload git.status porcelain v2 解析集成测试（真实 git 仓库）
// 重点回归：重命名行 `2 R. ... R100 <newPath>\t<origPath>` 必须解析出新路径 + orig，
// 旧实现把 origPath 当成了 path，导致 UI 显示旧路径、暂存/丢弃拿错文件。
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

// preload.js 是 CommonJS 源码（package.json type:module 不影响源文件本身），VM 沙箱加载拿 window.pilot
function loadPilot() {
  const code = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  const sandbox = {
    window: {},
    require: (id) => require_(id),
    process, console, setTimeout, clearTimeout, setInterval, clearInterval,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.pilot;
}

const pilot = loadPilot();
const cleanup = [];

function mkRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-git-'));
  cleanup.push(repo);
  const g = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 'test@pilot.local');
  g('config', 'user.name', 'pilot-test');
  return { repo, g };
}

afterAll(() => { for (const dir of cleanup.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('git.status porcelain v2 解析', () => {
  it('基础：分支、XY 标记、未跟踪与修改计数', async () => {
    const { repo, g } = mkRepo();
    fs.writeFileSync(path.join(repo, 'a.txt'), 'hello\n');
    g('add', '-A');
    g('commit', '-m', 'init');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'hello changed\n');
    fs.writeFileSync(path.join(repo, 'new.txt'), 'x\n');

    const st = await pilot.git.status(repo);
    expect(st.branch).toBeTruthy();
    expect(st.entries.find((e) => e.path === 'a.txt')?.y).toBe('M');
    expect(st.unstagedCount).toBe(1);
    expect(st.entries.find((e) => e.path === 'new.txt')?.untracked).toBe(true);
    expect(st.untrackedCount).toBe(1);
    expect(st.dirty).toBe(2);
  });

  it('已暂存重命名（git mv）：path 为新路径且 orig 正确，不残留旧路径条目', async () => {
    const { repo, g } = mkRepo();
    fs.writeFileSync(path.join(repo, 'oldname.txt'), 'hello\n');
    g('add', '-A');
    g('commit', '-m', 'init');
    g('mv', 'oldname.txt', 'newname.txt');

    const st = await pilot.git.status(repo);
    expect(st.stagedCount).toBe(1);
    const e = st.entries.find((x) => x.path === 'newname.txt');
    expect(e).toBeTruthy();
    expect(e.renamed).toBe(true);
    expect(e.orig).toBe('oldname.txt');
    expect(e.x).toBe('R');
    expect(st.entries.some((x) => x.path === 'oldname.txt')).toBe(false);
  });

  it('重命名路径含空格：新路径与 orig 都完整', async () => {
    const { repo, g } = mkRepo();
    fs.writeFileSync(path.join(repo, 'old name.txt'), 'hello\n');
    g('add', '-A');
    g('commit', '-m', 'init');
    g('mv', 'old name.txt', 'new name.txt');

    const st = await pilot.git.status(repo);
    const e = st.entries.find((x) => x.path === 'new name.txt');
    expect(e?.renamed).toBe(true);
    expect(e?.orig).toBe('old name.txt');
  });

  it('重命名后又编辑（2 RM 行）：暂存/未暂存计数与 orig 都正确', async () => {
    const { repo, g } = mkRepo();
    fs.writeFileSync(path.join(repo, 'before.txt'), 'line1\nline2\nline3\nline4\nline5\n');
    g('add', '-A');
    g('commit', '-m', 'init');
    g('mv', 'before.txt', 'moved.txt');
    fs.writeFileSync(path.join(repo, 'moved.txt'), 'line1\nline2\nline3\nline4\nline5 edited\n');

    const st = await pilot.git.status(repo);
    const e = st.entries.find((x) => x.renamed);
    expect(e?.path).toBe('moved.txt');
    expect(e?.orig).toBe('before.txt');
    expect(e?.x).toBe('R');
    expect(e?.y).toBe('M');
    expect(st.stagedCount).toBe(1);
    expect(st.unstagedCount).toBe(1);
    // git 对未暂存的文件系统重命名不做 rename 检测（.D + ?），此处只针对已暂存重命名
    expect(st.entries.some((x) => x.path === 'before.txt')).toBe(false);
  });
});
