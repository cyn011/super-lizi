/**
 * core/state/run-state-machine — 顶层 RUN 状态机（架构 §6.2）。
 *
 * BOOT→MENU→PLAYING⇄PAUSED→LEVEL_COMPLETE/GAME_OVER。与 DamageState 正交：
 * 本机只写自己的 `state` 字段，绝不写 DamageState（命数/形态），反之亦然。
 *
 * 零 Phaser / 零平台 API（core 铁律）：本模块为纯逻辑，可在 Node 下单测。
 * 仅做「合法转移校验」，不直接发事件——事件由 game-scene 编排（单一事实来源），
 * 以保持 core 与 game/ui 的解耦（事件总线已在 core/events 定义）。
 */
export type RunStateName =
  | 'BOOT'
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER';

/**
 * 合法转移表（架构 §6.2 状态图）。
 * key=当前态，value=可到达的下一态集合。
 * 设计取舍：
 *   - PLAYING 是核心态，可 →PAUSED / LEVEL_COMPLETE / GAME_OVER。
 *   - PAUSED 仅可 →PLAYING（继续）或 →GAME_OVER（异常致死，留口）；经 restart 也是先回到 PLAYING。
 *   - LEVEL_COMPLETE / GAME_OVER 是终态分支，可 →PLAYING（再玩/重试）或 →MENU（下一关/回菜单）。
 *     MENU 当前垂直切片未单独实现场景，但转移表保留以保证状态图闭合（S06 多关启用）。
 */
const VALID_TRANSITIONS: Record<RunStateName, readonly RunStateName[]> = {
  BOOT: ['MENU'],
  MENU: ['PLAYING'],
  PLAYING: ['PAUSED', 'LEVEL_COMPLETE', 'GAME_OVER'],
  PAUSED: ['PLAYING', 'GAME_OVER'],
  LEVEL_COMPLETE: ['PLAYING', 'MENU'],
  GAME_OVER: ['PLAYING', 'MENU'],
};

export interface RunStateMachine {
  readonly state: RunStateName;
  /** 下一态是否合法可达（不改 state，仅查询）。 */
  canTransition(to: RunStateName): boolean;
  /**
   * 执行转移。合法则置新态并返回 true；非法则保持原态、返回 false（不抛错，便于编排层安全调用）。
   * 同态转移幂等返回 true（不改 state）。
   */
  transition(to: RunStateName): boolean;
}

export class RunStateMachineImpl implements RunStateMachine {
  state: RunStateName;

  constructor(initial: RunStateName = 'BOOT') {
    this.state = initial;
  }

  canTransition(to: RunStateName): boolean {
    return VALID_TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: RunStateName): boolean {
    if (to === this.state) return true; // 同态幂等
    if (!this.canTransition(to)) return false;
    this.state = to;
    return true;
  }
}
