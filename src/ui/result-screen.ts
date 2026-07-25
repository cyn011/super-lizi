/**
 * ui/result-screen — 通关结算 + 评级菱形星（GDD 08 §3 / S05-2）。
 *
 * 本文件两层：
 *   1) 纯函数 `evaluateRanks` / `computeRanks`（零 Phaser / 零平台 API，可被 Node 单测，
 *      tests/unit/ui/result-screen.test.ts）。评级映射为 S05-2 拍板：
 *        时间维度（elapsedMs ≤ parTimeMs 得时间评级）+ 金币收集率（≥50% 得金币评级）
 *        → 双达标=3 评级、单达标=2 评级、完成但未达标=1 评级（失败不进结算，走 GameOver）。
 *   2) `ResultScreen` Phaser 视图：遮罩 + 评级菱形星 + 用时/金币 + 「再玩一次」大圆角按钮
 *      + 最小凯旋动画（面板 scale/alpha 弹入）。矢量 + 系统字体（ADR-004），禁位图字体；
 *      中文 ≥14px；按钮热区 ≥48×48（control-list §4）。
 *
 * 评级星以**矢量菱形星**绘制（Graphics 路径：旋转 45° 的菱形轮廓 + 填充），
 * 对齐 art-bible §7.2「原创菱形星（非五角星）」，替代原系统字体五角星 `★`(U+2605)。
 *
 * 关键约束：本文件对 Phaser 仅用 `import type`（编译期类型，运行时被擦除），
 * 故 Node 单测 import 本文件不会拉起 Phaser / canvas。运行期 Phaser 调用全部走
 * 注入的 `scene` 实例方法（scene.add.* / scene.tweens.*），不引用任何 Phaser.* 运行时值。
 *
 * 钩子：暴露 `handleTap(x,y)`（逻辑坐标）供 S05-5 微信深适配把原生触摸映射到按钮；
 * Web 端直接用 Phaser interactive 按钮，无需此钩子。
 */
import type Phaser from 'phaser';
import { ON_RESTART, ON_NEXT_LEVEL } from '../core/events/event-bus';
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

// 颜色（美术圣经 §3 / placeholder-spec，禁止硬编语义外色）
const COLOR_OVERLAY_BG = 0x000000;
const OVERLAY_ALPHA = 0.78; // 加深遮罩，让结算面板从关卡背景中跳出来
const COLOR_PANEL = 0x35251b; // 深棕面板（比原 0x4a3a2f 更深，与各种 biome 背景拉开对比）
const COLOR_OUTLINE = 0x2a1a12; // 近黑棕描边
const COLOR_HIGHLIGHT = 0xf2c94c; // 经济金：顶部横幅线/标题强调
const COLOR_TITLE = '#FFD23F'; // 暖黄标题字，高对比
const COLOR_RANK_ON = 0xf2c94c; // 经济金（评级达标，矢量菱形星填充）
const COLOR_RANK_OFF = 0x6a5a3f; // 暗化（评级未达，矢量菱形星填充）
const COLOR_BTN = 0xb5763e; // 栗色按钮
const COLOR_NEXT_BTN = 0x6fae4a; // 下一关按钮（S06 进度链，绿色强调）
const TEXT_FONT = 'sans-serif'; // 运行时系统字体（ADR-004：禁位图字体）

// 面板尺寸（S06：加高以容纳「下一关」+「再玩一次」两个按钮）
const PANEL_W = 280;
const PANEL_H = 232;
// 按钮（热区 ≥48×48：160×52）
const BTN_W = 160;
const BTN_H = 52;
// 「下一关」按钮局部 Y（位于「再玩一次」上方）
const NEXT_BTN_Y = PANEL_H / 2 - 86;
// 「再玩一次」按钮局部 Y（面板底部上方）
const REPLAY_BTN_Y = PANEL_H / 2 - 30;

// 评级菱形星（矢量，art-bible §7.2 原创菱形星，非五角星）
const RANK_ROW_Y = -PANEL_H / 2 + 56; // 评级行局部 Y
const RANK_GAP = 34; // 三个评级横向间距
const RANK_R = 13; // 菱形半对角线（≈26px 高，对齐原 26px 五角星）

/**
 * 绘制一个矢量菱形星（旋转 45° 的正方形轮廓 + 填充），中心 (cx,cy)，半对角线 r。
 * 颜色按 on/off 取 COLOR_RANK_ON / COLOR_RANK_OFF；描边统一 COLOR_OUTLINE。
 * 纯矢量路径，无 unicode 字符、无位图（满足 art-bible §7.2 + ADR-004）。
 */
