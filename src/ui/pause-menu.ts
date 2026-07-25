/**
 * ui/pause-menu — 暂停遮罩 + 继续/重玩（GDD 08 §3 / S05-2）。
 *
 * Phaser 视图：全屏遮罩 + 标题 + 两个大圆角按钮（继续→ON_RESUME / 重玩→ON_RESTART）。
 * 按钮热区 160×52 ≥48×48（control-list §4）；中文系统字体 16px ≥14px（ADR-004 禁位图字体）；
 * 矢量绘制（Graphics 圆角矩形 + Text 系统字体），不进包。
 *
 * Web 端按钮用 Phaser interactive（pointerdown 直接发事件）；
 * 微信端 deep 适配留在 S05-5，本文件暴露 `handleTap(x,y)`（逻辑坐标）供其把原生触摸映射到按钮。
 *
 * 仿真冻结由 game-scene 的 `paused` 标志在 update/stepSim 顶部早退实现（本组件只管显示 + 发事件）。
 */
import Phaser from 'phaser';
import { ON_RESUME, ON_RESTART } from '../core/events/event-bus';
import { pointInRect } from '../core/util/hit-test';

const LOGICAL_W = 512;
const LOGICAL_H = 288;
const CENTER_X = LOGICAL_W / 2;
const CENTER_Y = LOGICAL_H / 2;

// 颜色（美术圣经 §3 / placeholder-spec，禁止硬编语义外色）
const COLOR_OVERLAY_BG = 0x000000;
const OVERLAY_ALPHA = 0.6;
const COLOR_PANEL = 0x4a3a2f; // 暖棕面板
const COLOR_OUTLINE = 0x2a1a12; // 近黑棕描边
const COLOR_TITLE = '#F4EFE6'; // 石灰白
const COLOR_BTN_CONTINUE = 0xb5763e; // 栗色（继续）
const COLOR_BTN_RESTART = 0x8a6a4a; // 暗栗（重玩，次级）
const TEXT_FONT = 'sans-serif'; // 运行时系统字体（ADR-004）

// 面板 + 按钮尺寸
const PANEL_W = 300;
const PANEL_H = 180;
const BTN_W = 160;
const BTN_H = 52; // 热区 ≥48×48

interface ButtonHit {
  /** 逻辑坐标命中盒（绝对场景坐标）。 */
  rect: { x: number; y: number; w: number; h: number };
  action: () => void;
}

export class PauseMenu {
  private readonly scene: Phaser.Scene;
  private readonly bus: { emit: (name: string, payload?: unknown) => void };
  private container?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle; // 全屏遮罩：独立对象，不跟随面板容器动画
  private built = false;
  private readonly buttons: ButtonHit[] = [];

  private readonly resumeAction: () => void;
  private readonly restartAction: () => void;

  constructor(scene: Phaser.Scene, bus: { emit: (name: string, payload?: unknown) => void }) {
    this.scene = scene;
    this.bus = bus;
    this.resumeAction = () => this.bus.emit(ON_RESUME);
    this.restartAction = () => this.bus.emit(ON_RESTART);
  }

  get isBuilt(): boolean {
    return this.built;
  }

  /** 显示暂停菜单（幂等：已构建则直接显隐）。 */
  show(): void {
    if (!this.built) this.build();
    this.overlay?.setVisible(true);
    this.container?.setVisible(true);
  }

  /** 隐藏（继续/重玩后）。 */
  hide(): void {
    this.container?.setVisible(false);
    this.overlay?.setVisible(false);
  }

  destroy(): void {
    this.container?.destroy();
    this.container = undefined;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.built = false;
    this.buttons.length = 0;
  }

  /**
   * S05-5 钩子：微信原生触摸（逻辑坐标 x,y）→ 命中按钮则触发其动作。
   * Web 端由 Phaser interactive 处理，不走到这里。
   */
  handleTap(x: number, y: number): void {
    if (!this.container || !this.container.visible) return;
    for (const b of this.buttons) {
      if (pointInRect(x, y, b.rect)) {
        b.action();
        return;
      }
    }
  }

  // ── 构建（仅一次）──
  private build(): void {
    const c = this.scene.add.container(CENTER_X, CENTER_Y).setScrollFactor(0).setDepth(2500);

    // 全屏遮罩（独立 depth，随容器显隐同步）
    const overlay = this.scene.add
      .rectangle(LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, COLOR_OVERLAY_BG, OVERLAY_ALPHA)
      .setScrollFactor(0)
      .setDepth(2499);
    overlay.setName('overlay');

    // 面板（容器中心 0,0 为原点）
    const g = this.scene.add.graphics();
    g.fillStyle(COLOR_PANEL, 1);
    g.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    g.lineStyle(2, COLOR_OUTLINE, 1);
    g.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);

    // 标题
    const title = this.scene.add
      .text(0, -PANEL_H / 2 + 24, '暂停', {
        fontFamily: TEXT_FONT,
        fontSize: '18px',
        color: COLOR_TITLE,
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    title.setName('title');

    // 两个按钮（横排，居中）
    const btnY = PANEL_H / 2 - 34;
    const gap = 20; // 两钮中心间距
    const continueBtn = this.makeButton(-gap / 2, btnY, COLOR_BTN_CONTINUE, '继续', this.resumeAction);
    const restartBtn = this.makeButton(gap / 2, btnY, COLOR_BTN_RESTART, '重玩', this.restartAction);

    // 遮罩独立，不加入容器，避免跟随容器居中/缩放导致覆盖不全
    this.overlay = overlay;
    c.add([g, title, continueBtn.rect, continueBtn.text, restartBtn.rect, restartBtn.text]);

    // 记录命中盒（逻辑坐标；scale 弹入后约为 1，近似足够）
    this.buttons.push({
      rect: { x: CENTER_X - gap / 2 - BTN_W / 2, y: CENTER_Y + btnY - BTN_H / 2, w: BTN_W, h: BTN_H },
      action: this.resumeAction,
    });
    this.buttons.push({
      rect: { x: CENTER_X + gap / 2 - BTN_W / 2, y: CENTER_Y + btnY - BTN_H / 2, w: BTN_W, h: BTN_H },
      action: this.restartAction,
    });

    c.setVisible(false);
    this.container = c;
    this.built = true;
  }

  /** 构造单个按钮（圆角矩形 + 文本，可交互）。 */
  private makeButton(
    localX: number,
    localY: number,
    color: number,
    label: string,
    action: () => void,
  ): { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    const rect = this.scene.add
      .rectangle(localX, localY, BTN_W, BTN_H, color, 0.9)
      .setStrokeStyle(2, COLOR_OUTLINE, 1);
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', action);
    const text = this.scene.add
      .text(localX, localY, label, {
        fontFamily: TEXT_FONT,
        fontSize: '16px', // ≥14px
        color: COLOR_TITLE,
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    return { rect, text };
  }
}
