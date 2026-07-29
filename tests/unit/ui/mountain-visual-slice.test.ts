import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

declare const __dirname: string;

const root = join(__dirname, '../../..');
const gameScene = readFileSync(join(root, 'src/game/scenes/game-scene.ts'), 'utf8');
const hud = readFileSync(join(root, 'src/ui/hud.ts'), 'utf8');
const level = JSON.parse(readFileSync(join(root, 'src/config/levels/1-2.json'), 'utf8')) as {
  id: string;
  metadata: { name: string; theme: string };
};

describe('1-2 黛峦·续章 visual slice', () => {
  it('keeps the dedicated mountain art gated to level 1-2', () => {
    expect(gameScene).toContain("path: 'art/mountain/mountain-moon-backdrop-v1.png'");
    expect(gameScene).toContain("path: 'art/mountain/mountain-stone-foreground-v1.png'");
    expect(gameScene).toContain("isMountain && this.runtime.data.id === '1-2'");
    expect(gameScene).toContain('if (usesMountainArt) this.drawMountainBackground(pal)');
  });

  it('renders a moonlit stone foreground without changing collision data', () => {
    expect(gameScene).toContain('const groundTop = 7 * ts');
    expect(gameScene).toContain('.setScrollFactor(0)');
    expect(gameScene).toContain('drawMountainSolid');
    expect(gameScene).toContain('drawMountainLantern');
    expect(level).toMatchObject({
      id: '1-2',
      metadata: { name: '黛峦·续章', theme: 'mountain' },
    });
  });

  it('shows the current 1-2 id in a dedicated HUD badge', () => {
    expect(gameScene).toContain('this.hud.setLevel(id)');
    expect(hud).toContain('setLevel(levelId: string)');
    expect(hud).toContain('this.drawLevelBadge(g)');
    expect(hud).toContain('g.fillRoundedRect(104, 7, 52, 20, 9)');
  });
});
