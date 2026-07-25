/**
 * game/scenes/boot-scene — 启动场景（E1.S1 空场景占位）。
 * Sprint 1 不做资源预载，直接进入 Game 场景；后续接入 atlas/音频再扩展。
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Title');
  }
}
