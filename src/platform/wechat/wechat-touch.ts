/**
 * platform/wechat/wechat-touch — 虚拟按钮 RawInputProvider（GDD 01 §6 / E2.S2）。
 * 把微信触屏事件命中到 input-config.wechat.buttons 的四个虚拟按钮，
 * 产出 touch:left / touch:right / touch:jump / touch:action 信号（与 Web 键盘同源归一）。
 * 命中测试在「逻辑分辨率」空间进行（与 ui/touch-buttons 绘制公式一致），
 * 触屏设备 px 经 device/logical 比例换算。
 */

import type { RawInputFrame, RawInputProvider, SignalId } from '../../core/input/raw-input';
import { inputConfig } from '../../core/config';

interface ButtonDef {
  id: SignalId;
  nx: number; // 归一化中心 x [0,1]
  ny: number; // 归一化中心 y [0,1]
  nr: number; // 归一化半径（以逻辑宽度为基准）
}

interface TouchPoint {
  id: number;
  x: number; // 逻辑 px
  y: number;
}

export class WechatTouchProvider implements RawInputProvider {
  private readonly logicalW: number;
  private readonly logicalH: number;
  private readonly deviceW: number;
  private readonly deviceH: number;
  private readonly buttons: ButtonDef[] = [];

  private readonly down = new Set<SignalId>();
  private readonly pressed = new Set<SignalId>();
  private readonly released = new Set<SignalId>();
  private readonly touchBtn = new Map<number, SignalId>();

  private readonly onStart = (e: { changedTouches?: TouchPoint[] }): void => this.handle(e.changedTouches, 'start');
  private readonly onMove = (e: { changedTouches?: TouchPoint[] }): void => this.handle(e.changedTouches, 'move');
  private readonly onEnd = (e: { changedTouches?: TouchPoint[] }): void => this.handle(e.changedTouches, 'end');
  /** R2-twenty-two：click 事件补充。微信开发者工具鼠标模式 + 桌面浏览器点击圆钮走这条路径。 */
  private readonly onCanvasClick = (e: { clientX: number; clientY: number }): void => this.handleClick(e.clientX, e.clientY);

