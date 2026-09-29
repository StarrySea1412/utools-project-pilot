<script setup>
import { computed, ref } from 'vue';
import { store, portProject } from '../store.js';
import { closeModal } from '../ui.js';
import Icon from '../components/Icon.vue';
import { portLabel, portKind, isHttpPort, detectServiceName, fmtMem } from '../ports.js';

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
  <div class="modal-body-inner ports-ui">
    <!-- 顶部：分类分段器 + 说明 -->
    <div class="ports-top">
      <div class="ports-seg">
        <button class="ports-seg-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          全部 <b>{{ enrichedPorts.length }}</b>
        </button>
        <button class="ports-seg-btn" :class="{ active: filter === 'projects' }" @click="filter = 'projects'">
          <Icon name="Folder" :size="12" /> 项目服务 <b>{{ projectPortsCount }}</b>
        </button>
        <button class="ports-seg-btn" :class="{ active: filter === 'other' }" @click="filter = 'other'">
          其他进程 <b>{{ otherPortsCount }}</b>
        </button>
      </div>
      <span class="ports-hint">点击行打开 HTTP 服务 · 点击项目名直达</span>
    </div>

    <p v-if="store.sys?.portsError" class="hint pad err-text">{{ store.sys.portsError }}</p>
    <p v-else-if="store.sys?.portsLoading" class="hint pad">扫描中（netstat）…</p>

    <div v-else class="ports-list">
      <div v-for="p in displayedPorts" :key="p.port"
           class="port-card" :class="[{ http: p.isHttp }, 'kind-' + portKind(p)]"
           :title="p.commandLine ? `命令行：${p.commandLine}` : (p.isHttp ? '点击在浏览器打开服务' : '')"
           @click="openPort(p)">
        <!-- 左：端口徽章 -->
        <span class="pc-port mono">:{{ p.port }}</span>

        <!-- 中：主体信息 -->
        <div class="pc-main">
          <div class="pc-line1">
            <span class="pc-service">{{ p.service || (p.names[0] || '未知进程').replace(/\.exe$/i, '') }}</span>
            <span v-if="p.isHttp" class="pc-http-dot" title="HTTP 可访问"></span>
            <span v-if="p.project" class="pc-proj" title="点击跳转至此项目概览" @click.stop="toProject(p.project.id)">
              <Icon name="Folder" :size="10" /> {{ p.project.name }}
            </span>
          </div>
          <div class="pc-line2">
            <span class="pc-proc">{{ p.names.join(', ') || '未知进程' }}</span>
            <span class="pc-pid mono">PID {{ p.pids.join('/') || '—' }}</span>
          </div>
        </div>

        <!-- 右：内存 + 操作 -->
        <span v-if="p.mem" class="pc-mem mono">{{ fmtMem(p.mem) }}</span>
        <button v-if="canKill(p)" class="pc-kill" :class="{ armed: armed === p.port }"
                :title="armed === p.port ? '再点一次确认结束该进程树' : '结束该进程树（taskkill /T /F）'"
                @click.stop="kill(p)">
          <template v-if="armed === p.port">确认结束</template>
          <Icon v-else name="X" :size="11" />
        </button>
        <span v-else class="pc-kill off" title="系统关键进程不可结束"><Icon name="Lock" :size="10" /></span>
      </div>
      <p v-if="!displayedPorts.length" class="ports-empty">该分类下没有发现监听中的端口。</p>
    </div>
  </div>
</template>

<style scoped>
/* 端口管理 UI v2 — 卡片式列表（Linear 风 hairline + 分段器） */
.ports-ui { gap: 0; }
.ports-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.ports-seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--code-bg); border-radius: 10px; }
.ports-seg-btn {
  display: inline-flex; align-items: center; gap: 5px;
  border: none; background: none; color: var(--text-3); cursor: pointer;
  font-size: 12px; font-weight: 600; font-family: var(--font);
  padding: 5px 12px; border-radius: 8px; transition: all 0.15s;
}
.ports-seg-btn b { font-variant-numeric: tabular-nums; opacity: 0.7; font-weight: 700; }
.ports-seg-btn:hover { color: var(--text-2); }
.ports-seg-btn.active { background: var(--glass-strong); color: var(--text); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1); }
.ports-hint { font-size: 11px; color: var(--text-3); margin-left: auto; }

.ports-list { display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow-y: auto; padding-right: 2px; }

.port-card {
  display: flex; align-items: center; gap: 12px; padding: 9px 12px;
  border: 1px solid var(--stroke-soft); border-radius: 10px; background: var(--glass-thin);
  transition: border-color 0.15s, background 0.15s;
}
.port-card:hover { border-color: var(--stroke); background: var(--hover); }
.port-card.http { cursor: pointer; }
.port-card.http:hover { border-color: color-mix(in srgb, var(--accent) 35%, transparent); }

/* 分类色条：系统=灰 / 业务=绿 / 应用=蓝（仅左侧 2px 提示，克制） */
.port-card.kind-system { border-left: 2px solid var(--text-3); }
.port-card.kind-dev { border-left: 2px solid var(--ok); }
.port-card.kind-app { border-left: 2px solid var(--accent); }

.pc-port { font-size: 12.5px; font-weight: 700; color: var(--accent); min-width: 52px; flex-shrink: 0; }
.port-card.kind-system .pc-port { color: var(--text-3); }

.pc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pc-line1 { display: flex; align-items: center; gap: 7px; min-width: 0; }
.pc-service { font-size: 12.5px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-http-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-2); flex-shrink: 0; }
.pc-proj {
  display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  padding: 1px 7px; border-radius: 6px; cursor: pointer; border: none; font-family: var(--font);
  max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: all 0.15s;
}
.pc-proj:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }

.pc-line2 { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pc-proc { font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.pc-pid { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; }

.pc-mem { font-size: 11.5px; font-weight: 700; color: var(--accent-2); min-width: 52px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }

.pc-kill {
  border: 1px solid transparent; border-radius: 7px; cursor: pointer; flex-shrink: 0;
  background: color-mix(in srgb, var(--err) 10%, transparent); color: var(--err);
  font-size: 11px; font-weight: 700; padding: 4px 8px; font-family: var(--font);
  display: inline-flex; align-items: center; transition: all 0.15s;
}
.pc-kill:hover { background: color-mix(in srgb, var(--err) 22%, transparent); }
.pc-kill.armed { background: var(--err); color: #fff; }
.pc-kill.off { background: transparent; color: var(--text-3); opacity: 0.4; cursor: not-allowed; }

.ports-empty { text-align: center; color: var(--text-3); font-size: 12px; padding: 28px 0; }
</style>
