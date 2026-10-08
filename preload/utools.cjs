// preload/utools.cjs — uTools API 封装域：db 兼容 / 对话框 / shell 打开 / 通知 / 终端 / PATH 探测
// desktop/preload.cjs 的 utools shim 与真实 uTools API 都从这里的回退分支走，勿收紧判断条件。
const { execFile, execFileSync, spawn } = require('child_process');
const fsp = require('fs').promises;
const { isWin, shellArgs } = require('./env.cjs');

// db — 兼容 uTools 真实 API（utools.db.get/put/remove）
function dbGet(key) {
  const u = window.utools;
  if (!u) return null;
  if (typeof u.db?.get === 'function') { const d = u.db.get(key); return d ? d.value : null; }
  if (typeof u.dbGet === 'function') { const d = u.dbGet(key); return d ? d.value : null; }
  return null;
}

function dbPut(key, value) {
  const u = window.utools;
  if (!u) return;
  const doc = { _id: key, value };
  const raw = (typeof u.db?.get === 'function' ? u.db.get(key) : (typeof u.dbGet === 'function' ? u.dbGet(key) : null));
  if (raw && raw._rev) doc._rev = raw._rev;
  const res = typeof u.db?.put === 'function' ? u.db.put(doc) : (typeof u.dbPut === 'function' ? u.dbPut(doc) : null);
  if (res && res.error) throw new Error('保存失败: ' + res.message);
}

// dialogs / shell
function selectFolder() {
  if (typeof window.utools?.showOpenDialog !== 'function') return [];
  const r = window.utools.showOpenDialog({
    title: '选择项目文件夹',
    buttonLabel: '添加',
    properties: ['openDirectory', 'multiSelections'],
  });
  return r || [];
}

// 数据导出：选保存位置并写 JSON（返回文件路径，取消返回 null）
function exportJson(defaultName, text) {
  if (typeof window.utools?.showSaveDialog !== 'function') return null;
  const file = window.utools.showSaveDialog({
    title: '导出数据',
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!file) return null;
  fsp.writeFile(file, text, 'utf8');
  return file;
}

// 数据导入：选文件并读文本（取消返回 null）
function importJson() {
  if (typeof window.utools?.showOpenDialog !== 'function') return null;
  const r = window.utools.showOpenDialog({
    title: '导入数据',
    buttonLabel: '导入',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  const file = r && r[0];
  if (!file) return null;
  return fsp.readFile(file, 'utf8');
}

function openPath(p) {
  const err = window.utools && window.utools.shellOpenPath(p);
  return err || null;
}

function showItemInFolder(p) { if (window.utools) window.utools.shellShowItemInFolder(p); }
function openInBrowser(url) { if (window.utools) window.utools.shellOpenExternal(url); }
function copyText(t) { if (window.utools) window.utools.copyText(t); }
function notify(body) { if (window.utools && window.utools.showNotification) window.utools.showNotification(body); }
function isDark() { return window.utools ? !!window.utools.isDarkColors() : false; }

function openTerminal(cwd) {
  if (isWin) {
    // 优先 Windows Terminal，回退 cmd
    const p = spawn('cmd.exe', ['/d', '/c', 'wt.exe', '-d', cwd], { windowsHide: true, detached: true, stdio: 'ignore' });
    p.on('error', () => {
      const c = spawn('cmd.exe', ['/k'], { cwd, windowsHide: false, detached: true, stdio: 'ignore', shell: true });
      c.unref();
    });
    p.unref();
  } else {
    const p = spawn('x-terminal-emulator', [], { cwd, detached: true, stdio: 'ignore' });
    p.on('error', () => { const q = spawn('xterm', [], { cwd, detached: true, stdio: 'ignore' }); q.unref(); });
    p.unref();
  }
}

// 用编辑器打开：cmd 为完整命令行（模板已替换 {path}），经 shell 解析
function openWithEditor(cmd) {
  const { file, args } = shellArgs(cmd);
  const p = spawn(file, args, { windowsHide: true, detached: true, stdio: 'ignore' });
  p.on('error', () => {});
  p.unref();
  return true;
}

// PATH 探测：Windows 下 x.cmd 需要连 .cmd 扩展一起试（where 会命中 code.cmd）
function hasInPath(cmd, isWinTarget) {
  const exe = isWinTarget ? [cmd, `${cmd}.cmd`, `${cmd}.exe`] : [cmd];
  for (const name of exe) {
    try {
      const r = execFileSync(isWinTarget ? 'where.exe' : 'which', [name], { timeout: 3000, windowsHide: true, stdio: 'pipe' });
      if (String(r || '').trim()) return true;
    } catch (e) {}
  }
  return false;
}

module.exports = { dbGet, dbPut, selectFolder, exportJson, importJson, openPath, showItemInFolder, openInBrowser, copyText, notify, isDark, openTerminal, openWithEditor, hasInPath };
