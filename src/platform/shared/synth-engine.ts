/**
 * platform/shared/synth-engine — 双端共享 WebAudio 程序化合成引擎（S05-4-BGM / audio-bgm-design.md）。
 *
 * 职责（platform 层，非 core）：
 *   1) SFX 合成：迁移自 web-audio.ts 的全部逻辑（OscillatorNode + GainNode 包络、MasterBus 限幅、
 *      明亮 SFX lowpass、高频采集节流、白噪瞬态、复音上限 8）——全部保留。
 *   2) BGM 调度：按 audio-bgm-design.md §3 的 Tone 表程序化合成双 BGM（music:menu / music:stage），
 *      经 lookahead 预排调度器实现 intro→loop 无缝循环，复用同一套 MasterBus 限幅总线。
 *
 * 零平台耦合：本文件不出现 `wx.` / `window.AudioContext` / 字面量 `new AudioContext`；ctx 由上层
 * 包装（WebAudio / WechatAudio）通过 getCtor 注入，SynthEngine 仅消费已建好的 AudioContext。
 * 微信端 ctx 来源差异（wx.createWebAudioContext）完全封装在 wechat-audio 的 getCtor，与本文件无关。
 *
 * 测试性：构造 `(ctx: AudioContext | null, audioConfig)`，ctx 为 null 时 play/playMusic/stopMusic 均
 * no-op（对齐 audio-bgm-design.md §2.1 解锁闸门）；可直接传入 mock AudioContext 做单测。
 */
import { audioConfig as defaultAudioConfig } from '../../core/config';

/** audio-config.json 的（强推断）类型。 */
type AudioConfig = typeof defaultAudioConfig;

const EPS = 0.0001; // 指数斜坡下限（WebAudio 不允许 0）

/** 1 个八分音符（audio-bgm-design.md §0：1 拍 = 1 八分 = 0.25s）。 */
const BEAT = 0.25;
/** intro 段在 loop 前的八分偏移（introBars=2 → 2×8=16 八分）。 */
const INTRO_OFFSET = 16;

// ─────────────────────────────────────────────────────────────────────────────
// 合成基元类型
// ─────────────────────────────────────────────────────────────────────────────

