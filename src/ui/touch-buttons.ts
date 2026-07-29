/**
 * ui/touch-buttons — 微信触屏虚拟控件可视化。
 *
 * 设计风格（方案 G · 深底浅边）：
 * - 参考用户截图：深棕色按钮底板 + 奶油米色粗描边 + 奶油色图标。
 * - 立体感来自内倒角：顶部/左侧浅高光 + 底部/右侧深阴影，外圈一道明显的浅米色描边。
 * - 左/右：横向圆角矩形（圆角较小），内嵌用户提供胖箭头 PNG（左键水平翻转）。
 * - 动作：小圆钮，内嵌用户提供的栗子攻击星形 PNG。
 * - 跳跃：大圆钮，内嵌用户提供的上箭头 PNG。
 * - 暂停：右上深底圆钮，内嵌双竖线（仍用 Graphics 实时绘制）。
 *
 * 四个控制按钮优先使用 PNG 纹理（'ui-arrow-btn' / 'ui-action-btn' / 'ui-jump-btn'），
 * 加载失败则降级为代码绘制（零位图资产，ADR-004）。
 * 命中区/坐标/半径仍来自 inputConfig.wechat.buttons，与 wechat-touch 命中公式一致。
 */
import Phaser from 'phaser';
import { inputConfig } from '../core/config';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../platform/detect';
import {
  type ButtonId,
  type ButtonType,
  type SignalId,
  type ButtonVisualSpec,
  type RoundRectGeom,
  type CircleGeom,
  BUTTON_ORDER,
  BUTTON_TYPE,
  BUTTON_VISUAL_SPEC,
  BASE_DARK,
  BASE_MID,
  OUTLINE_LIGHT,
  ICON_CREAM,
  ICON_HIGHLIGHT,
  SHADOW_DARK,
  HIGHLIGHT,
  PRESSED_OUTLINE,
  SHADOW_OFFSET,
  RELEASE_TWEEN_MS,
  RELEASE_TWEEN_EASE,
  buildDirectionGeom,
  buildCircleGeom,
  resolveButtonId,
} from './touch-buttons-constants';

export {
  type ButtonId,
  type ButtonType,
  type SignalId,
  type ButtonVisualSpec,
  BUTTON_ORDER,
  BUTTON_TYPE,
  BUTTON_VISUAL_SPEC,
  BASE_DARK,
  BASE_MID,
  OUTLINE_LIGHT,
  ICON_CREAM,
  ICON_HIGHLIGHT,
  SHADOW_DARK,
  HIGHLIGHT,
  PRESSED_OUTLINE,
  resolveButtonId,
};

/** 图片纹理键：用户提供的 PNG 按钮素材。 */
const ARROW_TEXTURE_KEY = 'ui-arrow-btn';
const ACTION_TEXTURE_KEY = 'ui-action-btn';
const JUMP_TEXTURE_KEY = 'ui-jump-btn';

/** 四钮公共控制接口（DarkRect / DarkCircle / ImageButton 统一实现）。 */
interface ButtonControl {
  readonly id: ButtonId;
  setPressed(pressed: boolean): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
}

type IconPainter = (g: Phaser.GameObjects.Graphics, size: number) => void;

// ---- 图片按钮（四个控制钮通用；方向键可为矩形，动作/跳跃为圆钮）----
class ImageButton implements ButtonControl {
  readonly id: ButtonId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private readonly spec: ButtonVisualSpec;

  private pressed = false;
  private disabled = false;

  constructor(
    scene: Phaser.Scene,
    id: ButtonId,
    cx: number,
    cy: number,
    textureKey: string,
    displayW: number,
    displayH: number,
    flipX = false,
  ) {
    this.id = id;
    this.scene = scene;
    this.spec = BUTTON_VISUAL_SPEC[id];

    this.container = scene.add.container(cx, cy).setDepth(1000).setScrollFactor(0);
    this.image = scene.add.image(0, 0, textureKey).setScrollFactor(0);
    // 原始按钮是 128×128 PNG，运行时会缩小到约 28–36px。
    // 缩小时使用线性采样，保留原图的圆边、高光与描边细节（Web + 微信两端）。
    this.image.setTexture(textureKey);
    this.image.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.image.setDisplaySize(displayW, displayH);
    this.image.setFlipX(flipX);
    this.container.add(this.image);
  }

