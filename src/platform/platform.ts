/**
 * platform/platform — 双端平台接口（架构 §5）。core/game 只依赖此接口，不直接碰 wx/DOM。
 * 逻辑层零平台分支的铁律在此收口：差异全部封装到具体的 web/* 与 wechat/* 实现。
 */
import type { RawInputProvider } from '../core/input/raw-input';

export type Env = 'web' | 'wechat';

export interface AudioPort {
  /** 播放占位/真实音效（MVP 静音或 WebAudio 合成）。 */
  play(name: string): void;
  /** 首次用户交互后解锁（绕过自动播放限制）。 */
  unlock(): void;
}

export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface LifecyclePort {
  onHide(cb: () => void): void;
  onShow(cb: () => void): void;
}

/**
 * 微信分享（转发）+ 关卡深链端口。
 * 全部 wx.* 调用收敛到 platform/wechat/*；Web / 测试环境实现为 no-op 不抛错。
 */
export interface SharePort {
  /** 开启微信右上角「...」转发菜单并注册转发内容。title 为分享卡片标题。非微信/测试环境需 no-op 不抛错。 */
  enableShare(title: string): void;
  /** 更新分享附带 query 上下文（如 { level: '2-3' }）。 */
  updateContext(ctx: Record<string, string>): void;
  /** 读取冷启动 getLaunchOptionsSync / onShow 携带的 query（如 { level: '2-3' }），用于深链进关。 */
  getLaunchQuery(): Record<string, string>;
}

/** 平台能力聚合。由 detect → createPlatform 在 Boot 注入。 */
export interface Platform {
  env: Env;
  input: RawInputProvider;
  audio: AudioPort;
  storage: StoragePort;
  lifecycle: LifecyclePort;
  /**
   * 可选：减少动态（accessibility §9.3 / seed-topper-spec §2.1）。
   * 开启时 game-scene 跳过蜕变光晕脉冲 tween（仅保留静态稳态光晕），防光敏。
   * 默认 false；后续可由系统 prefers-reduced-motion / 设置项注入，无需改 game-scene（P6 整改 D3）。
   */
  reduceMotion?: boolean;
  /**
   * 可选：把主角屏幕逻辑坐标喂给输入提供方。
   * gesture 布局用于以主角位置为原点判定点击意图（见 click-to-move-design.md 最新拍板）；
   * virtual 布局的输入提供方无此方法 → 调方用 ?. 安全跳过（no-op）。
   */
  setPlayerScreenPos?: (x: number, y: number) => void;
  /**
   * 可选（仅微信端实现，Web 端 no-op）：菜单激活时屏蔽 gameplay 原生输入转发。
   * E7.S3 / S05-5：暂停 / 结算 / GameOver 时置 true，恢复 / 重开时置 false，
   * 避免菜单点击顺带驱动角色（同时保留后台暂停期间仍按住的手指 → 输入连续）。
   */
  setMenuActive?: (active: boolean) => void;
  /**
   * 可选（仅微信端实现，Web 端 no-op）：注入「原生菜单点击路由」回调。
   * game-scene 据 RunState 把逻辑坐标派发给 PauseMenu/ResultScreen.handleTap，
   * 使「继续 / 重玩 / 再玩一次」在微信端可点（Web 端由 Phaser interactive 按钮生效）。
   */
  setNativeMenuTap?: (cb: (x: number, y: number) => void) => void;
  /**
   * 可选：微信分享（转发）+ 关卡深链端口。
   * 仅微信端实现；Web 端不传（undefined）→ game/boot 用 ?. 安全跳过（no-op）。
   */
  share?: SharePort;
}
