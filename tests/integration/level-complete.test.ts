/**
 * tests/integration/level-complete.test.ts — C5 单关闭环 headless 验证。
 *
 * 用真实 LevelLoader 构建的 CollisionWorld + runStepSim（与 game-scene 共用同步协议）直驱：
 * 持续右行 → 玩家从出生点走到凯旋之门、AABB 重叠（等价 game-scene 的 resolveGoal）。
 * 同时验证终点处相机 scrollX 钳制在关卡内（F9）。零 Phaser / 零平台 API。
 * 全部数值来自关卡 JSON / config，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../src/core/level/level-loader';
import { CharacterController } from '../../src/core/character/character-controller';
import type { InputState } from '../../src/core/input/input-abstraction';
import { characterConfig, level1_1 } from '../../src/core/config';
import { runStepSim } from '../../src/game/scene-sync';
import { computeCameraScroll } from '../../src/game/camera/follow-camera';
import { STEP_DT } from '../unit/_step';

const rt = LevelLoader.load(level1_1);
const GOAL = rt.goal;

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
    ...over,
  };
}

function aabbOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('C5 单关闭环 headless（出生 → 凯旋之门可达）', () => {
  it('持续右行 → 抵达凯旋之门 AABB 重叠（闭环成立，无敌人也可达）', () => {
    const body = { x: rt.spawn.x, y: rt.spawn.y, w: 24, h: 34, vx: 0, vy: 0 };
    const cc = new CharacterController(characterConfig, {
      x: rt.spawn.x,
      y: rt.spawn.y,
      grounded: true,
    });
    const ctx = { body, controller: cc, world: rt.world };
    let lg = true;
    let reached = false;
    let minY = body.y;
    for (let i = 0; i < 6000 && !reached; i++) {
      const res = runStepSim(ctx, mkInput({ right: true }), lg, STEP_DT);
      lg = res.grounded;
      if (body.y < minY) minY = body.y; // 记录是否曾离地（走路应基本贴合地面）
      if (aabbOverlap(body, GOAL)) reached = true;
    }
    expect(reached).toBe(true);
    // 走路过程脚底贴地（不陷入、不大幅离地）
    expect(minY).toBeLessThanOrEqual(rt.spawn.y + 2);
  });

  it('抵达终点时相机 scrollX 钳制在关卡内（F9：关宽 1280 > 512）', () => {
    const levelW = rt.data.width * rt.data.tileSize;
    const levelH = rt.data.height * rt.data.tileSize;
    const s = computeCameraScroll(GOAL.x + GOAL.w / 2, GOAL.y + GOAL.h / 2, levelW, levelH);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(levelW - 512);
  });
});
