/**
 * tests/unit/state/run-state-machine.test.ts — 顶层 RUN 状态机合法转移（S05-2 / 架构 §6.2）。
 *
 * 纯 Node（零 Phaser / 零平台 API），验证 RunStateMachineImpl 的转移表与校验逻辑：
 *   - 合法转移置新态、返回 true
 *   - 非法转移保持原态、返回 false（不抛错，便于 game-scene 安全编排）
 *   - 同态转移幂等
 *   - 本机只写自身 `state`，与实体 DamageState 正交（不依赖/不写其字段）
 */
import { describe, it, expect } from 'vitest';
import { RunStateMachineImpl } from '../../../src/core/state/run-state-machine';

describe('RunStateMachine · 顶层会话流（架构 §6.2）', () => {
  it('初始 BOOT → 仅 MENU 合法', () => {
    const m = new RunStateMachineImpl('BOOT');
    expect(m.canTransition('MENU')).toBe(true);
    expect(m.canTransition('PLAYING')).toBe(false);
    expect(m.transition('MENU')).toBe(true);
    expect(m.state).toBe('MENU');
  });

  it('MENU → PLAYING 合法', () => {
    const m = new RunStateMachineImpl('MENU');
    expect(m.transition('PLAYING')).toBe(true);
    expect(m.state).toBe('PLAYING');
  });

  it('PLAYING ⇄ PAUSED 互转合法', () => {
    const m = new RunStateMachineImpl('PLAYING');
    expect(m.transition('PAUSED')).toBe(true);
    expect(m.state).toBe('PAUSED');
    expect(m.transition('PLAYING')).toBe(true);
    expect(m.state).toBe('PLAYING');
  });

  it('PLAYING → LEVEL_COMPLETE / GAME_OVER 合法；PAUSED → LEVEL_COMPLETE 非法', () => {
    const a = new RunStateMachineImpl('PLAYING');
    expect(a.transition('LEVEL_COMPLETE')).toBe(true);
    const b = new RunStateMachineImpl('PLAYING');
    expect(b.transition('GAME_OVER')).toBe(true);
    const c = new RunStateMachineImpl('PAUSED');
    expect(c.transition('LEVEL_COMPLETE')).toBe(false);
    expect(c.state).toBe('PAUSED'); // 非法转移不改状态
  });

  it('GAME_OVER / LEVEL_COMPLETE → PLAYING（重试/再玩）合法', () => {
    const g = new RunStateMachineImpl('GAME_OVER');
    expect(g.transition('PLAYING')).toBe(true);
    const l = new RunStateMachineImpl('LEVEL_COMPLETE');
    expect(l.transition('PLAYING')).toBe(true);
  });

  it('同态转移幂等：返回 true 且状态不变', () => {
    const m = new RunStateMachineImpl('PLAYING');
    expect(m.transition('PLAYING')).toBe(true);
    expect(m.state).toBe('PLAYING');
  });

  it('非法转移返回 false 且保持原态', () => {
    const m = new RunStateMachineImpl('PLAYING');
    expect(m.transition('BOOT')).toBe(false);
    expect(m.transition('MENU')).toBe(false);
    expect(m.state).toBe('PLAYING');
  });

  it('转移表闭合：LEVEL_COMPLETE / GAME_OVER 均可回 PLAYING（再玩/重试）', () => {
    expect(new RunStateMachineImpl('LEVEL_COMPLETE').canTransition('PLAYING')).toBe(true);
    expect(new RunStateMachineImpl('GAME_OVER').canTransition('PLAYING')).toBe(true);
    // 且两者经一次合法转移即可落到 PLAYING
    const lc = new RunStateMachineImpl('LEVEL_COMPLETE');
    expect(lc.transition('PLAYING')).toBe(true);
    expect(lc.state).toBe('PLAYING');
    const go = new RunStateMachineImpl('GAME_OVER');
    expect(go.transition('PLAYING')).toBe(true);
    expect(go.state).toBe('PLAYING');
  });
});
