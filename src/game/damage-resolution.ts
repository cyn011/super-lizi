/**
 * game/damage-resolution — C3 伤害接触解算（game-scene 与集成测试共用的单一真实实现）。
 *
 * 设计：把「重叠判定 → 无敌帧保护 → hit → 状态转换 → 击退 → 事件发放 → 重生/GameOver」
 * 集中为纯函数，game-scene 的 resolveHazards 仅做委托。这样集成测试直接调用本函数即
 * 「C3 管线」的真实代码证据（非复制胶水），改动只在一处。
 *
 * 纯 TS，零 Phaser（仅依赖 core 类型与 CharacterController/characterConfig）。
 * 直接修改 body / damage（重生时重建 controller 并通过返回值交回调用方替换）。
 */
import type { Body } from '../core/physics/body';
import { CharacterController } from '../core/character/character-controller';
import type { HazardSource } from '../core/damage/hazard-source';
import type { DamageStateMachine, DamageConfig } from '../core/damage/damage-state-machine';
import type { EventBus } from '../core/events/event-bus';
import { ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER } from '../core/events/event-bus';
import { characterConfig } from '../core/config';

/** 一次伤害接触的解算结果（供调用方落地 hitstun / controller 替换）。 */
export interface HazardContactResult {
  /** 本次是否发生有效受伤（重叠 + 无敌帧外）。 */
  hit: boolean;
  /** 若受伤需设置的 hitstun（ms）；0 表示无（如重生/GameOver 分支不施加击退）。 */
  hitstunMs: number;
  /** 是否触发重生（DEAD 且有命 → 立即重生 FULL，body 已回 spawn）。 */
  respawned: boolean;
  /** 是否触发 Game Over（DEAD 且命耗尽）。 */
  gameOver: boolean;
  /** 重生时返回新 controller 供调用方替换（spawn 处满血复位）。 */
  controller?: CharacterController;
}

/**
 * 解算一次伤害接触。直接修改 body / damage；重生时重建并返回新 controller。
 *
 * @param damage 受伤状态机（读取 state / invincibleTimer，调用 hit()）。
 * @param hazard 实现 HazardSource 的伤害源（占位或真实敌人）。
 * @param body   玩家碰撞盒（击退写入 vx/vy；重生时整体复位到 spawn）。
 * @param bus    事件总线（发 ON_HURT / ON_DEATH / ON_RESPAWN / ON_GAME_OVER）。
 * @param cfg    DamageConfig（击退速度/上冲/hitstun）。
 * @param spawn  检查点（重生落点，脚底贴地）。
 * @param playerW/playerH 满血碰撞盒尺寸（重生复位用）。
 */
export function resolveHazardContact(params: {
  damage: DamageStateMachine;
  hazard: HazardSource;
  body: Body;
  bus: EventBus;
  cfg: DamageConfig;
  spawn: { x: number; y: number };
  playerW: number;
  playerH: number;
}): HazardContactResult {
  const { damage, hazard, body, bus, cfg, spawn, playerW, playerH } = params;
  const res: HazardContactResult = {
    hit: false,
    hitstunMs: 0,
    respawned: false,
    gameOver: false,
  };

  // 无重叠 / 无敌帧内（含 hitstun 窗口）→ 忽略
  if (!hazard.overlaps(body)) return res;
  if (damage.invincibleTimer > 0) return res;

  const beforeState = damage.state;
  damage.hit();
  res.hit = true;

  if (beforeState === 'FULL' && damage.state === 'SMALL') {
    // 受伤：发 ON_HURT + 远离源施加击退 + 设 hitstun
    bus.emit(ON_HURT, { lives: damage.lives, state: damage.state });
    body.vx = hazard.knockbackDir(body) * cfg.knockbackSpeed;
    body.vy = -cfg.knockbackUp;
    res.hitstunMs = cfg.hitstunMs;
  } else if (beforeState === 'SMALL') {
    if (damage.state === 'FULL') {
      // 有命立即重生（原地满血回检查点，不施加击退）
      bus.emit(ON_DEATH, { lives: damage.lives });
      bus.emit(ON_RESPAWN, { lives: damage.lives });
      const nc = new CharacterController(characterConfig, {
        x: spawn.x,
        y: spawn.y,
        grounded: true,
      });
      body.x = spawn.x;
      body.y = spawn.y;
      body.w = playerW;
      body.h = playerH;
      body.vx = 0;
      body.vy = 0;
      res.controller = nc;
      res.respawned = true;
    } else {
      // 命耗尽 → Game Over
      bus.emit(ON_DEATH, { lives: damage.lives });
      bus.emit(ON_GAME_OVER, { lives: damage.lives });
      res.gameOver = true;
    }
  }

  return res;
}
