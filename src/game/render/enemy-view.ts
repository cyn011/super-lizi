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
import type { LevelTheme } from '../../core/level/level-data';
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

/**
 * zenith（破晓穹顶，3-6）专用换皮配色（art/zenith-biome-spec.md §A5.2 逐敌处理表）。
 * 全部取自 11 色锁色板或其既有 tint 派生，**0 新增 hex**：
 *   #373D79 = darken(#6E7BF2,0.5)（深星紫，theme-palette ZENITH.rockFace 同值）；
 *   #BDE9FB = lighten(#5BC8F5,0.6)（星云雾，astral-biome-spec §A5 已定义的 du_fu 翅膜色）。
 *
 * 总原则（§A5 三管齐下）：① 体色压暗至 #373D79（对破晓金天 8.06:1）；
 * ② 上缘 1px #FFD23F 破晓 rim（对暗岩 6.90:1，解决「暗体掠过暗岩又糊」）；
 * ③ 描边由全局 1px **加倍至 2px** #2A1A12（对天 13.56:1）。形状 + 明度双编码，不依赖色相，色盲安全。
 *
 * ⚠️ 这些常量**只在 zenith 分支内消费**；非 zenith 路径继续走上方原有常量，逐值不变。
 */
const ZEN_BODY_DARK = 0x373d79; // 深星紫暗体（vs 破晓金天 8.06:1）
const ZEN_RIM = 0xffd23f; // 破晓金上缘 rim（vs 暗岩 6.90:1）
const ZEN_STROKE_W = 2; // 描边加倍 2px（§A5.3 规则 1）
const ZEN_DANGER = 0xe8483b; // 警示红（危险语义全局不变，§A5.3 规则 4）
const ZEN_ACCENT = 0x5bc8f5; // 残星辉青（脉纹 / 炮口；仅用于暗体之上，§A5.3 规则 3）
const ZEN_TRAIL = 0xf2933c; // 晨曦暖橙（ci_li 拖尾纹，增独特性）
const ZEN_WING = 0xbde9fb; // 星云雾翅膜（du_fu，半透；同 astral §A5）

/**
 * 在世界坐标 Graphics 上绘制一个敌人（已消灭则跳过）。
 *
 * @param theme 关卡主题（`runtime.data.metadata.theme`）。仅 'zenith' 走 §A5.2 换皮分支；
 *              其余全部 theme（含 undefined 缺省）走**完全原样**的现有代码路径，逐值零回归。
 */
