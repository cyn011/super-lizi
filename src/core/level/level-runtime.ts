/**
 * core/level/level-runtime — 关卡运行时（GDD 05，E4.S1 落地）。
 *
 * 由 LevelData.tiles 构建 tile 网格 → 产出可直接喂给 stepBody 的 CollisionWorld，
 * 并暴露 spawn / goal(AABB) / entities / data。纯 TS，零 Phaser / 零平台依赖（core 铁律）。
 *
 * 边界约定（对齐 tests/unit/level/level-loader.test.ts 的 C5 验收）：
 *   - 越界左/右/底（tx<0 / tx>=width / ty>=height）= 实心墙（封边：撞墙 + 防穿底，双保险）
 *   - 越界顶（ty<0）= 开放（允许起跳越顶）
 *   - 仅网格内（0<=tx<width, 0<=ty<height）参与瓦片查询；越界瓦片在构建期被忽略（健壮性）
 * 关卡左右墙同时由瓦片（col0 / colLast 全高实心）显式表达，与封边语义一致、便于断言。
 */
import type {
  LevelData,
  EntityDef,
  TileDef,
  CoinEntityDef,
  SeedEntityDef,
  CheckpointEntityDef,
  ChestnutEntityDef,
  BeatPhase,
} from './level-data';
import type { CollisionWorld } from '../physics/collision';
import { createEnemies, type EnemyAI } from '../enemy/enemy-ai';

/** 轴对齐包围盒（goal / 任意命中判定共用）。 */
export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_GOAL_W = 32;
const DEFAULT_GOAL_H = 64;

export class RuntimeLevel {
  /** 原始关卡数据（含 beat / metadata，供 UI / BeatClock 预留读取）。 */
  readonly data: LevelData;
  /** 由 tiles 构建的碰撞世界（isSolidTile / isOneWayTile 查询）。 */
  readonly world: CollisionWorld;
  /** 出生点（逻辑 px，脚底贴地由 Loader 计算或直接给出）。 */
  readonly spawn: { x: number; y: number };
  /** 凯旋之门 AABB（由 goal 坐标 + 尺寸推导）。 */
  readonly goal: AABB;
  /** 实体列表（C5 为空，供 E3/E4 复用）。 */
  readonly entities: EntityDef[];
  /** S04-1：由 entities 生成的真实可踩敌人实例（替代 C3 占位刺栗，经 damage-resolution 管线）。 */
  readonly enemies: EnemyAI[];
  /** S04-3：由 entities 过滤生成的金币实例（碰玩家 → ON_COIN，联动 S04-4 经济）。 */
  readonly coins: CoinEntityDef[];
  /** S04-3：由 entities 过滤生成的种子实例（碰玩家 → ON_SEED_COLLECTED，GDD 12）。 */
  readonly seeds: SeedEntityDef[];
  /** S04-3：由 entities 过滤生成的检查点实例（碰玩家 → 更新 respawnPoint + ON_CHECKPOINT）。 */
  readonly checkpoints: CheckpointEntityDef[];
  /** Phase 5：由 entities 过滤生成的栗子补给实例（碰玩家 → addAmmo + ON_AMMO_CHANGED）。 */
  readonly chestnuts: ChestnutEntityDef[];

  private readonly solid: boolean[][];
  private readonly oneWay: boolean[][];

  /**
   * 节拍动态实心集（S05-1）：key = `${tx},${ty}` 的字符串键。
   * 由 BeatDrivenSystem 经 setBeatTileSolid 翻转——物理唯一真相源不变，仅 OR 此集。
   * 越界 tile 永不入此集；isSolid 仅对网格内查询它，封边语义不受破坏。
   */
  private readonly dynamicSolid = new Set<string>();

  /** 节拍平台 initial 缺省相位（与设计契约 / 实现口径一致）。 */
  private static readonly BEAT_INITIAL_DEFAULT: BeatPhase = 'ghost';

