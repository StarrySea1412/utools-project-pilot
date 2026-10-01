<script setup>
import { computed, ref, onMounted } from 'vue';
import { store, saveProjects, checkGit, refreshAllGit, genCommitMessage } from '../store.js';
import { toast, confirmBox, openModal } from '../ui.js';
import Icon from './Icon.vue';
import BranchModal from '../modals/BranchModal.vue';

const props = defineProps({ project: { type: Object, required: true } });

const status = ref(null);
const error = ref(null);
const loading = ref(true);
const selKey = ref(null);
const diff = ref('');
const diffLoading = ref(false);
const diffStaged = ref(false);
const aiBusy = ref(false);
const committing = ref(false);

const staged = computed(() => (status.value?.entries || []).filter((f) => f.x !== '.' && f.x !== '?' && !f.untracked));
const unstaged = computed(() => (status.value?.entries || []).filter((f) => f.untracked || (f.y !== '.' && f.y !== '?' && !f.unmerged)));
const unmerged = computed(() => (status.value?.entries || []).filter((f) => f.unmerged));
const stagedCount = computed(() => staged.value.length);

const keyOf = (f) => `${f.x}${f.y}:${f.path}`;

if (new URLSearchParams(location.search).has('debug')) {
  document.title = 'GC:' + (props.project?.id || 'NULL') + '|' + JSON.stringify(props.project?.name || null);
}

async function loadStatus() {
  loading.value = true;
  try {
    status.value = await window.pilot.git.status(props.project.path);
    error.value = null;
    // 增量更新缓存：保住 checkGit 写入的 lastCommitAt，整写会让「最近更新」排序错位
    const cache = store.gitCache[props.project.id] || (store.gitCache[props.project.id] = {});
    cache.status = status.value; cache.at = Date.now();
    cache.notRepo = false; cache.loading = false; cache.error = null;
  } catch (e) {
    error.value = String(e.message || e) + (e.stack ? ' @' + e.stack.split('\n')[1] : '');
  }
  loading.value = false;
}

async function showDiff(f, isStaged) {
  selKey.value = keyOf(f);
  diffStaged.value = isStaged;
  diffLoading.value = true;
  try { diff.value = await window.pilot.git.diffFile(props.project.path, f, isStaged); }
  catch (e) { diff.value = '（' + (e.message || e) + '）'; }
  diffLoading.value = false;
}

async function stage(files) {
  try {
    await window.pilot.git.stage(props.project.path, files.map((f) => f.path));
    toast('已暂存', 'ok'); await loadStatus(); refreshAllGit(true);
  } catch (e) { toast(e.message, 'err'); }
}
async function unstage(files) {
  try {
    await window.pilot.git.unstage(props.project.path, files.map((f) => f.path));
    toast('已取消暂存', 'ok'); await loadStatus(); refreshAllGit(true);
  } catch (e) { toast(e.message, 'err'); }
}
function discard(f) {
  confirmBox('确认操作',
    `确定${f.untracked ? '删除未跟踪文件' : '丢弃该文件的修改'}「${f.path}」？${f.untracked ? '文件将被删除，' : '修改不可恢复，'}建议先提交或暂存。`,
    async () => {
      try {
        if (f.untracked) await window.pilot.git.discardUntracked(props.project.path, [f.path]);
        else await window.pilot.git.discard(props.project.path, [f.path]);
        toast('已丢弃', 'ok'); await loadStatus(); refreshAllGit(true);
      } catch (e) { toast(e.message, 'err'); }
    });
}

async function aiMsg() {
  if (!stagedCount.value) { toast('请先暂存文件', 'warn'); return; }
  aiBusy.value = true;
  try {
    store.commitMsg = await genCommitMessage(props.project, staged.value);
    toast('AI 已生成提交信息', 'ai');
  } catch (e) { toast('AI 生成失败：' + e.message, 'err'); }
  aiBusy.value = false;
}

async function commit() {
  const msg = store.commitMsg.trim();
  if (!msg) { toast('请填写提交信息', 'warn'); return; }
  committing.value = true;
  try {
    const hash = await window.pilot.git.commit(props.project.path, msg);
    store.commitMsg = '';
    toast(`已提交 ${hash}`, 'ok');
    await loadStatus(); refreshAllGit(true);
  } catch (e) { toast('提交失败：' + e.message, 'err'); }
  committing.value = false;
}