/** 单音（osc 类型 + 频率走向 + 包络 + 相对增益）。BGM 与 SFX 共用。 */
export interface Tone {
  type: OscillatorType;
  /** 起始频率 (Hz)。 */
  f0: number;
  /** 结束频率 (Hz)，与 f0 相同即无滑音（BGM 全部稳态音）。 */
  f1: number;
  /** 起始偏移（相对段落起点，秒）。 */
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
export interface SfxSpec {
  tones: Tone[];
  /** 可选白噪瞬态（零素材），用于 land/stomp 的"咔"。 */
  noise?: { t0: number; dur: number; gain: number };
}

/** 单段 BGM 的合成规格（audio-bgm-design.md §3.3）。 */
export interface MusicSpec {
  loopBars: number;
  introBars: number;
  voices: {
    lead: Tone[];
    bass: Tone[];
    pad: Tone[];
    perc?: Tone[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX 数据（迁移自 web-audio.ts，与 audio-design.md §3.1 表末列一致）
// ─────────────────────────────────────────────────────────────────────────────

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
  // GDD 17 扔栗子机制 4 音（audio-design §3.1 派生，统一"木质/清脆"音色）
  'sfx:chestnut_throw': 0.40,
  'sfx:chestnut_empty': 0.30,
  'sfx:chestnut_clink': 0.35,
  'sfx:chestnut_hit': 0.45,
};

/** SFX name → 合成规格（全部来自 audio-design.md §3.1，多音类按序排布）。 */
export const SFX_SPECS: Record<string, SfxSpec> = {
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
  // GDD 17 扔栗子机制 4 音（木质短促 / 清脆对消）
  'sfx:chestnut_throw': {
    // 投掷：短促下滑"噗"声（三角 520→200，80ms）
    tones: [{ type: 'triangle', f0: 520, f1: 200, t0: 0, dur: 0.08, attack: 0.003, release: 0.077, gain: 1 }],
  },
  'sfx:chestnut_empty': {
    // 空弹：低频闷响提示（正弦 180→120，120ms）
    tones: [{ type: 'sine', f0: 180, f1: 120, t0: 0, dur: 0.12, attack: 0.006, release: 0.114, gain: 1 }],
  },
  'sfx:chestnut_clink': {
    // 对消：清脆双音金属感（方波 900→1400，60ms）
    tones: [{ type: 'square', f0: 900, f1: 1400, t0: 0, dur: 0.06, attack: 0.002, release: 0.058, gain: 1 }],
  },
  'sfx:chestnut_hit': {
    // 命中可踩敌人：木质击打 + 短噪（方波 600→260，70ms + 轻噪）
    tones: [{ type: 'square', f0: 600, f1: 260, t0: 0, dur: 0.07, attack: 0.003, release: 0.067, gain: 1 }],
    noise: { t0: 0, dur: 0.02, gain: 0.3 },
  },
};

/** 计算 SFX 有效增益 = master * sfx * baseGain（baseGain 缺省 0 → 静音）。 */
export function sfxEffectiveGain(name: string, master: number, sfx: number): number {
  return (SFX_BASE_GAIN[name] ?? 0) * master * sfx;
}

// ─────────────────────────────────────────────────────────────────────────────
// BGM 数据（audio-bgm-design.md §3，逐音转秒；intro 段额外 +INTRO_OFFSET×BEAT 偏移）
// ─────────────────────────────────────────────────────────────────────────────

/** BGM 轨基准增益（类比 SFX_BASE_GAIN，audio-bgm-design.md §2.3）。 */
export const MUSIC_BASE_GAIN: Record<string, number> = {
  'music:menu': 0.5,
  'music:stage': 0.5,
};

/** 用 [Hz, 起始拍, 时长拍] 紧凑构造 Tone 数组（f1=f0 稳态音，t0/dur 由拍×BEAT 换算）。 */
type RawNote = [hz: number, startBeat: number, durBeats: number];
function voice(
  type: OscillatorType,
  attack: number,
  release: number,
  gain: number,
  notes: RawNote[],
  beatOffset = 0,
): Tone[] {
  return notes.map(([f0, sb, db]) => ({
    type,
    f0,
    f1: f0,
    t0: (beatOffset + sb) * BEAT,
    dur: db * BEAT,
    attack,
    release,
    gain,
  }));
}

// 声部默认合成档案（audio-bgm-design.md §3.0）
const LEAD = { type: 'triangle' as OscillatorType, attack: 0.005, release: 0.12, gain: 1.0 };
const BASS = { type: 'triangle' as OscillatorType, attack: 0.005, release: 0.10, gain: 0.9 };
const PAD_MENU = { type: 'sine' as OscillatorType, attack: 0.08, release: 0.30, gain: 0.3 };
const PAD_STAGE = { type: 'sine' as OscillatorType, attack: 0.08, release: 0.30, gain: 0.2 };
const PERC = { type: 'square' as OscillatorType, attack: 0.002, release: 0.048, gain: 0.3 };

// ── menu（§3.1）──
const menuIntroLead = voice(LEAD.type, LEAD.attack, LEAD.release, LEAD.gain, [
  [783.99, 0, 2], [1046.5, 2, 2], [783.99, 4, 2], [659.25, 6, 2], [523.25, 8, 4], [392.0, 12, 4],
]);
const menuIntroBass = voice(BASS.type, BASS.attack, BASS.release, BASS.gain, [
  [130.81, 0, 8], [130.81, 8, 8],
]);
const menuIntroPad = voice(PAD_MENU.type, PAD_MENU.attack, PAD_MENU.release, PAD_MENU.gain, [
  [392.0, 0, 8], [392.0, 8, 8],
]);
const menuLoopLead = voice(LEAD.type, LEAD.attack, LEAD.release, LEAD.gain, [
  [659.25, 0, 2], [783.99, 2, 2], [880.0, 4, 2], [783.99, 6, 2], [523.25, 8, 2], [659.25, 10, 2],
  [587.33, 12, 2], [523.25, 14, 2], [440.0, 16, 2], [523.25, 18, 2], [587.33, 20, 2], [659.25, 22, 2],
  [587.33, 24, 2], [659.25, 26, 2], [783.99, 28, 2], [659.25, 30, 2], [659.25, 32, 2], [783.99, 34, 2],
  [880.0, 36, 2], [783.99, 38, 2], [523.25, 40, 2], [659.25, 42, 2], [587.33, 44, 2], [523.25, 46, 2],
  [440.0, 48, 2], [523.25, 50, 2], [587.33, 52, 2], [698.46, 54, 2], [783.99, 56, 2], [659.25, 58, 2],
  [587.33, 60, 2], [523.25, 62, 2],
], INTRO_OFFSET);
const menuLoopBass = voice(BASS.type, BASS.attack, BASS.release, BASS.gain, [
  [130.81, 0, 4], [196.0, 4, 4], [110.0, 8, 4], [164.81, 12, 4], [87.31, 16, 4], [130.81, 20, 4],
  [98.0, 24, 4], [146.83, 28, 4], [130.81, 32, 4], [196.0, 36, 4], [110.0, 40, 4], [164.81, 44, 4],
  [87.31, 48, 4], [130.81, 52, 4], [98.0, 56, 4], [146.83, 60, 4],
], INTRO_OFFSET);
const menuLoopPad = voice(PAD_MENU.type, PAD_MENU.attack, PAD_MENU.release, PAD_MENU.gain, [
  [392.0, 0, 8], [220.0, 8, 8], [174.61, 16, 8], [196.0, 24, 8], [392.0, 32, 8], [220.0, 40, 8],
  [174.61, 48, 8], [196.0, 56, 8],
], INTRO_OFFSET);

// ── stage（§3.2）──
const stageIntroLead = voice(LEAD.type, LEAD.attack, LEAD.release, LEAD.gain, [
  [523.25, 0, 2], [659.25, 2, 2], [783.99, 4, 2], [1046.5, 6, 2], [783.99, 8, 4], [659.25, 12, 4],
]);
const stageIntroBass = voice(BASS.type, BASS.attack, BASS.release, BASS.gain, [
  [130.81, 0, 8], [130.81, 8, 8],
]);
const stageIntroPad = voice(PAD_STAGE.type, PAD_STAGE.attack, PAD_STAGE.release, PAD_STAGE.gain, [
  [392.0, 0, 8], [392.0, 8, 8],
]);
const stageLoopLead = voice(LEAD.type, LEAD.attack, LEAD.release, LEAD.gain, [
  [523.25, 0, 2], [659.25, 2, 2], [783.99, 4, 2], [659.25, 6, 2], [587.33, 8, 2], [783.99, 10, 2],
  [880.0, 12, 2], [783.99, 14, 2], [440.0, 16, 2], [523.25, 18, 2], [659.25, 20, 2], [523.25, 22, 2],
  [698.46, 24, 2], [880.0, 26, 2], [783.99, 28, 2], [659.25, 30, 2], [523.25, 32, 2], [659.25, 34, 2],
  [783.99, 36, 2], [880.0, 38, 2], [783.99, 40, 2], [587.33, 42, 2], [659.25, 44, 2], [587.33, 46, 2],
  [440.0, 48, 2], [523.25, 50, 2], [659.25, 52, 2], [880.0, 54, 2], [698.46, 56, 2], [587.33, 58, 2],
  [523.25, 60, 2], [587.33, 62, 2],
], INTRO_OFFSET);
const stageLoopBass = voice(BASS.type, BASS.attack, BASS.release, BASS.gain, [
  [130.81, 0, 4], [196.0, 4, 4], [98.0, 8, 4], [146.83, 12, 4], [110.0, 16, 4], [164.81, 20, 4],
  [87.31, 24, 4], [130.81, 28, 4], [130.81, 32, 4], [196.0, 36, 4], [98.0, 40, 4], [146.83, 44, 4],
  [110.0, 48, 4], [164.81, 52, 4], [87.31, 56, 4], [130.81, 60, 4],
], INTRO_OFFSET);
const stageLoopPad = voice(PAD_STAGE.type, PAD_STAGE.attack, PAD_STAGE.release, PAD_STAGE.gain, [
  [196.0, 0, 8], [293.66, 8, 8], [220.0, 16, 8], [261.63, 24, 8], [196.0, 32, 8], [293.66, 40, 8],
  [220.0, 48, 8], [261.63, 56, 8],
], INTRO_OFFSET);
// perc：轻 tick（方波 1000Hz，f0=f1，durBeats=0.2，gain=0.3），按 §3.2.3 表每 4 八分一击（16 击）。
const stagePercNotes: RawNote[] = [];
for (let b = 0; b <= 60; b += 4) stagePercNotes.push([1000, b, 0.2]);
const stagePerc = voice(PERC.type, PERC.attack, PERC.release, PERC.gain, stagePercNotes, INTRO_OFFSET);

/** 双 BGM 合成规格（audio-bgm-design.md §3）。 */
export const MUSIC_SPECS: Record<string, MusicSpec> = {
  'music:menu': {
    loopBars: 8,
    introBars: 2,
    voices: {
      lead: [...menuIntroLead, ...menuLoopLead],
      bass: [...menuIntroBass, ...menuLoopBass],
      pad: [...menuIntroPad, ...menuLoopPad],
    },
  },
  'music:stage': {
    loopBars: 8,
    introBars: 2,
    voices: {
      lead: [...stageIntroLead, ...stageLoopLead],
      bass: [...stageIntroBass, ...stageLoopBass],
      pad: [...stageIntroPad, ...stageLoopPad],
      perc: stagePerc,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 调度预编译（intro / loop 分段，loop 段 t0 已归零）
// ─────────────────────────────────────────────────────────────────────────────

interface SchedSpec {
  introLen: number;
  loopLen: number;
  introTones: Tone[]; // t0 ∈ [0, introLen)
  loopTones: Tone[];  // t0 ∈ [0, loopLen)
}

function buildSched(name: string): SchedSpec {
  const spec = MUSIC_SPECS[name];
  const introLen = spec.introBars * 8 * BEAT; // 2×8×0.25 = 4.0s
  const loopLen = spec.loopBars * 8 * BEAT;   // 8×8×0.25 = 16.0s
  const all: Tone[] = [
    ...spec.voices.lead,
    ...spec.voices.bass,
    ...spec.voices.pad,
    ...(spec.voices.perc ?? []),
  ];
  const introTones = all
    .filter((t) => t.t0 < introLen)
    .sort((a, b) => a.t0 - b.t0);
  const loopTones = all
    .filter((t) => t.t0 >= introLen)
    .map((t) => ({ ...t, t0: t.t0 - introLen }))
    .sort((a, b) => a.t0 - b.t0);
  return { introLen, loopLen, introTones, loopTones };
}

// ─────────────────────────────────────────────────────────────────────────────
// SynthEngine
// ─────────────────────────────────────────────────────────────────────────────

/** 已排程且尚未结束的音频源（用于 stopMusic 截断）。 */
interface ActiveNode {
  node: AudioScheduledSourceNode;
  /** 该音的 start 时间（stop 需 ≥ start 才合法，避免 InvalidStateError）。 */
  start: number;
}

export class SynthEngine {
  private ctx: AudioContext | null;
  private readonly audioConfig: AudioConfig;

  /** 当前活跃声部数（SFX 复音上限保护，与 BGM 独立预算）。 */
  private activeVoices = 0;
  /** E1：MasterBus 限幅压缩器（消同帧/多音叠加削波）；null=未建/直连 destination。 */
  private compressor: AudioNode | null = null;
  /** E4：高频采集 SFX 最小播放间隔（秒），防同帧/极快连发叠响互掩。 */
  private readonly lastPlayed = new Map<string, number>();
  private static readonly THROTTLE_SFX = new Set(['sfx:seed_collect', 'sfx:coin']);
  private static readonly THROTTLE_MS = 50;
  /** E3：明亮 SFX（方波/锯齿主体）过 lowpass 去刺耳（audio-polish-phase6 §1.3）。 */
  private static readonly BRIGHT_SFX = new Set([
    'sfx:stomp',
    'sfx:hurt',
    'sfx:pause',
    'sfx:resume',
    'sfx:projectile_fire',
  ]);
  private static readonly BRIGHT_CUTOFF = 3000; // 2500–3500Hz 区间
  private static readonly MAX_VOICES = 8;

  // ── BGM 调度状态 ──
  private readonly schedCache = new Map<string, SchedSpec>();
  private currentName: string | null = null;
  /** 解锁前请求的 BGM（ctx 为 null 时无法启动）；unlock 续上后自动补播，避免真机首屏静音。 */
  private pendingName: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private phase: 'intro' | 'loop' = 'intro';
  private nextIdx = 0;
  private sectionStartTime = 0;
  private sched: SchedSpec | null = null;
  private activeNodes: ActiveNode[] = [];
  /** 调度器每次检查窗口（秒），预排未来 Tone（audio-bgm-design.md §4）。 */
  private static readonly LOOKAHEAD = 0.1;
  /** 段落切换保护（防极端情况下死循环）。 */
  private static readonly MAX_SECTION_STEPS = 4;

  constructor(ctx: AudioContext | null, audioConfig: AudioConfig = defaultAudioConfig) {
    this.ctx = ctx;
    this.audioConfig = audioConfig;
  }

  /** 诊断用：当前 ctx 状态（无 ctx 返回 'none'）。供平台层一次性上报。 */
  get contextState(): string {
    return this.ctx ? (typeof this.ctx.state === 'string' ? this.ctx.state : 'unknown') : 'none';
  }

  /**
   * 建/resume ctx（幂等）。getCtor 由上层包装提供（Web=globalThis.AudioContext，
   * 微信=wx.createWebAudioContext 包装）；无可用构造器时静默返回（无 WebAudio 环境）。
   */
  unlock(getCtor: () => typeof AudioContext | null): void {
    if (!this.ctx) {
      const Ctor = getCtor();
      if (!Ctor) return; // 无 WebAudio：静默
      try {
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
        return;
      }
    }
    // resume 幂等，但必须等恢复完成后才能安排待播 BGM。真机首屏的第一次
    // resume 常因不在用户手势中被拒绝；后续触摸会再次调用 unlock 重试。
    const ctx = this.ctx;
    const flushPendingMusic = () => {
      if (!this.pendingName) return;
      const n = this.pendingName;
      this.pendingName = null;
      this.playMusic(n);
    };
    try {
      if (ctx.state === 'running') {
        flushPendingMusic();
        return;
      }
      const resumed = ctx.resume();
      if (resumed && typeof resumed.then === 'function') {
        void resumed.then(flushPendingMusic).catch(() => {
          // 自动播放限制拒绝时保留 pendingName，等待下一次真实触摸重试。
        });
      } else {
        flushPendingMusic();
      }
    } catch {
      // 同上：保持 ctx 与 pendingName，允许下一次触摸重试。
    }
  }

  /** 播放 SFX（解锁前 ctx 为 null → no-op）。 */
  play(name: string): void {
    if (!this.ctx) return; // 解锁前静默
    if (this.activeVoices >= SynthEngine.MAX_VOICES) return; // 复音上限，防爆
    // E4：高频采集类（seed_collect/coin）极快连发节流，防同帧叠响互掩
    if (SynthEngine.THROTTLE_SFX.has(name)) {
      const now = this.ctx.currentTime;
      const last = this.lastPlayed.get(name);
      if (last !== undefined && now - last < SynthEngine.THROTTLE_MS / 1000) return;
      this.lastPlayed.set(name, now);
    }
    this.synthSfx(name);
  }

  /**
   * 启动指定 BGM 循环（audio-bgm-design.md §2.1）。
   * - ctx 为 null（未解锁）→ no-op；
   * - 未知 name → no-op；
   * - 同 name 重复调用 → idempotent（不叠加第二份循环）；
   * - 换 name → 先 stopMusic 当前，再启动新 BGM。
   */
  playMusic(name: string): void {
    if (!(name in MUSIC_SPECS)) return; // 未知 name：静默
    if (!this.ctx || (typeof this.ctx.state === 'string' && this.ctx.state !== 'running')) {
      // 解锁前或 context 仍 suspended/interrupted 时记意愿，resume 成功后补播。
      this.pendingName = name;
      return;
    }
    if (this.currentName === name) return; // idempotent
    this.stopMusic(); // 换名先停后起

    let sched = this.schedCache.get(name);
    if (!sched) {
      sched = buildSched(name);
      this.schedCache.set(name, sched);
    }
    this.sched = sched;
    this.currentName = name;
    this.phase = 'intro';
    this.nextIdx = 0;
    // 留极小提前量，避免立刻调度到过去时刻（sectionStartTime < now 导致包络异常）。
    this.sectionStartTime = this.ctx.currentTime + 0.06;
    this.scheduleTick(); // 同步先排一批（消除首帧 25ms 静默）
    this.timer = setInterval(() => this.scheduleTick(), 25);
  }

  /**
   * 停止当前 BGM：清除 lookahead 调度器 + 停止已排程未触发的 oscillator（截断），
   * 无当前 BGM 时 no-op。
   */
  stopMusic(): void {
    this.pendingName = null; // 取消任何待补播意愿
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.currentName === null) return; // 无当前 BGM → no-op
    const ctx = this.ctx;
    for (const { node, start } of this.activeNodes) {
      // stop(t) 需 ≥ start 且 ≥ currentTime 才合法；取二者较大者，避免 InvalidStateError。
      try {
        node.stop(Math.max(ctx ? ctx.currentTime : 0, start));
      } catch {
        /* 已结束的源 stop 抛错可忽略 */
      }
    }
    this.activeNodes = [];
    this.currentName = null;
    this.sched = null;
    this.phase = 'intro';
    this.nextIdx = 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SFX 合成（迁移自 web-audio.ts）
  // ───────────────────────────────────────────────────────────────────────────

  private masterBus(ctx: AudioContext): AudioNode {
    if (!this.compressor) {
      const factory = (ctx as unknown as { createDynamicsCompressor?: () => DynamicsCompressorNode })
        .createDynamicsCompressor;
      if (typeof factory === 'function') {
        const comp = factory.call(ctx);
        comp.threshold.value = -6;
        comp.ratio.value = 8;
        comp.attack.value = 0.003;
        comp.release.value = 0.12;
        comp.knee.value = 6;
        comp.connect(ctx.destination);
        this.compressor = comp;
      } else {
        this.compressor = ctx.destination; // 不支持则直连
      }
    }
    return this.compressor;
  }

  private makeLowpass(ctx: AudioContext, freq: number): BiquadFilterNode | null {
    const factory = (ctx as unknown as { createBiquadFilter?: () => BiquadFilterNode }).createBiquadFilter;
    if (typeof factory !== 'function') return null;
    const f = factory.call(ctx);
    f.type = 'lowpass';
    f.frequency.value = freq;
    return f;
  }

  private synthSfx(name: string): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const spec = SFX_SPECS[name];
    if (!spec) return; // 未知 name：静默

    const master = this.audioConfig.master ?? 1;
    const sfx = this.audioConfig.sfx ?? 1;
    const base = sfxEffectiveGain(name, master, sfx);
    if (base <= 0) return; // 静音轴（如 sfx=0）

    const now = ctx.currentTime;
    const bus = this.masterBus(ctx);
    let oscCount = 0;

    const lowpass = SynthEngine.BRIGHT_SFX.has(name)
      ? this.makeLowpass(ctx, SynthEngine.BRIGHT_CUTOFF)
      : null;

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
      g.gain.setValueAtTime(EPS, start);
      g.gain.exponentialRampToValueAtTime(peak, start + tone.attack);
      g.gain.setValueAtTime(peak, Math.max(start + tone.attack, end - tone.release));
      g.gain.exponentialRampToValueAtTime(EPS, end);
      if (lowpass) {
        osc.connect(lowpass);
        lowpass.connect(g);
      } else {
        osc.connect(g);
      }
      g.connect(bus);
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
        ng.gain.setValueAtTime(EPS, ns);
        ng.gain.exponentialRampToValueAtTime(np, ns + 0.002);
        ng.gain.exponentialRampToValueAtTime(EPS, ne);
        src.connect(ng);
        ng.connect(bus);
        src.start(ns);
        src.stop(ne + 0.02);
      } catch {
        /* 瞬态失败不阻塞主音 */
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BGM 调度
  // ───────────────────────────────────────────────────────────────────────────

  /** lookahead 调度器：预排未来 LOOKAHEAD 内的 Tone；intro 播一次后无缝回绕 loop。 */
  private scheduleTick(): void {
    const ctx = this.ctx;
    const sched = this.sched;
    if (!ctx || !sched) return;

    let guard = 0;
    while (guard++ < SynthEngine.MAX_SECTION_STEPS) {
      const now = ctx.currentTime;
      const elapsed = now - this.sectionStartTime;
      const sectionTones = this.phase === 'intro' ? sched.introTones : sched.loopTones;
      while (
        this.nextIdx < sectionTones.length &&
        sectionTones[this.nextIdx].t0 <= elapsed + SynthEngine.LOOKAHEAD
      ) {
        this.scheduleTone(sectionTones[this.nextIdx], this.sectionStartTime);
        this.nextIdx++;
      }
      if (this.nextIdx < sectionTones.length) break; // 本段未排完，等下一 tick
      // 本段排完，推进到下一段（intro→loop 一次性，loop→loop 无缝回绕）
      if (this.phase === 'intro') {
        this.phase = 'loop';
        this.sectionStartTime += sched.introLen;
        this.nextIdx = 0;
      } else {
        this.sectionStartTime += sched.loopLen;
        this.nextIdx = 0;
      }
    }
  }

  /** 按 BGM Tone 合成单个 oscillator 并排程到 sectionStart + tone.t0。 */
  private scheduleTone(tone: Tone, sectionStart: number): void {
    const ctx = this.ctx;
    const name = this.currentName;
    if (!ctx || !name) return;

    const master = this.audioConfig.master ?? 1;
    const music = this.audioConfig.music ?? 0;
    const base = master * music * (MUSIC_BASE_GAIN[name] ?? 0);
    if (base <= 0) return; // music=0 → 静音轴

    const start = sectionStart + tone.t0;
    const end = start + tone.dur;
    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.f0, start); // BGM 全部稳态音（f1==f0），无需 ramp
    const g = ctx.createGain();
    const peak = Math.max(base * tone.gain, EPS);
    g.gain.setValueAtTime(EPS, start);
    g.gain.exponentialRampToValueAtTime(peak, start + tone.attack);
    g.gain.setValueAtTime(peak, Math.max(start + tone.attack, end - tone.release));
    g.gain.exponentialRampToValueAtTime(EPS, end);
    osc.connect(g);
    g.connect(this.masterBus(ctx));
    osc.start(start);
    osc.stop(Math.max(ctx.currentTime, end + 0.02));
    this.activeNodes.push({ node: osc, start });
    osc.onended = () => {
      const i = this.activeNodes.findIndex((a) => a.node === osc);
      if (i >= 0) this.activeNodes.splice(i, 1);
    };
  }
}
