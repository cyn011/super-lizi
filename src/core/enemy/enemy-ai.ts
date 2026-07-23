/**
 * core/enemy/enemy-ai — 敌人 AI（GDD 04 §3，E3.S1/S2 表驱动状态机 + HazardSource）。
 *
 * 零 Phaser / 零平台 API（core 铁律）。每实例对应关卡一个敌人实体。
 * 行为表（参数全部来自 enemy-config.json，禁止硬编码）：
 *   ci_li      → patrol：水平巡逻 speed，遇边缘（前方无地）或墙掉头；可踩。
 *   du_fu      → float ：原地正弦浮动（float=峰值竖直速度，amp=振幅）；可踩。
 *   chong_feng → idle→detect（玩家在 detect 内且高度差<attackRange）→charge（朝玩家直线
 *                chargeSpeed）→wallHit（撞墙 stun=stunMs 回 idle）；不可踩（踩它玩家受伤）。
 *                stun 期 non-hazard（sprint plan §1.2，可被安全越过）。
 *   shi_pao    → 定时 fireInterval 朝玩家方向 fire 生成 Projectile（独立 hazard）；不可踩。
 *
 * 复用 C3 的 HazardSource 接口接入 damage-resolution；可踩时额外实现 StompableHazard
 * （getBounds / markStomped）供踩踏顶触判定。chong_feng / shi_pao 实现 HazardSource 且
 * isStompable=false → 走「玩家受伤」分支（原 C3 逻辑，本 Story 不消灭敌人）。
 *
 * update(dt, world, player?) 返回本步由 shi_pao 产出的 Projectile[]（空数组表示无产出），
 * 交由 game-scene 管理弹丸列表。
 *
 * EnemyState 取 GDD 04 §5 规范类型（enemy-types.ts），本模块通过 toState() 暴露快照。
 */
import type { Body } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import type { HazardSource, StompableHazard } from '../damage/hazard-source';
import type { EnemyState, EnemyTypeName } from './enemy-types';
import { enemyConfig } from '../config';
import { Projectile } from './projectile';

/** 单类敌人参数（全部来自 enemy-config.json，禁止硬编码）。 */
export interface EnemyConfigEntry {
  /** ci_li 巡逻水平速度（px/s）。 */
  speed?: number;
  /** du_fu 正弦浮速：峰值竖直速度（px/s）。 */
  float?: number;
  /** du_fu 振幅（px）。 */
  amp?: number;
  /** chong_feng：检测水平半径（px），玩家中心水平距 ≤ detect 才进入 detect。 */
  detect?: number;
  /** chong_feng：冲锋水平速度（px/s）。 */
  chargeSpeed?: number;
  /** chong_feng：撞墙眩晕时长（ms），眩晕结束回 idle。 */
  stun?: number;
  /** chong_feng：检测垂直容差（px），高度差 < attackRange 才触发 detect（GDD 04：<48）。 */
  attackRange?: number;
  /** shi_pao：开火间隔（ms），每 fireInterval 朝玩家发射一枚弹丸。 */
  fireInterval?: number;
  /** shi_pao：弹丸速度（px/s），fire 时按朝向注入。 */
  projSpeed?: number;
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
  private dir: 1 | -1 = 1; // 巡逻/冲锋方向（初始向右）
  private readonly baseY: number; // 嘟浮基准 y
  private phase = 0; // 嘟浮相位
  /** chong_feng 眩晕剩余（ms）。 */
  private stunTimer = 0;
  /** shi_pao 开火计时（ms），累计到 fireInterval 触发一次 fire。 */
  private fireTimer = 0;
  /** shi_pao 开火口闪光计时（ms，仅视觉，由 game-scene 渲染读取）。 */
  private fireFlash = 0;
  /** shi_pao 最近一次瞄准方向（单位向量，默认朝左=玩家来向）；fire 时更新。 */
  private aimX = -1;
  private aimY = 0;

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

  /** 当前朝向（1=右 / -1=左），渲染楔形前尖 / 眼睛用。 */
  get facing(): 1 | -1 {
    return this.dir;
  }

  /** 最近一次瞄准方向（单位向量），渲染炮口朝向用。 */
  get aim(): { x: number; y: number } {
    return { x: this.aimX, y: this.aimY };
  }

  /** 开火口闪光剩余（ms），>0 时渲染炮口闪光。 */
  get flash(): number {
    return this.fireFlash;
  }

