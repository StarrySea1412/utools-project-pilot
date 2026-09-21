<script setup>
import { computed } from 'vue';
import { store, markNotifRead, markAllNotifRead, clearNotifs } from '../store.js';
import { timeAgo } from '../ui.js';

const emit = defineEmits(['open-detail']);
const unread = computed(() => store.notifications.filter((n) => !n.read).length);
const projName = (id) => (store.projects.find((p) => p.id === id) || {}).name || '';

function open(n) {
  markNotifRead(n.id);
  if (n.projectId) {
    store.activeProjectId = n.projectId;
    store.view = 'detail';
    store.detailTab = 'tasks';
    emit('open-detail', n.projectId);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="store.notifOpen" class="modal-mask open" @click.self="store.notifOpen = false">
      <div class="modal glass-strong notif-modal" role="dialog">
        <div class="modal-head">
          <h3>🔔 通知中心</h3>
          <span class="spacer"></span>
          <button v-if="unread" class="btn btn-ghost sm" @click="markAllNotifRead()">全部已读</button>
          <button class="icon-btn" @click="store.notifOpen = false">✕</button>
        </div>
        <div class="modal-body-inner">
          <div v-for="n in store.notifications" :key="n.id" class="notif-row" :class="{ unread: !n.read }" @click="open(n)">
            <span class="notif-ico">{{ n.icon }}</span>
            <span class="notif-text" :title="n.text">{{ n.text }}</span>
            <span v-if="n.projectId" class="mini-tag mono">{{ projName(n.projectId) }}</span>
            <span class="c-time">{{ timeAgo(n.time) }}</span>
            <span v-if="!n.read" class="notif-dot"></span>
          </div>
          <p v-if="!store.notifications.length" class="hint">暂无通知。任务失败、AI 异常会推到这里。</p>
        </div>
        <div class="btn-row" style="margin-top: 8px">
          <button class="btn btn-ghost" @click="clearNotifs(); store.notifOpen = false">清空通知</button>
          <button class="btn" @click="store.notifOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
