/**
 * platform/wechat/share — 微信分享（转发）+ 关卡深链端口（SharePort 实现）。
 *
 * 全部 wx.* 调用均判空 + try/catch，非微信 / 测试环境调用不抛错（no-op）。
 * 参考 lifecycle.ts 的 `(globalThis as { wx?: ... }).wx` 宽松类型转换，无需改 weapp-adapter.d.ts。
 */
import type { SharePort } from '../platform';

/** 微信全局对象（宽松类型，仅用到的字段）。 */
interface WxLike {
  getLaunchOptionsSync?: () => { query?: Record<string, string> } | undefined;
  showShareMenu?: (opts: { menus: string[] }) => void;
  onShareAppMessage?: (cb: () => unknown) => void;
  onShow?: (cb: (opts: { query?: Record<string, string> }) => void) => void;
}

function getWx(): WxLike | undefined {
  return (globalThis as { wx?: WxLike }).wx;
}

export class WechatShare implements SharePort {
  /** 冷启动 query（getLaunchOptionsSync），onShow 持续更新。 */
  private launchQuery: Record<string, string> = {};
  /** 分享附加上下文（如 { level: '2-3' }），随转发 query 携带。 */
  private context: Record<string, string> = {};

  constructor() {
    const wx = getWx();
    try {
      const lo = wx?.getLaunchOptionsSync?.();
      if (lo?.query) this.launchQuery = lo.query;
    } catch {
      /* 非微信环境 / 异常 → 空 query，不抛错 */
    }
    // 深链：以冷启动 query 种子化分享 context，使首次分享（甚至 loadLevel 前）即带正确关卡，
    // 仍可被后续 updateContext（loadLevel 当前关）覆盖——保证分享卡始终是「当前所在关」。
    this.context = { ...this.launchQuery };
    try {
      wx?.onShow?.((opts) => {
        const q = (opts as { query?: Record<string, string> })?.query;
        if (q) this.launchQuery = q;
      });
    } catch {
      /* 非微信环境 / 异常 → 不注册，不抛错 */
    }
  }

  enableShare(title: string): void {
    const wx = getWx();
    try {
      wx?.showShareMenu?.({ menus: ['shareAppMessage'] });
    } catch {
      /* 非微信环境 / 异常 → no-op 不抛错 */
    }
    try {
      wx?.onShareAppMessage?.(() => ({
        title,
        query: this.queryString(),
      }));
    } catch {
      /* 非微信环境 / 异常 → no-op 不抛错 */
    }
  }

  updateContext(ctx: Record<string, string>): void {
    Object.assign(this.context, ctx);
  }

  getLaunchQuery(): Record<string, string> {
    return this.launchQuery;
  }

  /** 把 context 拼成 url query 串（值 encodeURIComponent）。 */
  private queryString(): string {
    return Object.entries(this.context)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }
}
