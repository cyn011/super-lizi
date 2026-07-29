/**
 * ui/hud — 命数 HUD + 形态指示 + 经济字段（分数/金币/连击）+ Game Over 覆盖层（design/ux/hud-spec.md）。
 *
 * 架构定位：ui 层，允许 Phaser；**绝不引入平台 API 到 core**（红线 §6.5 / §8.5）。
 * 颜色全部引用美术圣经 §3 色板；中文文本用系统字体 'sans-serif'（禁用位图字体，ADR-004）。
 * 经济字段格式化走纯函数 src/ui/hud-economy.ts（零 Phaser，可单测）；本文件负责 Graphics 矢量图标 + Text 绘制。
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
import {
  formatScore,
  formatCoins,
  formatCombo,
  shouldShowCombo,
} from './hud-economy';

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

// ---- 经济字段（S04-5，hud-spec 未覆盖 / 08-ui-hud §3 中上分数金币）----
// 布局：顶部右侧（与左上心形+形态镜像，margin 8，512×288 坐标系）。
const COLOR_COIN = 0xf2c94c; // 经济金（与 coin-view.ts 同色，双编码：形状+色，色盲安全）
const COLOR_COMBO_TEXT = '#E8483B'; // 警示红（连击文本，双编码危险色，对齐敌人/弹丸；越界橙已归位锁色板 #E8483B，P6 整改 A）
const ECON_MARGIN = 8; // 距右边距（与心形左 margin 对称）
const ECON_Y = 8; // 与心形同行
const ECON_GAP = 8; // 分数 ↔ 金币组 间距
const SCORE_FONT_SIZE = '14px'; // 中文 ≥14px 等效（accessibility §9.2）
const COIN_ICON_SIZE = 14; // 金币图标 ~14×14（放大，提升存在感）
const COIN_TEXT_GAP = 3; // 金币图标 ↔ 数字 间距
const ECON_LINE_H = 18; // 连击行相对分数行下移（font 14 + 间距）

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

  // ── S04-4 经济字段（S04-5 绘制 HUD 分数/金币/连击）──
  /** 当前分数（来自 ON_SCORE_CHANGED，setScore 写字段并触发 redraw 绘制）。 */
  private score = 0;
  /** 当前金币数（setCoins 写字段并触发 redraw 绘制）。 */
  private coins = 0;
  /** 当前连击倍率（setCombo 写字段并触发 redraw；comboMult>1 时才显示）。 */
  private comboMult = 1;

  /** 心形 + 形态图标 Graphics（固定相机层，depth 1000）。 */
  private gfx!: Phaser.GameObjects.Graphics;
  /** Game Over 覆盖层元素（仅渲染，不绑输入）。 */
  private overlay?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;

  /** 经济文本对象（系统字体 'sans-serif'，固定相机层 depth 1000，与 gfx 对齐）。 */
  private scoreText!: Phaser.GameObjects.Text; // 分数「分数 N」（右对齐）
  private coinText!: Phaser.GameObjects.Text; // 金币「×N」（右对齐，位金币图标右侧）
  private comboText!: Phaser.GameObjects.Text; // 连击「xN」（仅 comboMult>1 显示，右对齐，分数下方）
  /** 当前关卡徽标（例如 1-2），位于形态图标右侧。 */
  private levelText!: Phaser.GameObjects.Text;
  /** 顶部半透明信息栏底板（固定相机层 depth 999，位于 gfx 之下，统一 HUD 容器感）。 */
  private barGfx?: Phaser.GameObjects.Graphics;

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
    // 顶部信息栏底板（depth 999，位于心形/经济之下），统一 HUD 容器感。
    this.barGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(999);
    this.drawTopBar();
    this.gfx = this.scene.add.graphics().setScrollFactor(0).setDepth(1000);

    // 经济文本（系统字体，固定相机层 depth 1000，与 gfx 对齐）：分数 / 金币 / 连击。
    // 禁用位图字体（ADR-004）：fontFamily 取运行时系统 sans-serif；中文 ≥14px 等效 + 高对比描边。
    this.scoreText = this.scene.add
      .text(0, 0, '', {
        fontFamily: TEXT_FONT,
        fontSize: SCORE_FONT_SIZE,
        color: COLOR_TEXT,
        stroke: COLOR_TEXT_STROKE,
        strokeThickness: 2,
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.coinText = this.scene.add
      .text(0, 0, '', {
        fontFamily: TEXT_FONT,
        fontSize: '16px', // 金币数字放大（存在感 > 分数）
        color: COLOR_TEXT,
        stroke: COLOR_TEXT_STROKE,
        strokeThickness: 2,
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.comboText = this.scene.add
      .text(0, 0, '', {
        fontFamily: TEXT_FONT,
        fontSize: SCORE_FONT_SIZE,
        color: COLOR_COMBO_TEXT,
        stroke: COLOR_TEXT_STROKE,
        strokeThickness: 2,
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false); // comboMult===1 默认隐藏
    this.levelText = this.scene.add
      .text(130, 17, '', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        color: COLOR_TEXT,
        stroke: COLOR_TEXT_STROKE,
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    // 重同步 + 瞬态：每个事件回调都先读最新 damage（getter），再叠加瞬态（§4）。
    this.offs.push(this.bus.on(ON_HURT, () => this.redraw())); // form 切 SMALL
    this.offs.push(this.bus.on(ON_DEATH, () => this.redraw())); // 心形出现空心槽
    this.offs.push(this.bus.on(ON_RESPAWN, () => this.redraw())); // form 切 FULL
    this.offs.push(this.bus.on(ON_GAME_OVER, () => this.showOverlay()));
  }

  /**
   * 重绘 HUD（心形 + 形态图标 + 经济字段）。仅在事件/初始时调用（开销低，见 hud-spec §8.3）。
   * 形状区分（可访问性 §7）：满=实心填充，空=空心描边轮廓——不靠颜色。
   *
   * 布局（512×288 逻辑坐标系，margin 8；hud-spec §2 扩展经济字段到顶部右侧）：
   * ```
   * (0,0)┌───────────────────────────────────────────────┐(512,0)
   *      │ ♥ ♥ ♥   🌰       分数 1234 ×12   (左上命数/形态)│(右上经济，右对齐 x=504)
   *      │ (8,8)  (72,8)              x2    (连击，mult>1 才显示，分数下一行)│
   *      └───────────────────────────────────────────────┘
   * ```
   * 经济文本/图标固定相机层（scrollFactor 0, depth 1000），不与心形+形态（同层左上）重叠。
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
    this.drawLevelBadge(g);
    // S04-5：经济字段（分数/金币/连击）绘制在 gfx(金币图标) + Text(数字)，事件触发式重绘。
    this.drawEconomy();
  }

  /**
   * S04-5：写入当前分数（来自 ON_SCORE_CHANGED）并触发 redraw 绘制。
   * ui 不持有游戏状态，只读事件注入值（架构铁律）。事件触发式重绘，非每帧。
   */
  setScore(score: number): void {
    this.score = score;
    this.redraw();
  }

  /** S04-5：写入当前金币数并触发 redraw 绘制（金币图标 + ×N）。 */
  setCoins(coins: number): void {
    this.coins = coins;
    this.redraw();
  }

  /** S04-5：写入当前连击倍率并触发 redraw 绘制（comboMult>1 才显示 xN）。 */
  setCombo(mult: number): void {
    this.comboMult = mult;
    this.redraw();
  }

  /** 设置当前关卡徽标；loadLevel 每次切关时调用。 */
  setLevel(levelId: string): void {
    this.levelText.setText(levelId);
    this.redraw();
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

  /** 解绑所有事件订阅 + 隐藏覆盖层 + 销毁经济文本（场景 shutdown / 重启时调用，见 hud-spec §8.1）。 */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.hideOverlay();
    this.barGfx?.destroy();
    this.barGfx = undefined;
    this.scoreText?.destroy();
    this.coinText?.destroy();
    this.comboText?.destroy();
    this.levelText?.destroy();
  }

  /** 顶部信息栏：半透明木质/像素风条带，横跨顶部，承载心形+形态+经济字段（hud-spec §2 容器感）。 */
  private drawTopBar(): void {
    const g = this.barGfx;
    if (!g) return;
    g.clear();
    g.fillStyle(0x2a1a12, 0.32); // 描边棕半透明（锁色板 #5 tint）
    g.fillRoundedRect(0, 0, LOGICAL_W, 30, 0);
    // 底部 1px 高光线，营造信息带边缘
    g.lineStyle(1, 0xf2c94c, 0.18); // 经济金极淡描边（锁色板 #8）
    g.lineBetween(0, 30, LOGICAL_W, 30);
  }

  // ---- 内部绘制 ----

  /** 深蓝圆角关卡徽标：对应目标图左上角的「1-2」信息层级。 */
  private drawLevelBadge(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x0b1d38, 0.86);
    g.fillRoundedRect(104, 7, 52, 20, 9);
    g.lineStyle(1, 0x4a78c0, 0.78);
    g.strokeRoundedRect(104, 7, 52, 20, 9);
  }

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

  /**
   * S04-5 经济字段绘制：金币图标（Graphics 矢量，绘在共享 gfx 上）+ 分数/金币/连击（Text 系统字体）。
   * 全部右对齐到 x = LOGICAL_W - ECON_MARGIN (504)；金币组置于分数左侧。
   * 连击「xN」仅在 comboMult > 1 时显示（=1 常态隐藏，避免常驻干扰）。
   * 禁用位图字体（ADR-004）：Text 用运行时系统 'sans-serif'。
   */
  private drawEconomy(): void {
    const g = this.gfx;
    // 文本（纯格式化走 hud-economy.ts，零 Phaser）
    this.scoreText.setText(formatScore(this.score));
    this.coinText.setText(formatCoins(this.coins));

    const right = LOGICAL_W - ECON_MARGIN; // 504
    const y = ECON_Y; // 8

    // 分数：右对齐到右边距
    this.scoreText.setOrigin(1, 0).setPosition(right, y);
    const scoreW = this.scoreText.width;

    // 金币组（图标 + 数字）置于分数左侧：组右沿 = right - 分数宽 - 间距
    const coinTextW = this.coinText.width;
    const coinGroupW = COIN_ICON_SIZE + COIN_TEXT_GAP + coinTextW;
    const coinGroupRight = right - scoreW - ECON_GAP;
    this.coinText.setOrigin(1, 0).setPosition(coinGroupRight, y);
    // 金币图标在金币数字左侧（垂直相对分数文本居中）
    const iconX = coinGroupRight - coinTextW - COIN_TEXT_GAP;
    const iconY = y + Math.max(0, Math.floor((this.scoreText.height - COIN_ICON_SIZE) / 2));
    this.drawCoinIcon(g, iconX, iconY, COIN_ICON_SIZE);

    // 连击：仅 mult>1 显示，右对齐到右边距、分数下一行
    if (shouldShowCombo(this.comboMult)) {
      this.comboText.setText(formatCombo(this.comboMult));
      this.comboText.setVisible(true).setOrigin(1, 0).setPosition(right, y + ECON_LINE_H);
    } else {
      this.comboText.setVisible(false);
    }
  }

  /** 矢量金币图标（参考 coin-view.ts：经济金圆币 + 中心竖纹，双编码色盲安全）；size≈12。 */
  private drawCoinIcon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
  ): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 1;
    g.fillStyle(COLOR_COIN, 1);
    g.fillCircle(cx, cy, r);
    g.lineStyle(1, COLOR_OUTLINE, 1);
    g.strokeCircle(cx, cy, r);
    // 中心竖纹（不依赖颜色即可辨识为「币」）
    g.fillStyle(COLOR_OUTLINE, 0.8);
    g.fillRect(cx - 1, cy - r + 2, 2, r);
  }
}
