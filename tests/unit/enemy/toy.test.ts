/**
 * tests/unit/enemy/toy.test.ts — 玩具 toy（home 专属小 hazard）纯模块单测（GDD 1-5 §3.3）。
 *
 * 验证：
 *   - 静态属性：硬顶不可踩(stompable=false) + 尺寸 20×16。
 *   - 静止贴地：update 无 AI 移动、零弹丸产出（x/y 不变）。
 *   - 接触=非致死致伤：复用 resolveHazardContact 的 FULL→SMALL 分支（扣 1 级 + 无敌帧），
 *     不触发死亡/重生（非 applyFatalDeath），发 ON_HURT；且即便从顶踩下也不消灭（isStompable=false）。
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

// 玩具静态障碍：update 不读碰撞世界，桩仅占位
const stubWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: () => false,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('toy 专属小 hazard（静止贴地 + 接触非致死致伤）', () => {
  it('静态属性：硬顶不可踩 + 尺寸 20×16 + y 为盒顶（与 pet/通用敌同款 top-anchored，区别于 cactus ground-anchor）', () => {
    const top = 224;
    const e = new EnemyAI('toy', 600, top, 0);
    expect(e.type).toBe('toy');
    expect(e.isStompable).toBe(false); // 硬顶不可踩
    expect(e.width).toBe(20);
    expect(e.height).toBe(16);
    expect(e.y).toBe(top); // 传入 y 即盒顶（top-anchored），盒底 = y + height
  });

  it('update 为静态：无 AI 移动、零弹丸产出', () => {
    const e = new EnemyAI('toy', 600, 224, 1);
    const x0 = e.x;
    const y0 = e.y;
    const r = e.update(1 / 60, stubWorld, undefined);
    expect(r).toEqual([]); // 静态障碍无弹丸
    expect(e.x).toBe(x0); // 不巡逻
    expect(e.y).toBe(y0);
  });

  it('接触 = 非致死致伤：FULL 重叠 → ON_HURT + 扣 1 级(SMALL) + 无敌帧，不扣命/不重生/不 GameOver', () => {
    const e = new EnemyAI('toy', 600, 224, 2);
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev: string[] = [];
    bus.on(ON_HURT, () => ev.push(ON_HURT));
    const body = { x: 600, y: 224, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 };

    const r = resolveHazardContact({ damage: dsm, hazard: e, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.hit).toBe(true);
    expect(r.stomped).toBe(false);
    expect(ev).toEqual([ON_HURT]);
    expect(dsm.state).toBe('SMALL'); // 扣 1 级（FULL→SMALL）
    expect(dsm.lives).toBe(3); // 命数不变（非致死）
    expect(dsm.invincibleTimer).toBeGreaterThan(0);
    expect(r.gameOver).toBe(false);
    expect(r.respawned).toBe(false);
  });

  it('禁止踩：从顶踩下仍走受伤分支、不消灭（isStompable=false）', () => {
    const e = new EnemyAI('toy', 600, 224, 3);
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const body = { x: 600, y: 192, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 300 }; // top=224，自上方高速踩下

    const r = resolveHazardContact({ damage: dsm, hazard: e, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });

    expect(r.stomped).toBe(false);
    expect(r.hit).toBe(true);
    expect(dsm.state).toBe('SMALL');
    expect(e.overlaps(body)).toBe(true);
  });
});
