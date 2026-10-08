// preload/git.cjs — Git 域：status/diff/log/branch/tag/stash/blame/hunk 暂存/提交同步全在这
// 解析规则的坑（porcelain v2 两哈希、\u0001 分隔符、format 间插 \n）见仓库记忆与 tests/git-status.test.mjs。
const { execFile } = require('child_process');
const fsp = require('fs').promises;
const path = require('path');
const { cut, runCmd } = require('./env.cjs');

async function git(cwd, args) {
  const r = await runCmd('git', args, { cwd, timeout: 60000 });
  if (r.code !== 0) throw new Error((r.stderr || `git ${args[0]} 退出码 ${r.code}`).trim());
  return r.stdout;
}

async function gitStatus(cwd) {
  const out = await git(cwd, ['status', '--porcelain=v2', '--branch']);
  const lines = out.split('\n');
  const st = { branch: '', upstream: '', ahead: 0, behind: 0, detached: false, entries: [], stagedCount: 0, unstagedCount: 0, untrackedCount: 0 };
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('# branch.head ')) { st.branch = line.slice(14); if (st.branch === '(detached)') st.detached = true; }
    else if (line.startsWith('# branch.upstream ')) st.upstream = line.slice(18);
    else if (line.startsWith('# branch.ab ')) {
      const m = line.slice(12).match(/\+(\d+)\s+-(\d+)/);
      if (m) { st.ahead = +m[1]; st.behind = +m[2]; }
    } else if (line.startsWith('1 ')) {
      // 1 <XY> <sub> <mH> <mI> <mU> <oidH> <oidI> <path…>
      const sp = line.split(' ');
      addEntry(st, sp[1], sp.slice(8).join(' '));
    } else if (line.startsWith('2 ')) {
      // 2 <XY> <sub> <mH> <mI> <mU> <mH'> <mI'> <X><score> <newPath>\t<origPath>
      // newPath / origPath 都可能含空格：newPath 取第 9 列之后的整段，origPath 取制表符之后的整段
      const parts = line.split('\t');
      const head = parts[0].split(' ');
      const e = { x: head[1][0], y: head[1][1], path: head.slice(9).join(' ') };
      if (parts[1]) { e.orig = parts[1]; e.renamed = true; }
      if (e.x !== '.' && e.x !== '?') st.stagedCount++;
      if (e.y !== '.' && e.y !== '?') st.unstagedCount++;
      st.entries.push(e);
    } else if (line.startsWith('u ')) {
      // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path…>
      const sp = line.split(' ');
      st.entries.push({ x: 'U', y: 'U', path: sp.slice(10).join(' '), unmerged: true });
      st.unstagedCount++;
    } else if (line.startsWith('? ')) {
      st.entries.push({ x: '?', y: '?', path: line.slice(2), untracked: true });
      st.untrackedCount++;
    }
  }
  function addEntry(st, xy, file, orig, extra) {
    const x = xy[0], y = xy[1];
    if (x !== '.' && x !== '?') st.stagedCount++;
    if (y !== '.' && y !== '?') st.unstagedCount++;
    const e = { x, y, path: file };
    if (orig) { e.orig = orig.split(' ').slice(8).join(' '); e.renamed = true; }
    st.entries.push(e);
  }
  st.dirty = st.stagedCount + st.unstagedCount + st.untrackedCount;
  return st;
}

async function gitDiffFile(cwd, file, staged) {
  let out;
  if (file.untracked) {
    try {
      const c = await fsp.readFile(path.join(cwd, file.path), 'utf8');
      out = `+++ 新文件: ${file.path}\n` + c.split('\n').map(l => '+' + l).join('\n');
    } catch (e) { out = '（无法读取文件）'; }
  } else {
    const args = ['diff', '--no-color', '-U3'];
    if (staged) args.push('--cached');
    args.push('--', file.path);
    out = await git(cwd, args);
  }
  return cut(out || '（无差异）');
}

async function gitLog(cwd, n = 60) {
  // 分隔符用控制字符：Node execFile 禁止参数含 \u0000，故用 \u0001/\u001f
  const sep = '\u001f', fld = '\u0001';
  const out = await git(cwd, ['log', `--pretty=format:%H${fld}%h${fld}%an${fld}%aI${fld}%s${fld}%b${fld}%P${sep}`, '-n', String(n)]);
  return out.split(sep).filter(r => r.trim()).map(r => {
    const [hash, short, author, date, subject, body, parents] = r.split(fld);
    // --pretty=format 会在记录间插 \n，hash/parents 必须 trim 才能参与拓扑比对
    return { hash: (hash || '').trim(), short, author, date, subject: subject || '', body: (body || '').trim(), parents: (parents || '').trim() };
  });
}

async function gitBranches(cwd) {
  const out = await git(cwd, ['branch', '--format=%(HEAD)%00%(refname:short)%00%(upstream:short)']);
  return out.split('\n').filter(Boolean).map(l => {
    const [head, name, upstream] = l.split('\u0000');
    return { current: head.trim() === '*', name, upstream: upstream || '' };
  });
}

// tag 列表（新→旧）：轻量与附注 tag 都要，附锚点 hash 供区间切片
async function gitTags(cwd) {
  const out = await git(cwd, ['tag', '--sort=-creatordate', '--format=%(refname:short)%00%(objectname)']);
  return out.split('\n').filter(Boolean).map(l => {
    const [name, hash] = l.split('\u0000');
    return { name, hash: (hash || '').trim() };
  });
}

