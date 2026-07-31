/**
 * core/level/level-data — 关卡数据类型与校验（GDD 05，E1.S3 骨架）。
 * 数值集中 config/levels/*.json，逻辑层零硬编码。零 Phaser / 零平台依赖。
 */
export interface TileDef {
  tx: number;
  ty: number;
  /** 瓦片种类：solid/oneway 基础碰撞；家具 sofa/table/cabinet 复用既有 solid/oneway 碰撞语义（仅换皮）。 */
  kind: TileKind;
}

/**
 * 瓦片种类联合类型（S04-3 扩展）：
 *   - 'solid' / 'oneway'：基础碰撞（实心 / 单向平台），由 CollisionWorld 直接消费。
 *   - 'sofa' / 'cabinet'：家具实心（映射 solid，顶面可踩、四壁/底面挡）；'table'：家具单向（映射 oneway，仅顶可踩）。
 * 家具碰撞零新增逻辑：level-runtime.setTile 仅扩展 kind→碰撞映射表（sofa/cabinet→solid、table→oneway）。
 */
export type TileKind = 'solid' | 'oneway' | 'sofa' | 'table' | 'cabinet';

/**
 * 实体联合类型（S04-3 扩展）：敌人（保留 S04-1）/ 金币 / 种子 / 检查点，
 * 均由关卡 JSON `entities[]` 生成。`RuntimeLevel` 按 `type` 过滤分桶。
 * 坐标系与敌人一致：(x,y) = 碰撞/渲染盒左上角（脚底贴地由放置坐标决定）。
 */
export type EntityDef =
  | EnemyEntityDef
  | VehicleEntityDef
  | ManholeEntityDef
  | PaperPileEntityDef
  | CoffeeSpillEntityDef
  | CoinEntityDef
  | SeedEntityDef
  | CheckpointEntityDef
  | ChestnutEntityDef;

/**
 * 关卡主题联合类型（theme-system §8 / sea-biome-spec §1/§8 契约）。
 * 未知 theme 经 resolveBiome 回退 'grass'（fail-safe，不抛错、零回归）。
 * 'mountain' = cave palette 别名（1-2 复用）；'sea' = 1-3 海主题（本批次新增）。
 * 'office' = 1-7 办公主题（批次 3，office-visual-spec §3 权威 8 槽，0 新增 hex）。
 * 'silhouette' = 2-4「剪影回廊」专属主题（逆光辉廊 + 暗蓝剪影，锁色板内 0 新增 hex）。
 * 'volcano' = 2-6「熔心终焉」第二章终章主题（熔岩 biome，volcano-biome-spec.md §1.2 权威 8 槽，锁色板内 0 新增 hex）。
 * 'astral' = 3-1「浮空初息」第三章开篇主题（星界 biome，astral-biome-spec.md §1.2 权威 8 槽，锁色板内 0 新增 hex；
 *            全 biome 唯一「明度翻面」：星白浮岩亮地面 #BEC4F9 + 墨蓝星空 #1F2244）。
 */
export type LevelTheme =
  | 'grass'
  | 'cave'
  | 'mountain'
  | 'vine_forest'
  | 'storm_sky'
  | 'sea'
  | 'desert'
  | 'home'
  | 'street'
  | 'office'
  | 'silhouette'
  | 'volcano'
  | 'astral';

/** S04-1/S04-2 敌人实体 schema（E3.S1/S2）：可由关卡 JSON 生成真实敌人（替代 C3 占位刺栗）。 */
export type EnemyEntityType =
  | 'ci_li'
  | 'du_fu'
  | 'chong_feng'
  | 'shi_pao'
  | 'gu_bao'
  | 'bouncy_vine'
  | 'cyclone'
  | 'du_fu_silhouette'
  | 'jellyfish'
  | 'scorpion'
  | 'cactus'
  | 'pet'
  | 'toy'
  | 'vehicle'
  | 'manhole'
  | 'paper_pile'
  | 'coffee_spill';

