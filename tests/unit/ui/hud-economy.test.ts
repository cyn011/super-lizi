/**
 * tests/unit/ui/hud-economy.test.ts — HUD 经济字段纯格式化回归（S04-5）。
 *
 * 纯 Node（零 Phaser / 零平台 API，testing.md §2 约束），验证「数值 → 字符串」格式化逻辑。
 * 渲染侧（金币 Graphic 矢量 + Text 系统字体）由真机/模拟器人眼回归验证（与 hud-hearts 同策略）。
 */
import { describe, it, expect } from 'vitest';
import {
  formatScore,
  formatCoins,
  formatCombo,
  shouldShowCombo,
} from '../../../src/ui/hud-economy';

describe('HUD 经济字段格式化 (S04-5)', () => {
  it('formatScore → "分数 N"（中文 ≥14px 等效）', () => {
    expect(formatScore(0)).toBe('分数 0');
    expect(formatScore(100)).toBe('分数 100');
    expect(formatScore(12345)).toBe('分数 12345');
    expect(formatScore(-50)).toBe('分数 -50');
  });

  it('formatCoins → "×N"', () => {
    expect(formatCoins(0)).toBe('×0');
    expect(formatCoins(3)).toBe('×3');
    expect(formatCoins(99)).toBe('×99');
  });

  it('formatCombo → "xN"（拉丁 x，区别于金币 ×）', () => {
    expect(formatCombo(2)).toBe('x2');
    expect(formatCombo(4)).toBe('x4');
  });

  it('shouldShowCombo → 仅 mult>1 显示（=1 常态隐藏，避免常驻干扰）', () => {
    expect(shouldShowCombo(1)).toBe(false);
    expect(shouldShowCombo(0.5)).toBe(false);
    expect(shouldShowCombo(2)).toBe(true);
    expect(shouldShowCombo(4)).toBe(true);
  });

  it('组合：踩怪连击链 score/coins/combo 字符串互不冲突', () => {
    expect(formatScore(300)).toBe('分数 300');
    expect(formatCoins(2)).toBe('×2');
    expect(formatCombo(3)).toBe('x3');
    expect(shouldShowCombo(3)).toBe(true);
    expect(shouldShowCombo(1)).toBe(false);
  });
});
