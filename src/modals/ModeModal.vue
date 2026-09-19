<script setup>
import { ref } from 'vue';
import { store, saveSettings } from '../store.js';
import { toast, closeModal, confirmBox } from '../ui.js';

const props = defineProps({ mode: { type: Object, default: null } });

const name = ref(props.mode?.name || '');
const prompt = ref(props.mode?.prompt || '');

function save() {
  if (!name.value.trim() || !prompt.value.trim()) { toast('名称和提示词不能为空', 'warn'); return; }
  if (props.mode) {
    Object.assign(props.mode, { name: name.value.trim(), prompt: prompt.value.trim() });
  } else {
    const id = 'mode_' + Date.now().toString(36);
    store.settings.analysisModes.push({ id, name: name.value.trim(), prompt: prompt.value.trim(), builtin: false });
    store.insightMode = id;
  }
  saveSettings();
  toast('已保存', 'ok');
  closeModal();
}
function del() {
  confirmBox('删除模式', `删除「${props.mode.name}」？`, () => {
    store.settings.analysisModes = store.settings.analysisModes.filter((x) => x.id !== props.mode.id);
    saveSettings();
    closeModal();
  });
}
</script>

<template>
  <div class="modal-body-inner">
    <label class="field"><span class="f-label">模式名称</span>
      <input v-model="name" class="input" placeholder="如：版本发布说明">
    </label>
    <label class="field"><span class="f-label">提示词（发给 AI 的分析指令）</span>
      <textarea v-model="prompt" class="input mono" rows="5" placeholder="根据提交记录，……"></textarea>
      <span class="f-hint">提交记录会作为上下文发送给 AI，提示词决定 AI 输出的角度和格式。</span>
    </label>
    <div class="btn-row" style="margin-top: 10px">
      <button v-if="mode && !mode.builtin" class="btn btn-danger-ghost" @click="del">删除</button>
      <span class="spacer"></span>
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="save">{{ mode ? '保存' : '添加' }}</button>
    </div>
  </div>
</template>
