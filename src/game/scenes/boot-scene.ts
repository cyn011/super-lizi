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
