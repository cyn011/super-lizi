/**
 * tests/unit/level/level-loader-4-1.test.ts — 4-1《拾掷回声》（翠野 grass · 第四章 opener：
 * 投掷回归 + 首次「浮 × 投」交汇）加载验证（core 纯逻辑）。结构照 level-loader-3-6.test.ts（同构）。
 *
 * 权威依据：design/gdd/level-4-1-design.md §13.1 —— 本文件逐条落地 **E1–E14** 全部脚本可判断言。
 *
 * 覆盖：注册表含 4-1、validateLevelData 通过、metadata（name/theme/parTimeMs）、
 * mechanics 仅 glide（⚠️ 严禁出现 throw 字段：LevelMechanicsDef 无此字段，投掷为全局常驻能力）、
 * 敌种组合（ci_li×6 + chong_feng×3 + du_fu×2 + gu_bao×2 + shi_pao×1 = 14，密度 14/48≈0.292）、
 * 实体分桶（coin×13 / seed×6 / chestnut×4 / checkpoint×3）、
 * E1 x 非降序 / E2 y 契约 / E3 beat ty=4 / E4 零 ty2 / E5 shi_pao 不与可站立 tx 重叠 /
 * E6 chestnut 间距 ≥8 格 / E7 地面 seed ≥3 / E8 goal 贴地且不越界 / E9 ty4 列无 y<96 可收集物 /
 * E10 无同坐标实体 / E11 地面 ty7,8 全宽无缺口 / E12 cp 距压力峰 ≤6 格 / E13 oneway 簇单点跳达 /
 * E14 gap ≤ 羽降安全值且不可跨 gap 下方为全宽地面、
 * ⚠️ **biome 回归**（设计 §0.10 风险）：theme='grass' 且为 THEME_PALETTES 注册命中而非静默回退、
 * nextLevelId 进度链（4-1 当前末关 → null）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData, type EnemyEntityDef } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { biomeForLevel, THEME_PALETTES } from '../../../src/game/render/theme-palette';

/** 可站立 tx 集合（设计 §4.6）：6 簇 oneway(ty5) + 1 簇 beatPlatform(ty4)。 */
const STANDABLE_TXS = new Set([5, 6, 13, 14, 18, 19, 25, 26, 32, 33, 34, 35, 36, 41, 42]);
/** oneway 簇边界（设计 §4.1 P1..P6）。 */
const ONEWAY_CLUSTERS: Array<[number, number]> = [
  [5, 6], // P1 观景低台
  [13, 14], // P2 左射台
  [18, 19], // P3 右台
  [25, 26], // P4 起跳台
  [32, 33], // P5 落点台
  [41, 42], // P6 对消观察位
];
/** 二段跳顶点上升量（px，Ch3 红线基准）。 */
const JUMP_APEX_PX = 119;
/** Δ=0 时的羽降安全跨越值（格，chapter-4-plan §3.3）。 */
const GLIDE_SAFE_TILES = 5;

