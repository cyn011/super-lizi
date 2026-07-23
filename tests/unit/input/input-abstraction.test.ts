/**
 * tests/unit/input/input-abstraction.test.ts — GDD01 双端 InputState 一致性
 * 来自 testing.md §4.1（Sprint 1 质量门：testing.md §3-①）。
 * 纯 Node，不依赖 Phaser/WebGL/canvas/wx。
 */
import { describe, it, expect } from 'vitest';
import { InputAbstraction } from '../../../src/core/input/input-abstraction';
import type { RawInputFrame } from '../../../src/core/input/raw-input';
import { webInputConfig, wechatInputConfig } from '../../../src/config/input-config';
import { STEP_MS } from '../_step';

// 等价手势：Web 按 ArrowLeft 一帧  vs  微信触屏 left 按钮一帧
function webLeftHeldFrame(): RawInputFrame {
  return { down: new Set(['ArrowLeft']), pressedEdge: new Set(['ArrowLeft']), releasedEdge: new Set() };
}
function wechatLeftHeldFrame(): RawInputFrame {
  return { down: new Set(['touch:left']), pressedEdge: new Set(['touch:left']), releasedEdge: new Set() };
}

describe('GDD01 双端 InputState 一致性 (control-list §4.2)', () => {
  it('Web 键盘 与 微信触屏 产出相同 InputState', () => {
    const t = STEP_MS * 10; // 仿真时钟 ms
    const web = new InputAbstraction(webInputConfig).sample(webLeftHeldFrame(), t);
    const wx = new InputAbstraction(wechatInputConfig).sample(wechatLeftHeldFrame(), t);
    expect(wx).toEqual(web); // 完全一致 → 逻辑层零平台分支的可测证据
    expect(web.left).toBe(true);
  });

  it('jumpPressedAt 精度 ≤16ms（固定步 16.67ms 天然满足）', () => {
    const f: RawInputFrame = { down: new Set(['Space']), pressedEdge: new Set(['Space']), releasedEdge: new Set() };
    const ia = new InputAbstraction(webInputConfig);
    const s = ia.sample(f, 1000);
    expect(s.jumpPressed).toBe(true);
    expect(s.jumpPressedAt).toBe(1000); // 记录仿真时钟，非 wall clock
  });
});
