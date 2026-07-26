/**
 * ui/touch-buttons — 微信触屏虚拟控件可视化（参考用户截图药丸长条 + 大圆钮风格）。
 *
 * 设计要点：
 * - 左下：左/右合并为一个"方向药丸"长条，中间竖线分隔，视觉连续、命中区分独立。
 * - 右下：跳（暖黄大圆 + 白色上三角）、扔栗子（栗色大圆 + 白色栗子嫩芽）。
 * - 右上：暂停小圆钮（白边 + 双竖线）。
 * - 全部 Phaser Graphics 实时绘制（fillRoundedRect / strokeRoundedRect / fillTriangle 等），**零位图资产**（ADR-004）。
 * - 命中区/坐标/半径仍来自 inputConfig.wechat.buttons，与 wechat-touch 命中公式一致，不破坏平台输入层。
 *
 * 视觉风格：深色半透明底 + 白图标/白边，按下时缩回 + 描边切暖黄，整体比截图更干净、对比度更高。
 */
import Phaser from 'phaser';
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

// ---- 颜色（参考用户第二张截图：红色半透明药丸 + 白色箭头风格，在深棕色地面上高对比）----
/** 控件深色底（栗壳棕），用于暂停图标 */
const COLOR_BG_DARK = 0x3e2723;
/** 方向药丸填充：警示红 #DC4438（暗 5%，半透明但高饱和，在蓝天/地面均可见） */
const COLOR_FILL_DIRECTION = 0xdc4438;
/** 动作键（跳）填充：暖黄 #F2C83C（暗 5%，art-bible §3.1） */
const COLOR_FILL_ACTION = 0xf2c83c;
/** 动作键（扔栗子）填充：栗色 #AC703B（暗 5%，art-bible §4.2，呼应栗宝） */
const COLOR_FILL_THROW = 0xac703b;
/** 默认描边：白边，在彩色底上清晰 */
const COLOR_OUTLINE = 0xffffff;
/** 按下态描边：暖黄高亮 */
const COLOR_PRESSED_OUTLINE = 0xffd23f;
/** 图标色：白 */
const COLOR_ICON = 0xffffff;

// ---- 视觉规格（导出给测试回归）----
export interface ButtonVisualSpec {
  fillColor: number;
  fillAlphaDefault: number;
  fillAlphaPressed: number;
  lineWidthDefault: number;
  lineWidthPressed: number;
  lineAlphaDefault: number;
  lineAlphaPressed: number;
  pressedScale: number;
}

export const BUTTON_VISUAL_SPEC: Record<ButtonId, ButtonVisualSpec> = {
  left: {
    fillColor: COLOR_FILL_DIRECTION,
    fillAlphaDefault: 0.82,
    fillAlphaPressed: 0.95,
    lineWidthDefault: 3,
    lineWidthPressed: 4,
    lineAlphaDefault: 1.0,
    lineAlphaPressed: 1.0,
    pressedScale: 0.97,
  },
  right: {
    fillColor: COLOR_FILL_DIRECTION,
    fillAlphaDefault: 0.82,
    fillAlphaPressed: 0.95,
    lineWidthDefault: 3,
    lineWidthPressed: 4,
    lineAlphaDefault: 1.0,
    lineAlphaPressed: 1.0,
    pressedScale: 0.97,
  },
  jump: {
    fillColor: COLOR_FILL_ACTION,
    fillAlphaDefault: 0.55,
    fillAlphaPressed: 0.68,
    lineWidthDefault: 4,
    lineWidthPressed: 5,
    lineAlphaDefault: 1.0,
    lineAlphaPressed: 1.0,
    pressedScale: 0.92,
  },
  action: {
    fillColor: COLOR_FILL_THROW,
    fillAlphaDefault: 0.55,
    fillAlphaPressed: 0.68,
    lineWidthDefault: 4,
    lineWidthPressed: 5,
    lineAlphaDefault: 1.0,
    lineAlphaPressed: 1.0,
    pressedScale: 0.92,
  },
};

