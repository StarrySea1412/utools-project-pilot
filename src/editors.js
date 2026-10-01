// editors.js — 「用编辑器打开」目标探测与启动（纯逻辑可测）
// 探测顺序 = 用户自定义 → PATH 命令 → 安装路径。全部候选由 UI 呈现，用户点了才算数。

// 已知编辑器：PATH 命令名 + Windows 常见安装路径（存在才列为候选）
export const EDITOR_DEFS = [
  { id: 'code', name: 'VS Code', cmds: ['code'], winPaths: ['%LOCALAPPDATA%/Programs/Microsoft VS Code/Code.exe', 'C:/Program Files/Microsoft VS Code/Code.exe'] },
  { id: 'cursor', name: 'Cursor', cmds: ['cursor', 'cursor.cmd'], winPaths: ['%LOCALAPPDATA%/Programs/cursor/Cursor.exe'] },
  { id: 'windsurf', name: 'Windsurf', cmds: ['windsurf'], winPaths: ['%LOCALAPPDATA%/Programs/windsurf/Windsurf.exe'] },
  { id: 'sublime', name: 'Sublime Text', cmds: ['subl'], winPaths: ['C:/Program Files/Sublime Text/sublime_text.exe'] },
  { id: 'webstorm', name: 'WebStorm', cmds: ['webstorm'], winPaths: ['%LOCALAPPDATA%/Programs/WebStorm/bin/webstorm64.exe'] },
  { id: 'idea', name: 'IntelliJ IDEA', cmds: ['idea'], winPaths: [] },
  { id: 'zed', name: 'Zed', cmds: ['zed'], winPaths: ['%LOCALAPPDATA%/Programs/Zed/Zed.exe'] },
];

// PATH 里找得到可执行（PATH 检测由注入的 hasCmd 完成，便于测试）
export function detectEditors({ hasCmd, fileExists, expandEnv, isWin }) {
  const found = [];
  for (const def of EDITOR_DEFS) {
    const cmd = def.cmds.find((c) => hasCmd(c, isWin));
    if (cmd) { found.push({ id: def.id, name: def.name, how: 'path', cmd }); continue; }
    if (isWin && def.winPaths.some((p) => fileExists(expandEnv(p)))) {
      found.push({ id: def.id, name: def.name, how: 'file', cmd: def.winPaths[0] });
    }
  }
  return found;
}

// 打开项目的最终命令：自定义模板支持 {path} 占位，缺省追加在末尾
export function buildOpenCommand(template, projectPath) {
  const t = String(template || '').trim();
  if (!t) return null;
  return t.includes('{path}') ? t.replace(/\{path\}/g, projectPath) : `${t} "${projectPath}"`;
}
