/**
 * platform/gesture-provider — 点击/滑动手势输入提供者（UX-CLICK-TO-MOVE / 方案 C + 纯点击降级）。
 *
 * 设计要点（design/ux/click-to-move-design.md）：
 * - 零 Phaser / 零 wx 依赖：只吃「逻辑分辨率坐标」（512×288），所有判定在平台层。
 * - 产出与现有**完全相同**的信号 id：touch:left / touch:right / touch:jump / touch:action。
 *   → core/InputAbstraction、CharacterController.consume 原样复用，零改。
 * - 双态模型统一于同一事件流：
 *     · Tap 态（微信模拟器只报 pointerdown）：点区域即开始 held，计时器（仿真时钟）到点自动 released。
 *       以「栗宝屏幕位置」为原点：其右/左死区外走 WALK_SEGMENT_MS 后自停；其上方死区外跳 JUMP_HOLD_MS（满跳）；栗宝周围死区清方向。
 *     · Hold 态（真机触屏 / 能报 move+up）：按住持续 held，松手 released；移动中越过栗宝屏幕 x 实时换向；
 *       上划（Δy<0 且 |Δy|≥SLOPE·|Δx| 且位移≥SWIPE_MIN_DIST）→ 跳（松手早=短跳，按住久=满跳）；
 *       跳跃态下继续拖动可空中换向（jumping 与 walkDir 叠加），拖动起点落在死区（walkDir=null）也能起步行走。
 * - 双指 tap（≥2 枚 pointer 同时 down）→ 产出 touch:action（暂停通道）。
 * - 计时器由仿真时钟驱动（advance(dtMs) 每帧由 sample 调用方传入），**不用 setTimeout**，
 *   暂停/失焦时 reset() 清状态，避免漂移与卡死。
 * - 全部参数来自 input-config.json 的 wechat.gesture 块，不硬编码。
 */
import { refillFrame, type RawInputFrame, type RawInputProvider, type SignalId } from '../core/input/raw-input';
import { LOGICAL_WIDTH } from './detect';
import type { PointerSink } from './raw-input-provider';

/** 手势参数（全部来自 input-config.json，禁止硬编码）。 */
export interface GestureParams {
  /** 死区半径（以栗宝屏幕位置为原点）：|dx|<=deadzone 且 |dy|<=deadzone → 停。默认 16。
   *  替代原 horizontalDeadzoneX 的「屏幕中线分区」语义（见 design/ux/click-to-move-design.md 最新拍板）。 */
  deadzone: number;
  /** 【已弃用】原 Tap 跳跃上半区阈值（y<此值判跳）。跳跃改相对栗宝 Y（dy < -deadzone 判跳）。保留键以兼容旧配置。 */
  jumpZoneTop: number;
  /** 上划跳斜率阈值：|Δy| ≥ jumpSwipeSlope·|Δx| 且 Δy<0 视为上划跳。 */
  jumpSwipeSlope: number;
  /** 最小滑距：位移 ≥ 此值才算「滑动」（否则视为纯点 → Tap 态）。 */
  swipeMinDist: number;
  /** Tap 行走段时长：点左/右后持续 held 此毫秒后自动 released（自停）。 */
  walkSegmentMs: number;
  /** Tap 跳跃保持时长：点上区后 jump 持续 held 此毫秒（≥满跳上升 267ms → 满跳）。 */
  jumpHoldMs: number;
}

const SIGNAL_LEFT = 'touch:left';
const SIGNAL_RIGHT = 'touch:right';
const SIGNAL_JUMP = 'touch:jump';
const SIGNAL_ACTION = 'touch:action';

/** 单枚指针的运行时状态。 */
interface PointerState {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  /** 是否已进入 Hold 态（移动 ≥ swipeMinDist）。进入后取消 Tap 自动停，改为松手释放。 */
  isHold: boolean;
  /** Tap 行走累计计时（仅未进入 Hold 时累加，到点自动 released）。 */
  walkTapTimer: number;
  /** 跳保持倒计时（>0 表示 jump 正 held；到点或松手 released）。 */
  jumpHeldTimer: number;
  /** 当前行走方向（null = 未行走）。 */
  walkDir: 'left' | 'right' | null;
  /** 是否处于跳跃态（Tap 上区 或 Hold 上划）。 */
  jumping: boolean;
}

