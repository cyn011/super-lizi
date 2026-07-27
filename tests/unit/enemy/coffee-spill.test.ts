/**
 * tests/unit/enemy/coffee-spill.test.ts — 办公咖啡渍 coffee_spill（1-7 专属低摩擦 zone）纯模块单测（GDD 1-7 §3）。
 *
 * 验证：
 *   - 静态属性：非可踩(isStompable=false) + 尺寸来自实体 w/h + 左上角 x/y（不重锚）+ 初始 idle。
 *   - 静止：update 不移动 x/y（zone 静态；仅推进红边/波纹 telegraph 视觉相位）。
 *   - 视觉相位：update 推进 coffeeRipplePhase（≤2Hz，仅 render 读取；Reduce Motion 由渲染层冻结）。
 *   - overlaps 恒 false（非伤害、零碰撞 zone，不进 damage-resolution 受伤/踩杀管线）。
 *   - 禁止踩：isStompable=false 且 overlaps 恒 false（低摩擦由 game-scene 注入 frictionScale，非碰撞/非伤害）。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../../src/core/enemy/enemy-ai';
import type { CollisionWorld } from '../../../src/core/physics/collision';

// coffee_spill 静态 zone：update 不读碰撞世界，桩仅占位。
const stubWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: () => false,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('coffee_spill 办公咖啡渍（低摩擦 zone 非伤害障碍）', () => {
  it('静态属性：非可踩 + 尺寸来自 w/h + 左上角 x/y + 初始 idle', () => {
    const e = new EnemyAI('coffee_spill', 512, 192, 0, undefined, { w: 64, h: 32 });
    expect(e.type).toBe('coffee_spill');
    expect(e.isStompable).toBe(false); // 低摩擦 zone 非可踩（frictionScale 由 runtime 暴露，碰撞零参与）
    expect(e.width).toBe(64);
    expect(e.height).toBe(32);
    expect(e.x).toBe(512); // 左上角 x（不重锚）
    expect(e.y).toBe(192); // 左上角 y
    expect(e.state).toBe('idle');
  });

  it('update 为静态：x/y 不变（zone 静态，无 AI 位移 / 弹丸），返回空弹丸', () => {
    const e = new EnemyAI('coffee_spill', 512, 192, 1, undefined, { w: 64, h: 32 });
    const x0 = e.x;
    const y0 = e.y;
    const proj = e.update(1 / 60, stubWorld, undefined);
    expect(e.x).toBe(x0);
    expect(e.y).toBe(y0);
    expect(proj).toEqual([]); // 无弹丸产出
  });

  it('视觉相位：update 推进 coffeeRipplePhase（≤2Hz，仅 render 红边/波纹读取）', () => {
    const e = new EnemyAI('coffee_spill', 512, 192, 2, undefined, { w: 64, h: 32 });
    expect(e.coffeeRipplePhaseState).toBe(0); // 初值 0
    e.update(1 / 60, stubWorld, undefined);
    expect(e.coffeeRipplePhaseState).toBeGreaterThan(0); // 推进（2π×1.5Hz×dt）
  });

  it('overlaps 恒 false（非伤害，低摩擦 zone 碰撞零参与，不进 damage-resolution）', () => {
    // cs1 box [512,576]×[192,224]
    const e = new EnemyAI('coffee_spill', 512, 192, 3, undefined, { w: 64, h: 32 });
    const bodyInZone = { x: 530, y: 200, w: 24, h: 34, vx: 0, vy: 0 }; // 落在 zone 盒内
    expect(e.overlaps(bodyInZone)).toBe(false);
    const bodyOnTop = { x: 530, y: 178, w: 24, h: 34, vx: 0, vy: 300 }; // 自上方高速下落（贴顶）
    expect(e.overlaps(bodyOnTop)).toBe(false);
  });

  it('禁止踩：isStompable=false 且 overlaps 恒 false（低摩擦由 game-scene 注入 frictionScale）', () => {
    const e = new EnemyAI('coffee_spill', 768, 192, 4, undefined, { w: 64, h: 32 });
    const body = { x: 780, y: 170, w: 24, h: 34, vx: 0, vy: 300 }; // 自上方高速踩下（落在 zone 内）
    expect(e.isStompable).toBe(false);
    expect(e.overlaps(body)).toBe(false);
  });

  it('不同尺寸正确解析（cs1 64×32）', () => {
    const cs = new EnemyAI('coffee_spill', 1376, 192, 5, undefined, { w: 64, h: 32 });
    expect(cs.width).toBe(64);
    expect(cs.height).toBe(32);
    expect(cs.x).toBe(1376);
    expect(cs.y).toBe(192);
  });
});
