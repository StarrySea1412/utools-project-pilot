// probe.test.mjs — preload sys.probe 端口探活集成测试（真实 http server）
// 存活判定标准：收到任何 HTTP 响应头即 ok（404 也算活着）；连接拒绝 / 超时 = 不健康。
import { describe, it, expect, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

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
const servers = [];

function startServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    servers.push(srv);
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

afterAll(() => { for (const s of servers.splice(0)) s.close(); });

// 拿一个当前空闲的端口：绑 0 分配后立刻释放
async function freePort() {
  const srv = await startServer(() => {});
  const port = srv.address().port;
  await new Promise((r) => srv.close(r));
  servers.splice(servers.indexOf(srv), 1);
  return port;
}

describe('sys.probe 端口探活', () => {
  it('HTTP 200 服务：ok + 延迟 + 状态码', async () => {
    const srv = await startServer((req, res) => { res.end('ok'); });
    const port = srv.address().port;
    const r = await pilot.sys.probe([port]);
    expect(r).toHaveLength(1);
    expect(r[0].port).toBe(port);
    expect(r[0].ok).toBe(true);
    expect(r[0].code).toBe(200);
    expect(r[0].ms).toBeGreaterThanOrEqual(0);
  });

  it('HTTP 404 也算存活（服务活着，只是路由不存在）', async () => {
    const srv = await startServer((req, res) => { res.statusCode = 404; res.end('nope'); });
    const port = srv.address().port;
    const r = await pilot.sys.probe([port]);
    expect(r[0].ok).toBe(true);
    expect(r[0].code).toBe(404);
  });

  it('无进程的端口：不健康（连接拒绝）', async () => {
    const port = await freePort();
    const r = await pilot.sys.probe([port]);
    expect(r[0].ok).toBe(false);
    expect(r[0].error).toBeTruthy();
  });

  it('批量探测：结果与传入端口一一对应', async () => {
    const srv = await startServer((req, res) => res.end('ok'));
    const open = srv.address().port;
    const closed = await freePort();
    const r = await pilot.sys.probe([open, closed]);
    expect(r.map((x) => x.port)).toEqual([open, closed]);
    expect(r[0].ok).toBe(true);
    expect(r[1].ok).toBe(false);
  });

  it('非法输入被过滤，不抛异常', async () => {
    const r = await pilot.sys.probe([]);
    expect(r).toEqual([]);
    const r2 = await pilot.sys.probe([0, -1, 99999, 'abc']);
    expect(r2).toEqual([]);
  });
});
