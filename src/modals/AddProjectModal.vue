<script setup>
import { ref } from 'vue';
import { addProject, refreshAllGit, saveProjects } from '../store.js';
import { toast, closeModal } from '../ui.js';
import Icon from '../components/Icon.vue';

const picked = ref([]);
const manual = ref('');
const tags = ref('');

function pick() {
  const dirs = window.pilot.selectFolder() || [];
  dirs.forEach((d) => { if (!picked.value.includes(d)) picked.value.push(d); });
}
function rmPick(p) { picked.value = picked.value.filter((x) => x !== p); }

async function doAdd() {
  const paths = [...picked.value];
  if (manual.value.trim()) paths.push(manual.value.trim());
  const tagList = tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (!paths.length) { toast('请先选择或输入项目路径', 'warn'); return; }
  let added = 0;
  for (const p of paths) {
    if (!(await window.pilot.fs.exists(p))) { toast(`路径不存在: ${p}`, 'err'); continue; }
    const proj = addProject(p);
    if (proj) { proj.tags = tagList.slice(); saveProjects(); added++; }
    else toast(`已存在，跳过: ${p}`, 'warn');
  }
  if (added) {
    toast(`已添加 ${added} 个项目`, 'ok');
    closeModal();
    refreshAllGit(true);
  }
}
</script>

<template>
  <div class="modal-body-inner">
    <div class="add-row">
      <button class="btn btn-primary" @click="pick"><Icon name="FolderOpen" :size="13" /> 选择文件夹…</button>
      <span class="hint">或手动输入路径</span>
    </div>
    <div class="picked-list">
      <div v-for="p in picked" :key="p" class="picked-item">
        <span :title="p">{{ p }}</span>
        <button @click="rmPick(p)"><Icon name="X" :size="11" /></button>
      </div>
    </div>
    <label class="field"><span class="f-label">项目路径</span>
      <input v-model="manual" class="input" placeholder="D:\code\my-project">
    </label>
    <label class="field"><span class="f-label">标签（逗号分隔）</span>
      <input v-model="tags" class="input" placeholder="tool, dev">
    </label>
    <div class="hint">也可直接把文件夹拖进本插件窗口添加。</div>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="doAdd">添加</button>
    </div>
  </div>
</template>
