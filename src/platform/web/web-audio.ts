/**
 * platform/web/web-audio — WebAudio 程序化合成（S05-4 / audio-design.md §3.1）。
 *
 * 零素材：每个 SFX name 由 `OscillatorNode` + `GainNode` 包络实时合成；瞬态（land/stomp 的
 * "咔"）用运行时生成的短 `BufferSource` 白噪（仍零素材）。同发上限 8（≤8 复音），无需池化；
 * 踩踏同帧双音（`sfx:stomp` 0.50 + `sfx:enemy_death` 0.20）增益已错开，峰值 < 1.0 不爆音。
 *
 * 解锁：unlock() 建并 resume AudioContext（绕过自动播放限制）；play() 在 ctx 为 null 时 no-op
 * （即解锁前静默）。resume 幂等，重复调用安全（首屏 main.ts 已调一次，真实手势后浏览器自动续 resume）。
 *
 * 音量：effectiveGain = audioConfig.master * audioConfig.sfx * SFX_BASE_GAIN[name]。
 *
 * 测试性：构造函数可选注入 AudioContext 工厂（默认走 globalThis.AudioContext），便于单测注入 mock，
 * 避免触碰 `window`（node 测试环境无 window）。
 */
import type { AudioPort } from '../platform';
import { audioConfig } from '../../core/config';

/** 每个 SFX 的基准增益（与 audio-design.md §3.1 表末列一致）。 */
export const SFX_BASE_GAIN: Record<string, number> = {
  'sfx:jump': 0.50,
  'sfx:land': 0.35,
  'sfx:stomp': 0.50,
  'sfx:enemy_death': 0.20,
  'sfx:coin': 0.45,
  'sfx:hurt': 0.50,
  'sfx:death': 0.40,
  'sfx:respawn': 0.40,
  'sfx:game_over': 0.40,
  'sfx:pause': 0.30,
  'sfx:resume': 0.30,
  'sfx:restart': 0.40,
  'sfx:level_clear': 0.50,
  'sfx:checkpoint': 0.35,
  'sfx:seed_collect': 0.45,
  'sfx:seed_metamorph': 0.45,
  'sfx:projectile_fire': 0.25,
  // §3.1 表未列 double_jump（仅 §2 行 2 描述），此处据 §2 派生补全，使 ON_DOUBLE_JUMP 预留映射可用。
  'sfx:double_jump': 0.45,
};

/** 合成基元：单音（osc 类型 + 频率走向 + 包络 + 相对增益）。 */
interface Tone {
  type: OscillatorType;
  /** 起始频率 (Hz)。 */
  f0: number;
  /** 结束频率 (Hz)，与 f0 相同即无滑音。 */
  f1: number;
  /** 起始偏移（相对 play 时刻，秒）。 */
  t0: number;
  /** 时长（秒）。 */
  dur: number;
  /** 起音（秒）。 */
  attack: number;
  /** 释音（秒）。 */
  release: number;
  /** 相对增益（叠乘，默认 1）。 */
  gain: number;
}

/** 单个 SFX 的合成规格（可含多音序 + 可选白噪瞬态）。 */
interface SfxSpec {
  tones: Tone[];
  /** 可选白噪瞬态（零素材），用于 land/stomp 的"咔"。 */
  noise?: { t0: number; dur: number; gain: number };
}

