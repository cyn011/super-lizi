/**
 * core/enemy/du-fu-silhouette — 嘟浮剪影（du_fu_silhouette）状态机（GDD 16 §3，纯函数，零平台）。
 *
 * 表驱动、可 headless 单测。core 铁律：本文件不依赖任何渲染框架或平台 API，
 * 不读写任何全局状态——所有推进由 stepDufuSilhouette 纯函数完成，几何/危害/可踩全部由参数推导。
 *
 * 剪影是原嘟浮（du_fu）的暗色镜像变体：复用同一套浮动数学（float=60/amp=24），
 * 仅叠加一种行为扭曲（twist）。本文件默认按 **A. 镜像分身（mirror，反相成对）** 实现全部数值；
 * B(静态诱饵 decoy) / C(相位幽灵 phaseghost) 作为备选亦已实现（GDD 16 §2.2）。
 *
 * 四态语义（GDD 16 §2 表）：
 *   IDLE    —— 仅 decoy 休眠期（静止无害）；mirror/phaseghost 不使用。
 *   FLOAT   —— 主浮动态（A 恒 FLOAT / B 激活后 FLOAT / C 在 FLOAT 内叠加 ghost 子态）。
 *   SOLID   —— 仅 phaseghost 的「可见」子态（可踩可伤）。
 *   WRAITH  —— 仅 phaseghost 的「半透」子态（不可踩、可穿越）。
 *
 * 镜像配对（mirror）：剪影与配对光嘟浮共享 baseY/amp/float、仅相位反相（mirrorOffset=π），
 * 二者 y 恒满足 y_sil + y_du ≈ 2·baseY（一个升它落），纯几何反相、零 RNG、无漂移。
 *
 * 踩杀/受伤由集成层（overlaps + markStomped）派生，复用 ON_STOMP / ON_ENEMY_HIT_PLAYER，
 * 不在此函数内发；ACTIVATED / GHOST_SHIFT 仅为 benign 占位事件（不进经济、不新增音频键）。
 */
import type { EnemyTypeName } from './enemy-types';
import { applyFloat } from './float-math';

/** 剪影行为扭曲（GDD 16 §1.1 / §2.2）。 */
export type DufuSilhouetteTwist = 'mirror' | 'decoy' | 'phaseghost';
/** 主态：IDLE=decoy 休眠；FLOAT=浮动态（A/B激活/C 共用）。 */
export type DufuSilhouetteMode = 'IDLE' | 'FLOAT';
/** 幽灵子态：仅 phaseghost；SOLID=可见可踩可伤，WRAITH=半透穿越。 */
export type DufuSilhouetteGhost = 'SOLID' | 'WRAITH';

/** 状态机数值（全部来自 enemy-config.json 的 du_fu_silhouette 项，禁止硬编码）。 */
export interface DufuSilhouetteCfg {
  /** 峰值竖直速度（px/s，默认 60，沿用原嘟浮）。 */
  float: number;
  /** 振幅（px，默认 24，沿用原嘟浮）。 */
  amp: number;
  /** 碰撞盒宽（px）。 */
  width: number;
  /** 碰撞盒高（px）。 */
  height: number;
  /** 默认可踩意愿（由 mode/ghost 动态覆写；mirror 恒 true）。 */
  stompable: boolean;
  /** 行为扭曲类型（默认 mirror）。 */
  twist: DufuSilhouetteTwist;
  /** 反相位差（rad，默认 π：剪影与配对光嘟浮反相）。 */
  mirrorOffset: number;
  /** 激活距离（px，decoy 用，默认 96 = 3 tile）。 */
  decoyTriggerDist: number;
  /** 相位幽灵整周期（ms，默认 2000）。 */
  ghostPeriodMs: number;
  /** SOLID 占比（0..1，默认 0.4：可踩可伤窗口 = 0.4×ghostPeriodMs）。 */
  ghostSolidRatio: number;
  /** 浮动基准锚点（'air'=空中，沿用原嘟浮）。 */
  baseYAnchor: 'air' | 'ground';
}

/** stepDufuSilhouette 单步返回值。 */
export interface DufuSilhouetteStep {
  /** 推进后的状态（新对象，不修改入参）。 */
  state: DufuSilhouetteState;
  /** 本步 benign 事件（踩杀/受伤由集成层派生，不在此发）。 */
  events: DufuSilhouetteEvent[];
}

