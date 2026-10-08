// store/doctor.js — 项目体检域：采集 → 规则评分 → AI 结构化报告 → 按项目按天缓存
// 与探索模式同一持久化模式（store/explore）但数据与口径独立，不互相干扰。
import { store, today } from './state.js';

export function saveDoctor(projectId, data) {
  store.doctor[projectId] = { date: today(), at: Date.now(), ...data };
  try { window.pilot?.dbPut('pilot:doctor', store.doctor); } catch (e) { console.error('保存体检结果失败', e); }
}

// 主流程：采集 → 规则兜底 → （可选）AI 深度报告。
// 返回 {report, rule, data}：report 展示层用（AI 成功为 AI 报告，失败降级为规则），rule 始终为离线基线。
export async function runDoctor(proj, { withAi = true } = {}) {
  if (!proj || !proj.path) throw new Error('项目不存在');
  const { ruleCheckup, buildDoctorPrompt, parseDoctorJson, gradeOf } = await import('../doctor.js');
  const data = await window.pilot.inspect.inspect(proj.path);
  if (!data || !data.ok) throw new Error((data && data.error) || '采集失败');
  const rule = ruleCheckup(data);

  let report = { score: rule.score, grade: rule.grade, summary: rule.dims[0] ? '本地规则体检（未启用 AI）' : '', dims: rule.dims, items: rule.items };
  if (withAi && store.settings.ai?.baseUrl && store.settings.ai?.apiKey && store.settings.ai?.model) {
    const { ai } = await import('./ai.js');
    const { sys, user } = buildDoctorPrompt(data, rule);
    const raw = await ai([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ]);
    const parsed = parseDoctorJson(raw);
    report = { ...parsed, items: parsed.items.length ? parsed.items : rule.items };
  }
  saveDoctor(proj.id, { ...report, ruleScore: rule.score, ruleGrade: rule.grade, notes: data.notes || [] });
  return { report, rule, data };
}
