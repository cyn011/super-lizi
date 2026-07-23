/**
 * tests/unit/events/event-bus.test.ts — E1.S3 EventBus 事件总线（架构 ADR-002）
 * 对应 E1.S3 验收要点「EventBus 单测通过」。纯 Node，不依赖 Phaser/WebGL。
 */
import { describe, it, expect } from 'vitest';
import { EventBus, ON_JUMP } from '../../../src/core/events/event-bus';

describe('E1.S3 EventBus 事件总线 (架构 ADR-002)', () => {
  it('emit 把 payload 投送给订阅者', () => {
    const bus = new EventBus();
    const received: unknown[] = [];
    bus.on(ON_JUMP, (p) => received.push(p));
    bus.emit(ON_JUMP, { x: 1 });
    expect(received).toEqual([{ x: 1 }]);
  });

  it('on 返回取消订阅函数，调用后不再接收', () => {
    const bus = new EventBus();
    let count = 0;
    const off = bus.on(ON_JUMP, () => count++);
    bus.emit(ON_JUMP);
    off();
    bus.emit(ON_JUMP);
    expect(count).toBe(1);
  });

  it('多订阅者均收到同一事件', () => {
    const bus = new EventBus();
    let a = 0;
    let b = 0;
    bus.on(ON_JUMP, () => a++);
    bus.on(ON_JUMP, () => b++);
    bus.emit(ON_JUMP);
    bus.emit(ON_JUMP);
    expect(a).toBe(2);
    expect(b).toBe(2);
  });

  it('clear 清空所有订阅', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on(ON_JUMP, () => count++);
    bus.clear();
    bus.emit(ON_JUMP);
    expect(count).toBe(0);
  });
});
