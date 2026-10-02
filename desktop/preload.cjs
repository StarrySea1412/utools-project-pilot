// desktop/preload.js — 独立桌面版渲染层桥（Electron preload）
// 在页面脚本（含 dist 里的 mock 脚本）之前执行：
//   1. 注入 window.utools shim —— mock 开头 `if (window.utools) return` 自动失效
//   2. require 根目录 preload.js —— 照常挂 window.pilot（与 uTools 内完全一致）
// utools API 与主进程之间走同步 IPC 单通道（pilot-call）；enter/out 事件走异步推送。
const { ipcRenderer, clipboard } = require('electron');

// 同步单通道：{ __error } 包装主进程异常
const call = (op, ...args) => {
  const r = ipcRenderer.sendSync('pilot-call', { op, args });
  if (r && typeof r === 'object' && r.__error) throw new Error(r.__error);
  return r;
};

// ---------- enter/out 事件分发（App.vue 的 onPluginEnter/onPluginOut） ----------
let enterCbs = [];
let outCbs = [];
ipcRenderer.on('plugin-enter', () => enterCbs.forEach((cb) => { try { cb({ type: '' }); } catch (e) {} }));
ipcRenderer.on('plugin-out', () => outCbs.forEach((cb) => { try { cb(); } catch (e) {} }));

// ---------- window.utools shim：只实现 preload.js / src 实际用到的 API ----------
window.utools = {
  isDesktop: true, // 与 mock 的 isMock 对应：SysBar 用它区分演示数据标记

  // db —— preload 侧 dbGet/dbPut 优先走 utools.db.*，这里不实现 db.* 命名空间，
  // preload 的回退分支（typeof u.dbGet === 'function'）会接住下面这两个：
  dbGet(id) { return call('dbGet', id); },
  dbPut(doc) { return call('dbPut', doc); },
  dbRemove(doc) { return call('dbRemove', doc._id || doc); },

  // 对话框（同步）
  showOpenDialog(opts) { return call('showOpenDialog', opts); },
  showSaveDialog(opts) { return call('showSaveDialog', opts); },

  // shell / 通知 / 主题
  shellOpenPath(p) { return call('shellOpenPath', p); },
  shellShowItemInFolder(p) { return call('shellShowItemInFolder', p); },
  shellOpenExternal(url) { return call('shellOpenExternal', url); },
  showNotification(body) { return call('showNotification', body); },
  isDarkColors() { return call('isDarkColors'); },

  // 剪贴板在 renderer 侧直接可用，不必绕主进程
  copyText(t) { clipboard.writeText(String(t ?? '')); },

  // 生命周期
  onPluginEnter(cb) { enterCbs.push(cb); },
  onPluginOut(cb) { outCbs.push(cb); },

  // uTools 专属的拖拽入参：Electron 下 HTML5 拖拽自带 File.path（App.vue 优先走那条路），这里留空即可
  getDragFilePaths() { return []; },
};

// ---------- 挂上现有 preload.js（window.pilot 全套） ----------
require('../preload.js');
