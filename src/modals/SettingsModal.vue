<script setup>
import { ref } from 'vue';
import { store, saveSettings, exportAll, importAll } from '../store.js';
import { toast, closeModal, openModal, confirmBox, applyTheme } from '../ui.js';
import ModeModal from './ModeModal.vue';
import Icon from '../components/Icon.vue';

const ai = store.settings.ai;
const baseUrl = ref(ai.baseUrl || '');
const apiKey = ref(ai.apiKey || '');
const model = ref(ai.model || '');
const commitPrompt = ref(store.settings.commitPrompt || '');
const theme = ref(store.settings.theme || 'auto');
const testResult = ref('');
const testing = ref(false);

function save() {
  store.settings.ai.baseUrl = baseUrl.value.trim() || store.settings.ai.baseUrl;
  store.settings.ai.apiKey = apiKey.value.trim();
  store.settings.ai.model = model.value.trim() || store.settings.ai.model;
  store.settings.commitPrompt = commitPrompt.value.trim();
  store.settings.theme = theme.value;
  saveSettings();
  applyTheme();
  toast('设置已保存', 'ok');
  closeModal();
}

async function test() {
  testing.value = true;
  testResult.value = '';
  try {
    const text = await window.pilot.aiChat({
      baseUrl: baseUrl.value.trim() || store.settings.ai.baseUrl,
      apiKey: apiKey.value.trim(),
      model: model.value.trim() || store.settings.ai.model,
      messages: [{ role: 'user', content: '回复"OK"两个字母即可' }],
    });
    testResult.value = '✓ 连通成功：' + text.slice(0, 30);
  } catch (e) { testResult.value = '✕ ' + (e.message || e); }
  testing.value = false;
}

function addMode() { openModal(ModeModal, {}, { title: '自定义分析模式' }); }
function editMode(m) { openModal(ModeModal, { mode: m }, { title: '编辑分析模式' }); }

function doExport() {
  const file = exportAll();
  if (file) toast('已导出到 ' + file, 'ok');
  else if (file === null && window.pilot?.exportJson) toast('已取消导出', 'warn');
  else toast('当前环境不支持导出', 'err');
}

function doImport(mode) {
  importAll(mode).then((r) => {
    if (!r) return; // 用户取消
    const parts = [];
    if (r.projects) parts.push(`${mode === 'replace' ? '导入' : '新增'}项目 ${r.projects} 个`);
    if (r.todos) parts.push(`待办 ${r.todos} 条`);
    if (r.settings) parts.push('设置已覆盖');
    toast('导入完成：' + (parts.join('，') || '无新内容'), 'ok');
  }).catch((e) => toast('导入失败：' + (e.message || e), 'err'));
}

function onImportClick() {
  // confirmBox 只有一个确定回调：合并导入走弹窗确认，覆盖导入用双弹窗分开
  confirmBox('合并导入', '从备份文件导入，路径重复的项目会跳过，保留本地现有数据。继续？', () => doImport('merge'), { danger: false, okText: '选择文件' });
}

function onReplaceClick() {
  confirmBox('全量覆盖导入', '用备份文件替换本地<b>全部</b>数据（项目/设置/待办），操作不可撤销。确定继续？', () => doImport('replace'));
}
</script>

<template>
  <div class="modal-body-inner settings-body">
    <section class="set-section">
      <h4><Icon name="Bot" :size="13" /> AI 服务（OpenAI 兼容接口）</h4>
      <label class="field"><span class="f-label">Base URL</span>
        <input v-model="baseUrl" class="input mono" placeholder="https://api.openai.com/v1">
        <span class="f-hint">兼容 OpenAI 格式的任意服务：DeepSeek、Moonshot、通义、OpenRouter 等</span>
      </label>
      <div class="two-col">
        <label class="field"><span class="f-label">API Key</span>
          <input v-model="apiKey" type="password" class="input mono">
        </label>
        <label class="field"><span class="f-label">模型</span>
          <input v-model="model" class="input mono" placeholder="gpt-4o-mini">
        </label>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" :disabled="testing" @click="test">测试连通性</button>
        <span class="hint" :class="{ 'err-text': testResult.startsWith('✕') }">{{ testResult }}</span>
      </div>
    </section>

    <section class="set-section">
      <h4><Icon name="Sparkles" :size="13" /> 提交信息生成提示词</h4>
      <label class="field"><span class="f-label">System 提示词</span>
        <textarea v-model="commitPrompt" class="input mono" rows="4"></textarea>
        <span class="f-hint">留空使用默认。定义 AI 生成 commit message 的风格与规范。</span>
      </label>
    </section>

    <section class="set-section">
      <h4><Icon name="ListChecks" :size="13" /> 提交记录分析模式（{{ store.settings.analysisModes.length }}）</h4>
      <ul class="mode-manage">
        <li v-for="m in store.settings.analysisModes" :key="m.id">
          <span>{{ m.name }}</span>
          <span class="mini-tag" :class="{ svc: !m.builtin }">{{ m.builtin ? '内置' : '自定义' }}</span>
          <button class="icon-btn" @click="editMode(m)"><Icon name="Pencil" :size="13" /></button>
        </li>
      </ul>
      <button class="btn btn-ghost" @click="addMode"><Icon name="Plus" :size="13" /> 添加自定义模式</button>
    </section>

    <section class="set-section">
      <h4><Icon name="SunMoon" :size="13" /> 外观</h4>
      <div class="field"><span class="f-label">主题</span>
        <select v-model="theme" class="select full">
          <option value="auto">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </div>
    </section>

    <section class="set-section">
      <h4><Icon name="DatabaseBackup" :size="13" /> 数据备份</h4>
      <div class="btn-row">
        <button class="btn btn-ghost" @click="doExport"><Icon name="Download" :size="13" /> 导出全部数据</button>
        <button class="btn btn-ghost" @click="onImportClick"><Icon name="Upload" :size="13" /> 合并导入</button>
        <button class="btn btn-ghost" @click="onReplaceClick"><Icon name="FileWarning" :size="13" /> 全量覆盖导入</button>
      </div>
      <span class="f-hint">导出项目/设置/待办/通知为 JSON 文件；换机或重装时用导入恢复。uTools 数据无云同步，建议定期导出。</span>
    </section>

    <section class="set-section">
      <h4><Icon name="Keyboard" :size="13" /> 快捷键</h4>
      <ul class="kb-list">
        <li><span class="kb-key">Ctrl K</span><span>命令面板（项目 / 脚本 / 导航 / 设置模糊搜索）</span></li>
        <li><span class="kb-key">/</span><span>聚焦搜索框</span></li>
        <li><span class="kb-key">J / K</span><span>列表中下移 / 上移项目</span></li>
        <li><span class="kb-key">Enter</span><span>打开聚焦的项目</span></li>
        <li><span class="kb-key">Esc</span><span>逐级返回（弹窗 → 控制台 → 仪表盘）</span></li>
      </ul>
    </section>

    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>
