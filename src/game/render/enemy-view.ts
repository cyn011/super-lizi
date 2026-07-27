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
import { drawCyclone } from './cyclone-view';

const CI_LI_COLOR = 0xe8483b; // 警示红（ci_li）
const DU_FU_COLOR = 0x6e7bf2; // 蓝紫（du_fu）
const CHONG_FENG_COLOR = 0xe8483b; // 警示红（chong_feng，强化不可踩危险，S04-2）
const SHI_PAO_COLOR = 0xf4efe6; // 石白（shi_pao 固定炮台，GDD 04；越界色整改 A）
const SHI_PAO_MUZZLE = 0x8a8276; // 炮口石灰暗（stone dark；越界色整改 A）
const FLASH_COLOR = 0xe8483b; // 开火闪光警示红（双编码危险色；越界色整改 A）
const OUTLINE = 0x2a1a12; // 近黑棕描边
const VINE_GREEN = 0x7cc242; // 草绿（弹藤藤体，锁色板 #1）
const VINE_HIGHLIGHT = 0xffd23f; // 暖黄（弹藤高光环，友好辅助提示，锁色板 #4）

/** 在世界坐标 Graphics 上绘制一个敌人（已消灭则跳过）。 */
export function drawEnemy(
  g: Phaser.GameObjects.Graphics,
  e: EnemyAI,
  reduceMotion = false,
): void {
  if (e.dead) return; // 已消灭不绘制
  if (e.type === 'bouncy_vine') {
    drawBouncyVine(g, e); // 弹藤：草绿线圈（纯辅助，友好色）
    return;
  }
  if (e.type === 'cyclone') {
    drawCyclone(g, e); // 气旋：半透明上升气流柱（纯辅助力场）
    return;
  }
  if (e.type === 'gu_bao') {
    drawGuBao(g, e); // 鼓苞：地生苞 + 尖刺（危险）/ 软顶（可踩）
    return;
  }
  if (e.type === 'du_fu_silhouette') {
    drawSilhouette(g, e); // 嘟浮剪影：暗色 + 反向翅 + 暖黄发光边（GDD 16 §7.3）
    return;
  }
  if (e.type === 'jellyfish') {
    drawJellyfish(g, e); // 水母：半透天空蓝伞 + 蓝紫触手 + 暖黄核心（sea 专属，GDD 1-3 §3.2）
    return;
  }
  if (e.type === 'scorpion') {
    drawScorpion(g, e); // 蝎子：暖橙身 + 暗钳/腿 + 上翘红尾刺（desert 专属，GDD 1-4 §3.2）
    return;
  }
  if (e.type === 'cactus') {
    drawCactus(g, e); // 仙人掌：草绿柱 + 红刺 + 硬顶不可踩（desert 专属固定障碍，GDD 1-4 §3.3）
    return;
  }
  if (e.type === 'pet') {
    drawPet(g, e, reduceMotion); // 宠物：暖橙圆润四足 + 暖黄耳 + 红铃（home 专属，GDD 1-5 §3.2）
    return;
  }
  if (e.type === 'toy') {
    drawToy(g, e); // 玩具：经济金小方块 + 红尖角（home 专属静止小 hazard，GDD 1-5 §3.3）
    return;
  }
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

/**
 * 鼓苞（gu_bao）占位绘制（GDD 13 §7.3，锁色板内）：
 *   - 苞体：暖橙 #F2933C + 描边 #2A1A12（与 4 旧敌区分）。
 *   - 危险态（EMERGING/ACTIVE）：顶部警示红 #E8483B 尖刺（危险双编码）。
 *   - 缩回软顶（RETRACTING）：尖刺收起，顶转暖黄 #FFD23F 高光环（可踩提示）。
 *   - DORMANT（盒高≈0）：不绘制（地下）。
 * 几何读 EnemyAI.getBounds()（盒顶随升起进度 p 上移），单一真相源，与碰撞盒一致。
 */
const GU_BAO_BUD = 0xf2933c; // 暖橙苞体
const GU_BAO_SPIKE = 0xe8483b; // 警示红尖刺（危险）
const GU_BAO_SOFT = 0xffd23f; // 暖黄软顶（可踩）
function drawGuBao(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.h <= 0.5) return; // DORMANT：地下不可见（盒高≈0）
  const outline = OUTLINE;
  // 苞体（垂直圆角柱）
  const radii = { tl: b.w / 2, tr: b.w / 2, bl: 2, br: 2 };
  g.fillStyle(GU_BAO_BUD, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.lineStyle(1, outline, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);

  const state = e.guBaoPhaseState;
  const cx = b.x + b.w / 2;
  if (state === 'EMERGING' || state === 'ACTIVE') {
    // 警示红尖刺顶（危险双编码）：三枚三角
    g.fillStyle(GU_BAO_SPIKE, 1);
    const half = b.w / 2;
    const sh = Math.max(3, b.w * 0.45);
    const mid = b.y - sh;
    g.fillTriangle(b.x, b.y, b.x + half * 0.6, b.y, cx, mid);
    g.fillTriangle(b.x + half * 0.4, b.y, b.x + b.w - half * 0.4, b.y, cx, mid);
    g.fillTriangle(b.x + b.w - half * 0.6, b.y, b.x + b.w, b.y, cx, mid);
    g.lineStyle(1, outline, 1);
    g.strokeTriangle(b.x, b.y, b.x + half * 0.6, b.y, cx, mid);
    g.strokeTriangle(b.x + b.w - half * 0.6, b.y, b.x + b.w, b.y, cx, mid);
  } else if (state === 'RETRACTING') {
    // 软顶：暖黄高光环（可踩提示），尖刺收起
    g.fillStyle(GU_BAO_SOFT, 1);
    const topH = Math.max(3, b.h * 0.28);
    g.fillRoundedRect(b.x + 2, b.y, b.w - 4, topH, { tl: b.w / 3, tr: b.w / 3, bl: 0, br: 0 });
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

/**
 * 弹藤（bouncy_vine）占位绘制（GDD 14 §7.3，锁色板内）：
 *   - 藤体：草绿 #7CC242 + 描边 #2A1A12（与鼓苞暖橙 / 4 旧敌区分）。
 *   - 压缩（SPRING）：线圈压扁；回弹（RECOIL）：松弛。
 *   - 高光环（暖黄 #FFD23F）：友好辅助提示（与鼓苞 RETRACTING 软顶暖黄同源但语境不同）。
 * 几何读 EnemyAI.getBounds()（盒贴地，顶 = anchorY - height），单一真相源，与碰撞盒一致。
 */
function drawBouncyVine(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.h <= 0.5) return;
  const outline = OUTLINE;
  const state = e.vinePhaseState;
  const p = e.vineProgress; // 0..1 压缩/回弹进度
  // 线圈主体（扁圆角条，贴地）
  const h = Math.max(3, b.h * (1 - 0.4 * (state === 'SPRING' ? p : 0))); // SPRING 期压扁
  g.fillStyle(VINE_GREEN, 1);
  g.fillRoundedRect(b.x, b.y + (b.h - h), b.w, h, { tl: b.w / 2, tr: b.w / 2, bl: 4, br: 4 });
  g.lineStyle(1, outline, 1);
  g.strokeRoundedRect(b.x, b.y + (b.h - h), b.w, h, { tl: b.w / 2, tr: b.w / 2, bl: 4, br: 4 });
  // 卷曲纹（中竖线，暗示弹性线圈）
  g.lineStyle(1, outline, 0.7);
  g.beginPath();
  g.moveTo(b.x + b.w / 2, b.y + (b.h - h) + 2);
  g.lineTo(b.x + b.w / 2, b.y + b.h - 2);
  g.strokePath();
  // 高光环（友好辅助）：IDLE 常亮、SPRING 弹起瞬间最亮、RECOIL 渐隐
  const ringA = state === 'SPRING' ? 0.95 : state === 'RECOIL' ? 0.5 * (1 - p) : 0.7;
  g.fillStyle(VINE_HIGHLIGHT, ringA);
  const ringH = Math.max(2, b.h * 0.35);
  g.fillRoundedRect(b.x + 3, b.y + (b.h - h), b.w - 6, ringH, { tl: b.w / 3, tr: b.w / 3, bl: 0, br: 0 });
}

/**
 * 嘟浮剪影（du_fu_silhouette）占位绘制（GDD 16 §7.3，锁色板内 0 新增色）：
 *   - 主体：暗涂 #2A1A12（描边色，与原嘟浮蓝紫 #6E7BF2 明度反差极大）。
 *   - 反向翅：翅尖朝下（原嘟浮翅朝上），轮廓即分（art-bible §4.3 剪影法则）。
 *   - 暖黄发光边 #FFD23F（1px）：把暗剪影从亮背景「勾」出来，且与原嘟浮（无暖黄边）双编码区分。
 *   - 相位幽灵（phaseghost）WRAITH 期 alpha ≤ 0.4（半透可穿越）。
 * 四重区分线索（暗色 + 反向翅 + 暖黄边 + 镜像动效）全部生效（GDD 16 §7.4）。
 * 几何读 EnemyAI.getBounds()，单一真相源，与碰撞盒一致。
 */
const SIL_FILL = 0x2a1a12; // 暗涂描边 #2A1A12（锁色板 #5）
const SIL_GLOW = 0xffd23f; // 暖黄发光边 #FFD23F（锁色板 #4）
function drawSilhouette(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  const isWraith = e.silTwist === 'phaseghost' && e.silGhostState === 'WRAITH';
  const alpha = isWraith ? 0.4 : 1; // WRAITH 期半透
  const topR = b.h / 2;
  const radii = { tl: topR, tr: topR, bl: 4, br: 4 }; // 顶圆角（软顶轮廓，暗示可踩）

  // 暗色主体
  g.fillStyle(SIL_FILL, alpha);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);

  // 反向翅（翅尖朝下，原嘟浮朝上；轮廓即分）
  const cx = b.x + b.w / 2;
  const wingBaseY = b.y + b.h * 0.5;
  const wingTipY = b.y + b.h + b.h * 0.5; // 朝下伸出
  g.fillStyle(SIL_FILL, alpha);
  g.fillTriangle(b.x, wingBaseY, b.x, b.y + b.h, cx - b.w * 0.12, wingTipY);
  g.fillTriangle(b.x + b.w, wingBaseY, b.x + b.w, b.y + b.h, cx + b.w * 0.12, wingTipY);

  // 暖黄发光边（1px，强化「暗中显形」+ 双编码区分）
  g.lineStyle(1, SIL_GLOW, alpha);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.strokeTriangle(b.x, wingBaseY, b.x, b.y + b.h, cx - b.w * 0.12, wingTipY);
  g.strokeTriangle(b.x + b.w, wingBaseY, b.x + b.w, b.y + b.h, cx + b.w * 0.12, wingTipY);

  // 双编码眼睛（暖黄，朝下轮廓区分；明度/形状/动效多重线索，色盲安全）
  g.fillStyle(SIL_GLOW, alpha);
  const eyeY = b.y + b.h * 0.58;
  g.fillCircle(b.x + b.w * 0.36, eyeY, 2);
  g.fillCircle(b.x + b.w * 0.64, eyeY, 2);
}

/**
 * 水母（jellyfish）占位绘制（GDD 1-3 §3.2 / sea-visual-spec §2，锁色板内 0 新增色）：
 *   - 伞盖：半透天空蓝 #5BC8F5 alpha≤0.5 + 描边 #2A1A12 细边（半透穹顶，soft 顶暗示可踩）。
 *   - 触手：蓝紫 #6E7BF2 alpha≤0.6 飘带（≤2Hz 摆，防光敏），相位随 sim 时间（取 phase 近似）。
 *   - 核心：暖黄 #FFD23F 小点（生命感）。
 * 与 du_fu（实心蓝紫扁圆+翅）三重区分：半透天空蓝 vs 蓝紫实心 + 透明度 + 伞+触手 vs 扁圆+翅（色盲安全）。
 * 几何读 EnemyAI.getBounds()（盒随浮动上下，单一真相源，与碰撞盒一致）。
 */
const JELLY_CAP = 0x5bc8f5; // 天空蓝伞盖（锁色板 #11）
const JELLY_TENTACLE = 0x6e7bf2; // 蓝紫触手辉光（锁色板 #9，常量直接引用，不进 palette）
const JELLY_CORE = 0xffd23f; // 暖黄核心（锁色板 #4）
function drawJellyfish(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const ph = e.floatPhase;
  // 伞盖脉冲（±6% 缩放，≤1Hz，柔和；render-only micro-bob，不进碰撞）
  const pulse = 1 + Math.sin(ph) * 0.06;
  const capW = b.w * pulse;
  const capH = b.h * 0.55 * pulse;

  // 触手（3–4 条蓝紫半透飘带，相位摆动）
  g.lineStyle(3, JELLY_TENTACLE, 0.6);
  for (let i = 0; i < 4; i++) {
    const tx = b.x + 4 + i * ((b.w - 8) / 3);
    g.beginPath();
    g.moveTo(tx, cy - capH * 0.3);
    g.lineTo(tx + Math.sin(ph * 2 + i) * 3, cy + capH * 0.4);
    g.lineTo(tx + Math.sin(ph * 2 + i + 1) * 4, b.y + b.h - 2);
    g.strokePath();
  }

  // 伞盖（半透天空蓝穹顶 + 描边细边）
  g.fillStyle(JELLY_CAP, 0.5);
  g.fillEllipse(cx, cy - capH * 0.2, capW, capH);
  g.lineStyle(1, OUTLINE, 1);
  g.strokeEllipse(cx, cy - capH * 0.2, capW, capH);

  // 核心（暖黄小点）
  g.fillStyle(JELLY_CORE, 0.8);
  g.fillCircle(cx, cy - capH * 0.2, 3);
}

/**
 * 蝎子（scorpion）占位绘制（GDD 1-4 §3.2 / desert-visual-spec §2.1，锁色板内 0 新增色）：
 *   - 主体：暖橙 #F2933C + 描边 #2A1A12（长条圆角身，bbox 40×24）。
 *   - 钳/腿：沙岩暗面 #79491E（tint 派生，锁色板 #3 派生，0 新增）。
 *   - 尾（后，上翘）：暖橙节 + 警示红 #E8483B 尾尖（hard 顶不可踩双编码）。
 *   - 眼：天空 #5BC8F5（锁色板 #11）。
 *   - charge telegraph：尾刺上扬更高 + 尾尖红闪（≤2Hz，防光敏）。
 * 几何读 EnemyAI.getBounds()（盒顶随碰撞盒，单一真相源）。
 * 颜色仅用 11 色锁色板或 tint 派生（#79491E 为 darken(#F2933C,0.5) 派生，0 新增 hex）。
 */
const SCORPION_BODY = 0xf2933c; // 暖橙 #F2933C（#3）
const SCORPION_DARK = 0x79491e; // 沙岩暗面 #79491E（darken(#F2933C,0.5) tint 派生，0 新增）
const SCORPION_TIP = 0xe8483b; // 警示红 #E8483B（#7）
const SCORPION_EYE = 0x5bc8f5; // 天空 #5BC8F5（#11）
function drawScorpion(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  const dir = e.facing;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const t = e.scorpionChargePhase;
  const charging = e.scorpionCharging;

  // 1) 主体（长条圆角）
  g.fillStyle(SCORPION_BODY, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, { tl: 8, tr: 8, bl: 6, br: 6 });
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, { tl: 8, tr: 8, bl: 6, br: 6 });

  // 2) 腿（下 4–5 条，暗面）
  g.lineStyle(2, SCORPION_DARK, 1);
  for (let i = 0; i < 5; i++) {
    g.lineBetween(b.x + 5 + i * 7, b.y + b.h, b.x + 3 + i * 7, b.y + b.h + 5);
  }

  // 3) 钳（前 ×2，朝 facing 外伸）
  const fx = dir > 0 ? b.x + b.w : b.x;
  g.fillStyle(SCORPION_DARK, 1);
  g.fillTriangle(fx, cy - 6, fx + dir * 10, cy - 9, fx + dir * 10, cy - 2); // 上钳
  g.fillTriangle(fx, cy + 6, fx + dir * 10, cy + 9, fx + dir * 10, cy + 2); // 下钳

  // 4) 尾（后，上翘；charge 时抬高）
  const tailBaseX = dir > 0 ? b.x : b.x + b.w;
  const raise = charging ? -14 : -6; // charge 上扬更高
  g.fillStyle(SCORPION_BODY, 1);
  g.fillCircle(tailBaseX - dir * 4, cy, 4);
  g.fillCircle(tailBaseX - dir * 10, cy - 4, 3);
  g.fillCircle(tailBaseX - dir * 15, cy + raise, 2.5);

  // 5) 尾尖（danger，charge 时闪光 ≤2Hz）
  const tipA = charging ? 0.7 + 0.3 * Math.sin(t * 4) : 1; // ≤2Hz
  g.fillStyle(SCORPION_TIP, tipA);
  g.fillTriangle(
    tailBaseX - dir * 15 - 2,
    cy + raise,
    tailBaseX - dir * 15 + 2,
    cy + raise,
    tailBaseX - dir * 20,
    cy + raise - 6,
  );

  // 6) 眼（天空蓝点）
  g.fillStyle(SCORPION_EYE, 1);
  g.fillCircle(cx + dir * 10, b.y + 8, 2);
  g.fillCircle(cx + dir * 10, b.y + 16, 2);
}

