<script setup>
// RuntimePanel.vue — 运行时面板（Lazydocker 式）：全局视角汇总所有项目正在跑的服务进程
// 内部脚本 + 外部探测，一行一进程：状态灯 / 名称 / 项目 / 端口 / 内存 / 日志 / 重启 / 停止
import { computed, ref } from 'vue';
import { store, stopScript, startScript, projectServices } from '../store.js';
import { toast } from '../ui.js';
import { portUrl, fmtMem, isHttpPort } from '../ports.js';
import Icon from './Icon.vue';

const emit = defineEmits(['open-detail']);
const expanded = ref({}); // 服务行日志展开
const collapsed = ref(false); // 面板折叠状态

// 汇总：每个项目 × projectServices（内部 + 外部）
const allServices = computed(() => {
  const out = [];
  for (const p of store.projects) {
    for (const s of projectServices(p)) {
      out.push({ ...s, project: p });
    }
  }
  // 内部服务排前面（可控），外部随后；无端口且非内部的（纯内部脚本无日志行）保留但沉底
  const weight = (s) => s.isInternal ? 0 : (s.port ? 1 : 2);
  return out.sort((a, b) => weight(a) - weight(b));
});

const isRunning = computed(() => allServices.value.length > 0);
const totalMem = computed(() => allServices.value.reduce((n, s) => n + (s.mem || 0), 0));
// 本插件自身占用（与 SysBar 同源）
const selfRss = computed(() => store.sys?.self?.rss ? (store.sys.self.rss / 1048576).toFixed(1) : null);

function toggleLog(key) { expanded.value[key] = !expanded.value[key]; }
function logOf(s) {
  const h = store.procHandles[getScriptId(s)];
  return h ? (store.procLogs[h.id] || '').slice(-800) : '';
}
function getScriptId(s) {
  // 内部服务通过 name 反查 scriptId（procHandles key 即 scriptId）
  const proj = s.project;
  const sc = (proj.scripts || []).find((x) => x.name === s.name && store.procHandles[x.id]?.running);
  return sc?.id || '';
}
async function restart(s) {
  const proj = s.project;
  const sc = (proj.scripts || []).find((x) => x.name === s.name);
  if (!sc) { toast('找不到对应脚本，无法重启', 'err'); return; }
  await stopScript(sc);
  startScript(proj, sc);
  toast(`已重启「${s.name}」`, 'ok');
}
async function stop(s) {
  const sc = (s.project.scripts || []).find((x) => x.name === s.name);
  if (!sc) { toast('外部进程请到端口管理中结束', 'warn'); return; }
  await stopScript(sc);
  toast(`已停止「${s.name}」`, 'ok');
}
// 结束外部进程：两击确认（与 PortsModal 一致），防误杀不相关进程
const armed = ref(null);
let armTimer = null;
const killKey = (s) => `${s.project.id}:${s.pid || ''}`;
async function killExternal(s) {
  if (!s.pid) return;
  const key = killKey(s);
  if (armed.value !== key) {
    armed.value = key;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed.value = null; }, 2500);
    return;
  }
  armed.value = null;
  try {
    const r = await window.pilot.killPid(s.pid);
    if (r && r.ok === false) { toast(`结束失败：${r.error || '未知错误'}`, 'err'); return; }
    toast(`已结束「${s.service || s.name}」进程`, 'ok');
  } catch (e) { toast(`结束失败：${e.message || e}`, 'err'); }
  try { store.sys.ports = await window.pilot.sys.ports(); } catch (e) {}
}
function openUrl(s) { if (s.url) window.pilot.openInBrowser(s.url); }
function toProject(id) { emit('open-detail', id); }
// HTTP 服务的探活结果（store 每 15s 刷新；无数据不显示）
const healthOf = (s) => (s.port && isHttpPort(s.port) ? (store.sys?.health?.[s.port] || null) : null);
</script>

