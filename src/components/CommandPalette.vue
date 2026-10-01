<script setup>
// CommandPalette.vue — Ctrl+K 命令面板：项目 / 脚本 / 导航 / 设置 模糊搜索
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { store, saveProjects, startScript, refreshAllGit, activeProjects } from '../store.js';
import { toast, openModal, closeModal, applyTheme } from '../ui.js';
import { buildOpenCommand } from '../editors.js';
import Icon from './Icon.vue';
import AddProjectModal from '../modals/AddProjectModal.vue';
import SettingsModal from '../modals/SettingsModal.vue';
import AllChanges from './AllChanges.vue';
import WeeklyReport from './WeeklyReport.vue';

const emit = defineEmits(['open-detail', 'close']);

const q = ref('');
const sel = ref(0);
const inputEl = ref(null);
const listEl = ref(null);

// ---------- 命令源 ----------
const NAV_CMDS = [
  { id: 'nav:dashboard', icon: 'LayoutGrid', label: '返回仪表盘', hint: '导航', run: () => { store.view = 'dashboard'; store.activeProjectId = null; refreshAllGit(); } },
  { id: 'nav:allchanges', icon: 'GitBranch', label: '全部项目的未提交变更', hint: '导航', run: () => openModal(AllChanges, {}, { title: '全部项目的未提交变更', wide: true }) },
  { id: 'nav:archive', icon: 'Inbox', label: '归档管理（设置）', hint: '导航', run: () => openModal(SettingsModal, {}, { title: '设置', wide: true }) },
  { id: 'nav:weekly', icon: 'ScrollText', label: 'AI 周报（近 7 天）', hint: '导航', run: () => openModal(WeeklyReport, {}, { title: 'AI 周报（全部项目 · 近 7 天）', wide: true }) },
  { id: 'nav:workpanel', icon: 'Compass', label: '展开/收起工作台', hint: '导航', run: () => { store.workOpen = !store.workOpen; } },
  { id: 'nav:theme', icon: 'SunMoon', label: '切换深浅主题', hint: '设置', run: () => { const cur = document.documentElement.dataset.theme; store.settings.theme = cur === 'dark' ? 'light' : 'dark'; saveSettingsQuiet(); applyTheme(); } },
  { id: 'nav:add', icon: 'Plus', label: '添加项目', hint: '操作', run: () => openModal(AddProjectModal, {}, { title: '添加项目' }) },
  { id: 'nav:settings', icon: 'Settings', label: '设置', hint: '设置', run: () => openModal(SettingsModal, {}, { title: '设置', wide: true }) },
  { id: 'nav:refresh', icon: 'RefreshCw', label: '刷新全部 Git 状态', hint: '操作', run: async () => { toast('正在刷新…', 'info'); await refreshAllGit(true); toast('已刷新', 'ok'); } },
];
function saveSettingsQuiet() { import('../store.js').then((m) => m.saveSettings()); }

// 项目与脚本命令在计算时按 store 生成
let editorCache = '';
function openInEditor(p) {
  const tpl = (store.settings.editorCmd || '').trim();
  if (tpl) {
    const cmd = buildOpenCommand(tpl, p.path);
    if (cmd) { window.pilot.openWithEditor(cmd); toast('已在编辑器中打开', 'ok'); return; }
  }
  if (!editorCache) {
    editorCache = window.pilot.hasInPath?.('code', true) ? 'code {path}' : '';
    if (!editorCache) { toast('未检测到编辑器，请在设置中配置「编辑器命令」', 'warn'); return; }
  }
  const cmd = buildOpenCommand(editorCache, p.path);
  if (cmd) { window.pilot.openWithEditor(cmd); toast('已在 VS Code 中打开', 'ok'); }
}
function buildCommands() {
  const out = [];
  for (const p of activeProjects()) {
    out.push({
      id: 'proj:' + p.id, icon: 'Folder', label: p.name, hint: '项目 · ' + (p.tags?.[0] || '打开'),
      run: () => { emit('open-detail', p.id); },
    });
    out.push({
      id: 'editor:' + p.id, icon: 'ExternalLink', label: `用编辑器打开：${p.name}`, hint: '编辑器',
      run: () => { openInEditor(p); },
    });
    out.push({
      id: 'explore:' + p.id, icon: 'Compass', label: `探索：${p.name}`, hint: 'AI 完成度评估 · 功能推荐',
      run: () => { store.detailTab = 'explore'; emit('open-detail', p.id); },
    });
    for (const s of p.scripts || []) {
      out.push({
        id: `run:${p.id}:${s.id}`, icon: s.persistent ? 'Zap' : 'Play', label: `${s.name}（${p.name}）`,
        hint: '运行脚本' + (s.persistent ? ' · 服务' : ''), run: () => { startScript(p, s); toast(`已启动 ${s.name}`, 'ok'); },
      });
    }
  }
  return out;
}

