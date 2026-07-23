/**
 * platform/web/web-audio — WebAudio 占位（GDD 09 / 架构 §5.2）。
 * MVP：首次交互解锁 AudioContext，play 仅记录/静音，不加载任何音频文件（包体策略）。
 * 资产就绪后在此映射真实音效，不破结构。
 */
import type { AudioPort } from '../platform';

export class WebAudio implements AudioPort {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      void this.ctx.resume();
      this.unlocked = true;
    } catch {
      /* 无 WebAudio：静默 */
    }
  }

  play(_name: string): void {
    if (!this.ctx) return;
    // TODO(E2/S3): 用振荡器合成短音（零文件进包）。占位阶段仅预留钩子。
  }
}
