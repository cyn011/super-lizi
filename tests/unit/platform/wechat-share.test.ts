/**
 * tests/unit/platform/wechat-share.test.ts — 微信分享（转发）+ 关卡深链端口（SharePort）单测。
 *
 * 纯 Node（零 Phaser / 零真实 wx）。用 globalThis.wx stub 覆盖：
 *   showShareMenu / onShareAppMessage / getLaunchOptionsSync / onShow。
 * 验证：
 *   1) enableShare 调用 showShareMenu 且 menus 含 'shareAppMessage'；
 *   2) onShareAppMessage 被注册，回调返回 { title, query }（来自冷启动 query）；
 *   3) updateContext 后 query 串随 context 变化；
 *   4) getLaunchQuery 返回冷启动 query；
 *   5) 删除 globalThis.wx 后 enableShare / getLaunchQuery 不抛错（no-op 路径）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WechatShare } from '../../../src/platform/wechat/share';

interface WxStub {
  showShareMenu: (opts: { menus: string[] }) => void;
  onShareAppMessage: (cb: () => unknown) => void;
  getLaunchOptionsSync: () => { query?: Record<string, string> };
  onShow: (cb: (opts: { query?: Record<string, string> }) => void) => void;
}

/** 安装 wx stub，记录被注册的回调。返回句柄供断言。 */
function installWx(): {
  wx: WxStub;
  shareMenuCalls: Array<{ menus: string[] }>;
  shareCb?: () => unknown;
  showCb?: (opts: { query?: Record<string, string> }) => void;
} {
  const shareMenuCalls: Array<{ menus: string[] }> = [];
  let shareCb: (() => unknown) | undefined;
  let showCb: ((opts: { query?: Record<string, string> }) => void) | undefined;

  const wx = {
    showShareMenu: (opts: { menus: string[] }) => {
      shareMenuCalls.push(opts);
    },
    onShareAppMessage: (cb: () => unknown) => {
      shareCb = cb;
    },
    getLaunchOptionsSync: () => ({ query: { level: '2-3' } }),
    onShow: (cb: (opts: { query?: Record<string, string> }) => void) => {
      showCb = cb;
    },
  };

  (globalThis as unknown as { wx: WxStub }).wx = wx;
  return { wx, shareMenuCalls, get shareCb() { return shareCb; }, get showCb() { return showCb; } };
}

afterEach(() => {
  // 还原 globalThis.wx，避免污染其它用例。
  // @ts-expect-error 测试辅助：显式删除 globalThis.wx。
  delete globalThis.wx;
});

describe('WechatShare · 转发菜单 + 深链 query', () => {
  it('enableShare 调用 showShareMenu 且 menus 含 shareAppMessage', () => {
    const h = installWx();
    const share = new WechatShare();

    share.enableShare('栗宝大冒险 · 一起来跳！');

    expect(h.shareMenuCalls).toHaveLength(1);
    expect(h.shareMenuCalls[0].menus).toContain('shareAppMessage');
  });

  it('onShareAppMessage 被注册，回调返回 { title, query }（来自冷启动 query）', () => {
    const h = installWx();
    const share = new WechatShare();

    share.enableShare('栗宝大冒险 · 一起来跳！');

    expect(h.shareCb).toBeTypeOf('function');
    const res = (h.shareCb as () => { title: string; query: string })();
    expect(res).toEqual({ title: '栗宝大冒险 · 一起来跳！', query: 'level=2-3' });
  });

  it('getLaunchQuery 返回冷启动 query { level: "2-3" }', () => {
    installWx();
    const share = new WechatShare();

    expect(share.getLaunchQuery()).toEqual({ level: '2-3' });
  });

  it('updateContext 后转发 query 串随 context 变化', () => {
    const h = installWx();
    const share = new WechatShare();
    share.enableShare('栗宝大冒险 · 一起来跳！');

    share.updateContext({ level: '2-2' });
    const res = (h.shareCb as () => { title: string; query: string })();
    expect(res.query).toBe('level=2-2');
  });

  it('onShow 持续更新 launchQuery（深链随热启动变化）', () => {
    const h = installWx();
    const share = new WechatShare();

    h.showCb?.({ query: { level: '1-1' } });
    expect(share.getLaunchQuery()).toEqual({ level: '1-1' });
  });
});

describe('WechatShare · 非微信环境 no-op（不抛错）', () => {
  it('无 globalThis.wx 时 enableShare / getLaunchQuery 不抛错', () => {
    // @ts-expect-error 测试辅助：确保 wx 不存在
    delete globalThis.wx;

    const share = new WechatShare();
    expect(() => share.enableShare('栗宝大冒险 · 一起来跳！')).not.toThrow();
    expect(() => share.updateContext({ level: '2-3' })).not.toThrow();
    expect(() => share.getLaunchQuery()).not.toThrow();
    expect(share.getLaunchQuery()).toEqual({});
  });

  it('wx 方法缺失时 enableShare 仍安全返回（不抛错）', () => {
    // 仅提供部分字段（无 showShareMenu / onShareAppMessage）。
    (globalThis as unknown as { wx: Record<string, unknown> }).wx = {
      getLaunchOptionsSync: () => ({ query: {} }),
    };
    const share = new WechatShare();
    expect(() => share.enableShare('栗宝大冒险 · 一起来跳！')).not.toThrow();
  });
});
