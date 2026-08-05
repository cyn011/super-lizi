/**
 * tests/unit/level/level-loader-1-4.test.ts — 1-4 沙漠卡（沙漠主题）加载验证（core 纯逻辑）。
 *
 * 覆盖：注册表含 1-4、validateLevelData 通过、metadata.theme='desert'（沙漠 8 槽 palette）、
 * biome 解析器返回 desert 暖橙调色板、goal 可达、敌种组合（通用四敌恒含 + 沙漠专属 scorpion×3 + cactus×3）、
 * scorpion 硬顶不可踩/尺寸 40×24、cactus 硬顶不可踩/尺寸 24×48、quicksand 区域×2（取代 tideSegments/riptide）、
 * bp_desert 节拍平台、实体分桶、出生点、进度链 1-3→1-4→2-1。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';

describe('1-4 沙漠卡加载（注册表 + Loader）', () => {
  const data = levels['1-4'];
  const rt = LevelLoader.load(data);

  it('注册表含 1-4 且通过 validateLevelData', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('1-4');
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata：theme="desert"、name="《灼沙绿洲》"、parTimeMs=44000', () => {
    expect(data.metadata.theme).toBe('desert');
    const meta = data.metadata as unknown as { name: string; parTimeMs: number };
    expect(meta.name).toBe('《灼沙绿洲》');
    expect(meta.parTimeMs).toBe(44000);
  });

  it('biome 解析：desert 返回沙漠 palette（0 新增 hex，锁色板内，8 槽权威 hex）', () => {
    const pal = biomeForLevel(data);
    // 沙漠 8 槽权威 hex（desert-biome-spec §8.2 / desert-visual-spec §4.1）
    expect(pal.bg).toBe(0xf7be8a); // 暖沙晴空 #F7BE8A（tint 派生）
    expect(pal.rockFace).toBe(0xf2933c); // 沙岩主面 #F2933C（暖橙）
    expect(pal.rockBody).toBe(0x79491e); // 沙岩暗面 #79491E（tint 派生）
    expect(pal.outline).toBe(0x2a1a12); // 描边 #2A1A12
    expect(pal.firelight).toBe(0xffd23f); // 阳光核心 #FFD23F
    expect(pal.crystalCore).toBe(0x7cc242); // 仙人掌绿 #7CC242
    expect(pal.crystalGlow).toBe(0xf2c94c); // 沙金辉光 #F2C94C
    expect(pal.danger).toBe(0xe8483b); // 危险 #E8483B
    expect(resolveBiome('desert')).toBe(THEME_PALETTES.desert);
    // fail-safe：未知 theme 仍回退 grass
    expect(resolveBiome('unknown_theme').rockFace).toBe(THEME_PALETTES.grass.rockFace);
  });

  it('尺寸正确：width=54 height=9 tileSize=32', () => {
    expect(data.width).toBe(54);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
  });

  it('敌种组合 = 通用四敌(ci_li×3 + du_fu×2 + chong_feng×2 + shi_pao×2) + scorpion×3 + cactus×3 = 15', () => {
    expect(rt.enemies).toHaveLength(15);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    expect(types.filter((t) => t === 'scorpion')).toHaveLength(3);
    expect(types.filter((t) => t === 'cactus')).toHaveLength(3);
  });

  it('scorpion/cactus 实例：硬顶不可踩（双编码危险）+ 尺寸正确', () => {
    const scorps = rt.enemies.filter((e) => e.type === 'scorpion');
    const cacti = rt.enemies.filter((e) => e.type === 'cactus');
    expect(scorps).toHaveLength(3);
    expect(cacti).toHaveLength(3);
    for (const s of scorps) {
      expect(s.isStompable).toBe(false); // 硬顶不可踩
      expect(s.width).toBe(40);
      expect(s.height).toBe(24);
    }
    for (const c of cacti) {
      expect(c.isStompable).toBe(false); // 硬顶不可踩
      expect(c.width).toBe(24);
      expect(c.height).toBe(48);
    }
  });

  it('流沙区 quicksand×2（取代 1-3 的 tideSegments/riptide）：参数正确且 surfaceY 对齐地面顶', () => {
    const zones = data.quicksand ?? [];
    expect(zones).toHaveLength(2);
    const q1 = zones.find((s) => s.id === 'qs_q1')!;
    const q2 = zones.find((s) => s.id === 'qs_q2')!;
    expect(q1).toBeTruthy();
    expect(q2).toBeTruthy();
    expect(q1.xStart).toBe(480);
    expect(q1.xEnd).toBe(672);
    expect(q1.surfaceY).toBe(224);
    expect(q1.sinkRate).toBe(35);
    expect(q1.deathY).toBe(304);
    expect(q1.telegraphMs).toBe(500);
    expect(q2.xStart).toBe(1056);
    expect(q2.xEnd).toBe(1344);
    expect(q2.surfaceY).toBe(224);
    expect(q2.sinkRate).toBe(55);
    expect(q2.deathY).toBe(336);
    expect(q2.telegraphMs).toBe(350);
    // 沙漠无潮汐 / 无暗流（机制同构替换）
    expect(data.tideSegments).toBeUndefined();
    expect(data.riptide).toBeUndefined();
  });

  it('bp_desert 节拍平台：initial="solid" + pattern="SSSGGG" + bpm120/grid8（主理人拍板启用）', () => {
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    const track = data.beat.tracks[0];
    expect(track.target).toBe('bp_desert');
    expect(track.pattern).toBe('SSSGGG');
    const bp = data.beatPlatforms?.[0];
    expect(bp?.id).toBe('bp_desert');
    expect(bp?.initial).toBe('solid');
    expect(bp?.tiles.map((t) => `${t.tx},${t.ty}`).sort()).toEqual(['17,4', '18,4', '19,4']);
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
    expect(rt.goal.x + rt.goal.w).toBe(1696);
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize); // < 1728
  });
});

describe('进度链（1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6 → 1-7 → 2-1）', () => {
  it('LEVEL_ORDER 含 1-4 且位于 1-3 之后、2-1 之前；nextLevelId("1-4") === "2-1"', () => {
    expect(LEVEL_ORDER).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '4-1']);
    expect(nextLevelId(LEVEL_ORDER, '1-4')).toBe('1-5');
    expect(nextLevelId(LEVEL_ORDER, '1-5')).toBe('1-6');
    expect(nextLevelId(LEVEL_ORDER, '1-6')).toBe('1-7');
    expect(nextLevelId(LEVEL_ORDER, '1-3')).toBe('1-4');
  });
});
