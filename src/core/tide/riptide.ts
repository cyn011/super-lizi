/**
 * core/tide/riptide — 暗流（riptide）区域力场纯函数（GDD 1-3 §5.1，core 零平台铁律）。
 *
 * 暗流 = 关卡内一块矩形区域；栗宝中心位于区域内时，场景对其施加水平速度偏置（轻量、可被输入覆盖）。
 * 类比 cyclone 力场：纯几何判定，非实体、非碰撞；仅作 flavor 推力，不构硬锁。
 *
 * 纯函数、确定性、零 Phaser / 零平台 API；所有数值来自 LevelData.riptide。
 */
import type { RiptideDef } from '../level/level-data';

/**
 * 查找包含给定世界坐标 (x,y) 的暗流区域（含端点）；无匹配返回 null。
 * @param zones 关卡暗流区域列表（LevelData.riptide）。
 * @param x 判定点 x（通常取栗宝中心 x）。
 * @param y 判定点 y（通常取栗宝中心 y）。
 */
export function riptideAt(
  zones: readonly RiptideDef[] | undefined,
  x: number,
  y: number,
): RiptideDef | null {
  if (!zones) return null;
  for (const z of zones) {
    if (x >= z.xStart && x <= z.xEnd && y >= z.yTop && y <= z.yBottom) return z;
  }
  return null;
}
