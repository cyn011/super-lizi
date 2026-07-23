/**
 * game/pickup-resolution — S04-3 实体拾取 / 检查点解算（game-scene 与集成测试共用的单一真实实现）。
 *
 * 与 damage-resolution 对称：把「玩家 AABB 与 coin/seed/checkpoint 重叠 → 事件发放 + 检查点重生点更新」
 * 集中为纯函数（零 Phaser / 零平台 API），game-scene 的 resolvePickups 仅做委托。
 * 这样集成测试直接调用本函数即「S04-3 拾取/检查点管线」的真实代码证据（非复制胶水）。
 *
 * scope 边界（见 Task S04-3）：种子**仅发 ON_SEED_COLLECTED**，maturity 局内累积 / 蜕变视觉
 * （GDD 12 computeGrowth 四阶段）留专项 Story；金币发 ON_COIN 由 S04-4 经济订阅闭环。
 */
import type { Body } from '../core/physics/body';
import { rectsOverlap, type Rect } from '../core/physics/aabb';
import type { RuntimeLevel } from '../core/level/level-runtime';
import type { EventBus } from '../core/events/event-bus';
import { ON_COIN, ON_SEED_COLLECTED, ON_CHECKPOINT } from '../core/events/event-bus';
import type { CheckpointEntityDef } from '../core/level/level-data';

/**
 * 占位碰撞/渲染尺寸（px，32px 网格对齐；待 art-spec 确定后由 config 注入）。
 * 单点真理源：渲染视图从此处导入，保证「绘制盒 == 碰撞盒」，避免错位。
 * 坐标来自关卡 JSON（不写死）；此处仅是尺寸占位，非玩法调参。
 */
export const COIN_SIZE = 16;
export const SEED_SIZE = 16;
export const CHECKPOINT_W = 24;
export const CHECKPOINT_H = 48;

/** 一次拾取/检查点解算的产出（供调用方定向重绘对应图层）。 */
export interface PickupResult {
  /** 本帧新拾取的金币索引（已写入 collectedCoins）。 */
  coinHits: number[];
  /** 本帧新拾取的种子索引（已写入 collectedSeeds）。 */
  seedHits: number[];
  /** 本帧 respawnPoint 是否被检查点更新（含首次/移动到新点）。 */
  checkpointUpdated: boolean;
}

export interface PickupParams {
  runtime: RuntimeLevel;
  /** 玩家碰撞盒（只读其 x/y/w/h 做 AABB 重叠）。 */
  body: Body;
  /** 已拾取金币去重集合（索引 → 防重复计数 / 重复事件）。原地增删。 */
  collectedCoins: Set<number>;
  /** 已拾取种子去重集合（索引 → 防重复事件）。原地增删。 */
  collectedSeeds: Set<number>;
  /** 检查点重生点；触碰检查点（且不同于当前）时**原地**更新 {x,y}。 */
  respawnPoint: { x: number; y: number };
  /** 事件总线（发 ON_COIN / ON_SEED_COLLECTED / ON_CHECKPOINT）。 */
  bus: EventBus;
}

/**
 * 解算一次实体拾取与检查点。直接修改 collectedCoins / collectedSeeds / respawnPoint（原地）。
 *
 * - 金币：与玩家 AABB 重叠且未 collected → `ON_COIN` + 标记（渲染移除由调用方按 coinHits 处理）。
 * - 种子：与玩家 AABB 重叠且未 collected → `ON_SEED_COLLECTED(seedId)` + 标记（seedId 缺省 'seed_common'）。
 * - 检查点：重叠且 respawnPoint 未设/不同 → 更新 respawnPoint + `ON_CHECKPOINT({x,y})`（去重：仅首次或移动到新点）。
 *
 * @returns 本帧发生变化的部分（coinHits / seedHits / checkpointUpdated），供调用方定向重绘。
 */
export function resolvePickups(params: PickupParams): PickupResult {
  const { runtime, body, collectedCoins, collectedSeeds, respawnPoint, bus } = params;
  const result: PickupResult = { coinHits: [], seedHits: [], checkpointUpdated: false };

  // ── 金币 ──
  for (let i = 0; i < runtime.coins.length; i++) {
    if (collectedCoins.has(i)) continue; // 已拾取 → 跳过（去重）
    const c = runtime.coins[i];
    const box: Rect = { x: c.x, y: c.y, w: COIN_SIZE, h: COIN_SIZE };
    if (rectsOverlap(body, box)) {
      collectedCoins.add(i);
      bus.emit(ON_COIN);
      result.coinHits.push(i);
    }
  }

  // ── 种子 ──
  for (let i = 0; i < runtime.seeds.length; i++) {
    if (collectedSeeds.has(i)) continue; // 已拾取 → 跳过（去重）
    const s = runtime.seeds[i];
    const box: Rect = { x: s.x, y: s.y, w: SEED_SIZE, h: SEED_SIZE };
    if (rectsOverlap(body, box)) {
      collectedSeeds.add(i);
      const seedId = s.seedId ?? 'seed_common';
      bus.emit(ON_SEED_COLLECTED, seedId);
      result.seedHits.push(i);
    }
  }

  // ── 检查点（先取「本帧重叠的那一个」，再与 respawnPoint 比较，避免同时重叠多个时重复发）──
  let overlapping: CheckpointEntityDef | null = null;
  for (const cp of runtime.checkpoints) {
    const box: Rect = { x: cp.x, y: cp.y, w: CHECKPOINT_W, h: CHECKPOINT_H };
    if (rectsOverlap(body, box)) {
      overlapping = cp;
      break;
    }
  }
  if (overlapping && (respawnPoint.x !== overlapping.x || respawnPoint.y !== overlapping.y)) {
    respawnPoint.x = overlapping.x;
    respawnPoint.y = overlapping.y;
    bus.emit(ON_CHECKPOINT, { x: overlapping.x, y: overlapping.y });
    result.checkpointUpdated = true;
  }

  return result;
}
