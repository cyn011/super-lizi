/**
 * game/render/cyclone-view — 气旋（cyclone）占位绘制（GDD 15 §7.3，锁色板内，game/ 允许 Phaser）。
 *
 * 半透明天蓝气柱（#5BC8F5，alpha≤0.35）+ 蓝紫漩涡辉光（#6E7BF2）+ 上升叶/瓣粒子（#FFD23F），
 * 随 phase 旋转。与鼓苞（橙刺柱）/ 弹藤（绿线圈）形态 + 颜色全异（实心 vs 半透明气柱）。
 * 几何读 EnemyAI.getBounds()（气柱 bbox，自地面向上延伸），单一真相源，与力场检测一致。
 *
 * ⚠️ biome 分支（art/zenith-biome-spec.md §A5.4.5 硬约束）：
 *   - `theme === 'zenith'`（3-6 破晓穹顶，亮天 #FFE695）→ 走「逆光暗管」口径（drawCycloneZenith）。
 *     现有青柱在破晓金天前仅 1.54:1（粒子 #FFD23F 更差，1.17:1），整根气柱实质隐形。
 *   - **其余全部 theme（含 2-3 storm_sky 已 live 的 4 个 cyclone 实例）走完全原样的现有路径**，
 *     零改动、零回归。spec §A5.4.5 明确否决「给所有 cyclone 统一加描边/暗管」的全局方案。
 *   - theme 缺省（undefined）= 现有观感（向后兼容，忘记传参退化为安全现状而非崩溃）。
 */
import type Phaser from 'phaser';
import type { EnemyAI } from '../../core/enemy/enemy-ai';
import type { LevelTheme } from '../../core/level/level-data';

const CYCLONE_BODY = 0x5bc8f5; // 天空（气柱主体，锁色板 #11）
const CYCLONE_GLOW = 0x6e7bf2; // 蓝紫（漩涡辉光，锁色板 #9）
const CYCLONE_PARTICLE = 0xffd23f; // 暖黄（上升粒子，锁色板 #4）
const OUTLINE = 0x2a1a12; // 近黑棕描边（锁色板 #5）

/**
 * zenith（破晓穹顶）专用暗管配色（art/zenith-biome-spec.md §A5.4.2 部件表，锁色板 / tint 派生，0 新增 hex）。
 * 可发现性由「暗管 silhouette」保证（描边 13.56:1 + 填充 12.41:1 对破晓金天），与粒子裸天对比无关。
 */
const ZEN_TUBE_FILL = 0x1f2244; // 穹壳暗面（rockBody，darken(#6E7BF2,0.72) tint）；vs 金天 12.41:1
const ZEN_TUBE_STROKE_W = 2; // 暗管描边 2px（§A5.3 规则 1：亮天前关键交互物一律 2px）
const ZEN_PARTICLE = 0xf2933c; // 晨曦暖橙（firelight，锁色板 #2）；vs 暗管 6.57:1
const ZEN_SWIRL = 0x5bc8f5; // 残星辉青（crystalCore，锁色板 #11）；vs 暗管 8.03:1，保留跨 biome 身份
const ZEN_SWIRL2 = 0x6e7bf2; // 蓝紫次旋纹（锁色板 #9）；vs 暗管 4.21:1，次级装饰不承载识别
const ZEN_PARTICLE_R = 2.2; // 粒子半径（与非 zenith 一致）

/**
 * 在世界坐标 Graphics 上绘制一个气旋（已消灭则跳过）。
 *
 * @param theme        关卡主题；仅 'zenith' 走暗管分支，其余（含 undefined）= 现有观感，逐值不变。
 * @param reduceMotion Reduce Motion 下冻结首帧（静态暗管 + 粒子/旋纹停在 phase=0），仅 zenith 分支消费。
 */
