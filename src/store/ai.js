// store/ai.js — AI 域：OpenAI 兼容调用封装 / 提交信息生成 / 提交记录分析 / 按天持久化
import { store, today } from './state.js';

export function ai(messages) {
  const { baseUrl, apiKey, model } = store.settings.ai || {};
  if (!baseUrl || !apiKey || !model) throw new Error('请先在设置中配置 AI 服务（Base URL / API Key / 模型）');
  return window.pilot.aiChat({ baseUrl, apiKey, model, messages });
}

const MAX_DIFF_CHARS = 14000, MAX_LOG_CHARS = 12000;

export async function genCommitMessage(proj, stagedFiles) {
  const parts = [];
  let total = 0;
  for (const f of stagedFiles.slice(0, 30)) {
    const d = await window.pilot.git.diffFile(proj.path, f, true);
    const add = d.length > MAX_DIFF_CHARS ? d.slice(0, MAX_DIFF_CHARS) + '\n...[截断]' : d;
    parts.push(`### ${f.path}\n${add}`);
    total += add.length;
    if (total > MAX_DIFF_CHARS) break;
  }
  if (!parts.length) throw new Error('暂存区没有文件，请先暂存要提交的变更');
  const sys = store.settings.commitPrompt || window.pilot.defaultCommitPrompt;
  const text = await ai([
    { role: 'system', content: sys },
    { role: 'user', content: `变更文件列表：\n${stagedFiles.map((f) => f.path).join('\n')}\n\n以下是 git diff（已暂存）：\n\n${parts.join('\n\n')}` },
  ]);
  return text.replace(/^[`"'\s]+|[`"'\s]+$/g, '').split('\n').filter(Boolean).slice(0, 3).join('\n');
}

export async function analyzeHistory(proj, mode, commits) {
  const lines = commits.map((c) => {
    let s = `- ${c.subject} (${c.short}, ${c.author}, ${c.date.slice(0, 10)})`;
    if (c.body) s += `\n  ${c.body.replace(/\n+/g, ' / ').slice(0, 160)}`;
    return s;
  }).join('\n');
  return ai([
    { role: 'system', content: '你是软件工程分析助手，只依据给出的提交记录做分析，用简体中文输出，条理清晰，不要编造记录之外的信息。' },
    { role: 'user', content: `项目：${proj.name}\n\n最近的提交记录：\n${lines.slice(0, MAX_LOG_CHARS)}\n\n分析任务：${mode.prompt}` },
  ]);
}

// ---------- AI 今日建议（按天持久化，一天一份） ----------
export function saveAiAdvice(data) {
  store.aiAdvice = { date: today(), at: Date.now(), ...data };
  try { window.pilot?.dbPut('pilot:aiAdvice', store.aiAdvice); } catch (e) { console.error('保存 AI 建议失败', e); }
}

// ---------- 探索模式（按项目 × 按天缓存 AI 评估结果） ----------
export function saveExplore(projectId, data) {
  store.explore[projectId] = { date: today(), at: Date.now(), ...data };
  try { window.pilot?.dbPut('pilot:explore', store.explore); } catch (e) { console.error('保存探索结果失败', e); }
}
