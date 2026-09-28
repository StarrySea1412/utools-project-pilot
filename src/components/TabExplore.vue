<script setup>
// TabExplore.vue — 探索模式：AI 评估项目完成度 + 推荐下一步功能
import { ref, computed, onMounted } from 'vue';
import { store, saveExplore, today, addTodo } from '../store.js';
import { exploreAdvice, collectExploreContext, ruleScore, gradeOf } from '../explore.js';
import { toast, timeAgo } from '../ui.js';
import Icon from './Icon.vue';

const props = defineProps({ project: { type: Object, required: true } });

const busy = ref(false);
const stage = ref('idle'); // idle -> collecting -> analyzing -> done
const error = ref('');
const local = ref(null); // 本地规则评分（始终可得）
const hasAi = computed(() => {
  const { baseUrl, apiKey, model } = store.settings.ai || {};
  return !!(baseUrl && apiKey && model);
});

const cached = computed(() => store.explore[props.project.id]);
const cachedFresh = computed(() => cached.value?.date === today() ? cached.value : null);
const showRule = computed(() => cachedFresh.value || local.value);

const scoreColor = (s) => s >= 80 ? 'var(--ok)' : s >= 60 ? 'var(--accent)' : s >= 40 ? 'var(--warn)' : 'var(--err)';
const LV_LABEL = { 2: '强烈推荐', 1: '值得做', 0: '锦上添花' };

async function analyze() {
  if (busy.value) return;
  if (!hasAi.value) {
    // 无 AI：只做本地规则扫描
    busy.value = true; error.value = '';
    try {
      stage.value = 'collecting';
      const ctx = await collectExploreContext(props.project);
      local.value = ruleScore(ctx);
      stage.value = 'done';
      toast('已完成本地规则扫描，配置 AI 可获得深度评估', 'info');
    } catch (e) { error.value = e.message || String(e); stage.value = 'idle'; }
    busy.value = false;
    return;
  }
  busy.value = true; error.value = '';
  try {
    stage.value = 'collecting';
    stage.value = 'analyzing';
    const r = await exploreAdvice(props.project);
    local.value = { score: r.ruleScore, grade: r.ruleGrade, dims: r.ruleDims };
    saveExplore(props.project.id, {
      score: r.score, grade: r.grade, summary: r.summary,
      dims: r.dims, ideas: r.ideas, ruleScore: r.ruleScore, ruleGrade: r.ruleGrade,
    });
    stage.value = 'done';
    toast('探索分析完成', 'ai');
  } catch (e) { error.value = e.message || String(e); stage.value = 'idle'; }
  busy.value = false;
}

onMounted(() => { if (!cachedFresh.value) analyze(); });

// 推荐一键转待办：level 2→紧急象限、1→重要、0→以后，自动关联本项目
function toTodo(it) {
  const quad = it.level === 2 ? 0 : it.level === 1 ? 1 : 3;
  const t = addTodo(it.text, props.project.id, quad);
  if (t) toast(`已加入待办：${it.text.slice(0, 24)}${it.text.length > 24 ? '…' : ''}`, 'ok');
}
</script>

