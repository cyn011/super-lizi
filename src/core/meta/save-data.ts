/**
 * core/meta/save-data — 元循环 / 存档模型（GDD 11，E1.S3 骨架 + S05-3 扩展）。
 *
 * 仅定义模型、跨层结果类型与 StoragePort 接口；具体读写经 platform.storage 注入
 * （铁律：core 不直连存储实现、core 不依赖 ui）。
 *
 * S05-3 变更：
 *   - SaveData 增加 `version`（迁移基线）、`ranks`（原 `stars`，EL-STAR-FIX 后 G5 一致性）、`bestCoins`；
 *   - `RankResult` 由 ui/result-screen 上移至本文件（core 不依赖 ui 的铁律收口）；
 *   - SaveManager 增加 `recordClear`（通关落盘最优成绩 + 解锁下一关）与版本化 `load` 迁移。
 */
import { type SeedMeta, type SeedRuntimeState, type Stage, STAGE_ORDER, maxStage } from '../seed/seed-types';

export interface SaveData {
  /** 存档格式版本（S05-3 引入，默认 1，供未来迁移）。 */
  version: number;
  /** 已解锁关卡 id 列表（首关 1-1 默认解锁）。 */
  unlockedLevels: string[];
  /** 各关最优评级（1–3，取历史最大）。键=关卡 id。EL-STAR-FIX 后由 `stars`→`ranks`（G5 一致性）。 */
  ranks: Record<string, number>;
  /** 各关最优用时（ms，取历史最小=最快）。键=关卡 id。 */
  bestTimes: Record<string, number>;
  /** 各关最优金币数（取历史最大）。键=关卡 id。S05-3 新增。 */
  bestCoins: Record<string, number>;
  /** 种子蜕变全局状态（GDD 12 §3.6，MVP 必做）：跨关累计采集 / 成熟度 / 已解锁阶段。 */
  seedMeta: SeedMeta;
}

/** 存储端口：由 platform 层实现（Web / 微信端存储）。 */
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** 默认种子蜕变存档（GDD 12 §3.6）：仅 sprout 解锁，计数/成熟度为 0。 */
export function defaultSeedMeta(): SeedMeta {
  return { totalCollected: 0, maturity: 0, unlockedStages: ['sprout'], currentStage: 'sprout' };
}

export function defaultSaveData(): SaveData {
  return {
    version: 1,
    unlockedLevels: ['1-1'],
    ranks: {},
    bestTimes: {},
    bestCoins: {},
    seedMeta: defaultSeedMeta(),
  };
}

/**
 * 单关通关结算结果（供 UI 展示 + 存档落盘）。
 * S05-3 从 ui/result-screen 上移至 core：保持 core 不依赖 ui 的铁律，
 * 使 SaveManager 可直接消费而无需反向引用 UI 层。
 */
export interface RankResult {
  /** 最终评级 1..3（完成至少 1 评级）。 */
  ranks: number;
  /** 时间维度是否达标（≤parTime）。 */
  timeMet: boolean;
  /** 金币维度是否达标（收集率 ≥ RANK_COIN_COLLECT_RATE）。 */
  coinMet: boolean;
  /** 金币收集率 0..1。 */
  coinRate: number;
  /** 本次通关用时（ms），供存档 bestTimes。 */
  elapsedMs: number;
  /** 本次拾取金币数，供存档 bestCoins。 */
  collectedCoins: number;
}

const SAVE_VERSION = 1;

export class SaveManager {
  constructor(
    private readonly storage: StoragePort,
    private readonly key = 'super-mali-save',
    /**
     * 静态关卡顺序（可选）：通关后据其推导并解锁 nextLevel。
     * 留空（默认）则仅记录成绩，不解锁下一关——真实关卡注册表由后续进度 Story 注入。
     */
    private readonly levelOrder: readonly string[] = [],
  ) {}

