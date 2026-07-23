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
  level1_1,
} from '../../core/config';
import { CharacterController } from '../../core/character/character-controller';
import { DamageStateMachine } from '../../core/damage/damage-state-machine';
import type { Body } from '../../core/physics/body';
import type { CollisionWorld } from '../../core/physics/collision';
import { LevelLoader } from '../../core/level/level-loader';
import type { RuntimeLevel } from '../../core/level/level-runtime';
import { EventBus, ON_LAND, ON_LEVEL_COMPLETE, ON_PAUSE, ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER, ON_RESTART, ON_COIN, ON_STOMP, ON_SCORE_CHANGED } from '../../core/events/event-bus';
import { FixedStep } from '../fixed-step';
import { drawLibaoPlaceholder } from '../../ui/placeholder';
import { Hud } from '../../ui/hud';
import { TouchButtons } from '../../ui/touch-buttons';
import { runStepSim } from '../scene-sync';
import { resolveHazardContact } from '../damage-resolution';
import { FollowCamera } from '../camera/follow-camera';
import { drawEnemy } from '../render/enemy-view';
import { drawCoin } from '../render/coin-view';
import { drawSeed } from '../render/seed-view';
import { drawCheckpoint } from '../render/checkpoint-view';
import { resolvePickups } from '../pickup-resolution';
import { EnemyAI, createEnemies } from '../../core/enemy/enemy-ai';
import { EconomyController } from '../../core/economy/economy';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, detectEnv } from '../../platform/detect';
import { createPlatform } from '../../platform';

const PLAYER_W = 24;
const PLAYER_H = 34;