<template>
  <section v-if="isRunning" class="glass panel rt-panel" :class="{ collapsed }">
    <div class="rt-head" @click="collapsed = !collapsed">
      <h4 class="panel-title"><Icon name="Activity" :size="14" /> 运行时 · {{ allServices.length }} 个服务</h4>
      <span class="mini-tag svc mono" title="全部服务进程内存合计">服务 {{ fmtMem(totalMem) }}</span>
      <span v-if="selfRss" class="mini-tag mono" title="本插件进程内存占用">自身 {{ selfRss }} MB</span>
      <span class="spacer"></span>
      <span class="rt-collapse-hint">{{ collapsed ? '展开' : '' }}</span>
      <button class="icon-btn sm" :title="collapsed ? '展开面板' : '折叠面板'" @click.stop="collapsed = !collapsed">
        <Icon :name="collapsed ? 'ChevronDown' : 'ChevronUp'" :size="12" />
      </button>
    </div>
    <div v-if="!collapsed" class="rt-rows">
      <div v-for="s in allServices" :key="(s.project.id) + ':' + (s.port || s.name)" class="rt-row" :class="{ internal: s.isInternal }">
        <span class="rt-led" :class="{ on: true }"></span>
        <button class="rt-name" :title="s.project.name" @click="toProject(s.project.id)">{{ s.service || s.name }}</button>
        <span class="mini-tag" :class="s.isInternal ? 'svc' : ''">{{ s.isInternal ? '内部' : '外部' }}</span>
        <button v-if="s.port" class="rt-port mono" :title="s.url ? '点击打开 ' + s.url : ''" :class="{ clickable: s.url }" @click="openUrl(s)">:{{ s.port }}</button>
        <span v-else class="rt-port mono muted">:—</span>
        <span v-if="healthOf(s)" class="rt-health" :class="healthOf(s).ok ? 'up' : 'down'"
              :title="healthOf(s).ok ? `探活正常（HTTP ${healthOf(s).code || '—'}），延迟 ${healthOf(s).ms}ms` : '探活失败：无响应或超时'">{{ healthOf(s).ok ? healthOf(s).ms + 'ms' : '超时' }}</span>
        <span class="rt-mem mono">{{ s.mem ? fmtMem(s.mem) : '—' }}</span>
        <span class="spacer"></span>
        <button v-if="s.isInternal" class="icon-btn sm" title="查看日志" @click="toggleLog(s.project.id + ':' + (s.port || s.name))"><Icon :name="expanded[s.project.id + ':' + (s.port || s.name)] ? 'ChevronDown' : 'ChevronUp'" :size="12" /></button>
        <button v-if="s.isInternal" class="icon-btn sm" title="重启" @click="restart(s)"><Icon name="RotateCw" :size="12" /></button>
        <button v-if="s.isInternal" class="icon-btn sm" title="停止" @click="stop(s)"><Icon name="Square" :size="12" /></button>
        <button v-if="!s.isInternal && s.pid" class="icon-btn sm rt-kill" :class="{ armed: armed === killKey(s) }"
                :title="armed === killKey(s) ? '再点一次确认结束该进程树' : '结束该进程树（两击确认）'"
                @click="killExternal(s)">
          <template v-if="armed === killKey(s)">确认</template>
          <Icon v-else name="X" :size="12" />
        </button>
        <pre v-if="s.isInternal && expanded[s.project.id + ':' + (s.port || s.name)] && logOf(s)" class="rt-log mono">{{ logOf(s) }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rt-kill { color: var(--err); }
.rt-kill:hover { background: color-mix(in srgb, var(--err) 15%, transparent); border-radius: 7px; }
.rt-kill.armed { background: var(--err); color: #fff; border-radius: 7px; padding: 0 8px; font-size: 11px; font-weight: 700; }
.rt-health { font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; flex-shrink: 0; padding: 1px 7px; border-radius: 6px; }
.rt-health.up { color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, transparent); }
.rt-health.down { color: var(--err); background: color-mix(in srgb, var(--err) 12%, transparent); }
</style>