/** SFX name → 合成规格（全部来自 audio-design.md §3.1，多音类按序排布）。 */
const SFX_SPECS: Record<string, SfxSpec> = {
  'sfx:jump': {
    tones: [{ type: 'triangle', f0: 320, f1: 540, t0: 0, dur: 0.14, attack: 0.005, release: 0.135, gain: 1 }],
  },
  'sfx:land': {
    tones: [{ type: 'triangle', f0: 150, f1: 110, t0: 0, dur: 0.07, attack: 0.004, release: 0.066, gain: 1 }],
    noise: { t0: 0, dur: 0.02, gain: 0.3 },
  },
  'sfx:stomp': {
    tones: [{ type: 'square', f0: 600, f1: 180, t0: 0, dur: 0.07, attack: 0.003, release: 0.067, gain: 1 }],
    noise: { t0: 0, dur: 0.02, gain: 0.4 },
  },
  'sfx:enemy_death': {
    tones: [{ type: 'sine', f0: 400, f1: 200, t0: 0, dur: 0.10, attack: 0.005, release: 0.095, gain: 1 }],
  },
  'sfx:coin': {
    // 双音上行：B5→E6（988→1319），每音 60ms
    tones: [
      { type: 'sine', f0: 988, f1: 988, t0: 0, dur: 0.06, attack: 0.003, release: 0.057, gain: 1 },
      { type: 'sine', f0: 1319, f1: 1319, t0: 0.06, dur: 0.06, attack: 0.003, release: 0.057, gain: 1 },
    ],
  },
  'sfx:hurt': {
    tones: [{ type: 'sawtooth', f0: 400, f1: 160, t0: 0, dur: 0.18, attack: 0.005, release: 0.175, gain: 1 }],
  },
  'sfx:death': {
    tones: [{ type: 'triangle', f0: 500, f1: 120, t0: 0, dur: 0.40, attack: 0.010, release: 0.390, gain: 1 }],
  },
  'sfx:respawn': {
    tones: [{ type: 'sine', f0: 300, f1: 600, t0: 0, dur: 0.25, attack: 0.010, release: 0.240, gain: 1 }],
  },
  'sfx:game_over': {
    // 三角 440→330→220 三步下行，每步 200ms
    tones: [
      { type: 'triangle', f0: 440, f1: 440, t0: 0, dur: 0.20, attack: 0.010, release: 0.190, gain: 1 },
      { type: 'triangle', f0: 330, f1: 330, t0: 0.20, dur: 0.20, attack: 0.010, release: 0.190, gain: 1 },
      { type: 'triangle', f0: 220, f1: 220, t0: 0.40, dur: 0.20, attack: 0.010, release: 0.190, gain: 1 },
    ],
  },
  'sfx:pause': {
    tones: [{ type: 'square', f0: 660, f1: 660, t0: 0, dur: 0.05, attack: 0.002, release: 0.048, gain: 1 }],
  },
  'sfx:resume': {
    tones: [{ type: 'square', f0: 660, f1: 880, t0: 0, dur: 0.06, attack: 0.002, release: 0.058, gain: 1 }],
  },
  'sfx:restart': {
    tones: [{ type: 'triangle', f0: 440, f1: 880, t0: 0, dur: 0.12, attack: 0.004, release: 0.116, gain: 1 }],
  },
  'sfx:level_clear': {
    // 凯旋上行琶音 C5-E5-G5-C6，每音 120ms 顺序
    tones: [
      { type: 'triangle', f0: 523, f1: 523, t0: 0, dur: 0.12, attack: 0.005, release: 0.115, gain: 1 },
      { type: 'triangle', f0: 659, f1: 659, t0: 0.12, dur: 0.12, attack: 0.005, release: 0.115, gain: 1 },
      { type: 'triangle', f0: 784, f1: 784, t0: 0.24, dur: 0.12, attack: 0.005, release: 0.115, gain: 1 },
      { type: 'triangle', f0: 1047, f1: 1047, t0: 0.36, dur: 0.12, attack: 0.005, release: 0.115, gain: 1 },
    ],
  },
  'sfx:checkpoint': {
    tones: [{ type: 'sine', f0: 784, f1: 784, t0: 0, dur: 0.30, attack: 0.010, release: 0.290, gain: 1 }],
  },
  'sfx:seed_collect': {
    // 双音上行：C6→G6（1047→1568），每音 50ms
    tones: [
      { type: 'sine', f0: 1047, f1: 1047, t0: 0, dur: 0.05, attack: 0.003, release: 0.047, gain: 1 },
      { type: 'sine', f0: 1568, f1: 1568, t0: 0.05, dur: 0.05, attack: 0.003, release: 0.047, gain: 1 },
    ],
  },
  'sfx:seed_metamorph': {
    // 温暖上行绽放 440→880 + 2x 泛音
    tones: [
      { type: 'sine', f0: 440, f1: 880, t0: 0, dur: 0.30, attack: 0.010, release: 0.290, gain: 1 },
      { type: 'sine', f0: 880, f1: 1760, t0: 0, dur: 0.30, attack: 0.010, release: 0.290, gain: 0.4 },
    ],
  },
  'sfx:projectile_fire': {
    tones: [{ type: 'square', f0: 700, f1: 300, t0: 0, dur: 0.08, attack: 0.003, release: 0.077, gain: 1 }],
  },
  'sfx:double_jump': {
    // §2 行 2 描述（§3.1 未列）：三角 480→700，90ms
    tones: [{ type: 'triangle', f0: 480, f1: 700, t0: 0, dur: 0.09, attack: 0.005, release: 0.085, gain: 1 }],
  },
};

