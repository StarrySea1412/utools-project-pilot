<script setup>
import { computed, ref, onMounted } from 'vue';
import { store } from '../store.js';
import { timeAgo, fmtDate, commitType } from '../ui.js';
import { computeGraph, graphColor } from '../git-graph.js';

const props = defineProps({ project: { type: Object, required: true } });

const log = ref([]);
const error = ref('');
const loading = ref(true);
const sel = computed({ get: () => store.selCommit, set: (v) => { store.selCommit = v; } });
const files = ref([]);
const detail = computed(() => log.value.find((c) => c.hash === sel.value));

onMounted(async () => {
  try { log.value = await window.pilot.git.log(props.project.path, 60); }
  catch (e) { error.value = String(e.message || e); }
  loading.value = false;
});

async function select(c) {
  sel.value = c.hash;
  files.value = [];
  try { files.value = await window.pilot.git.commitFileNames(props.project.path, c.hash); }
  catch (e) { files.value = []; }
}

// ---- 拓扑图渲染 ----
const GW = 14, ROW_H = 48, CY = 24;
const graph = computed(() => computeGraph(log.value));
const x = (lane) => lane * GW + 8;
const seg = (x1, y1, x2, y2) => x1 === x2
  ? `M${x1},${y1} L${x2},${y2}`
  : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
</script>

<template>
  <div class="history-layout">
    <aside class="glass panel history-panel">
      <ul v-if="!loading && !error" class="commit-list">
        <li v-for="(c, i) in log" :key="c.hash" class="commit-item" :class="{ sel: sel === c.hash }" @click="select(c)">
          <svg class="g-svg" :width="graph.maxLanes * GW + 4" :height="ROW_H">
            <!-- 顶部入线：等待道纵向贯穿；收束道对角汇入 -->
            <path v-for="t in graph.rows[i].tops" :key="'t' + t.t" class="g-edge"
              :d="seg(x(t.t), 0, t.merge ? x(graph.rows[i].lane) : x(t.t), CY)" :stroke="graphColor(t.t)" />
            <!-- 底部出线：主干延续 / 分支展开 -->
            <path v-for="(e, k) in graph.rows[i].edges" :key="'e' + k" class="g-edge"
              :d="seg(x(e.from), CY, x(e.to), ROW_H)" :stroke="graphColor(e.to)" />
            <circle :cx="x(graph.rows[i].lane)" :cy="CY" r="4.5" class="g-dot" :fill="graphColor(graph.rows[i].lane)" />
          </svg>
          <div class="c-main">
            <div class="c-line1">
              <span class="c-type" :class="commitType(c.subject)">{{ commitType(c.subject) }}</span>
              <span class="c-subj" :title="c.subject">{{ c.subject }}</span>
            </div>
            <div class="c-meta">{{ c.short }} · {{ c.author }} · {{ timeAgo(new Date(c.date).getTime()) }}</div>
          </div>
        </li>
        <li v-if="!log.length" class="hint pad">暂无提交</li>
      </ul>
      <p v-else-if="error" class="hint pad">{{ error }}</p>
      <p v-else class="hint pad">读取提交历史…</p>
    </aside>

    <section class="glass panel commit-detail">
      <template v-if="detail">
        <div class="cd-head">
          <h4>{{ detail.subject }}</h4>
          <div class="cd-meta">{{ detail.author }} · {{ fmtDate(new Date(detail.date).getTime()) }} · <code>{{ detail.short }}</code></div>
        </div>
        <pre v-if="detail.body" class="cd-body">{{ detail.body }}</pre>
        <ul v-if="files.length" class="cd-file-list">
          <li v-for="f in files" :key="f.path"><span class="mini-tag">{{ f.ins }}</span><span :title="f.path">{{ f.path }}</span></li>
        </ul>
        <p v-else class="hint">读取变更文件…</p>
      </template>
      <p v-else class="hint pad">从左侧选择一个提交查看详情。</p>
    </section>
  </div>
</template>
