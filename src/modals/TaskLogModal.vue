<script setup>
import { fmtDate } from '../ui.js';
import { closeModal } from '../ui.js';
import Icon from '../components/Icon.vue';

defineProps({ task: { type: Object, required: true } });
</script>

<template>
  <div class="modal-body-inner log-list">
    <div v-for="(l, i) in (task.log || [])" :key="i" class="log-entry" :class="{ 'log-err': !l.ok }">
      <div class="log-head">
        <span :class="l.ok ? 'ok-text' : 'err-text'"><Icon :name="l.ok ? 'Check' : 'X'" :size="12" /> {{ l.ok ? '成功' : '失败' }}</span>
        <span>{{ fmtDate(l.time) }}</span>
      </div>
      <pre>{{ l.output || '（无输出）' }}</pre>
    </div>
    <p v-if="!(task.log || []).length" class="hint">暂无运行记录</p>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">关闭</button>
    </div>
  </div>
</template>
