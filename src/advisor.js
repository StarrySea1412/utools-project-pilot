// advisor.js — 领航建议：规则引擎 + AI 增强
import { store, activeProject, projectPorts } from './store.js';

// 每条建议：{ id, icon, text, sub, level(0 提示/1 关注/2 紧急), projectId, action: {type, ...} }
// action.type: git(打开详情Git页) | open(打开URL) | detail | console | none

export function buildSuggestions() {
  const out = [];
  for (const p of store.projects) {
    const st = store.gitCache[p.id]?.status;
    const running = (p.scripts || []).filter((s) => s.persistent && store.procHandles[s.id]?.running);
    const failedTask = (p.tasks || []).find((t) => t.log?.[0] && !t.log[0].ok);

    if (st?.dirty > 0) {
      out.push({
        id: `dirty-${p.id}`, icon: 'Pencil', level: st.dirty > 8 ? 2 : 1,
        text: `「${p.name}」有 ${st.dirty} 个未提交变更`,
        sub: st.branch ? `${st.branch} 分支` : '',
        projectId: p.id, action: { type: 'git' },
      });
    }
    if (st?.behind > 0) {
      out.push({
        id: `behind-${p.id}`, icon: 'ArrowDown', level: 1,
        text: `「${p.name}」落后远程 ${st.behind} 个提交`,
        sub: '建议先拉取再继续开发，避免大冲突', projectId: p.id, action: { type: 'git' },
      });
    }
    if (st?.ahead > 2) {
      out.push({
        id: `ahead-${p.id}`, icon: 'ArrowUp', level: 1,
        text: `「${p.name}」领先远程 ${st.ahead} 个提交`,
        sub: '本地提交堆积较多，记得推送备份', projectId: p.id, action: { type: 'git' },
      });
    }
    if (running.length) {
      const ports = projectPorts(p);
      const portTxt = ports.length ? `，监听 ${ports.map((x) => ':' + x.port).slice(0, 3).join(' ')}` : '';
      out.push({
        id: `run-${p.id}`, icon: 'CircleDot', level: 0,
        text: `「${p.name}」服务运行中${portTxt}`,
        sub: running.map((s) => s.name).join('、'),
        projectId: p.id, action: ports.length ? { type: 'open', url: `http://localhost:${ports[0].port}` } : { type: 'detail' },
        actionText: ports.length ? '打开页面' : '查看项目',
      });
    }
    if (failedTask) {
      out.push({
        id: `taskfail-${p.id}`, icon: 'TriangleAlert', level: 2,
        text: `「${p.name}」自动任务「${failedTask.name}」最近一次执行失败`,
        sub: '点击查看运行日志，排查命令是否需要更新',
        projectId: p.id, action: { type: 'tasks' },
      });
    }
    const idleDays = Math.floor((Date.now() - (p.lastOpened || p.createdAt || Date.now())) / 864e5);
    if (idleDays >= 14 && !running.length) {
      out.push({
        id: `idle-${p.id}`, icon: 'Moon', level: 0,
        text: `「${p.name}」已 ${idleDays} 天没有打开`,
        sub: '考虑整理标签或归档，保持列表清爽', projectId: p.id, action: { type: 'detail' },
      });
    }
  }
  const totalDirty = store.projects.reduce((n, p) => n + (store.gitCache[p.id]?.status?.dirty || 0), 0);
  const ports = store.sys?.ports || [];
  if (!totalDirty && store.projects.length) {
    out.push({
      id: 'clean', icon: 'CircleCheck', level: 0,
      text: '所有项目工作区干净', sub: `当前系统共 ${ports.length} 个 TCP 端口在监听`,
      action: { type: 'none' },
    });
  }
  const weight = { 2: 0, 1: 1, 0: 2 };
  return out.sort((a, b) => weight[a.level] - weight[b.level]).slice(0, 8);
}

// AI 增强：把项目态势摘要发给模型，生成一段规划建议（旧接口，保留纯文本版）
export async function aiSuggestions() {
  const r = await aiAdvice();
  return [r.summary, ...r.items.map((i) => `- ${i.text}`)].filter(Boolean).join('\n');
}

// AI 今日建议：结构化输出，每条都带等级和动作，像规则建议一样可点击
// 返回 { summary, items: [{text, level, project, action}] }
const AI_ICONS = ['Pencil', 'ArrowDown', 'ArrowUp', 'CircleDot', 'TriangleAlert', 'Moon', 'Zap', 'Timer', 'Wrench', 'ShieldAlert', 'CalendarClock', 'Sparkles'];

