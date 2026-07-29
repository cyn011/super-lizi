/**
 * ui/touch-buttons-constants — 微信触屏虚拟控件常量与纯逻辑。
 *
 * 本文件不依赖 Phaser / DOM，可在 Node 单测环境直接 import。
 * 渲染类 TouchButtons 位于 touch-buttons.ts。
 */
import { inputConfig } from '../core/config';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../platform/detect';

// ---- 公开类型 ----
export type ButtonId = 'left' | 'right' | 'jump' | 'action';
export type ButtonType = 'direction' | 'action';
/** 物理信号 id（来自 RawInputFrame.down）。对微信端为 'touch:left' / 'touch:right' / 'touch:jump' / 'touch:action'。 */
export type SignalId = string;

// ---- 常量表（导出用于测试 + 设计自检）----
export const BUTTON_ORDER: readonly ButtonId[] = ['left', 'right', 'jump', 'action'] as const;
export const BUTTON_IDS: readonly ButtonId[] = BUTTON_ORDER;
export const BUTTON_TYPE: Record<ButtonId, ButtonType> = {
  left: 'direction',
  right: 'direction',
  jump: 'action',
  action: 'action',
};

/** 'touch:left' → 'left' 等。无匹配返回 null（容错：未来扩展按钮不需改此处）。 */
export function resolveButtonId(signalId: SignalId): ButtonId | null {
  for (const id of BUTTON_ORDER) {
    if (signalId === `touch:${id}`) return id;
  }
  return null;
}

// ---- 深底浅边调色板（参考用户截图：深棕底 + 奶油边/图标）----
/** 深棕主底板：#5D4037 */
export const BASE_DARK = 0x5d4037;
/** 略浅内部色（用于内倒角层次）：#6D4C41 */
export const BASE_MID = 0x6d4c41;
/** 浅米色外描边 / 暂停图标：#F5DEB3 */
export const OUTLINE_LIGHT = 0xf5deb3;
/** 图标主色：奶油色 #FFF8DC */
export const ICON_CREAM = 0xfff8dc;
/** 图标顶部高光：#FFFFFF（淡） */
export const ICON_HIGHLIGHT = 0xffffff;
/** 图标底部阴影：#D7CCC8 */
export const ICON_SHADOW = 0xd7ccc8;
/** 按钮顶部高光：浅米色 #EFEBE9 */
export const HIGHLIGHT = 0xefebe9;
/** 按钮底部阴影：深棕 #3E2723 */
export const SHADOW_DARK = 0x3e2723;
/** 按下态描边：暖黄 #FFD54F */
export const PRESSED_OUTLINE = 0xffd54f;

/** 底部阴影向下偏移像素。 */
export const SHADOW_OFFSET = 3;

/** 弹起弹性回弹 tween 参数。 */
export const RELEASE_TWEEN_MS = 200;
export const RELEASE_TWEEN_EASE = 'Back.Out';

// ---- 视觉规格（导出给测试回归）----
export interface ButtonVisualSpec {
  fillColor: number;
  fillAlphaDefault: number;
  fillAlphaPressed: number;
  lineWidthDefault: number;
  lineWidthPressed: number;
  lineColorDefault: number;
  lineColorPressed: number;
  pressedScale: number;
}

export const BUTTON_VISUAL_SPEC: Record<ButtonId, ButtonVisualSpec> = {
  left: {
    fillColor: BASE_DARK,
    fillAlphaDefault: 1.0,
    fillAlphaPressed: 1.0,
    lineWidthDefault: 2,
    lineWidthPressed: 2,
    lineColorDefault: OUTLINE_LIGHT,
    lineColorPressed: PRESSED_OUTLINE,
    pressedScale: 0.96,
  },
  right: {
    fillColor: BASE_DARK,
    fillAlphaDefault: 1.0,
    fillAlphaPressed: 1.0,
    lineWidthDefault: 2,
    lineWidthPressed: 2,
    lineColorDefault: OUTLINE_LIGHT,
    lineColorPressed: PRESSED_OUTLINE,
    pressedScale: 0.96,
  },
  jump: {
    fillColor: BASE_DARK,
    fillAlphaDefault: 1.0,
    fillAlphaPressed: 1.0,
    lineWidthDefault: 2,
    lineWidthPressed: 2,
    lineColorDefault: OUTLINE_LIGHT,
    lineColorPressed: PRESSED_OUTLINE,
    pressedScale: 0.92,
  },
  action: {
    fillColor: BASE_DARK,
    fillAlphaDefault: 1.0,
    fillAlphaPressed: 1.0,
    lineWidthDefault: 2,
    lineWidthPressed: 2,
    lineColorDefault: OUTLINE_LIGHT,
    lineColorPressed: PRESSED_OUTLINE,
    pressedScale: 0.92,
  },
};

// ---- 几何/坐标辅助（不依赖 Phaser）----
export interface RoundRectGeom {
  w: number;
  h: number;
  radius: number;
}
export interface CircleGeom {
  r: number;
}

/** 方向键几何（基于 inputConfig）；PNG 为正方形，禁止非等比拉伸。 */
export function buildDirectionGeom(id: ButtonId): { geom: RoundRectGeom; cx: number; cy: number } {
  const cfg = inputConfig.wechat.buttons[id];
  const r = cfg.r * LOGICAL_WIDTH;
  const size = r * 2;
  return {
    geom: { w: size, h: size, radius: size * 0.18 },
    cx: cfg.x * LOGICAL_WIDTH,
    cy: cfg.y * LOGICAL_HEIGHT,
  };
}

/** 圆形按钮几何（基于 inputConfig）。 */
export function buildCircleGeom(id: ButtonId): { geom: CircleGeom; cx: number; cy: number } {
  const cfg = inputConfig.wechat.buttons[id];
  return {
    geom: { r: cfg.r * LOGICAL_WIDTH },
    cx: cfg.x * LOGICAL_WIDTH,
    cy: cfg.y * LOGICAL_HEIGHT,
  };
}