  constructor(data: LevelData) {
    this.data = data;
    const w = data.width;
    const h = data.height;
    const ts = data.tileSize;

    // 网格初始化（[ty][tx]）
    this.solid = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
    this.oneWay = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
    for (const t of data.tiles) this.setTile(t, w, h);

    // 节拍平台初始相位登记：initial ?? 'ghost' === 'solid' 的 tile 写入动态实心集
    // （边界 3/4：beat 禁用时平台锁在 initial，与「普通实心 tile」行为一致）。
    for (const p of data.beatPlatforms ?? []) {
      if ((p.initial ?? RuntimeLevel.BEAT_INITIAL_DEFAULT) === 'solid') {
        for (const t of p.tiles) this.dynamicSolid.add(this.beatKey(t.tx, t.ty));
      }
    }

    // 注入碰撞世界：仅网格内查询，越界一律非实心（由瓦片表达墙）
    this.world = {
      tileSize: ts,
      width: w,
      height: h,
      isSolidTile: (tx, ty) => this.isSolid(tx, ty),
      isOneWayTile: (tx, ty) => this.isOneWay(tx, ty),
    };

    this.spawn = data.spawn ?? RuntimeLevel.defaultSpawn(data);
    this.goal = RuntimeLevel.buildGoal(data);
    this.entities = data.entities ?? [];
    this.enemies = createEnemies(data.entities ?? []);
    // S04-3：按 type 过滤分桶（coin/seed/checkpoint），与敌人共用 entities[] 来源。
    this.coins = (data.entities ?? []).filter(
      (e): e is CoinEntityDef => e.type === 'coin',
    );
    this.seeds = (data.entities ?? []).filter(
      (e): e is SeedEntityDef => e.type === 'seed',
    );
    this.checkpoints = (data.entities ?? []).filter(
      (e): e is CheckpointEntityDef => e.type === 'checkpoint',
    );
    this.chestnuts = (data.entities ?? []).filter(
      (e): e is ChestnutEntityDef => e.type === 'chestnut',
    );
  }

  private setTile(t: TileDef, w: number, h: number): void {
    if (t.tx < 0 || t.tx >= w || t.ty < 0 || t.ty >= h) return; // 越界忽略
    if (t.kind === 'oneway') this.oneWay[t.ty][t.tx] = true;
    else this.solid[t.ty][t.tx] = true; // 'solid' 或未来其它实心 kind 一律按实心处理
  }

  private inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && tx < this.world.width && ty >= 0 && ty < this.world.height;
  }

  /** 实心查询：越界左/右/底=墙（封边防走出/掉穿）、越界顶=开放；网格内查 solid 网格 OR 节拍动态实心集。 */
  private isSolid(tx: number, ty: number): boolean {
    if (ty < 0) return false; // 顶部开放（允许起跳越顶）
    if (!this.inBounds(tx, ty)) return true; // 左/右/底封边（ty>=0 前提下的越界）
    return this.solid[ty][tx] || this.dynamicSolid.has(this.beatKey(tx, ty));
  }

  /** 节拍 tile 键（字符串，避免数字键在宽高变化时歧义）。 */
  private beatKey(tx: number, ty: number): string {
    return `${tx},${ty}`;
  }

  /**
   * 节拍动态翻转（S05-1）：core 层（BeatDrivenSystem）据跨拍相位调用。
   * 增/删 dynamicSolid；越界 tile 不登记（isSolid 对越界走封边语义）。
   * @param solid true=登记为可踩实心，false=退出碰撞（ghost）。
   */
  setBeatTileSolid(tx: number, ty: number, solid: boolean): void {
    const k = this.beatKey(tx, ty);
    if (solid) this.dynamicSolid.add(k);
    else this.dynamicSolid.delete(k);
  }

  /** 单向平台查询：仅网格内、且 kind===oneway 的 tile。 */
  private isOneWay(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.oneWay[ty][tx];
  }

  /** 缺省出生点：左侧第 2 列、脚底贴首行实心顶（退化为「站在地面」）。 */
  private static defaultSpawn(data: LevelData): { x: number; y: number } {
    const ts = data.tileSize;
    let floorTy = data.height - 1;
    for (let ty = 0; ty < data.height; ty++) {
      if (data.tiles.some((t) => t.ty === ty && t.kind !== 'oneway')) {
        floorTy = ty;
        break;
      }
    }
    return { x: ts * 2, y: floorTy * ts - 34 };
  }

  /** 终点 AABB：沿用 LevelData.goal 的 (x,y)，尺寸取 goal.w/h 或默认 32×64。 */
  private static buildGoal(data: LevelData): AABB {
    return {
      x: data.goal.x,
      y: data.goal.y,
      w: data.goal.w ?? DEFAULT_GOAL_W,
      h: data.goal.h ?? DEFAULT_GOAL_H,
    };
  }
}