  setPressed(pressed: boolean): void {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    this.scene.tweens.killTweensOf(this.container);
    if (pressed) {
      this.container.setScale(this.spec.pressedScale);
      this.image.setTint(0xdddddd);
    } else {
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.0,
        duration: RELEASE_TWEEN_MS,
        ease: RELEASE_TWEEN_EASE,
      });
      this.image.clearTint();
    }
  }

  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.image.setAlpha(disabled ? 0.5 : 1.0);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}

// ---- 绘制：深底圆角矩形按钮（以 (0,0) 为中心）----
function paintDarkRoundRect(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  radius: number,
  pressed: boolean,
  disabled: boolean,
  icon: IconPainter,
): void {
  const x = -w / 2;
  const y = -h / 2;
  const baseA = disabled ? 0.5 : 1.0;
  const outlineColor = disabled ? OUTLINE_LIGHT : pressed ? PRESSED_OUTLINE : OUTLINE_LIGHT;

  // 底部阴影（按下态消失，整体下沉）
  if (!pressed && !disabled) {
    g.fillStyle(SHADOW_DARK, 0.9);
    g.fillRoundedRect(x + 1, y + SHADOW_OFFSET, w, h, radius);
  }

  // 主体深底
  g.fillStyle(BASE_DARK, baseA);
  g.fillRoundedRect(x, y, w, h, radius);

  // 内层略浅倒角（左上/顶部受光）
  g.fillStyle(BASE_MID, (disabled ? 0.35 : pressed ? 0.45 : 0.55) * baseA);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h * 0.45, {
    tl: Math.max(1, radius - 2),
    tr: Math.max(1, radius - 2),
    bl: 0,
    br: 0,
  });

  // 顶部高光条（淡米色，强化倒角）
  g.fillStyle(HIGHLIGHT, (disabled ? 0.25 : pressed ? 0.3 : 0.45) * baseA);
  g.fillRoundedRect(x + 4, y + 4, w - 8, Math.min(5, h * 0.18), {
    tl: Math.max(1, radius - 3),
    tr: Math.max(1, radius - 3),
    bl: 0,
    br: 0,
  });

  // 外描边（浅米色，细；按下暖黄）
  g.lineStyle(2, outlineColor, disabled ? 0.45 : 1.0);
  g.strokeRoundedRect(x, y, w, h, radius);

  // 图标（按下时上移 1px）
  g.translateCanvas(0, pressed ? -1 : 0);
  icon(g, Math.min(w, h));
  g.translateCanvas(0, pressed ? 1 : 0);
}

// ---- 绘制：深底圆钮（以 (0,0) 为中心）----
function paintDarkCircle(
  g: Phaser.GameObjects.Graphics,
  r: number,
  pressed: boolean,
  disabled: boolean,
  icon: IconPainter,
): void {
  const baseA = disabled ? 0.5 : 1.0;
  const outlineColor = disabled ? OUTLINE_LIGHT : pressed ? PRESSED_OUTLINE : OUTLINE_LIGHT;

  // 底部阴影
  if (!pressed && !disabled) {
    g.fillStyle(SHADOW_DARK, 0.9);
    g.fillCircle(0, SHADOW_OFFSET, r);
  }

  // 主体深底
  g.fillStyle(BASE_DARK, baseA);
  g.fillCircle(0, 0, r);

  // 内层略浅倒角（左上受光）
  g.fillStyle(BASE_MID, (disabled ? 0.3 : pressed ? 0.4 : 0.5) * baseA);
  g.fillCircle(-r * 0.15, -r * 0.25, r * 0.62);

  // 顶部高光小圆
  g.fillStyle(HIGHLIGHT, (disabled ? 0.2 : pressed ? 0.25 : 0.4) * baseA);
  g.fillCircle(-r * 0.1, -r * 0.35, r * 0.35);

  // 外描边
  g.lineStyle(2, outlineColor, disabled ? 0.45 : 1.0);
  g.strokeCircle(0, 0, r);

  // 图标（按下上移 1px）
  g.translateCanvas(0, pressed ? -1 : 0);
  icon(g, r * 1.9);
  g.translateCanvas(0, pressed ? 1 : 0);
}

