/**
 * 微信构建入口回归：静态资源复制不得把根目录的真机兼容入口覆盖成历史副本。
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

declare const __dirname: string;

const root = join(__dirname, '../../..');
const canonicalEntry = readFileSync(join(root, 'game.js'), 'utf8');
const copyScript = readFileSync(join(root, 'scripts/copy-wechat.mjs'), 'utf8');

describe('WeChat canonical build entry', () => {
  it('keeps the EventTarget shim required by Phaser startListeners', () => {
    expect(canonicalEntry).toContain('R2-nov：EventTarget polyfill');
    expect(canonicalEntry).toContain('obj.addEventListener = function');
    expect(canonicalEntry).toContain('makeEventTarget(globalThis.__screenCanvas)');
  });

  it('does not keep a second public/game.js that can overwrite the canonical entry', () => {
    expect(readdirSync(join(root, 'public'))).not.toContain('game.js');
  });

  it('restores and verifies the canonical entry after copying public assets', () => {
    const publicCopyAt = copyScript.indexOf("cpSync(publicDir, out");
    const canonicalCopyAt = copyScript.lastIndexOf(
      "copyFileSync(resolve(root, 'game.js'), resolve(out, 'game.js'))",
    );
    expect(publicCopyAt).toBeGreaterThan(-1);
    expect(canonicalCopyAt).toBeGreaterThan(publicCopyAt);
    expect(copyScript).toContain('canonical game.js integrity check failed');
  });
});
