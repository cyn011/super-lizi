/**
 * game/scene-sync — C1 同步协议（body ↔ controller.state 双向拷贝桥）。
 *
 * 背景：core 已锁。CharacterController 在自有 state 上算 vx/vy（含跳跃/二段跳/coyote/
 * buffer/短跳），而真正被 stepBody 积分的是独立 Body。二者之间缺一座同步桥，导致 F1/F2
 * （占位覆盖、跳跃不驱动 body）与 F3（grounded 滞后 1 帧）。
 *
 * 本模块提供单一实现的 runStepSim，game-scene 与集成测试共用 → 测试即「同步协议」的证据。
 * 纯 TS，零 Phaser / 零平台 API（符合 core 零平台铁律，本模块落在 src/game）。
 *
 * in/out 顺序（对应 integration-plan.md §2.2）：
 *   in : body.vx/vy → state.vx/vy（速度连续性）；lastGrounded → state.grounded（去 F3 滞后）
 *   consume(input,dt)：控制器原地修改 state.vx/vy（重力由 stepBody 负责，绝不在此积分位置）
 *   out(速度): state.vx/vy → body.vx/vy
 *   stepBody：积分 body（重力 + 分轴碰撞）
 *   out(位置): body.x/y → state.x/y；res.grounded → 下一帧 lastGrounded
 */
import type { CharacterController } from '../core/character/character-controller';
import type { InputState } from '../core/input/input-abstraction';
import { stepBody, type Body } from '../core/physics/body';
import type { CollisionWorld } from '../core/physics/collision';

export interface StepSimContext {
  body: Body;
  controller: CharacterController;
  /** 真实关卡由 C5 的 LevelLoader 注入；headless/集成测试可传最小化地板或 undefined（纯自由积分）。 */
  world?: CollisionWorld;
}

export interface StepSimResult {
  /** 本步物理解算的着地结果（供下一帧 in 注入 lastGrounded）。 */
  grounded: boolean;
  /** 本步 in 注入前的着地状态（落地边沿检测：!prevGrounded && grounded → ON_LAND）。 */
  prevGrounded: boolean;
}

/**
 * 单固定步同步协议。不改任何 core 逻辑，仅做场景层桥接。
 * @param lastGrounded 上一帧 stepBody 解算出的着地状态（首帧传 true）。
 */
export function runStepSim(
  ctx: StepSimContext,
  input: InputState,
  lastGrounded: boolean,
  dt: number,
): StepSimResult {
  const { body, controller, world } = ctx;
  const s = controller.state;
  const prevGrounded = lastGrounded;

  // —— in：让 controller 看到当前真实物理状态（消除 F3 的 1 帧滞后）——
  s.vx = body.vx;
  s.vy = body.vy;
  s.grounded = lastGrounded;

  // —— consume：控制器算 vx/vy（跳跃/二段跳/coyote/buffer/短跳）——
  controller.consume(input, dt);

  // —— out（速度回灌 body）：controller 的水平/跳跃输出真实驱动物理体 ——
  body.vx = s.vx;
  body.vy = s.vy;

  // —— 物理积分 + 碰撞解算（重力在此施加，非 controller）——
  const res = stepBody(body, dt, world);

  // —— out（位置/着地回灌 state，保持两套对象每步一致）——
  s.x = body.x;
  s.y = body.y;

  return { grounded: res.grounded, prevGrounded };
}

/** 构造最小地板碰撞世界（demo 场景与集成测试共用，非关卡数据；C5 由 LevelLoader 替换）。 */
export function createFloorWorld(opts: {
  tileSize: number;
  width: number;
  height: number;
  floorRow: number;
}): CollisionWorld {
  const { tileSize, width, height, floorRow } = opts;
  return {
    tileSize,
    width,
    height,
    isSolidTile: (c, r) => r >= floorRow && c >= 0 && c < width,
    isOneWayTile: () => false,
  };
}
