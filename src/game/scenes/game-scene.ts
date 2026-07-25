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
  inputConfig,
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
import type { RuntimeLevel } from '../../core/level/level-runtime';
import { EventBus, ON_LAND, ON_LEVEL_COMPLETE, ON_PAUSE, ON_RESUME, ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER, ON_RESTART, ON_COIN, ON_STOMP, ON_SCORE_CHANGED, ON_JUMP, ON_PROJECTILE_SPAWN, ON_BEAT, ON_NEXT_LEVEL, ON_SEED_COLLECTED, ON_SEED_GROWTH, ON_SEED_METAMORPHOSIS, ON_BOUNCE } from '../../core/events/event-bus';
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
import { resolveHazardContact } from '../damage-resolution';
import { FollowCamera } from '../camera/follow-camera';
import { RunStateMachineImpl, type RunStateMachine } from '../../core/state/run-state-machine';
import { RunLifecycle } from '../../core/state/run-lifecycle';
import { resolveActiveMenu } from '../../core/state/menu-tap';
// S05-4 薄音频总线：订阅事件总线 → platform.audio.play(name)；仅依赖 AudioPort 类型，不反向依赖平台实现。
import { AudioBus } from '../audio/audio-bus';
import { drawEnemy } from '../render/enemy-view';
import { biomeForLevel } from '../render/theme-palette';
import { drawProjectile } from '../render/projectile-view';
import { drawCoin } from '../render/coin-view';
import { drawSeed } from '../render/seed-view';
import { drawCheckpoint } from '../render/checkpoint-view';
import { resolvePickups } from '../pickup-resolution';
import { createSeedRuntime, accumulateOnCollect } from '../../core/seed/seed-runtime';
import { drawMaliTopper, playMetamorphAura, drawSeedAura } from '../render/mali-topper';
import type { Stage, SeedRuntimeState } from '../../core/seed/seed-types';
import { EnemyAI, createEnemies } from '../../core/enemy/enemy-ai';
import { Projectile } from '../../core/enemy/projectile';
import type { HazardSource } from '../../core/damage/hazard-source';
import { EconomyController } from '../../core/economy/economy';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, detectEnv } from '../../platform/detect';
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
  /** 关卡地形 Graphics（loadLevel 重建时先销毁旧实例，避免泄漏）。 */
  private levelGfx?: Phaser.GameObjects.Graphics;
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
    // S06：结算页「下一关」按钮 → 加载下一关（进度链闭环）。
    this.bus.on(ON_NEXT_LEVEL, () => {
      const n = nextLevelId(LEVEL_ORDER, this.currentLevelId);
      if (n) this.loadLevel(n);
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
    });

    // S04-3 去重集合初始化（关卡实体渲染在 loadLevel 内完成）。
    this.collectedCoins = new Set<number>();
    this.collectedSeeds = new Set<number>();

    // 输入布局：结构性检测 input 是否为手势提供方（实现 PointerSink）→ gesture；否则 virtual 四钮。
    // 微信 ?buttons=1 / 配置 layout:"virtual" 回退四钮；gesture 为默认（见 click-to-move-design.md）。
    const isGesture = this.isGestureInput();
    if (!isGesture) {
      // virtual 布局：挂载旧四钮（命中 → simulatePress → touch:* → consume）。
      this.touchButtons = new TouchButtons(this);
    }
    this.setupPointerInput(isGesture);

    // S06：按 currentLevelId 从注册表加载关卡（首关 1-1）；restart / 下一关复用同一路径。
    this.loadLevel(this.currentLevelId);

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

    // C3 伤害接触解算（重叠 + 无敌帧外 → hit + 击退 + 事件）
    this.resolveHazards();

    // C5 终点检测：body AABB 与凯旋之门 AABB 重叠 → ON_LEVEL_COMPLETE（无敌人也可达）
    this.resolveGoal();

    // S04-3：实体拾取 / 检查点解算（委托单一真实实现 resolvePickups）。
    this.resolvePickups();

    // S05-1 节拍门控：对齐 headless——每固定步只调一次 advanceBeat（内部 crossedBeat）。
    // 跨拍时先刷平台相位、再 emit ON_BEAT（让音频/juice 读到新相位）。
    // 禁用时 advanceBeat 直接返回 -1 不 emit；暂停/通关/GameOver 由顶部早退保证 simTimeMs 不推进 → 自然冻结。
    if (this.beatClock) {
      advanceBeat(this.beatClock, simTimeMs, this.bus, (idx) => this.beatSystem?.applyBeat(idx));
    }

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
    // S05-5：门开 → 屏蔽 gameplay 原生输入转发，原生点击改走菜单路由。
    this.platform.setMenuActive?.(true);
  }

  /** ON_RESUME 处理（S05-2）：RunState PAUSED→PLAYING，隐藏遮罩，恢复仿真。 */
  private onResume(): void {
    if (!this.runState.transition('PLAYING')) return;
    this.paused = false;
    this.pauseMenu?.hide();
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
    this.resultScreen?.show(result, this.elapsedMs, this.collectedCoins.size, totalCoins, hasNext);
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
    // S06：复用 loadLevel 重建「当前关」全部运行时状态（干净一局）。
    this.loadLevel(this.currentLevelId);
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
    // 背景层：仅非空 palette（洞穴暗蓝 #1C2E49）绘制；草原 bg=null 跳过，零回归。
    if (pal.bg !== null) {
      g.fillStyle(pal.bg, 1);
      g.fillRect(0, 0, this.runtime.data.width * ts, this.runtime.data.height * ts);
    }
    for (let ty = 0; ty < this.runtime.data.height; ty++) {
      for (let tx = 0; tx < this.runtime.data.width; tx++) {
        if (this.world.isSolidTile(tx, ty)) {
          g.fillStyle(pal.rockFace, 1);
          g.fillRect(tx * ts, ty * ts, ts, ts);
          g.lineStyle(1, pal.outline, 1);
          g.strokeRect(tx * ts, ty * ts, ts, ts);
        } else if (this.world.isOneWayTile(tx, ty)) {
          g.fillStyle(pal.rockBody, 1);
          g.fillRect(tx * ts, ty * ts, ts, ts / 2);
        }
      }
    }
    // 凯旋之门
    g.fillStyle(pal.crystalCore, 1);
    g.fillRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);
    g.lineStyle(2, pal.outline, 1);
    g.strokeRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);
  }

  private drawSprite(): void {
    const g = this.sprite;
    g.clear();
    drawLibaoPlaceholder(g, this.controller.state.facing);
  }

  /**
   * 输入路由（click-to-move-design.md §7.3）：
   * - gesture 布局：把 Phaser pointerdown/move/up（逻辑坐标）转发到平台输入提供方的 PointerSink 方法，
   *   由 GestureProvider 完成屏幕分区 / 双态判定，产出与原四钮完全一致的 touch:* 信号。
   *   微信模拟器鼠标模式只报 pointerdown（无 move/up）→ 自动走 Tap 段路径（点区域走/点上方跳）。
   * - virtual 布局：保留旧逻辑——命中四钮 → simulatePress → touch:*。
   */
  private setupPointerInput(isGesture: boolean): void {
    // virtual：命中四钮 → simulatePress（旧逻辑，保留）。gesture 默认布局时 isGesture=false 才走这里。
    if (!isGesture) {
      const b = inputConfig.wechat.buttons;
      const btns = [
        { id: 'touch:left' as const,  cx: b.left.x   * LOGICAL_WIDTH,  cy: b.left.y   * LOGICAL_HEIGHT, r: b.left.r   * LOGICAL_WIDTH },
        { id: 'touch:right' as const, cx: b.right.x  * LOGICAL_WIDTH,  cy: b.right.y  * LOGICAL_HEIGHT, r: b.right.r  * LOGICAL_WIDTH },
        { id: 'touch:jump' as const,  cx: b.jump.x   * LOGICAL_WIDTH,  cy: b.jump.y   * LOGICAL_HEIGHT, r: b.jump.r   * LOGICAL_WIDTH },
        { id: 'touch:action' as const,cx: b.action.x * LOGICAL_WIDTH,  cy: b.action.y * LOGICAL_HEIGHT, r: b.action.r * LOGICAL_WIDTH },
      ];
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        for (const btn of btns) {
          const dx = pointer.x - btn.cx;
          const dy = pointer.y - btn.cy;
          if (dx * dx + dy * dy <= btn.r * btn.r) {
            (this.platform.input as { simulatePress?: (id: string) => void }).simulatePress?.(btn.id);
            break;
          }
        }
      });
      return;
    }

    // gesture 布局：按平台分流坐标来源（根因修复）。
    // 微信小游戏 + Scale.NONE + 原生上屏 canvas 下，Phaser pointer 坐标失真（拿不到 DOM boundingRect）
    // 甚至不触发 → GestureProvider 收到恒在死区中心的坐标 → 永远判"停"。
    // 故微信端坐标改由平台层通过 wx.onTouch* + screenCanvas.click 喂给 GestureProvider，
    // 这里【不再注册】Phaser pointer，避免失真坐标干扰。
    if (this.platform.env === 'wechat') {
      console.log('[gesture] wechat: using native touch/click channel, skip Phaser pointer');
      return;
    }

    // Web 端：浏览器里 Phaser pointer 坐标正确（0-512 逻辑分辨率），保留转发到 PointerSink。
    const sink = this.platform.input as unknown as PointerSink;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => sink.pointerDown(pointer.x, pointer.y, pointer.id));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => sink.pointerMove(pointer.x, pointer.y, pointer.id));
    this.input.on('pointerup',   (pointer: Phaser.Input.Pointer) => sink.pointerUp(pointer.x, pointer.y, pointer.id));
    console.log('[gesture] registered Phaser pointer (web only)');
  }

  /** 结构性检测：平台输入是否手势提供方（实现 PointerSink）→ gesture，否则 virtual 四钮。 */
  private isGestureInput(): boolean {
    return typeof (this.platform.input as { pointerDown?: unknown }).pointerDown === 'function';
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
      for (const e of this.enemies) drawEnemy(this.enemyGfx, e);
    }

    // S04-2：每帧重绘弹丸（位置由 stepSim 积分，世界坐标随相机偏移）。
    if (this.projectileGfx) {
      this.projectileGfx.clear();
      for (const p of this.projectiles) drawProjectile(this.projectileGfx, p);
    }

    this.drawSprite();
    this.drawTopper();
    this.drawAura();
  }
}
