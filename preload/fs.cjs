// preload/fs.cjs — 文件域：目录浏览 / 文本预览 / 基础文件操作
const fsp = require('fs').promises;
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.venv', 'venv', '__pycache__', 'target', '.cache', 'coverage']);

async function listDir(dir) {
  const names = await fsp.readdir(dir, { withFileTypes: true });
  const items = [];
  for (const d of names) {
    if (IGNORE_DIRS.has(d.name) && d.isDirectory()) continue;
    const full = path.join(dir, d.name);
    let size = null, mtime = null;
    try { const s = await fsp.stat(full); size = s.size; mtime = s.mtimeMs; } catch (e) {}
    items.push({ name: d.name, dir: d.isDirectory(), size, mtime, link: d.isSymbolicLink() });
  }
  items.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'zh'));
  return items;
}

const TEXT_EXT = new Set(['.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.less', '.html', '.htm', '.vue', '.py', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.sh', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.env', '.xml', '.sql', '.log', '.gitignore', '.editorconfig', '.lock', '.mjs', '.cjs', '.bat', '.ps1', '.dart', '.kt', '.swift', '.rb', '.php']);

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  return TEXT_EXT.has(ext) || !ext && true;
}

async function readText(file) {
  const buf = await fsp.readFile(file);
  if (buf.length > 1024 * 512) throw new Error('文件过大（>512KB），请在系统中打开');
  if (buf.includes(0)) throw new Error('二进制文件，不支持预览');
  return buf.toString('utf8');
}

// window.pilot.fs 的完整命名空间
const fsApi = {
  listDir,
  isTextFile,
  readText,
  writeText: (file, content) => fsp.writeFile(file, content, 'utf8'),
  mkdir: (dir) => fsp.mkdir(dir, { recursive: true }),
  rm: (p) => fsp.rm(p, { recursive: true }),
  rename: (a, b) => fsp.rename(a, b),
  exists: (p) => fsp.stat(p).then(() => true, () => false),
};

module.exports = { fsApi };