export function drawEnemy(
  g: Phaser.GameObjects.Graphics,
  e: EnemyAI,
  reduceMotion = false,
  theme?: LevelTheme,
): void {
  if (e.dead) return; // 已消灭不绘制
  if (e.type === 'bouncy_vine') {
    drawBouncyVine(g, e); // 弹藤：草绿线圈（纯辅助，友好色）
    return;
  }
  if (e.type === 'cyclone') {
    drawCyclone(g, e, theme, reduceMotion); // 气旋：半透明上升气流柱（zenith 走逆光暗管）
    return;
  }
  if (e.type === 'gu_bao') {
    if (theme === 'zenith') drawGuBaoZenith(g, e);
    else drawGuBao(g, e); // 鼓苞：地生苞 + 尖刺（危险）/ 软顶（可踩）
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
  if (e.type === 'vehicle') {
    drawVehicle(g, e, reduceMotion); // 街道汽车：危险车身 + 车窗 + 车轮 + 头灯（硬顶不可踩，GDD 1-6 §3.2）
    return;
  }
  if (e.type === 'manhole') {
    drawManhole(g, e, reduceMotion); // 街道井盖：盖 + 蒸汽柱/预警红边（GDD 1-6 §3.3）
    return;
  }
  if (e.type === 'paper_pile') {
    drawPaperPile(g, e); // 办公文件堆：暖金纸堆 + 暖黄翻页（可踩平台，GDD 1-7 §3）
    return;
  }
  if (e.type === 'coffee_spill') {
    drawCoffeeSpill(g, e, reduceMotion); // 办公咖啡渍：暗棕渍 + 红边闪（低摩擦 zone telegraph，GDD 1-7 §3）
    return;
  }
  const b = e.getBounds();

  // ── zenith 分支（§A5.2）：ci_li / du_fu / shi_pao 换皮。chong_feng 不在 3-6 出场，不做分支。
  if (theme === 'zenith') {
    if (e.type === 'shi_pao') drawShiPaoZenith(g, b, e);
    else if (e.type === 'du_fu') drawDuFuZenith(g, b);
    else if (e.type === 'ci_li') drawCiLiZenith(g, b);
    else drawStompable(g, b, CHONG_FENG_COLOR); // 兜底：非 3-6 敌种走原样式
    return;
  }

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

// ══════════════════════════════════════════════════════════════════════════
// zenith（破晓穹顶）换皮实现 —— art/zenith-biome-spec.md §A5.2 逐行落地。
// 仅由 theme === 'zenith' 进入；所有非 zenith 关卡不触及本区任何代码。
// ══════════════════════════════════════════════════════════════════════════

/** 上缘 1px #FFD23F 破晓 rim（逆光轮廓光，把暗体从暗岩前景「拉」出来；§A5.3 规则 2）。 */
function zenRim(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
  inset = 0,
): void {
  g.lineStyle(1, ZEN_RIM, 1);
  g.lineBetween(b.x + inset, b.y, b.x + b.w - inset, b.y);
}

/**
 * shi_pao 穹炮（§A5.2 第 1 行）：石身 #F4EFE6 → #373D79（顺带在本分支内清掉 #F4EFE6/#8A8276 两个越界色）；
 * 上缘 1px #FFD23F rim；炮口 #5BC8F5 + 缘 #E8483B；描边 2px。
 * ⚠️ 越界色只在 zenith 分支内清理 —— 非 zenith 路径的 SHI_PAO_COLOR/SHI_PAO_MUZZLE 保持原样（全局整改为独立议题）。
 */
function drawShiPaoZenith(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
  e: EnemyAI,
): void {
  // 炮身（方顶硬棱 = 不可踩形状语言不变）：暗体 + 2px 描边
  g.fillStyle(ZEN_BODY_DARK, 1);
  g.fillRect(b.x, b.y, b.w, b.h);
  g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
  g.strokeRect(b.x, b.y, b.w, b.h);
  // 上缘破晓 rim（对暗岩 6.90:1）
  zenRim(g, b);

  // 炮口：朝 aim 方向伸出小矩形（#5BC8F5 芯；按 §A5.3 规则 3 必带 #2A1A12 描边）
  const aim = e.aim;
  const len = Math.hypot(aim.x, aim.y) || 1;
  const ux = aim.x / len;
  const uy = aim.y / len;
  const mw = 6;
  const mh = 6;
  const mx = b.x + b.w / 2 + ux * (b.w / 2) - mw / 2;
  const my = b.y + b.h / 2 + uy * (b.h / 2) - mh / 2;
  g.fillStyle(ZEN_ACCENT, 1);
  g.fillRect(mx, my, mw, mh);
  g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
  g.strokeRect(mx, my, mw, mh);
  // 炮口缘（警示红，危险双编码 + 对金天 3.14:1 自持）
  g.lineStyle(ZEN_STROKE_W, ZEN_DANGER, 1);
  g.lineBetween(mx + ux * mw, my + uy * mh, mx + mw - ux * mw, my + mh - uy * mh);

  // 开火闪光（仅视觉，危险语义色全局不变）
  if (e.flash > 0) {
    g.fillStyle(ZEN_DANGER, 0.9);
    g.fillCircle(b.x + b.w / 2 + ux * (b.w / 2 + 4), b.y + b.h / 2 + uy * (b.h / 2 + 4), 4);
  }
  // 双编码眼睛（暗体上改用破晓金，保证在 #373D79 上仍可读；vs 暗体 6.90:1）
  g.fillStyle(ZEN_RIM, 1);
  g.fillCircle(b.x + b.w * 0.36, b.y + b.h * 0.4, 2);
  g.fillCircle(b.x + b.w * 0.64, b.y + b.h * 0.4, 2);
}

/**
 * gu_bao 曙苞（§A5.2 第 2 行）：苞体 #F2933C → #373D79；上缘 1px #FFD23F rim；脉纹 #5BC8F5；
 * 顶刺 #E8483B；软顶 #FFD23F 环（vs 暗苞体 6.90:1，可踩窗口比 astral 更醒目）；描边 2px。
 */
function drawGuBaoZenith(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.h <= 0.5) return; // DORMANT：地下不可见（盒高≈0）
  const radii = { tl: b.w / 2, tr: b.w / 2, bl: 2, br: 2 };
  // 苞体（暗体 + 2px 描边）
  g.fillStyle(ZEN_BODY_DARK, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);
  // 脉纹（青，落在暗苞体上 8.03:1；仅装饰，不承载识别）
  g.lineStyle(1, ZEN_ACCENT, 0.8);
  g.lineBetween(b.x + b.w * 0.5, b.y + b.h * 0.25, b.x + b.w * 0.5, b.y + b.h * 0.85);
  g.lineBetween(b.x + b.w * 0.3, b.y + b.h * 0.45, b.x + b.w * 0.3, b.y + b.h * 0.85);
  g.lineBetween(b.x + b.w * 0.7, b.y + b.h * 0.45, b.x + b.w * 0.7, b.y + b.h * 0.85);
  // 上缘破晓 rim（§A5.2 gu_bao 行：全状态恒有；后续尖刺 / 软顶环覆盖其上，不冲突）
  zenRim(g, b, 2);

  const state = e.guBaoPhaseState;
  const cx = b.x + b.w / 2;
  if (state === 'EMERGING' || state === 'ACTIVE') {
    // 警示红尖刺顶（危险双编码，形状语言不变）：三枚三角 + 2px 描边
    g.fillStyle(ZEN_DANGER, 1);
    const half = b.w / 2;
    const sh = Math.max(3, b.w * 0.45);
    const mid = b.y - sh;
    g.fillTriangle(b.x, b.y, b.x + half * 0.6, b.y, cx, mid);
    g.fillTriangle(b.x + half * 0.4, b.y, b.x + b.w - half * 0.4, b.y, cx, mid);
    g.fillTriangle(b.x + b.w - half * 0.6, b.y, b.x + b.w, b.y, cx, mid);
    g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
    g.strokeTriangle(b.x, b.y, b.x + half * 0.6, b.y, cx, mid);
    g.strokeTriangle(b.x + b.w - half * 0.6, b.y, b.x + b.w, b.y, cx, mid);
  } else if (state === 'RETRACTING') {
    // 软顶：破晓金高光环（可踩提示，vs 暗苞体 6.90:1），尖刺收起
    g.fillStyle(ZEN_RIM, 1);
    const topH = Math.max(3, b.h * 0.28);
    g.fillRoundedRect(b.x + 2, b.y, b.w - 4, topH, { tl: b.w / 3, tr: b.w / 3, bl: 0, br: 0 });
  }
}

/**
 * ci_li 陨星体（§A5.2 第 3 行）：主体 #E8483B → #373D79（一致性提升，Tier-1 的 3.14:1 本已达标）；
 * #F2933C 拖尾纹增独特性；上缘 1px #FFD23F rim；描边 2px。
 * ⚠️ 「刺保持 #E8483B」= 保持现状 —— ci_li 是**可踩**敌（isStompable），现有占位为「软顶圆角·无刺」
 *    （见本文件头部形状契约）。尖角是全项目保留给「不可踩·危险」的形状编码（§A5.3 规则 4 功能语义全局不变），
 *    故 zenith 不为可踩敌新增尖刺，避免误导玩家「不可踩」。
 */
function drawCiLiZenith(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
): void {
  const topR = b.h / 2;
  const radii = { tl: topR, tr: topR, bl: 4, br: 4 }; // 软顶圆角（可踩形状语言不变）
  g.fillStyle(ZEN_BODY_DARK, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);
  // 拖尾纹（暖橙，落在暗体上；陨星体身份线索，与 du_fu 区分）
  g.lineStyle(1, ZEN_TRAIL, 0.9);
  g.lineBetween(b.x + b.w * 0.12, b.y + b.h * 0.72, b.x + b.w * 0.42, b.y + b.h * 0.72);
  g.lineBetween(b.x + b.w * 0.2, b.y + b.h * 0.88, b.x + b.w * 0.5, b.y + b.h * 0.88);
  // 上缘破晓 rim
  zenRim(g, b, 3);
  // 双编码眼睛（破晓金，vs 暗体 6.90:1）
  g.fillStyle(ZEN_RIM, 1);
  const eyeY = b.y + b.h * 0.42;
  g.fillCircle(b.x + b.w * 0.36, eyeY, 2);
  g.fillCircle(b.x + b.w * 0.64, eyeY, 2);
}

/**
 * du_fu 曙精灵（§A5.2 第 4 行）：主体**保持 #6E7BF2**（跨关身份不动）；描边加倍至 2px #2A1A12；
 * 肚斑 #373D79（同 astral §A5）；翅膜 #BDE9FB 半透。
 * 翅尖朝上 —— 与 du_fu_silhouette 的「反向翅（朝下）」保持既有区分契约（见本文件 drawSilhouette 注释）。
 */
function drawDuFuZenith(
  g: Phaser.GameObjects.Graphics,
  b: { x: number; y: number; w: number; h: number },
): void {
  const cx = b.x + b.w / 2;
  // 翅膜（星云雾半透，翅尖朝上；先画，被主体压住内缘）
  const wingBaseY = b.y + b.h * 0.5;
  const wingTipY = b.y - b.h * 0.45;
  g.fillStyle(ZEN_WING, 0.55);
  g.fillTriangle(b.x, wingBaseY, b.x, b.y + b.h * 0.15, cx - b.w * 0.12, wingTipY);
  g.fillTriangle(b.x + b.w, wingBaseY, b.x + b.w, b.y + b.h * 0.15, cx + b.w * 0.12, wingTipY);
  // 翅膜同样走 2px 描边：翅是剪影的一部分，亮天前须与主体同口径（§A5.3 规则 1）
  g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
  g.strokeTriangle(b.x, wingBaseY, b.x, b.y + b.h * 0.15, cx - b.w * 0.12, wingTipY);
  g.strokeTriangle(b.x + b.w, wingBaseY, b.x + b.w, b.y + b.h * 0.15, cx + b.w * 0.12, wingTipY);

  // 主体（蓝紫身份色不动）+ 2px 描边（临界 2.94:1 靠描边 13.56:1 兜底）
  const topR = b.h / 2;
  const radii = { tl: topR, tr: topR, bl: 4, br: 4 };
  g.fillStyle(DU_FU_COLOR, 1);
  g.fillRoundedRect(b.x, b.y, b.w, b.h, radii);
  g.lineStyle(ZEN_STROKE_W, OUTLINE, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, b.h, radii);
  // 肚斑（深星紫暗斑，亮天下给主体一块暗锚点；同 astral §A5）
  g.fillStyle(ZEN_BODY_DARK, 1);
  g.fillEllipse(cx, b.y + b.h * 0.68, b.w * 0.5, b.h * 0.42);
  // 上缘破晓 rim
  zenRim(g, b, 4);
  // 双编码眼睛（描边色，落在蓝紫主体上，与非 zenith 一致）
  g.fillStyle(OUTLINE, 1);
  const eyeY = b.y + b.h * 0.42;
  g.fillCircle(b.x + b.w * 0.36, eyeY, 2);
  g.fillCircle(b.x + b.w * 0.64, eyeY, 2);
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

/**
 * 街道汽车（vehicle）占位绘制（GDD 1-6 §3.2 / street-visual-spec §2，锁色板内 0 新增色）：
 *   - 车身：环境冷蓝 #4A78C0 + 描边 #2A1A12（圆角上 3/4 车体）。
 *   - 下裙暗带：街影暗蓝 #254060（tint 派生，锁色板 #6）。
 *   - 车窗：天空 #5BC8F5 半透（锁色板 #11）。
 *   - 车轮 ×2：描边 #2A1A12 + 暗蓝轮毂 #254060。
 *   - 头灯：警示红 #E8483B 朝 facing 楔形（硬顶不可踩双编码）；≤2Hz 闪烁，Reduce Motion 常亮。
 * 致命 hazard（applyFatalDeath，isStompable=false），仅形状+颜色双编码危险，避用命粉 #F26D8B。
 * 几何读 EnemyAI.getBounds()（box 顶 y = JSON y，底贴 ground 顶；横向 ping-pong 由 AI 推进）。
 */
const VEHICLE_BODY = 0x4a78c0; // 环境冷蓝 #4A78C0（#10，车身）
const VEHICLE_DARK = 0x254060; // 街影暗蓝 #254060（#6，下裙/暗带）
const VEHICLE_WIN = 0x5bc8f5; // 天空 #5BC8F5（#11，车窗）
const VEHICLE_OUT = 0x2a1a12; // 描边 #2A1A12（#5）
const VEHICLE_LIGHT = 0xe8483b; // 警示红 #E8483B（#7，头灯）
function drawVehicle(g: Phaser.GameObjects.Graphics, e: EnemyAI, reduceMotion: boolean): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  const dir = e.vehicleDir;
  const bodyH = b.h * 0.78;
  // 1) 下裙暗带（先画，被车体压住上缘）
  g.fillStyle(VEHICLE_DARK, 1);
  g.fillRect(b.x + 2, b.y + bodyH - 6, b.w - 4, b.h - bodyH + 6);
  // 2) 车身（上 3/4 圆角）
  g.fillStyle(VEHICLE_BODY, 1);
  g.fillRoundedRect(b.x, b.y, b.w, bodyH, { tl: 6, tr: 6, bl: 4, br: 4 });
  g.lineStyle(1, VEHICLE_OUT, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, bodyH, { tl: 6, tr: 6, bl: 4, br: 4 });
  // 3) 车窗（半透天空蓝）
  g.fillStyle(VEHICLE_WIN, 0.6);
  g.fillRoundedRect(b.x + 8, b.y + 5, b.w - 16, b.h * 0.32, 3);
  // 4) 车轮 ×2（描边 + 暗蓝轮毂）
  const wheelY = b.y + b.h - 2;
  for (const wx of [b.x + 12, b.x + b.w - 12]) {
    g.fillStyle(VEHICLE_OUT, 1);
    g.fillCircle(wx, wheelY, 5);
    g.fillStyle(VEHICLE_DARK, 1);
    g.fillCircle(wx, wheelY, 2.5);
  }
  // 5) 头灯（朝 facing，警示红楔形；≤2Hz 闪烁，Reduce Motion 常亮）
  const hp = e.headPhaseState + e.vehiclePhaseOffset * 0.012;
  const on = reduceMotion ? true : Math.sin(hp) > 0;
  const lightA = on ? 1 : 0.35;
  const fx = dir > 0 ? b.x + b.w : b.x;
  const cy = b.y + b.h * 0.5;
  const tipX = dir > 0 ? fx + 6 : fx - 6;
  g.fillStyle(VEHICLE_LIGHT, lightA);
  g.fillTriangle(fx, cy - 4, fx, cy + 4, tipX, cy);
}

/**
 * 街道井盖（manhole）占位绘制（GDD 1-6 §3.3 / street-visual-spec §2，锁色板内 0 新增色）：
 *   - 井盖：环境冷蓝 #4A78C0 扁椭圆 + 描边 #2A1A12 环 + 格栅线（贴地，常态无害）。
 *   - TELEGRAPH：预警红边 #E8483B（≤3Hz 闪，不伤）。
 *   - STEAM：暖橙 #F2933C 蒸汽柱 blob（≤3Hz 摆动）+ 红边双编码（伤害期）。
 * 仅 STEAM 蒸汽柱为软伤害（resolveHazardContact，FULL→SMALL −1 级 + 无敌帧），避用命粉 #F26D8B。
 * 几何读 EnemyAI 的 manholeCenterX/anchorY/steamHeight（蒸汽柱 AABB 与 getSteamBounds 一致）。
 */
const MANHOLE_COVER = 0x4a78c0; // 环境冷蓝 #4A78C0（#10，井盖）
const MANHOLE_OUT = 0x2a1a12; // 描边 #2A1A12（#5）
const MANHOLE_STEAM = 0xf2933c; // 暖橙 #F2933C（#3，蒸汽）
const MANHOLE_EDGE = 0xe8483b; // 警示红 #E8483B（#7，预警/伤害双编码）
function drawManhole(g: Phaser.GameObjects.Graphics, e: EnemyAI, reduceMotion: boolean): void {
  const cx = e.manholeCenterXState;
  const topY = e.manholeAnchorYState; // ground 顶
  const w = e.getBounds().w; // 盖宽（= 蒸汽柱宽）
  const r = w / 2;
  const state = e.manholePhaseState;
  const sh = e.manholeSteamHeightState;
  // 1) 井盖（扁椭圆贴地）+ 描边环 + 格栅
  g.fillStyle(MANHOLE_COVER, 1);
  g.fillEllipse(cx, topY - 3, w, w * 0.4);
  g.lineStyle(1, MANHOLE_OUT, 1);
  g.strokeEllipse(cx, topY - 3, w, w * 0.4);
  g.lineStyle(1, MANHOLE_OUT, 0.8);
  for (let i = -1; i <= 1; i++) {
    g.lineBetween(cx + i * (r * 0.5), topY - 3 - w * 0.16, cx + i * (r * 0.5), topY - 3 + w * 0.16);
  }
  // 2) TELEGRAPH：预警红边（≤3Hz 闪，不伤）
  if (state === 'TELEGRAPH') {
    const sp = e.steamPhaseState;
    const a = reduceMotion ? 0.8 : 0.5 + 0.5 * Math.sin(sp); // ≤3Hz
    g.lineStyle(2, MANHOLE_EDGE, a);
    g.strokeRect(cx - r - 1, topY - sh, w + 2, sh);
  } else if (state === 'STEAM') {
    // 3) STEAM：暖橙蒸汽柱 blob（≤3Hz 摆动）
    const sp = e.steamPhaseState;
    g.fillStyle(MANHOLE_STEAM, 0.55);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const yy = topY - t * sh;
      const wob = reduceMotion ? 0 : Math.sin(sp + i) * 2 * (1 - t);
      const rw = r * (0.45 + 0.55 * (1 - t)) + (reduceMotion ? 0 : Math.sin(sp * 1.3 + i) * 2);
      g.fillCircle(cx + wob, yy, rw);
    }
    // 红边双编码（伤害期）
    g.lineStyle(1, MANHOLE_EDGE, 0.6);
    g.strokeRect(cx - r, topY - sh, w, sh);
  }
}