/**
 * 街道汽车实体（GDD 1-6 §3.2，批次 3 street 主题）：横向往返致命 hazard。
 * 碰撞 = 致命（applyFatalDeath，isStompable=false，硬顶不可踩）；接触即 respawn 到检查点、扣 1 命。
 * 在 [baseX, baseX+range] 间 ping-pong 往返；dir 初始方向（±1）；speed 像素/秒；phaseOffset(ms) 错相位。
 */
export interface VehicleEntityDef {
  type: 'vehicle';
  /** 往返区间左端（px，碰撞盒左上角 x 锚，y 由 ground y 决定）。 */
  x: number;
  /** 往返区间宽度（px）；右端 = x + range。缺省 224。 */
  range?: number;
  /** 速度（px/s）。缺省 90。 */
  speed?: number;
  /** 初始方向（±1，+1=朝终点/右，-1=朝左）。缺省 1。 */
  dir?: number;
  /** 初始相位偏移（ms，错峰多车不同步）。缺省 0。 */
  phaseOffset?: number;
  /** 碰撞盒宽（px）。缺省 48。 */
  w?: number;
  /** 碰撞盒高（px）。缺省 32。 */
  h?: number;
  /** 底部贴地 y（px，碰撞盒顶；碰撞盒底 = y + h = ground 顶，车辆贴地）。缺省 192。 */
  y: number;
}

/**
 * 街道井盖蒸汽实体（GDD 1-6 §3.3，批次 3 street 主题）：SAFE→TELEGRAPH→STEAM→SAFE 状态机。
 * 仅 STEAM 阶段蒸汽柱 [x-w/2, x+w/2]×[y-steamHeight, y] 为软伤害（resolveHazardContact，FULL→SMALL −1 级 + 无敌帧，不 respawn、不扣命）。
 * period(ms) 周期；activeMs STEAM 持续；telegraphMs 预警前摇（红边 + 不伤）；steamHeight 蒸汽柱高（px）；phaseOffset(ms) 错相位。
 */
export interface ManholeEntityDef {
  type: 'manhole';
  /** 井盖中心 x（px）。蒸汽柱以 x 为对称轴、宽 w。 */
  x: number;
  /** 井盖顶 y（px，地面/井口所在 worldY；蒸汽柱自 y 向上延伸 steamHeight）。缺省 224。 */
  y: number;
  /** 周期（ms，SAFE+TELEGRAPH+STEAM 一循环）。缺省 3000。 */
  period?: number;
  /** STEAM 持续（ms）。缺省 900。 */
  activeMs?: number;
  /** 预警前摇（ms，红边闪烁，不伤）。缺省 500。 */
  telegraphMs?: number;
  /** 蒸汽柱高（px）。缺省 96。 */
  steamHeight?: number;
  /** 井盖碰撞/绘制宽（px，蒸汽柱同宽）。缺省 32。 */
  w?: number;
  /** 初始相位偏移（ms，错峰多井盖不同步）。缺省 0。 */
  phaseOffset?: number;
}
export interface EnemyEntityDef {
  type: EnemyEntityType;
  x: number;
  y: number;
  /**
   * 每实例覆盖（数值型；向后兼容旧 4 敌）。
   * gu_bao：phaseOffset(ms 初始相位错相) / dormantMs / activeMs / height / width。
   * bouncy_vine：power(弹起速度倍率，normal=1.0 / strong=1.2 / weak=0.8) /
   *              bounceVelocity / width / height / springMs / recoilMs。
   * cyclone：w / h(气柱尺寸) / liftAcc / riseMax / dragX(实例级强度与尺寸覆盖)。
   * 其余敌(ci_li/du_fu/chong_feng/shi_pao)不读此字段。
   */
  params?: Record<string, number>;
}

/** S04-3 金币实体（经济内容源；碰玩家 → ON_COIN，联动 S04-4 经济 +10）。 */
export interface CoinEntityDef {
  type: 'coin';
  x: number;
  y: number;
}

