/**
 * tests/unit/level/level-loader-2-6.test.ts — 2-6 熔心终焉关（volcano 终章 + 节拍平台双簇）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 2-6、validateLevelData 通过、metadata.theme='volcano'、goal x+w<width*ts、
 * 敌种组合（gu_bao×4 + ci_li×4 + du_fu×3 + shi_pao×5 = 16）、实体分桶（coin×16 / seed×6 / checkpoint×4）、
 * tile 去重 + oneway 位置、出生点、beat 启用 + beatPlatforms 双簇 tiles 全 ty=4（红线：平台必须放站立头顶之上）、
 * nextLevelId 进度链（2-6 为当前终章 → null，结算页隐藏「下一关」）、biome 接线（volcano → 玄武岩黑 + 暗紫天空）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('2-6 熔心终焉关加载（注册表 + Loader）', () => {
  const data = levels['2-6'];
  const rt = LevelLoader.load(data);

  it('注册表含 2-6 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('2-6');
    expect(data.width).toBe(56);
    expect(data.height).toBe(9);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "volcano"（火山终章调色板）、name="熔心终焉"、parTimeMs=100000', () => {
    expect(data.metadata.theme).toBe('volcano');
    expect(data.metadata.name).toBe('熔心终焉');
    expect(data.metadata.parTimeMs).toBe(100000);
  });

  it('goal x + w < width*ts（1760 < 1792），终点可达', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1760);
    expect(data.goal.type).toBe('triumph_gate');
  });

  it('敌种组合 = gu_bao×4 + ci_li×4 + du_fu×3 + shi_pao×5 = 16', () => {
    expect(rt.enemies).toHaveLength(16);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(4);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(4);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(3);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(5);
  });

  it('实体分桶：coin×16 / seed×6（seed_01..seed_06）/ checkpoint×4', () => {
    expect(rt.coins).toHaveLength(16);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[5].seedId).toBe('seed_06');
    expect(rt.seeds[0].y).toBe(200);
    expect(rt.checkpoints).toHaveLength(4);
    // gu_bao 携带 phaseOffset（错相位契约，对齐 2-1）—— 校验 JSON 数据源
    const guBaoOffsets = data.entities
      .filter((e) => e.type === 'gu_bao')
      .map((e) => (e as unknown as { params?: { phaseOffset?: number } }).params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 0, 530, 0]);
  });

  it('tile 去重（grid 幂等）：地面 ty7-8 全宽实心、墙 col0/col55 实心、oneway(11,12)@ty3/(25,26)@ty4/(39,40)@ty5/(49,50)@ty4', () => {
    expect(rt.world.isSolidTile(5, 7)).toBe(true);
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    expect(rt.world.isSolidTile(55, 8)).toBe(true);
    expect(rt.world.isOneWayTile(11, 3)).toBe(true);
    expect(rt.world.isOneWayTile(12, 3)).toBe(true);
    expect(rt.world.isOneWayTile(25, 4)).toBe(true);
    expect(rt.world.isOneWayTile(26, 4)).toBe(true);
    expect(rt.world.isOneWayTile(39, 5)).toBe(true);
    expect(rt.world.isOneWayTile(40, 5)).toBe(true);
    expect(rt.world.isOneWayTile(49, 4)).toBe(true);
    expect(rt.world.isOneWayTile(50, 4)).toBe(true);
    expect(rt.world.isSolidTile(25, 4)).toBe(false); // oneway 非 solid
    expect(rt.world.isSolidTile(39, 5)).toBe(false); // oneway 非 solid
  });

  it('出生点 spawn = (64, 190)，beat 启用且 beatPlatforms 双簇红线校验：每簇 tiles 全 ty=4（站立头顶之上，严禁 ty5）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toHaveLength(2);
    expect(data.beat.tracks[0].target).toBe('bp_v1');
    expect(data.beat.tracks[1].target).toBe('bp_v2');
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(2);
    for (const bp of bps) {
      for (const t of bp.tiles) {
        expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
      }
    }
  });
});

describe('nextLevelId 进度链（2-6 为当前终章 → null，结算页隐藏「下一关」）', () => {
  it('LEVEL_ORDER 末关为 2-6；nextLevelId("2-5") === "2-6"，("2-6") === null', () => {
    expect(LEVEL_ORDER).toContain('2-6');
    expect(LEVEL_ORDER.indexOf('2-5')).toBeLessThan(LEVEL_ORDER.indexOf('2-6'));
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('2-6');
    expect(nextLevelId(LEVEL_ORDER, '2-5')).toBe('2-6');
    expect(nextLevelId(LEVEL_ORDER, '2-6')).toBeNull();
  });
});

describe('biome 解析器（theme → theme-palette，2-6 火山调色板，锁色板内 0 新增色）', () => {
  it('volcano → 玄武岩黑 rockFace #2A1A12、暗紫天空 bg #3F45A8、熔岩橙红 firelight #F2933C、灼热高光 crystalCore #FFD23F', () => {
    const pal = resolveBiome('volcano');
    expect(pal.rockFace).toBe(0x2a1a12); // 玄武岩黑（全 biome 唯一黑曜岩主面）
    expect(pal.rockBody).toBe(0x2a1a12); // 同 rockFace 有意复用
    expect(pal.bg).toBe(0x3f45a8); // 暗紫天空（darken(#6E7BF2,0.3) tint 派生）
    expect(pal.outline).toBe(0x2a1a12); // 描边
    expect(pal.firelight).toBe(0xf2933c); // 熔岩橙红
    expect(pal.crystalCore).toBe(0xffd23f); // 灼热高光（暖黄）
    expect(pal.crystalGlow).toBe(0xf2933c); // 熔岩辉光（与 firelight 同源）
    expect(pal.danger).toBe(0xe8483b); // 警示红
    // 不为草原（fail-safe 回退）兜底：volcano 已注册，返回专属调色板
    expect(pal.rockFace).not.toBe(0x3a2a1f);
  });
  it('biomeForLevel(2-6) = volcano palette（rockFace 玄武岩黑 #2A1A12）', () => {
    expect(biomeForLevel(levels['2-6']).rockFace).toBe(0x2a1a12);
    expect(biomeForLevel(levels['2-6']).bg).toBe(0x3f45a8);
  });
});
