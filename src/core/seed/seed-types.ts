/**
 * core/seed/seed-types — 种子蜕变系统共享契约（GDD 12 §3.2）。
 *
 * 纯类型 + 阶段契约，零 Phaser / 零平台依赖（core 铁律）。
 *
 * 4 阶段权威枚举（对齐 art §1.3 computeGrowth 的 stage:0|1|2|3）：
 *   苗=sprout(0) 藤=vine(1) 花=bloom(2) 果=fruit(3)
 * GDD 12 附录 A 已裁决此四阶段取代 ux §6.3 三阶段提案。
 */

/** 蜕变阶段（美术权威四阶段）。索引越大越成熟。 */
export type Stage = 'sprout' | 'vine' | 'bloom' | 'fruit';

/** 单一种子类型的进度（局内 / 图鉴，GDD 12 §3.2）。 */
export interface SeedProgress {
  seedId: string;
  collectedCount: number;
  stage: Stage;
  growthPct: number;
}

/** 全局蜕变状态（持久化到 SaveData，GDD 12 §3.6）。 */
export interface SeedMeta {
  totalCollected: number;
  maturity: number;
  unlockedStages: Stage[];
  currentStage: Stage;
}

/** 运行时状态（每局重置，不持久化，GDD 12 §3.1/§3.6）。 */
export interface SeedRuntimeState {
  growthPct: number;
  stage: Stage;
  collectedThisRun: number;
}

/**
 * 阶段有序列表（sprout→vine→bloom→fruit），用于 maxStage 比较与持久化写回。
 * 顺序即「成熟度」升序；索引越大越成熟。
 */
export const STAGE_ORDER: readonly Stage[] = ['sprout', 'vine', 'bloom', 'fruit'];

/** 取两阶段中更成熟者（按 STAGE_ORDER 索引，越大越成熟）。 */
export function maxStage(a: Stage, b: Stage): Stage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b;
}
