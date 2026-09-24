<script setup>
import { computed, ref } from 'vue';
import { store, saveProjects, saveAiAdvice, checkGit, refreshAllGit } from '../store.js';
import { toast, timeAgo, confirmBox } from '../ui.js';
import { buildSuggestions, aiAdvice } from '../advisor.js';
import Icon from './Icon.vue';

const emit = defineEmits(['open-detail']);

const list = computed(() => buildSuggestions());
const urgent = computed(() => list.value.filter((s) => s.level === 2).length);
const advice = computed(() => store.aiAdvice);
const hasAdvice = computed(() => !!advice.value.items?.length);
const aiBusy = ref(false);

// 执行中的一键操作 id 集合（按钮转圈、防连点）
const busyIds = ref(new Set());
const isBusy = (s) => busyIds.value.has(s.id);

// 建议动作直达：pull/push 直接执行 git 操作，完成后刷新态势（建议随之消失）
async function runGitAction(s, op) {
  const proj = store.projects.find((p) => p.id === s.projectId);
  if (!proj) return;
  busyIds.value.add(s.id);
  toast(op === 'pull' ? '拉取中…' : '推送中…', 'info');
  try {
    if (op === 'pull') await window.pilot.git.pull(proj.path);
    else await window.pilot.git.push(proj.path);
    toast(op === 'pull' ? `「${proj.name}」已拉取` : `「${proj.name}」已推送`, 'ok');
    await Promise.all([checkGit(proj, true), import('../store.js').then((m) => m.refreshAllGit(true))]);
  } catch (e) { toast('操作失败：' + (e.message || e), 'err'); }
  busyIds.value.delete(s.id);
}

function act(s) {
  const a = s.action;
  if (!a || a.type === 'none') return;
  if (a.type === 'pull' || a.type === 'push') {
    const op = a.type;
    confirmBox(op === 'pull' ? '拉取远程' : '推送到远程',
      `对「${store.projects.find((p) => p.id === s.projectId)?.name || ''}」执行 ${op === 'pull' ? 'git pull（不使用 rebase）' : 'git push'}？`,
      () => runGitAction(s, op), { danger: op === 'push', okText: op === 'pull' ? '拉取' : '推送' });
    return;
  }
  if (a.type === 'git' || a.type === 'tasks' || a.type === 'detail') {
    store.activeProjectId = s.projectId;
    store.view = 'detail';
    store.fileCwd = null;
    store.detailTab = a.type === 'git' ? 'git' : a.type === 'tasks' ? 'tasks' : 'overview';
    store.gitSubTab = 'changes';
    import('../store.js').then((m) => m.saveProjects());
    emit('open-detail', s.projectId);
  } else if (a.type === 'open') {
    window.pilot.openInBrowser(a.url);
  }
}
const actionText = (s) => s.actionText || (s.action?.type === 'git' ? '去处理' : s.action?.type === 'tasks' ? '看日志' : s.action?.type === 'open' ? '打开' : '查看');

async function runAi() {
  aiBusy.value = true;
  try {
    const r = await aiAdvice();
    if (!r.items.length) throw new Error('AI 没有给出有效建议，请重试');
    saveAiAdvice(r);
    toast('AI 建议已生成', 'ai');
  } catch (e) { toast('AI 建议失败：' + e.message, 'err'); }
  aiBusy.value = false;
}
</script>

<template>
  <div class="sug-tools">
    <span class="hint">{{ list.length }} 条建议<template v-if="urgent">，{{ urgent }} 项紧急</template></span>
    <span class="spacer"></span>
    <button class="btn ai-btn sm" :disabled="aiBusy" @click="runAi">
      <Icon name="Sparkles" :size="12" /> {{ aiBusy ? '分析中…' : (hasAdvice ? '重新分析' : 'AI 今日建议') }}
    </button>
  </div>

  <div v-for="s in list" :key="s.id" class="sug-row" :class="'lv' + s.level">
    <span class="sug-ico" :class="'lv' + s.level"><Icon :name="s.icon" :size="12" /></span>
    <span class="sug-text">{{ s.text }}</span>
    <span v-if="s.sub" class="sug-sub">{{ s.sub }}</span>
    <span class="spacer"></span>
    <button v-if="s.action?.type !== 'none'" class="btn btn-ghost sm" :disabled="isBusy(s)" @click="act(s)">{{ isBusy(s) ? '执行中…' : actionText(s) }}</button>
  </div>
  <p v-if="!list.length" class="hint" style="padding: 4px 10px">一切正常，没有需要处理的事。</p>

  <!-- AI 今日建议：持久化的结构化清单，每条可执行 -->
  <div v-if="hasAdvice" class="ai-block">
    <div class="ai-head">
      <Icon name="Sparkles" :size="12" />
      <span class="ai-summary">{{ advice.summary || '今日建议' }}</span>
      <span class="spacer"></span>
      <span class="hint">{{ timeAgo(advice.at) }}生成</span>
    </div>
    <div v-for="s in advice.items" :key="s.id" class="sug-row ai-row" :class="'lv' + s.level">
      <span class="sug-ico" :class="'lv' + s.level"><Icon :name="s.icon" :size="12" /></span>
      <span class="sug-text">{{ s.text }}</span>
      <span v-if="s.sub" class="sug-sub">{{ s.sub }}</span>
      <span class="spacer"></span>
      <button v-if="s.action?.type !== 'none'" class="btn btn-ghost sm" :disabled="isBusy(s)" @click="act(s)">{{ isBusy(s) ? '执行中…' : actionText(s) }}</button>
    </div>
  </div>
</template>
