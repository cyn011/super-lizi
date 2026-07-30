/**
 * platform/web/web-audio — Web 端 AudioPort（S05-4-BGM / audio-bgm-design.md）。
 *
 * 薄包装：所有 SFX / BGM 程序化合成逻辑已抽到 `../shared/synth-engine` 的 `SynthEngine`，
 * 本类仅负责 Web 环境的 AudioContext 构造（getCtor / unlock），并委托 SynthEngine 完成
 * play / playMusic / stopMusic。零素材、可测、不膨胀包体。
 *
 * 解锁：unlock() 建并 resume AudioContext（绕过自动播放限制）；play/playMusic 在 ctx 为 null
 * 时 no-op（即解锁前静默）。resume 幂等，重复调用安全。
 *
 * 测试性：构造函数可选注入 AudioContext 工厂（默认走 globalThis.AudioContext），便于单测注入 mock，
 * 避免触碰 `window`（node 测试环境无 window）。
 *
 * 兼容导出：SFX_BASE_GAIN / SFX_SPECS / sfxEffectiveGain 从 shared 重新导出，保持既有测试可用。
 */
import type { AudioPort } from '../platform';
import { audioConfig } from '../../core/config';
import {
  SynthEngine,
  SFX_BASE_GAIN,
  SFX_SPECS,
  sfxEffectiveGain,
} from '../shared/synth-engine';

export { SFX_BASE_GAIN, SFX_SPECS, sfxEffectiveGain };

/** 可注入的 AudioContext 工厂（测试用 mock；默认 globalThis.AudioContext）。 */
export type AudioContextCtor = () => typeof AudioContext | null;

export class WebAudio implements AudioPort {
  private engine: SynthEngine;
  /** 可注入的 AudioContext 工厂（默认 globalThis.AudioContext / webkitAudioContext）。 */
  private readonly getCtor: AudioContextCtor;

  constructor(audioContextCtor?: AudioContextCtor) {
    this.getCtor =
      audioContextCtor ??
      (() => {
        const w = globalThis as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        return w.AudioContext ?? w.webkitAudioContext ?? null;
      });
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

  isRunning(): boolean {
    return this.engine.contextState === 'running';
  }
}
