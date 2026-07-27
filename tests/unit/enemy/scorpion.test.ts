/**
 * tests/unit/enemy/scorpion.test.ts — 蝎子（scorpion）+ 仙人掌（cactus）专属敌/障碍纯模块单测（GDD 1-4 §3.2/§3.3）。
 *
 * 镜像 tests/unit/enemy/jellyfish.test.ts 结构，验证：
 *   - scorpion：硬顶不可踩(stompable=false) + 尺寸 40×24 + 巡逻 + charge telegraph（玩家进入 detect 范围 → 尾刺上扬）。
 *   - cactus：硬顶不可踩 + 尺寸 24×48 + 静态（update 无 AI、零弹丸）；底中贴地（盒底 = y 传入值）。
 *   - 二者均经 EnemyAI 构造（createEnemies 识别列表已含），零平台纯逻辑。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../../src/core/enemy/enemy-ai';
import type { CollisionWorld } from '../../../src/core/physics/collision';
import type { Body } from '../../../src/core/physics/body';

// 最小碰撞世界桩（scorpion 巡逻仅需 isSolidTile 探测边缘/墙；测试不依赖地形）
const stubWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: () => false,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('scorpion 专属敌（地面不可踩 + charge telegraph）', () => {
  it('静态属性：硬顶不可踩 + 尺寸 40×24 + 默认 patrol 态', () => {
    const e = new EnemyAI('scorpion', 500, 200, 1);
    expect(e.type).toBe('scorpion');
    expect(e.isStompable).toBe(false); // 硬顶不可踩
    expect(e.width).toBe(40);
    expect(e.height).toBe(24);
    expect(e.scorpionCharging).toBe(false); // 初始非 charge
  });

  it('玩家进入 detect 范围 → charge telegraph（尾刺上扬 + 尾尖红闪）；远离 → 解除', () => {
    const e = new EnemyAI('scorpion', 500, 200, 1);
    // 玩家就在蝎子附近（detect=120，attackRange 缺省 64）
    const near = { x: 500, y: 200, w: 24, h: 34 };
    const rNear = e.update(1 / 60, stubWorld, near as unknown as Body);
    expect(rNear).toEqual([]); // 蝎子无弹丸产出
    expect(e.scorpionCharging).toBe(true);

    // 玩家远离（>detect）
    const far = { x: 500 + 400, y: 200, w: 24, h: 34 };
    const e2 = new EnemyAI('scorpion', 500, 200, 2);
    const rFar = e2.update(1 / 60, stubWorld, far as unknown as Body);
    expect(rFar).toEqual([]);
    expect(e2.scorpionCharging).toBe(false);
  });

  it('charge 相位每步推进（≤2Hz 红闪，仅视觉），且 update 返回空弹丸数组', () => {
    const e = new EnemyAI('scorpion', 500, 200, 3);
    const player = { x: 500, y: 200, w: 24, h: 34 };
    const before = e.scorpionChargePhase;
    const r = e.update(1 / 60, stubWorld, player as unknown as Body);
    expect(r).toEqual([]);
    expect(e.scorpionCharging).toBe(true);
    expect(e.scorpionChargePhase).not.toBeCloseTo(before, 5); // 相位推进
    // 1.5Hz ⇒ 每步(1/60s)推进 2π·1.5/60 ≈ 0.157 rad
    expect(e.scorpionChargePhase - before).toBeCloseTo((2 * Math.PI * 1.5) / 60, 4);
  });

  it('空中玩家（垂直偏离 > attackRange）不触发 charge', () => {
    const e = new EnemyAI('scorpion', 500, 200, 4);
    const airborne = { x: 500, y: 200 - 200, w: 24, h: 34 }; // 垂直差 200 > 64
    e.update(1 / 60, stubWorld, airborne as unknown as Body);
    expect(e.scorpionCharging).toBe(false);
  });
});

describe('cactus 专属固定障碍（硬顶不可踩 + 静态）', () => {
  it('静态属性：硬顶不可踩 + 尺寸 24×48 + 底中贴地（盒底 = 传入 y）', () => {
    const groundTop = 224;
    const e = new EnemyAI('cactus', 768, groundTop, 5);
    expect(e.type).toBe('cactus');
    expect(e.isStompable).toBe(false); // 硬顶不可踩
    expect(e.width).toBe(24);
    expect(e.height).toBe(48);
    // 底中贴地：盒底 = y + height = 传入 y（设计坐标 = 地面顶）
    expect(e.y + e.height).toBeCloseTo(groundTop, 5);
  });

  it('update 为静态：无 AI 移动、零弹丸产出', () => {
    const e = new EnemyAI('cactus', 768, 224, 6);
    const x0 = e.x;
    const y0 = e.y;
    const r = e.update(1 / 60, stubWorld, undefined);
    expect(r).toEqual([]); // 静态障碍无弹丸
    expect(e.x).toBe(x0); // 不巡逻
    expect(e.y).toBe(y0);
  });
});
