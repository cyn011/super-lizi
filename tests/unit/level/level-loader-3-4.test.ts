/**
 * tests/unit/level/level-loader-3-4.test.ts — 3-4 陨雨回廊关（星界 astral · 深化 C：代价轴）
 * 加载验证（core 纯逻辑）。结构照 level-loader-3-3.test.ts。
 *
 * 覆盖：注册表含 3-4、validateLevelData 通过、metadata.theme='astral'/name='陨雨回廊'/parTimeMs=98000、
 * goal x+w<width*ts 且 type='triumph_gate'、敌种组合（gu_bao×3 + ci_li×3 + du_fu×3 + shi_pao×5 = 14，本章火力峰）、
 * 实体分桶（coin×14 / seed×6 / checkpoint×4）、敌人 y 契约、tile 去重 + oneway 走廊踏石 st0..st8、出生点、
 * beat 启用 1 簇（主动降档，把认知带宽让给弹道读取）+ beatPlatforms tiles 全 ty=4（红线：严禁 ty5）、
 * mechanics.glide === true、云海地面 ty7,8 全宽实心（公平性地板：零坠落死亡、零 soft-lock）、
 * 走廊构图红线（可站立 oneway 仅 ty4/ty5，零 ty3、零 ty2）、
 * nextLevelId 进度链（3-3 → 3-4 → 3-5）、biome 接线（astral 复用，0 新增 hex）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { biomeForLevel } from '../../../src/game/render/theme-palette';

describe('3-4 陨雨回廊关加载（注册表 + Loader）', () => {
  const data = levels['3-4'];
  const rt = LevelLoader.load(data);

  it('注册表含 3-4 且通过 validateLevelData；width=50 / height=9', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('3-4');
    expect(data.width).toBe(50);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "astral"（星界调色板复用）、name="陨雨回廊"、parTimeMs=98000', () => {
    expect(data.metadata.theme).toBe('astral');
    expect(data.metadata.name).toBe('陨雨回廊');
    expect(data.metadata.parTimeMs).toBe(98000);
    // 单调递增：98000 > 3-3 的 96000（弹道窗口等待 + 窄岛试错为不可压缩固定成本）。
    expect(data.metadata.parTimeMs!).toBeGreaterThan(levels['3-3'].metadata.parTimeMs!);
  });

  it('mechanics.glide === true（本关把羽降从「资产」翻成「负债」：滞空 = 暴露）', () => {
    expect(data.mechanics?.glide).toBe(true);
    expect(levels['2-6'].mechanics).toBeUndefined(); // 旧关缺省 = 关闭，零回归
  });

  it('goal x + w < width*ts（1568 < 1600），终点可达且 type=triumph_gate；goal.x=(width−2)×32', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1568);
    expect(data.goal.x).toBe((data.width - 2) * data.tileSize); // 1536 = tx48
    expect(data.goal.type).toBe('triumph_gate');
    expect(data.goal.y).toBe(160);
    expect(data.goal.h).toBe(64);
  });

  it('敌种组合 = gu_bao×3 + ci_li×3 + du_fu×3 + shi_pao×5 = 14（密度 0.280，单调高于 3-3 的 0.260）', () => {
    expect(rt.enemies).toHaveLength(14);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(3);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(3);
    // shi_pao×5 = 本章火力峰（1 门 S2 教学样本 + 1 门 S3 出口 + 3 门 S4 走廊）。
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(5);
    expect(rt.enemies.length / data.width).toBeCloseTo(0.28, 3);
    expect(rt.enemies.length / data.width).toBeGreaterThan(
      levels['3-3'].entities.filter((e) =>
        ['gu_bao', 'ci_li', 'du_fu', 'shi_pao'].includes(e.type),
      ).length / levels['3-3'].width,
    );
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
    // 5 门 shi_pao 全部在 y=100 排成一条贯穿全关的火线（走廊正上方 28px）。
    const paoXs = data.entities.filter((e) => e.type === 'shi_pao').map((e) => e.x);
    expect(paoXs).toEqual([480, 960, 1088, 1248, 1344]);
  });

  it('du_fu 摆位纪律：3 只间距均为 400px（12.5 格）≫ 3 格下限 → 不存在 du_fu 连踩链（不抢跑 3-5）', () => {
    const xs = data.entities.filter((e) => e.type === 'du_fu').map((e) => e.x);
    expect(xs).toEqual([384, 784, 1184]);
    for (let i = 1; i < xs.length; i++) {
      expect((xs[i] - xs[i - 1]) / 32).toBeGreaterThanOrEqual(3);
    }
  });

  it('实体分桶：coin×14 / seed×6（seed_01..seed_06）/ checkpoint×4', () => {
    expect(rt.coins).toHaveLength(14);
    expect(rt.seeds).toHaveLength(6);
    expect([...rt.seeds.map((s) => s.seedId)].sort()).toEqual([
      'seed_01',
      'seed_02',
      'seed_03',
      'seed_04',
      'seed_05',
      'seed_06',
    ]);
    // 公平性（红线 ≥3 颗地面主路）：seed_01/02/03/04 四颗全在云海地面（y=200）
    // → 完全不碰高路、不用 glide、不读相位的玩家也能满蜕变（0.25×4 = 1.00）。
    const byId = new Map(rt.seeds.map((s) => [s.seedId, s]));
    expect(byId.get('seed_01')!.y).toBe(200);
    expect(byId.get('seed_02')!.y).toBe(200);
    expect(byId.get('seed_03')!.y).toBe(200);
    expect(byId.get('seed_04')!.y).toBe(200);
    expect(rt.seeds.filter((s) => s.y === 200).length).toBeGreaterThanOrEqual(3);
    // 技能溢价（非通关门槛）：seed_05 悬于 bp_d1 上方、seed_06 悬于 st7 窄岛（三炮火线正中）上方。
    expect([byId.get('seed_05')!.x, byId.get('seed_05')!.y]).toEqual([880, 96]);
    expect([byId.get('seed_06')!.x, byId.get('seed_06')!.y]).toEqual([1296, 96]);
    // cp×4（+1，压力峰专用）：间距递减 8/8/8/6 格，cp4 紧贴 S4 三炮走廊入口 tx32。
    expect(rt.checkpoints).toHaveLength(4);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([320, 576, 832, 1024]);
    expect(rt.checkpoints.every((c) => c.y === 176)).toBe(true);
    const guBaoOffsets = data.entities
      .filter((e) => e.type === 'gu_bao')
      .map((e) => (e as unknown as { params?: { phaseOffset?: number } }).params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 530, 265]);
  });

  it('tile 去重（grid 幂等）：云海地面 ty7-8 全宽实心、墙 col0/col49 实心、oneway 走廊踏石 st0..st8', () => {
    for (let tx = 0; tx < 50; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(49, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    // 走廊踏石全部为 oneway（复用既有 kind，0 新增）；5 座只有 1 格宽（st2/st4/st5/st6/st7）。
    const islands: Array<[number[], number]> = [
      [[4, 5], 5], // st0 热身低岛
      [[8, 9], 5], // st1 热身低岛（走廊入口）
      [[13], 4], // st2 窄岛#1（教具原点，炮 tx15 正压其上）
      [[17, 18], 4], // st3 单炮试探落点
      [[22], 4], // st4 窄岛#2
      [[31], 4], // st5 窄岛#3
      [[35], 4], // st6 窄岛#4（三炮走廊内）
      [[40], 4], // st7 窄岛#5（代价轴靶心）
      [[45, 46], 5], // st8 门前岛
    ];
    for (const [txs, ty] of islands) {
      for (const tx of txs) {
        expect(rt.world.isOneWayTile(tx, ty)).toBe(true);
        expect(rt.world.isSolidTile(tx, ty)).toBe(false); // oneway 非 solid
      }
    }
    // 窄岛计数：1 格宽岛恰为 5 座（代价轴的落点精度考核规模）。
    expect(data.tiles.filter((t) => t.kind === 'oneway')).toHaveLength(13);
  });

  it('走廊构图红线：可站立 oneway 仅 ty4/ty5（本关零 ty3、零 ty2 —— 是「回廊」不是「塔」）', () => {
    const oneways = data.tiles.filter((t) => t.kind === 'oneway');
    expect(oneways.length).toBeGreaterThan(0);
    expect(oneways.every((t) => t.ty === 4 || t.ty === 5)).toBe(true);
    expect(oneways.some((t) => t.ty === 3)).toBe(false);
    // 顶面 y 只有 128 / 160 两个取值 → 一条近水平的廊道剪影。
    expect([...new Set(oneways.map((t) => t.ty * 32))].sort((a, b) => a - b)).toEqual([128, 160]);
    // 全部 ty4 岛顶距地面 96px < 二段跳顶点 119px → 高路随时可从地面重入，零 soft-lock。
    expect((7 - 4) * 32).toBeLessThan(119);
  });

  it('出生点 spawn = (64, 190)，beat 启用 1 簇（主动降档）且红线校验：tiles 全 ty=4（严禁 ty5）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    // 1 簇 = 主动降档（3-3 已用满 2 簇）：把认知带宽让给弹道读取（★★★ 负荷峰）。
    expect(data.beat.tracks).toHaveLength(1);
    expect(data.beat.tracks.map((t) => t.target)).toEqual(['bp_d1']);
    expect(data.beat.tracks.every((t) => t.pattern === 'SSGG')).toBe(true);
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(1);
    expect(bps.map((b) => b.id)).toEqual(['bp_d1']);
    expect(bps.every((b) => b.initial === 'ghost')).toBe(true);
    for (const bp of bps) {
      for (const t of bp.tiles) {
        expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
      }
    }
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([26, 27, 28]);
    // 唯一节拍簇置于 S3（tx20..31）= 压力峰之外；S4 走廊（tx32..42）内零节拍瓦片、零相位读取。
    expect(bps[0].tiles.every((t) => t.tx >= 20 && t.tx <= 31)).toBe(true);
    // track.target 必须能解析到实际平台（否则加载期 fail-fast）。
    const ids = new Set(bps.map((b) => b.id));
    for (const tr of data.beat.tracks) expect(ids.has(tr.target)).toBe(true);
  });

  it('顶层 props / checkpoints 为空数组（检查点以 entities 表达，沿用 2-1..3-3 写法）', () => {
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });
});

describe('nextLevelId 进度链（3-3 → 3-4 → 3-5）', () => {
  it('LEVEL_ORDER 含 3-4 且位于 3-3 之后、3-5 之前；nextLevelId("3-3") === "3-4"，("3-4") === "3-5"', () => {
    expect(LEVEL_ORDER).toContain('3-4');
    expect(LEVEL_ORDER.indexOf('3-3')).toBeLessThan(LEVEL_ORDER.indexOf('3-4'));
    expect(LEVEL_ORDER.indexOf('3-4')).toBeLessThan(LEVEL_ORDER.indexOf('3-5'));
    expect(nextLevelId(LEVEL_ORDER, '3-3')).toBe('3-4');
    expect(nextLevelId(LEVEL_ORDER, '3-4')).toBe('3-5');
  });
});

describe('biome 接线（3-4 复用 astral 调色板，0 新增 hex）', () => {
  it('biomeForLevel(3-4) = astral palette（与 3-1/3-2/3-3 逐槽同源）', () => {
    const pal = biomeForLevel(levels['3-4']);
    expect(pal.rockFace).toBe(0xbec4f9);
    expect(pal.bg).toBe(0x1f2244);
    expect(pal).toEqual(biomeForLevel(levels['3-1']));
  });
});
