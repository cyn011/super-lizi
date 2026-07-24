/**
 * platform/web/web-keyboard — 键盘 RawInputProvider（GDD 01 / E2.S2）。
 * 产出 RawInputFrame：物理信号 id = KeyboardEvent.code（"ArrowLeft" 等）。
 * 逻辑层只认信号 id，不感知键盘。
 */

import { refillFrame, type RawInputFrame, type RawInputProvider, type SignalId } from '../../core/input/raw-input';

const PREVENT_DEFAULT_CODES = new Set<string>([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'ShiftLeft', 'ShiftRight',
]);

export class WebKeyboardProvider implements RawInputProvider {
  private readonly down = new Set<SignalId>();
  private readonly pressed = new Set<SignalId>();
  private readonly released = new Set<SignalId>();
  /** 复用帧对象，避免每 sample() 新建三组 Set（稳态 GC 优化，见 Phase 6 报告候选④）。 */
  private readonly frame: RawInputFrame = {
    down: new Set<SignalId>(),
    pressedEdge: new Set<SignalId>(),
    releasedEdge: new Set<SignalId>(),
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    if (e.repeat) return; // 仅记录边沿，忽略系统重复
    const code = e.code as SignalId;
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const code = e.code as SignalId;
    if (this.down.has(code)) this.released.add(code);
    this.down.delete(code);
  };

  constructor() {
    // 不在构造期绑定；由 Web 平台工厂调用 attach() 显式绑定（与微信对称）
  }

  /** 绑定 DOM 键盘监听（Web 平台启动时调用）。 */
  attach(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
    }
  }

  /** 解绑 DOM 键盘监听。 */
  detach(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    }
  }

  sample(): RawInputFrame {
    const f = refillFrame(this.frame, this.down, this.pressed, this.released);
    this.pressed.clear();
    this.released.clear();
    return f;
  }

  reset(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    }
  }
}
