<script setup>
import { ref } from 'vue';
import { store, startScript, stopScript, saveProjects } from '../store.js';
import { toast, openModal, confirmBox } from '../ui.js';
import ScriptModal from '../modals/ScriptModal.vue';

const props = defineProps({ project: { type: Object, required: true } });

function isRunning(s) { return !!(s.persistent && store.procHandles[s.id]?.running); }

function run(s) {
  startScript(props.project, s);
  toast(`已启动「${s.name}」`, 'ok');
}
async function stop(s) {
  await stopScript(s);
  toast(`已停止「${s.name}」`, 'ok');
}
function edit(s) { openModal(ScriptModal, { project: props.project, script: s }, { title: '编辑脚本' }); }
function add() { openModal(ScriptModal, { project: props.project }, { title: '添加脚本' }); }
function showLog(s) { store.consoleOpen = s.id; }
function del(s) {
  confirmBox('删除脚本', `删除「${s.name}」？`, () => {
    props.project.scripts = props.project.scripts.filter((x) => x.id !== s.id);
    saveProjects();
    toast('已删除', 'ok');
  });
}
</script>

<template>
  <div class="panel-head">
    <h4>脚本（{{ project.scripts.length }}）</h4>
    <button class="btn btn-primary" @click="add">＋ 添加脚本</button>
  </div>
  <div class="script-list">
    <div v-for="s in project.scripts" :key="s.id" class="script-row glass" :class="{ 'row-running': isRunning(s) }">
      <div class="s-info">
        <div class="s-name">
          {{ s.name }}
          <span v-if="s.persistent" class="mini-tag svc">服务</span>
          <span v-if="isRunning(s)" class="run-dot"></span>
        </div>
        <code class="s-cmd">{{ s.cmd }}</code>
      </div>
      <div class="s-actions">
        <button v-if="s.persistent && isRunning(s)" class="btn btn-danger-ghost" @click="stop(s)">■ 停止</button>
        <button v-else class="btn btn-primary-ghost" @click="run(s)">▶ {{ s.persistent ? '启动' : '运行' }}</button>
        <button class="icon-btn" title="查看输出" @click="showLog(s)">❐</button>
        <button class="icon-btn" title="编辑" @click="edit(s)">✏️</button>
        <button class="icon-btn" title="删除" @click="del(s)">🗑</button>
      </div>
    </div>
    <div v-if="!project.scripts.length" class="empty-box">
      <div class="e-icon">⚡</div><div class="e-title">还没有脚本</div>
      <div class="e-sub">把常用的 dev / build / start 命令保存为一键脚本。</div>
    </div>
  </div>
</template>