export async function aiAdvice() {
  // 1) 组织上下文：项目态势 + 待办 + 最近提交主题 + 失败任务 + 端口
  const lines = store.projects.map((p) => {
    const st = store.gitCache[p.id]?.status;
    const running = (p.scripts || []).filter((s) => s.persistent && store.procHandles[s.id]?.running).map((s) => s.name);
    const idleDays = Math.floor((Date.now() - (p.lastOpened || p.createdAt || Date.now())) / 864e5);
    const failTask = (p.tasks || []).find((t) => t.log?.[0] && !t.log[0].ok);
    return `- ${p.name}${p.tags?.length ? ' [' + p.tags.join('/') + ']' : ''}: ` +
      `${st ? `分支 ${st.branch}，未提交 ${st.dirty}，↑${st.ahead} ↓${st.behind}` : '非 Git 或未读取'}, ` +
      `服务运行中: ${running.join(',') || '无'}, ${idleDays} 天未打开, 任务 ${(p.tasks || []).filter((t) => t.enabled).length} 个启用` +
      (failTask ? `, 任务「${failTask.name}」最近执行失败` : '');
  }).join('\n');
  const todos = store.todos.filter((t) => !t.done).slice(0, 10).map((t) => `- ${t.text}`).join('\n');
  const ports = (store.sys?.ports || []).slice(0, 30).map((x) => `:${x.port}(${x.names[0] || '?'})`).join(' ');

  let commits = '';
  try {
    const names = {};
    store.projects.forEach((p) => { names[p.name] = true; });
    const logs = await Promise.all(store.projects.slice(0, 8).map(async (p) => {
      try {
        const list = await window.pilot.git.log(p.path, 3);
        return list.map((c) => `${p.name}: ${c.subject}`).join('\n');
      } catch (e) { return ''; }
    }));
    commits = logs.filter(Boolean).join('\n');
  } catch (e) { /* 提交记录拿不到就算了 */ }

  const sys =
    '你是开发者的项目领航 Agent，根据项目态势输出 JSON（不要 markdown 代码围栏、不要多余文字），格式：' +
    '{"summary":"一句话今日重点","items":[{"text":"具体可执行的建议，一句话","level":0到2,"project":"相关项目名或空","action":"git|detail|tasks|none"}]}。' +
    'level：2=今天必须处理，1=值得关注，0=可安排的整理。items 3~6 条，按重要度排序。' +
    'action 表示点击后跳转的目标：git=该项目的Git变更页（有未提交/落后远程时用），tasks=任务页（任务失败时用），detail=项目概览，none=仅提示。' +
    'project 必须与给出的项目名完全一致，否则留空。summary 不超过 40 字，点明今天最该做的一件事。';

  const user =
    `今天是 ${new Date().toLocaleDateString('zh-CN')}。\n\n项目态势：\n${lines || '（暂无项目）'}` +
    (commits ? `\n\n最近提交：\n${commits}` : '') +
    (todos ? `\n\n待办事项：\n${todos}` : '') +
    `\n\n系统监听端口：${ports || '无'}`;

  const raw = await import('./store.js').then((m) => m.ai([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]));

  // 2) 解析：容错裁出 JSON，校验字段并回填 projectId
  const parsed = parseAdviceJson(raw);
  const byName = new Map(store.projects.map((p) => [p.name, p.id]));
  const items = parsed.items.slice(0, 6).map((it, i) => {
    const projectId = byName.get(it.project) || null;
    let action = { type: 'none' };
    if (projectId && ['git', 'detail', 'tasks'].includes(it.action)) action = { type: it.action };
    else if (projectId) action = { type: 'detail' };
    return {
      id: 'ai-' + i,
      icon: AI_ICONS[i % AI_ICONS.length],
      level: [0, 1, 2].includes(it.level) ? it.level : 0,
      text: String(it.text || '').slice(0, 120),
      sub: it.project || '',
      projectId, action, ai: true,
    };
  }).filter((it) => it.text);
  const weight = { 2: 0, 1: 1, 0: 2 };
  items.sort((a, b) => weight[a.level] - weight[b.level]);
  return { summary: String(parsed.summary || '').slice(0, 80), items };
}

function parseAdviceJson(raw) {
  const s = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  const j = JSON.parse(m ? m[0] : s);
  if (!j || typeof j !== 'object') throw new Error('AI 返回格式异常');
  j.items = Array.isArray(j.items) ? j.items : [];
  return j;
}
