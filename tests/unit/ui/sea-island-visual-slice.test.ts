/**
 * 锁定 1-3「澜屿潮汐」的专属海岛美术接入与潮池地形轮廓。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

declare const __dirname: string;

const root = join(__dirname, '../../..');
const gameScene = readFileSync(join(root, 'src/game/scenes/game-scene.ts'), 'utf8');
const ammoHud = readFileSync(join(root, 'src/ui/ammo-hud.ts'), 'utf8');
const level = JSON.parse(readFileSync(join(root, 'src/config/levels/1-3.json'), 'utf8')) as {
  id: string;
  tiles: Array<{ tx: number; ty: number; kind: string }>;
  tideSegments: Array<{ xStart: number; xEnd: number }>;
};

describe('1-3 澜屿潮汐 visual slice', () => {
  it('loads dedicated island and reef assets through the shared Web/WeChat image chain', () => {
    expect(gameScene).toContain(
      "{ key: 'sea-island-backdrop-v1', path: 'art/sea/sea-island-backdrop-v1.png' }",
    );
    expect(gameScene).toContain(
      "{ key: 'sea-reef-foreground-v1', path: 'art/sea/sea-reef-foreground-v1.png' }",
    );
    expect(gameScene).toContain("isSea && this.runtime.data.id === '1-3'");
    expect(gameScene).toContain('this.drawSeaIslandBackground()');
  });

  it('skins solid reef and one-way wood platforms without replacing collision APIs', () => {
    expect(gameScene).toContain('this.drawSeaSolid(g, X, Y, ts, surface, tx, ty)');
    expect(gameScene).toContain('this.drawSeaOneway(g, X, Y, ts, tx)');
    expect(gameScene).toContain('this.world.isSolidTile(tx, groundRow)');
    expect(gameScene).toContain('this.runtime.data.tideSegments');
    expect(gameScene).toContain('this.drawSeaCheckpoint');
    expect(gameScene).toContain('this.drawSeaGoal(g, pal)');
    expect(ammoHud).toContain("this.theme === 'sea'");
    expect(ammoHud).toContain('0xff8a7a');
  });

  it('opens real tide pools exactly across the two existing tide segments', () => {
    const solidGround = new Set(
      level.tiles
        .filter((tile) => tile.kind === 'solid' && (tile.ty === 7 || tile.ty === 8))
        .map((tile) => `${tile.tx},${tile.ty}`),
    );
    expect(level.id).toBe('1-3');
    expect(level.tideSegments).toMatchObject([
      { xStart: 416, xEnd: 768 },
      { xStart: 1024, xEnd: 1408 },
    ]);
    for (let tx = 13; tx <= 23; tx++) {
      expect(solidGround.has(`${tx},7`)).toBe(false);
      expect(solidGround.has(`${tx},8`)).toBe(false);
    }
    for (let tx = 32; tx <= 43; tx++) {
      expect(solidGround.has(`${tx},7`)).toBe(false);
      expect(solidGround.has(`${tx},8`)).toBe(false);
    }
    expect(solidGround.has('12,7')).toBe(true);
    expect(solidGround.has('24,7')).toBe(true);
    expect(solidGround.has('31,7')).toBe(true);
    expect(solidGround.has('44,7')).toBe(true);
  });
});