<template>
  <div class="explore-page">
    <!-- 头部：评分环 + 总评 -->
    <section v-if="showRule" class="glass panel ex-head">
      <div class="ex-ring-wrap">
        <svg viewBox="0 0 36 36" class="ex-ring" :style="{ '--pct': (showRule.score) }">
          <circle class="bg" cx="18" cy="18" r="15.9" pathLength="100" />
          <circle class="fg" cx="18" cy="18" r="15.9" pathLength="100"
                  :stroke="scoreColor(showRule.score)" :stroke-dasharray="`${showRule.score} 100`" />
        </svg>
        <div class="ex-ring-txt">
          <b :style="{ color: scoreColor(showRule.score) }">{{ showRule.score }}</b>
          <span>/100</span>
        </div>
      </div>
      <div class="ex-head-info">
        <div class="ex-grade-row">
          <h4 class="panel-title">项目完成度<span class="ex-grade" :style="{ color: scoreColor(showRule.score) }">{{ showRule.grade }}</span></h4>
          <span v-if="showRule === cachedFresh" class="mini-tag mono" :title="'分析于 ' + new Date(showRule.at).toLocaleString('zh-CN')">今日已分析 · {{ timeAgo(showRule.at) }}</span>
          <span v-else class="mini-tag">本地规则扫描</span>
        </div>
        <p class="ex-summary">{{ showRule.summary || '（AI 未给出总评）' }}</p>
        <div class="btn-row">
          <button class="btn ai-btn" :disabled="busy" @click="analyze">
            <Icon name="Sparkles" :size="13" /> {{ busy ? '分析中…' : (showRule === cachedFresh ? '重新分析' : (hasAi ? 'AI 深度分析' : '重新扫描')) }}
          </button>
        </div>
      </div>
    </section>

    <!-- 未分析的空态 -->
    <section v-if="!showRule && !busy" class="glass panel ex-empty">
      <div class="e-icon"><Icon name="Compass" :size="30" /></div>
      <div class="e-title">探索这个项目</div>
      <div class="e-sub">
        {{ hasAi ? 'AI 将读取项目结构、README 与提交历史，评估完成度并推荐下一步功能。' : '未配置 AI 服务，仅提供本地规则扫描（文档/测试/CI/活跃度）。配置 AI 后可获得深度功能推荐。' }}
      </div>
      <button class="btn ai-btn" @click="analyze"><Icon name="Sparkles" :size="13" /> {{ hasAi ? '开始探索' : '本地扫描' }}</button>
    </section>

    <!-- 加载态 -->
    <section v-if="busy" class="glass panel ex-loading">
      <div class="loading-panel">
        <template v-if="stage === 'collecting'">正在读取项目结构、README 与提交历史…</template>
        <template v-else-if="stage === 'analyzing'">AI 正在评估项目完成度与扩展方向…（约 10~30 秒）</template>
      </div>
    </section>

    <p v-if="error" class="hint err-text">{{ error }}<template v-if="!hasAi">（可在设置中配置 AI 服务）</template></p>

    <!-- 维度剖析 -->
    <section v-if="showRule?.dims?.length" class="glass panel">
      <h4 class="panel-title"><Icon name="ChartNoAxesColumn" :size="14" /> 维度剖析</h4>
      <div class="ex-dims">
        <div v-for="d in showRule.dims" :key="d.name" class="ex-dim">
          <span class="ex-dim-name" :title="d.note">{{ d.name }}</span>
          <div class="ex-dim-bar"><i :style="{ width: Math.min(100, d.score / 25 * 100) + '%', background: scoreColor(d.score / 25 * 100) }"></i></div>
          <span class="ex-dim-val mono">{{ d.score }}<template v-if="showRule.dims.length && showRule !== local">/25</template></span>
        </div>
      </div>
    </section>

    <!-- 功能扩展推荐 -->
    <section v-if="cachedFresh?.ideas?.length" class="glass panel">
      <h4 class="panel-title"><Icon name="Lightbulb" :size="14" /> 功能扩展推荐</h4>
      <div class="ex-ideas">
        <div v-for="it in cachedFresh.ideas" :key="it.id" class="ex-idea" :class="'lv' + it.level">
          <span class="ex-idea-lv">{{ LV_LABEL[it.level] }}</span>
          <div class="ex-idea-body">
            <p class="ex-idea-text">{{ it.text }}</p>
            <p v-if="it.why" class="ex-idea-why">{{ it.why }}</p>
          </div>
          <button class="btn sm btn-ghost ex-idea-todo" :title="'转待办（关联 ' + project.name + '）'"
                  @click="toTodo(it)"><Icon name="ListTodo" :size="12" /> 待办</button>
        </div>
      </div>
    </section>

    <!-- 规则对照（有 AI 结果时折叠展示） -->
    <section v-if="cachedFresh && local" class="glass panel ex-rule-panel">
      <h4 class="panel-title"><Icon name="Scale" :size="14" /> 本地规则对照
        <span class="mini-tag mono">规则 {{ local.score }} 分 · AI {{ cachedFresh.score }} 分</span>
      </h4>
      <div class="ex-rule-dims">
        <span v-for="d in local.dims" :key="d.name" class="mini-tag" :title="d.note">{{ d.name }} {{ d.score }}</span>
      </div>
      <p class="hint">规则扫描只看文件特征（README/测试目录/CI 配置/提交频率），AI 评估综合了源码结构与内容理解，两者互补。</p>
    </section>
  </div>
</template>
