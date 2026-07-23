/**
 * core/input/input-abstraction — 跨端输入归一（GDD 01 / E2.S2 / control-list §4.2）。
 * 把物理输入帧（RawInputFrame，来自键盘 code 或触屏 id）归一为逻辑层唯一认的 InputState。
 * 逻辑层（角色/敌人/UI）只读 InputState，零平台分支。
 * 本模块零 Phaser / 零平台依赖；可纯 Node 单测。
 */

import type { RawInputFrame, SignalId } from './raw-input';

/** 抽象输入事件（跨 GDD 一致，见 00-index §1.2）。 */
export const INPUT_LEFT = 'INPUT_LEFT';
export const INPUT_RIGHT = 'INPUT_RIGHT';
export const INPUT_JUMP = 'INPUT_JUMP';
export const INPUT_ACTION = 'INPUT_ACTION';

/**
 * 单端输入映射：每个抽象动作对应一组「物理信号 id」。
 * - Web：键码，如 ['ArrowLeft','KeyA']
 * - 微信：虚拟按钮 id，如 ['touch:left']
 */
export interface InputMapping {
  left: string[];
  right: string[];
  jump: string[];
  action: string[];
}

/**
 * 逻辑层消费的输入状态（每固定步产出一份）。
 * - *Held：当前按住
 * - *Pressed / *Released：本帧边沿
 * - jumpPressedAt：跳跃按下的仿真时钟 ms（供 03 跳跃缓冲，非 wall clock）
 */
export interface InputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  jumpReleased: boolean;
  actionPressed: boolean;
  actionHeld: boolean;
  actionReleased: boolean;
  jumpPressedAt: number;
}

const EMPTY_STATE: InputState = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpHeld: false,
  jumpReleased: false,
  actionPressed: false,
  actionHeld: false,
  actionReleased: false,
  jumpPressedAt: 0,
};

export class InputAbstraction {
  private readonly mapping: InputMapping;

  constructor(mapping: InputMapping) {
    this.mapping = mapping;
  }

  /** 采样一帧原始输入 → 归一 InputState。simTimeMs 为仿真时钟（来自固定步长累加）。 */
  sample(frame: RawInputFrame, simTimeMs: number): InputState {
    const m = this.mapping;
    const held = (ids: string[]): boolean => ids.some((id) => frame.down.has(id as SignalId));
    const pressed = (ids: string[]): boolean => ids.some((id) => frame.pressedEdge.has(id as SignalId));
    const released = (ids: string[]): boolean => ids.some((id) => frame.releasedEdge.has(id as SignalId));

    const jumpPressed = pressed(m.jump);
    return {
      ...EMPTY_STATE,
      left: held(m.left),
      right: held(m.right),
      jumpPressed,
      jumpHeld: held(m.jump),
      jumpReleased: released(m.jump),
      actionPressed: pressed(m.action),
      actionHeld: held(m.action),
      actionReleased: released(m.action),
      // 仅在「本帧刚按下跳」时记录仿真时钟；否则 0（与上一帧无关，零平台分支）
      jumpPressedAt: jumpPressed ? simTimeMs : 0,
    };
  }
}
