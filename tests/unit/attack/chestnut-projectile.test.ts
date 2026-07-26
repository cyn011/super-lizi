/**
 * tests/unit/attack/chestnut-projectile.test.ts — 栗子弹丸（GDD 17 §3.2 / §5.2，core 零平台 headless 单测）。
 *
 * 覆盖：每步积分移动、达最大射程/越界/撞墙 → dead、overlapsRect 命中判定（含 dead 返回 false）。
 * 全部数值来自 attack-config.json（经 attackConfig 读取），禁止硬编码。零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { ChestnutProjectile } from '../../../src/core/attack/chestnut-projectile';
import { attackConfig } from '../../../src/core/config';
import type { CollisionWorld } from '../../../src/core/physics/collision';

/** 最小碰撞世界：cols ∈ [0,20] 在 row≥8 为地；其余空。足够验证越界/撞墙。 */
function makeWorld(): CollisionWorld {
  return {
    tileSize: 32,
    width: 100,
    height: 20,
    isSolidTile: (c, r) => c >= 0 && c <= 20 && r >= 8,
    isOneWayTile: () => false,
  };
}

describe('GDD 17 ChestnutProjectile 弹丸积分与判定', () => {
  it('每步积分：向右飞行 x 增加、traveled 累加', () => {
    const c = new ChestnutProjectile(50, 50, 200, 0, 1);
    const x0 = c.x;
    c.update(0.1, makeWorld());
    expect(c.x).toBeGreaterThan(x0);
    expect(c.traveled).toBeGreaterThan(0);
  });

  it('达最大射程 → dead（puff）', () => {
    const max = attackConfig.chestnutMaxRange ?? 320;
    const c = new ChestnutProjectile(0, 50, 100, 0, 1);
    // 步进直到 traveled 累积超过 max
    for (let i = 0; i < 100 && !c.dead; i++) c.update(0.05, makeWorld());
    expect(c.dead).toBe(true);
    expect(c.traveled).toBeGreaterThanOrEqual(max - 1);
  });

  it('越界（x < 0）→ dead', () => {
    const c = new ChestnutProjectile(-5, 50, -100, 0, -1);
    c.update(0.01, makeWorld());
    expect(c.dead).toBe(true);
  });

  it('撞墙（进入实心 tile）→ dead', () => {
    // 起点落在地面 tile（row 8 实心），update 立即判定撞墙
    const c = new ChestnutProjectile(5 * 32, 8 * 32, 50, 0, 1);
    c.update(0.01, makeWorld());
    expect(c.dead).toBe(true);
  });

  it('overlapsRect：重叠矩形 → true；分离矩形 → false', () => {
    const c = new ChestnutProjectile(100, 100, 0, 0, 1);
    // 与弹丸 AABB（100,100,12,12）重叠
    expect(c.overlapsRect(100, 100, 12, 12)).toBe(true);
    // 远离
    expect(c.overlapsRect(500, 500, 12, 12)).toBe(false);
  });

  it('dead 弹丸 overlapsRect 返回 false（不再参与命中）', () => {
    const c = new ChestnutProjectile(-5, 50, -100, 0, -1);
    c.update(0.01, makeWorld());
    expect(c.dead).toBe(true);
    expect(c.overlapsRect(100, 100, 12, 12)).toBe(false);
  });
});
