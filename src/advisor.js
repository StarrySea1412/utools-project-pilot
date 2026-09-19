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
        id: `dirty-${p.id}`, icon: '✏️', level: st.dirty > 8 ? 2 : 1,
        text: `「${p.name}」有 ${st.dirty} 个未提交变更`,
        sub: st.branch ? `${st.branch} 分支` : '',
        projectId: p.id, action: { type: 'git' },
      });
    }
    if (st?.behind > 0) {
      out.push({
        id: `behind-${p.id}`, icon: '⬇️', level: 1,
        text: `「${p.name}」落后远程 ${st.behind} 个提交`,
        sub: '建议先拉取再继续开发，避免大冲突', projectId: p.id, action: { type: 'git' },
      });
    }
    if (st?.ahead > 2) {
      out.push({
        id: `ahead-${p.id}`, icon: '⬆️', level: 1,
        text: `「${p.name}」领先远程 ${st.ahead} 个提交`,
        sub: '本地提交堆积较多，记得推送备份', projectId: p.id, action: { type: 'git' },
      });
    }
    if (running.length) {
      const ports = projectPorts(p);
      const portTxt = ports.length ? `，监听 ${ports.map((x) => ':' + x.port).slice(0, 3).join(' ')}` : '';
      out.push({
        id: `run-${p.id}`, icon: '🟢', level: 0,
        text: `「${p.name}」服务运行中${portTxt}`,
        sub: running.map((s) => s.name).join('、'),
        projectId: p.id, action: ports.length ? { type: 'open', url: `http://localhost:${ports[0].port}` } : { type: 'detail' },
        actionText: ports.length ? '打开页面' : '查看项目',
      });
    }
    if (failedTask) {
      out.push({
        id: `taskfail-${p.id}`, icon: '⚠️', level: 2,
        text: `「${p.name}」自动任务「${failedTask.name}」最近一次执行失败`,
        sub: '点击查看运行日志，排查命令是否需要更新',
        projectId: p.id, action: { type: 'tasks' },
      });
    }
    const idleDays = Math.floor((Date.now() - (p.lastOpened || p.createdAt || Date.now())) / 864e5);
    if (idleDays >= 14 && !running.length) {
      out.push({
        id: `idle-${p.id}`, icon: '💤', level: 0,
        text: `「${p.name}」已 ${idleDays} 天没有打开`,
        sub: '考虑整理标签或归档，保持列表清爽', projectId: p.id, action: { type: 'detail' },
      });
    }
  }
  const totalDirty = store.projects.reduce((n, p) => n + (store.gitCache[p.id]?.status?.dirty || 0), 0);
  const ports = store.sys?.ports || [];
  if (!totalDirty && store.projects.length) {
    out.push({
      id: 'clean', icon: '✅', level: 0,
      text: '所有项目工作区干净', sub: `当前系统共 ${ports.length} 个 TCP 端口在监听`,
      action: { type: 'none' },
    });
  }
  const weight = { 2: 0, 1: 1, 0: 2 };
  return out.sort((a, b) => weight[a.level] - weight[b.level]).slice(0, 8);
}

// AI 增强：把项目态势摘要发给模型，生成一段规划建议
export async function aiSuggestions() {
  const lines = store.projects.map((p) => {
    const st = store.gitCache[p.id]?.status;
    const running = (p.scripts || []).filter((s) => s.persistent && store.procHandles[s.id]?.running).map((s) => s.name);
    const idleDays = Math.floor((Date.now() - (p.lastOpened || p.createdAt || Date.now())) / 864e5);
    return `- ${p.name}${p.tags?.length ? ' [' + p.tags.join('/') + ']' : ''}: ` +
      `${st ? `分支 ${st.branch}，未提交 ${st.dirty}，↑${st.ahead} ↓${st.behind}` : '非 Git 或未读取'}, ` +
      `服务运行中: ${running.join(',') || '无'}, ${idleDays} 天未打开, 任务 ${(p.tasks || []).filter((t) => t.enabled).length} 个启用`;
  }).join('\n');
  const ports = (store.sys?.ports || []).slice(0, 30).map((x) => `:${x.port}(${x.names[0] || '?'})`).join(' ');
  const text = await import('./store.js').then((m) => m.ai([
    { role: 'system', content: '你是开发者的项目管理领航助手。根据给出的项目态势与系统端口，给出 4~6 条简短可执行的中文建议（每条一行，以 - 开头），覆盖：优先处理的事项、风险、可安排的整理工作。不要输出标题和解释。' },
    { role: 'user', content: `项目态势：\n${lines}\n\n系统监听端口：${ports}\n\n今天是 ${new Date().toLocaleDateString('zh-CN')}。` },
  ]));
  return text;
}
