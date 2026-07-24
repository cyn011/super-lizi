/**
 * game/render/mali-topper — 栗宝头顶蜕变物程序化绘制 + 蜕变光晕（GDD 12 §3.5 / art §1.3）。
 *
 * 归 UI 程序（seed-eng 实现；美术总监只出规格 + 复审）。game 层，允许 Phaser。
 * 仅做「视觉」：绝不修改 body / sizeScale / form / 碰撞盒（GDD 12 §3.4/§3.5 红线）。
 *
 * 调色板取自 art-bible §3.1 / placeholder-spec §1.5：
 *   草绿 #7CC242 / 暖黄 #FFD23F / 暖橙 #F2933C / 近黑棕描边 #2A1A12。
 * 光晕暖黄 #FFD23F（art-bible §1.3 权威值）。
 *
 * 锚点：topper 在世界坐标 (cx, topY) 绘制，topY = 栗宝头顶 y（碰撞盒顶）；
 * 配件向上（负 y）生长。尺寸小（~16px），像素对齐。
 */
import type Phaser from 'phaser';
import type { Stage } from '../../core/seed/seed-types';

const SPROUT_GREEN = 0x7cc242; // 草绿嫩芽
const WARM_YELLOW = 0xffd23f; // 暖黄花瓣/花心
const FRUIT_ORANGE = 0xf2933c; // 暖橙果（莓红/橙 → 取调色板暖橙；莓红非调色板色，留美术复审）
const OUTLINE = 0x2a1a12; // 近黑棕描边
const AURA_COLOR = 0xffd23f; // 蜕变光晕暖黄（art-bible §1.3 权威值 #FFD23F）

/** 在 (cx, topY)（topY=栗宝头顶 y）程序化绘制头顶蜕变物。每帧 redraw 用最新 stage 即可平滑跟随 body。 */
export function drawMaliTopper(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  topY: number,
  stage: Stage,
): void {
  switch (stage) {
    case 'sprout':
      drawSprout(g, cx, topY);
      break;
    case 'vine':
      drawVine(g, cx, topY);
      break;
    case 'bloom':
      drawBloom(g, cx, topY);
      break;
    case 'fruit':
      drawFruit(g, cx, topY);
      break;
  }
}

/** 苗：短茎 + 2 小叶（嫩芽绿）。 */
function drawSprout(g: Phaser.GameObjects.Graphics, cx: number, topY: number): void {
  g.lineStyle(2, SPROUT_GREEN, 1);
  g.lineBetween(cx, topY, cx, topY - 5);
  g.fillStyle(SPROUT_GREEN, 1);
  g.fillCircle(cx - 3, topY - 6, 3);
  g.fillCircle(cx + 3, topY - 6, 3);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx - 3, topY - 6, 3);
  g.strokeCircle(cx + 3, topY - 6, 3);
}

/** 藤：更长卷藤 + 多叶。 */
function drawVine(g: Phaser.GameObjects.Graphics, cx: number, topY: number): void {
  g.lineStyle(2, SPROUT_GREEN, 1);
  g.lineBetween(cx, topY, cx + 2, topY - 4);
  g.lineBetween(cx + 2, topY - 4, cx - 2, topY - 7);
  g.lineBetween(cx - 2, topY - 7, cx + 2, topY - 11);
  g.fillStyle(SPROUT_GREEN, 1);
  g.fillCircle(cx + 5, topY - 5, 3);
  g.fillCircle(cx - 4, topY - 8, 3);
  g.fillCircle(cx + 4, topY - 12, 3);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx + 5, topY - 5, 3);
  g.strokeCircle(cx - 4, topY - 8, 3);
  g.strokeCircle(cx + 4, topY - 12, 3);
}

/** 花：茎顶花瓣（暖黄）+ 草绿花心。 */
function drawBloom(g: Phaser.GameObjects.Graphics, cx: number, topY: number): void {
  g.lineStyle(2, SPROUT_GREEN, 1);
  g.lineBetween(cx, topY, cx, topY - 8);
  g.fillStyle(WARM_YELLOW, 1);
  g.fillCircle(cx - 4, topY - 12, 3.5);
  g.fillCircle(cx + 4, topY - 12, 3.5);
  g.fillCircle(cx, topY - 16, 3.5);
  g.fillCircle(cx, topY - 8, 3.5);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx - 4, topY - 12, 3.5);
  g.strokeCircle(cx + 4, topY - 12, 3.5);
  g.strokeCircle(cx, topY - 16, 3.5);
  g.strokeCircle(cx, topY - 8, 3.5);
  g.fillStyle(SPROUT_GREEN, 1);
  g.fillCircle(cx, topY - 12, 2.5);
}

/** 果：茎顶圆果（暖橙）+ 草绿小叶。仅渲染、不动碰撞盒/尺寸（GDD 12 §3.5）。 */
function drawFruit(g: Phaser.GameObjects.Graphics, cx: number, topY: number): void {
  g.lineStyle(2, SPROUT_GREEN, 1);
  g.lineBetween(cx, topY, cx, topY - 8);
  g.fillStyle(SPROUT_GREEN, 1);
  g.fillCircle(cx + 4, topY - 9, 2.5);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx + 4, topY - 9, 2.5);
  g.fillStyle(FRUIT_ORANGE, 1);
  g.fillCircle(cx, topY - 14, 5);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeCircle(cx, topY - 14, 5);
  g.fillStyle(WARM_YELLOW, 0.8);
  g.fillCircle(cx - 2, topY - 16, 1.5);
}

/**
 * 蜕变光晕：在 (cx, cy) 生成暖黄光晕圆，alpha 0→0.6→0、半径小→大（scale），≤0.4s 后销毁。
 * 单次脉冲、不闪（GDD 12 §3.1 / art §1.3）。仅视觉，不改任何玩法状态。
 */
export function playMetamorphAura(scene: Phaser.Scene, cx: number, cy: number): void {
  const aura = scene.add.circle(cx, cy, 20, AURA_COLOR, 1).setDepth(13);
  aura.setScale(0.3).setAlpha(0);
  // 半径小→大（scale 0.3→1.25，Phaser 全局支持，最稳）
  scene.tweens.add({ targets: aura, scale: 1.25, duration: 400, ease: 'Sine.Out' });
  // alpha 0→0.6→0（yoyo），结束即销毁（≤0.4s，单次脉冲）
  scene.tweens.add({
    targets: aura,
    alpha: 0.6,
    duration: 200,
    yoyo: true,
    ease: 'Sine.InOut',
    onComplete: () => aura.destroy(),
  });
}
