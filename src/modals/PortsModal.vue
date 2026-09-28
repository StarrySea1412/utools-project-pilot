<script setup>
import { computed, ref } from 'vue';
import { store, portProject } from '../store.js';
import { closeModal } from '../ui.js';
import Icon from '../components/Icon.vue';
import { portLabel, portKind, KIND_LABEL, isHttpPort, detectServiceName, fmtMem } from '../ports.js';

const filter = ref('all'); // 'all' | 'projects' | 'other'

const enrichedPorts = computed(() => {
  return (store.sys?.ports || []).map((p) => {
    const info = portProject(p.port);
    const service = info?.service || detectServiceName(p.commandLine, p.names, p.scriptName, p.port);
    return {
      ...p,
      project: info?.project || null,
      service,
      isHttp: isHttpPort(p.port),
    };
  });
});

const projectPortsCount = computed(() => enrichedPorts.value.filter((p) => p.project).length);
const otherPortsCount = computed(() => enrichedPorts.value.filter((p) => !p.project).length);

const displayedPorts = computed(() => {
  let list = enrichedPorts.value.slice();
  if (filter.value === 'projects') {
    list = list.filter((p) => p.project);
  } else if (filter.value === 'other') {
    list = list.filter((p) => !p.project);
  }
  return list.sort((a, b) => {
    const aHasProj = a.project ? 1 : 0;
    const bHasProj = b.project ? 1 : 0;
    if (aHasProj !== bHasProj) return bHasProj - aHasProj;
    const aSys = portKind(a) === 'system' ? 1 : 0;
    const bSys = portKind(b) === 'system' ? 1 : 0;
    if (aSys !== bSys) return aSys - bSys;
    return a.port - b.port;
  });
});

function openPort(p) {
  if (p.isHttp) window.pilot.openInBrowser(`http://localhost:${p.port}`);
}

function toProject(projectId) {
  closeModal();
  store.activeProjectId = projectId;
  store.detailTab = 'overview';
  store.view = 'detail';
}

// 结束进程：两击确认，系统关键进程禁用
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
    window.pilot.notify(`已结束 ${p.service || p.names[0] || '进程'}（端口 ${p.port}）`);
  } catch (e) { window.pilot.notify(`结束失败：${e.message || e}`); }
  store.sys.portsLoading = true;
  try { store.sys.ports = await window.pilot.sys.ports(); } catch (e) { /* 保留旧列表 */ }
  store.sys.portsLoading = false;
}
</script>

<template>
  <div class="modal-body-inner">
    <div class="port-filter-tabs">
      <button class="port-filter-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">
        全部 ({{ enrichedPorts.length }})
      </button>
      <button class="port-filter-btn" :class="{ active: filter === 'projects' }" @click="filter = 'projects'">
        <Icon name="Folder" :size="12" /> 项目服务 ({{ projectPortsCount }})
      </button>
      <button class="port-filter-btn" :class="{ active: filter === 'other' }" @click="filter = 'other'">
        其他进程 ({{ otherPortsCount }})
      </button>
    </div>

    <p v-if="store.sys?.portsError" class="hint pad err-text">{{ store.sys.portsError }}</p>
    <p v-else-if="store.sys?.portsLoading" class="hint pad">扫描中（netstat）…</p>
    <div v-else class="ports-table">
      <div v-for="p in displayedPorts" :key="p.port" class="port-row" :class="{ 'port-http': p.isHttp }"
           :title="p.commandLine ? `命令行：${p.commandLine}` : (p.isHttp ? '点击在浏览器打开服务' : '')"
           @click="openPort(p)">
        <span class="port-num">:{{ p.port }}</span>

        <button v-if="p.project" class="port-proj-tag" title="点击跳转至此项目概览" @click.stop="toProject(p.project.id)">
          <Icon name="Folder" :size="10" /> {{ p.project.name }}
        </button>

        <span class="mini-tag" :class="'kind-' + portKind(p)">{{ KIND_LABEL[portKind(p)] }}</span>

        <span class="port-names">
          <b v-if="p.service && p.service !== (p.names[0] || '').replace(/\.exe$/i, '')" class="service-bold">{{ p.service }} · </b>
          {{ p.names.join(', ') || '未知进程' }}
        </span>

        <span v-if="p.mem" class="port-mem mono" title="进程内存占用">{{ fmtMem(p.mem) }}</span>
        <span class="port-pids">PID {{ p.pids.join('/') || '—' }}</span>

        <button v-if="canKill(p)" class="kill-btn" :class="{ armed: armed === p.port }"
                :title="armed === p.port ? '再点一次确认结束该进程树' : '结束该进程树（taskkill /T /F）'"
                @click.stop="kill(p)">
          <template v-if="armed === p.port">确认结束</template>
          <Icon v-else name="X" :size="11" />
        </button>
        <span v-else class="kill-btn kill-off" title="系统关键进程不可结束"><Icon name="X" :size="11" /></span>

        <span v-if="p.isHttp" class="mini-tag svc clickable-svc" title="点击在浏览器打开">HTTP</span>
      </div>
      <p v-if="!displayedPorts.length" class="hint pad">该分类下没有发现监听中的端口。</p>
    </div>
    <p class="hint">点击所属项目可快速跳转到项目详情；点击 HTTP 端口可直接在浏览器打开。</p>
    <div class="btn-row" style="margin-top: 8px">
      <button class="btn btn-ghost" @click="closeModal()">关闭</button>
    </div>
  </div>
</template>
