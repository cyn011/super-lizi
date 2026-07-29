/**
 * ui/result-screen — 通关结算 + 评级星 + 庆祝反馈（GDD 08 §3 / S05-2 / 结算页打磨）。
 *
 * 本文件两层：
 *   1) 纯函数 `evaluateRanks` / `computeRanks`（零 Phaser / 零平台 API，可被 Node 单测，
 *      tests/unit/ui/result-screen.test.ts）。评级映射为 S05-2 拍板：
 *        时间维度（elapsedMs ≤ parTimeMs 得时间评级）+ 金币收集率（≥50% 得金币评级）
 *        → 双达标=3 评级、单达标=2 评级、完成但未达标=1 评级（失败不进结算，走 GameOver）。
 *   2) `ResultScreen` Phaser 视图：遮罩 + 庆祝标题 + 矢量五角星（依次弹出/发光）+
 *      栗宝庆祝头像 + 彩带粒子 + 成绩区（图标/最佳纪录/NEW）+ 星级规则提示 +
 *      主按钮「下一关」+ 次按钮「再玩一次/关卡选择」。
 *      矢量 + 系统字体（ADR-004），禁位图字体；中文 ≥14px；按钮热区 ≥48×48。
 *
 * 关键约束：本文件对 Phaser 仅用 `import type`（编译期类型，运行时被擦除），
 * 故 Node 单测 import 本文件不会拉起 Phaser / canvas。运行期 Phaser 调用全部走
 * 注入的 `scene` 实例方法（scene.add.* / scene.tweens.*），不引用任何 Phaser.* 运行时值。
 *
 * 钩子：暴露 `handleTap(x,y)`（逻辑坐标）供 S05-5 微信深适配把原生触摸映射到按钮；
 * Web 端直接用 Phaser interactive 按钮，无需此钩子。
 */
import type Phaser from 'phaser';
import { ON_RESTART, ON_NEXT_LEVEL, ON_RETURN_TITLE } from '../core/events/event-bus';
import { pointInRect } from '../core/util/hit-test';
// RankResult 类型已上移至 core/meta/save-data（S05-3：core 不依赖 ui 铁律收口）。
import type { RankResult } from '../core/meta/save-data';

// ── 纯函数层（零 Phaser / 零平台 API，可单测）──

/** 评级计算的输入。 */
export interface RankInput {
  /** 本次通关用时（ms）。 */
  elapsedMs: number;
  /** 目标时间（ms）：elapsedMs ≤ parTimeMs 得时间评级；≤0 视为未定（不达标）。 */
  parTimeMs: number;
  /** 已拾取金币数。 */
  collectedCoins: number;
  /** 关卡金币总数。 */
  totalCoins: number;
}

/**
 * 评级评估结果（供 UI 展示 + 纯计数）。
 * 注意：RankResult 类型定义已迁至 src/core/meta/save-data（本文件仅 import type），
 * 避免 core 反向依赖 ui 层。
 */

/** 金币收集率阈值：≥50% 得金币评级（S05-2 拍板，GDD 08 §3 权重各 50%）。 */
export const RANK_COIN_COLLECT_RATE = 0.5;
/** 完成即得的基础评级数（保证「完成但未达标」也至少 1 评级）。 */
export const BASE_RANKS_ON_CLEAR = 1;

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * 评估评级（纯函数）。
 *   coinRate = totalCoins>0 ? collected/total : 1（无金币视为全收集）
 *   coinMet  = coinRate ≥ 0.5
 *   timeMet  = parTimeMs>0 && elapsedMs ≤ parTimeMs
 *   ranks    = 1（基础）+ (timeMet?1:0) + (coinMet?1:0)   → 范围 [1,3]
 */
export function evaluateRanks(input: RankInput): RankResult {
  const coinRate =
    input.totalCoins > 0 ? clamp01(input.collectedCoins / input.totalCoins) : 1;
  const coinMet = coinRate >= RANK_COIN_COLLECT_RATE;
  const timeMet = input.parTimeMs > 0 && input.elapsedMs <= input.parTimeMs;
  const ranks = BASE_RANKS_ON_CLEAR + (timeMet ? 1 : 0) + (coinMet ? 1 : 0);
  // S05-3：携带 elapsedMs / collectedCoins，供 game-scene 直接交给 SaveManager.recordClear 落盘。
  return { ranks, timeMet, coinMet, coinRate, elapsedMs: input.elapsedMs, collectedCoins: input.collectedCoins };
}

/** 仅取评级数（= evaluateRanks(input).ranks）。 */
export function computeRanks(input: RankInput): number {
  return evaluateRanks(input).ranks;
}

// ── Phaser 视图层 ──