/**
 * S04-3 种子实体（GDD 12 §5.4）：碰玩家 → ON_SEED_COLLECTED(seedId)。
 * 本 Story 仅发事件；maturity 局内累积 / 蜕变视觉（computeGrowth 四阶段）留专项 Story。
 */
export interface SeedEntityDef {
  type: 'seed';
  x: number;
  y: number;
  /** 种子类型 id（如 'seed_common'）；缺省回退 'seed_common'（由拾取解算处理）。 */
  seedId?: string;
}

/** S04-3 检查点实体：碰玩家 → 更新 respawnPoint + ON_CHECKPOINT（GDD 05 Must 重生语义）。 */
export interface CheckpointEntityDef {
  type: 'checkpoint';
  x: number;
  y: number;
}

/** Phase 5 栗子补给实体（GDD 17 §6.2）：碰玩家 → 弹药 +amount（封顶 ammoCap），发 ON_AMMO_CHANGED。不进分数经济。 */
export interface ChestnutEntityDef {
  type: 'chestnut';
  x: number;
  y: number;
  params?: { amount?: number };
}

/**
 * 办公文件堆（GDD 1-7 §3，office 主题）：可踩平台·非伤害（solid 堆叠物，玩家可站上/借以越障）。
 * 碰撞 = 实心（经 RuntimeLevel 将其覆盖瓦片标记进 solid 网格，类比 sofa/cabinet tile-kind，零新增碰撞机制）；
 * 不调用 applyDamage / applyFatalDeath。solidity='solid' 为全 AABB 实心（默认），'oneway' 仅顶可踩。
 * 坐标 (x,y) = 碰撞盒左上角（父级对齐瓦片，全 32 对齐），w/h 为盒宽高（px）。
 */
export interface PaperPileEntityDef {
  type: 'paper_pile';
  /** 碰撞盒左上角 x（px）。 */
  x: number;
  /** 碰撞盒左上角 y（px）。 */
  y: number;
  /** 盒宽（px）。缺省 32。 */
  w?: number;
  /** 盒高（px）。缺省 32。 */
  h?: number;
  /** 实心语义：'solid'=全 AABB 实心（默认），'oneway'=仅顶可踩。缺省 'solid'。 */
  solidity?: 'solid' | 'oneway';
}

/**
 * 办公咖啡渍（GDD 1-7 §3，office 主题）：地面局部低摩擦 zone·非碰撞·非伤害（R1 正确落点）。
 * 玩家 body 与该矩形 AABB 重叠且 grounded 时，水平减速按 cfg.friction * frictionScale 计算（打滑、难急停）；
 * 不造成任何伤害，不进入 damage-resolution。frictionScale ∈ (0,1)（越小越滑），缺省 0.35。
 */
export interface CoffeeSpillEntityDef {
  type: 'coffee_spill';
  /** zone 矩形左上角 x（px，贴地）。 */
  x: number;
  /** zone 矩形左上角 y（px）。 */
  y: number;
  /** zone 宽（px）。缺省 64。 */
  w?: number;
  /** zone 高（px）。缺省 32。 */
  h?: number;
  /** 低摩擦系数（0<scale<1，越小越滑）。缺省 0.35。 */
  frictionScale?: number;
}

export interface PropDef {
  type: string;
  x: number;
  y: number;
}

export interface CheckpointDef {
  x: number;
  y: number;
}

/** 出生点（像素坐标，body 左上角；脚底贴地面）。 */
export interface SpawnDef {
  x: number;
  y: number;
}

export interface GoalDef {
  type: string;
  x: number;
  y: number;
  /** 终点 AABB 宽（缺省 32）。 */
  w?: number;
  /** 终点 AABB 高（缺省 64）。 */
  h?: number;
}

/**
 * 潮汐段（GDD 1-3 §4.3）：水位线周期升降的地形机制。
 * 水位线 worldY 随段内 x 与时间正弦起伏；worldY 以下视作水域 hazard（软伤害）。
 * 全部单位 px / ms：`waterTopY(t) = mid + amp·sin(2π·(t+phase)/periodMs)`，
 * `mid=(lowY+highY)/2`、`amp=(lowY-highY)/2`（lowY>highY，故 amp>0）。
 */
