/**
 * tests/unit/level/level-loader-3-3.test.ts — 3-3 鸣星回阶关（星界 astral · 深化 B：时间轴）
 * 加载验证（core 纯逻辑）。结构照 level-loader-3-1.test.ts / 3-2.test.ts。
 *
 * 覆盖：注册表含 3-3、validateLevelData 通过、metadata.theme='astral'/name='鸣星回阶'/parTimeMs=96000、
 * goal x+w<width*ts 且 type='triumph_gate'、敌种组合（gu_bao×3 + ci_li×3 + du_fu×4 + shi_pao×3 = 13）、
 * 实体分桶（coin×13 / seed×6 / checkpoint×3）、敌人 y 契约、tile 去重 + oneway 上行梯列 st0..st6、出生点、
 * beat 启用 2 簇（= 全章上限）+ 两簇 beatPlatforms tiles 全 ty=4（红线：严禁 ty5）、mechanics.glide === true、
 * 云海地面 ty7,8 全宽实心（公平性地板：零坠落死亡、零 soft-lock）、
 * nextLevelId 进度链（3-3 → 3-4；末关已随批 B 顺延至 3-5）、biome 接线（astral 复用）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { validateLevelData } from '../../../src/core/level/level-data';
import { levels, LEVEL_ORDER } from '../../../src/core/config';
import { nextLevelId } from '../../../src/core/level/level-order';
import { biomeForLevel } from '../../../src/game/render/theme-palette';

describe('3-3 鸣星回阶关加载（注册表 + Loader）', () => {
  const data = levels['3-3'];
  const rt = LevelLoader.load(data);

  it('注册表含 3-3 且通过 validateLevelData；width=50 / height=9', () => {
    expect(data).toBeTruthy();
    expect(data.id).toBe('3-3');
    expect(data.width).toBe(50);
    expect(data.height).toBe(9);
    expect(data.tileSize).toBe(32);
    expect(data.version).toBe(1);
    expect(validateLevelData(data)).toBe(true);
  });

  it('metadata.theme = "astral"（星界调色板复用）、name="鸣星回阶"、parTimeMs=96000', () => {
    expect(data.metadata.theme).toBe('astral');
    expect(data.metadata.name).toBe('鸣星回阶');
    expect(data.metadata.parTimeMs).toBe(96000);
    // 单调递增：96000 > 3-2 的 92000 > 3-1 的 88000（相位等待为不可压缩固定成本）。
    expect(data.metadata.parTimeMs!).toBeGreaterThan(levels['3-2'].metadata.parTimeMs!);
  });

  it('mechanics.glide === true（本关把羽降深化为「相位半拍修正键」）', () => {
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

  it('敌种组合 = gu_bao×3 + ci_li×3 + du_fu×4 + shi_pao×3 = 13（密度 0.260，单调高于 3-2 的 0.250）', () => {
    expect(rt.enemies).toHaveLength(13);
    const types = rt.enemies.map((e) => e.type);
    expect(types.filter((t) => t === 'gu_bao')).toHaveLength(3);
    expect(types.filter((t) => t === 'ci_li')).toHaveLength(3);
    expect(types.filter((t) => t === 'du_fu')).toHaveLength(4);
    expect(types.filter((t) => t === 'shi_pao')).toHaveLength(3);
    expect(rt.enemies.length / data.width).toBeCloseTo(0.26, 3);
    expect(rt.enemies.length / data.width).toBeGreaterThan(
      levels['3-2'].entities.filter((e) =>
        ['gu_bao', 'ci_li', 'du_fu', 'shi_pao'].includes(e.type),
      ).length / levels['3-2'].width,
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

  it('节拍区留白（防认知过载）：S2(tx11..21) / S4(tx33..43) 各仅 1 敌，且均为可踩的 du_fu', () => {
    const inRange = (x: number, txFrom: number, txTo: number) =>
      x >= txFrom * 32 && x <= txTo * 32 + 31;
    const enemyDefs = data.entities.filter((e) =>
      ['gu_bao', 'ci_li', 'du_fu', 'shi_pao'].includes(e.type),
    );
    const s2 = enemyDefs.filter((e) => inRange(e.x, 11, 21));
    const s4 = enemyDefs.filter((e) => inRange(e.x, 33, 43));
    expect(s2).toHaveLength(1);
    expect(s2[0].type).toBe('du_fu');
    expect(s4).toHaveLength(1);
    expect(s4[0].type).toBe('du_fu');
  });

  it('实体分桶：coin×13 / seed×6（seed_01..seed_06）/ checkpoint×3', () => {
    expect(rt.coins).toHaveLength(13);
    expect(rt.seeds).toHaveLength(6);
    expect([...rt.seeds.map((s) => s.seedId)].sort()).toEqual([
      'seed_01',
      'seed_02',
      'seed_03',
      'seed_04',
      'seed_05',
      'seed_06',
    ]);
    // 公平性：seed_01/02/03 三颗全在云海地面主路（y=200）→ 不读相位也能拿 0.75 蜕变（设计稿 §8）。
    const byId = new Map(rt.seeds.map((s) => [s.seedId, s]));
    expect(byId.get('seed_01')!.y).toBe(200);
    expect(byId.get('seed_02')!.y).toBe(200);
    expect(byId.get('seed_03')!.y).toBe(200);
    // 相位路径奖励：seed_04 悬于 bp_c1 上方、seed_05 悬于 bp_c2 上方、seed_06 在梯顶 A（ty3）。
    expect([byId.get('seed_04')!.x, byId.get('seed_04')!.y]).toEqual([416, 112]);
    expect([byId.get('seed_05')!.x, byId.get('seed_05')!.y]).toEqual([1248, 112]);
    expect([byId.get('seed_06')!.x, byId.get('seed_06')!.y]).toEqual([592, 80]);
    expect(rt.checkpoints).toHaveLength(3);
    expect(rt.checkpoints.map((c) => c.x)).toEqual([352, 704, 1088]);
    const guBaoOffsets = data.entities
      .filter((e) => e.type === 'gu_bao')
      .map((e) => (e as unknown as { params?: { phaseOffset?: number } }).params?.phaseOffset ?? 0);
    expect(guBaoOffsets).toEqual([0, 530, 265]);
  });

  it('tile 去重（grid 幂等）：云海地面 ty7-8 全宽实心、墙 col0/col49 实心、oneway 上行梯列 st0..st6', () => {
    for (let tx = 0; tx < 50; tx++) {
      expect(rt.world.isSolidTile(tx, 7)).toBe(true);
      expect(rt.world.isSolidTile(tx, 8)).toBe(true);
    }
    expect(rt.world.isSolidTile(0, 0)).toBe(true); // 左墙
    expect(rt.world.isSolidTile(49, 0)).toBe(true); // 右墙
    expect(rt.world.isSolidTile(0, 7)).toBe(true); // 地面+墙重复声明 → 去重后仍实心
    // 上行梯列全部为 oneway（复用既有 kind，0 新增）：ty5 → ty4 → (beat ty4) → ty3，模式出现两次。
    const islands: Array<[number[], number]> = [
      [[3, 4], 5], // st0 梯列 A 第一级
      [[7, 8], 4], // st1 梯列 A 第二级（P1 起跳台）
      [[18, 19], 3], // st2 梯顶 A（仅经 bp_c1 抵达）
      [[25, 26], 5], // st_a D1 降落落点
      [[27, 28], 5], // st3 梯列 B 基座
      [[32, 33], 4], // st4 梯列 B 第二级（P2 起跳台）
      [[43, 44], 3], // st5 梯顶 B（仅经 bp_c2 抵达）
      [[46, 47], 5], // st6 门前岛
    ];
    for (const [txs, ty] of islands) {
      for (const tx of txs) {
        expect(rt.world.isOneWayTile(tx, ty)).toBe(true);
        expect(rt.world.isSolidTile(tx, ty)).toBe(false); // oneway 非 solid
      }
    }
  });

  it('出生点 spawn = (64, 190)，beat 启用 2 簇（全章上限）且红线校验：两簇 tiles 全 ty=4（严禁 ty5）', () => {
    expect(rt.spawn.x).toBe(64);
    expect(rt.spawn.y).toBe(190);
    expect(data.beat.enabled).toBe(true);
    expect(data.beat.bpm).toBe(120);
    expect(data.beat.grid).toBe(8);
    expect(data.beat.tracks).toHaveLength(2);
    expect(data.beat.tracks.map((t) => t.target)).toEqual(['bp_c1', 'bp_c2']);
    // 两簇同 pattern → 相位记忆可从 3-1/3-2 无损迁移（防过载，主计划 §2.2）。
    expect(data.beat.tracks.every((t) => t.pattern === 'SSGG')).toBe(true);
    expect(data.beatPlatforms).toBeDefined();
    const bps = data.beatPlatforms!;
    expect(bps).toHaveLength(2);
    expect(bps.map((b) => b.id)).toEqual(['bp_c1', 'bp_c2']);
    expect(bps.every((b) => b.initial === 'ghost')).toBe(true);
    for (const bp of bps) {
      for (const t of bp.tiles) {
        expect(t.ty).toBe(4); // 红线：节拍平台必须放站立角色头顶之上
      }
    }
    expect(bps[0].tiles.map((t) => t.tx)).toEqual([12, 13, 14]);
    expect(bps[1].tiles.map((t) => t.tx)).toEqual([38, 39, 40]);
    // track.target 必须能解析到实际平台（否则加载期 fail-fast）。
    const ids = new Set(bps.map((b) => b.id));
    for (const tr of data.beat.tracks) expect(ids.has(tr.target)).toBe(true);
  });

  it('顶层 props / checkpoints 为空数组（检查点以 entities 表达，沿用 2-1..3-2 写法）', () => {
    expect(data.props).toEqual([]);
    expect(data.checkpoints).toEqual([]);
  });
});

describe('nextLevelId 进度链（3-3 续接 3-4；末关已随批 B/C 顺延至 3-6）', () => {
  it('LEVEL_ORDER 末关为 3-6；nextLevelId("3-2") === "3-3"，("3-3") === "3-4"', () => {
    expect(LEVEL_ORDER).toContain('3-3');
    expect(LEVEL_ORDER.indexOf('3-2')).toBeLessThan(LEVEL_ORDER.indexOf('3-3'));
    expect(LEVEL_ORDER.indexOf('3-3')).toBeLessThan(LEVEL_ORDER.indexOf('3-4'));
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('3-6');
    expect(nextLevelId(LEVEL_ORDER, '3-2')).toBe('3-3');
    // 批 B 前 3-3 为末关（null）；3-4《陨雨回廊》/ 3-5《凌霄绝息》/ 3-6《星穹终启》落地后进度链继续。
    expect(nextLevelId(LEVEL_ORDER, '3-3')).toBe('3-4');
    expect(nextLevelId(LEVEL_ORDER, '3-5')).toBe('3-6');
  });
});

describe('biome 接线（3-3 复用 astral 调色板，0 新增 hex）', () => {
  it('biomeForLevel(3-3) = astral palette（与 3-1/3-2 逐槽同源）', () => {
    const pal = biomeForLevel(levels['3-3']);
    expect(pal.rockFace).toBe(0xbec4f9);
    expect(pal.bg).toBe(0x1f2244);
    expect(pal).toEqual(biomeForLevel(levels['3-1']));
  });
});
