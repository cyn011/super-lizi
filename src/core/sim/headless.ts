/**
 * core/sim/headless — 无头确定性仿真编排器（testing.md §5 / S06-1 门禁）。
 *
 * 目标：在 Node 环境（零 Phaser / 零平台 API）下，按固定步长把核心系统串起来跑 N 步，
 * 断言「同输入序列 → 同最终 state」「状态有界不穿地/不飞出世界」「beat.enabled=false
 * 不触发任何机制」。它是双端逻辑等价与无崩溃的第二道确定性保险（CI 无 canvas 即可跑）。
 *
 * 落点：src/core/sim/headless.ts（核心层，零平台）。为保持 core 自洽、不反向依赖 game 层，
 * 本文件就地内联「同步协议」（与 game/scene-sync.runStepSim 同源逻辑），仅用 core 模块：
 *   InputAbstraction → CharacterController → stepBody(+CollisionWorld)
 *   → EnemyAI(+Projectile) → Economy / DamageStateMachine / BeatClock（计时与门控）
 *
 * 明确不做：不接入 game 层真实的 damage-resolution / pickup-resolution 碰撞管线（那部分由
 * 专有的 enemy-stomp / enemy-nonstompable / c3-damage / pickup-checkpoint 集成测试覆盖）。
 * 本冒烟只验证「整条固定步循环可确定性跑通、状态有界、节拍门控有效」。
 */
import type { Body } from '../physics/body';
import { stepBody } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import { LevelLoader } from '../level/level-loader';
import type { RuntimeLevel } from '../level/level-runtime';
import { CharacterController } from '../character/character-controller';
import { InputAbstraction } from '../input/input-abstraction';
import type { RawInputFrame } from '../input/raw-input';
import { emptyFrame } from '../input/raw-input';
import { EnemyAI } from '../enemy/enemy-ai';
import { Projectile } from '../enemy/projectile';
import { EconomyController } from '../economy/economy';
import { DamageStateMachine } from '../damage/damage-state-machine';
import { BeatClock, type BeatDef } from '../beat/beat-clock';
import { advanceBeat } from '../beat/advance-beat';
import { EventBus, ON_LAND, ON_JUMP, ON_BEAT, ON_LEVEL_COMPLETE } from '../events/event-bus';
import { characterConfig, level1_1, STEP_DT, damageConfig, webInputConfig } from '../config';

/** 角色碰撞盒尺寸（与 game-scene / integration 测试一致：24×34）。 */
const CHAR_W = 24;
const CHAR_H = 34;

/** 可选构造参数。 */
export interface HeadlessOptions {
  /** 关卡 JSON（默认内置 1-1）。 */
  levelJson?: unknown;
  /** 节拍是否启用（默认取关卡 beat.enabled）。 */
  beatEnabled?: boolean;
  /** 初始命数（默认取 damage-config.initialLives）。 */
  initialLives?: number;
}

/** 仿真最终快照（供断言状态有界 / 确定性）。 */
export interface HeadlessFinalState {
  character: { x: number; y: number; vx: number; vy: number; grounded: boolean };
  enemies: Array<{ type: string; x: number; y: number; dead: boolean; state: string }>;
  projectiles: number;
}

/** 单次仿真结果。 */
export interface HeadlessResult {
  steps: number;
  /** 是否抛异常（任何步内出错即 true，用于「无异常」断言）。 */
  crashed: boolean;
  /** 确定性哈希：同输入序列 → 逐位一致。 */
  finalHash: string;
  /** 捕获的事件名序列（深层相等可判确定性）。 */
  events: string[];
  /** beat.enabled=true 时跨拍次数；false 时恒 0。 */
  beatEvents: number;
  /** 经济 / 伤害快照（冒烟中仅计时推进，无碰撞驱动变化，恒初值）。 */
  score: number;
  coins: number;
  lives: number;
  finalState: HeadlessFinalState;
}

/** 简单 AABB 重叠判定（与 game-scene.resolveGoal / integration 测试同源）。 */
function aabbOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** FNV-1a 字符串哈希（确定性，零随机数 / 零时钟）。 */
function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 无头仿真编排器：构造即装配好一关的所有核心系统，run() 跑 N 步并产出确定性结果。
 * 纯 core、确定性（无 Math.random / Date.now / 平台 API）。
 */
export class HeadlessSim {
  private readonly bus = new EventBus();
  /** 最近一次 run 的实际步数（用于确定性哈希）。 */
  private runSteps = 0;
  private readonly level: RuntimeLevel;
  private readonly body: Body;
  private readonly cc: CharacterController;
  private readonly ia: InputAbstraction;
  private readonly enemies: EnemyAI[];
  private readonly projectiles: Projectile[] = [];
  private readonly economy = new EconomyController();
  private readonly damage: DamageStateMachine;
  private readonly beat: BeatClock;
  private readonly beatEnabled: boolean;

  /** 捕获的事件序列（跨步累积）。 */
  private events: string[] = [];
  private beatEvents = 0;
  private levelCompleteEmitted = false;

