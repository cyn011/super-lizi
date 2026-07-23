/**
 * core/physics/aabb — 轴对齐包围盒（AABB）重叠工具（GDD 02 §3 / 架构 §4.2）。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 *
 * 供实体拾取 / 检查点 / 任意命中判定复用；与 Body 矩形结构兼容（多出的 vx/vy 字段不影响）。
 */
/** 矩形（轴对齐），左上角 (x,y) + 宽高 (w,h)。 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 两个 AABB 是否重叠（标准分离轴测试，开区间允许边贴边不触发）。
 * @returns true 表示两矩形在二维上有交集。
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
