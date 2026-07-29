/**
 * 触屏按钮清晰度回归：
 * 禁止恢复“128px PNG → 28–36px 最近邻压缩 → 微信画布再次放大”的二次采样路径。
 * 控件必须按逻辑尺寸由 Phaser Graphics 直接绘制。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

declare const __dirname: string;

const touchButtonsSource = readFileSync(
  join(__dirname, '../../../src/ui/touch-buttons.ts'),
  'utf8',
);
const gameSceneSource = readFileSync(
  join(__dirname, '../../../src/game/scenes/game-scene.ts'),
  'utf8',
);

describe('触屏按钮清晰度回归', () => {
  it('四个控制按钮全部使用按逻辑尺寸直接绘制的 Graphics 控件', () => {
    expect(touchButtonsSource.match(/new DarkRect/g)).toHaveLength(2);
    expect(touchButtonsSource.match(/new DarkCircle/g)).toHaveLength(2);
    expect(touchButtonsSource).not.toContain('new ImageButton');
  });

  it('按钮渲染不再执行位图缩放或最近邻纹理采样', () => {
    expect(touchButtonsSource).not.toContain('setDisplaySize');
    expect(touchButtonsSource).not.toContain('FilterMode.NEAREST');
    expect(touchButtonsSource).not.toMatch(/ui-(arrow|action|jump)-btn/);
  });

  it('游戏场景不再预加载已停用的按钮 PNG', () => {
    expect(gameSceneSource).not.toMatch(/ui\/(arrow|action|jump)-btn\.png/);
    expect(gameSceneSource).not.toContain('WechatImageFile');
  });
});
