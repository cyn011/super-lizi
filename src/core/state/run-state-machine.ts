/**
 * core/state/run-state-machine — 顶层 RUN 状态机（架构级，E1.S3 骨架）。
 * BOOT→MENU→PLAYING⇄PAUSED→LEVEL_COMPLETE/GAME_OVER。与 DamageState 正交。零 Phaser。
 */
export type RunStateName =
  | 'BOOT'
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER';

export interface RunStateMachine {
  state: RunStateName;
  transition(to: RunStateName): void;
}

export class RunStateMachineImpl implements RunStateMachine {
  state: RunStateName = 'BOOT';

  transition(to: RunStateName): void {
    this.state = to;
  }
}
