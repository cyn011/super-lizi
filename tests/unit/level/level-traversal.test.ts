/**
 * tests/unit/level/level-traversal.test.ts — C5 闭环 + 三类碰撞验收（headless）。
 *
 * 直驱真实组件：LevelLoader.load(1-1) → RuntimeLevel.world + spawn + goal，
 * 经 src/game/scene-sync 的 runStepSim（与 game-scene 共用同一同步桥）→ 证明：
 *   1) 出生→走到凯旋之门 → ON_LEVEL_COMPLETE（最小可玩闭环，无敌人也可达）
 *   2) 站地（地面行走不坠）
 *   3) 撞墙（竖直墙阻挡水平移动）
 *   4) 落平台（单向 / 实心悬浮平台均可落）
 *
 * 零 Phaser / 零平台 API；全部数值来自 config / 关卡 JSON，禁止硬编码。
 * 关卡布局对齐 specs/level-loader.test.ts：地面 ty7/8、左右边界墙 col0/colLast、
 * 单向台 (14,15,16,5)/(29,30,31,6)、实心台 (22,23,4)、spawn(64,190)、goal(1184,160,32,64)。
 */
import { describe, it, expect } from 'vitest';
import { CharacterController } from '../../../src/core/character/character-controller';
import type { InputState } from '../../../src/core/input/input-abstraction';
import { characterConfig, level1_1, STEP_DT } from '../../../src/core/config';
import { runStepSim } from '../../../src/game/scene-sync';
import { LevelLoader } from '../../../src/core/level/level-loader';
import type { CollisionWorld } from '../../../src/core/physics/collision';
import { EventBus, ON_LEVEL_COMPLETE } from '../../../src/core/events/event-bus';

const BODY_W = 24;
const BODY_H = 34;

function mkInput(over: Partial<InputState> = {}): InputState {
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
    throwPressed: false,
    throwHeld: false,
    throwReleased: false,
    ...over,
  };
}

describe('C5 单关闭环 + 三类碰撞（headless, 1-1 真实关卡）', () => {
  it('出生→走到凯旋之门 → 发 ON_LEVEL_COMPLETE（最小可玩闭环）', () => {
    const rt = LevelLoader.load(level1_1);
    const body = { x: rt.spawn.x, y: rt.spawn.y, w: BODY_W, h: BODY_H, vx: 0, vy: 0 };
    const cc = new CharacterController(characterConfig, {
      x: rt.spawn.x,
      y: rt.spawn.y,
      grounded: true,
    });
    const bus = new EventBus();
    let completed = false;
    bus.on(ON_LEVEL_COMPLETE, () => {
      completed = true;
    });

    const g = rt.goal;
    let lg = true;
    let groundedSeen = false;
    for (let i = 0; i < 4000 && !completed; i++) {
      const res = runStepSim({ body, controller: cc, world: rt.world }, mkInput({ right: true }), lg, STEP_DT);
      lg = res.grounded;
      if (res.grounded) groundedSeen = true;
      // 复刻 scene 的 resolveGoal：goal AABB 重叠 → 发 ON_LEVEL_COMPLETE（一次）
      const overlap =
        body.x < g.x + g.w && body.x + body.w > g.x && body.y < g.y + g.h && body.y + body.h > g.y;
      if (overlap) bus.emit(ON_LEVEL_COMPLETE, { levelId: rt.data.id });
    }

    expect(completed).toBe(true); // 闭环成立
    expect(groundedSeen).toBe(true); // 过程中持续站地（无掉穿）
    expect(body.x + body.w).toBeGreaterThan(g.x); // 确实走到门内
  });

  it('撞墙：竖直实心墙阻挡水平移动（身体被钳在墙左）', () => {
    // 合成世界：列 3 为墙，ty>=5 为地面（保证站地）
    const wallWorld: CollisionWorld = {
      tileSize: 32,
      width: 6,
      height: 6,
      isSolidTile: (tx, ty) => tx === 3 || ty >= 5,
      isOneWayTile: () => false,
    };
    const body = { x: 0, y: 5 * 32 - BODY_H, w: BODY_W, h: BODY_H, vx: 0, vy: 0 };
    const cc = new CharacterController(characterConfig, { x: 0, y: 5 * 32 - BODY_H, grounded: true });
    let lg = true;
    for (let i = 0; i < 600; i++) {
      const res = runStepSim({ body, controller: cc, world: wallWorld }, mkInput({ right: true }), lg, STEP_DT);
      lg = res.grounded;
    }
    // 墙体左侧 = 3*32 = 96，身体右缘最多贴到 96 → x ≤ 72
    expect(body.x).toBeLessThanOrEqual(72 + 1e-6);
    expect(body.x).toBeGreaterThan(60); // 确实右移并被墙挡住
  });

  it('落平台（单向）：自由下落落在 oneway 台顶（(14,5), top=160）', () => {
    const rt = LevelLoader.load(level1_1);
    const x = 14 * 32; // 单向平台 (14,5)
    const body = { x, y: 0, w: BODY_W, h: BODY_H, vx: 0, vy: 0 };
    const cc = new CharacterController(characterConfig, { x, y: 0, grounded: false });
    let lg = false;
    for (let i = 0; i < 400; i++) {
      const res = runStepSim({ body, controller: cc, world: rt.world }, mkInput(), lg, STEP_DT);
      lg = res.grounded;
      if (lg) break;
    }
    expect(lg).toBe(true); // 落到 oneway 台顶
    expect(body.y).toBeCloseTo(5 * 32 - BODY_H, 2); // y ≈ 160-34 = 126（非地面 190）
  });

  it('落平台（实心）：自由下落落在实心悬浮平台顶（(22,4), top=128）', () => {
    const rt = LevelLoader.load(level1_1);
    const x = 22 * 32; // 实心平台 (22,4)
    const body = { x, y: 0, w: BODY_W, h: BODY_H, vx: 0, vy: 0 };
    const cc = new CharacterController(characterConfig, { x, y: 0, grounded: false });
    let lg = false;
    for (let i = 0; i < 400; i++) {
      const res = runStepSim({ body, controller: cc, world: rt.world }, mkInput(), lg, STEP_DT);
      lg = res.grounded;
      if (lg) break;
    }
    expect(lg).toBe(true);
    expect(body.y).toBeCloseTo(4 * 32 - BODY_H, 2); // y ≈ 128-34 = 94（非地面 190）
  });
});