/**
 * 仙人掌（cactus）占位绘制（GDD 1-4 §3.3 / desert-visual-spec §2.2，锁色板内 0 新增色）：
 *   - 主体：草绿 #7CC242 + 描边 #2A1A12（竖柱 bbox 24×48，底中贴地）。
 *   - 暗部：草绿暗 #3E6121（darken(#7CC242,0.5) tint 派生，0 新增）。
 *   - 侧臂：草绿 + 暗部。
 *   - 刺：警示红 #E8483B（hard 顶不可踩双编码）。
 * 静态障碍，无 idle/charge 区分（静态 telegraph 即可读）。
 * 颜色仅用 11 色锁色板或 tint 派生（#3E6121 为 darken(#7CC242,0.5) 派生，0 新增 hex）。
 */
const CACTUS_BODY = 0x7cc242; // 草绿 #7CC242（#1）
const CACTUS_DARK = 0x3e6121; // 草绿暗 #3E6121（darken(#7CC242,0.5) tint 派生，0 新增）
const CACTUS_SPIKE = 0xe8483b; // 警示红 #E8483B（#7）
function drawCactus(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  const cx = b.x + b.w / 2;
  // 1) 主体（竖柱）
  g.fillStyle(CACTUS_BODY, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, { tl: 10, tr: 10, bl: 4, br: 4 });
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, { tl: 10, tr: 10, bl: 4, br: 4 });
  // 2) 暗部（右 1/3）
  g.fillStyle(CACTUS_DARK, 1);
  g.fillRoundedRect(b.x + 16, b.y, 8, b.h, { tl: 0, tr: 10, bl: 0, br: 4 });
  // 3) 侧臂（左/右各一）
  g.fillStyle(CACTUS_BODY, 1);
  g.fillRoundedRect(b.x - 8, b.y + 20, 10, 16, 4); // 左臂
  g.fillRoundedRect(b.x + 22, b.y + 14, 10, 18, 4); // 右臂
  g.lineStyle(1, OUTLINE, 1);
  g.strokeRoundedRect(b.x - 8, b.y + 20, 10, 16, 4);
  g.strokeRoundedRect(b.x + 22, b.y + 14, 10, 18, 4);
  // 4) 刺（周身红，短放射）
  g.lineStyle(1, CACTUS_SPIKE, 1);
  for (let i = 0; i < 6; i++) {
    const yy = b.y + 8 + i * 7;
    g.lineBetween(b.x, yy, b.x - 4, yy - 2);
    g.lineBetween(b.x + b.w, yy, b.x + b.w + 4, yy - 2);
  }
  // 5) 顶刺（强化 hard 顶）
  g.lineBetween(cx, b.y, cx - 3, b.y - 5);
  g.lineBetween(cx, b.y, cx + 3, b.y - 5);
}

