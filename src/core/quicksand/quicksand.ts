/**
 * core/quicksand/quicksand — 流沙下陷纯函数（GDD 1-4 §4，core 零平台铁律）。
 *
 * 流沙 = 地面危险区域，玩家脚底进入 [xStart,xEnd] 且 y≥surfaceY（地面接触）即持续下陷，
 * 触底（y≥deathY）即死（respawn 到检查点，复用 07）。区别于 1-3 潮汐（软伤害、可飞越）：
 * 流沙致死但 telegraph + 逃脱窗口守住公平。
 *
 * 关键规则：
 *   - 空中（跳跃中，grounded=false）不触发下陷 → 跳跃跨越 = 安全解法之一。
 *   - 下陷速率在 telegraphMs 内由 0 线性渐变到 sinkRate（漩涡+暗色渐显双编码 telegraph）。
 *   - 触底判定：累计下陷深度 ≥ (deathY - surfaceY) → 触发死亡。
 *
 * 纯函数、确定性、零 Phaser / 零平台 API；所有数值来自 LevelData.quicksand。
 */
import type { QuicksandDef } from '../level/level-data';

/** 找到包含世界 x 的流沙区（含端点）；无匹配返回 null（zones 缺省安全返回 null）。 */
export function quicksandZoneAt(
  zones: readonly QuicksandDef[] | undefined,
  x: number,
): QuicksandDef | null {
  if (!zones || zones.length === 0) return null;
  for (const z of zones) {
    if (x >= z.xStart && x <= z.xEnd) return z;
  }
  return null;
}

/**
 * 玩家是否处于流沙下陷状态：
 *   脚底 x 在 [xStart,xEnd] 区间内 且 脚底接触地面（grounded）且 脚底 y ≥ surfaceY。
 * 空中（!grounded）不触发 → 跳跃跨越安全。
 */
export function isQuicksandSinking(
  zone: QuicksandDef,
  body: { x: number; y: number; w: number; h: number },
  grounded: boolean,
): boolean {
  const cx = body.x + body.w / 2;
  if (cx < zone.xStart || cx > zone.xEnd) return false;
  if (!grounded) return false; // 空中不触发
  const bottom = body.y + body.h;
  return bottom >= zone.surfaceY;
}

/**
 * 下陷速率（telegraph 渐变）：入场后 telegraphMs 内由 0 线性渐变到 sinkRate，之后保持满速。
 * telegraphMs<=0 时立即满速（退化为无前摇）。
 */
export function quicksandSinkRate(def: QuicksandDef, sinkMs: number): number {
  const t = def.telegraphMs <= 0 ? 1 : Math.min(1, sinkMs / def.telegraphMs);
  return def.sinkRate * t;
}

/** 累计下陷深度是否达到致死阈值（触底 deathY）。 */
export function quicksandBottomedOut(def: QuicksandDef, sinkDepth: number): boolean {
  return sinkDepth >= def.deathY - def.surfaceY;
}

/**
 * 渲染下沉视觉 offset（不改碰撞盒）：玩家身体仍停在地面（地面为实心，不挖空），
 * 仅把 sprite 向下偏移 sinkDepth（钳到致死深度内），呈现「陷没沙底」效果。
 */
export function quicksandVisualOffset(def: QuicksandDef, sinkDepth: number): number {
  const max = def.deathY - def.surfaceY;
  return Math.max(0, Math.min(sinkDepth, max));
}

/** 派生：逃脱窗口（站定不动到触底的时间，秒）= (deathY - surfaceY) / sinkRate。 */
export function quicksandEscapeWindow(def: QuicksandDef): number {
  if (def.sinkRate <= 0) return Infinity;
  return (def.deathY - def.surfaceY) / def.sinkRate;
}
