<script setup>
import { ref, computed, watch } from 'vue';
import { saveProjects } from '../store.js';
import { toast, closeModal } from '../ui.js';
import Select from '../components/Select.vue';

const props = defineProps({
  project: { type: Object, required: true },
  task: { type: Object, default: null },
});

const name = ref(props.task?.name || '');
const cmd = ref(props.task?.cmd || '');
const type = ref(props.task?.type || 'interval');
const everyMinutes = ref(props.task?.everyMinutes || 60);
const atTime = ref(props.task?.atTime || '09:00');
const enabled = ref(props.task ? props.task.enabled : true);

const showEvery = computed(() => type.value === 'interval');
const showAt = computed(() => type.value === 'daily');

function save() {
  if (!name.value.trim() || !cmd.value.trim()) { toast('名称和命令不能为空', 'warn'); return; }
  const data = {
    name: name.value.trim(), cmd: cmd.value.trim(), type: type.value,
    everyMinutes: Math.max(1, +everyMinutes.value || 60),
    atTime: atTime.value || '09:00',
    enabled: enabled.value,
  };
  if (props.task) Object.assign(props.task, data);
  else props.project.tasks.push(Object.assign({ id: 'tk_' + Date.now().toString(36), log: [], lastRun: 0 }, data));
  saveProjects();
  toast('已保存', 'ok');
  closeModal();
}
</script>

<template>
  <div class="modal-body-inner">
    <label class="field"><span class="f-label">任务名称</span>
      <input v-model="name" class="input" placeholder="每日拉取更新">
    </label>
    <label class="field"><span class="f-label">执行命令</span>
      <textarea v-model="cmd" class="input mono" rows="2" placeholder="git pull --rebase"></textarea>
    </label>
    <div class="field"><span class="f-label">触发方式</span>
      <Select v-model="type" block :options="[{ value: 'interval', label: '固定间隔' }, { value: 'daily', label: '每天定时' }, { value: 'boot', label: '插件打开时' }]" />
    </div>
    <div class="two-col">
      <label v-if="showEvery" class="field"><span class="f-label">间隔（分钟）</span>
        <input v-model="everyMinutes" type="number" min="1" class="input">
      </label>
      <label v-if="showAt" class="field"><span class="f-label">定时（HH:MM）</span>
        <input v-model="atTime" type="time" class="input">
      </label>
    </div>
    <label class="check-row">
      <input v-model="enabled" type="checkbox"> 启用
    </label>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="save">{{ task ? '保存' : '添加' }}</button>
    </div>
  </div>
</template>
