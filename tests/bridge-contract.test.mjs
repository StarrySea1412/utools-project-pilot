// bridge-contract.test.mjs — pilot-bridge（浏览器真数据桥）与 preload 的 API 面契约一致性
// preload 暴露的每个方法，浏览器桥必须都有——否则该功能在 dev:real 预览下是坏的。
// 历史教训：v1.12~v1.14 期间 bridge 漂移（tags/blame/stash/hunk 暂存/备份导入导出/sys.probe 缺失），
// 预览下这些功能直接不可用且无人发现；v1.14.1 补齐并加本测试锁死（与 mock-contract 同一守门思路）。
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(__dirname, '..');
const require_ = createRequire(import.meta.url);

// 收集对象上的全部方法路径（含命名空间，如 git.status / sys.probe）
function walkApi(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'function') out.push(prefix + k);
    else if (v && typeof v === 'object') out.push(...walkApi(v, prefix + k + '.'));
  }
  return out.sort();
}

// preload 真实 API 面（VM 沙箱加载，同 mock-contract 手法）
function loadPilotApi() {
  const code = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const sandbox = {
    window: {},
    // preload 拆分后入口会 require('./preload/*.cjs')，相对 id 要按项目根解析
    require: (id) => require_(id.startsWith('.') ? path.resolve(root, id) : id),
    process, console, setTimeout, clearTimeout, setInterval, clearInterval,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return walkApi(sandbox.window.pilot);
}

// pilot-bridge 在浏览器里加载即执行（顶层同步 XHR 拉元数据/DB）——桩掉 XHR/fetch/定时器后加载
function loadBridgeApi() {
  const code = fs.readFileSync(path.join(root, 'scripts', 'pilot-bridge.js'), 'utf8');
  class FakeXHR {
    open() {}
    setRequestHeader() {}
    send() { this.status = 200; this.responseText = '{}'; }
  }
  const sandbox = {
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    document: { createElement: () => ({ click() {} }) },
    navigator: { userAgent: 'vitest' },
    location: { protocol: 'http:' },
    XMLHttpRequest: FakeXHR,
    fetch: () => new Promise(() => {}), // 永不 resolve：契约测试只看方法面，不真发请求
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    console,
  };
  sandbox.window.XMLHttpRequest = FakeXHR;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return walkApi(sandbox.window.pilot);
}

describe('pilot-bridge 契约', () => {
  const pilot = loadPilotApi();
  const bridge = loadBridgeApi();

  it('bridge 不缺方法（preload 有的它都得有，否则预览下该功能是坏的）', () => {
    expect(pilot.filter((m) => !bridge.includes(m))).toEqual([]);
  });

  it('bridge 不多出方法（preload 没有的名字说明两边有分叉）', () => {
    expect(bridge.filter((m) => !pilot.includes(m))).toEqual([]);
  });
});
