/**
 * platform/wechat/native-button-router — 微信原生触摸 → 菜单按钮路由（E7.S3 / S05-5）。
 *
 * 把微信真实触屏（wx.onTouch*）与模拟器鼠标（screenCanvas.click）坐标换算到逻辑分辨率
 * （512×288，与 input-abstraction 同坐标系），再派发给 game-scene 注入的 routeTap。
 * routeTap 据 RunState 把点击路由到 PauseMenu.handleTap / ResultScreen.handleTap
 * （S05-2 已暴露），使「继续 / 重玩 / 再玩一次」在微信端可点（Web 端由 Phaser interactive 按钮生效）。
 *
 * 门控（input-gate.isMenuActive）：仅当菜单激活时才路由，否则直接放行给 gameplay 手势
 * （与 attachWechatTouch 共享同一门，避免同一次点击既驱动角色又点菜单）。
 *
 * 平台层豁免：本文件可 import wx（见 core 零平台铁律）。纯换算逻辑 deviceToLogical 在 coord.ts
 * （亦被 gameplay 复用，保证菜单命中盒与 gameplay 按钮同坐标系）。
 */
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../detect';
import { getDeviceSize, deviceToLogical } from './coord';
import { isMenuActive } from './input-gate';

/** 逻辑坐标点击回调（由 game-scene 注入：据 RunState 路由到对应菜单 handleTap）。 */
export type RouteTap = (logicalX: number, logicalY: number) => void;

export class NativeButtonRouter {
  private readonly deviceW: number;
  private readonly deviceH: number;
  private readonly onStart: (e: unknown) => void;
  private readonly onClick: (e: { clientX: number; clientY: number }) => void;
  private routeTap: RouteTap | null = null;

  constructor(logicalW: number = LOGICAL_WIDTH, logicalH: number = LOGICAL_HEIGHT) {
    void logicalW;
    void logicalH;
    const size = getDeviceSize();
    this.deviceW = size.w;
    this.deviceH = size.h;

    this.onStart = (e: unknown) => this.handleTouch(e);
    this.onClick = (e: { clientX: number; clientY: number }) => this.handleClick(e);

    const wx = (globalThis as {
      wx?: {
        onTouchStart?: (cb: (e: unknown) => void) => void;
        offTouchStart?: (cb: (e: unknown) => void) => void;
      };
    }).wx;
    wx?.onTouchStart?.(this.onStart);

    // 模拟器鼠标模式主通道（与 attachWechatTouch 一致）：screenCanvas.click 坐标经同公式换算。
    const screenCanvas = (globalThis as {
      __screenCanvas?: {
        addEventListener?: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void;
        removeEventListener?: (t: string, h: unknown) => void;
      };
    }).__screenCanvas;
    if (screenCanvas && typeof screenCanvas.addEventListener === 'function') {
      screenCanvas.addEventListener('click', this.onClick);
    }
  }

  /** 注入路由回调（game-scene 据 RunState 决定派发给哪个菜单 handleTap）。 */
  setRouteTap(cb: RouteTap): void {
    this.routeTap = cb;
  }

  /** 解绑（随 Platform 生命周期；当前 Platform 与应用同生命周期，暂未调用）。 */
  destroy(): void {
    const wx = (globalThis as {
      wx?: { offTouchStart?: (cb: (e: unknown) => void) => void };
    }).wx;
    wx?.offTouchStart?.(this.onStart);
    const screenCanvas = (globalThis as {
      __screenCanvas?: { removeEventListener?: (t: string, h: unknown) => void };
    }).__screenCanvas;
    if (screenCanvas && typeof screenCanvas.removeEventListener === 'function') {
      screenCanvas.removeEventListener('click', this.onClick);
    }
    this.routeTap = null;
  }

  private toLogical(clientX: number, clientY: number): { x: number; y: number } {
    return deviceToLogical(clientX, clientY, this.deviceW, this.deviceH);
  }

  private handleTouch(e: unknown): void {
    // 门控：仅菜单激活时路由；否则交给 gameplay 手势。
    if (!isMenuActive() || !this.routeTap) return;
    const touches = (e as {
      changedTouches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number }>;
    }).changedTouches;
    if (!touches) return;
    for (const t of touches) {
      const cx = typeof t.clientX === 'number' ? t.clientX : typeof t.x === 'number' ? t.x : 0;
      const cy = typeof t.clientY === 'number' ? t.clientY : typeof t.y === 'number' ? t.y : 0;
      const { x, y } = this.toLogical(cx, cy);
      this.routeTap(x, y);
    }
  }

  private handleClick(e: { clientX: number; clientY: number }): void {
    if (!isMenuActive() || !this.routeTap) return;
    const { x, y } = this.toLogical(e.clientX, e.clientY);
    this.routeTap(x, y);
  }
}
