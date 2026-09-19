<script setup>
import { saveProjects, execAndLog } from '../store.js';
import { toast, openModal, confirmBox, timeAgo } from '../ui.js';
import TaskModal from '../modals/TaskModal.vue';
import TaskLogModal from '../modals/TaskLogModal.vue';

const props = defineProps({ project: { type: Object, required: true } });

function scheduleText(t) {
  if (t.type === 'boot') return '插件打开时';
  if (t.type === 'daily') return `每天 ${t.atTime || '09:00'}`;
  return `每 ${t.everyMinutes || 60} 分钟`;
}
function toggle(t) { saveProjects(); }
function add() { openModal(TaskModal, { project: props.project }, { title: '添加自动任务' }); }
function edit(t) { openModal(TaskModal, { project: props.project, task: t }, { title: '编辑自动任务' }); }
function showLog(t) { openModal(TaskLogModal, { task: t }, { title: `任务日志 · ${t.name}` }); }
function del(t) {
  confirmBox('删除任务', `删除「${t.name}」？`, () => {
    props.project.tasks = props.project.tasks.filter((x) => x.id !== t.id);
    saveProjects(); toast('已删除', 'ok');
  });
}
async function runNow(t) {
  toast(`正在执行「${t.name}」…`, 'info');
  await execAndLog(props.project, t);
  toast(t.log[0].ok ? `任务「${t.name}」执行成功` : `任务「${t.name}」失败，点击日志查看`, t.log[0].ok ? 'ok' : 'err');
}
</script>

<template>
  <div class="panel-head">
    <h4>自动任务（{{ (project.tasks || []).length }}）</h4>
    <button class="btn btn-primary" @click="add">＋ 添加任务</button>
  </div>
  <div class="script-list">
    <div v-for="t in project.tasks" :key="t.id" class="task-row glass" :class="{ 'row-off': !t.enabled }">
      <label class="switch" title="启用/停用">
        <input v-model="t.enabled" type="checkbox" @change="toggle(t)"><span></span>
      </label>
      <div class="s-info">
        <div class="s-name">{{ t.name }} <span class="mini-tag">{{ scheduleText(t) }}</span></div>
        <code class="s-cmd">{{ t.cmd }}</code>
      </div>
      <div class="s-actions">
        <span class="c-time" title="上次运行">{{ t.lastRun ? timeAgo(t.lastRun) : '未运行' }}</span>
        <button class="btn btn-primary-ghost" @click="runNow(t)">▶ 运行</button>
        <button class="icon-btn" title="运行日志" @click="showLog(t)">❐</button>
        <button class="icon-btn" @click="edit(t)">✏️</button>
        <button class="icon-btn" @click="del(t)">🗑</button>
      </div>
    </div>
    <div v-if="!(project.tasks || []).length" class="empty-box">
      <div class="e-icon">⏱</div><div class="e-title">还没有自动任务</div>
      <div class="e-sub">支持：每天定时 / 固定间隔 / 打开插件时触发，自动在项目目录执行命令。</div>
    </div>
  </div>
</template>
