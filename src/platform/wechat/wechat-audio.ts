/**
 * platform/wechat/wechat-audio — 远程流式音频占位（GDD 09 / 架构 §5.2）。
 * 音乐走远程 URL（不进主包）；MVP play 仅预留钩子。unlockOnInteraction 由首次 touch 触发。
 */
import type { AudioPort } from '../platform';

export class WechatAudio implements AudioPort {
  private unlocked = false;

  unlock(): void {
    this.unlocked = true;
  }

  play(_name: string): void {
    if (!this.unlocked) return;
    // TODO(E2/S3): wx.createInnerAudioContext().src = CDN_URL; .play();
  }
}
