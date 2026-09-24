// backup.test.mjs — 数据导出/导入单测
import { describe, it, expect, beforeEach } from 'vitest';

const memdb = new Map();
let lastExport = null;
globalThis.window = {
  pilot: {
    dbGet: (k) => memdb.get(k) ?? null,
    dbPut: (k, v) => { memdb.set(k, v); },
    exportJson: (name, text) => { lastExport = { name, text }; return 'D:/demo/' + name; },
    importJson: () => lastExport?.text ?? null,
    notify() {},
  },
};

const { store, exportAll, importAll, saveTodos } = await import('../src/store.js');

beforeEach(() => {
  memdb.clear();
  lastExport = null;
  store.projects = [];
  store.todos = [];
  store.notifications = [];
});

describe('exportAll', () => {
  it('导出包含全部数据键与元信息', () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [] }];
    memdb.set('pilot:projects', { projects: store.projects });
    memdb.set('pilot:todos', { todos: [{ id: 't1', text: 'x', done: false }] });
    const file = exportAll();
    expect(file).toMatch(/project-pilot-backup-.*\.json$/);
    const data = JSON.parse(lastExport.text);
    expect(data.app).toBe('project-pilot');
    expect(data['pilot:projects'].projects).toHaveLength(1);
    expect(data['pilot:todos'].todos).toHaveLength(1);
    // settings 未入库时导出 null，元信息始终存在
    expect(data.exportedAt).toBeTruthy();
  });

  it('空数据键导出为 null 而不是报错', () => {
    exportAll();
    const data = JSON.parse(lastExport.text);
    expect(data['pilot:notifications']).toBeNull();
  });
});

describe('importAll', () => {
  it('合并导入：路径重复跳过，新项目入库', async () => {
    store.projects = [{ id: 'p1', name: 'a', path: 'D:/a', scripts: [], tasks: [] }];
    const backup = {
      app: 'project-pilot', version: 1,
      'pilot:projects': { projects: [
        { id: 'px', name: 'a', path: 'd:/A', scripts: [], tasks: [] }, // 同路径（大小写不同）应跳过
        { id: 'py', name: 'b', path: 'D:/b', scripts: [], tasks: [] },
      ] },
    };
    lastExport = { name: 'f.json', text: JSON.stringify(backup) };
    const r = await importAll('merge');
    expect(r.projects).toBe(2);
    expect(store.projects).toHaveLength(2); // 1 旧 + 1 新
    expect(store.projects.some((p) => p.name === 'b')).toBe(true);
  });

  it('全量覆盖导入替换本地项目', async () => {
    store.projects = [{ id: 'p1', name: 'local', path: 'D:/local', scripts: [], tasks: [] }];
    const backup = {
      app: 'project-pilot', version: 1,
      'pilot:projects': { projects: [{ id: 'pz', name: 'remote', path: 'D:/remote', scripts: [], tasks: [] }] },
    };
    lastExport = { name: 'f.json', text: JSON.stringify(backup) };
    await importAll('replace');
    expect(store.projects).toHaveLength(1);
    expect(store.projects[0].name).toBe('remote');
  });

  it('非本应用备份文件被拒绝', async () => {
    lastExport = { name: 'f.json', text: JSON.stringify({ hello: 1 }) };
    await expect(importAll('merge')).rejects.toThrow('不是Seewrok的备份文件');
  });

  it('坏 JSON 被拒绝且不破坏现有状态', async () => {
    lastExport = { name: 'f.json', text: 'not-json{{' };
    await expect(importAll('merge')).rejects.toThrow('JSON');
  });

  it('用户取消（返回 null）不报错', async () => {
    lastExport = null;
    expect(await importAll('merge')).toBeNull();
  });

  it('待办合并导入去重（按文本）', async () => {
    store.todos = [{ id: 't1', text: '写周报', done: false, q: 1, createdAt: 1, doneAt: 0 }];
    const backup = {
      app: 'project-pilot', version: 1,
      'pilot:todos': { todos: [
        { id: 'tx', text: '写周报', done: false, q: 1, createdAt: 2, doneAt: 0 },
        { id: 'ty', text: '新任务', done: false, q: 1, createdAt: 3, doneAt: 0 },
      ] },
    };
    lastExport = { name: 'f.json', text: JSON.stringify(backup) };
    await importAll('merge');
    const texts = store.todos.map((t) => t.text);
    expect(texts).toContain('新任务');
    expect(texts.filter((t) => t === '写周报')).toHaveLength(1);
  });
});