export function drawCyclone(
  g: Phaser.GameObjects.Graphics,
  e: EnemyAI,
  theme?: LevelTheme,
  reduceMotion = false,
): void {
  if (e.dead) return; // 已消灭不绘制
  const b = e.getBounds();
  if (b.h <= 0.5 || b.w <= 0.5) return;

  // ── zenith 分支：逆光暗管（§A5.4.2）。非 zenith 一律不进入，保 2-3 storm_sky 零回归。
  if (theme === 'zenith') {
    drawCycloneZenith(g, e, b, reduceMotion);
    return;
  }

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

/**
 * zenith 逆光暗管（art/zenith-biome-spec.md §A5.4.2 / §A5.4.3）：
 *   暗管填充 #1F2244 alpha≤0.5 → 中心旋纹 #5BC8F5 → 次旋纹 #6E7BF2 → 升腾粒子 #F2933C → 2px #2A1A12 描边（最后画，silhouette 清晰）。
 *
 * ⚠️ 粒子必须**严格限制在暗管内**（§A5.4.3 最差情形）：粒子逸出管外贴裸金天仅 1.89:1 即消失，
 *    全靠暗管兜底 —— 故粒子中心按「描边半宽 + 粒子半径」双向内缩钳制，几何上不可能触及管缘之外。
 */
function drawCycloneZenith(
  g: Phaser.GameObjects.Graphics,
  e: EnemyAI,
  b: { x: number; y: number; w: number; h: number },
  reduceMotion: boolean,
): void {
  const inZone = e.cycloneInZone;
  // Reduce Motion：冻结首帧（phase 归零 → 旋纹/粒子静止；暗管本就静态，silhouette 仍 13.56:1 可发现）。
  const phase = reduceMotion ? 0 : e.cyclonePhaseState;
  const cx = b.x + b.w / 2;

  // 1) 暗管填充（半透，读成「被晨光罩住的上升气流」而非实心地形；alpha 恒 ≤0.5）
  g.fillStyle(ZEN_TUBE_FILL, inZone ? 0.5 : 0.42);
  g.fillRect(b.x, b.y, b.w, b.h);

  // 2) 中心旋纹（青，保留气柱跨 biome 身份；落在暗管内 8.03:1）
  const bandW = b.w * 0.5;
  const off = Math.sin(phase) * (b.w * 0.18);
  g.fillStyle(ZEN_SWIRL, inZone ? 0.55 : 0.4);
  g.fillRoundedRect(cx - bandW / 2 + off, b.y + 4, bandW, b.h - 8, 6);

  // 3) 次旋纹（蓝紫，次级装饰，不承载识别；落在暗管内 4.21:1）
  const off2 = Math.sin(phase + Math.PI) * (b.w * 0.18);
  g.fillStyle(ZEN_SWIRL2, inZone ? 0.3 : 0.2);
  g.fillRoundedRect(cx - bandW / 2 + off2, b.y + 10, bandW * 0.7, b.h - 20, 6);

  // 4) 升腾粒子（暖橙；严格钳制在暗管内 —— 逸出即贴裸金天 1.89:1 消失）
  const inset = ZEN_TUBE_STROKE_W / 2 + ZEN_PARTICLE_R; // 描边半宽 + 粒子半径
  const minX = b.x + inset;
  const maxX = b.x + b.w - inset;
  const minY = b.y + inset;
  const maxY = b.y + b.h - inset;
  if (maxX > minX && maxY > minY) {
    g.fillStyle(ZEN_PARTICLE, inZone ? 0.95 : 0.7);
    const cols = 3;
    const spanY = maxY - minY;
    for (let i = 0; i < cols; i++) {
      const rawX = b.x + b.w * ((i + 0.5) / cols);
      const px = Math.min(maxX, Math.max(minX, rawX)); // 横向钳制
      const t = (phase / (2 * Math.PI) + i / cols) % 1; // 0..1 上升相位
      const py = minY + spanY * (1 - t); // 纵向直接落在安全区内（自管底升至管顶）
      g.fillCircle(px, py, ZEN_PARTICLE_R);
    }
  }

  // 5) 暗管描边（2px 满 alpha，最后画 → 可发现性硬兜底，vs 破晓金天 13.56:1）
  g.lineStyle(ZEN_TUBE_STROKE_W, OUTLINE, 1);
  g.strokeRect(b.x, b.y, b.w, b.h);
}
