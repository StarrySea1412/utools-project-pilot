<script setup>
// AlgoPanel.vue — 刷题领航：今日推荐 / 连续打卡 / 分类进度 / 题库清单与笔记
// 纯逻辑在 store/algo.js（algoStreak / pickDaily / algoStats，有直测），这里只做呈现与动作。
import { computed, ref } from 'vue';
import { store, today, markDone, toggleRedo, setNote, setGoal, algoStreak, pickDaily, algoStats } from '../store.js';
import { BANK, CATEGORIES, catName, LEVELS, problemUrl } from '../algo/bank.js';
import Icon from './Icon.vue';

const d = today();
const picks = computed(() => pickDaily(BANK, store.algo.progress, store.algo.redo, d, store.algo.goal));
const streak = computed(() => algoStreak(store.algo.log, d));
const stats = computed(() => algoStats(store.algo.progress, BANK));
const todayDone = computed(() => store.algo.log[d] || 0);
const quotaMet = computed(() => todayDone.value >= store.algo.goal);

const filter = ref('todo'); // todo | redo | <categoryId>
const noteFor = ref('');
const noteDraft = ref('');
const pct = computed(() => Math.round((stats.value.done / stats.value.total) * 100));

const list = computed(() => {
  const prog = store.algo.progress;
  if (filter.value === 'todo') return BANK.filter((p) => !prog[p.slug]?.done);
  if (filter.value === 'redo') return BANK.filter((p) => store.algo.redo.includes(p.slug));
  if (filter.value === 'done') return BANK.filter((p) => prog[p.slug]?.done).sort((a, b) => (prog[b.slug].doneAt || 0) - (prog[a.slug].doneAt || 0));
  return BANK.filter((p) => p.c === filter.value);
});

const lvCls = (lv) => ['qb1', 'qb2', 'qb0'][lv]; // 复用四象限徽标配色：蓝=简单 琥珀=中等 红=困难
const open = (p) => window.pilot?.openInBrowser?.(problemUrl(p));
function startNote(p) {
  noteFor.value = p.slug;
  noteDraft.value = store.algo.progress[p.slug]?.note || '';
}
function saveNote() {
  if (noteFor.value) setNote(noteFor.value, noteDraft.value);
  noteFor.value = ''; noteDraft.value = '';
}
function goalOptions(n) { return [1, 2, 3, 4, 5].map((v) => ({ value: v, label: `每日 ${v} 题` })); }
</script>

