/**
 * tests/unit/level/level-loader-1-7.test.ts — 1-7 办公关（office 主题）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 1-7、validateLevelData 通过、metadata.theme='office'（OFFICE 8 槽 palette）、
 * biome 解析器返回 OFFICE 调色板（0 新增 hex，锁色板内；office-visual-spec §3.1 字节级一致）、
 * 尺寸、平坦铺贴地形 tile-kind（全部 solid：地面 ty7-8 + 左右墙 tx0/53 ty0-6，碰撞映射 solid）、
 * 敌种组合（通用四敌恒含 + paper_pile×5 + coffee_spill×4 = 18，paper_pile 静态实心非伤害、
 * coffee_spill 低摩擦 zone 非伤害）、paper_pile 覆盖瓦片标记进 solid 网格（runtime.paperPileTiles）、
 * coffee_spill zone 列表（runtime.coffeeSpillZones）含 frictionScale、实体分桶（coin×18 / seed×6 /
 * chestnut×3 / checkpoint×3）、beat 禁用且无 beatPlatforms、无 quicksand/tideSegments/riptide、
 * 出生点、进度链 1-6→1-7→2-1。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';

describe('1-7 办公关加载（注册表 + Loader）', () => {
  const data = levels['1-7'];
  const rt = LevelLoader.load(data);

  it('注册表含 1-7 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('1-7');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata：theme="office"、name="《案牍劳形》"、parTimeMs=52000', () => {
    expect(data.metadata.theme).toBe('office');
    const meta = data.metadata as unknown as { name: string; parTimeMs: number };
    expect(meta.name).toBe('《案牍劳形》');
    expect(meta.parTimeMs).toBe(52000);
  });

  it('biome 解析：office 返回 OFFICE 8 槽 palette（0 新增 hex，锁色板内权威 hex，office-visual-spec §3.1 字节级一致）', () => {
    const pal = biomeForLevel(data);
    // OFFICE 8 槽权威 hex（office-visual-spec §3.1 契约，逐字锁色板）
    expect(pal.bg).toBe(0x5bc8f5); // 天花板微光 #5BC8F5（锁色板 #11）
    expect(pal.rockFace).toBe(0x4a78c0); // 办公桌/柜体主面 #4A78C0（锁色板 #10）
    expect(pal.rockBody).toBe(0x254060); // 柜体暗面 #254060（锁色板 #6）
    expect(pal.outline).toBe(0x2a1a12); // 描边 #2A1A12（锁色板 #5）
    expect(pal.firelight).toBe(0xf2933c); // 暖橙 #F2933C（锁色板 #3）
    expect(pal.crystalCore).toBe(0x7cc242); // 草绿绿植 #7CC242（锁色板 #1）
    expect(pal.crystalGlow).toBe(0x6e7bf2); // 蓝紫屏光 #6E7BF2（锁色板 #9）
    expect(pal.danger).toBe(0xe8483b); // 警示红 #E8483B（锁色板 #7）
    expect(resolveBiome('office')).toBe(THEME_PALETTES.office);
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
    expect(rt.world.isOneWayTile(0, 0)).toBe(false); // 办公关无 oneway 地形
  });

  it('敌种组合 = 通用四敌(ci_li×3 + du_fu×2 + chong_feng×2 + shi_pao×2) + paper_pile×5 + coffee_spill×4 = 18', () => {
    expect(rt.enemies).toHaveLength(18);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    expect(types.filter((t) => t === 'paper_pile')).toHaveLength(5);
    expect(types.filter((t) => t === 'coffee_spill')).toHaveLength(4);
  });

  it('paper_pile/coffee_spill 实例：非可踩（isStompable=false）+ 尺寸来自实体 w/h + 左上角 x/y', () => {
    const piles = rt.enemies.filter((e) => e.type === 'paper_pile');
    const spills = rt.enemies.filter((e) => e.type === 'coffee_spill');
    expect(piles).toHaveLength(5);
    expect(spills).toHaveLength(4);
    // 抽样：p1(32×64) 与 cs1(64×32)
    const p1 = piles.find((e) => e.x === 416 && e.y === 160)!;
    expect(p1.isStompable).toBe(false);
    expect(p1.width).toBe(32);
    expect(p1.height).toBe(64);
    const cs1 = spills.find((e) => e.x === 512 && e.y === 192)!;
    expect(cs1.isStompable).toBe(false);
    expect(cs1.width).toBe(64);
    expect(cs1.height).toBe(32);
  });

  it('paper_pile 覆盖瓦片标记进 solid 网格（runtime.paperPileTiles，共 9 键；碰撞走 world，玩家可踩站）', () => {
    // p1(416,160,32,64)→tx13 ty5-6；p2(640,192,64,32)→tx20-21 ty6；p3(864,160,32,64)→tx27 ty5-6；
    // p4(1056,192,32,32)→tx33 ty6；p5(1248,160,32,64)→tx39 ty5-6。
    const expectKeys = [
      '13,5', '13,6',
      '20,6', '21,6',
      '27,5', '27,6',
      '33,6',
      '39,5', '39,6',
    ];
    expect(rt.paperPileTiles.size).toBe(9);
    for (const k of expectKeys) expect(rt.paperPileTiles.has(k)).toBe(true);
    // 标记后的瓦片确实是实心（玩家可站上越障）
    expect(rt.world.isSolidTile(13, 5)).toBe(true);
    expect(rt.world.isSolidTile(13, 6)).toBe(true);
    expect(rt.world.isSolidTile(27, 5)).toBe(true);
    expect(rt.world.isSolidTile(20, 6)).toBe(true);
    expect(rt.world.isSolidTile(39, 6)).toBe(true);
    // 文件堆顶上方仍开放（非整列封死）
    expect(rt.world.isSolidTile(13, 4)).toBe(false);
  });

  it('coffee_spill zone 列表（runtime.coffeeSpillZones）含 4 个矩形 + frictionScale（非伤害、零碰撞）', () => {
    expect(rt.coffeeSpillZones).toHaveLength(4);
    const cs1 = rt.coffeeSpillZones.find((z) => z.x === 512 && z.y === 192)!;
    const cs2 = rt.coffeeSpillZones.find((z) => z.x === 768 && z.y === 192)!;
    const cs3 = rt.coffeeSpillZones.find((z) => z.x === 1120 && z.y === 192)!;
    const cs4 = rt.coffeeSpillZones.find((z) => z.x === 1376 && z.y === 192)!;
    expect(cs1).toEqual({ x: 512, y: 192, w: 64, h: 32, frictionScale: 0.35 });
    expect(cs2).toEqual({ x: 768, y: 192, w: 64, h: 32, frictionScale: 0.30 });
    expect(cs3).toEqual({ x: 1120, y: 192, w: 64, h: 32, frictionScale: 0.40 });
    expect(cs4).toEqual({ x: 1376, y: 192, w: 64, h: 32, frictionScale: 0.35 });
    // 咖啡渍 zone 不创建碰撞（其覆盖瓦片保持开放，碰撞零参与）
    expect(rt.world.isSolidTile(16, 6)).toBe(false); // cs1 覆盖 tx16,ty6
    expect(rt.world.isSolidTile(24, 6)).toBe(false); // cs2 覆盖 tx24,ty6
  });

  it('办公无关 quicksand / tideSegments / riptide（机制同构替换，平坦办公室取代水平流沙）', () => {
    expect(data.quicksand).toBeUndefined();
    expect(data.tideSegments).toBeUndefined();
    expect(data.riptide).toBeUndefined();
  });

  it('beat 禁用（主理人拍板 bp_office off）：enabled=false + 无 beatPlatforms 字段 + bpm/grid 仍 120/8', () => {
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

describe('进度链（1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6 → 1-7 → 2-1）', () => {
  it('LEVEL_ORDER 含 1-7 且位于 1-6 之后、2-1 之前；nextLevelId("1-7") === "2-1"、("1-6") === "1-7"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4']);
    expect(LEVEL_ORDER).toContain('1-7');
    expect(nextLevelId(LEVEL_ORDER, '1-7')).toBe('2-1');
    expect(nextLevelId(LEVEL_ORDER, '1-6')).toBe('1-7');
  });
});
