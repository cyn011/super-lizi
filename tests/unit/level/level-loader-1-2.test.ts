/**
 * tests/unit/level/level-loader-1-2.test.ts — 1-2 山川关（theme-system §5/§6 改法）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 1-2、validateLevelData 通过、metadata.theme='mountain'（山川 = cave palette 别名，
 * 零新资产）、biome 解析器对 mountain 返回冷暗 cave palette、goal 可达、敌种组合（旧 4 敌恒含 +
 * 山地专属 gu_bao×2 错相走廊）、实体分桶、出生点、nextLevelId 由 1-2 续接 2-1。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';

describe('1-2 山川关加载（注册表 + Loader）', () => {
  const data = levels['1-2'];
  const rt = LevelLoader.load(data);

  it('注册表含 1-2 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('1-2');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "mountain"（山川 = cave palette 别名，theme-system §5/§6）', () => {
    expect(data.metadata.theme).toBe('mountain');
  });

  it('biome 解析：mountain 复用 cave 冷暗 palette（零新增 hex），与 1-1 grass 形成冷/暖反差', () => {
    const pal = biomeForLevel(data);
    // cave palette 权威 hex（art/cave-biome-spec §6.2）：岩壁 #4A78C0 / 背景 #1C2E49
    expect(pal.rockFace).toBe(0x4a78c0);
    expect(pal.bg).toBe(0x1c2e49);
    expect(pal.danger).toBe(0xe8483b);
    // 别名语义：resolveBiome('mountain') 与 cave 同引用
    expect(resolveBiome('mountain')).toBe(THEME_PALETTES.cave);
    // fail-safe：未知 theme 仍回退 grass
    expect(resolveBiome('unknown_theme').rockFace).toBe(THEME_PALETTES.grass.rockFace);
  });

  it('goal x + w < width*ts（1504 < 1536），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1504);
  });

  it('敌种组合 = 旧 4 敌（ci_li×3 + du_fu×3 + shi_pao×2 + chong_feng×2）+ 山地专属 gu_bao×2 = 12', () => {
    expect(rt.enemies).toHaveLength(12);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(3);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(2);
  });

  it('gu_bao 实体 params.phaseOffset 保留（中段挑战峰：0 / 530 错相）', () => {
    const gb = data.entities.filter((e) => e.type === 'gu_bao');
    expect(gb).toHaveLength(2);
    const offsets = gb.map((e) => (e as { params?: { phaseOffset: number } }).params?.phaseOffset ?? 0);
    expect(offsets).toEqual([0, 530]);
  });

  it('实体分桶：coin / seed / checkpoint 不污染 enemies', () => {
    expect(rt.coins.length).toBeGreaterThan(0);
    expect(rt.seeds.length).toBe(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.checkpoints.length).toBe(2);
    expect(rt.checkpoints[0]).toEqual({ type: 'checkpoint', x: 960, y: 176 });
  });

  it('出生点 spawn 坐标正确（脚底贴地面 row7 顶 y=224 → body.y=190）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
  });
});

describe('进度链（1-1 → 1-2 → 1-3 → 1-4 → 2-1）', () => {
  it('LEVEL_ORDER 续接为 7 关；nextLevelId(LEVEL_ORDER, "1-2") === "1-3"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4']);
    expect(nextLevelId(LEVEL_ORDER, '1-2')).toBe('1-3');
  });
});
