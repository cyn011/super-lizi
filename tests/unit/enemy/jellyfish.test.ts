/**
 * tests/unit/enemy/jellyfish.test.ts — 水母（jellyfish）专属敌纯模块单测（GDD 1-3 §3.2）。
 *
 * 验证：
 *   - DEFAULT_JELLYFISH_CFG：软顶可踩 + 不伤(nonDamaging) + 持久踏脚石(persistentStomp) + 尺寸 36×40 + amp=24。
 *   - stepJellyfish：x 静止（只上下浮），vy 峰值 = float，单周期后 y 回到 baseY，振幅不超 amp。
 *   - 复用 applyFloat：bob 区间半宽 = amp。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_JELLYFISH_CFG,
  stepJellyfish,
  type JellyfishState,
} from '../../../src/core/enemy/jellyfish';
import { applyFloat } from '../../../src/core/enemy/float-math';

describe('jellyfish 纯模块（垂直 bob + soft 顶踏脚石）', () => {
  it('DEFAULT_JELLYFISH_CFG：软顶可踩 + 不伤 + 持久踏脚石 + 尺寸 36×40', () => {
    expect(DEFAULT_JELLYFISH_CFG.stompable).toBe(true);
    expect(DEFAULT_JELLYFISH_CFG.nonDamaging).toBe(true);
    expect(DEFAULT_JELLYFISH_CFG.persistentStomp).toBe(true);
    expect(DEFAULT_JELLYFISH_CFG.width).toBe(36);
    expect(DEFAULT_JELLYFISH_CFG.height).toBe(40);
    expect(DEFAULT_JELLYFISH_CFG.amp).toBe(24);
    expect(DEFAULT_JELLYFISH_CFG.float).toBe(50);
  });

  it('stepJellyfish 保持 x 静止，仅 y 随正弦上下（峰值竖直速度 ≈ float）', () => {
    const s: JellyfishState = { baseY: 110, amp: 24, float: 50, phase: 0 };
    const r0 = stepJellyfish(s, 1 / 60, 480);
    expect(r0.x).toBe(480); // x 永不动
    expect(r0.vx).toBe(0);
    expect(r0.vy).toBeCloseTo(50, 0); // t=0 时 cos0=1 → 峰值竖直速度 = float
    expect(r0.y).toBeGreaterThan(110); // 从 baseY 向上浮
    expect(r0.y).toBeLessThanOrEqual(110 + 24); // 不超过振幅上界
  });

  it('单周期后 y 回到 baseY，且全程 x 静止、振幅落在 [baseY-amp, baseY+amp]', () => {
    const s: JellyfishState = { baseY: 110, amp: 24, float: 50, phase: 0 };
    // omega = float/amp；周期 T = 2π/omega = 2π·amp/float（秒）
    const periodS = (2 * Math.PI * 24) / 50;
    // 精确等分为 N 段 dt，使累计时间恰为周期 → phase 恰进 2π（避免整数步取整累积误差）
    const N = 600;
    const dt = periodS / N;
    let cur: JellyfishState = { ...s };
    let minY = Infinity;
    let maxY = -Infinity;
    let lastY = 110;
    for (let i = 0; i < N; i++) {
      const r = stepJellyfish(cur, dt, 480);
      cur = { baseY: cur.baseY, amp: cur.amp, float: cur.float, phase: r.phase };
      expect(r.x).toBe(480); // 每步 x 静止
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y);
      lastY = r.y;
    }
    expect(lastY).toBeCloseTo(110, 6); // 完整周期（恰 N=600 步）回到起点
    expect(minY).toBeGreaterThanOrEqual(110 - 24 - 1e-6);
    expect(maxY).toBeLessThanOrEqual(110 + 24 + 1e-6);
  });

  it('applyFloat 复用：bob 区间半宽 = amp（phase=π/2 ⇒ y = baseY + amp）', () => {
    const s: JellyfishState = { baseY: 96, amp: 24, float: 50, phase: Math.PI / 2 };
    const r = applyFloat(s, 0, 1088, 0);
    expect(r.x).toBe(1088);
    expect(r.y).toBeCloseTo(96 + 24, 5); // baseY + amp（sin(π/2)=1）
    expect(r.vx).toBe(0);
  });
});
