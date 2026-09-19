<script setup>
import { ui } from '../ui.js';
const icons = { ok: '✓', err: '✕', warn: '!', info: 'i', ai: '✦' };
</script>

<template>
  <div class="toast-wrap">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="'toast-' + t.type">
      <span class="t-ico">{{ icons[t.type] || 'i' }}</span><span>{{ t.msg }}</span>
    </div>
  </div>
</template>