export interface TideSegmentDef {
  /** 段 id（如 'tide_t1'）。 */
  id: string;
  /** 段 x 区间（px，含端点）。 */
  xStart: number;
  xEnd: number;
  /** 低潮水位线 worldY（px，水位最低，露出最多地面）。 */
  lowY: number;
  /** 高潮水位线 worldY（px，水位最高，淹没最多）。 */
  highY: number;
  /** 周期（ms）。 */
  periodMs: number;
  /** 初始相位偏移（ms），用于多段反相（如 T2 错开 T1）。 */
  phase: number;
}

/**
 * 暗流（riptide）区域力场（GDD 1-3 §5.1）：区域内给栗宝叠加水平速度偏置（轻量、可被输入覆盖）。
 * 类比 cyclone 力场，非实体、非碰撞；仅作 flavor 推力，不构硬锁。
 */
export interface RiptideDef {
  /** 区域 x 区间（px，含端点）。 */
  xStart: number;
  xEnd: number;
  /** 区域 y 区间（px）：yTop=顶、yBottom=底。 */
  yTop: number;
  yBottom: number;
  /** 水平速度偏置（px/s，正=朝终点方向推进）。 */
  vxBias: number;
}

/**
 * 流沙区（GDD 1-4 §4，批次 3 沙漠主题）：地面危险区域，进入后持续下陷，触底即死（respawn 到检查点）。
 * 区别于 1-3 潮汐（软伤害、可飞越），流沙致死但 telegraph + 逃脱窗口守住公平。
 * 全部单位 px / ms：玩家脚底进入 [xStart,xEnd] 且 y≥surfaceY（地面接触）即下陷；
 * 下陷速率在 telegraphMs 内由 0 渐变到 sinkRate；y≥deathY 触发死亡（复用 07 respawn）。
 * 空中（跳跃）不触发下陷（跳跃跨越 = 安全解法之一）。
 */
export interface QuicksandDef {
  /** 区 id（如 'qs_q1'）。 */
  id: string;
  /** 区 x 区间（px，含端点，落于地面之上）。 */
  xStart: number;
  xEnd: number;
  /** 流沙地表 worldY（= 地面顶 y，如 224）。 */
  surfaceY: number;
  /** 站立其中的下陷速率（px/s，telegraph 渐变后满速）。 */
  sinkRate: number;
  /** 下陷到此 worldY 即判定「触底死亡」（复用 07 死亡态，respawn 到检查点）。 */
  deathY: number;
  /** 进入后到达满速下陷前的渐变前摇（ms，漩涡+暗色渐显双编码 telegraph）。 */
  telegraphMs: number;
}

/** 节拍相位：平台可踩/可碰撞(solid) vs 虚化/可穿过(ghost)。 */
export type BeatPhase = 'solid' | 'ghost';

/** 节拍平台实体：一块由若干 tile 组成的「节拍平台」，由 tracks[].target 用 id 引用。 */
export interface BeatPlatformDef {
  /** 实例唯一 id；tracks[].target 引用此 id（无匹配 → 加载期 fail-fast）。 */
  id: string;
  /** 组成平台的瓦片坐标（逻辑 tile 网格，tx/ty 为整数）。可多块连成一条平台。 */
  tiles: Array<{ tx: number; ty: number }>;
  /** 第 0 拍之前（未触发任何 track 时）的保底相位；缺省 'ghost'（S05-1 实现口径）。 */
  initial?: BeatPhase;
}

