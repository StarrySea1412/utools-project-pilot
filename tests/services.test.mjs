// services.test.mjs — 服务识别与项目-端口归属算法单测
import { describe, it, expect, beforeEach } from 'vitest';

// 先布好 window.pilot stub，store.js 挂载时不会用到，运行时函数会调用
const memdb = new Map();
globalThis.window = {
  pilot: {
    dbGet: (k) => memdb.get(k) ?? null,
    dbPut: (k, v) => { memdb.set(k, v); },
    notify() {},
  },
};

const { store, matchProjectForPort, projectServices, projectPorts, portProject, isProjectRunning } = await import('../src/store.js');
const { detectServiceName, normalizePath, pathContains, isHttpPort, portUrl } = await import('../src/ports.js');

function mkProj(id, name, path, extra = {}) {
  return { id, name, path, tags: [], scripts: [], tasks: [], notes: '', createdAt: 0, lastOpened: 0, ...extra };
}

beforeEach(() => {
  memdb.clear();
  store.projects = [];
  store.sys = { ports: [] };
  store.procHandles = {};
});

describe('路径归一化与包含检测', () => {
  it('normalizePath：统一反斜杠/正斜杠/末尾斜杠/大小写', () => {
    expect(normalizePath('D:\\Project\\MyApp\\')).toBe('d:/project/myapp');
    expect(normalizePath('D://project//myapp')).toBe('d:/project/myapp');
    expect(normalizePath('')).toBe('');
  });

  it('pathContains：命令行包含项目路径且边界安全', () => {
    expect(pathContains('D:/project/app', 'node D:\\project\\app\\server.js')).toBe(true);
    expect(pathContains('D:/project/app', 'D:/project/application/other.js')).toBe(false);
    expect(pathContains('D:/project/app', 'node src/server.js')).toBe(false);
  });
});

describe('服务类型识别 detectServiceName', () => {
  it('从命令行识别前端框架', () => {
    expect(detectServiceName('node node_modules/vite/bin/vite.js', ['node.exe'])).toBe('Vite');
    expect(detectServiceName('node node_modules/next/dist/bin/next dev', ['node.exe'])).toBe('Next.js');
    expect(detectServiceName('nuxt dev', ['node.exe'])).toBe('Nuxt');
  });

  it('从命令行识别 Python/Java 生态', () => {
    expect(detectServiceName('python -m uvicorn app.main:app', ['python.exe'])).toBe('Uvicorn');
    expect(detectServiceName('python manage.py runserver', ['python.exe'])).toBe('Django');
    expect(detectServiceName('java -jar spring-boot.jar', ['java.exe'])).toBe('Spring Boot');
  });

  it('从进程名识别数据库运行时', () => {
    expect(detectServiceName('mysqld.exe', ['mysqld.exe'])).toBe('MySQL');
    expect(detectServiceName('', ['postgres.exe'])).toBe('PostgreSQL');
    expect(detectServiceName('', ['redis-server.exe'])).toBe('Redis');
    expect(detectServiceName('', ['mongod.exe'])).toBe('MongoDB');
  });

  it('回退：无特征时给出进程名或端口标签', () => {
    expect(detectServiceName('', ['foo.exe'], '', null)).toBe('foo');
    expect(detectServiceName('', ['Code.exe'], '', null)).toBe('Code');
    expect(detectServiceName('', ['node.exe'], 'my-api', null)).toBe('my-api');
  });
});

describe('HTTP 端口识别', () => {
  it('isHttpPort：常见 Web 端口为 true，数据库端口为 false', () => {
    expect(isHttpPort(5173)).toBe(true);
    expect(isHttpPort(3000)).toBe(true);
    expect(isHttpPort(8080)).toBe(true);
    expect(isHttpPort(3306)).toBe(false);
    expect(isHttpPort(5432)).toBe(false);
    expect(isHttpPort(6379)).toBe(false);
  });

  it('portUrl：HTTP 端口返回 URL，非 HTTP 返回 null', () => {
    expect(portUrl(3000)).toBe('http://localhost:3000');
    expect(portUrl(3306)).toBeNull();
  });
});

