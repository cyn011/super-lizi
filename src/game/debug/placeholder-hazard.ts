/**
 * game/debug/placeholder-hazard — C3 管线验证用占位伤害源（非 MVP 敌，E3 前占位）。
 *
 * 实现 core 的 HazardSource 接口；逻辑（overlaps/knockbackDir）在 game/（允许 Phaser）。
 * 静态刺栗：仅造成伤害、不可踩（isStompable=false）。渲染落到 game/（Phaser Graphics），
 * 零逻辑入侵 core；Phaser 仅作类型引用（import type），运行时零依赖，可被 headless 测试安全导入。
 */
import type Phaser from 'phaser';
import type { Body } from '../../core/physics/body';
import type { HazardSource } from '../../core/damage/hazard-source';

const HAZARD_COLOR = 0xe8483b; // 警示红（placeholder-spec §1.2 刺栗）
const OUTLINE_COLOR = 0x2a1a12; // 近黑棕描边（placeholder-spec §0 通用约定）

/**
 * C3 占位刺栗。构造于世界坐标（x,y 为左上角，w/h 默认 24）。
 * isStompable=false：占位敌仅伤害，不可踩（与真实刺栗的踩踏语义区分，未来 E3 另定）。
 */
export class PlaceholderHazard implements HazardSource {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly isStompable = false;

  constructor(x: number, y: number, w = 24, h = 24) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  /** AABB 重叠判定（与 body 碰撞盒）。 */
  overlaps(body: Body): boolean {
    return (
      body.x < this.x + this.w &&
      body.x + body.w > this.x &&
      body.y < this.y + this.h &&
      body.y + body.h > this.y
    );
  }

  /** 远离源的水平方向：玩家中心在源左侧→向右推(1)，右侧→向左推(-1)。 */
  knockbackDir(body: Body): 1 | -1 {
    return body.x + body.w / 2 < this.x + this.w / 2 ? 1 : -1;
  }

  /** 在世界坐标绘制静态刺栗（相机滚动时随 Graphics 容器自动偏移）。 */
  draw(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(HAZARD_COLOR, 1);
    g.fillRect(this.x, this.y, this.w, this.h);
    g.lineStyle(1, OUTLINE_COLOR, 1);
    g.strokeRect(this.x, this.y, this.w, this.h);
    // 顶部小刺点（双编码，增强辨识，见 placeholder-spec §1.2）
    g.fillStyle(OUTLINE_COLOR, 1);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const sx = this.x + (i + 0.5) * (this.w / n);
      g.fillTriangle(sx - 2, this.y, sx + 2, this.y, sx, this.y - 4);
    }
  }
}
