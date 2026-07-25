/**
 * core/enemy/enemy-types — 敌人状态类型（GDD 04，E1.S3 骨架）。
 * 4 类：ci_li / chong_feng / du_fu / shi_pao。零 Phaser / 零平台依赖。
 */
export type EnemyTypeName =
  | 'ci_li'
  | 'chong_feng'
  | 'du_fu'
  | 'shi_pao'
  | 'gu_bao'
  | 'bouncy_vine'
  | 'cyclone';

/** 敌人运行时状态（可踩判定见 E3.S1/S2）。 */
export interface EnemyState {
  id: number;
  type: EnemyTypeName;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  state: string;
  stompable: boolean;
  dead: boolean;
}

/** 弹丸（独立 hazard，碰玩家受伤）。 */
export interface ProjectileState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dead: boolean;
}
