/**
 * core/enemy/projectile — 弹丸（独立 hazard，碰玩家受伤；GDD 04 §3，E3.S2）。
 *
 * 纯逻辑、零 Phaser / 零平台依赖（core 层铁律）。每固定步积分移动；飞出世界边界或撞墙 →
 * 标记 dead（由 game-scene 从弹丸列表移除）。实现 HazardSource（isStompable=false），
 * 与 C3 占位刺栗走同一「玩家受伤」分支（原 C3 逻辑，本 Story 不消灭弹丸）。
 *
 * 尺寸来自 enemy-config.json 的 projectile 项（禁止硬编码）；速度由石炮 fire 时按
 * shi_pao.projSpeed 注入（见 enemy-ai.ts 的 shi_pao 行为），保证数值全来自 config。
 */
import type { Body } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import type { HazardSource } from '../damage/hazard-source';
import { enemyConfig } from '../config';

/** 弹丸尺寸配置（来自 enemy-config.json 的 projectile 项）。 */
interface ProjectileConfigEntry {
  width?: number;
  height?: number;
}

export class Projectile implements HazardSource {
  /** 全局自增 id（渲染键 / 去重，保证跨实例唯一）。 */
  static nextId = 1;
  readonly id: number;
  /** 弹丸不可踩（碰玩家即受伤，与踩踏互斥）。 */
  readonly isStompable = false;
  readonly width: number;
  readonly height: number;
  /** 当前位置（世界坐标，px）。 */
  x: number;
  y: number;
  /** 速度（px/s），由石炮 fire 时按方向 × projSpeed 注入。 */
  vx: number;
  vy: number;
  /** 是否已失效（越界/撞墙），失效后 overlaps 返回 false 并由场景移除。 */
  dead = false;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    id: number = Projectile.nextId++,
  ) {
    this.id = id;
    const cfg = (enemyConfig as Record<string, ProjectileConfigEntry>).projectile ?? {};
    this.width = cfg.width ?? 10;
    this.height = cfg.height ?? 10;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  /** 每固定步积分移动；越界（左/右/顶/底封边外）或撞墙 → dead。 */
  update(dt: number, world: CollisionWorld): void {
    if (this.dead) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const ts = world.tileSize;
    const outOfBounds =
      this.x < 0 ||
      this.y < 0 ||
      this.x > world.width * ts ||
      this.y > world.height * ts;
    if (outOfBounds) {
      this.dead = true;
      return;
    }
    const cx = Math.floor((this.x + this.width / 2) / ts);
    const cy = Math.floor((this.y + this.height / 2) / ts);
    if (world.isSolidTile(cx, cy)) {
      this.dead = true;
    }
  }

  overlaps(body: Body): boolean {
    if (this.dead) return false;
    return (
      body.x < this.x + this.width &&
      body.x + body.w > this.x &&
      body.y < this.y + this.height &&
      body.y + body.h > this.y
    );
  }

  knockbackDir(body: Body): 1 | -1 {
    return body.x + body.w / 2 < this.x + this.width / 2 ? 1 : -1;
  }

  /** 当前 AABB（供渲染 / 调试）。 */
  getBounds(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }
}
