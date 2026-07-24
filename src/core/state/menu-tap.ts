/**
 * core/state/menu-tap — 原生菜单点击路由判定（E7.S3 / S05-5，零平台 API）。
 *
 * 纯逻辑：据当前 RunState 派生的 UI 可见性，决定一次原生触摸应路由到
 * 哪个菜单的 handleTap（PauseMenu / ResultScreen）。
 * 供 game-scene 的 routeMenuTap 使用；与 ui/ 的 PauseMenu.handleTap / ResultScreen.handleTap
 * 解耦（本模块不 import Phaser、不直接调用它们）。
 */

export interface MenuTapContext {
  /** RunState 是否处于 PAUSED（暂停遮罩可见）。 */
  paused: boolean;
  /** RunState 是否处于 LEVEL_COMPLETE（结算面板可见）。 */
  levelComplete: boolean;
  /** PauseMenu 是否已构建（isBuilt）。 */
  pauseBuilt: boolean;
  /** ResultScreen 是否已构建（isBuilt）。 */
  resultBuilt: boolean;
}

export type ActiveMenu = 'pause' | 'result' | null;

/**
 * 解析当前应接收原生点击的菜单：
 *   - paused && pauseBuilt → 'pause'
 *   - levelComplete && resultBuilt → 'result'
 *   - 否则（PLAYING / 仅标志为真但组件未建）→ null（交给 gameplay 输入）
 * 暂停优先级高于结算（二者不同时成立；若异常同时为真，暂停优先）。
 */
export function resolveActiveMenu(ctx: MenuTapContext): ActiveMenu {
  if (ctx.paused && ctx.pauseBuilt) return 'pause';
  if (ctx.levelComplete && ctx.resultBuilt) return 'result';
  return null;
}
