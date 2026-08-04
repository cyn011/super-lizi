/**
 * tests/unit/level/level-loader-2-4.test.ts — 2-4 剪影回廊关（D1 嘟浮剪影落地）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 2-4、validateLevelData 通过、metadata.theme='silhouette'、goal x+w<width*ts、
 * 敌种组合（du_fu_silhouette×3 + du_fu×3 + ci_li×2 + shi_pao×2 = 10）、剪影 params(mirrorOffset/pairId) 保留、
 * 实体分桶（coin×8 / seed×6 / checkpoint×2）、tile 去重、出生点、beat 禁用、LEVEL_ORDER 续接、biome 接线。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('2-4 剪影回廊关加载（注册表 + Loader）', () => {
  const data = levels['2-4'];
  const rt = LevelLoader.load(data);

  it('注册表含 2-4 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('2-4');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "silhouette"（新增剪影主题，逆光辉廊）、name="剪影回廊"', () => {
    expect(data.metadata.theme).toBe('silhouette');
    expect(data.metadata.name).toBe('剪影回廊');
  });

  it('goal x + w < width*ts（1440 < 1472），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1440);
  });

  it('敌种组合 = du_fu_silhouette×3 + du_fu×3 + ci_li×2 + shi_pao×2 = 10', () => {
    expect(rt.enemies).toHaveLength(10);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'du_fu_silhouette')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(3);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
  });

  it('剪影实体 params 保留 mirrorOffset=3.14159 且 pairId 正确配对光嘟浮', () => {
    const sils = data.entities.filter(
      (e) => e.type === 'du_fu_silhouette',
    ) as Array<{ type: string; params?: { mirrorOffset: number; pairId: number } }>;
    expect(sils).toHaveLength(3);
    const pairs = sils.map((s) => s.params?.pairId ?? -1).sort((a, b) => a - b);
    expect(pairs).toEqual([3, 9, 18]); // 配对 #3/#9/#18（光嘟浮实例 id）
    for (const s of sils) {
      expect(s.params?.mirrorOffset).toBeCloseTo(3.14159);
    }
  });

  it('剪影经 EnemyAI 实例化后默认可踩（mirror FLOAT → stompable/hazard=true）', () => {
    const sils = rt.enemies.filter((e) => e.type === 'du_fu_silhouette');
    expect(sils.length).toBe(3);
    for (const s of sils) {
      expect(s.isStompable).toBe(true);
    }
  });

  it('实体分桶：coin×8 / seed×6（seed_01..seed_06 沿 x 升序）/ checkpoint×2', () => {
    expect(rt.coins).toHaveLength(8);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[0].y).toBe(200);
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

describe('nextLevelId 进度链（2-5 续接 2-6，非末关）', () => {
  it('LEVEL_ORDER 续接至 2-6；nextLevelId("2-4") === "2-5"，("2-5") === "2-6"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6']);
    expect(nextLevelId(LEVEL_ORDER, '2-4')).toBe('2-5');
    expect(nextLevelId(LEVEL_ORDER, '2-5')).toBe('2-6');
  });
});

describe('biome 解析器（theme → theme-palette，2-4 剪影调色板，全锁色板 0 新增色）', () => {
  it('silhouette → 暗蓝岩面 rockFace #254060、天空 bg #5BC8F5、暖黄 firelight #FFD23F', () => {
    const pal = resolveBiome('silhouette');
    expect(pal.rockFace).toBe(0x254060);
    expect(pal.rockBody).toBe(0x1c2e49);
    expect(pal.bg).toBe(0x5bc8f5);
    expect(pal.outline).toBe(0x2a1a12);
    expect(pal.firelight).toBe(0xffd23f);
    expect(pal.crystalCore).toBe(0xffd23f);
  });
  it('biomeForLevel(2-4) = silhouette palette（rockFace 暗蓝 #254060）', () => {
    expect(biomeForLevel(levels['2-4']).rockFace).toBe(0x254060);
  });
});