  constructor(opts: HeadlessOptions = {}) {
    const levelJson = opts.levelJson ?? level1_1;
    this.level = LevelLoader.load(levelJson);

    const spawn = this.level.spawn;
    this.body = { x: spawn.x, y: spawn.y, w: CHAR_W, h: CHAR_H, vx: 0, vy: 0 };
    this.cc = new CharacterController(characterConfig, {
      x: spawn.x,
      y: spawn.y,
      grounded: true,
    });
    // Ch3 羽降（glide）：与 game-scene.loadLevel 同源注入，保证 headless 仿真与真实运行路径一致
    // （缺省 false → 旧 13 关确定性哈希不变，零回归）。
    this.cc.glideEnabled = this.level.data.mechanics?.glide === true;
    this.ia = new InputAbstraction(webInputConfig);
    this.enemies = this.level.enemies;

    const beatData = (this.level.data.beat ?? {
      enabled: false,
      bpm: 120,
      grid: 8,
      tracks: [],
    }) as BeatDef;
    this.beatEnabled = opts.beatEnabled ?? beatData.enabled;
    this.beat = new BeatClock({ ...beatData, enabled: this.beatEnabled });

    this.damage = new DamageStateMachine(opts.initialLives ?? damageConfig.initialLives);

    // 订阅事件用于确定性捕获（headless 不渲染，仅记录事件序列）。
    this.bus.on(ON_LAND, () => this.events.push(ON_LAND));
    this.bus.on(ON_JUMP, () => this.events.push(ON_JUMP));
    this.bus.on(ON_BEAT, () => this.events.push(ON_BEAT));
    this.bus.on(ON_LEVEL_COMPLETE, () => this.events.push(ON_LEVEL_COMPLETE));
  }

  /**
   * 跑 steps 个固定步；frames 为每步原始输入帧（短于 steps 时补空帧）。
   * @returns 确定性结果（崩溃时 crashed=true，finalHash='CRASH'）。
   */
  run(frames: RawInputFrame[], steps: number): HeadlessResult {
    this.runSteps = steps;
    const world: CollisionWorld = this.level.world;
    let lastGrounded = true;
    let simTimeMs = 0;
    try {
      for (let i = 0; i < steps; i++) {
        const frame = frames[i] ?? emptyFrame();
        simTimeMs = i * STEP_DT * 1000;
        const input = this.ia.sample(frame, simTimeMs);

        // —— 同步协议（in → consume → out速度 → stepBody → out位置，与 runStepSim 同源）——
        const s = this.cc.state;
        s.vx = this.body.vx;
        s.vy = this.body.vy;
        s.grounded = lastGrounded;
        this.cc.consume(input, STEP_DT); // 原地改 state.vx/vy（含跳/二段/coyote/buffer/短跳）
        this.body.vx = s.vx;
        this.body.vy = s.vy;
        const res = stepBody(this.body, STEP_DT, world); // 重力 + 分轴碰撞
        s.x = this.body.x;
        s.y = this.body.y;
        const grounded = res.grounded;

        // —— 事件捕获 ——
        if (input.jumpPressed) this.bus.emit(ON_JUMP);
        if (grounded && !lastGrounded) this.bus.emit(ON_LAND);
        if (!this.levelCompleteEmitted && aabbOverlap(this.body, this.level.goal)) {
          this.levelCompleteEmitted = true;
          this.bus.emit(ON_LEVEL_COMPLETE);
          this.economy.onLevelComplete();
        }

        // —— 敌人推进（4 类 AI + 石炮弹丸）——
        for (const e of this.enemies) {
          const spawned = e.update(STEP_DT, world, this.body);
          for (const p of spawned) this.projectiles.push(p);
        }
        // 弹丸积分 + 回收出界/撞墙（保持列表有界、确定性）
        for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
          const p = this.projectiles[pi];
          p.update(STEP_DT, world);
          if (p.dead) this.projectiles.splice(pi, 1);
        }

        // —— 节拍门控（统一 advanceBeat：enabled=false 时返回 -1 → 0 触发）——
        // 与 game-scene 同源逻辑：跨拍 emit ON_BEAT（headless 不驱动 BeatDrivenSystem，仅记录事件）。
        const beatIdx = advanceBeat(this.beat, simTimeMs, this.bus);
        if (beatIdx >= 0) this.beatEvents++;

        // —— 经济 / 伤害计时推进（冒烟中仅跑计时，无碰撞驱动数值变化）——
        this.economy.update(STEP_DT * 1000);
        this.damage.update(STEP_DT * 1000);

        lastGrounded = grounded;
      }

      return {
        steps,
        crashed: false,
        finalHash: this.computeHash(),
        events: this.events,
        beatEvents: this.beatEvents,
        score: this.economy.state.score,
        coins: this.economy.state.coins,
        lives: this.damage.lives,
        finalState: this.snapshot(),
      };
    } catch {
      return {
        steps,
        crashed: true,
        finalHash: 'CRASH',
        events: this.events,
        beatEvents: this.beatEvents,
        score: this.economy.state.score,
        coins: this.economy.state.coins,
        lives: this.damage.lives,
        finalState: this.snapshot(),
      };
    }
  }

  /** 确定性哈希：角色态 + 步数 + 事件数 + 节拍数 + 经济/伤害 + 弹丸数。 */
  private computeHash(): string {
    const s = this.cc.state;
    const parts = [
      round2(s.x),
      round2(s.y),
      round2(s.vx),
      round2(s.vy),
      this.runSteps,
      this.events.length,
      this.beatEvents,
      this.economy.state.score,
      this.economy.state.coins,
      this.damage.lives,
      this.enemies.length,
      this.projectiles.length,
    ];
    return hashString(parts.join('|'));
  }

  /** 末态快照。 */
  private snapshot(): HeadlessFinalState {
    const s = this.cc.state;
    return {
      character: {
        x: round2(s.x),
        y: round2(s.y),
        vx: round2(s.vx),
        vy: round2(s.vy),
        grounded: s.grounded,
      },
      enemies: this.enemies.map((e) => ({
        type: e.type,
        x: round2(e.x),
        y: round2(e.y),
        dead: e.dead,
        state: e.state,
      })),
      projectiles: this.projectiles.length,
    };
  }
}

/** testing.md §5 约定工厂：createHeadlessSim().run(SCRIPTED_INPUTS, 600)。 */
export function createHeadlessSim(opts: HeadlessOptions = {}): HeadlessSim {
  return new HeadlessSim(opts);
}