// ---- 图标绘制 ----

/**
 * 圆润粗箭头（参考用户截图）：深棕描边 + 奶油填充 + 顶部高光 + 底部阴影。
 * 箭头由粗矩形杆 + 圆钝三角头组成，整体感觉厚重可爱。
 */
function drawRoundArrow(g: Phaser.GameObjects.Graphics, size: number, dir: 'left' | 'right' | 'up'): void {
  const len = size * 0.80;
  const headW = size * 0.54;
  const headL = size * 0.40;
  const shaftW = size * 0.28;

  // 右向箭头基础坐标（中心在原点，箭头朝右）
  const shaftL = len - headL;
  const shaft = [
    { x: -len / 2, y: -shaftW / 2 },
    { x: shaftL - len / 2, y: -shaftW / 2 },
    { x: shaftL - len / 2, y: -headW / 2 },
    { x: len / 2, y: 0 },
    { x: shaftL - len / 2, y: headW / 2 },
    { x: shaftL - len / 2, y: shaftW / 2 },
    { x: -len / 2, y: shaftW / 2 },
  ];

  let pts = shaft;
  if (dir === 'left') {
    pts = pts.map((p) => ({ x: -p.x, y: p.y }));
  } else if (dir === 'up') {
    pts = pts.map((p) => ({ x: -p.y, y: -p.x }));
  }

  // 阴影偏移
  const shadowPts = pts.map((p) => ({ x: p.x + 1, y: p.y + 1 }));

  // 外描边阴影
  g.fillStyle(SHADOW_DARK, 0.6);
  drawPoly(g, shadowPts);

  // 主体填充（奶油色）
  g.fillStyle(ICON_CREAM, 1);
  drawPoly(g, pts);

  // 顶部高光（让箭头有倒角受光感）
  g.fillStyle(ICON_HIGHLIGHT, 0.45);
  const hi = dir === 'left'
    ? pts.map((p) => ({ x: p.x + 1.5, y: p.y - 1.5 }))
    : dir === 'up'
      ? pts.map((p) => ({ x: p.x + 1.5, y: p.y - 1.5 }))
      : pts.map((p) => ({ x: p.x - 1.5, y: p.y - 1.5 }));
  // 只保留上半部分近似：用 slightly smaller polygon 做高光 mask 太复杂，直接画一个覆盖上半的高光条
  g.fillStyle(ICON_HIGHLIGHT, 0.35);
  if (dir === 'left' || dir === 'right') {
    const y0 = -shaftW * 0.35;
    g.fillRect(-len * 0.35, y0, len * 0.55, Math.max(2, shaftW * 0.22));
  } else {
    const x0 = -shaftW * 0.35;
    g.fillRect(x0, -len * 0.35, Math.max(2, shaftW * 0.22), len * 0.55);
  }

  // 深棕细描边
  g.lineStyle(1, SHADOW_DARK, 0.85);
  g.strokePoints(pts, true, true);
}

/** 绘制钝角多边形箭头（不用贝塞尔，避免 Phaser Graphics 类型缺少 quadraticCurveTo）。 */
function drawPoly(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[]): void {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x, pts[i].y);
  }
  g.closePath();
  g.fillPath();
}

function drawLeftArrow(g: Phaser.GameObjects.Graphics, size: number): void {
  drawRoundArrow(g, size, 'left');
}
function drawRightArrow(g: Phaser.GameObjects.Graphics, size: number): void {
  drawRoundArrow(g, size, 'right');
}
function drawJumpArrow(g: Phaser.GameObjects.Graphics, size: number): void {
  drawRoundArrow(g, size, 'up');
}

