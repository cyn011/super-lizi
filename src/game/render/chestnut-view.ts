/**
 * game/render/chestnut-view — 栗子弹丸渲染（GDD 17 §5.2）。
 *
 * 架构定位：game 层渲染，允许 Phaser；纯 Graphics（ADR-004，零素材）。
 * 每帧由 game-scene 调 sync(chests) 绘制当前活跃弹丸（栗色圆 + 朝向拖尾）。
 * 不持有对象池逻辑（ChestnutProjectile 自身带 dead 标记，game-scene 每帧压缩列表即可）。
 */
import Phaser from 'phaser';
import type { ChestnutProjectile } from '../../core/attack/chestnut-projectile';

const COLOR_CHESTNUT = 0xb5763e; // 栗色（与主角一致）
const COLOR_OUTLINE = 0x2a1a12;

export class ChestnutView {
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(10); // 与敌人/弹丸同层
  }

  /** 每帧同步：清除并重绘所有未失效弹丸。 */
  sync(chests: ChestnutProjectile[]): void {
    const g = this.gfx;
    g.clear();
    for (const c of chests) {
      if (c.dead) continue;
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      // 拖尾（朝向反方向短条，半透明）
      g.fillStyle(COLOR_CHESTNUT, 0.3);
      g.fillRect(c.x - c.facing * 6, cy - 1, 6, 2);
      // 栗身
      g.fillStyle(COLOR_CHESTNUT, 1);
      g.fillCircle(cx, cy, c.width / 2);
      g.lineStyle(1, COLOR_OUTLINE, 1);
      g.strokeCircle(cx, cy, c.width / 2);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
