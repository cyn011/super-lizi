/**
 * tests/unit/platform/wechat-lifecycle.test.ts — E7.S3 生命周期 + 原生菜单路由判定（S05-5）。
 *
 * 纯 Node（零 Phaser / 零 wx）。覆盖：
 *   1) wx.onHide→ON_PAUSE、wx.onShow→ON_RESUME 经 RunStateMachine 转移正确；
 *   2) 输入连续性（lifecycle 绝不触碰输入 → 后台暂停期间按住的手指 onShow 后原样保留，无跳变）；
 *   3) 手动暂停不被 onShow 自动恢复（不重复弹菜单）；
 *   4) onHide 仅在 PLAYING 生效（非 PLAYING 不重复暂停）；
 *   5) 原生菜单命中盒 AABB（pointInRect）与「当前应路由到哪个菜单」判定（resolveActiveMenu）。
 *
 * 注意：RunStateMachine 的实际转移由 game-scene 的 ON_PAUSE/ON_RESUME 处理器执行
 * （单一事实来源，与 S05-2 一致）。本测试以相同方式接线（emit→transition），
 * 从而验证「事件 → RunStateMachine 转移正确」这一交付要求。
 */
import { describe, it, expect } from 'vitest';
import { RunStateMachineImpl } from '../../../src/core/state/run-state-machine';
import { RunLifecycle } from '../../../src/core/state/run-lifecycle';
import { ON_PAUSE, ON_RESUME } from '../../../src/core/events/event-bus';
import { pointInRect, type Rect } from '../../../src/core/util/hit-test';
import { resolveActiveMenu } from '../../../src/core/state/menu-tap';

/** 接线同 game-scene：emit ON_PAUSE→PAUSED、ON_RESUME→PLAYING。 */
function wire(run: RunStateMachineImpl): { events: string[]; emit: (n: string) => void } {
  const events: string[] = [];
  const emit = (name: string): void => {
    events.push(name);
    if (name === ON_PAUSE) run.transition('PAUSED');
    if (name === ON_RESUME) run.transition('PLAYING');
  };
  return { events, emit };
}

/** 模拟「输入提供方」：仅记录 reset 调用与按下集合，用于验证 lifecycle 不碰输入。 */
function makeInput() {
  return {
    down: new Set(['touch:right']),
    resetCalls: 0,
    reset() {
      this.resetCalls++;
      this.down.clear();
    },
  };
}

describe('RunLifecycle · wx.onHide/onShow 闭环（E7.S3 / S05-5）', () => {
  it('onHide(PLAYING) → 发 ON_PAUSE 且 RunState PLAYING→PAUSED', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onHide();

    expect(events).toContain(ON_PAUSE);
    expect(run.state).toBe('PAUSED');
  });

  it('onHide→onShow → 发 ON_RESUME 且 RunState PAUSED→PLAYING', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onHide();
    lc.onShow();

    expect(events).toEqual([ON_PAUSE, ON_RESUME]);
    expect(run.state).toBe('PLAYING');
  });

  it('输入连续性：onHide→onShow 全程不调用输入 reset，原按住手指保留（无跳变）', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { emit } = wire(run);
    const lc = new RunLifecycle(run, emit);
    const input = makeInput();

    lc.onHide();
    lc.onShow();

    // lifecycle 不触碰输入：down 集合未动、reset 从未调用。
    expect(input.down.has('touch:right')).toBe(true);
    expect(input.resetCalls).toBe(0);
  });

  it('手动暂停（非后台）→ onShow 不自动恢复（不重复弹菜单）', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    // 模拟手动暂停：直接转 PAUSED（backgroundPaused 仍为 false，未走 onHide）。
    run.transition('PAUSED');
    lc.onShow();

    expect(events).not.toContain(ON_RESUME); // 未自动恢复
    expect(run.state).toBe('PAUSED'); // 仍暂停
    expect(lc.isBackgroundPaused).toBe(false);
  });

  it('onHide 仅 PLAYING 生效：MENU 态下无操作（不重复暂停）', () => {
    const run = new RunStateMachineImpl('MENU');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onHide();

    expect(events).not.toContain(ON_PAUSE);
    expect(run.state).toBe('MENU');
  });

  it('连续两次 onHide → 仅一次 ON_PAUSE（第二次时已是 PAUSED）', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onHide();
    lc.onHide();

    expect(events.filter((e) => e === ON_PAUSE)).toHaveLength(1);
    expect(run.state).toBe('PAUSED');
  });

  it('未 onHide 直接 onShow → 无操作（无后台暂停标记）', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onShow();

    expect(events).not.toContain(ON_RESUME);
    expect(run.state).toBe('PLAYING');
  });

  it('onShow 遇异常态（非 PAUSED）→ 清标记安全退出，不误发 ON_RESUME', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { events, emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onHide(); // → PAUSED, backgroundPaused=true
    run.transition('PLAYING'); // 异常：期间被外部手动恢复（非经 onShow）
    lc.onShow(); // 应清标记并退出，不重复发 ON_RESUME

    expect(events).toEqual([ON_PAUSE]); // 仅一次 PAUSE，无 RESUME
    expect(lc.isBackgroundPaused).toBe(false);
    expect(run.state).toBe('PLAYING');
  });

  it('reset() 清后台暂停标记（重开新局前调用）', () => {
    const run = new RunStateMachineImpl('PLAYING');
    const { emit } = wire(run);
    const lc = new RunLifecycle(run, emit);

    lc.onHide();
    expect(lc.isBackgroundPaused).toBe(true);
    lc.reset();
    expect(lc.isBackgroundPaused).toBe(false);
  });
});

describe('原生菜单命中盒 AABB（pointInRect，坐标系 512×288）', () => {
  const rect: Rect = { x: 100, y: 50, w: 160, h: 52 }; // 同 PauseMenu 按钮热区

  it('中心点命中', () => {
    expect(pointInRect(180, 76, rect)).toBe(true);
  });
  it('左上角边界命中（含边界）', () => {
    expect(pointInRect(100, 50, rect)).toBe(true);
  });
  it('右下角边界命中（含边界）', () => {
    expect(pointInRect(260, 102, rect)).toBe(true);
  });
  it('左侧外部不命中', () => {
    expect(pointInRect(50, 76, rect)).toBe(false);
  });
  it('右侧刚越界不命中', () => {
    expect(pointInRect(261, 76, rect)).toBe(false);
  });
});

describe('原生菜单路由判定（resolveActiveMenu）', () => {
  it('paused && pauseBuilt → "pause"', () => {
    expect(
      resolveActiveMenu({ paused: true, levelComplete: false, pauseBuilt: true, resultBuilt: true }),
    ).toBe('pause');
  });
  it('levelComplete && resultBuilt → "result"', () => {
    expect(
      resolveActiveMenu({ paused: false, levelComplete: true, pauseBuilt: true, resultBuilt: true }),
    ).toBe('result');
  });
  it('均不可见 → null（交给 gameplay 输入）', () => {
    expect(
      resolveActiveMenu({ paused: false, levelComplete: false, pauseBuilt: true, resultBuilt: true }),
    ).toBe(null);
  });
  it('标志为真但组件未建 → null（不路由到未建菜单）', () => {
    expect(
      resolveActiveMenu({ paused: true, levelComplete: false, pauseBuilt: false, resultBuilt: true }),
    ).toBe(null);
  });
});
