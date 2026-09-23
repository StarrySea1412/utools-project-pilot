// mock-contract.test.mjs — mock 与 preload 的 window.pilot 契约一致性
// 防 public/mock/utools-mock.js 漂移：preload 暴露的每个方法 mock 必须实现
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(__dirname, '..');

// 在沙箱里跑 mock 脚本，收集 window.pilot 的方法名
function runMock() {
  const code = fs.readFileSync(path.join(root, 'public/mock/utools-mock.js'), 'utf8');
  const sandbox = {
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, title: '' },
    location: { search: '', protocol: 'http:' },
    navigator: { userAgent: 'vitest' },
    setTimeout, setInterval, clearTimeout, clearInterval,
    console,
  };
  sandbox.window = Object.assign(sandbox.window, { document: sandbox.document, location: sandbox.location, navigator: sandbox.navigator });
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window;
}

// 从 preload.js 源码静态抽取 window.pilot = {...} 里的方法名
function preloadApiNames() {
  const code = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const m = code.match(/window\.pilot\s*=\s*\{([\s\S]*?)\n\s{4}\}/);
  if (!m) throw new Error('preload.js 中未找到 window.pilot 挂载块');
  const names = new Set();
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^\s{6}([A-Za-z_$][\w$]*)\s*\(/);
    if (mm && !['if', 'for', 'while', 'switch', 'catch', 'return', 'function'].includes(mm[1])) names.add(mm[1]);
    const ns = line.match(/^\s{6}([a-z]+):\s*\{/);
    if (ns) names.add(ns[1]);
  }
  return names;
}

describe('mock 契约', () => {
  it('mock 脚本在无 window.utools 环境下可执行', () => {
    const w = runMock();
    expect(w.pilot).toBeTruthy();
    expect(w.utools).toBeTruthy();
  });

  it('preload 暴露的顶层 API mock 全部实现', () => {
    const w = runMock();
    const missing = [...preloadApiNames()].filter((n) => w.pilot[n] === undefined);
    expect(missing).toEqual([]);
  });

  it('mock git 命名空间覆盖 preload git 的所有方法', () => {
    const w = runMock();
    const code = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
    const gm = code.match(/git:\s*\{([\s\S]*?)\n\s{6}\}/);
    const mockGit = w.pilot.git || {};
    const missing = [];
    if (gm) {
      const KEYWORDS = ['if', 'for', 'while', 'switch', 'catch', 'return', 'function'];
      for (const line of gm[1].split('\n')) {
        const mm = line.match(/^\s{8}([A-Za-z_$][\w$]*)\s*\(/);
        if (mm && !KEYWORDS.includes(mm[1]) && mockGit[mm[1]] === undefined) missing.push(mm[1]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('mock dbGet/dbPut 语义与 preload 桥接一致（直接给值）', () => {
    const w = runMock();
    w.pilot.dbPut('k', { a: 1 });
    expect(w.pilot.dbGet('k')).toEqual({ a: 1 });
  });
});
