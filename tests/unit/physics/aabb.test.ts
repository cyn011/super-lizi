/**
 * tests/unit/physics/aabb.test.ts — core 零平台 AABB 重叠工具（S04-3 复用）。
 * 纯 Node，零 Phaser。验证 rectsOverlap 的相交 / 边贴边 / 分离语义，并与 Body 矩形结构兼容。
 */
import { describe, it, expect } from 'vitest';
import { rectsOverlap, type Rect } from '../../../src/core/physics/aabb';

describe('core/physics/aabb — rectsOverlap', () => {
  const a: Rect = { x: 0, y: 0, w: 10, h: 10 };

  it('重叠（内部 / 相交）返回 true', () => {
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: -5, y: -5, w: 10, h: 10 })).toBe(true);
  });

  it('边贴边（无实际交集）返回 false', () => {
    expect(rectsOverlap(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false); // 右贴边
    expect(rectsOverlap(a, { x: -5, y: 0, w: 5, h: 5 })).toBe(false); // 左贴边
    expect(rectsOverlap(a, { x: 0, y: 10, w: 5, h: 5 })).toBe(false); // 下贴边
  });

  it('完全分离返回 false', () => {
    expect(rectsOverlap(a, { x: 100, y: 100, w: 5, h: 5 })).toBe(false);
  });

  it('Body 矩形结构兼容（多出 vx/vy 字段不影响判定）', () => {
    const body = { x: 0, y: 0, w: 24, h: 34, vx: 100, vy: -50 };
    expect(rectsOverlap(body, { x: 10, y: 10, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(body, { x: 100, y: 0, w: 5, h: 5 })).toBe(false);
  });
});
