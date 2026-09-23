<script setup>
import { ui } from '../ui.js';
import Icon from './Icon.vue';
const icons = { ok: 'Check', err: 'X', warn: 'TriangleAlert', info: 'Info', ai: 'Sparkles' };
</script>

<template>
  <div class="toast-wrap">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="'toast-' + t.type">
      <span class="t-ico"><Icon :name="icons[t.type] || 'Info'" :size="10" /></span><span>{{ t.msg }}</span>
    </div>
  </div>
</template>
