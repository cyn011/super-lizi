/**
 * platform/web/web-storage — localStorage 封装（GDD 11 §3 / 架构 §5.3）。
 * 仅字符串读写；SaveData 序列化由 meta 层负责。
 */
import type { StoragePort } from '../platform';

const KEY_PREFIX = 'super-mali:';

export class WebStorage implements StoragePort {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(KEY_PREFIX + key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(KEY_PREFIX + key, value);
    } catch {
      /* 隐私模式 / 配额满：静默降级 */
    }
  }
}
