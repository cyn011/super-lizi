/**
 * tests/integration/enemy-stomp.test.ts — S04-1 踩踏接入 C3 受伤链路（headless 验证）。
 *
 * 直驱真实组件：EnemyAI（core，实现 StompableHazard）+ resolveHazardContact（game-scene 与测试
 * 共用单一真实解算）+ DamageStateMachine + EventBus。验证：
 *   踩刺栗（vy>0 且从顶接触）→ 敌 eliminated + 玩家反弹(vy<0) + ON_STOMP/ON_ENEMY_DEATH，不触发受伤；
 *   侧碰可踩敌人（同高、vy>0 但非从顶）→ 走受伤链路（状态 SMALL），敌不消灭。
 * 零 Phaser / 零平台 API。stompBounce 来自 characterConfig，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../src/core/enemy/enemy-ai';
import { resolveHazardContact } from '../../src/game/damage-resolution';
import { DamageStateMachine } from '../../src/core/damage/damage-state-machine';
import { EventBus, ON_STOMP, ON_ENEMY_DEATH, ON_HURT } from '../../src/core/events/event-bus';
import { characterConfig, damageConfig } from '../../src/core/config';
import { STEP_DT } from '../unit/_step';

const SPAWN = { x: 0, y: 0 }; // 踩踏分支不触达重生逻辑，占位即可

describe('S04-1 踩踏接入 damage-resolution', () => {
  it('踩刺栗（从顶下落）→ 敌消灭 + 玩家反弹(vy<0) + ON_STOMP/ON_ENEMY_DEATH，不触发受伤', () => {
    const enemy = new EnemyAI('ci_li', 300, 200, 0); // 敌顶 y=200
    const body = { x: 300, y: 168, w: 24, h: 34, vx: 0, vy: 200 }; // 底=202 落入敌身顶、下落中
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev: string[] = [];
    bus.on(ON_STOMP, () => ev.push(ON_STOMP));
    bus.on(ON_ENEMY_DEATH, () => ev.push(ON_ENEMY_DEATH));

    const r = resolveHazardContact({
      damage: dsm,
      hazard: enemy,
      body,
      bus,
      cfg: damageConfig,
      spawn: SPAWN,
      playerW: 24,
      playerH: 34,
      dt: STEP_DT,
    });

    expect(r.stomped).toBe(true);
    expect(r.hit).toBe(false);
    expect(enemy.dead).toBe(true);
    expect(enemy.overlaps(body)).toBe(false); // 消灭后不再作为 hazard
    expect(body.vy).toBe(characterConfig.stompBounce); // 向上反弹（stompBounce<0）
    expect(body.vy).toBeLessThan(0);
    expect(ev).toEqual([ON_STOMP, ON_ENEMY_DEATH]);
    expect(dsm.state).toBe('FULL'); // 踩踏不触发受伤
  });

  it('侧面碰可踩敌人（同高、非从顶）→ 走受伤链路，敌不消灭', () => {
    const enemy = new EnemyAI('ci_li', 300, 200, 0);
    const body = { x: 312, y: 190, w: 24, h: 34, vx: 0, vy: 50 }; // 站地(底224)与敌同高侧碰
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev: string[] = [];
    bus.on(ON_HURT, () => ev.push(ON_HURT));

    const r = resolveHazardContact({
      damage: dsm,
      hazard: enemy,
      body,
      bus,
      cfg: damageConfig,
      spawn: SPAWN,
      playerW: 24,
      playerH: 34,
      dt: STEP_DT,
    });

    expect(r.stomped).toBe(false);
    expect(enemy.dead).toBe(false);
    expect(r.hit).toBe(true);
    expect(dsm.state).toBe('SMALL'); // 首次受伤 FULL→SMALL
    expect(dsm.lives).toBe(3);
    expect(ev).toEqual([ON_HURT]);
  });
});
