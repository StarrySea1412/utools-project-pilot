<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { store, load, startScheduler, startAutoRefresh, refreshAllGit, addProject, checkGit, startSysMonitor, patrolOnce } from './store.js';
import { applyTheme, toast } from './ui.js';
import Dashboard from './components/Dashboard.vue';
import Detail from './components/Detail.vue';
import ToastHost from './components/ToastHost.vue';
import ModalHost from './components/ModalHost.vue';
import NotifCenter from './components/NotifCenter.vue';
import ConsoleDrawer from './components/ConsoleDrawer.vue';
import CommandPalette from './components/CommandPalette.vue';
import Icon from './components/Icon.vue';

const cmdkOpen = ref(false);

function init() {
  if (new URLSearchParams(location.search).has('flat')) {
    document.documentElement.classList.add('flat');
  }
  load();
  applyTheme();
  patrolOnce();      // 静默巡检：刷新 Git 态势 + 落后/失败主动进通知中心（内部自带去重节流）
  startAutoRefresh();
  startScheduler();
  startSysMonitor();
  if (window.utools) {
    window.utools.onPluginEnter(({ type, payload }) => {
      if (type === 'files' && payload?.length) {
        let n = 0;
        payload.forEach((p) => { if (addProject(p.path)) n++; });
        if (n) { toast(`已添加 ${n} 个项目`, 'ok'); refreshAllGit(true); }
      }
    });
  }
}

function onDrop(e) {
  e.preventDefault();
  store.dropActive = false;
  let paths = [];
  if (e.dataTransfer.files?.length) paths = [...e.dataTransfer.files].map((f) => f.path);
  else if (window.utools?.getDragFilePaths) paths = window.utools.getDragFilePaths();
  const dirs = paths.filter((p) => { try { return require('fs').statSync(p).isDirectory(); } catch (err) { return false; } });
  let n = 0;
  dirs.forEach((d) => { if (addProject(d)) n++; });
  if (n) { toast(`已添加 ${n} 个项目`, 'ok'); refreshAllGit(true); }
  else if (paths.length) toast('只支持文件夹', 'warn');
}

function onKey(e) {
  // Ctrl+K / Cmd+K 打开命令面板（输入框里也生效）
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    if (cmdkOpen.value) cmdkOpen.value = false;
    else { closeModalAll(); cmdkOpen.value = true; }
    return;
  }
  // 仪表盘列表 j/k 键盘导航（不在输入控件时）
  if (store.view === 'dashboard' && !cmdkOpen.value && (e.key === 'j' || e.key === 'k')) {
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    moveListSel(e.key === 'j' ? 1 : -1);
    return;
  }
  if (e.key !== 'Escape') return;
  if (cmdkOpen.value) { cmdkOpen.value = false; return; }
  if (uiBusy()) return;
  if (store.consoleOpen) { store.consoleOpen = null; return; }
  if (store.view === 'detail') backToDashboard();
}

// j/k 导航：聚焦/移动仪表盘的项目卡片
function moveListSel(step) {
  const items = [...document.querySelectorAll('.proj-card, .proj-row')];
  if (!items.length) return;
  const cur = items.findIndex((el) => el === document.activeElement);
  const next = cur < 0 ? 0 : Math.min(Math.max(cur + step, 0), items.length - 1);
  items[next].focus();
  items[next].scrollIntoView({ block: 'nearest' });
}
function uiBusy() { return !!document.querySelector('.modal-mask'); }
function closeModalAll() {
  if (uiBusy()) document.querySelector('.modal-mask')?.dispatchEvent(new MouseEvent('click', { bubbles: false }));
  import('./ui.js').then((m) => { m.ui.modal = null; m.ui.confirm = null; });
}

function backToDashboard() {
  store.view = 'dashboard';
  store.activeProjectId = null;
  refreshAllGit();
}

onMounted(() => {
  init();
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));

// 打开详情（供卡片点击）：
function openDetail(id) {
  if (new URLSearchParams(location.search).has('debug')) document.title = 'openDetail:' + id;
  const proj = store.projects.find((p) => p.id === id);
  if (!proj) return;
  proj.lastOpened = Date.now();
  import('./store.js').then((m) => m.saveProjects());
  store.activeProjectId = id;
  store.view = 'detail';
  store.fileCwd = null;
  store.gitSubTab = 'changes';
  checkGit(proj, true);
}
</script>

<template>
  <div class="app-root"
       @dragover.prevent="store.dropActive = true"
       @drop="onDrop">
    <div v-if="store.dropActive" class="drop-mask" @dragleave="store.dropActive = false">
      <div class="drop-box glass-strong"><Icon name="FolderInput" :size="22" /> 松手添加项目文件夹</div>
    </div>
    <Dashboard v-if="store.view === 'dashboard'" @open-detail="openDetail" @back-dashboard="backToDashboard" />
    <Detail v-else-if="store.view === 'detail'" />
    <ToastHost />
    <ModalHost />
    <ConsoleDrawer />
    <NotifCenter @open-detail="openDetail" />
    <CommandPalette v-if="cmdkOpen" @open-detail="openDetail" @close="cmdkOpen = false" />
  </div>
</template>
