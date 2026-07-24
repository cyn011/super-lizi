/**
 * tests/unit/beat/beat-schema.test.ts — S05-1 谱面 schema 与 fail-fast（core 纯逻辑）。
 *
 * 覆盖：
 *   ① LevelData 收紧后（BeatTrackEntry[] + beatPlatforms）经 validateLevelData 仍合法；
 *   ② BeatDrivenSystem 构造期 fail-fast：track.target 无对应 beatPlatforms.id → 抛错。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { BeatClock } from '../../../src/core/beat/beat-clock';
import { BeatDrivenSystem } from '../../../src/core/beat/beat-driven-system';

/** 构造一个最小合法关卡 JSON（地面 + 左右墙 + 出生/终点 + beat）。 */
function makeLevel(opts: {
  platforms?: unknown[];
  tracks?: unknown[];
  enabled?: boolean;
} = {}) {
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
    beat: {
      enabled: opts.enabled ?? true,
      bpm: 120,
      grid: 8,
      tracks: opts.tracks ?? [],
    },
    beatPlatforms: opts.platforms,
    metadata: { name: 't', theme: 'grass' },
  };
}

describe('S05-1 节拍谱面 schema', () => {
  it('收紧后 LevelData（BeatTrackEntry[] + beatPlatforms）经 validateLevelData 合法', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }, { tx: 6, ty: 4 }] }],
      tracks: [{ target: 'bp_a', pattern: 'SSSSSSSSGGGGGGGG' }],
    });
    expect(validateLevelData(json)).toBe(true);
    // 类型断言：tracks 为 BeatTrackEntry[]、beatPlatforms 为 BeatPlatformDef[]
    const data = json as unknown as {
      beat: { tracks: Array<{ target: string; pattern?: string }> };
      beatPlatforms?: Array<{ id: string }>;
    };
    expect(data.beat.tracks[0].target).toBe('bp_a');
    expect(data.beatPlatforms?.[0].id).toBe('bp_a');
  });

  it('BeatDrivenSystem fail-fast：track.target 无对应 beatPlatforms.id → 构造抛错', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }] }],
      tracks: [{ target: 'bp_missing', pattern: 'S' }],
    });
    const rt = LevelLoader.load(json);
    const beat = new BeatClock(rt.data.beat);
    expect(() => new BeatDrivenSystem(rt, beat, rt.data.beat.tracks)).toThrow(/bp_missing/);
  });

  it('BeatDrivenSystem 正常构造：target 命中 beatPlatforms.id（不抛错）', () => {
    const json = makeLevel({
      platforms: [{ id: 'bp_a', initial: 'solid', tiles: [{ tx: 5, ty: 4 }] }],
      tracks: [{ target: 'bp_a', pattern: 'S' }],
    });
    const rt = LevelLoader.load(json);
    const beat = new BeatClock(rt.data.beat);
    expect(() => new BeatDrivenSystem(rt, beat, rt.data.beat.tracks)).not.toThrow();
  });
});
