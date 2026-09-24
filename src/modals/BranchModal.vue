<script setup>
import { ref, computed, onMounted } from 'vue';
import { store, checkGit } from '../store.js';
import { toast, closeModal, confirmBox } from '../ui.js';
import Icon from '../components/Icon.vue';

const props = defineProps({ project: { type: Object, required: true } });

const branches = ref([]);
const loading = ref(true);
const creating = ref(false);
const newName = ref('');
const newFrom = ref('');
const hasRemote = ref(false);

async function load() {
  loading.value = true;
  try {
    branches.value = await window.pilot.git.branches(props.project.path);
    hasRemote.value = await window.pilot.git.hasRemote(props.project.path);
  } catch (e) { toast('读取分支失败：' + (e.message || e), 'err'); }
  loading.value = false;
}
onMounted(load);

const current = computed(() => branches.value.find((b) => b.current));

function switchTo(b) {
  if (b.current) return;
  confirmBox('切换分支', `切换到分支「${b.name}」？<br><small>有未提交变更时 git 会尝试合并携带，冲突会中止。</small>`, async () => {
    try {
      await window.pilot.git.checkout(props.project.path, b.name);
      toast(`已切换到 ${b.name}`, 'ok');
      await load();
      checkGit(props.project, true);
    } catch (e) { toast('切换失败：' + (e.message || e), 'err'); }
  }, { danger: false });
}

function del(b) {
  confirmBox('删除分支', `删除本地分支「${b.name}」？<br><small>未合并的分支会拒绝删除（-d），强制删除请用命令行确认。</small>`, async () => {
    try {
      await window.pilot.git.deleteBranch(props.project.path, b.name);
      toast(`已删除 ${b.name}`, 'ok');
      await load();
      checkGit(props.project, true);
    } catch (e) { toast('删除失败：' + (e.message || e), 'err'); }
  });
}

async function create() {
  const name = newName.value.trim();
  if (!name) { toast('请输入分支名', 'warn'); return; }
  creating.value = true;
  try {
    await window.pilot.git.createBranch(props.project.path, name, newFrom.value.trim() || undefined);
    toast(`已创建并切换到 ${name}`, 'ok');
    newName.value = ''; newFrom.value = '';
    await load();
    checkGit(props.project, true);
  } catch (e) { toast('创建失败：' + (e.message || e), 'err'); }
  creating.value = false;
}

function close() { closeModal(); }
</script>

<template>
  <div class="modal-body-inner">
    <div class="branch-toolbar">
      <button class="btn btn-ghost" :disabled="loading" @click="load"><Icon name="RefreshCw" :size="13" /> 刷新</button>
      <span class="hint">当前：<b class="mono">{{ current?.name || '—' }}</b></span>
    </div>

    <ul class="branch-list">
      <li v-for="b in branches" :key="b.name" :class="{ cur: b.current }">
        <Icon name="GitBranch" :size="13" />
        <span class="b-name mono">{{ b.name }}</span>
        <span v-if="b.upstream" class="mini-tag" title="远程跟踪">{{ b.upstream }}</span>
        <span v-if="b.current" class="mini-tag svc">当前</span>
        <span class="spacer"></span>
        <button v-if="!b.current" class="btn btn-ghost sm" @click="switchTo(b)">切换</button>
        <button v-if="!b.current" class="icon-btn" title="删除分支" @click="del(b)"><Icon name="Trash2" :size="12" /></button>
      </li>
      <li v-if="!loading && !branches.length" class="hint">没有读取到分支</li>
      <li v-if="loading" class="hint">加载中…</li>
    </ul>

    <div class="branch-new">
      <div class="two-col">
        <label class="field"><span class="f-label">新分支名</span>
          <input v-model="newName" class="input mono" placeholder="feature/xxx" @keydown.enter="create">
        </label>
        <label class="field"><span class="f-label">基于（可选）</span>
          <input v-model="newFrom" class="input mono" placeholder="默认当前分支">
        </label>
      </div>
      <button class="btn btn-primary" :disabled="creating" @click="create"><Icon name="Plus" :size="13" /> 创建并切换</button>
    </div>

    <div class="btn-row" style="margin-top: 10px">
      <span class="hint">{{ hasRemote ? '' : '（该仓库没有配置远程）' }}</span>
      <span class="spacer"></span>
      <button class="btn btn-ghost" @click="close">关闭</button>
    </div>
  </div>
</template>
