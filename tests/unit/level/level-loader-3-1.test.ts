/**
 * tests/unit/level/level-loader-3-1.test.ts — 3-1 浮空初息关（星界 astral opener + 新机制羽降 glide）
 * 加载验证（core 纯逻辑）。结构照 level-loader-2-6.test.ts。
 *
 * 覆盖：注册表含 3-1、validateLevelData 通过、metadata.theme='astral'/name='浮空初息'/parTimeMs=88000、
 * goal x+w<width*ts 且 type='triumph_gate'、敌种组合（gu_bao×3 + ci_li×3 + du_fu×3 + shi_pao×2 = 11）、
 * 实体分桶（coin×12 / seed×5 / checkpoint×3）、敌人 y 契约、tile 去重 + oneway 浮岛 fi0..fi6、出生点、
 * beat 启用 + beatPlatforms 单簇 tiles 全 ty=4（红线：严禁 ty5）、
 * **mechanics.glide === true（本关唯一 Schema 新增字段）** 且旧关缺省 = 关闭（零回归）、
 * 云海地面 ty7,8 全宽实心（公平性地板：零坠落死亡、零 soft-lock）、
 * nextLevelId 进度链（3-1 → 3-2 → 3-3；末关断言已随批 A 迁至 level-loader-3-3.test.ts）、
 * biome 接线（astral 明度翻面）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { resolveBiome, biomeForLevel } from '../../../src/game/render/theme-palette';

describe('3-1 浮空初息关加载（注册表 + Loader）', () => {
  const data = levels['3-1'];
  const rt = LevelLoader.load(data);

  it('注册表含 3-1 且通过 validateLevelData；width=46 / height=9', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('3-1');
    expect(data.width).toBe(46);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "astral"（星界调色板）、name="浮空初息"、parTimeMs=88000', () => {
    expect(data.metadata.theme).toBe('astral');
    expect(data.metadata.name).toBe('浮空初息');
    expect(data.metadata.parTimeMs).toBe(88000);
  });

  it('mechanics.glide === true（Ch3 新机制羽降开关）；旧关缺省 = 关闭（加法扩展，13 关零回归）', () => {
    expect(data.mechanics?.glide).toBe(true);
    // 向后兼容红线：旧 13 关无 mechanics 字段 → 羽降关闭，行为完全不变。
    expect(levels['2-6'].mechanics).toBeUndefined();
    expect(levels['1-1'].mechanics).toBeUndefined();
  });

  it('goal x + w < width*ts（1440 < 1472），终点可达且 type=triumph_gate', () => {
    expect(rt.goal.x + rt.goal.w).toBeLessThan(data.width * data.tileSize);
    expect(rt.goal.x + rt.goal.w).toBe(1440);
    expect(data.goal.type).toBe('triumph_gate');
    expect(data.goal.y).toBe(160);
  });

  it('敌种组合 = gu_bao×3 + ci_li×3 + du_fu×3 + shi_pao×2 = 11（opener 降压，低于 2-6 的 16）', () => {
    expect(rt.enemies).toHaveLength(11);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(3);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(3);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(2);
  });

  it('敌人 y 契约恒定（gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100），零例外', () => {
    const yByType: Record<string, number> = {
      gu_bao: 224,
      ci_li: 200,
      du_fu: 120,
      shi_pao: 100,
    };
    // 直接校验 JSON 数据源（EnemyAI 运行期 y 会随 AI 更新，契约锚在关卡数据上）。
    for (const e of data.entities) {
      const expected = yByType[e.type];
      if (expected !== undefined) expect(e.y).toBe(expected);
    }
  });

  it('实体分桶：coin×12 / seed×5（seed_01..seed_05）/ checkpoint×3', () => {
    expect(rt.coins).toHaveLength(12);
    expect(rt.seeds).toHaveLength(5);
    expect(rt.seeds[0].seedId).toBe('seed_01');
    expect(rt.seeds[4].seedId).toBe('seed_05');
    // 公平性：seed_02/03/04 全在云海地面主路（y=200），不会羽降也能拿到 3 颗（0.75 蜕变进度）。
    expect(rt.seeds[1].y).toBe(200);
    expect(rt.seeds[2].y).toBe(200);
    expect(rt.seeds[3].y).toBe(200);
    expect(rt.checkpoints).toHaveLength(3);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([512, 800, 1088]);
    // gu_bao 携带 phaseOffset（错相位契约，对齐 2-1/2-6）—— 校验 JSON 数据源
    const guBaoOffsets = data.entities
      .filter((e) => e.type === 'gu_bao')
      .map((e) => (e as unknown as { params?: { phaseOffset?: number } }).params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 530, 265]);
  });

  it('S1 教学装置：四连金币 45° 下降弧 (352,112)→(384,136)→(416,160)→(448,184)，斜率匹配羽降轨迹', () => {
    const arc = rt.coins.filter((c) => c.x >= 352 && c.x <= 448).sort((a, b) => a.x - b.x);
    expect(arc.map((c) => [c.x, c.y])).toEqual([
      [352, 112],
      [384, 136],
      [416, 160],
      [448, 184],
    ]);
  });

  it('tile 去重（grid 幂等）：云海地面 ty7-8 全宽实心、墙 col0/col45 实心、oneway 浮岛 fi0..fi6', () => {
    // 公平性地板：云海地面全宽实心恒存在 → 零坠落死亡、零 soft-lock。
    for (let tx = 0; tx < 46; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(45, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    // 浮岛全部为 oneway（复用既有 kind，0 新增）
    const islands: Array<[number[], number]> = [
      [[4, 5], 5], // fi0 阶梯岛
      [[8, 9, 10], 3], // fi1 高栖岛（载 seed_01）
      [[16, 17], 5], // fi2 岛链起
      [[23, 24], 5], // fi3 岛链终（fi2→fi3 = 5 格 gap，必需羽降）
      [[28, 29], 4], // fi4 抬升岛
      [[34, 35], 4], // fi5 走廊岛
      [[42, 43], 5], // fi6 门前岛（载 seed_05）
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
    expect(data.beat.tracks[0].target).toBe('bp_a1');
    expect(data.beat.tracks[0].pattern).toBe('SSGG');
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(1); // opener 仅 1 簇（2-6 为 2 簇，刻意降认知负载）
    expect(bps[0].id).toBe('bp_a1');
    expect(bps[0].initial).toBe('ghost');
    for (const bp of bps) {
      for (const t of bp.tiles) {
        expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
      }
    }
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([38, 39, 40]);
  });

  it('顶层 props / checkpoints 为空数组（检查点以 entities 表达，沿用 2-1/2-4/2-5/2-6 写法）', () => {
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });
});

describe('nextLevelId 进度链（3-1 之后续接 3-2 / 3-3，末关为 3-3）', () => {
  it('LEVEL_ORDER 中 2-6 → 3-1 → 3-2 → 3-3；nextLevelId("2-6") === "3-1"，("3-1") === "3-2"', () => {
    expect(LEVEL_ORDER).toContain('3-1');
    expect(LEVEL_ORDER.indexOf('2-6')).toBeLessThan(LEVEL_ORDER.indexOf('3-1'));
    expect(LEVEL_ORDER.indexOf('3-1')).toBeLessThan(LEVEL_ORDER.indexOf('3-2'));
    // 末关已由 3-1 顺延至 3-3（批 A：3-2《星隙长渡》+ 3-3《鸣星回阶》落地）。
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('3-3');
    expect(nextLevelId(LEVEL_ORDER, '2-6')).toBe('3-1');
    expect(nextLevelId(LEVEL_ORDER, '3-1')).toBe('3-2');
    expect(nextLevelId(LEVEL_ORDER, '3-3')).toBeNull();
  });
});

describe('biome 解析器（theme → theme-palette，3-1 星界调色板，锁色板内 0 新增色）', () => {
  it('astral → 星白浮岩 rockFace #BEC4F9（全 biome 唯一亮地面）、墨蓝星空 bg #1F2244（全 biome 最暗天）', () => {
    const pal = resolveBiome('astral');
    expect(pal.rockFace).toBe(0xbec4f9); // 星白浮岩（lighten(#6E7BF2,0.55) tint，签名色）
    expect(pal.rockBody).toBe(0x6e7bf2); // 蓝紫本色（浮岩暗面 / oneway / 顶缘暗边）
    expect(pal.bg).toBe(0x1f2244); // 墨蓝星空（darken(#6E7BF2,0.72) tint）
    expect(pal.outline).toBe(0x2a1a12); // 描边
    expect(pal.firelight).toBe(0xffd23f); // 星屑暖黄（暗天里唯一暖色）
    expect(pal.crystalCore).toBe(0x5bc8f5); // 星辉青（星核高光 / 星门核心）
    expect(pal.crystalGlow).toBe(0x5bc8f5); // 星辉青（星云辉光，与 crystalCore 同源有意复用）
    expect(pal.danger).toBe(0xe8483b); // 警示红
    // 不为草原（fail-safe 回退）兜底：astral 已注册，返回专属调色板
    expect(pal.rockFace).not.toBe(0x3a2a1f);
    // 明度翻面红线：地比天亮（astral 是全 biome 唯一高明度地面）
    expect(pal.rockFace).toBeGreaterThan(pal.bg as number);
  });

  it('biomeForLevel(3-1) = astral palette（rockFace 星白浮岩 #BEC4F9 / bg 墨蓝星空 #1F2244）', () => {
    expect(biomeForLevel(levels['3-1']).rockFace).toBe(0xbec4f9);
    expect(biomeForLevel(levels['3-1']).bg).toBe(0x1f2244);
  });
});
