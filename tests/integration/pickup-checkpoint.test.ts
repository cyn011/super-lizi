/**
 * tests/integration/pickup-checkpoint.test.ts — S04-3 实体拾取 / 检查点 headless 验证。
 *
 * 直驱真实组件：RuntimeLevel（coin/seed/checkpoint 分桶）+ resolvePickups（game-scene 与测试
 * 共用的单一真实实现）+ EventBus + EnemyAI + resolveHazardContact（C3 重生管线）。
 * 验证：
 *   - 金币拾取 → ON_COIN + collected 去重（重复重叠不重复发）；
 *   - 种子拾取 → ON_SEED_COLLECTED(seedId) + 去重；
 *   - 检查点触碰 → 更新 respawnPoint + ON_CHECKPOINT（去重，仅首次/移动到新点）；
 *   - 死亡重生落 respawnPoint（== 检查点）。
 * 零 Phaser / 零平台 API。全部数值来自关卡 JSON / config，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../src/core/level/level-loader';
import type { RuntimeLevel } from '../../src/core/level/level-runtime';
import { EnemyAI } from '../../src/core/enemy/enemy-ai';
import { resolveHazardContact } from '../../src/game/damage-resolution';
import { DamageStateMachine } from '../../src/core/damage/damage-state-machine';
import { resolvePickups } from '../../src/game/pickup-resolution';
import { EventBus, ON_COIN, ON_SEED_COLLECTED, ON_CHECKPOINT } from '../../src/core/events/event-bus';
import { level1_1, damageConfig } from '../../src/core/config';
import { STEP_DT } from '../unit/_step';

const rt = LevelLoader.load(level1_1);

describe('S04-3 金币拾取（ON_COIN + 去重）', () => {
  it('重叠 → 发 ON_COIN + 标记 collected；重复重叠不重复发', () => {
    const collectedCoins = new Set<number>();
    const body = { x: 0, y: 0, w: 24, h: 34, vx: 0, vy: 0 };
    const bus = new EventBus();
    let coinCount = 0;
    bus.on(ON_COIN, () => coinCount++);

    const coin = rt.coins[0];
    body.x = coin.x;
    body.y = coin.y; // 与金币 AABB 重叠

    const r1 = resolvePickups({ runtime: rt, body, collectedCoins, collectedSeeds: new Set(), respawnPoint: { x: 0, y: 0 }, bus });
    expect(coinCount).toBe(1);
    expect(r1.coinHits).toEqual([0]);
    expect(collectedCoins.has(0)).toBe(true);

    // 仍在重叠，但已 collected → 不去重前不应再发
    const r2 = resolvePickups({ runtime: rt, body, collectedCoins, collectedSeeds: new Set(), respawnPoint: { x: 0, y: 0 }, bus });
    expect(coinCount).toBe(1);
    expect(r2.coinHits).toEqual([]);
  });
});

describe('S04-3 种子拾取（ON_SEED_COLLECTED + 去重）', () => {
  it('重叠 → 发 ON_SEED_COLLECTED(seedId) + 标记 collected；重复重叠不重复发', () => {
    const collectedSeeds = new Set<number>();
    const body = { x: 0, y: 0, w: 24, h: 34, vx: 0, vy: 0 };
    const bus = new EventBus();
    const seeds: unknown[] = [];
    bus.on(ON_SEED_COLLECTED, (p) => seeds.push(p));

    const seed = rt.seeds[0]; // seed_01
    body.x = seed.x;
    body.y = seed.y;

    const r1 = resolvePickups({ runtime: rt, body, collectedCoins: new Set(), collectedSeeds, respawnPoint: { x: 0, y: 0 }, bus });
    expect(seeds).toEqual(['seed_01']); // 仅发事件，maturity/蜕变留专项
    expect(r1.seedHits).toEqual([0]);
    expect(collectedSeeds.has(0)).toBe(true);

    const r2 = resolvePickups({ runtime: rt, body, collectedCoins: new Set(), collectedSeeds, respawnPoint: { x: 0, y: 0 }, bus });
    expect(seeds.length).toBe(1); // 去重
    expect(r2.seedHits).toEqual([]);
  });
});

describe('S04-3 检查点（更新 respawnPoint + ON_CHECKPOINT + 去重）', () => {
  it('触碰 → 更新 respawnPoint + 发 ON_CHECKPOINT；停留不去重；移动到新点再发', () => {
    const fakeRuntime = {
      coins: [],
      seeds: [],
      checkpoints: [
        { type: 'checkpoint', x: 100, y: 100 },
        { type: 'checkpoint', x: 500, y: 100 },
      ],
    } as unknown as RuntimeLevel;
    const respawnPoint = { x: 0, y: 0 };
    const bus = new EventBus();
    const evs: unknown[] = [];
    bus.on(ON_CHECKPOINT, (p) => evs.push(p));

    // 第一检查点
    const body = { x: 100, y: 100, w: 24, h: 34, vx: 0, vy: 0 };
    const r1 = resolvePickups({ runtime: fakeRuntime, body, collectedCoins: new Set(), collectedSeeds: new Set(), respawnPoint, bus });
    expect(respawnPoint).toEqual({ x: 100, y: 100 });
    expect(evs).toEqual([{ x: 100, y: 100 }]);
    expect(r1.checkpointUpdated).toBe(true);

    // 仍停留第一检查点 → 不去重前不重复发
    const r2 = resolvePickups({ runtime: fakeRuntime, body, collectedCoins: new Set(), collectedSeeds: new Set(), respawnPoint, bus });
    expect(evs.length).toBe(1);
    expect(r2.checkpointUpdated).toBe(false);

    // 移动到第二检查点 → 再次发 ON_CHECKPOINT
    body.x = 500;
    body.y = 100;
    const r3 = resolvePickups({ runtime: fakeRuntime, body, collectedCoins: new Set(), collectedSeeds: new Set(), respawnPoint, bus });
    expect(respawnPoint).toEqual({ x: 500, y: 100 });
    expect(evs).toEqual([{ x: 100, y: 100 }, { x: 500, y: 100 }]);
    expect(r3.checkpointUpdated).toBe(true);
  });

  it('真实关卡：触碰检查点 → respawnPoint 改变；死亡重生落检查点（GDD 05 重生语义）', () => {
    const respawnPoint = { x: rt.spawn.x, y: rt.spawn.y };
    const body = { x: rt.spawn.x, y: rt.spawn.y, w: 24, h: 34, vx: 0, vy: 0 };
    const bus = new EventBus();
    const cpEvents: unknown[] = [];
    bus.on(ON_CHECKPOINT, (p) => cpEvents.push(p));

    const cp = rt.checkpoints[0];
    body.x = cp.x;
    body.y = cp.y; // 与检查点 AABB 重叠

    const r1 = resolvePickups({ runtime: rt, body, collectedCoins: new Set(), collectedSeeds: new Set(), respawnPoint, bus });
    expect(cpEvents).toEqual([{ x: cp.x, y: cp.y }]);
    expect(r1.checkpointUpdated).toBe(true);
    expect(respawnPoint).toEqual({ x: cp.x, y: cp.y });

    // 模拟死亡（SMALL 再受击 → 以 respawnPoint 为重生生点 → body 落检查点）
    const enemy = new EnemyAI('ci_li', cp.x, cp.y + 12, 99); // 与 body 重叠制造受伤
    const dsm = new DamageStateMachine(3, damageConfig);
    dsm.hit(); // FULL→SMALL
    dsm.update(damageConfig.invincibleMs + 1); // 清无敌帧
    const res = resolveHazardContact({ damage: dsm, hazard: enemy, body, bus, cfg: damageConfig, spawn: respawnPoint, playerW: 24, playerH: 34, dt: STEP_DT });
    expect(res.respawned).toBe(true);
    expect(body.x).toBe(cp.x);
    expect(body.y).toBe(cp.y);
  });
});
