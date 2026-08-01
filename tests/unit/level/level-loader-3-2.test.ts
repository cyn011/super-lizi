/**
 * tests/unit/level/level-loader-3-2.test.ts — 3-2 星隙长渡关（星界 astral · 深化 A：空间轴）
 * 加载验证（core 纯逻辑）。结构照 level-loader-3-1.test.ts。
 *
 * 覆盖：注册表含 3-2、validateLevelData 通过、metadata.theme='astral'/name='星隙长渡'/parTimeMs=92000、
 * goal x+w<width*ts 且 type='triumph_gate'、敌种组合（gu_bao×3 + ci_li×3 + du_fu×4 + shi_pao×2 = 12）、
 * 实体分桶（coin×13 / seed×5 / checkpoint×3）、敌人 y 契约、tile 去重 + oneway 远岛群 fj0..fj5、出生点、
 * beat 启用 + beatPlatforms 单簇 tiles 全 ty=4（红线：严禁 ty5）、mechanics.glide === true、
 * 云海地面 ty7,8 全宽实心（公平性地板：零坠落死亡、零 soft-lock）、
 * nextLevelId 进度链（3-1 → 3-2 → 3-3）、biome 接线（astral 复用，0 新增 hex）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { biomeForLevel } from '../../../src/game/render/theme-palette';

describe('3-2 星隙长渡关加载（注册表 + Loader）', () => {
  const data = levels['3-2'];
  const rt = LevelLoader.load(data);

  it('注册表含 3-2 且通过 validateLevelData；width=48 / height=9', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('3-2');
    expect(data.width).toBe(48);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "astral"（星界调色板复用）、name="星隙长渡"、parTimeMs=92000', () => {
    expect(data.metadata.theme).toBe('astral');
    expect(data.metadata.name).toBe('星隙长渡');
    expect(data.metadata.parTimeMs).toBe(92000);
    // 单调递增：par 92000 > 3-1 的 88000（主计划 §5.2）
    expect(data.metadata.parTimeMs!).toBeGreaterThan(levels['3-1'].metadata.parTimeMs!);
  });

  it('mechanics.glide === true（Ch3 羽降开关，布尔写法与 3-1 一致）', () => {
    expect(data.mechanics?.glide).toBe(true);
    // 向后兼容红线：旧 13 关无 mechanics 字段 → 羽降关闭，行为完全不变。
    expect(levels['2-6'].mechanics).toBeUndefined();
  });

  it('goal x + w < width*ts（1504 < 1536），终点可达且 type=triumph_gate；goal.x=(width−2)×32', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1504);
    expect(data.goal.x).toBe((data.width - 2) * data.tileSize); // 1472 = tx46，与 3-1 同构
    expect(data.goal.type).toBe('triumph_gate');
    expect(data.goal.y).toBe(160);
    expect(data.goal.h).toBe(64);
  });

  it('敌种组合 = gu_bao×3 + ci_li×3 + du_fu×4 + shi_pao×2 = 12（密度 0.250，单调高于 3-1 的 0.239）', () => {
    expect(rt.enemies).toHaveLength(12);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(3);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(4);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
    // 克制声明：shi_pao 仅 2 只（与 3-1 持平）——代价轴留给 3-4，防支柱漂移（设计稿 §4.4）。
    expect(rt.enemies.length / data.width).toBeCloseTo(0.25, 3);
  });

  it('敌人 y 契约恒定（gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100），零例外', () => {
    const yByType: Record<string, number> = {
      gu_bao: 224,
      ci_li: 200,
      du_fu: 120,
      shi_pao: 100,
    };
    for (const e of data.entities) {
      const expected = yByType[e.type];
      if (expected !== undefined) expect(e.y).toBe(expected);
    }
  });

  it('实体分桶：coin×13 / seed×5（seed_01..seed_05）/ checkpoint×3', () => {
    expect(rt.coins).toHaveLength(13);
    expect(rt.seeds).toHaveLength(5);
    expect(rt.seeds.map((s) => s.seedId)).toEqual([
      'seed_01',
      'seed_02',
      'seed_03',
      'seed_04',
      'seed_05',
    ]);
    // 公平性：4 颗种子在云海地面主路（y=200）→ 完全不会羽降也能满蜕变（4×0.25，设计稿 §8）。
    expect(rt.seeds.filter((s) => s.y === 200)).toHaveLength(4);
    // seed_03 是唯一技能梯度奖励：悬于 fj4(ty4) 上方 32px。
    expect([rt.seeds[2].x, rt.seeds[2].y]).toEqual([1024, 96]);
    expect(rt.checkpoints).toHaveLength(3);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([352, 704, 1088]);
    const guBaoOffsets = data.entities
      .filter((e) => e.type === 'gu_bao')
      .map((e) => (e as unknown as { params?: { phaseOffset?: number } }).params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 265, 530]);
  });

  it('教学装置：两段 45° 金币斜降弧（弧①416/448+544/576、弧②864/896）标注羽降中继路线', () => {
    const arc1 = rt.coins.filter((c) => c.x >= 416 && c.x <= 576).sort((a, b) => a.x - b.x);
    expect(arc1.map((c) => [c.x, c.y])).toEqual([
      [416, 56],
      [448, 88],
      [544, 96],
      [576, 128],
    ]);
    const arc2 = rt.coins.filter((c) => c.x >= 864 && c.x <= 896).sort((a, b) => a.x - b.x);
    expect(arc2.map((c) => [c.x, c.y])).toEqual([
      [864, 56],
      [896, 88],
    ]);
  });

  it('tile 去重（grid 幂等）：云海地面 ty7-8 全宽实心、墙 col0/col47 实心、oneway 远岛群 fj0..fj5', () => {
    // 公平性地板：云海地面全宽实心恒存在 → 零坠落死亡、零 soft-lock。
    for (let tx = 0; tx < 48; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(47, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    // 远岛群全部为 oneway（复用既有 kind，0 新增）——羽降失败落回地面继续前进。
    const islands: Array<[number[], number]> = [
      [[4, 5], 5], // fj0 阶梯岛
      [[8, 9, 10], 3], // fj1 高栖岛（长渡①起点）
      [[18, 19], 5], // fj2 长渡①落点（G2 = 7 格 Δ+2，必需羽降）
      [[23, 24], 3], // fj3 高栖岛（G3 = 3 格 Δ−2 反面示范）
      [[31, 32], 4], // fj4 长渡②落点（G4 = 6 格 Δ+1，载 seed_03）
      [[43, 44], 5], // fj5 门前高台
    ];
    for (const [txs, ty] of islands) {
      for (const tx of txs) {
        expect(rt.world.isOneWayTile(tx, ty)).toBe(true);
        expect(rt.world.isSolidTile(tx, ty)).toBe(false); // oneway 非 solid
      }
    }
  });

  it('出生点 spawn = (64, 190)，beat 启用且 beatPlatforms 单簇红线校验：tiles 全 ty=4（严禁 ty5）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toHaveLength(1);
    expect(data.beat.tracks[0].target).toBe('bp_b1');
    expect(data.beat.tracks[0].pattern).toBe('SSGG'); // 沿用 3-1 pattern → 相位记忆可迁移
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(1); // 认知预算全给空间轴：维持 1 簇，不与长渡叠加
    expect(bps[0].id).toBe('bp_b1');
    expect(bps[0].initial).toBe('ghost');
    for (const bp of bps) {
      for (const t of bp.tiles) {
        expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
      }
    }
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([36, 37, 38]);
  });

  it('顶层 props / checkpoints 为空数组（检查点以 entities 表达，沿用 2-1..3-1 写法）', () => {
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });
});

describe('nextLevelId 进度链（3-1 → 3-2 → 3-3）', () => {
  it('LEVEL_ORDER 含 3-2 且位于 3-1 之后、3-3 之前；nextLevelId("3-1") === "3-2"', () => {
    expect(LEVEL_ORDER).toContain('3-2');
    expect(LEVEL_ORDER.indexOf('3-1')).toBeLessThan(LEVEL_ORDER.indexOf('3-2'));
    expect(LEVEL_ORDER.indexOf('3-2')).toBeLessThan(LEVEL_ORDER.indexOf('3-3'));
    expect(nextLevelId(LEVEL_ORDER, '3-1')).toBe('3-2');
    expect(nextLevelId(LEVEL_ORDER, '3-2')).toBe('3-3');
  });
});

describe('biome 接线（3-2 复用 astral 调色板，0 新增 hex）', () => {
  it('biomeForLevel(3-2) = astral palette（rockFace 星白浮岩 #BEC4F9 / bg 墨蓝星空 #1F2244）', () => {
    const pal = biomeForLevel(levels['3-2']);
    expect(pal.rockFace).toBe(0xbec4f9);
    expect(pal.bg).toBe(0x1f2244);
    // 与 3-1 逐槽同源（同批复用，art 侧 0 新增）
    expect(pal).toEqual(biomeForLevel(levels['3-1']));
  });
});
