/**
 * tests/unit/enemy/bouncy-vine.test.ts — 弹藤（bouncy_vine）三态状态机纯函数（GDD 14，core 零平台 headless 单测）。
 *
 * 覆盖：IDLE/SPRING/RECOIL 语义（p / hazard / launchReady / justFired）、落地下降边沿 contact 触发、
 * 状态推进（SPRING→RECOIL→IDLE 边界）、完整一周期回到 IDLE、hazard 恒 false、纯辅助零计分、
 * 弹起倍率 resolveBouncyVinePower（normal=1.0 / strong=1.2 / weak=0.8，非法回退 1.0）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BOUNCY_VINE_CFG,
  resolveBouncyVinePower,
  stepBouncyVine,
  isBouncyVine,
  type BouncyVineCfg,
} from '../../../src/core/enemy/bouncy-vine';
import { STEP_DT } from '../_step';

const CFG: BouncyVineCfg = DEFAULT_BOUNCY_VINE_CFG; // bounceVelocity=-680, springMs=80, recoilMs=180

describe('GDD 14 弹藤状态机 · 三态语义', () => {
  it('IDLE：p=0、hazard=false、launchReady=true、justFired=false（待命可触发）', () => {
    const r = stepBouncyVine('IDLE', 0, STEP_DT, CFG, false);
    expect(r.state).toBe('IDLE');
    expect(r.p).toBeCloseTo(0, 6);
    expect(r.hazard).toBe(false);
    expect(r.launchReady).toBe(true);
    expect(r.justFired).toBe(false);
  });

  it('IDLE + contact（落地下降边沿）→ SPRING，当帧 justFired=true、launchReady=false、p=0、t=0', () => {
    const r = stepBouncyVine('IDLE', 0, STEP_DT, CFG, true);
    expect(r.state).toBe('SPRING');
    expect(r.justFired).toBe(true);
    expect(r.launchReady).toBe(false);
    expect(r.p).toBeCloseTo(0, 6);
    expect(r.t).toBeCloseTo(0, 6);
  });

  it('IDLE + 无 contact → 保持 IDLE（不误触发弹起）', () => {
    const r = stepBouncyVine('IDLE', 0, STEP_DT, CFG, false);
    expect(r.state).toBe('IDLE');
    expect(r.justFired).toBe(false);
  });

  it('SPRING：p 随本态时间线性上升（0→1，compress/release）', () => {
    const r = stepBouncyVine('SPRING', 40, STEP_DT, CFG, false);
    expect(r.state).toBe('SPRING');
    expect(r.p).toBeCloseTo((40 + STEP_DT * 1000) / CFG.springMs, 4);
    expect(r.p).toBeGreaterThan(0);
    expect(r.hazard).toBe(false);
  });

  it('RECOIL：p 自 1 递减（回弹松弛冷却窗口）', () => {
    const r = stepBouncyVine('RECOIL', 90, STEP_DT, CFG, false);
    expect(r.state).toBe('RECOIL');
    expect(r.p).toBeCloseTo(1 - (90 + STEP_DT * 1000) / CFG.recoilMs, 4);
    expect(r.p).toBeLessThan(1);
    expect(r.p).toBeGreaterThan(0);
    expect(r.hazard).toBe(false);
  });

  it('hazard 全态恒 false（纯辅助，茎部无害，不进 GDD06 计分分支）', () => {
    const idle = stepBouncyVine('IDLE', 0, STEP_DT, CFG, false);
    const spring = stepBouncyVine('SPRING', 10, STEP_DT, CFG, false);
    const recoil = stepBouncyVine('RECOIL', 10, STEP_DT, CFG, false);
    expect(idle.hazard).toBe(false);
    expect(spring.hazard).toBe(false);
    expect(recoil.hazard).toBe(false);
  });

  it('launchReady 仅 IDLE=true（SPRING/RECOIL 冷却中不可再触发）', () => {
    expect(stepBouncyVine('IDLE', 0, STEP_DT, CFG, false).launchReady).toBe(true);
    expect(stepBouncyVine('SPRING', 10, STEP_DT, CFG, false).launchReady).toBe(false);
    expect(stepBouncyVine('RECOIL', 10, STEP_DT, CFG, false).launchReady).toBe(false);
  });
});

describe('GDD 14 状态切换（边界）', () => {
  it('SPRING→RECOIL：本态时间溢出后进入 RECOIL 并结转剩余时间', () => {
    const r = stepBouncyVine('SPRING', CFG.springMs - 5, STEP_DT, CFG, false);
    expect(r.state).toBe('RECOIL');
    expect(r.t).toBeCloseTo(CFG.springMs - 5 + STEP_DT * 1000 - CFG.springMs, 3);
  });

  it('RECOIL→IDLE：冷却溢出后回到 IDLE，t 归零附近，launchReady 复位', () => {
    const r = stepBouncyVine('RECOIL', CFG.recoilMs - 5, STEP_DT, CFG, false);
    expect(r.state).toBe('IDLE');
    expect(r.t).toBeLessThan(CFG.recoilMs);
    expect(r.launchReady).toBe(true);
    expect(r.justFired).toBe(false);
  });

  it('SPRING 期间 contact=true 不重新触发（contact 仅 IDLE 生效）', () => {
    const r = stepBouncyVine('SPRING', 10, STEP_DT, CFG, true);
    expect(r.state).toBe('SPRING');
    expect(r.justFired).toBe(false);
  });

  it('完整一周期（IDLE→SPRING→RECOIL→IDLE）：落地触发后经 ~17 固定步回到 IDLE', () => {
    let s: ReturnType<typeof stepBouncyVine> = stepBouncyVine('IDLE', 0, STEP_DT, CFG, true); // → SPRING
    expect(s.state).toBe('SPRING');
    const steps = Math.ceil((CFG.springMs + CFG.recoilMs) / (STEP_DT * 1000)) + 2;
    for (let i = 0; i < steps; i++) s = stepBouncyVine(s.state, s.t, STEP_DT, CFG, false);
    expect(s.state).toBe('IDLE');
    expect(s.launchReady).toBe(true);
  });
});

describe('GDD 14 弹起倍率 resolveBouncyVinePower（数值化，非设计档字符串）', () => {
  it('缺省 / undefined → 1.0（normal）', () => {
    expect(resolveBouncyVinePower()).toBe(1);
    expect(resolveBouncyVinePower({})).toBe(1);
  });
  it('strong=1.2 → 1.2', () => {
    expect(resolveBouncyVinePower({ power: 1.2 })).toBe(1.2);
  });
  it('weak=0.8 → 0.8', () => {
    expect(resolveBouncyVinePower({ power: 0.8 })).toBe(0.8);
  });
  it('非法（0 / 负 / 非数值）→ 回退 1.0（防刷/防误配）', () => {
    expect(resolveBouncyVinePower({ power: 0 })).toBe(1);
    expect(resolveBouncyVinePower({ power: -1 })).toBe(1);
    expect(resolveBouncyVinePower({ power: 'strong' as unknown as number })).toBe(1);
  });
});

describe('isBouncyVine 类型守卫', () => {
  it('仅 ' + "'bouncy_vine'" + ' 命中', () => {
    expect(isBouncyVine('bouncy_vine')).toBe(true);
    expect(isBouncyVine('cyclone')).toBe(false);
    expect(isBouncyVine('ci_li')).toBe(false);
  });
});
