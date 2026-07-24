/**
 * tests/unit/level/level-runtime.test.ts — S05-1 动态实心集（beat 域）。
 *
 * 覆盖：
 *   ① setBeatTileSolid 后 world.isSolidTile 随之变化（solid↔ghost 翻转）；
 *   ② 越界封边语义不受 dynamicSolid 破坏（左/右/底=墙、顶=开放）；
 *   ③ 越界 tile 不进入 dynamicSolid（isSolid 对越界走封边，不被动态集污染）；
 *   ④ initial:'solid' 平台构造期即登记、initial 缺省('ghost')不登记。
 * 与 level-loader.test.ts 互补（此处偏重「动态翻转 + 封边不变」）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';

function makeLevel(opts: { platforms?: unknown[]; enabled?: boolean } = {}) {
  const width = 16;
  const height = 9;
  const tiles: unknown[] = [];
  for (let tx = 0; tx < width; tx++) {
    tiles.push({ tx, ty: 7, kind: 'solid' });
    tiles.push({ tx, ty: 8, kind: 'solid' });
  }
  for (let ty = 0; ty < height; ty++) {
    tiles.push({ tx: 0, ty, kind: 'solid' });
    tiles.push({ tx: width - 1, ty, kind: 'solid' });
  }
  return {
    id: 't-rt',
    version: 1,
    tileSize: 32,
    width,
    height,
    tiles,
    entities: [],
    props: [],
    checkpoints: [],
    goal: { type: 'triumph_gate', x: (width - 1) * 32, y: 7 * 32 - 64, w: 32, h: 64 },
    spawn: { x: 64, y: 6 * 32 },
    beat: { enabled: opts.enabled ?? true, bpm: 120, grid: 8, tracks: [] },
    beatPlatforms: opts.platforms,
    metadata: { name: 't', theme: 'grass' },
  };
}

describe('S05-1 RuntimeLevel 动态实心集', () => {
  it('setBeatTileSolid 翻转 world.isSolidTile（solid↔ghost）', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }] }],
    });
    const rt = LevelLoader.load(json);
    expect(rt.world.isSolidTile(5, 4)).toBe(true); // initial solid 已登记

    rt.setBeatTileSolid(5, 4, false); // → ghost
    expect(rt.world.isSolidTile(5, 4)).toBe(false);

    rt.setBeatTileSolid(5, 4, true); // → solid 可踩
    expect(rt.world.isSolidTile(5, 4)).toBe(true);

    // 相邻从未登记过的空气 tile 不受影响
    expect(rt.world.isSolidTile(6, 4)).toBe(false);
  });

  it('越界封边语义不受 dynamicSolid 破坏（左/右/底=墙、顶=开放）', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }] },
      { id: 'bp_b', initial: 'ghost', tiles: [{ tx: 8, ty: 4 }] }],
    });
    const rt = LevelLoader.load(json);
    const w = 16;
    const h = 9;
    // 左墙 / 右墙 / 底墙
    expect(rt.world.isSolidTile(-1, 0)).toBe(true);
    expect(rt.world.isSolidTile(w, 0)).toBe(true);
    expect(rt.world.isSolidTile(5, h)).toBe(true);
    // 顶部开放
    expect(rt.world.isSolidTile(5, -1)).toBe(false);
  });

  it('越界 tile 不污染 dynamicSolid（封边优先于动态集）', () => {
    const json = makeLevel({ platforms: [] });
    const rt = LevelLoader.load(json);
    // 越界处即便试图登记 solid，isSolid 仍按封边语义（顶开放、其余墙）
    rt.setBeatTileSolid(-5, -5, true);
    expect(rt.world.isSolidTile(-5, -5)).toBe(false); // 顶越界 → 开放
    rt.setBeatTileSolid(99, 99, true);
    expect(rt.world.isSolidTile(99, 99)).toBe(true); // 底/右越界 → 墙（与动态集无关）
  });

  it('构造期按 initial 登记：solid 平台入集、缺省(ghost)不登记', () => {
    const json = makeLevel({
      platforms: [
        { id: 'bp_solid', initial: 'solid', tiles: [{ tx: 5, ty: 4 }] },
        { id: 'bp_ghost', initial: 'ghost', tiles: [{ tx: 6, ty: 4 }] },
        { id: 'bp_def', tiles: [{ tx: 7, ty: 4 }] }, // 缺省 → ghost（S05-1 实现口径）
      ],
    });
    const rt = LevelLoader.load(json);
    expect(rt.world.isSolidTile(5, 4)).toBe(true); // initial solid
    expect(rt.world.isSolidTile(6, 4)).toBe(false); // initial ghost
    expect(rt.world.isSolidTile(7, 4)).toBe(false); // 缺省 ghost
  });
});