<template>
  <!-- 今日推荐 -->
  <div class="algo-today">
    <div class="algo-head-row">
      <span class="panel-sub"><Icon name="Target" :size="12" /> 今日推荐 · {{ d }}</span>
      <span class="spacer"></span>
      <span class="mini-tag mono" :class="{ 'fw-tag': quotaMet }" :title="'今日完成 ' + todayDone + ' / ' + store.algo.goal">
        {{ todayDone }} / {{ store.algo.goal }}
      </span>
      <span class="mini-tag mono" :class="{ 'fw-tag algo-streak-on': streak > 0 }" :title="streak ? '连续打卡 ' + streak + ' 天，保持住' : '今天刷一道就开始连击'">
        <Icon name="Flame" :size="11" /> {{ streak }} 天
      </span>
    </div>
    <div v-for="p in picks" :key="p.slug" class="todo-row algo-pick">
      <button class="todo-check" :class="{ checked: store.algo.progress[p.slug]?.done }" title="标记完成/未做" @click="markDone(p.slug, !store.algo.progress[p.slug]?.done)">
        <Icon v-if="store.algo.progress[p.slug]?.done" name="Check" :size="9" />
      </button>
      <span class="todo-text" :title="p.t"><span class="algo-num">{{ p.n }}</span>{{ p.t }}</span>
      <span class="quad-badge" :class="lvCls(p.lv)">{{ LEVELS[p.lv] }}</span>
      <span class="mini-tag">{{ catName(p.c) }}</span>
      <span v-if="store.algo.redo.includes(p.slug)" class="mini-tag" title="重做队列">重做</span>
      <span class="spacer"></span>
      <button class="icon-btn sm" title="打开 LeetCode" @click="open(p)"><Icon name="ExternalLink" :size="12" /></button>
    </div>
    <div class="algo-head-row" style="padding: 2px 10px 6px">
      <span class="hint">{{ quotaMet ? '今日配额已完成，多刷一道都是赚的' : '完成推荐题自动计入连击' }}</span>
      <span class="spacer"></span>
      <button class="icon-btn sm" title="减少每日题量" @click="setGoal(store.algo.goal - 1)" :disabled="store.algo.goal <= 1">−</button>
      <span class="hint">每日 {{ store.algo.goal }} 题</span>
      <button class="icon-btn sm" title="增加每日题量" @click="setGoal(store.algo.goal + 1)" :disabled="store.algo.goal >= 5">＋</button>
    </div>
  </div>

  <!-- 分类进度 -->
  <div class="algo-bar" :title="'总进度 ' + stats.done + ' / ' + stats.total + '（' + pct + '%）'"><i :style="{ width: pct + '%' }"></i></div>
  <div class="algo-stats">
    <span v-for="c in CATEGORIES" :key="c.id" class="mini-tag clickable-svc"
          :class="{ 'svc': stats.byType[c.id]?.done, 'kind-system': !stats.byType[c.id]?.done, 'algo-chip-on': filter === c.id }"
          :title="c.name + '：已完成 ' + (stats.byType[c.id]?.done || 0) + ' / ' + stats.byType[c.id]?.total + '，点击筛选'"
          @click="filter = filter === c.id ? 'todo' : c.id">
      {{ c.name }} <b>{{ stats.byType[c.id]?.done || 0 }}/{{ stats.byType[c.id]?.total }}</b>
    </span>
  </div>

  <!-- 题库清单 -->
  <div class="subtabs tiny" style="padding: 0 10px 4px">
    <button class="subtab" :class="{ 'subtab-active': filter === 'todo' }" @click="filter = 'todo'">未做</button>
    <button class="subtab" :class="{ 'subtab-active': filter === 'redo' }" @click="filter = 'redo'">
      重做<span v-if="store.algo.redo.length" class="tab-badge">{{ store.algo.redo.length }}</span>
    </button>
    <button class="subtab" :class="{ 'subtab-active': filter === 'done' }" @click="filter = 'done'">已完成</button>
  </div>

  <div class="algo-list">
    <div v-for="p in list" :key="p.slug" class="todo-row" :class="{ 'algo-done': store.algo.progress[p.slug]?.done }">
      <button class="todo-check" :class="{ checked: store.algo.progress[p.slug]?.done }" title="标记完成/未做" @click="markDone(p.slug, !store.algo.progress[p.slug]?.done)">
        <Icon v-if="store.algo.progress[p.slug]?.done" name="Check" :size="9" />
      </button>
      <span class="todo-text" :title="p.t"><span class="algo-num">{{ p.n }}</span>{{ p.t }}</span>
      <span class="quad-badge" :class="lvCls(p.lv)">{{ LEVELS[p.lv] }}</span>
      <span class="mini-tag">{{ catName(p.c) }}</span>
      <button class="icon-btn sm" :class="{ 'chip-active': store.algo.redo.includes(p.slug) }"
              :title="store.algo.redo.includes(p.slug) ? '移出重做队列' : '加入重做队列'" @click="toggleRedo(p.slug)">
        <Icon name="RotateCw" :size="11" />
      </button>
      <button class="icon-btn sm" title="笔记" @click="startNote(p)"><Icon name="Pencil" :size="11" /></button>
      <button class="icon-btn sm" title="打开 LeetCode" @click="open(p)"><Icon name="ExternalLink" :size="11" /></button>
    </div>
    <p v-if="!list.length" class="hint" style="padding: 4px 10px">这个筛选下没有题目。</p>
  </div>

  <!-- 笔记编辑 -->
  <div v-if="noteFor" class="algo-note">
    <input class="input" v-model="noteDraft" :placeholder="'「' + (BANK.find((p) => p.slug === noteFor) || {}).t + '」的解法要点 / 踩坑，回车保存'"
           @keydown.enter="saveNote" @keydown.esc="noteFor = ''">
    <button class="btn btn-ghost sm" @click="saveNote">保存</button>
  </div>
</template>
