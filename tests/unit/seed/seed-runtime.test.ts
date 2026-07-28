/**
 * tests/unit/seed/seed-runtime.test.ts — GDD 12 种子蜕变运行时（core 零平台可单测）。
 *
 * 覆盖：
 *   - stageFromMaturity 阈值（对齐 art §1.3：[0.25,0.5,0.75]）
 *   - growthPct 封顶 1.0（GDD 12 §3.3 growthCap）
 *   - accumulateOnCollect 的 stageChanged 判定与原地累积
 *   - SaveManager.saveSeedResult 合并 + 缺省/老档向后兼容（§3.6）
 */
import { describe, it, expect } from 'vitest';
import {
  stageFromMaturity,
  createSeedRuntime,
  accumulateOnCollect,
} from '../../../src/core/seed/seed-runtime';
import { SaveManager, type StoragePort } from '../../../src/core/meta/save-data';
import type { SeedRuntimeState } from '../../../src/core/seed/seed-types';

/** 内存 StoragePort 实现（测试用，不触达任何平台存储）。 */
class MockStorage implements StoragePort {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  seedRaw(key: string, raw: string): void {
    this.map.set(key, raw);
  }
}

describe('stageFromMaturity（GDD 12 §3.3 阈值）', () => {
  it('边界：0→sprout, 0.25→vine, 0.5→bloom, 0.75→fruit, 0.99→fruit', () => {
    expect(stageFromMaturity(0)).toBe('sprout');
    expect(stageFromMaturity(0.25)).toBe('vine');
    expect(stageFromMaturity(0.5)).toBe('bloom');
    expect(stageFromMaturity(0.75)).toBe('fruit');
    expect(stageFromMaturity(0.99)).toBe('fruit');
  });

  it('区间内部值正确归类（< 上界归低阶）', () => {
    expect(stageFromMaturity(0.1)).toBe('sprout');
    expect(stageFromMaturity(0.249)).toBe('sprout');
    expect(stageFromMaturity(0.49)).toBe('vine');
    expect(stageFromMaturity(0.74)).toBe('bloom');
    expect(stageFromMaturity(1.0)).toBe('fruit');
    expect(stageFromMaturity(-0.1)).toBe('sprout'); // 负数归最低阶，不崩
  });

  it('可用注入阈值覆盖默认（meta/hybrid Could 扩展点）', () => {
    // 两段阈值示例：<0.5 苗、≥0.5 果
    expect(stageFromMaturity(0.4, [0.5])).toBe('sprout');
    expect(stageFromMaturity(0.6, [0.5])).toBe('fruit');
  });
});

describe('createSeedRuntime（GDD 12 §3.1 本局重置）', () => {
  it('初始 growthPct=0 → stage=sprout、collectedThisRun=0', () => {
    const run = createSeedRuntime();
    expect(run).toEqual({ growthPct: 0, stage: 'sprout', collectedThisRun: 0 });
  });
});

describe('accumulateOnCollect（GDD 12 §3.1 累积 + 封顶 + stageChanged）', () => {
  it('每颗 +0.25，逐次跨阈值 stageChanged=true；封顶 1.0 后不再变', () => {
    const run = createSeedRuntime();
    let r = accumulateOnCollect(run);
    expect(r).toEqual({ growthPct: 0.25, stage: 'vine', stageChanged: true });
    expect(run.collectedThisRun).toBe(1);

    r = accumulateOnCollect(run);
    expect(r).toEqual({ growthPct: 0.5, stage: 'bloom', stageChanged: true });
    expect(run.collectedThisRun).toBe(2);

    r = accumulateOnCollect(run);
    expect(r).toEqual({ growthPct: 0.75, stage: 'fruit', stageChanged: true });
    expect(run.collectedThisRun).toBe(3);

    // 第 4 次：growthPct 封顶 1.0，stage 已是 fruit → stageChanged=false
    r = accumulateOnCollect(run);
    expect(r.growthPct).toBe(1.0);
    expect(r.stage).toBe('fruit');
    expect(r.stageChanged).toBe(false);
    expect(run.collectedThisRun).toBe(4);

    // 第 5 次仍封顶 1.0，不再越界
    r = accumulateOnCollect(run);
    expect(r.growthPct).toBe(1.0);
    expect(r.stageChanged).toBe(false);
    expect(run.collectedThisRun).toBe(5);
  });

  it('原地修改传入对象（不返回新 SeedRuntimeState）', () => {
    const run: SeedRuntimeState = createSeedRuntime();
    const before = run;
    accumulateOnCollect(run);
    expect(run).toBe(before); // 同一引用（原地累积）
    expect(run.growthPct).toBe(0.25);
  });
});

describe('SaveManager.saveSeedResult（GDD 12 §3.6 合并 + 兼容）', () => {
  function buildRun(collects: number): SeedRuntimeState {
    const run = createSeedRuntime();
    for (let i = 0; i < collects; i++) accumulateOnCollect(run);
    return run;
  }

  it('合并入 SeedMeta：totalCollected++、maturity=max、currentStage=maxStage、unlockedStages 并集', () => {
    const m = new SaveManager(new MockStorage());
    const run = buildRun(4); // collectedThisRun=4, growthPct=1.0, stage=fruit
    m.saveSeedResult(run);

    const d = m.load();
    expect(d.seedMeta.totalCollected).toBe(4);
    expect(d.seedMeta.maturity).toBe(1.0);
    expect(d.seedMeta.currentStage).toBe('fruit');
    // 默认 unlockedStages=['sprout'] ∪ [run.stage='fruit']
    expect(d.seedMeta.unlockedStages).toEqual(['sprout', 'fruit']);
  });

  it('二次保存取历史最优合并（不覆盖已有更高 maturity / stage）', () => {
    const s = new MockStorage();
    const m = new SaveManager(s);
    m.saveSeedResult(buildRun(4)); // fruit, maturity 1.0
    m.saveSeedResult(buildRun(0)); // sprout, maturity 0

    const d = m.load();
    expect(d.seedMeta.totalCollected).toBe(4); // 累加
    expect(d.seedMeta.maturity).toBe(1.0); // max 保留
    expect(d.seedMeta.currentStage).toBe('fruit'); // maxStage 保留
  });

  it('缺省存档含 seedMeta 默认值（向后兼容 GDD 12 §3.6）', () => {
    const m = new SaveManager(new MockStorage());
    const d = m.load();
    expect(d.seedMeta).toEqual({
      totalCollected: 0,
      maturity: 0,
      unlockedStages: ['sprout'],
      currentStage: 'sprout',
    });
  });

  it('老档（无 seedMeta）load 后补默认 seedMeta，不崩', () => {
    const s = new MockStorage();
    s.seedRaw(
      'libao-da-maoxian-save',
      JSON.stringify({ version: 1, unlockedLevels: ['1-1'], ranks: {}, bestTimes: {}, bestCoins: {} }),
    );
    const m = new SaveManager(s);
    const d = m.load();
    expect(d.seedMeta).toEqual({
      totalCollected: 0,
      maturity: 0,
      unlockedStages: ['sprout'],
      currentStage: 'sprout',
    });
  });
});
