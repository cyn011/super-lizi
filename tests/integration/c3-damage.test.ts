/**
 * tests/integration/c3-damage.test.ts — C3 受伤管线 headless 验证。
 *
 * 通过场景共用的真实组件直驱：
 *   - createFloorWorld（与 game-scene 同款最小地板）
 *   - DamageStateMachine（真实状态机）
 *   - PlaceholderHazard（真实 HazardSource 实现；Phaser 仅 type-only import，headless 安全）
 *   - resolveHazardContact（game-scene 与测试共用的单一真实解算函数）
 *   - EventBus（真实事件发放）
 *   - runStepSim + skipConsume（C3 同步协议改动，R3 击退保护）
 *
 * 零 Phaser / 零平台 API。验证：ON_HURT 发出 + 击退写入 body；hitstun 跳过 consume 保留击退；
 * SMALL 再 hit → ON_DEATH+ON_RESPAWN 且 body 回 spawn；lives 耗尽 → ON_GAME_OVER。
 * 全部数值来自 damageConfig / characterConfig，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { DamageStateMachine } from '../../src/core/damage/damage-state-machine';
import { PlaceholderHazard } from '../../src/game/debug/placeholder-hazard';
import { resolveHazardContact } from '../../src/game/damage-resolution';
import { CharacterController } from '../../src/core/character/character-controller';
import type { InputState } from '../../src/core/input/input-abstraction';
import { EventBus, ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER } from '../../src/core/events/event-bus';
import { runStepSim, createFloorWorld } from '../../src/game/scene-sync';
import { TILE, characterConfig, damageConfig } from '../../src/core/config';
import { STEP_DT } from '../unit/_step';

const FLOOR_ROW = 7;
const REST_Y = FLOOR_ROW * TILE - 34; // 脚底贴地板顶
const SPAWN_X = 64;
const SPAWN = { x: SPAWN_X, y: REST_Y };
const PLAYER_W = 24;
const PLAYER_H = 34;

function mkNeutral(): InputState {
  return {
    left: false,
    right: false,
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    actionPressed: false,
    actionHeld: false,
    actionReleased: false,
    jumpPressedAt: 0,
  };
}

function floorWorld() {
  return createFloorWorld({ tileSize: TILE, width: 40, height: 9, floorRow: FLOOR_ROW });
}

function makeBody(y = REST_Y) {
  return { x: SPAWN_X, y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 };
}

/** 在玩家左侧放置一个与 body 重叠的占位 hazard（knockbackDir 应为 -1：向右推远离 → 实际向左推因为源在左）。 */
function leftHazard() {
  return new PlaceholderHazard(SPAWN_X - 20, REST_Y + 5, 24, 24);
}

function record(bus: EventBus): string[] {
  const ev: string[] = [];
  bus.on(ON_HURT, () => ev.push(ON_HURT));
  bus.on(ON_DEATH, () => ev.push(ON_DEATH));
  bus.on(ON_RESPAWN, () => ev.push(ON_RESPAWN));
  bus.on(ON_GAME_OVER, () => ev.push(ON_GAME_OVER));
  return ev;
}

