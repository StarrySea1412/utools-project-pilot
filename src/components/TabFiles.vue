<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { store } from '../store.js';
import { toast, confirmBox, fmtSize, fmtDate } from '../ui.js';

const props = defineProps({ project: { type: Object, required: true } });

const cwd = computed(() => store.fileCwd || props.project.path);
const items = ref([]);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  try { items.value = await window.pilot.fs.listDir(cwd.value); error.value = ''; }
  catch (e) { error.value = String(e.message || e); }
  loading.value = false;
}
watch(cwd, load);
onMounted(load);

const crumbs = computed(() => {
  const root = props.project.path.replace(/[\\/]+$/, '');
  const cur = cwd.value;
  const rel = cur === root ? [] : cur.slice(root.length + 1).split(/[\\/]/);
  const parts = [root, ...rel];
  return parts.map((p, i) => ({ name: i === 0 ? '项目根' : p, full: parts.slice(0, i + 1).join('/') }));
});

const openPath = (p) => window.pilot.openPath(p);

async function newFile() {
  const name = prompt('新文件名');
  if (!name) return;
  try { await window.pilot.fs.writeText(cwd.value + '/' + name, ''); load(); } catch (e) { toast(e.message, 'err'); }
}
async function newDir() {
  const name = prompt('新文件夹名');
  if (!name) return;
  try { await window.pilot.fs.mkdir(cwd.value + '/' + name); load(); } catch (e) { toast(e.message, 'err'); }
}
async function rename(it) {
  const nn = prompt('重命名', it.name);
  if (nn && nn !== it.name) {
    try { await window.pilot.fs.rename(cwd.value + '/' + it.name, cwd.value + '/' + nn); load(); } catch (e) { toast(e.message, 'err'); }
  }
}
function del(it) {
  confirmBox('删除', `删除「${it.name}」？文件夹会连同内容一起删除，不可恢复！`, async () => {
    try { await window.pilot.fs.rm(cwd.value + '/' + it.name); load(); } catch (e) { toast(e.message, 'err'); }
  });
}
async function preview(it) {
  let content = '';
  try { content = await window.pilot.fs.readText(cwd.value + '/' + it.name); }
  catch (e) { toast(e.message, 'err'); return; }
  const nn = prompt('预览 / 编辑（确定=保存）', content);
  if (nn !== null && nn !== content) {
    try { await window.pilot.fs.writeText(cwd.value + '/' + it.name, nn); toast('已保存', 'ok'); load(); } catch (e) { toast(e.message, 'err'); }
  }
}
function open(it) { openPath(cwd.value + '/' + it.name); }
function enter(it) { store.fileCwd = cwd.value + '/' + it.name; }
</script>

<template>
  <div class="panel-head">
    <div class="crumbs">
      <template v-for="(c, i) in crumbs" :key="c.full">
        <span v-if="i" class="c-sep">›</span>
        <button class="crumb" :title="c.full" @click="store.fileCwd = c.full === crumbs[0].full ? null : c.full">{{ c.name }}</button>
      </template>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" @click="newFile">＋ 文件</button>
      <button class="btn btn-ghost" @click="newDir">＋ 文件夹</button>
      <button class="btn btn-ghost" @click="openPath(cwd)">▸ 系统打开</button>
    </div>
  </div>
  <div class="glass panel file-panel">
    <ul v-if="!loading && !error" class="file-list">
      <li v-for="it in items" :key="it.name" class="file-row" @click="it.dir ? enter(it) : preview(it)">
        <span class="f-ico">{{ it.dir ? '📁' : '📄' }}</span>
        <span class="f-name" :title="it.name">{{ it.name }}</span>
        <span class="f-size">{{ it.dir ? '' : fmtSize(it.size) }}</span>
        <span class="f-actions">
          <button v-if="!it.dir" title="预览/编辑" @click.stop="preview(it)">👁</button>
          <button title="系统打开" @click.stop="open(it)">▸</button>
          <button title="重命名" @click.stop="rename(it)">✏️</button>
          <button title="删除" @click.stop="del(it)">🗑</button>
        </span>
      </li>
      <li v-if="!items.length" class="hint pad">空目录</li>
    </ul>
    <p v-else-if="error" class="hint pad">{{ error }}</p>
    <p v-else class="hint pad">加载中…</p>
  </div>
</template>
