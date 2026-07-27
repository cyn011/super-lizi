/**
 * tests/unit/quicksand/quicksand.test.ts — 流沙下陷纯函数单测（GDD 1-4 §4）。
 *
 * 镜像 tests/unit/tide/tide.test.ts 结构，验证：
 *   - quicksandZoneAt：按 x 区间命中（含端点），区外/区间隙返回 null，zones=undefined 安全 null。
 *   - isQuicksandSinking：脚底在 [xStart,xEnd] 且接地(y≥surfaceY) 即 true；空中(!grounded)/越界 即 false。
 *   - quicksandSinkRate：telegraphMs 内由 0 线性渐变到 sinkRate，telegraphMs=0 即满速。
 *   - quicksandBottomedOut：累计下陷深度 ≥ (deathY-surfaceY) 即触底。
 *   - quicksandVisualOffset：钳到 [0, deathY-surfaceY]（不改碰撞盒，仅 sprite 下沉）。
 *   - quicksandEscapeWindow：= (deathY-surfaceY)/sinkRate（站定到触底的时间）。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import type { QuicksandDef } from '../../../src/core/level/level-data';
import {
  quicksandZoneAt,
  isQuicksandSinking,
  quicksandSinkRate,
  quicksandBottomedOut,
  quicksandVisualOffset,
  quicksandEscapeWindow,
} from '../../../src/core/quicksand/quicksand';

const Q1: QuicksandDef = {
  id: 'qs_q1',
  xStart: 480,
  xEnd: 672,
  surfaceY: 224,
  sinkRate: 35,
  deathY: 304,
  telegraphMs: 500,
};
const Q2: QuicksandDef = {
  id: 'qs_q2',
  xStart: 1056,
  xEnd: 1344,
  surfaceY: 224,
  sinkRate: 55,
  deathY: 336,
  telegraphMs: 350,
};

describe('quicksand 纯函数', () => {
  it('quicksandZoneAt 命中 x 区间（含端点），区间外/间隙返回 null', () => {
    const zones = [Q1, Q2];
    expect(quicksandZoneAt(zones, 480)?.id).toBe('qs_q1');
    expect(quicksandZoneAt(zones, 672)?.id).toBe('qs_q1');
    expect(quicksandZoneAt(zones, 1056)?.id).toBe('qs_q2');
    expect(quicksandZoneAt(zones, 1344)?.id).toBe('qs_q2');
    expect(quicksandZoneAt(zones, 800)).toBeNull(); // Q1/Q2 之间间隙
    expect(quicksandZoneAt(zones, 100)).toBeNull(); // 最左之外
    expect(quicksandZoneAt(zones, 1500)).toBeNull(); // 最右之外
    expect(quicksandZoneAt(undefined, 500)).toBeNull();
    expect(quicksandZoneAt([], 500)).toBeNull();
  });

  it('isQuicksandSinking：接地 + 脚底≥surfaceY + x 在区间 → true；空中/越界 → false', () => {
    const grounded = { x: 500, y: 224 - 34, w: 24, h: 34 }; // 脚底 = 224 = surfaceY
    expect(isQuicksandSinking(Q1, grounded, true)).toBe(true);
    // 空中（跳跃中，grounded=false）不触发 → 跳跃跨越安全
    expect(isQuicksandSinking(Q1, grounded, false)).toBe(false);
    // x 越界（不在区间）→ false
    const off = { x: 900, y: 224 - 34, w: 24, h: 34 };
    expect(isQuicksandSinking(Q1, off, true)).toBe(false);
    // 脚底高于 surfaceY（未接触地面）→ false
    const high = { x: 500, y: 224 - 34 - 8, w: 24, h: 34 };
    expect(isQuicksandSinking(Q1, high, true)).toBe(false);
  });

  it('quicksandSinkRate：telegraphMs 内由 0 线性渐变到 sinkRate', () => {
    // 满速=35；telegraph=500ms
    expect(quicksandSinkRate(Q1, 0)).toBeCloseTo(0, 5);
    expect(quicksandSinkRate(Q1, 250)).toBeCloseTo(17.5, 5); // 半程
    expect(quicksandSinkRate(Q1, 500)).toBeCloseTo(35, 5); // 满速
    expect(quicksandSinkRate(Q1, 1000)).toBeCloseTo(35, 5); // 超出保持满速
  });

  it('quicksandSinkRate：telegraphMs=0 立即满速（退化为无前摇）', () => {
    const instant: QuicksandDef = { ...Q1, telegraphMs: 0 };
    expect(quicksandSinkRate(instant, 0)).toBeCloseTo(35, 5);
  });

  it('quicksandBottomedOut：累计下陷深度 ≥ (deathY-surfaceY) 即触底', () => {
    // Q1 触底阈值 = 304 - 224 = 80
    expect(quicksandBottomedOut(Q1, 79)).toBe(false);
    expect(quicksandBottomedOut(Q1, 80)).toBe(true);
    expect(quicksandBottomedOut(Q1, 90)).toBe(true);
    // Q2 触底阈值 = 336 - 224 = 112
    expect(quicksandBottomedOut(Q2, 112)).toBe(true);
  });

  it('quicksandVisualOffset：钳到 [0, deathY-surfaceY]，不改碰撞盒', () => {
    expect(quicksandVisualOffset(Q1, -10)).toBe(0); // 负 → 0
    expect(quicksandVisualOffset(Q1, 40)).toBe(40); // 区间内透传
    expect(quicksandVisualOffset(Q1, 80)).toBe(80); // 恰触底 → 满偏移
    expect(quicksandVisualOffset(Q1, 200)).toBe(80); // 超出钳到 max
  });

  it('quicksandEscapeWindow：= (deathY-surfaceY)/sinkRate（站定到触底时间，秒）', () => {
    expect(quicksandEscapeWindow(Q1)).toBeCloseTo(80 / 35, 5); // ≈2.286s
    expect(quicksandEscapeWindow(Q2)).toBeCloseTo(112 / 55, 5); // ≈2.036s
    // sinkRate=0 → 永不下陷（Infinity）
    const stuck: QuicksandDef = { ...Q1, sinkRate: 0 };
    expect(quicksandEscapeWindow(stuck)).toBe(Infinity);
  });

  it('契约自检：1-4 两区 surfaceY 对齐地面顶(y=224)，escape 窗口守公平(>2s 量级)', () => {
    expect(Q1.surfaceY).toBe(224);
    expect(Q2.surfaceY).toBe(224);
    expect(quicksandEscapeWindow(Q1)).toBeGreaterThan(2);
    expect(quicksandEscapeWindow(Q2)).toBeGreaterThan(2);
  });
});
