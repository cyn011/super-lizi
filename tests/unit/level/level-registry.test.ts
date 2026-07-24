/**
 * tests/unit/level/level-registry.test.ts — 关卡注册表 + 进度链纯函数（S06）。
 *
 * 验证：
 *   - levels 注册表含 1-1 / 1-2，且 1-2 通过 validateLevelData；
 *   - LEVEL_ORDER = ['1-1','1-2']；
 *   - nextLevelId 推导下一关（末关返回 null）。
 * 零 Phaser / 零平台 API（core 铁律）。
 */
import { describe, it, expect } from 'vitest';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { validateLevelData } from '../../../src/core/level/level-data';
import { nextLevelId } from '../../../src/core/level/level-order';

describe('关卡注册表（1-2 流水线复用）', () => {
  it('levels 注册表含 1-1 与 1-2', () => {
    expect(levels['1-1']).toBeTruthy();
    expect(levels['1-2']).toBeTruthy();
    expect(levels['1-2'].id).toBe('1-2');
  });

  it('levels["1-2"] 通过 validateLevelData（合法 LevelData）', () => {
    expect(validateLevelData(levels['1-2'])).toBe(true);
  });

  it('1-2 节拍 pattern 为 D4 修正值 SSSGGG（非 spec 初稿 GSGSGSGSGSGSGSGS）', () => {
    const track = levels['1-2'].beat.tracks[0];
    expect(track.target).toBe('bp_1_2');
    expect(track.pattern).toBe('SSSGGG');
  });

  it('1-2 节拍平台 tile 不出现在 tiles[]（initial=ghost）', () => {
    const bp = levels['1-2'].beatPlatforms?.[0];
    expect(bp?.id).toBe('bp_1_2');
    const inTiles = levels['1-2'].tiles.some(
      (t) => bp?.tiles.some((bt) => bt.tx === t.tx && bt.ty === t.ty),
    );
    expect(inTiles).toBe(false);
  });

  it('LEVEL_ORDER = ["1-1","1-2"]', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2']);
  });
});

describe('nextLevelId（进度链推导）', () => {
  it('当前关在顺序中有后继时返回下一关 id', () => {
    expect(nextLevelId(['1-1', '1-2'], '1-1')).toBe('1-2');
  });

  it('当前关为末关（或不在顺序中）返回 null', () => {
    expect(nextLevelId(['1-1', '1-2'], '1-2')).toBeNull();
    expect(nextLevelId(['1-1', '1-2'], '9-9')).toBeNull();
  });
});
