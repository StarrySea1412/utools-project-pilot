<script setup>
// AllChanges.vue — 跨项目聚合变更总览：回答「我今天改了哪些东西」
import { computed, ref, onMounted } from 'vue';
import { store, activeProjects } from '../store.js';
import { toast, closeModal } from '../ui.js';
import Icon from './Icon.vue';

const emit = defineEmits(['open-detail']);

const loading = ref(true);
// 每项目最新 status：进入时全量刷新一次，不靠缓存（弹窗打开时数据要准）
const fresh = ref({});

async function load() {
  loading.value = true;
  const entries = await Promise.all(activeProjects().map(async (p) => {
    try {
      const st = await window.pilot.git.status(p.path);
      return [p.id, st];
    } catch (e) { return [p.id, null]; }
  }));
  fresh.value = Object.fromEntries(entries);
  loading.value = false;
}
onMounted(load);

const dirtyProjects = computed(() => activeProjects()
  .filter((p) => fresh.value[p.id]?.dirty > 0)
  .map((p) => ({ proj: p, st: fresh.value[p.id] }))
  .sort((a, b) => b.st.dirty - a.st.dirty));

const totalDirty = computed(() => dirtyProjects.value.reduce((n, x) => n + x.st.dirty, 0));

function goGit(id) {
  closeModal();
  store.activeProjectId = id;
  store.view = 'detail';
  store.detailTab = 'git';
  store.gitSubTab = 'changes';
  emit('open-detail', id);
}
function goCommit(id) {
  goGit(id);
}
</script>

<template>
  <div class="modal-body-inner all-changes">
    <div class="ac-head">
      <span class="hint">
        <template v-if="!loading">{{ dirtyProjects.length }} 个项目有未提交变更，共 {{ totalDirty }} 个文件</template>
        <template v-else>正在扫描全部项目…</template>
      </span>
      <button class="btn btn-ghost" :disabled="loading" @click="load"><Icon name="RefreshCw" :size="13" /> 重新扫描</button>
    </div>

    <div v-for="{ proj, st } in dirtyProjects" :key="proj.id" class="ac-proj">
      <div class="ac-proj-head" @click="goGit(proj.id)">
        <span class="p-icon ac-icon" :style="{ background: 'var(--chip-bg)' }">{{ proj.name[0].toUpperCase() }}</span>
        <span class="b-name">{{ proj.name }}</span>
        <span class="mini-tag mono" v-if="st.branch">{{ st.branch }}</span>
        <span class="dirty-pill">● {{ st.dirty }}</span>
        <span class="spacer"></span>
        <button class="btn btn-ghost sm" @click.stop="goCommit(proj.id)"><Icon name="ArrowUpRight" :size="12" /> 去提交</button>
      </div>
      <ul class="ac-files">
        <li v-for="f in (st.entries || []).slice(0, 5)" :key="f.path">
          <span class="ch-badge" :class="f.untracked ? 'b-u' : 'b-m'">{{ f.untracked ? 'U' : 'M' }}</span>
          <span class="ac-path mono" :title="f.path">{{ f.path }}</span>
        </li>
        <li v-if="st.entries.length > 5" class="hint">… 还有 {{ st.entries.length - 5 }} 个文件</li>
      </ul>
    </div>

    <div v-if="!loading && !dirtyProjects.length" class="empty-box" style="grid-column: 1/-1">
      <div class="e-icon"><Icon name="CircleCheck" :size="30" /></div>
      <div class="e-title">全部干净</div>
      <div class="e-sub">所有项目的工作区都没有未提交变更</div>
    </div>

    <div class="btn-row" style="margin-top: 10px">
      <span class="spacer"></span>
      <button class="btn btn-ghost" @click="closeModal()">关闭</button>
    </div>
  </div>
</template>
