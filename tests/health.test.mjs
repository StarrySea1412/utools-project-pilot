// health.test.mjs — 外部服务上下线状态机（serviceTransitions）单测
import { describe, it, expect } from 'vitest';
import { serviceTransitions } from '../src/health.js';

const mk = (projectId, port, service = 'Vite') => ({ key: `${projectId}:${port}`, projectId, port, service });

describe('serviceTransitions 上下线状态机', () => {
  it('首轮扫描：只建基线，不产出任何事件', () => {
    const seen = {};
    const { next, downs, ups } = serviceTransitions(seen, [mk('p1', 5173), mk('p2', 8000, 'Uvicorn')], 1000);
    expect(downs).toEqual([]);
    expect(ups).toEqual([]);
    expect(Object.keys(next).sort()).toEqual(['p1:5173', 'p2:8000']);
    expect(next['p1:5173'].info.service).toBe('Vite');
  });

  it('服务消失：下线事件只带一次', () => {
    const r0 = serviceTransitions({}, [mk('p1', 5173)], 1000);
    const r1 = serviceTransitions(r0.next, [mk('p1', 5173)], 16000);
    expect(r1.downs).toEqual([]);

    // 下一轮端口消失 → 恰好一条下线，info 完整
    const r2 = serviceTransitions(r1.next, [], 31000);
    expect(r2.downs).toEqual([mk('p1', 5173)]);

    // 再下一轮仍消失：downNotified 已置位，不重复通知
    const r3 = serviceTransitions(r2.next, [], 46000);
    expect(r3.downs).toEqual([]);
    expect(r3.next['p1:5173'].downNotified).toBe(true);
  });

  it('恢复上线：清除标记，下次再下线会再次通知', () => {
    const r0 = serviceTransitions({}, [mk('p1', 5173)], 1000);
    const down = serviceTransitions(r0.next, [], 16000);
    expect(down.downs).toHaveLength(1);

    // 重新出现 → up 事件 + 标记清除
    const up = serviceTransitions(down.next, [mk('p1', 5173)], 31000);
    expect(up.ups).toEqual([mk('p1', 5173)]);
    expect(up.next['p1:5173'].downNotified).toBe(false);

    // 再次消失：能再次通知
    const down2 = serviceTransitions(up.next, [], 46000);
    expect(down2.downs).toEqual([mk('p1', 5173)]);
  });

  it('多服务：只报告消失的那个', () => {
    const r0 = serviceTransitions({}, [mk('p1', 5173), mk('p1', 3000, 'Next.js'), mk('p2', 8000, 'Uvicorn')], 1000);
    const r1 = serviceTransitions(r0.next, [mk('p1', 5173), mk('p2', 8000, 'Uvicorn')], 16000);
    expect(r1.downs).toEqual([mk('p1', 3000, 'Next.js')]);
    expect(r1.ups).toEqual([]);
  });

  it('baseline（收起恢复 / 休眠唤醒后的首轮）：端口全变了也不产事件，旧记录静默吞掉', () => {
    const r0 = serviceTransitions({}, [mk('p1', 5173), mk('p2', 8000)], 1000);
    // 长间隔后所有旧服务都没了、还出现了新端口：baseline 下不通知，旧记录带 downNotified 保留
    const r1 = serviceTransitions(r0.next, [mk('p1', 5174)], 3600000, { baseline: true });
    expect(r1.downs).toEqual([]);
    expect(r1.ups).toEqual([]);
    expect(Object.keys(r1.next).sort()).toEqual(['p1:5173', 'p1:5174', 'p2:8000']);
    expect(r1.next['p1:5173'].downNotified).toBe(true);
    expect(r1.next['p2:8000'].downNotified).toBe(true);
    expect(r1.next['p1:5174'].downNotified).toBe(false);
  });

  it('baseline 期间消失的服务不补发通知（用户大概率自己关的），重启后恢复检测', () => {
    const r0 = serviceTransitions({}, [mk('p1', 5173)], 1000);
    const r1 = serviceTransitions(r0.next, [], 3600000, { baseline: true }); // 长间隔：静默吞掉
    const r2 = serviceTransitions(r1.next, [], 3615000);                     // 仍不在：不补发
    expect(r2.downs).toEqual([]);
    // 重启上线 → 产出 up 事件并清除标记 → 之后真正下线能再次通知
    const up = serviceTransitions(r2.next, [mk('p1', 5173)], 3630000);
    expect(up.ups).toEqual([mk('p1', 5173)]);
    expect(up.next['p1:5173'].downNotified).toBe(false);
    const down2 = serviceTransitions(up.next, [], 3645000);
    expect(down2.downs).toEqual([mk('p1', 5173)]);
  });
});
