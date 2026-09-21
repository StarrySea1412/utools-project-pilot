<script setup>
import { computed, ref } from 'vue';
import { store, addTodo, toggleTodo, removeTodo, clearDoneTodos, saveTodos } from '../store.js';
import { timeAgo } from '../ui.js';

const emit = defineEmits(['open-detail']);
const draft = ref('');

const open = computed(() => store.todos.filter((t) => !t.done));
const done = computed(() => store.todos.filter((t) => t.done));
const projName = (id) => (store.projects.find((p) => p.id === id) || {}).name || '';

function add() {
  if (addTodo(draft.value)) draft.value = '';
}
function goProject(id) {
  if (!id) return;
  store.activeProjectId = id;
  store.view = 'detail';
  store.detailTab = 'overview';
  emit('open-detail', id);
}
</script>

<template>
  <section class="sug-panel glass">
    <div class="sug-head" @click="store.todosOpen = !store.todosOpen">
      <h4 class="panel-title">🗒️ 待办</h4>
      <span class="panel-en">QUICK NOTES</span>
      <span v-if="open.length" class="tab-badge">{{ open.length }} 项未完成</span>
      <span v-else class="hint">清空</span>
      <span class="spacer"></span>
      <button v-if="done.length" class="btn btn-ghost sm" @click.stop="clearDoneTodos()">清空已完成</button>
      <button class="icon-btn" @click.stop="store.todosOpen = !store.todosOpen">{{ store.todosOpen ? '⌄' : '⌃' }}</button>
    </div>
    <div v-if="store.todosOpen" class="sug-list">
      <div class="todo-input-row">
        <input class="input" v-model="draft" placeholder="记一件小事，回车添加…" @keydown.enter="add">
      </div>
      <div v-for="t in open" :key="t.id" class="todo-row">
        <button class="todo-check" title="完成" @click="toggleTodo(t.id)"></button>
        <span class="todo-text" :title="t.text">{{ t.text }}</span>
        <span v-if="t.projectId" class="mini-tag mono" :title="'关联项目：' + projName(t.projectId)" @click="goProject(t.projectId)">{{ projName(t.projectId) }}</span>
        <span class="c-time">{{ timeAgo(t.createdAt) }}</span>
        <button class="icon-btn sm" title="删除" @click="removeTodo(t.id)">✕</button>
      </div>
      <div v-for="t in done" :key="t.id" class="todo-row done">
        <button class="todo-check checked" title="取消完成" @click="toggleTodo(t.id)">✓</button>
        <span class="todo-text" :title="t.text">{{ t.text }}</span>
        <span v-if="t.projectId" class="mini-tag mono" :title="'关联项目：' + projName(t.projectId)" @click="goProject(t.projectId)">{{ projName(t.projectId) }}</span>
        <span class="c-time">{{ timeAgo(t.doneAt || t.createdAt) }}</span>
        <button class="icon-btn sm" title="删除" @click="removeTodo(t.id)">✕</button>
      </div>
      <p v-if="!store.todos.length" class="hint">暂无待办。随手记，回车添加。</p>
    </div>
  </section>
</template>
