/**
 * game/scenes/sandbox-scene — E2.S5 手感沙盒（dev only，不写单测）。
 * 空房间跑真实固定步 + 角色控制器，浮层（Graphics/Text）实测 control-list §1 指标：
 *   当前 simTimeMs、上次跳跃顶点高度(px)、coyote/buffer 状态、二段跳计数。
 * 仅在 dev 可达：import.meta.env.DEV 守卫 + 控制台 __startSandbox() 启动独立游戏实例，
 * 不污染生产打包与现有 demo 流程（main.ts 不引用本文件）。
 */
import Phaser from 'phaser';
import { CharacterController } from '../../core/character/character-controller';
import {
  characterConfig,
  GRAVITY,
  MAX_FALL,
  TILE,
  STEP_MS,
} from '../../core/config';
import { FixedStep } from '../fixed-step';

const FLOOR_ROW = 7;
const GROUND_Y = FLOOR_ROW * TILE; // 地面顶（=224）
const SPAWN_X = 64;
const VIEW_W = 512;
const VIEW_H = 288;

export class SandboxScene extends Phaser.Scene {
  private controller!: CharacterController;
  private loop!: FixedStep;
  private gfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;

  // 实测指标
  private simTimeMs = 0;
  private lastApex = 0;
  private minY = 0;
  private doubleJumpCount = 0;
  private prevJump = false;

  constructor() {
    super('Sandbox');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#5BC8F5');

    this.controller = new CharacterController(characterConfig, {
      x: SPAWN_X,
      y: GROUND_Y - 34,
      grounded: true,
    });
    this.minY = this.controller.state.y;

    this.gfx = this.add.graphics();
    this.hud = this.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
    });

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.jumpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 真实固定步：采样 → consume → 简易重力积分/地面碰撞 → 渲染
    this.loop = new FixedStep((dt, t) => this.stepSim(dt, t), STEP_MS);
  }

  private stepSim(dt: number, simTimeMs: number): void {
    this.simTimeMs = simTimeMs;

    const jumpDown = this.jumpKey.isDown;
    const input = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      jumpPressed: jumpDown && !this.prevJump,
      jumpHeld: jumpDown,
      jumpReleased: !jumpDown && this.prevJump,
      actionPressed: false,
      actionHeld: false,
      actionReleased: false,
      jumpPressedAt: simTimeMs,
    };

    const prevVy = this.controller.state.vy;
    const prevAir = this.controller.state.airJumpsLeft;
    const wasGrounded = this.controller.state.grounded;
    const wasCoyote = this.controller.state.coyoteTimer > 0;

    this.controller.consume(input, dt);

    // 简易重力积分 + 地面碰撞（沙盒无真实关卡，仅做手感观测）
    const s = this.controller.state;
    const jumpFired = s.vy < prevVy - 1e-6; // 本步出现向上冲量（新跳跃）
    s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    const top = GROUND_Y - s.h;
    if (s.y >= top) {
      s.y = top;
      s.vy = 0;
      s.grounded = true;
    } else {
      s.grounded = false;
    }

    // 顶点高度追踪（落地后重置基线）
    if (jumpFired) this.minY = s.y;
    else this.minY = Math.min(this.minY, s.y);
    if (prevVy < 0 && s.vy >= 0) this.lastApex = GROUND_Y - this.minY; // 越过顶点

    // 二段跳计数
    if (s.airJumpsLeft < prevAir) this.doubleJumpCount++;
    else if (jumpFired && (wasGrounded || wasCoyote)) this.doubleJumpCount = 0;
    if (s.grounded) this.doubleJumpCount = 0;

    this.prevJump = jumpDown;
  }

  private drawHud(): void {
    const s = this.controller.state;
    const lines = [
      `simTime   : ${this.simTimeMs}ms`,
      `apex(px)  : ${this.lastApex.toFixed(1)}`,
      `coyote    : ${s.coyoteTimer.toFixed(0)}ms`,
      `buffer    : ${s.jumpBufferTimer.toFixed(0)}ms`,
      `airJumps  : ${s.airJumpsLeft}/${characterConfig.airJumps}`,
      `dblJumps  : ${this.doubleJumpCount}`,
      `grounded  : ${s.grounded}`,
      `vy        : ${s.vy.toFixed(0)}`,
    ];
    this.hud.setText(lines.join('\n'));
  }

  update(_time: number, delta: number): void {
    this.loop.update(delta);

    const s = this.controller.state;
    this.gfx.clear();
    // 地面
    this.gfx.fillStyle(0x3a2a1f, 1);
    this.gfx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
    // 角色（落地/空中变色）
    this.gfx.fillStyle(s.grounded ? 0xffd166 : 0xef476f, 1);
    this.gfx.fillRect(Math.round(s.x), Math.round(s.y), s.w, s.h);

    this.drawHud();
  }
}

// dev only：暴露控制台启动器，避免污染生产打包与现有 demo 流程。
const DEV = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;
if (DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__startSandbox = () => {
    let parent = document.getElementById('sandbox-root');
    if (!parent) {
      parent = document.createElement('div');
      parent.id = 'sandbox-root';
      document.body.appendChild(parent);
    }
    new Phaser.Game({
      type: Phaser.AUTO,
      width: VIEW_W,
      height: VIEW_H,
      pixelArt: true,
      parent,
      scene: [SandboxScene],
    });
  };
}