describe('C3 受伤管线 headless（FULL→SMALL→DEAD→重生 / GameOver）', () => {
  it('FULL 接触 → ON_HURT 发出 + 击退写入 body（vx 远离源、vy 向上）', () => {
    const world = floorWorld();
    const body = makeBody();
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev = record(bus);
    const hazard = leftHazard(); // 源在玩家左侧

    const r = resolveHazardContact({ damage: dsm, hazard, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.hit).toBe(true);
    expect(ev).toEqual([ON_HURT]); // 仅一次
    expect(dsm.state).toBe('SMALL');
    expect(dsm.invincibleTimer).toBeGreaterThan(0); // 进入无敌帧（含 hitstun 窗口）
    // 源在左 → knockbackDir = -1 → body 被推向左（vx<0）
    expect(body.vx).toBeCloseTo(-damageConfig.knockbackSpeed, 6);
    expect(body.vy).toBeCloseTo(-damageConfig.knockbackUp, 6);
    expect(r.hitstunMs).toBe(damageConfig.hitstunMs); // 设了 hitstun
  });

  it('R3 hitstun 跳过 consume → 击退速度被物理保留（不被摩擦吃光）', () => {
    const world = floorWorld();
    const bus = new EventBus();
    const hazard = leftHazard();

    // 跳过 consume 分支
    const bodyS = makeBody();
    const ccS = new CharacterController(characterConfig, { x: bodyS.x, y: bodyS.y, grounded: true });
    const dsmS = new DamageStateMachine(3, damageConfig);
    resolveHazardContact({ damage: dsmS, hazard, body: bodyS, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    const baseVx = bodyS.vx;
    let lg = true;
    for (let i = 0; i < 6; i++) {
      const res = runStepSim({ body: bodyS, controller: ccS, world }, mkNeutral(), lg, STEP_DT, true);
      lg = res.grounded;
    }
    const afterSkip = bodyS.vx;

    // 对照：不跳过 consume（中性输入）→ friction 把击退速度快速吃光
    const bodyC = makeBody();
    const ccC = new CharacterController(characterConfig, { x: bodyC.x, y: bodyC.y, grounded: true });
    const dsmC = new DamageStateMachine(3, damageConfig);
    resolveHazardContact({ damage: dsmC, hazard, body: bodyC, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    let lg2 = true;
    for (let i = 0; i < 6; i++) {
      const res = runStepSim({ body: bodyC, controller: ccC, world }, mkNeutral(), lg2, STEP_DT, false);
      lg2 = res.grounded;
    }
    const afterConsume = bodyC.vx;

    // 跳过 consume：水平击退基本保留（stepBody 不改 vx）
    expect(Math.abs(afterSkip)).toBeGreaterThan(Math.abs(baseVx) * 0.9);
    // 不跳过 consume：中性输入下摩擦把击退吃光大半
    expect(Math.abs(afterConsume)).toBeLessThan(Math.abs(baseVx) * 0.5);
    // 跳过 consume 保留的击退显著多于被吃光的
    expect(Math.abs(afterSkip)).toBeGreaterThan(Math.abs(afterConsume) * 1.5);
  });

  it('无敌帧（hitstun 窗口）内重复接触不触发：状态/命数不变', () => {
    const body = makeBody();
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev = record(bus);
    const hazard = leftHazard();

    resolveHazardContact({ damage: dsm, hazard, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    const livesAfterFirst = dsm.lives;
    ev.length = 0; // 清空，验证窗口内无新事件

    // 仍在无敌帧内（dt 不足以衰减完 1.5s）→ 忽略
    dsm.update(100); // 仅衰减 100ms，仍 >0
    const r2 = resolveHazardContact({ damage: dsm, hazard, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    expect(r2.hit).toBe(false);
    expect(ev).toEqual([]); // 无新事件
    expect(dsm.state).toBe('SMALL'); // 仍是 SMALL
    expect(dsm.lives).toBe(livesAfterFirst); // 命数不减
  });

  it('SMALL 再 hit → ON_DEATH + ON_RESPAWN，body 回到 spawn，lives 减 1', () => {
    const body = makeBody();
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev = record(bus);
    const hazard = leftHazard();

    // FULL→SMALL，清无敌帧
    dsm.hit();
    expect(dsm.state).toBe('SMALL');
    dsm.update(damageConfig.invincibleMs + 1);

    const r = resolveHazardContact({ damage: dsm, hazard, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.respawned).toBe(true);
    expect(r.gameOver).toBe(false);
    expect(ev).toEqual([ON_DEATH, ON_RESPAWN]); // 顺序：先死后重生
    expect(dsm.state).toBe('FULL'); // 立即重生为 FULL
    expect(dsm.lives).toBe(2); // 命数 3→2
    expect(dsm.invincibleTimer).toBeGreaterThan(0); // 重生带无敌帧
    // body 整体复位到 spawn（脚底贴地、满血尺寸）
    expect(body.x).toBe(SPAWN.x);
    expect(body.y).toBe(SPAWN.y);
    expect(body.w).toBe(PLAYER_W);
    expect(body.h).toBe(PLAYER_H);
    expect(body.vx).toBe(0);
    expect(body.vy).toBe(0);
  });

  it('lives 耗尽 → ON_DEATH + ON_GAME_OVER，不重生', () => {
    const body = makeBody();
    const dsm = new DamageStateMachine(1, damageConfig);
    const bus = new EventBus();
    const ev = record(bus);
    const hazard = leftHazard();

    // FULL→SMALL，清无敌帧
    dsm.hit();
    expect(dsm.state).toBe('SMALL');
    dsm.update(damageConfig.invincibleMs + 1);

    const r = resolveHazardContact({ damage: dsm, hazard, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.gameOver).toBe(true);
    expect(r.respawned).toBe(false);
    expect(ev).toEqual([ON_DEATH, ON_GAME_OVER]); // 顺序：先死后 GameOver
    expect(dsm.state).toBe('DEAD');
    expect(dsm.lives).toBe(0);
    expect(dsm.isGameOver).toBe(true);
    // GameOver 分支不复位 body（不再施加击退、不重生）
    expect(r.controller).toBeUndefined();
  });
});
