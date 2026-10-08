<script setup>
// TabDoctor.vue — 项目体检：工程卫生评分 + 结构化改进项
// 数据源：preload/inspect.cjs 硬采集；AI 可选深度报告，默认离线规则兜底。
import { ref, computed, onMounted } from 'vue';
import { store, today, runDoctor } from '../store.js';
import { toast, timeAgo } from '../ui.js';
import { gradeOf, SEV_LABEL } from '../doctor.js';
import Icon from './Icon.vue';

const props = defineProps({ project: { type: Object, required: true } });

const busy = ref(false);
const stage = ref('idle'); // idle -> collecting -> analyzing -> done
const error = ref('');

const cached = computed(() => store.doctor[props.project.id]);
const fresh = computed(() => cached.value?.date === today() ? cached.value : null);
const report = computed(() => fresh.value || null);
const hasAi = computed(() => {
  const s = store.settings.ai || {};
  return !!(s.baseUrl && s.apiKey && s.model);
});

const scoreColor = (s) => s >= 80 ? 'var(--ok)' : s >= 60 ? 'var(--accent)' : s >= 40 ? 'var(--warn)' : 'var(--err)';

async function run(force = false) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try {
    stage.value = 'collecting';
    if (hasAi.value) stage.value = 'analyzing';
    const r = await runDoctor(props.project, { withAi: hasAi.value });
    stage.value = 'done';
    toast(hasAi.value ? 'AI 体检完成' : '规则体检完成' + (force ? '（AI 不可用）' : ''), 'ok');
  } catch (e) { error.value = e.message || String(e); stage.value = 'idle'; }
  busy.value = false;
}

onMounted(() => { if (!fresh.value) run(); });

const AREA_LABEL = { deps: '依赖', todos: '代码债', tests: '测试', docs: '文档', git: 'Git', general: '通用' };
</script>

<template>
  <div class="explore-page">
    <!-- 头部：健康分环 + 总评 -->
    <section v-if="report" class="glass panel ex-head">
      <div class="ex-ring-wrap">
        <svg viewBox="0 0 36 36" class="ex-ring" :style="{ '--pct': report.score }">
          <circle class="bg" cx="18" cy="18" r="15.9" pathLength="100" />
          <circle class="fg" cx="18" cy="18" r="15.9" pathLength="100"
                  :stroke="scoreColor(report.score)" :stroke-dasharray="`${report.score} 100`" />
        </svg>
        <div class="ex-ring-txt">
          <b :style="{ color: scoreColor(report.score) }">{{ report.score }}</b>
          <span>/100</span>
        </div>
      </div>
      <div class="ex-head-info">
        <div class="ex-grade-row">
          <h4 class="panel-title">项目健康<span class="ex-grade" :style="{ color: scoreColor(report.score) }">{{ report.grade }}</span></h4>
          <span v-if="fresh" class="mini-tag mono" :title="'分析于 ' + new Date(fresh.at).toLocaleString('zh-CN')">今日体检 · {{ timeAgo(fresh.at) }}</span>
          <span v-else class="mini-tag">离线规则</span>
        </div>
        <p class="ex-summary">{{ report.summary || '（无总评）' }}</p>
        <div class="btn-row">
          <button class="btn ai-btn" :disabled="busy" @click="run(true)">
            <Icon name="Sparkles" :size="13" /> {{ busy ? '体检中…' : (hasAi ? '重新体检' : '规则体检') }}
          </button>
          <span v-if="!hasAi" class="hint">未配置 AI，当前为本地规则结果；启用 AI 可得深度建议</span>
        </div>
      </div>
    </section>

    <!-- 空态：未体检 -->
    <section v-if="!report && !busy" class="glass panel ex-empty">
      <div class="e-icon"><Icon name="Stethoscope" :size="30" /></div>
      <div class="e-title">给项目做个体检</div>
      <div class="e-sub">
        自动扫描依赖漏洞 / 过期包 / TODO 债 / 文档与测试覆盖 / Git 卫生。
        {{ hasAi ? 'AI 会基于采集数据输出优先级排序的改进清单。' : '未配置 AI 时提供本地规则评分与清单。' }}
      </div>
      <button class="btn ai-btn" @click="run()"><Icon name="Sparkles" :size="13" /> 开始体检</button>
    </section>

    <!-- 加载态 -->
    <section v-if="busy" class="glass panel ex-loading">
      <div class="loading-panel">
        <template v-if="stage === 'collecting'">正在扫描依赖漏洞 / TODO / 文档 / 测试与 Git 卫生…</template>
        <template v-else-if="stage === 'analyzing'">AI 正在给出优先级建议…（通常 10~30 秒）</template>
      </div>
    </section>

    <p v-if="error" class="hint err-text">{{ error }}<template v-if="!hasAi">（可在设置中配置 AI 服务）</template></p>

    <!-- 维度剖析 -->
    <section v-if="report?.dims?.length" class="glass panel">
      <h4 class="panel-title"><Icon name="ChartNoAxesColumn" :size="14" /> 体检维度</h4>
      <div class="ex-dims">
        <div v-for="d in report.dims" :key="d.name" class="ex-dim">
          <span class="ex-dim-name" :title="d.note">{{ d.name }}</span>
          <div class="ex-dim-bar"><i :style="{ width: Math.min(100, d.score / 25 * 100) + '%', background: scoreColor(d.score / 25 * 100) }"></i></div>
          <span class="ex-dim-val mono">{{ d.score }}/25</span>
        </div>
      </div>
    </section>

    <!-- 改进项清单 -->
    <section v-if="report?.items?.length" class="glass panel">
      <h4 class="panel-title"><Icon name="ListChecks" :size="14" /> 改进项 <span class="mini-tag mono">{{ report.items.length }} 条</span></h4>
      <div class="ex-ideas">
        <div v-for="it in report.items" :key="it.id || it.title" class="ex-idea dr-item" :class="'lv' + it.severity">
          <span class="ex-idea-lv" :title="AREA_LABEL[it.area] || '通用'">{{ SEV_LABEL[it.severity] }}</span>
          <div class="ex-idea-body">
            <p class="ex-idea-text">{{ it.title }}<span class="dr-effort mono">{{ it.effort }}</span></p>
            <p v-if="it.detail" class="ex-idea-why">{{ it.detail }}</p>
            <p v-if="it.reason" class="dr-why">{{ it.reason }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 采样备注（AI/规则不一致或采集缺项时给出） -->
    <section v-if="report?.notes && report.notes.length" class="glass panel">
      <h4 class="panel-title"><Icon name="Info" :size="13" /> 采集备注</h4>
      <ul class="dr-notes"><li v-for="(n, i) in report.notes" :key="i" class="hint">{{ n }}</li></ul>
    </section>
  </div>
</template>
