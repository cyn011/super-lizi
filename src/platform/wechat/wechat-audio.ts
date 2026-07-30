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
 * 微信端 getCtor：优先微信原生 `wx.createWebAudioContext`，否则才回退全局 `AudioContext`。
 * weapp-adapter 可能暴露“存在但不可播放”的 AudioContext 占位，若先选它会造成真机全程静音。
 * wx 返回实例而非构造器，故包装成可被 `new` 调用、且保持 wx receiver 的工厂。
 * 非微信/无 WebAudio 环境 → null 静默。
 */
function defaultWechatCtor(): typeof AudioContext | null {
  const w = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
    wx?: { createWebAudioContext?: () => AudioContext };
  };
  const wx = w.wx;
  if (wx && typeof wx.createWebAudioContext === 'function') {
    return (function (this: unknown) {
      return wx.createWebAudioContext!();
    } as unknown) as typeof AudioContext;
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class WechatAudio implements AudioPort {
  private engine: SynthEngine;
  private readonly getCtor: AudioContextCtor;
  /** 一次性诊断开关（console.error 在 game.js 静音策略下仍保留，可在 vConsole 看到）。 */
  private static diagDone = false;

  constructor(audioContextCtor?: AudioContextCtor) {
    this.getCtor = audioContextCtor ?? defaultWechatCtor;
    this.engine = new SynthEngine(null, audioConfig);
    // iOS 静音/震动档下也尝试出声（InnerAudioContext 生效；WebAudio 视基础库而定，无害）。
    const w = globalThis as unknown as { wx?: { setInnerAudioOption?: (o: Record<string, unknown>) => void } };
    if (w.wx && typeof w.wx.setInnerAudioOption === 'function') {
      try { w.wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch { /* noop */ }
    }
  }

  unlock(): void {
    this.engine.unlock(this.getCtor);
    if (!WechatAudio.diagDone) {
      WechatAudio.diagDone = true;
      const w = globalThis as unknown as {
        wx?: { createWebAudioContext?: unknown };
      };
      const hasWxWAA = !!(w.wx && typeof w.wx.createWebAudioContext === 'function');
      // eslint-disable-next-line no-console
      console.error(
        '[audio-diag] unlock: hasWxCreateWebAudioContext=' + hasWxWAA +
        ' ctxState=' + this.engine.contextState,
      );
    }
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