/**
 * 宠物（pet）占位绘制（GDD 1-5 §3.2 / home-visual-spec §2.1，锁色板内 0 新增色）：
 *   - 主体：暖橙 #F2933C + 描边 #2A1A12（矮圆身，bbox 36×28）。
 *   - 耳（上×2）：暖黄 #FFD23F 小三角（微动 ±6°）。
 *   - 暗部：沙岩暗面 #79491E（darken(#F2933C,0.5) tint 派生，0 新增）。
 *   - 四足：暖橙短腿。
 *   - 眼：天空 #5BC8F5（#11）。
 *   - 铃铛（颈）：警示红 #E8483B（#7，硬顶不可踩双编码「非安全」）。
 * 友好圆润外形 + 红铃 telegraph（形状+颜色双编码，色盲安全，避用命粉 #F26D8B）。
 * 矮胖 bob / 耳摆 ≤1Hz（render-only micro-bob，Reduce Motion 冻结首帧）；patrol 位移为玩法不冻结。
 * 几何读 EnemyAI.getBounds()（盒随碰撞盒，单一真相源）。
 */
const PET_BODY = 0xf2933c; // 暖橙 #F2933C（#3）
const PET_EAR = 0xffd23f; // 暖黄 #FFD23F（#4）
const PET_DARK = 0x79491e; // 沙岩暗面 #79491E（darken(#F2933C,0.5) tint 派生，0 新增）
const PET_EYE = 0x5bc8f5; // 天空 #5BC8F5（#11）
const PET_BELL = 0xe8483b; // 警示红 #E8483B（#7）
const PET_OUT = 0x2a1a12; // 描边 #2A1A12（#5）
function drawPet(g: Phaser.GameObjects.Graphics, e: EnemyAI, reduceMotion: boolean): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  const cx = b.x + b.w / 2;
  const ph = reduceMotion ? 0 : e.petBobPhaseState; // Reduce Motion 冻结微动首帧
  const bob = Math.sin(ph) * 3; // 矮胖 bob ±3px（≤1Hz）
  const yOff = b.y + bob;
  // 1) 主体（矮圆）
  g.fillStyle(PET_BODY, 1);
  g.fillRoundedRect(b.x, yOff, b.w, b.h, { tl: 14, tr: 14, bl: 10, br: 10 });
  g.lineStyle(1, PET_OUT, 1);
  g.strokeRoundedRect(b.x, yOff, b.w, b.h, { tl: 14, tr: 14, bl: 10, br: 10 });
  // 2) 暗部（底 1/3）
  g.fillStyle(PET_DARK, 1);
  g.fillRoundedRect(b.x + 2, yOff + b.h * 0.7, b.w - 4, b.h * 0.3, { tl: 0, tr: 0, bl: 8, br: 8 });
  // 3) 耳（上×2，暖黄，±6° 微动近似像素偏移）
  const earWig = Math.sin(ph) * 1.2;
  g.fillStyle(PET_EAR, 1);
  g.fillTriangle(cx - 10, yOff + 2, cx - 2, yOff + 2, cx - 6 + earWig, yOff - 8);
  g.fillTriangle(cx + 10, yOff + 2, cx + 2, yOff + 2, cx + 6 + earWig, yOff - 8);
  g.lineStyle(1, PET_OUT, 1);
  g.strokeTriangle(cx - 10, yOff + 2, cx - 2, yOff + 2, cx - 6 + earWig, yOff - 8);
  g.strokeTriangle(cx + 10, yOff + 2, cx + 2, yOff + 2, cx + 6 + earWig, yOff - 8);
  // 4) 四足（下×4）
  g.fillStyle(PET_BODY, 1);
  for (let i = 0; i < 4; i++) g.fillRoundedRect(b.x + 4 + i * 9, yOff + b.h - 4, 6, 7, 2);
  // 5) 眼（天空蓝点）
  g.fillStyle(PET_EYE, 1);
  g.fillCircle(cx - 6, yOff + 11, 2);
  g.fillCircle(cx + 6, yOff + 11, 2);
  // 6) 铃铛（颈，警示红，双编码「非安全」）
  g.fillStyle(PET_BELL, 1);
  g.fillCircle(cx, yOff + b.h * 0.55, 2.5);
}