/**
 * 办公文件堆（paper_pile）占位绘制（GDD 1-7 §3 / office-visual-spec §2.1，锁色板内 0 新增色）：
 *   - 纸堆主体：经济金 #F2C94C + 描边 #2A1A12（暖金纸面，可踩平台）。
 *   - 暗面：暗棕 #79491E（darken(#F2933C,0.5) tint 派生，0 新增）。
 *   - 歪斜纸片（顶×3）：经济金 + 描边（有机纸堆造型）。
 *   - 高光翻页：暖黄 #FFD23F（纸感 telegraph + 可踩提示）。
 *   - 顶缘 1px 描边：#2A1A12（可踩提示，与硬顶敌区分）。
 * 可踩平台（soft 顶）：暖金圆润纸顶 + 暖黄翻页 = 可踩形状语言，避用命粉 #F26D8B。
 * 几何读 EnemyAI.getBounds()（盒 = 瓦片覆盖区，单一真相源，与碰撞盒/瓦片网格一致）。
 */
const PAPER_PILE_PAPER = 0xf2c94c; // 经济金 #F2C94C（#8，纸面）
const PAPER_PILE_PAGE = 0xffd23f; // 暖黄 #FFD23F（#4，翻页高光）
const PAPER_PILE_DARK = 0x79491e; // 暗棕 #79491E（darken(#F2933C,0.5) tint 派生，0 新增）
const PAPER_PILE_OUT = 0x2a1a12; // 描边 #2A1A12（#5）
function drawPaperPile(g: Phaser.GameObjects.Graphics, e: EnemyAI): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  const bodyH = b.h * 0.7; // 堆叠主体占 70% 高，顶部留纸片空间
  // 1) 纸堆主体（堆叠圆角矩形，微歪）
  g.fillStyle(PAPER_PILE_PAPER, 1);
  g.fillRoundedRect(b.x, b.y, b.w, bodyH, 3);
  g.lineStyle(1, PAPER_PILE_OUT, 1);
  g.strokeRoundedRect(b.x, b.y, b.w, bodyH, 3);
  // 2) 暗面（右侧，体积感）
  g.fillStyle(PAPER_PILE_DARK, 1);
  g.fillRect(b.x + b.w * 0.72, b.y, b.w * 0.28, bodyH);
  // 3) 歪斜纸片（顶上几张）
  for (let i = 0; i < 3; i++) {
    const px = b.x + 3 + i * 5;
    const py = b.y - 4 - i * 4;
    const pw = b.w - 10 - i * 6;
    g.fillStyle(PAPER_PILE_PAPER, 1);
    g.fillRoundedRect(px, py, pw, 5, 2);
    g.lineStyle(1, PAPER_PILE_OUT, 0.8);
    g.strokeRoundedRect(px, py, pw, 5, 2);
  }
  // 4) 高光翻页（暖黄亮页，纸感 + 可踩 telegraph）
  g.fillStyle(PAPER_PILE_PAGE, 1);
  g.fillRect(b.x + 4, b.y + 4, b.w * 0.4, 4);
  // 5) 顶缘 1px 描边（可访问性，soft 顶可踩提示）
  g.lineStyle(1, PAPER_PILE_OUT, 1);
  g.lineBetween(b.x, b.y, b.x + b.w, b.y);
}