async function gitOp(op) {
  try {
    if (op === 'pull') { toast('拉取中…', 'info'); await window.pilot.git.pull(props.project.path); toast('已拉取', 'ok'); }
    if (op === 'push') { toast('推送中…', 'info'); await window.pilot.git.push(props.project.path); toast('已推送', 'ok'); }
    if (op === 'stage-all') {
      const all = (status.value.entries || []).map((f) => f.path);
      await window.pilot.git.stage(props.project.path, all); toast('已全部暂存', 'ok');
    }
    if (op === 'unstage-all') {
      const files = (status.value.entries || []).filter((f) => f.x !== '.' && !f.untracked).map((f) => f.path);
      await window.pilot.git.unstage(props.project.path, files); toast('已取消全部暂存', 'ok');
    }
  } catch (e) { toast('操作失败：' + e.message, 'err'); }
  await loadStatus(); refreshAllGit(true);
}

// ---------- stash ----------
const stashList = ref([]);
async function loadStash() {
  try { stashList.value = await window.pilot.git.stashList(props.project.path); }
  catch (e) { stashList.value = []; }
}
async function stashPush() {
  if (!status.value?.dirty) { toast('工作区干净，无需暂存', 'warn'); return; }
  try {
    await window.pilot.git.stashPush(props.project.path);
    toast('已暂存到 stash', 'ok');
    await Promise.all([loadStatus(), loadStash()]); refreshAllGit(true);
  } catch (e) { toast('stash 失败：' + e.message, 'err'); }
}
function stashPop(label) {
  confirmBox('恢复暂存', `把「${label}」弹回工作区？<br><small>pop 成功后该条 stash 会被删除；有冲突时会保留在 stash 里。</small>`, async () => {
    try {
      await window.pilot.git.stashPop(props.project.path, label);
      toast('已恢复到工作区', 'ok');
      await Promise.all([loadStatus(), loadStash()]); refreshAllGit(true);
    } catch (e) { toast('恢复失败：' + e.message, 'err'); }
  }, { danger: false });
}
function stashDrop(label) {
  confirmBox('删除暂存', `删除「${label}」？该记录将不可恢复。`, async () => {
    try {
      await window.pilot.git.stashDrop(props.project.path, label);
      toast('已删除', 'ok');
      await loadStash();
    } catch (e) { toast('删除失败：' + e.message, 'err'); }
  });
}

function openBranchModal() {
  openModal(BranchModal, { project: props.project }, { title: '分支管理 · ' + props.project.name });
}

const diffLines = computed(() => diff.value.split('\n').map((l) => ({
  text: l,
  cls: l.startsWith('+') && !l.startsWith('+++') ? 'add' : l.startsWith('-') && !l.startsWith('---') ? 'del' : l.startsWith('@@') ? 'hunk' : '',
})));

// 初始默认选中第一个文件
async function initSel() {
  await loadStatus();
  const first = staged.value[0] || unstaged.value[0] || unmerged.value[0];
  if (first) showDiff(first, !first.untracked && first.x !== '.');
  else diff.value = '';
  loading.value = false;
  loadStash();
}
onMounted(initSel);
</script>