// 单文件提交历史：该文件出现过的提交（新→旧，带变更统计）
async function gitFileLog(cwd, file, n = 40) {
  const sep = '\u001f', fld = '\u0001';
  const out = await git(cwd, ['log', `--pretty=format:%H${fld}%h${fld}%an${fld}%aI${fld}%s${sep}`, '--follow', '-n', String(n), '--', file]);
  return out.split(sep).filter(r => r.trim()).map(r => {
    const [hash, short, author, date, subject] = r.split(fld);
    return { hash: (hash || '').trim(), short, author, date, subject: subject || '' };
  });
}

// 行级溯源：porcelain 输出交给 src/git-deep.js 的 parseBlame 解析
async function gitBlameRaw(cwd, file) {
  return git(cwd, ['blame', '--porcelain', '--', file]);
}

// hunk 级暂存：补丁文本经 stdin 喂给 git apply --cached
async function gitApplyStaged(cwd, patch) {
  return new Promise((resolve, reject) => {
    const p = execFile('git', ['apply', '--cached', '--whitespace=nowarn', '-'], {
      cwd, timeout: 30000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }, (err, _so, stderr) => {
      if (err) reject(new Error((stderr || err.message || '').trim()));
      else resolve(true);
    });
    p.stdin.end(patch);
  });
}

async function gitCommit(cwd, message) {
  await git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', '--short', 'HEAD']);
}

async function gitHasRemote(cwd) {
  const r = await runCmd('git', ['remote'], { cwd });
  return r.stdout.trim().length > 0;
}

// ---------- 分支管理 / stash ----------
async function gitCreateBranch(cwd, name, from) {
  await git(cwd, ['checkout', '-b', name, ...(from ? [from] : [])]);
  return true;
}
async function gitDeleteBranch(cwd, name, force = false) {
  await git(cwd, ['branch', force ? '-D' : '-d', name]);
  return true;
}
async function gitStashList(cwd) {
  const out = await git(cwd, ['stash', 'list', '--pretty=format:%H%n%gd%n%gs']);
  const rows = out.split('\n').filter(Boolean);
  const list = [];
  for (let i = 0; i + 2 < rows.length + 1; i += 3) {
    if (!rows[i] || !rows[i + 1] || !rows[i + 2]) break;
    list.push({ hash: rows[i], label: rows[i + 1], subject: rows[i + 2] });
  }
  return list;
}

// window.pilot.git 的完整命名空间（挂载入口直接引用，方法面由 mock-contract 守门）
const gitApi = {
  status: gitStatus,
  diffFile: gitDiffFile,
  log: gitLog,
  branches: gitBranches,
  tags: gitTags,
  fileLog: gitFileLog,
  blameRaw: gitBlameRaw,
  applyStaged: gitApplyStaged,
  // 提交行引用标签（分支/tag，git graph 风）：hash -> [label…]
  async commitBranches(cwd, limit = 200) {
    const sep = '\u0001', fld = '\u0002';
    const out = await git(cwd, ['log', `--pretty=format:%H${fld}%D${sep}`, '-n', String(limit)]);
    const map = {};
    for (const row of out.split(sep).filter((r) => r.trim())) {
      const [hash, refs] = row.split(fld);
      const labels = String(refs || '').split(',').map((s) => s.trim()).filter(Boolean)
        .map((r) => r.replace(/^HEAD -> /, '').replace(/^tag: /, ''))
        .map((r) => (r.startsWith('origin/') ? 'Ω ' + r.slice(7) : r));
      if (labels.length) map[(hash || '').trim()] = [...new Set(labels)];
    }
    return map;
  },
  checkout: async (cwd, ref) => { await git(cwd, ['checkout', ref]); return true; },
  createBranch: gitCreateBranch,
  deleteBranch: gitDeleteBranch,
  stashPush: async (cwd, msg) => { await git(cwd, ['stash', 'push', ...(msg ? ['-m', msg] : [])]); return true; },
  stashPop: async (cwd, label) => { await git(cwd, ['stash', 'pop', label || 'stash@{0}']); return true; },
  stashDrop: async (cwd, label) => { await git(cwd, ['stash', 'drop', label || 'stash@{0}']); return true; },
  stashList: gitStashList,
  stage: (cwd, files) => git(cwd, ['add', '--', ...files]),
  unstage: (cwd, files) => git(cwd, ['reset', 'HEAD', '--', ...files]),
  discard: (cwd, files) => git(cwd, ['checkout', '--', ...files]),
  discardUntracked: async (cwd, files) => {
    for (const f of files) { try { await fsp.rm(path.join(cwd, f), { recursive: true }); } catch (e) {} }
  },
  commit: gitCommit,
  push: (cwd) => git(cwd, ['push']),
  pull: (cwd) => git(cwd, ['pull', '--no-rebase']),
  fetch: (cwd) => git(cwd, ['fetch', '--all', '--prune']),
  hasRemote: gitHasRemote,
  commitFileNames: async (cwd, hash) => {
    const out = await git(cwd, ['show', '--name-status', '--format=', hash]);
    return out.split('\n').filter(Boolean).map((l) => {
      const parts = l.split('\t');
      return { ins: parts[0], path: parts[parts.length - 1] };
    });
  },
};

module.exports = { git, gitApi };
