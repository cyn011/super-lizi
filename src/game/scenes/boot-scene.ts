/**
 * game/scenes/boot-scene — 启动场景（E1.S1 空场景占位）。
 * Sprint 1 不做资源预载，直接进入 Game 场景；后续接入 atlas/音频再扩展。
 */

import Phaser from 'phaser';
import { LEVEL_ORDER } from '../../core/config';
import type { Platform } from '../../platform/platform';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // === DIAG（蓝屏排查）：BootScene 启动即铺全屏绿，确认 Phaser 已跑到 Boot。
    // 若微信端看到绿色 → Phaser 启动正常，问题在 Boot→Title 切换或 Title 渲染。
    // 若仍纯蓝 → Phaser 未启动到 Boot（main.ts/game.js 启动链问题）。
    this.add.rectangle(256, 144, 512, 288, 0x00ff00).setDepth(10000);
    this.add.text(256, 144, 'DIAG BOOT', { fontFamily: 'sans-serif', fontSize: '20px', color: '#000000' }).setOrigin(0.5).setDepth(10001);

    // 深链：冷启动带 level 参数 → 跳过标题屏直接进对应关；否则走默认 Title。
    const platform = (this.registry.get('platform') ??
      (globalThis as { __superMaliPlatform?: Platform }).__superMaliPlatform) as
      | Platform
      | undefined;
    const lq = platform?.share?.getLaunchQuery();
    const lv = lq?.level;
    if (lv && LEVEL_ORDER.includes(lv)) {
      this.scene.start('Game', { startLevel: lv });
    } else {
      this.scene.start('Title');
    }
  }
}
