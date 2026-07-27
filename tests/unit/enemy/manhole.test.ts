/**
 * tests/unit/enemy/manhole.test.ts — 街道井盖 manhole（1-6 专属蒸汽小 hazard）纯模块单测（GDD 1-6 §3.3）。
 *
 * 验证：
 *   - 静态属性：硬顶不可踩 + 薄盖 32×4（碰撞忽略，hazard 走蒸汽柱）+ 初始 SAFE + 蒸汽柱 AABB 正确。
 *   - 静止：update 不移动 x/y（仅推进状态机 + 视觉相位）。
 *   - 状态机循环：SAFE→TELEGRAPH→STEAM→SAFE（phaseOffset=0 起推进覆盖三态）。
 *   - 蒸汽柱仅 STEAM 为软伤害：SAFE/TELEGRAPH 阶段 overlaps 恒 false（即便玩家在柱内）。
 *   - 接触=非致死致伤（仅 STEAM 蒸汽柱命中）：FULL→SMALL 扣 1 级 + 无敌帧，命数不变，不重生/不 GameOver。
 *   - 禁止踩：即便从顶踩下仍走受伤分支、不消灭（isStompable=false）。
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

// manhole 静态障碍：update 不读碰撞世界，桩仅占位。
const stubWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: () => false,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('manhole 街道井盖蒸汽（SAFE→TELEGRAPH→STEAM + 非致死致伤）', () => {
  it('静态属性：硬顶不可踩 + 薄盖 32×4 + 初始 SAFE + 蒸汽柱 AABB', () => {
    const e = new EnemyAI('manhole', 640, 224, 0, undefined, { period: 3000, activeMs: 900, telegraphMs: 500, steamHeight: 96, w: 32, phaseOffset: 0 });
    expect(e.type).toBe('manhole');
    expect(e.isStompable).toBe(false);
    expect(e.width).toBe(32);
    expect(e.height).toBe(4); // 薄盖（碰撞忽略）
    expect(e.manholePhaseState).toBe('SAFE');
    // 蒸汽柱：以 centerX=640 为轴、宽=32、自 anchorY=224 向上 steamHeight=96
    const sb = e.getSteamBounds();
    expect(sb).toEqual({ x: 640 - 16, y: 224 - 96, w: 32, h: 96 }); // {x:624,y:128,w:32,h:96}
  });

  it('update 为静态：x/y 不变（仅状态机 + 视觉相位推进）', () => {
    const e = new EnemyAI('manhole', 640, 224, 1, undefined, { period: 3000, activeMs: 900, telegraphMs: 500, steamHeight: 96, w: 32, phaseOffset: 0 });
    const x0 = e.x;
    const y0 = e.y;
    e.update(1 / 60, stubWorld, undefined);
    expect(e.x).toBe(x0);
    expect(e.y).toBe(y0);
  });

  it('状态机循环：SAFE→TELEGRAPH→STEAM→SAFE（phaseOffset=0 起，推进后覆盖三态）', () => {
    const e = new EnemyAI('manhole', 640, 224, 2, undefined, { period: 3000, activeMs: 900, telegraphMs: 500, steamHeight: 96, w: 32, phaseOffset: 0 });
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(e.manholePhaseState);
      e.update(1 / 60, stubWorld, undefined);
    }
    expect(seen.has('SAFE')).toBe(true);
    expect(seen.has('TELEGRAPH')).toBe(true);
    expect(seen.has('STEAM')).toBe(true);
  });

  it('蒸汽柱仅 STEAM 为软伤害：SAFE/TELEGRAPH 阶段 overlaps 恒 false（即便玩家在柱内）', () => {
    // phaseOffset=0 → 初始 SAFE
    const e = new EnemyAI('manhole', 640, 224, 3, undefined, { period: 3000, activeMs: 900, telegraphMs: 500, steamHeight: 96, w: 32, phaseOffset: 0 });
    const bodyInColumn = { x: 624, y: 200, w: 24, h: 34, vx: 0, vy: 0 }; // 落在蒸汽柱 [624,656]×[128,224]
    expect(e.manholePhaseState).toBe('SAFE');
    expect(e.overlaps(bodyInColumn)).toBe(false);
    // 推进至 TELEGRAPH（tt∈[1600,2100)）仍不伤
    for (let i = 0; i < 200 && e.manholePhaseState !== 'TELEGRAPH'; i++) e.update(1 / 60, stubWorld, undefined);
    expect(e.manholePhaseState).toBe('TELEGRAPH');
    expect(e.overlaps(bodyInColumn)).toBe(false);
  });

  it('接触 = 非致死致伤（仅 STEAM 蒸汽柱命中）：FULL→SMALL 扣 1 级 + 无敌帧，命数不变/不重生/不 GameOver', () => {
    // phaseOffset=2400 → 初始落点 tt=2400 ∈ STEAM
    const e = new EnemyAI('manhole', 640, 224, 4, undefined, { period: 3000, activeMs: 900, telegraphMs: 500, steamHeight: 96, w: 32, phaseOffset: 2400 });
    // 推进至 STEAM（即便初始已 STEAM，update 一次确保状态机写入）
    for (let i = 0; i < 60 && e.manholePhaseState !== 'STEAM'; i++) e.update(1 / 60, stubWorld, undefined);
    expect(e.manholePhaseState).toBe('STEAM');
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const ev: string[] = [];
    bus.on(ON_HURT, () => ev.push(ON_HURT));
    const bodyInColumn = { x: 624, y: 200, w: 24, h: 34, vx: 0, vy: 0 };
    const r = resolveHazardContact({ damage: dsm, hazard: e, body: bodyInColumn, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    expect(r.hit).toBe(true);
    expect(r.stomped).toBe(false);
    expect(ev).toEqual([ON_HURT]);
    expect(dsm.state).toBe('SMALL'); // 扣 1 级（FULL→SMALL）
    expect(dsm.lives).toBe(3);       // 命数不变（非致死，区别于 vehicle applyFatalDeath）
    expect(dsm.invincibleTimer).toBeGreaterThan(0);
    expect(r.gameOver).toBe(false);
    expect(r.respawned).toBe(false);
  });

  it('禁止踩：STEAM 蒸汽柱内自顶高速踩下仍走受伤分支、不消灭（isStompable=false）', () => {
    const e = new EnemyAI('manhole', 640, 224, 5, undefined, { period: 3000, activeMs: 900, telegraphMs: 500, steamHeight: 96, w: 32, phaseOffset: 2400 });
    for (let i = 0; i < 60 && e.manholePhaseState !== 'STEAM'; i++) e.update(1 / 60, stubWorld, undefined);
    expect(e.manholePhaseState).toBe('STEAM');
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const body = { x: 624, y: 192, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 300 }; // 自上方高速踩下（落在蒸汽柱内）
    const r = resolveHazardContact({ damage: dsm, hazard: e, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    expect(r.stomped).toBe(false); // 不可踩：不被消灭
    expect(r.hit).toBe(true);      // 改走受伤分支
    expect(dsm.state).toBe('SMALL');
    expect(e.overlaps(body)).toBe(true); // 蒸汽柱命中（hazard 仍激活）
  });
});