describe('4-1 拾掷回声关加载（注册表 + Loader）', () => {
  const data = levels['4-1'];
  const rt = LevelLoader.load(data);

  it('注册表含 4-1 且通过 validateLevelData；width=48 / height=9 / tileSize=32 / version=1', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('4-1');
    expect(data.width).toBe(48);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.name="拾掷回声" / theme="grass"（刻意复用最老 biome）/ parTimeMs=98000（> 3-6 的 ms/格）', () => {
    expect(data.metadata.name).toBe('拾掷回声');
    expect(data.metadata.theme).toBe('grass');
    expect(data.metadata.parTimeMs).toBe(98000);
    // 章间单调递增（按 ms/格，非绝对值：4-1 更短但更慢）——2042 > 3-6 的 2036。
    const msPerTile4_1 = data.metadata.parTimeMs! / data.width;
    const msPerTile3_6 = levels['3-6'].metadata.parTimeMs! / levels['3-6'].width;
    expect(msPerTile4_1).toBeGreaterThan(msPerTile3_6);
  });

  it('⚠️ mechanics 仅 { glide: true }：**严禁 throw 字段**（LevelMechanicsDef 无此字段，投掷全局常驻）', () => {
    expect(data.mechanics?.glide).toBe(true);
    // 红线：投掷无 feature flag、无 mechanics 门（设计 §0.2 / §12）。加 throw 会被 schema 忽略或报错。
    expect(Object.prototype.hasOwnProperty.call(data.mechanics!, 'throw')).toBe(false);
    expect(Object.keys(data.mechanics!)).toEqual(['glide']);
  });

  it('敌种组合 = ci_li×6 + chong_feng×3 + du_fu×2 + gu_bao×2 + shi_pao×1 = 14（密度 14/48≈0.292）', () => {
    expect(rt.enemies).toHaveLength(14);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(6);
    expect(types.filter((t) => t === 'chong_feng')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(2);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(2);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(1);
    // 章首回落：0.292 < 3-6 的 18/56≈0.321（chapter-4-plan §3.1）。
    expect(14 / data.width).toBeCloseTo(0.292, 3);
    expect(14 / data.width).toBeLessThan(18 / 56);
  });

  it('实体分桶：coin×13 / seed×6（seed_01..06）/ chestnut×4 / checkpoint×3；共 40 实体', () => {
    expect(data.entities).toHaveLength(40);
    expect(rt.coins).toHaveLength(13);
    expect(rt.seeds).toHaveLength(6);
    expect(rt.chestnuts).toHaveLength(4);
    expect([...rt.seeds.map((s) => s.seedId)].sort()).toEqual([
      'seed_01',
      'seed_02',
      'seed_03',
      'seed_04',
      'seed_05',
      'seed_06',
    ]);
    expect(rt.checkpoints).toHaveLength(3);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([320, 768, 1280]);
    // 每颗 chestnut 补给 5 发（attack-config.pickupAmount 同值，数据侧显式声明）。
    for (const c of rt.chestnuts) expect(c.params?.amount).toBe(5);
    // gu_bao 相位错开 0 / 530（设计 §5.2 S4）。
    const guBaoOffsets = data.entities
      .filter((e): e is EnemyEntityDef => e.type === 'gu_bao')
      .map((e) => e.params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 530]);
  });

  // ──────────────────────────── E1–E14（设计 §13.1） ────────────────────────────

  it('E1：entities 按 x **非降序**（同 x 不同 y 允许 —— 本关 6 组：192/448/992/1120/1184/1408）', () => {
    const xs = data.entities.map((e) => e.x);
    // ⚠️ 必须是非降序而非严格升序：6 组同 x 异 y 是设计 §5.3 的刻意布局。
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    const dupX = [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))].sort((a, b) => a - b);
    expect(dupX).toEqual([192, 448, 992, 1120, 1184, 1408]);
  });

  it('E2：y 契约零例外（gu_bao=224 / ci_li·chong_feng·chestnut=200 / du_fu=120 / shi_pao=100 / checkpoint=176）', () => {
    const yByType: Record<string, number> = {
      gu_bao: 224,
      ci_li: 200,
      chong_feng: 200,
      chestnut: 200,
      du_fu: 120,
      shi_pao: 100,
      checkpoint: 176,
    };
    let checked = 0;
    for (const e of data.entities) {
      const expected = yByType[e.type];
      if (expected !== undefined) {
        expect(e.y).toBe(expected);
        checked++;
      }
    }
    // 14 敌 + 4 chestnut + 3 checkpoint = 21 项受契约约束（coin/seed 自由）。
    expect(checked).toBe(21);
  });

  it('E3：beatPlatforms 所有 tiles.ty === 4（🔴 红线：节拍平台恒 ty4，严禁 ty5）', () => {
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(1);
    expect(bps[0].id).toBe('bp_a1');
    expect(bps[0].initial).toBe('ghost');
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([34, 35, 36]);
    for (const bp of bps) for (const t of bp.tiles) expect(t.ty).toBe(4);
  });

  it('E4：零 ty2 —— 除左右边界墙(tx0/tx47)外无任何 ty<3 瓦片；oneway 全 ty5、beat ty4（可站立最小 ty=4）', () => {
    for (const t of data.tiles) {
      if (t.ty < 3) expect([0, 47]).toContain(t.tx);
    }
    // 零 ty2：非边界列上 ty===2 的瓦片数必须为 0。
    expect(data.tiles.filter((t) => t.ty === 2 && t.tx !== 0 && t.tx !== 47)).toHaveLength(0);
    const oneways = data.tiles.filter((t) => t.kind === 'oneway');
    expect(oneways).toHaveLength(12);
    expect(oneways.every((t) => t.ty === 5)).toBe(true);
    // 可站立层最小 ty = 4（bp_a1），≥3 ✅。
    const standableTys = [...oneways.map((t) => t.ty), ...data.beatPlatforms!.flatMap((b) => b.tiles.map((t) => t.ty))];
    expect(Math.min(...standableTys)).toBe(4);
    expect(Math.min(...standableTys)).toBeGreaterThanOrEqual(3);
    // ty3 顶面 y=96，距地面顶 224 为 128px > 顶点 119px → 物理不可达，故本关不使用（设计 §4.6）。
    expect((7 - 3) * 32).toBeGreaterThan(JUMP_APEX_PX);
  });

  it('E5：shi_pao 所在 tx(43) ∉ 可站立 tx 集合（防炮台与落脚点同列，反例 X10）', () => {
    const paoTxs = data.entities.filter((e) => e.type === 'shi_pao').map((e) => e.x / 32);
    expect(paoTxs).toEqual([43]);
    // 可站立集合由数据实时推导，避免与常量表脱钩。
    const standTxs = new Set<number>();
    for (const t of data.tiles) if (t.kind === 'oneway') standTxs.add(t.tx);
    for (const bp of data.beatPlatforms!) for (const t of bp.tiles) standTxs.add(t.tx);
    expect([...standTxs].sort((a, b) => a - b)).toEqual([...STANDABLE_TXS].sort((a, b) => a - b));
    for (const tx of paoTxs) expect(standTxs.has(tx)).toBe(false);
  });

  it('E6：相邻 chestnut 间距 ≥ 8 格（实际 12/11/10；弹药经济 §9）', () => {
    const xs = data.entities.filter((e) => e.type === 'chestnut').map((e) => e.x);
    expect(xs).toEqual([352, 736, 1088, 1408]);
    const gaps = xs.slice(1).map((x, i) => (x - xs[i]) / 32);
    expect(gaps).toEqual([12, 11, 10]);
    expect(gaps.every((g) => g >= 8)).toBe(true);
  });

  it('E7：y=200 的地面主路 seed ≥ 3 颗（seed_01/04/05）—— 满蜕变不依赖投掷与 C3/C4 羽降', () => {
    const groundSeeds = rt.seeds.filter((s) => s.y === 200);
    expect(groundSeeds.length).toBeGreaterThanOrEqual(3);
    expect(groundSeeds.map((s) => s.seedId).sort()).toEqual(['seed_01', 'seed_04', 'seed_05']);
    // growthPerSeed=0.25 → 3 地面 + 任意 1 低门槛高路 = 满蜕变（公平性红线 P3）。
    expect(groundSeeds.length + 1).toBeGreaterThanOrEqual(4);
  });

  it('E8：goal.y + h === 224（底贴地面顶面）且 goal.x + w ≤ (width-1)×32', () => {
    expect(data.goal.type).toBe('triumph_gate');
    expect(data.goal.x).toBe(1472);
    expect(data.goal.y).toBe(160);
    expect(data.goal.w).toBe(32);
    expect(data.goal.h).toBe(64);
    // 算术用 rt.goal（Loader 已解析 w/h，非可选）——底边 y+h 必须恰好贴地面顶面 224。
    expect(rt.goal.y + rt.goal.h).toBe(224);
    expect(rt.goal.x + rt.goal.w).toBeLessThanOrEqual((data.width - 1) * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
  });

  it('E9：bp_a1(tx34,35,36) 列上 y<96 的可收集物 = 0（防 ty4 满跳顶点出画 −25px，反例 X8）', () => {
    const bpTxs = new Set(data.beatPlatforms!.flatMap((b) => b.tiles.map((t) => t.tx)));
    const collectibles = data.entities.filter(
      (e) => e.type === 'coin' || e.type === 'seed' || e.type === 'chestnut',
    );
    const onBpColumns = collectibles.filter((e) => bpTxs.has(Math.floor(e.x / 32)));
    expect(onBpColumns.filter((e) => e.y < 96)).toHaveLength(0);
    // bp 列上共 2 件可收集物：chestnut@1088(tx34, y=200 地面补给) + coin@1120(tx35, y=96 台上)。
    // 台上金币恰为 y=96：body 占 [94,128]，走过即碰到，无需起跳（设计 §4.3 规避 ty4 顶点出画 −25px）。
    expect(onBpColumns.map((e) => `${e.type}@${e.x}:${e.y}`)).toEqual([
      'chestnut@1088:200',
      'coin@1120:96',
    ]);
  });

  it('E10：无两个实体同 (x, y)', () => {
    const keys = data.entities.map((e) => `${e.x},${e.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('E11：地面 ty7/ty8 在 tx0..47 全覆盖无缺口（公平性地板：零坠落死亡、零 soft-lock）', () => {
    for (let tx = 0; tx < 48; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    // 左右墙 ty0..6（去重后与地面并存）。
    expect(rt.world.isSolidTile(0, 0)).toBe(true);
    expect(rt.world.isSolidTile(47, 0)).toBe(true);
    expect(rt.world.isSolidTile(0, 7)).toBe(true);
    // oneway 非 solid。
    for (const [a, b] of ONEWAY_CLUSTERS) {
      for (let tx = a; tx <= b; tx++) {
        expect(rt.world.isOneWayTile(tx, 5)).toBe(true);
        expect(rt.world.isSolidTile(tx, 5)).toBe(false);
      }
    }
  });

  it('E12：每个 checkpoint 距其下游最近压力峰 ≤ 6 格（cp1→2 / cp2→1 / cp3→3，设计 §6）', () => {
    const cpTxs = data.entities.filter((e) => e.type === 'checkpoint').map((e) => e.x / 32);
    expect(cpTxs).toEqual([10, 24, 40]);
    // 设计 §6 逐项点名的压力峰：cp1→chong_feng@384、cp2→P4 起跳台@800、cp3→shi_pao@1376。
    expect((384 - 320) / 32).toBe(2);
    expect((800 - 768) / 32).toBe(1);
    expect((1376 - 1280) / 32).toBe(3);
    // 通用红线：压力峰 = 任一敌人 ∪ 任一 oneway 簇入口；每个 cp 的下游最近峰必须 ≤6 格。
    const enemyTypes = new Set(['ci_li', 'chong_feng', 'du_fu', 'gu_bao', 'shi_pao']);
    const pressureTxs = [
      ...data.entities.filter((e) => enemyTypes.has(e.type)).map((e) => Math.floor(e.x / 32)),
      ...ONEWAY_CLUSTERS.map(([a]) => a),
    ].sort((a, b) => a - b);
    for (const cp of cpTxs) {
      const nearest = pressureTxs.filter((p) => p > cp)[0];
      expect(nearest).toBeDefined();
      expect(nearest - cp).toBeLessThanOrEqual(6);
    }
    // 更严格的对照：只看敌人时距离为 [2,4,3]，同样全部 ≤6。
    const enemyTxs = data.entities
      .filter((e) => enemyTypes.has(e.type))
      .map((e) => Math.floor(e.x / 32))
      .sort((a, b) => a - b);
    expect(cpTxs.map((cp) => enemyTxs.filter((p) => p > cp)[0] - cp)).toEqual([2, 4, 3]);
  });

  it('E13：每个 oneway 簇（ty5=64px）与 bp_a1（ty4=96px）均可从地面单点跳达（≤ 顶点 119px）', () => {
    for (const [a, b] of ONEWAY_CLUSTERS) {
      for (let tx = a; tx <= b; tx++) expect(STANDABLE_TXS.has(tx)).toBe(true);
    }
    expect((7 - 5) * 32).toBe(64);
    expect((7 - 5) * 32).toBeLessThanOrEqual(JUMP_APEX_PX);
    expect((7 - 4) * 32).toBe(96);
    expect((7 - 4) * 32).toBeLessThanOrEqual(JUMP_APEX_PX);
    // 上升跨越 ≤3 格红线：地面 ty7 → bp_a1 ty4 恰为 3 格。
    expect(7 - 4).toBeLessThanOrEqual(3);
  });

  it('E14：gap 序列 [6,3,5,5,7]；可跨 gap ≤ 羽降安全值 5.0；C1/C5 不可跨 gap 下方为全宽地面', () => {
    const gaps = ONEWAY_CLUSTERS.slice(1).map(([start], i) => start - ONEWAY_CLUSTERS[i][1] - 1);
    expect(gaps).toEqual([6, 3, 5, 5, 7]); // C1..C5（Δ 全为 0，两端同为 ty5 顶面 160）
    // C2/C3/C4 为设计路径：全部 ≤ 5.0（Δ=0 的羽降安全值）。
    expect([gaps[1], gaps[2], gaps[3]].every((g) => g <= GLIDE_SAFE_TILES)).toBe(true);
    // C1(6) / C5(7) > 5 → 刻意不可跨（非路径）。反例 X9：严禁把 C3/C4 放宽到 6 格。
    expect(gaps[0]).toBeGreaterThan(GLIDE_SAFE_TILES);
    expect(gaps[4]).toBeGreaterThan(GLIDE_SAFE_TILES);
    // 零坠落死亡：不可跨 gap 正下方必须是全宽地面（掉下去只是走慢路，不死、不 soft-lock）。
    const impassable: Array<[number, number]> = [
      [ONEWAY_CLUSTERS[0][1] + 1, ONEWAY_CLUSTERS[1][0] - 1], // C1: tx7..12
      [ONEWAY_CLUSTERS[4][1] + 1, ONEWAY_CLUSTERS[5][0] - 1], // C5: tx34..40
    ];
    for (const [from, to] of impassable) {
      for (let tx = from; tx <= to; tx++) {
        expect(rt.world.isSolidTile(tx, 7)).toBe(true);
        expect(rt.world.isSolidTile(tx, 8)).toBe(true);
      }
    }
  });

  it('beat 配置：enabled / bpm=120 / grid=8 / 单 track target=bp_a1 pattern=SSGG（opener 不加相位难度）', () => {
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toHaveLength(1);
    expect(data.beat.tracks[0].target).toBe('bp_a1');
    expect(data.beat.tracks[0].pattern).toBe('SSGG');
    // track.target 必须能解析到实际平台（否则加载期 fail-fast）。
    const ids = new Set(data.beatPlatforms!.map((b) => b.id));
    for (const tr of data.beat.tracks) expect(ids.has(tr.target)).toBe(true);
  });

  it('出生点 spawn = (64, 190)；顶层 props / checkpoints 空数组（检查点以 entities 表达，沿用 2-1..3-6 写法）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });
});

describe('biome 接线（grass 复用：叙事「回响」回到 1-1 的视觉原点，0 新增 hex）', () => {
  it('⚠️ theme="grass" 为 THEME_PALETTES **注册命中**而非静默回退；与 1-1 完全同色、≠ zenith', () => {
    const data = levels['4-1'];
    expect(data.metadata.theme).toBe('grass');
    // ⚠️ 关键：resolveBiome 对未注册 theme 会**静默回退 grass**，而本关目标恰是 grass
    //    → 单看返回值无法区分「命中」与「回退」。故显式断言 'grass' 是注册表里真实存在的键，
    //      从而证明 resolveBiome 走的是 `THEME_PALETTES[theme]` 命中分支，而非 fallback 分支。
    expect(Object.prototype.hasOwnProperty.call(THEME_PALETTES, 'grass')).toBe(true);
    const pal = biomeForLevel(data);
    expect(pal).toBe(THEME_PALETTES.grass); // 同一对象引用 = 注册命中
    // legacy 草原调色板既有值（设计 §0.10：不修改、不 reconcile）。
    expect(pal.bg).toBeNull(); // 草原关不绘背景层
    expect(pal.rockFace).toBe(0x3a2a1f);
    // 设计 §1.2：4-1 与 1-1 视觉完全一致 —— 这本身就是那句没说出口的台词。
    expect(pal).toEqual(biomeForLevel(levels['1-1']));
    // 且明确不是第三章终章的 zenith（章末爆发 → 章首回落）。
    expect(pal).not.toEqual(biomeForLevel(levels['3-6']));
  });
});

describe('nextLevelId 进度链（4-1 当前末关 → null）', () => {
  it('LEVEL_ORDER 末关 4-1；nextLevelId("3-6")==="4-1"，("4-1")===null', () => {
    expect(LEVEL_ORDER).toContain('4-1');
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('4-1');
    expect(LEVEL_ORDER.indexOf('3-6')).toBeLessThan(LEVEL_ORDER.indexOf('4-1'));
    expect(nextLevelId(LEVEL_ORDER, '3-6')).toBe('4-1');
    // 当前末关 → 结算页对 4-1 隐藏「下一关」。
    expect(nextLevelId(LEVEL_ORDER, '4-1')).toBeNull();
  });
});
