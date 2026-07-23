/**
 * game/render/coin-view — S04-3 金币占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 经济金圆币 + 中心竖纹（双编码：形状 + 颜色共同区分，色盲安全）。
 * 尺寸取自 pickup-resolution 的 COIN_SIZE，保证绘制盒 == 碰撞盒。
 * 参考 enemy-view.ts 的绘制风格与 depth（assets-manifest §4 P0 占位策略，atlas 换皮留 E8）。
 */
import type Phaser from 'phaser';
import type { CoinEntityDef } from '../../core/level/level-data';
import { COIN_SIZE } from '../pickup-resolution';

const COIN_COLOR = 0xf2c94c; // 经济金（art-bible 调色板）
const OUTLINE = 0x2a1a12; // 近黑棕描边（asset-manifest §4 P0 统一描边）

/** 在世界坐标 Graphics 上绘制一个金币（已拾取的不绘制，由调用方按去重集合跳过）。 */
export function drawCoin(g: Phaser.GameObjects.Graphics, c: CoinEntityDef): void {
  const cx = c.x + COIN_SIZE / 2;
  const cy = c.y + COIN_SIZE / 2;
  const r = COIN_SIZE / 2 - 1;
  // 币面（金圆）
  g.fillStyle(COIN_COLOR, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx, cy, r);
  // 双编码：中心竖纹（不依赖颜色即可辨识为「币」）
  g.fillStyle(OUTLINE, 0.8);
  g.fillRect(cx - 1, cy - r + 3, 2, r);
}
