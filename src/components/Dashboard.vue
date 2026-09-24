<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { store, saveSettings, removeProject, startScript, stopScript, refreshAllGit } from '../store.js';
import { toast, openModal, confirmBox, applyTheme } from '../ui.js';
import Icon from './Icon.vue';
import ProjectCard from './ProjectCard.vue';
import ProjectRow from './ProjectRow.vue';
import SysBar from './SysBar.vue';
import WorkPanel from './WorkPanel.vue';
import AllChanges from './AllChanges.vue';
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
  else if (store.sort === 'updated') list.sort((a, b) => (store.gitCache[b.id]?.lastCommitAt || 0) - (store.gitCache[a.id]?.lastCommitAt || 0));
  else if (store.sort === 'tag') list.sort((a, b) => ((a.tags || [])[0] || '￿').localeCompare((b.tags || [])[0] || '￿') || a.name.localeCompare(b.name));
  else list.sort((a, b) => (b.lastOpened || b.createdAt || 0) - (a.lastOpened || a.createdAt || 0));
  return list;
});

const unread = computed(() => store.notifications.filter((n) => !n.read).length);
const sortProxy = computed({
  get: () => store.sort,
  set: (v) => { store.sort = v; store.settings.sort = v; saveSettings(); },
});
const cardView = computed(() => store.settings.cardView || 'card');
const VIEWS = [['card', 'LayoutGrid', '卡片视图'], ['compact', 'Grid3x3', '紧凑视图'], ['list', 'List', '列表视图']];
function setView(v) {
  store.settings.cardView = v;
  saveSettings();
}

// 按 / 快速聚焦搜索（输入控件聚焦时不抢按键）
const searchEl = ref(null);
function onSlash(e) {
  if (e.key !== '/' || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
  e.preventDefault();
  searchEl.value?.focus();
}
onMounted(() => document.addEventListener('keydown', onSlash));
onBeforeUnmount(() => document.removeEventListener('keydown', onSlash));

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

function openAllChanges() {
  openModal(AllChanges, {}, { title: '全部项目的未提交变更', wide: true });
}

function openProject(id) { emit('open-detail', id); }

function cardMenu(proj, ev) {
  // 简单实现：使用原生右键式菜单弹层
  const m = document.createElement('div');
  m.className = 'ctx-menu glass-strong';
  m.innerHTML = `
    <button data-m="edit">编辑项目</button>
    <button data-m="folder">打开文件夹</button>
    <button data-m="terminal">在终端打开</button>
    <button data-m="explorer">定位到目录</button>
    <hr><button data-m="del" class="danger">移除项目</button>`;
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
      <div class="logo-mini"><Icon name="Plane" :size="16" /></div>
      <div class="brand-txt">
        <div class="brand-line"><h1>项目领航员</h1></div>
      </div>
    </div>
    <div class="top-actions">
      <button class="icon-btn" title="通知中心" @click="store.notifOpen = true">
        <Icon name="Bell" :size="15" /><span v-if="unread" class="notif-badge">{{ unread > 9 ? '9+' : unread }}</span>
      </button>
      <button class="icon-btn" title="切换主题" @click="toggleTheme"><Icon name="SunMoon" :size="15" /></button>
      <button class="icon-btn" title="设置" @click="openModal(SettingsModal, {}, { title: '设置', wide: true })"><Icon name="Settings" :size="15" /></button>
      <button class="btn btn-primary" @click="openModal(AddProjectModal, {}, { title: '添加项目' })"><Icon name="Plus" :size="14" /> 添加项目</button>
    </div>
  </header>

  <SysBar />
  <WorkPanel @open-detail="emit('open-detail', $event)" />

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
      <div class="subtabs tiny view-switch">
        <button v-for="[v, ico, label] in VIEWS" :key="v" class="subtab"
                :class="{ 'subtab-active': cardView === v }" :title="label" @click="setView(v)"><Icon :name="ico" :size="13" /></button>
      </div>
      <div class="search-box"><span class="search-ico"><Icon name="Search" :size="13" /></span>
        <input ref="searchEl" v-model="store.search" placeholder="搜索项目 / 路径 / 标签…（按 / 聚焦）"
               @keydown.esc="searchEl?.blur()">
      </div>
      <select v-model="sortProxy" class="select">
        <option value="recent">最近使用</option>
        <option value="updated">最近更新</option>
        <option value="dirty">变更最多</option>
        <option value="tag">按标签</option>
        <option value="name">名称</option>
      </select>
      <button class="icon-btn" title="全部项目的未提交变更" @click="openAllChanges"><Icon name="GitBranch" :size="14" /></button>
      <button class="icon-btn" title="刷新全部 Git 状态" @click="refreshGit"><Icon name="RefreshCw" :size="14" /></button>
    </div>
  </div>

  <main v-if="cardView !== 'list'" class="grid" :class="{ compact: cardView === 'compact' }">
    <template v-if="store.projects.length">
      <ProjectCard v-for="p in visibleProjects" :key="p.id" :project="p"
                   @open="openProject" @menu="cardMenu" @run="runFromCard" />
      <div v-if="!visibleProjects.length" class="empty-box" style="grid-column: 1/-1">
        <div class="e-icon"><Icon name="SearchX" :size="30" /></div><div class="e-title">没有匹配的项目</div>
        <div class="e-sub">换个关键词或标签试试</div>
      </div>
    </template>
    <div v-else class="empty-box" style="grid-column: 1/-1">
      <div class="e-icon"><Icon name="Rocket" :size="30" /></div>
      <div class="e-title">还没有项目</div>
      <div class="e-sub">添加你的第一个本地项目，一键启动脚本、查看 Git 状态。<br>也支持把文件夹直接拖入本插件窗口。</div>
      <button class="btn btn-primary" @click="openModal(AddProjectModal, {}, { title: '添加项目' })">＋ 添加项目</button>
    </div>
  </main>

  <main v-else class="proj-list glass">
    <template v-if="visibleProjects.length">
      <ProjectRow v-for="p in visibleProjects" :key="p.id" :project="p"
                  @open="openProject" @menu="cardMenu" @run="runFromCard" />
    </template>
    <div v-else class="empty-box">
      <div class="e-icon"><Icon :name="store.projects.length ? 'SearchX' : 'Rocket'" :size="30" /></div>
      <div class="e-title">{{ store.projects.length ? '没有匹配的项目' : '还没有项目' }}</div>
      <div class="e-sub">{{ store.projects.length ? '换个关键词或标签试试' : '添加你的第一个本地项目，一键启动脚本、查看 Git 状态。' }}</div>
      <button v-if="!store.projects.length" class="btn btn-primary" @click="openModal(AddProjectModal, {}, { title: '添加项目' })">＋ 添加项目</button>
    </div>
  </main>
</template>
