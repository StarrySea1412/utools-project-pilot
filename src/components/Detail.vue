<script setup>
import { computed, ref, watch } from 'vue';
import { store, activeProject, removeProject, startScript } from '../store.js';
import { toast, openModal, confirmBox, projectIconStyle } from '../ui.js';
import TabOverview from './TabOverview.vue';
import TabScripts from './TabScripts.vue';
import TabGit from './TabGit.vue';
import TabNotes from './TabNotes.vue';
import TabTasks from './TabTasks.vue';
import TabFiles from './TabFiles.vue';
import EditProjectModal from '../modals/EditProjectModal.vue';

const TABS = [
  ['overview', '概览'], ['scripts', '脚本'], ['git', 'Git'],
  ['notes', '备忘'], ['tasks', '任务'], ['files', '文件'],
];
const TAB_COMPS = { overview: TabOverview, scripts: TabScripts, git: TabGit, notes: TabNotes, tasks: TabTasks, files: TabFiles };

const proj = computed(() => activeProject());
const st = computed(() => store.gitCache[proj.value?.id]?.status);

function back() {
  store.view = 'dashboard';
  store.activeProjectId = null;
  import('../store.js').then((m) => m.refreshAllGit());
}
const openPath = (p) => window.pilot.openPath(p);
const openTerminal = (p) => window.pilot.openTerminal(p);
</script>

<template>
  <template v-if="proj">
    <header class="topbar detail-bar glass-strong">
      <button class="icon-btn" title="返回 (Esc)" @click="back">←</button>
      <div class="p-icon" :style="{ ...projectIconStyle(proj.color), width: '34px', height: '34px', fontSize: '15px' }">
        {{ (proj.name || '?').charAt(0).toUpperCase() }}
      </div>
      <div class="card-title">
        <h2>{{ proj.name }}</h2>
        <p class="p-path" :title="proj.path">{{ proj.path }}</p>
      </div>
      <div class="top-actions">
        <button class="icon-btn" title="打开文件夹" @click="openPath(proj.path)">▸</button>
        <button class="icon-btn" title="打开终端" @click="openTerminal(proj.path)">⌨</button>
        <button class="icon-btn" title="编辑项目" @click="openModal(EditProjectModal, { project: proj }, { title: '编辑项目' })">✏️</button>
        <button class="icon-btn" title="移除项目" @click="confirmBox('移除项目', `确定移除「${proj.name}」吗？不会删除磁盘文件。`, () => { removeProject(proj.id); back(); })">🗑</button>
      </div>
    </header>

    <nav class="tabbar glass">
      <button v-for="[id, label] in TABS" :key="id" class="tab"
              :class="{ 'tab-active': store.detailTab === id }" @click="store.detailTab = id">
        {{ label }}
        <span v-if="id === 'git' && st?.dirty" class="tab-badge">{{ st.dirty }}</span>
        <span v-if="id === 'tasks' && (proj.tasks || []).some((t) => t.enabled)" class="tab-dot"></span>
      </button>
    </nav>

    <main class="detail-body">
      <component :is="TAB_COMPS[store.detailTab]" :project="proj" />
    </main>
  </template>
</template>
