/**
 * game/scenes/game-scene — E1.S1 微信最小可运行 demo 主场景（过 R2）。
 * 内容：1 个经 InputState 驱动的「栗宝」占位精灵 + 真实关卡（C5 Loader 构建的 CollisionWorld）+ 微信触屏四按钮。
 * 固定步长 60Hz：采样 → InputAbstraction → CharacterController.consume → stepBody(world) → 渲染 → 相机跟随 → 终点检测。
 *
 * Sprint 3 C1：stepSim 用同步协议（src/game/scene-sync）驱动 body，消除 F1/F2/F3。
 * Sprint 3 C5：用 LevelLoader 建 RuntimeLevel 替换占位地板；出生点初始化；相机跟随；凯旋之门 AABB 重叠 → ON_LEVEL_COMPLETE。
 * 逻辑层零平台分支。
 */
import Phaser from 'phaser';
import type { Platform } from '../../platform/platform';
import type { RawInputProvider } from '../../core/input/raw-input';
import type { PointerSink } from '../../platform/raw-input-provider';
import { InputAbstraction, type InputState } from '../../core/input/input-abstraction';
import {
  webInputConfig,
  wechatInputConfig,
  characterConfig,
  damageConfig,
  economyConfig,
  attackConfig,
  STEP_MS,
  STEP_DT,
  levels,
  LEVEL_ORDER,
} from '../../core/config';
import { nextLevelId } from '../../core/level/level-order';
import { CharacterController } from '../../core/character/character-controller';
import { DamageStateMachine } from '../../core/damage/damage-state-machine';
import type { Body } from '../../core/physics/body';
import type { CollisionWorld } from '../../core/physics/collision';
import { LevelLoader } from '../../core/level/level-loader';
import type { QuicksandDef } from '../../core/level/level-data';
import type { RuntimeLevel } from '../../core/level/level-runtime';
import { EventBus, ON_LAND, ON_LEVEL_COMPLETE, ON_PAUSE, ON_RESUME, ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER, ON_RESTART, ON_COIN, ON_STOMP, ON_SCORE_CHANGED, ON_JUMP, ON_PROJECTILE_SPAWN, ON_BEAT, ON_NEXT_LEVEL, ON_RETURN_TITLE, ON_SEED_COLLECTED, ON_SEED_GROWTH, ON_SEED_METAMORPHOSIS, ON_BOUNCE, ON_CHESTNUT_THROWN, ON_AMMO_CHANGED, ON_AMMO_EMPTY, ON_CHESTNUT_HIT, ON_PROJECTILE_CANCEL } from '../../core/events/event-bus';
import { FixedStep } from '../fixed-step';
import { BeatClock } from '../../core/beat/beat-clock';
import { BeatDrivenSystem } from '../../core/beat/beat-driven-system';
import { advanceBeat } from '../../core/beat/advance-beat';
import { drawLibaoPlaceholder } from '../../ui/placeholder';
import { Hud } from '../../ui/hud';
import { TouchButtons } from '../../ui/touch-buttons';
import { PauseMenu } from '../../ui/pause-menu';
import { ResultScreen, evaluateRanks } from '../../ui/result-screen';
// RankResult 类型归属 core（S05-3）；SaveManager 消费平台注入的 storage 落盘（core 零平台 API）。
import { SaveManager, type RankResult } from '../../core/meta/save-data';
import { runStepSim } from '../scene-sync';
import { resolveHazardContact, applyFatalDeath } from '../damage-resolution';
import { FollowCamera } from '../camera/follow-camera';
import { RunStateMachineImpl, type RunStateMachine } from '../../core/state/run-state-machine';
import { RunLifecycle } from '../../core/state/run-lifecycle';
import { resolveActiveMenu } from '../../core/state/menu-tap';
// S05-4 薄音频总线：订阅事件总线 → platform.audio.play(name)；仅依赖 AudioPort 类型，不反向依赖平台实现。
import { AudioBus } from '../audio/audio-bus';
import { drawEnemy } from '../render/enemy-view';
import { biomeForLevel, type ThemePalette } from '../render/theme-palette';
// GDD 1-3：潮汐水位线 + 暗流力场（core 零平台纯函数，本层仅消费）。
import { tideSurfaceY, tideSegmentAt } from '../../core/tide/tide';
import { riptideAt } from '../../core/tide/riptide';
import { drawProjectile } from '../render/projectile-view';
import { drawCoin } from '../render/coin-view';
import { drawSeed } from '../render/seed-view';
import { drawCheckpoint } from '../render/checkpoint-view';
import { resolvePickups } from '../pickup-resolution';
// GDD 1-4：流沙下陷致死机制（core 零平台纯函数，本层仅消费）。
import {
  quicksandZoneAt,
  isQuicksandSinking,
  quicksandSinkRate,
  quicksandBottomedOut,
  quicksandVisualOffset,
} from '../../core/quicksand/quicksand';
// GDD 17 扔栗子机制：控制器 + 弹丸（core 零平台）/ 弹药 HUD / 弹丸渲染（ui / game 层）。
import { ThrowController } from '../../core/attack/throw-controller';
import { ChestnutProjectile } from '../../core/attack/chestnut-projectile';
import { AmmoHud } from '../../ui/ammo-hud';
import { ChestnutView } from '../render/chestnut-view';
import { createSeedRuntime, accumulateOnCollect } from '../../core/seed/seed-runtime';
import { drawMaliTopper, playMetamorphAura, drawSeedAura } from '../render/mali-topper';
import type { Stage, SeedRuntimeState } from '../../core/seed/seed-types';
import { EnemyAI, createEnemies } from '../../core/enemy/enemy-ai';
import { Projectile } from '../../core/enemy/projectile';
import type { HazardSource } from '../../core/damage/hazard-source';
import { EconomyController } from '../../core/economy/economy';
import { detectEnv } from '../../platform/detect';
import { createPlatform } from '../../platform';

const PLAYER_W = 24;
const PLAYER_H = 34;

// 受伤 juice 时长（hud-spec §5.1 / §5.3，来自规格、非命数/无敌时长/缩放，允许字面量）。
const HIT_FLASH_MS = 150; // 受击闪红（§5.1）
const RESPAWN_FADE_MS = 200; // 重生淡入（§5.3）

/**
 * 结算星级「目标时间」兜底（ms）。GDD 05 parTime 未定，先在关卡 metadata 加 `parTimeMs`，
 * 缺省回退此值（待主理人拍板，见回传 ③）。1-1.json 已写入 60000ms（60s）作占位。
 */
const DEFAULT_PAR_TIME_MS = 60000;

/**
 * 中性输入（全 false）：击退 hitstun 期间替换玩家输入，使 controller 不消费方向/跳跃，
 * 角色仅由物理积分击退（R3，integration-plan §5.3）。字段与 InputState 完全一致。
 */
const NEUTRAL_INPUT: InputState = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpHeld: false,
  jumpReleased: false,
  actionPressed: false,
  actionHeld: false,
  actionReleased: false,
  jumpPressedAt: 0,
  throwPressed: false,
  throwHeld: false,
  throwReleased: false,
};

export class GameScene extends Phaser.Scene {
  private platform!: Platform;
  private abstraction!: InputAbstraction;
  private controller!: CharacterController;
  private body!: Body;
  private world!: CollisionWorld;
  private runtime!: RuntimeLevel;
  /** S06 进度链：当前关卡 id（默认首关）；restart/下一关经此切换。 */
  private currentLevelId: string = LEVEL_ORDER[0];
  /** 分享深链：Boot 经 scene.start('Game', { startLevel }) 传入的待进关卡。 */
  private pendingStartLevel?: string;
  /** 关卡地形 Graphics（loadLevel 重建时先销毁旧实例，避免泄漏）。 */
  private levelGfx?: Phaser.GameObjects.Graphics;
  /** 海主题背景-天空/水面层（scrollFactor 0，depth -10，全屏竖直渐变，仅 sea 创建一次）。 */
  private seaSkyGfx?: Phaser.GameObjects.Graphics;
  /** 海主题背景-远景层（scrollFactor 0.3，depth -9，远礁剪影 + 海底剪影带，仅 sea 创建一次）。 */
  private seaFarGfx?: Phaser.GameObjects.Graphics;
  /** 海主题背景-中景层（scrollFactor 0.6，depth -8，浪线 + 珊瑚 + 气泡，仅 sea 创建一次）。 */
  private seaMidGfx?: Phaser.GameObjects.Graphics;
  /** 海主题背景-前景层（scrollFactor 1.2，depth 4，每帧 clear+重绘的动态浪花/气泡，仅 sea 创建一次）。 */
  private seaNearGfx?: Phaser.GameObjects.Graphics;
  /** 海主题潮汐水体叠层（世界坐标，随相机滚动；每帧按 waterSurfaceY 重绘，仅 sea 关卡创建）。 */
  private tideGfx?: Phaser.GameObjects.Graphics;
  /** 潮汐波浪相位累加器（≤2Hz，Reduce Motion 下冻结，仅海关使用）。 */
  private tidePhase = 0;
  /** 前景近景气泡相位累加器（≤3Hz，Reduce Motion 下冻结，仅海关使用）。 */
  private seaNearPhase = 0;
  /** 沙漠主题背景-天空层（scrollFactor 0，depth -10，全屏竖直渐变，仅 desert 创建一次）。 */
  private desertSkyGfx?: Phaser.GameObjects.Graphics;
  /** 沙漠主题背景-远景层（scrollFactor 0.3，depth -9，沙丘剪影，仅 desert 创建一次）。 */
  private desertFarGfx?: Phaser.GameObjects.Graphics;
  /** 沙漠主题背景-中景层（scrollFactor 0.6，depth -8，金字塔+仙人掌，仅 desert 创建一次）。 */
  private desertMidGfx?: Phaser.GameObjects.Graphics;
  /** 沙漠主题背景-中景太阳脉冲层（scrollFactor 0.6，depth -8，每帧重绘，仅 desert 创建一次）。 */
  private desertSunGfx?: Phaser.GameObjects.Graphics;
  /** 沙漠主题背景-前景沙幕层（scrollFactor 1.2，depth 4，每帧重绘，仅 desert 创建一次）。 */
  private desertNearGfx?: Phaser.GameObjects.Graphics;
  /** GDD 1-4 流沙叠层（世界坐标，随相机滚动；每帧按 sink 状态重绘，仅 desert 关卡创建）。 */
  private quicksandGfx?: Phaser.GameObjects.Graphics;
  /** 流沙太阳脉冲相位累加器（≤2Hz，Reduce Motion 下冻结，仅沙漠关使用）。 */
  private desertSunPhase = 0;
  /** 前景沙幕相位累加器（Reduce Motion 下冻结，仅沙漠关使用）。 */
  private desertVeilPhase = 0;
  /** 沙漠主题背景-热浪蜃气层（scrollFactor 0.4，depth -8.5，每帧重绘，仅 desert 创建一次）。 */
  private desertHeatGfx?: Phaser.GameObjects.Graphics;
  /** 热浪相位累加器（≤1.5Hz，Reduce Motion 下冻结，仅沙漠关使用）。 */
  private desertHeatPhase = 0;
  /** 家主题背景-天花板+后墙层（scrollFactor 0，depth -10，全屏竖直渐变，仅 home 创建一次）。 */
  private homeWallGfx?: Phaser.GameObjects.Graphics;
  /** 家主题背景-远景层（scrollFactor 0.3，depth -9，窗光 + 家具剪影带，仅 home 创建一次）。 */
  private homeFarGfx?: Phaser.GameObjects.Graphics;
  /** 家主题背景-中景层（scrollFactor 0.6，depth -8，相框 + 盆栽 + 灯架，仅 home 创建一次）。 */
  private homeMidGfx?: Phaser.GameObjects.Graphics;
  /** 家主题背景-中景台灯脉冲层（scrollFactor 0.6，depth -8，每帧重绘，仅 home 创建一次）。 */
  private homeLampGfx?: Phaser.GameObjects.Graphics;
  /** 家主题背景-前景窗帘层（scrollFactor 1.2，depth 4，每帧重绘，仅 home 创建一次）。 */
  private homeNearGfx?: Phaser.GameObjects.Graphics;
  /** 台灯脉冲相位累加器（≤2Hz，Reduce Motion 下冻结，仅家关使用）。 */
  private homeLampPhase = 0;
  /** 窗帘飘移相位累加器（≤2Hz，Reduce Motion 下冻结，仅家关使用）。 */
  private homeCurtainPhase = 0;
  /** 街道主题背景-天花板+后墙层（scrollFactor 0, depth -10，全屏竖直渐变，仅 street 创建一次）。 */
  private streetCeilWallGfx?: Phaser.GameObjects.Graphics;
  /** 街道主题背景-远景层（scrollFactor 0.3, depth -9，楼宇剪影 + 窗光，仅 street 创建一次）。 */
  private streetFarGfx?: Phaser.GameObjects.Graphics;
  /** 街道主题背景-中景层（scrollFactor 0.6, depth -8，街灯 + 霓虹 + 树，仅 street 创建一次）。 */
  private streetMidGfx?: Phaser.GameObjects.Graphics;
  /** 街道主题背景-中景辉光层（scrollFactor 0.6, depth -8，每帧重绘：街灯晕 + 霓虹脉冲）。 */
  private streetGlowGfx?: Phaser.GameObjects.Graphics;
  /** 街道主题背景-前景护栏层（scrollFactor 1.2, depth 4，每帧重绘：护栏门控闪烁）。 */
  private streetNearGfx?: Phaser.GameObjects.Graphics;
  /** 街景窗光相位累加器（≤2Hz，Reduce Motion 下冻结，仅街道关使用）。 */
  private streetWindowPhase = 0;
  /** 街灯辉光相位累加器（≤2Hz，Reduce Motion 下冻结，仅街道关使用）。 */
  private streetLampPhase = 0;
  /** 霓虹脉冲相位累加器（≤2Hz，Reduce Motion 下冻结，仅街道关使用）。 */
  private streetNeonPhase = 0;
  /** 前景护栏门控相位累加器（Reduce Motion 下冻结，仅街道关使用）。 */
  private streetNearPhase = 0;
  /** 办公主题背景-天花板+后墙层（scrollFactor 0, depth -10，全屏荧光渐变，仅 office 创建一次）。 */
  private officeWallGfx?: Phaser.GameObjects.Graphics;
  /** 办公主题背景-远景层（scrollFactor 0.3, depth -9，隔断剪影 + 窗光，仅 office 创建一次）。 */
  private officeFarGfx?: Phaser.GameObjects.Graphics;
  /** 办公主题背景-中景层（scrollFactor 0.6, depth -8，办公桌 + 显示器 + 绿植 + 荧光灯架本体，仅 office 创建一次）。 */
  private officeMidGfx?: Phaser.GameObjects.Graphics;
  /** 办公主题背景-中景辉光层（scrollFactor 0.6, depth -8，每帧重绘：荧光灯管微闪 + 屏光/窗光脉冲）。 */
  private officeGlowGfx?: Phaser.GameObjects.Graphics;
  /** 办公主题背景-前景悬挑/电线层（scrollFactor 1.2, depth 4，每帧重绘：隔断悬挑/电线掠过）。 */
  private officeNearGfx?: Phaser.GameObjects.Graphics;
  /** 办公荧光灯管相位累加器（≤2Hz，Reduce Motion 下冻结，仅办公关使用）。 */
  private officeFluorescentPhase = 0;
  /** 办公窗光脉冲相位累加器（≤2Hz，Reduce Motion 下冻结，仅办公关使用）。 */
  private officeWindowPhase = 0;
  /** 办公屏光脉冲相位累加器（≤2Hz，Reduce Motion 下冻结，仅办公关使用）。 */
  private officeScreenPhase = 0;
  /** 草原主题背景-天空层（scrollFactor 0，depth -10，全屏竖直渐变，仅 grass 创建一次）。 */
  private grassSkyGfx?: Phaser.GameObjects.Graphics;
  /** 草原主题背景-远景层（scrollFactor 0.3，depth -9，远山+云+温室剪影，仅 grass 创建一次）。 */
  private grassFarGfx?: Phaser.GameObjects.Graphics;
  /** 草原主题背景-中景层（scrollFactor 0.6，depth -8，树+风车+花丛，仅 grass 创建一次）。 */
  private grassMidGfx?: Phaser.GameObjects.Graphics;
  /** 草原主题背景-前景层（scrollFactor 1.2，depth 4，草丛+花瓣，仅 grass 创建一次，静态）。 */
  private grassNearGfx?: Phaser.GameObjects.Graphics;
  /** 办公前景悬挑/电线门控相位累加器（Reduce Motion 下冻结，仅办公关使用）。 */
  private officeNearPhase = 0;
  /** 当前下陷区（sinking 时记录，供 sprite 下沉视觉 offset；非 sinking 时 null）。 */
  private qsZone: QuicksandDef | null = null;
  /** 流沙下陷累计时间（ms），用于 telegraph 渐变速率。 */
  private qsSinkMs = 0;
  /** 流沙累计下陷深度（px），达到 (deathY-surfaceY) 触发触底死亡。 */
  private qsSinkDepth = 0;
  /** S05-1 节拍时钟：从关卡 beat 建；enabled 时每固定步门控。 */
  private beatClock?: BeatClock;
  /** S05-1 节拍驱动系统：按 tracks 在跨拍瞬间切平台 solid/ghost；无平台/无 track 时为 undefined。 */
  private beatSystem?: BeatDrivenSystem;
  private goal!: { x: number; y: number; w: number; h: number };
  private camera!: FollowCamera;
  private bus!: EventBus;
  /** S05-4 薄音频总线：把真实游戏事件转发到 platform.audio.play(name)；shutdown 时 destroy。 */
  private audioBus?: AudioBus;
  private loop!: FixedStep;
  private sprite!: Phaser.GameObjects.Graphics;
  private touchButtons?: TouchButtons;
  /** 上一帧 stepBody 解算的着地状态（in 注入 consume 前，消除 F3 滞后）。 */
  private lastGrounded = true;
  /** 关卡已完成标记，避免重复发 ON_LEVEL_COMPLETE。 */
  private levelComplete = false;

  // ── C3 受伤管线 ──
  /** 受伤状态机（FULL/SMALL/DEAD + 无敌帧 + sizeScale）。 */
  private damage!: DamageStateMachine;
  /** 击退失控计时（ms）：>0 期间跳过 consume，仅物理积分击退（R3）。 */
  private hitstunTimer = 0;
  /** S04-1 真实可踩敌人（替代 C3 占位刺栗），经同一 damage-resolution 管线解算。 */
  private enemies: EnemyAI[] = [];
  /** 检查点（出生点），重生落点。 */
  private spawn!: { x: number; y: number };
  /** 敌人渲染 Graphics（世界坐标，随相机滚动）。 */
  private enemyGfx?: Phaser.GameObjects.Graphics;
  /** S04-2：石炮发射的弹丸列表（独立 hazard，碰玩家受伤），每步积分移动，dead 后移除。 */
  private projectiles: Projectile[] = [];
  /** S04-2：弹丸占位渲染 Graphics（世界坐标，随相机滚动，depth 对齐 enemy）。 */
  private projectileGfx?: Phaser.GameObjects.Graphics;

  // ── S04-3 实体 / 检查点（coin/seed/checkpoint 生成 + 拾取 + 重生）──
  /** 检查点重生点（S04-3）：触碰 checkpoint 后更新；死亡重生 / restart 落此。初始化为出生点。 */
  private respawnPoint: { x: number; y: number } = { x: 0, y: 0 };
  /** 已拾取金币去重集合（索引 → 防重复计数 / 重复事件）。 */
  private collectedCoins = new Set<number>();
  /** 已拾取种子去重集合（索引 → 防重复事件）。 */
  private collectedSeeds = new Set<number>();
  /** 金币 / 种子 / 检查点占位渲染 Graphics（世界坐标，随相机滚动）。 */
  private coinGfx?: Phaser.GameObjects.Graphics;
  private seedGfx?: Phaser.GameObjects.Graphics;
  private checkpointGfx?: Phaser.GameObjects.Graphics;

  // ── GDD 12 种子蜕变（局内 runtime + 头顶 topper 视觉）──
  /** 本局种子运行时：每关 loadLevel 重置（createSeedRuntime）。core 零平台纯逻辑，此层仅委托。 */
  private seedRun!: SeedRuntimeState;
  /** 当前头顶 topper 阶段（METAMORPHOSIS 时更新；每帧据此重绘跟随 body）。 */
  private currentSeedStage: Stage = 'sprout';
  /** 头顶蜕变物 Graphics（世界坐标，depth 高于角色；仅视觉，不改碰撞）。 */
  private topperGfx?: Phaser.GameObjects.Graphics;
  /** topper 几何是否已随 stage 重绘（stage 不变则每帧仅移动 Graphics，避免重建几何）。 */
  private topperDirty = true;
  /** 稳态暖黄光晕 Graphics（世界坐标，depth 介于身体(10)与 topper(12) 间；每帧跟随 body 重绘）。 */
  private auraGfx?: Phaser.GameObjects.Graphics;
  /** 减少动态（D3）：跳过蜕变光晕脉冲 tween，仅保留静态稳态光晕。来源 platform.reduceMotion。 */
  private reduceMotion = false;

  // ── S04-4 经济 / 分数（core 零平台 API）──
  /** 经济控制器：踩怪/金币/通关计分 + 连击倍率（GDD 06）。 */
  private economy!: EconomyController;
  /** S04-4 economy 事件订阅 off 集合（shutdown 解绑）。 */
  private economyOffs: Array<() => void> = [];
  /** S04-5：HUD 已同步的连击倍率；用于检测连击窗超时（economy.update 内部清零）后仅发一次 ON_SCORE_CHANGED。 */
  private prevComboMult = 1;

