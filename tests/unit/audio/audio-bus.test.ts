/**
 * tests/unit/audio/audio-bus.test.ts — S05-4 薄音频总线（audio-design.md §3.3）。
 *
 * 纯 Node（零 Phaser / 零 wx）。用真实 EventBus + MockAudioPort 验证：
 *   1) 每个登记事件 emit 一次 → 恰好一次对应 name 的 play；name 与 EVENT_TO_SFX 映射一致；
 *   2) ON_SCORE_CHANGED（D7）不触发 play（默认不映射）；
 *   3) destroy() 后事件不再转发 play。
 */
import { describe, it, expect } from 'vitest';
import { EventBus, ON_SCORE_CHANGED } from '../../../src/core/events/event-bus';
import type { AudioPort } from '../../../src/platform/platform';
import { AudioBus, EVENT_TO_SFX } from '../../../src/game/audio/audio-bus';

/** 记录 play 调用名/次数的 mock AudioPort。 */
class MockAudioPort implements AudioPort {
  calls: string[] = [];
  play(name: string): void {
    this.calls.push(name);
  }
  unlock(): void {
    /* no-op */
  }
  playMusic(name: string): void {
    this.calls.push(name);
  }
  stopMusic(): void {
    /* no-op */
  }
  isRunning(): boolean {
    return false;
  }
}

describe('AudioBus · 事件 → play(name) 映射（S05-4）', () => {
  it('每个登记事件 emit 一次 → 恰好一次对应 name 的 play', () => {
    const events = Object.keys(EVENT_TO_SFX);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      const bus = new EventBus();
      const audio = new MockAudioPort();
      const ab = new AudioBus(bus, audio);
      bus.emit(ev, {});
      expect(audio.calls, `事件 ${ev} 应恰好 play 一次`).toEqual([EVENT_TO_SFX[ev]]);
      ab.destroy();
    }
  });

  it('ON_SCORE_CHANGED（D7 默认不映射）不触发任何 play', () => {
    const bus = new EventBus();
    const audio = new MockAudioPort();
    const ab = new AudioBus(bus, audio);
    bus.emit(ON_SCORE_CHANGED, { score: 0, coins: 0, comboMult: 1 });
    expect(audio.calls).toEqual([]);
    ab.destroy();
  });

  it('destroy() 后事件不再转发 play（解绑生效）', () => {
    const bus = new EventBus();
    const audio = new MockAudioPort();
    const ab = new AudioBus(bus, audio);
    ab.destroy();
    bus.emit('ON_JUMP', {});
    bus.emit('ON_LAND', {});
    expect(audio.calls).toEqual([]);
  });

  it('同一事件多次 emit → 每次都 play（不丢失，不重复订阅叠加）', () => {
    const bus = new EventBus();
    const audio = new MockAudioPort();
    const ab = new AudioBus(bus, audio);
    bus.emit('ON_COIN', {});
    bus.emit('ON_COIN', {});
    bus.emit('ON_COIN', {});
    expect(audio.calls).toEqual(['sfx:coin', 'sfx:coin', 'sfx:coin']);
    ab.destroy();
  });
});
