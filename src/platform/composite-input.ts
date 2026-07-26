/**
 * platform/composite-input — 次级输入（手势/融合）与键盘的合并器（架构 §5）。
 *
 * 把键盘（WebKeyboardProvider，始终合并，不冲突）与次级输入（GestureProvider / FusionInput）
 * 合并为单一 RawInputProvider。约定：
 * - sample：合并 down/pressedEdge/releasedEdge（三组 Set 复用，不每帧新建）。
 * - 仅当次级实现 PointerSink 时挂上 pointer* 方法，使 game-scene 可用结构性检测转发 Phaser pointer。
 * - 仅当次级支持 advance（仿真时钟驱动手势计时器）时转发。
 * - 仅当次级支持 setPlayerScreenPos（手势以主角屏幕位置为原点）时转发，使 Platform.setPlayerScreenPos 能抵手势层。
 *
 * 合并后对外仍是 RawInputProvider & Partial<PointerSink> & { advance?; setPlayerScreenPos? }，
 * game-scene / platform 无需感知内部是键盘 + 手势 还是 键盘 + 融合。
 */
import type { RawInputProvider, RawInputFrame, SignalId } from '../core/input/raw-input';
import type { PointerSink } from './raw-input-provider';

export type CompositeInput = RawInputProvider &
  Partial<PointerSink> & {
    advance?(dt: number): void;
    setPlayerScreenPos?(x: number, y: number): void;
  };

/**
 * 合并键盘与次级输入。键盘始终传入（Web/微信统一模式），次级为手势或融合层。
 */
export function makeCompositeInput(
  keyboard: RawInputProvider,
  secondary: RawInputProvider,
): CompositeInput {
  const sink = secondary as Partial<PointerSink>;
  const adv = secondary as Partial<{ advance(dt: number): void }>;
  const posSink = secondary as Partial<{ setPlayerScreenPos?(x: number, y: number): void }>;

  // 复用合并帧，避免每 sample() 新建三组 Set（稳态 GC 优化，见 Phase 6 报告候选④）。
  const merged: RawInputFrame = {
    down: new Set<SignalId>(),
    pressedEdge: new Set<SignalId>(),
    releasedEdge: new Set<SignalId>(),
  };

  const obj: CompositeInput = {
    sample(): RawInputFrame {
      const kf = keyboard.sample();
      const sf = secondary.sample();
      merged.down.clear();
      for (const s of kf.down) merged.down.add(s);
      for (const s of sf.down) merged.down.add(s);
      merged.pressedEdge.clear();
      for (const s of kf.pressedEdge) merged.pressedEdge.add(s);
      for (const s of sf.pressedEdge) merged.pressedEdge.add(s);
      merged.releasedEdge.clear();
      for (const s of kf.releasedEdge) merged.releasedEdge.add(s);
      for (const s of sf.releasedEdge) merged.releasedEdge.add(s);
      return merged;
    },
    reset(): void {
      keyboard.reset?.();
      secondary.reset?.();
    },
  };

  if (typeof sink.pointerDown === 'function') {
    obj.pointerDown = (x: number, y: number, id?: number) => sink.pointerDown!(x, y, id);
    obj.pointerMove = (x: number, y: number, id?: number) => sink.pointerMove?.(x, y, id);
    obj.pointerUp = (x: number, y: number, id?: number) => sink.pointerUp?.(x, y, id);
  }
  if (typeof adv.advance === 'function') {
    obj.advance = (dt: number) => adv.advance!(dt);
  }
  if (typeof posSink.setPlayerScreenPos === 'function') {
    obj.setPlayerScreenPos = (x: number, y: number) => posSink.setPlayerScreenPos!(x, y);
  }
  return obj;
}
