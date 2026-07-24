/**
 * platform/wechat/wechat-audio — 远程流式音频（S05-4 / audio-design.md §3.2 / E7.S2 / P6 E5）。
 *
 * 策略：name → CDN URL 映射（assets/audio/cdn-map.json，外置，改素材不碰代码）；
 *       缺失素材期间静默不崩（known limitation，不阻塞主线）。
 * 播放走 `wx.createInnerAudioContext()`（仅微信运行时存在）；非微信环境（含测试）`wx` 未定义 →
 *       所有路径 guarded no-op，绝不抛错/阻塞主线程。实例池复用限制并发（iOS≈4、其余 6）。
 *
 * E5（P6）：streamFrom 落地（池 / volume / onError guard / iOS 池=4）；CDN 外置 assets/audio/cdn-map.json。
 * E6（P6，纯规格注释）：微信端 InnerAudioContext.volume 仅 0–1 单总线系数，无法运行时逐 SFX 调增益；
 *       故「逐 SFX 混音」必须在素材制作阶段按 audio-polish-phase6 §1.2 目标响度表渲染（mp3 烘焙），
 *       微信侧只做 master*sfx 总线调节（见 streamFrom 的 volume 赋值）。
 *
 * 平台层豁免：import wx 仅允许于 platform/wechat/*（见 core 零平台铁律）。本文件通过
 *       `globalThis.wx` 守卫访问，不引入真实 CDN URL（素材未到位，D9 待主理人提供）。
 */
import type { AudioPort } from '../platform';
import { audioConfig } from '../../core/config';
import cdnMap from '../../../assets/audio/cdn-map.json';

/** 微信端 SFX → CDN URL 映射（外置 assets/audio/cdn-map.json，D9 待主理人提供真实 URL）。 */
export const SFX_CDN: Record<string, string> = { ...cdnMap };

/**
 * iOS 旧版对同时播放的 InnerAudioContext 实例数有硬上限（约 4–5）；其余平台放宽到 6
 * （audio-polish-phase6 §3.4）。模块加载时依系统信息判定一次，非微信环境安全回退 6。
 */
function detectIosPool(): number {
  const w = globalThis as unknown as {
    wx?: { getSystemInfoSync?: () => { system?: string; platform?: string } };
  };
  const info = w.wx?.getSystemInfoSync?.();
  const sys = (info?.system ?? info?.platform ?? '').toLowerCase();
  return sys.includes('ios') ? 4 : 6;
}
const MAX_POOL = detectIosPool();

interface InnerAudioContextLike {
  src: string;
  volume?: number;
  play(): void;
  destroy?(): void;
  onError?(cb: (err: unknown) => void): void;
  onEnded?(cb: () => void): void;
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
    this.streamFrom(url);
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

  /** 出错/结束时回收实例（移出池并销毁，避免坏实例复用）。 */
  private recycle(ctx: InnerAudioContextLike): void {
    const i = this.pool.indexOf(ctx);
    if (i >= 0) this.pool.splice(i, 1);
    ctx.destroy?.();
  }

  /**
   * E5 / S05-4：远程流式播放单条 SFX。
   * 守卫：!unlocked || !url || !wx → 静默返回。
   * 取池实例 → 设 src + volume(master*sfx) → onError 仅 log+回收（绝不抛）→ play()。
   * onError 守卫确保真机弱网卡顿/404 不崩（G3 ⑦ 真机复验待 D9/E7）。
   */
  streamFrom(url: string): void {
    if (!this.unlocked) return;
    const wxImpl = getWx();
    if (!wxImpl || !url) return; // 非微信环境 / 无 URL → 静默不崩
    const ctx = this.acquire(wxImpl);
    ctx.src = url;
    if (typeof ctx.volume !== 'undefined') {
      // E6：单总线系数，无法逐 SFX 增益，故素材侧已烘焙目标响度（audio-polish-phase6 §1.2/§3.5）
      ctx.volume = (audioConfig.master ?? 1) * (audioConfig.sfx ?? 1);
    }
    try {
      ctx.onError?.((err) => {
        // 真机弱网/404：仅 log + 回收，绝不抛（防 G3 ⑦ 红错）
        console.warn('[wechat-audio] streamFrom error', err);
        this.recycle(ctx);
      });
      ctx.play();
    } catch (err) {
      console.warn('[wechat-audio] streamFrom play failed', err);
      this.recycle(ctx);
    }
  }
}
