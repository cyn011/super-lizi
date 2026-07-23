/**
 * core/enemy/enemy-ai — 敌人 AI（GDD 04 §3，E3.S1 表驱动状态机 + HazardSource）。
 *
 * 零 Phaser / 零平台 API（core 铁律）。每实例对应关卡一个敌人实体。
 * 行为表（S04-1，全部参数来自 enemy-config.json，禁止硬编码）：
 *   ci_li  → patrol：水平巡逻 speed，遇边缘（前方无地）或墙掉头；可踩。
 *   du_fu  → float ：原地正弦浮动（float=峰值竖直速度，amp=振幅）；可踩。
 *
 * 复用 C3 的 HazardSource 接口接入 damage-resolution；可踩时额外实现 StompableHazard
 * （getBounds / markStomped）供踩踏顶触判定。chong_feng / shi_pao 留 S04-2。
 *
 * EnemyState 取 GDD 04 §5 规范类型（enemy-types.ts），本模块通过 toState() 暴露快照。
 */
import type { Body } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import type { HazardSource, StompableHazard } from '../damage/hazard-source';
import type { EnemyState, EnemyTypeName } from './enemy-types';
import { enemyConfig } from '../config';

/** 单类敌人参数（全部来自 enemy-config.json，禁止硬编码）。 */
export interface EnemyConfigEntry {
  /** ci_li 巡逻水平速度（px/s）。 */
  speed?: number;
  /** du_fu 正弦浮速：峰值竖直速度（px/s）。 */
  float?: number;
  /** du_fu 振幅（px）。 */
  amp?: number;
  /** 是否可踩消灭。 */
  stompable: boolean;
  /** 碰撞盒宽（px）。 */
  width: number;
  /** 碰撞盒高（px）。 */
  height: number;
}

const DEFAULT_ENEMY_W = 24;
const DEFAULT_ENEMY_H = 24;

/**
 * 敌人 AI 实例（E3.S1）。一个实例 = 关卡一个敌人实体。
 * 表驱动：update 按 type 分派到对应行为；新增敌人类型只需扩表 + 扩 createEnemies。
 */
export class EnemyAI implements StompableHazard {
  readonly id: number;
  readonly type: EnemyTypeName;
  readonly isStompable: boolean;
  readonly enemyType: string;
  readonly width: number;
  readonly height: number;

  /** 当前位置 / 速度（世界坐标，px / px·s⁻¹）。 */
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** 状态名（'patrol' | 'float' | 'idle' | 'dead'），供调试/未来序列化。 */
  state: string;
  /** 是否已消灭（消灭后不再作为 hazard）。 */
  dead = false;

  private readonly cfg: EnemyConfigEntry;
  private dir: 1 | -1 = 1; // 巡逻方向（初始向右）
  private readonly baseY: number; // 嘟浮基准 y
  private phase = 0; // 嘟浮相位

  constructor(
    type: EnemyTypeName,
    x: number,
    y: number,
    id: number,
    config: typeof enemyConfig = enemyConfig,
  ) {
    this.type = type;
    this.id = id;
    this.enemyType = type;
    this.cfg = config[type] as EnemyConfigEntry;
    this.isStompable = this.cfg.stompable;
    this.width = this.cfg.width ?? DEFAULT_ENEMY_W;
    this.height = this.cfg.height ?? DEFAULT_ENEMY_H;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.state = type === 'ci_li' ? 'patrol' : type === 'du_fu' ? 'float' : 'idle';
  }

  /** 当前碰撞盒（供碰撞解算 / HazardSource.overlaps）。 */
  getBody(): Body {
    return { x: this.x, y: this.y, w: this.width, h: this.height, vx: this.vx, vy: this.vy };
  }

  /** StompableHazard：供 damage-resolution 做「玩家底触敌顶」判定。 */
  getBounds(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  /** GDD 04 §5 EnemyState 快照（调试 / 未来序列化）。 */
  toState(): EnemyState {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      hp: 1,
      state: this.state,
      stompable: this.isStompable,
      dead: this.dead,
    };
  }

  /** 每固定步推进（dt 秒）。死亡敌人不再更新。 */
  update(dt: number, world: CollisionWorld): void {
    if (this.dead) return;
    if (this.type === 'ci_li') this.updatePatrol(dt, world);
    else if (this.type === 'du_fu') this.updateFloat(dt);
  }

  // ── ci_li 巡逻：先探测前方边缘/墙，再移动（避免穿墙 / 掉坑）──
  private updatePatrol(dt: number, world: CollisionWorld): void {
    const speed = this.cfg.speed ?? 0;
    const frontX = this.dir > 0 ? this.x + this.width + 1 : this.x - 1;
    const footY = this.y + this.height + 1; // 脚前下方探地（边缘检测）
    const wallY = this.y + this.height / 2; // 身前中部探墙
    const groundAhead = this.isSolidAt(world, frontX, footY);
    const wallAhead = this.isSolidAt(world, frontX, wallY);
    if (!groundAhead || wallAhead) this.dir = (this.dir * -1) as 1 | -1;
    this.x += this.dir * speed * dt;
    this.vx = this.dir * speed;
  }

  // ── du_fu 正弦浮动：y = baseY + amp·sin(phase)，phase 以「峰值速度」推进一步 ──
  // 令 omega = floatSpeed / amp，则峰值竖直速度 = amp·omega = floatSpeed（数值全来自 config）。
  private updateFloat(dt: number): void {
    const floatSpeed = this.cfg.float ?? 0;
    const amp = this.cfg.amp ?? 0;
    const omega = amp > 0 ? floatSpeed / amp : 0; // rad/s，使峰值竖直速度 = floatSpeed
    this.phase += omega * dt;
    this.y = this.baseY + amp * Math.sin(this.phase);
    this.vy = floatSpeed * Math.cos(this.phase);
    this.vx = 0;
  }

  private isSolidAt(world: CollisionWorld, px: number, py: number): boolean {
    const ts = world.tileSize;
    const tx = Math.floor(px / ts);
    const ty = Math.floor(py / ts);
    return world.isSolidTile(tx, ty);
  }

  // ── HazardSource 实现 ──
  overlaps(body: Body): boolean {
    if (this.dead) return false; // 已消灭：不再作为 hazard
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

  /** 被踩消灭：标记死亡，overlaps 随即返回 false，场景跳过（从世界移除）。 */
  markStomped(): void {
    this.dead = true;
    this.state = 'dead';
  }
}

/**
 * 由关卡实体列表生成真实敌人（替代 C3 占位刺栗）。
 * 仅识别 S04-1 的 ci_li / du_fu；coin / checkpoint / 未来敌留待 S04-3 实体管线。
 * 零 Phaser / 零平台 API。
 */
export function createEnemies(
  entities: ReadonlyArray<{ type: string; x: number; y: number }>,
): EnemyAI[] {
  const out: EnemyAI[] = [];
  let id = 0;
  for (const e of entities) {
    if (e.type === 'ci_li' || e.type === 'du_fu') {
      out.push(new EnemyAI(e.type as EnemyTypeName, e.x, e.y, id++));
    }
  }
  return out;
}
