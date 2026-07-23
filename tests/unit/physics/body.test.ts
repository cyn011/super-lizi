/**
 * tests/unit/physics/body.test.ts — GDD02 固定步长物理
 * 来自 testing.md §4.2（E2.S1），并补全 CollisionWorld 下的 isGrounded / 分轴解算断言。
 * 纯 Node，不依赖 Phaser/WebGL。
 */
import { describe, it, expect } from 'vitest';
import { stepBody, isGrounded, type Body } from '../../../src/core/physics/body';
import type { CollisionWorld } from '../../../src/core/physics/collision';
import { STEP_MS, TILE, GRAVITY, MAX_FALL } from '../../../src/config/physics-config';

function makeBody(over: Partial<Body> = {}): Body {
  return { x: 0, y: 0, w: TILE, h: TILE, vx: 0, vy: 0, ...over };
}

/** 第 5 行（0 起）起为实心地面的迷你世界，供 isGrounded / 分轴解算断言。 */
function makeWorld(): CollisionWorld {
  return {
    tileSize: TILE,
    width: 40,
    height: 10,
    isSolidTile: (tx, ty) => ty >= 5 && tx >= 0 && tx < 40,
    isOneWayTile: () => false,
  };
}

describe('GDD02 固定步长物理 (ADR-005)', () => {
  it('自由落体 1s 后 vy 确定性 = min(gravity*1s, maxFall)', () => {
    const b = makeBody();
    for (let i = 0; i < 60; i++) stepBody(b, STEP_MS / 1000); // 60 固定步 = 1s
    expect(b.vy).toBeCloseTo(Math.min(GRAVITY * 1, MAX_FALL), 1); // = 900
    // 再跑一次完全一致（确定性）
    const c = makeBody();
    for (let i = 0; i < 60; i++) stepBody(c, STEP_MS / 1000);
    expect(c).toEqual(b);
  });

  it('穿透安全：v*dt < TILE（无需 CCD）', () => {
    expect(MAX_FALL * (STEP_MS / 1000)).toBeLessThan(TILE); // 900/60=15 < 32
  });

  it('isGrounded 当且仅当底触地且 vy>=0（CollisionWorld）', () => {
    const world = makeWorld();
    const resting = makeBody({ y: 5 * TILE - TILE, vy: 0 }); // 底贴第 5 行顶
    expect(isGrounded(resting, world)).toBe(true);
    const air = makeBody({ y: 0, vy: -100 });
    expect(isGrounded(air, world)).toBe(false);
  });

  it('stepBody 分轴解算：落入实心 tile 后被推回顶面 (grounded)', () => {
    const world = makeWorld();
    const b = makeBody({ x: 0, y: 5 * TILE - TILE + 2, vy: 0 }); // 底已入第 5 行 2px
    const res = stepBody(b, STEP_MS / 1000, world);
    expect(res.grounded).toBe(true);
    expect(b.y + b.h).toBeCloseTo(5 * TILE, 5);
  });
});