/** 谱面一条目（BeatDef.tracks 的元素）。pattern 周期模式与 (beat+action) 单点模式二选一。 */
export interface BeatTrackEntry {
  /** 目标平台 id（引用 BeatPlatformDef.id）。无匹配 id → 加载期 fail-fast 抛错。 */
  target: string;
  /**
   * 周期模式：状态串，按 `beatIndex % pattern.length` 取字符映射：
   *   'S'=solid，'G'=ghost，'T'=toggle（相对上一拍相位取反，首拍取 initial 的反）。
   * MVP 仅用 S/G；T 留 Could 表现。非法字符 → 保持上一拍相位 + dev warn（不抛错）。
   */
  pattern?: string;
  /** 单点模式：精确拍号（0 起）；仅当 pattern 缺省且 beat===当前拍号时生效。 */
  beat?: number;
  /** 单点模式目标相位（pattern 缺省时生效）。 */
  action?: BeatPhase;
  /** 预留扩展（Could）：如 { hold:N } 表示触发后保持 N 拍再回到 default。MVP 不用。 */
  params?: Record<string, unknown>;
}

export interface BeatDef {
  enabled: boolean;
  bpm: number;
  grid: number;
  tracks: BeatTrackEntry[]; // S05-1：原 unknown[] → 真实谱面 schema
}

/**
 * 关卡级机制开关（GDD level-3-1-design §4.7，加法扩展，全部 optional）。
 *
 * 红线：**缺省 = 机制关闭**——旧 13 关（1-1~2-6）无此字段，行为完全不变（零回归）。
 * 机制本身不是「关卡实体」：entities[] 零新增类型、tiles[] 零新增 kind、敌人代码零改动。
 */
export interface LevelMechanicsDef {
  /**
   * 羽降（Feather Descent，第三章新动词「浮」）：true = 本关启用「条件性 maxFall 钳制」。
   * 语义见 character-controller.glideEnabled：下落段持续按住跳跃键 → 下落速度由全局 maxFall(900)
   * 钳到 GLIDE_MAX_FALL(140)，滞空大幅延长；不提供水平推力、不新增输入信号。
   * MVP 仅布尔开关；数值（fallMax / activateVy）集中在 physics-config.json，便于 QA 统一调校。
   */
  glide?: boolean;
}

export interface LevelData {
  id: string;
  version: number;
  tileSize: number;
  width: number;
  height: number;
  tiles: TileDef[];
  entities: EntityDef[];
  props: PropDef[];
  checkpoints: CheckpointDef[];
  goal: GoalDef;
  /** 出生点（逻辑 px）；缺省时由 Loader 按地面推算。 */
  spawn?: SpawnDef;
  beat: BeatDef;
  /** 节拍平台实体声明（S05-1）：独立于 entities/props，tracks[].target 用 id 引用一组 tile。 */
  beatPlatforms?: BeatPlatformDef[];
  /** 潮汐段（GDD 1-3 §4）：水位线升降地形机制；缺省 = 无潮汐。 */
  tideSegments?: TideSegmentDef[];
  /** 暗流（riptide）区域力场（GDD 1-3 §5.1）；缺省 = 无暗流。 */
  riptide?: RiptideDef[];
  /** 流沙区（GDD 1-4 §4，批次 3 沙漠主题）：地面下陷致死机制；缺省 = 无流沙。取代 1-3 的 tideSegments。 */
  quicksand?: QuicksandDef[];
  /**
   * 关卡级机制开关（3-1 起）：缺省 = 全部机制关闭（旧 13 关零回归）。
   * 目前仅 `glide`（羽降）；由 game-scene / headless 在 loadLevel 时注入 CharacterController。
   */
  mechanics?: LevelMechanicsDef;
  metadata: { name: string; theme: LevelTheme; parTimeMs?: number };
}

/** 最小化校验（E4.S1 扩展完整 schema 校验）。 */
export function validateLevelData(d: unknown): d is LevelData {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  const goal = o.goal as GoalDef | undefined;
  const spawn = o.spawn as SpawnDef | undefined;
  return (
    typeof o.id === 'string' &&
    typeof o.tileSize === 'number' &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    !!o.goal &&
    !!goal &&
    typeof goal.x === 'number' &&
    typeof goal.y === 'number' &&
    !!o.spawn &&
    !!spawn &&
    typeof spawn.x === 'number' &&
    typeof spawn.y === 'number' &&
    !!o.beat
  );
}