<template>
  <div class="changes-layout">
    <aside class="glass panel changes-panel">
      <div class="panel-head slim">
        <div class="subtabs tiny">
          <button class="subtab tiny-active">全部 {{ status?.dirty ?? 0 }}</button>
        </div>
        <button class="icon-btn" title="刷新" @click="loadStatus"><Icon name="RefreshCw" :size="14" /></button>
      </div>
      <div class="file-groups">
        <template v-if="!loading && !error">
          <div v-if="unmerged.length" class="file-group">
            <div class="group-title conflict">冲突文件（{{ unmerged.length }}）</div>
            <div v-for="f in unmerged" :key="keyOf(f)" class="change-row" :class="{ sel: selKey === keyOf(f) }" @click="showDiff(f, false)">
              <span class="ch-badge b-u">U</span>
              <span class="ch-path" :title="f.path">{{ f.path }}</span>
            </div>
          </div>
          <div v-if="staged.length" class="file-group">
            <div class="group-title staged">已暂存（{{ staged.length }}）</div>
            <div v-for="f in staged" :key="keyOf(f)" class="change-row" :class="{ sel: selKey === keyOf(f) }" @click="showDiff(f, true)">
              <span class="ch-badge b-s">S</span>
              <span class="ch-path" :title="f.path">{{ f.path }}</span>
              <span class="ch-ops"><button title="取消暂存" @click.stop="unstage([f])">↩</button></span>
            </div>
          </div>
          <div v-if="unstaged.length" class="file-group">
            <div class="group-title">未暂存 / 未跟踪（{{ unstaged.length }}）</div>
            <div v-for="f in unstaged" :key="keyOf(f)" class="change-row" :class="{ sel: selKey === keyOf(f) }" @click="showDiff(f, false)">
              <span class="ch-badge" :class="f.untracked ? 'b-u' : 'b-m'">{{ f.untracked ? 'U' : 'M' }}</span>
              <span class="ch-path" :title="f.path">{{ f.path }}</span>
              <span class="ch-ops">
                <button title="暂存" @click.stop="stage([f])"><Icon name="Plus" :size="11" /></button>
                <button title="丢弃" @click.stop="discard(f)"><Icon name="Undo2" :size="11" /></button>
              </span>
            </div>
          </div>
          <p v-if="!status?.dirty" class="hint pad sync-ok"><Icon name="CircleCheck" :size="13" /> 工作区干净，没有未提交的变更。</p>
        </template>
        <p v-else-if="error" class="hint pad">{{ error }}</p>
        <p v-else class="hint pad">加载中…</p>
      </div>
    </aside>

    <section class="glass panel diff-panel">
      <div v-if="selKey" class="diff-view">
        <div class="diff-head">
          <code>{{ selKey?.split(':')[1] }}</code>
          <span class="mini-tag">{{ diffStaged ? '已暂存' : '未暂存' }}</span>
        </div>
        <pre v-if="!diffLoading" class="diff-code"><span v-for="(l, i) in diffLines" :key="i" class="dl" :class="l.cls">{{ l.text || ' ' }}</span></pre>
        <div v-else class="loading-panel">计算差异…</div>
      </div>
      <p v-else class="hint pad">从左侧选择文件查看差异。</p>
    </section>
  </div>

  <div class="commit-bar glass">
    <textarea v-model="store.commitMsg" class="input" placeholder="提交信息（可点下方「AI 生成」）…"></textarea>
    <div class="commit-actions">
      <button class="btn ai-btn" :disabled="!stagedCount || aiBusy" @click="aiMsg"><Icon name="Sparkles" :size="12" /> {{ aiBusy ? '生成中…' : 'AI 生成' }}</button>
      <span class="hint">{{ stagedCount }} 个已暂存文件</span>
      <button class="btn btn-primary" :disabled="!stagedCount || committing" @click="commit"><Icon name="Check" :size="13" /> {{ committing ? '提交中…' : '提交' }}</button>
    </div>
  </div>

  <div class="side-toolbar glass">
    <span class="branch-info">
      <button class="btn btn-ghost sm" title="分支管理" @click="openBranchModal">
        <Icon name="GitBranch" :size="12" /> {{ status?.branch || '—' }}
      </button>
      <span v-if="status?.ahead || status?.behind" class="ab">↑{{ status.ahead || 0 }} ↓{{ status.behind || 0 }}</span>
      <span v-else-if="status" class="ok-text sync-ok"><Icon name="Check" :size="12" /> 与远程同步</span>
    </span>
    <span class="spacer"></span>
    <button class="btn btn-ghost" title="把工作区改动存入 stash" @click="stashPush"><Icon name="Inbox" :size="13" /> stash</button>
    <button v-if="stashList.length" class="btn btn-ghost" title="stash 列表" @click="stashPop(stashList[0].label)"><Icon name="Undo2" :size="13" /> 恢复最新 ({{ stashList.length }})</button>
    <button class="btn btn-ghost" @click="gitOp('stage-all')">全部暂存</button>
    <button class="btn btn-ghost" @click="gitOp('unstage-all')">取消全部暂存</button>
    <button class="btn btn-ghost" @click="gitOp('pull')">↓ 拉取</button>
    <button class="btn btn-ghost" @click="gitOp('push')">↑ 推送</button>
  </div>
</template>
