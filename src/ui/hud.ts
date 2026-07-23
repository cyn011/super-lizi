/**
 * ui/hud — 命数 HUD + 形态指示 + Game Over 覆盖层（design/ux/hud-spec.md）。
 *
 * 架构定位：ui 层，允许 Phaser；**绝不引入平台 API 到 core**（红线 §6.5 / §8.5）。
 * 颜色全部引用美术圣经 §3 色板；中文文本用系统字体 'sans-serif'（禁用位图字体，ADR-004）。
 *
 * 关键陷阱（hud-spec §8.4 / 实现合同）：
 *   Hud **不持有** DamageStateMachine 实例，而是通过注入的 getDamage() getter 读取「最新」实例。
 *   因为 ON_RESPAWN / ON_RESTART 会 new DamageStateMachine，若持有旧实例 redraw 会读到过期 lives/state。
 *
 * 事件订阅（hud-spec §4 / §8.1）：
 *   任一回调都先「重同步」一次（heart=damage.lives、form=damage.state），再叠加该事件瞬态。
 *   这样即便事件顺序有边缘情况也不漂移。
 */
import Phaser from 'phaser';
import {
  EventBus,
  ON_HURT,
  ON_DEATH,
  ON_RESPAWN,
  ON_GAME_OVER,
} from '../core/events/event-bus';
import type { DamageStateMachine, DamageState } from '../core/damage/damage-state-machine';
import { computeHeartSlots } from './hud-hearts';

// ---- 颜色（美术圣经 §3 / placeholder-spec §0，禁止硬编码语义外的色）----
const COLOR_HEART_FULL = 0xf26d8b; // 生命粉红 #F26D8B（与警示红解耦，§9.1）
const COLOR_OUTLINE = 0x2a1a12; // 近黑棕描边
const COLOR_FORM_FULL = 0xb5763e; // 栗色 #B5763E（FULL 形态块，呼应主角 §4.2）
const COLOR_SPROUT = 0x7cc242; // 嫩芽草绿 #7CC242
const COLOR_FORM_SMALL = 0x8a6a4a; // 暗栗色 #8A6A4A（SMALL 暗化）

// ---- 布局（hud-spec §2，逻辑坐标，图标基准 16×16）----
const HEART_SIZE = 16;
const HEART_GAP = 4;
const HEART_X0 = 8;
const HEART_Y0 = 8;
const FORM_X = 72; // 心形右侧，间隔 8px（slot2 末 64 + 8）
const FORM_Y = 8;

