/**
 * ui/touch-buttons — 微信触屏四按钮可视化（art/ui/touch-buttons-spec §3-B 方案）。
 *
 * 设计要点（对照 spec §5 工程参数表）：
 * - 仅 env==='wechat' 时挂载（由 game-scene 决策）。
 * - 命中区/坐标/半径来自 inputConfig.wechat.buttons（位置/半径**零变更**，与 wechat-touch 命中公式一致）。
 * - 4 个独立 Phaser.Container，每个内部 1 个 Graphics，按钮按下时独立 setScale+tween。
 * - 双层配色：方向键（left/right）白 0.18 描边 2px；动作键（jump/action）暖黄 #FFD23F 0.32 描边 3px。
 * - 按下态：scale 0.94（方向键）/ 0.92（动作键）+ 描边色切 #B5763E（栗色）+ 描边加粗 1px + 填充 alpha +0.15。
 * - 弹起：Phaser tween Back.Out，200ms 弹性回 1.0（自动过冲 1.0 → ~1.02 → 1.0）。
 * - action 预留态：setActionDisabled(true) → 整体 alpha ×0.6 + 描边改虚线（48 段 2 实 1 空 ≈ 4:2 比例）。
 * - 图标全部用 Phaser Graphics 原子 API 实时绘制（fillTriangle / fillRect），**零新增资产**。
 *
 * 接入策略（与 wechat-touch 解耦）：
 *   按下态从 platform.input.sample().down Set 同步。游戏场景在 stepSim 中调 syncDown(frame.down)，
 *   TouchButtons 内部检测边沿变化（按下/弹起）触发 tween + 内部 redraw。
 *   这样 wechat-touch.ts / input-config.json 完全不动；只动 ui 层 + game-scene 一处一行。
 */
import Phaser from 'phaser';
import { inputConfig } from '../core/config';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../platform/detect';

// ---- 公开类型 ----
export type ButtonId = 'left' | 'right' | 'jump' | 'action';
export type ButtonType = 'direction' | 'action';
/** 物理信号 id（来自 RawInputFrame.down）。对微信端为 'touch:left' / 'touch:right' / 'touch:jump' / 'touch:action'。 */
export type SignalId = string;

// ---- 常量表（导出用于测试 + 可供设计自检）----
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

// ---- 颜色（与 art-bible §3.1 + spec §5.3 严格对齐）----
/** 描边色（统一：placeholder-spec §0 / spec §5.2） */
const COLOR_OUTLINE = 0x2a1a12;
/** 按下态描边色：栗色（spec §5.3，呼应栗宝 art-bible §4.2） */
const COLOR_PRESSED_OUTLINE = 0xb5763e;
/** 方向键填色：白（spec §5.2） */
const COLOR_FILL_DIRECTION = 0xffffff;
/** 动作键填色：暖黄 #FFD23F（art-bible §3.1 主色板） */
const COLOR_FILL_ACTION = 0xffd23f;
/** 图标色 = 描边色（spec §4.3，色盲安全 + 在暖黄上对比度 > 7:1） */
const COLOR_ICON = COLOR_OUTLINE;

// ---- 视觉规格（spec §5.3 全量参数表，按钮可零成本切换）----
export interface ButtonVisualSpec {
  /** 填充色（不随按下变化） */
  fillColor: number;
  /** 默认态填充 alpha（spec §5.3 表格） */
  fillAlphaDefault: number;
  /** 按下态填充 alpha（默认 +0.15） */
  fillAlphaPressed: number;
  /** 默认态描边宽度（方向键 2、动作键 3） */
  lineWidthDefault: number;
  /** 按下态描边宽度（默认 +1px） */
  lineWidthPressed: number;
  /** 默认态描边 alpha（方向键 0.85、动作键 0.95） */
  lineAlphaDefault: number;
  /** 按下态描边 alpha（默认 +0.05~0.10） */
  lineAlphaPressed: number;
  /** 按下态 scale（方向键 0.94、动作键 0.92；squash 强度差 0.02 强化动作键"重按"感） */
  pressedScale: number;
}

