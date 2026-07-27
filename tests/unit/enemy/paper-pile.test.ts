/**
 * tests/unit/enemy/paper-pile.test.ts — 办公文件堆 paper_pile（1-7 专属静态实心障碍）纯模块单测（GDD 1-7 §3）。
 *
 * 验证：
 *   - 静态属性：非可踩(isStompable=false) + 尺寸来自实体 w/h + 左上角 x/y（不重锚）+ 初始 idle。
 *   - 静止：update 不移动 x/y（仅登记为静态障碍，无 AI 位移/弹丸）。
 *   - overlaps 恒 false（非伤害、静态实心走 tile 网格，不进 damage-resolution 受伤/踩杀管线）。
 *   - 禁止踩：isStompable=false 且 overlaps 恒 false（碰撞走 CollisionWorld 实心瓦片，不消灭、不伤）。
 * 纯 TS，零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../../src/core/enemy/enemy-ai';
import type { CollisionWorld } from '../../../src/core/physics/collision';

// paper_pile 静态障碍：update 不读碰撞世界，桩仅占位。
const stubWorld = {
  tileSize: 32,
  width: 200,
  height: 20,
  isSolidTile: () => false,
  isOneWayTile: () => false,
} as unknown as CollisionWorld;

describe('paper_pile 办公文件堆（静态实心非伤害障碍）', () => {
  it('静态属性：非可踩 + 尺寸来自 w/h + 左上角 x/y + 初始 idle', () => {
    const e = new EnemyAI('paper_pile', 416, 160, 0, undefined, { w: 32, h: 64 });
    expect(e.type).toBe('paper_pile');
    expect(e.isStompable).toBe(false); // 静态实心非可踩（碰撞走 tile 网格）
    expect(e.width).toBe(32);
    expect(e.height).toBe(64);
    expect(e.x).toBe(416); // 左上角 x（不重锚）
    expect(e.y).toBe(160); // 左上角 y
    expect(e.state).toBe('idle');
  });

  it('update 为静态：x/y 不变（无 AI 位移 / 弹丸），返回空弹丸', () => {
    const e = new EnemyAI('paper_pile', 416, 160, 1, undefined, { w: 32, h: 64 });
    const x0 = e.x;
    const y0 = e.y;
    const proj = e.update(1 / 60, stubWorld, undefined);
    expect(e.x).toBe(x0);
    expect(e.y).toBe(y0);
    expect(proj).toEqual([]); // 无弹丸产出
  });

  it('overlaps 恒 false（非伤害，静态实心走 tile 网格，不进 damage-resolution）', () => {
    // p1 box [416,448]×[160,224]
    const e = new EnemyAI('paper_pile', 416, 160, 2, undefined, { w: 32, h: 64 });
    const bodyOnPile = { x: 420, y: 180, w: 24, h: 34, vx: 0, vy: 0 }; // 与堆叠盒重叠
    expect(e.overlaps(bodyOnPile)).toBe(false);
    const bodyOnTop = { x: 420, y: 150, w: 24, h: 34, vx: 0, vy: 300 }; // 自上方高速下落（贴顶）
    expect(e.overlaps(bodyOnTop)).toBe(false);
  });

  it('禁止踩：isStompable=false 且 overlaps 恒 false（碰撞走世界实心瓦片，不消灭/不伤）', () => {
    const e = new EnemyAI('paper_pile', 640, 192, 3, undefined, { w: 64, h: 32 });
    const body = { x: 650, y: 170, w: 24, h: 34, vx: 0, vy: 300 }; // 自上方高速踩下（落在堆叠盒内）
    expect(e.isStompable).toBe(false);
    expect(e.overlaps(body)).toBe(false);
  });

  it('不同尺寸正确解析（p2 64×32 / p4 32×32）', () => {
    const p2 = new EnemyAI('paper_pile', 640, 192, 4, undefined, { w: 64, h: 32 });
    expect(p2.width).toBe(64);
    expect(p2.height).toBe(32);
    expect(p2.x).toBe(640);
    expect(p2.y).toBe(192);
    const p4 = new EnemyAI('paper_pile', 1056, 192, 5, undefined, { w: 32, h: 32 });
    expect(p4.width).toBe(32);
    expect(p4.height).toBe(32);
  });
});
