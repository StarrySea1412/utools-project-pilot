// mock-contract.test.mjs — mock 与 preload 的 window.pilot 契约一致性
// 防 public/mock/utools-mock.js 漂移：preload 暴露的每个方法（含 git.xxx / sys.xxx / fs.xxx
// 命名空间）mock 必须实现。旧实现用正则从源码抽方法名，实际抽出 0 个、形同虚设；
// 现在 VM 加载 preload 拿到真实 API 面后全量比对。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(__dirname, '..');
const require_ = createRequire(import.meta.url);

// 收集对象上的全部方法路径（含命名空间，如 git.status / sys.ports）
function walkApi(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'function') out.push(prefix + k);
    else if (v && typeof v === 'object') out.push(...walkApi(v, prefix + k + '.'));
  }
  return out.sort();
}

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

// VM 加载 preload.js（CommonJS 源码），拿真实 API 面
function loadRealPilot() {
  const code = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
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

describe('mock 契约', () => {
  it('mock 脚本在无 window.utools 环境下可执行', () => {
    const w = runMock();
    expect(w.pilot).toBeTruthy();
    expect(w.utools).toBeTruthy();
  });

  it('preload 暴露的全部 API（含命名空间）mock 全部实现', () => {
    const real = walkApi(loadRealPilot());
    const mock = new Set(walkApi(runMock().pilot));
    // 防抽取再次空转：真实 API 面应远大于阈值（当前 54 项）
    expect(real.length).toBeGreaterThan(40);
    const missing = real.filter((n) => !mock.has(n));
    expect(missing).toEqual([]);
  });

  it('mock dbGet/dbPut 语义与 preload 桥接一致（直接给值）', () => {
    const w = runMock();
    w.pilot.dbPut('k', { a: 1 });
    expect(w.pilot.dbGet('k')).toEqual({ a: 1 });
  });
});
