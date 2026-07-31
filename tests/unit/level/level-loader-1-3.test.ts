/**
 * tests/unit/level/level-loader-1-3.test.ts — 1-3 海关卡（海主题）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 1-3、validateLevelData 通过、metadata.theme='sea'（海 8 槽 palette）、
 * biome 解析器返回 sea 冷蓝调色板、goal 可达、敌种组合（通用四敌恒含 + 海专属 jellyfish×3）、
 * jellyfish 软顶可踩/不伤/持久踏脚石 + 高潮时踏脚石可用（公平）、tideSegments T1/T2 反相、
 * riptide 区域力场、bp_sea 节拍平台、实体分桶、出生点、进度链 1-3→2-1。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';
import { tideSurfaceY } from '../../../src/core/tide/tide';
import { riptideAt } from '../../../src/core/tide/riptide';
import { isAntiPhase } from '../../../src/core/tide/tide';

describe('1-3 海关卡加载（注册表 + Loader）', () => {
  const data = levels['1-3'];
  const rt = LevelLoader.load(data);

  it('注册表含 1-3 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('1-3');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata：theme="sea"、name="《澜屿潮汐》"、parTimeMs=40000', () => {
    expect(data.metadata.theme).toBe('sea');
    const meta = data.metadata as unknown as { name: string; parTimeMs: number };
    expect(meta.name).toBe('《澜屿潮汐》');
    expect(meta.parTimeMs).toBe(40000);
  });

  it('biome 解析：sea 返回海 palette（0 新增 hex，锁色板内）', () => {
    const pal = biomeForLevel(data);
    // 海 8 槽权威 hex（sea-biome-spec §1.2/§8.2）
    expect(pal.bg).toBe(0x5bc8f5); // 天空 #5BC8F5（水面天光）
    expect(pal.rockFace).toBe(0x4a78c0); // 环境冷蓝 #4A78C0（礁岩主面）
    expect(pal.rockBody).toBe(0x254060); // 海床暗面（tint 派生，0 新增）
    expect(pal.crystalCore).toBe(0xffd23f); // 暖黄 #FFD23F（气泡核心）
    expect(pal.danger).toBe(0xe8483b); // 警示红 #E8483B
    expect(resolveBiome('sea')).toBe(THEME_PALETTES.sea);
    // fail-safe：未知 theme 仍回退 grass
    expect(resolveBiome('unknown_theme').rockFace).toBe(THEME_PALETTES.grass.rockFace);
  });

  it('尺寸正确：width=52 height=9 tileSize=32', () => {
    expect(data.width).toBe(52);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
  });

  it('敌种组合 = 通用四敌(ci_li×3 + du_fu×2 + chong_feng×2 + shi_pao×2) + 海专属 jellyfish×3 = 12', () => {
    expect(rt.enemies).toHaveLength(12);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    expect(types.filter((t) => t === 'jellyfish')).toHaveLength(3);
  });

  it('jellyfish 实例：软顶可踩 + 不伤 + 持久踏脚石 + 尺寸 36×40', () => {
    const js = rt.enemies.filter((e) => e.type === 'jellyfish');
    expect(js).toHaveLength(3);
    for (const j of js) {
      expect(j.isStompable).toBe(true);
      expect(j.nonDamaging).toBe(true);
      expect(j.persistentStomp).toBe(true);
      expect(j.width).toBe(36);
      expect(j.height).toBe(40);
    }
  });

  it('公平保证：三处 jellyfish 浮动最低点仍高于对应高水位线（高潮时踏脚石可用）', () => {
    // GDD 1-3 §3.2：J1 在 T1（highY=160），J2/J3 在 T2（highY=128）；amp=24。
    const highWaterByX: Array<{ x: number; highY: number }> = [
      { x: 480, highY: 160 }, // J1 → T1
      { x: 1088, highY: 128 }, // J2 → T2
      { x: 1216, highY: 128 }, // J3 → T2
    ];
    const js = rt.enemies.filter((e) => e.type === 'jellyfish');
    for (const { x, highY } of highWaterByX) {
      const j = js.find((e) => Math.abs(e.x - x) < 1);
      expect(j).toBeTruthy();
      // 构造期未推进：j.y === baseY；浮动最低点 = baseY - amp(24)
      const lowestBobY = j!.y - 24;
      expect(lowestBobY).toBeLessThan(highY); // 始终高于高水位 → 踏脚石可用
    }
  });

  it('潮汐段 T1/T2：参数正确且反相', () => {
    const segs = data.tideSegments ?? [];
    expect(segs).toHaveLength(2);
    const t1 = segs.find((s) => s.id === 'tide_t1')!;
    const t2 = segs.find((s) => s.id === 'tide_t2')!;
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
    expect(t1.xStart).toBe(416);
    expect(t1.xEnd).toBe(768);
    expect(t1.lowY).toBe(256);
    expect(t1.highY).toBe(160);
    expect(t1.periodMs).toBe(6400);
    expect(t1.phase).toBe(0);
    expect(t2.xStart).toBe(1024);
    expect(t2.xEnd).toBe(1408);
    expect(t2.lowY).toBe(224);
    expect(t2.highY).toBe(128);
    expect(t2.periodMs).toBe(8000);
    expect(t2.phase).toBe(3200);
    // 反相（phase 错开，迫使重新 timing）
    expect(isAntiPhase(t1, t2)).toBe(true);
    // 水位公式自检：T1 在 t=0 应为中水位 mid=(256+160)/2=208
    expect(tideSurfaceY(t1, 0)).toBeCloseTo(208, 5);
  });

  it('暗流（riptide）区域力场：1 处，参数正确，区域命中/外落', () => {
    const zones = data.riptide ?? [];
    expect(zones).toHaveLength(1);
    const z = zones[0];
    expect(z.xStart).toBe(1056);
    expect(z.xEnd).toBe(1280);
    expect(z.yTop).toBe(96);
    expect(z.yBottom).toBe(224);
    expect(z.vxBias).toBe(140);
    // 区域内（含端点）命中
    expect(riptideAt(zones, 1168, 160)?.vxBias).toBe(140);
    expect(riptideAt(zones, 1056, 96)?.vxBias).toBe(140);
    // 区域外落空
    expect(riptideAt(zones, 900, 160)).toBeNull();
    expect(riptideAt(zones, 1300, 160)).toBeNull();
  });

  it('bp_sea 节拍平台：initial="solid" + pattern="SSSGGG" + bpm120/grid8', () => {
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    const track = data.beat.tracks[0];
    expect(track.target).toBe('bp_sea');
    expect(track.pattern).toBe('SSSGGG');
    const bp = data.beatPlatforms?.[0];
    expect(bp?.id).toBe('bp_sea');
    expect(bp?.initial).toBe('solid');
    expect(bp?.tiles.map((t) => `${t.tx},${t.ty}`).sort()).toEqual(['18,4', '19,4', '20,4']);
  });

  it('实体分桶：coin×18 / seed×6 / chestnut×3 / checkpoint×3（不污染 enemies）', () => {
    expect(rt.coins).toHaveLength(18);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[5].seedId).toBe('seed_06');
    expect(rt.chestnuts).toHaveLength(3);
    expect(rt.chestnuts.every((c) => (c.params?.amount ?? 0) === 5)).toBe(true);
    expect(rt.checkpoints).toHaveLength(3);
    expect(rt.checkpoints.map((c) => `${c.x},${c.y}`).sort()).toEqual(
      ['1088,176', '1408,176', '832,176'].sort(),
    );
  });

  it('出生点 spawn 与 1-1/1-2 同款（x=64,y=190）；goal 可达', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    // goal 右边缘落于世界内（< width*ts=1664），且最后一块实心地面之上的 tx50（x=1600..1632）
    // 注：设计稿写 x=1632，但 tx51(1632..1664) 为全高边界墙，置于 1632 会嵌墙且不可达；
    // 故落点为 x=1600（末列可站立地面），右边缘 1632=墙左面，玩家可触及。
    expect(rt.goal.x).toBe(1600);
    expect(rt.goal.y).toBe(160);
    expect(rt.goal.w).toBe(32);
    expect(rt.goal.h).toBe(64);
    expect(rt.goal.x + rt.goal.w).toBe(1632);
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
  });
});

describe('进度链（1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6 → 1-7 → 2-1）', () => {
  it('LEVEL_ORDER 含 1-3 且位于 1-2 之后；nextLevelId("1-3") === "1-4"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6']);
    expect(nextLevelId(LEVEL_ORDER, '1-3')).toBe('1-4');
  });
});
