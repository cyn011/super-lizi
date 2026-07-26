/**
 * tests/unit/platform/fusion-input.test.ts — 按钮 + 手势融合层（融合为唯一模式）。
 *
 * 覆盖用户拍板的五类行为：
 *  (1) 按钮命中优先：Web PointerSink 路径下，pointerDown 落在虚拟按钮 → 走按钮 press，
 *      且通道在 pointerDown 时决定并稳定到抬起（按钮通道内 move 不泄漏给手势）。
 *  (2) 未命中走手势：pointerDown 落在按钮外 → 走 GestureProvider 手势（touch:jump 等）。
 *  (3) 键盘合并：FusionInput 经 makeCompositeInput 与键盘合并，键盘信号始终并入不冲突。
 *  (4) 暂停图标命中：落点在 pauseIcon → 产出 touch:pause（而非手势 / 而非其它按钮）。
 *  (5) click 路由：微信端 bindWechat 后，screenCanvas.click 命中按钮 → 按钮层；
 *      未命中 → 手势 Tap（以主角屏幕位置为原点）。
 *
 * 不依赖 Phaser / 真实 wx：Web 路径直接构造 FusionInput 调用 PointerSink；
 * 微信 click/touch 路由用 wx + __screenCanvas 桩注入后断言融合层路由结果。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RawInputProvider, RawInputFrame, SignalId } from '../../../src/core/input/raw-input';
import { emptyFrame } from '../../../src/core/input/raw-input';
import { FusionInput } from '../../../src/platform/fusion-input';
import { makeCompositeInput } from '../../../src/platform/composite-input';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../../../src/platform/detect';
import { inputConfig } from '../../../src/core/config';

/** 逻辑分辨率下按钮中心（测试环境 deviceW===logicalW，device→logical 比例=1）。 */
function buttonLogicalCenter(id: 'left' | 'right' | 'jump' | 'action'): { x: number; y: number } {
  const b = inputConfig.wechat.buttons[id];
  return { x: b.x * LOGICAL_WIDTH, y: b.y * LOGICAL_HEIGHT };
}
/** 暂停图标逻辑中心。 */
function pauseLogicalCenter(): { x: number; y: number } {
  const p = inputConfig.wechat.pauseIcon!;
  return { x: p.x * LOGICAL_WIDTH, y: p.y * LOGICAL_HEIGHT };
}

// ───────────────────────── Web PointerSink 路径（无 wx，bindWechat 早退）─────────────────────────
describe('FusionInput — Web PointerSink：按钮命中优先 + 通道稳定', () => {
  it('pointerDown 落在左按钮中心 → down 含 touch:left（按钮层），且手势层无信号', () => {
    const fusion = new FusionInput();
    const c = buttonLogicalCenter('left');
    fusion.pointerDown(c.x, c.y, 0);
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:left')).toBe(true);
    expect(f.pressedEdge.has('touch:left')).toBe(true);
    // 手势层未触发（未向 GestureProvider 投递该触点）
    expect(f.down.has('touch:jump')).toBe(false);
    expect(f.down.has('touch:right')).toBe(false);
  });

  it('按钮通道内 move 到手势区域不泄漏给手势（通道在 pointerDown 决定并稳定到抬起）', () => {
    const fusion = new FusionInput();
    const c = buttonLogicalCenter('left');
    fusion.pointerDown(c.x, c.y, 0); // 落到左按钮 → 按钮通道
    // 手指移到主角上方（手势判跳区），但按钮通道忽略 move
    fusion.pointerMove(256, 50, 0);
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:left')).toBe(true); // 仍在按左按钮
    expect(f.down.has('touch:jump')).toBe(false); // 未泄漏成跳
  });

  it('pointerUp 释放按钮通道 → released 边沿', () => {
    const fusion = new FusionInput();
    const c = buttonLogicalCenter('jump');
    fusion.pointerDown(c.x, c.y, 0);
    fusion.pointerUp(c.x, c.y, 0);
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:jump')).toBe(false);
    expect(f.releasedEdge.has('touch:jump')).toBe(true);
  });
});

describe('FusionInput — Web PointerSink：未命中按钮走手势', () => {
  it('pointerDown 落在按钮外（主角上方死区外）→ GestureProvider 产出 touch:jump', () => {
    const fusion = new FusionInput();
    // (256,50)：无按钮命中；GestureProvider 默认原点(256,144)，dy=-94<-16 → 跳
    fusion.pointerDown(256, 50, 0);
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.down.has('touch:left')).toBe(false);
    expect(f.down.has('touch:right')).toBe(false);
  });
});

describe('FusionInput — Web PointerSink：暂停图标命中', () => {
  it('pointerDown 落在 pauseIcon → 产出 touch:pause（而非手势/其它按钮）', () => {
    const fusion = new FusionInput();
    const p = pauseLogicalCenter();
    fusion.pointerDown(p.x, p.y, 0);
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:pause')).toBe(true);
    expect(f.down.has('touch:jump')).toBe(false);
    expect(f.down.has('touch:left')).toBe(false);
  });
});

