/**
 * core/economy/economy — 经济 / 分数（GDD 06，E4.S2 真实实现）。
 *
 * 纯逻辑、确定性、零 Phaser / 零平台依赖（架构铁律：core 零平台 API）。
 * 时间来自注入的 dtMs；禁止 Math.random / Date.now。
 * 所有数值来自 economy-config.json（经 core/config 读取），零硬编码。
 *
 * 订阅事件（由 game-scene 转发）：ON_STOMP / ON_COIN / ON_LEVEL_COMPLETE / ON_DEATH。
 * 连击倍率：仅「踩怪」计入连击；连击窗口 comboWindowMs 内连续踩怪 combo++，
 *   mult = min(maxMult, 1 + comboCount * comboStep)，窗口超时清零（comboCount=0, comboMult=1）。
 *
 * 设计要点：
 * - EconomyController 持有 EconomyState，方法直接 mutate state（确定性、可单测）。
 * - 生命(lives) 不在此处管理 —— 由 DamageStateMachine（GDD 07）持有，本模块只接收 ON_DEATH 做连击重置。
 * - 屏幕分数 UI 不在此绘制（ui 层 S04-5 负责），本模块只负责数值与 ON_SCORE_CHANGED 发放点由调用方触发。
 */
import { economyConfig as defaultEconomyConfig } from '../config';

/** 经济配置（来自 economy-config.json，禁止硬编码）。 */
export interface EconomyConfig {
  /** 初始命数（仅作契约对齐；实际 lives 由 DamageStateMachine 持有）。 */
  initialLives: number;
  /** 踩怪基础分。 */
  stompScore: number;
  /** 金币分。 */
  coinScore: number;
  /** 通关（到达凯旋之门）附加分。 */
  goalScore: number;
  /** 连击窗口（ms）：窗口内连续踩怪累加连击。 */
  comboWindowMs: number;
  /** 连击倍率上限（封顶 ×maxMult）。 */
  maxMult: number;
  /** 每连击步的倍率增量：mult = min(maxMult, 1 + comboCount * comboStep)。 */
  comboStep: number;
}

/** 运行时经济状态（GDD 06 §5，仅分数/金币/连击，lives 在伤害状态机）。 */
export interface EconomyState {
  /** 累计分数（踩怪 + 金币 + 通关）。 */
  score: number;
  /** 累计金币数。 */
  coins: number;
  /** 当前连击数（仅踩怪累加）。 */
  comboCount: number;
  /** 当前连击倍率（封顶 maxMult）。 */
  comboMult: number;
  /** 连击窗口剩余时间（ms）；>0 表示连击有效中。 */
  comboTimerMs: number;
}

/** 初始经济状态（分数/金币/连击归零，倍率=1）。 */
export function createEconomyState(): EconomyState {
  return {
    score: 0,
    coins: 0,
    comboCount: 0,
    comboMult: 1,
    comboTimerMs: 0,
  };
}

/**
 * 经济/分数控制器（S04-4）。持有 EconomyState，响应事件方法 mutate state。
 * 纯逻辑、确定性、零平台 API。
 */
export class EconomyController {
  /** 当前经济状态（调用方读取后用于 ON_SCORE_CHANGED payload / HUD）。 */
  state: EconomyState;
  private cfg: EconomyConfig;

  constructor(config: EconomyConfig = defaultEconomyConfig as EconomyConfig) {
    this.cfg = config;
    this.state = createEconomyState();
  }

  /**
   * 踩怪（ON_STOMP）：分数 += stompScore * 当前 comboMult（先按当前倍率计分）；
   * 连击 +1；刷新倍率（封顶）；刷新连击窗口。连击仅由踩怪累加。
   */
  onStomp(): void {
    this.state.score += this.cfg.stompScore * this.state.comboMult;
    this.state.comboCount += 1;
    this.state.comboMult = Math.min(
      this.cfg.maxMult,
      1 + this.state.comboCount * this.cfg.comboStep,
    );
    this.state.comboTimerMs = this.cfg.comboWindowMs;
  }

  /** 金币（ON_COIN）：金币 +1；分数 += coinScore。不计入连击。 */
  onCoin(): void {
    this.state.coins += 1;
    this.state.score += this.cfg.coinScore;
  }

  /** 通关（ON_LEVEL_COMPLETE）：分数 += goalScore。不计入连击。 */
  onLevelComplete(): void {
    this.state.score += this.cfg.goalScore;
  }

  /** 死亡（ON_DEATH，SMALL→DEAD）：仅重置连击（comboCount=0, comboMult=1, comboTimerMs=0）。分数/金币保留。 */
  onDeath(): void {
    this.state.comboCount = 0;
    this.state.comboMult = 1;
    this.state.comboTimerMs = 0;
  }

  /**
   * 每帧（或固定步）推进连击窗口倒计时。窗口超时则连击清零（comboCount=0, comboMult=1）。
   * @param dtMs 帧/步时长（ms），来自 update/delta 或固定步。
   */
  update(dtMs: number): void {
    if (this.state.comboTimerMs > 0) {
      this.state.comboTimerMs -= dtMs;
      if (this.state.comboTimerMs <= 0) {
        this.state.comboTimerMs = 0;
        this.state.comboMult = 1;
        this.state.comboCount = 0;
      }
    }
  }
}