/**
 * 点击/滑动手势输入提供者。核心层零改动：仅产出 touch:* 信号，core 按既有映射消费。
 */
export class GestureProvider implements RawInputProvider, PointerSink {
  private readonly params: GestureParams;
  /** 栗宝屏幕逻辑坐标（点击意图判定原点）。默认屏幕中心，避免未设置时崩。 */
  private playerX = 256;
  private playerY = 144;

  private readonly down = new Set<SignalId>();
  private readonly pressed = new Set<SignalId>();
  private readonly released = new Set<SignalId>();

  /** 当前活动指针（按 pointerId）。模拟器只有 pointerdown → 同 id 反复覆盖即「重新点」。 */
  private readonly pointers = new Map<number, PointerState>();
  /** 主指针 id（驱动移动/跳跃的那枚）。 */
  private primaryId: number | null = null;
  /** 双指暂停锁：≥2 枚指针同时 down 时为 true，期间屏蔽移动、仅响应暂停释放。 */
  private pauseLock = false;
  /** 复用帧对象，避免每 sample() 新建三组 Set（稳态 GC 优化，见 Phase 6 报告候选④）。 */
  private readonly frame: RawInputFrame = {
    down: new Set<SignalId>(),
    pressedEdge: new Set<SignalId>(),
    releasedEdge: new Set<SignalId>(),
  };

  constructor(params: GestureParams, logicalWidth: number = LOGICAL_WIDTH) {
    this.params = params;
    // logicalWidth 仅保留历史签名兼容；新判定以 playerX/playerY 为原点，不再依赖屏幕中线。
    void logicalWidth;
  }

  /** 每帧由平台层喂入栗宝的屏幕逻辑坐标（相机变换后），作为点击意图判定原点。 */
  setPlayerScreenPos(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
  }

  // ---- 指针事件入口 ----

  pointerDown(x: number, y: number, pointerId = 0): void {
    // 诊断：入口打点（坐标已换算到逻辑分辨率 512×288），便于复现"坐标失真/不触发"问题。
    console.log('[gesture][provider] pointerDown id=', pointerId, 'x=', x, 'y=', y, 'pointers=', this.pointers.size);
    const fresh: PointerState = {
      startX: x,
      startY: y,
      curX: x,
      curY: y,
      isHold: false,
      walkTapTimer: 0,
      jumpHeldTimer: 0,
      walkDir: null,
      jumping: false,
    };
    this.pointers.set(pointerId, fresh);

    // 双指同时 down → 暂停（action 通道）。屏蔽移动，清掉已有行走/跳跃。
    if (this.pointers.size >= 2) {
      this.pauseLock = true;
      this.clearMovement();
      this.down.add(SIGNAL_ACTION);
      this.pressed.add(SIGNAL_ACTION);
      return;
    }

    this.primaryId = pointerId;
    // 模拟器快速连点（无 pointerup）：新 pointerdown 覆盖旧指针，先清掉残留信号再判新意图。
    this.clearMovement();
    this.beginIntent(x, y);
  }

