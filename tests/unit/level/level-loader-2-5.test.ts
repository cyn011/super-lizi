/**
 * tests/unit/level/level-loader-2-5.test.ts — 2-5 深渊回响关（cave 进阶 + 首启节拍平台）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 2-5、validateLevelData 通过、metadata.theme='cave'、goal x+w<width*ts、
 * 敌种组合（gu_bao×3 + ci_li×3 + du_fu×2 + shi_pao×2 = 10）、实体分桶（coin×7 / seed×5 / checkpoint×2）、
 * tile 去重 + oneway 位置、出生点、beat 启用 + beatPlatforms[0].tiles 全 ty=4（红线：平台必须放站立头顶之上）、
 * nextLevelId 续接、biome 接线（cave → 暗蓝岩壁）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('2-5 深渊回响关加载（注册表 + Loader）', () => {
  const data = levels['2-5'];
  const rt = LevelLoader.load(data);

  it('注册表含 2-5 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('2-5');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "cave"（石窟进阶，复用地形调色板）、name="深渊回响"、parTimeMs=84000', () => {
    expect(data.metadata.theme).toBe('cave');
    expect(data.metadata.name).toBe('深渊回响');
    expect(data.metadata.parTimeMs).toBe(84000);
  });

  it('goal x + w < width*ts（1472 < 1536），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1472);
  });

  it('敌种组合 = gu_bao×3 + ci_li×3 + du_fu×2 + shi_pao×2 = 10', () => {
    expect(rt.enemies).toHaveLength(10);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(3);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
  });

  it('实体分桶：coin×7 / seed×5（seed_01..seed_05）/ checkpoint×2', () => {
    expect(rt.coins).toHaveLength(7);
    expect(rt.seeds).toHaveLength(5);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[0].y).toBe(200);
    expect(rt.checkpoints).toHaveLength(2);
  });

  it('tile 去重（grid 幂等）：地面 ty7-8 全宽实心、墙 col0/col47 实心、oneway(10,11)@ty3/(26,27)@ty4/(40,41)@ty5', () => {
    expect(rt.world.isSolidTile(5, 7)).toBe(true);
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    expect(rt.world.isSolidTile(47, 8)).toBe(true);
    expect(rt.world.isOneWayTile(10, 3)).toBe(true);
    expect(rt.world.isOneWayTile(11, 3)).toBe(true);
    expect(rt.world.isOneWayTile(26, 4)).toBe(true);
    expect(rt.world.isOneWayTile(27, 4)).toBe(true);
    expect(rt.world.isOneWayTile(40, 5)).toBe(true);
    expect(rt.world.isOneWayTile(41, 5)).toBe(true);
    expect(rt.world.isSolidTile(26, 4)).toBe(false); // oneway 非 solid
  });

  it('出生点 spawn = (64, 190)，beat 启用且 beatPlatforms[0] 红线校验：tiles 全 ty=4（站立头顶之上，严禁 ty5）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.tracks).toHaveLength(1);
    expect(data.beat.tracks[0].target).toBe('bp_deep');
    expect(data.beatPlatforms).toBeDefined();
    const bp = data.beatPlatforms![0];
    expect(bp.id).toBe('bp_deep');
    for (const t of bp.tiles) {
      expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
    }
  });
});

describe('nextLevelId 进度链（2-5 续接 2-6，非末关）', () => {
  it('LEVEL_ORDER 续接至 2-6；nextLevelId("2-4") === "2-5"，("2-5") === "2-6"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '4-1']);
    expect(nextLevelId(LEVEL_ORDER, '2-4')).toBe('2-5');
    expect(nextLevelId(LEVEL_ORDER, '2-5')).toBe('2-6');
  });
});

describe('biome 解析器（theme → theme-palette，2-5 石窟调色板，锁色板内 0 新增色）', () => {
  it('cave → 暗蓝岩面 rockFace #4A78C0、天空 bg #1C2E49、暖橙 firelight #F2933C', () => {
    const pal = resolveBiome('cave');
    expect(pal.rockFace).toBe(0x4a78c0);
    expect(pal.rockBody).toBe(0x254060);
    expect(pal.bg).toBe(0x1c2e49);
    expect(pal.outline).toBe(0x2a1a12);
    expect(pal.firelight).toBe(0xf2933c);
    expect(pal.crystalGlow).toBe(0x6e7bf2);
  });
  it('biomeForLevel(2-5) = cave palette（rockFace 环境冷蓝 #4A78C0）', () => {
    expect(biomeForLevel(levels['2-5']).rockFace).toBe(0x4a78c0);
  });
});
