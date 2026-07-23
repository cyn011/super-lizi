/**
 * platform/raw-input-provider — 重新导出 RawInputProvider 接口（架构 §3 文件清单）。
 * 单一事实来源在 core/input/raw-input.ts；此处仅为平台层目录结构对齐。
 */
export type { RawInputProvider, RawInputFrame, SignalId } from '../core/input/raw-input';

/**
 * PointerSink — 指针事件下沉接口（点击/滑动手势方案，UX-CLICK-TO-MOVE）。
 * 由场景层（Phaser pointer 事件）或平台层（wx.onTouch*）把归一化到逻辑分辨率的
 * 屏幕坐标喂给实现方。pointerId 用于区分多指（双指暂停）。
 * 实现方零 Phaser / 零 wx 依赖，只吃逻辑坐标。
 */
export interface PointerSink {
  pointerDown(x: number, y: number, pointerId?: number): void;
  pointerMove(x: number, y: number, pointerId?: number): void;
  pointerUp(x: number, y: number, pointerId?: number): void;
}
