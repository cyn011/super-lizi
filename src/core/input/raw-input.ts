/**
 * core/input/raw-input — 物理输入帧与提供者接口（GDD 01 §5 / 架构 §4.1）。
 * 逻辑层只认「物理信号 id」集合；具体来源（键盘 code / 触屏 id）由 platform 层负责。
 * 本模块零 Phaser / 零平台分支。
 */

/** 物理信号 id：Web=键码（如 "ArrowLeft"）；微信="touch:left" 等。 */
export type SignalId = string;

/**
 * 单帧原始输入快照（由 RawInputProvider 产出）。
 * - down：当前按住的信号集合
 * - pressedEdge：本帧刚按下的信号（边沿）
 * - releasedEdge：本帧刚抬起的信号（边沿）
 */
export interface RawInputFrame {
  down: Set<SignalId>;
  pressedEdge: Set<SignalId>;
  releasedEdge: Set<SignalId>;
}

/** 双端原始输入采样器（唯一允许产出 RawInputFrame 的地方）。 */
export interface RawInputProvider {
  /** 采样一帧原始输入。实现方负责维护边沿集合并在采样后清空。 */
  sample(): RawInputFrame;
  /** 可选：失焦/暂停时清空按住状态，避免输入卡死。 */
  reset?(): void;
}

/** 构造空帧的便捷函数。 */
export function emptyFrame(): RawInputFrame {
  return { down: new Set(), pressedEdge: new Set(), releasedEdge: new Set() };
}
