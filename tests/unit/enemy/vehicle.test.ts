/**
 * tests/unit/enemy/vehicle.test.ts — 街道汽车 vehicle（1-6 专属致命 hazard）纯模块单测（GDD 1-6 §3.2）。
 *
 * 验证：
 *   - 静态属性：硬顶不可踩(stompable=false) + 尺寸 48×32 + 初始 dir/phaseOffset + 头灯相位初值 0。
 *   - 横向 ping-pong：update 推进 x 于 [baseX, baseX+range] 内往返（三角波），dir 会折返翻转、y 不变。
 *   - overlaps 恒 false（致命 hazard 不走 resolveHazardContact 非致死路径）；overlapsFatal 在 AABB 命中时 true。
 *   - 致命 = applyFatalDeath（扣 1 命 + 重生 FULL + 重生无敌帧 + controller 交回，非扣级/非 GameOver）。
 *   - 禁止踩：isStompable=false 且 overlaps 恒 false（致命改由 stepSim 的 overlapsFatal + applyFatalDeath 解算）。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../../src/core/enemy/enemy-ai';
import type { CollisionWorld } from '../../../src/core/physics/collision';
import { DamageStateMachine } from '../../../src/core/damage/damage-state-machine';
import { resolveHazardContact, applyFatalDeath } from '../../../src/game/damage-resolution';
import { EventBus } from '../../../src/core/events/event-bus';
import { damageConfig } from '../../../src/core/config';

const SPAWN = { x: 64, y: 190 };
const PLAYER_W = 24;
const PLAYER_H = 34;

// vehicle 不读碰撞世界（updateVehicle 仅 dt 驱动三角波位移），桩仅占位。
const stubWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: () => false,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('vehicle 街道汽车（致命 hazard：ping-pong + applyFatalDeath）', () => {
  it('静态属性：硬顶不可踩 + 尺寸 48×32 + 初始 dir/phaseOffset + 头灯相位 0', () => {
    const e = new EnemyAI('vehicle', 384, 192, 0, undefined, { speed: 90, range: 224, dir: 1, phaseOffset: 0, w: 48, h: 32 });
    expect(e.type).toBe('vehicle');
    expect(e.isStompable).toBe(false); // 硬顶不可踩（致命，非踩杀）
    expect(e.width).toBe(48);
    expect(e.height).toBe(32);
    expect(e.vehicleDir).toBe(1);
    expect(e.vehiclePhaseOffset).toBe(0);
    expect(e.headPhaseState).toBe(0); // 头灯闪烁相位初值 0
  });

  it('update 推进 ping-pong：x 于 [baseX, baseX+range] 内往返、dir 折返、y 不变、头灯相位累加', () => {
    const baseX = 384;
    const range = 224;
    const e = new EnemyAI('vehicle', baseX, 192, 1, undefined, { speed: 90, range, dir: 1, phaseOffset: 0, w: 48, h: 32 });
    const x0 = e.x;
    const head0 = e.headPhaseState;
    let sawReverse = false;
    for (let i = 0; i < 600; i++) {
      e.update(1 / 60, stubWorld, undefined);
      expect(e.x).toBeGreaterThanOrEqual(baseX - 1e-6);
      expect(e.x).toBeLessThanOrEqual(baseX + range + 1e-6);
      if (e.vehicleDir === -1) sawReverse = true;
    }
    expect(e.x).toBeGreaterThan(x0); // 首步右移（phaseOffset=0 落左端，dir=1）
    expect(sawReverse).toBe(true);   // 折返：dir 曾翻为 -1（确为 ping-pong）
    expect(e.y).toBe(192);           // 不竖直移动
    expect(e.headPhaseState).toBeGreaterThan(head0); // 头灯相位（≤2Hz）累加
  });

  it('overlaps 恒 false（致命 hazard 不走 resolveHazardContact 非致死路径）', () => {
    const e = new EnemyAI('vehicle', 384, 192, 2, undefined, { speed: 90, range: 224, dir: 1, phaseOffset: 0, w: 48, h: 32 });
    // 玩家盒完全覆盖车盒 [384,432]×[192,224]
    const body = { x: 400, y: 200, w: 24, h: 34, vx: 0, vy: 0 };
    expect(e.overlaps(body)).toBe(false);
    // resolveHazardContact 因 overlaps=false 直接忽略（不触发非致死扣级）
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const r = resolveHazardContact({ damage: dsm, hazard: e, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    expect(r.hit).toBe(false);
    expect(dsm.state).toBe('FULL'); // 状态不变（未走受伤分支）
  });

  it('overlapsFatal 在 AABB 命中时为 true（致命接触由 stepSim 经 applyFatalDeath 解算）', () => {
    const e = new EnemyAI('vehicle', 384, 192, 3, undefined, { speed: 90, range: 224, dir: 1, phaseOffset: 0, w: 48, h: 32 });
    const body = { x: 400, y: 200, w: 24, h: 34, vx: 0, vy: 0 }; // 与车盒重叠
    expect(e.overlapsFatal(body)).toBe(true);
  });

  it('禁止踩：isStompable=false 且 overlaps 恒 false（致命改由 applyFatalDeath，不进踩杀/受伤管线）', () => {
    const e = new EnemyAI('vehicle', 384, 192, 4, undefined, { speed: 90, range: 224, dir: 1, phaseOffset: 0, w: 48, h: 32 });
    const body = { x: 400, y: 160, w: 24, h: 34, vx: 0, vy: 300 }; // 自上方高速踩下
    expect(e.isStompable).toBe(false);
    expect(e.overlaps(body)).toBe(false);
  });

  it('致命接触 = applyFatalDeath：扣 1 命 + 重生 FULL + 重生无敌帧 + controller 交回（非 GameOver）', () => {
    const e = new EnemyAI('vehicle', 384, 192, 5, undefined, { speed: 90, range: 224, dir: 1, phaseOffset: 0, w: 48, h: 32 });
    const dsm = new DamageStateMachine(3, damageConfig);
    const bus = new EventBus();
    const body = { x: 400, y: 200, w: 24, h: 34, vx: 0, vy: 0 };
    expect(e.overlapsFatal(body)).toBe(true); // 重叠成立（前置，须先于 applyFatalDeath 调用，否则 body 被复位到 spawn）
    const r = applyFatalDeath({ damage: dsm, body, bus, cfg: damageConfig, spawn: SPAWN, playerW: PLAYER_W, playerH: PLAYER_H });
    expect(r.gameOver).toBe(false);
    expect(r.controller).toBeDefined(); // 重生 controller 交回调用方替换
    expect(dsm.lives).toBe(2);          // 扣 1 命
    expect(dsm.state).toBe('FULL');     // 有命立即重生 FULL（非扣级）
    expect(dsm.invincibleTimer).toBeGreaterThan(0); // 重生无敌帧
    expect(body.x).toBe(SPAWN.x);       // body 复位到检查点
    expect(body.y).toBe(SPAWN.y);
  });
});
