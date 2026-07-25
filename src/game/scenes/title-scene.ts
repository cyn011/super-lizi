/**
 * game/scenes/title-scene — 标题屏（栗宝大冒险 启动首屏）。
 *
 * 启动链：BootScene → TitleScene → GameScene（点击开始 / Enter / Space 进入 1-1）。
 *
 * 纯 Phaser Graphics + 系统字体绘制，零新增位图/音频/字体资源（ADR-004）。
 * 坐标全部相对逻辑中心（512×288），不依赖 window/document，Web + 微信双端兼容。
 *
 * 颜色纪律（红线）：
 *   - 山丘 / 按钮仅用 grass biome 锁色板：#7CC242 / #5FA82F / #2A1A12 / #F2933C / #F4EFE6。
 *   - 云朵白 #FFFFFF 仅作标题屏菜单背景插画，不计入游戏内资产调色板（铁律允许）。
 *   - 背景天空 #5BC8F5 由 main.ts 的 backgroundColor 提供，本场景不再重绘。
 */
import Phaser from 'phaser';

const LOGICAL_W = 512;
const LOGICAL_H = 288;
const CENTER_X = LOGICAL_W / 2; // 256

// ── 锁色板（grass biome，0 新增色）──
const COLOR_GRASS_GREEN = 0x7cc242; // 草绿（近景/中景山丘）
const COLOR_SHADOW_GREEN = 0x5fa82f; // 阴影绿（远景山丘）
const COLOR_OUTLINE = 0x2a1a12; // 描边 / 标题描边
const COLOR_WARM_ORANGE = 0xf2933c; // 暖橙（开始按钮填充）
const COLOR_CREAM = '#F4EFE6'; // 石灰白（标题/副标题/按钮文字）
const COLOR_CLOUD_WHITE = 0xffffff; // 云朵白：仅为菜单背景插画，不进游戏资产调色板

// 文本字体（与 ui/result-screen、ui/pause-menu 一致，运行时系统字体）
const TEXT_FONT = 'sans-serif';

// 开始按钮尺寸（热区 ≥ 触屏 32px 高）
const BTN_W = 150;
const BTN_H = 44;

/**
 * 画一朵云（重叠白色椭圆，menu 背景插画）。
 * 仅用 #FFFFFF，不计入资产调色板。
 */
function drawCloud(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
  g.fillStyle(COLOR_CLOUD_WHITE, 1);
  g.fillEllipse(cx - 14 * s, cy, 30 * s, 18 * s);
  g.fillEllipse(cx, cy - 6 * s, 36 * s, 26 * s);
  g.fillEllipse(cx + 16 * s, cy, 28 * s, 18 * s);
  g.fillEllipse(cx, cy + 5 * s, 44 * s, 20 * s);
}

/**
 * 画一层起伏山丘：底部实填 + 顶部一排椭圆隆起点形成连续曲线。
 * 颜色取自 grass biome 锁色板（草绿 / 阴影绿）。
 */
function drawHillLayer(
  g: Phaser.GameObjects.Graphics,
  baseY: number,
  color: number,
  bumpW: number,
  amp: number,
  count: number,
): void {
  g.fillStyle(color, 1);
  // 底部填色到屏幕底
  g.fillRect(0, baseY, LOGICAL_W, LOGICAL_H - baseY);
  // 顶部隆起的山包（椭圆中心压在 baseY，露出上半部）
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * LOGICAL_W;
    g.fillEllipse(x, baseY, bumpW, amp * 2);
  }
}

export class TitleScene extends Phaser.Scene {
  /** 防止键盘 + 点击重复触发 start（双端多次手势）。 */
  private started = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.started = false;
    const W = this.scale.width || LOGICAL_W;
    const H = this.scale.height || LOGICAL_H;

    // ── 天空：依赖 main.ts backgroundColor #5BC8F5，本场景不再重绘 ──

    // 云朵（menu 背景插画，白色，不进资产调色板）
    const clouds = this.add.graphics().setDepth(1);
    drawCloud(clouds, 90, 46, 1.0);
    drawCloud(clouds, 392, 38, 1.2);
    drawCloud(clouds, 250, 64, 0.8);

    // 山丘（2-3 层起伏，锁色板草绿/阴影绿，营造景深）
    const hills = this.add.graphics().setDepth(2);
    // 远景：阴影绿，最高基线、最小起伏
    drawHillLayer(hills, H - 86, COLOR_SHADOW_GREEN, 130, 22, 5);
    // 中景：草绿，居中基线、中等起伏
    drawHillLayer(hills, H - 64, COLOR_GRASS_GREEN, 150, 26, 4);
    // 近景：阴影绿，最低基线、最大起伏（最前层）
    drawHillLayer(hills, H - 42, COLOR_SHADOW_GREEN, 170, 30, 4);

    // 大标题「栗宝大冒险」：居中偏上，描边 + 阴影保证蓝天对比度
    const title = this.add
      .text(CENTER_X, 96, '栗宝大冒险', {
        fontFamily: TEXT_FONT,
        fontSize: '60px', // 5 字 × ~60px ≈ 屏宽 58%
        color: COLOR_CREAM,
        stroke: '#2A1A12',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(10);
    title.setShadow(3, 3, '#2A1A12', 4, true, true);

    // 副标题「像素风横版跳跃冒险」：标题下方，小一号，协调石灰白
    const subtitle = this.add
      .text(CENTER_X, 144, '像素风横版跳跃冒险', {
        fontFamily: TEXT_FONT,
        fontSize: '18px',
        color: COLOR_CREAM,
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // 开始按钮「▶ 开始游戏」：底部居中，暖橙填充 + 描边 + 石灰白文字
    const btnY = H - 70;
    const btn = this.add.container(CENTER_X, btnY).setDepth(20);
    const btnRect = this.add
      .rectangle(0, 0, BTN_W, BTN_H, COLOR_WARM_ORANGE, 1)
      .setStrokeStyle(2, COLOR_OUTLINE, 1);
    const btnText = this.add
      .text(0, 0, '▶ 开始游戏', {
        fontFamily: TEXT_FONT,
        fontSize: '18px',
        color: COLOR_CREAM,
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    btn.add([btnRect, btnText]);
    btn.setSize(BTN_W, BTN_H);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.startGame());

    // ── 轻量动画（纯 Phaser tween，零资源）──
    // 标题上下浮动
    this.tweens.add({
      targets: title,
      y: 92,
      duration: 1600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    // 副标题同步轻微浮动（相位错开）
    this.tweens.add({
      targets: subtitle,
      y: 140,
      duration: 1600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      delay: 120,
    });
    // 开始按钮缩放反馈（吸引注意）
    this.tweens.add({
      targets: btn,
      scale: 1.06,
      duration: 700,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });

    // ── 键盘 Enter / Space 开始 ──
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());
  }

  /** 进入 GameScene（关卡 1-1，GameScene 默认加载首关）。防重复触发。 */
  private startGame(): void {
    if (this.started) return;
    this.started = true;
    this.scene.start('Game');
  }
}