function drawRank(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, on: boolean): void {
  const fill = on ? COLOR_RANK_ON : COLOR_RANK_OFF;
  g.fillStyle(fill, 1);
  g.lineStyle(2, COLOR_OUTLINE, 1);
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r, cy);
  g.lineTo(cx, cy + r);
  g.lineTo(cx - r, cy);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

export class ResultScreen {
  private readonly scene: Phaser.Scene;
  private readonly bus: { emit: (name: string, payload?: unknown) => void };
  private container?: Phaser.GameObjects.Container;
  private rankGfx?: Phaser.GameObjects.Graphics; // 评级菱形星（单个 Graphics 绘制全部三个）
  private built = false;

  /** 「再玩一次」按钮的逻辑坐标命中盒（供 S05-5 handleTap 钩子；scale 弹入后约为 1，近似足够）。 */
  private buttonRect?: { x: number; y: number; w: number; h: number };
  /** 「下一关」按钮的逻辑坐标命中盒（S06；hasNext 时才有）。 */
  private nextButtonRect?: { x: number; y: number; w: number; h: number };
  /** 「下一关」按钮对象（矩形 + 文本），用于按 hasNext 切换可见性。 */
  private nextButtonObjs?: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text>;
  /** 当前是否显示「下一关」按钮（show 时按 hasNext 设置，handleTap 据此判定）。 */
  private nextButtonVisible = false;
  private readonly restartAction: () => void;
  private readonly nextAction: () => void;

  constructor(scene: Phaser.Scene, bus: { emit: (name: string, payload?: unknown) => void }) {
    this.scene = scene;
    this.bus = bus;
    this.restartAction = () => this.bus.emit(ON_RESTART);
    this.nextAction = () => this.bus.emit(ON_NEXT_LEVEL);
  }

  /** 结算面板是否已构建。 */
  get isBuilt(): boolean {
    return this.built;
  }

  /**
   * 显示结算：遮罩 + 评级菱形星 + 用时/金币 + 「再玩一次」。
   * 幂等：已构建则更新内容并重新弹入，不重复建对象。
   */
  show(result: RankResult, elapsedMs: number, collectedCoins: number, totalCoins: number, hasNext: boolean): void {
    if (!this.built) this.build();
    const c = this.container!;

    // 评级菱形星（filled 数 = result.ranks）；矢量重绘，与服务端无关
    if (this.rankGfx) {
      this.rankGfx.clear();
      for (let i = 0; i < 3; i++) {
        drawRank(this.rankGfx, (i - 1) * RANK_GAP, RANK_ROW_Y, RANK_R, i < result.ranks);
      }
    }
    // 信息行：清晰前缀，避免被错误覆盖成金币统计
    const info1 = c.getByName('info1') as Phaser.GameObjects.Text | null;
    const info2 = c.getByName('info2') as Phaser.GameObjects.Text | null;
    if (info1) info1.setText(`用时 ${(elapsedMs / 1000).toFixed(1)} 秒`);
    if (info2) info2.setText(`金币 ${collectedCoins} / ${totalCoins}`);

    // S06：「下一关」按钮始终显示；末关时文案改为「返回标题」。
    this.nextButtonVisible = true;
    const nextBtnText = c.getByName('nextBtnText') as Phaser.GameObjects.Text | null;
    if (nextBtnText) nextBtnText.setText(hasNext ? '下一关' : '返回标题');
    if (this.nextButtonObjs) {
      for (const o of this.nextButtonObjs) o.setVisible(true);
    }

    // 最小凯旋动画：panel 弹入（scale + alpha）
    c.setVisible(true);
    c.setScale(0.92);
    c.setAlpha(0);
    this.scene.tweens.killTweensOf(c);
    this.scene.tweens.add({
      targets: c,
      scale: 1.0,
      alpha: 1.0,
      duration: 220,
      ease: 'Back.Out',
    });
  }

  /** 隐藏结算面板（重试用）。 */
  hide(): void {
    this.container?.setVisible(false);
  }

  /** 销毁（场景 shutdown）。 */
  destroy(): void {
    this.container?.destroy();
    this.container = undefined;
    this.rankGfx = undefined;
    this.built = false;
    this.buttonRect = undefined;
    this.nextButtonRect = undefined;
    this.nextButtonObjs = undefined;
    this.nextButtonVisible = false;
  }

  /**
   * S05-5 钩子：微信原生触摸（逻辑坐标 x,y）→ 命中「再玩一次」则触发重玩。
   * Web 端由 Phaser interactive 按钮处理，不会走到这里；本方法保留供深适配调用。
   */
  handleTap(x: number, y: number): void {
    const r = this.buttonRect;
    if (!this.container || !this.container.visible) return;
    // S06：优先判「下一关」按钮（仅当其可见时）。
    if (this.nextButtonVisible && this.nextButtonRect && pointInRect(x, y, this.nextButtonRect)) {
      this.nextAction();
      return;
    }
    if (r && pointInRect(x, y, r)) {
      this.restartAction();
    }
  }

