/**
 * game/render/enemy-view — S04-1 敌人占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 可踩敌人用「软顶」视觉暗示：圆润顶（无刺）+ 双编码眼睛，区别于 C3 占位刺栗的尖刺危险暗示。
 * 色盲安全：刺栗 = 警示红 #E8483B，嘟浮 = 蓝紫 #6E7BF2，统一 #2A1A12 描边（对齐 asset-manifest §4 P0）。
 * 敌人渲染落在 game/（Phaser Graphics），逻辑（EnemyAI）在 core/，二者经 getBounds() 解耦。
 */
import type Phaser from 'phaser';
import type { EnemyAI } from '../../core/enemy/enemy-ai';

const CI_LI_COLOR = 0xe8483b; // 警示红（ci_li）
const DU_FU_COLOR = 0x6e7bf2; // 蓝紫（du_fu）
const OUTLINE = 0x2a1a12; // 近黑棕描边

/** 在世界坐标 Graphics 上绘制一个敌人（已消灭则跳过）。 */
export function drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  if (e.dead) return; // 已消灭不绘制
  const b = e.getBounds();
  const color = e.type === 'ci_li' ? CI_LI_COLOR : DU_FU_COLOR;
  // 软顶：上角大圆角（无刺）暗示「可踩」；下角小圆角。
  const topR = b.h / 2;
  const radii = { tl: topR, tr: topR, bl: 4, br: 4 };
  g.fillStyle(color, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);
  // 双编码眼睛（增强辨识，不依赖颜色区分）。
  g.fillStyle(OUTLINE, 1);
  const eyeY = b.y + b.h * 0.42;
  g.fillCircle(b.x + b.w * 0.36, eyeY, 2);
  g.fillCircle(b.x + b.w * 0.64, eyeY, 2);
}
