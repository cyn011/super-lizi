/**
 * core/seed/seed-config — 种子蜕变可调参数（GDD 12 §3.3，对齐 art §1.3 阈值）。
 *
 * 集中可调，零硬编码；core 零平台铁律。
 * 命名/数值对齐 GDD 12 §3.3 与 §6（seed-config.json 的 TS 落地）。
 */
export const SEED_CONFIG = {
  /** 每颗种子贡献的成长比例；4 颗满蜕变（苗→藤→花→果，对应 4 个 0.25 区间）。 */
  growthPerSeed: 0.25,
  /** growthPct 封顶，避免无限刷（GDD 12 §8 R2）。 */
  growthCap: 1.0,
  /** maturity 来源：MVP 默认 run-buff 驱动（'meta'/'hybrid' 为 Could 扩展）。 */
  source: 'run',
  /** 阶段阈值（对齐 art §1.3）：<0.25 苗 / 0.25≤m<0.5 藤 / 0.5≤m<0.75 花 / m≥0.75 果。 */
  stageThresholds: [0.25, 0.5, 0.75],
  /** 关卡实体类型名（GDD 12 §5.4）。 */
  seedEntityType: 'seed',
  /** Could：true 时 totalCollected 解锁 stage 上限（MVP 关闭，GDD 12 §3.3）。 */
  metaGatingEnabled: false,
} as const;
