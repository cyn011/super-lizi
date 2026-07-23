/**
 * core/damage/damage-state-machine — 受伤状态机（GDD 07，E2.S4）。
 *
 * 纯逻辑、确定性、零 Phaser / 零平台依赖。时间来自注入的 dtMs；
 * 禁止 Math.random / Date.now（core 层铁律）。所有数值来自 damage-config.json。
 *
 * 状态转移：
 *   FULL ──hit──▶ SMALL ──hit──▶ DEAD
 *   DEAD 且无命 → gameOver；DEAD 且有命 → 立即重生 FULL（带重生无敌帧）。
 *   FULL/SMALL 受击均受「无敌帧」保护。
 */
import { damageConfig } from '../config';

/** 受伤配置（来自 damage-config.json，禁止硬编码）。 */
export interface DamageConfig {
  invincibleMs: number;
  fullScale: number;
  smallScale: number;
  /** 命中后水平击退速度（px/s，远离源）。 */
  knockbackSpeed: number;
  /** 命中后向上冲量（px/s，取负为向上）。 */
  knockbackUp: number;
  /** 击退后短暂失控时长（ms）：期间跳过 controller.consume，仅物理积分击退（R3）。 */
  hitstunMs: number;
  /** 初始命数（由场景取用，经 Economy/06 接入后可被 economyConfig 覆盖）。 */
  initialLives: number;
}

export type DamageState = 'FULL' | 'SMALL' | 'DEAD';

export class DamageStateMachine {
  state: DamageState = 'FULL';
  /** 无敌帧剩余时间（ms）。 */
  invincibleTimer = 0;
  lives: number;
  /** 当前形态（重生后归位 BASE）。 */
  form: 'BASE' = 'BASE';
  private cfg: DamageConfig;

  constructor(initialLives: number, config: DamageConfig = damageConfig) {
    this.lives = initialLives;
    this.cfg = config;
  }

  /**
   * 受击：无敌帧内忽略；FULL→SMALL；SMALL→DEAD 并扣命，有命则立即重生 FULL，无命则 gameOver。
   * DEAD 状态再受击忽略（除非已重生为 FULL，那时走 FULL 分支）。
   */
  hit(): void {
    if (this.invincibleTimer > 0) return; // 无敌帧保护

    if (this.state === 'FULL') {
      this.state = 'SMALL';
      this.invincibleTimer = this.cfg.invincibleMs;
      return;
    }

    if (this.state === 'SMALL') {
      this.state = 'DEAD';
      this.lives -= 1;
      if (this.lives > 0) {
        // 立即重生
        this.state = 'FULL';
        this.form = 'BASE';
        this.invincibleTimer = this.cfg.invincibleMs;
      } else {
        this.lives = 0; // 防止负命数
      }
      return;
    }

    // state === 'DEAD' → 忽略
  }

  /** 每固定步递减无敌计时（ms），钳≥0。 */
  update(dtMs: number): void {
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dtMs);
  }

  /** 回到 FULL（重生/关卡重置），form 设值，无敌清零。 */
  reset(form: 'BASE' = 'BASE'): void {
    this.state = 'FULL';
    this.form = form;
    this.invincibleTimer = 0;
  }

  /** 碰撞盒缩放（FULL=1 / SMALL=0.6）；他系统只读，禁止直改。 */
  get sizeScale(): number {
    return this.state === 'SMALL' ? this.cfg.smallScale : this.cfg.fullScale;
  }

  /** 游戏结束：DEAD 且命数耗尽。 */
  get isGameOver(): boolean {
    return this.state === 'DEAD' && this.lives <= 0;
  }
}
