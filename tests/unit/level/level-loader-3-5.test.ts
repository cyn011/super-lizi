/**
 * tests/unit/level/level-loader-3-5.test.ts — 3-5 凌霄绝息关（星界 astral · 高压前奏：链式轴）
 * 加载验证（core 纯逻辑）。结构照 level-loader-3-3.test.ts / 3-4.test.ts。
 *
 * 覆盖：注册表含 3-5、validateLevelData 通过、metadata.theme='astral'/name='凌霄绝息'/parTimeMs=104000、
 * goal x+w<width*ts 且 type='triumph_gate'、敌种组合（gu_bao×4 + ci_li×4 + du_fu×5 + shi_pao×3 = 16，du_fu 为本章踏板峰）、
 * 实体分桶（coin×14 / seed×6 / checkpoint×4）、敌人 y 契约、tile 去重 + oneway 链条区 e0..e3 + 三层浮岩塔 T1/T2/T3、
 * 出生点、beat 启用 2 簇（= 全章上限）+ 两簇 beatPlatforms tiles 全 ty=4（红线：严禁 ty5）、
 * mechanics.glide === true、云海地面 ty7,8 全宽实心（公平性地板：零坠落死亡、零 soft-lock）、
 * ⚠️ **本关专属红线：可站立层仅 ty5/ty4/ty3，零 ty2**（height=9 物理上限，三层即顶）、
 * nextLevelId 进度链（3-5 为当前末关 → null，结算页隐藏「下一关」）、biome 接线（astral 复用）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { biomeForLevel } from '../../../src/game/render/theme-palette';

describe('3-5 凌霄绝息关加载（注册表 + Loader）', () => {
  const data = levels['3-5'];
  const rt = LevelLoader.load(data);

  it('注册表含 3-5 且通过 validateLevelData；width=52 / height=9', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('3-5');
    expect(data.width).toBe(52);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "astral"（星界调色板复用）、name="凌霄绝息"、parTimeMs=104000', () => {
    expect(data.metadata.theme).toBe('astral');
    expect(data.metadata.name).toBe('凌霄绝息');
    expect(data.metadata.parTimeMs).toBe(104000);
    // 单调递增：104000 > 3-4 的 98000（三层塔攀登 + 链条重试 + 两处相位等待）。
    expect(data.metadata.parTimeMs!).toBeGreaterThan(levels['3-4'].metadata.parTimeMs!);
  });

  it('mechanics.glide === true（本关把羽降深化为「可被踩踏续航的链条节点」）', () => {
    expect(data.mechanics?.glide).toBe(true);
    expect(levels['2-6'].mechanics).toBeUndefined(); // 旧关缺省 = 关闭，零回归
  });

  it('goal x + w < width*ts（1632 < 1664），终点可达且 type=triumph_gate；goal.x=(width−2)×32', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1632);
    expect(data.goal.x).toBe((data.width - 2) * data.tileSize); // 1600 = tx50
    expect(data.goal.type).toBe('triumph_gate');
    expect(data.goal.y).toBe(160);
    expect(data.goal.h).toBe(64);
  });

  it('敌种组合 = gu_bao×4 + ci_li×4 + du_fu×5 + shi_pao×3 = 16（密度 0.308，单调高于 3-4 的 0.280）', () => {
    expect(rt.enemies).toHaveLength(16);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(4);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(4);
    // du_fu×5 = 本章踏板峰（链条骨架 + 每处必需 glide 的第二解）。
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(5);
    // shi_pao 3→ 3-4 的 5 回落：本关是负荷谷（★★），炮只作复用考核。
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(3);
    expect(rt.enemies.length / data.width).toBeCloseTo(0.308, 3);
    expect(rt.enemies.length / data.width).toBeGreaterThan(
      levels['3-4'].entities.filter((e) =>
        ['gu_bao', 'ci_li', 'du_fu', 'shi_pao'].includes(e.type),
      ).length / levels['3-4'].width,
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
  });

  it('du_fu 摆位纪律：5 只间距 5/13/6/6 格（全 ≥3）→ 物理上排除「du_fu 连踩通关」这一主导策略', () => {
    const xs = data.entities.filter((e) => e.type === 'du_fu').map((e) => e.x);
    expect(xs).toEqual([416, 576, 992, 1184, 1376]);
    const gaps = xs.slice(1).map((x, i) => (x - xs[i]) / 32);
    expect(gaps).toEqual([5, 13, 6, 6]);
    expect(gaps.every((g) => g >= 3)).toBe(true);
  });

  it('shi_pao 摆位纪律：3 门全在跨越空档（tx23/28/41），不与任何可站立瓦片同列（读相位时头顶无炮口）', () => {
    const paoTxs = data.entities.filter((e) => e.type === 'shi_pao').map((e) => e.x / 32);
    expect(paoTxs).toEqual([23, 28, 41]);
    const standTxs = new Set<number>();
    for (const t of data.tiles) if (t.kind === 'oneway') standTxs.add(t.tx);
    for (const bp of data.beatPlatforms!) for (const t of bp.tiles) standTxs.add(t.tx);
    for (const tx of paoTxs) expect(standTxs.has(tx)).toBe(false);
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
    // 公平性（红线 ≥3 颗地面主路）：seed_01/02/03 三颗在云海地面（y=200）= 0.75 蜕变；
    // 第 4 颗 seed_04 位于层1（塔基 ty5，顶距地面 64px ≪ 119px，纯跳可上）→ 满蜕变可达。
    const byId = new Map(rt.seeds.map((s) => [s.seedId, s]));
    expect(byId.get('seed_01')!.y).toBe(200);
    expect(byId.get('seed_02')!.y).toBe(200);
    expect(byId.get('seed_03')!.y).toBe(200);
    expect(rt.seeds.filter((s) => s.y === 200).length).toBeGreaterThanOrEqual(3);
    // 技能梯度：三层塔每层一颗（层1 → 层2 → 层3）。
    expect([byId.get('seed_04')!.x, byId.get('seed_04')!.y]).toEqual([1120, 128]);
    expect([byId.get('seed_05')!.x, byId.get('seed_05')!.y]).toEqual([1280, 96]);
    // seed_06 置 y=80（层3 顶面 y=96 上方仅 16px）→ 走过去即得，规避「顶点出画」不可见风险。
    expect([byId.get('seed_06')!.x, byId.get('seed_06')!.y]).toEqual([1552, 80]);
    // cp×4：cp3 = 塔攀第一格 tx32、cp4 = bp_e2 门禁正下方 tx44（塔顶重试成本最低）。
    expect(rt.checkpoints).toHaveLength(4);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([352, 704, 1024, 1408]);
    expect(rt.checkpoints.every((c) => c.y === 176)).toBe(true);
    const guBaoOffsets = data.entities
      .filter((e) => e.type === 'gu_bao')
      .map((e) => (e as unknown as { params?: { phaseOffset?: number } }).params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 530, 265, 795]);
  });

  it('tile 去重（grid 幂等）：云海地面 ty7-8 全宽实心、墙 col0/col51 实心、oneway 链条区 + 三层浮岩塔', () => {
    for (let tx = 0; tx < 52; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(51, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    const islands: Array<[number[], number]> = [
      [[4, 5], 5], // e0 热身低岛
      [[9, 10], 5], // e1 热身低岛（链条起点）
      [[14, 15], 4], // e2 双段链第 1 落点
      [[20, 21], 4], // e3 双段链第 2 落点
      [[33, 34, 35], 5], // 层1 塔基
      [[38, 39, 40], 4], // 层2 塔中
      [[48, 49], 3], // 层3 塔顶 = 全关最高可站立面
    ];
    for (const [txs, ty] of islands) {
      for (const tx of txs) {
        expect(rt.world.isOneWayTile(tx, ty)).toBe(true);
        expect(rt.world.isSolidTile(tx, ty)).toBe(false); // oneway 非 solid
      }
    }
  });

  it('⚠️ ty2 禁令（本关专属红线）：可站立层仅 ty5/ty4/ty3，最高瓦片 = 层3 的 ty3；ty<3 只允许边界墙', () => {
    const oneways = data.tiles.filter((t) => t.kind === 'oneway');
    expect(oneways.length).toBeGreaterThan(0);
    expect(oneways.every((t) => t.ty >= 3 && t.ty <= 5)).toBe(true);
    expect(Math.min(...oneways.map((t) => t.ty))).toBe(3); // 三层塔已达 height=9 的物理上限
    // 节拍平台同样受约束（两簇均 ty=4）。
    for (const bp of data.beatPlatforms!) {
      for (const t of bp.tiles) expect(t.ty).toBeGreaterThanOrEqual(3);
    }
    // 除左右边界墙（solid，整高 ty0..8，与 3-1~3-4 同构）外，不得出现任何 ty<3 的瓦片。
    for (const t of data.tiles) {
      if (t.ty < 3) expect([0, 51]).toContain(t.tx);
    }
    // 设计意图（非 bug）：层3 顶面 y=96，距地面顶 y=224 为 128px > 二段跳顶点 ≈119px
    // → 层3 从地面绝对不可直达，bp_e2 是唯一入口。实现期不得判为「跳不上去 = bug」。
    expect((7 - 3) * 32).toBe(128);
    expect((7 - 3) * 32).toBeGreaterThan(119);
    // 对照：层1（ty5）顶距地面 64px ≪ 119px → 从地面纯跳可上（满蜕变的公平性地板）。
    expect((7 - 5) * 32).toBeLessThan(119);
  });

  it('出生点 spawn = (64, 190)，beat 启用 2 簇（全章上限）且红线校验：两簇 tiles 全 ty=4（严禁 ty5）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toHaveLength(2);
    expect(data.beat.tracks.map((t) => t.target)).toEqual(['bp_e1', 'bp_e2']);
    // 两簇同 pattern → 相位记忆可从 3-1/3-3 无损迁移（防过载）。
    expect(data.beat.tracks.every((t) => t.pattern === 'SSGG')).toBe(true);
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(2);
    expect(bps.map((b) => b.id)).toEqual(['bp_e1', 'bp_e2']);
    expect(bps.every((b) => b.initial === 'ghost')).toBe(true);
    for (const bp of bps) {
      for (const t of bp.tiles) {
        expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
      }
    }
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([25, 26, 27]); // bp_e1 链条中继站
    expect(bps[1].tiles.map((t) => t.tx)).toEqual([44, 45, 46]); // bp_e2 塔顶唯一入口
    // track.target 必须能解析到实际平台（否则加载期 fail-fast）。
    const ids = new Set(bps.map((b) => b.id));
    for (const tr of data.beat.tracks) expect(ids.has(tr.target)).toBe(true);
  });

  it('顶层 props / checkpoints 为空数组（检查点以 entities 表达，沿用 2-1..3-4 写法）', () => {
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });
});

describe('nextLevelId 进度链（3-5 为当前末关 → null，结算页隐藏「下一关」）', () => {
  it('LEVEL_ORDER 末关为 3-5；nextLevelId("3-4") === "3-5"，("3-5") === null', () => {
    expect(LEVEL_ORDER).toContain('3-5');
    expect(LEVEL_ORDER.indexOf('3-4')).toBeLessThan(LEVEL_ORDER.indexOf('3-5'));
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('3-5');
    expect(nextLevelId(LEVEL_ORDER, '3-4')).toBe('3-5');
    expect(nextLevelId(LEVEL_ORDER, '3-5')).toBeNull();
  });
});

describe('biome 接线（3-5 复用 astral 调色板，0 新增 hex）', () => {
  it('biomeForLevel(3-5) = astral palette（与 3-1..3-4 逐槽同源）', () => {
    const pal = biomeForLevel(levels['3-5']);
    expect(pal.rockFace).toBe(0xbec4f9);
    expect(pal.bg).toBe(0x1f2244);
    expect(pal).toEqual(biomeForLevel(levels['3-1']));
  });
});
