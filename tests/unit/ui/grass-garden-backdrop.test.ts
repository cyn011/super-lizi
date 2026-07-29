/**
 * 锁定 1-1 花园美术纵向切片的接入边界：
 * - Web / 微信共用同一张 2× PNG；
 * - 只替换 1-1 非交互背景；
 * - 其他草原关继续使用程序化视差回退。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

declare const __dirname: string;

const gameSceneSource = readFileSync(
  join(__dirname, '../../../src/game/scenes/game-scene.ts'),
  'utf8',
);

describe('game-scene · 1-1 花园美术背景', () => {
  it('通过统一加载链加载花园背景，兼容 Web 与微信小游戏', () => {
    expect(gameSceneSource).toContain(
      "{ key: 'grass-garden-backdrop-v1', path: 'art/grass/grass-garden-backdrop-v1.png' }",
    );
    expect(gameSceneSource).toContain("this.textures.exists('grass-garden-backdrop-v1')");
  });

  it('仅在 1-1 使用固定背景，不改变碰撞与地形渲染', () => {
    expect(gameSceneSource).toContain("this.runtime.data.id === '1-1'");
    expect(gameSceneSource).toContain(".image(camW / 2, camH / 2, 'grass-garden-backdrop-v1')");
    expect(gameSceneSource).toContain('.setDisplaySize(camW, camH)');
    expect(gameSceneSource).toContain('.setScrollFactor(0)');
    expect(gameSceneSource).toContain('.setDepth(-10)');
  });

  it('离开 1-1 时销毁位图，其他草原关回退到程序化四层背景', () => {
    expect(gameSceneSource).toContain('if (!usesGrassGardenBackdrop)');
    expect(gameSceneSource).toContain('this.grassGardenBackdrop?.destroy()');
    expect(gameSceneSource).toContain('if (!this.grassSkyGfx)');
    expect(gameSceneSource).toContain('if (!this.grassFarGfx)');
    expect(gameSceneSource).toContain('if (!this.grassMidGfx)');
  });
});
