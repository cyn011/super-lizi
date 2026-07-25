/**
 * core/events/event-bus — 手写事件总线（ADR-002）。
 * core 发事件、game/ui/audio 订阅，解耦各系统。零 Phaser / 零平台依赖。
 */

// ---- 事件名常量（GDD 03/04/06/07/10/11 约定）----
export const ON_JUMP = 'ON_JUMP';
export const ON_DOUBLE_JUMP = 'ON_DOUBLE_JUMP';
export const ON_LAND = 'ON_LAND';
/**
 * 弹藤回弹（GDD 14 §6）：零计分信号事件，仅供物理层套用弹起速度（player.vy = -bounceVelocity）。
 * 故意不发射 ON_STOMP —— 后者在 GDD 06 触发 +100 计分 + 敌死亡，反复弹跳刷分 = 主导策略风险。
 * 不新增任何音频键（复用 ON_JUMP 占位路径由音频总线订阅决定，本常量仅作事件名）。
 */
export const ON_BOUNCE = 'ON_BOUNCE';
export const ON_STOMP = 'ON_STOMP';
export const ON_ENEMY_DEATH = 'ON_ENEMY_DEATH';
export const ON_ENEMY_HIT_PLAYER = 'ON_ENEMY_HIT_PLAYER';
/**
 * 嘟浮剪影唤醒（decoy：IDLE→FLOAT，benign 占位）。复用既有通用占位音，**不新增音频键**（GDD 16 §6）。
 */
export const ON_SILHOUETTE_ACTIVATED = 'ON_SILHOUETTE_ACTIVATED';
/**
 * 嘟浮剪影相位幽灵切换（phaseghost：SOLID↔WRAITH，benign 占位）。复用既有通用占位音，**不新增音频键**（GDD 16 §6）。
 */
export const ON_SILHOUETTE_GHOST_SHIFT = 'ON_SILHOUETTE_GHOST_SHIFT';
export const ON_PROJECTILE_SPAWN = 'ON_PROJECTILE_SPAWN';
export const ON_HURT = 'ON_HURT';
export const ON_DEATH = 'ON_DEATH';
export const ON_RESPAWN = 'ON_RESPAWN';
export const ON_GAME_OVER = 'ON_GAME_OVER';
export const ON_COIN = 'ON_COIN';
/** 种子采集（GDD 12 §5.1）：payload `string`（seedId）。本 Story 仅发事件，maturity/蜕变留专项。 */
export const ON_SEED_COLLECTED = 'ON_SEED_COLLECTED';
/** 蜕变进度（GDD 12 §5.1）：payload `{ growthPct:number; stage:Stage }`，每次采集后重算即发（stage 未变也发），供 UI 进度条 / 音频细反馈。 */
export const ON_SEED_GROWTH = 'ON_SEED_GROWTH';
/** 蜕变跨阈值（GDD 12 §5.1）：payload `Stage`，仅当 stage 跨阈值变化时发（苗→藤→花→果），驱动 topper 切换 + 暖黄光晕 + sfx:seed_metamorph。 */
export const ON_SEED_METAMORPHOSIS = 'ON_SEED_METAMORPHOSIS';
export const ON_SCORE = 'ON_SCORE';
/** 经济变化广播（S04-4）：payload `{ score, coins, comboMult }`，供 HUD(S04-5) 订阅。 */
export const ON_SCORE_CHANGED = 'ON_SCORE_CHANGED';
export const ON_LIFE_LOST = 'ON_LIFE_LOST';
export const ON_LEVEL_COMPLETE = 'ON_LEVEL_COMPLETE';
export const ON_CHECKPOINT = 'ON_CHECKPOINT';
export const ON_PAUSE = 'ON_PAUSE';
export const ON_RESUME = 'ON_RESUME';
export const ON_RESTART = 'ON_RESTART';
export const ON_BEAT = 'ON_BEAT';
export const ON_START = 'ON_START';
export const ON_FORM_CHANGED = 'ON_FORM_CHANGED';
export const ON_LEVEL_COMPLETE_UI = 'ON_LEVEL_COMPLETE_UI';
/** 进入下一关（结算页「下一关」按钮触发）：UI 发、game-scene 订阅后加载 nextLevel。 */
export const ON_NEXT_LEVEL = 'ON_NEXT_LEVEL';

export type EventName = string;
export type EventHandler = (payload?: unknown) => void;

export class EventBus {
  private readonly handlers = new Map<EventName, Set<EventHandler>>();

  /** 订阅；返回取消订阅函数（便于组件销毁时解绑）。 */
  on(name: EventName, fn: EventHandler): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn);
    return () => this.off(name, fn);
  }

  off(name: EventName, fn: EventHandler): void {
    this.handlers.get(name)?.delete(fn);
  }

  /** 同步广播事件给所有订阅者。 */
  emit(name: EventName, payload?: unknown): void {
    const set = this.handlers.get(name);
    if (!set) return;
    // 复制一份，避免回调中增删订阅导致迭代异常
    for (const fn of [...set]) fn(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
