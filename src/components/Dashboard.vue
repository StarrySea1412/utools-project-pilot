<script setup>
import { computed, ref } from 'vue';
import { store, saveProjects, saveSettings, removeProject, checkGit, startScript, stopScript, refreshAllGit } from '../store.js';
import { ui, toast, openModal, confirmBox, timeAgo, shortPath, PROJECT_COLORS, projectIconStyle, applyTheme } from '../ui.js';
import ProjectCard from './ProjectCard.vue';
import SysBar from './SysBar.vue';
import Suggestions from './Suggestions.vue';
import TodoPanel from './TodoPanel.vue';
import NotifCenter from './NotifCenter.vue';
import AddProjectModal from '../modals/AddProjectModal.vue';
import EditProjectModal from '../modals/EditProjectModal.vue';
import SettingsModal from '../modals/SettingsModal.vue';

const emit = defineEmits(['open-detail']);

const tags = computed(() => {
  const map = new Map();
  store.projects.forEach((p) => (p.tags || []).forEach((t) => map.set(t, (map.get(t) || 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
});

const visibleProjects = computed(() => {
  let list = store.projects.slice();
  if (store.tagFilter !== '全部') list = list.filter((p) => (p.tags || []).includes(store.tagFilter));
  if (store.search.trim()) {
    const q = store.search.trim().toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)
      || (p.tags || []).some((t) => t.toLowerCase().includes(q)));
  }
  if (store.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (store.sort === 'dirty') list.sort((a, b) => (store.gitCache[b.id]?.status?.dirty || 0) - (store.gitCache[a.id]?.status?.dirty || 0));
  else list.sort((a, b) => (b.lastOpened || b.createdAt || 0) - (a.lastOpened || a.createdAt || 0));
  return list;
});

const totalDirty = computed(() => store.projects.reduce((n, p) => n + (store.gitCache[p.id]?.status?.dirty || 0), 0));
const unread = computed(() => store.notifications.filter((n) => !n.read).length);

function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  store.settings.theme = cur === 'dark' ? 'light' : 'dark';
  saveSettings();
  applyTheme();
}

async function refreshGit() {
  toast('正在刷新 Git 状态…', 'info');
  await refreshAllGit(true);
  toast('已刷新', 'ok');
}

function openProject(id) { emit('open-detail', id); }

function cardMenu(proj, ev) {
  // 简单实现：使用原生右键式菜单弹层
  const m = document.createElement('div');
  m.className = 'ctx-menu glass-strong';
  m.innerHTML = `
    <button data-m="edit">✏️ 编辑项目</button>
    <button data-m="folder">📁 打开文件夹</button>
    <button data-m="terminal">⌨ 在终端打开</button>
    <button data-m="explorer">🗂 定位到目录</button>
    <hr><button data-m="del" class="danger">🗑 移除项目</button>`;
  document.body.appendChild(m);
  const r = ev.target.getBoundingClientRect();
  m.style.top = (r.bottom + 6) + 'px';
  m.style.left = Math.min(r.left, window.innerWidth - 220) + 'px';
  const close = () => m.remove();
  setTimeout(() => document.addEventListener('click', close, { once: true }), 10);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    close();
    if (b.dataset.m === 'edit') openModal(EditProjectModal, { project: proj }, { title: '编辑项目' });
    if (b.dataset.m === 'folder') window.pilot.openPath(proj.path);
    if (b.dataset.m === 'terminal') window.pilot.openTerminal(proj.path);
    if (b.dataset.m === 'explorer') window.pilot.showItemInFolder(proj.path);
    if (b.dataset.m === 'del') confirmBox('移除项目', `确定从列表移除「${proj.name}」吗？<br><small>不会删除磁盘上的文件。</small>`,
      () => { removeProject(proj.id); toast('已移除', 'ok'); });
  });
}

function runFromCard(proj, script) {
  const h = store.procHandles[script.id];
  if (script.persistent && h?.running) stopScript(script);
  else startScript(proj, script);
}
</script>

<template>
  <header class="topbar glass-strong">
    <div class="brand">
      <div class="logo-mini">✈</div>
      <div class="brand-txt">
        <div class="brand-line"><h1>项目领航员</h1><span class="chip-pm">PM</span></div>
        <span class="brand-en">PROJECT PILOT · NAV CONSOLE</span>
      </div>
    </div>
    <div class="top-actions">
      <button class="icon-btn" title="通知中心" @click="store.notifOpen = true">
        🔔<span v-if="unread" class="notif-badge">{{ unread > 9 ? '9+' : unread }}</span>
      </button>
      <button class="icon-btn" title="切换主题" @click="toggleTheme">◐</button>
      <button class="icon-btn" title="设置" @click="openModal(SettingsModal, {}, { title: '设置', wide: true })">⚙</button>
      <button class="btn btn-primary" @click="openModal(AddProjectModal, {}, { title: '添加项目' })">＋ 添加项目</button>
    </div>
  </header>

  <SysBar />
  <Suggestions @open-detail="emit('open-detail', $event)" />
  <TodoPanel @open-detail="emit('open-detail', $event)" />

  <div class="toolbar">
    <div class="tag-chips">
      <button class="chip" :class="{ 'chip-active': store.tagFilter === '全部' }" @click="store.tagFilter = '全部'">
        全部 <b>{{ store.projects.length }}</b>
      </button>
      <button v-for="[t, n] in tags" :key="t" class="chip" :class="{ 'chip-active': store.tagFilter === t }"
              @click="store.tagFilter = store.tagFilter === t ? '全部' : t">
        {{ t }} <b>{{ n }}</b>
      </button>
    </div>
    <div class="toolbar-right">
      <div class="search-box"><span>⌕</span>
        <input v-model="store.search" placeholder="搜索项目 / 路径 / 标签…">
      </div>
      <select v-model="store.sort" class="select">
        <option value="recent">最近使用</option>
        <option value="name">名称</option>
        <option value="dirty">未提交数</option>
      </select>
      <button class="icon-btn" title="刷新全部 Git 状态" @click="refreshGit">⟳</button>
    </div>
  </div>

  <main class="grid">
    <template v-if="store.projects.length">
      <ProjectCard v-for="p in visibleProjects" :key="p.id" :project="p"
                   @open="openProject" @menu="cardMenu" @run="runFromCard" />
      <div v-if="!visibleProjects.length" class="empty-box" style="grid-column: 1/-1">
        <div class="e-icon">🔍</div><div class="e-title">没有匹配的项目</div>
        <div class="e-sub">换个关键词或标签试试</div>
      </div>
    </template>
    <div v-else class="empty-box" style="grid-column: 1/-1">
      <div class="e-icon">🚀</div>
      <div class="e-title">还没有项目</div>
      <div class="e-sub">添加你的第一个本地项目，一键启动脚本、查看 Git 状态。<br>也支持把文件夹直接拖入本插件窗口。</div>
      <button class="btn btn-primary" @click="openModal(AddProjectModal, {}, { title: '添加项目' })">＋ 添加项目</button>
    </div>
  </main>
</template>