// 受伤 juice 时长（hud-spec §5.1 / §5.3，来自规格、非命数/无敌时长/缩放，允许字面量）。
const HIT_FLASH_MS = 150; // 受击闪红（§5.1）
const RESPAWN_FADE_MS = 200; // 重生淡入（§5.3）

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
  private goal!: { x: number; y: number; w: number; h: number };
  private camera!: FollowCamera;
  private bus!: EventBus;
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

  // ── S04-4 经济 / 分数（core 零平台 API）──
  /** 经济控制器：踩怪/金币/通关计分 + 连击倍率（GDD 06）。 */
  private economy!: EconomyController;
  /** S04-4 economy 事件订阅 off 集合（shutdown 解绑）。 */
  private economyOffs: Array<() => void> = [];

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

    // 输入归一器（按平台选映射）
    this.abstraction = new InputAbstraction(
      this.platform.env === 'wechat' ? wechatInputConfig : webInputConfig,
    );

    // C5：用 LevelLoader 由真实关卡数据构建 CollisionWorld + 出生点 + 凯旋之门 AABB
    this.runtime = LevelLoader.load(level1_1);
    this.world = this.runtime.world;
    this.goal = this.runtime.goal;

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

    // 占位精灵（Graphics 运行时绘制，不依赖 PNG —— 见 art/placeholder-spec.md）
    this.sprite = this.add.graphics();
    this.sprite.setDepth(10); // 高于世界层（drawLevel 其后 add，hud-spec §8.3），避免被地形遮挡
    this.sprite.setPosition(Math.round(this.body.x), Math.round(this.body.y));
    this.drawSprite();

    // ── HUD + 受伤 juice 接线（hud-spec §8.4 / 实现合同）──
    // 受击闪红覆盖层（世界坐标跟随 body，depth = 栗宝+1，不进 HUD 层）。
    this.flashGfx = this.add.graphics().setDepth(11);
    // Hud 用 getter 读最新 damage：重生/重启会 new DamageStateMachine，避免读到过期实例（关键陷阱）。
    this.hud = new Hud(this, this.bus, () => this.damage, damageConfig.initialLives);
    this.hud.redraw(); // 初始绘制（3 实心心形 + FULL 形态）

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

    // 受伤 juice 计时（game-scene 自管，与 Hud 并存）：受击闪红 / 重生淡入。
    this.bus.on(ON_HURT, () => { this.hitFlashTimer = HIT_FLASH_MS; });
    this.bus.on(ON_RESPAWN, () => { this.respawnFadeTimer = RESPAWN_FADE_MS; });

    // Game Over：冻结 + 覆盖层 + 跨端重试触发（hud-spec §6.2）。
    this.bus.on(ON_GAME_OVER, () => this.onGameOver());

    // 场景 shutdown（若未来 scene.restart）清理订阅与 HUD（hud-spec §8.1，可选但稳妥）。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offRestart?.();
      this.offRestart = undefined;
      for (const off of this.economyOffs) off();
      this.economyOffs.length = 0;
      this.coinGfx?.destroy();
      this.seedGfx?.destroy();
      this.checkpointGfx?.destroy();
      this.hud.destroy();
    });

    // 真实关卡渲染（tile 世界坐标，相机滚动时自动偏移）
    // levelW/levelH 提前计算：供 drawLevel 诊断日志与相机跟随共用（纯顺序上移，无逻辑变更）。
    const levelW = this.runtime.data.width * this.runtime.data.tileSize;
    const levelH = this.runtime.data.height * this.runtime.data.tileSize;
    this.drawLevel();

    // S04-1：由关卡实体生成真实可踩敌人（替代 C3 占位刺栗），经同一 damage-resolution 管线解算。
    this.enemies = createEnemies(this.runtime.entities);
    this.enemyGfx = this.add.graphics().setDepth(9);

    // S04-3：由关卡实体生成 coin/seed/checkpoint 占位渲染 + 去重集合初始化。
    this.collectedCoins = new Set<number>();
    this.collectedSeeds = new Set<number>();
    this.coinGfx = this.add.graphics().setDepth(8);
    this.seedGfx = this.add.graphics().setDepth(8);
    this.checkpointGfx = this.add.graphics().setDepth(7);
    this.drawCoins();
    this.drawSeeds();
    this.drawCheckpoints();

    // 输入布局：结构性检测 input 是否为手势提供方（实现 PointerSink）→ gesture；否则 virtual 四钮。
    // 微信 ?buttons=1 / 配置 layout:"virtual" 回退四钮；gesture 为默认（见 click-to-move-design.md）。
    const isGesture = this.isGestureInput();
    if (!isGesture) {
      // virtual 布局：挂载旧四钮（命中 → simulatePress → touch:* → consume）。
      this.touchButtons = new TouchButtons(this);
    }
    this.setupPointerInput(isGesture);

    // C5 相机跟随：钳制到关卡边界（关宽 1280 > 逻辑宽 512），纵向不滚动
    this.camera = new FollowCamera(this.cameras.main, levelW, levelH);

    // 固定步长主循环（ADR-005）：step 内做仿真，渲染在每帧 update 后
    this.loop = new FixedStep((dt, simTimeMs) => this.stepSim(dt, simTimeMs), STEP_MS);
  }

  private stepSim(dt: number, simTimeMs: number): void {
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

    // 落地边沿 → 发 ON_LAND（juice/音频预留，C2）
    if (!res.prevGrounded && res.grounded) this.bus.emit(ON_LAND, {});

    this.lastGrounded = res.grounded;

    // S04-1：推进敌人 AI（表驱动；core 零平台，碰撞世界来自关卡 CollisionWorld）。
    for (const e of this.enemies) {
      if (!e.dead) e.update(dt, this.world);
    }

    // C3 伤害接触解算（重叠 + 无敌帧外 → hit + 击退 + 事件）
    this.resolveHazards();

    // C5 终点检测：body AABB 与凯旋之门 AABB 重叠 → ON_LEVEL_COMPLETE（无敌人也可达）
    this.resolveGoal();

    // S04-3：实体拾取 / 检查点解算（委托单一真实实现 resolvePickups）。
    this.resolvePickups();

    this.sprite.setPosition(Math.round(this.body.x), Math.round(this.body.y));
  }

  /**
   * C3 伤害接触解算（委托给共享纯函数，单一真实实现 → 集成测试即证据）。
   * 遍历全部存活敌人：命中 → 根据状态（踩踏 / 受伤）转换发对应事件，施加击退/反弹，设 hitstun；
   * 重生 → 用返回的新 controller 替换（spawn 处满血复位）。踩踏与受伤在同帧互斥。
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
   * ON_GAME_OVER 处理（hud-spec §6.2）：冻结 + 显示覆盖层 + 注册跨端重试触发。
   * 仿真已在 update 顶部因 gameOver 标志冻结；此处只负责覆盖层与输入。
   */
  private onGameOver(): void {
    this.gameOver = true;
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
   * ON_RESTART 处理（hud-spec §6.2）：干净 reset（重建 damage / body / controller，隐藏覆盖层，恢复仿真）。
   * 不调用 scene.restart，状态更可控（ADR：ON_RESTART 方案）。
   */
  private restartGame(): void {
    this.damage = new DamageStateMachine(damageConfig.initialLives, damageConfig);
    this.body = { x: this.respawnPoint.x, y: this.respawnPoint.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 };
    this.controller = new CharacterController(characterConfig, { x: this.respawnPoint.x, y: this.respawnPoint.y, grounded: true });
    this.lastGrounded = true;
    this.levelComplete = false;
    this.gameOver = false;
    this.hitstunTimer = 0;
    this.hitFlashTimer = 0;
    this.respawnFadeTimer = 0;
    // S04-3：重置拾取去重（与 economy 重置一致，使关卡实体可重新拾取），并重绘图层。
    this.collectedCoins.clear();
    this.collectedSeeds.clear();
    this.drawCoins();
    this.drawSeeds();
    this.drawCheckpoints();
    // S04-4：新一局分数/连击归零（HUD 字段经 ON_SCORE_CHANGED 同步归零，留 S04-5 绘制）。
    this.economy = new EconomyController(economyConfig);
    this.emitScoreChange();
    this.sprite.setAlpha(1);
    this.flashGfx?.clear();
    // 清理微信原生触摸监听（避免重复触发 ON_RESTART）。
    if (this.restartTouchHandler && typeof wx !== 'undefined' && wx.offTouchStart) {
      wx.offTouchStart(this.restartTouchHandler);
      this.restartTouchHandler = undefined;
    }
    this.hud.hideOverlay();
    this.hud.redraw();
  }

  /**
   * S04-4 经济变化广播：把当前 EconomyState 的 {score, coins, comboMult} 发 ON_SCORE_CHANGED。
   * 供 S04-5 HUD 订阅渲染；本 Story 仅确保数据流转正确。
   */
  private emitScoreChange(): void {
    const s = this.economy.state;
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
    const g = this.add.graphics();
    const ts = this.world.tileSize;
    for (let ty = 0; ty < this.runtime.data.height; ty++) {
      for (let tx = 0; tx < this.runtime.data.width; tx++) {
        if (this.world.isSolidTile(tx, ty)) {
          g.fillStyle(0x3a2a1f, 1);
          g.fillRect(tx * ts, ty * ts, ts, ts);
          g.lineStyle(1, 0x2a1a12, 1);
          g.strokeRect(tx * ts, ty * ts, ts, ts);
        } else if (this.world.isOneWayTile(tx, ty)) {
          g.fillStyle(0x6a5a3f, 1);
          g.fillRect(tx * ts, ty * ts, ts, ts / 2);
        }
      }
    }
    // 凯旋之门
    g.fillStyle(0xf2c94c, 1);
    g.fillRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);
    g.lineStyle(2, 0x2a1a12, 1);
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
    // Game Over：冻结仿真，仅保留已渲染画面与覆盖层；点击重试由 onGameOver 注册的触发器处理（hud-spec §6.2）。
    if (this.gameOver) return;

    // S04-4 连击窗口倒计时（帧 delta）；超时由 EconomyController 内部清零连击。
    this.economy.update(delta);

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

    this.drawSprite();
  }
}
