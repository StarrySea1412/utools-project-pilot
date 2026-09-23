<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, projectPorts } from '../store.js';
import { projectIconStyle, timeAgo, shortPath } from '../ui.js';
import Icon from './Icon.vue';

const props = defineProps({ project: { type: Object, required: true } });
const emit = defineEmits(['open', 'menu', 'run']);

const cache = computed(() => store.gitCache[props.project.id] || {});
const status = computed(() => cache.value.status);
const anyRunning = computed(() => props.project.scripts.some((s) => s.persistent && store.procHandles[s.id]?.running));

const shownScripts = computed(() => props.project.scripts.slice(0, 2));
function chipRunning(s) { return s.persistent && store.procHandles[s.id]?.running; }

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

const openPath = (p) => window.pilot.openPath(p);
const openTerminal = (p) => window.pilot.openTerminal(p);
</script>

<template>
  <div class="proj-row" :class="{ 'row-running': anyRunning }" tabindex="0"
       @click="emit('open', project.id)" @keydown.enter="emit('open', project.id)">
    <div class="p-icon pr-icon" :style="projectIconStyle(project.color)">
      <img v-if="icon" :src="icon" alt="" class="p-icon-img">
      <template v-else>{{ (project.name || '?').charAt(0).toUpperCase() }}</template>
    </div>

    <div class="pr-name">
      <b :title="project.name">{{ project.name }}</b>
      <span v-if="anyRunning" class="run-dot" title="服务运行中"></span>
      <span v-if="framework" class="mini-tag mono fw-tag">{{ framework }}</span>
    </div>

    <div class="pr-git">
      <span v-if="cache.loading" class="pr-muted">检查中…</span>
      <span v-else-if="cache.notRepo" class="pr-muted">非 Git</span>
      <span v-else-if="cache.error" class="pr-err" :title="cache.error">Git 异常</span>
      <template v-else-if="status">
        <span class="pr-branch" :title="status.branch || 'HEAD'"><span class="branch-dot"></span>{{ status.branch || 'HEAD' }}</span>
        <span v-if="status.dirty" class="dirty-pill" :title="'未提交变更 ' + status.dirty + ' 个'">● {{ status.dirty }}</span>
        <span v-if="status.ahead" class="ab" title="领先远程">↑{{ status.ahead }}</span>
        <span v-if="status.behind" class="ab" title="落后远程">↓{{ status.behind }}</span>
      </template>
    </div>

    <div class="pr-svc">
      <span v-if="svc" class="mini-tag svc" :title="'服务运行中：' + svc.name"><Icon name="Zap" :size="10" /> {{ svc.name }}<template v-if="svc.port"> :{{ svc.port }}</template></span>
      <button v-for="s in shownScripts" :key="s.id" class="script-chip" :class="{ running: chipRunning(s) }"
              :title="s.cmd" @click.stop="emit('run', project, s)">
        <i><Icon :name="chipRunning(s) ? 'Square' : 'Play'" :size="9" /></i>{{ s.name }}
      </button>
    </div>

    <span class="pr-time" :title="project.path">{{ timeAgo(project.lastOpened || project.createdAt) }}</span>

    <div class="pr-actions" @click.stop>
      <button class="icon-btn sm" title="打开文件夹" @click="openPath(project.path)"><Icon name="FolderOpen" :size="13" /></button>
      <button class="icon-btn sm" title="打开终端" @click="openTerminal(project.path)"><Icon name="Terminal" :size="13" /></button>
      <button class="icon-btn sm" title="更多" @click="emit('menu', project, $event)"><Icon name="MoreHorizontal" :size="13" /></button>
    </div>
  </div>
</template>
