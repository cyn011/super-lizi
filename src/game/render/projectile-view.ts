/**
 * game/render/projectile-view — S04-2 弹丸占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 弹丸为独立 hazard（碰玩家受伤），双编码：警示红 #E8483B（危险）+ 圆形主体带运动方向尖，
 * 区别于可踩敌人的软顶圆角。统一 #2A1A12 描边，depth 对齐 enemy-view。
 * 逻辑（Projectile）在 core/，渲染经 getBounds() 解耦。
 */
import type Phaser from 'phaser';
import type { Projectile } from '../../core/enemy/projectile';
import type { LevelTheme } from '../../core/level/level-data';

const PROJECTILE_COLOR = 0xe8483b; // 警示红（危险弹丸，双编码危险色，对齐敌人/闪光；越界色整改 A）
const OUTLINE = 0x2a1a12; // 近黑棕描边

/** zenith 短拖尾段数（art/zenith-biome-spec.md §A5.2 末行）。 */
const ZEN_TRAIL_SEGMENTS = 3;

/**
 * 在世界坐标 Graphics 上绘制一枚弹丸（dead 则不绘制）。
 *
 * @param theme 关卡主题。仅 'zenith' 追加一道 #E8483B alpha 递减短拖尾（§A5.2 末行：
 *              **拖尾禁用 #5BC8F5**——对破晓金天仅 1.54:1 会消失，改用与弹芯同族的警示红）。
 *              弹芯 #E8483B（vs 金天 3.14:1 ✅）+ 1px #2A1A12 描边为**现状即达标**，不改。
 *              其余全部 theme（含 undefined）走完全原样路径，逐值零回归。
 */
export function drawProjectile(
  g: Phaser.GameObjects.Graphics,
  p: Projectile,
  theme?: LevelTheme,
): void {
  if (p.dead) return;
  const b = p.getBounds();
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const r = b.w / 2;
  // zenith：警示红 alpha 递减短拖尾（先画，被弹芯压住头部）
  if (theme === 'zenith') {
    const tl = Math.hypot(p.vx, p.vy) || 1;
    const tux = p.vx / tl;
    const tuy = p.vy / tl;
    for (let i = ZEN_TRAIL_SEGMENTS; i >= 1; i--) {
      g.fillStyle(PROJECTILE_COLOR, 0.5 * (1 - i / (ZEN_TRAIL_SEGMENTS + 1))); // alpha 递减
      g.fillCircle(cx - tux * (r * 0.9 * i), cy - tuy * (r * 0.9 * i), r * (1 - 0.18 * i));
    }
  }
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