  // ── S05-2 暂停/结算/RunState 机（架构 §6.2）──
  /** 顶层 RUN 状态机（与实体 DamageState 正交，互不写字段）。 */
  private runState!: RunStateMachine;
  /** E7.S3 / S05-5：微信生命周期闭环策略（零平台，包装 RunStateMachine + 事件）。 */
  private lifecycle!: RunLifecycle;
  /** 暂停冻结标志：update/stepSim 顶部早退，仿真冻结、输入不丢。 */
  private paused = false;
  /** 本次游玩计时（ms）：仅在 PLAYING 每固定步累加，暂停/结算/GameOver 不涨。 */
  private elapsedMs = 0;
  /** 暂停遮罩 + 继续/重玩（PauseMenu）。 */
  private pauseMenu?: PauseMenu;
  /** 通关结算 + 星级（ResultScreen）。 */
  private resultScreen?: ResultScreen;
  /** S05-3：存档管理器（经平台注入 storage，core 零平台 API）。通关时落盘最优成绩。 */
  private saveManager!: SaveManager;

  // ── GDD 17 扔栗子机制 ──
  /** 投掷/弹药控制器（core 零平台纯逻辑）：tryThrow / addAmmo / update / reset。 */
  private throwController!: ThrowController;
  /** 当前飞行中的栗子弹丸列表（己方，不触发受伤）；每步积分 + 与敌人/炮弹矩阵 + 压缩。 */
  private chestnuts: ChestnutProjectile[] = [];
  /** 弹药 HUD（右上角，订阅 ON_AMMO_CHANGED 刷新）；一次性创建，每关 loadLevel 内 reset。 */
  private ammoHud?: AmmoHud;
  /** 栗子弹丸渲染（世界坐标，depth 10）。 */
  private chestnutView?: ChestnutView;
  /** 已拾取栗子补给去重集合（索引 → 防重复事件）。 */
  private collectedChestnuts = new Set<number>();

  // ── HUD + 受伤 juice（design/ux/hud-spec.md）──
  /** 命数 HUD + 形态指示 + Game Over 覆盖层（ui 层，Phaser）。 */
  private hud!: Hud;
  /** 受击闪红覆盖层（世界坐标跟随 body，depth = 栗宝+1）。 */
  private flashGfx?: Phaser.GameObjects.Graphics;
  /** 受击闪红计时（ms，hud-spec §5.1）：ON_HURT 时置 150。 */
  private hitFlashTimer = 0;
  /** 重生淡入计时（ms，hud-spec §5.3）：ON_RESPAWN 时置 200，期间压制无敌闪烁。 */
  private respawnFadeTimer = 0;
  /** Game Over 冻结标志（update 早退，暂停仿真）。 */
  private gameOver = false;
  /** ON_RESTART 订阅 off（场景 shutdown 时解绑）。 */
  private offRestart?: () => void;
  /** 微信原生触摸重试 handler（restartGame 清理，避免重复监听）。 */
  private restartTouchHandler?: () => void;
  /**
   * S05-5：原生菜单点击路由（由 Platform.setNativeMenuTap 注入，仅微信端生效）。
   * 把逻辑坐标派发给当前可见菜单的 handleTap（PauseMenu / ResultScreen，S05-2 已暴露）。
   * 仅当菜单激活（resolveActiveMenu 非 null）时才点中按钮，否则交给 gameplay 输入。
   * 坐标系同 input-abstraction：逻辑分辨率 512×288（handleTap 命中盒同坐标系）。
   */
  private readonly routeMenuTap = (x: number, y: number): void => {
    const target = resolveActiveMenu({
      paused: this.paused,
      levelComplete: this.levelComplete,
      pauseBuilt: this.pauseMenu?.isBuilt ?? false,
      resultBuilt: this.resultScreen?.isBuilt ?? false,
    });
    if (target === 'pause') this.pauseMenu?.handleTap(x, y);
    else if (target === 'result') this.resultScreen?.handleTap(x, y);
  };

  constructor() {
    super('Game');
  }

  /** 分享深链：Boot 经 scene.start('Game', { startLevel }) 带 data 进入时调用。 */
  init(data: { startLevel?: string }): void {
    this.pendingStartLevel = data?.startLevel;
  }

