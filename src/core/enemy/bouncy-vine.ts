/**
 * core/enemy/bouncy-vine — 弹藤（bouncy_vine）三态状态机（GDD 14 §3，纯函数，零平台）。
 *
 * 表驱动、可 headless 单测。core 铁律：本文件不依赖任何渲染框架或平台 API，
 * 不读写任何全局状态——所有推进由 stepBouncyVine 纯函数完成，几何/危害/可踩全部由参数推导。
 *
 * 三态（GDD 14 §2，事件驱动，落地下降边沿触发）：
 *   IDLE（线圈待命，launchReady=true，p=0）
 *   → SPRING（压缩→释放，当帧 justFired=true 套用弹起，p:0→1）
 *   → RECOIL（回弹松弛，冷却窗口，p:1→0）
 *   → 回 IDLE。
 *
 * 危害：全态 hazard=false（纯辅助，茎部无害）；可踩：全态 isStompable=false（非击杀型）。
 * 弹起走独立零计分事件 ON_BOUNCE（不进 GDD06 计分分支，防刷分，GDD 14 §6 红线）。
 */
import type { EnemyTypeName } from './enemy-types';

/** 弹藤三态（GDD 14 §2）。 */
export type BouncyVineState = 'IDLE' | 'SPRING' | 'RECOIL';

/** 状态机数值（全部来自 enemy-config.json 的 bouncy_vine 项，禁止硬编码）。 */
export interface BouncyVineCfg {
  /** 弹起速度（px/s，向上为负；默认 -680）。 */
  bounceVelocity: number;
  /** 压缩/释放动画时长（ms）。 */
  springMs: number;
  /** 冷却（不可再触发）时长（ms）。 */
  recoilMs: number;
  /** 碰撞盒宽（px）。 */
  width: number;
  /** 碰撞盒高（px，地面线圈厚度 ~16）。 */
  height: number;
  /** 恒 false（纯辅助）。 */
  hazard: boolean;
}

/** stepBouncyVine 单步返回值。 */
export interface BouncyVineStep {
  /** 推进后状态。 */
  state: BouncyVineState;
  /** 推进后本态已用时间（ms）。 */
  t: number;
  /** 压缩/回弹进度 0..1（IDLE=0 / SPRING 升 / RECOIL 降）。 */
  p: number;
  /** 当前态是否危害（恒 false）。 */
  hazard: boolean;
  /** 当前态是否可触发弹起（仅 IDLE=true）。 */
  launchReady: boolean;
  /** 当帧 IDLE→SPRING 进入 = true（集成层据此套用弹起速度一次）。 */
  justFired: boolean;
}

/** 默认 cfg（GDD 14 §3.1）。 */
export const DEFAULT_BOUNCY_VINE_CFG: BouncyVineCfg = {
  bounceVelocity: -680,
  springMs: 80,
  recoilMs: 180,
  width: 40,
  height: 16,
  hazard: false,
};

/** 状态顺序（循环数组）。 */
const BOUNCY_VINE_STATES: readonly BouncyVineState[] = ['IDLE', 'SPRING', 'RECOIL'];

function stateDuration(s: BouncyVineState, cfg: BouncyVineCfg): number {
  switch (s) {
    case 'IDLE':
      return Infinity; // 持久待命，等落地边沿 contact 触发
    case 'SPRING':
      return cfg.springMs;
    case 'RECOIL':
      return cfg.recoilMs;
  }
}

function nextBouncyVineState(s: BouncyVineState): BouncyVineState {
  const i = BOUNCY_VINE_STATES.indexOf(s);
  return BOUNCY_VINE_STATES[(i + 1) % BOUNCY_VINE_STATES.length];
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** 压缩/回弹进度 p（按态 + 本态已用时间 t 推导，0..1）。 */
export function bouncyVineProgress(s: BouncyVineState, t: number, cfg: BouncyVineCfg): number {
  switch (s) {
    case 'IDLE':
      return 0;
    case 'SPRING':
      return clamp01(t / cfg.springMs);
    case 'RECOIL':
      return clamp01(1 - t / cfg.recoilMs);
  }
}

/**
 * 单步推进纯函数（GDD 14 §3.3）。
 * @param s 当前态
 * @param t 当前态已用时间（ms）
 * @param dt 步长（秒，固定步长 1/60）
 * @param cfg 状态机数值
 * @param contact 集成层传入的「顶部落地下降边沿」布尔（player.vy>=0 且底触藤顶且上帧未接触）
 *         —— 由集成层用 AABB 顶触检测派生，零平台、不引用任何渲染框架
 * @returns 推进后的 { state, t, p, hazard, launchReady, justFired }
 */
export function stepBouncyVine(
  s: BouncyVineState,
  t: number,
  dt: number,
  cfg: BouncyVineCfg,
  contact: boolean,
): BouncyVineStep {
  // IDLE + contact → SPRING（当帧 justFired=true，p=0，t=0；集成层套用弹起速度）
  if (s === 'IDLE' && contact) {
    return {
      state: 'SPRING',
      t: 0,
      p: 0,
      hazard: cfg.hazard,
      launchReady: false,
      justFired: true,
    };
  }

  // 其余：按态推进（固定步下单步至多切一次；保留鲁棒循环 + guard 上限防非法 cfg）。
  let cur = s;
  let nt = t + dt * 1000;
  let guard = 0;
  while (guard++ < 8) {
    const dur = stateDuration(cur, cfg);
    if (nt >= dur) {
      nt -= dur;
      cur = nextBouncyVineState(cur);
    } else {
      break;
    }
  }
  const p = bouncyVineProgress(cur, nt, cfg);
  const hazard = cfg.hazard; // 恒 false（纯辅助）
  const launchReady = cur === 'IDLE'; // 仅 IDLE 可触发弹起
  return { state: cur, t: nt, p, hazard, launchReady, justFired: false };
}

/**
 * 弹起速度倍率解析（GDD 14 §3.2 / §4）。
 * 设计档用字符串 'weak'|'normal'|'strong'，但 EntityDef.params 为 Record<string,number>，
 * 故工程层以数值倍率透传：normal=1.0（缺省）、strong=1.2、weak=0.8。
 * 非法/缺省回退 1.0。
 */
export function resolveBouncyVinePower(params?: Record<string, number>): number {
  if (!params) return 1;
  const p = params.power;
  return typeof p === 'number' && p > 0 ? p : 1;
}

/** 类型守卫：用于 createEnemies / render 的窄化（保持 EnemyTypeName 集中一处）。 */
export function isBouncyVine(type: EnemyTypeName): type is 'bouncy_vine' {
  return type === 'bouncy_vine';
}
