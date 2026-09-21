<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, projectPorts } from '../store.js';
import { projectIconStyle, timeAgo, shortPath } from '../ui.js';

const props = defineProps({ project: { type: Object, required: true } });
const emit = defineEmits(['open', 'menu', 'run']);

const cache = computed(() => store.gitCache[props.project.id] || {});
const status = computed(() => cache.value.status);
const anyRunning = computed(() => props.project.scripts.some((s) => s.persistent && store.procHandles[s.id]?.running));
const hasTasks = computed(() => (props.project.tasks || []).some((t) => t.enabled));

const shownScripts = computed(() => props.project.scripts.slice(0, 3));
const moreCount = computed(() => Math.max(0, props.project.scripts.length - 3));

function chipRunning(s) { return s.persistent && store.procHandles[s.id]?.running; }
const openPath = (p) => window.pilot.openPath(p);
const openTerminal = (p) => window.pilot.openTerminal(p);

// ---- 项目身份：真实 logo + 技术栈 + 运行服务 ----
const icon = ref('');
const framework = ref('');
onMounted(async () => {
  try {
    const id = await window.pilot.identify(props.project.path);
    icon.value = id.icon || '';
    framework.value = id.framework || '';
  } catch (e) { /* 识别失败用字母占位 */ }
});
const svc = computed(() => {
  const running = props.project.scripts.find((s) => chipRunning(s));
  if (!running) return null;
  const port = (projectPorts(props.project)[0] || {}).port;
  return { name: running.name, port };
});
</script>

<template>
  <article class="proj-card glass hover-lift" :class="{ 'card-running': anyRunning }"
           :data-id="project.id" tabindex="0"
           @click="emit('open', project.id)" @keydown.enter="emit('open', project.id)">
    <div class="card-top">
      <div class="p-icon" :style="{ ...projectIconStyle(project.color), width: '42px', height: '42px', fontSize: '19px' }">
        <img v-if="icon" :src="icon" alt="" class="p-icon-img">
        <template v-else>{{ (project.name || '?').charAt(0).toUpperCase() }}</template>
      </div>
      <div class="card-title">
        <h3 :title="project.name">{{ project.name }}<span v-if="anyRunning" class="run-dot" title="服务运行中"></span></h3>
        <p class="p-path" :title="project.path">{{ shortPath(project.path) }}</p>
      </div>
      <button class="icon-btn card-menu" @click.stop="emit('menu', project, $event)">⋯</button>
    </div>

    <div class="card-git">
      <span v-if="cache.loading" class="git-badge muted">正在检查 Git…</span>
      <span v-else-if="cache.notRepo" class="git-badge muted">非 Git 仓库</span>
      <span v-else-if="cache.error" class="git-badge err" :title="cache.error">Git 异常</span>
      <span v-else-if="status" class="git-badge">
        <span class="branch-dot"></span><span class="b-name">{{ status.branch || 'HEAD' }}</span>
        <span v-if="status.dirty" class="dirty-pill" :title="'未提交变更 ' + status.dirty + ' 个'">● {{ status.dirty }}</span>
        <span v-if="status.ahead" class="ab" title="领先远程">↑{{ status.ahead }}</span>
        <span v-if="status.behind" class="ab" title="落后远程">↓{{ status.behind }}</span>
      </span>
      <span v-if="svc" class="mini-tag svc" :title="'服务运行中：' + svc.name">⚡ {{ svc.name }}<template v-if="svc.port"> :{{ svc.port }}</template></span>
      <span v-if="framework" class="mini-tag mono fw-tag">{{ framework }}</span>
    </div>

    <div v-if="project.scripts.length" class="script-chips">
      <button v-for="s in shownScripts" :key="s.id" class="script-chip" :class="{ running: chipRunning(s) }"
              :title="s.cmd" @click.stop="emit('run', project, s)">
        <i>{{ chipRunning(s) ? '■' : '▶' }}</i>{{ s.name }}
      </button>
      <button v-if="moreCount" class="script-chip more" @click.stop="emit('open', project.id)">+{{ moreCount }}</button>
    </div>

    <div v-if="(project.tags || []).length" class="card-tags">
      <span v-for="t in project.tags" :key="t" class="mini-tag">#{{ t }}</span>
    </div>

    <div class="card-foot">
      <span class="foot-time" :title="hasTasks ? '已启用自动任务' : ''">
        {{ hasTasks ? '⏱ ' : '' }}{{ timeAgo(project.lastOpened || project.createdAt) }}
      </span>
      <div class="card-actions">
        <button class="icon-btn" title="打开文件夹" @click.stop="openPath(project.path)">▸</button>
        <button class="icon-btn" title="打开终端" @click.stop="openTerminal(project.path)">⌨</button>
        <button class="icon-btn" title="进入管理" @click.stop="emit('open', project.id)">↗</button>
      </div>
    </div>
  </article>
</template>
