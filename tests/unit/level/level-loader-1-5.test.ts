/**
 * tests/unit/level/level-loader-1-5.test.ts — 1-5 家关（home 主题）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 1-5、validateLevelData 通过、metadata.theme='home'（家 8 槽 palette）、
 * biome 解析器返回 HOME 暖棕墙 palette（0 新增 hex，锁色板内）、goal 可达、
 * 家具地形 tile-kind（sofa×5 / table×3 / cabinet×7，碰撞映射 solid/oneway）、
 * 敌种组合（通用四敌恒含 + pet×4 + toy×4 = 17，pet/toy 硬顶不可踩）、
 * 实体分桶（coin×18 / seed×6 / chestnut×3 / checkpoint×3）、beat 禁用且无 beatPlatforms、
 * 无 quicksand/tide、出生点、进度链 1-4→1-5→2-1。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';

describe('1-5 家关加载（注册表 + Loader）', () => {
  const data = levels['1-5'];
  const rt = LevelLoader.load(data);

  it('注册表含 1-5 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('1-5');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata：theme="home"、name="《归巢》"、parTimeMs=46000', () => {
    expect(data.metadata.theme).toBe('home');
    const meta = data.metadata as unknown as { name: string; parTimeMs: number };
    expect(meta.name).toBe('《归巢》');
    expect(meta.parTimeMs).toBe(46000);
  });

  it('biome 解析：home 返回家 8 槽 palette（0 新增 hex，锁色板内权威 hex）', () => {
    const pal = biomeForLevel(data);
    // 家 8 槽权威 hex（home-biome-spec §1.2 / home-visual-spec §4）
    expect(pal.bg).toBe(0x6b4220); // 暖棕墙 #6B4220（darken 派生）
    expect(pal.rockFace).toBe(0xf2933c); // 暖橙 #F2933C（木家具主面 / 地板）
    expect(pal.rockBody).toBe(0x79491e); // 暗面 #79491E（darken 派生）
    expect(pal.outline).toBe(0x2a1a12); // 描边 #2A1A12
    expect(pal.firelight).toBe(0xffd23f); // 暖黄 #FFD23F（灯晕 / 窗光）
    expect(pal.crystalCore).toBe(0xffd23f); // 暖黄 #FFD23F（灯核心，同源复用）
    expect(pal.crystalGlow).toBe(0x7cc242); // 草绿 #7CC242（盆栽）
    expect(pal.danger).toBe(0xe8483b); // 警示红 #E8483B（玩具尖角 / 宠物铃）
    expect(resolveBiome('home')).toBe(THEME_PALETTES.home);
    // fail-safe：未知 theme 仍回退 grass
    expect(resolveBiome('unknown_theme').rockFace).toBe(THEME_PALETTES.grass.rockFace);
  });

  it('尺寸正确：width=54 height=9 tileSize=32', () => {
    expect(data.width).toBe(54);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
  });

  it('家具地形 tile-kind：sofa×5 / table×3 / cabinet×7（碰撞零改，仅 kind→碰撞映射）', () => {
    const kinds = data.tiles.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'sofa')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'table')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'cabinet')).toHaveLength(7); // 2 个柜（c1=25,26；c2=38×3）
    // 碰撞映射由 RuntimeLevel.world 兑现：sofa/cabinet=solid、table=oneway
    expect(rt.world.isSolidTile(12, 6)).toBe(true); // sofa s1
    expect(rt.world.isSolidTile(25, 5)).toBe(true); // cabinet c1
    expect(rt.world.isOneWayTile(17, 5)).toBe(true); // table t1（仅顶可踩）
    expect(rt.world.isSolidTile(17, 5)).toBe(false); // table 非实心
    // 地面 / 左右墙仍实心（封边语义一致）
    expect(rt.world.isSolidTile(0, 7)).toBe(true);
    expect(rt.world.isSolidTile(53, 8)).toBe(true);
  });

  it('敌种组合 = 通用四敌(ci_li×3 + du_fu×2 + chong_feng×2 + shi_pao×2) + pet×4 + toy×4 = 17', () => {
    expect(rt.enemies).toHaveLength(17);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    expect(types.filter((t) => t === 'pet')).toHaveLength(4);
    expect(types.filter((t) => t === 'toy')).toHaveLength(4);
  });

  it('pet/toy 实例：硬顶不可踩（双编码危险）+ 尺寸正确', () => {
    const pets = rt.enemies.filter((e) => e.type === 'pet');
    const toys = rt.enemies.filter((e) => e.type === 'toy');
    expect(pets).toHaveLength(4);
    expect(toys).toHaveLength(4);
    for (const p of pets) {
      expect(p.isStompable).toBe(false); // 硬顶不可踩（接触致伤、非踩杀）
      expect(p.width).toBe(36);
      expect(p.height).toBe(28);
    }
    for (const t of toys) {
      expect(t.isStompable).toBe(false); // 硬顶不可踩
      expect(t.width).toBe(20);
      expect(t.height).toBe(16);
    }
  });

  it('家无 quicksand / tideSegments / riptide（机制同构替换，垂直家具地形取代水平流沙）', () => {
    expect(data.quicksand).toBeUndefined();
    expect(data.tideSegments).toBeUndefined();
    expect(data.riptide).toBeUndefined();
  });

  it('beat 禁用（主理人拍板 bp_home off）：enabled=false + 无 beatPlatforms 字段 + bpm/grid 仍 120/8', () => {
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
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize); // < 1728
  });
});

describe('进度链（1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6 → 1-7 → 2-1）', () => {
  it('LEVEL_ORDER 含 1-6 且位于 1-5 之后、2-1 之前；nextLevelId("1-5") === "1-6"、("1-4") === "1-5"、("1-6") === "2-1"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4']);
    expect(LEVEL_ORDER).toContain('1-5');
    expect(nextLevelId(LEVEL_ORDER, '1-5')).toBe('1-6');
    expect(nextLevelId(LEVEL_ORDER, '1-6')).toBe('1-7');
    expect(nextLevelId(LEVEL_ORDER, '1-4')).toBe('1-5');
  });
});
