<script setup>
import { computed, ref } from 'vue';
import { store, activeProject, saveProjects } from '../store.js';
import { toast, openModal, applyTheme } from '../ui.js';
import { buildSuggestions, aiSuggestions } from '../advisor.js';

const emit = defineEmits(['open-detail']);

const list = computed(() => buildSuggestions());
const urgent = computed(() => list.value.filter((s) => s.level === 2).length);
const aiBusy = ref(false);
const aiText = ref('');

function act(s) {
  const a = s.action;
  if (!a || a.type === 'none') return;
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
  aiText.value = '';
  try { aiText.value = await aiSuggestions(); toast('AI 建议已生成', 'ai'); }
  catch (e) { toast('AI 建议失败：' + e.message, 'err'); }
  aiBusy.value = false;
}
</script>

<template>
  <section class="sug-panel glass">
    <div class="sug-head" @click="store.suggestionsOpen = !store.suggestionsOpen">
      <h4 class="panel-title">🛰 领航建议</h4>
      <span class="panel-en">MISSION BRIEF</span>
      <span v-if="urgent" class="tab-badge">{{ urgent }} 项紧急</span>
      <span v-else class="hint">{{ list.length }} 条</span>
      <span class="spacer"></span>
      <button class="btn ai-btn sm" :disabled="aiBusy" @click.stop="runAi">✦ {{ aiBusy ? '思考中…' : 'AI 今日建议' }}</button>
      <button class="icon-btn" @click.stop="store.suggestionsOpen = !store.suggestionsOpen">{{ store.suggestionsOpen ? '⌄' : '⌃' }}</button>
    </div>
    <div v-if="store.suggestionsOpen" class="sug-list">
      <div v-for="(s, i) in list" :key="s.id" class="sug-row" :class="'lv' + s.level">
        <span class="sug-idx">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="sug-ico">{{ s.icon }}</span>
        <span class="sug-text">{{ s.text }}</span>
        <span v-if="s.sub" class="sug-sub">{{ s.sub }}</span>
        <span class="spacer"></span>
        <button v-if="s.action?.type !== 'none'" class="btn btn-ghost sm" @click="act(s)">{{ actionText(s) }}</button>
      </div>
      <div v-if="aiText" class="ai-result sug-ai"><pre>{{ aiText }}</pre></div>
    </div>
  </section>
</template>