// ---- Game Over 覆盖层（hud-spec §6）----
const LOGICAL_W = 512;
const LOGICAL_H = 288;
const COLOR_OVERLAY_BG = 0x000000;
const OVERLAY_ALPHA = 0.6;
const COLOR_TEXT = '#F4EFE6'; // 石灰白 #F4EFE6
const COLOR_TEXT_STROKE = '#2A1A12';
const TEXT_FONT = 'sans-serif'; // 运行时系统字体（ADR-004：禁用位图字体）

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly bus: EventBus;
  /** getter：读「最新」damage 实例（重生/重启会 new，关键陷阱）。 */
  private readonly getDamage: () => DamageStateMachine;
  private readonly initialLives: number;

  /** 心形 + 形态图标 Graphics（固定相机层，depth 1000）。 */
  private gfx!: Phaser.GameObjects.Graphics;
  /** Game Over 覆盖层元素（仅渲染，不绑输入）。 */
  private overlay?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;

  /** bus.on 返回的 off 函数集合，destroy 时统一解绑（hud-spec §8.1）。 */
  private readonly offs: Array<() => void> = [];

  constructor(
    scene: Phaser.Scene,
    bus: EventBus,
    getDamage: () => DamageStateMachine,
    initialLives: number,
  ) {
    this.scene = scene;
    this.bus = bus;
    this.getDamage = getDamage;
    this.initialLives = initialLives;
    // 构造函数即完成接线，使 `new Hud(...)` 后可直接 redraw()（对齐实现合同 game-scene 片段）。
    this.create();
  }

  /**
   * 建 Graphics 容器（固定相机层 + depth 1000）并订阅事件（hud-spec §8.3–8.4）。
   * 幂等：重复调用安全（先建后调用不重复建）。保留为显式入口以匹配实现合同方法名。
   */
  create(): void {
    if (this.gfx) return; // 幂等保护
    this.gfx = this.scene.add.graphics().setScrollFactor(0).setDepth(1000);

    // 重同步 + 瞬态：每个事件回调都先读最新 damage（getter），再叠加瞬态（§4）。
    this.offs.push(this.bus.on(ON_HURT, () => this.redraw())); // form 切 SMALL
    this.offs.push(this.bus.on(ON_DEATH, () => this.redraw())); // 心形出现空心槽
    this.offs.push(this.bus.on(ON_RESPAWN, () => this.redraw())); // form 切 FULL
    this.offs.push(this.bus.on(ON_GAME_OVER, () => this.showOverlay()));
  }

  /**
   * 重绘 HUD（心形 + 形态图标）。仅在事件/初始时调用（开销低，见 hud-spec §8.3）。
   * 形状区分（可访问性 §7）：满=实心填充，空=空心描边轮廓——不靠颜色。
   */
  redraw(): void {
    const damage = this.getDamage();
    const slots = computeHeartSlots(damage.lives, this.initialLives);
    const g = this.gfx;
    g.clear();
    for (let i = 0; i < slots.total; i++) {
      const x = HEART_X0 + i * (HEART_SIZE + HEART_GAP);
      this.drawHeart(g, x, HEART_Y0, i < slots.filled);
    }
    this.drawForm(g, damage.state);
  }

  /** Game Over 覆盖层（hud-spec §6）：暗罩 + 居中系统字体文案。仅渲染，不绑输入。 */
  showOverlay(): void {
    if (this.overlay) return; // 已显示，避免重复创建
    this.overlay = this.scene.add
      .rectangle(LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, COLOR_OVERLAY_BG, OVERLAY_ALPHA)
      .setScrollFactor(0)
      .setDepth(2000);

    this.titleText = this.scene.add
      .text(LOGICAL_W / 2, LOGICAL_H / 2 - 14, '游戏结束', {
        fontFamily: TEXT_FONT,
        fontSize: '18px',
        color: COLOR_TEXT,
        stroke: COLOR_TEXT_STROKE,
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.hintText = this.scene.add
      .text(LOGICAL_W / 2, LOGICAL_H / 2 + 14, '点击重试', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        color: COLOR_TEXT,
        stroke: COLOR_TEXT_STROKE,
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);
  }

  /** 隐藏/销毁覆盖层（重试用）。 */
  hideOverlay(): void {
    this.overlay?.destroy();
    this.titleText?.destroy();
    this.hintText?.destroy();
    this.overlay = undefined;
    this.titleText = undefined;
    this.hintText = undefined;
  }

  /** 解绑所有事件订阅 + 隐藏覆盖层（场景 shutdown / 重启时调用，见 hud-spec §8.1）。 */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.hideOverlay();
  }

  // ---- 内部绘制 ----

  /** 心形：两个圆（lobe）+ 三角（point）近似（hud-spec §2）。实心填粉红，空心仅描边。 */
  private drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, filled: boolean): void {
    const lobeR = 4;
    const lcx1 = x + 4;
    const lcx2 = x + 12;
    const lcy = y + 5;
    const tx1 = x;
    const tx2 = x + 16;
    const tyTop = y + 5;
    const txMid = x + 8;
    const tyBot = y + 15;

    if (filled) {
      g.fillStyle(COLOR_HEART_FULL, 1);
      g.fillCircle(lcx1, lcy, lobeR);
      g.fillCircle(lcx2, lcy, lobeR);
      g.fillTriangle(tx1, tyTop, tx2, tyTop, txMid, tyBot);
    }
    // 描边（空心/实心都画）：实心=粉红描边、空心=仅轮廓（形状区分，§7）。
    g.lineStyle(1, COLOR_OUTLINE, 1);
    g.strokeCircle(lcx1, lcy, lobeR);
    g.strokeCircle(lcx2, lcy, lobeR);
    g.strokeTriangle(tx1, tyTop, tx2, tyTop, txMid, tyBot);
  }

  /** 形态图标（栗宝头像，次级）：FULL=16×16 栗色圆角块+嫩芽；SMALL/DEAD=缩小暗化块。 */
  private drawForm(g: Phaser.GameObjects.Graphics, state: DamageState): void {
    if (state === 'FULL') {
      const w = 16;
      const h = 16;
      const x = FORM_X;
      const y = FORM_Y;
      g.fillStyle(COLOR_FORM_FULL, 1);
      g.fillRoundedRect(x, y, w, h, 4);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokeRoundedRect(x, y, w, h, 4);
      // 顶部嫩芽草绿小点（呼应主角剪影 §4.2）
      g.fillStyle(COLOR_SPROUT, 1);
      g.fillCircle(x + w / 2, y + 3, 2.5);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokeCircle(x + w / 2, y + 3, 2.5);
    } else {
      // SMALL / DEAD：缩小 ~0.6（10×10）暗化圆角块，居中于 16×16 槽
      const s = 10;
      const off = (16 - s) / 2;
      const x = FORM_X + off;
      const y = FORM_Y + off;
      g.fillStyle(COLOR_FORM_SMALL, 1);
      g.fillRoundedRect(x, y, s, s, 3);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokeRoundedRect(x, y, s, s, 3);
    }
  }
}
