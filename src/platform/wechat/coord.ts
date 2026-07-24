/**
 * platform/wechat/coord — 设备像素 → 逻辑坐标换算（E7.S3 / S05-5）。
 *
 * 与 input-abstraction（GDD 01 §6/§7）同坐标系：逻辑分辨率 512×288。
 * 微信真实设备触摸给出的是「上屏画布像素」，需按 device/logical 比例换算，
 * 才能与 PauseMenu / ResultScreen 的「逻辑坐标命中盒」对齐。
 * 本模块的 deviceToLogical / getDeviceSize 被 gameplay（wechat-touch.attachWechatTouch）
 * 与原生菜单路由（native-button-router）共用，避免两处公式漂移。
 */
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../detect';

export interface DeviceSize {
  w: number;
  h: number;
}

/** 读取设备分辨率（触屏坐标基准）。无 wx 时退化为逻辑分辨率（不报错）。 */
export function getDeviceSize(): DeviceSize {
  let w = LOGICAL_WIDTH;
  let h = LOGICAL_HEIGHT;
  const wx = (globalThis as {
    wx?: {
      getSystemInfoSync?: () => {
        screenWidth?: number;
        windowWidth?: number;
        screenHeight?: number;
        windowHeight?: number;
      };
    };
  }).wx;
  if (wx && typeof wx.getSystemInfoSync === 'function') {
    try {
      const info = wx.getSystemInfoSync();
      if (info) {
        w = info.screenWidth || info.windowWidth || w;
        h = info.screenHeight || info.windowHeight || h;
      }
    } catch {
      /* 忽略，使用逻辑分辨率 */
    }
  }
  return { w, h };
}

/**
 * 设备像素 (px,py) → 逻辑坐标 (512×288)。
 * 与 wechat-touch 既有 hitTest / onCanvasClick 同公式，保证菜单命中与 gameplay 按钮一致。
 */
export function deviceToLogical(
  px: number,
  py: number,
  deviceW: number,
  deviceH: number,
): { x: number; y: number } {
  return {
    x: px * (LOGICAL_WIDTH / deviceW),
    y: py * (LOGICAL_HEIGHT / deviceH),
  };
}
