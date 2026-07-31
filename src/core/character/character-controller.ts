/**
 * core/character/character-controller — 角色状态与控制器（GDD 03，E2.S3 完整手感）。
 *
 * 消费 InputState + 固定 dt，管理：
 *   水平加速/摩擦、单跳、二段跳(airJumps)、coyote time、jump buffer、可变跳高（短跳）、踩踏反弹、
 *   羽降 glide（Ch3 新机制：下落段持续按住跳跃 → 条件性 maxFall 钳制，见 consume 第 7 步）。
 *
 * 关键边界（架构 §4 / GDD 02 / control-list §1）：
 *   - 本控制器「只设 vx/vy」，绝不积分位置、绝不施加重力——重力由场景 stepBody 负责。
 *   - 不读碰撞、不读 phaser、不读任何平台 API（core 层铁律）。
 *   - 着地状态由外部物理/碰撞每步经 setGroundState / 直接写 state.grounded 注入。
 *   - 所有数值来自 character-config.json，经 characterConfig 读取，零硬编码。
 *
 * 短跳规格冲突裁决（sprint-02-plan §6）：epics 写 v.y*=0.5（高度仅 25%），但 control-list §1
 * 卡点要求短跳高度 = 全跳 45~55%。卡点优先 → 用 shortHopCut=0.7（高度 ∝ v² → ≈49%）实现。
 */
import type { InputState } from '../input/input-abstraction';
import { characterConfig, GRAVITY, GLIDE_MAX_FALL, GLIDE_ACTIVATE_VY } from '../config';

/** 角色运行时状态（碰撞盒尺寸受 damage.sizeScale 影响，见 GDD 07）。 */
export interface CharacterState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  coyoteTimer: number;
  jumpBufferTimer: number;
  airJumpsLeft: number;
  sizeScale: number;
}

/** 角色手感参数（全部来自 character-config.json，禁止硬编码）。 */
export interface CharacterConfig {
  moveSpeed: number;
  accelGround: number;
  accelAir: number;
  friction: number;
  gravity: number;
  jumpVelocity: number;
  coyoteMs: number;
  jumpBufferMs: number;
  doubleJumpScale: number;
  stompBounce: number;
  /** 短跳截断系数：vy *= shortHopCut。高度 ∝ v²，0.7 → ≈49% 全跳高度（control-list §1 卡点）。 */
  shortHopCut: number;
  airJumps: number;
}

/**
 * 角色控制器（E2.S3 完整手感）。
 * consume() 每固定步调用一次，原地修改 this.state。
 */
export class CharacterController {
  state: CharacterState;

  /** 短跳截断标志：保证「每个跳跃只切一次」 vy，避免上升段反复乘 shortHopCut。 */
  private shortHopApplied = false;

  /** 最近一次 consume 是否执行了跳跃（供 game-scene 在真实运行路径补 emit ON_JUMP，D1）。每步 consume 重算。 */
  lastJumped = false;

  /**
   * 多段跳动态加成（GDD 17 §3.1 / D2-A）：默认 0（维持二段跳基线 airJumps=1 不变）。
   * 种子达 fruit 阶段时由 game-scene 置 1 → airJumpsLeft = airJumps + airJumpBonus（三段跳）。
   * 仅增强不削弱，每局/蜕变阶段变化重置（不改变已调手感，零平台分支）。
   */
  airJumpBonus = 0;

  /**
   * 当前摩擦缩放（R1：office 咖啡渍低摩擦 zone）。默认 1.0（正常摩擦）。
   * 由 game-scene 在每固定步 consume 之前注入：玩家 body 与 coffee_spill zone AABB 重叠且 grounded 时，
   * 取重叠 zone 中最小 frictionScale 注入（越滑越打滑、越难急停），否则重置 1.0。
   * 仅缩放「无方向输入时的水平减速摩擦」，不改变加速/最大速度（设计附录 D.2 伪代码）。
   */
  currentFrictionScale = 1.0;

  /**
   * 羽降（glide）总开关（GDD level-3-1-design §4.7 / E1）。默认 false（旧 13 关零回归）。
   * 由 game-scene.loadLevel / HeadlessSim 构造时按 `LevelData.mechanics?.glide === true` 注入
   * （与 currentFrictionScale 同款「外部注入 + 局部钳制」范式，不新增系统、不动重力积分、不动碰撞）。
   */
  glideEnabled = false;

  /**
   * 本步是否处于羽降态（只读输出信号）。供渲染层画薄翼占位（astral-biome-spec A4.3）
   * 与音频 ON_GLIDE 事件消费；控制器自身不读它，每步 consume 重算。
   */
  glideActive = false;

  constructor(
    private readonly config: CharacterConfig = characterConfig,
    initial?: Partial<CharacterState>,
  ) {
    this.state = {
      x: 0,
      y: 0,
      w: 24,
      h: 34,
      vx: 0,
      vy: 0,
      grounded: false,
      facing: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
        airJumpsLeft: config.airJumps + this.airJumpBonus,
        sizeScale: 1,
      ...initial,
    };
  }

  /** 每固定步由物理/碰撞结果注入当前是否着地（GDD 02 isGrounded）。 */
  setGroundState(grounded: boolean): void {
    this.state.grounded = grounded;
  }