  /**
   * 读取存档（S05-3 版本化）：
   *   - 空 storage → 默认存档；
   *   - 损坏 JSON → 回退默认；
   *   - 旧档（无 version 或 version<1，含 `stars`）→ 映射 stars→ranks 并置 version=1。
   */
  load(): SaveData {
    const raw = this.storage.get(this.key);
    if (!raw) return defaultSaveData();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return defaultSaveData(); // 损坏 JSON 回退默认
    }
    return this.migrate(parsed);
  }

  save(data: SaveData): void {
    this.storage.set(this.key, JSON.stringify(data));
  }

  /**
   * 记录一次通关成绩并落盘（S05-3）。
   *   - 各指标取历史最优：ranks/bestCoins 取大；bestTimes 取小（最快=最优，与"最佳用时"语义一致）。
   *   - 通关即解锁下一关：若 levelOrder 可推导 nextLevel，则加入 unlockedLevels（去重）。
   *     无法推导（levelOrder 未注入 / 当前关为末关）则仅记录成绩（ranks≥1 即标记已通关）。
   */
  recordClear(levelId: string, result: RankResult): void {
    const data = this.load();

    data.ranks[levelId] = Math.max(data.ranks[levelId] ?? 0, result.ranks);

    const prevTime: number | undefined = data.bestTimes[levelId];
    data.bestTimes[levelId] =
      prevTime === undefined ? result.elapsedMs : Math.min(prevTime, result.elapsedMs);

    const prevCoins: number | undefined = data.bestCoins[levelId];
    data.bestCoins[levelId] =
      prevCoins === undefined ? result.collectedCoins : Math.max(prevCoins, result.collectedCoins);

    const idx = this.levelOrder.indexOf(levelId);
    if (idx >= 0 && idx + 1 < this.levelOrder.length) {
      const next = this.levelOrder[idx + 1];
      if (!data.unlockedLevels.includes(next)) data.unlockedLevels.push(next);
    }

    this.save(data);
  }

  /**
   * 记录一局种子蜕变结果并落盘（GDD 12 §3.6 / §5.3）。
   * 合并入 seedMeta：
   *   - totalCollected += run.collectedThisRun
   *   - maturity = max(maturity, run.growthPct)
   *   - currentStage = maxStage(currentStage, run.stage)
   *   - unlockedStages = ∪(unlockedStages, [run.stage])
   * 用现成存储写回（仿 recordClear：load → 合并 → save）。
   */
  saveSeedResult(run: SeedRuntimeState): void {
    const data = this.load();
    const meta = data.seedMeta;
    meta.totalCollected += run.collectedThisRun;
    meta.maturity = Math.max(meta.maturity, run.growthPct);
    meta.currentStage = maxStage(meta.currentStage, run.stage);
    const set = new Set<Stage>(meta.unlockedStages);
    set.add(run.stage);
    meta.unlockedStages = [...set];
    this.save(data);
  }

  // ── 版本化迁移 ──
  private migrate(raw: unknown): SaveData {
    if (!raw || typeof raw !== 'object') return defaultSaveData();
    const o = raw as Record<string, unknown>;

    const hasVersion = typeof o.version === 'number';
    const isLegacy = !hasVersion || (o.version as number) < SAVE_VERSION;

    if (isLegacy) {
      // 旧档：stars → ranks（EL-STAR-FIX 命名对齐），其余字段缺省补全
      const stars = isRecordOfNumber(o.stars) ? (o.stars as Record<string, number>) : {};
      const ranks: Record<string, number> = {};
      for (const k of Object.keys(stars)) ranks[k] = stars[k];
      return {
        version: SAVE_VERSION,
        unlockedLevels: Array.isArray(o.unlockedLevels)
          ? (o.unlockedLevels as string[])
          : defaultSaveData().unlockedLevels,
        ranks,
        bestTimes: isRecordOfNumber(o.bestTimes) ? (o.bestTimes as Record<string, number>) : {},
        bestCoins: isRecordOfNumber(o.bestCoins) ? (o.bestCoins as Record<string, number>) : {},
        seedMeta: defaultSeedMeta(), // 旧档无 seedMeta → 默认（GDD 12 §3.6 向后兼容）
      };
    }

    // 当前版本：缺字段以默认补全，保证类型完整（向后兼容未来新增字段）
    const d = o as Partial<SaveData>;
    return {
      version: SAVE_VERSION,
      unlockedLevels: Array.isArray(d.unlockedLevels)
        ? (d.unlockedLevels as string[])
        : defaultSaveData().unlockedLevels,
      ranks: isRecordOfNumber(d.ranks) ? (d.ranks as Record<string, number>) : {},
      bestTimes: isRecordOfNumber(d.bestTimes) ? (d.bestTimes as Record<string, number>) : {},
      bestCoins: isRecordOfNumber(d.bestCoins) ? (d.bestCoins as Record<string, number>) : {},
      seedMeta: normalizeSeedMeta(d.seedMeta), // 缺/非法 seedMeta → 默认（GDD 12 §3.6 向后兼容）
    };
  }
}

/** 运行期窄化：判断未知值是否为 `Record<string, number>`（非数组对象）。 */
function isRecordOfNumber(v: unknown): v is Record<string, number> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 运行期窄化：判断未知值是否为合法 SeedMeta。 */
function isSeedMeta(v: unknown): v is SeedMeta {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.totalCollected === 'number' &&
    typeof o.maturity === 'number' &&
    Array.isArray(o.unlockedStages) &&
    typeof o.currentStage === 'string'
  );
}

/**
 * 规整 seedMeta：非法/缺字段 → 默认；合法则清洗阶段枚举（剔除非法 stage）+ 保证含 sprout
 * （GDD 12 §3.6 向后兼容：老存档 / 跨版本字段缺失不崩）。
 */
function normalizeSeedMeta(v: unknown): SeedMeta {
  if (isSeedMeta(v)) {
    const valid = (v.unlockedStages as unknown[]).filter((s): s is Stage =>
      STAGE_ORDER.includes(s as Stage),
    );
    const cur = STAGE_ORDER.includes(v.currentStage as Stage) ? (v.currentStage as Stage) : 'sprout';
    if (!valid.includes('sprout')) valid.push('sprout');
    return { totalCollected: v.totalCollected, maturity: v.maturity, unlockedStages: valid, currentStage: cur };
  }
  return defaultSeedMeta();
}
