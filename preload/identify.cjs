// preload/identify.cjs — 项目身份识别：logo 图标（dataURL）+ 技术栈判定
const fs = require('fs');
const path = require('path');

async function identify(base) {
  let icon = null, framework = '';
  for (const rel of ['logo.png', 'logo.svg', 'logo.jpg', 'logo.jpeg', 'icon.png', 'icon.svg', 'favicon.ico', 'favicon.png', 'public/favicon.ico', 'public/favicon.png', 'public/logo.png', 'public/logo.svg', 'public/icon.png', 'src/assets/logo.png', 'src/assets/logo.svg', 'assets/logo.png', 'assets/logo.svg', 'assets/icon.png', 'static/logo.png', 'docs/logo.png', 'static/favicon.ico', 'src-tauri/icons/icon.png', 'src-tauri/icons/32x32.png', 'resources/icon.png']) {
    const full = path.join(base, rel);
    try {
      const st = fs.statSync(full);
      if (!st.isFile() || st.size < 64 || st.size > 512 * 1024) continue;
      const buf = fs.readFileSync(full);
      if (!buf.includes(0) && !/\.svg$/.test(rel)) continue;
      const ext = path.extname(full).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.ico' ? 'image/x-icon' : ext === '.png' ? 'image/png' : 'image/jpeg';
      icon = `data:${mime};base64,${buf.toString('base64')}`;
      break;
    } catch (e) {}
  }
  const read = (f) => { try { return fs.readFileSync(path.join(base, f), 'utf8'); } catch (e) { return null; } };
  const deps = {};
  try { const pkg = JSON.parse(read('package.json') || '{}'); Object.assign(deps, pkg.dependencies || {}, pkg.devDependencies || {}); } catch (e) {}
  const has = (k) => Object.keys(deps).some((d) => d === k || d.startsWith('@' + k + '/'));
  if (has('next')) framework = 'Next';
  else if (has('nuxt')) framework = 'Nuxt';
  else if (has('vite')) framework = 'Vite';
  else if (has('vue')) framework = 'Vue';
  else if (has('react')) framework = 'React';
  else if (has('svelte')) framework = 'Svelte';
  else if (has('electron')) framework = 'Electron';
  else if (has('express')) framework = 'Express';
  if (!framework) {
    const py = read('pyproject.toml') || read('requirements.txt') || '';
    const exists = (f) => { try { fs.statSync(path.join(base, f)); return true; } catch (e) { return false; } };
    if (/django/i.test(py)) framework = 'Django';
    else if (/fastapi/i.test(py)) framework = 'FastAPI';
    else if (/flask/i.test(py)) framework = 'Flask';
    else if (exists('go.mod')) framework = 'Go';
    else if (exists('Cargo.toml')) framework = 'Rust';
    else if (exists('pom.xml') || exists('build.gradle')) framework = 'Java';
  }
  return { icon, framework };
}

module.exports = { identify };