describe('FusionInput — 键盘合并（makeCompositeInput）', () => {
  /** 极简键盘桩：始终按住 'ArrowLeft'（Web 物理信号），首帧补 pressed 边沿。 */
  function makeMockKeyboard(downSig: SignalId): RawInputProvider {
    let first = true;
    return {
      sample(): RawInputFrame {
        const f = emptyFrame();
        f.down.add(downSig);
        if (first) {
          f.pressedEdge.add(downSig);
          first = false;
        }
        return f;
      },
      reset(): void {
        first = true;
      },
    };
  }

  it('融合层按钮信号与键盘信号并存（键盘始终并入不冲突）', () => {
    const input = makeCompositeInput(makeMockKeyboard('ArrowLeft'), new FusionInput());
    const c = buttonLogicalCenter('right');
    // 经 composite 的 PointerSink 转发到融合层
    (input as unknown as { pointerDown(x: number, y: number, id?: number): void })
      .pointerDown(c.x, c.y, 0);
    const f: RawInputFrame = input.sample();
    expect(f.down.has('touch:right')).toBe(true); // 融合层按钮
    expect(f.down.has('ArrowLeft')).toBe(true); // 键盘并入
  });
});

// ───────────────────────── 微信 click/touch 路由（注入 wx + __screenCanvas 桩）─────────────────────────
interface MockCanvas {
  listeners: Record<string, Array<(e: { clientX: number; clientY: number }) => void>>;
  addEventListener: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void;
  removeEventListener: (t: string, h: unknown) => void;
}

function makeMockCanvas(): MockCanvas {
  const listeners: Record<string, Array<(e: { clientX: number; clientY: number }) => void>> = {};
  return {
    listeners,
    addEventListener(t, h) {
      (listeners[t] ||= []).push(h);
    },
    removeEventListener(t, h) {
      const arr = listeners[t];
      if (!arr) return;
      const i = arr.indexOf(h as (e: { clientX: number; clientY: number }) => void);
      if (i >= 0) arr.splice(i, 1);
    },
  };
}

describe('FusionInput — 微信 click 路由（bindWechat）', () => {
  let canvas: MockCanvas;
  let wxStub: {
    getSystemInfoSync: () => { screenWidth: number; screenHeight: number };
    onTouchStart: ReturnType<typeof vi.fn>;
    onTouchMove: ReturnType<typeof vi.fn>;
    onTouchEnd: ReturnType<typeof vi.fn>;
    onTouchCancel: ReturnType<typeof vi.fn>;
  };
  let fusion: FusionInput;

  beforeEach(() => {
    canvas = makeMockCanvas();
    (globalThis as { __screenCanvas?: MockCanvas }).__screenCanvas = canvas;
    wxStub = {
      getSystemInfoSync: () => ({ screenWidth: LOGICAL_WIDTH, screenHeight: LOGICAL_HEIGHT }),
      onTouchStart: vi.fn(),
      onTouchMove: vi.fn(),
      onTouchEnd: vi.fn(),
      onTouchCancel: vi.fn(),
    };
    (globalThis as { wx?: unknown }).wx = wxStub;
    fusion = new FusionInput();
  });

  afterEach(() => {
    fusion.destroy();
    delete (globalThis as { __screenCanvas?: MockCanvas }).__screenCanvas;
    delete (globalThis as { wx?: unknown }).wx;
  });

  it('bindWechat 把 click 绑到 screenCanvas（仅融合层一条，避免与按钮层重复消费）', () => {
    expect(canvas.listeners['click']?.length).toBe(1);
  });

  it('click 命中跳按钮 → 走按钮层 routeClick → touch:jump', () => {
    const c = buttonLogicalCenter('jump');
    canvas.listeners['click'][0]({ clientX: c.x, clientY: c.y });
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.down.has('touch:left')).toBe(false);
  });

  it('click 未命中按钮 → 走手势 Tap（主角上方死区外 → touch:jump）', () => {
    canvas.listeners['click'][0]({ clientX: 256, clientY: 50 });
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.down.has('touch:left')).toBe(false);
  });

  it('wx.onTouchStart 路由：touch 命中跳按钮 → 按钮层 touch:jump', () => {
    const onStart = wxStub.onTouchStart.mock.calls[0][0] as (e: { changedTouches: Array<{ identifier: number; clientX: number; clientY: number }> }) => void;
    const c = buttonLogicalCenter('jump');
    onStart({ changedTouches: [{ identifier: 0, clientX: c.x, clientY: c.y }] });
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:jump')).toBe(true);
  });

  it('wx.onTouchStart 路由：touch 未命中按钮 → 手势 touch:jump', () => {
    const onStart = wxStub.onTouchStart.mock.calls[0][0] as (e: { changedTouches: Array<{ identifier: number; clientX: number; clientY: number }> }) => void;
    onStart({ changedTouches: [{ identifier: 0, clientX: 256, clientY: 50 }] });
    const f: RawInputFrame = fusion.sample();
    expect(f.down.has('touch:jump')).toBe(true);
  });
});
