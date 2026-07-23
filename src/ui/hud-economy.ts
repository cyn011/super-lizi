/**
 * ui/hud-economy — HUD 经济字段「数值 → 字符串」纯格式化（零 Phaser / 零平台，可单测）。
 *
 * 渲染仍由 ui/hud.ts 用 Graphics（金币图标矢量）+ Text（系统字体）完成；本模块只负责
 * 纯文本格式化，便于 tests/unit/ui/hud-economy.test.ts 验证（与设计/ux/hud-spec.md 解耦渲染）。
 *
 * 约定（S04-5 / 08-ui-hud §3）：
 *   - 分数用中文「分数 N」（中文 ≥14px 等效，accessibility §9.2）。
 *   - 金币用「×N」（N = 已拾取金币数）。
 *   - 连击倍率用「xN」，且仅在 mult > 1 时显示（=1 为常态，不常驻干扰，见 shouldShowCombo）。
 * 颜色/描边由 hud.ts 的 Text style 负责，本模块只产出字符串，不耦合颜色。
 */

/** 分数前缀（中文，满足 accessibility 中文 ≥14px 等效）。 */
export const SCORE_PREFIX = '分数';
/** 金币前缀（乘号 ×，避免使用拉丁 x 与连击混淆）。 */
export const COIN_PREFIX = '×';
/** 连击前缀（拉丁 x，区别于金币 ×）。 */
export const COMBO_PREFIX = 'x';

/** 分数格式化：`分数 N`。 */
export function formatScore(score: number): string {
  return `${SCORE_PREFIX} ${score}`;
}

/** 金币格式化：`×N`。 */
export function formatCoins(coins: number): string {
  return `${COIN_PREFIX}${coins}`;
}

/** 连击倍率格式化：`xN`（仅 mult>1 时由调用方显示）。 */
export function formatCombo(mult: number): string {
  return `${COMBO_PREFIX}${mult}`;
}

/** 是否显示连击指示：仅当倍率 > 1（=1 为常态，不常驻干扰，hud-spec 显隐逻辑）。 */
export function shouldShowCombo(mult: number): boolean {
  return mult > 1;
}
