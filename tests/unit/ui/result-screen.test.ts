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
  computeRanks,
  evaluateRanks,
  RANK_COIN_COLLECT_RATE,
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
