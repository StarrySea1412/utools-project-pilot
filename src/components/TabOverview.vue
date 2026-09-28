<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, startScript, stopScript, projectPorts, projectServices, watchProc, checkGit } from '../store.js';
import { toast, timeAgo, commitType } from '../ui.js';
import { fmtMem } from '../ports.js';
import Icon from './Icon.vue';

const props = defineProps({ project: { type: Object, required: true } });

const status = computed(() => store.gitCache[props.project.id]?.status);
const recentCommits = ref([]);
const runningTaskLogs = ref([]);

onMounted(async () => {
  try { recentCommits.value = await window.pilot.git.log(props.project.path, 5) || []; } catch (e) { recentCommits.value = []; }
  runningTaskLogs.value = (props.project.tasks || [])
    .flatMap((t) => (t.log || []).slice(0, 2).map((l) => ({ ...l, task: t.name })))
    .sort((a, b) => b.time - a.time).slice(0, 5);
});

const tasksOn = computed(() => (props.project.tasks || []).filter((t) => t.enabled).length);

// ---- 概览内嵌服务控制台（Dockge 风：一行服务 + 行内日志） ----
const runningScripts = computed(() => props.project.scripts.filter((s) => s.persistent));
function isRunning(s) { return !!store.procHandles[s.id]?.running; }
async function toggle(s) {
  if (isRunning(s)) { await stopScript(s); toast(`已停止「${s.name}」`, 'ok'); }
  else { startScript(props.project, s); toast(`已启动「${s.name}」`, 'ok'); }
}
const logOf = (s) => {
  const h = store.procHandles[s.id];
  return h ? (store.procLogs[h.id] || '').slice(-600) : '';
};
const portsOf = computed(() => projectPorts(props.project));
function openPort(p) { window.pilot.openInBrowser(`http://localhost:${p.port}`); }

// ---- 外部检测到的项目服务（VSCode / 终端启动，非内部脚本） ----
const externalServices = computed(() => {
  const all = projectServices(props.project);
  return all.filter((s) => !s.isInternal && s.port);
});
async function killExternal(s) {
  if (!s.pid) return;
  try {
    const r = await window.pilot.killPid(s.pid);
    if (r && r.ok === false) { toast(`结束失败：${r.error || '未知错误'}`, 'err'); return; }
    toast(`已结束「${s.service || s.name}」进程`, 'ok');
  } catch (e) { toast(`结束失败：${e.message || e}`, 'err'); }
  try { store.sys.ports = await window.pilot.sys.ports(); } catch (e) { /* 保留旧列表 */ }
}

function runScript(script) {
  startScript(props.project, script);
  toast(`已启动「${script.name}」`, 'ok');
}
const openPath = (p) => window.pilot.openPath(p);
const openTerminal = (p) => window.pilot.openTerminal(p);
function toGit() { store.detailTab = 'git'; }
</script>

