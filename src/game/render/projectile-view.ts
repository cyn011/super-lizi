/**
 * game/render/projectile-view — S04-2 弹丸占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 弹丸为独立 hazard（碰玩家受伤），双编码：警示红 #E8483B（危险）+ 圆形主体带运动方向尖，
 * 区别于可踩敌人的软顶圆角。统一 #2A1A12 描边，depth 对齐 enemy-view。
 * 逻辑（Projectile）在 core/，渲染经 getBounds() 解耦。
 */
import type Phaser from 'phaser';
import type { Projectile } from '../../core/enemy/projectile';

const PROJECTILE_COLOR = 0xe8483b; // 警示红（危险弹丸，双编码危险色，对齐敌人/闪光；越界色整改 A）
const OUTLINE = 0x2a1a12; // 近黑棕描边

/** 在世界坐标 Graphics 上绘制一枚弹丸（dead 则不绘制）。 */
export function drawProjectile(g: Phaser.GameObjects.Graphics, p: Projectile): void {
  if (p.dead) return;
  const b = p.getBounds();
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const r = b.w / 2;
  // 圆形主体（双编码：形状 + 颜色）
  g.fillStyle(PROJECTILE_COLOR, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx, cy, r);
  // 运动方向小尖（朝 vx/vy）
  const len = Math.hypot(p.vx, p.vy) || 1;
  const ux = p.vx / len;
  const uy = p.vy / len;
  const tipX = cx + ux * (r + 4);
  const tipY = cy + uy * (r + 4);
  const px = -uy;
  const py = ux;
  g.fillStyle(PROJECTILE_COLOR, 1);
  g.fillTriangle(cx + px * 3, cy + py * 3, cx - px * 3, cy - py * 3, tipX, tipY);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeTriangle(cx + px * 3, cy + py * 3, cx - px * 3, cy - py * 3, tipX, tipY);
}
