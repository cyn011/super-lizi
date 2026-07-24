/**
 * tests/unit/beat/advance-beat.test.ts — S05-1 统一节拍门控（core 纯逻辑）。
 *
 * 验证 advanceBeat 三件事：
 *   ① 启用时跨拍 emit ON_BEAT 且返回 beatIndex；未跨拍不 emit、返回 -1；
 *   ② 禁用时不 emit、返回 -1；
 *   ③ 确定性：同输入序列 → 同 ON_BEAT 序列 + 同 beatIndex 序列（双端等价证据）。
 * game-scene 与 headless 共用此函数，保证门控一致。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { BeatClock } from '../../../src/core/beat/beat-clock';
import { EventBus, ON_BEAT } from '../../../src/core/events/event-bus';
import { advanceBeat } from '../../../src/core/beat/advance-beat';

describe('S05-1 advanceBeat 统一节拍门控', () => {
  it('启用时跨拍 emit ON_BEAT 且返回 beatIndex；未跨拍不 emit', () => {
    const beat = new BeatClock({ enabled: true, bpm: 120, grid: 8, tracks: [] });
    const bus = new EventBus();
    const got: unknown[] = [];
    bus.on(ON_BEAT, (p) => got.push(p));

    // simTimeMs=0 → 第 0 拍（lastBeat -1→0）跨拍，emit
    const r0 = advanceBeat(beat, 0, bus, () => {});
    expect(r0).toBe(0);
    expect(got.length).toBe(1);

    // 仍在第 0 拍内（<62.5ms）→ 不跨拍、不 emit
    const r1 = advanceBeat(beat, 60, bus, () => {});
    expect(r1).toBe(-1);
    expect(got.length).toBe(1);

    // 进入第 1 拍（≥62.5ms）→ 跨拍，emit；payload.beat=1
    const r2 = advanceBeat(beat, 62.5, bus, () => {});
    expect(r2).toBe(1);
    expect(got.length).toBe(2);
    expect(got[1]).toEqual({ beat: 1 });
  });

  it('onBeat 回调仅在跨拍时触发，传入 beatIndex', () => {
    const beat = new BeatClock({ enabled: true, bpm: 120, grid: 8, tracks: [] });
    const bus = new EventBus();
    const idxs: number[] = [];
    advanceBeat(beat, 0, bus, (i) => idxs.push(i));
    advanceBeat(beat, 60, bus, (i) => idxs.push(i)); // 未跨拍
    advanceBeat(beat, 62.5, bus, (i) => idxs.push(i));
    expect(idxs).toEqual([0, 1]);
  });

  it('禁用时不 emit、返回 -1', () => {
    const beat = new BeatClock({ enabled: false, bpm: 120, grid: 8, tracks: [] });
    const bus = new EventBus();
    let count = 0;
    bus.on(ON_BEAT, () => count++);
    const r = advanceBeat(beat, 1000, bus, () => {});
    expect(r).toBe(-1);
    expect(count).toBe(0);
  });

  it('确定性：同输入序列 → 同 beatIndex 序列 + 同事件数', () => {
    const run = () => {
      const beat = new BeatClock({ enabled: true, bpm: 120, grid: 8, tracks: [] });
      const bus = new EventBus();
      const seq: number[] = [];
      let events = 0;
      bus.on(ON_BEAT, () => events++);
      for (let i = 0; i < 20; i++) advanceBeat(beat, i * 16.6667, bus, (idx) => seq.push(idx));
      return { seq, events };
    };
    const a = run();
    const b = run();
    expect(a.seq).toEqual(b.seq);
    expect(a.events).toBe(b.events);
    expect(a.seq.length).toBeGreaterThan(0);
  });
});