  pointerMove(x: number, y: number, pointerId = 0): void {
    const p = this.pointers.get(pointerId);
    if (!p) return;
    p.curX = x;
    p.curY = y;
    if (this.pauseLock) return; // 暂停中忽略移动
    if (pointerId !== this.primaryId) return; // 非主指针（第二指）不驱动移动

    const dx = x - p.startX;
    const dy = y - p.startY;
    const dist = Math.hypot(dx, dy);

    // 位移达到阈值 → 进入 Hold 态（取消 Tap 自动停，改为松手释放）。
    if (!p.isHold && dist >= this.params.swipeMinDist) p.isHold = true;

    // 上划跳：任意起始区，只要位移与上扬满足斜率即跳（Hold 态核心交互）。
    // 注意：不再用「if (p.jumping) return」提前退出 —— 跳跃态下 pointerMove 仍继续处理水平移动，
    // 从而「跳跃中拖动可空中换向」（jumping 与 walkDir 叠加）。本帧上划跳只产出跳（释放行走），
    // 若随后继续拖动（dy 不再满足上扬或后续 move），会落到下方实时换向逻辑接管。
    if (dy < 0 && Math.abs(dy) >= this.params.jumpSwipeSlope * Math.abs(dx) && dist >= this.params.swipeMinDist) {
      this.clearWalk();
      p.jumping = true;
      p.jumpHeldTimer = this.params.jumpHoldMs;
      this.down.add(SIGNAL_JUMP);
      this.pressed.add(SIGNAL_JUMP);
      return;
    }

    // 实时换向：进入 Hold 态后，依据当前指针 x 相对栗宝屏幕 x（this.playerX）实时决定方向：
    //   · x < playerX - deadzone  → 左走（仅在方向变化时调用 setWalk，避免重复 pressed）
    //   · x > playerX + deadzone  → 右走
    //   · 死区内（|x-playerX| <= deadzone）→ 保持上一方向（p.walkDir 原值，防抖），不清除、不重发
    // 效果：① 地面按住拖动 → 实时跟手左右走、松手停；② 跳跃中按住拖动 → 空中实时换向；
    //       ③ 拖回死区不抖（保持上一方向）。
    // 不再要求「先判出方向」：起点落在死区（walkDir=null）也能在拖动到左/右区后触发行走。
    if (p.isHold) {
      const dz = this.params.deadzone;
      if (x < this.playerX - dz) {
        if (p.walkDir !== 'left') this.setWalk('left');
      } else if (x > this.playerX + dz) {
        if (p.walkDir !== 'right') this.setWalk('right');
      }
      // 死区内：保持上一方向，不调用 setWalk，不清除（防抖）
    }
  }

  pointerUp(x: number, y: number, pointerId = 0): void {
    const p = this.pointers.get(pointerId);
    this.pointers.delete(pointerId);

    // 任一指抬起 → 双指不再同时 down → 释放暂停。
    if (this.pauseLock && this.pointers.size < 2) {
      this.pauseLock = false;
      if (this.down.has(SIGNAL_ACTION)) {
        this.down.delete(SIGNAL_ACTION);
        this.released.add(SIGNAL_ACTION);
      }
    }

    if (pointerId !== this.primaryId) {
      if (this.primaryId === pointerId) this.primaryId = null;
      return;
    }

    // 主指针抬起：跳跃与行走独立释放（二者可同时成立：跳跃中拖动 → 空中左/右移），
    // 松手应一并清除，避免行走信号残留导致松手后仍在走。
    if (p) {
      if (p.jumping) {
        this.releaseSignal(SIGNAL_JUMP);
        p.jumping = false;
      }
      if (p.walkDir) {
        this.releaseSignal(p.walkDir === 'left' ? SIGNAL_LEFT : SIGNAL_RIGHT);
        p.walkDir = null;
      }
    }
    this.primaryId = null;
  }

  // ---- 仿真时钟推进（由 sample 调用方每帧传入，不用 setTimeout）----
  advance(dtMs: number): void {
    if (dtMs <= 0) return;
    for (const p of this.pointers.values()) {
      // Tap 行走自动停（Hold 态不自动停，等松手）。
      if (p.walkDir && !p.isHold) {
        p.walkTapTimer += dtMs;
        if (p.walkTapTimer >= this.params.walkSegmentMs) {
          this.releaseSignal(p.walkDir === 'left' ? SIGNAL_LEFT : SIGNAL_RIGHT);
          p.walkDir = null;
        }
      }
      // 跳保持计时（到点自动 released；Hold 态若更早松手则由 pointerUp 释放，幂等）。
      if (p.jumping) {
        p.jumpHeldTimer -= dtMs;
        if (p.jumpHeldTimer <= 0) {
          this.releaseSignal(SIGNAL_JUMP);
          p.jumping = false;
        }
      }
    }
  }

