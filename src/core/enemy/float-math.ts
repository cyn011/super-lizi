/**
 * core/enemy/float-math — 嘟浮 / 嘟浮剪影共享正弦浮动纯函数（GDD 16 §2 / GDD 04，零平台）。
 *
 * 单一浮动数学：omega = float / amp（rad/s），使峰值竖直速度 = float（px/s）；
 * y = baseY + amp·sin(phase + phaseOffset)；vy = float·cos(phase + phaseOffset)。
 * 剪影与原嘟浮复用同一套公式，仅 phaseOffset 不同（剪影 = π → 反相成对）。
 *
 * core 铁律：本文件不依赖任何渲染框架或平台 API，不读写全局状态；
 * 输入仅 state + dt + x + phaseOffset，输出新几何（无副作用、可 headless 单测）。
 */
export interface FloatState {
  /** 浮动基准 y（px，= baseY）。 */
  baseY: number;
  /** 振幅（px）。 */
  amp: number;
  /** 峰值竖直速度（px/s，决定 omega = float/amp）。 */
  float: number;
  /** 当前相位（rad，不含 phaseOffset）。 */
  phase: number;
}

export interface FloatResult {
  /** 推进后相位（rad）。 */
  phase: number;
  /** 当前 x（px，原样回传，浮动不改变水平位置）。 */
  x: number;
  /** 当前 y（px）。 */
  y: number;
  /** 水平速度（恒 0）。 */
  vx: number;
  /** 当前竖直速度（px/s）。 */
  vy: number;
}

/**
 * 单步推进正弦浮动。
 * @param s 当前浮动状态（baseY/amp/float/phase）
 * @param dt 步长（秒，固定步长 1/60）
 * @param x 当前水平坐标（原样保持回传）
 * @param phaseOffset 相位偏移（剪影 = π 反相；原嘟浮 = 0）
 */
export function applyFloat(s: FloatState, dt: number, x: number, phaseOffset: number): FloatResult {
  const omega = s.amp > 0 ? s.float / s.amp : 0; // rad/s，使峰值竖直速度 = float
  const phase = s.phase + omega * dt;
  const y = s.baseY + s.amp * Math.sin(phase + phaseOffset);
  const vy = s.float * Math.cos(phase + phaseOffset);
  return { phase, x, y, vx: 0, vy };
}
