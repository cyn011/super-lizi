/**
 * platform/wechat/wechat-storage — wx.setStorageSync 封装（GDD 11 §3 / 架构 §5.3）。
 */
import type { StoragePort } from '../platform';

const KEY_PREFIX = 'libao-da-maoxian:';

export class WechatStorage implements StoragePort {
  get(key: string): string | null {
    try {
      const w = (globalThis as unknown as { wx: { getStorageSync(k: string): string } }).wx;
      return w.getStorageSync(KEY_PREFIX + key) ?? null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      const w = (globalThis as unknown as { wx: { setStorageSync(k: string, v: string): void } }).wx;
      w.setStorageSync(KEY_PREFIX + key, value);
    } catch {
      /* 降级静默 */
    }
  }
}
