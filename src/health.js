// health.js — 外部服务上下线状态机（纯函数，便于单测）
// 以「扫描周期」为单位比较前后两轮端口归属：上一轮在、这一轮不在 = 下线（通知一次）；
// downNotified 的服务重新出现 = 恢复上线（清除标记，下次下线再通知）。
// baseline=true 时只重建基线不产出事件——用于插件恢复显示 / 休眠唤醒后的首轮扫描，
// 此时端口变化是长时间累积的，逐条通知只会刷屏。

// seen:   { [key]: { lastSeenAt, downNotified, info } }   上一轮的在线清单（key = `${projectId}:${port}`）
// matched: [{ key, projectId, port, service }]             本轮扫描归属到项目的外部 HTTP 服务
export function serviceTransitions(seen, matched, now, { baseline = false } = {}) {
  const downs = [];
  const ups = [];
  const next = {};
  for (const m of matched) {
    const prev = seen[m.key];
    if (!baseline && prev && prev.downNotified) ups.push(m);
    next[m.key] = { lastSeenAt: now, downNotified: false, info: m };
  }
  if (!baseline) {
    for (const key of Object.keys(seen)) {
      const rec = seen[key];
      if (!next[key]) {
        if (!rec.downNotified) downs.push({ ...rec.info });
        // 记录必须保留（带 downNotified），否则下一条扫描周期会重复通知
        next[key] = { ...rec, downNotified: true };
      }
    }
  } else {
    // 长间隔（收起恢复 / 休眠唤醒）内消失的服务：静默吞掉，不补发通知；
    // 服务重新上线时由 matched 分支清除标记，之后恢复正常检测
    for (const [key, rec] of Object.entries(seen)) {
      if (!next[key]) next[key] = { ...rec, downNotified: true };
    }
  }
  return { next, downs, ups };
}
