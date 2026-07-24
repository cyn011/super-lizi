/**
 * tests/integration/seed-metamorphosis.test.ts — QA B4 种子蜕变端到端（headless）。
 *
 * 直驱 core 纯函数（seed-runtime）+ 事件总线，复刻 game-scene 的 ON_SEED_COLLECTED 处理契约：
 *   采集 → accumulateOnCollect → 必发 ON_SEED_GROWTH；仅 stage 跨阈值再发 ON_SEED_METAMORPHOSIS。
 * 验证：
 *   1) 连采 4 颗 → growthPct 阶梯 0.25 / 0.5 / 0.75 / 1.0；
 *   2) stage 推导 sprout→vine→bloom→fruit（每次采集后 stage 值）；
 *   3) ON_SEED_GROWTH 每次都发（4 次）；ON_SEED_METAMORPHOSIS 仅跨阈值发（3 次：第 1/2/3 次采集）；
 *   4) topper stage（currentSeedStage）在 METAMORPHOSIS 时更新，最终跟随到 fruit；
 *   5) 跨关 saveSeedResult 落盘：seedMeta.totalCollected/maturity/currentStage/unlockedStages 持久化一致（重载后保持）。
 * 零 Phaser / 零平台 API（core 零平台铁律）。
 */
import { describe, it, expect } from 'vitest';
import {
  EventBus,
  ON_SEED_COLLECTED,
  ON_SEED_GROWTH,
  ON_SEED_METAMORPHOSIS,
} from '../../src/core/events/event-bus';
import { createSeedRuntime, accumulateOnCollect } from '../../src/core/seed/seed-runtime';
import type { Stage } from '../../src/core/seed/seed-types';
import { SaveManager, type StoragePort } from '../../src/core/meta/save-data';

/** 内存 StoragePort（测试用，零平台 API）。 */
class MockStorage implements StoragePort {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}

interface GrowthPayload {
  growthPct: number;
  stage: Stage;
}

describe('B4 种子蜕变端到端（headless）', () => {
  it('连采 4 颗：growthPct 阶梯 / stage 推导 / 事件次数 / topper 跟随 / 跨关持久化', () => {
    const bus = new EventBus();
    // 复刻 game-scene ON_SEED_COLLECTED 处理契约（事件驱动，与 game-scene 同构）
    const run = createSeedRuntime();
    bus.on(ON_SEED_COLLECTED, () => {
      const res = accumulateOnCollect(run);
      bus.emit(ON_SEED_GROWTH, { growthPct: res.growthPct, stage: res.stage });
      if (res.stageChanged) bus.emit(ON_SEED_METAMORPHOSIS, res.stage);
    });

    const growthPctSeen: number[] = [];
    const stagesSeen: Stage[] = [];
    let growthCount = 0;
    let metamorphCount = 0;
    let currentSeedStage: Stage = 'sprout';

    bus.on(ON_SEED_GROWTH, (p) => {
      growthCount++;
      const { growthPct, stage } = p as GrowthPayload;
      growthPctSeen.push(growthPct);
      stagesSeen.push(stage);
    });
    bus.on(ON_SEED_METAMORPHOSIS, (stage) => {
      metamorphCount++;
      currentSeedStage = stage as Stage;
    });

    // 采集 4 颗
    for (let i = 0; i < 4; i++) bus.emit(ON_SEED_COLLECTED, `seed-${i}`);

    // 1) growthPct 阶梯 0.25 / 0.5 / 0.75 / 1.0（4 颗满蜕变，seed-config growthPerSeed=0.25）
    expect(growthPctSeen).toEqual([0.25, 0.5, 0.75, 1.0]);
    // 2) stage 推导：sprout(初)→vine(0.25)→bloom(0.5)→fruit(0.75)；第 4 颗仍 fruit（封顶 1.0 未跨阈值）
    expect(stagesSeen).toEqual(['vine', 'bloom', 'fruit', 'fruit']);
    expect(run.stage).toBe('fruit');
    expect(run.growthPct).toBe(1.0);
    expect(run.collectedThisRun).toBe(4);

    // 3) 事件次数：GROWTH 每次都发（4）；METAMORPHOSIS 仅跨阈值（3：第 1/2/3 次采集）
    expect(growthCount).toBe(4);
    expect(metamorphCount).toBe(3);

    // 4) topper stage 跟随到 fruit（末次 METAMORPHOSIS 为 fruit）
    expect(currentSeedStage).toBe('fruit');

    // 5) 跨关 saveSeedResult 持久化（同 storage 重载后保持一致）
    const storage = new MockStorage();
    const sm = new SaveManager(storage);
    sm.saveSeedResult(run);
    const reloaded = new SaveManager(storage).load().seedMeta;
    expect(reloaded.totalCollected).toBe(4);
    expect(reloaded.maturity).toBe(1.0);
    expect(reloaded.currentStage).toBe('fruit');
    expect(reloaded.unlockedStages).toContain('sprout');
    expect(reloaded.unlockedStages).toContain('fruit');
  });

  it('阈值边界：恰好跨阈值时 METAMORPHOSIS 才发（0.25→vine 触发，<0.25 不触发）', () => {
    const bus = new EventBus();
    const run = createSeedRuntime(); // growthPct=0 → sprout
    let metamorph = 0;
    bus.on(ON_SEED_METAMORPHOSIS, () => {
      metamorph++;
    });
    bus.on(ON_SEED_COLLECTED, () => {
      const res = accumulateOnCollect(run);
      bus.emit(ON_SEED_GROWTH, { growthPct: res.growthPct, stage: res.stage });
      if (res.stageChanged) bus.emit(ON_SEED_METAMORPHOSIS, res.stage);
    });

    // 采 1 颗：growthPct=0.25 → vine（跨阈值，触发 1 次）
    bus.emit(ON_SEED_COLLECTED, 's1');
    expect(run.stage).toBe('vine');
    expect(metamorph).toBe(1);
  });
});
