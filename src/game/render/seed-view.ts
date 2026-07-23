/**
 * game/render/seed-view — S04-3 种子占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 栗色种壳（#B5763E）+ 草绿双叶嫩芽（#7CC242），呼应 GDD 12 蜕变母题；
 * 形状（种壳水滴 + 双叶）与颜色共同编码，色盲安全。
 * 尺寸取自 pickup-resolution 的 SEED_SIZE，保证绘制盒 == 碰撞盒。
 */
import type Phaser from 'phaser';
import type { SeedEntityDef } from '../../core/level/level-data';
import { SEED_SIZE } from '../pickup-resolution';

const SPROUT_COLOR = 0x7cc242; // 草绿嫩芽
const SHELL_COLOR = 0xb5763e; // 栗色种壳
const OUTLINE = 0x2a1a12; // 近黑棕描边

/** 在世界坐标 Graphics 上绘制一个种子（已拾取的不绘制，由调用方按去重集合跳过）。 */
export function drawSeed(g: Phaser.GameObjects.Graphics, s: SeedEntityDef): void {
  const cx = s.x + SEED_SIZE / 2;
  const baseY = s.y + SEED_SIZE - 3;
  // 种壳（栗色椭圆/水滴）
  g.fillStyle(SHELL_COLOR, 1);
  g.fillEllipse(cx, baseY - 3, SEED_SIZE - 6, SEED_SIZE - 6);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeEllipse(cx, baseY - 3, SEED_SIZE - 6, SEED_SIZE - 6);
  // 嫩芽（草绿双叶，从种壳顶冒出）
  g.fillStyle(SPROUT_COLOR, 1);
  g.fillCircle(cx - 3, s.y + 4, 3);
  g.fillCircle(cx + 3, s.y + 4, 3);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx - 3, s.y + 4, 3);
  g.strokeCircle(cx + 3, s.y + 4, 3);
}