const LOGICAL_W = 512;
const LOGICAL_H = 288;
const CENTER_X = LOGICAL_W / 2; // 256
const CENTER_Y = LOGICAL_H / 2; // 144

// 颜色（春日花园气质 + 像素清晰描边）
const COLOR_OVERLAY_BG = 0x000000;
const OVERLAY_ALPHA = 0.78;
const COLOR_PANEL = 0x2b190f;
const COLOR_PANEL_TOP = 0x3a2518;
const COLOR_OUTLINE = 0x160b07;
const COLOR_HIGHLIGHT = 0xffd23f; // 暖金高光
const COLOR_TITLE = '#FFD23F';
const COLOR_RANK_ON = 0xffd23f; // 金星填充
const COLOR_RANK_OFF = 0x554938; // 暗金棕星
const COLOR_TEXT_MAIN = '#F4EFE6';
const COLOR_TEXT_MUTED = '#C9B8A3';
const COLOR_TEXT_ACCENT = '#FFD23F';
const COLOR_TEXT_DANGER = '#ff8a7a'; // 未达标提示
const COLOR_BTN_MAIN = 0x70a82e;
const COLOR_BTN_MAIN_HIGH = 0x9bca3e;
const COLOR_BTN_SECONDARY = 0xa75e28;
const COLOR_BTN_SECONDARY_HIGH = 0xc77b39;
const TEXT_FONT = 'sans-serif';

// 目标稿是接近方形的奖章卡片；在 16:9 画布中保留左右安全区，不压到刘海/微信胶囊。
const PANEL_W = 344;
const PANEL_H = 270;

// 主按钮
const MAIN_BTN_W = 252;
const MAIN_BTN_H = 34;
// 次按钮（底部横排两个）
const SUB_BTN_W = 120;
const SUB_BTN_H = 28;
const SUB_BTN_GAP = 12;

// 评级星
const RANK_ROW_Y = -64;
const RANK_GAP = 58;
const RANK_OUTER_R = 27;
const RANK_INNER_R = 12;

// 栗宝头像
const AVATAR_X = -PANEL_W / 2 + 36;
const AVATAR_Y = RANK_ROW_Y + 1;

// 成绩区
const STATS_Y = -2;
const STAT_ROW_H = 22;

const MAIN_BTN_Y = 78;
const SUB_BTN_Y = 114;

/** 可单测的结算布局合同：防止后续把主视觉再次压回窄竖卡或让按钮互相覆盖。 */
export const RESULT_LAYOUT = {
  logicalWidth: LOGICAL_W,
  logicalHeight: LOGICAL_H,
  panelWidth: PANEL_W,
  panelHeight: PANEL_H,
  mainButton: { width: MAIN_BTN_W, height: MAIN_BTN_H, y: MAIN_BTN_Y },
  subButton: { width: SUB_BTN_W, height: SUB_BTN_H, gap: SUB_BTN_GAP, y: SUB_BTN_Y },
} as const;

export function computeSubButtonPositions(): {
  leftX: number;
  rightX: number;
  leftCenterX: number;
  rightCenterX: number;
} {
  const leftX = -SUB_BTN_W - SUB_BTN_GAP / 2;
  const rightX = SUB_BTN_GAP / 2;
  return {
    leftX,
    rightX,
    leftCenterX: leftX + SUB_BTN_W / 2,
    rightCenterX: rightX + SUB_BTN_W / 2,
  };
}

