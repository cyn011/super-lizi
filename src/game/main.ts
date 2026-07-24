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
    scene: [BootScene, GameScene],
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

  // 首次交互解锁音频（自动播放限制）
  platform.audio.unlock();

  // 真实手势内再次 resume（绕过自动播放限制；boot 时调用因无手势无效）。
  // 守卫 window：main.ts 同时被 index.html 与微信 game.js 引用，微信端无 window；
  // 微信端跳过监听（WechatAudio.unlock() 仅置 flag，boot 调用已够，无需手势 resume）。
  if (typeof window !== 'undefined') {
    const resumeAudio = () => platform.audio.unlock();
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
    window.addEventListener('touchstart', resumeAudio, { once: true });
  }

  return game;
}

// Web 端由 index.html 调用；此处自动启动以便 Vite 入口直接生效。
// 微信端不再传 parent：上屏画布已通过 globalThis.__screenCanvas 传入，
// 且 Scale 设为 NONE/NO_CENTER，避免 DOM 查询与 CSS 缩放。
startGame();
