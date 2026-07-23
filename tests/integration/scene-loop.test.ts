/**
 * tests/integration/scene-loop.test.ts — C1 同步协议 + C2 手感集成验证（headless）。
 *
 * 直驱真实组件：CharacterController + Body + CollisionWorld（createFloorWorld）+ InputAbstraction，
 * 通过 src/game/scene-sync 的 runStepSim（单一同步协议实现，与 game-scene 共用）→ 证明 C1 同步桥
 * 未扭曲手感，10 项 §1 指标在「集成态」落入区间（control-list §1 / epics C2 验收）。
 *
 * 零 Phaser / 零平台 API：本文件只依赖 core（已锁）与 game/scene-sync（纯桥接）。
 * 全部数值从 characterConfig / 物理 config 读取，禁止硬编码魔法数。
 */
import { describe, it, expect } from 'vitest';
import { CharacterController } from '../../src/core/character/character-controller';
import type { InputState } from '../../src/core/input/input-abstraction';
import { InputAbstraction } from '../../src/core/input/input-abstraction';
import { characterConfig, TILE, GRAVITY, MAX_FALL, wechatInputConfig } from '../../src/core/config';
import { runStepSim, createFloorWorld } from '../../src/game/scene-sync';
import { STEP_DT } from '../unit/_step';

const FLOOR_ROW = 7;
const REST_Y = FLOOR_ROW * TILE - 34; // 190：脚底贴地板顶
const SPAWN_X = 64;

/** 最小 InputState 构造器。 */
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

function floorWorld() {
  return createFloorWorld({ tileSize: TILE, width: 40, height: 9, floorRow: FLOOR_ROW });
}

function makeBody(y = REST_Y) {
  return { x: SPAWN_X, y, w: 24, h: 34, vx: 0, vy: 0 };
}

