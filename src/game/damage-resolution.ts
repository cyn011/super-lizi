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
import type { HazardSource, StompableHazard } from '../core/damage/hazard-source';
import type { DamageStateMachine, DamageConfig } from '../core/damage/damage-state-machine';
import type { EventBus } from '../core/events/event-bus';
import { ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER, ON_STOMP, ON_ENEMY_DEATH } from '../core/events/event-bus';
import { characterConfig } from '../core/config';

/** 几何容差（类 collision 边界 1e-6，非玩法调参）：踩踏「上帧在敌顶之上」判定用。 */
const STOMP_EPS = 1e-3;

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
  /** 本次是否触发踩踏（消灭敌人 + 玩家反弹，与受伤互斥）。 */
  stomped: boolean;
  /** 重生时返回新 controller 供调用方替换（spawn 处满血复位）。 */
  controller?: CharacterController;
}

/** 收窄到可踩契约（仅当同时具备 getBounds / markStomped 时生效）。 */
function asStompable(h: HazardSource): StompableHazard | null {
  const s = h as Partial<StompableHazard>;
  if (typeof s.getBounds === 'function' && typeof s.markStomped === 'function') {
    return s as StompableHazard;
  }
  return null;
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
 * @param dt 固定步长（秒），用于踩踏「上帧底」推算；缺省回退 1/60（测试可不传）。
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
  dt?: number;
}): HazardContactResult {
  const { damage, hazard, body, bus, cfg, spawn, playerW, playerH } = params;
  const dt = params.dt ?? 1 / 60;
  const res: HazardContactResult = {
    hit: false,
    hitstunMs: 0,
    respawned: false,
    gameOver: false,
    stomped: false,
  };

  // 无重叠 → 忽略
  if (!hazard.overlaps(body)) return res;

  // ── 踩踏分支（可踩敌人，从顶踩下）──
  // 即便处于无敌帧也允许踩敌（踩踏不触发受伤）；与下方受伤分支互斥（同帧只走其一）。
  // 三条件：hazard.isStompable && 玩家下落(vy>0) && 上帧底在敌顶之上（玩家从上方接触敌顶）。
  if (hazard.isStompable) {
    const s = asStompable(hazard);
    if (s) {
      const b = s.getBounds();
      const playerBottom = body.y + body.h;
      const prevBottom = body.y + body.h - body.vy * dt; // 上帧底（dt 秒前）
      const cameFromAbove = prevBottom <= b.y + STOMP_EPS; // 上帧在敌顶之上 / 贴合
      const nowOverlap = playerBottom > b.y; // 本帧已陷入敌身顶
      if (body.vy > 0 && cameFromAbove && nowOverlap) {
        body.vy = characterConfig.stompBounce; // 向上反弹（stompBounce<0，来自 config）
        bus.emit(ON_STOMP, { type: s.enemyType ?? 'unknown', x: b.x + b.w / 2, y: b.y });
        // persistentStomp（水母 jellyfish）：仅弹起、不消灭 → 可作持久踏脚石（区别于 du_fu 踩杀）
        if (!(hazard as { persistentStomp?: boolean }).persistentStomp) {
          s.markStomped(); // 敌消灭（dead → overlaps 返回 false）
          bus.emit(ON_ENEMY_DEATH, { type: s.enemyType ?? 'unknown', x: b.x + b.w / 2, y: b.y + b.h / 2 });
        }
        res.stomped = true;
        return res;
      }
    }
  }

  // 无敌帧内（含 hitstun 窗口）→ 忽略受伤
  if (damage.invincibleTimer > 0) return res;

  // nonDamaging（水母 jellyfish 触手/侧身）：重叠但不造成伤害，仅作踏脚石 → 跳过受伤分支
  if ((hazard as { nonDamaging?: boolean }).nonDamaging) return res;

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
