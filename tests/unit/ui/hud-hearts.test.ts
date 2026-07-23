/**
 * tests/unit/ui/hud-hearts.test.ts — computeHeartSlots 纯函数回归（design/ux/hud-spec.md §3.1）。
 *
 * 纯 Node（零 Phaser / 零平台 API，testing.md §2 约束），直接验证槽位计算逻辑。
 * Hud 渲染侧（心形/形态图标绘制、覆盖层）由真机/模拟器人眼回归验证（与 touch-buttons 同策略）。
 */
import { describe, it, expect } from 'vitest';
import { computeHeartSlots } from '../../../src/ui/hud-hearts';

describe('HUD 命数心形槽位计算 (hud-spec §3.1)', () => {
  it('lives=3, initial=3 → 3 槽全满', () => {
    expect(computeHeartSlots(3, 3)).toEqual({ total: 3, filled: 3 });
  });

  it('lives=2, initial=3 → 3 槽 2 满（1 空心）', () => {
    expect(computeHeartSlots(2, 3)).toEqual({ total: 3, filled: 2 });
  });

  it('lives=0, initial=3 → 3 槽全空', () => {
    expect(computeHeartSlots(0, 3)).toEqual({ total: 3, filled: 0 });
  });

  it('加命后 lives=4 > initial=3 → 槽位动态扩到 4 全满（不截断，前瞻 prop_heart）', () => {
    expect(computeHeartSlots(4, 3)).toEqual({ total: 4, filled: 4 });
  });

  it('负数 lives 安全 → filled 钳到 0，total 仍取 max(initial, lives)', () => {
    expect(computeHeartSlots(-1, 3)).toEqual({ total: 3, filled: 0 });
  });
});
