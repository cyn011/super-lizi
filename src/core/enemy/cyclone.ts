/**
 * core/enemy/cyclone — 气旋（cyclone）上升气流力场（GDD 15 §3，纯函数，零平台）。
 *
 * 区域力场（纯辅助、非实体）：玩家 body 与气柱 bbox 重叠期间施加向上加速度（净向上），
 * 并钳制上升速度；离场恢复纯重力。零渲染框架与平台 API 依赖。可 headless 单测。
 *
 * 落地形态：实体承载（entities[]），anchorY = 地面顶 y；气柱自 anchorY 向上延伸 h
 * （GDD 15 §3.2 / 2-3 content-spec §2：y=224 地面锚点、气柱向上）。故调用方传入
 * cy = anchorY - h（气柱「顶」），bbox = [cx-w/2, cx+w/2] × [cy, cy+h]（GDD 15 §2 公式）。
 */
import type { Body } from '../physics/body';

/** 力场数值（全部来自 enemy-config.json 的 cyclone 项，禁止硬编码）。 */
export interface CycloneCfg {
  /** 上抛加速度（px/s²，向上为正；套用时 ay=-liftAcc，因 Y 向下为正）。默认 2600。 */
  liftAcc: number;
  /** 上升速度上限（px/s，正值；套用 vy=max(vy,-riseMax)）。默认 220。 */
  riseMax: number;
  /** 水平拖拽系数（1/s，默认 0=保留完整操控）。 */
  dragX: number;
  /** 气柱宽（px）。 */
  width: number;
  /** 气柱高（px）。 */
  height: number;
  /** 漩涡动画角速度（rad/s，仅视觉）。 */
  phaseSpeed: number;
  /** 恒 false（纯辅助，无伤害）。 */
  hazard: boolean;
}

/** stepCyclone 单步返回值。 */
export interface CycloneStep {
  /** 漩涡动画相位（0..2π，时间推进，仅渲染）。 */
  phase: number;
  /** 玩家是否位于气柱内。 */
  inZone: boolean;
  /** 本帧水平力贡献（px/s²；默认 0，dragX>0 时作回中拖拽）。 */
  fx: number;
  /** 本帧垂直力贡献（px/s²，向上为负；inZone 时 =-liftAcc，否则 0）。 */
  fy: number;
}

/** 默认 cfg（GDD 15 §3.1）。 */
export const DEFAULT_CYCLONE_CFG: CycloneCfg = {
  liftAcc: 2600,
  riseMax: 220,
  dragX: 0,
  width: 96,
  height: 160,
  phaseSpeed: 3.0,
  hazard: false,
};

/** 玩家 body 只读视图（stepCyclone 仅读，不写）。 */
export type PlayerBody = Pick<Body, 'x' | 'y' | 'w' | 'h' | 'vx' | 'vy'>;

/**
 * 玩家是否位于气柱内（AABB 相交）。
 * @param cx 气柱中心 x（= colLeft + w/2）
 * @param cy 气柱顶 y（= anchorY - h，气柱自此处向下延伸 h；见本文件头注释）
 */
export function cycloneInZone(cfg: CycloneCfg, cx: number, cy: number, player: PlayerBody): boolean {
  const halfW = cfg.width / 2;
  return (
    player.x < cx + halfW &&
    player.x + player.w > cx - halfW &&
    player.y < cy + cfg.height &&
    player.y + player.h > cy
  );
}

/**
 * 单步力场纯函数（GDD 15 §3.3）。
 * @param cfg 力场数值
 * @param player 玩家只读 body（集成层传入，零平台派生）
 * @param dt 步长（秒，固定步长 1/60）
 * @param prevPhase 上一帧漩涡相位（状态在集成层保持，纯函数不持有）
 * @param cx 气柱中心 x
 * @param cy 气柱顶 y（anchorY - h）
 * @returns { phase, inZone, fx, fy } —— 集成层 stepBody 后叠加：
 *          vy += fy*dt（并钳 max(·,-riseMax)）；vx += fx*dt（dragX>0 时）
 */
export function stepCyclone(
  cfg: CycloneCfg,
  player: PlayerBody,
  dt: number,
  prevPhase: number,
  cx: number,
  cy: number,
): CycloneStep {
  const halfW = cfg.width / 2;
  const inZone = cycloneInZone(cfg, cx, cy, player);
  // 垂直力：inZone → 向上加速度 -liftAcc（Y 向下为正）；离场 → 0（恢复纯重力）。
  const fy = inZone ? -cfg.liftAcc : 0;
  // 水平力：默认 dragX=0 → 保留完整操控；dragX>0 作朝柱心轻回中（帮助留在气流）。
  let fx = 0;
  if (inZone && cfg.dragX > 0) {
    const pcx = player.x + player.w / 2;
    fx = -cfg.dragX * (pcx - cx);
  }
  // 漩涡相位（仅渲染）：时间推进，mod 2π。
  const phase = (prevPhase + cfg.phaseSpeed * dt) % (2 * Math.PI);
  return { phase, inZone, fx, fy };
}

/**
 * 力场套用（集成层在 stepBody 后调用，GDD 15 §3.3 / §4）。
 * 直接改写玩家 body 速度：vy 施加 fy（向上为负）并钳制最大上升速度；vx 施加 fx。
 * 离场（inZone=false）时不改写（自然恢复重力）。
 */
export function applyCycloneForce(step: CycloneStep, body: Body, dt: number, riseMax: number): void {
  if (!step.inZone) return;
  body.vy += step.fy * dt;
  // 钳制最大上升速度（防无限加速 / 飘出屏）：vy 向上为负 → max(vy, -riseMax)
  if (body.vy < -riseMax) body.vy = -riseMax;
  body.vx += step.fx * dt;
}