  /**
   * E2.S3 完整手感：水平 / 单跳 / 二段跳 / coyote / jump buffer / 可变跳高（短跳）。
   * 原地修改 this.state；重力由场景 stepBody 应用，此处不积分位置。
   */
  consume(input: InputState, dt: number): void {
    const s = this.state;
    const cfg = this.config;
    const ms = dt * 1000;

    // 3. grounded 处理（开头）：着地则刷新土狼窗口与空中跳额度；离地则衰减土狼计时（钳≥0）。
    if (s.grounded) {
      s.coyoteTimer = cfg.coyoteMs;
      s.airJumpsLeft = cfg.airJumps + this.airJumpBonus;
      this.shortHopApplied = false; // 落地复位短跳标志
    } else {
      s.coyoteTimer = Math.max(0, s.coyoteTimer - ms);
    }

    // 1. 水平：有方向→按 accelGround/accelAir 加速并钳到 ±moveSpeed；无方向→按 friction 朝 0 减速（不可越过 0）。
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      const accel = s.grounded ? cfg.accelGround : cfg.accelAir;
      s.vx = approach(s.vx, dir * cfg.moveSpeed, accel * dt);
      s.facing = dir > 0 ? 1 : -1;
    } else {
      s.vx = approach(s.vx, 0, cfg.friction * this.currentFrictionScale * dt);
    }

    // 4. jump buffer：本帧按下→记录缓冲；否则衰减（钳≥0）。
    if (input.jumpPressed) {
      s.jumpBufferTimer = cfg.jumpBufferMs;
    } else {
      s.jumpBufferTimer = Math.max(0, s.jumpBufferTimer - ms);
    }

    // 5. 执行跳跃（每步至多一次，条件 jumpBufferTimer>0）。
    let jumped = false;
    if (s.jumpBufferTimer > 0) {
      if (s.grounded || s.coyoteTimer > 0) {
        // 单跳 / 土狼跳
        s.vy = cfg.jumpVelocity;
        s.grounded = false;
        s.coyoteTimer = 0;
        this.shortHopApplied = false; // 新跳跃允许一次短跳截断
        jumped = true;
      } else if (s.airJumpsLeft > 0) {
        // 二段跳（空中，且尚有空中跳额度）
        s.vy = cfg.jumpVelocity * cfg.doubleJumpScale;
        s.airJumpsLeft -= 1;
        s.grounded = false;
        this.shortHopApplied = false;
        jumped = true;
      }
      if (jumped) s.jumpBufferTimer = 0; // 消费缓冲
    }

    // 6. 可变跳高（短跳）：本步刚起跳、或上升段(vy<0)且检测到跳跃释放 → vy *= shortHopCut 一次。
    //    布尔标志保证「每个跳跃只切一次」，避免反复乘。
    const released = input.jumpReleased || !input.jumpHeld;
    if (!this.shortHopApplied && released && (jumped || s.vy < 0)) {
      s.vy *= cfg.shortHopCut;
      this.shortHopApplied = true;
    }

    // 7. 羽降（glide，第三章新机制 · GDD level-3-1-design §4.3/§4.4/§4.7）：
    //    「条件性 maxFall 钳制」—— 关卡启用 + 未着地 + 持续按住跳跃键 + 已在下落段(vy>activateVy)
    //    → 把下落速度钳到 GLIDE_MAX_FALL(140)，取代全局 MAX_FALL(900)，滞空由 0.363s 拉到 0.850s。
    //    守「只设 vx/vy」铁律：仅钳制、不施力、不积分位置、不提供任何水平推力（水平仍受 moveSpeed 约束）。
    //    与既有跳跃三语义靠「边沿类型 + 状态」正交，互不冲突：
    //      起跳/二段跳 = jumpPressed 按下沿；短跳截断 = jumpReleased 松开沿 + 上升段；羽降 = jumpHeld 持续态 + 下落段。
    //    「起跳后一直按住」= 满跳 + 羽降但放弃二段跳（二段跳需新的按下沿）→ 真实取舍，非无脑最优。
    if (
      this.glideEnabled &&
      !s.grounded &&
      input.jumpHeld &&
      s.vy > GLIDE_ACTIVATE_VY
    ) {
      // ⚠️ 时序补偿：本控制器不施加重力，consume 之后 stepBody 还会再加一帧重力
      //    （vy = min(vy + GRAVITY*dt, MAX_FALL)）。故此处预扣一帧重力，
      //    使真正参与位置积分的下落速度恰为 GLIDE_MAX_FALL —— 设计稿的 45° 斜降可读性、
      //    6.0 格射程与四连金币教学弧的斜率匹配都强依赖这个精确值（§6.4 金币弧特别说明）。
      const cap = Math.max(0, GLIDE_MAX_FALL - GRAVITY * dt);
      s.vy = Math.min(s.vy, cap);
      this.glideActive = true;
    } else {
      this.glideActive = false;
    }

    // 记录本步是否发生跳跃（供真实运行路径发 ON_JUMP；headless 独立仿真，不依赖此字段）。
    this.lastJumped = jumped;
  }

  /** 踩踏反弹：被踩敌人顶消灭时由场景碰撞判定后调用，设向上速度 = stompBounce。 */
  applyStomp(): void {
    this.state.vy = this.config.stompBounce;
  }
}

function approach(cur: number, target: number, maxDelta: number): number {
  if (cur < target) return Math.min(cur + maxDelta, target);
  if (cur > target) return Math.max(cur - maxDelta, target);
  return target;
}
