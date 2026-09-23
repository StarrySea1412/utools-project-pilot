<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { store } from '../store.js';
import { toast } from '../ui.js';
import Icon from './Icon.vue';

const bodyRef = ref(null);

const openHandle = computed(() => (store.consoleOpen ? store.procHandles[store.consoleOpen] : null));
const log = computed(() => (openHandle.value ? store.procLogs[openHandle.value.id] || '' : ''));

watch(log, async () => {
  await nextTick();
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
});

function close() { store.consoleOpen = null; }
function clear() {
  if (openHandle.value) store.procLogs[openHandle.value.id] = '';
}
function copyAll() {
  window.pilot.copyText(log.value);
  toast('已复制输出', 'ok');
}
</script>

<template>
  <div v-if="openHandle" class="console-drawer glass-strong open">
    <div class="console-head">
      <span class="console-title"><Icon name="Terminal" :size="13" /> {{ openHandle.scriptName }}</span>
      <span class="spacer"></span>
      <button class="icon-btn" title="复制全部" @click="copyAll"><Icon name="Copy" :size="14" /></button>
      <button class="icon-btn" title="清屏" @click="clear"><Icon name="Eraser" :size="14" /></button>
      <button class="icon-btn" title="收起" @click="close"><Icon name="ChevronDown" :size="14" /></button>
    </div>
    <pre ref="bodyRef" class="console-body">{{ log }}</pre>
  </div>
</template>
