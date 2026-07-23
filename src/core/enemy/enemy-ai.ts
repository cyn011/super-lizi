/**
 * core/enemy/enemy-ai — 敌人 AI（GDD 04，E1.S3 骨架）。
 * E3.S1/S2 落地表驱动 4 类状态机 + 弹丸。当前占位。零 Phaser / 零平台依赖。
 */
import type { EnemyState, ProjectileState } from './enemy-types';
import { enemyConfig } from '../config';

export class EnemyAI {
  constructor(private readonly config = enemyConfig) {}

  /** E3.S1/S2：每固定步推进敌人状态机与弹丸。当前占位空实现。 */
  step(_enemies: EnemyState[], _projectiles: ProjectileState[], _dt: number): void {
    // TODO(E3.S1/S2): 刺栗巡逻掉头+可踩 / 嘟浮浮动 / 冲锋 detect→charge→stun / 石炮 fire。
  }
}
