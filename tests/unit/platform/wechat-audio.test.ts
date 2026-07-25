/**
 * tests/unit/platform/wechat-audio.test.ts — S05-4-BGM 微信端 WebAudio 合成（audio-bgm-design.md）。
 *
 * 纯 Node（零 Phaser / 零素材）。验证重构后微信端不再依赖 CDN / InnerAudioContext，改为
 * WebAudio 程序化合成（经 wx.createWebAudioContext 或全局 AudioContext）：
 *   1) 非微信环境（wx/AudioContext 均无）→ unlock 后 play 仍静默不崩（known limitation 解除但无 WebAudio）；
 *   2) 注入 fake wx.createWebAudioContext → unlock 后 play 创建振荡器（真机 SFX 出声）；
 *   3) unlock 前 play 静默（ctx 为 null）；
 *   4) playMusic(music:stage) 注入首拍 Tone 且峰值 < 1（微信端 BGM 亦出声）；
 *   5) 未知 music name 静默不崩。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WechatAudio } from '../../../src/platform/wechat/wechat-audio';

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
    return {
      threshold: new MockParam(),
      ratio: new MockParam(),
      attack: new MockParam(),
      release: new MockParam(),
      knee: new MockParam(),
      connect() {},
    } as unknown as DynamicsCompressorNode;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

describe('WechatAudio · WebAudio 合成（S05-4-BGM，不再依赖 CDN）', () => {
  afterEach(() => {
    // 清理 fake wx / AudioContext，避免污染其他用例与全局状态。
    delete (globalThis as unknown as { wx?: unknown }).wx;
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    MockAudioContext.oscCount = 0;
    MockNode.all = [];
  });

  it('非微信环境（无 wx / 无 AudioContext）→ unlock 后 play 仍静默不崩', () => {
    const a = new WechatAudio();
    a.unlock();
    expect(() => a.play('sfx:jump')).not.toThrow();
    expect(MockAudioContext.oscCount).toBe(0);
  });

  it('注入 fake wx.createWebAudioContext → unlock 后 play 创建振荡器', () => {
    (globalThis as unknown as { wx?: unknown }).wx = {
      createWebAudioContext: () => new MockAudioContext(),
    };
    MockAudioContext.oscCount = 0;
    const a = new WechatAudio();
    a.unlock();
    expect(() => a.play('sfx:jump')).not.toThrow();
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
  });

  it('unlock 前 play 静默（ctx 为 null）', () => {
    (globalThis as unknown as { wx?: unknown }).wx = {
      createWebAudioContext: () => new MockAudioContext(),
    };
    const a = new WechatAudio();
    a.play('sfx:jump');
    expect(MockAudioContext.oscCount).toBe(0);
  });

  it('playMusic(music:stage) 注入首拍 Tone（微信合成亦出声，峰值<1）', () => {
    (globalThis as unknown as { wx?: unknown }).wx = {
      createWebAudioContext: () => new MockAudioContext(),
    };
    MockAudioContext.oscCount = 0;
    MockNode.all = [];
    const a = new WechatAudio();
    a.unlock();
    a.playMusic('music:stage');
    expect(MockAudioContext.oscCount).toBeGreaterThan(0);
    const peaks = MockNode.all.flatMap((n) => n.gain.ramps);
    expect(Math.max(...peaks)).toBeLessThan(1);
    a.stopMusic();
  });

  it('未知 music name 静默不崩', () => {
    (globalThis as unknown as { wx?: unknown }).wx = {
      createWebAudioContext: () => new MockAudioContext(),
    };
    const a = new WechatAudio();
    a.unlock();
    expect(() => a.playMusic('music:stage_cave')).not.toThrow();
    a.stopMusic();
  });
});