  // ── 构建（仅一次）──
  private build(): void {
    const c = this.scene.add.container(CENTER_X, CENTER_Y).setScrollFactor(0).setDepth(2500);

    // 全屏遮罩（不随相机滚动）
    const overlay = this.scene.add
      .rectangle(LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, COLOR_OVERLAY_BG, OVERLAY_ALPHA)
      .setScrollFactor(0)
      .setDepth(2499);
    overlay.setName('overlay');

    // 面板（以容器中心 0,0 为原点，局部坐标）
    const g = this.scene.add.graphics();
    g.fillStyle(COLOR_PANEL, 1);
    g.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    g.lineStyle(2, COLOR_OUTLINE, 1);
    g.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);

    // 顶部经济金横幅线（强化"通关"视觉层次）
    g.lineStyle(3, COLOR_HIGHLIGHT, 1);
    g.beginPath();
    g.moveTo(-PANEL_W / 2 + 16, -PANEL_H / 2 + 44);
    g.lineTo(PANEL_W / 2 - 16, -PANEL_H / 2 + 44);
    g.strokePath();

    // 标题：大字号暖黄 + 深描边，让通关提示一眼可见
    const title = this.scene.add
      .text(0, -PANEL_H / 2 + 22, '通关！', {
        fontFamily: TEXT_FONT,
        fontSize: '28px',
        fontStyle: 'bold',
        color: COLOR_TITLE,
        stroke: '#2A1A12',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    title.setName('title');

    // 评级菱形星（矢量，横排三个，居中；初始全 off，show() 按 result.ranks 重绘）
    const rankG = this.scene.add.graphics();
    rankG.setName('rankGlyphs');
    for (let i = 0; i < 3; i++) {
      drawRank(rankG, (i - 1) * RANK_GAP, RANK_ROW_Y, RANK_R, false);
    }
    this.rankGfx = rankG;

    // 信息行：带清晰前缀，避免与标题/按钮混淆
    const info1 = this.scene.add
      .text(0, -PANEL_H / 2 + 90, '', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        color: '#F4EFE6',
      })
      .setOrigin(0.5);
    info1.setName('info1');
    const info2 = this.scene.add
      .text(0, -PANEL_H / 2 + 112, '', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        color: '#F4EFE6',
      })
      .setOrigin(0.5);
    info2.setName('info2');

    // 「下一关/返回标题」大圆角按钮（S06：位于「再玩一次」上方；始终显示，末关变文案）
    const nextBtn = this.scene.add
      .rectangle(0, NEXT_BTN_Y, BTN_W, BTN_H, COLOR_NEXT_BTN, 0.9)
      .setStrokeStyle(2, COLOR_OUTLINE, 1);
    nextBtn.setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', this.nextAction);
    const nextBtnText = this.scene.add
      .text(0, NEXT_BTN_Y, '下一关', {
        fontFamily: TEXT_FONT,
        fontSize: '16px', // ≥14px
        color: '#F4EFE6',
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    nextBtnText.setName('nextBtnText');
    nextBtn.setVisible(false);
    nextBtnText.setVisible(false);

    // 「再玩一次」大圆角按钮（热区 160×52 ≥48×48）
    const btn = this.scene.add
      .rectangle(0, REPLAY_BTN_Y, BTN_W, BTN_H, COLOR_BTN, 0.9)
      .setStrokeStyle(2, COLOR_OUTLINE, 1);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', this.restartAction);
    const btnText = this.scene.add
      .text(0, REPLAY_BTN_Y, '再玩一次', {
        fontFamily: TEXT_FONT,
        fontSize: '16px', // ≥14px
        color: '#F4EFE6',
        stroke: '#2A1A12',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    c.add([g, title, rankG, info1, info2, nextBtn, nextBtnText, btn, btnText]);
    // 遮罩不入容器（覆盖全屏，独立 depth），但随容器显隐同步
    c.add(overlay);
    overlay.setDepth(2499);

    // 记录按钮逻辑坐标命中盒（容器中心 + 局部偏移，忽略弹入 scale 近似）
    this.buttonRect = {
      x: CENTER_X - BTN_W / 2,
      y: CENTER_Y + REPLAY_BTN_Y - BTN_H / 2,
      w: BTN_W,
      h: BTN_H,
    };
    this.nextButtonRect = {
      x: CENTER_X - BTN_W / 2,
      y: CENTER_Y + NEXT_BTN_Y - BTN_H / 2,
      w: BTN_W,
      h: BTN_H,
    };
    this.nextButtonObjs = [nextBtn, nextBtnText];

    c.setVisible(false);
    this.container = c;
    this.built = true;
  }
}
