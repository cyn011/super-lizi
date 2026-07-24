/**
 * core/state/run-lifecycle — 微信生命周期闭环策略（E7.S3 / S05-5）。
 *
 * 纯逻辑层（零 Phaser / 零平台 API，可在 Node 下单测）。
 * 它只持有 RunStateMachine 引用 + 一个 emit（事件总线接口），负责「何时该发 ON_PAUSE / ON_RESUME」
 * 的策略判定，并跟踪「本次暂停是否由后台（onHide）触发」：
 *
 *   - onHide：仅 PLAYING 态才后台暂停，置 backgroundPaused 标记。
 *   - onShow：仅当「本次暂停确由后台触发」才恢复；手动暂停（双指/动作键）不被自动恢复
 *     （避免 onShow 重复弹菜单 / 误恢复）。
 *
 * 关键铁律（control-list §4 第5项 / GDD 01 §7）：本控制器**绝不触碰输入状态**
 * （不 reset 输入提供方、不清除按下集合）。输入连续性由「不清除」保证：
 * 后台期间玩家仍按住的手指在 onShow 后原样保留（无跳变），仿真恢复后手感连续。
 *
 * 状态转移（RunStateMachine.transition）仍由 game-scene 的 ON_PAUSE / ON_RESUME 处理器执行
 * （单一事实来源，与 S05-2 既有接线一致）；本控制器只发事件。测试中以相同方式接线以验证
 * 「事件 → RunStateMachine 转移正确」。
 */
import type { RunStateMachine } from './run-state-machine';
import { ON_PAUSE, ON_RESUME } from '../events/event-bus';

export type LifecycleEmit = (name: string, payload?: unknown) => void;

export class RunLifecycle {
  /** 本次暂停是否由后台（onHide）触发。仅此标记为真时 onShow 才自动恢复。 */
  private backgroundPaused = false;

  constructor(
    private readonly run: RunStateMachine,
    private readonly emit: LifecycleEmit,
  ) {}

  /**
   * 对应 onHide。仅 PLAYING 时后台暂停（仿真冻结由 game-scene 的 ON_PAUSE 处理器早退实现）。
   * 非 PLAYING（如已手动暂停 / 结算 / GameOver）→ 不动（不重复暂停、不误标记）。
   * 不触碰输入（输入连续）。
   */
  onHide(): void {
    if (this.run.state !== 'PLAYING') return;
    this.backgroundPaused = true;
    this.emit(ON_PAUSE, { source: 'onHide', background: true });
  }

  /**
   * 对应 onShow。仅当「本次暂停确由后台触发」才恢复仿真；
   * 手动暂停（backgroundPaused=false）不被自动恢复（不重复弹菜单）。
   * 异常态（已非 PAUSED，如期间被手动恢复）→ 清标记后安全退出。
   * 不触碰输入（输入连续）。
   */
  onShow(): void {
    if (!this.backgroundPaused) return; // 手动暂停 / 已清除 → 不自动恢复
    if (this.run.state !== 'PAUSED') {
      this.backgroundPaused = false; // 异常态兜底：清标记
      return;
    }
    this.backgroundPaused = false;
    this.emit(ON_RESUME, { source: 'onShow', background: true });
  }

  /** 重开 / 新开一局：清后台暂停标记，避免上局的后台暂停态污染新局。 */
  reset(): void {
    this.backgroundPaused = false;
  }

  /** 测试 / 调试用：当前是否处于「后台触发的暂停」。 */
  get isBackgroundPaused(): boolean {
    return this.backgroundPaused;
  }
}
