<script setup>
import { ref } from 'vue';
import { saveProjects } from '../store.js';
import { toast, closeModal } from '../ui.js';

const props = defineProps({
  project: { type: Object, required: true },
  script: { type: Object, default: null },
});

const name = ref(props.script?.name || '');
const cmd = ref(props.script?.cmd || '');
const persistent = ref(!!props.script?.persistent);

function save() {
  if (!name.value.trim() || !cmd.value.trim()) { toast('名称和命令不能为空', 'warn'); return; }
  if (props.script) {
    Object.assign(props.script, { name: name.value.trim(), cmd: cmd.value.trim(), persistent: persistent.value });
  } else {
    props.project.scripts.push({
      id: 'sc_' + Date.now().toString(36),
      name: name.value.trim(), cmd: cmd.value.trim(), persistent: persistent.value,
    });
  }
  saveProjects();
  toast('已保存', 'ok');
  closeModal();
}
</script>

<template>
  <div class="modal-body-inner">
    <label class="field"><span class="f-label">名称</span>
      <input v-model="name" class="input" placeholder="dev">
    </label>
    <label class="field"><span class="f-label">命令</span>
      <textarea v-model="cmd" class="input mono" rows="3" placeholder="npm run dev"></textarea>
      <span class="f-hint">在项目目录下执行；长驻命令（如 dev server）请勾选「服务型」</span>
    </label>
    <label class="check-row">
      <input v-model="persistent" type="checkbox"> 服务型进程（启动后常驻，可停止）
    </label>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="save">{{ script ? '保存' : '添加' }}</button>
    </div>
  </div>
</template>
