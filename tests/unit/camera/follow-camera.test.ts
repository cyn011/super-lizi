/**
 * tests/unit/camera/follow-camera.test.ts — C5 相机钳制数学（pure，Node 单测）。
 * follow-camera 零 Phaser 运行时依赖，computeCameraScroll 可被直接验证。
 * 关宽 1280 > 逻辑宽 512 → 必须钳制；关高 288 == 逻辑高 → 纵向不滚。
 */
import { describe, it, expect } from 'vitest';
import {
  computeCameraScroll,
  FollowCamera,
  type ScrollableCamera,
} from '../../../src/game/camera/follow-camera';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../../../src/platform/detect';

const LEVEL_W = 40 * 32; // 1280
const LEVEL_H = 9 * 32; // 288

describe('C5 FollowCamera 钳制（F9）', () => {
  it('左端：目标在左侧 → scrollX 钳到 0', () => {
    const s = computeCameraScroll(100, 144, LEVEL_W, LEVEL_H);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });

  it('中段：scrollX = targetX - LOGICAL_WIDTH/2', () => {
    const cx = 640;
    const s = computeCameraScroll(cx, 144, LEVEL_W, LEVEL_H);
    expect(s.x).toBe(cx - LOGICAL_WIDTH / 2);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(LEVEL_W - LOGICAL_WIDTH);
  });

  it('右端：目标在右侧 → scrollX 钳到 maxX（不越界）', () => {
    const s = computeCameraScroll(5000, 144, LEVEL_W, LEVEL_H);
    expect(s.x).toBe(LEVEL_W - LOGICAL_WIDTH);
  });

  it('负目标 → 钳到 0（不越左界）', () => {
    const s = computeCameraScroll(-500, 144, LEVEL_W, LEVEL_H);
    expect(s.x).toBe(0);
  });

  it('纵向：关高==逻辑高 → scrollY 恒 0', () => {
    const s = computeCameraScroll(640, 1000, LEVEL_W, LEVEL_H);
    expect(s.y).toBe(0);
  });

  it('FollowCamera 包裹相机对象设置 scrollX/scrollY（微信 CANVAS/NONE 走内部 transform）', () => {
    const cam: ScrollableCamera = { scrollX: 0, scrollY: 0 };
    const fc = new FollowCamera(cam, LEVEL_W, LEVEL_H);
    fc.follow(640, 144);
    expect(cam.scrollX).toBe(640 - LOGICAL_WIDTH / 2);
    expect(cam.scrollY).toBe(0);
  });
});
