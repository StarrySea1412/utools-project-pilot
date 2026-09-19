<script setup>
import { ref } from 'vue';
import { saveProjects, refreshAllGit } from '../store.js';
import { toast, closeModal, PROJECT_COLORS } from '../ui.js';

const props = defineProps({ project: { type: Object, required: true } });

const name = ref(props.project.name);
const path = ref(props.project.path);
const tags = ref((props.project.tags || []).join(', '));
const color = ref(props.project.color || 0);

function save() {
  props.project.name = name.value.trim() || props.project.name;
  props.project.path = path.value.trim() || props.project.path;
  props.project.tags = tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  props.project.color = color.value;
  saveProjects();
  toast('已保存', 'ok');
  closeModal();
  refreshAllGit(true);
}
</script>

<template>
  <div class="modal-body-inner">
    <label class="field"><span class="f-label">名称</span><input v-model="name" class="input"></label>
    <label class="field"><span class="f-label">路径</span><input v-model="path" class="input"></label>
    <label class="field"><span class="f-label">标签（逗号分隔）</span><input v-model="tags" class="input"></label>
    <div class="field"><span class="f-label">颜色</span>
      <div class="color-row">
        <button v-for="(c, i) in PROJECT_COLORS" :key="i" class="c-dot" :class="{ sel: color === i }"
                :style="{ background: c[0] }" @click="color = i"></button>
      </div>
    </div>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>