/**
 * 办公咖啡渍（coffee_spill）占位绘制（GDD 1-7 §3 / office-visual-spec §2.2，锁色板内 0 新增色）：
 *   - 渍面：暗棕 #79491E 半透不规则斑块（非碰撞 low_friction zone 视觉）。
 *   - crema 内圈：暖橙 #F2933C 浅咖。
 *   - 湿反光：天空 #5BC8F5 小椭圆。
 *   - 边缘警示红边：警示红 #E8483B 闪（≤2Hz，low_friction telegraph）；Reduce Motion 冻结首帧静态红边。
 *   - 细微波纹：天空 #5BC8F5 椭圆描边（≤2Hz，Reduce Motion 冻结）。
 * 非碰撞：仅 zone 视觉；low_friction 触发由 physics 据 RuntimeLevel.coffeeSpillZones 暴露的 frictionScale 判定。
 * 几何读 EnemyAI.getBounds()（zone 矩形，单一真相源）。禁用品红 #F26D8B。
 */
const COFFEE_STAIN = 0x79491e; // 暗棕 #79491E（darken(#F2933C,0.5) tint 派生，0 新增）
const COFFEE_CREMA = 0xf2933c; // 暖橙 #F2933C（#3，crema）
const COFFEE_WET = 0x5bc8f5; // 天空 #5BC8F5（#11，湿反光）
const COFFEE_EDGE = 0xe8483b; // 警示红 #E8483B（#7，低摩擦 telegraph）
const COFFEE_OUT = 0x2a1a12; // 描边 #2A1A12（#5）

