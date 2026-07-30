/**
 * 锁定 1-4「灼沙绿洲」的专属沙漠美术接入，同时确保流沙机制数据不被视觉换皮替换。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

declare const __dirname: string;

const root = join(__dirname, '../../..');
const gameScene = readFileSync(join(root, 'src/game/scenes/game-scene.ts'), 'utf8');
const ammoHud = readFileSync(join(root, 'src/ui/ammo-hud.ts'), 'utf8');
const level = JSON.parse(readFileSync(join(root, 'src/config/levels/1-4.json'), 'utf8')) as {
  id: string;
  metadata: { name: string; theme: string };
  quicksand: Array<{ xStart: number; xEnd: number; surfaceY: number; deathY: number }>;
};

describe('1-4 灼沙绿洲 visual slice', () => {
  it('loads dedicated oasis and sandstone assets only for level 1-4', () => {
    expect(gameScene).toContain(
      "{ key: 'desert-oasis-backdrop-v1', path: 'art/desert/desert-oasis-backdrop-v1.jpg' }",
    );
    expect(gameScene).toContain(
      "{ key: 'desert-sandstone-foreground-v1', path: 'art/desert/desert-sandstone-foreground-v1.png' }",
    );
    expect(gameScene).toContain("isDesert && this.runtime.data.id === '1-4'");
    expect(gameScene).toContain('this.drawDesertOasisBackground()');
  });

  it('skins desert terrain, platforms, checkpoint, goal and ammo without changing collision APIs', () => {
    expect(gameScene).toContain('this.drawDesertSolid(g, X, Y, ts, surface, tx, ty)');
    expect(gameScene).toContain('this.drawDesertOneway(g, X, Y, ts, tx)');
    expect(gameScene).toContain('this.drawDesertCheckpoint');
    expect(gameScene).toContain('this.drawDesertGoal(g)');
    expect(gameScene).toContain('this.drawQuicksandOverlay()');
    expect(ammoHud).toContain("this.theme === 'desert'");
    expect(ammoHud).toContain('0xf05b3f');
  });

  it('keeps the two existing quicksand zones and desert metadata intact', () => {
    expect(level).toMatchObject({
      id: '1-4',
      metadata: { name: '《灼沙绿洲》', theme: 'desert' },
    });
    expect(level.quicksand).toMatchObject([
      { xStart: 480, xEnd: 672, surfaceY: 224, deathY: 304 },
      { xStart: 1056, xEnd: 1344, surfaceY: 224, deathY: 336 },
    ]);
  });
});
