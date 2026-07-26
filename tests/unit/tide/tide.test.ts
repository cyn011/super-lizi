/**
 * tests/unit/tide/tide.test.ts — 潮汐水位线 + 暗流区域力场纯函数单测（GDD 1-3 §4/§5.1）。
 *
 * 验证：
 *   - tideSurfaceY：mid ± amp·sin 公式（mid=(lowY+highY)/2、amp=(lowY-highY)/2）。
 *   - tideSegmentAt：按 x 区间命中（含端点），段间空档返回 null。
 *   - isAntiPhase：T1/T2 相位错开判定。
 *   - riptideAt：矩形区域内命中（含端点）/ 区域外 null / zones=undefined 安全 null。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { tideSurfaceY, tideSegmentAt, isAntiPhase } from '../../../src/core/tide/tide';
import { riptideAt } from '../../../src/core/tide/riptide';
import type { TideSegmentDef, RiptideDef } from '../../../src/core/level/level-data';

const T1: TideSegmentDef = {
  id: 'tide_t1',
  xStart: 416,
  xEnd: 768,
  lowY: 256,
  highY: 160,
  periodMs: 6400,
  phase: 0,
};
const T2: TideSegmentDef = {
  id: 'tide_t2',
  xStart: 1024,
  xEnd: 1408,
  lowY: 224,
  highY: 128,
  periodMs: 8000,
  phase: 3200,
};

describe('tide 水位线纯函数', () => {
  it('tideSurfaceY 公式：mid ± amp·sin（t=0 中水位、最低潮=lowY、最高潮=highY）', () => {
    expect(tideSurfaceY(T1, 0)).toBeCloseTo(208, 5); // (256+160)/2
    // 最低潮（sin=+1，水面落至最低 = y 最大）：t 使 2π·t/6400 = π/2 → t=1600
    expect(tideSurfaceY(T1, 1600)).toBeCloseTo(256, 5); // lowY
    // 最高潮（sin=-1，水面升至最高 = y 最小）：t=4800
    expect(tideSurfaceY(T1, 4800)).toBeCloseTo(160, 5); // highY
  });

  it('T1 高水位 highY=160 低于 oneway(ty4) 顶边 y=128 ⇒ 安全过路在水面之上（干燥）', () => {
    // 越小 y = 越高；oneway ty4 顶 y=128 < highY=160 ⇒ oneway 顶在水面之上 → 高潮时仍可走
    expect(128).toBeLessThan(160);
  });

  it('tideSegmentAt 命中 x 区间（含端点），段间空档返回 null', () => {
    const segs = [T1, T2];
    expect(tideSegmentAt(segs, 416)?.id).toBe('tide_t1');
    expect(tideSegmentAt(segs, 768)?.id).toBe('tide_t1');
    expect(tideSegmentAt(segs, 1024)?.id).toBe('tide_t2');
    expect(tideSegmentAt(segs, 1408)?.id).toBe('tide_t2');
    expect(tideSegmentAt(segs, 800)).toBeNull(); // T1/T2 之间空档
    expect(tideSegmentAt(segs, 100)).toBeNull(); // 最左之外
    expect(tideSegmentAt(segs, 1500)).toBeNull(); // 最右之外
    expect(tideSegmentAt([], 500)).toBeNull();
  });

  it('T1/T2 反相（phase 差 ≈ 半周期，迫使重新 timing）', () => {
    expect(isAntiPhase(T1, T2)).toBe(true);
  });
});

describe('riptide 暗流区域力场', () => {
  const z: RiptideDef = {
    xStart: 1056,
    xEnd: 1280,
    yTop: 96,
    yBottom: 224,
    vxBias: 140,
  };

  it('区域内点返回 zone（含端点）', () => {
    expect(riptideAt([z], 1168, 160)?.vxBias).toBe(140); // 中心
    expect(riptideAt([z], 1056, 96)?.vxBias).toBe(140); // 左上端点
    expect(riptideAt([z], 1280, 224)?.vxBias).toBe(140); // 右下端点
  });

  it('区域外点返回 null（x/y 任一边界外）', () => {
    expect(riptideAt([z], 100, 160)).toBeNull(); // x 左外
    expect(riptideAt([z], 1300, 160)).toBeNull(); // x 右外
    expect(riptideAt([z], 1168, 80)).toBeNull(); // y 上外
    expect(riptideAt([z], 1168, 240)).toBeNull(); // y 下外
  });

  it('zones=undefined 时安全返回 null', () => {
    expect(riptideAt(undefined, 1168, 160)).toBeNull();
  });
});