describe('C1 同步协议 + C2 手感集成验证 (headless, control-list §1)', () => {
  it('C1 同步桥：body 与 controller.state 每固定步保持一致（位置/水平/尺寸同值；竖直 = 指令 + 重力*dt）', () => {
    const world = floorWorld();
    const body = makeBody();
    const cc = new CharacterController(characterConfig, { x: SPAWN_X, y: REST_Y, grounded: true });
    const ctx = { body, controller: cc, world };
    let lg = true;
    for (let i = 0; i < 120; i++) {
      const res = runStepSim(ctx, mkInput({ right: true, jumpPressed: i === 10 }), lg, STEP_DT);
      lg = res.grounded;
      // 位置每步回灌（out-position），末端严格一致
      expect(body.x).toBeCloseTo(cc.state.x, 6);
      expect(body.y).toBeCloseTo(cc.state.y, 6);
      // 水平：物理不修改 vx，controller 指令与 body 同值
      expect(body.vx).toBeCloseTo(cc.state.vx, 6);
      // 竖直：state.vy 是控制器指令，stepBody 在其后施加重力（含 MAX_FALL 钳制）；
      // 着地时碰撞解算把 vy 归零 → 二者按“着地/空中”分两支一致
      if (lg) {
        expect(body.vy).toBeCloseTo(0, 6); // 着地：碰撞把 vy 归零
      } else {
        expect(body.vy).toBeCloseTo(Math.min(cc.state.vy + GRAVITY * STEP_DT, MAX_FALL), 6);
      }
      expect(body.w).toBe(cc.state.w);
      expect(body.h).toBe(cc.state.h);
    }
  });

  it('C1 出生静止站地 60s 不抖 / 不陷 / 不下坠', () => {
    const world = floorWorld();
    const body = makeBody();
    const cc = new CharacterController(characterConfig, { x: SPAWN_X, y: REST_Y, grounded: true });
    const ctx = { body, controller: cc, world };
    let lg = true;
    for (let i = 0; i < 3600; i++) {
      const res = runStepSim(ctx, mkInput(), lg, STEP_DT);
      lg = res.grounded;
    }
    expect(Math.abs(body.y - REST_Y)).toBeLessThan(0.5); // 不下坠 / 不陷
    expect(Math.abs(body.vx)).toBeLessThan(1e-6); // 不抖
    expect(lg).toBe(true); // 仍着地
  });

  it('全跳高度 ≈64px（60–68）', () => {
    const world = floorWorld();
    const body = makeBody();
    const cc = new CharacterController(characterConfig, { x: SPAWN_X, y: REST_Y, grounded: true });
    const ctx = { body, controller: cc, world };
    let lg = true;
    let apexY = body.y;
    for (let i = 0; i < 200; i++) {
      const input = i === 0 ? mkInput({ jumpPressed: true, jumpHeld: true }) : mkInput({ jumpHeld: true });
      const res = runStepSim(ctx, input, lg, STEP_DT);
      lg = res.grounded;
      if (body.y < apexY) apexY = body.y;
      if (res.grounded && i > 0) break;
    }
    const height = REST_Y - apexY;
    expect(height).toBeGreaterThanOrEqual(60);
    expect(height).toBeLessThanOrEqual(68);
  });

  it('二段跳高度 ≈1.6 tile（50–56px）', () => {
    const world = floorWorld();
    const body = makeBody();
    const cc = new CharacterController(characterConfig, { x: SPAWN_X, y: REST_Y, grounded: true });
    const ctx = { body, controller: cc, world };
    let lg = true;
    let didDouble = false;
    let startY = REST_Y;
    let apexY = REST_Y;
    for (let i = 0; i < 300; i++) {
      let input;
      if (i === 0) input = mkInput({ jumpPressed: true, jumpHeld: true });
      else if (!didDouble && i > 5 && cc.state.vy >= 0) {
        // 在第一个跳跃弧顶（vy 由负转正）处补二段跳
        input = mkInput({ jumpPressed: true, jumpHeld: true });
        didDouble = true;
        startY = body.y;
        apexY = body.y;
      } else input = mkInput({ jumpHeld: true });
      const res = runStepSim(ctx, input, lg, STEP_DT);
      lg = res.grounded;
      if (didDouble && body.y < apexY) apexY = body.y;
      if (res.grounded && i > 0) break;
    }
    const height = startY - apexY;
    expect(didDouble).toBe(true);
    expect(height).toBeGreaterThanOrEqual(50);
    expect(height).toBeLessThanOrEqual(56);
  });

  it('短跳高度 = 全跳 45–55%', () => {
    const world = floorWorld();
    const restY = REST_Y;

    // 全跳
    const fullBody = makeBody();
    const fullCc = new CharacterController(characterConfig, { x: SPAWN_X, y: restY, grounded: true });
    let lg = true;
    let fullApex = restY;
    for (let i = 0; i < 200; i++) {
      const input = i === 0 ? mkInput({ jumpPressed: true, jumpHeld: true }) : mkInput({ jumpHeld: true });
      const res = runStepSim({ body: fullBody, controller: fullCc, world }, input, lg, STEP_DT);
      lg = res.grounded;
      if (fullBody.y < fullApex) fullApex = fullBody.y;
      if (res.grounded && i > 0) break;
    }
    const fullH = restY - fullApex;

    // 短跳（按即松）
    const shBody = makeBody();
    const shCc = new CharacterController(characterConfig, { x: SPAWN_X, y: restY, grounded: true });
    lg = true;
    let shApex = restY;
    for (let i = 0; i < 200; i++) {
      const input =
        i === 0 ? mkInput({ jumpPressed: true, jumpHeld: false, jumpReleased: true }) : mkInput();
      const res = runStepSim({ body: shBody, controller: shCc, world }, input, lg, STEP_DT);
      lg = res.grounded;
      if (shBody.y < shApex) shApex = shBody.y;
      if (res.grounded && i > 0) break;
    }
    const shH = restY - shApex;
    const ratio = shH / fullH;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });

  it('coyote：离地 ≤100ms 内按跳有效（vy<0）', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined }; // 自由积分，grounded 由 lastGrounded 控制
    let lg = true;
    for (let i = 0; i < 2; i++) {
      runStepSim(ctx, mkInput(), lg, STEP_DT); // 着地阶段：coyote 充满
      lg = false;
    }
    const res = runStepSim(ctx, mkInput({ jumpPressed: true, jumpHeld: true }), false, STEP_DT);
    expect(cc.state.vy).toBeLessThan(0); // 土狼跳生效
  });

  it('coyote：离地 >100ms 内按跳无效（vy>=0）', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined };
    let lg = true;
    for (let i = 0; i < 2; i++) {
      runStepSim(ctx, mkInput(), lg, STEP_DT);
      lg = false;
    }
    cc.state.airJumpsLeft = 0; // 隔离：有跳必是土狼跳
    for (let i = 0; i < 8; i++) runStepSim(ctx, mkInput(), false, STEP_DT); // 离地 >100ms（coyote 耗尽）
    const res = runStepSim(ctx, mkInput({ jumpPressed: true, jumpHeld: true }), false, STEP_DT);
    expect(cc.state.vy).toBeGreaterThanOrEqual(0);
  });

  it('jump buffer：落地前 ≤120ms 按跳、落地即刻起跳（vy<0）', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined };
    let lg = true;
    for (let i = 0; i < 2; i++) {
      runStepSim(ctx, mkInput(), lg, STEP_DT);
      lg = false;
    }
    cc.state.airJumpsLeft = 0; // 隔离：落地后才起跳（非二段跳）
    for (let i = 0; i < 8; i++) runStepSim(ctx, mkInput(), false, STEP_DT); // 离地 >100ms，coyote 耗尽
    runStepSim(ctx, mkInput({ jumpPressed: true, jumpHeld: true }), false, STEP_DT); // 落地前按跳 → buffer=120
    const res = runStepSim(ctx, mkInput({ jumpHeld: true }), true, STEP_DT); // ≤120ms 内落地
    expect(cc.state.vy).toBeLessThan(0);
  });

  it('jump buffer：>120ms 才落地则不触发跳跃（vy>=0）', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined };
    let lg = true;
    for (let i = 0; i < 2; i++) {
      runStepSim(ctx, mkInput(), lg, STEP_DT);
      lg = false;
    }
    cc.state.airJumpsLeft = 0;
    for (let i = 0; i < 8; i++) runStepSim(ctx, mkInput(), false, STEP_DT);
    runStepSim(ctx, mkInput({ jumpPressed: true, jumpHeld: true }), false, STEP_DT); // buffer=120
    for (let i = 0; i < 8; i++) runStepSim(ctx, mkInput({ jumpHeld: true }), false, STEP_DT); // >120ms（buffer 耗尽）
    const res = runStepSim(ctx, mkInput({ jumpHeld: true }), true, STEP_DT); // 落地
    expect(cc.state.vy).toBeGreaterThanOrEqual(0);
  });

  it('二段跳：空中恰好 1 次，落地重置 airJumpsLeft', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined };
    cc.state.airJumpsLeft = characterConfig.airJumps; // 1
    runStepSim(ctx, mkInput({ jumpPressed: true, jumpHeld: true }), false, STEP_DT); // 第一次空中跳
    expect(cc.state.vy).toBeLessThan(0);
    expect(cc.state.airJumpsLeft).toBe(0);
    runStepSim(ctx, mkInput({ jumpPressed: true, jumpHeld: true }), false, STEP_DT); // 第二次（无效）
    expect(cc.state.airJumpsLeft).toBe(0);
    runStepSim(ctx, mkInput(), true, STEP_DT); // 落地重置
    expect(cc.state.airJumpsLeft).toBe(characterConfig.airJumps);
  });

  it('水平 0→满速 ≤0.2s', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined };
    let lg = true;
    let steps = 0;
    while (cc.state.vx < characterConfig.moveSpeed - 1e-6 && steps < 100) {
      runStepSim(ctx, mkInput({ right: true }), lg, STEP_DT);
      lg = true; // 保持着地（accelGround）
      steps++;
    }
    expect(cc.state.vx).toBeCloseTo(characterConfig.moveSpeed, 5);
    expect(steps * STEP_DT).toBeLessThanOrEqual(0.2);
  });

  it('水平 松键→停 ≤0.15s', () => {
    const cc = new CharacterController();
    const body = makeBody();
    const ctx = { body, controller: cc, world: undefined };
    cc.state.vx = characterConfig.moveSpeed;
    let lg = true;
    let steps = 0;
    while (cc.state.vx > 1e-6 && steps < 100) {
      runStepSim(ctx, mkInput(), lg, STEP_DT);
      lg = true;
      steps++;
    }
    expect(cc.state.vx).toBe(0);
    expect(steps * STEP_DT).toBeLessThanOrEqual(0.15);
  });

  it('action 字段正确透传（controller 暂未消费，F10）', () => {
    const ia = new InputAbstraction(wechatInputConfig);
    const frame = {
      down: new Set(['touch:action']),
      pressedEdge: new Set(['touch:action']),
      releasedEdge: new Set<string>(),
    };
    const s = ia.sample(frame, 123);
    expect(s.actionHeld).toBe(true);
    expect(s.actionPressed).toBe(true);
    // 跑一步不崩、不改手感（controller 忽略 action）
    const cc = new CharacterController(characterConfig);
    const body = makeBody();
    runStepSim({ body, controller: cc, world: undefined }, s, true, STEP_DT);
    expect(cc.state.vx).toBe(0);
    expect(cc.state.vy).toBe(0);
  });

  it('C4 微信 touch:jump 经 wechatInputConfig → consume → 真实起跳（headless 链路）', () => {
    const world = floorWorld();
    const body = makeBody();
    const cc = new CharacterController(characterConfig, { x: SPAWN_X, y: REST_Y, grounded: true });
    const ia = new InputAbstraction(wechatInputConfig);
    const ctx = { body, controller: cc, world };
    let lg = true;
    let apexY = body.y;
    for (let i = 0; i < 200; i++) {
      const frame =
        i === 0
          ? { down: new Set(['touch:jump']), pressedEdge: new Set(['touch:jump']), releasedEdge: new Set<string>() }
          : { down: new Set(['touch:jump']), pressedEdge: new Set<string>(), releasedEdge: new Set<string>() };
      const input = ia.sample(frame, i * STEP_DT * 1000);
      const res = runStepSim(ctx, input, lg, STEP_DT);
      lg = res.grounded;
      if (body.y < apexY) apexY = body.y;
      if (res.grounded && i > 0) break;
    }
    expect(REST_Y - apexY).toBeGreaterThan(40); // 真实起跳（微信链路驱动 body 上升）
  });

  it('固定步一致：同输入序列双端逐帧一致（确定性）', () => {
    const run = () => {
      const world = floorWorld();
      const body = makeBody();
      const cc = new CharacterController(characterConfig, { x: SPAWN_X, y: REST_Y, grounded: true });
      const ctx = { body, controller: cc, world };
      let lg = true;
      const trace: number[] = [];
      for (let i = 0; i < 61; i++) {
        const input = mkInput({ right: true, jumpPressed: i === 30, jumpHeld: i >= 30 });
        const res = runStepSim(ctx, input, lg, STEP_DT);
        lg = res.grounded;
        trace.push(body.x, body.y, body.vx, body.vy);
      }
      return trace;
    };
    expect(run()).toEqual(run());
  });
});
