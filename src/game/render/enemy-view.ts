/**
 * game/render/enemy-view — S04-1/S04-2 敌人占位渲染（game/ 允许 Phaser；core 零平台铁律）。
 *
 * 双编码（色 + 形状）色盲安全，统一 #2A1A12 描边（对齐 asset-manifest §4 P0）：
 *   - 可踩（ci_li / du_fu）：软顶圆角（无刺）+ 双编码眼睛，暗示「可从顶踩死」。
 *   - 不可踩（chong_feng / shi_pao）：硬角/楔形前尖/方顶炮口，暗示「危险·勿踩」。
 * 色：ci_li = 警示红 #E8483B，du_fu = 蓝紫 #6E7BF2，chong_feng = 警示红 #E8483B（强化不可踩危险，S04-2），
 *     shi_pao = 石白 #F4EFE6（固定炮台，GDD 04；越界色整改 A）。
 * 敌人渲染落在 game/（Phaser Graphics），逻辑（EnemyAI）在 core/，二者经 getBounds() 解耦。
 */
import type Phaser from 'phaser';
import type { EnemyAI } from '../../core/enemy/enemy-ai';

const CI_LI_COLOR = 0xe8483b; // 警示红（ci_li）
const DU_FU_COLOR = 0x6e7bf2; // 蓝紫（du_fu）
const CHONG_FENG_COLOR = 0xe8483b; // 警示红（chong_feng，强化不可踩危险，S04-2）
const SHI_PAO_COLOR = 0xf4efe6; // 石白（shi_pao 固定炮台，GDD 04；越界色整改 A）
const SHI_PAO_MUZZLE = 0x8a8276; // 炮口石灰暗（stone dark；越界色整改 A）
const FLASH_COLOR = 0xe8483b; // 开火闪光警示红（双编码危险色；越界色整改 A）
const OUTLINE = 0x2a1a12; // 近黑棕描边

/** 在世界坐标 Graphics 上绘制一个敌人（已消灭则跳过）。 */
export function drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  if (e.dead) return; // 已消灭不绘制
  const b = e.getBounds();
  const color =
    e.type === 'ci_li'
      ? CI_LI_COLOR
      : e.type === 'du_fu'
        ? DU_FU_COLOR
        : e.type === 'chong_feng'
          ? CHONG_FENG_COLOR
          : SHI_PAO_COLOR;

  if (e.type === 'chong_feng') {
    drawChongFeng(g, b, color, e);
  } else if (e.type === 'shi_pao') {
    drawShiPao(g, b, color, e);
  } else {
    drawStompable(g, b, color); // ci_li / du_fu：软顶圆角 + 双编码眼睛
  }
}

/** 可踩敌：软顶大圆角（无刺）+ 双编码眼睛，暗示可踩。 */
function drawStompable(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
  color: number,
): void {
  const topR = b.h / 2;
  const radii = { tl: topR, tr: topR, bl: 4, br: 4 };
  g.fillStyle(color, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.fillStyle(OUTLINE, 1);
  const eyeY = b.y + b.h * 0.42;
  g.fillCircle(b.x + b.w * 0.36, eyeY, 2);
  g.fillCircle(b.x + b.w * 0.64, eyeY, 2);
}

/** 不可踩·冲锋怪：硬角矩形 + 朝 facing 的楔形前尖（强化「冲锋/危险·勿踩」）。 */
function drawChongFeng(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
  color: number,
  e: EnemyAI,
): void {
  const dir = e.facing;
  g.fillStyle(color, 1);
  g.fillRect(b.x, b.y, b.w, b.h); // 硬角（无圆角）
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRect(b.x, b.y, b.w, b.h);
  // 楔形前尖：front 边中点向 facing 方向伸出三角，双编码「危险/冲锋」
  const tipX = dir > 0 ? b.x + b.w + 5 : b.x - 5;
  const baseX = dir > 0 ? b.x + b.w : b.x;
  const cy = b.y + b.h / 2;
  g.fillStyle(color, 1);
  g.fillTriangle(baseX, b.y + 4, baseX, b.y + b.h - 4, tipX, cy);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeTriangle(baseX, b.y + 4, baseX, b.y + b.h - 4, tipX, cy);
  // 双编码眼睛（朝 facing）
  g.fillStyle(OUTLINE, 1);
  const eyeX = dir > 0 ? b.x + b.w * 0.62 : b.x + b.w * 0.38;
  const eyeY = b.y + b.h * 0.4;
  g.fillCircle(eyeX, eyeY, 2);
}

/** 不可踩·石炮：方顶硬棱 + 朝 aim 方向的炮口 + 开火闪光（双编码「危险·勿踩」）。 */
function drawShiPao(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
  color: number,
  e: EnemyAI,
): void {
  g.fillStyle(color, 1);
  g.fillRect(b.x, b.y, b.w, b.h); // 方顶硬棱（无圆角）
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRect(b.x, b.y, b.w, b.h);
  // 炮口：朝 aim 方向伸出小矩形
  const aim = e.aim;
  const len = Math.hypot(aim.x, aim.y) || 1;
  const ux = aim.x / len;
  const uy = aim.y / len;
  const mw = 6;
  const mh = 6;
  const mx = b.x + b.w / 2 + ux * (b.w / 2) - mw / 2;
  const my = b.y + b.h / 2 + uy * (b.h / 2) - mh / 2;
  g.fillStyle(SHI_PAO_MUZZLE, 1);
  g.fillRect(mx, my, mw, mh);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRect(mx, my, mw, mh);
  // 开火闪光（仅视觉）
  if (e.flash > 0) {
    g.fillStyle(FLASH_COLOR, 0.9);
    g.fillCircle(b.x + b.w / 2 + ux * (b.w / 2 + 4), b.y + b.h / 2 + uy * (b.h / 2 + 4), 4);
  }
  // 双编码眼睛
  g.fillStyle(OUTLINE, 1);
  g.fillCircle(b.x + b.w * 0.36, b.y + b.h * 0.4, 2);
  g.fillCircle(b.x + b.w * 0.64, b.y + b.h * 0.4, 2);
}