  constructor(logicalW: number, logicalH: number) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;
    // 设备分辨率（触屏坐标基准）。无 wx 时退化为逻辑分辨率（不报错）。
    let dw = logicalW;
    let dh = logicalH;
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      try {
        const info = wx.getSystemInfoSync();
        dw = info.screenWidth || info.windowWidth || logicalW;
        dh = info.screenHeight || info.windowHeight || logicalH;
      } catch {
        /* 忽略，使用逻辑分辨率 */
      }
    }
    this.deviceW = dw;
    this.deviceH = dh;

    const b = inputConfig.wechat.buttons;
    this.buttons = [
      { id: 'touch:left', nx: b.left.x, ny: b.left.y, nr: b.left.r },
      { id: 'touch:right', nx: b.right.x, ny: b.right.y, nr: b.right.r },
      { id: 'touch:jump', nx: b.jump.x, ny: b.jump.y, nr: b.jump.r },
      { id: 'touch:action', nx: b.action.x, ny: b.action.y, nr: b.action.r },
    ];

    if (typeof wx !== 'undefined') {
      wx.onTouchStart?.(this.onStart);
      wx.onTouchMove?.(this.onMove);
      wx.onTouchEnd?.(this.onEnd);
      wx.onTouchCancel?.(this.onEnd);
    }

    // R2-twenty-two：click 事件补充。微信开发者工具鼠标模式 + 桌面浏览器
    // 调试时点圆钮都走这条路径。weapp-adapter 给 screenCanvas 注入了标准 DOM
    // addEventListener，但 mousedown/mouseup 在微信模拟器鼠标模式下不触发，
    // 只有 click 触发 → 退化为"短按 ~100ms"语义：按一下 = 一跳 / 一步。
    // 真机有触屏所以仍走 touch 路径，本段只在 mouse 场景生效。
    const screenCanvas = (globalThis as { __screenCanvas?: { addEventListener?: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void } }).__screenCanvas;
    if (screenCanvas && typeof screenCanvas.addEventListener === 'function') {
      screenCanvas.addEventListener('click', this.onCanvasClick);
    }
  }

  /**
   * R2-twenty-two：click 事件 → 短按 100ms。微信模拟器鼠标模式点击圆钮驱动角色用。
   * 行为：按下（pressed + down）→ 100ms 后松开（down 删 + released），
   * 与触屏 touchStart+touchEnd 等价（持续按住不能持续移动，只支持"按一下"）。
   * 真机触屏不受影响（仍走 touch 路径）。
   */
  private handleClick(clientX: number, clientY: number): void {
    const hit = this.hitTest(clientX, clientY);
    if (!hit) return;
    if (!this.down.has(hit)) this.pressed.add(hit);
    this.down.add(hit);
    setTimeout(() => {
      if (this.down.has(hit)) {
        this.down.delete(hit);
        this.released.add(hit);
      }
    }, 100);
  }

  /** R2-twenty-two：解绑 click 事件（场景销毁时调用） */
  destroy(): void {
    const screenCanvas = (globalThis as { __screenCanvas?: { removeEventListener?: (t: string, h: unknown) => void } }).__screenCanvas;
    if (screenCanvas && typeof screenCanvas.removeEventListener === 'function') {
      screenCanvas.removeEventListener('click', this.onCanvasClick);
    }
    if (typeof wx !== 'undefined') {
      wx.offTouchStart?.(this.onStart);
      wx.offTouchMove?.(this.onMove);
      wx.offTouchEnd?.(this.onEnd);
      wx.offTouchCancel?.(this.onEnd);
    }
  }

  /** 把设备 px 触屏点换算到逻辑空间，并命中虚拟按钮（与 ui/touch-buttons 同公式）。 */
  private hitTest(px: number, py: number): SignalId | null {
    const lx = px * (this.logicalW / this.deviceW);
    const ly = py * (this.logicalH / this.deviceH);
    for (const btn of this.buttons) {
      const cx = btn.nx * this.logicalW;
      const cy = btn.ny * this.logicalH;
      const r = btn.nr * this.logicalW; // 半径以逻辑宽度为基准（绘制一致）
      const dx = lx - cx;
      const dy = ly - cy;
      if (dx * dx + dy * dy <= r * r) return btn.id;
    }
    return null;
  }

  private handle(points: TouchPoint[] | undefined, phase: 'start' | 'move' | 'end'): void {
    if (!points) return;
    for (const p of points) {
      if (phase === 'end') {
        const id = this.touchBtn.get(p.id);
        if (id) {
          this.down.delete(id);
          this.released.add(id);
          this.touchBtn.delete(p.id);
        }
        continue;
      }
      const hit = this.hitTest(p.x, p.y);
      if (!hit) continue;
      const prev = this.touchBtn.get(p.id);
      if (prev && prev !== hit) {
        // 滑出原按钮：释放旧、按下新
        this.down.delete(prev);
        this.released.add(prev);
      }
      if (!this.down.has(hit)) this.pressed.add(hit);
      this.down.add(hit);
      this.touchBtn.set(p.id, hit);
    }
  }

  sample(): RawInputFrame {
    const frame: RawInputFrame = {
      down: new Set(this.down),
      pressedEdge: new Set(this.pressed),
      releasedEdge: new Set(this.released),
    };
    this.pressed.clear();
    this.released.clear();
    return frame;
  }

  reset(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.touchBtn.clear();
  }

  /**
   * R2-twenty-two.c：外部模拟按下（供 Phaser InputPlugin pointerdown 调用）。
   * 与 click 同语义：立即按下（pressed + down）→ 100ms 后松开（down 删 + released）。
   * 微信模拟器鼠标模式下 canvas 原生事件不可靠，改用 Phaser 的 pointer 归化。
   * 真机触屏仍走 wx.onTouchStart（不受影响）。
   */
  simulatePress(buttonId: SignalId): void {
    if (!this.down.has(buttonId)) this.pressed.add(buttonId);
    this.down.add(buttonId);
    setTimeout(() => {
      if (this.down.has(buttonId)) {
        this.down.delete(buttonId);
        this.released.add(buttonId);
      }
    }, 100);
  }
}
