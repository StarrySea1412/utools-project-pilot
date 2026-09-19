<script setup>
import { store } from '../store.js';
import GitChanges from './GitChanges.vue';
import GitHistory from './GitHistory.vue';
import GitInsights from './GitInsights.vue';

defineProps({ project: { type: Object, required: true } });

const SUBTABS = [['changes', '变更'], ['history', '提交历史'], ['insights', 'AI 分析']];
const VIEWS = { changes: GitChanges, history: GitHistory, insights: GitInsights };
</script>

<template>
  <div class="git-wrap">
    <div class="git-toolbar glass">
      <div class="subtabs">
        <button v-for="[id, label] in SUBTABS" :key="id" class="subtab"
                :class="{ 'subtab-active': store.gitSubTab === id }" @click="store.gitSubTab = id">
          {{ label }}
        </button>
      </div>
    </div>
    <component :is="VIEWS[store.gitSubTab]" :project="project" />
  </div>
</template>
