<script setup>
import { computed, ref } from 'vue';
import { store, addTodo, toggleTodo, removeTodo, clearDoneTodos, setTodoQuad } from '../store.js';
import { timeAgo } from '../ui.js';
import Icon from './Icon.vue';

const emit = defineEmits(['open-detail']);
const draft = ref('');
const draftProject = ref(''); // 创建时可选关联项目
const draftQuad = ref(1);     // 创建时选择象限（默认 重要·不紧急）
const view = ref('list'); // list | quad
const dragOver = ref(null); // 四象限拖拽悬停高亮

// 四象限：0 紧急·重要 / 1 重要·不紧急 / 2 紧急·不重要 / 3 都不
const QUADS = [
  { id: 0, name: '紧急 · 重要', hint: '马上做', short: '紧急' },
  { id: 1, name: '重要 · 不紧急', hint: '安排做', short: '重要' },
  { id: 2, name: '紧急 · 不重要', hint: '少做', short: '琐碎' },
  { id: 3, name: '不紧急 · 不重要', hint: '以后', short: '以后' },
];
const qOf = (t) => ((t.q ?? 1) % 4 + 4) % 4;
const quadOf = (t) => QUADS[qOf(t)];

const open = computed(() => store.todos.filter((t) => !t.done));
const done = computed(() => store.todos.filter((t) => t.done));
const byQuad = computed(() => QUADS.map((q) => open.value.filter((t) => qOf(t) === q.id)));
const projName = (id) => (store.projects.find((p) => p.id === id) || {}).name || '';

function add() {
  if (addTodo(draft.value, draftProject.value || null, draftQuad.value)) draft.value = '';
}
// 中文输入法选词的回车（isComposing / keyCode 229）不应添加待办
function onEnter(e) {
  if (e.isComposing || e.keyCode === 229) return;
  add();
}
function goProject(id) {
  if (!id) return;
  store.activeProjectId = id;
  store.view = 'detail';
  store.detailTab = 'overview';
  emit('open-detail', id);
}
function cycleQuad(t) {
  setTodoQuad(t.id, qOf(t) + 1);
}
function onDrop(qid, ev) {
  ev.preventDefault();
  dragOver.value = null;
  const id = ev.dataTransfer.getData('text/pilot-todo');
  if (id) setTodoQuad(id, qid);
}
const onDragStart = (t, ev) => ev.dataTransfer.setData('text/pilot-todo', t.id);
</script>

<template>
  <div class="todo-input-row">
    <input class="input" v-model="draft" placeholder="记一件小事，回车添加…" @keydown.enter="onEnter">
    <div class="quad-pick" title="新增到哪个象限">
      <button v-for="q in QUADS" :key="q.id" class="quad-pick-btn" :class="['qp' + q.id, { active: draftQuad === q.id }]"
              :title="q.name" @click="draftQuad = q.id">{{ q.short }}</button>
    </div>
    <select v-model="draftProject" class="select todo-proj-select" title="关联项目（可选）">
      <option value="">不关联项目</option>
      <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
    </select>
    <div class="subtabs tiny">
      <button class="subtab" :class="{ 'subtab-active': view === 'list' }" @click="view = 'list'">列表</button>
      <button class="subtab" :class="{ 'subtab-active': view === 'quad' }" @click="view = 'quad'">四象限</button>
    </div>
    <button v-if="done.length" class="btn btn-ghost sm" @click="clearDoneTodos()">清空已完成</button>
  </div>

  <!-- 列表视图 -->
  <template v-if="view === 'list'">
    <div v-for="t in open" :key="t.id" class="todo-row">
      <button class="todo-check" title="完成" @click="toggleTodo(t.id)"></button>
      <span class="todo-text" :title="t.text">{{ t.text }}</span>
      <span class="quad-badge" :class="'qb' + qOf(t)" :title="'所属象限：' + quadOf(t).name + '，点击切换'" @click="cycleQuad(t)">{{ quadOf(t).short }}</span>
      <span v-if="t.projectId" class="mini-tag mono" :title="'关联项目：' + projName(t.projectId) + '，点击打开'" @click="goProject(t.projectId)">{{ projName(t.projectId) }}</span>
      <span class="c-time">{{ timeAgo(t.createdAt) }}</span>
      <button class="icon-btn sm" title="删除" @click="removeTodo(t.id)"><Icon name="X" :size="12" /></button>
    </div>
    <div v-for="t in done" :key="t.id" class="todo-row done">
      <button class="todo-check checked" title="取消完成" @click="toggleTodo(t.id)"><Icon name="Check" :size="9" /></button>
      <span class="todo-text" :title="t.text">{{ t.text }}</span>
      <span v-if="t.projectId" class="mini-tag mono" :title="'关联项目：' + projName(t.projectId) + '，点击打开'" @click="goProject(t.projectId)">{{ projName(t.projectId) }}</span>
      <span class="c-time">{{ timeAgo(t.doneAt || t.createdAt) }}</span>
      <button class="icon-btn sm" title="删除" @click="removeTodo(t.id)"><Icon name="X" :size="12" /></button>
    </div>
    <p v-if="!store.todos.length" class="hint" style="padding: 4px 10px">暂无待办。随手记，回车添加。</p>
  </template>

  <!-- 四象限视图 -->
  <div v-else class="quad-grid">
    <div v-for="(items, qi) in byQuad" :key="qi" class="quad-cell" :class="['q' + qi, { dragover: dragOver === qi }]"
         @dragover.prevent @dragenter.prevent="dragOver = qi" @dragleave="dragOver === qi && (dragOver = null)" @drop="onDrop(qi, $event)">
      <div class="quad-head">
        <span class="q-name">{{ QUADS[qi].name }}</span>
        <span class="q-hint">{{ items.length ? items.length + ' 项' : QUADS[qi].hint }}</span>
      </div>
      <div v-for="t in items" :key="t.id" class="todo-mini-row" draggable="true" @dragstart="onDragStart(t, $event)">
        <button class="todo-check" title="完成" @click="toggleTodo(t.id)"></button>
        <span class="todo-text" :title="t.text + (t.projectId ? ' · ' + projName(t.projectId) : '')">{{ t.text }}</span>
        <span v-if="t.projectId" class="mini-tag mono" :title="'关联项目：' + projName(t.projectId) + '，点击打开'" @click="goProject(t.projectId)">{{ projName(t.projectId) }}</span>
        <button class="icon-btn sm" title="删除" @click="removeTodo(t.id)"><Icon name="X" :size="12" /></button>
      </div>
      <span v-if="!items.length" class="q-empty">拖待办到这里</span>
    </div>
  </div>
  <p v-if="view === 'quad' && done.length" class="hint" style="padding: 4px 10px 0">已完成 {{ done.length }} 项（列表视图可查看）</p>
</template>
