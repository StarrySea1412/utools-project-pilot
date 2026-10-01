// editors.test.mjs — 「用编辑器打开」探测与归档纯逻辑单测
import { describe, it, expect, beforeEach } from 'vitest';

// 先布好 window.pilot stub（store.js 挂载依赖）
const memdb = new Map();
globalThis.window = {
  pilot: {
    dbGet: (k) => memdb.get(k) ?? null,
    dbPut: (k, v) => { memdb.set(k, v); },
    notify() {},
    hasInPath: (cmd, isWin) => (cmd === 'code' ? true : false), // 测试桩：只有 code 在 PATH
    openWithEditor: (cmd) => { opened.push(cmd); return true; },
  },
};
const opened = [];

const { detectEditors, buildOpenCommand, EDITOR_DEFS } = await import('../src/editors.js');
const { store, activeProjects, archivedProjects, addProject, archiveProject, unarchiveProject } = await import('../src/store.js');

beforeEach(() => {
  memdb.clear();
  opened.length = 0;
  store.projects = [];
});

describe('buildOpenCommand 命令模板', () => {
  it('{path} 占位替换', () => {
    expect(buildOpenCommand('code {path}', 'D:/work/app')).toBe('code D:/work/app');
    expect(buildOpenCommand('D:/apps/ws/bin/webstorm64.exe {path}', 'D:/a')).toBe('D:/apps/ws/bin/webstorm64.exe D:/a');
  });
  it('无占位：路径追加在末尾并加引号', () => {
    expect(buildOpenCommand('subl', 'D:/my app')).toBe('subl "D:/my app"');
  });
  it('空模板返回 null；路径含空格时占位替换不加多余引号（模板自己控制）', () => {
    expect(buildOpenCommand('', 'D:/x')).toBeNull();
    expect(buildOpenCommand('   ', 'D:/x')).toBeNull();
    expect(buildOpenCommand('code "{path}"', 'D:/my app')).toBe('code "D:/my app"');
  });
});

describe('detectEditors 编辑器探测', () => {
  const isWin = true;
  const expandEnv = (p) => p.replace('%LOCALAPPDATA%', 'C:/Users/t/AppData/Local');
  it('PATH 命中：只列 PATH 候选', () => {
    const found = detectEditors({
      hasCmd: (c) => c === 'code',
      fileExists: () => false,
      expandEnv, isWin,
    });
    expect(found).toEqual([{ id: 'code', name: 'VS Code', how: 'path', cmd: 'code' }]);
  });
  it('PATH 未命中但安装文件存在：回退文件路径候选', () => {
    const found = detectEditors({
      hasCmd: () => false,
      fileExists: (p) => p.includes('cursor/Cursor.exe'),
      expandEnv, isWin,
    });
    expect(found).toEqual([{ id: 'cursor', name: 'Cursor', how: 'file', cmd: '%LOCALAPPDATA%/Programs/cursor/Cursor.exe' }]);
  });
  it('linux 下不查 winPaths', () => {
    const found = detectEditors({
      hasCmd: () => false,
      fileExists: () => true,
      expandEnv, isWin: false,
    });
    expect(found).toEqual([]);
  });
  it('多个命中按 EDITOR_DEFS 顺序', () => {
    const found = detectEditors({
      hasCmd: (c) => c === 'code' || c === 'subl',
      fileExists: () => false,
      expandEnv, isWin,
    });
    expect(found.map((f) => f.id)).toEqual(['code', 'sublime']);
    expect(found.every((f) => f.how === 'path')).toBe(true);
  });
  it('EDITOR_DEFS 覆盖主流编辑器', () => {
    expect(EDITOR_DEFS.map((d) => d.id)).toContain('code');
    expect(EDITOR_DEFS.map((d) => d.id)).toContain('cursor');
  });
});

describe('项目归档 activeProjects / archivedProjects', () => {
  it('归档后移出活动列表、进归档列表，恢复后回来', () => {
    const p = addProject('D:/work/app');
    addProject('D:/work/other');
    expect(activeProjects()).toHaveLength(2);

    archiveProject(p.id);
    expect(activeProjects().map((x) => x.id)).not.toContain(p.id);
    expect(archivedProjects().map((x) => x.id)).toContain(p.id);
    expect(store.projects).toHaveLength(2); // 数据本体不删

    unarchiveProject(p.id);
    expect(activeProjects().map((x) => x.id)).toContain(p.id);
    expect(archivedProjects()).toHaveLength(0);
  });

  it('恢复时补 lastOpened（浮到最近使用前列）', () => {
    const p = addProject('D:/work/app');
    p.lastOpened = 0;
    archiveProject(p.id);
    const before = Date.now();
    unarchiveProject(p.id);
    expect(p.lastOpened).toBeGreaterThanOrEqual(before);
  });

  it('重复归档/恢复幂等', () => {
    const p = addProject('D:/work/app');
    expect(archiveProject(p.id)).toBe(true);
    expect(archiveProject(p.id)).toBe(true);
    expect(unarchiveProject(p.id)).toBe(true);
    expect(unarchiveProject(p.id)).toBe(true);
  });

  it('不存在的 id 返回 false', () => {
    expect(archiveProject('nope')).toBe(false);
    expect(unarchiveProject('nope')).toBe(false);
  });
});