/** 八角闪光星（动作键：呼应"种子精灵/收集"星徽）。 */
function drawStar(g: Phaser.GameObjects.Graphics, size: number): void {
  const outer = size * 0.32;
  const inner = size * 0.14;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  }

  // 阴影
  g.fillStyle(SHADOW_DARK, 0.5);
  g.fillPoints(pts.map((p) => ({ x: p.x + 1, y: p.y + 1 })), true, true);

  // 主体
  g.fillStyle(ICON_CREAM, 1);
  g.fillPoints(pts, true, true);

  // 中心高光
  g.fillStyle(ICON_HIGHLIGHT, 0.5);
  g.fillCircle(0, -2, size * 0.08);

  // 描边
  g.lineStyle(1, SHADOW_DARK, 0.85);
  g.strokePoints(pts, true, true);
}

// ---- 深底圆角矩形按钮（方向左/右）----
class DarkRect implements ButtonControl {
  readonly id: ButtonId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly geom: RoundRectGeom;
  private readonly spec: ButtonVisualSpec;
  private readonly icon: IconPainter;

  private pressed = false;
  private disabled = false;

  constructor(
    scene: Phaser.Scene,
    id: ButtonId,
    geom: RoundRectGeom,
    cx: number,
    cy: number,
    icon: IconPainter,
  ) {
    this.scene = scene;
    this.id = id;
    this.geom = geom;
    this.spec = BUTTON_VISUAL_SPEC[id];
    this.icon = icon;

    this.container = scene.add.container(cx, cy).setDepth(1000).setScrollFactor(0);
    this.g = scene.add.graphics().setScrollFactor(0);
    this.container.add(this.g);
    this.redraw();
  }

  setPressed(pressed: boolean): void {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    this.scene.tweens.killTweensOf(this.container);
    if (pressed) {
      this.container.setScale(this.spec.pressedScale);
    } else {
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.0,
        duration: RELEASE_TWEEN_MS,
        ease: RELEASE_TWEEN_EASE,
      });
    }
    this.redraw();
  }

  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.redraw();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  private redraw(): void {
    this.g.clear();
    paintDarkRoundRect(
      this.g,
      this.geom.w,
      this.geom.h,
      this.geom.radius,
      this.pressed,
      this.disabled,
      this.icon,
    );
  }
}

// ---- 深底圆钮（跳/动作）----
class DarkCircle implements ButtonControl {
  readonly id: ButtonId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly geom: CircleGeom;
  private readonly spec: ButtonVisualSpec;
  private readonly icon: IconPainter;

  private pressed = false;
  private disabled = false;

  constructor(
    scene: Phaser.Scene,
    id: ButtonId,
    geom: CircleGeom,
    cx: number,
    cy: number,
    icon: IconPainter,
  ) {
    this.scene = scene;
    this.id = id;
    this.geom = geom;
    this.spec = BUTTON_VISUAL_SPEC[id];
    this.icon = icon;

    this.container = scene.add.container(cx, cy).setDepth(1000).setScrollFactor(0);
    this.g = scene.add.graphics().setScrollFactor(0);
    this.container.add(this.g);
    this.redraw();
  }

  setPressed(pressed: boolean): void {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    this.scene.tweens.killTweensOf(this.container);
    if (pressed) {
      this.container.setScale(this.spec.pressedScale);
    } else {
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.0,
        duration: RELEASE_TWEEN_MS,
        ease: RELEASE_TWEEN_EASE,
      });
    }
    this.redraw();
  }

  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.redraw();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  private redraw(): void {
    this.g.clear();
    paintDarkCircle(this.g, this.geom.r, this.pressed, this.disabled, this.icon);
  }
}

// ---- 暂停深底圆钮 ----
class PauseIcon {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cx: number, cy: number, r: number) {
    this.g = scene.add.graphics().setDepth(1000).setScrollFactor(0);

