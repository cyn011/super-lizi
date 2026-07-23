/**
 * tests/unit/level/level-loader.test.ts — C5 Loader 升级验证（core 纯逻辑 Node 单测）。
 *
 * 覆盖：1-1.json 经 LevelLoader 构建有效 CollisionWorld（站地/撞墙/落平台/单向平台）、
 * spawn 坐标、goal AABB 推导、entities 透传、validateLevelData 通过。beat.enabled:false 不驱动机制。
 * 与 level-runtime.test.ts 互补（此处偏重「落平台物理 + 出生/终点闭环数据」）。
 * 零 Phaser / 零平台 API。全部数值来自关卡 JSON，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { level1_1 } from '../../../src/core/config';

/** 让 body 自由落体直到着地，返回最终 body（验证站地/落平台）。 */
function dropToGround(world: ReturnType<typeof LevelLoader.load>['world'], x: number, startY: number) {
  const body = { x, y: startY, w: 24, h: 34, vx: 0, vy: 0 };
  for (let i = 0; i < 600; i++) {
    body.vy = Math.min(body.vy + 1800 / 60, 900);
    body.y += body.vy / 60;
    const ts = world.tileSize;
    const bottomTile = Math.floor((body.y + body.h - 1e-6) / ts);
    const left = Math.floor(body.x / ts);
    const right = Math.floor((body.x + body.w - 1e-6) / ts);
    let grounded = false;
    for (let tx = left; tx <= right; tx++) {
      if (world.isSolidTile(tx, bottomTile)) {
        body.y = bottomTile * ts - body.h;
        body.vy = 0;
        grounded = true;
        break;
      }
    }
    if (grounded) break;
  }
  return body;
}

describe('C5 LevelLoader 升级（core 纯逻辑）', () => {
  const rt = LevelLoader.load(level1_1);

  it('validateLevelData 通过（含 spawn / goal 坐标）', () => {
    expect(validateLevelData(level1_1)).toBe(true);
  });

  it('构建有效 CollisionWorld：地面实心、空气非实心', () => {
    expect(rt.world.isSolidTile(5, 7)).toBe(true); // 地面行
    expect(rt.world.isSolidTile(5, 5)).toBe(false); // 空中
    expect(rt.world.tileSize).toBe(level1_1.tileSize);
    expect(rt.world.width).toBe(level1_1.width);
  });

  it('世界边界：左/右/底越界为墙、顶部开放（撞墙 + 防穿底）', () => {
    expect(rt.world.isSolidTile(-1, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(40, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(5, 9)).toBe(true); // 底墙
    expect(rt.world.isSolidTile(5, -1)).toBe(false); // 顶部开放
  });

  it('单向平台：oneway 仅 isOneWayTile 命中，不是 solid', () => {
    expect(rt.world.isOneWayTile(14, 5)).toBe(true);
    expect(rt.world.isOneWayTile(29, 6)).toBe(true);
    expect(rt.world.isSolidTile(15, 5)).toBe(false);
  });

  it('悬浮实心平台：可站（落平台，ty4 顶 y=128 → body.y=94）', () => {
    const b = dropToGround(rt.world, 22 * 32, 0);
    expect(b.y).toBeCloseTo(4 * 32 - 34, 3);
  });

  it('出生点 spawn 坐标正确（脚底贴地面 row7 顶 y=224 → body.y=190）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    const b = dropToGround(rt.world, rt.spawn.x, rt.spawn.y);
    expect(b.y).toBeCloseTo(7 * 32 - 34, 3); // 站地
  });

  it('凯旋之门 AABB 由 goal 推导（底贴地面），玩家可达', () => {
    expect(rt.goal.x).toBe(1184);
    expect(rt.goal.y).toBe(160);
    expect(rt.goal.w).toBe(32);
    expect(rt.goal.h).toBe(64);
    expect(rt.goal.y + rt.goal.h).toBeCloseTo(7 * 32, 3); // 底贴地面
  });

  it('entities 透传 + S04-1 敌人由实体生成 EnemyAI', () => {
    expect(rt.entities.length).toBe(3);
    expect(rt.enemies.length).toBe(3);
    expect(rt.enemies[0].type).toBe('ci_li');
    expect(rt.enemies[1].type).toBe('ci_li');
    expect(rt.enemies[2].type).toBe('du_fu');
    expect(rt.enemies.every((e) => e.isStompable)).toBe(true);
  });

  it('beat.enabled:false 不驱动机制（仅透传，无逻辑消费）', () => {
    expect(rt.data.beat.enabled).toBe(false);
  });
});
