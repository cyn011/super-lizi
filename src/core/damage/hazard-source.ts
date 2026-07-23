/**
 * core/damage/hazard-source — 伤害源最小接口（GDD 07 / C3 接入 / 未来 E3 敌人复用）。
 *
 * 纯逻辑、零平台 API（core 层铁律）。game-scene 与碰撞系统通过本接口统一判定
 * 「是否重叠」「击退方向」「是否可踩」，从而与具体伤害源实现解耦：
 *   - C3 用 game/debug/placeholder-hazard 占位刺栗验证 FULL→SMALL→DEAD→重生 全链路；
 *   - 未来 E3 真实敌人实现本接口即可接入，零返工。
 */
import type { Body } from '../physics/body';

export interface HazardSource {
  /** 是否与玩家碰撞盒重叠（AABB）。 */
  overlaps(body: Body): boolean;
  /** 远离源的水平击退方向：玩家在源左侧→向右推(1)，右侧→向左推(-1)。 */
  knockbackDir(body: Body): 1 | -1;
  /** 是否可被踩消灭（未来 E3 用；C3 占位刺栗为 false，仅伤害）。 */
  isStompable: boolean;
}
