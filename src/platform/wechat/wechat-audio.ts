/**
 * platform/wechat/wechat-audio — 微信端 AudioPort（S05-4-BGM / audio-bgm-design.md）。
 *
 * 本期改为 WebAudio 程序化合成（经 `wx.createWebAudioContext()` 或全局 `AudioContext`），
 * 不再依赖 CDN 素材 / InnerAudioContext（D9 素材阻塞已解除，真机 SFX / BGM 均出声）。
 * 所有合成与 BGM 调度逻辑复用 `../shared/synth-engine` 的 `SynthEngine`，与 Web 端同构。
 *
 * 解锁：unlock() 经 getCtor 建并 resume ctx（绕过自动播放限制）；play/playMusic 在 ctx 为 null
 * 时 no-op（解锁前静默）。非微信环境（含测试）getCtor 返回 null → 全程静默不崩。
 *
 * 平台层豁免：仅允许于 platform/wechat/* 通过 `globalThis.wx` 守卫访问微信对象，不引入真实
 * 资源 URL；非微信环境安全回退 null，绝不抛错/阻塞主线程。
 */
import type { AudioPort } from '../platform';
import { audioConfig } from '../../core/config';
import { SynthEngine } from '../shared/synth-engine';

/** 可注入的 AudioContext 工厂（测试用 mock；默认微信环境探测）。 */
export type AudioContextCtor = () => typeof AudioContext | null;

/**
 * 微信端 getCtor：优先全局 `AudioContext`，否则 `wx.createWebAudioContext`
 * （wx 返回实例而非构造器，故包装成可被 `new` 调用的工厂）。非微信/无 WebAudio 环境 → null 静默。
 */
function defaultWechatCtor(): typeof AudioContext | null {
  const w = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
    wx?: { createWebAudioContext?: () => AudioContext };
  };
  const AC = w.AudioContext ?? w.webkitAudioContext;
  if (AC) return AC;
  const wx = w.wx;
  if (wx && typeof wx.createWebAudioContext === 'function') {
    const factory = wx.createWebAudioContext;
    return (function (this: unknown) {
      return factory();
    } as unknown) as typeof AudioContext;
  }
  return null;
}

export class WechatAudio implements AudioPort {
  private engine: SynthEngine;
  private readonly getCtor: AudioContextCtor;

  constructor(audioContextCtor?: AudioContextCtor) {
    this.getCtor = audioContextCtor ?? defaultWechatCtor;
    this.engine = new SynthEngine(null, audioConfig);
  }

  unlock(): void {
    this.engine.unlock(this.getCtor);
  }

  play(name: string): void {
    this.engine.play(name);
  }

  playMusic(name: string): void {
    this.engine.playMusic(name);
  }

  stopMusic(): void {
    this.engine.stopMusic();
  }
}
