/**
 * tests/unit/platform/wechat-touch.test.ts — R2-twenty-two：click 事件补充
 *
 * 覆盖：微信开发者工具鼠标模式 + 桌面浏览器点圆钮的 click 事件支持。
 * 微信模拟器鼠标模式下 mousedown/mouseup 不触发，只触发 click → 退化为
 * "短按 100ms"语义：按一下 = 一跳/一步（~6 帧 @ 60fps，足够触发 controller 反馈）。
 * 真机触屏不受影响（仍走 touch 路径）。
 * 按钮位置来自 inputConfig.wechat.buttons：左 (0.08, 0.82) r=0.07, 跳 (0.82, 0.82) r=0.08。
 * 设备/逻辑均为 512×288（测试环境无 wx.getSystemInfoSync）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WechatTouchProvider } from '../../../src/platform/wechat/wechat-touch';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../../../src/platform/detect';

function buttonCenterDevice(id: 'left' | 'right' | 'jump' | 'action'): { x: number; y: number } {
  const b = (id === 'left') ? { x: 0.08, y: 0.82 }
    : (id === 'right') ? { x: 0.22, y: 0.82 }
    : (id === 'jump') ? { x: 0.82, y: 0.82 }
    : { x: 0.92, y: 0.7 };
  // 测试中 deviceW === logicalW，转换比例 = 1
  return { x: b.x * LOGICAL_WIDTH, y: b.y * LOGICAL_HEIGHT };
}

function outOfButtonsDevice(): { x: number; y: number } {
  return { x: 5, y: 5 };
}

interface MockCanvas {
  listeners: Record<string, Array<(e: { clientX: number; clientY: number }) => void>>;
  addEventListener: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void;
  removeEventListener: (t: string, h: unknown) => void;
}

function makeMockCanvas(): MockCanvas {
  const listeners: Record<string, Array<(e: { clientX: number; clientY: number }) => void>> = {};
  return {
    listeners,
    addEventListener(t, h) { (listeners[t] ||= []).push(h); },
    removeEventListener(t, h) {
      const arr = listeners[t];
      if (!arr) return;
      const i = arr.indexOf(h as (e: { clientX: number; clientY: number }) => void);
      if (i >= 0) arr.splice(i, 1);
    },
  };
}

describe('WechatTouchProvider — R2-twenty-two click 事件补充', () => {
  let canvas: MockCanvas;
  let provider: WechatTouchProvider;

  beforeEach(() => {
    canvas = makeMockCanvas();
    (globalThis as { __screenCanvas?: MockCanvas }).__screenCanvas = canvas;
    provider = new WechatTouchProvider(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { __screenCanvas?: MockCanvas }).__screenCanvas;
  });

  it('click 注册到 screenCanvas', () => {
    expect(canvas.listeners['click']?.length).toBe(1);
  });

  it('click 命中跳按钮 → pressed + down 含 touch:jump', () => {
    const c = buttonCenterDevice('jump');
    canvas.listeners['click'][0]({ clientX: c.x, clientY: c.y });
    const frame = provider.sample();
    expect(frame.pressedEdge.has('touch:jump')).toBe(true);
    expect(frame.down.has('touch:jump')).toBe(true);
  });

  it('100ms 后自动松开 → released + down 删', () => {
    vi.useFakeTimers();
    const c = buttonCenterDevice('jump');
    canvas.listeners['click'][0]({ clientX: c.x, clientY: c.y });
    expect(provider.sample().down.has('touch:jump')).toBe(true);
    vi.advanceTimersByTime(100);
    const frame = provider.sample();
    expect(frame.down.has('touch:jump')).toBe(false);
    expect(frame.releasedEdge.has('touch:jump')).toBe(true);
  });

  it('click 在按钮外 → 不触发任何状态', () => {
    const p = outOfButtonsDevice();
    canvas.listeners['click'][0]({ clientX: p.x, clientY: p.y });
    const frame = provider.sample();
    expect(frame.down.size).toBe(0);
    expect(frame.pressedEdge.size).toBe(0);
  });

  it('4 钮独立 click → 各自独立按下', () => {
    for (const id of ['left', 'right', 'jump', 'action'] as const) {
      const c = buttonCenterDevice(id);
      canvas.listeners['click'][0]({ clientX: c.x, clientY: c.y });
    }
    const frame = provider.sample();
    expect(frame.down.has('touch:left')).toBe(true);
    expect(frame.down.has('touch:right')).toBe(true);
    expect(frame.down.has('touch:jump')).toBe(true);
    expect(frame.down.has('touch:action')).toBe(true);
  });

  it('同按钮重复 click 100ms 内不会产生两次 pressed（down 已含则跳过）', () => {
    vi.useFakeTimers();
    const c = buttonCenterDevice('left');
    canvas.listeners['click'][0]({ clientX: c.x, clientY: c.y });
    canvas.listeners['click'][0]({ clientX: c.x, clientY: c.y }); // 立即再点
    const frame = provider.sample();
    expect(frame.pressedEdge.has('touch:left')).toBe(true);
    // 只有一次 pressed（第二次被 down.has 检查挡住）
    expect(frame.pressedEdge.size).toBe(1);
    vi.advanceTimersByTime(100);
    const frame2 = provider.sample();
    expect(frame2.releasedEdge.has('touch:left')).toBe(true);
  });

  it('destroy() 解除 click 监听', () => {
    provider.destroy();
    expect(canvas.listeners['click']?.length ?? 0).toBe(0);
  });

  it('没有 __screenCanvas 时不报错', () => {
    delete (globalThis as { __screenCanvas?: MockCanvas }).__screenCanvas;
    expect(() => new WechatTouchProvider(LOGICAL_WIDTH, LOGICAL_HEIGHT)).not.toThrow();
  });
});
