/**
 * core/beat/advance-beat — 统一「推进节拍 + 广播 ON_BEAT」核心函数（S05-1）。
 *
 * 抽此函数是为了让 game-scene 与 headless 走【同一段】节拍门控逻辑，保证双端行为一致
 * （启用时跨拍 emit ON_BEAT、禁用时永不 emit、同输入同序列），并可被单测直接覆盖。
 * core 零 Phaser / 零平台 API、确定性。
 *
 * 注意：本函数负责调 beat.crossedBeat()（每固定步只应调一次，调用方须保证）。
 * BeatDrivenSystem.applyBeat 内部【不】调 crossedBeat——相位翻转交给调用方传入的 onBeat。
 */
import type { BeatClock } from './beat-clock';
import type { EventBus } from '../events/event-bus';
import { ON_BEAT } from '../events/event-bus';

/**
 * 推进一个固定步的节拍门控。
 * @param beat 节拍时钟（enabled=false 时直接返回 -1，不发事件）。
 * @param simTimeMs 当前仿真时钟 ms（与 BeatClock 同源）。
 * @param bus 事件总线（跨拍时 emit ON_BEAT，payload={ beat: idx }）。
 * @param onBeat 可选：跨拍时回调，传入整拍序号（用于驱动 BeatDrivenSystem.applyBeat）。
 * @returns 本次跨拍的整拍序号；未跨拍或禁用时返回 -1。
 */
export function advanceBeat(
  beat: BeatClock,
  simTimeMs: number,
  bus: EventBus,
  onBeat?: (beatIndex: number) => void,
): number {
  if (!beat.enabled) return -1;
  if (!beat.crossedBeat(simTimeMs)) return -1;
  const idx = beat.getBeat(simTimeMs);
  onBeat?.(idx);
  bus.emit(ON_BEAT, { beat: idx });
  return idx;
}