/** 像素风：手绘圆角矩形（每角 3 段折线，避免 fillRoundedRect 的平滑感）。 */
function drawPixelPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  topFill?: number,
): void {
  const r = 6; // 像素圆角半径
  g.fillStyle(fill, 1);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.lineTo(x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.lineTo(x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.lineTo(x, y + h - r);
  g.lineTo(x, y + r);
  g.closePath();
  g.fillPath();

  if (topFill !== undefined) {
    g.fillStyle(topFill, 1);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.lineTo(x + w, y + r);
    g.lineTo(x + w, y + h * 0.45);
    g.lineTo(x, y + h * 0.45);
    g.lineTo(x, y + r);
    g.closePath();
    g.fillPath();
  }

  g.lineStyle(2, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.lineTo(x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.lineTo(x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.lineTo(x, y + h - r);
  g.lineTo(x, y + r);
  g.closePath();
  g.strokePath();
}

/** 绘制平整纯色按钮：单一底色 + 统一像素描边，不使用渐变或上下色带。 */
function drawPixelButton(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
  inset: number,
): void {
  const r = 5;
  // 单一纯色表面
  g.fillStyle(base, 1);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.lineTo(x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.lineTo(x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.lineTo(x, y + h - r);
  g.lineTo(x, y + r);
  g.closePath();
  g.fillPath();

  // 外描边
  g.lineStyle(2, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.lineTo(x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.lineTo(x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.lineTo(x, y + h - r);
  g.lineTo(x, y + r);
  g.closePath();
  g.strokePath();

  // 等距内描边只定义边界，不制造凸起方向。
  g.lineStyle(1, inset, 0.85);
  g.beginPath();
  g.moveTo(x + r, y + 2);
  g.lineTo(x + w - r, y + 2);
  g.lineTo(x + w - 2, y + r);
  g.lineTo(x + w - 2, y + h - r);
  g.lineTo(x + w - r, y + h - 2);
  g.lineTo(x + r, y + h - 2);
  g.lineTo(x + 2, y + h - r);
  g.lineTo(x + 2, y + r);
  g.closePath();
  g.strokePath();
}

function traceStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** 带投影、金边和高光的像素五角星。 */
function drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outer: number, inner: number, fill: number): void {
  const active = fill === COLOR_RANK_ON;

  if (active) {
    g.fillStyle(COLOR_HIGHLIGHT, 0.12);
    g.fillCircle(cx, cy, outer + 5);
  }

  // 右下硬阴影，制造目标稿里的厚像素体积。
  g.fillStyle(0x120906, 0.9);
  traceStar(g, cx + 2, cy + 3, outer, inner);
  g.fillPath();

  g.fillStyle(fill, 1);
  g.lineStyle(active ? 2.5 : 2, active ? 0xffb51f : COLOR_OUTLINE, 1);
  traceStar(g, cx, cy, outer, inner);
  g.fillPath();
  g.strokePath();

  if (active) {
    // 左上角小高光，避免纯色星星显得扁平。
    g.fillStyle(0xfff6b2, 0.95);
    g.beginPath();
    g.moveTo(cx - 8, cy - 11);
    g.lineTo(cx - 2, cy - 15);
    g.lineTo(cx - 4, cy - 7);
    g.closePath();
    g.fillPath();
  }
}

/** 绘制栗宝庆祝小头像（圆润栗形 + 嫩芽 + 挥手）。 */
function drawCelebrationLibao(g: Phaser.GameObjects.Graphics, cx: number, cy: number, scale: number): void {
  const colorBody = 0xb5763e;
  const colorSprout = 0x7cc242;
  g.setPosition(cx, cy);
  g.setScale(scale);

  // 身体（上尖下圆的栗子轮廓）
  g.fillStyle(colorBody, 1);
  g.lineStyle(2, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(0, -20);
  g.lineTo(10, -13);
  g.lineTo(15, -2);
  g.lineTo(13, 10);
  g.lineTo(7, 16);
  g.lineTo(-7, 16);
  g.lineTo(-13, 10);
  g.lineTo(-15, -2);
  g.lineTo(-10, -13);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // 头顶嫩芽（像素风两片小叶）
  g.fillStyle(colorSprout, 1);
  g.lineStyle(1, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(0, -20);
  g.lineTo(-7, -25);
  g.lineTo(-2, -21);
  g.lineTo(0, -20);
  g.lineTo(7, -25);
  g.lineTo(2, -21);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // 眼睛（朝上的笑眼，避免旧弧线看起来像皱眉）
  g.lineStyle(2, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(-8, -3);
  g.lineTo(-5, -6);
  g.lineTo(-2, -3);
  g.moveTo(2, -3);
  g.lineTo(5, -6);
  g.lineTo(8, -3);
  g.strokePath();

  // 腮红
  g.fillStyle(0xffa0a0, 0.6);
  g.fillCircle(-9, 2, 2.5);
  g.fillCircle(9, 2, 2.5);

  // 嘴巴
  g.fillStyle(COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(-4, 2);
  g.lineTo(4, 2);
  g.lineTo(2, 7);
  g.lineTo(-2, 7);
  g.closePath();
  g.fillPath();

  // 小手与脚，让角色姿态更接近庆祝动作。
  g.fillStyle(colorBody, 1);
  g.lineStyle(1.5, COLOR_OUTLINE, 1);
  g.fillCircle(-17, 5, 4);
  g.strokeCircle(-17, 5, 4);
  g.fillEllipse(-8, 18, 10, 5);
  g.strokeEllipse(-8, 18, 10, 5);
  g.fillEllipse(8, 18, 10, 5);
  g.strokeEllipse(8, 18, 10, 5);

  // 左手举着小花
  g.fillStyle(0xffd23f, 1);
  g.lineStyle(1, COLOR_OUTLINE, 1);
  g.fillCircle(16, -6, 4);
  g.strokeCircle(16, -6, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, -6, 1.5);

  // 手臂
  g.lineStyle(2, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(11, 0);
  g.lineTo(16, -6);
  g.strokePath();
}

/** 右侧奖励装饰：小花 + 金币堆，与左侧栗宝形成平衡。 */
function drawRewardDecoration(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.setPosition(cx, cy);

  // 叶片与花茎
  g.lineStyle(3, 0x31551f, 1);
  g.beginPath();
  g.moveTo(0, 16);
  g.lineTo(0, -3);
  g.strokePath();
  g.fillStyle(0x7cc242, 1);
  g.fillEllipse(-7, 8, 14, 7);
  g.fillEllipse(7, 5, 14, 7);

  // 六瓣小花
  g.fillStyle(0xffb52e, 1);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    g.fillCircle(Math.cos(a) * 7, -9 + Math.sin(a) * 7, 5);
  }
  g.fillStyle(COLOR_HIGHLIGHT, 1);
  g.lineStyle(1.5, COLOR_OUTLINE, 1);
  g.fillCircle(0, -9, 5);
  g.strokeCircle(0, -9, 5);

  // 金币堆
  const coins = [
    { x: 19, y: 16 },
    { x: 31, y: 16 },
    { x: 25, y: 10 },
  ];
  for (const coin of coins) {
    g.fillStyle(COLOR_HIGHLIGHT, 1);
    g.lineStyle(1.5, 0x8a5a2e, 1);
    g.fillEllipse(coin.x, coin.y, 15, 7);
    g.strokeEllipse(coin.x, coin.y, 15, 7);
  }
}

/** 成绩区的原创矢量图标，避免不同平台 emoji 字形和尺寸不一致。 */
function drawStatIcons(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  // 秒表
  g.lineStyle(2, 0xf4efe6, 1);
  g.strokeCircle(x, y, 7);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - 4);
  g.moveTo(x, y);
  g.lineTo(x + 4, y + 2);
  g.moveTo(x - 3, y - 10);
  g.lineTo(x + 3, y - 10);
  g.strokePath();

  // 金币
  const coinY = y + STAT_ROW_H;
  g.fillStyle(COLOR_HIGHLIGHT, 1);
  g.lineStyle(2, 0x9a641c, 1);
  g.fillCircle(x, coinY, 8);
  g.strokeCircle(x, coinY, 8);
  g.lineStyle(1.5, 0xfff0a0, 1);
  g.strokeCircle(x, coinY, 5);
  g.beginPath();
  g.moveTo(x + 2, coinY - 3);
  g.lineTo(x - 2, coinY - 3);
  g.lineTo(x - 2, coinY + 3);
  g.lineTo(x + 2, coinY + 3);
  g.strokePath();

  // 奖杯
  const trophyY = y + STAT_ROW_H * 2;
  g.fillStyle(COLOR_HIGHLIGHT, 1);
  g.lineStyle(2, 0x9a641c, 1);
  g.fillRect(x - 6, trophyY - 7, 12, 9);
  g.strokeRect(x - 6, trophyY - 7, 12, 9);
  g.beginPath();
  g.moveTo(x - 6, trophyY - 5);
  g.lineTo(x - 10, trophyY - 5);
  g.lineTo(x - 8, trophyY);
  g.lineTo(x - 5, trophyY);
  g.moveTo(x + 6, trophyY - 5);
  g.lineTo(x + 10, trophyY - 5);
  g.lineTo(x + 8, trophyY);
  g.lineTo(x + 5, trophyY);
  g.moveTo(x, trophyY + 2);
  g.lineTo(x, trophyY + 6);
  g.moveTo(x - 5, trophyY + 6);
  g.lineTo(x + 5, trophyY + 6);
  g.strokePath();
}

/** 次按钮图标：重玩圆箭头 + 折叠地图，避免 Unicode 图标在微信端发生字形偏移。 */
function drawSubButtonIcons(
  g: Phaser.GameObjects.Graphics,
  replayX: number,
  mapX: number,
  y: number,
): void {
  g.lineStyle(2, 0xfff1d2, 1);

  // 重玩圆箭头
  g.beginPath();
  g.arc(replayX, y, 7, Math.PI * 0.15, Math.PI * 1.75);
  g.moveTo(replayX - 7, y - 4);
  g.lineTo(replayX - 9, y + 1);
  g.lineTo(replayX - 4, y);
  g.strokePath();

  // 折叠地图
  g.beginPath();
  g.moveTo(mapX - 9, y - 7);
  g.lineTo(mapX - 3, y - 4);
  g.lineTo(mapX + 3, y - 7);
  g.lineTo(mapX + 9, y - 4);
  g.lineTo(mapX + 9, y + 7);
  g.lineTo(mapX + 3, y + 4);
  g.lineTo(mapX - 3, y + 7);
  g.lineTo(mapX - 9, y + 4);
  g.closePath();
  g.moveTo(mapX - 3, y - 4);
  g.lineTo(mapX - 3, y + 7);
  g.moveTo(mapX + 3, y - 7);
  g.lineTo(mapX + 3, y + 4);
  g.strokePath();
}

/** 星级规则文案：告诉玩家差多少达成下一颗星。 */
function rankHint(result: RankResult, totalCoins: number): string {
  if (result.ranks === 3) return '三星达成！完美通关！';
  const coinShort = Math.ceil(totalCoins * RANK_COIN_COLLECT_RATE) - result.collectedCoins;
  const coinNeed = Math.max(0, coinShort);
  const needCoinForStar2 = result.ranks === 1 && coinNeed > 0;
  const needTimeForStar3 = result.ranks === 2 && !result.timeMet;
  const needCoinForStar3 = result.ranks === 2 && !result.coinMet;
  if (needCoinForStar2) return `还差 ${coinNeed} 枚金币即可获得二星`;
  if (needTimeForStar3) return '时间未达标，再快一点可得三星';
  if (needCoinForStar3) return `还差 ${coinNeed} 枚金币即可获得三星`;
  return '继续挑战，冲击满星！';
}

/** 结算页最佳纪录展示：刷新纪录时必须显示本次成绩，而不是旧纪录或 `--`。 */
export function formatBestTime(
  elapsedMs: number,
  previousBestTimeMs?: number,
): { text: string; isNewBest: boolean } {
  const isNewBest =
    previousBestTimeMs === undefined || elapsedMs < previousBestTimeMs;
  const displayMs = isNewBest ? elapsedMs : previousBestTimeMs;
  return { text: (displayMs / 1000).toFixed(1), isNewBest };
}

export class ResultScreen {
  private readonly scene: Phaser.Scene;
  private readonly bus: { emit: (name: string, payload?: unknown) => void };
  private container?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private rankStars: Phaser.GameObjects.Graphics[] = [];
  private confettiGfx?: Phaser.GameObjects.Graphics;
  private avatar?: Phaser.GameObjects.Graphics;
  private built = false;
  private reduceMotion = false;

  private buttons: Array<{
    rect: { x: number; y: number; w: number; h: number };
    action: () => void;
  }> = [];

  private readonly restartAction: () => void;
  private readonly nextAction: () => void;
  private readonly returnTitleAction: () => void;

  constructor(scene: Phaser.Scene, bus: { emit: (name: string, payload?: unknown) => void }) {
    this.scene = scene;
    this.bus = bus;
    this.restartAction = () => this.bus.emit(ON_RESTART);
    this.nextAction = () => this.bus.emit(ON_NEXT_LEVEL);
    this.returnTitleAction = () => this.bus.emit(ON_RETURN_TITLE);
  }

  get isBuilt(): boolean {
    return this.built;
  }

  /**
   * 显示结算面板。
   * @param previousBestTimeMs 本局之前的最优用时（ms）；undefined 表示首次通关。
   */
  show(
    result: RankResult,
    elapsedMs: number,
    collectedCoins: number,
    totalCoins: number,
    hasNext: boolean,
    previousBestTimeMs?: number,
  ): void {
    if (!this.built) this.build();
    const c = this.container!;

    this.reduceMotion = (this.scene as unknown as { reduceMotion?: boolean }).reduceMotion ?? false;

    // 标题
    const title = c.getByName('title') as Phaser.GameObjects.Text | null;
    if (title) {
      title.setText('通关成功！');
      title.setScale(0.9);
      this.scene.tweens.add({ targets: title, scale: 1, duration: 280, ease: 'Back.Out', delay: 60 });
    }

    // 三颗星各自绘制、各自动画，避免空图层导致“看似逐颗、实际整组一起出现”。
    for (let i = 0; i < this.rankStars.length; i++) {
      const star = this.rankStars[i];
      const on = i < result.ranks;
      star.clear();
      drawStar(star, 0, 0, RANK_OUTER_R, RANK_INNER_R, on ? COLOR_RANK_ON : COLOR_RANK_OFF);
      this.scene.tweens.killTweensOf(star);
      if (this.reduceMotion) {
        star.setScale(1).setAlpha(1);
      } else {
        star.setScale(0.15).setAlpha(0.35);
        this.scene.tweens.add({
          targets: star,
          scale: 1,
          alpha: 1,
          duration: 280,
          ease: 'Back.Out',
          delay: 120 + i * 100,
        });
      }
    }

    // 星级提示
    const hint = c.getByName('rankHint') as Phaser.GameObjects.Text | null;
    if (hint) {
      hint.setText(rankHint(result, totalCoins));
      hint.setColor(result.ranks === 3 ? COLOR_TEXT_ACCENT : result.ranks === 1 ? COLOR_TEXT_DANGER : COLOR_TEXT_MUTED);
    }

    // 成绩区
    const timeStr = (elapsedMs / 1000).toFixed(1);
    const best = formatBestTime(elapsedMs, previousBestTimeMs);

    const statTimeVal = c.getByName('statTimeVal') as Phaser.GameObjects.Text | null;
    const statCoinVal = c.getByName('statCoinVal') as Phaser.GameObjects.Text | null;
    const statBestVal = c.getByName('statBestVal') as Phaser.GameObjects.Text | null;
    const newBadge = c.getByName('newBadge') as Phaser.GameObjects.Text | null;
    if (statTimeVal) statTimeVal.setText(`${timeStr}秒`);
    if (statCoinVal) statCoinVal.setText(`${collectedCoins} / ${totalCoins}`);
    if (statBestVal) {
      statBestVal.setText(`${best.text}秒`);
      statBestVal.setX(best.isNewBest ? PANEL_W / 2 - 90 : PANEL_W / 2 - 55);
    }
    if (newBadge) newBadge.setVisible(best.isNewBest);

    // 按钮文案
    const nextBtnText = c.getByName('nextBtnText') as Phaser.GameObjects.Text | null;
    if (nextBtnText) nextBtnText.setText(hasNext ? '下一关  →' : '返回标题');

    // 按钮命中盒需要随 hasNext 变化：末关时「下一关」按钮实际也返回标题，保留命中。
    this.buttons = [];
    this.buttons.push({
      rect: { x: CENTER_X - MAIN_BTN_W / 2, y: CENTER_Y + MAIN_BTN_Y - MAIN_BTN_H / 2, w: MAIN_BTN_W, h: MAIN_BTN_H },
      action: hasNext ? this.nextAction : this.returnTitleAction,
    });
    const subPositions = computeSubButtonPositions();
    this.buttons.push({
      rect: {
        x: CENTER_X + subPositions.leftX,
        y: CENTER_Y + SUB_BTN_Y - SUB_BTN_H / 2,
        w: SUB_BTN_W,
        h: SUB_BTN_H,
      },
      action: this.restartAction,
    });
    this.buttons.push({
      rect: {
        x: CENTER_X + subPositions.rightX,
        y: CENTER_Y + SUB_BTN_Y - SUB_BTN_H / 2,
        w: SUB_BTN_W,
        h: SUB_BTN_H,
      },
      action: this.returnTitleAction,
    });

    // 彩带庆祝
    this.spawnConfetti();

    // 显示全屏遮罩
    this.overlay?.setVisible(true);

    // 面板弹入
    c.setVisible(true);
    c.setScale(0.9);
    c.setAlpha(0);
    this.scene.tweens.killTweensOf(c);
    this.scene.tweens.add({
      targets: c,
      scale: 1,
      alpha: 1,
      duration: 240,
      ease: 'Back.Out',
    });
  }

  hide(): void {
    this.container?.setVisible(false);
    this.overlay?.setVisible(false);
    this.stopConfetti();
  }

  destroy(): void {
    this.container?.destroy();
    this.container = undefined;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.rankStars = [];
    this.confettiGfx = undefined;
    this.avatar = undefined;
    this.built = false;
    this.buttons = [];
    this.stopConfetti();
  }

  handleTap(x: number, y: number): void {
    if (!this.container || !this.container.visible) return;
    for (const b of this.buttons) {
      if (pointInRect(x, y, b.rect)) {
        b.action();
        return;
      }
    }
  }

  // ── 构建（仅一次）──
  private build(): void {
    const c = this.scene.add.container(CENTER_X, CENTER_Y).setScrollFactor(0).setDepth(2500);

    // 全屏遮罩
    const overlay = this.scene.add
      .rectangle(LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, COLOR_OVERLAY_BG, OVERLAY_ALPHA)
      .setScrollFactor(0)
      .setDepth(2499);
    overlay.setName('overlay');

    // 面板阴影（在面板后下方，制造悬浮感）
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.55);
    shadow.fillRoundedRect(-PANEL_W / 2 + 5, -PANEL_H / 2 + 7, PANEL_W, PANEL_H, 8);

    // 面板主体
    const g = this.scene.add.graphics();
    drawPixelPanel(g, -PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, COLOR_PANEL, COLOR_PANEL_TOP);

    // 金色内框与顶部高光，呼应目标稿的厚重像素卡片。
    g.lineStyle(3, 0x8f561f, 1);
    g.strokeRoundedRect(-PANEL_W / 2 + 3, -PANEL_H / 2 + 3, PANEL_W - 6, PANEL_H - 6, 7);
    g.lineStyle(1.5, 0xe6a43b, 1);
    g.strokeRoundedRect(-PANEL_W / 2 + 6, -PANEL_H / 2 + 6, PANEL_W - 12, PANEL_H - 12, 5);
    g.lineStyle(2, 0xffca5c, 0.95);
    g.beginPath();
    g.moveTo(-PANEL_W / 2 + 14, -PANEL_H / 2 + 5);
    g.lineTo(PANEL_W / 2 - 14, -PANEL_H / 2 + 5);
    g.strokePath();

    // 标题
    const title = this.scene.add
      .text(0, -112, '通关成功！', {
        fontFamily: TEXT_FONT,
        fontSize: '30px',
        fontStyle: 'bold',
        color: COLOR_TITLE,
        stroke: '#2A1A12',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    title.setShadow(2, 3, '#120906', 2, true, true);
    title.setName('title');

    // 栗宝庆祝头像
    const avatar = this.scene.add.graphics();
    drawCelebrationLibao(avatar, AVATAR_X, AVATAR_Y, 1.3);
    this.avatar = avatar;

    // 右侧奖励装饰
    const rewardDecoration = this.scene.add.graphics();
    drawRewardDecoration(rewardDecoration, PANEL_W / 2 - 56, RANK_ROW_Y - 1);

    // 三颗独立五角星，show() 时按评级填色并逐颗播放动画。
    const starContainer = this.scene.add.container(0, 0);
    starContainer.setName('starContainer');
    for (let i = 0; i < 3; i++) {
      const sg = this.scene.add.graphics();
      sg.setName(`star${i}`);
      sg.setPosition((i - 1) * RANK_GAP, RANK_ROW_Y);
      starContainer.add(sg);
      this.rankStars.push(sg);
    }

    // 星级提示
    const rankHintText = this.scene.add
      .text(0, -27, '', {
        fontFamily: TEXT_FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: COLOR_TEXT_MUTED,
      })
      .setOrigin(0.5);
    rankHintText.setName('rankHint');

    // 成绩区背景条
    const statsBg = this.scene.add.graphics();
    drawPixelPanel(statsBg, -PANEL_W / 2 + 42, STATS_Y - 13, PANEL_W - 84, 69, 0x24130c);
    statsBg.lineStyle(1, 0x6d4428, 0.7);
    statsBg.beginPath();
    statsBg.moveTo(-PANEL_W / 2 + 54, STATS_Y + 9);
    statsBg.lineTo(PANEL_W / 2 - 54, STATS_Y + 9);
    statsBg.moveTo(-PANEL_W / 2 + 54, STATS_Y + 31);
    statsBg.lineTo(PANEL_W / 2 - 54, STATS_Y + 31);
    statsBg.strokePath();

    const statIcons = this.scene.add.graphics();
    drawStatIcons(statIcons, -PANEL_W / 2 + 59, STATS_Y);

    // 成绩行
    const makeStatRow = (idx: number, label: string, nameVal: string) => {
      const y = STATS_Y + idx * STAT_ROW_H;
      const lab = this.scene.add.text(-PANEL_W / 2 + 78, y, label, {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: COLOR_TEXT_MUTED,
      }).setOrigin(0, 0.5);
      const val = this.scene.add.text(PANEL_W / 2 - 55, y, '', {
        fontFamily: TEXT_FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: COLOR_TEXT_MAIN,
        stroke: '#2A1A12',
        strokeThickness: 2,
      }).setOrigin(1, 0.5);
      val.setName(nameVal);
      return [lab, val];
    };
    const [tLab, tVal] = makeStatRow(0, '用时', 'statTimeVal');
    const [cLab, cVal] = makeStatRow(1, '金币', 'statCoinVal');
    const [bLab, bVal] = makeStatRow(2, '最佳', 'statBestVal');

    // NEW 标签
    const newBadge = this.scene.add
      .text(PANEL_W / 2 - 45, STATS_Y + 2 * STAT_ROW_H, 'NEW!', {
        fontFamily: TEXT_FONT,
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#2A1A12',
        backgroundColor: '#FFD23F',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(1, 0.5);
    newBadge.setName('newBadge');
    newBadge.setVisible(false);

    // 主按钮「下一关 →」
    const mainBtnG = this.scene.add.graphics();
    drawPixelButton(mainBtnG, -MAIN_BTN_W / 2, MAIN_BTN_Y - MAIN_BTN_H / 2, MAIN_BTN_W, MAIN_BTN_H, COLOR_BTN_MAIN, COLOR_BTN_MAIN_HIGH);
    const mainBtnHit = this.scene.add
      .rectangle(0, MAIN_BTN_Y, MAIN_BTN_W, MAIN_BTN_H, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    mainBtnHit.on('pointerdown', this.nextAction);
    mainBtnHit.setName('mainBtnHit');
    const nextBtnText = this.scene.add
      .text(0, MAIN_BTN_Y - 1, '下一关  →', {
        fontFamily: TEXT_FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#FFF7DC',
        stroke: '#2A1A12',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    nextBtnText.setName('nextBtnText');

    // 次按钮「再玩一次」「关卡选择」
    const subBtnG = this.scene.add.graphics();
    const {
      leftX: leftBtnX,
      rightX: rightBtnX,
      leftCenterX,
      rightCenterX,
    } = computeSubButtonPositions();
    drawPixelButton(subBtnG, leftBtnX, SUB_BTN_Y - SUB_BTN_H / 2, SUB_BTN_W, SUB_BTN_H, COLOR_BTN_SECONDARY, COLOR_BTN_SECONDARY_HIGH);
    drawPixelButton(subBtnG, rightBtnX, SUB_BTN_Y - SUB_BTN_H / 2, SUB_BTN_W, SUB_BTN_H, 0x9c783f, 0xc19a55);
    const subIconG = this.scene.add.graphics();
    drawSubButtonIcons(subIconG, leftCenterX - 43, rightCenterX - 43, SUB_BTN_Y);

    const replayHit = this.scene.add
      .rectangle(leftCenterX, SUB_BTN_Y, SUB_BTN_W, SUB_BTN_H, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    replayHit.on('pointerdown', this.restartAction);
    const replayText = this.scene.add
      .text(leftCenterX + 9, SUB_BTN_Y - 1, '再玩一次', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#F4EFE6',
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const titleHit = this.scene.add
      .rectangle(rightCenterX, SUB_BTN_Y, SUB_BTN_W, SUB_BTN_H, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    titleHit.on('pointerdown', this.returnTitleAction);
    const titleBtnText = this.scene.add
      .text(rightCenterX + 9, SUB_BTN_Y - 1, '关卡选择', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#F4EFE6',
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    c.add([
      shadow,
      g,
      title,
      avatar,
      rewardDecoration,
      starContainer,
      rankHintText,
      statsBg,
      statIcons,
      tLab,
      tVal,
      cLab,
      cVal,
      bLab,
      bVal,
      newBadge,
      mainBtnG,
      mainBtnHit,
      nextBtnText,
      subBtnG,
      subIconG,
      replayHit,
      replayText,
      titleHit,
      titleBtnText,
    ]);

    this.overlay = overlay;
    c.setVisible(false);
    this.container = c;
    this.built = true;
  }

  // ── 彩带粒子（简化版：彩色小方块沿抛物线飘落）──
  private confettiPieces: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
    size: number;
    rot: number;
    rotVel: number;
  }> = [];
  private confettiUpdate?: () => void;

  private spawnConfetti(): void {
    if (this.reduceMotion) return;
    this.stopConfetti();
    const colors = [0xffd23f, 0x7cc242, 0xff8a7a, 0x5bc8f5, 0xffffff];
    const cx = CENTER_X;
    const cy = CENTER_Y - PANEL_H / 2 + 30;
    for (let i = 0; i < 32; i++) {
      this.confettiPieces.push({
        x: cx + (Math.random() - 0.5) * PANEL_W * 0.9,
        y: cy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 2.5 - 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI,
        rotVel: (Math.random() - 0.5) * 0.3,
      });
    }
    if (!this.confettiGfx) {
      this.confettiGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(2501);
    }
    this.confettiUpdate = () => this.updateConfetti();
    this.scene.events.on('update', this.confettiUpdate);
  }

  private updateConfetti(): void {
    if (!this.confettiGfx) return;
    this.confettiGfx.clear();
    for (const p of this.confettiPieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // 重力
      p.rot += p.rotVel;
      if (p.y > LOGICAL_H + 10) {
        p.y = -10;
        p.vy = -Math.random() * 2 - 0.5;
      }
      // 计算旋转后的四个角（避免依赖 translateCanvas/rotateCanvas 渲染器差异）
      const c = Math.cos(p.rot);
      const s = Math.sin(p.rot);
      const hx = (p.size / 2) * c;
      const hy = (p.size / 2) * s;
      const vx = (-p.size / 2) * s;
      const vy = (p.size / 2) * c;
      this.confettiGfx.fillStyle(p.color, 0.85);
      this.confettiGfx.beginPath();
      this.confettiGfx.moveTo(p.x + hx + vx, p.y + hy + vy);
      this.confettiGfx.lineTo(p.x - hx + vx, p.y - hy + vy);
      this.confettiGfx.lineTo(p.x - hx - vx, p.y - hy - vy);
      this.confettiGfx.lineTo(p.x + hx - vx, p.y + hy - vy);
      this.confettiGfx.closePath();
      this.confettiGfx.fillPath();
    }
  }

  private stopConfetti(): void {
    if (this.confettiUpdate) {
      this.scene.events.off('update', this.confettiUpdate);
      this.confettiUpdate = undefined;
    }
    this.confettiPieces = [];
    this.confettiGfx?.clear();
  }
}