  create(): void {
    // ── 防御式兜底（§9 迭代修复）：registry 在微信运行时可能读不到 platform/events ──
    // 诊断：确认 registry 中 platform 是否存在（帮助定位本层阻塞）。
    const regPlatform = this.registry.get('platform');

    // globalThis 兜底层（由 main.ts 写入 __superMaliPlatform / __superMaliEvents）。
    const gm = globalThis as unknown as {
      __superMaliPlatform?: Platform;
      __superMaliEvents?: EventBus;
    };

    // 优先级：registry → globalThis 兜底 → 重新创建（detectEnv + createPlatform）。
    if (regPlatform && (regPlatform as Platform).env) {
      this.platform = regPlatform as Platform;
    } else if (gm.__superMaliPlatform) {
      this.platform = gm.__superMaliPlatform;
    } else {
      const env = detectEnv();
      this.platform = createPlatform(env);
    }

    // events 同样三层兜底：registry → globalThis → new EventBus()。
    const regEvents = this.registry.get('events');
    if (regEvents) {
      this.bus = regEvents as EventBus;
    } else if (gm.__superMaliEvents) {
      this.bus = gm.__superMaliEvents;
    } else {
      this.bus = new EventBus();
    }

    // 兜底创建/读取后写回 registry，后续场景可复用。
    this.registry.set('platform', this.platform);
    this.registry.set('events', this.bus);

    // S05-4：尽早订阅音频总线（事件→play name）。本游戏无首帧必需音效，早注册安全。
    this.audioBus = new AudioBus(this.bus, this.platform.audio);
    // D3 Reduce Motion：来源 platform 注入（默认 false），game-scene 据此跳过光晕脉冲 tween。
    this.reduceMotion = this.platform.reduceMotion ?? false;

    // 输入归一器（按平台选映射）
    this.abstraction = new InputAbstraction(
      this.platform.env === 'wechat' ? wechatInputConfig : webInputConfig,
    );

    // 占位精灵（Graphics 运行时绘制，不依赖 PNG —— 见 art/placeholder-spec.md）。
    // body/controller/damage/关卡渲染等「按关卡」的初始化统一在 loadLevel 完成（S06 进度链复用）。
    this.sprite = this.add.graphics();
    this.sprite.setDepth(10); // 高于世界层（drawLevel 其后 add，hud-spec §8.3），避免被地形遮挡

    // ── HUD + 受伤 juice 接线（hud-spec §8.4 / 实现合同）──
    // 受击闪红覆盖层（世界坐标跟随 body，depth = 栗宝+1，不进 HUD 层）。
    this.flashGfx = this.add.graphics().setDepth(11);
    // Hud 用 getter 读最新 damage：重生/重启会 new DamageStateMachine，避免读到过期实例（关键陷阱）。
    // 初始绘制延后到 loadLevel（S06）：此时 damage 已就绪，避免读到 undefined。
    this.hud = new Hud(this, this.bus, () => this.damage, damageConfig.initialLives);

    // S05-2：RunState 机 + 暂停/结算 UI（架构 §6.2，与 DamageState 正交）。
    this.runState = new RunStateMachineImpl('PLAYING');
    // S05-5：微信生命周期闭环策略（仅 PLAYING 后台暂停、仅后台暂停才恢复、不碰输入）。
    this.lifecycle = new RunLifecycle(this.runState, (name, payload) => this.bus.emit(name, payload));
    this.pauseMenu = new PauseMenu(this, this.bus);
    this.resultScreen = new ResultScreen(this, this.bus);
    // S05-3：存档管理器（经平台注入 storage + 关卡顺序 LEVEL_ORDER，通关解锁下一关）。
    this.saveManager = new SaveManager(this.platform.storage, undefined, LEVEL_ORDER);

    // GDD 17：扔栗子机制实例化（控制器 + 弹药 HUD + 弹丸渲染；每关 loadLevel 内 reset 弹药）。
    // 必须在 loadLevel（首关）之前创建，使 loadLevel 的 ON_AMMO_CHANGED 重绘命中订阅。
    this.throwController = new ThrowController(attackConfig);
    this.ammoHud = new AmmoHud(this, this.bus, attackConfig.ammoStart, attackConfig.ammoCap);
    this.chestnutView = new ChestnutView(this);

    // S04-4 经济/分数：实例化控制器并订阅事件 → 计算 → 发 ON_SCORE_CHANGED（供 S04-5 HUD）。
    // 不破坏 S04-1 已落地的踩敌链路（ON_STOMP 由 damage-resolution 发放）；此处仅订阅/计算。
    this.economy = new EconomyController(economyConfig);
    this.economyOffs.push(
      this.bus.on(ON_STOMP, () => { this.economy.onStomp(); this.emitScoreChange(); }),
      this.bus.on(ON_COIN, () => { this.economy.onCoin(); this.emitScoreChange(); }), // S04-3 实体放置后触发；此处仅订阅/预留
      this.bus.on(ON_LEVEL_COMPLETE, () => { this.economy.onLevelComplete(); this.emitScoreChange(); }),
      this.bus.on(ON_DEATH, () => { this.economy.onDeath(); this.emitScoreChange(); }), // 死亡仅重置连击
      // HUD 预留（S04-5 绘制）：订阅 ON_SCORE_CHANGED 写字段，不绘制分数。
      this.bus.on(ON_SCORE_CHANGED, (p) => this.onScoreChanged(p)),
    );

    // ON_RESTART：干净 reset（场景内重开，非 scene.restart，状态更可控）。
    this.offRestart = this.bus.on(ON_RESTART, () => this.restartGame());
    // S06：结算页「下一关」按钮 → 加载下一关；末关时返回标题。
    this.bus.on(ON_NEXT_LEVEL, () => {
      this.resultScreen?.hide();
      this.platform.setMenuActive?.(false);
      const n = nextLevelId(LEVEL_ORDER, this.currentLevelId);
      if (n) {
        this.loadLevel(n);
        // S05-4-BGM：下一关重启 stage BGM。
        this.platform.audio.playMusic('music:stage');
      } else this.scene.start('Title');
    });
    // 结算页「关卡选择」按钮 → 返回标题。
    this.bus.on(ON_RETURN_TITLE, () => {
      this.resultScreen?.hide();
      this.platform.setMenuActive?.(false);
      this.scene.start('Title');
    });

    // 受伤 juice 计时（game-scene 自管，与 Hud 并存）：受击闪红 / 重生淡入。
    this.bus.on(ON_HURT, () => { this.hitFlashTimer = HIT_FLASH_MS; });
    this.bus.on(ON_RESPAWN, () => { this.respawnFadeTimer = RESPAWN_FADE_MS; });

    // Game Over：冻结 + 覆盖层 + 跨端重试触发（hud-spec §6.2）。
    this.bus.on(ON_GAME_OVER, () => this.onGameOver());

    // GDD 12 种子蜕变：采集 → accumulateOnCollect（core 纯函数）→ 必发 ON_SEED_GROWTH；
    // 仅当 stage 跨阈值再发 ON_SEED_METAMORPHOSIS。绝不改 form / sizeScale / 碰撞盒（仅视觉）。
    this.bus.on(ON_SEED_COLLECTED, (_seedId) => {
      if (!this.seedRun) return;
      const res = accumulateOnCollect(this.seedRun);
      this.bus.emit(ON_SEED_GROWTH, { growthPct: res.growthPct, stage: res.stage });
      if (res.stageChanged) {
        this.bus.emit(ON_SEED_METAMORPHOSIS, res.stage);
      }
    });
    // 蜕变跨阈值：更新头顶 topper 阶段 + 播放暖黄光晕（仅视觉反馈，不改任何玩法状态）。
    this.bus.on(ON_SEED_METAMORPHOSIS, (stage) => {
      this.currentSeedStage = stage as Stage;
      this.topperDirty = true; // 阶段切换才重绘 topper 几何（节流）
      // GDD 17 §3.1 / D2-A：种子达 fruit 阶段 → 多段跳加成 =1（ landings 后 airJumpsLeft = airJumps + bonus）。
      if (stage === 'fruit') this.controller.airJumpBonus = 1;
      const cx = this.body.x + PLAYER_W / 2;
      const topY = this.body.y;
      // 光晕中心=头顶上方 6px（spec §2/§10.2，S2 中心修正：body 中部→头顶上方）；
      // Reduce Motion 跳过脉冲 tween，仅稳态光晕（D3）。
      if (!this.reduceMotion) playMetamorphAura(this, cx, topY - 6);
    });

    // S05-2：暂停/结算/继续 事件接线（RunState 机驱动流转，单一事实来源）。
    this.bus.on(ON_PAUSE, (p) => this.onPause(p));
    this.bus.on(ON_RESUME, () => this.onResume());
    this.bus.on(ON_LEVEL_COMPLETE, (p) => this.onLevelComplete(p));

    // S05-2 最小钩子 + S05-5 深适配：微信 onHide→后台暂停、onShow→恢复（RunLifecycle 闭环）。
    // 策略（仅后台暂停才 onShow 恢复、输入不碰 → 连续）在 core/state/run-lifecycle。
    this.platform.lifecycle?.onHide?.(() => this.lifecycle.onHide());
    this.platform.lifecycle?.onShow?.(() => this.lifecycle.onShow());
    // S05-5：注入原生菜单点击路由（微信端把触摸逻辑坐标派发给 PauseMenu/ResultScreen.handleTap）。
    this.platform.setNativeMenuTap?.(this.routeMenuTap);

    // 场景 shutdown（若未来 scene.restart）清理订阅与 HUD（hud-spec §8.1，可选但稳妥）。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offRestart?.();
      this.offRestart = undefined;
      // S05-4-BGM：场景关闭即停 BGM（避免跨场景残留循环）。
      this.platform.audio.stopMusic();
      this.audioBus?.destroy();
      this.audioBus = undefined;
      for (const off of this.economyOffs) off();
      this.economyOffs.length = 0;
      this.coinGfx?.destroy();
      this.seedGfx?.destroy();
      this.checkpointGfx?.destroy();
      this.topperGfx?.destroy();
      this.auraGfx?.destroy();
      this.levelGfx?.destroy();
      this.pauseMenu?.destroy();
      this.resultScreen?.destroy();
      this.hud.destroy();
      // GDD 17：清理弹药 HUD + 栗子弹丸渲染（解绑 ON_AMMO_CHANGED 等订阅）。
      this.ammoHud?.destroy();
      this.chestnutView?.destroy();
    });

    // S04-3 去重集合初始化（关卡实体渲染在 loadLevel 内完成）。
    this.collectedCoins = new Set<number>();
    this.collectedSeeds = new Set<number>();

    // 融合唯一模式：按钮浮层常驻可点 + Phaser pointer 转发融合层（按钮命中优先，未命中走手势）。
    // 微信端 ?buttons=1 / 配置 layout 二选一语义已移除，永远走融合（见 fusion-input / click-to-move-design.md）。
    this.touchButtons = new TouchButtons(this);
    this.setupPointerInput();

    // 分享深链：优先用 Boot 传入的 startLevel，回退到冷启动 query.level。
    // platform 已在此前 resolve 完毕（registry → globalThis → 重建三层兜底）。
    let startLevel = this.pendingStartLevel;
    if (!startLevel) {
      const lq = this.platform.share?.getLaunchQuery();
      startLevel = lq?.level;
    }
    if (startLevel && LEVEL_ORDER.includes(startLevel)) {
      this.currentLevelId = startLevel;
    }

    // S06：按 currentLevelId 从注册表加载关卡（首关 1-1）；restart / 下一关复用同一路径。
    this.loadLevel(this.currentLevelId);
    // S05-4-BGM：进关即播 stage BGM（AudioPort 已 idempotent/换名先停后起；未解锁时 no-op）。
    this.platform.audio.playMusic('music:stage');

    // 固定步长主循环（ADR-005）：step 内做仿真，渲染在每帧 update 后
    this.loop = new FixedStep((dt, simTimeMs) => this.stepSim(dt, simTimeMs), STEP_MS);
  }

  /**
   * S06 关卡加载（进度链核心）：按 id 从注册表 `levels` 重建「按关卡」的全部运行时状态。
   * 被首关 create、restartGame（当前关）、ON_NEXT_LEVEL（下一关）三者复用，单一事实来源。
   * 不重建一次性 UI（sprite/flashGfx/hud/pauseMenu/resultScreen/订阅），仅重建 runtime/物理/
   * 节拍/敌人/拾取渲染/相机，并把 run 状态机与计时/标志复位为干净一局。
   */
  private loadLevel(id: string): void {
    this.currentLevelId = id;
    // 分享深链：把当前关写入转发 query，使后续分享卡片带 level=当前关。
    this.platform.share?.updateContext({ level: id });

    // C5：用 LevelLoader 由注册表关卡数据构建 CollisionWorld + 出生点 + 凯旋之门 AABB
    this.runtime = LevelLoader.load(levels[id]);
    this.world = this.runtime.world;
    this.goal = this.runtime.goal;

    // S05-1 节拍：持有 BeatClock + BeatDrivenSystem（对齐 headless 门控）。
    this.beatClock = undefined;
    this.beatSystem = undefined;
    const beatDef = this.runtime.data.beat;
    if (beatDef.enabled) {
      this.beatClock = new BeatClock(beatDef);
      const platforms = this.runtime.data.beatPlatforms ?? [];
      if (platforms.length > 0 && beatDef.tracks.length > 0) {
        this.beatSystem = new BeatDrivenSystem(this.runtime, this.beatClock, beatDef.tracks);
      }
    }

    // 出生点初始化：body 左上角贴地面顶（spawn.y 已为脚底贴地），grounded=true、sizeScale=1，无开场掉穿
    const spawn = this.runtime.spawn;
    this.spawn = { x: spawn.x, y: spawn.y };
    // S04-3：检查点重生点初始化为出生点（触碰 checkpoint 后更新）。
    this.respawnPoint = { x: spawn.x, y: spawn.y };
    this.body = { x: spawn.x, y: spawn.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 };
    this.controller = new CharacterController(characterConfig, {
      x: spawn.x,
      y: spawn.y,
      grounded: true,
    });

    // C3：受伤状态机 + 击退计时（initialLives 取自 damageConfig，Economy/06 接入后可覆盖）
    this.damage = new DamageStateMachine(damageConfig.initialLives, damageConfig);
    this.hitstunTimer = 0;
    this.lastGrounded = true;

    // S04-1：由关卡实体生成真实可踩敌人（替代 C3 占位刺栗），经同一 damage-resolution 管线解算。
    this.enemies = createEnemies(this.runtime.entities);
    if (!this.enemyGfx) this.enemyGfx = this.add.graphics().setDepth(9);
    else this.enemyGfx.clear();
    // S04-2：弹丸列表（石炮 fire 时 push；不可踩独立 hazard），及占位渲染层。
    // 切换关卡前先把残留弹丸归还对象池，避免稳态泄漏（候选②）。
    for (const p of this.projectiles) if (!p.dead) Projectile.release(p);
    this.projectiles = [];
    if (!this.projectileGfx) this.projectileGfx = this.add.graphics().setDepth(9);
    else this.projectileGfx.clear();

    // S04-3：由关卡实体生成 coin/seed/checkpoint 占位渲染 + 去重集合初始化。
    this.collectedCoins = new Set<number>();
    this.collectedSeeds = new Set<number>();

    // GDD 17：投掷复位（弹药回满 + 清空飞行弹丸 + 栗子补给去重）；并重绘弹药 HUD。
    this.throwController.reset(attackConfig.ammoStart);
    this.chestnuts = [];
    this.collectedChestnuts = new Set<number>();
    this.bus.emit(ON_AMMO_CHANGED, { ammo: this.throwController.ammo, cap: this.throwController.ammoCap });
    if (!this.coinGfx) this.coinGfx = this.add.graphics().setDepth(8);
    if (!this.seedGfx) this.seedGfx = this.add.graphics().setDepth(8);
    if (!this.checkpointGfx) this.checkpointGfx = this.add.graphics().setDepth(7);

    // GDD 12：本局种子 runtime 重置（growthPct=0 → sprout，保证本局即时反馈，§3.1）。
    this.seedRun = createSeedRuntime();
    this.currentSeedStage = 'sprout';
    this.topperDirty = true; // 新一局重置 topper 几何（sprout）
    if (!this.topperGfx) this.topperGfx = this.add.graphics().setDepth(12); // 高于角色(sprite=10)
    else this.topperGfx.clear();
    if (!this.auraGfx) this.auraGfx = this.add.graphics().setDepth(11); // 稳态光晕，压身体(10)上、topper(12)下
    else this.auraGfx.clear();

    this.drawCoins();
    this.drawSeeds();
    this.drawCheckpoints();

    // 真实关卡渲染（tile 世界坐标，相机滚动时自动偏移）；重建时先销毁旧地形 Graphics，避免泄漏。
    this.drawLevel();

    // C5 相机跟随：钳制到关卡边界（关宽 1536 > 逻辑宽 512），纵向不滚动
    const levelW = this.runtime.data.width * this.runtime.data.tileSize;
    const levelH = this.runtime.data.height * this.runtime.data.tileSize;
    this.camera = new FollowCamera(this.cameras.main, levelW, levelH);

    // S04-4 经济/分数：新一局分数/连击归零。
    this.economy = new EconomyController(economyConfig);
    this.prevComboMult = 1;

    // 顶层 RUN 状态机复位为 PLAYING（来自 PLAYING/PAUSED/LEVEL_COMPLETE/GAME_OVER 均合法）。
    this.runState.transition('PLAYING');
    this.paused = false;
    this.levelComplete = false;
    this.gameOver = false;
    this.elapsedMs = 0;
    this.hitFlashTimer = 0;
    this.respawnFadeTimer = 0;

    // 隐藏暂停/结算 UI，复位精灵与受伤闪烁覆盖层。
    this.pauseMenu?.hide();
    this.resultScreen?.hide();
    this.sprite?.setPosition(Math.round(this.body.x), Math.round(this.body.y));
    this.sprite?.setAlpha(1);
    this.flashGfx?.clear();
    this.hud.redraw();
    this.emitScoreChange();
  }

  private stepSim(dt: number, simTimeMs: number): void {
    // S05-2：暂停/GameOver/已通关 早退——仿真冻结（剩余固定步不再推进，避免同帧续步）。
    if (this.paused || this.gameOver || this.levelComplete) return;
    // 本次游玩计时（仅 PLAYING 累加；暂停/结算/GameOver 由上面早退保证不涨）。
    this.elapsedMs += dt * 1000;

    // 推进手势计时器（仿真时钟驱动；virtual 提供方无 advance → 安全跳过）。
    const inputPort = this.platform.input as RawInputProvider & Partial<PointerSink> & { advance?(dt: number): void };
    inputPort.advance?.(dt * 1000);

    const frame = this.platform.input.sample();
    const input = this.abstraction.sample(frame, simTimeMs);
    // 同步按下态给按钮视觉（按方案 B §5.5：边沿检测触发 squash/弹性回弹 tween）
    this.touchButtons?.syncDown(frame.down);

    // 双指暂停（touch:action）→ ON_PAUSE（架构 §5 / GDD 08：action 通道 → 暂停）。
    if (input.actionPressed) {
      this.bus.emit(ON_PAUSE, { source: 'gesture-action' });
    }

    // ── C3 同步协议补充：每固定步 tick 受伤状态机（无敌帧衰减）──
    this.damage.update(dt * 1000);

    // sizeScale → controller.state + body.h（+y 下推保持脚底 y+h 不变，避免瞬沉）
    this.controller.state.sizeScale = this.damage.sizeScale;
    const newH = PLAYER_H * this.damage.sizeScale;
    if (newH !== this.body.h) {
      const oldH = this.body.h;
      this.body.y += oldH - newH;
      this.body.h = newH;
    }

    // ── C3 hitstun：击退期间吞掉方向输入 + 跳过 consume（R3，integration-plan §5.3）──
    let effectiveInput: InputState = input;
    const skipConsume = this.hitstunTimer > 0;
    if (skipConsume) {
      this.hitstunTimer -= dt * 1000;
      effectiveInput = NEUTRAL_INPUT;
    }

    // C1 同步协议：controller.consume 输出真实驱动 body（含水平/跳跃/二段跳/coyote/buffer/短跳）；
    // hitstun 期间 skipConsume → 仅 stepBody 积分击退。

    // R1：办公咖啡渍低摩擦 zone —— 玩家 body 与 zone AABB 重叠且 grounded 时，取重叠 zone 中最小
    // frictionScale 注入 controller.currentFrictionScale（越滑越打滑、难急停）；否则重置 1.0（正常摩擦）。
    // 仅在 consume 之前注入（consume 用其缩放无方向输入时的水平减速摩擦，设计附录 D.2）。
    let frictionScale = 1.0;
    if (this.runtime.coffeeSpillZones.length > 0 && this.lastGrounded) {
      const body = this.body;
      for (const z of this.runtime.coffeeSpillZones) {
        if (
          body.x < z.x + z.w &&
          body.x + body.w > z.x &&
          body.y < z.y + z.h &&
          body.y + body.h > z.y
        ) {
          frictionScale = Math.min(frictionScale, z.frictionScale);
        }
      }
    }
    this.controller.currentFrictionScale = frictionScale;

    const res = runStepSim(
      { body: this.body, controller: this.controller, world: this.world },
      effectiveInput,
      this.lastGrounded,
      dt,
      skipConsume,
    );

    // D1：真实跳跃路径补 emit ON_JUMP（headless 已有，真实 game-scene 原缺）。
    // lastJumped 由 consume 设置；hitstun 跳过 consume 时不应误发（skipConsume 守卫）。
    if (this.controller.lastJumped && !skipConsume) this.bus.emit(ON_JUMP, {});

    // 落地边沿 → 发 ON_LAND（juice/音频预留，C2）
    if (!res.prevGrounded && res.grounded) this.bus.emit(ON_LAND, {});

    this.lastGrounded = res.grounded;

    // A5 暗流（riptide）：区域内给栗宝叠加水平速度偏置（轻量、可被输入覆盖；core 零平台力场）。
    this.applyRiptide(STEP_DT);

    // S04-1/S04-2：推进敌人 AI（表驱动；core 零平台，碰撞世界来自关卡 CollisionWorld）。
    // chong_feng detect / shi_pao aim 需玩家位置（this.body）；石炮 fire 产出弹丸 → projectiles。
    // bouncy_vine 触发回弹 → 套用上抛速度 + 发 ON_BOUNCE（零计分，GDD 14 §6 红线防刷分）。
    for (const e of this.enemies) {
      if (!e.dead) {
        const spawned = e.update(dt, this.world, this.body);
        if (spawned.length > 0) {
          // D3：石炮（shi_pao）开火产出弹丸时补 emit ON_PROJECTILE_SPAWN → sfx:projectile_fire。
          for (const p of spawned) this.projectiles.push(p);
          this.bus.emit(ON_PROJECTILE_SPAWN, { count: spawned.length });
        }
        // 弹藤：本步触发 → 套用上抛（已含 power 倍率，负值）+ 发 ON_BOUNCE（零计分、不进 GDD06）
        if (e.type === 'bouncy_vine' && e.justBounced) {
          this.body.vy = e.bounceVelocity;
          this.bus.emit(ON_BOUNCE, {});
        }
      }
    }

    // S04-2：弹丸每步积分移动（飞出边界/撞墙 → dead，resolveHazards 后移除）。
    for (const p of this.projectiles) {
      if (!p.dead) p.update(dt, this.world);
    }

    // ── GDD 17 扔栗子机制每步推进 ──
    // 投掷消费：throwPressed 边沿 → 扣弹/冷却校验 → 发弹 + ON_CHESTNUT_THROWN + ON_AMMO_CHANGED；
    // 弹药 0 时尝试扔 → ON_AMMO_EMPTY（HUD 红闪）。
    if (input.throwPressed) {
      const facing = this.controller.state.facing;
      const ox = this.body.x + this.body.w / 2 + facing * (this.body.w / 2 + 2);
      const oy = this.body.y + this.body.h * 0.4;
      const p = this.throwController.tryThrow(facing, ox, oy);
      if (p) {
        this.chestnuts.push(p);
        this.bus.emit(ON_CHESTNUT_THROWN, { x: ox, y: oy, facing });
        this.bus.emit(ON_AMMO_CHANGED, { ammo: this.throwController.ammo, cap: this.throwController.ammoCap });
      } else if (this.throwController.ammo <= 0) {
        this.bus.emit(ON_AMMO_EMPTY, { ammo: this.throwController.ammo });
      }
    }
    this.throwController.update(dt * 1000);

    // 栗子弹丸每步积分移动（飞出/撞墙 → dead）。
    for (const c of this.chestnuts) {
      if (!c.dead) c.update(dt, this.world);
    }

    // 栗子 vs 敌人 / 石炮炮弹 对消矩阵（GDD 17 §7）。
    for (const c of this.chestnuts) {
      if (c.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (!c.overlapsRect(e.x, e.y, e.width, e.height)) continue;
        if (e.type === 'chong_feng') {
          // 冲锋怪：栗子打断冲锋 → stun（同撞墙态），栗子消失。
          e.applyStun(attackConfig.enemyStunMs);
          c.dead = true;
          this.bus.emit(ON_PROJECTILE_CANCEL, { x: c.x, y: c.y });
        } else if (e.type === 'shi_pao') {
          // 石炮：不可击杀，栗子抵消消失（不发敌死事件）。
          c.dead = true;
          this.bus.emit(ON_PROJECTILE_CANCEL, { x: c.x, y: c.y });
        } else if (e.isStompable) {
          // 可踩敌人（ci_li / du_fu / 可踩期 gu_bao / sil）：复用踩杀管线（markStomped + 计分 + 事件）。
          e.markStomped();
          this.bus.emit(ON_STOMP, { type: e.enemyType, x: e.x + e.width / 2, y: e.y });
          this.bus.emit(ON_CHESTNUT_HIT, { type: e.enemyType, x: e.x + e.width / 2, y: e.y + e.height / 2 });
          c.dead = true;
        }
        // 其余（穿透型：bouncy_vine / cyclone / 不可踩期 gu_bao / sil）→ 栗子继续飞。
      }
      if (c.dead) continue;
      // 石炮炮弹对消：双方消失 + ON_PROJECTILE_CANCEL（clink）。
      for (const pr of this.projectiles) {
        if (pr.dead) continue;
        if (c.overlapsRect(pr.x, pr.y, pr.width, pr.height)) {
          c.dead = true;
          pr.dead = true;
          this.bus.emit(ON_PROJECTILE_CANCEL, { x: c.x, y: c.y });
        }
      }
    }

    // C3 伤害接触解算（重叠 + 无敌帧外 → hit + 击退 + 事件）
    this.resolveHazards();

    // 街道汽车致命接触（GDD 1-6 §3.2）：applyFatalDeath（−1 命 + respawn 到检查点）。
    // vehicle.overlaps 恒 false（刻意绕过非致死的 resolveHazardContact），此处经 overlapsFatal 单独致命解算。
    // 无敌帧 guard 防 respawn 同帧重复扣命；命中后 break（重生已重置位置 + 无敌帧）。
    for (const e of this.enemies) {
      if (e.type === 'vehicle' && !this.damage.invincibleTimer && e.overlapsFatal(this.body)) {
        const r = applyFatalDeath({
          damage: this.damage,
          body: this.body,
          bus: this.bus,
          cfg: damageConfig,
          spawn: this.respawnPoint,
          playerW: PLAYER_W,
          playerH: PLAYER_H,
        });
        if (r.controller) this.controller = r.controller;
        break;
      }
    }

    // A3 潮汐：脚底低于水位线 → 软伤害（扣 1 级 + 击退 + 无敌帧，不致死）
    this.resolveTideHazard();

    // A4 流沙：脚底在流沙区且接地 → 持续下陷；触底致死（respawn 到检查点，复用 07）
    this.resolveQuicksandHazard();

    // C5 终点检测：body AABB 与凯旋之门 AABB 重叠 → ON_LEVEL_COMPLETE（无敌人也可达）
    this.resolveGoal();

    // S04-3：实体拾取 / 检查点解算（委托单一真实实现 resolvePickups）。
    this.resolvePickups();
    // GDD 17：栗子补给拾取（独立去重集合，避免动到共享纯函数 resolvePickups 的集成测试）。
    this.resolveChestnutPickups();

    // S05-1 节拍门控：对齐 headless——每固定步只调一次 advanceBeat（内部 crossedBeat）。
    // 跨拍时先刷平台相位、再 emit ON_BEAT（让音频/juice 读到新相位）。
    // 禁用时 advanceBeat 直接返回 -1 不 emit；暂停/通关/GameOver 由顶部早退保证 simTimeMs 不推进 → 自然冻结。
    if (this.beatClock) {
      advanceBeat(this.beatClock, simTimeMs, this.bus, (idx) => this.beatSystem?.applyBeat(idx));
    }

    this.compactChestnuts();
    this.chestnutView?.sync(this.chestnuts);

    this.sprite.setPosition(Math.round(this.body.x), Math.round(this.body.y));
  }

  /**
   * C3 伤害接触解算（委托给共享纯函数，单一真实实现 → 集成测试即证据）。
   * 遍历存活敌人 + 存活弹丸（均实现 HazardSource，不可踩 → 受伤分支）：
   * 命中 → 根据状态（踩踏 / 受伤）转换发对应事件，施加击退/反弹，设 hitstun；
   * 重生 → 用返回的新 controller 替换（spawn 处满血复位）。踩踏与受伤在同帧互斥。
   * 解算后原地压缩弹丸列表并归还对象池（候选④ GC：避免每固定步新建数组）。
   */
  private resolveHazards(): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const r = resolveHazardContact({
        damage: this.damage,
        hazard: e,
        body: this.body,
        bus: this.bus,
        cfg: damageConfig,
        spawn: this.respawnPoint,
        playerW: PLAYER_W,
        playerH: PLAYER_H,
        dt: STEP_DT,
      });
      if (r.hitstunMs > 0) this.hitstunTimer = r.hitstunMs;
      if (r.controller) this.controller = r.controller;
    }
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const r = resolveHazardContact({
        damage: this.damage,
        hazard: p,
        body: this.body,
        bus: this.bus,
        cfg: damageConfig,
        spawn: this.respawnPoint,
        playerW: PLAYER_W,
        playerH: PLAYER_H,
        dt: STEP_DT,
      });
      if (r.hitstunMs > 0) this.hitstunTimer = r.hitstunMs;
      if (r.controller) this.controller = r.controller;
    }
    this.compactProjectiles();
  }

  /** 原地压缩弹丸列表：移除 dead 并归还对象池，避免每固定步新建数组（候选②/④）。 */
  private compactProjectiles(): void {
    const arr = this.projectiles;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p.dead) Projectile.release(p);
      else arr[w++] = p;
    }
    arr.length = w;
  }

  /** 原地压缩栗子弹丸列表：移除 dead（无对象池，仅数组压缩）。 */
  private compactChestnuts(): void {
    const arr = this.chestnuts;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i];
      if (c.dead) continue;
      arr[w++] = c;
    }
    arr.length = w;
  }

  /**
   * GDD 17 §6.2 栗子补给拾取：遍历关卡 chestnut 实体（runtime 已分桶），与玩家 AABB 重叠且未拾取过
   * → 弹药 +amount（封顶 ammoCap）+ 发 ON_AMMO_CHANGED（HUD 刷新）；去重防重复计数。独立去重集合，
   * 不改动共享纯函数 resolvePickups（保留其作为集成测试单一事实来源的地位）。
   */
  private resolveChestnutPickups(): void {
    const items = this.runtime.chestnuts;
    const bw = this.body.w;
    const bh = this.body.h;
    const PICKUP_BOX = 24; // 栗子补给占位盒（与主角同量级，level-data 未带 w/h）
    for (let i = 0; i < items.length; i++) {
      if (this.collectedChestnuts.has(i)) continue;
      const def = items[i];
      if (
        def.x < this.body.x + bw &&
        this.body.x < def.x + PICKUP_BOX &&
        def.y < this.body.y + bh &&
        this.body.y < def.y + PICKUP_BOX
      ) {
        this.collectedChestnuts.add(i);
        const amount = def.params?.amount ?? attackConfig.pickupAmount;
        const gained = this.throwController.addAmmo(amount);
        if (gained > 0) {
          this.bus.emit(ON_AMMO_CHANGED, { ammo: this.throwController.ammo, cap: this.throwController.ammoCap });
        }
      }
    }
  }

  /** 每固定步检测玩家 AABB 与凯旋之门 AABB 重叠，命中发 ON_LEVEL_COMPLETE（仅一次）。 */
  private resolveGoal(): void {
    if (this.levelComplete) return;
    const b = this.body;
    const g = this.goal;
    const overlap =
      b.x < g.x + g.w && b.x + b.w > g.x && b.y < g.y + g.h && b.y + b.h > g.y;
    if (overlap) {
      this.levelComplete = true;
      this.bus.emit(ON_LEVEL_COMPLETE, { levelId: this.runtime.data.id });
    }
  }

  /**
   * A5 暗流（riptide）力场：栗宝中心位于 riptide 区域内时，施加朝终点方向的水平速度偏置。
   * 偏置叠加在 controller 已算出的水平速度之上，并以（vxBias + moveSpeed）为上限钳制，
   * 既给出可感的「轻推」、又保证玩家输入可逆（按住反向仍可向左），不构成硬锁。
   * 经 character-controller 的 body.vx 接口施加，不破坏 core 零平台铁律。
   * @param dt 固定步长（秒）。
   */
  private applyRiptide(dt: number): void {
    const zones = this.runtime.data.riptide;
    if (!zones || zones.length === 0) return;
    const cx = this.body.x + this.body.w / 2;
    const cy = this.body.y + this.body.h / 2;
    const z = riptideAt(zones, cx, cy);
    if (!z) return;
    const cap = z.vxBias + characterConfig.moveSpeed; // 偏置上限（含玩家自身最大水平速）
    this.body.vx = Math.min(this.body.vx + z.vxBias, cap);
  }

  /**
   * A3 潮汐水位线 hazard：栗宝脚底低于当前段 waterSurfaceY ⇒ 触水。
   * 软伤害（守公平、不致死）：FULL→SMALL（扣 1 级）+ 向上击退 + 无敌帧；
   * 已是 SMALL/DEAD 仅给击退 + 无敌（不致死，区别于真 pit）。
   */
  private resolveTideHazard(): void {
    const segs = this.runtime.data.tideSegments;
    if (!segs || segs.length === 0) return;
    const cx = this.body.x + this.body.w / 2;
    const seg = tideSegmentAt(segs, cx);
    if (!seg) return;
    const wy = tideSurfaceY(seg, this.elapsedMs);
    const bottom = this.body.y + this.body.h;
    if (bottom <= wy) return; // 脚底在水面之上，未触水
    if (this.damage.invincibleTimer > 0) return; // 无敌帧内忽略（防连扣）
    if (this.damage.state === 'FULL') {
      this.damage.hit(); // FULL→SMALL（仅扣 1 级，不致死）
      this.bus.emit(ON_HURT, { lives: this.damage.lives, state: this.damage.state });
    }
    // 不论 FULL/SMALL：触水均给向上击退 + 无敌帧（软伤害，不致死）
    this.body.vy = -damageConfig.knockbackUp;
    this.damage.invincibleTimer = Math.max(this.damage.invincibleTimer, damageConfig.invincibleMs);
  }

  /**
   * A4 流沙下陷致死机制（GDD 1-4 §4）：栗宝脚底进入流沙区 [xStart,xEnd] 且接地（grounded）即持续下陷；
   * 触底（累计下陷深度 ≥ deathY-surfaceY）即死（respawn 到最近检查点，复用 07 death 管线 applyFatalDeath）。
   * 空中（!grounded）不触发 → 跳跃跨越为安全解法之一；离开区/跳起复位（给逃脱窗口）。
   * telegraph 渐变（quicksandSinkRate 在 telegraphMs 内由 0→sinkRate）+ 视觉下沉 offset 由 update 每帧应用。
   */
  private resolveQuicksandHazard(): void {
    const zones = this.runtime.data.quicksand;
    if (!zones || zones.length === 0) return;
    const cx = this.body.x + this.body.w / 2;
    const zone = quicksandZoneAt(zones, cx);
    if (!zone || !isQuicksandSinking(zone, this.body, this.lastGrounded)) {
      // 未进入区 / 跳起（空中） / 离区 → 复位（逃脱窗口）
      this.qsZone = null;
      this.qsSinkMs = 0;
      this.qsSinkDepth = 0;
      return;
    }
    this.qsZone = zone;
    this.qsSinkMs += STEP_DT * 1000;
    const rate = quicksandSinkRate(zone, this.qsSinkMs);
    this.qsSinkDepth += rate * STEP_DT;
    if (quicksandBottomedOut(zone, this.qsSinkDepth)) {
      // 触底致死 → 扣 1 命 + 有命立即重生 FULL（回检查点 + 重生无敌帧）/ 无命 GameOver（applyFatalDeath 发 ON_GAME_OVER）
      const r = applyFatalDeath({
        damage: this.damage,
        body: this.body,
        bus: this.bus,
        cfg: damageConfig,
        spawn: this.respawnPoint,
        playerW: PLAYER_W,
        playerH: PLAYER_H,
      });
      if (r.controller) this.controller = r.controller;
      this.qsZone = null;
      this.qsSinkMs = 0;
      this.qsSinkDepth = 0;
    }
  }

  /**
   * A3 潮汐水体叠层渲染（每帧，仅 sea 关卡）：按各段 waterSurfaceY 绘制半透水体 + 水面线 + 浪花带。
   * Reduce Motion 下波浪相位冻结（仅保留水位变化，必要玩法保留）。
   * draw call：每段 ~2（水体 fillRect + 水面线 stroke）≈ 4，远低于预算。
   */
  private drawTideOverlay(): void {
    const g = this.tideGfx;
    if (!g) return;
    const segs = this.runtime.data.tideSegments;
    if (!segs || segs.length === 0) {
      g.clear();
      return;
    }
    g.clear();
    const ts = this.world.tileSize;
    const H = this.runtime.data.height * ts;
    const WATER = 0x4a78c0; // 环境冷蓝 #4A78C0（淹没区水体，锁色板 #10）
    const LINE = 0x5bc8f5; // 天空 #5BC8F5（水面线，锁色板 #11）
    const SKY = 0x5bc8f5; // 天空 #5BC8F5（泡沫弧线，锁色板 #11，与 LINE 同源）
    const FOAM_YELLOW = 0xffd23f; // 暖黄 #FFD23F（溅点，锁色板 #4）
    if (!this.reduceMotion) this.tidePhase += STEP_DT * 1.2; // ≤2Hz 相位推进（泡沫共相位，Reduce Motion 冻结）
    const rip = this.runtime.data.riptide; // §4.5 暗流区（可选出口泡沫）
    for (const seg of segs) {
      const wy = tideSurfaceY(seg, this.elapsedMs);
      // 淹没区半透水体（waterSurfaceY 以下）
      g.fillStyle(WATER, 0.5);
      g.fillRect(seg.xStart, wy, seg.xEnd - seg.xStart, H - wy);
      // 水面线 + 浪花带（相位偏移，≤2Hz；Reduce Motion 冻结）
      g.lineStyle(2, LINE, 0.6);
      g.beginPath();
      g.moveTo(seg.xStart, wy);
      const step = 12;
      for (let x = seg.xStart; x <= seg.xEnd; x += step) {
        const off = Math.sin((x - seg.xStart) * 0.05 + this.tidePhase) * 2;
        g.lineTo(x, wy + off);
      }
      g.strokePath();

      // —— §3.3 边缘拍岸泡沫（edge foam）：水体与实心地形边缘相交处 ——
      // 纯视觉 telegraph，不改碰撞/水位；颜色仅 天空#11 / 暖黄#4（锁色板，0 新增 hex），零 PNG。
      // Reduce Motion：全部相位依赖 this.tidePhase（已冻结）→ 泡沫静止首帧，无需额外处理。
      const candidates: Array<{ x: number; y: number }> = [];
      const foamStep = ts / 2; // ~16px 步进（半瓦片，贴合地形边沿）
      for (let cx = seg.xStart; cx <= seg.xEnd; cx += foamStep) {
        // 同相位水面线（与上方 stroke 一致，保持视觉连续）
        const wyAtX = wy + Math.sin((cx - seg.xStart) * 0.05 + this.tidePhase) * 2;
        const tx = Math.floor(cx / ts);
        // 地形顶边：水线下一格实心、上一格空气 ⇒ 地形顶在水线下/岸边
        const solidBelow = this.world.isSolidTile(tx, Math.floor((wyAtX + 2) / ts));
        const solidAbove = this.world.isSolidTile(tx, Math.floor((wyAtX - 2) / ts));
        if (solidBelow && !solidAbove) {
          candidates.push({ x: cx, y: wyAtX }); // 地形顶边泡沫
          continue;
        }
        // 可选增强：竖直侧壁相交（水线行相邻列实心跳变 ⇒ 侧壁入水）
        const tyRow = Math.floor(wyAtX / ts);
        if (this.world.isSolidTile(tx, tyRow) !== this.world.isSolidTile(tx + 1, tyRow)) {
          candidates.push({ x: cx, y: wyAtX }); // 侧壁泡沫
        }
      }

      // §4.5 暗流区出口泡沫（强化"水流推出"可读性）：
      // riptide 端点落在当前段内，且当前水线穿越其 y 区间 ⇒ 在 xStart/xEnd 各补一组 foam。
      if (rip) {
        for (const z of rip) {
          if (z.xStart >= seg.xStart && z.xEnd <= seg.xEnd && wy >= z.yTop && wy <= z.yBottom) {
            candidates.push({ x: z.xStart, y: wy });
            candidates.push({ x: z.xEnd, y: wy });
          }
        }
      }

      // 断续出现（≤2Hz）：tidePhase 驱动门控，泡沫随相位明灭，避免静态死板
      // （频率 = 1.5·tidePhase 速率 ≈ 0.29Hz ≪ 2Hz，安全）
      const appear: Array<{ x: number; y: number }> = [];
      for (const p of candidates) {
        if (Math.sin(this.tidePhase * 1.5 + p.x * 0.1) > 0.3) appear.push(p);
      }
      if (appear.length > 0) {
        // 短弧泡沫：贴水线、微拱向上（批量单 path，1 次 strokePath）
        const w = 5;
        g.lineStyle(2, SKY, 0.5);
        g.beginPath();
        for (const p of appear) {
          const px = p.x;
          const py = p.y;
          g.moveTo(px - w, py);
          g.lineTo(px - w * 0.5, py - 2);
          g.lineTo(px, py - 3);
          g.lineTo(px + w * 0.5, py - 2);
          g.lineTo(px + w, py);
        }
        g.strokePath();
        // 溅点：暖黄小点（每点 1–3 个，确定性分布），位于 p 上方
        g.fillStyle(FOAM_YELLOW, 0.85);
        for (const p of appear) {
          const n = 1 + (Math.abs(Math.round(p.x + p.y)) % 3); // 1–3 个
          for (let d = 0; d < n; d++) {
            const dx = p.x + (d - 1) * 3 + 1;
            const dy = p.y - 3 - d;
            const r = 1 + (d % 2); // 半径 1–2px
            g.fillCircle(dx, dy, r);
          }
        }
      }
    }
  }

  /**
   * S04-3 实体拾取 / 检查点解算（委托 src/game/pickup-resolution 的单一真实实现）。
   * 金币/种子重叠 → 发 ON_COIN / ON_SEED_COLLECTED + 标记 collected；检查点重叠 → 更新
   * respawnPoint + 发 ON_CHECKPOINT（去重，仅首次/移动到新点）。按返回结果定向重绘对应图层。
   */
  private resolvePickups(): void {
    const r = resolvePickups({
      runtime: this.runtime,
      body: this.body,
      collectedCoins: this.collectedCoins,
      collectedSeeds: this.collectedSeeds,
      respawnPoint: this.respawnPoint,
      bus: this.bus,
    });
    if (r.coinHits.length > 0) this.drawCoins();
    if (r.seedHits.length > 0) this.drawSeeds();
    if (r.checkpointUpdated) this.drawCheckpoints();
  }

  /** S04-3 重绘未拾取金币（已 collected 的不绘制，实现移除渲染）。 */
  private drawCoins(): void {
    const g = this.coinGfx;
    if (!g) return;
    g.clear();
    for (let i = 0; i < this.runtime.coins.length; i++) {
      if (this.collectedCoins.has(i)) continue;
      drawCoin(g, this.runtime.coins[i]);
    }
  }

  /** S04-3 重绘未拾取种子（已 collected 的不绘制）。 */
  private drawSeeds(): void {
    const g = this.seedGfx;
    if (!g) return;
    g.clear();
    for (let i = 0; i < this.runtime.seeds.length; i++) {
      if (this.collectedSeeds.has(i)) continue;
      drawSeed(g, this.runtime.seeds[i]);
    }
  }

  /** S04-3 重绘检查点；若某检查点 == 当前 respawnPoint 则点亮（已抵达反馈）。 */
  private drawCheckpoints(): void {
    const g = this.checkpointGfx;
    if (!g) return;
    g.clear();
    for (const cp of this.runtime.checkpoints) {
      const active = this.respawnPoint.x === cp.x && this.respawnPoint.y === cp.y;
      drawCheckpoint(g, cp, active);
    }
  }

  /**
   * GDD 12：每帧跟随 body 重绘头顶蜕变物（仅视觉，不改碰撞盒/尺寸/形态 §3.4/§3.5 红线）。
   * 性能：topper 几何只随 stage 变化（候选① 节流）——stage 不变时仅移动 Graphics 对象
   * （setPosition，廉价 transform），不再每帧 clear()+重建几何（Phaser Graphics 几何重建是 CPU 热点）。
   * 锚点：cx = body.x + PLAYER_W/2（头中心 x），topY = body.y（头顶 y = 碰撞盒顶）；配件向上生长。
   */
  private drawTopper(): void {
    const g = this.topperGfx;
    if (!g) return;
    if (this.topperDirty) {
      g.clear();
      drawMaliTopper(g, 0, 0, this.currentSeedStage); // 本地原点绘制几何，stage 变更才重绘
      this.topperDirty = false;
    }
    const cx = this.body.x + PLAYER_W / 2;
    const topY = this.body.y; // 头顶 y（碰撞盒顶）
    g.setPosition(cx, topY); // 仅移动对象跟随 body，避免每帧重建几何
  }

  /**
   * GDD 12 / seed-topper-spec §2：每帧跟随 body 重绘稳态暖黄光晕（仅视觉）。
   * 中心=头顶上方 6px，α/r 按当前 stage 阶梯（sprout 无）；与蜕变脉冲（playMetamorphAura）叠加。
   * 静态绘制（无 tween），Reduce Motion 下仍呈现（无动画，防光敏 §9.3）。
   */
  private drawAura(): void {
    const g = this.auraGfx;
    if (!g) return;
    g.clear();
    if (this.reduceMotion) return; // D3：Reduce Motion 字面落实 task D「跳过光晕」（连稳态光晕一并跳过）
    drawSeedAura(g, this.body.x + PLAYER_W / 2, this.body.y, this.currentSeedStage);
  }

  /**
   * ON_GAME_OVER 处理（hud-spec §6.2）：冻结 + 显示覆盖层 + 注册跨端重试触发。
   * 仿真已在 update 顶部因 gameOver 标志冻结；此处只负责覆盖层与输入。
   */
  private onGameOver(): void {
    this.gameOver = true;
    // S05-4-BGM：GameOver 停 BGM（仿真冻结，重开时重启）。
    this.platform.audio.stopMusic();
    // S05-2：RunState 流转（PLAYING→GAME_OVER；与 DamageState 正交，不写其字段）。
    this.runState.transition('GAME_OVER');
    // S05-5：门开 → 屏蔽 gameplay 原生输入转发（Game Over 期间仿真冻结）。
    this.platform.setMenuActive?.(true);
    this.hud.showOverlay();
    // web：一次性点击覆盖层任意处 → 发 ON_RESTART（热区=全屏，≥48×48，§9.2）。
    this.input.once('pointerdown', () => this.bus.emit(ON_RESTART));
    // wechat：原生触摸（typeof wx 守卫）；一次即可，restartGame 会清理监听。
    if (typeof wx !== 'undefined' && wx.onTouchStart) {
      const h = () => { this.bus.emit(ON_RESTART); };
      wx.onTouchStart(h);
      this.restartTouchHandler = h;
    }
  }

  /**
   * ON_PAUSE 处理（S05-2）：RunState PLAYING→PAUSED（非法态忽略，防重入/误暂停），
   * 冻结仿真（update/stepSim 顶部早退）+ 显示暂停遮罩。输入不丢（每固定步恢复采样）。
   */
  private onPause(_payload?: unknown): void {
    if (!this.runState.transition('PAUSED')) return;
    this.paused = true;
    this.pauseMenu?.show();
    // S05-4-BGM：暂停即停 BGM（仿真冻结，恢复时重启）。
    this.platform.audio.stopMusic();
    // S05-5：门开 → 屏蔽 gameplay 原生输入转发，原生点击改走菜单路由。
    this.platform.setMenuActive?.(true);
  }

  /** ON_RESUME 处理（S05-2）：RunState PAUSED→PLAYING，隐藏遮罩，恢复仿真。 */
  private onResume(): void {
    if (!this.runState.transition('PLAYING')) return;
    this.paused = false;
    this.pauseMenu?.hide();
    // S05-4-BGM：恢复即重启 stage BGM。
    this.platform.audio.playMusic('music:stage');
    // S05-5：门关 → gameplay 原生输入恢复转发（后台暂停期间仍按住的手指原样保留 → 连续）。
    this.platform.setMenuActive?.(false);
  }

  /**
   * ON_LEVEL_COMPLETE 处理（S05-2）：RunState PLAYING→LEVEL_COMPLETE（防重入），
   * 冻结仿真 + 结算评级（时间≤parTime 得时间评级 + 金币收集率≥50% 得金币评级）→ 显示 ResultScreen。
   * 失败（命耗尽）走 onGameOver，不进此处。
   * parTime 来源：关卡 metadata.parTimeMs（1-1.json 已加，占位 60s），缺省回退 DEFAULT_PAR_TIME_MS（待主理人拍板）。
   */
  private onLevelComplete(_payload?: unknown): void {
    if (!this.runState.transition('LEVEL_COMPLETE')) return;
    // S05-4-BGM：凯旋收尾停 BGM，让 sfx:level_clear 独奏（audio-bgm-design.md §3.4）。
    this.platform.audio.stopMusic();
    const md = this.runtime.data.metadata as unknown as Record<string, unknown>;
    const parTimeMs = (md.parTimeMs as number | undefined) ?? DEFAULT_PAR_TIME_MS;
    const totalCoins = this.runtime.coins.length;
    const result: RankResult = evaluateRanks({
      elapsedMs: this.elapsedMs,
      parTimeMs,
      collectedCoins: this.collectedCoins.size,
      totalCoins,
    });
    // S06：是否还有下一关 → 决定结算页是否显示「下一关」按钮。
    const hasNext = nextLevelId(LEVEL_ORDER, this.currentLevelId) !== null;
    // 读取本局之前的最优用时，用于结算页「NEW!」标签（recordClear 落盘后再读就是已刷新后的值）。
    const previousBestTimeMs = this.saveManager.load().bestTimes[this.runtime.data.id];
    this.resultScreen?.show(result, this.elapsedMs, this.collectedCoins.size, totalCoins, hasNext, previousBestTimeMs);
    // S05-3：通关落盘最优成绩（ranks/bestTimes/bestCoins 取历史最优；V4 结算流程统一在此存档）。
    this.saveManager.recordClear(this.runtime.data.id, result);
    // GDD 12：一并落盘本局种子蜕变结果（totalCollected/maturity/stage 合并入 SeedMeta）。
    this.saveManager.saveSeedResult(this.seedRun);
    // S05-5：门开 → 屏蔽 gameplay 原生输入转发，原生点击走结算路由（再玩一次）。
    this.platform.setMenuActive?.(true);
  }

  /**
   * ON_RESTART 处理（hud-spec §6.2）：干净 reset（重建 damage / body / controller，隐藏覆盖层，恢复仿真）。
   * 不调用 scene.restart，状态更可控（ADR：ON_RESTART 方案）。
   */
  private restartGame(): void {
    // S05-5：清后台暂停标记（避免上局后台暂停态污染新局 → 误 auto-resume）。
    this.lifecycle.reset();
    // S05-5：门关 → gameplay 原生输入恢复转发。
    this.platform.setMenuActive?.(false);
    // 从结算面板点「再玩一次」时，先隐藏面板再重建关卡。
    this.resultScreen?.hide();
    // S06：复用 loadLevel 重建「当前关」全部运行时状态（干净一局）。
    this.loadLevel(this.currentLevelId);
    // S05-4-BGM：重开即重启 stage BGM（loadLevel 后重置状态机为 PLAYING）。
    this.platform.audio.playMusic('music:stage');
    // 清理微信原生触摸监听（避免重复触发 ON_RESTART）。
    if (this.restartTouchHandler && typeof wx !== 'undefined' && wx.offTouchStart) {
      wx.offTouchStart(this.restartTouchHandler);
      this.restartTouchHandler = undefined;
    }
    this.hud.hideOverlay();
  }

  /**
   * S04-4 经济变化广播：把当前 EconomyState 的 {score, coins, comboMult} 发 ON_SCORE_CHANGED。
   * 供 S04-5 HUD 订阅渲染；本 Story 仅确保数据流转正确。
   */
  private emitScoreChange(): void {
    const s = this.economy.state;
    this.prevComboMult = s.comboMult; // 同步追踪，避免 update 比较误判（见下）
    this.bus.emit(ON_SCORE_CHANGED, {
      score: s.score,
      coins: s.coins,
      comboMult: s.comboMult,
    });
  }

  /** S04-4 ON_SCORE_CHANGED 处理器：写 HUD 预留字段（S04-5 才绘制）。 */
  private onScoreChanged(p: unknown): void {
    const { score, coins, comboMult } = p as {
      score: number;
      coins: number;
      comboMult: number;
    };
    this.hud.setScore(score);
    this.hud.setCoins(coins);
    this.hud.setCombo(comboMult);
  }

  /** 真实关卡渲染：实心 tile / 单向平台 / 凯旋之门，全部世界坐标（相机偏移）。 */
  private drawLevel(): void {
    if (this.levelGfx) this.levelGfx.destroy(); // 重建关卡前销毁旧地形 Graphics，避免泄漏
    const g = this.add.graphics();
    this.levelGfx = g;
    const ts = this.world.tileSize;
    // biome 氛围接线点：theme → palette（草原保持默认暖色；洞穴冷暗蓝），对齐 art/cave-biome-spec.md §6。
    const pal = biomeForLevel(this.runtime.data);
    const isSea = this.runtime.data.metadata.theme === 'sea';
    const isDesert = this.runtime.data.metadata.theme === 'desert';
    const isHome = this.runtime.data.metadata.theme === 'home';
    const isStreet = this.runtime.data.metadata.theme === 'street';
    const isOffice = this.runtime.data.metadata.theme === 'office';
    const isGrass = this.runtime.data.metadata.theme === 'grass';

    // 非海关：清理可能残留的海背景（四层视差）/潮汐层（切换关卡安全）
    if (!isSea) {
      this.seaSkyGfx?.destroy();
      this.seaSkyGfx = undefined;
      this.seaFarGfx?.destroy();
      this.seaFarGfx = undefined;
      this.seaMidGfx?.destroy();
      this.seaMidGfx = undefined;
      this.seaNearGfx?.destroy();
      this.seaNearGfx = undefined;
      this.tideGfx?.destroy();
      this.tideGfx = undefined;
    }
    // 非沙漠关：清理可能残留的沙漠背景层/流沙层（切换关卡安全）
    if (!isDesert) {
      this.desertSkyGfx?.destroy();
      this.desertSkyGfx = undefined;
      this.desertFarGfx?.destroy();
      this.desertFarGfx = undefined;
      this.desertMidGfx?.destroy();
      this.desertMidGfx = undefined;
      this.desertSunGfx?.destroy();
      this.desertSunGfx = undefined;
      this.desertNearGfx?.destroy();
      this.desertNearGfx = undefined;
      this.desertHeatGfx?.destroy();
      this.desertHeatGfx = undefined;
      this.quicksandGfx?.destroy();
      this.quicksandGfx = undefined;
      this.qsSinkMs = 0;
      this.qsSinkDepth = 0;
      this.qsZone = null;
    }
    // 非家关：清理可能残留的家背景层（切换关卡安全）。镜像沙漠清理块。
    if (!isHome) {
      this.homeWallGfx?.destroy();
      this.homeWallGfx = undefined;
      this.homeFarGfx?.destroy();
      this.homeFarGfx = undefined;
      this.homeMidGfx?.destroy();
      this.homeMidGfx = undefined;
      this.homeLampGfx?.destroy();
      this.homeLampGfx = undefined;
      this.homeNearGfx?.destroy();
      this.homeNearGfx = undefined;
      this.homeLampPhase = 0;
      this.homeCurtainPhase = 0;
    }
    // 非街道关：清理可能残留的街道背景层（切换关卡安全）。镜像沙漠/家清理块。
    if (!isStreet) {
      this.streetCeilWallGfx?.destroy();
      this.streetCeilWallGfx = undefined;
      this.streetFarGfx?.destroy();
      this.streetFarGfx = undefined;
      this.streetMidGfx?.destroy();
      this.streetMidGfx = undefined;
      this.streetGlowGfx?.destroy();
      this.streetGlowGfx = undefined;
      this.streetNearGfx?.destroy();
      this.streetNearGfx = undefined;
      this.streetWindowPhase = 0;
      this.streetLampPhase = 0;
      this.streetNeonPhase = 0;
      this.streetNearPhase = 0;
    }
    // 非办公关：清理可能残留的办公背景层（切换关卡安全）。镜像街道清理块。
    if (!isOffice) {
      this.officeWallGfx?.destroy();
      this.officeWallGfx = undefined;
      this.officeFarGfx?.destroy();
      this.officeFarGfx = undefined;
      this.officeMidGfx?.destroy();
      this.officeMidGfx = undefined;
      this.officeGlowGfx?.destroy();
      this.officeGlowGfx = undefined;
      this.officeNearGfx?.destroy();
      this.officeNearGfx = undefined;
      this.officeFluorescentPhase = 0;
      this.officeWindowPhase = 0;
      this.officeScreenPhase = 0;
      this.officeNearPhase = 0;
    }
    // 非草原关：清理可能残留的草原背景层（切换关卡安全）。镜像其他清理块。
    if (!isGrass) {
      this.grassSkyGfx?.destroy();
      this.grassSkyGfx = undefined;
      this.grassFarGfx?.destroy();
      this.grassFarGfx = undefined;
      this.grassMidGfx?.destroy();
      this.grassMidGfx = undefined;
      this.grassNearGfx?.destroy();
      this.grassNearGfx = undefined;
    }

    // 背景层：
    //  - 非海关/非沙漠/非家关：非空 palette 才平铺（洞穴暗蓝）；草原 bg=null 跳过（零回归）。
    //  - 海关/沙漠/家关：跳过平铺（交给 drawSeaBackground / drawDesertBackground / drawHomeBackground 的天空渐变 + 视差层）。
    if (!isSea && !isDesert && !isHome && !isStreet && !isOffice && pal.bg !== null) {
      g.fillStyle(pal.bg, 1);
      g.fillRect(0, 0, this.runtime.data.width * ts, this.runtime.data.height * ts);
    }
    // 海主题背景（天空渐变 + 远/中景视差），仅 sea 创建一次
    if (isSea) this.drawSeaBackground(pal);
    // 沙漠主题背景（暖沙晴空 + 远/中景视差 + 太阳 + 沙幕），仅 desert 创建一次（动态层每帧重绘）
    if (isDesert) this.drawDesertBackground(pal);
    // 家主题背景（天花板+后墙 + 窗光/家具剪影 + 相框/盆栽/台灯 + 游戏层家具 + 窗帘），仅 home 创建一次（动态层每帧重绘）
    if (isHome) this.drawHomeBackground(pal);
    // 街道主题背景（霓街夜景五层视差：天花板+后墙 / 远景楼宇+窗光 / 中景街灯+霓虹+树 / 游戏 / 前景护栏），仅 street 创建一次（动态层每帧重绘）
    if (isStreet) this.drawStreetBackground(pal);
    // 办公主题背景（室内办公五层视差：天花板+后墙 / 远景隔断+窗光 / 中景办公桌+显示器+绿植+荧光灯 / 游戏 / 前景悬挑/电线），仅 office 创建一次（动态层每帧重绘）
    if (isOffice) this.drawOfficeBackground(pal);
    // 草原主题背景（天空渐变 + 远/中/近景视差：云/远山/温室 + 树/风车/花丛 + 草丛/花瓣），仅 grass 创建一次
    if (isGrass) this.drawGrassBackground(pal);

    // 家具 tile-kind 查找表（sofa/table/cabinet 仅在此表达，碰撞由 world 的 solid/oneway 承接）。
    // 遍历 runtime.data.tiles 暴露 kind（home-visual-spec §2.5 允许的方案，零新增 world API）。
    const kindAt = new Map<string, string>();
    for (const t of this.runtime.data.tiles) kindAt.set(`${t.tx},${t.ty}`, t.kind);

    for (let ty = 0; ty < this.runtime.data.height; ty++) {
      for (let tx = 0; tx < this.runtime.data.width; tx++) {
        const X = tx * ts;
        const Y = ty * ts;
        // 办公文件堆瓦片：跳过地形绘制（paper_pile 皮肤由 enemyGfx 经 drawPaperPile 渲染，详见 §2.1）。
        if (this.runtime.paperPileTiles.has(`${tx},${ty}`)) continue;
        if (this.world.isSolidTile(tx, ty)) {
          const kind = kindAt.get(`${tx},${ty}`);
          if (kind === 'sofa' || kind === 'cabinet') {
            this.drawHomeFurnitureSolid(g, X, Y, ts, kind, pal); // 家具实心：暖橙面 + 暗面 + 描边 + 家具细节
          } else if (isGrass) {
            // 草原：地表草皮顶 + 泥土体；仅顶面有草皮与描边，埋入地下的瓦片不描边（避免 test 网格感）。
            const surface = ty - 1 >= 0 && !this.world.isSolidTile(tx, ty - 1);
            this.drawGrassSolid(g, X, Y, ts, pal, surface, tx);
          } else {
            g.fillStyle(pal.rockFace, 1);
            g.fillRect(X, Y, ts, ts);
            g.lineStyle(1, pal.outline, 1); // 强制 1px 描边 #2A1A12（可访问性，vs 天空≈8.8:1）
            g.strokeRect(X, Y, ts, ts);
          }
        } else if (this.world.isOneWayTile(tx, ty)) {
          const kind = kindAt.get(`${tx},${ty}`);
          if (kind === 'table') {
            this.drawHomeFurnitureTable(g, X, Y, ts, pal); // 家具单向：仅顶半画桌面 + 暖黄沿 + 腿
          } else if (isGrass) {
            // 草原单向平台：红砖平台 + 顶面草皮（蘑菇/木板风，统一世界观）。
            this.drawGrassOneway(g, X, Y, ts, pal, tx);
          } else {
            g.fillStyle(pal.rockBody, 1);
            g.fillRect(X, Y, ts, ts / 2);
            g.lineStyle(1, pal.outline, 1); // 单向平台同样强制 1px 描边
            g.strokeRect(X, Y, ts, ts / 2);
          }
        }
      }
    }
    // 凯旋之门
    g.fillStyle(pal.crystalCore, 1);
    g.fillRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);
    g.lineStyle(2, pal.outline, 1);
    g.strokeRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);

    // 潮汐水体叠层（世界坐标，depth 3，位于地形之上、实体之下）；每帧按 waterSurfaceY 重绘
    if (isSea && !this.tideGfx) this.tideGfx = this.add.graphics().setDepth(3);
    // GDD 1-4 流沙叠层（世界坐标，depth 3，同上；每帧按 sink 状态重绘）
    if (isDesert && !this.quicksandGfx) this.quicksandGfx = this.add.graphics().setDepth(3);
  }

  /**
   * 海主题背景层（GDD 1-3 / sea-visual-spec §1，仅 sea）：完整五层视差结构——
   *   sky (scrollFactor 0,   depth -10) 天空/水面竖直渐变（SKY→ROCK_FACE），全屏一次
   *   far (scrollFactor 0.3, depth -9)  远礁剪影(REEF_FAR 无描边) + 海底剪影带(ROCK_BODY 起伏带)
   *   mid (scrollFactor 0.6, depth -8)  浪线(SKY α0.5) + 珊瑚(CORAL 枝 + FIRE 尖) + 静态气泡
   * 远景/中景绘制范围覆盖整关世界宽（runtime.data.width*tileSize）以支撑视差；
   * near 前景层（seaNearGfx，scrollFactor 1.2）由 drawSeaNear 每帧重绘，此处仅创建。
   * 全程序化 Graphics（零 PNG，ADR-004），颜色仅用 11 色锁色板或 tint 派生（REEF_FAR=0x2c486f 为
   * darken(#4A78C0,0.4) tint 派生，0 新增 hex）。
   * draw call：sky 1 + far(礁×6 + 海床 1)≈7 + mid(浪线 1 + 珊瑚×2 + 气泡×4)≈7，均 ≤15。
   */
  private drawSeaBackground(pal: ThemePalette): void {
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts; // 世界宽：远景/中景据此铺满以支撑视差
    const levelH = this.runtime.data.height * ts; // 世界高（= 内分辨率高，纵向不滚动 → scrollY 恒 0）
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // 锁色板 / tint 派生（0 新增 hex）
    const SKY = pal.bg ?? 0x5bc8f5; // 天空 #5BC8F5（#11）
    const ROCK_FACE = pal.rockFace; // 环境冷蓝 #4A78C0（#10）
    const REEF_FAR = 0x2c486f; // darken(#4A78C0, 0.4) 远景水幕剪影（tint 派生）
    const ROCK_BODY = pal.rockBody; // darken(#4A78C0, 0.5) 海床暗面（tint 派生）
    const CORAL = pal.crystalGlow; // 草绿 #7CC242（#1）
    const FIRE = pal.firelight; // 暖橙 #F2933C（#3）
    const BUBBLE_CORE = pal.crystalCore; // 暖黄 #FFD23F（#4）

    // ── 1) 天空/水面层（scrollFactor 0, depth -10）：竖直渐变 SKY→ROCK_FACE，全屏一次 fillRect ──
    if (!this.seaSkyGfx) this.seaSkyGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const sky = this.seaSkyGfx;
    sky.clear();
    sky.fillGradientStyle(SKY, SKY, ROCK_FACE, ROCK_FACE, 1);
    sky.fillRect(0, 0, camW, camH);

    // ── 2) 远景 far（scrollFactor 0.3, depth -9）：远礁剪影 + 海底剪影带，铺满 levelW ──
    if (!this.seaFarGfx) this.seaFarGfx = this.add.graphics().setScrollFactor(0.3).setDepth(-9);
    const far = this.seaFarGfx;
    far.clear();
    // 远礁剪影（3 座，无描边、低饱和）
    far.fillStyle(REEF_FAR, 1);
    const reefClusters = [
      { x: levelW * 0.12, y: levelH * 0.6, r: 46 },
      { x: levelW * 0.5, y: levelH * 0.56, r: 54 },
      { x: levelW * 0.84, y: levelH * 0.6, r: 48 },
    ];
    for (const c of reefClusters) {
      far.fillCircle(c.x, c.y, c.r);
      far.fillCircle(c.x + c.r * 0.62, c.y + c.r * 0.2, c.r * 0.72);
    }
    // 海底剪影带（ROCK_BODY 起伏带，贴底部/海床轮廓，纯氛围非碰撞）
    const seabed: { x: number; y: number }[] = [];
    const amp = 12;
    const wl = 150;
    for (let x = 0; x <= levelW; x += 32) {
      seabed.push({ x, y: levelH - 16 + Math.sin(x * ((Math.PI * 2) / wl)) * amp });
    }
    seabed.push({ x: levelW, y: levelH });
    seabed.push({ x: 0, y: levelH });
    far.fillStyle(ROCK_BODY, 1);
    far.fillPoints(seabed, true);

    // ── 3) 中景 mid（scrollFactor 0.6, depth -8）：浪线 + 珊瑚 + 气泡，铺满 levelW ──
    if (!this.seaMidGfx) this.seaMidGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    const mid = this.seaMidGfx;
    mid.clear();
    // 浪线带（正弦，SKY α0.5，置于海平线附近）
    mid.lineStyle(2, SKY, 0.5);
    mid.beginPath();
    const waveY = levelH * 0.66;
    mid.moveTo(0, waveY);
    for (let x = 0; x <= levelW; x += 16) {
      mid.lineTo(x, waveY + Math.sin(x * 0.05) * 5);
    }
    mid.strokePath();
    // 珊瑚（CORAL 枝 + FIRE 尖端圆点），2 处
    const coralSpots = [
      { x: levelW * 0.28, y: levelH * 0.86, h: 34 },
      { x: levelW * 0.68, y: levelH * 0.9, h: 28 },
    ];
    for (const s of coralSpots) {
      const w = 10;
      mid.fillStyle(CORAL, 1);
      mid.fillPoints(
        [
          { x: s.x, y: s.y },
          { x: s.x - w, y: s.y - s.h },
          { x: s.x - w * 0.3, y: s.y - s.h * 0.5 },
          { x: s.x, y: s.y - s.h },
          { x: s.x + w * 0.3, y: s.y - s.h * 0.5 },
          { x: s.x + w, y: s.y - s.h },
          { x: s.x, y: s.y },
        ],
        true,
      );
      mid.fillStyle(FIRE, 1);
      mid.fillCircle(s.x - w, s.y - s.h, 2.5);
      mid.fillCircle(s.x, s.y - s.h, 2.5);
      mid.fillCircle(s.x + w, s.y - s.h, 2.5);
    }
    // 气泡（外圈 SKY α0.4 + 核心 BUBBLE_CORE），静态装饰 2 颗
    const bubbleSpots = [
      { x: levelW * 0.4, y: levelH * 0.4, r: 4 },
      { x: levelW * 0.8, y: levelH * 0.35, r: 3.5 },
    ];
    for (const b of bubbleSpots) {
      mid.fillStyle(SKY, 0.4);
      mid.fillCircle(b.x, b.y, b.r);
      mid.fillStyle(BUBBLE_CORE, 0.8);
      mid.fillCircle(b.x, b.y, b.r * 0.4);
    }

    // ── 4) 前景 near（scrollFactor 1.2, depth 4）：每帧由 drawSeaNear 重绘，此处仅创建 ──
    if (!this.seaNearGfx) this.seaNearGfx = this.add.graphics().setScrollFactor(1.2).setDepth(4);
  }

  /**
   * 海主题前景 near 层（sea-visual-spec §1.5，仅 sea）：scrollFactor 1.2, depth 4，
   * 每帧 clear+重绘；2–3 颗缓升气泡（相位驱动，BUBBLE_CORE 核心 + SKY 外圈，alpha 低，遮挡≤10%）。
   * 另含一条极淡的近景浪花起伏线（前景微光 accent，刻意不锚定世界水位线——见回传偏差说明）。
   * Reduce Motion 下相位冻结（仅保留静态首帧，防光敏 <3Hz）。
   * 注：near 层 depth=4（低于实体层 7–12）以克制遮挡，与任务表一致；scrollFactor 1.2 提供前景快于世界的视差。
   */
  private drawSeaNear(): void {
    const g = this.seaNearGfx;
    if (!g) return;
    const cam = this.cameras.main;
    const camW = cam.width;
    const camH = cam.height;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    g.clear();
    const SKY = 0x5bc8f5; // 天空 #5BC8F5（#11）
    const BUBBLE_CORE = 0xffd23f; // 暖黄 #FFD23F（#4）

    // 每帧相位推进（≤3Hz；Reduce Motion 冻结首帧）
    if (!this.reduceMotion) this.seaNearPhase += STEP_DT * 0.6;

    // 2–3 颗缓升气泡：屏幕锚定（随相机 1.2 视差），y 由相位循环自底向上
    const bubbles = [
      { sx: camW * 0.2, offset: 0.0, rate: 0.16, rise: camH * 0.62, r: 3 },
      { sx: camW * 0.55, offset: 0.33, rate: 0.13, rise: camH * 0.7, r: 2.4 },
      { sx: camW * 0.82, offset: 0.66, rate: 0.18, rise: camH * 0.55, r: 2.8 },
    ];
    for (const b of bubbles) {
      const prog = (this.seaNearPhase * b.rate + b.offset) % 1;
      const screenY = camH - prog * b.rise; // 自底向上缓升，循环
      const sway = Math.sin(this.seaNearPhase * 1.2 + b.offset * 6) * 4; // 轻微水平摇曳
      const sx = b.sx + sway;
      // 屏幕锚定：local = screen + scroll*f，抵消 1.2 视差 → 气泡贴视口并随相机相对移动（前景掠过感）
      const lx = sx + scrollX * 1.2;
      const ly = screenY + scrollY * 1.2;
      g.fillStyle(SKY, 0.35);
      g.fillCircle(lx, ly, b.r);
      g.fillStyle(BUBBLE_CORE, 0.8);
      g.fillCircle(lx, ly, b.r * 0.4);
    }

    // 可选：极淡近景浪花起伏线（前景微光 accent，不锚定世界水位线，纯氛围）
    g.lineStyle(1, SKY, 0.22);
    g.beginPath();
    const baseY = camH * 0.82;
    g.moveTo(scrollX * 1.2, baseY + scrollY * 1.2);
    for (let i = 0; i <= camW; i += 16) {
      const yy = baseY + Math.sin(i * 0.06 + this.seaNearPhase * 2) * 3;
      g.lineTo(i + scrollX * 1.2, yy + scrollY * 1.2);
    }
    g.strokePath();
  }

  /**
   * 沙漠主题背景层（GDD 1-4 / desert-visual-spec §1，仅 desert）：镜像 drawSeaBackground 五层视差结构——
   *   sky (scrollFactor 0,   depth -10) 暖沙晴空竖直渐变（bg #F7BE8A → firelight #FFD23F 辉光）
   *   far (scrollFactor 0.3, depth -9)  沙丘剪影带(rockBody 无描边)
   *   mid (scrollFactor 0.6, depth -8)  金字塔(rockFace 受光 / rockBody 暗面) + 仙人掌(crystalCore + 暗部 + 红刺)
   * 远景/中景绘制范围覆盖整关世界宽（runtime.data.width*tileSize）以支撑视差；
   * 太阳脉冲层(desertSunGfx)与前景沙幕层(desertNearGfx)为每帧重绘，此处仅创建 Graphics。
   * 全程序化 Graphics（零 PNG，ADR-004），颜色仅用 11 色锁色板或 tint 派生（CACTUS_DARK=0x3e6121 为
   * darken(#7CC242,0.5) tint 派生，0 新增 hex）。draw call：sky 1 + far 1 + mid(金字塔×3 + 仙人掌×3)≈7，均 ≤15。
   */
  private drawDesertBackground(pal: ThemePalette): void {
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // 锁色板 / tint 派生（0 新增 hex）
    const SKY = pal.bg ?? 0xf7be8a; // 暖沙晴空 #F7BE8A（tint 派生）
    const HORIZON = pal.firelight; // 暖黄 #FFD23F 近地平线辉光
    const ROCK_BODY = pal.rockBody; // 暗沙岩 #79491E（远景沙丘 / 漩涡）
    const ROCK_FACE = pal.rockFace; // 暖橙 #F2933C（金字塔受光 / 太阳）
    const CACTUS = pal.crystalCore; // 草绿 #7CC242（仙人掌主体）
    const CACTUS_DARK = 0x3e6121; // darken(#7CC242,0.5) 仙人掌暗部（tint 派生）
    const OUT = pal.outline; // 描边 #2A1A12

    // ── 1) 天空层（scrollFactor 0, depth -10）：竖直渐变 SKY→HORIZON，全屏一次 ──
    if (!this.desertSkyGfx) this.desertSkyGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const sky = this.desertSkyGfx;
    sky.clear();
    sky.fillGradientStyle(SKY, SKY, HORIZON, HORIZON, 1);
    sky.fillRect(0, 0, camW, camH);

    // ── 2) 远景 far（scrollFactor 0.3, depth -9）：沙丘剪影带，铺满 levelW ──
    if (!this.desertFarGfx) this.desertFarGfx = this.add.graphics().setScrollFactor(0.3).setDepth(-9);
    const far = this.desertFarGfx;
    far.clear();
    far.fillStyle(ROCK_BODY, 1);
    const dunes: { x: number; y: number }[] = [];
    const amp = 14;
    const wl = 180;
    for (let x = 0; x <= levelW; x += 32) {
      dunes.push({ x, y: levelH * 0.64 + Math.sin(x * ((Math.PI * 2) / wl)) * amp });
    }
    dunes.push({ x: levelW, y: levelH });
    dunes.push({ x: 0, y: levelH });
    far.fillPoints(dunes, true);

    // ── 3) 中景 mid（scrollFactor 0.6, depth -8）：金字塔 + 仙人掌，create-once（仅 scrollFactor 驱动视差）──
    if (!this.desertMidGfx) this.desertMidGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    const mid = this.desertMidGfx;
    mid.clear();
    // 金字塔 ×3（左受光 ROCK_FACE / 右暗 ROCK_BODY，轻描边）
    const pyramids = [
      { x: levelW * 0.18, baseY: levelH * 0.68, w: 90, h: 64 },
      { x: levelW * 0.52, baseY: levelH * 0.7, w: 80, h: 56 },
      { x: levelW * 0.82, baseY: levelH * 0.66, w: 96, h: 70 },
    ];
    for (const p of pyramids) {
      const topX = p.x;
      const topY = p.baseY - p.h;
      const blX = p.x - p.w / 2;
      const brX = p.x + p.w / 2;
      mid.fillStyle(ROCK_FACE, 1);
      mid.fillPoints([{ x: topX, y: topY }, { x: blX, y: p.baseY }, { x: p.x, y: p.baseY }], true);
      mid.fillStyle(ROCK_BODY, 1);
      mid.fillPoints([{ x: topX, y: topY }, { x: p.x, y: p.baseY }, { x: brX, y: p.baseY }], true);
      mid.lineStyle(1, OUT, 1);
      mid.strokePoints([{ x: topX, y: topY }, { x: blX, y: p.baseY }, { x: brX, y: p.baseY }, { x: topX, y: topY }], true);
    }
    // 仙人掌 ×3（CACTUS 竖柱 + CACTUS_DARK 暗部 + 侧臂 + 红刺点缀，轻描边）
    const cacti = [
      { x: levelW * 0.33, baseY: levelH * 0.74, h: 46 },
      { x: levelW * 0.66, baseY: levelH * 0.76, h: 40 },
      { x: levelW * 0.92, baseY: levelH * 0.72, h: 52 },
    ];
    for (const c of cacti) {
      const w = 22;
      const x0 = c.x - w / 2;
      mid.fillStyle(CACTUS, 1);
      mid.fillRoundedRect(x0, c.baseY - c.h, w, c.h, { tl: 10, tr: 10, bl: 4, br: 4 });
      mid.fillStyle(CACTUS_DARK, 1);
      mid.fillRoundedRect(x0 + w * 0.66, c.baseY - c.h, w * 0.34, c.h, { tl: 0, tr: 10, bl: 0, br: 4 });
      mid.fillStyle(CACTUS, 1);
      mid.fillRoundedRect(x0 - 8, c.baseY - c.h * 0.6, 10, 16, 4);
      mid.fillRoundedRect(x0 + w - 2, c.baseY - c.h * 0.5, 10, 18, 4);
      mid.lineStyle(1, OUT, 1);
      mid.strokeRoundedRect(x0, c.baseY - c.h, w, c.h, { tl: 10, tr: 10, bl: 4, br: 4 });
      mid.fillStyle(pal.danger, 1);
      mid.fillCircle(x0 + 4, c.baseY - c.h * 0.8, 1.5);
      mid.fillCircle(x0 + w - 4, c.baseY - c.h * 0.5, 1.5);
    }

    // ── 4) 太阳脉冲层（scrollFactor 0.6, depth -8）：每帧重绘（drawDesertSun）──
    if (!this.desertSunGfx) this.desertSunGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    // ── 5) 前景沙幕层（scrollFactor 1.2, depth 4）：每帧重绘（drawDesertNear）──
    if (!this.desertNearGfx) this.desertNearGfx = this.add.graphics().setScrollFactor(1.2).setDepth(4);
    // ── 6) 热浪蜃气层（scrollFactor 0.4, depth -8.5）：每帧重绘（drawDesertHeat）──
    if (!this.desertHeatGfx) this.desertHeatGfx = this.add.graphics().setScrollFactor(0.4).setDepth(-8.5);
  }

  /**
   * 沙漠主题太阳脉冲层（desert-visual-spec §1.4，仅 desert）：scrollFactor 0.6, depth -8，
   * 每帧 clear+重绘；核心圆 + 8 条放射光芒，整体缩放 1±0.06 + 核心 α 呼吸（≤2Hz，防光敏）。
   * Reduce Motion 下相位冻结（静态圆 + 固定 α=0.85，无缩放/呼吸）。
   */
  private drawDesertSun(): void {
    const g = this.desertSunGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelH = this.runtime.data.height * ts;
    const levelW = this.runtime.data.width * ts;
    g.clear();
    const SUN = 0xffd23f; // 暖黄 #FFD23F（#4）
    if (!this.reduceMotion) this.desertSunPhase += STEP_DT * (2 * Math.PI * 1.2); // ≤2Hz
    const pulse = this.reduceMotion ? 0 : Math.sin(this.desertSunPhase);
    const baseR = 20;
    const r = baseR * (1 + pulse * 0.06);
    const coreA = this.reduceMotion ? 0.85 : 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(this.desertSunPhase));
    const cx = levelW * 0.74;
    const cy = levelH * 0.16;
    g.lineStyle(2, SUN, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.desertSunPhase * 0.3;
      g.lineBetween(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10));
    }
    g.fillStyle(SUN, coreA);
    g.fillCircle(cx, cy, r);
  }

  /**
   * 沙漠主题前景沙幕层（desert-visual-spec §1.5，仅 desert）：scrollFactor 1.2, depth 4，
   * 每帧 clear+重绘；屏幕锚定斜飘带（相位门控约 30% 时间可见，克制遮挡 ≤10%），暖黄高光点。
   * Reduce Motion 下相位冻结（静态斜带，不再飘移）。
   */
  private drawDesertNear(): void {
    const g = this.desertNearGfx;
    if (!g) return;
    const cam = this.cameras.main;
    const camW = cam.width;
    const camH = cam.height;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    g.clear();
    const SAND = 0xf2933c; // 暖橙 #F2933C（#3）
    const GOLD = 0xffd23f; // 暖黄 #FFD23F（#4）
    if (!this.reduceMotion) this.desertVeilPhase += STEP_DT * 0.5;
    const vis = Math.sin(this.desertVeilPhase * 0.2);
    if (vis <= 0.6) return; // 周期性透明（克制）
    const alpha = 0.25 + 0.15 * ((vis - 0.6) / 0.4);
    const baseY = camH * 0.7;
    const sway = Math.sin(this.desertVeilPhase) * 20;
    const pts = [
      { x: camW * 0.1 + sway, y: baseY },
      { x: camW * 0.4 + sway, y: baseY - 18 },
      { x: camW * 0.7 + sway, y: baseY + 8 },
      { x: camW * 1.0 + sway, y: baseY - 12 },
      { x: camW * 1.0 + sway, y: baseY + 14 },
      { x: camW * 0.1 + sway, y: baseY + 22 },
    ];
    g.fillStyle(SAND, alpha);
    g.beginPath();
    g.moveTo(pts[0].x + scrollX * 1.2, pts[0].y + scrollY * 1.2);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x + scrollX * 1.2, pts[i].y + scrollY * 1.2);
    g.closePath();
    g.fillPath();
    g.fillStyle(GOLD, 0.3);
    g.fillCircle(camW * 0.5 + sway + scrollX * 1.2, baseY + scrollY * 1.2, 2);
    g.fillCircle(camW * 0.8 + sway + scrollX * 1.2, baseY + 4 + scrollY * 1.2, 1.6);
  }

  /**
   * 沙漠主题-热浪蜃气层（desert-visual-spec §1.6，仅 desert）：scrollFactor 0.4, depth -8.5，
   * 每帧 clear+重绘；近地平线 2–3 条极低 α 水平「蜃气」条纹（SKY #F7BE8A / HORIZON #FFD23F，α≤0.12），
   * 垂直低频正弦摆动（≤1.5Hz，幅度 ≤2px）+ 条纹间水平相位差（desertHeatPhase + i*0.6），制造上升热浪扭曲感。
   * Reduce Motion 下相位冻结（静态条纹、固定 α，光敏安全 ≤3Hz）。draw call：fillRect×3（0 新增 hex）。
   */
  private drawDesertHeat(): void {
    const g = this.desertHeatGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelH = this.runtime.data.height * ts;
    const levelW = this.runtime.data.width * ts;
    g.clear();
    const SKY = 0xf7be8a; // 暖沙晴空 #F7BE8A（pal.bg，tint 派生）
    const HORIZON = 0xffd23f; // 暖黄 #FFD23F（pal.firelight，锁色板 #4）
    if (!this.reduceMotion) this.desertHeatPhase += STEP_DT * (2 * Math.PI * 1.5); // ≤1.5Hz 上升热浪
    const baseY = levelH * 0.63; // 对齐 far 沙丘剪影上缘（§1.6）
    const STRIPES = 3;
    for (let i = 0; i < STRIPES; i++) {
      const ph = this.desertHeatPhase + i * 0.6; // 条纹间相位差
      const sway = Math.sin(ph) * 2; // 垂直低频摆动 ≤2px
      const y = baseY + i * 3 + sway; // 高 2–4px 条纹，微错开
      const alpha = Math.max(0.04, 0.1 - i * 0.02); // α≤0.12，近地平线逐条更淡
      g.fillStyle(i % 2 === 0 ? SKY : HORIZON, alpha); // SKY/HORIZON 交替，极低 α（0 新增 hex）
      g.fillRect(0, y, levelW, 2 + (i % 2)); // 高 2–3px，跨整关世界宽
    }
  }

  /**
   * GDD 1-4 流沙叠层渲染（每帧，仅 desert 关卡）：按各区 surfaceY→deathY 铺暖橙沙底，
   * 叠同心内陷漩涡（rockBody 暗色，中心最暗），边缘轻描边区分边界（desert-visual-spec §2.3）。
   * Reduce Motion 下 sinkPhase 冻结（静态同心圈，仍暗色可读）。draw call：每区 ~2（铺底 + 漩涡×3 单 path）≈ 2。
   */
  private drawQuicksandOverlay(): void {
    const g = this.quicksandGfx;
    if (!g) return;
    const zones = this.runtime.data.quicksand;
    g.clear();
    if (!zones || zones.length === 0) return;
    const SAND = 0xf2933c; // 暖橙 #F2933C（#3，融入沙底）
    const SWIRL = 0x79491e; // darken(#F2933C,0.5) 漩涡暗色（tint 派生）
    const OUT = 0x2a1a12; // 描边 #2A1A12（#5）
    const sinkPhase = this.reduceMotion ? 0 : (this.elapsedMs / 1000) * 1.5; // ≤3Hz 内陷
    for (const z of zones) {
      const zx = z.xStart;
      const zw = z.xEnd - z.xStart;
      const zy = z.surfaceY;
      const zh = z.deathY - z.surfaceY;
      g.fillStyle(SAND, 1);
      g.fillRect(zx, zy, zw, zh);
      for (let ring = 0; ring < 3; ring++) {
        const rr = zh * 0.4 * (1 - ring * 0.28) * (1 - 0.04 * Math.sin(sinkPhase + ring));
        g.fillStyle(SWIRL, 0.35 + ring * 0.12);
        g.fillEllipse(zx + zw / 2, zy + zh / 2, rr * 2, rr);
      }
      g.lineStyle(1, OUT, 0.4);
      g.strokeRect(zx, zy, zw, zh);
    }
  }

  /**
   * 家主题背景层（GDD 1-5 / home-visual-spec §1，仅 home）：镜像 drawDesertBackground 五层视差结构——
   *   wall (scrollFactor 0,   depth -10) 天花板+后墙竖直渐变（bg #6B4220 → rockBody #79491E 天花板带）
   *   far  (scrollFactor 0.3, depth -9)  窗光(天空蓝内#5BC8F5 + 暖黄光晕 + 经济金框) + 家具剪影带(rockBody 无描边)
   *   mid  (scrollFactor 0.6, depth -8)  相框(经济金+草绿内) + 盆栽(草绿团+暗部) + 台灯架(暖橙柱+梯形罩)
   * 远景/中景绘制范围覆盖整关世界宽（runtime.data.width*tileSize）以支撑视差；
   * 台灯脉冲层(homeLampGfx)与前景窗帘层(homeNearGfx)为每帧重绘，此处仅创建 Graphics。
   * 全程序化 Graphics（零 PNG，ADR-004），颜色仅用 11 色锁色板或 tint 派生（盆栽暗部 0x3E6121 为
   * darken(#7CC242,0.5) tint 派生，0 新增 hex）。draw call：wall 1 + far(窗×3 + 剪影 1)≈4 + mid(框×3 + 盆栽×3 + 灯架×1)≈7，均 ≤15。
   */
  private drawHomeBackground(pal: ThemePalette): void {
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // 锁色板 / tint 派生（0 新增 hex）
    const WALL = pal.bg ?? 0x6b4220; // 暖棕墙 #6B4220（darken(#F2933C,0.55) tint 派生）
    const CEIL = pal.rockBody; // 天花板带 #79491E（darken(#F2933C,0.5) tint 派生）
    const ROCK_FACE = pal.rockFace; // 暖橙 #F2933C（木面 / 灯架）
    const ROCK_BODY = pal.rockBody; // 暗面 #79491E（家具剪影 / 天花板带）
    const FIRE = pal.firelight; // 暖黄 #FFD23F（窗光 / 桌沿 / 灯晕）
    const GLOW = pal.crystalGlow; // 草绿 #7CC242（盆栽 / 相框内块）
    const GOLD = 0xf2c94c; // 经济金 #F2C94C（窗框 / 柜把手 / 相框边，锁色板 #8）
    const SKY = 0x5bc8f5; // 天空 #5BC8F5（窗外微光，锁色板 #11）
    const OUT = pal.outline; // 描边 #2A1A12

    // ── 1) 天花板+后墙层（scrollFactor 0, depth -10）：竖直渐变 CEIL→WALL，全屏一次 fillRect ──
    if (!this.homeWallGfx) this.homeWallGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const wall = this.homeWallGfx;
    wall.clear();
    wall.fillGradientStyle(CEIL, CEIL, WALL, WALL, 1);
    wall.fillRect(0, 0, camW, camH);
    // 天花板与墙交界加深线（纯氛围，强化顶/壁分界）
    wall.lineStyle(2, ROCK_BODY, 1);
    wall.lineBetween(0, camH * 0.18, camW, camH * 0.18);

    // ── 2) 远景 far（scrollFactor 0.3, depth -9）：窗光 + 家具剪影带，铺满 levelW ──
    if (!this.homeFarGfx) this.homeFarGfx = this.add.graphics().setScrollFactor(0.3).setDepth(-9);
    const far = this.homeFarGfx;
    far.clear();
    // 窗光 ×3（窗格内天空蓝 α≤0.5 + 暖黄光晕 α≤0.3 静态首帧 + 经济金细框；脉冲为可选项，此处保持静态守 Reduce Motion）
    const winY = levelH * 0.3;
    const winW = 44;
    const winH = 56;
    const winXs = [levelW * 0.22, levelW * 0.55, levelW * 0.84];
    for (const wx of winXs) {
      far.fillStyle(SKY, 0.45);
      far.fillRect(wx - winW / 2, winY - winH / 2, winW, winH);
      far.fillStyle(FIRE, 0.3);
      far.fillRect(wx - winW / 2 + 4, winY - winH / 2 + 4, winW - 8, winH - 8);
      far.lineStyle(1, GOLD, 1);
      far.strokeRect(wx - winW / 2, winY - winH / 2, winW, winH);
      far.lineBetween(wx, winY - winH / 2, wx, winY + winH / 2); // 窗中竖格
    }
    // 家具剪影带（ROCK_BODY 起伏带，无描边、低饱和，纯氛围非碰撞）
    const sil: { x: number; y: number }[] = [];
    const amp = 14;
    const wl = 200;
    for (let x = 0; x <= levelW; x += 32) {
      sil.push({ x, y: levelH * 0.6 + Math.sin(x * ((Math.PI * 2) / wl)) * amp });
    }
    sil.push({ x: levelW, y: levelH });
    sil.push({ x: 0, y: levelH });
    far.fillStyle(ROCK_BODY, 1);
    far.fillPoints(sil, true);

    // ── 3) 中景 mid（scrollFactor 0.6, depth -8）：相框 + 盆栽 + 灯架，create-once（仅 scrollFactor 驱动视差）──
    if (!this.homeMidGfx) this.homeMidGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    const mid = this.homeMidGfx;
    mid.clear();
    // 相框 ×3（经济金框 + 草绿内块 + 描边）
    const frames = [
      { x: levelW * 0.16, y: levelH * 0.34 },
      { x: levelW * 0.4, y: levelH * 0.3 },
      { x: levelW * 0.72, y: levelH * 0.36 },
    ];
    for (const f of frames) {
      mid.fillStyle(GOLD, 1);
      mid.fillRoundedRect(f.x - 13, f.y - 10, 26, 20, 2);
      mid.fillStyle(GLOW, 1);
      mid.fillRect(f.x - 9, f.y - 6, 18, 12);
      mid.lineStyle(1, OUT, 1);
      mid.strokeRoundedRect(f.x - 13, f.y - 10, 26, 20, 2);
    }
    // 盆栽 ×3（草绿团 + 暗部侧 + 描边）
    const plants = [
      { x: levelW * 0.3, y: levelH * 0.5 },
      { x: levelW * 0.62, y: levelH * 0.48 },
      { x: levelW * 0.88, y: levelH * 0.52 },
    ];
    for (const p of plants) {
      mid.fillStyle(GLOW, 1);
      mid.fillCircle(p.x, p.y, 9);
      mid.fillCircle(p.x - 6, p.y + 3, 6);
      mid.fillCircle(p.x + 6, p.y + 3, 6);
      mid.fillStyle(0x3e6121, 1); // darken(#7CC242,0.5) 盆栽暗部（tint 派生，0 新增）
      mid.fillCircle(p.x + 4, p.y + 2, 5);
      mid.lineStyle(1, OUT, 1);
      mid.strokeCircle(p.x, p.y, 9);
    }
    // 灯架 ×1（暖橙细柱 + 底座 + 梯形灯罩；灯晕由 drawHomeLamp 每帧脉冲）
    const lampX = levelW * 0.4;
    const lampBaseY = levelH * 0.42;
    mid.fillStyle(ROCK_FACE, 1);
    mid.fillRoundedRect(lampX - 3, lampBaseY, 6, 22, 2); // 柱
    mid.fillEllipse(lampX, lampBaseY + 22, 18, 6); // 底座
    mid.fillPoints(
      [
        { x: lampX - 12, y: lampBaseY - 2 },
        { x: lampX + 12, y: lampBaseY - 2 },
        { x: lampX + 8, y: lampBaseY - 16 },
        { x: lampX - 8, y: lampBaseY - 16 },
      ],
      true,
    ); // 梯形灯罩
    mid.lineStyle(1, OUT, 1);
    mid.strokeRoundedRect(lampX - 3, lampBaseY, 6, 22, 2);
    mid.strokePoints(
      [
        { x: lampX - 12, y: lampBaseY - 2 },
        { x: lampX + 12, y: lampBaseY - 2 },
        { x: lampX + 8, y: lampBaseY - 16 },
        { x: lampX - 8, y: lampBaseY - 16 },
      ],
      true,
    );

    // ── 4) 台灯脉冲层（scrollFactor 0.6, depth -8）：每帧重绘（drawHomeLamp）──
    if (!this.homeLampGfx) this.homeLampGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    // ── 5) 前景窗帘层（scrollFactor 1.2, depth 4）：每帧重绘（drawHomeNear）──
    if (!this.homeNearGfx) this.homeNearGfx = this.add.graphics().setScrollFactor(1.2).setDepth(4);
  }

  /**
   * 家具实心 tile 渲染（sofa/cabinet = solid 复用，home-visual-spec §2.3）：暖橙木面 + 暗面带 + 1px 描边 + 家具细节。
   * 碰撞由 CollisionWorld 的 solid 承接（零新碰撞）；此处仅换皮。坐标 (X,Y) 为瓦片左上角（px）。
   */
  private drawHomeFurnitureSolid(
    g: Phaser.GameObjects.Graphics,
    X: number,
    Y: number,
    ts: number,
    kind: string,
    pal: ThemePalette,
  ): void {
    const ROCK_FACE = pal.rockFace; // 暖橙 #F2933C（木面）
    const ROCK_BODY = pal.rockBody; // 暗面 #79491E
    const GOLD = 0xf2c94c; // 经济金 #F2C94C（柜把手，锁色板 #8）
    const OUT = pal.outline; // 描边 #2A1A12
    // 木面
    g.fillStyle(ROCK_FACE, 1);
    g.fillRect(X, Y, ts, ts);
    // 顶暗带（受光少）
    g.fillStyle(ROCK_BODY, 1);
    g.fillRect(X, Y, ts, 6);
    g.lineStyle(1, OUT, 1);
    g.strokeRect(X, Y, ts, ts);
    if (kind === 'cabinet') {
      // 柜：门缝 + 金把手
      g.lineStyle(1, ROCK_BODY, 1);
      g.lineBetween(X + ts / 2, Y + 4, X + ts / 2, Y + ts - 4);
      g.fillStyle(GOLD, 1);
      g.fillCircle(X + ts / 2 - 3, Y + ts / 2, 1.5);
    } else {
      // 沙发：顶两坐垫凸
      g.fillStyle(ROCK_FACE, 1);
      g.fillRoundedRect(X + 3, Y + 2, ts / 2 - 5, 6, 3);
      g.fillRoundedRect(X + ts / 2 + 2, Y + 2, ts / 2 - 5, 6, 3);
    }
  }

  /**
   * 家具单向 tile 渲染（table = oneway 复用，home-visual-spec §2.3）：仅顶面半画桌面（同 oneway 行为）+
   * 暖黄桌沿高光 + 两短腿。碰撞由 CollisionWorld 的 oneWay 承接（零新碰撞）。坐标 (X,Y) 为瓦片左上角（px）。
   */
  private drawHomeFurnitureTable(
    g: Phaser.GameObjects.Graphics,
    X: number,
    Y: number,
    ts: number,
    pal: ThemePalette,
  ): void {
    const ROCK_FACE = pal.rockFace; // 暖橙 #F2933C（桌面）
    const ROCK_BODY = pal.rockBody; // 暗面 #79491E（腿）
    const FIRE = pal.firelight; // 暖黄 #FFD23F（桌沿高光）
    const OUT = pal.outline; // 描边 #2A1A12
    // 桌面（顶半）
    g.fillStyle(ROCK_FACE, 1);
    g.fillRect(X, Y, ts, ts / 2);
    // 桌沿暖黄高光
    g.lineStyle(1, FIRE, 0.8);
    g.lineBetween(X, Y + 1, X + ts, Y + 1);
    // 描边（顶半）
    g.lineStyle(1, OUT, 1);
    g.strokeRect(X, Y, ts, ts / 2);
    // 两短腿
    g.fillStyle(ROCK_BODY, 1);
    g.fillRect(X + 5, Y + ts / 2, 4, ts / 2 - 2);
    g.fillRect(X + ts - 9, Y + ts / 2, 4, ts / 2 - 2);
  }

  /**
   * 家主题台灯脉冲层（home-visual-spec §1.4，仅 home）：scrollFactor 0.6, depth -8，
   * 每帧 clear+重绘；核心圆 + 外扩柔光，α 呼吸（≤2Hz，防光敏）。灯架本体在 drawHomeBackground 的 mid 层静态绘制。
   * Reduce Motion 下相位冻结（静态圆 + 固定 α=0.85，无缩放/呼吸）。
   */
  private drawHomeLamp(): void {
    const g = this.homeLampGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelH = this.runtime.data.height * ts;
    const levelW = this.runtime.data.width * ts;
    g.clear();
    const LAMP = 0xffd23f; // 暖黄 #FFD23F（#4）
    if (!this.reduceMotion) this.homeLampPhase += STEP_DT * (2 * Math.PI * 1.2); // ≤2Hz
    const pulse = this.reduceMotion ? 0 : Math.sin(this.homeLampPhase);
    const baseR = 16;
    const r = baseR * (1 + pulse * 0.06);
    const coreA = this.reduceMotion ? 0.85 : 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(this.homeLampPhase));
    const cx = levelW * 0.4;
    const cy = levelH * 0.42 - 14; // 灯罩上方光晕中心
    g.fillStyle(LAMP, coreA * 0.4);
    g.fillCircle(cx, cy, r * 2.2); // 外扩柔光
    g.fillStyle(LAMP, coreA);
    g.fillCircle(cx, cy, r);
  }

  /**
   * 家主题前景窗帘层（home-visual-spec §1.5，仅 home）：scrollFactor 1.2, depth 4，
   * 每帧 clear+重绘；屏幕锚定斜飘带（相位门控约 30% 时间可见，克制遮挡 ≤10%），暖黄高光点。
   * Reduce Motion 下相位冻结（静态斜带，不再飘移）。
   */
  private drawHomeNear(): void {
    const g = this.homeNearGfx;
    if (!g) return;
    const cam = this.cameras.main;
    const camW = cam.width;
    const camH = cam.height;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    g.clear();
    const CURTAIN = 0xf2933c; // 暖橙 #F2933C（#3）
    const GOLD = 0xffd23f; // 暖黄 #FFD23F（#4）
    if (!this.reduceMotion) this.homeCurtainPhase += STEP_DT * 0.5;
    const vis = Math.sin(this.homeCurtainPhase * 0.2);
    if (vis <= 0.6) return; // 周期性透明（克制遮挡）
    const alpha = 0.25 + 0.15 * ((vis - 0.6) / 0.4);
    const baseY = camH * 0.7;
    const sway = (this.reduceMotion ? 0 : Math.sin(this.homeCurtainPhase)) * 20;
    const pts = [
      { x: camW * 0.1 + sway, y: baseY },
      { x: camW * 0.4 + sway, y: baseY - 18 },
      { x: camW * 0.7 + sway, y: baseY + 8 },
      { x: camW * 1.0 + sway, y: baseY - 12 },
      { x: camW * 1.0 + sway, y: baseY + 14 },
      { x: camW * 0.1 + sway, y: baseY + 22 },
    ];
    g.fillStyle(CURTAIN, alpha);
    g.beginPath();
    g.moveTo(pts[0].x + scrollX * 1.2, pts[0].y + scrollY * 1.2);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x + scrollX * 1.2, pts[i].y + scrollY * 1.2);
    g.closePath();
    g.fillPath();
    g.fillStyle(GOLD, 0.3);
    g.fillCircle(camW * 0.5 + sway + scrollX * 1.2, baseY + scrollY * 1.2, 2);
    g.fillCircle(camW * 0.8 + sway + scrollX * 1.2, baseY + 4 + scrollY * 1.2, 1.6);
  }

  /**
   * 街道主题背景层（GDD 1-6 / street-visual-spec §1，仅 street）：五层视差结构——
   *   ceilWall (scrollFactor 0,   depth -10) 天花板+后墙竖直渐变（rockBody #254060 → bg #408CAC）
   *   far      (scrollFactor 0.3, depth -9)  楼宇剪影 #2C486F + 窗光 #FFD23F（每帧重绘 drawStreetFar）
   *   mid      (scrollFactor 0.6, depth -8)  街灯 #F2933C + 霓虹 #6E7BF2/#FFD23F + 树 #7CC242（create-once）
   * 远景/中景绘制范围覆盖整关世界宽（runtime.data.width*tileSize）以支撑视差；
   * 中景辉光层(streetGlowGfx)与前景护栏层(streetNearGfx)为每帧重绘，此处仅创建 Graphics。
   * 全程序化 Graphics（零 PNG，ADR-004），颜色仅用 11 色锁色板或 tint 派生（楼宇 #2C486F 为
   * darken(#4A78C0,0.4) tint 派生、树暗部 0x3E6121 为 darken(#7CC242,0.5) tint 派生，0 新增 hex）。
   * draw call：ceil 1 + mid(街灯×3 + 霓虹×2 + 树×2)≈7，远景/辉光/护栏均每帧重绘（≤15 单 path）。
   */
  private drawStreetBackground(pal: ThemePalette): void {
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // 锁色板 / tint 派生（0 新增 hex）
    const WALL = pal.bg ?? 0x408cac; // 夜空蓝青 #408CAC（STREET bg，#）
    const CEIL = pal.rockBody; // 街影暗蓝 #254060（#6，天花板/暗带）
    const ROCK_FACE = pal.rockFace; // 建筑冷蓝 #304E7D（STREET rockFace）
    const OUT = pal.outline; // 描边 #2A1A12（#5）

    // ── 1) 天花板+后墙层（scrollFactor 0, depth -10）：竖直渐变 CEIL→WALL 全屏 ──
    if (!this.streetCeilWallGfx) this.streetCeilWallGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const cw = this.streetCeilWallGfx;
    cw.clear();
    cw.fillGradientStyle(CEIL, CEIL, WALL, WALL, 1);
    cw.fillRect(0, 0, camW, camH);
    // 天花板与墙交界加深线（强化顶/壁分界）
    cw.lineStyle(2, ROCK_FACE, 1);
    cw.lineBetween(0, camH * 0.16, camW, camH * 0.16);

    // ── 2) 远景 far（scrollFactor 0.3, depth -9）：楼宇剪影 + 窗光（每帧重绘 drawStreetFar）──
    if (!this.streetFarGfx) this.streetFarGfx = this.add.graphics().setScrollFactor(0.3).setDepth(-9);

    // ── 3) 中景 mid（scrollFactor 0.6, depth -8）：街灯 + 霓虹 + 树，create-once（仅 scrollFactor 驱动视差）──
    if (!this.streetMidGfx) this.streetMidGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    const mid = this.streetMidGfx;
    mid.clear();
    // 街灯 ×3（暖橙柱 + 梯形罩）
    const lamps = [
      { x: levelW * 0.2, y: levelH * 0.52 },
      { x: levelW * 0.5, y: levelH * 0.5 },
      { x: levelW * 0.82, y: levelH * 0.54 },
    ];
    for (const l of lamps) {
      mid.fillStyle(0xf2933c, 1); // 暖橙 #F2933C（#3）
      mid.fillRoundedRect(l.x - 2, l.y, 4, 26, 1);
      mid.fillPoints(
        [
          { x: l.x - 7, y: l.y - 2 },
          { x: l.x + 7, y: l.y - 2 },
          { x: l.x + 4, y: l.y - 12 },
          { x: l.x - 4, y: l.y - 12 },
        ],
        true,
      );
      mid.lineStyle(1, OUT, 1);
      mid.strokeRoundedRect(l.x - 2, l.y, 4, 26, 1);
    }
    // 霓虹 ×2（蓝紫竖牌 + 暖黄小牌）
    const neons = [
      { x: levelW * 0.36, y: levelH * 0.34 },
      { x: levelW * 0.68, y: levelH * 0.3 },
    ];
    for (const n of neons) {
      mid.fillStyle(0x6e7bf2, 0.9); // 蓝紫 #6E7BF2（#9，霓虹主）
      mid.fillRoundedRect(n.x - 4, n.y - 18, 8, 36, 3);
      mid.fillStyle(0xffd23f, 0.85); // 暖黄 #FFD23F（#4，霓虹副）
      mid.fillRoundedRect(n.x + 6, n.y - 10, 6, 20, 2);
    }
    // 树 ×2（草绿团 + 暗部，街道行道树）
    const trees = [
      { x: levelW * 0.1, y: levelH * 0.56 },
      { x: levelW * 0.9, y: levelH * 0.58 },
    ];
    for (const t of trees) {
      mid.fillStyle(0x7cc242, 1); // 草绿 #7CC242（#1）
      mid.fillCircle(t.x, t.y, 12);
      mid.fillCircle(t.x - 7, t.y + 4, 8);
      mid.fillCircle(t.x + 7, t.y + 4, 8);
      mid.fillStyle(0x3e6121, 1); // darken(#7CC242,0.5) 树暗部（tint 派生，0 新增）
      mid.fillCircle(t.x + 5, t.y + 3, 6);
      mid.lineStyle(1, OUT, 1);
      mid.strokeCircle(t.x, t.y, 12);
    }

    // ── 4) 中景辉光层（scrollFactor 0.6, depth -8）：每帧重绘（drawStreetGlow）──
    if (!this.streetGlowGfx) this.streetGlowGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    // ── 5) 前景护栏层（scrollFactor 1.2, depth 4）：每帧重绘（drawStreetNear）──
    if (!this.streetNearGfx) this.streetNearGfx = this.add.graphics().setScrollFactor(1.2).setDepth(4);
  }

  /**
   * 街道主题远景层（street-visual-spec §1.2，仅 street）：scrollFactor 0.3, depth -9，每帧 clear+重绘；
   * 楼宇剪影（#2C486F，darken(#4A78C0,0.4) tint 派生）+ 窗光（#FFD23F 小方块，α 随 streetWindowPhase
   * 闪烁 ≤2Hz，克制遮挡）。Reduce Motion 下相位冻结（窗光静态）。
   */
  private drawStreetFar(): void {
    const g = this.streetFarGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    g.clear();
    const BUILDING = 0x2c486f; // darken(#4A78C0,0.4) 远景楼宇剪影（tint 派生，0 新增）
    const WINDOW = 0xffd23f; // 暖黄 #FFD23F（#4，窗光）
    const baseY = levelH * 0.62;
    const buildings = [
      { x: levelW * 0.1, w: 70, h: levelH * 0.5 },
      { x: levelW * 0.3, w: 90, h: levelH * 0.62 },
      { x: levelW * 0.52, w: 60, h: levelH * 0.45 },
      { x: levelW * 0.68, w: 100, h: levelH * 0.66 },
      { x: levelW * 0.88, w: 80, h: levelH * 0.55 },
    ];
    // 楼宇剪影（无描边，低饱和氛围非碰撞）
    for (const b of buildings) {
      g.fillStyle(BUILDING, 1);
      g.fillRect(b.x, baseY - b.h, b.w, b.h);
    }
    // 窗光（暖黄小方块，α 随 streetWindowPhase 闪烁；伪随机相位错峰，克制）
    const wp = this.streetWindowPhase;
    let seed = 1;
    for (const b of buildings) {
      for (let wy = baseY - b.h + 8; wy < baseY - 6; wy += 12) {
        for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 12) {
          seed = (seed * 9301 + 49297) % 233280;
          const rnd = seed / 233280;
          const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(wp + rnd * Math.PI * 2));
          g.fillStyle(WINDOW, a);
          g.fillRect(wx, wy, 5, 6);
        }
      }
    }
  }

  /**
   * 街道主题中景辉光层（street-visual-spec §1.3，仅 street）：scrollFactor 0.6, depth -8，每帧 clear+重绘；
   * 街灯晕（#F2933C，≤2Hz 呼吸）+ 霓虹脉冲（#6E7BF2/#FFD23F，≤2Hz）。Reduce Motion 下相位冻结（静态）。
   */
  private drawStreetGlow(): void {
    const g = this.streetGlowGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    g.clear();
    // 街灯晕（暖橙，≤2Hz 呼吸）
    const lampXs = [levelW * 0.2, levelW * 0.5, levelW * 0.82];
    for (const lx of lampXs) {
      const ly = levelH * 0.52 - 12;
      const r = 16 * (1 + (this.reduceMotion ? 0 : Math.sin(this.streetLampPhase)) * 0.06);
      const coreA = this.reduceMotion ? 0.8 : 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(this.streetLampPhase));
      g.fillStyle(0xf2933c, coreA * 0.4);
      g.fillCircle(lx, ly, r * 1.8);
      g.fillStyle(0xf2933c, coreA);
      g.fillCircle(lx, ly, r * 0.7);
    }
    // 霓虹脉冲（蓝紫 + 暖黄，≤2Hz）
    const neons = [
      { x: levelW * 0.36, y: levelH * 0.34 },
      { x: levelW * 0.68, y: levelH * 0.3 },
    ];
    for (const n of neons) {
      const a = this.reduceMotion ? 0.7 : 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(this.streetNeonPhase));
      g.fillStyle(0x6e7bf2, a * 0.5);
      g.fillRoundedRect(n.x - 6, n.y - 20, 12, 40, 4);
      g.fillStyle(0xffd23f, a * 0.5);
      g.fillRoundedRect(n.x + 5, n.y - 12, 8, 24, 2);
    }
  }

  /**
   * 街道主题前景护栏层（street-visual-spec §1.5，仅 street）：scrollFactor 1.2, depth 4，每帧 clear+重绘；
   * 屏幕锚定横杆 + 立柱（环境冷蓝 #4A78C0）；相位门控约 30% 时间可见（sin(nearPhase*0.2)>0.6），克制遮挡。
   * Reduce Motion 下相位冻结（静态护栏，不再门控闪烁）。
   */
  private drawStreetNear(): void {
    const g = this.streetNearGfx;
    if (!g) return;
    const cam = this.cameras.main;
    const camW = cam.width;
    const camH = cam.height;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    g.clear();
    const RAIL = 0x4a78c0; // 环境冷蓝 #4A78C0（#10，护栏）
    if (this.reduceMotion) {
      // Reduce Motion：静态常显护栏（不门控闪烁）
      const baseY = camH * 0.82;
      g.lineStyle(2, RAIL, 0.4);
      g.lineBetween(0 + scrollX * 1.2, baseY + scrollY * 1.2, camW + scrollX * 1.2, baseY + scrollY * 1.2);
      g.lineStyle(2, RAIL, 0.3);
      g.lineBetween(0 + scrollX * 1.2, baseY - 10 + scrollY * 1.2, camW + scrollX * 1.2, baseY - 10 + scrollY * 1.2);
      for (let x = 0; x <= camW; x += 40) {
        g.lineBetween(x + scrollX * 1.2, baseY - 12 + scrollY * 1.2, x + scrollX * 1.2, baseY + 6 + scrollY * 1.2);
      }
      return;
    }
    const vis = Math.sin(this.streetNearPhase * 0.2);
    if (vis <= 0.6) return; // 周期性透明（克制）
    const alpha = 0.4 * ((vis - 0.6) / 0.4);
    const baseY = camH * 0.82;
    g.lineStyle(2, RAIL, alpha);
    g.lineBetween(0 + scrollX * 1.2, baseY + scrollY * 1.2, camW + scrollX * 1.2, baseY + scrollY * 1.2);
    g.lineStyle(2, RAIL, alpha * 0.7);
    g.lineBetween(0 + scrollX * 1.2, baseY - 10 + scrollY * 1.2, camW + scrollX * 1.2, baseY - 10 + scrollY * 1.2);
    for (let x = 0; x <= camW; x += 40) {
      g.lineBetween(x + scrollX * 1.2, baseY - 12 + scrollY * 1.2, x + scrollX * 1.2, baseY + 6 + scrollY * 1.2);
    }
  }

  /**
   * 办公主题背景层（GDD 1-7 / office-visual-spec §1，仅 office）：完整五层视差结构——
   *   wall (scrollFactor 0,   depth -10) 荧光天花板+后墙竖直渐变（CEIL→WALL），全屏一次
   *   far (scrollFactor 0.3, depth -9)  隔断剪影+窗光（每帧重绘 drawOfficeFar）
   *   mid (scrollFactor 0.6, depth -8)  办公桌+显示器+绿植+荧光灯架本体（create-once）
   *   glow(scrollFactor 0.6, depth -8)  荧光灯管微闪+屏光/窗光脉冲（每帧重绘 drawOfficeGlow）
   *   near(scrollFactor 1.2, depth 4)   隔断悬挑/电线（每帧重绘 drawOfficeNear）
   * 配色全部字面存在于 THEME_PALETTES['office'] 或锁色板/tint，0 新增 hex；禁用品红 #F26D8B。
   */
  private drawOfficeBackground(pal: ThemePalette): void {
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // 锁色板 / tint 派生（0 新增 hex）
    const WALL = pal.bg ?? 0x5bc8f5; // 天花板微光 #5BC8F5（OFFICE bg，#11）
    const CEIL = pal.rockBody; // 柜体暗面 #254060（#6，天花板带）
    const ROCK_FACE = pal.rockFace; // 办公桌/柜体主面 #4A78C0（#10）
    const OUT = pal.outline; // 描边 #2A1A12（#5）

    // ── 1) 天花板+后墙层（scrollFactor 0, depth -10）：竖直渐变 CEIL→WALL 全屏 ──
    if (!this.officeWallGfx) this.officeWallGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const cw = this.officeWallGfx;
    cw.clear();
    cw.fillGradientStyle(CEIL, CEIL, WALL, WALL, 1);
    cw.fillRect(0, 0, camW, camH);
    // 天花板与墙交界加深线（强化顶/壁分界）
    cw.lineStyle(2, ROCK_FACE, 1);
    cw.lineBetween(0, camH * 0.16, camW, camH * 0.16);

    // ── 2) 远景 far（scrollFactor 0.3, depth -9）：隔断剪影 + 窗光（每帧重绘 drawOfficeFar）──
    if (!this.officeFarGfx) this.officeFarGfx = this.add.graphics().setScrollFactor(0.3).setDepth(-9);

    // ── 3) 中景 mid（scrollFactor 0.6, depth -8）：办公桌 + 显示器 + 绿植 + 荧光灯架本体，create-once ──
    if (!this.officeMidGfx) this.officeMidGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    const mid = this.officeMidGfx;
    mid.clear();
    // 办公桌 ×2（冷蓝桌面 + 暗带）
    const desks = [
      { x: levelW * 0.18, y: levelH * 0.52 },
      { x: levelW * 0.74, y: levelH * 0.5 },
    ];
    for (const d of desks) {
      mid.fillStyle(ROCK_FACE, 1); // 桌面 #4A78C0（#10）
      mid.fillRoundedRect(d.x - 23, d.y, 46, 28, 3);
      mid.fillStyle(pal.rockBody, 1); // 暗带 #254060（#6）
      mid.fillRect(d.x - 23, d.y + 21, 46, 7);
      mid.lineStyle(1, OUT, 1);
      mid.strokeRoundedRect(d.x - 23, d.y, 46, 28, 3);
    }
    // 显示器 ×2（暖橙框 + 暗内屏）
    const monitors = [
      { x: levelW * 0.35, y: levelH * 0.48 },
      { x: levelW * 0.62, y: levelH * 0.46 },
    ];
    for (const m of monitors) {
      mid.fillStyle(0xf2933c, 1); // 暖橙 #F2933C（#3）框
      mid.fillRect(m.x - 13, m.y - 9, 26, 18);
      mid.fillStyle(OUT, 1); // 屏底 #2A1A12（#5）
      mid.fillRect(m.x - 10, m.y - 6, 20, 12);
      mid.lineStyle(1, OUT, 1);
      mid.strokeRect(m.x - 13, m.y - 9, 26, 18);
    }
    // 绿植 ×2（草绿团 + 阴影绿暗部）
    const plants = [
      { x: levelW * 0.5, y: levelH * 0.56 },
      { x: levelW * 0.9, y: levelH * 0.54 },
    ];
    for (const p of plants) {
      mid.fillStyle(0x7cc242, 1); // 草绿 #7CC242（#1）
      mid.fillCircle(p.x, p.y, 10);
      mid.fillCircle(p.x - 6, p.y + 3, 7);
      mid.fillCircle(p.x + 6, p.y + 3, 7);
      mid.fillStyle(0x5fa82f, 1); // 阴影绿 #5FA82F（VINE.rockBody 字面已有，0 新增）
      mid.fillCircle(p.x + 5, p.y + 2, 5);
      mid.lineStyle(1, OUT, 1);
      mid.strokeCircle(p.x, p.y, 10);
    }
    // 荧光灯架 ×1（冷蓝细杆 + 底座；灯管微闪见 glow 层）
    mid.fillStyle(ROCK_FACE, 1);
    mid.fillRect(levelW * 0.42 - 1, levelH * 0.18, 2, 18);
    mid.lineStyle(1, OUT, 1);
    mid.strokeRect(levelW * 0.42 - 1, levelH * 0.18, 2, 18);

    // ── 4) 中景辉光层（scrollFactor 0.6, depth -8）：每帧重绘（drawOfficeGlow）──
    if (!this.officeGlowGfx) this.officeGlowGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    // ── 5) 前景悬挑/电线层（scrollFactor 1.2, depth 4）：每帧重绘（drawOfficeNear）──
    if (!this.officeNearGfx) this.officeNearGfx = this.add.graphics().setScrollFactor(1.2).setDepth(4);
  }

  /**
   * 办公主题远景层（office-visual-spec §1.3，仅 office）：scrollFactor 0.3, depth -9，每帧 clear+重绘；
   * 隔断剪影带（#254060，无描边）+ 窗光（#5BC8F5 微光 + #F2933C 细框 + #FFD23F 光晕脉冲 ≤2Hz）。
   * Reduce Motion 下相位冻结（窗光静态）。
   */
  private drawOfficeFar(): void {
    const g = this.officeFarGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    g.clear();
    const PARTITION = 0x254060; // 隔断剪影 #254060（CAVE/SEA/STREET rockBody 字面已有，0 新增）
    const WIN = 0x5bc8f5; // 窗内微光 #5BC8F5（#11）
    // 隔断剪影带（无描边，低饱和氛围非碰撞）
    const baseY = levelH * 0.62;
    const partitions = [
      { x: levelW * 0.08, w: 80, h: levelH * 0.45 },
      { x: levelW * 0.3, w: 70, h: levelH * 0.55 },
      { x: levelW * 0.55, w: 90, h: levelH * 0.5 },
      { x: levelW * 0.78, w: 75, h: levelH * 0.58 },
    ];
    for (const p of partitions) {
      g.fillStyle(PARTITION, 1);
      g.fillRect(p.x, baseY - p.h, p.w, p.h);
    }
    // 窗光（暖橙细框 + 窗内微光 + 暖黄光晕脉冲）
    const wp = this.officeWindowPhase;
    const windows = [
      { x: levelW * 0.22, y: levelH * 0.3 },
      { x: levelW * 0.55, y: levelH * 0.32 },
      { x: levelW * 0.84, y: levelH * 0.3 },
    ];
    for (const w of windows) {
      const ww = 44;
      const wh = 56;
      g.lineStyle(1, 0xf2933c, 1); // 暖橙 #F2933C（#3）细框
      g.strokeRect(w.x - ww / 2, w.y - wh / 2, ww, wh);
      g.fillStyle(WIN, 0.5); // 窗内微光 #5BC8F5 α≤0.5
      g.fillRect(w.x - ww / 2 + 2, w.y - wh / 2 + 2, ww - 4, wh - 4);
      const glowA = this.reduceMotion ? 0.3 : 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(wp)); // ≤2Hz 光晕
      g.fillStyle(0xffd23f, glowA); // 暖黄 #FFD23F（#4）光晕
      g.fillRect(w.x - ww / 2 + 4, w.y - wh / 2 + 4, ww - 8, 6);
    }
  }

  /**
   * 办公主题中景辉光层（office-visual-spec §1.4，仅 office）：scrollFactor 0.6, depth -8，每帧 clear+重绘；
   * 荧光灯管微闪（#FFD23F，≤2Hz）+ 屏光脉冲（#6E7BF2/#FFD23F，≤2Hz）。Reduce Motion 下相位冻结（静态）。
   */
  private drawOfficeGlow(): void {
    const g = this.officeGlowGfx;
    if (!g) return;
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const levelH = this.runtime.data.height * ts;
    g.clear();
    // 荧光灯管微闪（暖黄，≤2Hz）
    const lampX = levelW * 0.42;
    const lampY = levelH * 0.18;
    const la = this.reduceMotion ? 0.9 : 0.7 + 0.2 * (0.5 + 0.5 * Math.sin(this.officeFluorescentPhase)); // ≤2Hz
    g.fillStyle(0xffd23f, la);
    g.fillRoundedRect(lampX - 12, lampY - 3, 24, 6, 2);
    // 屏光脉冲（蓝紫 + 暖黄，≤2Hz）
    const sp = this.officeScreenPhase;
    const monitors = [
      { x: levelW * 0.35, y: levelH * 0.48 },
      { x: levelW * 0.62, y: levelH * 0.46 },
    ];
    for (const m of monitors) {
      const a = this.reduceMotion ? 0.85 : 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(sp));
      g.fillStyle(0x6e7bf2, a); // 蓝紫 #6E7BF2（#9）屏光
      g.fillRect(m.x - 10, m.y - 6, 20, 12);
      g.fillStyle(0xffd23f, a * 0.5); // 暖黄 #FFD23F（#4）辅光
      g.fillRect(m.x - 8, m.y - 4, 16, 4);
    }
  }

  /**
   * 办公主题前景层（office-visual-spec §1.5，仅 office）：scrollFactor 1.2, depth 4，每帧 clear+重绘；
   * 偶尔隔断悬挑/电线掠过（环境冷蓝 #4A78C0 + 蓝紫 #6E7BF2 高光点）；门控约 30% 时间可见（sin(nearPhase*0.2)>0.6），克制遮挡。
   * Reduce Motion 下相位冻结（静态斜带，不再门控闪烁）。
   */
  private drawOfficeNear(): void {
    const g = this.officeNearGfx;
    if (!g) return;
    const cam = this.cameras.main;
    const camW = cam.width;
    const camH = cam.height;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    g.clear();
    const CABLE = 0x4a78c0; // 环境冷蓝 #4A78C0（#10，悬挑/电线）
    if (this.reduceMotion) {
      // Reduce Motion：静态常显斜带（不门控闪烁）
      const baseY = camH * 0.78;
      g.lineStyle(2, CABLE, 0.3);
      g.lineBetween(0 + scrollX * 1.2, baseY + scrollY * 1.2, camW + scrollX * 1.2, baseY - 30 + scrollY * 1.2);
      return;
    }
    const vis = Math.sin(this.officeNearPhase * 0.2);
    if (vis <= 0.6) return; // 周期性透明（克制）
    const alpha = 0.4 * ((vis - 0.6) / 0.4);
    const baseY = camH * 0.78;
    g.lineStyle(2, CABLE, alpha);
    g.lineBetween(0 + scrollX * 1.2, baseY + scrollY * 1.2, camW + scrollX * 1.2, baseY - 30 + scrollY * 1.2);
    // 蓝紫高光点（#6E7BF2，≤0.3 α）
    g.fillStyle(0x6e7bf2, alpha * 0.6);
    g.fillCircle(camW * 0.3 + scrollX * 1.2, baseY - 10 + scrollY * 1.2, 2);
    g.fillCircle(camW * 0.7 + scrollX * 1.2, baseY - 20 + scrollY * 1.2, 2);
  }

  /**
   * 草原主题背景层（仅 grass）：完整四层视差结构，全程序化 Graphics（零 PNG，ADR-004）——
   *   sky  (scrollFactor 0,   depth -10) 天空竖直渐变（SKY→SKY_LIGHT），全屏一次
   *   far  (scrollFactor 0.3, depth -9)  远山剪影 + 云朵 + 温室剪影，铺满 levelW
   *   mid  (scrollFactor 0.6, depth -8)  树 + 风车 + 花丛，铺满 levelW
   *   near (scrollFactor 1.2, depth 4)   前景草丛 + 漂浮花瓣（静态装饰，depth 4 克制遮挡）
   * 颜色全部来自 11 色锁色板或由其 tint 派生（SKY_LIGHT/CLOUD 为 lighten(#5BC8F5) 派生，0 新增 hex）。
   * 全部 create-once（静态，不进每帧 update，最低回归风险）。
   */
  private drawGrassBackground(pal: ThemePalette): void {
    const ts = this.world.tileSize;
    const levelW = this.runtime.data.width * ts;
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // 锁色板 / tint 派生（0 新增 hex）
    const SKY = 0x5bc8f5; // 天空 #5BC8F5（#11）
    const SKY_LIGHT = 0x9fdcf5; // lighten(#5BC8F5, ~0.4) 近地平线天光（tint 派生）
    const CLOUD = 0xeaf6fb; // lighten(#5BC8F5, ~0.75) 云朵（tint 派生）
    const HILL_FAR = 0x5fa82f; // 阴影绿 #5FA82F（#2）远山
    const HILL_NEAR = 0x7cc242; // 草绿 #7CC242（#1）近树/草丛
    const TRUNK = 0x79491e; // darken(#F2933C, 0.5) 树干（#3 派生）
    const FIRE = 0xf2933c; // 暖橙 #F2933C（#3）风车/花心点缀
    const GOLD = 0xf2c94c; // 经济金 #F2C94C（#8）花瓣/花心
    const OUTLINE = pal.outline; // 全局描边 #2A1A12

    // ── 1) 天空层（scrollFactor 0, depth -10）：竖直渐变 SKY→SKY_LIGHT，全屏一次 ──
    if (!this.grassSkyGfx) this.grassSkyGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const sky = this.grassSkyGfx;
    sky.clear();
    sky.fillGradientStyle(SKY, SKY, SKY_LIGHT, SKY_LIGHT, 1);
    sky.fillRect(0, 0, camW, camH);

    // ── 2) 远景 far（scrollFactor 0.3, depth -9）：远山 + 云 + 温室剪影，铺满 levelW ──
    if (!this.grassFarGfx) this.grassFarGfx = this.add.graphics().setScrollFactor(0.3).setDepth(-9);
    const far = this.grassFarGfx;
    far.clear();
    // 远山：3 座起伏剪影（无描边、低饱和绿）
    const hills = [
      { x: levelW * 0.18, y: camH * 0.72, w: 220, h: 90 },
      { x: levelW * 0.52, y: camH * 0.7, w: 280, h: 110 },
      { x: levelW * 0.85, y: camH * 0.74, w: 200, h: 80 },
    ];
    far.fillStyle(HILL_FAR, 1);
    for (const h of hills) {
      far.fillEllipse(h.x, h.y, h.w, h.h);
    }
    // 云朵：几簇椭圆（CLOUD），无描边
    const clouds = [
      { x: levelW * 0.1, y: camH * 0.18, s: 1.0 },
      { x: levelW * 0.4, y: camH * 0.12, s: 1.3 },
      { x: levelW * 0.7, y: camH * 0.22, s: 0.9 },
      { x: levelW * 0.92, y: camH * 0.15, s: 1.1 },
    ];
    far.fillStyle(CLOUD, 0.95);
    for (const c of clouds) {
      const r = 16 * c.s;
      far.fillCircle(c.x, c.y, r);
      far.fillCircle(c.x + r * 0.9, c.y + r * 0.2, r * 0.8);
      far.fillCircle(c.x - r * 0.9, c.y + r * 0.25, r * 0.7);
      far.fillCircle(c.x + r * 0.2, c.y - r * 0.6, r * 0.7);
    }
    // 温室剪影（pale 轮廓，位于中远处）：矩形 + 三角顶
    const gx = levelW * 0.62;
    const gy = camH * 0.6;
    const gw = 90;
    const gh = 56;
    far.fillStyle(CLOUD, 0.5);
    far.fillRect(gx, gy, gw, gh);
    far.fillTriangle(gx - 6, gy, gx + gw + 6, gy, gx + gw / 2, gy - 34);
    far.lineStyle(1, OUTLINE, 0.25);
    far.strokeRect(gx, gy, gw, gh);

    // ── 3) 中景 mid（scrollFactor 0.6, depth -8）：树 + 风车 + 花丛，铺满 levelW ──
    if (!this.grassMidGfx) this.grassMidGfx = this.add.graphics().setScrollFactor(0.6).setDepth(-8);
    const mid = this.grassMidGfx;
    mid.clear();
    // 树：树干 + 双层树冠
    const trees = [
      { x: levelW * 0.25, y: camH * 0.82, s: 1.0 },
      { x: levelW * 0.78, y: camH * 0.84, s: 1.2 },
    ];
    for (const t of trees) {
      const th = 40 * t.s;
      const tw = 8 * t.s;
      mid.fillStyle(TRUNK, 1);
      mid.fillRect(t.x - tw / 2, t.y - th, tw, th);
      mid.fillStyle(HILL_NEAR, 1);
      mid.fillCircle(t.x, t.y - th, 22 * t.s);
      mid.fillCircle(t.x - 16 * t.s, t.y - th + 8 * t.s, 16 * t.s);
      mid.fillCircle(t.x + 16 * t.s, t.y - th + 8 * t.s, 16 * t.s);
      mid.fillStyle(HILL_FAR, 0.6);
      mid.fillCircle(t.x, t.y - th - 6 * t.s, 14 * t.s);
    }
    // 风车：塔身 + 四叶（FIRE 描边 + CLOUD 叶面）
    const wx = levelW * 0.45;
    const wy = camH * 0.86;
    const wh = 64;
    mid.fillStyle(TRUNK, 1);
    mid.fillTriangle(wx - 9, wy, wx + 9, wy, wx, wy - wh);
    mid.lineStyle(1, OUTLINE, 1);
    mid.strokeTriangle(wx - 9, wy, wx + 9, wy, wx, wy - wh);
    const hubX = wx;
    const hubY = wy - wh;
    const bladeLen = 26;
    mid.fillStyle(CLOUD, 1);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      const tipX = hubX + Math.cos(a) * bladeLen;
      const tipY = hubY + Math.sin(a) * bladeLen;
      const px = hubX + Math.cos(a + 0.5) * bladeLen * 0.4;
      const py = hubY + Math.sin(a + 0.5) * bladeLen * 0.4;
      mid.fillTriangle(hubX, hubY, tipX, tipY, px, py);
    }
    mid.fillStyle(FIRE, 1);
    mid.fillCircle(hubX, hubY, 4);
    // 花丛（地面矮灌 + 花点）
    const bushes = [
      { x: levelW * 0.36, y: camH * 0.9 },
      { x: levelW * 0.6, y: camH * 0.92 },
      { x: levelW * 0.9, y: camH * 0.9 },
    ];
    for (const b of bushes) {
      mid.fillStyle(HILL_NEAR, 1);
      mid.fillCircle(b.x - 8, b.y, 9);
      mid.fillCircle(b.x + 8, b.y, 9);
      mid.fillCircle(b.x, b.y - 6, 11);
      mid.fillStyle(GOLD, 1);
      mid.fillCircle(b.x, b.y - 6, 3);
    }

    // ── 4) 前景 near（scrollFactor 1.2, depth 4）：草丛 + 漂浮花瓣（静态，克制遮挡）──
    if (!this.grassNearGfx) this.grassNearGfx = this.add.graphics().setScrollFactor(1.2).setDepth(4);
    const near = this.grassNearGfx;
    near.clear();
    // 前景草丛：沿底一排小三角（HILL_NEAR），仅装饰、不挡角色
    near.fillStyle(HILL_NEAR, 1);
    for (let x = 8; x < camW; x += 26) {
      near.fillTriangle(x, camH, x + 5, camH - 12, x + 10, camH);
      near.fillTriangle(x + 12, camH, x + 17, camH - 9, x + 22, camH);
    }
    // 漂浮花瓣（GOLD 小点），错落于中下区
    const petals = [
      { x: camW * 0.2, y: camH * 0.5 },
      { x: camW * 0.5, y: camH * 0.4 },
      { x: camW * 0.75, y: camH * 0.55 },
      { x: camW * 0.88, y: camH * 0.42 },
      { x: camW * 0.35, y: camH * 0.62 },
    ];
    near.fillStyle(GOLD, 0.85);
    for (const p of petals) near.fillCircle(p.x, p.y, 2.5);
  }

  /** 草原实心瓦片：地表草皮顶盖 + 红砖体；埋入地下者不描边（去 test 网格感）。 */
  private drawGrassSolid(
    g: Phaser.GameObjects.Graphics,
    X: number,
    Y: number,
    ts: number,
    pal: ThemePalette,
    surface: boolean,
    tx: number,
  ): void {
    const BRICK_FACE = 0xb54a3d; // darken(#E8483B, ~0.25) 砖红色，锁色板派生
    const BRICK_MORTAR = pal.outline;
    if (surface) {
      // 红砖体
      g.fillStyle(BRICK_FACE, 1);
      g.fillRect(X, Y + 8, ts, ts - 8);
      // 砖缝（横向 + 错开竖向）
      g.lineStyle(1, BRICK_MORTAR, 0.55);
      for (let by = Y + 8; by <= Y + ts; by += 8) {
        g.lineBetween(X, by, X + ts, by);
      }
      const xOffset = (tx % 2 === 0) ? 0 : 8;
      for (let bx = X + xOffset; bx <= X + ts; bx += 16) {
        g.lineBetween(bx, Y + 8, bx, Y + ts);
      }
      // 草皮顶盖
      g.fillStyle(0x7cc242, 1);
      g.fillRect(X, Y, ts, 9);
      // 草皮暗边 + 描边（仅顶面，避免整列网格）
      g.lineStyle(1, pal.outline, 1);
      g.strokeRect(X, Y, ts, 9);
      // 草叶小三角点缀
      g.fillStyle(0x5fa82f, 1);
      for (let i = 2; i < ts; i += 8) {
        g.fillTriangle(X + i, Y, X + i + 3, Y - 4, X + i + 6, Y);
      }
    } else {
      // 埋入地下：仅填红砖，不描边
      g.fillStyle(BRICK_FACE, 1);
      g.fillRect(X, Y, ts, ts);
    }
  }

  /** 草原单向平台：红砖平台 + 顶面草皮（蘑菇/木板风，统一世界观）。 */
  private drawGrassOneway(
    g: Phaser.GameObjects.Graphics,
    X: number,
    Y: number,
    ts: number,
    pal: ThemePalette,
    tx: number,
  ): void {
    const h = ts / 2;
    const BRICK_FACE = 0xb54a3d;
    const BRICK_MORTAR = pal.outline;
    // 红砖体
    g.fillStyle(BRICK_FACE, 1);
    g.fillRect(X, Y + 8, ts, h - 8);
    // 砖缝
    g.lineStyle(1, BRICK_MORTAR, 0.55);
    for (let by = Y + 8; by <= Y + h; by += 8) {
      g.lineBetween(X, by, X + ts, by);
    }
    const xOffset = (tx % 2 === 0) ? 0 : 8;
    for (let bx = X + xOffset; bx <= X + ts; bx += 16) {
      g.lineBetween(bx, Y + 8, bx, Y + h);
    }
    // 顶面草皮
    g.fillStyle(0x7cc242, 1);
    g.fillRect(X, Y, ts, 9);
    g.lineStyle(1, pal.outline, 1);
    g.strokeRect(X, Y, ts, h);
    // 小蘑菇点（GOLD 帽 + OUTLINE 点）装饰
    g.fillStyle(0xf2c94c, 1);
    g.fillCircle(X + ts / 2, Y + 4, 2.5);
  }

  private drawSprite(): void {
    const g = this.sprite;
    g.clear();
    drawLibaoPlaceholder(g, this.controller.state.facing);
  }

  /**
   * 输入路由（融合唯一模式，click-to-move-design.md §7.3）：
   * - 按钮浮层（TouchButtons）在 create() 已常驻创建——视觉 + 由 stepSim 的 syncDown(frame.down) 同步按下态。
   * - Web：把 Phaser pointerdown/move/up（逻辑坐标）转发到平台输入（融合层）的 PointerSink 方法，
   *   融合层内部按落点路由：命中按钮 → 按钮 press（simulateDown/Up），未命中 → GestureProvider 手势。
   *   通道在 pointerDown 时依落点决定并稳定到抬起（避免手势 pointer 泄漏）。
   * - 微信：skip Phaser pointer 注册。微信小游戏 + Scale.NONE + 原生上屏 canvas 下 Phaser pointer 坐标失真/不触发，
   *   坐标改由融合层经 wx.onTouch* + screenCanvas.click 统一绑一次后路由（见 fusion-input.ts）。
   */
  private setupPointerInput(): void {
    // 微信端：原生触屏/鼠标通道由融合层统一绑定路由，这里不注册 Phaser pointer，避免失真坐标干扰。
    if (this.platform.env === 'wechat') {
      console.log('[fusion] wechat: using native touch/click channel, skip Phaser pointer');
      return;
    }

    // Web 端：浏览器里 Phaser pointer 坐标正确（0–512 逻辑分辨率），转发到融合层 PointerSink。
    const sink = this.platform.input as unknown as PointerSink;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => sink.pointerDown(pointer.x, pointer.y, pointer.id));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => sink.pointerMove(pointer.x, pointer.y, pointer.id));
    this.input.on('pointerup',   (pointer: Phaser.Input.Pointer) => sink.pointerUp(pointer.x, pointer.y, pointer.id));
    console.log('[fusion] registered Phaser pointer (web only)');
  }

  update(time: number, delta: number): void {
    // Game Over / 暂停 / 已通关：冻结仿真（暂停遮罩/结算面板为独立 Phaser 对象，照常渲染）。
    // 暂停时 Phaser 输入系统仍派发 pointer 事件 → 暂停/结算按钮可点；仿真不推进（输入不丢）。
    if (this.gameOver || this.paused || this.levelComplete) return;

    // S04-4 连击窗口倒计时（帧 delta）；超时由 EconomyController 内部清零连击（comboMult→1）。
    this.economy.update(delta);

    // S04-5：连击窗超时（economy.update 内部清零）需反映到 HUD，否则 combo 指示会残留。
    // 仅在 mult 变化的那一帧发 ON_SCORE_CHANGED（事件触发式 redraw，非每帧重绘）；
    // prevComboMult 已随 emitScoreChange 同步，踩怪/币/死亡/重启的 emit 不会误触发此处。
    if (this.economy.state.comboMult !== this.prevComboMult) {
      this.prevComboMult = this.economy.state.comboMult;
      this.emitScoreChange();
    }

    if (this.loop) this.loop.update(delta);
    // C5 相机跟随：用玩家中心驱动 scroll（微信 CANVAS/NONE 下走内部 transform，非 CSS）
    if (this.camera) {
      this.camera.follow(this.body.x + this.body.w / 2, this.body.y + this.body.h / 2);
    }
    // 以栗宝屏幕位置为原点，把其屏幕逻辑坐标喂给手势输入：
    // 右上角(256+deadzone 外)→走、上方(deadzone 外)→跳、周围死区→停（见 click-to-move-design.md 最新拍板）。
    // virtual 布局的输入提供方无 setPlayerScreenPos，经平台转发为 no-op，安全跳过。
    const cam = this.cameras.main;
    const sx = (this.body.x + this.body.w / 2 - cam.scrollX) * cam.zoom;
    const sy = (this.body.y + this.body.h / 2 - cam.scrollY) * cam.zoom;
    this.platform.setPlayerScreenPos?.(sx, sy);

    // ── 受伤 juice 驱动（hud-spec §5.1–5.3，建议 loop 后）──
    let alpha = 1;
    if (this.respawnFadeTimer > 0) {
      // 重生淡入（200ms，0→1）；期间压制无敌闪烁（§5.3）。
      this.respawnFadeTimer -= delta;
      const t = Math.max(0, this.respawnFadeTimer) / RESPAWN_FADE_MS;
      alpha = 1 - t;
    } else if (this.damage.invincibleTimer > 0) {
      // 无敌闪烁 ~10Hz（明 50ms / 暗 50ms），永不彻底消失（§5.2，光敏安全）。
      alpha = Math.floor(time / 50) % 2 === 0 ? 1.0 : 0.4;
    }
    this.sprite.setAlpha(alpha);

    // 受击闪红覆盖（150ms，跟随 body 世界坐标，depth 11，§5.1）。
    const fg = this.flashGfx;
    if (fg) {
      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer -= delta;
        const a = 0.85 * Math.max(0, this.hitFlashTimer) / HIT_FLASH_MS;
        fg.clear();
        fg.fillStyle(0xe8483b, a);
        fg.fillRect(this.body.x, this.body.y, this.body.w, this.body.h);
      } else {
        fg.clear();
      }
    }

    // S04-1：每帧重绘敌人（位置由 stepSim 更新，世界坐标随相机偏移）。
    if (this.enemyGfx) {
      this.enemyGfx.clear();
      for (const e of this.enemies) drawEnemy(this.enemyGfx, e, this.reduceMotion);
    }

    // S04-2：每帧重绘弹丸（位置由 stepSim 积分，世界坐标随相机偏移）。
    if (this.projectileGfx) {
      this.projectileGfx.clear();
      for (const p of this.projectiles) drawProjectile(this.projectileGfx, p);
    }

    this.drawSprite();
    this.drawTopper();
    this.drawAura();
    // A3 潮汐水体叠层（仅 sea 关卡每帧重绘）
    if (this.runtime.data.metadata.theme === 'sea') {
      this.drawTideOverlay();
      this.drawSeaNear(); // 前景近景动态浪花/气泡（scrollFactor 1.2）
    }
    // A4 沙漠动态层（仅 desert 关卡每帧重绘）：太阳脉冲 + 前景沙幕 + 流沙叠层
    if (this.runtime.data.metadata.theme === 'desert') {
      this.drawDesertSun();
      this.drawDesertNear(); // 前景近景沙幕（scrollFactor 1.2）
      this.drawDesertHeat(); // 近地平线热浪蜃气（scrollFactor 0.4, depth -8.5）
      this.drawQuicksandOverlay(); // 流沙同心内陷漩涡（scrollFactor 1.0, depth 3）
    }
    // A5 家动态层（仅 home 关卡每帧重绘）：台灯脉冲 + 前景窗帘（scrollFactor 1.2）
    if (this.runtime.data.metadata.theme === 'home') {
      this.drawHomeLamp();
      this.drawHomeNear(); // 前景近景窗帘（scrollFactor 1.2）
    }
    // A6 街道动态层（仅 street 关卡每帧重绘）：窗光/街灯/霓虹/护栏相位累加（Reduce Motion 冻结）+ 远景窗光 + 中景辉光 + 前景护栏
    if (this.runtime.data.metadata.theme === 'street') {
      if (!this.reduceMotion) {
        this.streetWindowPhase += STEP_DT * (2 * Math.PI * 1.5); // ≤2Hz 窗光
        this.streetLampPhase += STEP_DT * (2 * Math.PI * 1.2); // ≤2Hz 街灯
        this.streetNeonPhase += STEP_DT * (2 * Math.PI * 2); // ≤2Hz 霓虹
        this.streetNearPhase += STEP_DT * 0.5; // 护栏门控
      }
      this.drawStreetFar(); // 远景窗光闪烁（scrollFactor 0.3）
      this.drawStreetGlow(); // 中景辉光（街灯晕 + 霓虹脉冲，scrollFactor 0.6）
      this.drawStreetNear(); // 前景护栏（scrollFactor 1.2）
    }
    // A7 办公动态层（仅 office 关卡每帧重绘）：荧光灯/屏光/窗光脉冲 + 前景悬挑相位累加（Reduce Motion 冻结）+ 远景隔断/窗光 + 中景辉光 + 前景悬挑
    if (this.runtime.data.metadata.theme === 'office') {
      if (!this.reduceMotion) {
        this.officeFluorescentPhase += STEP_DT * (2 * Math.PI * 1.5); // ≤2Hz 灯管微闪
        this.officeWindowPhase += STEP_DT * (2 * Math.PI * 1.5); // ≤2Hz 窗光脉冲
        this.officeScreenPhase += STEP_DT * (2 * Math.PI * 2); // ≤2Hz 屏光脉冲
        this.officeNearPhase += STEP_DT * 0.5; // 悬挑门控
      }
      this.drawOfficeFar(); // 远景隔断剪影 + 窗光（scrollFactor 0.3）
      this.drawOfficeGlow(); // 中景辉光（灯管微闪 + 屏光脉冲，scrollFactor 0.6）
      this.drawOfficeNear(); // 前景悬挑/电线（scrollFactor 1.2）
    }
    // A4 流沙视觉下沉：仅 sprite 偏移（不改碰撞盒），呈现「陷没沙底」；触底 respawn 后 qsZone=null → 归零
    if (this.qsZone && this.sprite) {
      const sinkOffset = quicksandVisualOffset(this.qsZone, this.qsSinkDepth);
      this.sprite.setPosition(Math.round(this.body.x), Math.round(this.body.y) + sinkOffset);
    }
  }
}
