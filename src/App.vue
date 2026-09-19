<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { store, load, startScheduler, startAutoRefresh, refreshAllGit, addProject, checkGit, startSysMonitor } from './store.js';
import { applyTheme, toast } from './ui.js';
import Dashboard from './components/Dashboard.vue';
import Detail from './components/Detail.vue';
import ToastHost from './components/ToastHost.vue';
import ModalHost from './components/ModalHost.vue';
import ConsoleDrawer from './components/ConsoleDrawer.vue';

function init() {
  if (new URLSearchParams(location.search).has('flat')) {
    document.documentElement.classList.add('flat');
  }
  load();
  applyTheme();
  refreshAllGit();
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
  if (e.key !== 'Escape') return;
  if (uiBusy()) return;
  if (store.consoleOpen) { store.consoleOpen = null; return; }
  if (store.view === 'detail') backToDashboard();
}
function uiBusy() { return !!document.querySelector('.modal-mask'); }

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
      <div class="drop-box glass-strong">📥 松手添加项目文件夹</div>
    </div>
    <Dashboard v-if="store.view === 'dashboard'" @open-detail="openDetail" @back-dashboard="backToDashboard" />
    <Detail v-else-if="store.view === 'detail'" />
    <ToastHost />
    <ModalHost />
    <ConsoleDrawer />
  </div>
</template>
