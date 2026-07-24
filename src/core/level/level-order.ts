/**
 * core/level/level-order — 关卡顺序纯函数（进度链，S06）。
 *
 * 给定静态关卡顺序数组与当前关卡 id，返回下一关 id；
 * 当前关不在顺序中或已是末关则返回 null（便于单测与 UI 判定）。
 * 零 Phaser / 零平台依赖。
 */
export function nextLevelId(order: readonly string[], current: string): string | null {
  const idx = order.indexOf(current);
  if (idx < 0 || idx + 1 >= order.length) return null;
  return order[idx + 1];
}