describe('端口归属项目 matchProjectForPort', () => {
  it('通过命令行包含项目路径匹配', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/ai-image-studio')];
    const rec = { port: 5173, pids: [100], names: ['node.exe'], commandLine: 'node D:\\project\\ai-image-studio\\node_modules\\vite\\bin\\vite.js' };
    expect(matchProjectForPort(rec)?.id).toBe('p1');
  });

  it('通过探测 cwd 匹配（相对路径命令行场景）', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/ai-image-studio')];
    const rec = { port: 4173, pids: [100], names: ['node.exe'], commandLine: 'node src/server.js', cwd: 'D:\\project\\ai-image-studio\\' };
    expect(matchProjectForPort(rec)?.id).toBe('p1');
  });

  it('通过内部脚本标记（isInternal + cwd）匹配', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app')];
    const rec = { port: 3000, pids: [100], names: ['node.exe'], commandLine: '', isInternal: true, cwd: 'D:/project/app' };
    expect(matchProjectForPort(rec)?.id).toBe('p1');
  });

  it('嵌套项目时选择路径最具体者', () => {
    store.projects = [mkProj('p1', 'mono', 'D:/work'), mkProj('p2', 'sub', 'D:/work/my-app')];
    const rec = { port: 5173, pids: [100], names: ['node.exe'], commandLine: 'node D:/work/my-app/node_modules/vite/bin/vite.js' };
    expect(matchProjectForPort(rec)?.id).toBe('p2');
  });

  it('无关端口返回 null', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app')];
    const rec = { port: 3306, pids: [100], names: ['mysqld.exe'], commandLine: 'C:/Program Files/MySQL/mysqld.exe' };
    expect(matchProjectForPort(rec)).toBeNull();
  });

  it('回退兼容：脚本命令包含端口进程名（npm → node.exe 场景）', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app', {
      scripts: [{ id: 's1', name: 'dev', cmd: 'npm run dev', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true };
    const rec = { port: 3000, pids: [100], names: ['node.exe'], commandLine: '' };
    expect(matchProjectForPort(rec)?.id).toBe('p1');
  });

  it('回退兼容：脚本命令包含端口进程名（python → python.exe 场景）', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app', {
      scripts: [{ id: 's1', name: 'web', cmd: 'python -m app.web', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true };
    const rec = { port: 8000, pids: [100], names: ['python.exe'], commandLine: '' };
    expect(matchProjectForPort(rec)?.id).toBe('p1');
  });

  it('回退兼容：不匹配其他运行时进程（java 端口不给 node 项目）', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app', {
      scripts: [{ id: 's1', name: 'dev', cmd: 'npm run dev', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true };
    const rec = { port: 3000, pids: [100], names: ['java.exe'], commandLine: '' };
    expect(matchProjectForPort(rec)).toBeNull();
  });
});

describe('项目服务列表 projectServices', () => {
  it('汇总内部脚本与外部检测到的服务', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app', {
      scripts: [{ id: 's1', name: 'dev', cmd: 'npm run dev', persistent: true }],
    })];
    store.procHandles.s1 = { id: 'proc1', running: true, pid: 111 };
    store.sys = { ports: [
      { port: 3000, pids: [222], names: ['node.exe'], commandLine: 'node D:/project/app/node_modules/vite/bin/vite.js' },
      { port: 3306, pids: [50], names: ['mysqld.exe'], commandLine: 'C:/MySQL/mysqld.exe' },
    ] };
    const svcs = projectServices(store.projects[0]);
    // 内部运行脚本（procHandles 有 pid 但命令行未匹配上端口记录时也计入）
    expect(svcs.length).toBeGreaterThanOrEqual(1);
    expect(svcs[0].isInternal).toBe(true);
    expect(svcs[0].pid).toBe(111);
  });

  it('外部服务带端口与服务名和 URL', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app')];
    store.sys = { ports: [
      { port: 5173, pids: [222], names: ['node.exe'], commandLine: 'node D:/project/app/node_modules/vite/bin/vite.js' },
    ] };
    const svcs = projectServices(store.projects[0]);
    expect(svcs.length).toBe(1);
    expect(svcs[0].port).toBe(5173);
    expect(svcs[0].isInternal).toBe(false);
    expect(svcs[0].url).toBe('http://localhost:5173');
  });

  it('isProjectRunning：无服务时 false，有内部脚本或外部服务时 true', () => {
    const p1 = mkProj('p1', 'app', 'D:/project/app');
    store.projects = [p1];
    expect(isProjectRunning(p1)).toBe(false);

    p1.scripts.push({ id: 's1', name: 'dev', cmd: 'npm run dev', persistent: true });
    store.procHandles.s1 = { id: 'proc1', running: true };
    expect(isProjectRunning(p1)).toBe(true);

    const p2 = mkProj('p2', 'ext', 'D:/project/ext');
    store.projects.push(p2);
    store.sys = { ports: [{ port: 8000, pids: [9], names: ['python.exe'], commandLine: 'python D:/project/ext/main.py' }] };
    expect(isProjectRunning(p2)).toBe(true);
  });
});

describe('projectPorts 与 portProject 反查', () => {
  it('projectPorts 只返回属于该项目的端口', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app')];
    store.sys = { ports: [
      { port: 5173, pids: [222], names: ['node.exe'], commandLine: 'node D:/project/app/vite.js' },
      { port: 3306, pids: [50], names: ['mysqld.exe'], commandLine: 'C:/MySQL/mysqld.exe' },
      { port: 8000, pids: [9], names: ['python.exe'], commandLine: 'python D:/project/app/main.py' },
    ] };
    const ports = projectPorts(store.projects[0]);
    expect(ports.map((p) => p.port).sort((a, b) => a - b)).toEqual([5173, 8000]);
  });

  it('portProject：端口反查所属项目与服务', () => {
    store.projects = [mkProj('p1', 'app', 'D:/project/app')];
    store.sys = { ports: [
      { port: 5173, pids: [222], names: ['node.exe'], commandLine: 'node D:/project/app/node_modules/vite/bin/vite.js' },
    ] };
    const info = portProject(5173);
    expect(info?.project.id).toBe('p1');
    expect(info?.service).toBe('Vite');
    expect(info?.url).toBe('http://localhost:5173');
    expect(portProject(3306)).toBeNull();
  });
});
