/**
 * platform/wechat/lifecycle — 微信生命周期端口（E7.S3 / S05-5）。
 *
 * 实现 LifecyclePort：把外部传入的 onHide/onShow 回调注册到微信全局 wx。
 * 策略判定（何时该发 ON_PAUSE / ON_RESUME、后台 / 手动暂停区分、输入连续性）
 * 在 core/state/run-lifecycle（纯逻辑、可单测）中；本文件只做「wx 事件 → 回调」的接线，
 * 平台层豁免 import wx（见 core 零平台铁律：仅 platform/wechat/* 可 import wx）。
 */
import type { LifecyclePort } from '../platform';

/** 微信 onHide 回调类型。 */
type HideCb = () => void;
/** 微信 onShow 回调类型。 */
type ShowCb = () => void;

export class WechatLifecycle implements LifecyclePort {
  onHide(cb: HideCb): void {
    const wx = (globalThis as { wx?: { onHide?: (cb: HideCb) => void } }).wx;
    wx?.onHide?.(cb);
  }

  onShow(cb: ShowCb): void {
    const wx = (globalThis as { wx?: { onShow?: (cb: ShowCb) => void } }).wx;
    wx?.onShow?.(cb);
  }
}