    // 底部阴影
    this.g.fillStyle(SHADOW_DARK, 0.9);
    this.g.fillCircle(cx, cy + SHADOW_OFFSET, r);
    // 主体深底
    this.g.fillStyle(BASE_DARK, 1);
    this.g.fillCircle(cx, cy, r);
    // 内层倒角
    this.g.fillStyle(BASE_MID, 0.55);
    this.g.fillCircle(cx - r * 0.15, cy - r * 0.25, r * 0.62);
    // 顶部高光
    this.g.fillStyle(HIGHLIGHT, 0.45);
    this.g.fillCircle(cx - r * 0.1, cy - r * 0.35, r * 0.35);
    // 外描边
    this.g.lineStyle(2, OUTLINE_LIGHT, 1);
    this.g.strokeCircle(cx, cy, r);
    // 双竖线（奶油色）
    const barW = Math.max(2, r * 0.16);
    const barH = r * 0.48;
    const gap = barW * 1.0;
    this.g.fillStyle(OUTLINE_LIGHT, 1);
    this.g.fillRect(cx - gap - barW, cy - barH / 2, barW, barH);
    this.g.fillRect(cx + gap, cy - barH / 2, barW, barH);
  }

  destroy(): void {
    this.g.destroy();
  }
}

// ---- 顶层：控件聚合 + 与 RawInputProvider 的同步入口 ----
export class TouchButtons {
  /** 4 钮控件（优先使用用户提供的 PNG 纹理；加载失败则降级为代码绘制）。 */
  private readonly controls: Record<ButtonId, ButtonControl>;
  private readonly pauseIcon?: PauseIcon;
  /** 上一次同步的 down 集合（用于边沿检测：触发 squash/弹起 tween） */
  private readonly down: Set<ButtonId> = new Set();

  constructor(scene: Phaser.Scene) {
    const left = buildDirectionGeom('left');
    const right = buildDirectionGeom('right');
    const action = buildCircleGeom('action');
    const jump = buildCircleGeom('jump');

    this.controls = {
      left: scene.textures.exists(ARROW_TEXTURE_KEY)
        ? new ImageButton(scene, 'left', left.cx, left.cy, ARROW_TEXTURE_KEY, left.geom.w, left.geom.h, true)
        : new DarkRect(scene, 'left', left.geom, left.cx, left.cy, drawLeftArrow),
      right: scene.textures.exists(ARROW_TEXTURE_KEY)
        ? new ImageButton(scene, 'right', right.cx, right.cy, ARROW_TEXTURE_KEY, right.geom.w, right.geom.h, false)
        : new DarkRect(scene, 'right', right.geom, right.cx, right.cy, drawRightArrow),
      action: scene.textures.exists(ACTION_TEXTURE_KEY)
        ? new ImageButton(scene, 'action', action.cx, action.cy, ACTION_TEXTURE_KEY, action.geom.r * 2, action.geom.r * 2, false)
        : new DarkCircle(scene, 'action', action.geom, action.cx, action.cy, drawStar),
      jump: scene.textures.exists(JUMP_TEXTURE_KEY)
        ? new ImageButton(scene, 'jump', jump.cx, jump.cy, JUMP_TEXTURE_KEY, jump.geom.r * 2, jump.geom.r * 2, false)
        : new DarkCircle(scene, 'jump', jump.geom, jump.cx, jump.cy, drawJumpArrow),
    };

    const pIcon = inputConfig.wechat.pauseIcon;
    if (pIcon) {
      this.pauseIcon = new PauseIcon(
        scene,
        pIcon.x * LOGICAL_WIDTH,
        pIcon.y * LOGICAL_HEIGHT,
        pIcon.r * LOGICAL_WIDTH,
      );
    }
  }

  /**
   * 由场景固定步循环调：传入 platform.input.sample().down，TouchButtons 自检边沿并触发 tween。
   */
  syncDown(downSet: Set<SignalId>): void {
    const next = new Set<ButtonId>();
    for (const sig of downSet) {
      const id = resolveButtonId(sig);
      if (id) next.add(id);
    }
    for (const id of BUTTON_ORDER) {
      const was = this.down.has(id);
      const now = next.has(id);
      if (was !== now) {
        this.controls[id].setPressed(now);
      }
    }
    this.down.clear();
    for (const id of next) this.down.add(id);
  }

  /** action 预留态：disabled=true 时该按钮整体 alpha ×0.5 + 描边变淡。 */
  setActionDisabled(disabled: boolean): void {
    this.controls.action.setDisabled(disabled);
  }

  destroy(): void {
    for (const c of Object.values(this.controls)) c.destroy();
    this.pauseIcon?.destroy();
    this.down.clear();
  }
}
