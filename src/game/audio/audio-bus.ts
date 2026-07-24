/**
 * game/audio/audio-bus — 薄音频总线（S05-4 / audio-design.md §3.3）。
 *
 * 职责：订阅 core 事件总线上的真实游戏事件 → 调 `platform.audio.play(name)`。
 * 解耦：core 只 emit 事件；本模块落在 game 层，仅依赖 core/events（常量 + EventBus 类型）
 * 与 platform 的 AudioPort 类型，不反向依赖任何平台实现（符合分层与 core 零平台铁律）。
 *
 * 不发声的事件（按设计契约 D7）：`ON_SCORE_CHANGED` 默认不映射（高频，避免 spam）。
 * 预留/待补 emit 的事件仍登记映射，事件一旦 emit 即自动发声，无需改本文件：
 *   - `ON_FORM_CHANGED`（蜕变，映射到已存在的 ON_FORM_CHANGED；勿引用不存在的 ON_SEED_METAMORPHOSIS）
 *   - `ON_PROJECTILE_SPAWN`（石炮，本 Story D3 已补 emit）
 *   - `ON_DOUBLE_JUMP`（二段跳，D5 延后，事件当前未 emit）
 */
import type { AudioPort } from '../../platform/platform';
import {
  EventBus,
  ON_JUMP,
  ON_DOUBLE_JUMP,
  ON_LAND,
  ON_STOMP,
  ON_ENEMY_DEATH,
  ON_COIN,
  ON_HURT,
  ON_LIFE_LOST,
  ON_DEATH,
  ON_RESPAWN,
  ON_GAME_OVER,
  ON_LEVEL_COMPLETE,
  ON_LEVEL_COMPLETE_UI,
  ON_PAUSE,
  ON_RESUME,
  ON_RESTART,
  ON_CHECKPOINT,
  ON_SEED_COLLECTED,
  ON_FORM_CHANGED,
  ON_PROJECTILE_SPAWN,
} from '../../core/events/event-bus';

/** 事件名 → SFX name 映射（name 对齐 audio-design.md §3.1）。 */
export const EVENT_TO_SFX: Record<string, string> = {
  [ON_JUMP]: 'sfx:jump',
  [ON_DOUBLE_JUMP]: 'sfx:double_jump', // D5 延后：事件当前未 emit，映射预留
  [ON_LAND]: 'sfx:land',
  [ON_STOMP]: 'sfx:stomp',
  [ON_ENEMY_DEATH]: 'sfx:enemy_death',
  [ON_COIN]: 'sfx:coin',
  [ON_HURT]: 'sfx:hurt',
  [ON_LIFE_LOST]: 'sfx:hurt', // 无独立 life_lost 合成，复用 hurt（设计契约：或复用 hurt）
  [ON_DEATH]: 'sfx:death',
  [ON_RESPAWN]: 'sfx:respawn',
  [ON_GAME_OVER]: 'sfx:game_over',
  [ON_LEVEL_COMPLETE]: 'sfx:level_clear',
  [ON_LEVEL_COMPLETE_UI]: 'sfx:level_clear', // UI 变体，复用 level_clear
  [ON_PAUSE]: 'sfx:pause',
  [ON_RESUME]: 'sfx:resume',
  [ON_RESTART]: 'sfx:restart',
  [ON_CHECKPOINT]: 'sfx:checkpoint',
  [ON_SEED_COLLECTED]: 'sfx:seed_collect',
  [ON_FORM_CHANGED]: 'sfx:seed_metamorph', // 蜕变音映射到已存在的 ON_FORM_CHANGED（设计契约：勿引用 ON_SEED_METAMORPHOSIS）
  [ON_PROJECTILE_SPAWN]: 'sfx:projectile_fire', // D3 本 Story 已补 emit
  // 注意：ON_SCORE_CHANGED 默认不映射（D7，高频避免 spam）
  // 注意：ON_ENEMY_HIT_PLAYER 由 ON_HURT 覆盖，不单列
};

/**
 * 薄音频总线：把「事件 → play(name)」订阅全部注册；提供 destroy() 统一解绑（场景 shutdown 调用）。
 * EventBus 同步多播，订阅顺序不影响其他订阅者。
 */
export class AudioBus {
  private readonly offs: Array<() => void> = [];

  constructor(bus: EventBus, audio: AudioPort) {
    for (const [event, name] of Object.entries(EVENT_TO_SFX)) {
      this.offs.push(bus.on(event, () => audio.play(name)));
    }
  }

  /** 解绑全部订阅（场景 shutdown 时调用，避免泄漏/重复播放）。 */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
