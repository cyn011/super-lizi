/**
 * 微信小游戏平台聚合（架构 §5）。
 *
 * 融合为唯一模式（用户拍板）：键盘（始终合并，不冲突）+ 融合层（按钮 + 手势）。
 * - 不再有 layout 二选一：原 `layout === 'gesture'` 走纯手势、`layout === 'buttons'/'virtual'` 走四钮
 *   的两条分支删除；永远走融合（按钮浮层常驻可点 + 屏幕其它区域拖拽即手势）。
 * - 融合层（FusionInput）统一绑一次 wx.onTouch* + screenCanvas.click，按落点路由：命中按钮 → 按钮 press，
 *   未命中 → GestureProvider 手势；保留双通道去重（模拟器 click 与 touch 同源不覆盖）。
 * - input-config.json 的 wechat.gesture 参数块仍由 FusionInput 读取（手势层仍需），但 layout 切换删除。
 */
import type { Platform } from '../platform';
import { makeCompositeInput } from '../composite-input';
import { WebKeyboardProvider } from '../web/web-keyboard';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../detect';
import { WechatStorage } from './wechat-storage';
import { WechatAudio } from './wechat-audio';
import { WechatLifecycle } from './lifecycle';
import { NativeButtonRouter } from './native-button-router';
import { setMenuActive as setGateMenuActive } from './input-gate';
import { WechatShare } from './share';
import { FusionInput } from '../fusion-input';

export function createWechatPlatform(): Platform {
  // 融合为唯一模式：键盘（始终合并，不冲突）+ 融合层（按钮 + 手势）。
  // 微信无物理键盘，WebKeyboardProvider.attach 在微信端为 no-op（window 兜底），合并仅保证"键盘路径"一致。
  const keyboard = new WebKeyboardProvider();
  keyboard.attach();

  // 永远走融合：按钮浮层常驻 + 屏幕任意区域拖拽即手势。无纯手势开关。
  const input = makeCompositeInput(keyboard, new FusionInput());

  // E7.S3 / S05-5：生命周期端口（wx.onHide/onShow → 回调，策略在 core/state/run-lifecycle）。
  const lifecycle = new WechatLifecycle();
  // E7.S3 / S05-5：原生菜单点击路由（wx 触摸 → 逻辑坐标 → game-scene 注入的 routeMenuTap）。
  const router = new NativeButtonRouter(LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const share = new WechatShare();
  return {
    env: 'wechat',
    reduceMotion: false, // P6 整改 D3：默认关闭；后续可由微信系统设置注入
    input,
    audio: new WechatAudio(),
    storage: new WechatStorage(),
    lifecycle,
    // 把主角屏幕坐标转发给融合层 → 手势层 setPlayerScreenPos（按钮层无此方法 → no-op）。
    setPlayerScreenPos: (x: number, y: number) => input.setPlayerScreenPos?.(x, y),
    // S05-5：菜单激活门（屏蔽 gameplay 转发）+ 原生菜单路由注入（均仅微信端生效，Web 端不传）。
    setMenuActive: (active: boolean) => setGateMenuActive(active),
    setNativeMenuTap: (cb: (x: number, y: number) => void) => router.setRouteTap(cb),
    // 微信分享（转发）+ 关卡深链；Web 端不传（undefined）。
    share,
  };
}