/** 确定性不规则斑点（伪随机半径微变，seed 不同则形状不同；render-only，不进碰撞）。 */
function coffeeBlobPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const n = 10;
  let s = (seed * 9301 + 49297) % 233280;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s = (s * 9301 + 49297) % 233280;
    const rr = 0.82 + (s / 233280) * 0.3; // 半径微变（0.82~1.12）
    pts.push({ x: cx + Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr });
  }
  return pts;
}

function drawCoffeeSpill(g: Phaser.GameObjects.Graphics, e: EnemyAI, reduceMotion: boolean): void {
  const b = e.getBounds();
  if (b.w <= 0 || b.h <= 0) return;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h; // 贴地底
  // 1) 暗棕半透不规则斑块（fillPoints 拟泼洒）
  g.fillStyle(COFFEE_STAIN, 0.55);
  g.fillPoints(coffeeBlobPoints(cx, cy, b.w * 0.5, b.h * 0.4, 1), true);
  // 2) 内圈 crema 暖橙（浅咖）
  g.fillStyle(COFFEE_CREMA, 0.4);
  g.fillPoints(coffeeBlobPoints(cx, cy, b.w * 0.32, b.h * 0.26, 2), true);
  // 3) 湿反光高光（天空蓝，α≤0.4）
  g.fillStyle(COFFEE_WET, 0.35);
  g.fillEllipse(cx - 4, cy - 3, b.w * 0.25, b.h * 0.15);
  // 4) 边缘警示红闪（low_friction telegraph，≤2Hz）
  const ph = e.coffeeRipplePhaseState;
  const ea = reduceMotion ? 0.5 : 0.35 + 0.35 * Math.sin(ph); // ≤2Hz
  g.lineStyle(1.5, COFFEE_EDGE, ea);
  g.strokePoints(coffeeBlobPoints(cx, cy, b.w * 0.5, b.h * 0.4, 1), true);
  // 5) 细微波纹（≤2Hz，Reduce Motion 冻结）
  if (!reduceMotion) {
    const ra = 0.3 * Math.sin(ph * 1.2);
    g.lineStyle(1, COFFEE_WET, Math.max(0, ra));
    g.strokeEllipse(cx, cy, b.w * 0.4, b.h * 0.3);
  }
}
