// store.test.mjs — 状态与持久化动作单测（window.pilot 用内存 stub 替代）
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

const { store, addTodo, toggleTodo, removeTodo, setTodoQuad, clearDoneTodos,
  addProject, removeProject, saveTodos, today, saveAiAdvice, pushNotification, notifUnread } = await import('../src/store.js');

beforeEach(() => {
  memdb.clear();
  store.projects = [];
  store.todos = [];
  store.notifications = [];
});

describe('待办', () => {
  it('添加待办：非空入库并持久化，空文本拒绝', () => {
    const t = addTodo('写周报');
    expect(t).toBeTruthy();
    expect(store.todos[0].text).toBe('写周报');
    expect(t.done).toBe(false);
    expect(memdb.get('pilot:todos').todos).toHaveLength(1);
    expect(addTodo('   ')).toBeNull();
  });

  it('完成/取消完成切换并记录 doneAt', () => {
    const t = addTodo('任务A');
    toggleTodo(t.id);
    expect(t.done).toBe(true);
    expect(t.doneAt).toBeGreaterThan(0);
    toggleTodo(t.id);
    expect(t.done).toBe(false);
    expect(t.doneAt).toBe(0);
  });

  it('四象限取值循环且对负数/超界取模安全', () => {
    const t = addTodo('任务B');
    setTodoQuad(t.id, 5); // 5 % 4 = 1
    expect(t.q).toBe(1);
    setTodoQuad(t.id, -1); // 归一到 3
    expect(t.q).toBe(3);
  });

  it('清空已完成只保留未完成', () => {
    const a = addTodo('A'); addTodo('B');
    toggleTodo(a.id);
    clearDoneTodos();
    expect(store.todos.map((t) => t.text)).toEqual(['B']);
  });

  it('删除待办', () => {
    const t = addTodo('C');
    removeTodo(t.id);
    expect(store.todos).toHaveLength(0);
  });
});

describe('AI 今日建议持久化', () => {
  it('saveAiAdvice 写入当天日期与内容', () => {
    saveAiAdvice({ summary: '先处理 axonhub', items: [{ text: 'x' }] });
    const saved = memdb.get('pilot:aiAdvice');
    expect(saved.date).toBe(today());
    expect(saved.summary).toBe('先处理 axonhub');
    expect(store.aiAdvice.items).toHaveLength(1);
  });
});

describe('通知中心', () => {
  it('推送通知入库且未读数正确', () => {
    pushNotification('Bell', 'hello');
    pushNotification('Bell', 'world');
    expect(store.notifications).toHaveLength(2);
    expect(notifUnread()).toBe(2);
  });

  it('通知超过 50 条截断', () => {
    for (let i = 0; i < 55; i++) pushNotification('Bell', 'n' + i, { save: false });
    expect(store.notifications.length).toBeLessThanOrEqual(50);
  });
});

describe('项目管理', () => {
  it('按路径去重：重复添加返回 null', () => {
    expect(addProject('D:/work/alpha')).toBeTruthy();
    expect(addProject('d:/work/alpha')).toBeNull(); // 大小写不敏感
    expect(store.projects).toHaveLength(1);
  });

  it('项目名取路径最后一段', () => {
    const p = addProject('D:/work/beta/');
    expect(p.name).toBe('beta');
  });

  it('删除项目', () => {
    const p = addProject('D:/work/gamma');
    removeProject(p.id);
    expect(store.projects).toHaveLength(0);
  });
});
