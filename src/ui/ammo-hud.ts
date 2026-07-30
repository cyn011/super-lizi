/**
 * ui/ammo-hud — 弹药 HUD（GDD 17 §6.3，右上角，与经济字段同排左侧）。
 *
 * 架构定位：ui 层，允许 Phaser；绝不引入平台 API 到 core（红线 §6.5 / §8.5）。
 * 纯 Graphics + 系统字体（ADR-004，零新增资产）。订阅 ON_AMMO_CHANGED 刷新；
 * 拾取弹跳动画（Text 缩放回弹）；弹药空红闪。与 hud.ts 同层（depth 1000，固定相机层）。
 *
 * 布局（512×288 逻辑坐标系）：与经济字段（分数/金币）同一行 y=8 右对齐，弹药组排到
 * 金币组左侧（anchorXProvider 由 game-scene 提供，指向 Hud.getCoinGroupLeftX），三者成一行。
 */
import Phaser from 'phaser';
import {
  EventBus,
  ON_AMMO_CHANGED,
  ON_COIN,
  ON_SCORE_CHANGED,
} from '../core/events/event-bus';

const LOGICAL_W = 512;
const AMMO_Y = 8; // 与经济字段（分数/金币）同行
const AMMO_GAP = 12; // 弹药组 ↔ 金币组 间距
const ICON_SIZE = 14;
const ICON_TEXT_GAP = 4; // 栗子图标 ↔ 数字 间距
const COLOR_CHESTNUT = 0xb5763e; // 栗色（与主角一致，art-bible §4.2）
const COLOR_SPROUT = 0x7cc242; // 嫩芽草绿
const COLOR_EMPTY = 0xe8483b; // 警示红（弹药空红闪，与敌人/弹丸同色板）
const COLOR_TEXT = '#F4EFE6'; // 石灰白
const COLOR_OUTLINE = 0x2a1a12; // 近黑棕描边（Graphics 用，数值）
const COLOR_OUTLINE_STR = '#2a1a12'; // 文本描边需字符串（Phaser TextStyle.stroke 类型）
const TEXT_FONT = 'sans-serif'; // 运行时系统字体（ADR-004）

export class AmmoHud {
  private readonly scene: Phaser.Scene;
  private readonly bus: EventBus;
  private ammo = 0;
  private cap = 0;
  /** 海关用海星、沙漠关用红色沙果表现同一弹药数值；仅换皮，不改变投掷资源语义。 */
  private theme = 'grass';
  /** 弹药组右边界锚点（指向金币组左沿），由外部（game-scene → Hud）提供。 */
  private readonly anchorXProvider: () => number;

  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly offs: Array<() => void> = [];

  constructor(
    scene: Phaser.Scene,
    bus: EventBus,
    initialAmmo: number,
    capacity: number,
    anchorXProvider: () => number,
  ) {
    this.scene = scene;
    this.bus = bus;
    this.ammo = initialAmmo;
    this.cap = capacity;
    this.anchorXProvider = anchorXProvider;

    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.text = scene.add
      .text(LOGICAL_W - 8, AMMO_Y, '', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        color: COLOR_TEXT,
        stroke: COLOR_OUTLINE_STR,
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.draw();
    this.offs.push(
      this.bus.on(ON_AMMO_CHANGED, (payload) =>
        this.onChanged(payload as { ammo: number; cap?: number }),
      ),
      // 经济字段变化会改变金币组宽度/位置，弹药组需同步重排保持同一行。
      this.bus.on(ON_COIN, () => this.draw()),
      this.bus.on(ON_SCORE_CHANGED, () => this.draw()),
    );
  }

  /** ON_AMMO_CHANGED：刷新弹药数 + 弹跳动画；归零时红闪。 */
  private onChanged(p: { ammo: number; cap?: number }): void {
    this.ammo = p.ammo;
    if (typeof p.cap === 'number') this.cap = p.cap;
    this.draw();
    // 拾取弹跳：Text 缩放快速回弹（Back.Out）
    this.scene.tweens.killTweensOf(this.text);
    this.text.setScale(1.2);
    this.scene.tweens.add({ targets: this.text, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.Out' });
    if (this.ammo <= 0) this.flashEmpty();
  }

  /** 切关时同步主题皮肤；1-3 海关显示海星，1-4 沙漠关显示沙果。 */
  setTheme(theme: string): void {
    this.theme = theme;
    this.draw();
  }

  /** 弹药空：图标短暂切警示红，180ms 后恢复。 */
  private flashEmpty(): void {
    this.draw(true);
    this.scene.time.delayedCall(180, () => {
      if (this.text.active) this.draw(false);
    });
  }

  private draw(empty = false): void {
    const g = this.gfx;
    g.clear();
    // 先写入文本以便读取真实宽度，再据锚点定位：弹药组排到金币组左侧、同一行。
    this.text.setText(`×${this.ammo}`);
    const ammoTextW = this.text.width;
    const y = AMMO_Y;
    const textRight = this.anchorXProvider() - AMMO_GAP; // “×N”数字右沿（金币组左沿左侧留间距）
    const x = textRight - ammoTextW - ICON_TEXT_GAP; // 图标左沿
    const fill = empty ? COLOR_EMPTY : COLOR_CHESTNUT;
    if (this.theme === 'sea') {
      const cx = x + ICON_SIZE / 2;
      const cy = y + ICON_SIZE / 2;
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? ICON_SIZE * 0.46 : ICON_SIZE * 0.2;
        points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      g.fillStyle(empty ? COLOR_EMPTY : 0xff8a7a, 1);
      g.fillPoints(points, true);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokePoints(points, true);
      if (!empty) {
        g.fillStyle(0xffd6a3, 0.9);
        g.fillCircle(cx, cy, 1.5);
      }
    } else if (this.theme === 'desert') {
      const cx = x + ICON_SIZE / 2;
      const cy = y + ICON_SIZE / 2 + 1;
      g.fillStyle(empty ? COLOR_EMPTY : 0xf05b3f, 1);
      g.fillCircle(cx, cy, ICON_SIZE / 2 - 1);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokeCircle(cx, cy, ICON_SIZE / 2 - 1);
      if (!empty) {
        g.fillStyle(0xff8a58, 0.9);
        g.fillCircle(cx - 2, cy - 2, 1.5);
        g.fillStyle(COLOR_SPROUT, 1);
        g.fillTriangle(cx - 3, y + 2, cx, y - 1, cx + 1, y + 4);
        g.fillTriangle(cx, y + 3, cx + 4, y, cx + 3, y + 5);
      }
    } else {
      // 栗子：圆身 + 顶部嫩芽
      g.fillStyle(fill, 1);
      g.fillCircle(x + ICON_SIZE / 2, y + ICON_SIZE / 2, ICON_SIZE / 2 - 1);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokeCircle(x + ICON_SIZE / 2, y + ICON_SIZE / 2, ICON_SIZE / 2 - 1);
      if (!empty) {
        g.fillStyle(COLOR_SPROUT, 1);
        g.fillCircle(x + ICON_SIZE / 2, y + 2, 2);
      }
    }
    // 数字右对齐到 textRight（与图标同行、右侧留 ICON_TEXT_GAP 间距）
    this.text.setOrigin(1, 0).setPosition(textRight, y);
  }

  /** 解绑事件 + 销毁图层（场景 shutdown 调用）。 */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.scene.tweens.killTweensOf(this.text);
    this.gfx.destroy();
    this.text.destroy();
  }
}
