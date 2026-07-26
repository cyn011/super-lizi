/**
 * core/attack/chestnut-projectile — 栗子弹丸（扔栗子机制，GDD 17 §3.2 / §5.2）。
 *
 * 纯逻辑、零 Phaser / 零平台 API（core 铁律），与 core/enemy/projectile.ts 同构。
 * 默认水平直射、无重力（chestnutGravity=0，决策 D3）；飞出最大射程 / 越界 / 撞墙 → dead。
 * 与玩家 body 无关（己方弹丸），不触发受伤；与石炮炮弹（Projectile）对消由 game-scene 处理。
 *
 * 尺寸 / 速度全部来自 attack-config.json（禁止硬编码）。
 */
import type { Body } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import { attackConfig } from '../config';

export class ChestnutProjectile {
  /** 自增 id（渲染键 / 去重，跨实例唯一）。 */
  static nextId = 1;

  readonly id: number;
  readonly width: number;
  readonly height: number;
  /** 朝向（1=右 / -1=左），渲染/方向提示用。 */
  readonly facing: 1 | -1;
  /** 当前位置（世界坐标，px）。 */
  x: number;
  y: number;
  /** 速度（px/s）。直射：vx=facing*speed，vy=0。 */
  vx: number;
  vy: number;
  /** 已飞行距离（px），达 chestnutMaxRange → dead。 */
  traveled = 0;
  /** 是否已失效（越界/撞墙/达射程），失效后 overlaps 返回 false 并由场景移除。 */
  dead = false;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    facing: 1 | -1,
    id: number = ChestnutProjectile.nextId++,
  ) {
    this.id = id;
    this.width = attackConfig.chestnutWidth ?? 12;
    this.height = attackConfig.chestnutHeight ?? 12;
    this.facing = facing;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  /** 每固定步积分移动；越界 / 撞墙 / 达最大射程 → dead（决策 D3 / §3.6）。 */
  update(dt: number, world: CollisionWorld): void {
    if (this.dead) return;
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    this.x += dx;
    this.y += dy;
    this.traveled += Math.abs(dx) + Math.abs(dy);

    // 达最大射程 → dead（puff）
    if (this.traveled >= (attackConfig.chestnutMaxRange ?? 320)) {
      this.dead = true;
      return;
    }

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

  /** 与玩家/AABB 重叠判定（供 game-scene 做敌人/炮弹对消；己方 body 忽略）。 */
  overlaps(body: Body): boolean {
    if (this.dead) return false;
    return (
      body.x < this.x + this.width &&
      body.x + body.w > this.x &&
      body.y < this.y + this.height &&
      body.y + body.h > this.y
    );
  }

  /** 与任意 AABB（x,y,w,h）重叠（供 game-scene 做敌人/炮弹命中；敌人非 Body 结构，故用裸矩形）。 */
  overlapsRect(x: number, y: number, w: number, h: number): boolean {
    if (this.dead) return false;
    return (
      x < this.x + this.width &&
      x + w > this.x &&
      y < this.y + this.height &&
      y + h > this.y
    );
  }

  /** 当前 AABB（供渲染 / 调试）。 */
  getBounds(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }
}
