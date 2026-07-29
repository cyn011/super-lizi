/**
 * tests/setup/mock-phaser-env.ts
 * 为 import Phaser 的测试文件提供最小 DOM 全局变量，避免 Node 环境初始化 Phaser 时
 * `window is not defined` 报错。仅用于纯数据/常量测试，不构造 Scene。
 */
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  configurable: true,
  writable: true,
});
