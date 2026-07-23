/**
 * platform/wechat/weapp-adapter.d.ts — 微信小游戏全局 wx 的最小类型声明（shim）。
 * 仅覆盖本项目用到的 API；完整类型以微信官方 @types 为准（不引入以省包体）。
 * 配合 weapp-adapter 在运行时提供 document/window/canvas 等全局，供 Phaser.AUTO 运行。
 */

interface WxTouch {
  identifier: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
}

interface WxTouchEvent {
  touches: WxTouch[];
  changedTouches: WxTouch[];
}

declare global {
  // 微信小游戏运行时全局；Web 构建由 detect 运行时探测，不影响类型可用
  // eslint-disable-next-line no-var
  var wx: {
    createCanvas(): HTMLCanvasElement;
    onTouchStart(cb: (e: WxTouchEvent) => void): void;
    onTouchMove(cb: (e: WxTouchEvent) => void): void;
    onTouchEnd(cb: (e: WxTouchEvent) => void): void;
    onTouchCancel(cb: (e: WxTouchEvent) => void): void;
    onHide(cb: () => void): void;
    onShow(cb: () => void): void;
    setStorageSync(key: string, data: string): void;
    getStorageSync(key: string): string;
    createInnerAudioContext(): { src: string; play(): void; destroy(): void };
    [key: string]: unknown;
  } | undefined;
}

export {};
