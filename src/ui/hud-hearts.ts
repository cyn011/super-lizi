/**
 * ui/hud-hearts — 命数心形槽位计算（纯函数，零 Phaser / 零平台依赖，便于单测）。
 *
 * 设计依据：design/ux/hud-spec.md §3.1（数量 = max(initialLives, lives)；满=实心、空=空心）。
 * - 渲染 max(initialLives, lives) 个槽：让玩家看到「已失去几命」（经典马里奥式，见 hud-spec §3.1）。
 * - 加命后 lives > initialLives 时槽位动态扩到 lives（不截断，前瞻 prop_heart 加命）。
 * - 负数 lives 安全：filled 钳到 0（状态机已保证 lives 不为负，此处兜底防御）。
 */
export interface HeartSlots {
  /** 槽位总数（含已失去的空心槽）：max(initialLives, lives)。 */
  total: number;
  /** 当前实心（满命）数量：clamp(lives, 0, total)。 */
  filled: number;
}

/**
 * 计算心形槽位布局。
 * @param lives 当前命数（来自 damage.lives，可能 0 或 ≥ initialLives）。
 * @param initialLives 初始命数（来自 damageConfig.initialLives，只读传入，禁止内部硬编码）。
 */
export function computeHeartSlots(lives: number, initialLives: number): HeartSlots {
  const total = Math.max(initialLives, lives);
  return { total, filled: Math.max(0, Math.min(lives, total)) };
}
