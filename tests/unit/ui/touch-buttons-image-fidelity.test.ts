/**
 * 锁定触控按钮的素材保真策略：
 * - 继续使用用户提供的三张 PNG，不用 Graphics 重画；
 * - Web 与微信小游戏端都使用 LINEAR 缩小采样。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

declare const __dirname: string;

const touchButtonsSource = readFileSync(
  join(__dirname, '../../../src/ui/touch-buttons.ts'),
  'utf8',
);
const gameSceneSource = readFileSync(
  join(__dirname, '../../../src/game/scenes/game-scene.ts'),
  'utf8',
);

describe('touch-buttons · 用户 PNG 素材保真', () => {
  it('保留三种 PNG 纹理及 ImageButton 渲染，不用代码图形替代', () => {
    expect(touchButtonsSource).toContain("const ARROW_TEXTURE_KEY = 'ui-arrow-btn'");
    expect(touchButtonsSource).toContain("const ACTION_TEXTURE_KEY = 'ui-action-btn'");
    expect(touchButtonsSource).toContain("const JUMP_TEXTURE_KEY = 'ui-jump-btn'");
    expect(touchButtonsSource).toContain('new ImageButton');
  });

  it('Web 端按钮缩小时使用 LINEAR 采样', () => {
    expect(touchButtonsSource).toContain(
      'this.image.texture.setFilter(Phaser.Textures.FilterMode.LINEAR)',
    );
  });

  it('微信小游戏端加载原 PNG，并使用同样的 LINEAR 采样', () => {
    expect(gameSceneSource).toContain("{ key: 'ui-arrow-btn', path: 'ui/arrow-btn.png' }");
    expect(gameSceneSource).toContain("{ key: 'ui-action-btn', path: 'ui/action-btn.png' }");
    expect(gameSceneSource).toContain("{ key: 'ui-jump-btn', path: 'ui/jump-btn.png' }");
    expect(gameSceneSource).toContain('cv.setFilter(Phaser.Textures.FilterMode.LINEAR)');
  });
});
