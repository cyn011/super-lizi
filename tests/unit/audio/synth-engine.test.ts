/**
 * tests/unit/audio/synth-engine.test.ts — S05-4-BGM 共享合成引擎直测（audio-bgm-design.md）。
 *
 * 纯 Node（零 Phaser / 零 wx）。直接构造 SynthEngine（ctx 由 mock 注入），验证：
 *   1) MUSIC_SPECS 结构完整（menu/stage、perc 仅 stage）；
 *   2) playMusic 注入首拍 Tone 且峰值 < 1（不爆音）；
 *   3) unlock 前（ctx=null）playMusic/play no-op；
 *   4) 重复同 name 不叠加（仅启动一个调度器，timer 级证据）；
 *   5) 换 name 先停后起（clearInterval 旧 + setInterval 新，单循环）；
 *   6) 未知 name no-op；stopMusic 可重启；
 *   7) music=0 静音轴；SFX 照常发声（无回归）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SynthEngine,
  MUSIC_SPECS,
  MUSIC_BASE_GAIN,
} from '../../../src/platform/shared/synth-engine';

class MockParam {
  value = 0;
  readonly ramps: number[] = [];
  setValueAtTime(v: number): this {
    this.ramps.push(v);
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.ramps.push(v);
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
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
  createBufferSource(): AudioBufferSourceNode {
    return new MockNode() as unknown as AudioBufferSourceNode;
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    const c = {
      threshold: new MockParam(),
      ratio: new MockParam(),
      attack: new MockParam(),
      release: new MockParam(),
      knee: new MockParam(),
      connect() {},
    };
    return c as unknown as DynamicsCompressorNode;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

const makeCtor = (): typeof AudioContext => MockAudioContext as unknown as typeof AudioContext;

const baseConfig = { master: 1, sfx: 1, music: 0.5, unlockOnInteraction: true };

function makeEngine(music = 0.5): SynthEngine {
  const cfg = { ...baseConfig, music };
  const engine = new SynthEngine(null, cfg as unknown as typeof baseConfig);
  engine.unlock(makeCtor); // 构建 ctx = new MockAudioContext()
  return engine;
}

describe('SynthEngine · BGM 调度（S05-4-BGM）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    MockAudioContext.oscCount = 0;
    MockNode.all = [];
  });

  it('MUSIC_SPECS 含 menu/stage；perc 仅 stage 有', () => {
    expect(Object.keys(MUSIC_SPECS).sort()).toEqual(['music:menu', 'music:stage']);
    expect(MUSIC_SPECS['music:menu'].voices.perc).toBeUndefined();
    expect(MUSIC_SPECS['music:stage'].voices.perc!.length).toBeGreaterThan(0);
    expect(MUSIC_BASE_GAIN['music:menu']).toBe(0.5);
    expect(MUSIC_BASE_GAIN['music:stage']).toBe(0.5);
  });

  it('playMusic 注入首拍 Tone（oscCount>0，峰值<1 不爆）', () => {
    MockAudioContext.oscCount = 0;
    MockNode.all = [];
    const e = makeEngine();
    e.playMusic('music:menu');
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
    const peaks = MockNode.all.flatMap((n) => n.gain.ramps);
    expect(Math.max(...peaks)).toBeLessThan(1);
    e.stopMusic();
  });

  it('unlock 前（ctx=null）playMusic / play 静默 no-op', () => {
    MockAudioContext.oscCount = 0;
    const e = new SynthEngine(null, baseConfig as unknown as typeof baseConfig);
    e.playMusic('music:menu');
    e.play('sfx:jump');
    expect(MockAudioContext.oscCount).toBe(0);
  });

  it('重复同 name 不叠加：仅启动一个调度器', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    vi.spyOn(globalThis, 'clearInterval');
    const e = makeEngine();
    e.playMusic('music:menu');
    e.playMusic('music:menu'); // idempotent → 不新起调度器
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    e.stopMusic();
  });

  it('换 name 先停后起：单循环（clearInterval 旧 + setInterval 新）', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const e = makeEngine();
    e.playMusic('music:menu');
    e.playMusic('music:stage');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1); // 停 menu
    expect(setIntervalSpy).toHaveBeenCalledTimes(2); // menu + stage
    e.stopMusic();
  });

  it('未知 music name no-op（不启动调度器）', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const e = makeEngine();
    e.playMusic('music:stage_cave');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    e.stopMusic();
  });

  it('stopMusic 清除调度器且可重启', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const e = makeEngine();
    e.playMusic('music:stage');
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    e.stopMusic();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    e.playMusic('music:stage'); // 重启
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    e.stopMusic();
  });

  it('music=0 静音轴：playMusic 不创建振荡器', () => {
    MockAudioContext.oscCount = 0;
    const e = makeEngine(0);
    e.playMusic('music:menu');
    expect(MockAudioContext.oscCount).toBe(0);
    e.stopMusic();
  });

  it('SFX 无回归：play 创建振荡器', () => {
    MockAudioContext.oscCount = 0;
    const e = makeEngine();
    e.play('sfx:jump');
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
  });
});
