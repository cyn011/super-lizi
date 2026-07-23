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
import { InputAbstraction } from '../../core/input/input-abstraction';
import {
  webInputConfig,
  wechatInputConfig,
  characterConfig,
  inputConfig,
  STEP_MS,
  level1_1,
} from '../../core/config';
import { CharacterController } from '../../core/character/character-controller';
import type { Body } from '../../core/physics/body';
import type { CollisionWorld } from '../../core/physics/collision';
import { LevelLoader } from '../../core/level/level-loader';
import type { RuntimeLevel } from '../../core/level/level-runtime';
import { EventBus, ON_LAND, ON_LEVEL_COMPLETE, ON_PAUSE } from '../../core/events/event-bus';
import { FixedStep } from '../fixed-step';
import { drawLibaoPlaceholder } from '../../ui/placeholder';
import { TouchButtons } from '../../ui/touch-buttons';
import { runStepSim } from '../scene-sync';
import { FollowCamera } from '../camera/follow-camera';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, detectEnv } from '../../platform/detect';
import { createPlatform } from '../../platform';

const PLAYER_W = 24;
const PLAYER_H = 34;

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
    this.body = { x: spawn.x, y: spawn.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 };
    this.controller = new CharacterController(characterConfig, {
      x: spawn.x,
      y: spawn.y,
      grounded: true,
    });

    // 占位精灵（Graphics 运行时绘制，不依赖 PNG —— 见 art/placeholder-spec.md）
    this.sprite = this.add.graphics();
    this.sprite.setPosition(Math.round(this.body.x), Math.round(this.body.y));
    this.drawSprite();

    // 真实关卡渲染（tile 世界坐标，相机滚动时自动偏移）
    // levelW/levelH 提前计算：供 drawLevel 诊断日志与相机跟随共用（纯顺序上移，无逻辑变更）。
    const levelW = this.runtime.data.width * this.runtime.data.tileSize;
    const levelH = this.runtime.data.height * this.runtime.data.tileSize;
    this.drawLevel();

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

    // C1 同步协议：controller.consume 输出真实驱动 body（含水平/跳跃/二段跳/coyote/buffer/短跳）
    const res = runStepSim(
      { body: this.body, controller: this.controller, world: this.world },
      input,
      this.lastGrounded,
      dt,
    );

    // 落地边沿 → 发 ON_LAND（juice/音频预留，C2）
    if (!res.prevGrounded && res.grounded) this.bus.emit(ON_LAND, {});

    this.lastGrounded = res.grounded;

    // C5 终点检测：body AABB 与凯旋之门 AABB 重叠 → ON_LEVEL_COMPLETE（无敌人也可达）
    this.resolveGoal();

    this.sprite.setPosition(Math.round(this.body.x), Math.round(this.body.y));
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

  update(_time: number, delta: number): void {
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
    this.drawSprite();
  }
}
