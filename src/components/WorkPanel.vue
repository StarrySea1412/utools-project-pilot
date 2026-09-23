<script setup>
import { computed, ref, watch } from 'vue';
import { store } from '../store.js';
import { buildSuggestions } from '../advisor.js';
import Icon from './Icon.vue';
import Suggestions from './Suggestions.vue';
import TodoPanel from './TodoPanel.vue';

const emit = defineEmits(['open-detail']);

const sugCount = computed(() => buildSuggestions().length);
const urgent = computed(() => buildSuggestions().filter((s) => s.level === 2).length);
const openTodos = computed(() => store.todos.filter((t) => !t.done).length);

function pick(tab) {
  store.workTab = tab;
  store.workOpen = true;
}

// 有紧急建议时自动展开一次（本次会话内只打扰一回）
const autoDone = ref(false);
watch(urgent, (n) => {
  if (n > 0 && !autoDone.value) {
    autoDone.value = true;
    store.workTab = 'sug';
    store.workOpen = true;
  }
}, { immediate: true });
</script>

<template>
  <section class="sug-panel glass">
    <div class="sug-head" @click="store.workOpen = !store.workOpen">
      <h4 class="panel-title"><Icon name="Compass" :size="14" /> 工作台</h4>
      <div class="subtabs tiny" @click.stop>
        <button class="subtab" :class="{ 'subtab-active': store.workTab === 'sug' }" @click="pick('sug')">
          <Icon name="Lightbulb" :size="12" /> 建议
          <span v-if="urgent" class="tab-badge">{{ urgent }} 急</span>
          <span v-else-if="sugCount" class="hint">{{ sugCount }}</span>
        </button>
        <button class="subtab" :class="{ 'subtab-active': store.workTab === 'todo' }" @click="pick('todo')">
          <Icon name="ListTodo" :size="12" /> 待办
          <span v-if="openTodos" class="tab-badge">{{ openTodos }}</span>
        </button>
      </div>
      <span class="spacer"></span>
      <button class="icon-btn" @click.stop="store.workOpen = !store.workOpen"><Icon :name="store.workOpen ? 'ChevronDown' : 'ChevronUp'" :size="14" /></button>
    </div>
    <div v-if="store.workOpen" class="sug-list">
      <Suggestions v-if="store.workTab === 'sug'" @open-detail="emit('open-detail', $event)" />
      <TodoPanel v-else @open-detail="emit('open-detail', $event)" />
    </div>
  </section>
</template>
