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
  | CheckpointEntityDef;

/** S04-1/S04-2 敌人实体 schema（E3.S1/S2）：可由关卡 JSON 生成真实敌人（替代 C3 占位刺栗）。 */
export type EnemyEntityType = 'ci_li' | 'du_fu' | 'chong_feng' | 'shi_pao';
export interface EnemyEntityDef {
  type: EnemyEntityType;
  x: number;
  y: number;
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

export interface BeatDef {
  enabled: boolean;
  bpm: number;
  grid: number;
  tracks: unknown[];
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
