/**
 * tests/unit/level/level-loader-1-6.test.ts — 1-6 街关（street 主题）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 1-6、validateLevelData 通过、metadata.theme='street'（街 8 槽 palette）、
 * biome 解析器返回 STREET 天青 palette（0 新增 hex，锁色板内；art-spec §3 字节级一致）、goal 可达、
 * 平坦铺贴地形 tile-kind（全部 solid：地面 ty7-8 + 左右墙 tx0/53 ty0-6，碰撞映射 solid）、
 * 敌种组合（通用四敌恒含 + vehicle×3 + manhole×4 = 16，vehicle 致命不可踩、manhole 薄盖不可踩）、
 * 实体分桶（coin×18 / seed×6 / chestnut×3 / checkpoint×3）、beat 禁用且无 beatPlatforms、
 * 无 quicksand/tideSegments/riptide、出生点、进度链 1-5→1-6→2-1。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';

describe('1-6 街关加载（注册表 + Loader）', () => {
  const data = levels['1-6'];
  const rt = LevelLoader.load(data);

  it('注册表含 1-6 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('1-6');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata：theme="street"、name="《霓街穿行》"、parTimeMs=112000', () => {
    expect(data.metadata.theme).toBe('street');
    const meta = data.metadata as unknown as { name: string; parTimeMs: number };
    expect(meta.name).toBe('《霓街穿行》');
    expect(meta.parTimeMs).toBe(112000);
  });

  it('biome 解析：street 返回街 8 槽 palette（0 新增 hex，锁色板内权威 hex，art-spec §3 字节级一致）', () => {
    const pal = biomeForLevel(data);
    // 街 8 槽权威 hex（art-spec §3 / street-visual-spec）
    expect(pal.bg).toBe(0x408cac); // 天青 #408CAC（街道天幕）
    expect(pal.rockFace).toBe(0x304e7d); // 深岩蓝 #304E7D（建筑立面）
    expect(pal.rockBody).toBe(0x254060); // 暗岩蓝 #254060（建筑体）
    expect(pal.outline).toBe(0x2a1a12); // 描边 #2A1A12
    expect(pal.firelight).toBe(0xf2933c); // 暖橙 #F2933C（灯晕）
    expect(pal.crystalCore).toBe(0xffd23f); // 暖黄 #FFD23F（窗光核心）
    expect(pal.crystalGlow).toBe(0x6e7bf2); // 霓虹蓝 #6E7BF2（霓虹辉光）
    expect(pal.danger).toBe(0xe8483b); // 警示红 #E8483B
    expect(resolveBiome('street')).toBe(THEME_PALETTES.street);
    // fail-safe：未知 theme 仍回退 grass
    expect(resolveBiome('unknown_theme').rockFace).toBe(THEME_PALETTES.grass.rockFace);
  });

  it('尺寸正确：width=54 height=9 tileSize=32', () => {
    expect(data.width).toBe(54);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
  });

  it('平坦铺贴地形 tile-kind：全部 solid（地面 ty7-8 ×54 + 左右墙 tx0/53 ty0-6），碰撞映射 solid', () => {
    const kinds = data.tiles.map((t) => t.kind);
    expect(kinds.every((k) => k === 'solid')).toBe(true);
    expect(data.tiles).toHaveLength(122); // 54×2 地面(108) + 14 墙
    // 地面 / 左右墙仍实心（封边语义一致）
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面左
    expect(rt.world.isSolidTile(53, 8)).toBe(true); // 地面右
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙顶
    expect(rt.world.isSolidTile(53, 6)).toBe(true); // 右墙
    expect(rt.world.isOneWayTile(0, 0)).toBe(false); // 街关无 oneway
  });

  it('敌种组合 = 通用四敌(ci_li×3 + du_fu×2 + chong_feng×2 + shi_pao×2) + vehicle×3 + manhole×4 = 16', () => {
    expect(rt.enemies).toHaveLength(16);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    expect(types.filter((t) => t === 'vehicle')).toHaveLength(3);
    expect(types.filter((t) => t === 'manhole')).toHaveLength(4);
  });

  it('vehicle/manhole 实例：硬顶不可踩（双编码危险）+ 尺寸正确', () => {
    const vehicles = rt.enemies.filter((e) => e.type === 'vehicle');
    const manholes = rt.enemies.filter((e) => e.type === 'manhole');
    expect(vehicles).toHaveLength(3);
    expect(manholes).toHaveLength(4);
    for (const v of vehicles) {
      expect(v.isStompable).toBe(false); // 致命不可踩（接触致杀、非踩杀）
      expect(v.width).toBe(48);
      expect(v.height).toBe(32);
    }
    for (const m of manholes) {
      expect(m.isStompable).toBe(false); // 薄盖不可踩（蒸汽柱软伤）
      expect(m.width).toBe(32);
      expect(m.height).toBe(4); // 薄盖（碰撞忽略，hazard 走蒸汽柱）
    }
  });

  it('街无关 quicksand / tideSegments / riptide（机制同构替换，平坦街道取代水平流沙）', () => {
    expect(data.quicksand).toBeUndefined();
    expect(data.tideSegments).toBeUndefined();
    expect(data.riptide).toBeUndefined();
  });

  it('beat 禁用（主理人拍板 bp_street off）：enabled=false + 无 beatPlatforms 字段 + bpm/grid 仍 120/8', () => {
    expect(data.beat.enabled).toBe(false);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toEqual([]);
    // 关键：JSON 中不含 beatPlatforms（与 1-4 的 bp_desert 不同）
    expect((data as { beatPlatforms?: unknown }).beatPlatforms).toBeUndefined();
  });

  it('实体分桶：coin×18 / seed×6 / chestnut×3 / checkpoint×3（不污染 enemies）', () => {
    expect(rt.coins).toHaveLength(18);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[5].seedId).toBe('seed_06');
    expect(rt.chestnuts).toHaveLength(3);
    expect(rt.chestnuts.every((c) => (c.params?.amount ?? 0) === 5)).toBe(true);
    expect(rt.checkpoints).toHaveLength(3);
  });

  it('出生点 spawn 与 1-1/1-2 同款（x=64,y=190）；goal（triumph_gate）可达', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect((data.goal as { type?: string }).type).toBe('triumph_gate');
    expect(rt.goal.x).toBe(1664);
    expect(rt.goal.y).toBe(160);
    expect(rt.goal.w).toBe(32);
    expect(rt.goal.h).toBe(64);
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize); // 1696 < 1728
  });
});

describe('进度链（1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6 → 2-1）', () => {
  it('LEVEL_ORDER 含 1-6 且位于 1-5 之后、2-1 之前；nextLevelId("1-6") === "2-1"、("1-5") === "1-6"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '2-1', '2-2', '2-3', '2-4']);
    expect(LEVEL_ORDER).toContain('1-6');
    expect(nextLevelId(LEVEL_ORDER, '1-6')).toBe('2-1');
    expect(nextLevelId(LEVEL_ORDER, '1-5')).toBe('1-6');
  });
});