/** 弹起弹性回弹 tween 参数。 */
const RELEASE_TWEEN_MS = 200;
const RELEASE_TWEEN_EASE = 'Back.Out';
/** 虚线圆周采样段数（48 = 2 实 1 空循环）。 */
const DASH_SEGMENTS = 48;

// ---- 几何 ----
interface BarGeom {
  cx: number;
  cy: number;
  width: number;
  height: number;
  radius: number;
}

interface CircleGeom {
  cx: number;
  cy: number;
  r: number;
}

// ---- 辅助：绘制虚线圆 ----
function drawDashedCircle(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number,
  lineWidth: number,
): void {
  g.lineStyle(lineWidth, color, alpha);
  const step = (Math.PI * 2) / DASH_SEGMENTS;
  for (let i = 0; i < DASH_SEGMENTS; i += 3) {
    const a1 = i * step;
    const a2 = (i + 2) * step;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const x2 = cx + Math.cos(a2) * r;
    const y2 = cy + Math.sin(a2) * r;
    g.lineBetween(x1, y1, x2, y2);
  }
}

// ---- 左/右方向药丸 ----
class TouchBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly geom: BarGeom;
  private readonly spec = BUTTON_VISUAL_SPEC.left;

  private pressedLeft = false;
  private pressedRight = false;
  private disabled = false;

  constructor(scene: Phaser.Scene, left: CircleGeom, right: CircleGeom) {
    this.scene = scene;
    // 药丸覆盖左右两个命中圆的外接矩形，半径取二者较小者保证两端圆润一致。
    const radius = Math.min(left.r, right.r);
    const width = right.cx + right.r - (left.cx - left.r);
    const height = radius * 2;
    const cx = (left.cx + right.cx) / 2;
    const cy = (left.cy + right.cy) / 2;
    this.geom = { cx, cy, width, height, radius };

    this.container = scene.add.container(cx, cy).setDepth(1000).setScrollFactor(0);
    this.g = scene.add.graphics().setScrollFactor(0);
    this.container.add(this.g);
    this.redraw();
  }

  setPressed(id: 'left' | 'right', pressed: boolean): void {
    const prevAny = this.pressedLeft || this.pressedRight;
    if (id === 'left') this.pressedLeft = pressed;
    else this.pressedRight = pressed;
    const nowAny = this.pressedLeft || this.pressedRight;
    if (prevAny !== nowAny) {
      this.scene.tweens.killTweensOf(this.container);
      if (nowAny) {
        this.container.setScale(this.spec.pressedScale);
      } else {
        this.scene.tweens.add({
          targets: this.container,
          scale: 1.0,
          duration: RELEASE_TWEEN_MS,
          ease: RELEASE_TWEEN_EASE,
        });
      }
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
    const { width: w, height: h, radius: r } = this.geom;
    const g = this.g;
    g.clear();

    const anyPressed = this.pressedLeft || this.pressedRight;
    const lineWidth = anyPressed ? this.spec.lineWidthPressed : this.spec.lineWidthDefault;
    const lineAlpha = (anyPressed ? this.spec.lineAlphaPressed : this.spec.lineAlphaDefault) * (this.disabled ? 0.6 : 1);
    const lineColor = anyPressed ? COLOR_PRESSED_OUTLINE : COLOR_OUTLINE;
    const baseAlpha = this.disabled ? 0.3 : 1;

    const x = -w / 2;
    const y = -h / 2;
    const hw = w / 2;

    // 左半
    const leftAlpha = (this.pressedLeft ? this.spec.fillAlphaPressed : this.spec.fillAlphaDefault) * baseAlpha;
    g.fillStyle(this.spec.fillColor, leftAlpha);
    g.fillRoundedRect(x, y, hw, h, { tl: r, tr: 0, bl: r, br: 0 });

    // 右半
    const rightAlpha = (this.pressedRight ? this.spec.fillAlphaPressed : this.spec.fillAlphaDefault) * baseAlpha;
    g.fillStyle(this.spec.fillColor, rightAlpha);
    g.fillRoundedRect(x + hw, y, hw, h, { tl: 0, tr: r, bl: 0, br: r });

    // 外描边
    g.lineStyle(lineWidth, lineColor, lineAlpha);
    g.strokeRoundedRect(x, y, w, h, r);

    // 中间分隔线
    g.lineStyle(2, COLOR_OUTLINE, 0.6 * baseAlpha);
    g.lineBetween(0, -h / 2 + r * 0.3, 0, h / 2 - r * 0.3);

    // 左/右箭头
    g.fillStyle(COLOR_ICON, this.disabled ? 0.5 : 1.0);
    const arrowW = h * 0.35;
    const arrowH = h * 0.45;
    // 左箭头
    const lx = -hw / 2;
    g.fillTriangle(lx - arrowW / 2, 0, lx + arrowW / 2, -arrowH / 2, lx + arrowW / 2, arrowH / 2);
    g.fillRect(lx - arrowW / 2 - 3, -2, 3, 4);
    // 右箭头
    const rx = hw / 2;
    g.fillTriangle(rx + arrowW / 2, 0, rx - arrowW / 2, -arrowH / 2, rx - arrowW / 2, arrowH / 2);
    g.fillRect(rx + arrowW / 2, -2, 3, 4);
  }
}

