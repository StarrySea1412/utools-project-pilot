<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, analyzeHistory, ai, activeProjects } from '../store.js';
import { toast, openModal } from '../ui.js';
import { changelogPrompt, pickRange, formatForPrompt, parseChangelog, groupByType, filterForChangelog } from '../changelog.js';
import ModeModal from '../modals/ModeModal.vue';
import Icon from './Icon.vue';
import Select from './Select.vue';

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

// ---------- 活跃度热力图（近 26 周，GitHub 风） ----------
const WEEKS = 26;
const heat = ref(null); // { cols: [[{count, title, lv}×7]×26], total, max }
const heatLoading = ref(false);

// ---------- Changelog 生成（tag 区间 + AI） ----------
const clBusy = ref(false);
const clResult = ref('');
const clError = ref('');
const tags = ref([]);        // [{name, hash}] 新→旧
const clFrom = ref('');      // '' = 从头
const clTo = ref('');        // '' = 最新提交（未打 tag 时）
const clVersion = ref('');   // 生成的版本号标题（可选）
const clStats = ref(null);   // {total, groups: [{type,label,count}]}

const tagOptions = computed(() => [
  { value: '', label: '（从头开始）' },
  ...tags.value.map((t) => ({ value: t.name, label: t.name })),
]);
const toOptions = computed(() => [
  { value: '', label: '（最新提交）' },
  ...tags.value.map((t) => ({ value: t.name, label: t.name })),
]);

async function loadTags() {
  try { tags.value = await window.pilot.git.tags(props.project.path); }
  catch (e) { tags.value = []; }
}

// 无 AI 时的离线兜底：type 分组直接渲染
function offlineChangelog(commits) {
  const groups = groupByType(filterForChangelog(commits));
  const lines = [];
  for (const g of groups) {
    lines.push(`### ${g.label}`);
    for (const c of g.commits) lines.push(`- ${c.subject}`);
  }
  return lines.join('\n');
}

async function genChangelog() {
  clBusy.value = true; clError.value = ''; clResult.value = ''; clStats.value = null;
  try {
    const all = await window.pilot.git.log(props.project.path, 2000);
    const commits = pickRange(all, tags.value, { from: clFrom.value, to: clTo.value });
    if (!commits.length) throw new Error('该区间没有提交，换个范围试试');
    clStats.value = {
      total: commits.length,
      groups: groupByType(filterForChangelog(commits)).map((g) => ({ type: g.type, label: g.label, count: g.commits.length })),
    };
    const { sys, user } = changelogPrompt({ from: clFrom.value, to: clTo.value, version: clVersion.value.trim() });
    const list = formatForPrompt(commits);
    try {
      clResult.value = parseChangelog(await ai([
        { role: 'system', content: sys },
        { role: 'user', content: user + '\n\n提交记录：\n' + list },
      ]));
      toast('Changelog 已生成', 'ai');
    } catch (e) {
      // AI 未配置/失败：离线兜底（分组列表），错误也要给出
      clResult.value = offlineChangelog(commits);
      clError.value = `AI 生成不可用（${e.message}），已按类型分组输出`;
    }
  } catch (e) { clError.value = String(e.message || e); }
  clBusy.value = false;
}

function copyChangelog() {
  window.pilot.copyText(clResult.value);
  toast('已复制', 'ok');
}
function saveChangelog() {
  const name = `changelog-${clVersion.value.trim() || new Date().toISOString().slice(0, 10)}.md`;
  const file = window.pilot?.exportJson?.(name, clResult.value);
  if (file) toast('已保存到 ' + file, 'ok');
  else toast('当前环境不支持保存文件', 'err');
}

