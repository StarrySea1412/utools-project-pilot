<script setup>
import { computed, ref, onMounted } from 'vue';
import { store } from '../store.js';
import { timeAgo, fmtDate, commitType, toast } from '../ui.js';
import { computeGraph, graphColor } from '../git-graph.js';

const props = defineProps({ project: { type: Object, required: true } });

const log = ref([]);
const refLabels = ref({}); // hash -> [分支/tag 标签]
const error = ref('');
const loading = ref(true);
const sel = computed({ get: () => store.selCommit, set: (v) => { store.selCommit = v; } });
const files = ref([]);
const detail = computed(() => log.value.find((c) => c.hash === sel.value));

// 行右键菜单（git graph 风：动作组）
const menu = ref(null); // { x, y, commit }
function openMenu(e, c) {
  menu.value = { x: e.clientX, y: e.clientY, commit: c };
}
function closeMenu() { menu.value = null; }
function copyHash(c) { window.pilot.copyText(c.hash); toast('已复制完整 hash', 'ok'); closeMenu(); }
function copySubject(c) { window.pilot.copyText(c.subject); toast('已复制提交主题', 'ok'); closeMenu(); }
async function checkoutCommit(c) {
  if (!confirm(`将仓库切到该提交（detached HEAD）？\n${c.short} ${c.subject}`)) return closeMenu();
  try { await window.pilot.git.checkout(props.project.path, c.hash); toast('已 checkout（detached）', 'ok'); }
  catch (e) { toast('checkout 失败：' + (e.message || e), 'err'); }
  closeMenu();
}

onMounted(async () => {
  try {
    log.value = await window.pilot.git.log(props.project.path, 60);
    try { refLabels.value = await window.pilot.git.commitBranches(props.project.path, 60) || {}; } catch (e) {}
  } catch (e) { error.value = String(e.message || e); }
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
  <div class="history-layout" @click="closeMenu">
    <aside class="glass panel history-panel">
      <ul v-if="!loading && !error" class="commit-list">
        <li v-for="(c, i) in log" :key="c.hash" class="commit-item" :class="{ sel: sel === c.hash }"
            @click="select(c)" @contextmenu.prevent="openMenu($event, c)">
          <svg class="g-svg" :width="graph.maxLanes * GW + 4" :height="ROW_H">
            <path v-for="t in graph.rows[i].tops" :key="'t' + t.t" class="g-edge"
              :d="seg(x(t.t), 0, t.merge ? x(graph.rows[i].lane) : x(t.t), CY)" :stroke="graphColor(t.t)" />
            <path v-for="(e, k) in graph.rows[i].edges" :key="'e' + k" class="g-edge"
              :d="seg(x(e.from), CY, x(e.to), ROW_H)" :stroke="graphColor(e.to)" />
            <circle :cx="x(graph.rows[i].lane)" :cy="CY" r="4.5" class="g-dot" :fill="graphColor(graph.rows[i].lane)" />
          </svg>
          <div class="c-main">
            <div class="c-line1">
              <span v-if="(refLabels[c.hash] || []).length" class="ref-tags">
                <span v-for="r in refLabels[c.hash]" :key="r" class="ref-tag" :class="{ head: r.includes('HEAD'), tag: r.startsWith('v') || r.startsWith('tag') }">{{ r }}</span>
              </span>
              <span class="c-type" :class="commitType(c.subject)">{{ commitType(c.subject) }}</span>
              <span class="c-subj" :title="c.subject">{{ c.subject }}</span>
            </div>
            <div class="c-meta">
              <code class="c-hash" title="点击复制完整 hash" @click.stop="copyHash(c)">{{ c.short }}</code>
              · {{ c.author }} · {{ timeAgo(new Date(c.date).getTime()) }}
            </div>
          </div>
        </li>
        <li v-if="!log.length" class="hint pad">暂无提交</li>
      </ul>
      <p v-else-if="error" class="hint pad">{{ error }}</p>
      <p v-else class="hint pad">读取提交历史…</p>
      <p class="hint" style="padding: 6px 10px">右键提交行有动作菜单</p>
    </aside>

    <!-- git graph 风行右键菜单 -->
    <Teleport to="body">
      <div v-if="menu" class="ctx-menu glass-strong" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
        <div class="ctx-title">{{ menu.commit.short }} · {{ menu.commit.subject.slice(0, 26) }}</div>
        <button @click="checkoutCommit(menu.commit)">⇱ Checkout 到此提交（detached）</button>
        <button @click="copyHash(menu.commit)">⧉ 复制完整 Hash</button>
        <button @click="copySubject(menu.commit)">⧉ 复制提交主题</button>
      </div>
    </Teleport>

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
