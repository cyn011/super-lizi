/**
 * platform/web/web-platform — Web 平台聚合（架构 §5）。
 *
 * 融合为唯一模式（用户拍板）：键盘（WebKeyboardProvider）始终合并 + 融合层（按钮 + 手势）。
 * - 按钮浮层常驻可点（TouchButtons 在 game-scene 创建）+ 屏幕任意其它区域拖拽即手势
 *   （GestureProvider，以主角屏幕位置为原点判定）+ 键盘始终可用。不再有二选一开关。
 * - 旧 `?gesture=1` / `?buttons=1` 覆盖与 `isForceVirtual` 二选一逻辑已移除：融合永远是默认。
 * - input-config.json 的 wechat.gesture 参数块仍由 FusionInput 读取（手势层仍需），但 layout 切换删除。
 */
import type { Platform } from '../platform';
import { makeCompositeInput } from '../composite-input';
import { WebKeyboardProvider } from './web-keyboard';
import { WebStorage } from './web-storage';
import { WebAudio } from './web-audio';
import { FusionInput } from '../fusion-input';

export function createWebPlatform(): Platform {
  const keyboard = new WebKeyboardProvider();
  keyboard.attach(); // F4 修复：绑定 DOM 键盘监听，否则 Web 键盘输入完全失效

  // 融合唯一模式：键盘 + 融合层（按钮命中优先，未命中走手势）合并为单一输入。
  const input = makeCompositeInput(keyboard, new FusionInput());

  return {
    env: 'web',
    reduceMotion: false, // P6 整改 D3：默认关闭；后续可由 prefers-reduced-motion / 设置项注入
    input,
    audio: new WebAudio(),
    storage: new WebStorage(),
    lifecycle: {
      onHide: () => {},
      onShow: () => {},
    },
    // 把主角屏幕坐标转发给融合层 → 手势层 setPlayerScreenPos（按钮层无此方法 → no-op）。
    setPlayerScreenPos: (x: number, y: number) => input.setPlayerScreenPos?.(x, y),
    // 微信分享端口：Web 端无此能力，no-op（undefined → game/boot 用 ?. 安全跳过）。
    share: undefined,
  };
}
