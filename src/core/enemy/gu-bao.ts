/**
 * core/enemy/gu-bao — 鼓苞（gu_bao）四态状态机（GDD 13 §3，纯函数，零平台）。
 *
 * 表驱动、可 headless 单测。core 铁律：本文件不依赖任何渲染框架或平台 API，
 * 不读写任何全局状态——所有推进由 stepGuBao 纯函数完成，几何/危害/可踩全部由参数推导。
 *
 * 四态循环：DORMANT(地下·无害) → EMERGING(升起·前摇·危害) → ACTIVE(全出·危害)
 *          → RETRACTING(缩回·软顶·可踩) → 回 DORMANT。
 * 周期 T = dormantMs + emergeMs + activeMs + retractMs（默认 2120ms）。
 *
 * 几何：盒底贴地（anchorY），盒顶 = anchorY - p×height；p=0 → 盒高 0（地下无碰撞）。
 * 危害：EMERGING/ACTIVE = true（接触走 GDD 07 受伤管线）；RETRACTING = false（可踩）。
 * 可踩：仅 RETRACTING = true（踩 → ON_STOMP +100 + 反弹，复用既有管线）。
 */
import type { EnemyTypeName } from './enemy-types';

/** 鼓苞四态（GDD 13 §2）。 */
export type GuBaoState = 'DORMANT' | 'EMERGING' | 'ACTIVE' | 'RETRACTING';

/** 状态机数值（全部来自 enemy-config.json 的 gu_bao 项，禁止硬编码）。 */
export interface GuBaoCfg {
  /** 地下静默时长（ms）。 */
  dormantMs: number;
  /** 升起前摇时长（ms）。 */
  emergeMs: number;
  /** 完全喷出（危险）时长（ms）。 */
  activeMs: number;
  /** 缩回（可踩窗口）时长（ms）。 */
  retractMs: number;
  /** 完全喷出高度（px，盒顶相对 anchorY 的最大上移量）。 */
  height: number;
  /** 碰撞盒宽（px）。 */
  width: number;
}

/** stepGuBao 单步返回值。 */
export interface GuBaoStep {
  /** 推进后的状态。 */
  state: GuBaoState;
  /** 推进后本态已用时间（ms），供下一步继续累加。 */
  t: number;
  /** 升起进度 0..1（DORMANT=0 / EMERGING 线性 / ACTIVE=1 / RETRACTING 递减）。 */
  p: number;
  /** 当前态是否危害（接触玩家 → 受伤管线）。 */
  hazard: boolean;
  /** 当前态是否可踩（RETRACTING 顶踩 → 踩杀 + 计分）。 */
  stompable: boolean;
}

/** 默认 cfg（GDD 13 §3.1 + 任务 P-LEVEL-04 拍板默认）。 */
export const DEFAULT_GU_BAO_CFG: GuBaoCfg = {
  dormantMs: 1100,
  emergeMs: 160,
  activeMs: 700,
  retractMs: 160,
  height: 48,
  width: 32,
};

/** 状态顺序（循环数组）。 */
const GU_BAO_STATES: readonly GuBaoState[] = ['DORMANT', 'EMERGING', 'ACTIVE', 'RETRACTING'];

/** 周期 T（ms）。 */
export function guBaoPeriod(cfg: GuBaoCfg): number {
  return cfg.dormantMs + cfg.emergeMs + cfg.activeMs + cfg.retractMs;
}

function stateDuration(s: GuBaoState, cfg: GuBaoCfg): number {
  switch (s) {
    case 'DORMANT':
      return cfg.dormantMs;
    case 'EMERGING':
      return cfg.emergeMs;
    case 'ACTIVE':
      return cfg.activeMs;
    case 'RETRACTING':
      return cfg.retractMs;
  }
}

function nextGuBaoState(s: GuBaoState): GuBaoState {
  const i = GU_BAO_STATES.indexOf(s);
  return GU_BAO_STATES[(i + 1) % GU_BAO_STATES.length];
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** 升起进度 p（按态 + 本态已用时间 t 推导，0..1）。 */
export function guBaoProgress(s: GuBaoState, t: number, cfg: GuBaoCfg): number {
  switch (s) {
    case 'DORMANT':
      return 0;
    case 'EMERGING':
      return clamp01(t / cfg.emergeMs);
    case 'ACTIVE':
      return 1;
    case 'RETRACTING':
      return clamp01(1 - t / cfg.retractMs);
  }
}

/** 几何：盒顶 y（px），anchorY 为地面锚点（苞自此处升起）。 */
export function guBaoTopY(anchorY: number, p: number, cfg: GuBaoCfg): number {
  return anchorY - p * cfg.height;
}

/**
 * 单步推进纯函数。
 * @param s 当前态
 * @param t 当前态已用时间（ms）
 * @param dt 步长（秒，固定步长 1/60）
 * @param cfg 状态机数值
 * @returns 推进后的 { state, t, p, hazard, stompable }
 *
 * 边界处理：
 *  - 跨态：nt = t + dt*1000，若 ≥ 本态时长则结转剩余时间进入下一态（固定步下单步至多切一次，
 *    仍保留鲁棒循环 + guard 上限，防止非法 cfg(duration≤0) 死循环）。
 *  - 状态切换帧的踩踏竞态：同一步内 ACTIVE→RETRACTING 时，推进后 state=RETRACTING、
 *    stompable=true，保证窗口边界可踩（GDD 13 §5 边缘情况 3）。
 */
export function stepGuBao(s: GuBaoState, t: number, dt: number, cfg: GuBaoCfg): GuBaoStep {
  let cur = s;
  let nt = t + dt * 1000;
  let guard = 0;
  while (guard++ < GU_BAO_STATES.length + 4) {
    const dur = stateDuration(cur, cfg);
    if (nt >= dur) {
      nt -= dur;
      cur = nextGuBaoState(cur);
    } else {
      break;
    }
  }
  const p = guBaoProgress(cur, nt, cfg);
  const hazard = cur === 'EMERGING' || cur === 'ACTIVE';
  const stompable = cur === 'RETRACTING';
  return { state: cur, t: nt, p, hazard, stompable };
}

/**
 * 由 phaseOffset（ms）推导初始态 + 本态已用时间。
 * phaseOffset ≥ T 或负数均经 `mod T` 归一化（GDD 13 §5 边缘情况 4）。
 * @returns { state, t } —— EnemyAI 构造时设定初始相位（双苞交替走廊用）。
 */
export function resolveGuBaoPhase(
  phaseOffset: number,
  cfg: GuBaoCfg,
): { state: GuBaoState; t: number } {
  const T = guBaoPeriod(cfg);
  if (T <= 0) return { state: 'DORMANT', t: 0 };
  const ph = ((phaseOffset % T) + T) % T; // 归一化到 [0, T)
  let acc = 0;
  for (const st of GU_BAO_STATES) {
    const dur = stateDuration(st, cfg);
    if (ph < acc + dur) return { state: st, t: ph - acc };
    acc += dur;
  }
  return { state: 'DORMANT', t: 0 };
}

/** 类型守卫：用于 createEnemies / render 的窄化（保持 EnemyTypeName 集中一处）。 */
export function isGuBao(type: EnemyTypeName): type is 'gu_bao' {
  return type === 'gu_bao';
}
