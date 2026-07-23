/**
 * core/level/level-data — 关卡数据类型与校验（GDD 05，E1.S3 骨架）。
 * 数值集中 config/levels/*.json，逻辑层零硬编码。零 Phaser / 零平台依赖。
 */
export interface TileDef {
  tx: number;
  ty: number;
  kind: string;
}

export interface EntityDef {
  type: string;
  x: number;
  y: number;
}

/** S04-1 敌人实体 schema（E3.S1）：可由关卡 JSON 生成真实可踩敌人（替代 C3 占位刺栗）。 */
export type EnemyEntityType = 'ci_li' | 'du_fu';
export interface EnemyEntityDef {
  type: EnemyEntityType;
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
