/**
 * platform/wechat/wechat-audio — 远程流式音频（S05-4 / audio-design.md §3.2 / E7.S2）。
 *
 * 策略：name → CDN URL 映射，缺失素材期间静默不崩（known limitation，不阻塞主线）。
 * 播放走 `wx.createInnerAudioContext()`（仅微信运行时存在）；非微信环境（含测试）`wx` 未定义 →
 * 所有路径 guarded no-op，绝不抛错/阻塞主线程。实例池复用（≤6）避免频繁 new。
 *
 * 平台层豁免：import wx 仅允许于 platform/wechat/*（见 core 零平台铁律）。本文件通过
 * `globalThis.wx` 守卫访问，不引入真实 CDN URL（素材未到位，D9 待主理人提供）。
 */
import type { AudioPort } from '../platform';

/**
 * 微信端 SFX → CDN URL 映射。
 * 素材未到位期间 URL 缺省为空串/未定义；play 在 URL 缺失时静默 no-op（known limitation）。
 * D9 待主理人提供 CDN base URL（如 `https://cdn.example.com/sfx/<name>.mp3`），仅改此 map 即生效。
 */
export const SFX_CDN: Record<string, string> = {};

/** 实例池上限（audio-design.md §3.2：建议 6）。 */
const MAX_POOL = 6;

interface InnerAudioContextLike {
  src: string;
  play(): void;
  destroy?(): void;
}

interface WxLike {
  createInnerAudioContext(): InnerAudioContextLike;
}

/** 取微信全局对象；非微信环境返回 undefined（测试/Web 均如此）。 */
function getWx(): WxLike | undefined {
  return (globalThis as unknown as { wx?: WxLike }).wx;
}

export class WechatAudio implements AudioPort {
  private unlocked = false;
  /** InnerAudioContext 实例池（复用，避免频繁 new）。 */
  private readonly pool: InnerAudioContextLike[] = [];

  unlock(): void {
    this.unlocked = true;
  }

  play(name: string): void {
    if (!this.unlocked) return; // 解锁前静默
    const url = SFX_CDN[name];
    if (!url) return; // 素材未到位 → 静默 no-op（known limitation）
    const wxImpl = getWx();
    if (!wxImpl) return; // 非微信环境（含测试）→ 静默不崩
    const ctx = this.acquire(wxImpl);
    ctx.src = url;
    ctx.play();
  }

  /** 从池取空闲实例（无则新建）；池满则复用最旧，限制 new 次数。 */
  private acquire(wxImpl: WxLike): InnerAudioContextLike {
    if (this.pool.length > 0) {
      const ctx = this.pool.shift()!;
      this.pool.push(ctx);
      return ctx;
    }
    const ctx = wxImpl.createInnerAudioContext();
    if (this.pool.length < MAX_POOL) this.pool.push(ctx);
    return ctx;
  }

  /**
   * E7.S2 / S05-4 seam：远程流式音频接口占位。
   * 当前素材未到位，URL 缺失即静默；仅当 wx 可用且 URL 存在才尝试播放。
   */
  streamFrom(url: string): void {
    if (!this.unlocked) return;
    const wxImpl = getWx();
    if (!wxImpl || !url) return; // 非微信环境 / 无 URL → 静默不崩
    // TODO(S05-4): 流式播放逻辑（当前仅留钩子，不阻塞主线）
  }
}
