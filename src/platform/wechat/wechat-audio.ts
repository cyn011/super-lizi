/**
 * platform/wechat/wechat-audio — 远程流式音频占位（GDD 09 / 架构 §5.2 / E7.S2）。
 *
 * 音乐走远程 URL（不进主包）；MVP play 仅预留钩子。unlockOnInteraction 由首次 touch 触发。
 *
 * ── E7.S2 / S05-4 接口 seam ──
 * 本文件**不实现**音频流：S05-4（audio-bus）尚未构建，故仅留清晰接口 seam，
 * 由 S05-4 来填充真实播放逻辑（wx.createInnerAudioContext().src = CDN_URL; .play()）。
 * 当前 S05-5 被 S05-4 阻塞：play() / streamFrom() 均为占位 no-op（首交互解锁后才允许，且不崩）。
 *
 * 平台层豁免：import wx 仅允许于 platform/wechat/*（见 core 零平台铁律）。
 */
import type { AudioPort } from '../platform';

export class WechatAudio implements AudioPort {
  private unlocked = false;

  unlock(): void {
    this.unlocked = true;
  }

  play(_name: string): void {
    if (!this.unlocked) return;
    // TODO(S05-4): wx.createInnerAudioContext().src = CDN_URL; .play();
  }

  /**
   * E7.S2 / S05-4 seam：远程流式音频接口占位。
   * S05-4（audio-bus）将持有 wx.createInnerAudioContext() 实例池，
   * 按 name → CDN URL 映射流式播放（音乐不进主包，control-list §2）。
   * 当前仅留钩子：S05-5 被 S05-4 阻塞，不实现播放逻辑。
   */
  streamFrom(_url: string): void {
    if (!this.unlocked) return;
    // TODO(S05-4): const ctx = wx.createInnerAudioContext(); ctx.src = _url; ctx.play();
  }
}
