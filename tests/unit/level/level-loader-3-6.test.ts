/**
 * tests/unit/level/level-loader-3-6.test.ts — 3-6 星穹终启关（破晓穹顶 zenith · climax 章末：四轴混编 gauntlet）
 * 加载验证（core 纯逻辑）。结构照 level-loader-3-5.test.ts（同构）。
 *
 * 覆盖：注册表含 3-6、validateLevelData 通过、metadata.theme='zenith'/name='星穹终启'/parTimeMs=114000、
 * goal x+w<width*ts 且 type='triumph_gate'、敌种组合（gu_bao×4 + ci_li×4 + du_fu×5 + shi_pao×5 + cyclone×1 = 19，
 *   密度分子 18/56≈0.321 为全项目峰）、实体分桶（coin×16 / seed×6 / checkpoint×5）、敌人 y 契约、
 * cyclone params 与 2-3 逐值相同、du_fu / shi_pao 摆位纪律、tile 去重 + oneway 群岛、
 * 出生点、beat 启用 2 簇（全章上限）+ 两簇 beatPlatforms tiles 全 ty=4（红线：严禁 ty5）、
 * mechanics.glide === true、云海地面 ty7,8 全宽实心（公平性地板：零坠落死亡、零 soft-lock）、
 * ⚠️ **本关专属红线①**：可站立层仅 ty5/ty4/ty3，零 ty2（height=9 物理上限，三层即顶）、
 * ⚠️ **本关专属红线②**：beat 六格全 ty=4（严禁 ty5），
 * ⚠️ **本关专属红线③**：rt.enemies 含 cyclone → 长度 19、密度分子 18（不含 cyclone），
 * ⚠️ **biome 红线**：biomeForLevel(3-6).bg === 0xffe695（zenith 未注册会静默回退 grass，终章变草原）、
 * n1 必须是 tx29（反向回跳绕过相位漏洞封死）、nextLevelId 进度链（3-6 当前末关 → null）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData, type EnemyEntityDef } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { biomeForLevel } from '../../../src/game/render/theme-palette';

describe('3-6 星穹终启关加载（注册表 + Loader）', () => {
  const data = levels['3-6'];
  const rt = LevelLoader.load(data);

  it('注册表含 3-6 且通过 validateLevelData；width=56 / height=9 / tileSize=32 / version=1', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('3-6');
    expect(data.width).toBe(56);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "zenith"（破晓穹顶，仅本关）/ name="星穹终启" / parTimeMs=114000（> 3-5 的 104000）', () => {
    expect(data.metadata.theme).toBe('zenith');
    expect(data.metadata.name).toBe('星穹终启');
    expect(data.metadata.parTimeMs).toBe(114000);
    // 单调递增：114000 > 3-5 的 104000（最长 + 最密 + 唯一四轴混编）。
    expect(data.metadata.parTimeMs!).toBeGreaterThan(levels['3-5'].metadata.parTimeMs!);
  });

  it('mechanics.glide === true（本关把羽降推向四轴混编的「保底续跳」）', () => {
    expect(data.mechanics?.glide).toBe(true);
    expect(levels['2-6'].mechanics).toBeUndefined(); // 旧关缺省 = 关闭，零回归
  });

  it('goal x + w < width*ts（1792），终点可达且 type=triumph_gate；goal.x=(width−2)×32', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1760);
    expect(data.goal.x).toBe((data.width - 2) * data.tileSize); // 1728 = tx54
    expect(data.goal.type).toBe('triumph_gate');
    expect(data.goal.y).toBe(160);
    expect(data.goal.h).toBe(64);
  });

  it('敌种组合 = gu_bao×4 + ci_li×4 + du_fu×5 + shi_pao×5 + cyclone×1；rt.enemies 长度 19（密度分子 18/56≈0.321）', () => {
    // ⚠️ cyclone 计入 rt.enemies（同 2-3 实测）：3-6 的 rt.enemies.length === 19（18 战斗敌 + 1 cyclone）。
    expect(rt.enemies).toHaveLength(19);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(4);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(4);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(5);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(5);
    expect(types.filter((t) => t === 'cyclone')).toHaveLength(1);
    // 密度分子 = 18（不含 cyclone）：0.3214 为全项目峰，单调高于 3-5(16/52≈0.308) 与 2-6(16/56≈0.286)。
    const combat = rt.enemies.filter((e) => e.type !== 'cyclone').length;
    expect(combat).toBe(18);
    expect(combat / data.width).toBeCloseTo(18 / 56, 3);
    expect(combat / data.width).toBeGreaterThan(16 / 52); // 3-5
    expect(combat / data.width).toBeGreaterThan(16 / 56); // 2-6
  });

  it('敌人 y 契约恒定（gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100），零例外', () => {
    const yByType: Record<string, number> = {
      gu_bao: 224,
      ci_li: 200,
      du_fu: 120,
      shi_pao: 100,
    };
    for (const e of data.entities) {
      if (e.type === 'gu_bao' || e.type === 'ci_li' || e.type === 'du_fu' || e.type === 'shi_pao') {
        // cyclone.y 不在此循环（地面锚点，单独断言，见下方 cyclone 用例）。
        expect((e as EnemyEntityDef).y).toBe(yByType[e.type]);
      }
    }
  });

  it('cyclone 力场实体（x=1376 / y=224 地面锚点）params 与 2-3 逐值相同（0 代码改动）', () => {
    const cyclone = data.entities.find((e) => e.type === 'cyclone') as EnemyEntityDef | undefined;
    expect(cyclone).toBeTruthy();
    // 备用 D1 方案（cyclone 平移至 x=1504 / tx47）未启用；
    // 若 QA 实测 cyclone 干扰地面主路，回退 D1 = x 改 1504。
    expect(cyclone!.x).toBe(1376);
    expect(cyclone!.y).toBe(224); // 地面锚点（非敌契约，单独断言）
    expect(cyclone!.params).toEqual({ w: 96, h: 160, liftAcc: 2600, riseMax: 220, dragX: 0 });
    // 与 2-3 的 cyclone params 逐值相同（仅数据复用，cyclone 代码零改动）。
    const cyclone2_3 = levels['2-3'].entities.find(
      (e) => e.type === 'cyclone',
    ) as EnemyEntityDef | undefined;
    expect(cyclone2_3).toBeTruthy();
    expect(cyclone!.params).toEqual(cyclone2_3!.params);
  });

  it('du_fu 摆位纪律：5 只 xs=[352,544,992,1248,1504]，间距 [6,14,8,8] 全 ≥3', () => {
    const xs = data.entities.filter((e) => e.type === 'du_fu').map((e) => e.x);
    expect(xs).toEqual([352, 544, 992, 1248, 1504]);
    const gaps = xs.slice(1).map((x, i) => (x - xs[i]) / 32);
    expect(gaps).toEqual([6, 14, 8, 8]);
    expect(gaps.every((g) => g >= 3)).toBe(true);
  });

  it('shi_pao 摆位纪律：5 门全在跨越空档（tx26/30/35/48/51），不与任何可站立瓦片同列', () => {
    // 主理人预授权：若 QA 实测密度 0.321 过载，可删 shi_pao(x=1120,tx35) 降密度，
    // 但不得削减 du_fu。当前 5 门炮全保留。
    const paoTxs = data.entities.filter((e) => e.type === 'shi_pao').map((e) => e.x / 32);
    expect(paoTxs).toEqual([26, 30, 35, 48, 51]);
    const standTxs = new Set<number>();
    for (const t of data.tiles) if (t.kind === 'oneway') standTxs.add(t.tx);
    for (const bp of data.beatPlatforms!) for (const t of bp.tiles) standTxs.add(t.tx);
    for (const tx of paoTxs) expect(standTxs.has(tx)).toBe(false);
  });

  it('实体分桶：coin×16 / seed×6（seed_01..06）/ checkpoint×5；seed y / gu_bao phaseOffsets', () => {
    expect(rt.coins).toHaveLength(16);
    expect(rt.seeds).toHaveLength(6);
    expect([...rt.seeds.map((s) => s.seedId)].sort()).toEqual([
      'seed_01',
      'seed_02',
      'seed_03',
      'seed_04',
      'seed_05',
      'seed_06',
    ]);
    // 公平性（红线 ≥3 颗地面主路）：seed_01/02/03 三颗在地面主路（y=200）= 0.75 蜕变。
    const byId = new Map(rt.seeds.map((s) => [s.seedId, s]));
    expect(byId.get('seed_01')!.y).toBe(200);
    expect(byId.get('seed_02')!.y).toBe(200);
    expect(byId.get('seed_03')!.y).toBe(200);
    expect(rt.seeds.filter((s) => s.y === 200).length).toBeGreaterThanOrEqual(3);
    // 技能梯度：seed_04/06 在 ty3 顶上方 16px（y=80），seed_05 在 g1(ty4) 顶上方 16px（y=112）。
    expect([byId.get('seed_04')!.x, byId.get('seed_04')!.y]).toEqual([736, 80]);
    expect([byId.get('seed_05')!.x, byId.get('seed_05')!.y]).toEqual([1600, 112]);
    expect([byId.get('seed_06')!.x, byId.get('seed_06')!.y]).toEqual([1440, 80]);
    // cp×5（全项目最多）：x = [320,608,800,1152,1472]，全 y=176。
    expect(rt.checkpoints).toHaveLength(5);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([320, 608, 800, 1152, 1472]);
    expect(rt.checkpoints.every((c) => c.y === 176)).toBe(true);
    // gu_bao 相位错相 0/265/530/795。
    const guBaoOffsets = data.entities
      .filter((e): e is EnemyEntityDef => e.type === 'gu_bao')
      .map((e) => e.params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 265, 530, 795]);
  });

  it('tile 去重（grid 幂等）：云海地面 ty7-8 全宽实心、墙 col0/col55 实心、oneway 群岛', () => {
    for (let tx = 0; tx < 56; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(55, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    const islands: Array<[number[], number]> = [
      [[3, 4], 5], // z1 起手低岛
      [[7, 8], 3], // z2 回望台（ty3）
      [[14, 15], 5], // z3 长渡落点
      [[23, 24], 3], // z4 律动高台（ty3）
      [[29], 5], // n1 窄岛①
      [[34], 5], // n2 窄岛②
      [[36, 37, 38], 5], // T1 塔基
      [[44, 45], 3], // T3 塔顶（ty3）
      [[50], 4], // g1 gauntlet 窄岛①（ty4）
      [[53], 5], // g2 gauntlet 窄岛②
    ];
    for (const [txs, ty] of islands) {
      for (const tx of txs) {
        expect(rt.world.isOneWayTile(tx, ty)).toBe(true);
        expect(rt.world.isSolidTile(tx, ty)).toBe(false); // oneway 非 solid
      }
    }
  });

  it('⚠️ ty2 禁令（本关专属红线，脚本级）：可站立层仅 ty5/ty4/ty3，最高瓦片 = ty3；ty<3 只允许边界墙', () => {
    const oneways = data.tiles.filter((t) => t.kind === 'oneway');
    expect(oneways.length).toBeGreaterThan(0);
    expect(oneways.every((t) => t.ty >= 3 && t.ty <= 5)).toBe(true);
    expect(Math.min(...oneways.map((t) => t.ty))).toBe(3); // 三层塔 + z2/z4 已达 height=9 物理上限
    // 节拍平台同样受约束（两簇均 ty=4）。
    for (const bp of data.beatPlatforms!) {
      for (const t of bp.tiles) expect(t.ty).toBeGreaterThanOrEqual(3);
    }
    // 除左右边界墙（solid，整高 ty0..8，与 3-1~3-5 同构）外，不得出现任何 ty<3 的瓦片。
    for (const t of data.tiles) {
      if (t.ty < 3) expect([0, 55]).toContain(t.tx);
    }
    // 设计意图（非 bug）：ty3 顶面 y=96，距地面顶 y=224 为 128px > 二段跳顶点 ≈119px
    // → ty3 从地面绝对不可直达，须经 ty5/ty4 中继 / 节拍平台 / cyclone。实现期不得判为「跳不上去 = bug」。
    expect((7 - 3) * 32).toBe(128);
    expect((7 - 3) * 32).toBeGreaterThan(119);
    // 对照：ty4（bp_z1/bp_z2/g1）顶距地面 96px ≪ 119px → 从地面纯跳可上（满蜕变的公平性地板）。
    expect((7 - 4) * 32).toBe(96);
    expect((7 - 4) * 32).toBeLessThan(119);
    // 对照：ty5（z1/z3/n1/n2/T1/g2）顶距地面 64px ≪ 119px → 从地面纯跳可上。
    expect((7 - 5) * 32).toBe(64);
    expect((7 - 5) * 32).toBeLessThan(119);
  });

  it('⚠️ beat 红线：enabled/bpm/grid/tracks 长度 2 且 target=[bp_z1,bp_z2]、pattern 全 SSGG；两簇 beat 全 ty=4', () => {
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toHaveLength(2);
    expect(data.beat.tracks.map((t) => t.target)).toEqual(['bp_z1', 'bp_z2']);
    // 两簇同 pattern → 相位记忆可从 3-1/3-3/3-5 无损迁移（防过载）。
    expect(data.beat.tracks.every((t) => t.pattern === 'SSGG')).toBe(true);
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(2);
    expect(bps.map((b) => b.id)).toEqual(['bp_z1', 'bp_z2']);
    expect(bps.every((b) => b.initial === 'ghost')).toBe(true);
    // ⚠️ 红线：节拍平台必须放站立角色头顶之上 → 两簇六格全 ty=4，严禁 ty=5。
    for (const bp of bps) {
      for (const t of bp.tiles) expect(t.ty).toBe(4);
    }
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([18, 19, 20]); // bp_z1 相位平台（z4 唯一入口）
    expect(bps[1].tiles.map((t) => t.tx)).toEqual([40, 41, 42]); // bp_z2 塔中门禁（T3 技巧解入口）
    // track.target 必须能解析到实际平台（否则加载期 fail-fast）。
    const ids = new Set(bps.map((b) => b.id));
    for (const tr of data.beat.tracks) expect(ids.has(tr.target)).toBe(true);
  });

  it('出生点 spawn = (64, 190)；顶层 props / checkpoints 空数组（检查点以 entities 表达，沿用 2-1..3-5 写法）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });

  it('⚠️ n1 必须是 tx29（反向回跳绕过相位漏洞封死）', () => {
    // 红线硬断言：n1 定在 tx29（非 tx28）。
    // 若改回 tx28，gap(z4@tx23-24, n1@tx28) 恰为 3 = 安全值上限，玩家可从 n1 反向回跳绕过 bp_z1 相位
    // 登上 z4（ty3 律动高台，time 轴独家奖励），时间轴独家奖励失效。
    const n1 = data.tiles.find((t) => t.kind === 'oneway' && t.tx === 29);
    expect(n1).toBeTruthy();
    expect(n1!.tx).toBe(29); // 硬断言：n1.tx 必须 === 29
    expect(n1!.ty).toBe(5);
    // 反向回跳封死校验：z4(tx23..24,ty3) 与 n1(tx29,ty5) 之间 gap = 29 - 24 - 1 = 4 > 3（安全上限）
    // → 不可从 n1 反向回跳抵达 z4。
    const z4 = data.tiles.filter((t) => t.kind === 'oneway' && t.tx >= 23 && t.tx <= 24);
    expect(z4.length).toBe(2);
    const gap = 29 - Math.max(...z4.map((t) => t.tx)) - 1;
    expect(gap).toBe(4);
    expect(gap).toBeGreaterThan(3);
  });
});

describe('biome 接线（zenith 破晓穹顶：明度再翻面，0 新增 hex）', () => {
  it('biomeForLevel(3-6).bg===0xffe695 / .rockFace===0x373d79；!== biomeForLevel(3-5)（明度翻面已生效）', () => {
    const pal = biomeForLevel(levels['3-6']);
    // ⚠️ 红线：theme 未注册时 resolveBiome 静默回退 grass（bg=null）→ 终章变草原。
    // bg === 0xffe695 证明 zenith 已落地（E2/E3 与 E1 同批，未然回退）。
    expect(pal.bg).toBe(0xffe695); // 破晓金天（全 biome 最亮天）
    expect(pal.rockFace).toBe(0x373d79); // 深星紫逆光岩（签名色）
    expect(pal).not.toEqual(biomeForLevel(levels['3-5'])); // astral 墨蓝天 0x1f2244（明度翻面已生效）
  });
});

describe('nextLevelId 进度链（3-6 当前末关 → null）', () => {
  it('LEVEL_ORDER 末关 3-6；nextLevelId("3-5")==="3-6"，("3-6")===null', () => {
    expect(LEVEL_ORDER).toContain('3-6');
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('3-6');
    expect(nextLevelId(LEVEL_ORDER, '3-5')).toBe('3-6');
    expect(nextLevelId(LEVEL_ORDER, '3-6')).toBeNull();
  });
});
