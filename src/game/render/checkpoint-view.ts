/**
 * game/render/checkpoint-view — S04-3 检查点占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 原创非旗杆标记：小石碑（圆角矩形碑身 + 顶部光点 + 底座），色盲安全形状。
 * 激活（== 当前 respawnPoint）时点亮为亮金 + 白色光点，提供「已抵达」反馈（lean：可选高亮）。
 * 尺寸取自 pickup-resolution 的 CHECKPOINT_W/H，保证绘制盒 == 碰撞盒。
 */
import type Phaser from 'phaser';
import type { CheckpointEntityDef } from '../../core/level/level-data';
import { CHECKPOINT_W, CHECKPOINT_H } from '../pickup-resolution';

const STELE_COLOR = 0x8a8f98; // 中性灰石碑（未激活）
const STELE_ACTIVE = 0xf2c94c; // 激活亮金
const OUTLINE = 0x2a1a12; // 近黑棕描边

/**
 * 在世界坐标 Graphics 上绘制一个检查点石碑。
 * @param active 是否已被激活（== 当前 respawnPoint）：激活时点亮。
 */
export function drawCheckpoint(
  g: Phaser.GameObjects.Graphics,
  cp: CheckpointEntityDef,
  active: boolean,
): void {
  const color = active ? STELE_ACTIVE : STELE_COLOR;
  const radii = { tl: 4, tr: 4, bl: 2, br: 2 };
  // 碑身
  g.fillStyle(color, 1);
  g.fillRoundedRect(cp.x, cp.y, CHECKPOINT_W, CHECKPOINT_H, radii);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRoundedRect(cp.x, cp.y, CHECKPOINT_W, CHECKPOINT_H, radii);
  // 顶部光点（双编码：形状 + 亮度指示激活态）
  g.fillStyle(active ? 0xffffff : STELE_COLOR, 1);
  g.fillCircle(cp.x + CHECKPOINT_W / 2, cp.y + 6, active ? 5 : 3);
  // 底座
  g.fillStyle(OUTLINE, 1);
  g.fillRect(cp.x - 2, cp.y + CHECKPOINT_H - 3, CHECKPOINT_W + 4, 3);
}
