/**
 * tests/unit/enemy/pet.test.ts — 宠物 pet（home 专属新敌）纯模块单测（GDD 1-5 §3.2）。
 *
 * 验证：
 *   - 静态属性：硬顶不可踩(stompable=false) + 尺寸 36×28 + 默认 patrol 态。
 *   - 地面巡逻：update 推进 x（边缘/墙掉头复用 updatePatrol），petBobPhase 视觉相位累加。
 *   - 接触=非致死致伤：复用 resolveHazardContact 的 FULL→SMALL 分支（扣 1 级 + 无敌帧），
 *     不触发 SMALL→DEAD 死亡/重生（非 applyFatalDeath），发 ON_HURT。
 *   - 禁止踩：即便从顶高速踩下（满足踩踏几何），因 isStompable=false 走受伤分支、不消灭宠物。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../../src/core/enemy/enemy-ai';
import type { CollisionWorld } from '../../../src/core/physics/collision';
import { DamageStateMachine } from '../../../src/core/damage/damage-state-machine';
import { resolveHazardContact } from '../../../src/game/damage-resolution';
import { EventBus, ON_HURT } from '../../../src/core/events/event-bus';
import { damageConfig } from '../../../src/core/config';

const SPAWN = { x: 64, y: 190 };
const PLAYER_W = 24;
const PLAYER_H = 34;

// 地面存根：ty>=7 为地面（pet 脚前下方有地、身前中部无墙 → 持续向右巡逻）
const patrolWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: (tx: number, ty: number) => ty >= 7,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('pet 专属敌（地面不可踩 + 接触非致死致伤）', () => {
  it('静态属性：硬顶不可踩 + 尺寸 36×28 + petBobPhase 初值 0', () => {
    const e = new EnemyAI('pet', 720, 200, 0);
    expect(e.type).toBe('pet');
    expect(e.isStompable).toBe(false); // 硬顶不可踩
    expect(e.width).toBe(36);
    expect(e.height).toBe(28);
    expect(e.petBobPhaseState).toBe(0);
  });

  it('update 推进巡逻 + 视觉相位累加（petBobPhase 随帧增长，≤1Hz）', () => {
    const e = new EnemyAI('pet', 720, 200, 1);
    const x0 = e.x;
    const phase0 = e.petBobPhaseState;
    for (let i = 0; i < 30; i++) e.update(1 / 60, patrolWorld, undefined);
    expect(e.x).toBeGreaterThan(x0); // 向右巡逻（边缘/墙掉头复用 updatePatrol）
    expect(e.petBobPhaseState).toBeGreaterThan(phase0); // 微动相位累加
    // 0.8Hz ⇒ 每步(1/60s)推进 2π·0.8/60 ≈ 0.0838 rad
    expect(e.petBobPhaseState - phase0).toBeCloseTo((2 * Math.PI * 0.8 * 30) / 60, 4);
  });

  it('接触 = 非致死致伤：FULL 重叠 → ON_HURT + 扣 1 级(SMALL) + 无敌帧，不扣命/不重生/不 GameOver', () => {
    const e = new EnemyAI('pet', 720, 200, 2);
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev: string[] = [];
    bus.on(ON_HURT, () => ev.push(ON_HURT));
    const body = { x: 720, y: 200, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 };

    const r = resolveHazardContact({ damage: dsm, hazard: e, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.hit).toBe(true);
    expect(r.stomped).toBe(false);
    expect(ev).toEqual([ON_HURT]); // 仅一次受伤事件（非死亡）
    expect(dsm.state).toBe('SMALL'); // 扣 1 级（FULL→SMALL）
    expect(dsm.lives).toBe(3); // 命数不变（非致死，区别于 quicksand applyFatalDeath）
    expect(dsm.invincibleTimer).toBeGreaterThan(0); // 进入无敌帧
    expect(r.gameOver).toBe(false);
    expect(r.respawned).toBe(false);
  });

  it('禁止踩：从顶高速踩下（满足踩踏几何）仍走受伤分支、不消灭（isStompable=false）', () => {
    const e = new EnemyAI('pet', 720, 200, 3);
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    // 玩家自上方高速下落：nowBottom>pet.top 且 prevBottom<=pet.top 且 vy>0（踩踏几何满足）
    const body = { x: 720, y: 168, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 300 };

    const r = resolveHazardContact({ damage: dsm, hazard: e, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.stomped).toBe(false); // 不可踩：不被消灭
    expect(r.hit).toBe(true); // 改走受伤分支
    expect(dsm.state).toBe('SMALL');
    expect(e.overlaps(body)).toBe(true); // 宠物未被 markStomped（仍作为 hazard 重叠）
  });
});
