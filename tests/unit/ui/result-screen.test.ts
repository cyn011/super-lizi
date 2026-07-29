/**
 * tests/unit/ui/result-screen.test.ts — 结算评级纯函数（S05-2，零 Phaser 可单测）。
 *
 * 仅验证「数值 → 评级」映射（来自 result-screen.ts 的纯函数 evaluateRanks / computeRanks）。
 * 渲染侧（遮罩/评级菱形星/按钮矢量 + 系统字体）由真机/模拟器人眼回归验证。
 *
 * 评级映射（S05-2 拍板）：
 *   时间维度（elapsedMs ≤ parTimeMs 得时间评级）+ 金币收集率（≥50% 得金币评级）
 *   → 双达标=3 评级、单达标=2 评级、完成但未达标=1 评级；失败不进结算（走 GameOver）。
 */
import { describe, it, expect } from 'vitest';
import {
  computeSubButtonPositions,
  computeRanks,
  evaluateRanks,
  formatBestTime,
  RANK_COIN_COLLECT_RATE,
  RESULT_LAYOUT,
} from '../../../src/ui/result-screen';

const PAR = 60000; // 目标 60s

describe('结算评级计算（S05-2，纯函数零 Phaser）', () => {
  it('RANK_COIN_COLLECT_RATE = 0.5（金币收集率阈值）', () => {
    expect(RANK_COIN_COLLECT_RATE).toBe(0.5);
  });

  it('双达标（时间≤par 且 金币≥50%）→ 3 评级', () => {
    expect(computeRanks({ elapsedMs: 50000, parTimeMs: PAR, collectedCoins: 12, totalCoins: 12 })).toBe(3);
    const r = evaluateRanks({ elapsedMs: 50000, parTimeMs: PAR, collectedCoins: 12, totalCoins: 12 });
    expect(r.ranks).toBe(3);
    expect(r.timeMet).toBe(true);
    expect(r.coinMet).toBe(true);
  });

  it('单达标（仅时间达标）→ 2 评级', () => {
    expect(computeRanks({ elapsedMs: 40000, parTimeMs: PAR, collectedCoins: 2, totalCoins: 12 })).toBe(2);
    const r = evaluateRanks({ elapsedMs: 40000, parTimeMs: PAR, collectedCoins: 2, totalCoins: 12 });
    expect(r.timeMet).toBe(true);
    expect(r.coinMet).toBe(false);
  });

  it('单达标（仅金币达标）→ 2 评级', () => {
    expect(computeRanks({ elapsedMs: 90000, parTimeMs: PAR, collectedCoins: 12, totalCoins: 12 })).toBe(2);
  });

  it('完成但未达标（超时且币不足）→ 1 评级', () => {
    expect(computeRanks({ elapsedMs: 90000, parTimeMs: PAR, collectedCoins: 1, totalCoins: 12 })).toBe(1);
    const r = evaluateRanks({ elapsedMs: 90000, parTimeMs: PAR, collectedCoins: 1, totalCoins: 12 });
    expect(r.timeMet).toBe(false);
    expect(r.coinMet).toBe(false);
  });

  it('零金币关卡：coinRate=1 → 金币评级自动达成（避免无币关拿不到评级）', () => {
    const r = evaluateRanks({ elapsedMs: 50000, parTimeMs: PAR, collectedCoins: 0, totalCoins: 0 });
    expect(r.coinMet).toBe(true);
    expect(r.coinRate).toBe(1);
    expect(r.ranks).toBe(3);
  });

  it('恰好 50% 收集率 → 金币评级达成（≥阈值，含边界）', () => {
    const r = evaluateRanks({ elapsedMs: 70000, parTimeMs: PAR, collectedCoins: 6, totalCoins: 12 });
    expect(r.coinRate).toBeCloseTo(0.5, 5);
    expect(r.coinMet).toBe(true);
    expect(r.timeMet).toBe(false);
    expect(r.ranks).toBe(2);
  });

  it('parTime=0 视为未定 → 时间评级不达成（且不除零崩溃）', () => {
    const r = evaluateRanks({ elapsedMs: 1000, parTimeMs: 0, collectedCoins: 12, totalCoins: 12 });
    expect(r.timeMet).toBe(false);
    expect(r.ranks).toBe(2);
  });

  it('evaluateRanks 返回 timeMet/coinMet/coinRate 供 UI 展示（如 2 评级 提“时间达标·金币未达”）', () => {
    const r = evaluateRanks({ elapsedMs: 30000, parTimeMs: PAR, collectedCoins: 8, totalCoins: 10 });
    expect(r.timeMet).toBe(true);
    expect(r.coinMet).toBe(true);
    expect(r.coinRate).toBeCloseTo(0.8, 5);
    expect(r.ranks).toBe(3);
  });
});

describe('通关结算布局合同', () => {
  it('面板保持近方形奖章卡比例，并为横屏安全区留出左右空间', () => {
    const widthRatio = RESULT_LAYOUT.panelWidth / RESULT_LAYOUT.logicalWidth;
    const panelAspect = RESULT_LAYOUT.panelWidth / RESULT_LAYOUT.panelHeight;

    expect(widthRatio).toBeGreaterThanOrEqual(0.65);
    expect(widthRatio).toBeLessThanOrEqual(0.75);
    expect(panelAspect).toBeLessThanOrEqual(1.3);
  });

  it('主按钮与底部双按钮互不重叠，且全部收在面板内', () => {
    const panelBottom = RESULT_LAYOUT.panelHeight / 2;
    const mainBottom =
      RESULT_LAYOUT.mainButton.y + RESULT_LAYOUT.mainButton.height / 2;
    const subTop =
      RESULT_LAYOUT.subButton.y - RESULT_LAYOUT.subButton.height / 2;
    const subBottom =
      RESULT_LAYOUT.subButton.y + RESULT_LAYOUT.subButton.height / 2;

    expect(mainBottom).toBeLessThan(subTop);
    expect(subBottom).toBeLessThanOrEqual(panelBottom);
  });

  it('两个次按钮加间距不超过主按钮宽度', () => {
    const subRowWidth =
      RESULT_LAYOUT.subButton.width * 2 + RESULT_LAYOUT.subButton.gap;
    expect(subRowWidth).toBeLessThanOrEqual(RESULT_LAYOUT.mainButton.width);
  });

  it('次按钮绘制起点与交互中心共享同一套坐标', () => {
    const p = computeSubButtonPositions();
    const halfWidth = RESULT_LAYOUT.subButton.width / 2;

    expect(p.leftCenterX).toBe(p.leftX + halfWidth);
    expect(p.rightCenterX).toBe(p.rightX + halfWidth);
    expect(p.rightX - (p.leftX + RESULT_LAYOUT.subButton.width))
      .toBe(RESULT_LAYOUT.subButton.gap);
  });
});

describe('最佳纪录展示', () => {
  it('首次通关显示本次成绩并标记 NEW，而不是显示 --', () => {
    expect(formatBestTime(35_200)).toEqual({
      text: '35.2',
      isNewBest: true,
    });
  });

  it('刷新纪录显示本次新纪录，未刷新时保留历史最佳', () => {
    expect(formatBestTime(35_200, 40_000)).toEqual({
      text: '35.2',
      isNewBest: true,
    });
    expect(formatBestTime(42_000, 35_200)).toEqual({
      text: '35.2',
      isNewBest: false,
    });
  });
});
