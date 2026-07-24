/**
 * tests/unit/beat/beat-driven-system.test.ts — S05-1 节拍驱动系统行为（core 纯逻辑）。
 *
 * 用真实 RuntimeLevel（含 beatPlatforms）+ BeatClock，验证：
 *   ① applyBeat 按 pattern 正确翻转 dynamicSolid（S→solid 可踩、G→ghost 不可踩）；
 *   ② 确定性（同 beatIndex → 同相位，与调用顺序无关）；
 *   ③ 单点模式（beat + action）触发一次；
 *   ④ 'T' toggle 取反（首拍取 initial 的反）；
 *   ⑤ fail-fast（target 无匹配抛错，与 beat-schema 互补）。
 * 零 Phaser / 零平台 API；不调 beat.crossedBeat（由 advanceBeat 负责）。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { BeatClock } from '../../../src/core/beat/beat-clock';
import { BeatDrivenSystem } from '../../../src/core/beat/beat-driven-system';

function makeLevel(opts: { platforms: unknown[]; tracks: unknown[]; enabled?: boolean }) {
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
    id: 't-beat',
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
    beat: { enabled: opts.enabled ?? true, bpm: 120, grid: 8, tracks: opts.tracks },
    beatPlatforms: opts.platforms,
    metadata: { name: 't', theme: 'grass' },
  };
}

describe('S05-1 BeatDrivenSystem 行为', () => {
  it('applyBeat 按 pattern 翻转 dynamicSolid（S→solid 可踩 / G→ghost 不可踩）', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }, { tx: 6, ty: 4 }] }],
      tracks: [{ target: 'bp_a', pattern: 'SSSSSSSSGGGGGGGG' }], // 16 长：0-7 solid, 8-15 ghost
    });
    const rt = LevelLoader.load(json);
    const beat = new BeatClock(rt.data.beat);
    const sys = new BeatDrivenSystem(rt, beat, rt.data.beat.tracks);

    // 初始 initial:'solid' → 已登记
    expect(rt.world.isSolidTile(5, 4)).toBe(true);
    expect(rt.world.isSolidTile(6, 4)).toBe(true);

    // beat 0 → pattern[0]='S' → 仍 solid
    sys.applyBeat(0);
    expect(rt.world.isSolidTile(5, 4)).toBe(true);
    expect(rt.world.isSolidTile(6, 4)).toBe(true);

    // beat 8 → pattern[8]='G' → ghost（不可踩）
    sys.applyBeat(8);
    expect(rt.world.isSolidTile(5, 4)).toBe(false);
    expect(rt.world.isSolidTile(6, 4)).toBe(false);

    // beat 0 再触发 → 回到 solid（按 pattern 绝对映射，与历史无关）
    sys.applyBeat(0);
    expect(rt.world.isSolidTile(5, 4)).toBe(true);
    expect(rt.world.isSolidTile(6, 4)).toBe(true);
  });

  it('确定性：同 beatIndex → 同相位（独立系统、不同调用顺序结果一致）', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'ghost', tiles: [{ tx: 5, ty: 4 }] }],
      tracks: [{ target: 'bp_a', pattern: 'SSSSSSSSGGGGGGGG' }],
    });
    const beat = new BeatClock((json as any).beat);

    // 顺序 A：0 → 8
    const rtA = LevelLoader.load(json);
    const sysA = new BeatDrivenSystem(rtA, beat, (json as any).beat.tracks);
    sysA.applyBeat(0);
    sysA.applyBeat(8);

    // 顺序 B：直接到 8（无前置 applyBeat）
    const rtB = LevelLoader.load(json);
    const sysB = new BeatDrivenSystem(rtB, beat, (json as any).beat.tracks);
    sysB.applyBeat(8);

    // 二者在 beat 8 下相位一致（均为 ghost）
    expect(rtA.world.isSolidTile(5, 4)).toBe(rtB.world.isSolidTile(5, 4));
    expect(rtA.world.isSolidTile(5, 4)).toBe(false);
  });

  it("单点模式：beat===N 时按 action 触发一次（'G'），非触发拍保持上一相位", () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_b', initial: 'solid', tiles: [{ tx: 7, ty: 4 }] }],
      tracks: [{ target: 'bp_b', beat: 3, action: 'ghost' }],
    });
    const rt = LevelLoader.load(json);
    const beat = new BeatClock(rt.data.beat);
    const sys = new BeatDrivenSystem(rt, beat, rt.data.beat.tracks);

    // 初始 solid
    expect(rt.world.isSolidTile(7, 4)).toBe(true);

    // beat 3 → 单点触发 ghost
    sys.applyBeat(3);
    expect(rt.world.isSolidTile(7, 4)).toBe(false);

    // beat 2（非触发拍）→ 保持上一相位（ghost）
    sys.applyBeat(2);
    expect(rt.world.isSolidTile(7, 4)).toBe(false);

    // beat 4（非触发拍）→ 仍保持 ghost
    sys.applyBeat(4);
    expect(rt.world.isSolidTile(7, 4)).toBe(false);
  });

  it("'T' toggle：相对上一拍取反，首拍取 initial 的反", () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_t', initial: 'solid', tiles: [{ tx: 9, ty: 4 }] }],
      tracks: [{ target: 'bp_t', pattern: 'T' }],
    });
    const rt = LevelLoader.load(json);
    const beat = new BeatClock(rt.data.beat);
    const sys = new BeatDrivenSystem(rt, beat, rt.data.beat.tracks);

    // 初始 solid
    expect(rt.world.isSolidTile(9, 4)).toBe(true);
    // beat 0 → 'T' 首拍取 initial('solid') 的反 → ghost
    sys.applyBeat(0);
    expect(rt.world.isSolidTile(9, 4)).toBe(false);
    // beat 1 → 'T' 取反（上一拍 ghost）→ solid
    sys.applyBeat(1);
    expect(rt.world.isSolidTile(9, 4)).toBe(true);
    // beat 2 → 再次取反 → ghost
    sys.applyBeat(2);
    expect(rt.world.isSolidTile(9, 4)).toBe(false);
  });

  it('fail-fast：track.target 无对应平台 → 构造抛错', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }] }],
      tracks: [{ target: 'nope', pattern: 'S' }],
    });
    const rt = LevelLoader.load(json);
    const beat = new BeatClock(rt.data.beat);
    expect(() => new BeatDrivenSystem(rt, beat, rt.data.beat.tracks)).toThrow(/nope/);
  });
});
