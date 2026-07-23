/**
 * platform/web/web-platform — Web 平台聚合（架构 §5）。
 * 输入 = 键盘（WebKeyboardProvider） + 指针手势（GestureProvider）并存：
 *   - gesture（默认）：点击/划屏驱动 touch:*，键盘仍可用（web.* 映射已含 touch:*）。
 *   - virtual（?buttons=1 或 layout=virtual 调试回退）：旧四钮（WechatTouchProvider），
 *     键盘照常工作。注：Web 无真实四钮，仅为与微信 ?buttons=1 回归一致的调试态。
 */
import type { Platform } from '../platform';
import type { RawInputProvider, RawInputFrame, SignalId } from '../../core/input/raw-input';
import { GestureProvider, type GestureParams } from '../gesture-provider';
import type { PointerSink } from '../raw-input-provider';
import { WebKeyboardProvider } from './web-keyboard';
import { WebStorage } from './web-storage';
import { WebAudio } from './web-audio';
import { WechatTouchProvider } from '../wechat/wechat-touch';
import { inputConfig } from '../../core/config';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../detect';

function readGestureParams(): GestureParams {
  const g = (inputConfig.wechat as unknown as { gesture?: Record<string, number> }).gesture;
  if (!g) {
    throw new Error('[web-platform] inputConfig.wechat.gesture 缺失，无法启用 gesture 布局');
  }
  return {
    deadzone: g.playerDeadzone ?? g.deadzone ?? 16,
    jumpZoneTop: g.jumpZoneTop,
    jumpSwipeSlope: g.jumpSwipeSlope,
    swipeMinDist: g.swipeMinDist,
    walkSegmentMs: g.walkSegmentMs,
    jumpHoldMs: g.jumpHoldMs,
  };
}

function isForceVirtual(): boolean {
  if (typeof location === 'undefined') return false;
  try {
    const qp = new URLSearchParams(location.search);
    if (qp.get('buttons') === '1') return true;
  } catch {
    /* ignore */
  }
  return inputConfig.wechat.layout === 'virtual';
}

/**
 * 合并键盘与次级（手势/按钮）输入：
 * - sample：合并 down/pressedEdge/releasedEdge。
 * - 仅在次级实现 PointerSink 时挂上 pointer* 方法（gesture 有、virtual 无），
 *   使 game-scene 可用 `('pointerDown' in input)` 结构性区分手势/虚拟布局。
 * - advance 仅在次级支持时转发（驱动手势计时器）。
 */
function makeCompositeInput(
  keyboard: WebKeyboardProvider,
  secondary: RawInputProvider,
): RawInputProvider & Partial<PointerSink> & { advance?(dt: number): void } {
  const sink = secondary as Partial<PointerSink>;
  const adv = secondary as Partial<{ advance(dt: number): void }>;

  const obj: RawInputProvider & Partial<PointerSink> & { advance?(dt: number): void } = {
    sample(): RawInputFrame {
      const kf = keyboard.sample();
      const sf = secondary.sample();
      return {
        down: new Set<SignalId>([...kf.down, ...sf.down]),
        pressedEdge: new Set<SignalId>([...kf.pressedEdge, ...sf.pressedEdge]),
        releasedEdge: new Set<SignalId>([...kf.releasedEdge, ...sf.releasedEdge]),
      };
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
  return obj;
}

export function createWebPlatform(): Platform {
  const keyboard = new WebKeyboardProvider();
  keyboard.attach(); // F4 修复：绑定 DOM 键盘监听，否则 Web 键盘输入完全失效

  const secondary = isForceVirtual()
    ? new WechatTouchProvider(LOGICAL_WIDTH, LOGICAL_HEIGHT)
    : new GestureProvider(readGestureParams());
  const input = makeCompositeInput(keyboard, secondary);

  // 把主角屏幕坐标转发给次级输入（gesture 有 setPlayerScreenPos，virtual 无 → no-op）。
  const posSink = secondary as Partial<{ setPlayerScreenPos?(x: number, y: number): void }>;

  return {
    env: 'web',
    input,
    audio: new WebAudio(),
    storage: new WebStorage(),
    lifecycle: {
      onHide: () => {},
      onShow: () => {},
    },
    setPlayerScreenPos: (x: number, y: number) => posSink.setPlayerScreenPos?.(x, y),
  };
}
