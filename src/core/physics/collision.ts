/**
 * core/physics/collision — AABB 分轴解算 / 单向平台 / 碰撞世界接口（GDD 02 §3 / 架构 §4.2）。
 * 纯 TS，零 Phaser。stepBody 在 body.ts 中调用本模块做分轴解算。
 */

/** 碰撞世界：提供 tile 网格的实心/单向查询（由关卡运行时注入）。 */
export interface CollisionWorld {
  tileSize: number;
  /** 网格宽（tile 数）。 */
  width: number;
  /** 网格高（tile 数）。 */
  height: number;
  /** (tx,ty) 是否为实心 tile（阻挡上下左右）。 */
  isSolidTile(tx: number, ty: number): boolean;
  /** (tx,ty) 是否为单向平台（仅下落时阻挡）。 */
  isOneWayTile(tx: number, ty: number): boolean;
}

/** 与 body 当前 AABB 重叠的实心 tile 坐标列表。 */
export function overlappingSolidTiles(
  body: { x: number; y: number; w: number; h: number },
  world: CollisionWorld,
): Array<{ tx: number; ty: number }> {
  const ts = world.tileSize;
  const x0 = Math.floor(body.x / ts);
  const x1 = Math.floor((body.x + body.w - 1e-6) / ts);
  const y0 = Math.floor(body.y / ts);
  const y1 = Math.floor((body.y + body.h - 1e-6) / ts);
  const out: Array<{ tx: number; ty: number }> = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (world.isSolidTile(tx, ty)) out.push({ tx, ty });
    }
  }
  return out;
}

/**
 * X 轴解算：body 已按 vx*dt 移动后调用。按运动方向把 body 推回最近实心 tile 边。
 * 返回是否撞墙（用于角色水平速度清零）。
 */
export function resolveAxisX(
  body: { x: number; y: number; w: number; h: number; vx: number },
  world: CollisionWorld,
): { hitLeft: boolean; hitRight: boolean } {
  const ts = world.tileSize;
  const dir = body.vx > 0 ? 1 : body.vx < 0 ? -1 : 0;
  const result = { hitLeft: false, hitRight: false };
  if (dir === 0) return result;
  const tiles = overlappingSolidTiles(body, world);
  if (tiles.length === 0) return result;
  if (dir > 0) {
    let minLeft = Infinity;
    for (const t of tiles) minLeft = Math.min(minLeft, t.tx * ts);
    body.x = minLeft - body.w;
    result.hitRight = true;
  } else {
    let maxRight = -Infinity;
    for (const t of tiles) maxRight = Math.max(maxRight, (t.tx + 1) * ts);
    body.x = maxRight;
    result.hitLeft = true;
  }
  body.vx = 0;
  return result;
}

/**
 * Y 轴解算：body 已按 vy*dt 移动后调用。下落时同时阻挡实心与单向平台。
 * 返回是否着地 / 撞顶（groundPlatform 暂未实现移动平台随动，留待 E2.S4）。
 */
export function resolveAxisY(
  body: { x: number; y: number; w: number; h: number; vy: number },
  world: CollisionWorld,
  prevBottom: number,
): { grounded: boolean; hitCeiling: boolean } {
  const ts = world.tileSize;
  const dir = body.vy > 0 ? 1 : body.vy < 0 ? -1 : 0;
  const result = { grounded: false, hitCeiling: false };

  // 实心 tile 双向阻挡
  const solid = overlappingSolidTiles(body, world);
  if (solid.length > 0 && dir !== 0) {
    if (dir > 0) {
      let minTop = Infinity;
      for (const t of solid) minTop = Math.min(minTop, t.ty * ts);
      body.y = minTop - body.h;
      result.grounded = true;
    } else {
      let maxBottom = -Infinity;
      for (const t of solid) maxBottom = Math.max(maxBottom, (t.ty + 1) * ts);
      body.y = maxBottom;
      result.hitCeiling = true;
    }
    body.vy = 0;
    return result;
  }

  // 单向平台：仅当上一帧底在平台顶之上、且本帧下落时阻挡
  if (dir > 0) {
    const x0 = Math.floor(body.x / ts);
    const x1 = Math.floor((body.x + body.w - 1e-6) / ts);
    const bottomTile = Math.floor((body.y + body.h - 1e-6) / ts);
    for (let tx = x0; tx <= x1; tx++) {
      if (world.isOneWayTile(tx, bottomTile)) {
        const platTop = bottomTile * ts;
        if (prevBottom <= platTop + 1e-3) {
          body.y = platTop - body.h;
          body.vy = 0;
          result.grounded = true;
          break;
        }
      }
    }
  }
  return result;
}
