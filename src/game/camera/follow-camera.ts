/**
 * game/camera/follow-camera — 关卡相机跟随（C5，F9）。
 *
 * 跟随玩家 x、钳制到关卡边界：scrollX = clamp(player.x - LOGICAL_WIDTH/2, 0, levelWidth - LOGICAL_WIDTH)。
 * 关宽 1280 > 逻辑宽 512 → 必须跟随才能看到全程；纵向关高 == 逻辑高 → 不滚动。
 *
 * 关键约束（main.ts R2）：微信端 type=Phaser.CANVAS / scale.mode=Scale.NONE，相机滚动走
 * Phaser 内部 camera transform（非 CSS transform），故两端行为一致、不依赖 DOM/CSS。
 *
 * 本模块零 Phaser 运行时依赖（相机参数用结构化最小接口，便于 vitest 单测钳制数学），
 * 仅 game 层使用。
 */
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../../platform/detect';

/** 可被相机滚动的最小接口（Phaser.Cameras.Scene2D.Camera 结构兼容）。 */
export interface ScrollableCamera {
  scrollX: number;
  scrollY: number;
}

/** 纯函数：由目标中心计算相机 scroll（钳制到关卡边界）。可被单测直接验证。 */
export function computeCameraScroll(
  targetX: number,
  targetY: number,
  levelWidth: number,
  levelHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(0, levelWidth - LOGICAL_WIDTH);
  const maxY = Math.max(0, levelHeight - LOGICAL_HEIGHT);
  return {
    x: clamp(targetX - LOGICAL_WIDTH / 2, 0, maxX),
    y: clamp(targetY - LOGICAL_HEIGHT / 2, 0, maxY),
  };
}

/** 关卡相机跟随器：每帧用玩家中心驱动 scrollX/scrollY。 */
export class FollowCamera {
  constructor(
    private readonly cam: ScrollableCamera,
    private readonly levelWidth: number,
    private readonly levelHeight: number,
  ) {}

  /** 跟随目标中心（通常传 body 中心）。 */
  follow(targetCenterX: number, targetCenterY: number): void {
    const s = computeCameraScroll(targetCenterX, targetCenterY, this.levelWidth, this.levelHeight);
    this.cam.scrollX = s.x;
    this.cam.scrollY = s.y;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