export const BUTTON_VISUAL_SPEC: Record<ButtonId, ButtonVisualSpec> = {
  left: {
    fillColor: COLOR_FILL_DIRECTION,
    fillAlphaDefault: 0.18,
    fillAlphaPressed: 0.33,
    lineWidthDefault: 2,
    lineWidthPressed: 3,
    lineAlphaDefault: 0.85,
    lineAlphaPressed: 0.95,
    pressedScale: 0.94,
  },
  right: {
    fillColor: COLOR_FILL_DIRECTION,
    fillAlphaDefault: 0.18,
    fillAlphaPressed: 0.33,
    lineWidthDefault: 2,
    lineWidthPressed: 3,
    lineAlphaDefault: 0.85,
    lineAlphaPressed: 0.95,
    pressedScale: 0.94,
  },
  jump: {
    fillColor: COLOR_FILL_ACTION,
    fillAlphaDefault: 0.32,
    fillAlphaPressed: 0.50,
    lineWidthDefault: 3,
    lineWidthPressed: 4,
    lineAlphaDefault: 0.95,
    lineAlphaPressed: 1.0,
    pressedScale: 0.92,
  },
  action: {
    fillColor: COLOR_FILL_ACTION,
    fillAlphaDefault: 0.32,
    fillAlphaPressed: 0.50,
    lineWidthDefault: 3,
    lineWidthPressed: 4,
    lineAlphaDefault: 0.95,
    lineAlphaPressed: 1.0,
    pressedScale: 0.92,
  },
};

/** 弹起弹性回弹 tween 参数（spec §5.4：Back.Out 1.0 → ~1.02 → 1.0）。 */
const RELEASE_TWEEN_MS = 200;
const RELEASE_TWEEN_EASE = 'Back.Out';
/** 虚线圆周采样段数（48 = 2 实 1 空循环，弧长比 ~2:1 ≈ spec §4.6 4 实 2 间隔）。 */
const DASH_SEGMENTS = 48;

// ---- 按钮几何（按 inputConfig 归一化坐标 × 逻辑分辨率）----
interface ButtonGeom {
  cx: number;
  cy: number;
  r: number;
}

// ---- 单按钮内部状态机 ----
class TouchButton {
  readonly id: ButtonId;
  readonly type: ButtonType;
  readonly geom: ButtonGeom;
  /** 容器：用于 setScale 缩放（中心 (0,0) 局部坐标 + setPosition 到 (cx,cy) 父坐标） */
  readonly container: Phaser.GameObjects.Container;
  /** 子 Graphics：相对容器中心 (0,0) 绘制 */
  readonly g: Phaser.GameObjects.Graphics;

  private readonly scene: Phaser.Scene;
  private pressed = false;
  private disabled = false;

  constructor(scene: Phaser.Scene, id: ButtonId, geom: ButtonGeom) {
    this.scene = scene;
    this.id = id;
    this.type = BUTTON_TYPE[id];
    this.geom = geom;

    // 容器位于 (cx, cy)，内部 Graphics 坐标 (0,0) 即按钮中心 → setScale 以中心为基点
    this.container = scene.add.container(geom.cx, geom.cy);
    this.container.setDepth(1000); // 保持最上层（spec §5.6）
    this.g = scene.add.graphics();
    this.container.add(this.g);

    this.redraw();
  }

