/**
 * platform/index — 平台工厂：据 env 注入对应实现（架构 §2/§5）。
 * game/main.ts 调用 createPlatform(detectEnv()) 得到 Platform 接口实例。
 */
import type { Env, Platform } from './platform';
import { createWebPlatform } from './web/web-platform';
import { createWechatPlatform } from './wechat/wechat-platform';

export function createPlatform(env: Env): Platform {
  return env === 'wechat' ? createWechatPlatform() : createWebPlatform();
}