// ---- 跳 / 扔栗子 大圆钮 ----
class TouchCircle {
  readonly id: ButtonId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly geom: CircleGeom;
  private readonly spec: ButtonVisualSpec;

  private pressed = false;
  private disabled = false;

  constructor(scene: Phaser.Scene, id: 'jump' | 'action', geom: CircleGeom) {
    this.scene = scene;
    this.id = id;
    this.geom = geom;
    this.spec = BUTTON_VISUAL_SPEC[id];

    this.container = scene.add.container(geom.cx, geom.cy).setDepth(1000).setScrollFactor(0);
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
    const { r } = this.geom;
    const g = this.g;
    const spec = this.spec;
    g.clear();

    const fillAlpha = (this.pressed ? spec.fillAlphaPressed : spec.fillAlphaDefault) * (this.disabled ? 0.6 : 1);
    const lineWidth = this.pressed ? spec.lineWidthPressed : spec.lineWidthDefault;
    const lineAlpha = (this.pressed ? spec.lineAlphaPressed : spec.lineAlphaDefault) * (this.disabled ? 0.6 : 1);
    const lineColor = this.pressed ? COLOR_PRESSED_OUTLINE : COLOR_OUTLINE;

    // 填充圆
    g.fillStyle(spec.fillColor, fillAlpha);
    g.fillCircle(0, 0, r);

    // 描边（disabled 改虚线）
    if (this.disabled) {
      drawDashedCircle(g, 0, 0, r, lineColor, lineAlpha * 0.6, lineWidth);
    } else {
      g.lineStyle(lineWidth, lineColor, lineAlpha);
      g.strokeCircle(0, 0, r);
    }

    // 内圈高光（让大圆钮更立体）
    if (!this.disabled) {
      g.lineStyle(2, 0xffffff, 0.15);
      g.strokeCircle(0, 0, r * 0.82);
    }

    // 图标
    g.fillStyle(COLOR_ICON, this.disabled ? 0.6 : 1.0);
    this.drawIcon(g, r);
  }

