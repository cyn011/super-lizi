/**
 * platform/wechat/input-gate — 菜单激活门（E7.S3 / S05-5）。
 *
 * 模块级可变标志，供「微信原生输入」双通道共享：
 *   - gameplay 输入转发（attachWechatTouch）：门开（菜单激活）时跳过，避免菜单点击
 *     顺带驱动角色（仿真冻结期不采样，但恢复瞬间可能残留 1 帧手势）。
 *   - 原生菜单路由（native-button-router）：门开时把点击派发给 PauseMenu/ResultScreen.handleTap。
 *
 * 由 game-scene 在暂停/结算/GameOver 时 setMenuActive(true)，恢复/重开时 setMenuActive(false)
 * （经 Platform.setMenuActive 注入）。门默认关（menuActive=false）→ 正常 gameplay 不受影响。
 *
 * 设计取舍：不采用「菜单点击后 reset 输入」方案——那会清除后台暂停期间仍按住的手指，
 * 违反 control-list §4 第5项「输入状态连续不丢」。门控只「屏蔽新触摸进入 gameplay」，
 * 已按住的旧手势原样保留（恢复后连续）。
 */
let menuActive = false;

/** game-scene 据 RunState 切换菜单可见性时调用。 */
export function setMenuActive(active: boolean): void {
  menuActive = active;
}

/** gameplay 转发 / 菜单路由共享读取。 */
export function isMenuActive(): boolean {
  return menuActive;
}
