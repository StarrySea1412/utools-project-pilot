<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, analyzeHistory } from '../store.js';
import { toast, openModal } from '../ui.js';
import ModeModal from '../modals/ModeModal.vue';

const props = defineProps({ project: { type: Object, required: true } });

const modes = computed(() => store.settings.analysisModes || []);
const cur = computed(() => store.insightMode || modes.value[0]?.id);
const n = ref(50);
const result = ref('');
const busy = ref(false);
const error = ref('');

const curMode = computed(() => modes.value.find((m) => m.id === cur.value));

async function run() {
  const mode = curMode.value;
  if (!mode) { toast('没有可用的分析模式', 'warn'); return; }
  busy.value = true; error.value = ''; result.value = '';
  try {
    const log = await window.pilot.git.log(props.project.path, n.value);
    if (!log.length) throw new Error('没有提交记录');
    result.value = await analyzeHistory(props.project, mode, log);
    toast('分析完成', 'ai');
  } catch (e) { error.value = String(e.message || e); }
  busy.value = false;
}
function copy() {
  window.pilot.copyText(result.value);
  toast('已复制', 'ok');
}
function addMode() { openModal(ModeModal, {}, { title: '自定义分析模式' }); }
function editMode() {
  if (curMode.value) openModal(ModeModal, { mode: curMode.value }, { title: '编辑分析模式' });
}
</script>

<template>
  <div class="insights-layout">
    <section class="glass panel insights-side">
      <h4 class="panel-title">分析模式</h4>
      <ul class="mode-list">
        <li v-for="m in modes" :key="m.id">
          <button class="mode-item" :class="{ sel: cur === m.id }" @click="store.insightMode = m.id">
            <span>{{ m.name }}</span>
            <span class="mini-tag" :class="{ svc: !m.builtin }">{{ m.builtin ? '内置' : '自定义' }}</span>
          </button>
        </li>
      </ul>
      <button class="btn btn-ghost full" @click="addMode">＋ 自定义模式</button>
      <button class="btn btn-ghost full" @click="editMode">✏️ 编辑当前模式</button>
    </section>
    <section class="glass panel insights-main">
      <div class="panel-head slim">
        <h4 class="panel-title">{{ curMode?.name || '分析' }}</h4>
        <div class="btn-row">
          <select v-model.number="n" class="select">
            <option :value="20">最近 20 条</option>
            <option :value="50">最近 50 条</option>
            <option :value="100">最近 100 条</option>
          </select>
          <button class="btn ai-btn" :disabled="busy" @click="run">✦ {{ busy ? '分析中…' : '开始分析' }}</button>
        </div>
      </div>
      <div class="insight-result">
        <div v-if="busy" class="loading-panel">AI 正在分析最近 {{ n }} 条提交…</div>
        <p v-else-if="error" class="hint pad err-text">{{ error }}</p>
        <div v-else-if="result" class="ai-result">
          <pre>{{ result }}</pre>
          <div class="btn-row"><button class="btn btn-ghost" @click="copy">复制</button></div>
        </div>
        <p v-else class="hint pad">选择模式后点击「开始分析」，AI 将读取提交记录并输出结果。</p>
      </div>
    </section>
  </div>
</template>
