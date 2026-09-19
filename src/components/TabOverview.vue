<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, startScript } from '../store.js';
import { toast, timeAgo, commitType } from '../ui.js';

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
        <button class="btn btn-ghost" @click="openPath(project.path)">▸ 打开文件夹</button>
        <button class="btn btn-ghost" @click="openTerminal(project.path)">⌨ 终端</button>
        <button class="btn btn-ghost" @click="toGit">⑂ 查看 Git</button>
      </div>
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
          <i>▶</i>{{ s.name }}
        </button>
      </div>
      <p v-else class="hint">还没有脚本，去「脚本」标签添加常用命令。</p>
    </section>

    <section class="glass panel">
      <h4 class="panel-title">最近自动任务</h4>
      <ul v-if="runningTaskLogs.length" class="task-log-mini">
        <li v-for="(l, i) in runningTaskLogs" :key="i">
          <span :class="l.ok ? 'ok-text' : 'err-text'">{{ l.ok ? '✓' : '✕' }}</span>
          {{ l.task }} <span class="c-time">{{ timeAgo(l.time) }}</span>
        </li>
      </ul>
      <p v-else class="hint">暂无运行记录。自动任务可在「任务」标签配置。</p>
    </section>
  </div>
</template>
