/**
 * tests/unit/enemy/gu-bao.test.ts — 鼓苞四态状态机纯函数（GDD 13，core 零平台 headless 单测）。
 *
 * 覆盖：四态 p / hazard / stompable 语义、状态切换（含 ACTIVE→RETRACTING 边界可踩）、
 * 周期 T=2120ms、phaseOffset 归一化（含负/超周期）、RETRACTING 为唯一可踩窗口。
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GU_BAO_CFG,
  guBaoPeriod,
  resolveGuBaoPhase,
  stepGuBao,
  type GuBaoCfg,
} from '../../../src/core/enemy/gu-bao';
import { STEP_DT } from '../_step';

const CFG: GuBaoCfg = DEFAULT_GU_BAO_CFG;
const T = guBaoPeriod(CFG); // 2120

describe('GDD 13 鼓苞状态机 · 周期与四态语义', () => {
  it('默认周期 T = dormantMs+emergeMs+activeMs+retractMs = 2120ms', () => {
    expect(T).toBe(1100 + 160 + 700 + 160);
    expect(T).toBe(2120);
  });

  it('DORMANT：p=0、hazard=false、stompable=false（地下无碰撞、无害、不可踩）', () => {
    const r = stepGuBao('DORMANT', 0, STEP_DT, CFG);
    expect(r.state).toBe('DORMANT');
    expect(r.p).toBeCloseTo(0, 6);
    expect(r.hazard).toBe(false);
    expect(r.stompable).toBe(false);
  });

  it('EMERGING：p 线性上升、hazard=true、stompable=false', () => {
    const r = stepGuBao('EMERGING', 80, STEP_DT, CFG);
    expect(r.state).toBe('EMERGING');
    expect(r.p).toBeCloseTo((80 + STEP_DT * 1000) / CFG.emergeMs, 4);
    expect(r.p).toBeGreaterThan(0);
    expect(r.hazard).toBe(true);
    expect(r.stompable).toBe(false);
  });

  it('ACTIVE：p=1、hazard=true、stompable=false', () => {
    const r = stepGuBao('ACTIVE', 300, STEP_DT, CFG);
    expect(r.state).toBe('ACTIVE');
    expect(r.p).toBe(1);
    expect(r.hazard).toBe(true);
    expect(r.stompable).toBe(false);
  });

  it('RETRACTING：p 递减、hazard=false、stompable=true（唯一可踩窗口）', () => {
    const r = stepGuBao('RETRACTING', 0, STEP_DT, CFG);
    expect(r.state).toBe('RETRACTING');
    expect(r.p).toBeLessThan(1);
    expect(r.p).toBeGreaterThan(0);
    expect(r.hazard).toBe(false);
    expect(r.stompable).toBe(true);
  });
});

describe('GDD 13 状态切换', () => {
  it('DORMANT→EMERGING：本态时间溢出后进入 EMERGING 并结转剩余时间', () => {
    const r = stepGuBao('DORMANT', 1095, STEP_DT, CFG);
    expect(r.state).toBe('EMERGING');
    expect(r.t).toBeCloseTo(1095 + STEP_DT * 1000 - CFG.dormantMs, 3);
    expect(r.hazard).toBe(true);
  });

  it('ACTIVE→RETRACTING 边界（边缘情况 3）：切换后 stompable=true，保证窗口边界可踩', () => {
    const r = stepGuBao('ACTIVE', CFG.activeMs - 5, STEP_DT, CFG);
    expect(r.state).toBe('RETRACTING');
    expect(r.stompable).toBe(true);
  });

  it('RETRACTING→DORMANT：完整一周期后回到 DORMANT，t 归零附近', () => {
    const steps = Math.ceil(T / (STEP_DT * 1000)) + 2;
    let s: ReturnType<typeof stepGuBao> = stepGuBao('DORMANT', 0, STEP_DT, CFG);
    for (let i = 1; i < steps; i++) s = stepGuBao(s.state, s.t, STEP_DT, CFG);
    expect(s.state).toBe('DORMANT');
    expect(s.t).toBeLessThan(CFG.dormantMs);
  });
});

describe('GDD 13 几何（盒顶 = anchorY - p*height）', () => {
  it('DORMANT 盒顶 = anchorY（地下零高）；ACTIVE 盒顶 = anchorY - height', () => {
    const anchorY = 224;
    const d = stepGuBao('DORMANT', 0, STEP_DT, CFG);
    const a = stepGuBao('ACTIVE', 0, STEP_DT, CFG);
    expect(anchorY - d.p * CFG.height).toBeCloseTo(anchorY, 6);
    expect(anchorY - a.p * CFG.height).toBeCloseTo(anchorY - CFG.height, 6);
  });
});

describe('GDD 13 phaseOffset 归一化（边缘情况 4）', () => {
  it('phaseOffset=0 → DORMANT t=0', () => {
    expect(resolveGuBaoPhase(0, CFG)).toEqual({ state: 'DORMANT', t: 0 });
  });
  it('phaseOffset=1060（半周期错相）→ DORMANT t=1060', () => {
    expect(resolveGuBaoPhase(1060, CFG)).toEqual({ state: 'DORMANT', t: 1060 });
  });
  it('负值 phaseOffset → mod T 归一化（落到 DORMANT 段）', () => {
    const r = resolveGuBaoPhase(-2000, CFG); // ph = 120 → DORMANT t=120
    expect(r.state).toBe('DORMANT');
    expect(r.t).toBeCloseTo(120, 3);
  });
  it('phaseOffset ≥ T → mod T 归一化（3000 % 2120 = 880 → DORMANT t=880）', () => {
    expect(resolveGuBaoPhase(3000, CFG)).toEqual({ state: 'DORMANT', t: 880 });
  });
});
