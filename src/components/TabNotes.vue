<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { saveProjects } from '../store.js';
import { toast } from '../ui.js';

const props = defineProps({ project: { type: Object, required: true } });

const text = ref(props.project.notes || '');
const state = ref(text.value ? `已保存 · ${text.value.length} 字` : '自动保存');
let timer = null;

watch(text, () => {
  state.value = '编辑中…';
  clearTimeout(timer);
  timer = setTimeout(() => {
    props.project.notes = text.value;
    saveProjects();
    state.value = `已保存 · ${text.value.length} 字`;
  }, 600);
});
onBeforeUnmount(() => {
  if (timer) { clearTimeout(timer); props.project.notes = text.value; saveProjects(); }
});

async function exportNote() {
  try {
    await window.pilot.fs.writeText(props.project.path + '/NOTES.md', props.project.notes || '');
    toast('已导出到项目根目录 NOTES.md', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}
</script>

<template>
  <div class="panel-head">
    <h4>项目备忘</h4>
    <div class="btn-row">
      <span class="hint">{{ state }}</span>
      <button class="btn btn-ghost" @click="exportNote">导出为 .md</button>
    </div>
  </div>
  <div class="glass panel note-panel">
    <textarea v-model="text" class="note-area"
              placeholder="记录这个项目的关键信息：启动顺序、注意事项、待办…（自动保存）"></textarea>
  </div>
</template>
