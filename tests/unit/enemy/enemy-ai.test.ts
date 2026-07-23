/**
 * tests/unit/enemy/enemy-ai.test.ts — S04-1/S04-2 敌人表驱动状态机（core 纯逻辑 Node 单测）。
 *
 * 覆盖：ci_li 巡逻+边缘/墙掉头、du_fu 正弦浮动、可踩判定（isStompable + 顶触条件由
 * damage-resolution 负责，本文件验证 EnemyAI 接口契约）、chong_feng（detect→charge→撞墙
 * stun→idle，stun 期 non-hazard）、shi_pao（fireInterval 到点生成弹丸）、Projectile
 * 移动与重叠判定、createEnemies 过滤。
 * 零 Phaser / 零平台 API。全部数值来自 enemy-config.json，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI, createEnemies } from '../../../src/core/enemy/enemy-ai';
import { Projectile } from '../../../src/core/enemy/projectile';
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
  it('识别 ci_li/du_fu/chong_feng/shi_pao，跳过 coin/未知类型，并分配顺序 id', () => {
    const enemies = createEnemies([
      { type: 'ci_li', x: 10, y: 10 },
      { type: 'du_fu', x: 20, y: 20 },
      { type: 'chong_feng', x: 30, y: 30 },
      { type: 'shi_pao', x: 40, y: 40 },
      { type: 'coin', x: 50, y: 50 },
      { type: 'unknown', x: 60, y: 60 },
    ]);
    expect(enemies).toHaveLength(4);
    expect(enemies.map((e) => e.type)).toEqual(['ci_li', 'du_fu', 'chong_feng', 'shi_pao']);
    expect(enemies[0].id).toBe(0);
    expect(enemies[3].id).toBe(3);
    // 可踩 / 不可踩 分组正确
    expect(enemies[0].isStompable).toBe(true);
    expect(enemies[1].isStompable).toBe(true);
    expect(enemies[2].isStompable).toBe(false);
    expect(enemies[3].isStompable).toBe(false);
    // 初始状态：巡逻 / 浮动 / idle / idle
    expect(enemies[0].state).toBe('patrol');
    expect(enemies[1].state).toBe('float');
    expect(enemies[2].state).toBe('idle');
    expect(enemies[3].state).toBe('idle');
  });

  it('空实体 → 空数组', () => {
    expect(createEnemies([])).toEqual([]);
  });
});

describe('S04-2 chong_feng 冲锋状态机（不可踩）', () => {
  it('idle：玩家在 detect 水平半径内且高度差 < attackRange → 进入 charge 并朝玩家方向', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT });
    const e = new EnemyAI('chong_feng', 300, 200, 0); // 中心 (314, 212)
    const player = { x: 400, y: 200, w: 24, h: 34, vx: 0, vy: 0 }; // 中心 (412, 217)：dx=98≤160, dy=5≤48
    expect(e.state).toBe('idle');
    e.update(STEP_DT, world, player);
    expect(e.state).toBe('charge');
    expect(e.facing).toBe(1); // 玩家在右 → 朝右
    expect(e.vx).toBeGreaterThan(0);
  });

  it('idle：玩家超出 detect 水平半径 → 不进入 charge（保持 idle）', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT });
    const e = new EnemyAI('chong_feng', 300, 200, 0);
    const far = { x: 600, y: 200, w: 24, h: 34, vx: 0, vy: 0 }; // dx=300>160
    e.update(STEP_DT, world, far);
    expect(e.state).toBe('idle');
  });

  it('charge：撞墙/边界 → stun（stunTimer 来自 config），stun 内 overlaps=false，归零回 idle', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT, walls: [12] });
    const e = new EnemyAI('chong_feng', LEFT * TS + 4, FLOOR * TS - 24, 0);
    e.state = 'charge'; // 直接驱动到 charge（dir 默认 +1，向右冲向 col12 墙）
    let reachedStun = false;
    for (let i = 0; i < 600; i++) {
      e.update(STEP_DT, world);
      if (e.state === 'stun') {
        reachedStun = true;
        break;
      }
    }
    expect(reachedStun).toBe(true);
    // stun 期 non-hazard（可被安全越过，sprint plan §1.2）
    const body = { x: e.x, y: e.y, w: 24, h: 24, vx: 0, vy: 0 };
    expect(e.overlaps(body)).toBe(false);
    // stun 计时（config=1000ms）耗尽 → 回 idle
    for (let i = 0; i < 70; i++) e.update(STEP_DT, world);
    expect(e.state).toBe('idle');
  });
});

describe('S04-2 shi_pao 固定炮台（不可踩）', () => {
  it('fireInterval 到点（且有玩家目标）→ 产出 1 枚朝玩家的 Projectile', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT });
    const sp = new EnemyAI('shi_pao', 300, 200, 0); // 中心 y=214
    const player = { x: 500, y: 197, w: 24, h: 34, vx: 0, vy: 0 }; // 中心 y=214，与炮台同高 → 纯水平
    const spawned: Projectile[] = [];
    for (let i = 0; i < 125; i++) {
      const out = sp.update(STEP_DT, world, player);
      spawned.push(...out);
    }
    expect(spawned).toHaveLength(1); // fireInterval=2000ms 内仅发射一次
    const p = spawned[0];
    expect(p.isStompable).toBe(false);
    expect(p.vx).toBeGreaterThan(0); // 朝右（玩家在右）
    expect(p.vy).toBeCloseTo(0, 6); // 同高 → 纯水平
  });

  it('无玩家目标 → 不发射（避免盲射）', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: LEFT, rightCol: RIGHT });
    const sp = new EnemyAI('shi_pao', 300, 200, 0);
    const spawned: Projectile[] = [];
    for (let i = 0; i < 125; i++) {
      const out = sp.update(STEP_DT, world); // 无 player
      spawned.push(...out);
    }
    expect(spawned).toHaveLength(0);
  });
});

describe('S04-2 Projectile 独立 hazard', () => {
  it('构造尺寸来自 config；每步积分移动；撞墙 → dead', () => {
    const world = makeWorld({ tileSize: TS, floorRow: FLOOR, leftCol: 0, rightCol: 5, walls: [5] });
    const p = new Projectile(32, FLOOR * TS - 24, 180, 0); // 向右飞，应撞 col5 墙
    expect(p.width).toBe(10);
    expect(p.height).toBe(10);
    for (let i = 0; i < 60; i++) p.update(STEP_DT, world);
    expect(p.dead).toBe(true);
    expect(p.overlaps({ x: 0, y: 0, w: 1, h: 1, vx: 0, vy: 0 })).toBe(false); // dead → 不重叠
  });

  it('overlaps / knockbackDir 正确，dead 后不再重叠', () => {
    const p = new Projectile(100, 100, 0, 0);
    const overlapping = { x: 100, y: 100, w: 10, h: 10, vx: 0, vy: 0 };
    const far = { x: 300, y: 300, w: 10, h: 10, vx: 0, vy: 0 };
    expect(p.overlaps(overlapping)).toBe(true);
    expect(p.overlaps(far)).toBe(false);
    // 中心 105：左推右(1) / 右推左(-1)
    expect(p.knockbackDir({ x: 50, y: 100, w: 10, h: 10, vx: 0, vy: 0 })).toBe(1);
    expect(p.knockbackDir({ x: 200, y: 100, w: 10, h: 10, vx: 0, vy: 0 })).toBe(-1);
    p.dead = true;
    expect(p.overlaps(overlapping)).toBe(false);
  });
});
