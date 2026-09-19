<script setup>
import { computed } from 'vue';
import { store } from '../store.js';
import { openModal } from '../ui.js';
import { topPorts, portText } from '../ports.js';
import PortsModal from '../modals/PortsModal.vue';

const mem = computed(() => store.sys?.mem);
const cpu = computed(() => store.sys?.cpu);
const ports = computed(() => store.sys?.ports || []);
const memPct = computed(() => mem.value ? Math.round(mem.value.pct * 100) : null);
const cpuPct = computed(() => cpu.value?.pct == null ? null : Math.round(cpu.value.pct * 100));
const memUsed = computed(() => mem.value ? (mem.value.used / 1073741824).toFixed(1) : '—');
const memTotal = computed(() => mem.value ? (mem.value.total / 1073741824).toFixed(1) : '—');
const bizPorts = computed(() => topPorts(ports.value));
// 趋势波形（Glances 风）：store 每 3s 采样，最多 60 点
const memHist = computed(() => store.sys?.memHistory || []);
const cpuHist = computed(() => store.sys?.cpuHistory || []);
function spark(hist, w = 64, h = 20) {
  if (!hist || hist.length < 2) return '';
  const max = Math.max(...hist, 0.35);
  return hist.map((v, i) => {
    const px = (i / (hist.length - 1)) * w;
    const py = h - 1.5 - Math.max(0, Math.min(1, v / max)) * (h - 3);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
}
const memLevel = computed(() => memPct.value == null ? 'ok' : memPct.value > 85 ? 'crit' : memPct.value > 70 ? 'warn' : 'ok');
const cpuLevel = computed(() => cpuPct.value == null ? 'ok' : cpuPct.value > 85 ? 'crit' : cpuPct.value > 60 ? 'warn' : 'ok');
const isMock = typeof window !== 'undefined' && !!window.utools?.isMock;
</script>

<template>
  <!-- 折叠态：一行摘要 -->
  <div v-if="!store.sysOpen" class="sysbar mini glass" @click="store.sysOpen = true">
    <span class="cell-val" :class="memLevel">内存 {{ memPct == null ? '—' : memPct + '%' }}</span>
    <span class="dot"></span>
    <span class="cell-val" :class="cpuLevel">CPU {{ cpuPct == null ? '—' : cpuPct + '%' }}</span>
    <span class="dot"></span>
    <span class="cell-val">{{ ports.length }} 端口</span>
    <span class="spacer"></span>
    <span class="cell-lab">展开</span>
  </div>

  <!-- 展开态：一行内联仪表，56px 高 -->
  <div v-else class="sysbar glass">
    <div class="cell" :title="`已用 ${memUsed} GB / 总量 ${memTotal} GB`">
      <div class="ring" :class="memLevel">
        <svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15.9" pathLength="100" /><circle class="fg" cx="18" cy="18" r="15.9" pathLength="100" :stroke-dasharray="`${memPct ?? 0} 100`" /></svg>
        <b>{{ memPct == null ? '—' : memPct }}</b>
      </div>
      <div class="cell-txt">
        <span class="cell-lab">内存</span>
        <span class="cell-val num">{{ memUsed }} / {{ memTotal }} GB</span>
      </div>
      <svg v-if="spark(memHist)" class="trend" :class="memLevel" width="64" height="20" viewBox="0 0 64 20" preserveAspectRatio="none">
        <polyline :points="spark(memHist)" />
      </svg>
    </div>
    <span class="vdiv"></span>
    <div class="cell">
      <div class="ring" :class="cpuLevel">
        <svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15.9" pathLength="100" /><circle class="fg" cx="18" cy="18" r="15.9" pathLength="100" :stroke-dasharray="`${cpuPct ?? 0} 100`" /></svg>
        <b>{{ cpuPct == null ? '—' : cpuPct }}</b>
      </div>
      <div class="cell-txt">
        <span class="cell-lab">CPU</span>
        <span class="cell-val num">{{ cpu?.cores ?? '—' }} 核</span>
      </div>
      <svg v-if="spark(cpuHist)" class="trend" :class="cpuLevel" width="64" height="20" viewBox="0 0 64 20" preserveAspectRatio="none">
        <polyline :points="spark(cpuHist)" />
      </svg>
    </div>
    <span class="vdiv"></span>
    <button class="cell click" title="查看全部监听端口" @click="openModal(PortsModal, {}, { title: '监听中的端口' })">
      <span class="port-ico">🔌</span>
      <div class="cell-txt">
        <span class="cell-lab">监听端口 <b class="num accent">{{ ports.length }}</b></span>
        <span class="cell-val mono">{{ bizPorts.map(portText).join('　') || '—' }}</span>
      </div>
    </button>
    <span class="spacer"></span>
    <span v-if="isMock" class="mini-tag svc">演示数据</span>
    <button class="icon-btn sm" title="折叠" @click="store.sysOpen = false">⌄</button>
  </div>
</template>