/** 剪影运行时状态（cfg 派生数值在构造期烘焙进 state，保证「输入仅 state+dt」）。 */
export interface DufuSilhouetteState {
  mode: DufuSilhouetteMode;
  ghost: DufuSilhouetteGhost; // 仅 twist=phaseghost 使用；其余恒 'SOLID'
  phase: number; // 浮动正弦相位（rad，不含 offset）
  ghostPhase: number; // 相位幽灵半透周期相位（0..1）
  baseY: number; // 浮动基准 y（px）
  x: number;
  y: number; // 当前世界 y（px）；y = baseY + amp·sin(phase + mirrorOffset)
  vx: number;
  vy: number;
  playerProximity: boolean; // 集成层每帧写入（decoy 激活用；零平台，仅布尔）
  pairId: number; // 配对光嘟浮实例 id（mirror 用；集成层据此对齐相位基准，仅元数据）
  // —— cfg 派生数值（构造期烘焙）——
  twist: DufuSilhouetteTwist;
  float: number;
  amp: number;
  mirrorOffset: number;
  decoyTriggerDist: number;
  ghostPeriodMs: number;
  ghostSolidRatio: number;
  /** 构造期可踩意愿（= cfg.stompable，decoy/phaseghost 据此动态覆写）。 */
  cfgStompable: boolean;
  /** 由 twist/mode/ghost 动态赋值的本次可踩标记（复用于集成层 StompableHazard）。 */
  stompable: boolean;
  /** 由 twist/mode/ghost 动态赋值的本次危害标记（复用于集成层 HazardSource.overlaps 短路）。 */
  hazard: boolean;
  dead: boolean;
}

/** 剪影 benign 事件联合（不进经济、不新增音频键）。 */
export type DufuSilhouetteEvent =
  | 'ACTIVATED' // decoy：IDLE→FLOAT
  | 'GHOST_SHIFT' // phaseghost：SOLID↔WRAITH 切换
  | 'IDLE'; // 占位（无事件）

/** 默认 cfg（GDD 16 §3.1，数值全部沿用原嘟浮）。 */
export const DEFAULT_DU_FU_SILHOUETTE_CFG: DufuSilhouetteCfg = {
  float: 60,
  amp: 24,
  width: 24,
  height: 24,
  stompable: true,
  twist: 'mirror',
  mirrorOffset: Math.PI,
  decoyTriggerDist: 96,
  ghostPeriodMs: 2000,
  ghostSolidRatio: 0.4,
  baseYAnchor: 'air',
};

/** 标志位推导：依据 twist / mode / ghost 给出 stompable / hazard（零平台纯推导）。 */
function deriveFlags(
  twist: DufuSilhouetteTwist,
  mode: DufuSilhouetteMode,
  ghost: DufuSilhouetteGhost,
  baseStomp: boolean,
): { stompable: boolean; hazard: boolean } {
  switch (twist) {
    case 'mirror':
      return { stompable: baseStomp, hazard: true };
    case 'decoy': {
      const active = mode === 'FLOAT';
      return { stompable: active ? baseStomp : false, hazard: active };
    }
    case 'phaseghost': {
      const solid = ghost === 'SOLID';
      return { stompable: solid ? baseStomp : false, hazard: solid };
    }
  }
}

/**
 * 由 enemy-config 的 du_fu_silhouette 项 + 每实例 params 构建运行时初始状态（数值全来自 config，禁止硬编码）。
 * @param cfg 已解析的状态机数值（含 twist / mirrorOffset / 等）
 * @param x 世界坐标左（px）
 * @param baseY 浮动基准 y（px，= 关卡实体 y）
 * @param params 每实例覆盖（mirrorOffset / pairId 等；向后兼容旧敌的 Record<string, number>）
 */
