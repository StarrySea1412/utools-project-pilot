<script setup>
import { ref } from 'vue';
import { store, saveSettings } from '../store.js';
import { toast, closeModal, openModal, applyTheme } from '../ui.js';
import ModeModal from './ModeModal.vue';

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
</script>

<template>
  <div class="modal-body-inner settings-body">
    <section class="set-section">
      <h4>🤖 AI 服务（OpenAI 兼容接口）</h4>
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
      <h4>✦ 提交信息生成提示词</h4>
      <label class="field"><span class="f-label">System 提示词</span>
        <textarea v-model="commitPrompt" class="input mono" rows="4"></textarea>
        <span class="f-hint">留空使用默认。定义 AI 生成 commit message 的风格与规范。</span>
      </label>
    </section>

    <section class="set-section">
      <h4>📊 提交记录分析模式（{{ store.settings.analysisModes.length }}）</h4>
      <ul class="mode-manage">
        <li v-for="m in store.settings.analysisModes" :key="m.id">
          <span>{{ m.name }}</span>
          <span class="mini-tag" :class="{ svc: !m.builtin }">{{ m.builtin ? '内置' : '自定义' }}</span>
          <button class="icon-btn" @click="editMode(m)">✏️</button>
        </li>
      </ul>
      <button class="btn btn-ghost" @click="addMode">＋ 添加自定义模式</button>
    </section>

    <section class="set-section">
      <h4>🎨 外观</h4>
      <div class="field"><span class="f-label">主题</span>
        <select v-model="theme" class="select full">
          <option value="auto">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </div>
    </section>

    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-ghost" @click="closeModal()">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>
