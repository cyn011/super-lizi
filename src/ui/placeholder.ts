/**
 * ui/placeholder — 运行时矢量占位绘制（art/placeholder-spec.md）。
 * 不依赖 PNG；栗宝/敌人/地形均用 Graphics 画色块 + ≥1px 近黑棕描边（#2A1A12）。
 * 换入图集时按 实体id_状态_序号 帧名对齐（placeholder-spec §5）。
 */
import Phaser from 'phaser';

export const COLOR_LIBAO = 0xb5763e; // 栗色
export const COLOR_SPROUT = 0x7cc242; // 嫩芽草绿
export const COLOR_OUTLINE = 0x2a1a12; // 近黑棕描边

/**
 * 绘制栗宝占位（碰撞盒 24×34；画布 32×40 居中缩排）。
 * 在 Graphics 局部坐标 (0,0) 起绘制；调用方用 setPosition 定位到 body 左上。
 */
export function drawLibaoPlaceholder(g: Phaser.GameObjects.Graphics, facing: number): void {
  g.fillStyle(COLOR_LIBAO, 1);
  g.fillRoundedRect(0, 0, 24, 34, 6);
  g.lineStyle(1, COLOR_OUTLINE, 1);
  g.strokeRoundedRect(0, 0, 24, 34, 6);

  // 朝向眼睛点（facing>=0 朝右）
  const eyeX = facing >= 0 ? 16 : 8;
  g.fillStyle(COLOR_OUTLINE, 1);
  g.fillCircle(eyeX, 14, 2);
}