export function createDufuSilhouetteState(
  cfg: DufuSilhouetteCfg,
  x: number,
  baseY: number,
  params?: Record<string, number>,
): DufuSilhouetteState {
  const twist = cfg.twist;
  const mirrorOffset = params?.mirrorOffset ?? cfg.mirrorOffset;
  const pairId = params?.pairId ?? 0;
  const mode: DufuSilhouetteMode = twist === 'decoy' ? 'IDLE' : 'FLOAT';
  const ghost: DufuSilhouetteGhost = 'SOLID';
  const { stompable, hazard } = deriveFlags(twist, mode, ghost, cfg.stompable);
  return {
    mode,
    ghost,
    phase: 0,
    ghostPhase: 0,
    baseY,
    x,
    y: baseY, // 初始静止于基准（mirror/phaseghost 下一步即浮动）
    vx: 0,
    vy: 0,
    playerProximity: false,
    pairId,
    twist,
    float: cfg.float,
    amp: cfg.amp,
    mirrorOffset,
    decoyTriggerDist: cfg.decoyTriggerDist,
    ghostPeriodMs: cfg.ghostPeriodMs,
    ghostSolidRatio: cfg.ghostSolidRatio,
    cfgStompable: cfg.stompable,
    stompable,
    hazard,
    dead: false,
  };
}

/**
 * 单步推进纯函数（GDD 16 §3.3）。
 * @param s 当前态
 * @param dt 步长（秒，固定步长 1/60）
 * @returns 推进后的新 state + 本步事件列表（不修改入参 s）
 *
 * 浮动数学：y = baseY + amp·sin(phase + mirrorOffset)，omega = float/amp（峰值竖直速度 = float）；
 * 复用共享纯函数 applyFloat，与原 du_fu 同一套公式（仅 mirrorOffset 不同）。
 *  - mirror：恒 FLOAT，stompable/hazard 同 du_fu。
 *  - decoy ：playerProximity 且 mode=IDLE → 切 FLOAT（emit ACTIVATED）；否则静止于 baseY。
 *  - phaseghost：ghostPhase += dt*1000/ghostPeriodMs；SOLID↔WRAITH 切换 emit GHOST_SHIFT；
 *              WRAITH → stompable=hazard=false（可穿越）。
 * 踩杀/接触受伤由集成层（overlaps + markStomped）派生，复用 ON_STOMP / ON_ENEMY_HIT_PLAYER。
 */
export function stepDufuSilhouette(s: DufuSilhouetteState, dt: number): DufuSilhouetteStep {
  const n: DufuSilhouetteState = { ...s };
  const events: DufuSilhouetteEvent[] = [];

  // 浮动是否生效：decoy 仅在 FLOAT 期浮动；IDLE 期静止于 baseY。
  const floating = n.twist !== 'decoy' || n.mode === 'FLOAT';
  if (floating) {
    const r = applyFloat(
      { baseY: n.baseY, amp: n.amp, float: n.float, phase: n.phase },
      dt,
      n.x,
      n.mirrorOffset,
    );
    n.phase = r.phase;
    n.x = r.x;
    n.y = r.y;
    n.vx = r.vx;
    n.vy = r.vy;
  } else {
    n.y = n.baseY; // IDLE 静止
    n.vy = 0;
    n.vx = 0;
  }

  // twist 分支
  if (n.twist === 'decoy') {
    if (n.playerProximity && n.mode === 'IDLE') {
      n.mode = 'FLOAT';
      events.push('ACTIVATED');
    }
  } else if (n.twist === 'phaseghost') {
    n.ghostPhase = (n.ghostPhase + (dt * 1000) / n.ghostPeriodMs) % 1;
    const solid = n.ghostPhase < n.ghostSolidRatio;
    const ng: DufuSilhouetteGhost = solid ? 'SOLID' : 'WRAITH';
    if (ng !== n.ghost) {
      n.ghost = ng;
      events.push('GHOST_SHIFT');
    }
  } else {
    // mirror：恒 FLOAT，ghost 保持 SOLID
    n.mode = 'FLOAT';
    n.ghost = 'SOLID';
  }

  // 由 twist/mode/ghost + 构造期可踩意愿 推导最终 stompable/hazard
  const derived = deriveFlags(n.twist, n.mode, n.ghost, n.cfgStompable);
  n.stompable = derived.stompable;
  n.hazard = derived.hazard;

  return { state: n, events };
}

/** 类型守卫：用于 createEnemies / render 的窄化（保持 EnemyTypeName 集中一处）。 */
export function isDufuSilhouette(type: EnemyTypeName): type is 'du_fu_silhouette' {
  return type === 'du_fu_silhouette';
}
