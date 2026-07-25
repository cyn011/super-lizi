/**
 * tests/unit/level/level-loader-2-2.test.ts — 2-2 藤林关（B 弹藤落地）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 2-2、validateLevelData 通过、metadata.theme='vine_forest'、goal x+w<width*ts、
 * 敌种组合（bouncy_vine×4 + ci_li×2 + du_fu×2 + shi_pao×2 = 10）、强弹藤 params.power=1.2 保留、
 * 实体分桶（coin×8 / seed×6 / checkpoint×2）、tile 去重、出生点、beat 禁用、biome 接线（藤林调色板）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('2-2 藤林关加载（注册表 + Loader）', () => {
  const data = levels['2-2'];
  const rt = LevelLoader.load(data);

  it('注册表含 2-2 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('2-2');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "vine_forest"（biome 接线点）、name="藤林回响"', () => {
    expect(data.metadata.theme).toBe('vine_forest');
    expect(data.metadata.name).toBe('藤林回响');
  });

  it('goal x + w < width*ts（1440 < 1472），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1440);
  });

  it('敌种组合 = bouncy_vine×4 + ci_li×2 + du_fu×2 + shi_pao×2 = 10', () => {
    expect(rt.enemies).toHaveLength(10);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'bouncy_vine')).toHaveLength(4);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(2);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
  });

  it('强弹藤（idx: x=992）params.power=1.2 保留；其余默认值透传', () => {
    const vines = data.entities.filter(
      (e) => e.type === 'bouncy_vine',
    ) as Array<{ type: string; x: number; params?: { power: number } }>;
    expect(vines).toHaveLength(4);
    const strong = vines.find((v) => v.x === 992);
    expect(strong?.params?.power).toBe(1.2);
    const normal = vines.filter((v) => !v.params || v.params.power === 1);
    expect(normal.length).toBe(3);
  });

  it('实体分桶：coin×8 / seed×6（seed_01@y=80 高空）/ checkpoint×2', () => {
    expect(rt.coins).toHaveLength(8);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[0].y).toBe(80);
    expect(rt.checkpoints).toHaveLength(2);
  });

  it('tile 去重（grid 幂等）：地面 ty7-8 全宽实心、墙 col0/col45 实心、oneway(5,6)@ty3/(22,23)@ty4/(33,34)@ty5', () => {
    expect(rt.world.isSolidTile(5, 7)).toBe(true);
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    expect(rt.world.isSolidTile(45, 8)).toBe(true);
    expect(rt.world.isOneWayTile(5, 3)).toBe(true);
    expect(rt.world.isOneWayTile(6, 3)).toBe(true);
    expect(rt.world.isOneWayTile(22, 4)).toBe(true);
    expect(rt.world.isOneWayTile(23, 4)).toBe(true);
    expect(rt.world.isOneWayTile(33, 5)).toBe(true);
    expect(rt.world.isOneWayTile(34, 5)).toBe(true);
    expect(rt.world.isSolidTile(22, 4)).toBe(false); // oneway 非 solid
  });

  it('出生点 spawn = (64, 190)，beat 禁用（本关不引入节拍平台）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(false);
    expect(data.beat.tracks).toEqual([]);
  });
});

describe('nextLevelId 进度链（2-2 → 2-3）', () => {
  it('LEVEL_ORDER 含 2-2；nextLevelId(LEVEL_ORDER, "2-2") === "2-3"', () => {
    expect(LEVEL_ORDER).toContain('2-2');
    expect(nextLevelId(LEVEL_ORDER, '2-2')).toBe('2-3');
  });
});

describe('biome 解析器（theme → theme-palette，2-2 藤林调色板，全锁色板 0 新增色）', () => {
  it('vine_forest → 草绿基色 rockFace #7CC242、天光 bg #5BC8F5、阴影绿 rockBody #5FA82F', () => {
    const pal = resolveBiome('vine_forest');
    expect(pal.rockFace).toBe(0x7cc242);
    expect(pal.bg).toBe(0x5bc8f5);
    expect(pal.rockBody).toBe(0x5fa82f);
    expect(pal.outline).toBe(0x2a1a12);
    expect(pal.crystalCore).toBe(0xffd23f);
  });
  it('biomeForLevel(2-2) = vine_forest palette（rockFace 草绿）', () => {
    expect(biomeForLevel(levels['2-2']).rockFace).toBe(0x7cc242);
  });
});
