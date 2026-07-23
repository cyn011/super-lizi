/**
 * core/physics/body — 刚体 / 碰撞结果 / 固定步长积分（GDD 02 §5 / 架构 §4.2 / ADR-005）。
 * 纯 TS，零 Phaser。重力与最大下落速度来自 config（禁止硬编码）。
 */
import { GRAVITY, MAX_FALL } from '../config';
import { CollisionWorld, resolveAxisX, resolveAxisY } from './collision';

/** 轴对齐刚体（逻辑 px；vx/vy 为 px/s）。 */
export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

/** 一次 stepBody 的解算结果（供角色 coyote / 渲染 juice 使用）。 */
export interface CollisionResult {
  grounded: boolean;
  hitCeiling: boolean;
  hitLeft: boolean;
  hitRight: boolean;
  groundPlatform?: Body;
}

/**
 * 固定步长推进一个 body（dt 为秒，通常 = STEP_DT = 1/60）。
 * 流程：Y 加重力 → 先 X 解算墙 → 再 Y 解算地/顶。
 * 无 world 时（纯自由积分，用于确定性单测）仅做重力 + 位置积分。
 */
export function stepBody(body: Body, dt: number, world?: CollisionWorld): CollisionResult {
  const result: CollisionResult = {
    grounded: false,
    hitCeiling: false,
    hitLeft: false,
    hitRight: false,
  };

  // 重力（仅 Y）
  body.vy = Math.min(body.vy + GRAVITY * dt, MAX_FALL);

  if (!world) {
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    return result;
  }

  // X 轴：先移动后解算
  body.x += body.vx * dt;
  const xr = resolveAxisX(body, world);
  result.hitLeft = xr.hitLeft;
  result.hitRight = xr.hitRight;

  // Y 轴：记录上一帧底，移动后解算
  const prevBottom = body.y + body.h;
  body.y += body.vy * dt;
  const yr = resolveAxisY(body, world, prevBottom);
  result.grounded = yr.grounded;
  result.hitCeiling = yr.hitCeiling;

  return result;
}

/**
 * 着地判定：body 底部紧贴实心/单向 tile 顶且 vy>=0（供角色 coyote 与 stepBody 复用）。
 * 无 world 时退化为「非下落」近似（仅供无世界单测占位，真实逻辑必须有 world）。
 */
export function isGrounded(body: Body, world?: CollisionWorld): boolean {
  if (body.vy < 0) return false;
  if (!world) return false;
  const ts = world.tileSize;
  const x0 = Math.floor((body.x + 1e-6) / ts);
  const x1 = Math.floor((body.x + body.w - 1e-6) / ts);
  const bottomTile = Math.floor((body.y + body.h + 1e-6) / ts);
  for (let tx = x0; tx <= x1; tx++) {
    if (world.isSolidTile(tx, bottomTile)) return true;
    if (world.isOneWayTile(tx, bottomTile)) {
      const platTop = bottomTile * ts;
      if (body.y + body.h <= platTop + 1e-3) return true;
    }
  }
  return false;
}

/**
 * 移动平台注册（E2.S4 随动用，MVP 预留接口）。
 * 当前实现记录平台速度，供角色 grounded 于其上时叠加位移；Sprint 1 未接入真实关卡。
 */
const movingPlatforms = new Map<Body, { x: number; y: number }>();

export function registerMovingPlatform(body: Body, vel: { x: number; y: number }): void {
  movingPlatforms.set(body, vel);
}

export function clearMovingPlatforms(): void {
  movingPlatforms.clear();
}
