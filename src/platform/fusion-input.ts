/**
 * platform/fusion-input — 按钮 + 手势融合输入层（融合为唯一模式）。
 *
 * 设计（用户拍板）：
 * - 默认双开融合：按钮浮层常驻可点 + 屏幕任意其它区域拖拽即手势 + 键盘始终可用。不再有二选一。
 * - 按钮命中优先：每个触点先 hitTest（inputConfig.wechat.buttons + pauseIcon）；命中某按钮 → 走该按钮 press；
 *   未命中 → 走 GestureProvider 手势。暂停图标视为特殊按钮（命中 → touch:pause，未命中 → 手势）。
 * - 手势内部逻辑（双指暂停等）不受影响：融合层只把「未命中按钮的触点」喂给 GestureProvider。
 * - 微信真机 + 模拟器鼠标模式的 touch 字段读取（优先 identifier/clientX/clientY，回退 id/x/y）、
 *   screenCanvas.click 路由，融合后仍正确工作。
 * - 现有去重逻辑（微信模拟器一次点击同时触发 wx.onTouch* 与 screenCanvas.click，TOUCH_DEDUP_MS 窗口）
 *   在融合层保留，避免坐标被反向 touch 覆盖。
 *
 * 对外实现 RawInputProvider & PointerSink：
 * - sample/reset：合并 buttons + gesture 两路信号（复用合并帧）。
 * - pointerDown/Move/Up（逻辑坐标，来自 Web Phaser pointer / 测试）：按通道路由。通道在 pointerDown 时
 *   依落点决定（命中按钮=按钮通道，否则=手势通道），指针抬起前保持稳定，杜绝手势 pointer 泄漏。
 * - advance：转发给 gesture（仿真时钟驱动计时器）。
 * - setPlayerScreenPos：转发给 gesture（以主角屏幕位置为原点判定点击意图）。
 *
 * 平台层（web/wechat-platform）把 keyboard 与 FusionInput 经 makeCompositeInput 合并，键盘始终并入不冲突。
 */
import { type RawInputFrame, type RawInputProvider, type SignalId } from '../core/input/raw-input';
import { GestureProvider, type GestureParams } from './gesture-provider';
import type { PointerSink } from './raw-input-provider';
import { WechatTouchProvider } from './wechat/wechat-touch';
import { inputConfig } from '../core/config';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './detect';

/** 从 input-config.json 读取手势参数（wechat.gesture 块未在 core 类型中声明，此处本地断言）。 */
function readGestureParams(): GestureParams {
  const g = (inputConfig.wechat as unknown as { gesture?: Record<string, number> }).gesture;
  if (!g) {
    throw new Error('[fusion-input] inputConfig.wechat.gesture 缺失，无法启用手势层');
  }
  return {
    deadzone: g.playerDeadzone ?? g.deadzone ?? 16,
    jumpZoneTop: g.jumpZoneTop,
    jumpSwipeSlope: g.jumpSwipeSlope,
    swipeMinDist: g.swipeMinDist,
    walkSegmentMs: g.walkSegmentMs,
    jumpHoldMs: g.jumpHoldMs,
  };
}

/** 双通道去重窗口（ms）。微信开发者工具鼠标模式下一次点击会同时触发 wx.onTouch* 与
 *  screenCanvas.click 两条通道，二者都喂同一融合层且 id 同为 0；后到的 touch 会用模拟器下可能失真/
 *  反向的 clientX 覆盖 click 已判好的意图，造成"点右半屏却向左走"。窗口内紧接 click 的 touch
 *  判定为同源模拟器鼠标事件并跳过，从而消除覆盖/反转；真机触屏无成对 click，不受影响。 */
const TOUCH_DEDUP_MS = 150;

/** wx.onTouch* changedTouches 单点（兼容真机/模拟器字段）。 */
interface WxTouch {
  identifier?: number;
  id?: number;
  clientX?: number;
  clientY?: number;
  x?: number;
  y?: number;
}

export class FusionInput implements RawInputProvider, PointerSink {
  private readonly gesture: GestureProvider;
  /** 按钮层：autoBind=false，事件由本融合层统一绑一次后 routeTouch/routeClick 喂入。 */
  private readonly buttons: WechatTouchProvider;

  /** 复用合并帧，避免每 sample() 新建三组 Set（稳态 GC 优化，见 Phase 6 报告候选④）。 */
  private readonly frame: RawInputFrame = {
    down: new Set<SignalId>(),
    pressedEdge: new Set<SignalId>(),
    releasedEdge: new Set<SignalId>(),
  };

