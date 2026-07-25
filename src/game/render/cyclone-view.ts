/**
 * game/render/cyclone-view — 气旋（cyclone）占位绘制（GDD 15 §7.3，锁色板内，game/ 允许 Phaser）。
 *
 * 半透明天蓝气柱（#5BC8F5，alpha≤0.35）+ 蓝紫漩涡辉光（#6E7BF2）+ 上升叶/瓣粒子（#FFD23F），
 * 随 phase 旋转。与鼓苞（橙刺柱）/ 弹藤（绿线圈）形态 + 颜色全异（实心 vs 半透明气柱）。
 * 几何读 EnemyAI.getBounds()（气柱 bbox，自地面向上延伸），单一真相源，与力场检测一致。
 */
import type Phaser from 'phaser';
import type { EnemyAI } from '../../core/enemy/enemy-ai';

const CYCLONE_BODY = 0x5bc8f5; // 天空（气柱主体，锁色板 #11）
const CYCLONE_GLOW = 0x6e7bf2; // 蓝紫（漩涡辉光，锁色板 #9）
const CYCLONE_PARTICLE = 0xffd23f; // 暖黄（上升粒子，锁色板 #4）
const OUTLINE = 0x2a1a12; // 近黑棕描边（锁色板 #5）

/** 在世界坐标 Graphics 上绘制一个气旋（已消灭则跳过）。 */
export function drawCyclone(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  if (e.dead) return; // 已消灭不绘制
  const b = e.getBounds();
  if (b.h <= 0.5 || b.w <= 0.5) return;
  const inZone = e.cycloneInZone;
  const phase = e.cyclonePhaseState;

  // 气柱主体（半透明天蓝，inZone 时略亮）
  const bodyA = inZone ? 0.4 : 0.28;
  g.fillStyle(CYCLONE_BODY, bodyA);
  g.fillRect(b.x, b.y, b.w, b.h);
  g.lineStyle(1, OUTLINE, 0.5);
  g.strokeRect(b.x, b.y, b.w, b.h);

  // 漩涡辉光（蓝紫，沿 phase 旋转的两条斜带，纯视觉）
  g.fillStyle(CYCLONE_GLOW, inZone ? 0.35 : 0.22);
  const cx = b.x + b.w / 2;
  const bandW = b.w * 0.5;
  const off = Math.sin(phase) * (b.w * 0.18);
  g.fillRoundedRect(cx - bandW / 2 + off, b.y + 4, bandW, b.h - 8, 6);
  g.fillStyle(CYCLONE_GLOW, inZone ? 0.25 : 0.16);
  const off2 = Math.sin(phase + Math.PI) * (b.w * 0.18);
  g.fillRoundedRect(cx - bandW / 2 + off2, b.y + 10, bandW * 0.7, b.h - 20, 6);

  // 上升粒子（暖黄，沿 phase 周期性上移点缀，暗示上升气流）
  g.fillStyle(CYCLONE_PARTICLE, inZone ? 0.9 : 0.6);
  const cols = 3;
  for (let i = 0; i < cols; i++) {
    const px = b.x + b.w * ((i + 0.5) / cols);
    const t = (phase / (2 * Math.PI) + i / cols) % 1; // 0..1 上升相位
    const py = b.y + b.h * (1 - t); // 自柱底向柱顶上升
    g.fillCircle(px, py, 2.2);
  }
}
