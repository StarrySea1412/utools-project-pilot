<script setup>
// WeeklyReport.vue — AI 周报：汇总全部项目最近 7 天的提交，生成可复制/保存的中文周报
import { ref, computed, onMounted } from 'vue';
import { store, ai } from '../store.js';
import { toast, closeModal } from '../ui.js';
import Icon from './Icon.vue';

const DAYS = 7;
const busy = ref(false);
const stage = ref('idle'); // idle -> collecting -> generating -> done
const stats = ref(null);   // {total, projects: [{name, count}]}
const report = ref('');
const error = ref('');

// 取每个项目近 7 天的提交（git log --since）
async function collectCommits() {
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();
  const per = await Promise.all(store.projects.map(async (p) => {
    try {
      const list = await window.pilot.git.log(p.path, 100);
      return {
        name: p.name,
        commits: list.filter((c) => new Date(c.date).getTime() >= Date.now() - DAYS * 864e5),
      };
    } catch (e) { return { name: p.name, commits: [] }; }
  }));
  return per;
}

async function generate() {
  busy.value = true; error.value = '';
  try {
    stage.value = 'collecting';
    const per = await collectCommits();
    const withCommits = per.filter((x) => x.commits.length);
    stats.value = { total: withCommits.reduce((n, x) => n + x.commits.length, 0), projects: withCommits.map((x) => ({ name: x.name, count: x.commits.length })) };

    if (!stats.value.total) { stage.value = 'idle'; busy.value = false; error.value = `最近 ${DAYS} 天没有任何项目的提交记录`; return; }

    stage.value = 'generating';
    const lines = withCommits.map((x) =>
      `## ${x.name}（${x.commits.length} 个提交）\n` + x.commits.map((c) => `- ${c.subject} (${c.author}, ${c.date.slice(0, 10)})`).join('\n')
    ).join('\n\n');
    const sys =
      '你是开发团队的技术写作助手。根据给出的多项目提交记录，输出一封中文周报（Markdown）：' +
      '第一行一句话概括本周主题；然后按项目分节，每节 2~4 条要点（合并同类提交，突出成果而非流水账）；' +
      '最后一段「风险与建议」（如有）。只依据给出的记录，不要编造。';
    const user = `时间范围：最近 ${DAYS} 天（${new Date(Date.now() - DAYS * 864e5).toLocaleDateString('zh-CN')} ~ 今天）\n\n提交记录：\n${lines}`;
    report.value = await ai([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ]);
    stage.value = 'done';
    toast('周报已生成', 'ai');
  } catch (e) { error.value = e.message || String(e); stage.value = 'idle'; }
  busy.value = false;
}

function copy() {
  window.pilot.copyText(report.value);
  toast('已复制到剪贴板', 'ok');
}
function saveToNotes() {
  // 保存到一个「周报」伪项目会太重，这里存到导出文件更实用——复用 exportJson
  const name = `weekly-report-${new Date().toISOString().slice(0, 10)}.md`;
  const file = window.pilot?.exportJson?.(name, report.value);
  if (file) toast('已保存到 ' + file, 'ok');
  else toast('当前环境不支持保存文件', 'err');
}
onMounted(generate);
</script>

<template>
  <div class="modal-body-inner weekly">
    <div class="wk-head">
      <span class="hint">
        <template v-if="stage === 'collecting'">正在收集全部项目的提交记录…</template>
        <template v-else-if="stage === 'generating'">AI 正在整理周报…</template>
        <template v-else-if="stats">最近 7 天 {{ stats.projects.length }} 个项目共 {{ stats.total }} 个提交</template>
        <template v-else>汇总全部项目最近 7 天的提交，AI 生成中文周报</template>
      </span>
      <span class="spacer"></span>
      <button class="btn btn-ghost" :disabled="busy" @click="generate"><Icon name="RefreshCw" :size="13" /> 重新生成</button>
    </div>

    <div v-if="stats && stats.projects.length" class="wk-stats">
      <span v-for="p in stats.projects" :key="p.name" class="mini-tag mono">{{ p.name }} ×{{ p.count }}</span>
    </div>

    <p v-if="error" class="hint err-text">{{ error }}</p>

    <pre v-if="report" class="wk-report mono">{{ report }}</pre>
    <div v-else-if="busy" class="loading-panel">生成中，提交多时约需十几秒…</div>

    <div class="btn-row" style="margin-top: 10px">
      <button v-if="report" class="btn btn-ghost" @click="copy"><Icon name="Copy" :size="13" /> 复制</button>
      <button v-if="report" class="btn btn-ghost" @click="saveToNotes"><Icon name="Download" :size="13" /> 保存为文件</button>
      <span class="spacer"></span>
      <button class="btn btn-ghost" @click="closeModal()">关闭</button>
    </div>
  </div>
</template>
