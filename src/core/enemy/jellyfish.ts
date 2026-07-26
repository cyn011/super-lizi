/**
 * core/enemy/jellyfish — 水母（jellyfish）专属敌（GDD 1-3 §3.2，core 零平台铁律）。
 *
 * 行为（与通用敌 du_fu 同源但三重区分，防色盲混淆）：
 *   - 垂直正弦浮动（x 静止，只上下浮）→ 稳定「踏脚石」；复用 du_fu 浮动数学 applyFloat。
 *   - soft 顶可踩（踩踏 = ON_STOMP 弹跳，同 du_fu 经济/反馈）。
 *   - 触手/侧身**不伤**（nonDamaging）：与四种通用敌一致「soft 顶可踩、硬顶伤」，但水母连侧身都无害。
 *   - 持久踩踏（persistentStomp）：被踩仅弹起、不被消灭 → 可反复作踏脚石（区别于 du_fu 踩杀）。
 *
 * 数值全部来自 enemy-config.json 的 jellyfish 项（float/amp/width/height/...），禁止硬编码。
 * 几何/危害/可踩由 EnemyAI 统一推导；本模块仅提供 cfg + 浮动步进纯函数（供单测）。
 */
import { applyFloat, type FloatState, type FloatResult } from './float-math';

/** 水母配置（全部来自 enemy-config.json，禁止硬编码）。 */
export interface JellyfishCfg {
  /** 峰值竖直速度（px/s），决定浮动 omega = float/amp。 */
  float: number;
  /** 浮动振幅（px，对应 GDD §3.2 的 bob 区间半宽，如 J1 86..134 ⇒ amp=24）。 */
  amp: number;
  /** 是否可踩（soft 顶）。 */
  stompable: boolean;
  /** 触手/侧身是否不造成伤害（水母温柔，仅踏脚石）。 */
  nonDamaging: boolean;
  /** 被踩是否仅弹起、不被消灭（持久踏脚石）。 */
  persistentStomp: boolean;
  /** 碰撞盒宽（px），GDD §3.2 约定 36。 */
  width: number;
  /** 碰撞盒高（px），GDD §3.2 约定 40。 */
  height: number;
}

/** 默认 cfg（GDD 1-3 §3.2：振幅 24px、周期≈3000ms ⇒ omega≈2.09rad/s ⇒ float≈50px/s）。 */
export const DEFAULT_JELLYFISH_CFG: JellyfishCfg = {
  float: 50,
  amp: 24,
  stompable: true,
  nonDamaging: true,
  persistentStomp: true,
  width: 36,
  height: 40,
};

/** 水母浮动状态（复用 du_fu FloatState）。 */
export type JellyfishState = FloatState;

/**
 * 单步推进水母垂直浮动（x 静止，仅 y 随正弦上下）。
 * @param s 当前浮动状态（baseY/amp/float/phase）
 * @param dt 步长（秒，固定步长 1/60）
 * @param x 当前水平坐标（原样保持回传）
 * @returns 推进后 { phase, x, y, vx:0, vy }
 */
export function stepJellyfish(s: JellyfishState, dt: number, x: number): FloatResult {
  return applyFloat(s, dt, x, 0);
}