  private drawIcon(g: Phaser.GameObjects.Graphics, r: number): void {
    if (this.id === 'jump') {
      // 上三角（箭头）+ 底部横线
      const h = r * 0.55;
      const w = r * 0.6;
      const t = r * 0.18;
      g.fillTriangle(0, -h / 2 - 2, -w / 2, h / 2 - 2, w / 2, h / 2 - 2);
      g.fillRect(-w / 2 - 2, h / 2, w + 4, 3);
      // 加一条小横线表示"地面"
      g.fillStyle(COLOR_ICON, 0.6);
      g.fillRect(-w / 2 - 4, h / 2 + 4, w + 8, 2);
    } else {
      // 栗子：圆身 + 顶部嫩芽（呼应栗宝）
      const bodyR = r * 0.35;
      g.fillCircle(0, r * 0.1, bodyR);
      // 栗身顶部小缺口
      g.fillStyle(this.spec.fillColor, 1.0);
      g.fillCircle(0, -r * 0.28, r * 0.12);
      // 重新画图标色嫩芽
      g.fillStyle(COLOR_ICON, 1.0);
      g.fillTriangle(-r * 0.12, -r * 0.22, -r * 0.22, -r * 0.45, 0, -r * 0.28);
      g.fillTriangle(r * 0.12, -r * 0.22, r * 0.22, -r * 0.45, 0, -r * 0.28);
    }
  }
}

// ---- 暂停小圆钮 ----
class PauseIcon {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cx: number, cy: number, r: number) {
    this.g = scene.add.graphics().setDepth(1000).setScrollFactor(0);

    // 圆底
    this.g.fillStyle(COLOR_BG_DARK, 0.6);
    this.g.fillCircle(cx, cy, r);
    this.g.lineStyle(2, COLOR_OUTLINE, 0.9);
    this.g.strokeCircle(cx, cy, r);

    // 双竖线
    const barW = Math.max(2, r * 0.18);
    const barH = r * 0.55;
    const gap = barW * 0.8;
    this.g.fillStyle(COLOR_ICON, 1.0);
    this.g.fillRect(cx - gap - barW, cy - barH / 2, barW, barH);
    this.g.fillRect(cx + gap, cy - barH / 2, barW, barH);
  }

  destroy(): void {
    this.g.destroy();
  }
}

// ---- 顶层：控件聚合 + 与 RawInputProvider 的同步入口 ----
export class TouchButtons {
  private readonly bar: TouchBar;
  private readonly circles: Record<'jump' | 'action', TouchCircle>;
  private readonly pauseIcon?: PauseIcon;
  /** 上一次同步的 down 集合（用于边沿检测：触发 squash/弹起 tween） */
  private readonly down: Set<ButtonId> = new Set();

  constructor(scene: Phaser.Scene) {
    const cfg = inputConfig.wechat.buttons;
    const left: CircleGeom = {
      cx: cfg.left.x * LOGICAL_WIDTH,
      cy: cfg.left.y * LOGICAL_HEIGHT,
      r: cfg.left.r * LOGICAL_WIDTH,
    };
    const right: CircleGeom = {
      cx: cfg.right.x * LOGICAL_WIDTH,
      cy: cfg.right.y * LOGICAL_HEIGHT,
      r: cfg.right.r * LOGICAL_WIDTH,
    };
    this.bar = new TouchBar(scene, left, right);

    this.circles = {
      jump: new TouchCircle(scene, 'jump', {
        cx: cfg.jump.x * LOGICAL_WIDTH,
        cy: cfg.jump.y * LOGICAL_HEIGHT,
        r: cfg.jump.r * LOGICAL_WIDTH,
      }),
      action: new TouchCircle(scene, 'action', {
        cx: cfg.action.x * LOGICAL_WIDTH,
        cy: cfg.action.y * LOGICAL_HEIGHT,
        r: cfg.action.r * LOGICAL_WIDTH,
      }),
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
   * 不修改 wechat-touch.ts：通过既有的 RawInputFrame.down 这条渠道同步，单一事实来源保持。
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
        if (id === 'left' || id === 'right') {
          this.bar.setPressed(id, now);
        } else {
          this.circles[id].setPressed(now);
        }
      }
    }
    this.down.clear();
    for (const id of next) this.down.add(id);
  }

  /** action 预留态：disabled=true 时该按钮整体 alpha ×0.6 + 描边改虚线。 */
  setActionDisabled(disabled: boolean): void {
    this.circles.action.setDisabled(disabled);
  }

  destroy(): void {
    this.bar.destroy();
    for (const c of Object.values(this.circles)) c.destroy();
    this.pauseIcon?.destroy();
    this.down.clear();
  }
}
