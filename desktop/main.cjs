// desktop/main.js — 独立桌面版主进程壳（Electron）
// 与 uTools 插件形态共用同一套 dist/ 渲染产物与 preload.js 桥接层，
// 这里只做「窗口 + 托盘 + 热键 + 单实例 + utools shim 的主进程侧」。
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, globalShortcut, nativeTheme, Notification, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------- 可调常量 ----------
const HOTKEY = 'Alt+Shift+S';       // 全局热键：呼出/隐藏
const WIN_W = 980, WIN_H = 640;     // 与 plugin.json pluginSetting 一致
const APP_NAME = 'Seewrok';

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const DB_FILE = path.join(app.getPath('userData'), 'pilot-db.json');
const ICON = path.join(ROOT, 'logo.png');

// ---------- 单实例锁：二次启动聚焦已有窗口 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
app.on('second-instance', () => { if (mainWin) { showWin(); } });

// ---------- db（同步 IPC 供 renderer 读写，与 uTools dbGet/dbPut 语义一致） ----------
let dbCache = null;
function loadDb() {
  try { dbCache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { dbCache = {}; }
}
function saveDb() {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2));
  } catch (e) { console.error('db 保存失败', e); }
}

// ---------- utools shim 主进程侧：同步单通道 ----------
ipcMain.on('pilot-call', (event, { op, args = [] } = {}) => {
  let result = null, error = null;
  try {
    switch (op) {
      case 'dbGet': { const [id] = args; result = dbCache[id] ? { _id: id, value: dbCache[id].value } : null; break; }
      case 'dbPut': { const [doc] = args; dbCache[doc._id] = { value: doc.value }; saveDb(); result = { ok: true }; break; }
      case 'dbRemove': { const [id] = args; delete dbCache[id]; saveDb(); result = { ok: true }; break; }
      case 'showOpenDialog': { const [opts] = args; result = dialog.showOpenDialogSync(mainWin, opts) || []; break; }
      case 'showSaveDialog': { const [opts] = args; result = dialog.showSaveDialogSync(mainWin, opts) || null; break; }
      case 'isDarkColors': result = !!nativeTheme.shouldUseDarkColors; break;
      case 'showNotification': { const [body] = args; if (Notification.isSupported()) new Notification({ title: APP_NAME, body: String(body) }).show(); result = true; break; }
      case 'shellOpenPath': { const [p] = args; result = shell.openPath(p); break; }
      case 'shellShowItemInFolder': { const [p] = args; shell.showItemInFolder(p); result = true; break; }
      case 'shellOpenExternal': { const [url] = args; if (/^https?:/i.test(url)) shell.openExternal(url); result = true; break; }
      default: error = '未知操作: ' + op;
    }
  } catch (e) { error = String(e && e.message || e); }
  event.returnValue = error ? { __error: error } : result;
});

// ---------- 窗口 ----------
let mainWin = null;
let tray = null;

function createWindow() {
  mainWin = new BrowserWindow({
    width: WIN_W, height: WIN_H,
    minWidth: 720, minHeight: 480,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false,
    },
  });
  mainWin.loadFile(DIST);
  // 关闭 = 隐藏到托盘（真正退出走托盘菜单）；隐藏时通知渲染层暂停轮询（对应 uTools 的 onPluginOut）
  mainWin.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); hideWin(); } });
  mainWin.on('show', () => mainWin.webContents.send('plugin-enter'));
  mainWin.on('hide', () => mainWin.webContents.send('plugin-out'));
  mainWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function showWin() {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}
function hideWin() { mainWin.hide(); }
function toggleWin() { (mainWin && mainWin.isVisible()) ? hideWin() : showWin(); }

// ---------- 托盘 ----------
function createTray() {
  tray = new Tray(ICON);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口（' + HOTKEY + '）', click: showWin },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showWin);
}

// ---------- 生命周期 ----------
app.whenReady().then(() => {
  if (!fs.existsSync(DIST)) {
    dialog.showErrorBox(APP_NAME, '未找到 dist/index.html。\n请先运行 npm run build 生成前端产物，再启动桌面版。');
    app.quit();
    return;
  }
  loadDb();
  createWindow();
  createTray();
  if (!globalShortcut.register(HOTKEY, toggleWin)) console.warn('热键注册失败：', HOTKEY);
});

app.on('before-quit', () => { try { globalShortcut.unregisterAll(); } catch (e) {} });
app.on('window-all-closed', () => { /* 托盘常驻，不退出 */ });