<template>
  <div class="ov-grid">
    <section class="glass panel stat-panel">
      <h4 class="panel-title">项目状态</h4>
      <div class="stat-grid">
        <div class="stat"><b :class="status?.dirty ? 'warn-text' : 'ok-text'">{{ status ? status.dirty : '—' }}</b><span>未提交变更</span></div>
        <div class="stat"><b>{{ status ? (status.branch || 'HEAD') : '—' }}</b>
          <span>当前分支{{ status && (status.ahead || status.behind) ? ` · ↑${status.ahead} ↓${status.behind}` : '' }}</span></div>
        <div class="stat"><b>{{ project.scripts.length }}</b><span>脚本</span></div>
        <div class="stat"><b>{{ tasksOn }}/{{ (project.tasks || []).length }}</b><span>自动任务</span></div>
      </div>
      <div class="ov-actions">
        <button class="btn btn-ghost" @click="openPath(project.path)"><Icon name="FolderOpen" :size="13" /> 打开文件夹</button>
        <button class="btn btn-ghost" @click="openTerminal(project.path)"><Icon name="Terminal" :size="13" /> 终端</button>
        <button class="btn btn-ghost" @click="toGit"><Icon name="GitBranch" :size="13" /> 查看 Git</button>
      </div>
    </section>

    <section v-if="runningScripts.length || externalServices.length" class="glass panel svc-panel">
      <h4 class="panel-title"><Icon name="Zap" :size="14" /> 服务
        <span v-if="portsOf.length" class="mini-tag svc mono clickable-svc" title="点击打开">{{ portsOf.map((p) => ':' + p.port).join(' ') }}</span>
      </h4>
      <div class="svc-rows">
        <div v-for="s in runningScripts" :key="s.id" class="svc-row" :class="{ on: isRunning(s) }">
          <div class="svc-head">
            <span class="svc-led" :class="isRunning(s) ? 'on' : ''"></span>
            <span class="svc-name">{{ s.name }}</span>
            <span class="mono svc-cmd" :title="s.cmd">{{ s.cmd }}</span>
            <span class="spacer"></span>
            <span v-if="isRunning(s)" class="mini-tag svc">运行中</span>
            <button class="btn sm" :class="isRunning(s) ? 'btn-danger' : 'btn-primary'" @click="toggle(s)"><Icon :name="isRunning(s) ? 'Square' : 'Play'" :size="11" /> {{ isRunning(s) ? '停止' : '启动' }}</button>
          </div>
          <pre v-if="isRunning(s) && logOf(s)" class="svc-log">{{ logOf(s) }}</pre>
        </div>

        <!-- 外部启动（VSCode / 终端）检测到的服务 -->
        <div v-for="s in externalServices" :key="'ext-' + s.port" class="svc-row on">
          <div class="svc-head">
            <span class="svc-led on"></span>
            <span class="svc-name">{{ s.service || s.name }}</span>
            <span class="mono svc-cmd" :title="s.cmd || '外部终端启动的进程'">{{ s.cmd || '外部终端启动的进程' }}</span>
            <span class="spacer"></span>
            <span v-if="s.mem" class="mini-tag mono" title="该服务进程内存占用">{{ fmtMem(s.mem) }}</span>
            <span class="mini-tag svc" title="外部启动，由系统 netstat 实时检测">外部</span>
            <span v-if="s.port" class="mini-tag mono svc">PID {{ s.pid || '—' }}</span>
            <button v-if="s.url" class="btn sm btn-ghost" @click="window.pilot.openInBrowser(s.url)"><Icon name="ExternalLink" :size="11" /> 打开</button>
            <button v-if="s.pid" class="btn sm btn-danger" @click="killExternal(s)"><Icon name="Square" :size="11" /> 结束</button>
          </div>
        </div>
      </div>
      <p class="hint">端口来自本机 netstat 实时关联；「外部」为在终端/IDE 里启动、由本插件自动探测关联的服务。</p>
    </section>

    <section class="glass panel">
      <h4 class="panel-title">最近提交</h4>
      <ul v-if="recentCommits.length" class="commit-mini">
        <li v-for="c in recentCommits" :key="c.hash">
          <span class="c-type" :class="commitType(c.subject)">{{ commitType(c.subject) }}</span>
          <span class="c-subj" :title="c.subject">{{ c.subject }}</span>
          <span class="c-time">{{ timeAgo(new Date(c.date).getTime()) }}</span>
        </li>
      </ul>
      <p v-else class="hint">暂无提交记录</p>
    </section>

    <section class="glass panel">
      <h4 class="panel-title">脚本快捷入口</h4>
      <div v-if="project.scripts.length" class="script-chips big">
        <button v-for="s in project.scripts" :key="s.id" class="script-chip" @click="runScript(s)">
          <i><Icon name="Play" :size="9" /></i>{{ s.name }}
        </button>
      </div>
      <p v-else class="hint">还没有脚本，去「脚本」标签添加常用命令。</p>
    </section>

    <section class="glass panel">
      <h4 class="panel-title">最近自动任务</h4>
      <ul v-if="runningTaskLogs.length" class="task-log-mini">
        <li v-for="(l, i) in runningTaskLogs" :key="i">
          <span :class="l.ok ? 'ok-text' : 'err-text'"><Icon :name="l.ok ? 'Check' : 'X'" :size="12" /></span>
          {{ l.task }} <span class="c-time">{{ timeAgo(l.time) }}</span>
        </li>
      </ul>
      <p v-else class="hint">暂无运行记录。自动任务可在「任务」标签配置。</p>
    </section>
  </div>
</template>