async function loadHeat() {
  heatLoading.value = true;
  try {
    const log = await window.pilot.git.log(props.project.path, 400);
    // 聚合到「天」：本地时区的 yyyy-mm-dd
    const byDay = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - (WEEKS * 7 - 1));
    for (const c of log) {
      const d = new Date(c.date); d.setHours(0, 0, 0, 0);
      if (d < start) continue;
      const k = d.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    // 列 = 周（周日起点，对齐 GitHub），行 = 星期
    const cols = [];
    let cur = new Date(start);
    // 对齐到周日
    cur.setDate(cur.getDate() - cur.getDay());
    while (cols.length < WEEKS + 1) {
      const col = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(cur); d.setDate(d.getDate() + dow);
        if (d > today || d < start) { col.push({ count: -1, lv: 0, title: '' }); continue; }
        const k = d.toISOString().slice(0, 10);
        const count = byDay.get(k) || 0;
        col.push({ count, lv: 0, title: `${d.toLocaleDateString('zh-CN')}：${count} 个提交` });
      }
      cols.push(col);
      cur.setDate(cur.getDate() + 7);
    }
    const max = Math.max(1, ...[...byDay.values()]);
    for (const col of cols) for (const cell of col) {
      if (cell.count <= 0) continue;
      cell.lv = cell.count >= max * 0.75 ? 4 : cell.count >= max * 0.5 ? 3 : cell.count >= max * 0.25 ? 2 : 1;
    }
    heat.value = { cols, total: [...byDay.values()].reduce((a, b) => a + b, 0), max };
  } catch (e) { heat.value = null; }
  heatLoading.value = false;
}
onMounted(() => { loadHeat(); loadTags(); });
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
      <button class="btn btn-ghost full" @click="addMode"><Icon name="Plus" :size="13" /> 自定义模式</button>
      <button class="btn btn-ghost full" @click="editMode"><Icon name="Pencil" :size="13" /> 编辑当前模式</button>
    </section>
    <section class="glass panel insights-main">
      <div class="panel-head slim">
        <h4 class="panel-title">{{ curMode?.name || '分析' }}</h4>
        <div class="btn-row">
          <Select v-model="n" :options="[{ value: 20, label: '最近 20 条' }, { value: 50, label: '最近 50 条' }, { value: 100, label: '最近 100 条' }]" />
          <button class="btn ai-btn" :disabled="busy" @click="run"><Icon name="Sparkles" :size="13" /> {{ busy ? '分析中…' : '开始分析' }}</button>
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

      <!-- Changelog 生成 -->
      <div class="cl-wrap">
        <div class="heat-head">
          <h4 class="panel-title"><Icon name="ScrollText" :size="13" /> Changelog</h4>
          <span v-if="clStats" class="hint">{{ clStats.total }} 个提交 · {{ clStats.groups.map((g) => `${g.label} ${g.count}`).join(' · ') }}</span>
        </div>
        <div class="cl-controls">
          <Select v-model="clFrom" :options="tagOptions" title="起始 tag（不含）" />
          <span class="hint">→</span>
          <Select v-model="clTo" :options="toOptions" title="截止 tag（含）" />
          <input v-model="clVersion" class="input mono" style="width: 130px" placeholder="版本号（可选，如 v1.12.0）">
          <button class="btn ai-btn" :disabled="clBusy" @click="genChangelog"><Icon name="Sparkles" :size="13" /> {{ clBusy ? '生成中…' : '生成' }}</button>
        </div>
        <p v-if="clError" class="hint err-text" style="margin: 6px 0 0">{{ clError }}</p>
        <div v-if="clResult" class="cl-result">
          <pre class="mono">{{ clResult }}</pre>
          <div class="btn-row">
            <button class="btn btn-ghost" @click="copyChangelog"><Icon name="Copy" :size="13" /> 复制</button>
            <button class="btn btn-ghost" @click="saveChangelog"><Icon name="Download" :size="13" /> 保存为 .md</button>
          </div>
        </div>
      </div>

      <!-- 活跃度热力图 -->
      <div v-if="heat" class="heat-wrap">
        <div class="heat-head">
          <h4 class="panel-title"><Icon name="Zap" :size="13" /> 近 26 周活跃度</h4>
          <span class="hint">共 {{ heat.total }} 个提交</span>
          <span class="heat-legend">
            少 <span class="heat-cell"></span><span class="heat-cell h1"></span><span class="heat-cell h2"></span><span class="heat-cell h3"></span><span class="heat-cell h4"></span> 多
          </span>
        </div>
        <div class="heat-grid">
          <div v-for="(col, ci) in heat.cols" :key="ci" class="heat-col">
            <span v-for="(cell, ri) in col" :key="ri" class="heat-cell"
                  :class="cell.count < 0 ? 'off' : 'h' + cell.lv" :title="cell.title"></span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