  /**
   * 每固定步推进（dt 秒）。死亡敌人不再更新。
   * @param player 玩家碰撞盒（chong_feng detect / shi_pao aim 需要；ci_li/du_fu 可省）。
   * @returns 本步由 shi_pao 产出的弹丸（无则空数组）。
   */
  update(dt: number, world: CollisionWorld, player?: Body): Projectile[] {
    if (this.dead) return [];
    if (this.fireFlash > 0) this.fireFlash = Math.max(0, this.fireFlash - dt * 1000);
    if (this.type === 'ci_li') {
      this.updatePatrol(dt, world);
      return [];
    }
    if (this.type === 'du_fu') {
      this.updateFloat(dt);
      return [];
    }
    if (this.type === 'chong_feng') return this.updateChongFeng(dt, world, player);
    if (this.type === 'shi_pao') return this.updateShiPao(dt, player);
    return [];
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

  // ── chong_feng 冲锋：idle 探测玩家 → charge 直线冲锋 → 撞墙 stun → 回 idle ──
  // detect：玩家中心水平距 ≤ detect 且垂直差 < attackRange（GDD 04：高度差 <48）。
  // charge：朝锁定方向 chargeSpeed 直线；前方（CollisionWorld 实体 tile 或越界封边）阻挡 → stun。
  // stun：静止 stunMs，归零回 idle（stun 期 overlaps 返回 false → non-hazard，sprint plan §1.2）。
  private updateChongFeng(dt: number, world: CollisionWorld, player?: Body): Projectile[] {
    if (this.state === 'idle') {
      this.vx = 0;
      if (player) {
        const dx = player.x + player.w / 2 - (this.x + this.width / 2);
        const dy = player.y + player.h / 2 - (this.y + this.height / 2);
        const detect = this.cfg.detect ?? 0;
        const vRange = this.cfg.attackRange ?? 0;
        if (Math.abs(dx) <= detect && Math.abs(dy) <= vRange) {
          this.dir = dx >= 0 ? 1 : -1;
          this.state = 'charge';
          this.vx = this.dir * (this.cfg.chargeSpeed ?? 0); // 立即起步冲锋（同帧进入 charge）
        }
      }
    } else if (this.state === 'charge') {
      const speed = this.cfg.chargeSpeed ?? 0;
      this.vx = this.dir * speed;
      this.x += this.vx * dt; // 直线冲锋（固定 y，不计入重力，符合「朝玩家方向直线」）
      const frontX = this.dir > 0 ? this.x + this.width + 1 : this.x - 1;
      const midY = this.y + this.height / 2;
      if (this.isSolidAt(world, frontX, midY)) {
        this.state = 'stun';
        this.stunTimer = this.cfg.stun ?? 0;
        this.vx = 0;
      }
    } else if (this.state === 'stun') {
      this.vx = 0;
      this.stunTimer -= dt * 1000;
      if (this.stunTimer <= 0) {
        this.state = 'idle';
        this.stunTimer = 0;
      }
    }
    return [];
  }

  // ── shi_pao 固定炮台：定时 fireInterval 朝玩家方向发射一枚 Projectile（独立 hazard）──
  // 静态 turret（vx/vy=0）；fireTimer 累计到 fireInterval 且有玩家目标时 fire，
  // 重置计时并产出朝玩家归一化方向 × projSpeed 的弹丸。无玩家目标不发射（避免盲射）。
  private updateShiPao(dt: number, player?: Body): Projectile[] {
    this.vx = 0;
    this.vy = 0;
    this.state = 'idle'; // 静态炮台，状态每帧复位（仅 fire 当帧闪烁）
    this.fireTimer += dt * 1000;
    const interval = this.cfg.fireInterval ?? Infinity;
    if (this.fireTimer >= interval && player) {
      this.fireTimer = 0;
      this.state = 'fire';
      this.fireFlash = 120; // 仅视觉闪光
      const pcx = this.x + this.width / 2;
      const pcy = this.y + this.height / 2;
      const tx = player.x + player.w / 2;
      const ty = player.y + player.h / 2;
      let dx = tx - pcx;
      let dy = ty - pcy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      this.aimX = dx;
      this.aimY = dy;
      const speed = this.cfg.projSpeed ?? 0;
      // 炮口外推一点出生，避免与炮台自身重叠误伤
      const mx = pcx + dx * (this.width / 2 + 2);
      const my = pcy + dy * (this.height / 2 + 2);
      return [new Projectile(mx, my, dx * speed, dy * speed)];
    }
    return [];
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
    if (this.state === 'stun') return false; // chong_feng 眩晕期 non-hazard（可被安全越过）
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
 * 识别 ci_li / du_fu / chong_feng / shi_pao 四类；coin / checkpoint / 未来实体留待各自管线。
 * 零 Phaser / 零平台 API。
 */
export function createEnemies(
  entities: ReadonlyArray<{ type: string; x: number; y: number }>,
): EnemyAI[] {
  const out: EnemyAI[] = [];
  let id = 0;
  for (const e of entities) {
    if (
      e.type === 'ci_li' ||
      e.type === 'du_fu' ||
      e.type === 'chong_feng' ||
      e.type === 'shi_pao'
    ) {
      out.push(new EnemyAI(e.type as EnemyTypeName, e.x, e.y, id++));
    }
  }
  return out;
}
