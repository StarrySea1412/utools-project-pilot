<script setup>
import { computed, ref } from 'vue';
import { store } from '../store.js';
import { closeModal } from '../ui.js';
import Icon from '../components/Icon.vue';
import { portLabel, portKind, KIND_LABEL } from '../ports.js';

// 系统端口沉底，业务端口靠前
const ports = computed(() => [...(store.sys?.ports || [])].sort((a, b) => (portKind(a) === 'system') - (portKind(b) === 'system') || a.port - b.port));
const isHttp = (port) => [80, 443, 3000, 3001, 4000, 5000, 5173, 5174, 7001, 8000, 8001, 8008, 8080, 8081, 8090, 8888, 9000, 9528, 4200].includes(port);
function openPort(p) {
  if (isHttp(p.port)) window.pilot.openInBrowser(`http://localhost:${p.port}`);
}
// 结束进程（CurrPorts 风）：两击确认，系统关键进程禁用
const armed = ref(null);
let armTimer = null;
const canKill = (p) => portKind(p) !== 'system' && p.pids.length && p.pids[0] > 4;
async function kill(p) {
  if (armed.value !== p.port) {
    armed.value = p.port;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed.value = null; }, 2500);
    return;
  }
  armed.value = null;
  try {
    const r = await window.pilot.killPid(p.pids[0]);
    if (r && r.ok === false) { window.pilot.notify(`结束失败：${r.error || '未知错误'}`); return; }
    window.pilot.notify(`已结束 ${p.names[0] || '进程'}（端口 ${p.port}）`);
  } catch (e) { window.pilot.notify(`结束失败：${e.message || e}`); }
  store.sys.portsLoading = true;
  try { store.sys.ports = await window.pilot.sys.ports(); } catch (e) { /* 保留旧列表 */ }
  store.sys.portsLoading = false;
}
</script>

<template>
  <div class="modal-body-inner">
    <p v-if="store.sys?.portsError" class="hint pad err-text">{{ store.sys.portsError }}</p>
    <p v-else-if="store.sys?.portsLoading" class="hint pad">扫描中（netstat）…</p>
    <div v-else class="ports-table">
      <div v-for="p in ports" :key="p.port" class="port-row" :class="{ 'port-http': isHttp(p.port) }" @click="isHttp(p.port) && openPort(p)">
        <span class="port-num">:{{ p.port }}</span>
        <span class="mini-tag" :class="'kind-' + portKind(p)">{{ KIND_LABEL[portKind(p)] }}</span>
        <span class="port-names">{{ (p.names.join(', ') || '未知进程') + (portLabel(p.port) ? ' · ' + portLabel(p.port) : '') }}</span>
        <span class="port-pids">PID {{ p.pids.join(' / ') || '—' }}</span>
        <button v-if="canKill(p)" class="kill-btn" :class="{ armed: armed === p.port }" :title="armed === p.port ? '再点一次确认结束该进程树' : '结束该进程树（taskkill /T /F）'" @click.stop="kill(p)"><template v-if="armed === p.port">确认结束</template><Icon v-else name="X" :size="11" /></button>
        <span v-else class="kill-btn kill-off" title="系统关键进程不可结束"><Icon name="X" :size="11" /></span>
        <span v-if="isHttp(p.port)" class="mini-tag svc">HTTP</span>
      </div>
      <p v-if="!ports.length" class="hint pad">没有发现监听中的 TCP 端口。</p>
    </div>
    <p class="hint">系统 = Windows 自身服务；业务 = 开发/数据库；应用 = 第三方软件。点击 HTTP 开发端口可直接在浏览器打开。</p>
    <div class="btn-row" style="margin-top: 8px">
      <button class="btn btn-ghost" @click="closeModal()">关闭</button>
    </div>
  </div>
</template>
