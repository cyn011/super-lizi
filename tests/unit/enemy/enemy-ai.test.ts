/**
 * tests/unit/enemy/enemy-ai.test.ts — S04-1 敌人表驱动状态机（core 纯逻辑 Node 单测）。
 *
 * 覆盖：ci_li 巡逻+边缘/墙掉头、du_fu 正弦浮动、可踩判定（isStompable + 顶触条件由
 * damage-resolution 负责，本文件验证 EnemyAI 接口契约）、createEnemies 过滤。
 * 零 Phaser / 零平台 API。全部数值来自 enemy-config.json，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI, createEnemies } from '../../../src/core/enemy/enemy-ai';
import type { CollisionWorld } from '../../../src/core/physics/collision';
import { STEP_DT } from '../_step';

/** 构造最小碰撞世界：cols ∈ [leftCol,rightCol] 在 floorRow 以下为地；walls 列全高实心。 */
function makeWorld(opts: {
  tileSize: number;
  floorRow: number;
  leftCol: number;
  rightCol: number;
  walls?: number[];
}): CollisionWorld {
  const { tileSize, floorRow, leftCol, rightCol, walls = [] } = opts;
  return {
    tileSize,
    width: 100,
    height: 20,
    isSolidTile: (c, r) => {
      if (c < leftCol || c > rightCol) return false;
      if (r < floorRow) return walls.includes(c);
      return true;
    },
    isOneWayTile: () => false,
  };
}

const TS = 32;
const FLOOR = 7;
const LEFT = 5;
const RIGHT = 14;

describe('S04-1 EnemyAI 表驱动行为', () => {
  it('ci_li：初始向右巡逻（vx>0），空地持续右移', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT });
    const e = new EnemyAI('ci_li', LEFT * TS + 4, FLOOR * TS - 24, 0);
    const x0 = e.x;
    e.update(STEP_DT, world);
    expect(e.vx).toBeGreaterThan(0);
    expect(e.x).toBeGreaterThan(x0);
  });

  it('ci_li：遇边缘（前方无地）掉头，不走出平台', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT });
    const e = new EnemyAI('ci_li', LEFT * TS + 4, FLOOR * TS - 24, 0);
    let reversed = false;
    let prevVx = e.vx;
    let minX = e.x;
    let maxX = e.x;
    for (let i = 0; i < 600; i++) {
      e.update(STEP_DT, world);
      if (Math.sign(e.vx) !== Math.sign(prevVx) && prevVx !== 0) reversed = true;
      prevVx = e.vx;
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }
    expect(reversed).toBe(true); // 至少掉头一次
    // 始终停留在平台横向范围 [LEFT, RIGHT+1) 内（含探测余量）
    expect(minX).toBeGreaterThanOrEqual(LEFT * TS - 2);
    expect(maxX).toBeLessThanOrEqual((RIGHT + 1) * TS - 24 + 2);
  });

  it('ci_li：遇墙掉头，不穿墙', () => {
    const world = makeWorld({
      tileSize: TS,
      floorRow: FLOOR,
      leftCol: LEFT,
      rightCol: RIGHT,
      walls: [12],
    });
    const e = new EnemyAI('ci_li', LEFT * TS + 4, FLOOR * TS - 24, 0);
    let reversed = false;
    let prevVx = e.vx;
    let maxX = e.x;
    for (let i = 0; i < 600; i++) {
      e.update(STEP_DT, world);
      if (Math.sign(e.vx) !== Math.sign(prevVx) && prevVx !== 0) reversed = true;
      prevVx = e.vx;
      maxX = Math.max(maxX, e.x);
    }
    expect(reversed).toBe(true);
    expect(maxX).toBeLessThan(12 * TS); // 墙在 col12(=384)，敌 frontend 不越过
  });

  it('du_fu：原地正弦浮动，y 在 baseY±amp 内振荡且确有位移', () => {
    const e = new EnemyAI('du_fu', 100, 120, 0);
    const baseY = e.y;
    let minY = e.y;
    let maxY = e.y;
    for (let i = 0; i < 240; i++) {
      e.update(STEP_DT, makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT }));
      minY = Math.min(minY, e.y);
      maxY = Math.max(maxY, e.y);
    }
    expect(minY).toBeGreaterThanOrEqual(baseY - 24 - 0.5);
    expect(maxY).toBeLessThanOrEqual(baseY + 24 + 0.5);
    expect(maxY - minY).toBeGreaterThan(10); // 确有可见浮动
    expect(e.vx).toBe(0); // 不通巡逻
  });

  it('可踩判定：ci_li / du_fu 均 isStompable=true，getBounds 返回配置尺寸', () => {
    const ci = new EnemyAI('ci_li', 300, 200, 0);
    const du = new EnemyAI('du_fu', 100, 120, 1);
    expect(ci.isStompable).toBe(true);
    expect(du.isStompable).toBe(true);
    expect(ci.getBounds()).toEqual({ x: 300, y: 200, w: 24, h: 24 });
    expect(du.getBounds()).toEqual({ x: 100, y: 120, w: 24, h: 24 });
    expect(ci.enemyType).toBe('ci_li');
  });

  it('HazardSource：overlaps 正确；markStomped 后 dead 且不再重叠', () => {
    const e = new EnemyAI('ci_li', 300, 200, 0);
    const overlapping = { x: 300, y: 200, w: 24, h: 24, vx: 0, vy: 0 };
    const far = { x: 600, y: 200, w: 24, h: 24, vx: 0, vy: 0 };
    expect(e.overlaps(overlapping)).toBe(true);
    expect(e.overlaps(far)).toBe(false);
    e.markStomped();
    expect(e.dead).toBe(true);
    expect(e.overlaps(overlapping)).toBe(false); // 消灭后不再作为 hazard
  });

  it('HazardSource：knockbackDir 按玩家相对源中心左右推离', () => {
    const e = new EnemyAI('ci_li', 300, 200, 0); // 中心 312
    const left = { x: 200, y: 200, w: 24, h: 24, vx: 0, vy: 0 }; // 中心 212 < 312 → 推右(1)
    const right = { x: 400, y: 200, w: 24, h: 24, vx: 0, vy: 0 }; // 中心 412 > 312 → 推左(-1)
    expect(e.knockbackDir(left)).toBe(1);
    expect(e.knockbackDir(right)).toBe(-1);
  });
});

describe('S04-1 createEnemies 工厂', () => {
  it('仅识别 ci_li / du_fu，跳过 coin / 未知类型，并分配顺序 id', () => {
    const enemies = createEnemies([
      { type: 'ci_li', x: 10, y: 10 },
      { type: 'du_fu', x: 20, y: 20 },
      { type: 'coin', x: 30, y: 30 },
      { type: 'chong_feng', x: 40, y: 40 },
    ]);
    expect(enemies).toHaveLength(2);
    expect(enemies[0].type).toBe('ci_li');
    expect(enemies[1].type).toBe('du_fu');
    expect(enemies[0].id).toBe(0);
    expect(enemies[1].id).toBe(1);
    expect(enemies.every((e) => e.isStompable)).toBe(true);
    expect(enemies[0].state).toBe('patrol');
    expect(enemies[1].state).toBe('float');
  });

  it('空实体 → 空数组', () => {
    expect(createEnemies([])).toEqual([]);
  });
});