/** 计算 SFX 有效增益 = master * sfx * baseGain（baseGain 缺省 0 → 静音）。 */
export function sfxEffectiveGain(name: string, master: number, sfx: number): number {
  return (SFX_BASE_GAIN[name] ?? 0) * master * sfx;
}

const EPS = 0.0001; // 指数斜坡下限（WebAudio 不允许 0）

export class WebAudio implements AudioPort {
  private ctx: AudioContext | null = null;
  /** 当前活跃声部数（复音上限保护）。 */
  private activeVoices = 0;
  /** 可注入的 AudioContext 工厂（测试用 mock；默认 globalThis.AudioContext）。 */
  private readonly getCtor: () => typeof AudioContext | null;

  /** 同发复音上限（≤8，audio-design.md §3.1）。 */
  private static readonly MAX_VOICES = 8;

  constructor(audioContextCtor?: () => typeof AudioContext | null) {
    this.getCtor =
      audioContextCtor ??
      (() => {
        const w = globalThis as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        return w.AudioContext ?? w.webkitAudioContext ?? null;
      });
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = this.getCtor();
      if (!Ctor) return; // 无 WebAudio：静默
      try {
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
        return;
      }
    }
    // resume 幂等：首屏调用一次后，真实手势内浏览器自动续 resume；重复调用安全。
    void this.ctx.resume();
  }

  play(name: string): void {
    if (!this.ctx) return; // 解锁前静默
    if (this.activeVoices >= WebAudio.MAX_VOICES) return; // 复音上限，防爆
    this.synth(name);
  }

  /** 按 SFX_SPECS 合成并调度。 */
  private synth(name: string): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const spec = SFX_SPECS[name];
    if (!spec) return; // 未知 name：静默

    const master = audioConfig.master ?? 1;
    const sfx = audioConfig.sfx ?? 1;
    const base = sfxEffectiveGain(name, master, sfx);
    if (base <= 0) return; // 静音轴（如 sfx=0）

    const now = ctx.currentTime;
    let oscCount = 0;

    for (const tone of spec.tones) {
      const start = now + tone.t0;
      const end = start + tone.dur;
      const osc = ctx.createOscillator();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.f0, start);
      if (tone.f1 !== tone.f0) {
        osc.frequency.linearRampToValueAtTime(tone.f1, end);
      }
      const g = ctx.createGain();
      const peak = Math.max(base * tone.gain, EPS);
      // 包络：0 → peak（attack）→ 保持 → 回落 0（release）
      g.gain.setValueAtTime(EPS, start);
      g.gain.exponentialRampToValueAtTime(peak, start + tone.attack);
      g.gain.setValueAtTime(peak, Math.max(start + tone.attack, end - tone.release));
      g.gain.exponentialRampToValueAtTime(EPS, end);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
      oscCount++;
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };
    }
    if (oscCount > 0) this.activeVoices += oscCount;

    // 白噪瞬态（land/stomp 的"咔"），零素材；createBuffer 不可用时静默跳过。
    if (spec.noise && typeof ctx.createBuffer === 'function') {
      try {
        const n = spec.noise;
        const len = Math.max(1, Math.floor(ctx.sampleRate * n.dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const ng = ctx.createGain();
        const np = Math.max(base * n.gain, EPS);
        const ns = now + n.t0;
        const ne = ns + n.dur;
        ng.gain.setValueAtTime(np, ns);
        ng.gain.exponentialRampToValueAtTime(EPS, ne);
        src.connect(ng);
        ng.connect(ctx.destination);
        src.start(ns);
        src.stop(ne + 0.02);
      } catch {
        /* 瞬态失败不阻塞主音 */
      }
    }
  }
}