/**
 * 玩具（toy）占位绘制（GDD 1-5 §3.3 / home-visual-spec §2.2，锁色板内 0 新增色）：
 *   - 主体：经济金 #F2C94C（#8）+ 描边 #2A1A12（小圆角块，bbox 20×16，底中贴地）。
 *   - 尖角/危险边：警示红 #E8483B（#7）四角小三角（硬顶不可踩双编码，与 cactus 红刺同源但更小）。
 * 静止贴地小 hazard（与 cactus 同族静态障碍），无 idle/charge 区分（静态 telegraph 即可读）。
 * 几何读 EnemyAI.getBounds()（盒随碰撞盒，单一真相源）。
 */
const TOY_BODY = 0xf2c94c; // 经济金 #F2C94C（#8）
const TOY_SPIKE = 0xe8483b; // 警示红 #E8483B（#7）
const TOY_OUT = 0x2a1a12; // 描边 #2A1A12（#5）
function drawToy(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  // 1) 主体（小圆角块）
  g.fillStyle(TOY_BODY, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, 5);
  g.lineStyle(1, TOY_OUT, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, 5);
  // 2) 尖角（上×2 + 侧×2，警示红，hard 顶不可踩双编码）
  g.fillStyle(TOY_SPIKE, 1);
  g.fillTriangle(b.x + 2, b.y, b.x + 7, b.y, b.x + 4.5, b.y - 5); // 左上尖
  g.fillTriangle(b.x + 13, b.y, b.x + 18, b.y, b.x + 15.5, b.y - 5); // 右上尖
  g.fillTriangle(b.x, b.y + 4, b.x, b.y + 12, b.x - 5, b.y + 8); // 左尖
  g.fillTriangle(b.x + 20, b.y + 4, b.x + 20, b.y + 12, b.x + 25, b.y + 8); // 右尖
}
