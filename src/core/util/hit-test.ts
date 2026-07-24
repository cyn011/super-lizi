/**
 * core/util/hit-test — 纯 AABB 命中测试（零 Phaser / 零平台 API）。
 *
 * 供 ui/（PauseMenu / ResultScreen）与 platform/wechat（原生按钮路由）共用，
 * 保证「逻辑坐标命中盒」判定单一事实来源，可被 Node 单测。
 * 坐标系同 input-abstraction：逻辑分辨率 512×288（见 GDD 01 §6/§7）。
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 点 (px,py) 是否落在轴对齐矩形 rect 内（含边界）。
 * 与 PauseMenu.handleTap / ResultScreen.handleTap 的原内联判定完全一致。
 */
export function pointInRect(px: number, py: number, rect: Rect): boolean {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}
