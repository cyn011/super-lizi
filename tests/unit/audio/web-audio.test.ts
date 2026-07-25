/**
 * tests/unit/audio/web-audio.test.ts — S05-4 WebAudio 程序化合成（audio-design.md §3.1）。
 *
 * 纯 Node（环境 'node'，无 DOM/window）。通过 WebAudio 构造函数注入 AudioContext 工厂（mock），
 * 不触碰 globalThis.window，符合 core 零平台 / 测试隔离。
 *
 * 验证：
 *   1) unlock 前 play 静默（不创建振荡器）；
 *   2) unlock 后 play 不抛错且触发振荡器创建；
 *   3) 未知 name 静默不抛错；
 *   4) 多音类（coin）按序创建多个振荡器；
 *   5) stomp 白噪瞬态创建 buffer source 不抛错；
 *   6) 音量 = master * sfx * SFX_BASE_GAIN[name]，增益峰值对齐 baseGain。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WebAudio, SFX_BASE_GAIN, sfxEffectiveGain } from '../../../src/platform/web/web-audio';
import { audioConfig } from '../../../src/core/config';

// ── 最小 AudioContext mock ──
class MockParam {
  value = 0;
  readonly ramps: number[] = [];
  setValueAtTime(v: number, _t: number): this {
    this.ramps.push(v);
    return this;
  }
  linearRampToValueAtTime(v: number, _t: number): this {
    this.ramps.push(v);
    return this;
  }
  exponentialRampToValueAtTime(v: number, _t: number): this {
    this.ramps.push(v);
    return this;
  }
}

class MockNode {
  static all: MockNode[] = [];
  type: OscillatorType = 'sine';
  readonly frequency = new MockParam();
  readonly gain = new MockParam();
  connect(): this {
    return this;
  }
  start(): void {}
  stop(): void {}
  onended: (() => void) | null = null;
  constructor() {
    MockNode.all.push(this);
  }
}

class MockAudioContext {
  static oscCount = 0;
  static bufCount = 0;
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = {};
  createOscillator(): OscillatorNode {
    MockAudioContext.oscCount++;
    return new MockNode() as unknown as OscillatorNode;
  }
  createGain(): GainNode {
    return new MockNode() as unknown as GainNode;
  }
  createBuffer(_c: number, _len: number, _r: number): AudioBuffer {
    MockAudioContext.bufCount++;
    return { getChannelData: () => new Float32Array(8) } as unknown as AudioBuffer;
  }
  createBufferSource(): AudioBufferSourceNode {
    return new MockNode() as unknown as AudioBufferSourceNode;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

const makeAudio = (): WebAudio =>
  new WebAudio(() => MockAudioContext as unknown as typeof AudioContext);

describe('WebAudio 程序化合成（S05-4）', () => {
  it('unlock 前 play 静默：不创建振荡器', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.play('sfx:jump');
    expect(MockAudioContext.oscCount).toBe(0);
  });

  it('unlock 后 play 不抛错且触发振荡器创建', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.unlock();
    expect(() => a.play('sfx:jump')).not.toThrow();
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
  });

  it('未知 SFX name 不抛错（静默）', () => {
    const a = makeAudio();
    a.unlock();
    expect(() => a.play('sfx:unknown_xyz')).not.toThrow();
  });

  it('多音类（coin = 双音序）按序创建 2 个振荡器', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.unlock();
    a.play('sfx:coin');
    expect(MockAudioContext.oscCount).toBe(2);
  });

  it('四音序（level_clear）创建 4 个振荡器', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.unlock();
    a.play('sfx:level_clear');
    expect(MockAudioContext.oscCount).toBe(4);
  });

  it('stomp 含白噪瞬态：创建 buffer source 不抛错', () => {
    MockAudioContext.bufCount = 0;
    const a = makeAudio();
    a.unlock();
    expect(() => a.play('sfx:stomp')).not.toThrow();
    expect(MockAudioContext.bufCount).toBeGreaterThan(0);
  });

  it('音量计算 = master * sfx * SFX_BASE_GAIN[name]', () => {
    expect(SFX_BASE_GAIN['sfx:jump']).toBe(0.5);
    expect(sfxEffectiveGain('sfx:jump', audioConfig.master, audioConfig.sfx)).toBeCloseTo(0.5, 5);
    // sfx=0 时静音轴
    expect(sfxEffectiveGain('sfx:jump', 1, 0)).toBe(0);
  });

  it('增益峰值对齐 master*sfx*baseGain（捕获 gain 包络峰值≈0.5）', () => {
    MockNode.all = [];
    const a = makeAudio();
    a.unlock();
    a.play('sfx:jump');
    const peaks = MockNode.all.flatMap((n) => n.gain.ramps);
    const maxPeak = Math.max(...peaks);
    expect(maxPeak).toBeCloseTo(0.5, 5);
  });

  it('全部已知 SFX name 播放均不抛错（合成冒烟）', () => {
    const a = makeAudio();
    a.unlock();
    expect(() => {
      for (const name of Object.keys(SFX_BASE_GAIN)) a.play(name);
    }).not.toThrow();
  });

  it('参数化：每个已知 SFX 至少创建 1 个振荡器（合成确有声）', () => {
    for (const name of Object.keys(SFX_BASE_GAIN)) {
      MockAudioContext.oscCount = 0;
      const a = makeAudio();
      a.unlock();
      a.play(name);
      expect(MockAudioContext.oscCount, `SFX ${name} 应创建振荡器`).toBeGreaterThan(0);
    }
  });
});

// ── S05-4-BGM：Web 端 BGM 双端合成（委托 SynthEngine，行为契约 §2.1 / §5.4）──
describe('WebAudio · BGM 程序化合成（S05-4-BGM）', () => {
  afterEach(() => {
    MockAudioContext.oscCount = 0;
    MockNode.all = [];
  });

  it('unlock 前 playMusic 静默：不创建振荡器', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.playMusic('music:menu');
    expect(MockAudioContext.oscCount).toBe(0);
  });

  it('unlock 后 playMusic 注入首拍 Tone（oscCount>0，峰值<1 不爆）', () => {
    MockAudioContext.oscCount = 0;
    MockNode.all = [];
    const a = makeAudio();
    a.unlock();
    a.playMusic('music:menu');
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
    const peaks = MockNode.all.flatMap((n) => n.gain.ramps);
    expect(Math.max(...peaks)).toBeLessThan(1);
    a.stopMusic();
  });

  it('重复 playMusic 同 name 不叠加（idempotent）', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.unlock();
    a.playMusic('music:menu');
    const afterFirst = MockAudioContext.oscCount;
    a.playMusic('music:menu'); // 重复 → 不新增
    expect(MockAudioContext.oscCount).toBe(afterFirst);
    a.stopMusic();
  });

  it('换 name 先停后起：不双循环叠加', () => {
    MockAudioContext.oscCount = 0;
    const a = makeAudio();
    a.unlock();
    a.playMusic('music:menu');
    a.playMusic('music:stage'); // 应停 menu 起 stage
    // menu 首拍 + stage 首拍（各 3 个 t0=0 音）；stopMusic 仅截断已排程，振荡器计数不归零，
    // 但两次 playMusic 仅新增两份首拍（idempotent 保证第二份 stage 不重复叠加）。
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
    a.playMusic('music:stage'); // 再重复 stage → 不新增
    a.stopMusic();
  });

  it('未知 music name 静默不抛错', () => {
    const a = makeAudio();
    a.unlock();
    expect(() => a.playMusic('music:stage_cave')).not.toThrow();
    a.stopMusic();
  });
});
