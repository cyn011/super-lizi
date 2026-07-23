/**
 * platform/detect — 平台探测（架构 §5.4）。
 * 构建期 VITE_PLATFORM 优先，回退运行时 typeof wx。本文件是 game/ 层的一部分（可用 import.meta）。
 */
import type { Env } from './platform';

/** 探测当前运行环境（web / wechat）。 */
export function detectEnv(): Env {
  // 构建期注入：vite --mode wechat → define VITE_PLATFORM='wechat'
  const buildEnv = (import.meta as unknown as { env?: { VITE_PLATFORM?: string } }).env?.VITE_PLATFORM;
  if (buildEnv === 'wechat') return 'wechat';
  // 运行时探测：微信小游戏全局 wx
  if (typeof (globalThis as { wx?: unknown }).wx !== 'undefined') return 'wechat';
  return 'web';
}

/** 逻辑分辨率（架构 §1：512×288，FIT）。触屏按钮归一化坐标 × 此值得命中区。 */
export const LOGICAL_WIDTH = 512;
export const LOGICAL_HEIGHT = 288;
