/**
 * tests/integration/enemy-nonstompable.test.ts — S04-2 不可踩敌人 + 弹丸接入 C3 受伤链路（headless）。
 *
 * 直驱真实组件：EnemyAI（chong_feng/shi_pao，实现 HazardSource isStompable=false）/
 * Projectile（独立 hazard）/ resolveHazardContact（game-scene 与测试共用单一真实解算）/
 * DamageStateMachine / EventBus。验证：
 *   - 踩冲锋怪（vy>0 从顶）→ 玩家受伤(SMALL)、敌不消灭、sizeScale/无敌帧变化（与踩踏互斥）。
 *   - 弹丸碰玩家 → 玩家受伤(SMALL)、弹丸仍存活（独立 hazard，不消灭）。
 *   - 侧面碰可踩敌(ci_li)仍可踩（不破坏 S04-1）：从顶踩 → 消灭+反弹。
 *   - 冲锋怪 stun 期 → 玩家接触不触发受伤（non-hazard，sprint plan §1.2）。
 * 零 Phaser / 零平台 API。数值来自 damageConfig / enemyConfig，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../src/core/enemy/enemy-ai';
import { Projectile } from '../../src/core/enemy/projectile';
import { resolveHazardContact } from '../../src/game/damage-resolution';
import { DamageStateMachine } from '../../src/core/damage/damage-state-machine';
import { EventBus, ON_HURT, ON_STOMP, ON_ENEMY_DEATH } from '../../src/core/events/event-bus';
import { damageConfig } from '../../src/core/config';
import { STEP_DT } from '../unit/_step';

const SPAWN = { x: 0, y: 0 }; // 受伤分支不触达重生逻辑，占位即可

describe('S04-2 不可踩敌人 + 弹丸 → 玩家受伤（不消灭）', () => {
  it('踩冲锋怪（从顶下落 vy>0）→ 玩家受伤(SMALL)，敌不消灭，sizeScale/无敌帧变化', () => {
    const enemy = new EnemyAI('chong_feng', 300, 200, 0); // 不可踩
    const body = { x: 300, y: 168, w: 24, h: 34, vx: 0, vy: 200 }; // 底=202 落入敌身顶、下落中
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
    expect(r.stomped).toBe(false); // 走受伤分支，非踩踏
    expect(r.hit).toBe(true);
    expect(enemy.dead).toBe(false); // 不消灭敌人
    expect(enemy.overlaps(body)).toBe(true); // 仍作为 hazard（未被移除）
    expect(dsm.state).toBe('SMALL'); // FULL→SMALL
    expect(dsm.sizeScale).toBeCloseTo(damageConfig.smallScale, 6); // 形态缩放变化
    expect(dsm.invincibleTimer).toBeGreaterThan(0); // 进入无敌帧
    expect(ev).toEqual([ON_HURT]);
  });

  it('弹丸碰玩家 → 玩家受伤(SMALL)，弹丸仍存活（独立 hazard，不消灭）', () => {
    const p = new Projectile(300, 200, 0, 0, 1); // 与玩家重叠
    const body = { x: 300, y: 200, w: 24, h: 34, vx: 0, vy: 0 };
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev: string[] = [];
    bus.on(ON_HURT, () => ev.push(ON_HURT));
    const r = resolveHazardContact({
      damage: dsm,
      hazard: p,
      body,
      bus,
      cfg: damageConfig,
      spawn: SPAWN,
      playerW: 24,
      playerH: 34,
      dt: STEP_DT,
    });
    expect(r.stomped).toBe(false);
    expect(r.hit).toBe(true);
    expect(p.dead).toBe(false); // 弹丸不被消灭（仅玩家受伤）
    expect(dsm.state).toBe('SMALL');
    expect(dsm.invincibleTimer).toBeGreaterThan(0);
    expect(ev).toEqual([ON_HURT]);
  });

  it('侧面碰可踩敌(ci_li)仍可踩（不破坏 S04-1）：从顶踩 → 消灭+反弹', () => {
    const enemy = new EnemyAI('ci_li', 300, 200, 0);
    const body = { x: 300, y: 168, w: 24, h: 34, vx: 0, vy: 200 };
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
    expect(enemy.dead).toBe(true);
    expect(dsm.state).toBe('FULL'); // 踩踏不触发受伤
    expect(ev).toEqual([ON_STOMP, ON_ENEMY_DEATH]);
  });

  it('冲锋怪 stun 期 → 玩家接触不触发受伤（non-hazard，可被安全越过）', () => {
    const enemy = new EnemyAI('chong_feng', 300, 200, 0);
    enemy.state = 'stun';
    const body = { x: 300, y: 200, w: 24, h: 34, vx: 0, vy: 0 };
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
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
    expect(r.hit).toBe(false);
    expect(dsm.state).toBe('FULL'); // 未受伤
  });
});
