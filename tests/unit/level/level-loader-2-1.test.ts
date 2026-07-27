/**
 * tests/unit/level/level-loader-2-1.test.ts — 2-1 洞穴关（P-LEVEL-04）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 2-1、validateLevelData 通过、metadata.theme='cave'、goal x+w<width、
 * 敌种组合（旧 4 敌 + gu_bao×5，params.phaseOffset 保留）、实体分桶、tile 去重（grid 幂等）、
 * 出生点、nextLevelId 由 1-2 推导 2-1、biome 解析器对 cave 返回冷暗 palette。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('2-1 洞穴关加载（注册表 + Loader）', () => {
  const data = levels['2-1'];
  const rt = LevelLoader.load(data);

  it('注册表含 2-1 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('2-1');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "cave"（biome 接线点）', () => {
    expect(data.metadata.theme).toBe('cave');
    expect(data.metadata.name).toBe('石窟回响');
  });

  it('goal x + w < width*ts（1376 < 1408），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1376);
  });

  it('敌种组合 = 旧 4 敌（ci_li×2 + du_fu×1 + shi_pao×1）+ gu_bao×5 = 9', () => {
    expect(rt.enemies).toHaveLength(9);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(2);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(1);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(1);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(5);
  });

  it('gu_bao 实体 params.phaseOffset 保留（错相走廊：0 / 0 / 1060 / 0 / 530）', () => {
    const gb = data.entities.filter((e) => e.type === 'gu_bao');
    expect(gb).toHaveLength(5);
    const offsets = gb.map((e) => (e as { params?: { phaseOffset: number } }).params?.phaseOffset ?? 0);
    expect(offsets).toEqual([0, 0, 1060, 0, 530]);
  });

  it('实体分桶：coin×8 / seed×6 / checkpoint×2', () => {
    expect(rt.coins).toHaveLength(8);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.checkpoints).toHaveLength(2);
  });

  it('tile 去重（grid 幂等）：地面 ty7-8 全宽实心、墙 col0/col43 实心、悬浮岩台(28,29)@ty4、oneway(18-20)@ty5', () => {
    expect(rt.world.isSolidTile(5, 7)).toBe(true);
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍为实心
    expect(rt.world.isSolidTile(43, 8)).toBe(true);
    expect(rt.world.isSolidTile(28, 4)).toBe(true); // 悬浮 solid
    expect(rt.world.isSolidTile(29, 4)).toBe(true);
    expect(rt.world.isOneWayTile(19, 5)).toBe(true);
    expect(rt.world.isOneWayTile(18, 5)).toBe(true);
    expect(rt.world.isOneWayTile(20, 5)).toBe(true);
    expect(rt.world.isSolidTile(19, 5)).toBe(false); // oneway 非 solid
  });

  it('出生点 spawn = (64, 190)，beat 禁用（本关不引入节拍平台）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(false);
    expect(data.beat.tracks).toEqual([]);
  });
});

describe('nextLevelId 进度链（1-2 → 1-3 → 1-4 → 1-5 → 1-6 → 1-7 → 2-1 → 2-2 → 2-3 → 2-4）', () => {
  it('LEVEL_ORDER 续接为 7 关；nextLevelId(LEVEL_ORDER, "1-2") === "1-3"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4']);
    expect(nextLevelId(LEVEL_ORDER, '1-2')).toBe('1-3');
  });
  it('2-1 已非末关 → nextLevelId 返回 "2-2"；末关 2-4 返回 null', () => {
    expect(nextLevelId(LEVEL_ORDER, '2-1')).toBe('2-2');
    expect(nextLevelId(LEVEL_ORDER, '2-4')).toBeNull();
  });
});

describe('biome 解析器（theme → theme-palette，对齐 art/cave-biome-spec §6）', () => {
  it('cave → 冷暗 palette（权威 hex：rockFace #4A78C0、bg #1C2E49 派生 tint）', () => {
    const pal = resolveBiome('cave');
    expect(pal.rockFace).toBe(0x4a78c0);
    expect(pal.bg).toBe(0x1c2e49); // darken(#4A78C0,0.38)
    expect(pal.rockBody).toBe(0x254060); // darken(#4A78C0,0.50)
    expect(pal.crystalCore).toBe(0xffd23f);
    expect(pal.outline).toBe(0x2a1a12);
  });
  it('grass → 草原默认暖色（bg=null，保持 1-1 零改动；1-2 已切 mountain 不影响 grass palette）', () => {
    const pal = resolveBiome('grass');
    expect(pal.bg).toBeNull();
    expect(pal.rockFace).toBe(0x3a2a1f);
  });
  it('未知 theme 回退 grass（fail-safe）', () => {
    expect(resolveBiome('unknown').bg).toBeNull();
  });
  it('biomeForLevel(2-1) = cave palette（rockFace 冷蓝）', () => {
    expect(biomeForLevel(levels['2-1']).rockFace).toBe(0x4a78c0);
  });
  it('biomeForLevel(1-1) = grass 默认（不受影响）', () => {
    expect(biomeForLevel(levels['1-1']).bg).toBeNull();
  });
});
