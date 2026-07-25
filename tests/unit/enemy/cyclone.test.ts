/**
 * tests/unit/enemy/cyclone.test.ts — 气旋（cyclone）上升气流力场纯函数（GDD 15，core 零平台 headless 单测）。
 *
 * 覆盖：cycloneInZone AABB 检测、stepCyclone 力场（inZone→fy=-liftAcc、离场→0）、漩涡相位推进（mod 2π）、
 * dragX 回中拖拽、applyCycloneForce 套用（净向上、riseMax 钳速、vx 受 fx 影响、离场不改写）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CYCLONE_CFG,
  cycloneInZone,
  stepCyclone,
  applyCycloneForce,
  type CycloneCfg,
} from '../../../src/core/enemy/cyclone';
import type { Body } from '../../../src/core/physics/body';
import { STEP_DT } from '../_step';

// 落地形态：气柱实体承载，anchorY=224（地面顶），width=96、height=160 → cx=208、cy=64。
const CX = 208; // x=160, width=96 → 160+48
const CY = 64; // anchorY(224) - height(160)
const PLAYER_IN: Body = { x: 200, y: 120, w: 24, h: 34, vx: 0, vy: 0 }; // 气柱内
const PLAYER_OUT: Body = { x: 400, y: 120, w: 24, h: 34, vx: 0, vy: 0 }; // 气柱外（x 超出）

describe('GDD 15 气旋 · inZone AABB 检测', () => {
  it('玩家位于气柱 bbox 内 → inZone=true', () => {
    expect(cycloneInZone(DEFAULT_CYCLONE_CFG, CX, CY, PLAYER_IN)).toBe(true);
  });
  it('玩家位于气柱外（x 超出）→ inZone=false', () => {
    expect(cycloneInZone(DEFAULT_CYCLONE_CFG, CX, CY, PLAYER_OUT)).toBe(false);
  });
});

describe('GDD 15 stepCyclone · 力场推导', () => {
  it('inZone → fy=-liftAcc（向上加速度，Y 向下为正）、fx=0（dragX=0 保留操控）', () => {
    const r = stepCyclone(DEFAULT_CYCLONE_CFG, PLAYER_IN, STEP_DT, 0, CX, CY);
    expect(r.inZone).toBe(true);
    expect(r.fy).toBeCloseTo(-DEFAULT_CYCLONE_CFG.liftAcc, 6);
    expect(r.fx).toBeCloseTo(0, 6);
  });

  it('离场 → fy=0（恢复纯重力）、fx=0', () => {
    const r = stepCyclone(DEFAULT_CYCLONE_CFG, PLAYER_OUT, STEP_DT, 0, CX, CY);
    expect(r.inZone).toBe(false);
    expect(r.fy).toBeCloseTo(0, 6);
    expect(r.fx).toBeCloseTo(0, 6);
  });

  it('漩涡相位按 phaseSpeed*dt 推进，mod 2π（仅渲染）', () => {
    const r = stepCyclone(DEFAULT_CYCLONE_CFG, PLAYER_IN, STEP_DT, 0, CX, CY);
    expect(r.phase).toBeCloseTo(DEFAULT_CYCLONE_CFG.phaseSpeed * STEP_DT, 6);
    expect(r.phase).toBeGreaterThanOrEqual(0);
    expect(r.phase).toBeLessThan(2 * Math.PI);
  });

  it('相位跨 2π 回绕（prevPhase 接近上界 → mod 2π）', () => {
    const prev = 2 * Math.PI - 0.01;
    const r = stepCyclone(DEFAULT_CYCLONE_CFG, PLAYER_IN, STEP_DT, prev, CX, CY);
    expect(r.phase).toBeCloseTo((prev + DEFAULT_CYCLONE_CFG.phaseSpeed * STEP_DT) % (2 * Math.PI), 6);
    expect(r.phase).toBeLessThan(2 * Math.PI);
  });

  it('dragX>0 → inZone 时 fx 朝柱心回中（fx = -dragX*(pcx-cx)），帮助留在气流', () => {
    const DRAG: CycloneCfg = { ...DEFAULT_CYCLONE_CFG, dragX: 2.0 };
    const r = stepCyclone(DRAG, PLAYER_IN, STEP_DT, 0, CX, CY);
    const pcx = PLAYER_IN.x + PLAYER_IN.w / 2; // 212
    expect(r.inZone).toBe(true);
    expect(r.fx).toBeCloseTo(-DRAG.dragX * (pcx - CX), 6); // -2*(212-208) = -8
  });
});

describe('GDD 15 applyCycloneForce · 速度套用与钳速', () => {
  it('inZone：vy 施加 fy（向上为负）并积分，未超 riseMax → vy = fy*dt', () => {
    const body: Body = { x: 0, y: 0, w: 24, h: 34, vx: 0, vy: 0 };
    const step = { phase: 0, inZone: true, fx: 0, fy: -DEFAULT_CYCLONE_CFG.liftAcc };
    applyCycloneForce(step, body, STEP_DT, DEFAULT_CYCLONE_CFG.riseMax);
    expect(body.vy).toBeCloseTo(-DEFAULT_CYCLONE_CFG.liftAcc * STEP_DT, 4); // -2600/60 ≈ -43.33
    expect(body.vx).toBeCloseTo(0, 6); // fx=0 不改 vx
  });

  it('inZone + 已高于 riseMax：vy 钳制到 -riseMax（防无限加速/飘出屏）', () => {
    const body: Body = { x: 0, y: 0, w: 24, h: 34, vx: 0, vy: -300 };
    const step = { phase: 0, inZone: true, fx: 0, fy: -DEFAULT_CYCLONE_CFG.liftAcc };
    applyCycloneForce(step, body, STEP_DT, DEFAULT_CYCLONE_CFG.riseMax);
    expect(body.vy).toBe(-DEFAULT_CYCLONE_CFG.riseMax); // -220
  });

  it('inZone + dragX fx：vx 受 fx*dt 影响（朝柱心回中）', () => {
    const body: Body = { x: 0, y: 0, w: 24, h: 34, vx: 0, vy: 0 };
    const step = { phase: 0, inZone: true, fx: -8, fy: 0 };
    applyCycloneForce(step, body, STEP_DT, DEFAULT_CYCLONE_CFG.riseMax);
    expect(body.vx).toBeCloseTo(-8 * STEP_DT, 6); // -0.1333
  });

  it('离场（inZone=false）：不改写 body（自然恢复重力）', () => {
    const body: Body = { x: 0, y: 0, w: 24, h: 34, vx: 12, vy: -50 };
    const before = { vx: body.vx, vy: body.vy };
    const step = { phase: 0, inZone: false, fx: 0, fy: 0 };
    applyCycloneForce(step, body, STEP_DT, DEFAULT_CYCLONE_CFG.riseMax);
    expect(body.vx).toBe(before.vx);
    expect(body.vy).toBe(before.vy);
  });
});