// 简易模糊匹配：所有字符按序出现即可，连续匹配加分
function fuzzyScore(text, qstr) {
  if (!qstr) return 1;
  const t = text.toLowerCase(), q2 = qstr.toLowerCase();
  let ti = 0, score = 0, streak = 0;
  for (const ch of q2) {
    const idx = t.indexOf(ch, ti);
    if (idx < 0) return -1;
    score += (idx === ti) ? ++streak * 2 : (streak = 1, 1);
    ti = idx + 1;
  }
  return score + Math.max(0, 20 - text.length); // 短名字加分
}

const results = computed(() => {
  const cmds = [...buildCommands(), ...NAV_CMDS];
  if (!q.value.trim()) return cmds.slice(0, 12);
  const scored = cmds
    .map((c) => ({ c, s: Math.max(fuzzyScore(c.label, q.value), fuzzyScore(c.hint, q.value)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
  return scored.slice(0, 14);
});

watch(q, () => { sel.value = 0; });

function pick(i) {
  const c = results.value[i];
  if (!c) return;
  close();
  c.run();
}
function close() { emit('close'); }

function onKeydown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel.value = Math.min(sel.value + 1, results.value.length - 1); scrollSel(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel.value = Math.max(sel.value - 1, 0); scrollSel(); }
  else if (e.key === 'Enter') { e.preventDefault(); pick(sel.value); }
  else if (e.key === 'Escape') { e.preventDefault(); close(); }
}
function scrollSel() {
  nextTick(() => {
    const el = listEl.value?.querySelector(`.cmd-row:nth-child(${sel.value + 1})`);
    el?.scrollIntoView({ block: 'nearest' });
  });
}

function onInputKeydown(e) { onKeydown(e); }
onMounted(() => { inputEl.value?.focus(); document.addEventListener('keydown', onKeydown, true); });
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true));
</script>

<template>
  <div class="modal-mask open cmdk-mask" @click.self="close">
    <div class="cmdk glass-strong">
      <div class="cmdk-input-row">
        <Icon name="Search" :size="15" />
        <input ref="inputEl" v-model="q" class="cmdk-input" placeholder="搜索项目 / 脚本 / 命令…（↑↓ 选择，Enter 执行）"
               @keydown="onInputKeydown">
        <span class="hint">Esc 关闭</span>
      </div>
      <div ref="listEl" class="cmdk-list">
        <div v-for="(c, i) in results" :key="c.id" class="cmd-row" :class="{ sel: i === sel }"
             @click="pick(i)" @mousemove="sel = i">
          <span class="sug-ico"><Icon :name="c.icon" :size="13" /></span>
          <span class="cmd-label">{{ c.label }}</span>
          <span class="spacer"></span>
          <span class="cmd-hint">{{ c.hint }}</span>
        </div>
        <p v-if="!results.length" class="hint pad">没有匹配的命令</p>
      </div>
    </div>
  </div>
</template>
