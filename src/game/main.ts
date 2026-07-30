/**
 * game/main — Phaser.Game 引导入口（被 index.html / 微信 game.js 引用）。
 * 探测平台 → 注入 Platform/EventBus → 设全局 Scale → 启 Boot→Game。
 * 微信端：canvas 由 wx.createCanvas() 提供；weapp-adapter 已在 game.js 中 require 注入全局。
 * 黑屏根因修复见 game.js 的 R3：文档把 document.readyState 钉为 'complete'，
 * 确保 Phaser.Core.DOMContentLoaded() 在构造时同步调用 boot()，从而绑定 canvas 并启动主循环。
 */
import Phaser from 'phaser';
import { detectEnv } from '../platform/detect';
import { createPlatform } from '../platform';
import { EventBus } from '../core/events/event-bus';
import { BootScene } from './scenes/boot-scene';
import { TitleScene } from './scenes/title-scene';
import { GameScene } from './scenes/game-scene';

export function startGame(parent?: string | HTMLElement): Phaser.Game {
  const env = detectEnv();
  const platform = createPlatform(env);
  const events = new EventBus();

  // 微信端画布：game.js 顶部抢占的第一个上屏画布（globalThis.__screenCanvas）。
  const canvas =
    env === 'wechat'
      ? (globalThis as unknown as { __screenCanvas?: HTMLCanvasElement }).__screenCanvas
      : undefined;

  const config: Phaser.Types.Core.GameConfig = {
    type: env === 'wechat' ? Phaser.CANVAS : Phaser.AUTO,
    width: 512,
    height: 288,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#5BC8F5',
    parent: env === 'wechat' ? undefined : parent,
    canvas,
    scale: {
      // 微信小游戏没有真实 DOM，FIT/CENTER_BOTH 的 CSS 缩放会失效或把 canvas 缩到不可见；
      // 用 NONE 让 Phaser 直接按传入的 screenCanvas 尺寸渲染。
      mode: env === 'wechat' ? Phaser.Scale.NONE : Phaser.Scale.FIT,
      autoCenter: env === 'wechat' ? Phaser.Scale.NO_CENTER : Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, TitleScene, GameScene],
  };

  const game = new Phaser.Game(config);

  game.registry.set('platform', platform);
  game.registry.set('events', events);

  // ── GameScene registry 兜底（参见 game-scene.ts §9）：
  // 微信运行时 Phaser registry 行为异常，scene 可能读不到 platform/events。
  // 这里再挂一层 globalThis，GameScene 优先读 registry，缺失时读 globalThis，最后才重建。
  const gm = globalThis as unknown as {
    __superMaliPlatform?: typeof platform;
    __superMaliEvents?: typeof events;
  };
  gm.__superMaliPlatform = platform;
  gm.__superMaliEvents = events;

  // 微信分享（转发）+ 关卡深链：开启右上角「...」转发菜单（Web 端 share 为 undefined → no-op）。
  platform.share?.enableShare('栗宝大冒险 · 一起来跳！');

  // 首次交互解锁音频（绕过自动播放限制）。
  // 关键：AudioContext 必须在用户手势内首次创建并 resume。boot 期创建会被微信自动播放策略
  // 永久置为 suspended（之后 resume 也救不回）→ 真机全程无声。故 boot 不预创建 ctx，
  // 仅在真实手势回调内首次创建+恢复；unlock() 幂等且可重复调用：若 resume 被策略拒绝，
  // 后续触摸会再次调用并重试。
  const unlockAudio = () => platform.audio.unlock();
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
  }
  // 微信沙盒无 window 事件，改用 wx 真实手势回调内 resume；不加 {once}，允许策略拒绝后重试。
  const wxGlobal = globalThis as unknown as {
    wx?: { onTouchStart?: (cb: () => void) => void; onTouchEnd?: (cb: () => void) => void };
  };
  if (wxGlobal.wx?.onTouchStart) wxGlobal.wx.onTouchStart(unlockAudio);
  if (wxGlobal.wx?.onTouchEnd) wxGlobal.wx.onTouchEnd(unlockAudio);

  return game;
}

// Web 端挂到 #game-root，避免 FIT 画布被追加到全屏容器之后而落到首屏之外。
// 微信端不再传 parent：上屏画布已通过 globalThis.__screenCanvas 传入，
// 且 config 会忽略 parent，Scale 设为 NONE/NO_CENTER。
startGame('game-root');
