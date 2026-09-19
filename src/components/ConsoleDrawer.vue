<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { store } from '../store.js';
import { toast } from '../ui.js';

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
      <span class="console-title">⌨ {{ openHandle.scriptName }}</span>
      <span class="spacer"></span>
      <button class="icon-btn" title="复制全部" @click="copyAll">❐</button>
      <button class="icon-btn" title="清屏" @click="clear">⌫</button>
      <button class="icon-btn" title="收起" @click="close">⌄</button>
    </div>
    <pre ref="bodyRef" class="console-body">{{ log }}</pre>
  </div>
</template>
