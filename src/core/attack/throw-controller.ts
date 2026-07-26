/**
 * core/attack/throw-controller — 弹药与投掷控制（GDD 17 §3.2–§3.3 / §5.2）。
 *
 * 纯逻辑、零 Phaser / 零平台 API（core 铁律）。管理：
 *   - 当前弹药 ammo / 上限 ammoCap / 冷却 cooldownTimer。
 *   - tryThrow(facing, ox, oy)：冷却/弹药校验 → 成功扣弹+置冷却+返回栗子弹丸，失败返回 null。
 *   - addAmmo(n)：关卡内栗子补给拾取（封顶 ammoCap）。
 *   - update(dtMs)：冷却衰减。
 *   - reset(startAmmo)：每关/重生复位。
 *
 * 全部数值来自 attack-config.json（禁止硬编码）。
 */
import { attackConfig } from '../config';
import { ChestnutProjectile } from './chestnut-projectile';

/** 投掷控制配置（来自 attack-config.json，强类型由消费方断言）。 */
export interface AttackConfig {
  chestnutSpeed: number;
  chestnutGravity: number;
  chestnutCooldownMs: number;
  chestnutMaxRange: number;
  chestnutWidth: number;
  chestnutHeight: number;
  ammoCap: number;
  ammoStart: number;
  pickupAmount: number;
  enemyStunMs: number;
  scorePerKill: number;
  multiJumpStageUnlock: string;
  multiJumpBonus: number;
}

export class ThrowController {
  ammo: number;
  readonly ammoCap: number;
  cooldownTimer: number;

  private readonly cfg: AttackConfig;

  constructor(cfg: AttackConfig = attackConfig as AttackConfig) {
    this.cfg = cfg;
    this.ammoCap = cfg.ammoCap;
    this.ammo = cfg.ammoStart;
    this.cooldownTimer = 0;
  }

  /**
   * 尝试投掷一枚栗子。
   * @param facing 朝向（1=右 / -1=左）
   * @param originX 出生 x（角色嘴前/手前，已外推）
   * @param originY 出生 y
   * @returns 成功 → ChestnutProjectile（调用方纳入列表并发 ON_CHESTNUT_THROWN）；失败（弹药 0 / 冷却中）→ null
   */
  tryThrow(facing: 1 | -1, originX: number, originY: number): ChestnutProjectile | null {
    if (this.ammo <= 0) return null;
    if (this.cooldownTimer > 0) return null;
    this.ammo -= 1;
    this.cooldownTimer = this.cfg.chestnutCooldownMs;
    const speed = this.cfg.chestnutSpeed;
    const vx = facing * speed;
    const vy = this.cfg.chestnutGravity; // 默认 0（直射，决策 D3）
    const p = new ChestnutProjectile(originX, originY, vx, vy, facing);
    return p;
  }

  /** 补给拾取：弹药 +n 并封顶 ammoCap（GDD 17 §3.3）。返回实际增加的弹药数。 */
  addAmmo(n: number): number {
    const before = this.ammo;
    this.ammo = Math.min(this.ammoCap, this.ammo + n);
    return this.ammo - before;
  }

  /** 每固定步冷却衰减（ms）。 */
  update(dtMs: number): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dtMs);
    }
  }

  /** 每关/重生复位弹药（默认 ammoStart）与冷却。 */
  reset(startAmmo: number = this.cfg.ammoStart): void {
    this.ammo = Math.min(this.ammoCap, startAmmo);
    this.cooldownTimer = 0;
  }
}