  /** 切按下态：立即 squash（setScale）+ 弹起时 Back.Out 弹性回 1.0（spec §5.5 状态机）。 */
  setPressed(pressed: boolean): void {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    // 取消任何进行中的回弹 tween（避免"按下时 tween 还在把 scale 拉回 1.0"）
    this.scene.tweens.killTweensOf(this.container);
    if (pressed) {
      // pointer-down 即时 squash（GameJuice 共识：按下瞬时反馈，30ms 内可达）
      this.container.setScale(BUTTON_VISUAL_SPEC[this.id].pressedScale);
    } else {
      // 释放：Back.Out 自动过冲 1.0 → ~1.02 → 1.0
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.0,
        duration: RELEASE_TWEEN_MS,
        ease: RELEASE_TWEEN_EASE,
      });
    }
    this.redraw();
  }

  /** action 预留态（spec §4.6）：整体 alpha ×0.6 + 描边改虚线 + 图标 alpha ×0.6。 */
  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.redraw();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  // ---- 内部绘制（一次 redraw = 一次状态快照） ----
  private redraw(): void {
    const { r } = this.geom;
    const g = this.g;
    const spec = BUTTON_VISUAL_SPEC[this.id];
    g.clear();

    // 1. 填充圆（按下 +0.15 alpha；disabled ×0.6）
    const fillAlpha = (this.pressed ? spec.fillAlphaPressed : spec.fillAlphaDefault) * (this.disabled ? 0.6 : 1);
    g.fillStyle(spec.fillColor, fillAlpha);
    g.fillCircle(0, 0, r);

    // 2. 描边（按下切栗色 + 加粗 1px；disabled 改虚线 + alpha ×0.6）
    const lineWidth = this.pressed ? spec.lineWidthPressed : spec.lineWidthDefault;
    const lineAlphaBase = this.pressed ? spec.lineAlphaPressed : spec.lineAlphaDefault;
    const lineColor = this.pressed ? COLOR_PRESSED_OUTLINE : COLOR_OUTLINE;
    const lineAlpha = lineAlphaBase * (this.disabled ? 0.6 : 1);
    if (this.disabled) {
      this.drawDashedCircle(g, 0, 0, r, lineColor, lineAlpha, lineWidth);
    } else {
      g.lineStyle(lineWidth, lineColor, lineAlpha);
      g.strokeCircle(0, 0, r);
    }

    // 3. 图标（统一 fillStyle 一次，原子 API 实时绘制；disabled alpha ×0.6）
    g.fillStyle(COLOR_ICON, this.disabled ? 0.6 : 1.0);
    this.drawIcon(g);
  }

  /** 虚线圆：48 段 lineBetween 循环（2 实 1 空 ≈ 4 实 2 间隔弧长比，spec §4.6）。 */
  private drawDashedCircle(
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
      // 每 3 段中前 2 段为实线（lineBetween 画线段）
      const a1 = i * step;
      const a2 = (i + 2) * step;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r;
      const y2 = cy + Math.sin(a2) * r;
      g.lineBetween(x1, y1, x2, y2);
    }
  }

  /** 像素图标：4 钮 4 套，全部 fillTriangle/fillRect 实时绘制（spec §5.2 表格）。 */
  private drawIcon(g: Phaser.GameObjects.Graphics): void {
    switch (this.id) {
      case 'left':
        // ◀：大三角（尖端朝左）+ 2 个尾翼小方块
        g.fillTriangle(-10, 0, 6, -8, 6, 8);
        g.fillRect(-12, -3, 4, 2);
        g.fillRect(-12, 1, 4, 2);
        break;
      case 'right':
        // ▶：left 的水平镜像
        g.fillTriangle(10, 0, -6, -8, -6, 8);
        g.fillRect(8, -3, 4, 2);
        g.fillRect(8, 1, 4, 2);
        break;
      case 'jump':
        // ▲：大三角朝上 + 底部 1px 横线（"脚"）
        g.fillTriangle(0, -10, -8, 4, 8, 4);
        g.fillRect(-10, 6, 20, 2);
        break;
      case 'action':
        // ✦：八角光芒（"+" 4 段 + 4 个 4×4 斜位小方块）
        g.fillRect(-10, -1, 20, 2); // 横
        g.fillRect(-1, -10, 2, 20); // 竖
        g.fillRect(-6, -6, 4, 4); // 斜 ↖
        g.fillRect(2, -6, 4, 4); // 斜 ↗
        g.fillRect(-6, 2, 4, 4); // 斜 ↙
        g.fillRect(2, 2, 4, 4); // 斜 ↘
        break;
    }
  }
}

/** 顶层：4 钮聚合 + 与 RawInputProvider 的同步入口。 */
export class TouchButtons {
  private readonly buttons: Map<ButtonId, TouchButton>;
  /** 上一次同步的 down 集合（用于边沿检测：触发 squash/弹起 tween） */
  private readonly down: Set<ButtonId> = new Set();

  constructor(scene: Phaser.Scene) {
    this.buttons = new Map();
    const cfg = inputConfig.wechat.buttons;
    for (const id of BUTTON_ORDER) {
      const b = cfg[id];
      if (!b) continue; // 容错：config 缺键跳过
      const geom: ButtonGeom = {
        cx: b.x * LOGICAL_WIDTH,
        cy: b.y * LOGICAL_HEIGHT,
        r: b.r * LOGICAL_WIDTH, // 与 wechat-touch 命中公式一致（按宽换算）
      };
      this.buttons.set(id, new TouchButton(scene, id, geom));
    }
  }

  /**
   * 由场景固定步循环调：传入 platform.input.sample().down，TouchButtons 自检边沿并触发 tween。
   * - 新进入 down：对应按钮 setPressed(true)（即时 squash + 重绘按下态）
   * - 离开 down：对应按钮 setPressed(false)（Back.Out 200ms 弹性回 1.0 + 重绘默认态）
   * - 未变化：不重绘（spec §5.6 静止态 0 重绘）
   *
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
        this.buttons.get(id)?.setPressed(now);
      }
    }
    // 复制而非直接持有外部 Set（避免外部清空/重置后我们读到空集）
    this.down.clear();
    for (const id of next) this.down.add(id);
  }

  /**
   * action 预留态：disabled=true 时该按钮整体 alpha ×0.6 + 描边改虚线（spec §4.6）。
   * 当 action 尚未绑定功能时由场景调用一次即可；后续启用再调 false 恢复。
   */
  setActionDisabled(disabled: boolean): void {
    this.buttons.get('action')?.setDisabled(disabled);
  }

  destroy(): void {
    for (const b of this.buttons.values()) b.destroy();
    this.buttons.clear();
    this.down.clear();
  }
}
