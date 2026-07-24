/**
 * platform/wechat/wechat-platform — 微信小游戏平台聚合（架构 §5）。
 * 输入按 inputConfig.wechat.layout 选择：
 *   - "gesture"（默认）：GestureProvider（点击/滑动手势），真机 wx.onTouch* 转发到它。
 *   - "virtual"（调试回退 / ?buttons=1）：旧 WechatTouchProvider（四钮）。
 * storage/audio 直接调用 wx.*。
 */
import type { Platform } from '../platform';
import type { RawInputProvider } from '../../core/input/raw-input';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../detect';
import { GestureProvider, type GestureParams } from '../gesture-provider';
import type { PointerSink } from '../raw-input-provider';
import { WechatTouchProvider } from './wechat-touch';
import { WechatStorage } from './wechat-storage';
import { WechatAudio } from './wechat-audio';
import { WechatLifecycle } from './lifecycle';
import { NativeButtonRouter } from './native-button-router';
import { setMenuActive as setGateMenuActive } from './input-gate';
import { inputConfig } from '../../core/config';

/** 从 input-config.json 读取手势参数（wechat.gesture 块未在 core 类型中声明，此处本地断言）。 */
function readGestureParams(): GestureParams {
  const g = (inputConfig.wechat as unknown as { gesture?: Record<string, number> }).gesture;
  if (!g) {
    throw new Error('[wechat-platform] inputConfig.wechat.gesture 缺失，无法启用 gesture 布局');
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

/** 调试强制 virtual：Web 端 ?buttons=1；微信无 URL，仅由 layout 配置驱动。 */
function isForceVirtual(): boolean {
  if (typeof location === 'undefined') return false;
  try {
    return new URLSearchParams(location.search).get('buttons') === '1';
  } catch {
    return false;
  }
}

export function createWechatPlatform(): Platform {
  const useGesture = !isForceVirtual() && inputConfig.wechat.layout !== 'virtual';
  let input: RawInputProvider;

  if (useGesture) {
    // 默认手势布局：GestureProvider 产出 touch:* 信号（core 原样消费）。
    const gesture = new GestureProvider(readGestureParams());
    attachWechatTouch(gesture); // 真机触屏 + 模拟器鼠标（wx.onTouch* + screenCanvas.click）转发；微信端不在 game-scene 注册 Phaser pointer
    input = gesture;
  } else {
    // 调试回退：旧四钮虚拟按钮（自带 wx 事件绑定）。
    input = new WechatTouchProvider(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  // E7.S3 / S05-5：生命周期端口（wx.onHide/onShow → 回调，策略在 core/state/run-lifecycle）。
  const lifecycle = new WechatLifecycle();
  // E7.S3 / S05-5：原生菜单点击路由（wx 触摸 → 逻辑坐标 → game-scene 注入的 routeMenuTap）。
  const router = new NativeButtonRouter(LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const w = (globalThis as unknown as { wx: { onHide(cb: () => void): void; onShow(cb: () => void): void } }).wx;
  // 把主角屏幕坐标转发给当前输入（gesture 有 setPlayerScreenPos；virtual 的 WechatTouchProvider 无 → no-op）。
  const posSink = input as Partial<{ setPlayerScreenPos?(x: number, y: number): void }>;
  return {
    env: 'wechat',
    reduceMotion: false, // P6 整改 D3：默认关闭；后续可由微信系统设置注入
    input,
    audio: new WechatAudio(),
    storage: new WechatStorage(),
    lifecycle,
    setPlayerScreenPos: (x: number, y: number) => posSink.setPlayerScreenPos?.(x, y),
    // S05-5：菜单激活门（屏蔽 gameplay 转发）+ 原生菜单路由注入（均仅微信端生效，Web 端不传）。
    setMenuActive: (active: boolean) => setGateMenuActive(active),
    setNativeMenuTap: (cb: (x: number, y: number) => void) => router.setRouteTap(cb),
  };
}

/**
 * 真机触屏：wx.onTouchStart/Move/End 的触点坐标换算到逻辑分辨率后转发到 GestureProvider。
 * 模拟器鼠标模式只报 pointerdown（无 move/up），由 game-scene 经 Phaser pointer 事件转发，
 * 两者互补；同环境不会重复触发（模拟器走 Phaser、真机走 wx，见设计文档 §8）。
 */
/** 双通道去重窗口（ms）。微信开发者工具鼠标模式下一次点击会同时触发 wx.onTouch* 与
 *  screenCanvas.click 两条通道，二者都喂同一 GestureProvider 且 id 同为 0；后到的 touch
 *  会用模拟器下可能失真/反向的 clientX 覆盖 click 已判好的意图，造成"点右半屏却向左走"。
 *  窗口内紧接 click 的 touch 判定为同源模拟器鼠标事件并跳过，从而消除覆盖/反转；
 *  真机触屏无成对 click，不受影响。 */
const TOUCH_DEDUP_MS = 150;

function attachWechatTouch(gesture: PointerSink): void {
  const wx = (globalThis as { wx?: { onTouchStart?: (cb: (e: unknown) => void) => void; onTouchMove?: (cb: (e: unknown) => void) => void; onTouchEnd?: (cb: (e: unknown) => void) => void; onTouchCancel?: (cb: (e: unknown) => void) => void; getSystemInfoSync?: () => { screenWidth?: number; windowWidth?: number; screenHeight?: number; windowHeight?: number } } }).wx;
  if (!wx || typeof wx.onTouchStart !== 'function') return;

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

  // 双通道去重状态（闭包级，每次 attach 独立）。lastSource 初始 'touch'：
  // 真机先到的 touch 永不被误判为"click 同源"，去重只在"touch 紧接 click"时触发。
  let lastEventAt = 0;
  let lastSource: 'click' | 'touch' = 'touch';

  const forward = (phase: string, e: unknown, fn: (x: number, y: number, id: number) => void): void => {
    const touches = (e as { changedTouches?: Array<{ clientX?: number; clientY: number; x?: number; pageX?: number; pageY?: number; identifier?: number; id?: number }> }).changedTouches;
    if (!touches) return;
    for (const t of touches) {
      const id = typeof t.identifier === 'number' ? t.identifier : typeof t.id === 'number' ? t.id : 0;

      // 坐标字段诊断：模拟器下确认 clientX 是否有效（非 undefined/NaN，且与 click 量级一致）。
      if (phase === 'start') {
        console.log('[gesture][wx-touch] field-probe clientX=', t.clientX, 'x=', t.x, 'pageX=', t.pageX, 'clientY=', t.clientY, 'pageY=', t.pageY);
      }

      // 双通道去重：本次 touch 是刚那次 click 的同源模拟器鼠标事件 → 跳过转发，
      // 避免用可能失真/反向的 touch 坐标覆盖 click 已判好的意图（点右却向左走的根因）。
      if (Date.now() - lastEventAt < TOUCH_DEDUP_MS && lastSource === 'click') {
        if (phase === 'start') console.log('[gesture][wx-touch] dedup-skip (paired with click)');
        continue;
      }

      // 记录时间戳/源（touch 已判定为真实触屏意图，正常转发）。
      lastEventAt = Date.now();
      lastSource = 'touch';

      // 防御性回退：clientX 明确无效（undefined/NaN）时退 t.x（同口径乘 sx）；否则保持 clientX。
      let cx = t.clientX;
      if (typeof cx !== 'number' || Number.isNaN(cx)) {
        cx = typeof t.x === 'number' ? t.x : 0;
      }
      const x = cx * sx;
      const y = t.clientY * sy;

      // 诊断：仅 start 阶段打印（raw → logical），便于复现"坐标失真/不触发"问题。
      if (phase === 'start') {
        console.log('[gesture][wx-touch]', phase, 'raw=', t.clientX, t.clientY, 'logical=', x, y);
      }
      fn(x, y, id);
    }
  };

  wx.onTouchStart?.((e) => forward('start', e, (x, y, id) => gesture.pointerDown(x, y, id)));
  wx.onTouchMove?.((e) => forward('move', e, (x, y, id) => gesture.pointerMove(x, y, id)));
  wx.onTouchEnd?.((e) => forward('end', e, (x, y, id) => gesture.pointerUp(x, y, id)));
  wx.onTouchCancel?.((e) => forward('cancel', e, (x, y, id) => gesture.pointerUp(x, y, id)));

  // R2-fix：模拟器鼠标模式主通道。微信开发者工具鼠标模式点击圆钮走 screenCanvas.click
  // （坐标用 px*(logical/device) 换算，与 WechatTouchProvider.onCanvasClick 同法），
  // click 单指、无 move/up，对应 GestureProvider Tap 态（beginIntent 处理单点，
  // advance 计时器自动释放行走/跳跃）。真机 touch 仍走上方 wx.onTouch*，两者互补不冲突。
  // 注意：click 转发后更新 lastEventAt/lastSource，使紧随其后的同源 touch 被去重跳过。
  const screenCanvas = (globalThis as { __screenCanvas?: { addEventListener?: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void } }).__screenCanvas;
  if (screenCanvas && typeof screenCanvas.addEventListener === 'function') {
    screenCanvas.addEventListener('click', (e: { clientX: number; clientY: number }) => {
      const x = e.clientX * sx;
      const y = e.clientY * sy;
      console.log('[gesture][screenCanvas-click]', 'raw=', e.clientX, e.clientY, 'logical=', x, y);
      lastEventAt = Date.now();
      lastSource = 'click';
      gesture.pointerDown(x, y, 0);
    });
  }
}
