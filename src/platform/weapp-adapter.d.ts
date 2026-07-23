/**
 * platform/weapp-adapter.d.ts — 微信小游戏全局 wx 的最小类型声明。
 * 仅平台层（platform/wechat/*）引用 wx；逻辑层（core/game/ui）严禁引用。
 * weapp-adapter 由 game.js 在微信端 require，先于 main.js 执行以打补丁全局。
 */
declare const wx: any;

declare module 'weapp-adapter';
