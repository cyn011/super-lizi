/**
 * core/level/level-data — 关卡数据类型与校验（GDD 05，E1.S3 骨架）。
 * 数值集中 config/levels/*.json，逻辑层零硬编码。零 Phaser / 零平台依赖。
 */
export interface TileDef {
  tx: number;
  ty: number;
  kind: string;
}

/**
 * 实体联合类型（S04-3 扩展）：敌人（保留 S04-1）/ 金币 / 种子 / 检查点，
 * 均由关卡 JSON `entities[]` 生成。`RuntimeLevel` 按 `type` 过滤分桶。
 * 坐标系与敌人一致：(x,y) = 碰撞/渲染盒左上角（脚底贴地由放置坐标决定）。
 */
export type EntityDef =
  | EnemyEntityDef
  | CoinEntityDef
  | SeedEntityDef
  | CheckpointEntityDef
  | ChestnutEntityDef;

/** S04-1/S04-2 敌人实体 schema（E3.S1/S2）：可由关卡 JSON 生成真实敌人（替代 C3 占位刺栗）。 */
export type EnemyEntityType =
  | 'ci_li'
  | 'du_fu'
  | 'chong_feng'
  | 'shi_pao'
  | 'gu_bao'
  | 'bouncy_vine'
  | 'cyclone'
  | 'du_fu_silhouette';
export interface EnemyEntityDef {
  type: EnemyEntityType;
  x: number;
  y: number;
  /**
   * 每实例覆盖（数值型；向后兼容旧 4 敌）。
   * gu_bao：phaseOffset(ms 初始相位错相) / dormantMs / activeMs / height / width。
   * bouncy_vine：power(弹起速度倍率，normal=1.0 / strong=1.2 / weak=0.8) /
   *              bounceVelocity / width / height / springMs / recoilMs。
   * cyclone：w / h(气柱尺寸) / liftAcc / riseMax / dragX(实例级强度与尺寸覆盖)。
   * 其余敌(ci_li/du_fu/chong_feng/shi_pao)不读此字段。
   */
  params?: Record<string, number>;
}

/** S04-3 金币实体（经济内容源；碰玩家 → ON_COIN，联动 S04-4 经济 +10）。 */
export interface CoinEntityDef {
  type: 'coin';
  x: number;
  y: number;
}

/**
 * S04-3 种子实体（GDD 12 §5.4）：碰玩家 → ON_SEED_COLLECTED(seedId)。
 * 本 Story 仅发事件；maturity 局内累积 / 蜕变视觉（computeGrowth 四阶段）留专项 Story。
 */
export interface SeedEntityDef {
  type: 'seed';
  x: number;
  y: number;
  /** 种子类型 id（如 'seed_common'）；缺省回退 'seed_common'（由拾取解算处理）。 */
  seedId?: string;
}

/** S04-3 检查点实体：碰玩家 → 更新 respawnPoint + ON_CHECKPOINT（GDD 05 Must 重生语义）。 */
export interface CheckpointEntityDef {
  type: 'checkpoint';
  x: number;
  y: number;
}

/** Phase 5 栗子补给实体（GDD 17 §6.2）：碰玩家 → 弹药 +amount（封顶 ammoCap），发 ON_AMMO_CHANGED。不进分数经济。 */
export interface ChestnutEntityDef {
  type: 'chestnut';
  x: number;
  y: number;
  params?: { amount?: number };
}

export interface PropDef {
  type: string;
  x: number;
  y: number;
}

export interface CheckpointDef {
  x: number;
  y: number;
}

/** 出生点（像素坐标，body 左上角；脚底贴地面）。 */
export interface SpawnDef {
  x: number;
  y: number;
}

export interface GoalDef {
  type: string;
  x: number;
  y: number;
  /** 终点 AABB 宽（缺省 32）。 */
  w?: number;
  /** 终点 AABB 高（缺省 64）。 */
  h?: number;
}

/** 节拍相位：平台可踩/可碰撞(solid) vs 虚化/可穿过(ghost)。 */
export type BeatPhase = 'solid' | 'ghost';

/** 节拍平台实体：一块由若干 tile 组成的「节拍平台」，由 tracks[].target 用 id 引用。 */
export interface BeatPlatformDef {
  /** 实例唯一 id；tracks[].target 引用此 id（无匹配 → 加载期 fail-fast）。 */
  id: string;
  /** 组成平台的瓦片坐标（逻辑 tile 网格，tx/ty 为整数）。可多块连成一条平台。 */
  tiles: Array<{ tx: number; ty: number }>;
  /** 第 0 拍之前（未触发任何 track 时）的保底相位；缺省 'ghost'（S05-1 实现口径）。 */
  initial?: BeatPhase;
}

/** 谱面一条目（BeatDef.tracks 的元素）。pattern 周期模式与 (beat+action) 单点模式二选一。 */
export interface BeatTrackEntry {
  /** 目标平台 id（引用 BeatPlatformDef.id）。无匹配 id → 加载期 fail-fast 抛错。 */
  target: string;
  /**
   * 周期模式：状态串，按 `beatIndex % pattern.length` 取字符映射：
   *   'S'=solid，'G'=ghost，'T'=toggle（相对上一拍相位取反，首拍取 initial 的反）。
   * MVP 仅用 S/G；T 留 Could 表现。非法字符 → 保持上一拍相位 + dev warn（不抛错）。
   */
  pattern?: string;
  /** 单点模式：精确拍号（0 起）；仅当 pattern 缺省且 beat===当前拍号时生效。 */
  beat?: number;
  /** 单点模式目标相位（pattern 缺省时生效）。 */
  action?: BeatPhase;
  /** 预留扩展（Could）：如 { hold:N } 表示触发后保持 N 拍再回到 default。MVP 不用。 */
  params?: Record<string, unknown>;
}

export interface BeatDef {
  enabled: boolean;
  bpm: number;
  grid: number;
  tracks: BeatTrackEntry[]; // S05-1：原 unknown[] → 真实谱面 schema
}

export interface LevelData {
  id: string;
  version: number;
  tileSize: number;
  width: number;
  height: number;
  tiles: TileDef[];
  entities: EntityDef[];
  props: PropDef[];
  checkpoints: CheckpointDef[];
  goal: GoalDef;
  /** 出生点（逻辑 px）；缺省时由 Loader 按地面推算。 */
  spawn?: SpawnDef;
  beat: BeatDef;
  /** 节拍平台实体声明（S05-1）：独立于 entities/props，tracks[].target 用 id 引用一组 tile。 */
  beatPlatforms?: BeatPlatformDef[];
  metadata: { name: string; theme: string };
}

/** 最小化校验（E4.S1 扩展完整 schema 校验）。 */
export function validateLevelData(d: unknown): d is LevelData {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  const goal = o.goal as GoalDef | undefined;
  const spawn = o.spawn as SpawnDef | undefined;
  return (
    typeof o.id === 'string' &&
    typeof o.tileSize === 'number' &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    !!o.goal &&
    !!goal &&
    typeof goal.x === 'number' &&
    typeof goal.y === 'number' &&
    !!o.spawn &&
    !!spawn &&
    typeof spawn.x === 'number' &&
    typeof spawn.y === 'number' &&
    !!o.beat
  );
}