  /** Web/测试 PointerSink 通道跟踪：pointerId → 当前按下的按钮（SignalId）或吞掉的控制面板触点（null）。 */
  private readonly activeByPointer = new Map<number, SignalId | null>();

  /** 去重状态（按环境独立）。 */
  private lastEventAt = 0;
  private lastSource: 'click' | 'touch' = 'touch';

  // 解绑所需的 wx 句柄引用
  private readonly onTouchStart = (e: unknown): void => this.forwardTouch('start', e);
  private readonly onTouchMove = (e: unknown): void => this.forwardTouch('move', e);
  private readonly onTouchEnd = (e: unknown): void => this.forwardTouch('end', e);
  private readonly onTouchCancel = (e: unknown): void => this.forwardTouch('end', e);
  private readonly onClick = (e: { clientX: number; clientY: number }): void => this.forwardClick(e.clientX, e.clientY);

  constructor() {
    this.gesture = new GestureProvider(readGestureParams());
    this.buttons = new WechatTouchProvider(LOGICAL_WIDTH, LOGICAL_HEIGHT, /* autoBind */ false);
    this.bindWechat();
  }

  // ───────────────────────── PointerSink（逻辑坐标，Web Phaser / 测试）─────────────────────────

  pointerDown(x: number, y: number, pointerId = 0): void {
    const hit = this.buttons.hitTestLogical(x, y);
    if (hit) {
      this.activeByPointer.set(pointerId, hit);
      this.buttons.simulateDown(hit);
    } else if (this.buttons.isInControlPanelLogical(x, y)) {
      // 底部控制面板内未命中按钮 → 吞掉，不触发手势，避免按钮间隙/下方误走/跳。
      this.activeByPointer.set(pointerId, null);
    } else {
      this.gesture.pointerDown(x, y, pointerId);
    }
  }

  pointerMove(x: number, y: number, pointerId = 0): void {
    // 通道在 pointerDown 时依落点决定并稳定到抬起：按钮/吞掉通道忽略 move，手势通道继续转发。
    if (this.activeByPointer.has(pointerId)) return;
    this.gesture.pointerMove(x, y, pointerId);
  }

  pointerUp(x: number, y: number, pointerId = 0): void {
    const hit = this.activeByPointer.get(pointerId);
    if (hit) {
      this.buttons.simulateUp(hit);
    }
    // null = 控制面板吞掉；undefined = 手势通道。两种都需要清理映射。
    if (hit !== undefined) {
      this.activeByPointer.delete(pointerId);
      if (hit === null) return;
    }
    this.gesture.pointerUp(x, y, pointerId);
  }

  // ───────────────────────── RawInputProvider 采样 ─────────────────────────

  sample(): RawInputFrame {
    const bf = this.buttons.sample();
    const gf = this.gesture.sample();
    this.frame.down.clear();
    for (const s of bf.down) this.frame.down.add(s);
    for (const s of gf.down) this.frame.down.add(s);
    this.frame.pressedEdge.clear();
    for (const s of bf.pressedEdge) this.frame.pressedEdge.add(s);
    for (const s of gf.pressedEdge) this.frame.pressedEdge.add(s);
    this.frame.releasedEdge.clear();
    for (const s of bf.releasedEdge) this.frame.releasedEdge.add(s);
    for (const s of gf.releasedEdge) this.frame.releasedEdge.add(s);
    return this.frame;
  }

  reset(): void {
    this.buttons.reset();
    this.gesture.reset();
    this.activeByPointer.clear();
  }

  // ───────────────────────── 手势层转发 ─────────────────────────

  advance(dtMs: number): void {
    this.gesture.advance(dtMs);
  }

  setPlayerScreenPos(x: number, y: number): void {
    this.gesture.setPlayerScreenPos(x, y);
  }

  /** 解绑（随 Platform 生命周期；当前 Platform 与应用同生命周期，暂未调用）。 */
  destroy(): void {
    if (typeof wx !== 'undefined') {
      wx.offTouchStart?.(this.onTouchStart);
      wx.offTouchMove?.(this.onTouchMove);
      wx.offTouchEnd?.(this.onTouchEnd);
      wx.offTouchCancel?.(this.onTouchEnd);
    }
    const screenCanvas = (globalThis as { __screenCanvas?: { removeEventListener?: (t: string, h: unknown) => void } }).__screenCanvas;
    if (screenCanvas && typeof screenCanvas.removeEventListener === 'function') {
      screenCanvas.removeEventListener('click', this.onClick);
    }
    this.buttons.destroy();
  }

  // ───────────────────────── 微信端统一绑定 + 路由 ─────────────────────────

