/**
 * 通关弹窗标题与评级星尺寸回归。
 * 用户要求：在上一版基础上，评级星再缩小 18%，标题缩小 10%。
 */
import { describe, expect, it } from 'vitest';
import { RESULT_LAYOUT } from '../../../src/ui/result-screen';

describe('result-screen · 标题与评级星视觉比例', () => {
  it('标题由 30px 精确缩小 10% 至 27px', () => {
    expect(RESULT_LAYOUT.titleFontSize).toBe(27);
  });

  it('评级星在上一版 0.8 基础上精确缩小 18%', () => {
    expect(RESULT_LAYOUT.rankStarScale).toBeCloseTo(0.656, 5);
    expect(RESULT_LAYOUT.rankStarOuterRadius).toBeCloseTo(17.712, 5);
  });
});
