/**
 * 触控按钮参照图布局回归：
 * - 方向键保持原始 PNG 的 1:1 比例，不能被压扁；
 * - 四钮按参照图形成“大方向键 / 中攻击键 / 大跳跃键”的层级；
 * - 放大后的按钮之间保留间距，并且不越出画布底部。
 */
import { describe, expect, it } from 'vitest';
import { inputConfig } from '../../../src/core/config';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../../src/platform/detect';
import {
  buildCircleGeom,
  buildDirectionGeom,
} from '../../../src/ui/touch-buttons-constants';

describe('touch-buttons · 参照图尺寸与布局', () => {
  it('方向键为 54×54 左右的正方形，不拉伸 PNG', () => {
    const left = buildDirectionGeom('left');
    const right = buildDirectionGeom('right');

    expect(left.geom.w).toBeCloseTo(left.geom.h, 5);
    expect(right.geom.w).toBeCloseTo(right.geom.h, 5);
    expect(left.geom.w).toBeCloseTo(53.76, 2);
    expect(right.geom.w).toBeCloseTo(53.76, 2);
  });

  it('攻击键补偿 PNG 透明留白、跳跃键缩小 20%，两者视觉重量接近', () => {
    const action = buildCircleGeom('action');
    const jump = buildCircleGeom('jump');

    expect(action.geom.r * 2).toBeCloseTo(53.76, 2);
    expect(jump.geom.r * 2).toBeCloseTo(45.8752, 2);
    expect(action.geom.r).toBeGreaterThan(jump.geom.r);
  });

  it('四钮分组间距充足，且完整位于逻辑画布内', () => {
    const left = buildDirectionGeom('left');
    const right = buildDirectionGeom('right');
    const action = buildCircleGeom('action');
    const jump = buildCircleGeom('jump');

    expect(right.cx - left.cx).toBeGreaterThan(left.geom.w);
    expect(jump.cx - action.cx).toBeGreaterThan(action.geom.r + jump.geom.r);

    expect(left.cy + left.geom.h / 2).toBeLessThanOrEqual(LOGICAL_HEIGHT);
    expect(right.cy + right.geom.h / 2).toBeLessThanOrEqual(LOGICAL_HEIGHT);
    expect(action.cy + action.geom.r).toBeLessThanOrEqual(LOGICAL_HEIGHT);
    expect(jump.cy + jump.geom.r).toBeLessThanOrEqual(LOGICAL_HEIGHT);

    expect(inputConfig.wechat.buttons.left.x * LOGICAL_WIDTH).toBeCloseTo(left.cx, 5);
  });
});