  // ---- RawInputProvider 采样 ----
  sample(): RawInputFrame {
    const f = refillFrame(this.frame, this.down, this.pressed, this.released);
    this.pressed.clear();
    this.released.clear();
    return f;
  }

  /** 失焦/暂停时清空所有按住与计时，避免输入卡死。 */
  reset(): void {
    this.pointers.clear();
    this.primaryId = null;
    this.pauseLock = false;
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }

  // ---- 内部辅助 ----

  private primary(): PointerState | undefined {
    return this.primaryId == null ? undefined : this.pointers.get(this.primaryId);
  }

  /**
   * 按当前指针坐标「相对栗宝屏幕位置」确定意图（原点 = playerX/playerY，非屏幕中线）：
   *   · dy < -deadzone        → 跳（点击在栗宝上方死区外）
   *   · dx >  deadzone        → 右走
   *   · dx < -deadzone        → 左走
   *   · 斜向（既偏上又偏左右）→ 跳 + 走 同时成立（用户拍板：斜向优先跳，同时按水平方向走）
   *   · 死区内（|dx|<=DZ 且 |dy|<=DZ）→ 停（清水平方向；clearMovement 已清空其它）
   */
  private beginIntent(x: number, y: number): void {
    const p = this.primary();
    if (!p) return;
    const dx = x - this.playerX;
    const dy = y - this.playerY;
    const DZ = this.params.deadzone;

    // 斜向优先跳：点击在栗宝上方死区外即跳（可与水平方向同时成立）。
    if (dy < -DZ) {
      p.jumping = true;
      p.jumpHeldTimer = this.params.jumpHoldMs;
      this.down.add(SIGNAL_JUMP);
      this.pressed.add(SIGNAL_JUMP);
    }

    // 水平意图：与跳跃可叠加（斜向 = 跳 + 走）。
    if (dx > DZ) {
      this.setWalk('right');
    } else if (dx < -DZ) {
      this.setWalk('left');
    } else {
      this.clearWalk(); // 死区（含纯跳 |dx|<=DZ）→ 清水平方向，保留已有的跳
    }
  }

  private setWalk(dir: 'left' | 'right'): void {
    const p = this.primary();
    if (!p) return;
    if (p.walkDir === dir) {
      p.walkTapTimer = 0;
      p.isHold = false;
      return;
    }
    this.clearWalk();
    p.walkDir = dir;
    p.walkTapTimer = 0;
    p.isHold = false;
    const sig = dir === 'left' ? SIGNAL_LEFT : SIGNAL_RIGHT;
    this.down.add(sig);
    this.pressed.add(sig);
  }

  /** 清掉行走信号（left/right 从 down 移除并补 released 边沿）；主指针 walkDir 置空。 */
  private clearWalk(): void {
    if (this.down.has(SIGNAL_LEFT)) {
      this.down.delete(SIGNAL_LEFT);
      this.released.add(SIGNAL_LEFT);
    }
    if (this.down.has(SIGNAL_RIGHT)) {
      this.down.delete(SIGNAL_RIGHT);
      this.released.add(SIGNAL_RIGHT);
    }
    const p = this.primary();
    if (p) p.walkDir = null;
  }

  /** 清掉所有移动信号（行走 + 跳跃），供新手势起点 / 双指暂停使用。 */
  private clearMovement(): void {
    this.clearWalk();
    if (this.down.has(SIGNAL_JUMP)) {
      this.down.delete(SIGNAL_JUMP);
      this.released.add(SIGNAL_JUMP);
    }
  }

  private releaseSignal(sig: SignalId): void {
    if (this.down.has(sig)) {
      this.down.delete(sig);
      this.released.add(sig);
    }
  }
}
