/**
 * core/tide/tide — 潮汐水位线纯函数（GDD 1-3 §4，core 零平台铁律）。
 *
 * 水位线 worldY 随关卡段（TideSegmentDef）定时正弦起伏；worldY 以下视作水域 hazard。
 * 纯函数、确定性、零 Phaser / 零平台 API；所有数值来自 LevelData.tideSegments。
 *
 * 公式（GDD 1-3 §4.3）：
 *   mid  = (lowY + highY) / 2
 *   amp  = (lowY - highY) / 2            // lowY > highY ⇒ amp > 0
 *   waterTopY(t) = mid + amp · sin(2π · (t + phase) / periodMs)
 * 其中 lowY=低潮水位（露出最多）、highY=高潮水位（淹没最多）。
 */
import type { TideSegmentDef } from '../level/level-data';

const TWO_PI = Math.PI * 2;

/**
 * 计算某潮汐段在 timeMs 时刻的水位线 worldY（px）。
 * @param seg 潮汐段定义（含 lowY/highY/periodMs/phase）。
 * @param timeMs 当前关卡仿真时间（ms，与 game-scene 的 elapsedMs 同源）。
 */
export function tideSurfaceY(seg: TideSegmentDef, timeMs: number): number {
  const mid = (seg.lowY + seg.highY) / 2;
  const amp = (seg.lowY - seg.highY) / 2;
  return mid + amp * Math.sin((TWO_PI * (timeMs + seg.phase)) / seg.periodMs);
}

/**
 * 查找包含给定世界 x 的潮汐段（含端点）；无匹配返回 null。
 * 多段不重叠（GDD 1-3 §4.3 各段 x 区间独立），取首个命中。
 */
export function tideSegmentAt(
  segs: readonly TideSegmentDef[],
  x: number,
): TideSegmentDef | null {
  for (const s of segs) {
    if (x >= s.xStart && x <= s.xEnd) return s;
  }
  return null;
}

/**
 * 反相校验辅助（测试/调试用）：两段的相位差是否约等于半周期（错开）。
 * 容差放宽到 ±25%（≥1/4 周期即视为明显错位），仅用于「T1/T2 反相」语义断言。
 */
export function isAntiPhase(a: TideSegmentDef, b: TideSegmentDef): boolean {
  const phaseDiff = Math.abs(a.phase - b.phase) % Math.max(a.periodMs, b.periodMs);
  const halfA = a.periodMs / 2;
  const halfB = b.periodMs / 2;
  // 落在 [半周期·(1-ε), 半周期·(1+ε)] 附近即视为反相错开
  const near = (v: number, half: number) => Math.abs(v - half) <= half * 0.5;
  return near(phaseDiff, halfA) || near(phaseDiff, halfB) || near(phaseDiff, (halfA + halfB) / 2);
}
