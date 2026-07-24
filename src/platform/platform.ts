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

/** 平台能力聚合。由 detect → createPlatform 在 Boot 注入。 */
export interface Platform {
  env: Env;
  input: RawInputProvider;
  audio: AudioPort;
  storage: StoragePort;
  lifecycle: LifecyclePort;
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
}