  /** 统一绑一次 wx.onTouch* + screenCanvas.click；按落点路由到 buttons 或 gesture。Web 端无 wx → 不绑。 */
  private bindWechat(): void {
    if (typeof wx === 'undefined') return; // Web：Phaser pointer 经 PointerSink 路径驱动

    let deviceW = LOGICAL_WIDTH;
    let deviceH = LOGICAL_HEIGHT;
    try {
      const info = wx.getSystemInfoSync?.();
      if (info) {
        deviceW = info.screenWidth || info.windowWidth || LOGICAL_WIDTH;
        deviceH = info.screenHeight || info.windowHeight || LOGICAL_HEIGHT;
      }
    } catch {
      /* 忽略，退回逻辑分辨率 */
    }
    const sx = LOGICAL_WIDTH / deviceW;
    const sy = LOGICAL_HEIGHT / deviceH;

    wx.onTouchStart?.(this.onTouchStart);
    wx.onTouchMove?.(this.onTouchMove);
    wx.onTouchEnd?.(this.onTouchEnd);
    wx.onTouchCancel?.(this.onTouchCancel);

    const screenCanvas = (globalThis as { __screenCanvas?: { addEventListener?: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void } }).__screenCanvas;
    if (screenCanvas && typeof screenCanvas.addEventListener === 'function') {
      screenCanvas.addEventListener('click', this.onClick);
    }

    this.sx = sx;
    this.sy = sy;
  }

  // 由 bindWechat 注入的运行时换算比例（避免在每次 touch 回调里重新查 device 尺寸）
  private sx = 1;
  private sy = 1;

  private forwardTouch(phase: 'start' | 'move' | 'end', e: unknown): void {
    const touches = (e as { changedTouches?: WxTouch[] }).changedTouches;
    if (!touches) return;
    for (const t of touches) {
      const id = typeof t.identifier === 'number' ? t.identifier : typeof t.id === 'number' ? t.id : 0;
      const px = typeof t.clientX === 'number' ? t.clientX : typeof t.x === 'number' ? t.x : 0;
      const py = typeof t.clientY === 'number' ? t.clientY : typeof t.y === 'number' ? t.y : 0;

      // 双通道去重：本次 touch 是刚那次 click 的同源模拟器鼠标事件 → 跳过转发，
      // 避免用可能失真/反向的 touch 坐标覆盖 click 已判好的意图（点右却向左走的根因）。
      if (phase === 'start' && Date.now() - this.lastEventAt < TOUCH_DEDUP_MS && this.lastSource === 'click') {
        continue;
      }
      // 记录时间戳/源（touch 已判定为真实触屏意图，正常转发）。
      this.lastEventAt = Date.now();
      this.lastSource = 'touch';

      const hit = this.buttons.hitTest(px, py);
      if (hit) {
        // 命中按钮 → 走按钮层（routeTouch 内部再做 device→logical 换算与 hitTest）
        this.buttons.routeTouch([{ identifier: id, clientX: px, clientY: py }], phase === 'end' ? 'end' : phase === 'start' ? 'start' : 'move');
      } else if (this.buttons.isInControlPanel(px, py)) {
        // 红框控制面板内未命中按钮 → 吞掉，不转手势，避免误操作。
        if (phase === 'start') this.activeByPointer.set(id, null);
        if (phase === 'end' || phase === 'move') {
          // move 无需处理；end 时清理吞掉标记，不通知 gesture。
          if (phase === 'end') this.activeByPointer.delete(id);
        }
      } else {
        const lx = px * this.sx;
        const ly = py * this.sy;
        if (phase === 'start') this.gesture.pointerDown(lx, ly, id);
        else if (phase === 'move') this.gesture.pointerMove(lx, ly, id);
        else this.gesture.pointerUp(lx, ly, id);
      }
    }
  }

  private forwardClick(clientX: number, clientY: number): void {
    const hit = this.buttons.hitTest(clientX, clientY);
    if (hit) {
      // 命中按钮 → 短按 100ms（pause 图标亦走此路径 → touch:pause）
      this.buttons.routeClick(clientX, clientY);
    } else if (!this.buttons.isInControlPanel(clientX, clientY)) {
      // 未命中按钮且不在底部控制面板 → 走手势 Tap（控制面板内点击直接吞掉，避免误操作）
      this.gesture.pointerDown(clientX * this.sx, clientY * this.sy, 0);
    }
    // click 转发后更新去重状态，使紧随其后的同源 touch 被跳过。
    this.lastEventAt = Date.now();
    this.lastSource = 'click';
  }
}
