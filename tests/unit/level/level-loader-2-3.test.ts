/**
 * tests/unit/level/level-loader-2-3.test.ts — 2-3 风暴天空关（C 气旋落地）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 2-3、validateLevelData 通过、metadata.theme='storm_sky'、goal x+w<width*ts、
 * 敌种组合（cyclone×4 + du_fu×2 + chong_feng×2 + shi_pao×2 = 10）、气旋 params(w/h/liftAcc/riseMax/dragX) 保留、
 * 实体分桶（coin×8 / seed×6 / checkpoint×2）、tile 去重、出生点、beat 禁用、biome 接线（风暴天空调色板）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('2-3 风暴天空关加载（注册表 + Loader）', () => {
  const data = levels['2-3'];
  const rt = LevelLoader.load(data);

  it('注册表含 2-3 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('2-3');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "storm_sky"（biome 接线点）、name="风暴天空"', () => {
    expect(data.metadata.theme).toBe('storm_sky');
    expect(data.metadata.name).toBe('风暴天空');
  });

  it('goal x + w < width*ts（1440 < 1472），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1440);
  });

  it('敌种组合 = cyclone×4 + du_fu×2 + chong_feng×2 + shi_pao×2 = 10', () => {
    expect(rt.enemies).toHaveLength(10);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'cyclone')).toHaveLength(4);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
  });

  it('气旋实体 params 全部保留（w=96/h=160/liftAcc=2600/riseMax=220/dragX=0）×4', () => {
    const cycs = data.entities.filter(
      (e) => e.type === 'cyclone',
    ) as Array<{ type: string; params?: { w: number; h: number; liftAcc: number; riseMax: number; dragX: number } }>;
    expect(cycs).toHaveLength(4);
    for (const c of cycs) {
      expect(c.params?.w).toBe(96);
      expect(c.params?.h).toBe(160);
      expect(c.params?.liftAcc).toBe(2600);
      expect(c.params?.riseMax).toBe(220);
      expect(c.params?.dragX).toBe(0);
    }
  });

  it('实体分桶：coin×8 / seed×6（seed_01@y=80 高空）/ checkpoint×2', () => {
    expect(rt.coins).toHaveLength(8);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[0].y).toBe(80);
    expect(rt.checkpoints).toHaveLength(2);
  });

  it('tile 去重（grid 幂等）：地面 ty7-8 全宽实心、墙 col0/col45 实心、oneway(5,6)@ty3/(22,23)@ty3/(33,34)@ty5', () => {
    expect(rt.world.isSolidTile(5, 7)).toBe(true);
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    expect(rt.world.isSolidTile(45, 8)).toBe(true);
    expect(rt.world.isOneWayTile(5, 3)).toBe(true);
    expect(rt.world.isOneWayTile(6, 3)).toBe(true);
    expect(rt.world.isOneWayTile(22, 3)).toBe(true);
    expect(rt.world.isOneWayTile(23, 3)).toBe(true);
    expect(rt.world.isOneWayTile(33, 5)).toBe(true);
    expect(rt.world.isOneWayTile(34, 5)).toBe(true);
    expect(rt.world.isSolidTile(22, 3)).toBe(false); // oneway 非 solid
  });

  it('出生点 spawn = (64, 190)，beat 禁用（本关不引入节拍平台）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(false);
    expect(data.beat.tracks).toEqual([]);
  });
});

describe('nextLevelId 进度链（2-4 为末关 → null）', () => {
  it('LEVEL_ORDER 末关为 2-4；nextLevelId(LEVEL_ORDER, "2-3") === "2-4"，("2-4") === null', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4']);
    expect(nextLevelId(LEVEL_ORDER, '2-3')).toBe('2-4');
    expect(nextLevelId(LEVEL_ORDER, '2-4')).toBeNull();
  });
});

describe('biome 解析器（theme → theme-palette，2-3 风暴天空调色板，全锁色板 0 新增色）', () => {
  it('storm_sky → 蓝紫岩台 rockFace #6E7BF2、阴沉天光 bg #4A78C0', () => {
    const pal = resolveBiome('storm_sky');
    expect(pal.rockFace).toBe(0x6e7bf2);
    expect(pal.bg).toBe(0x4a78c0);
    expect(pal.rockBody).toBe(0x4a78c0);
    expect(pal.outline).toBe(0x2a1a12);
    expect(pal.crystalCore).toBe(0xffd23f);
  });
  it('biomeForLevel(2-3) = storm_sky palette（rockFace 蓝紫）', () => {
    expect(biomeForLevel(levels['2-3']).rockFace).toBe(0x6e7bf2);
  });
});
