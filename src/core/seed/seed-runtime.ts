/**
 * core/seed/seed-runtime — 种子蜕变运行时纯函数（GDD 12 §3.1 / §5.3）。
 *
 * 零 Phaser / 零平台 API（core 铁律）。所有累积逻辑集中此处，game-scene 仅做委托。
 */
import type { SeedRuntimeState, Stage } from './seed-types';
import { SEED_CONFIG } from './seed-config';

/**
 * 由 maturity 推导阶段（对齐 art §1.3 computeGrowth 阈值）：
 *   m < 0.25 → sprout(苗)
 *   0.25 ≤ m < 0.5 → vine(藤)
 *   0.5 ≤ m < 0.75 → bloom(花)
 *   m ≥ 0.75 → fruit(果)
 * thresholds 默认取 SEED_CONFIG.stageThresholds，可注入以支持 meta/hybrid（Could）。
 */
export function stageFromMaturity(
  m: number,
  thresholds: readonly number[] = SEED_CONFIG.stageThresholds,
): Stage {
  const [t1, t2, t3] = thresholds;
  if (m < t1) return 'sprout';
  if (m < t2) return 'vine';
  if (m < t3) return 'bloom';
  return 'fruit';
}

/** 创建一局全新的种子运行时（growthPct=0 → stage=sprout，保证本局即时反馈，GDD 12 §3.1）。 */
export function createSeedRuntime(): SeedRuntimeState {
  return { growthPct: 0, stage: 'sprout', collectedThisRun: 0 };
}

/**
 * 采集一颗种子后累积生长（GDD 12 §3.1）。
 * 原地修改 `run` 并返回本次变化：
 *   - collectedThisRun++
 *   - growthPct = min(growthCap, growthPct + growthPerSeed)
 *   - newStage = stageFromMaturity(growthPct)
 *   - stageChanged = newStage !== run.stage（跨阈值标记，供 METAMORPHOSIS 判定）
 *   - run.stage = newStage
 */
export function accumulateOnCollect(
  run: SeedRuntimeState,
  cfg = SEED_CONFIG,
): { growthPct: number; stage: Stage; stageChanged: boolean } {
  run.collectedThisRun += 1;
  run.growthPct = Math.min(cfg.growthCap, run.growthPct + cfg.growthPerSeed);
  const newStage = stageFromMaturity(run.growthPct, cfg.stageThresholds);
  const stageChanged = newStage !== run.stage;
  run.stage = newStage;
  return { growthPct: run.growthPct, stage: newStage, stageChanged };
}
