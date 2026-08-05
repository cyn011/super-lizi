/**
 * tests/unit/render/_fake-graphics — 渲染层测试用的 Phaser.Graphics 打桩记录器（零 Phaser 依赖）。
 *
 * game/render/*-view.ts 全部是「纯绘制指令流」函数（读 EnemyAI 几何 → 调 Graphics 方法），
 * 因此无需真跑 Phaser：用一个记录调用的 fake Graphics 收集 (method, args)，
 * 即可对「颜色序列 / 描边宽度 / 粒子数量」做逐值断言。
 *
 * 用途：
 *   1) 回归锁——非 zenith 主题的颜色序列与改动前逐值比对（golden master）。
 *   2) zenith 正向——断言新暗管 / 暗体换皮口径落地。
 *   3) 0 新增 hex——把捕获到的全部颜色值与锁色板白名单求差集。
 */
import type Phaser from 'phaser';
import type { EnemyAI } from '../../../src/core/enemy/enemy-ai';

/** 一条被记录的绘制调用。 */
export interface DrawCall {
  method: string;
  args: number[];
}

/** 记录型 fake Graphics：实现 *-view.ts 用到的全部方法，只记录不绘制。 */
export class FakeGraphics {
  readonly calls: DrawCall[] = [];

  private rec(method: string, args: unknown[]): this {
    // 只保留数值参数（圆角 radii 对象等非数值参数展平为其数值字段）。
    const flat: number[] = [];
    for (const a of args) {
      if (typeof a === 'number') flat.push(a);
      else if (a && typeof a === 'object') {
        for (const v of Object.values(a as Record<string, unknown>)) {
          if (typeof v === 'number') flat.push(v);
        }
      }
    }
    this.calls.push({ method, args: flat });
    return this;
  }

  fillStyle(...a: unknown[]): this { return this.rec('fillStyle', a); }
  lineStyle(...a: unknown[]): this { return this.rec('lineStyle', a); }
  fillRect(...a: unknown[]): this { return this.rec('fillRect', a); }
  strokeRect(...a: unknown[]): this { return this.rec('strokeRect', a); }
  fillRoundedRect(...a: unknown[]): this { return this.rec('fillRoundedRect', a); }
  strokeRoundedRect(...a: unknown[]): this { return this.rec('strokeRoundedRect', a); }
  fillCircle(...a: unknown[]): this { return this.rec('fillCircle', a); }
  strokeCircle(...a: unknown[]): this { return this.rec('strokeCircle', a); }
  fillTriangle(...a: unknown[]): this { return this.rec('fillTriangle', a); }
  strokeTriangle(...a: unknown[]): this { return this.rec('strokeTriangle', a); }
  fillEllipse(...a: unknown[]): this { return this.rec('fillEllipse', a); }
  strokeEllipse(...a: unknown[]): this { return this.rec('strokeEllipse', a); }
  fillPoints(...a: unknown[]): this { return this.rec('fillPoints', a); }
  strokePoints(...a: unknown[]): this { return this.rec('strokePoints', a); }
  lineBetween(...a: unknown[]): this { return this.rec('lineBetween', a); }
  beginPath(...a: unknown[]): this { return this.rec('beginPath', a); }
  moveTo(...a: unknown[]): this { return this.rec('moveTo', a); }
  lineTo(...a: unknown[]): this { return this.rec('lineTo', a); }
  strokePath(...a: unknown[]): this { return this.rec('strokePath', a); }
  clear(...a: unknown[]): this { return this.rec('clear', a); }

  /** 供 *-view.ts 消费的 Phaser.Graphics 视图（结构化 duck typing）。 */
  get g(): Phaser.GameObjects.Graphics {
    return this as unknown as Phaser.GameObjects.Graphics;
  }

  /** 按调用顺序抽取「颜色 + alpha」序列：fillStyle(color,alpha) / lineStyle(width,color,alpha)。 */
  styleSequence(): string[] {
    const out: string[] = [];
    for (const c of this.calls) {
      if (c.method === 'fillStyle') {
        out.push(`fill:${hex(c.args[0])}@${fmtA(c.args[1])}`);
      } else if (c.method === 'lineStyle') {
        out.push(`line:${c.args[0]}px:${hex(c.args[1])}@${fmtA(c.args[2])}`);
      }
    }
    return out;
  }

  /** 本次绘制用到的全部颜色值（去重，用于 0 新增 hex 断言）。 */
  colorsUsed(): number[] {
    const s = new Set<number>();
    for (const c of this.calls) {
      if (c.method === 'fillStyle') s.add(c.args[0]);
      else if (c.method === 'lineStyle') s.add(c.args[1]);
    }
    return [...s].sort((a, b) => a - b);
  }

  /** 某方法被调用的次数（如统计粒子 fillCircle 数）。 */
  countOf(method: string): number {
    return this.calls.filter((c) => c.method === method).length;
  }

  /** 某方法的全部调用（用于几何断言，如粒子是否落在暗管内）。 */
  callsOf(method: string): DrawCall[] {
    return this.calls.filter((c) => c.method === method);
  }
}

function hex(n: number | undefined): string {
  return n === undefined ? 'undef' : `0x${n.toString(16).padStart(6, '0')}`;
}
function fmtA(n: number | undefined): string {
  return n === undefined ? 'undef' : n.toFixed(3);
}

/** 构造一个鸭子类型的 EnemyAI 替身（render 只读取几何 + 少量相位 getter）。 */
export function fakeEnemy(over: Partial<Record<string, unknown>> = {}): EnemyAI {
  const base: Record<string, unknown> = {
    type: 'ci_li',
    dead: false,
    x: 100,
    y: 200,
    width: 32,
    height: 24,
    facing: 1,
    aim: { x: 1, y: 0 },
    flash: 0,
    guBaoPhaseState: 'ACTIVE',
    vinePhaseState: 'IDLE',
    vineProgress: 0,
    cyclonePhaseState: 1.0,
    cycloneInZone: false,
    floatPhase: 0.5,
    silTwist: 'none',
    silGhostState: 'SOLID',
    petBobPhaseState: 0.3,
    scorpionChargePhase: 0,
    scorpionCharging: false,
    vehicleDir: 1,
    headPhaseState: 0,
    vehiclePhaseOffset: 0,
    manholeCenterXState: 100,
    manholeAnchorYState: 200,
    manholeSteamHeightState: 40,
    manholePhaseState: 'IDLE',
    steamPhaseState: 0,
    coffeeRipplePhaseState: 0,
    ...over,
  };
  base.getBounds = () => ({
    x: base.x as number,
    y: base.y as number,
    w: base.width as number,
    h: base.height as number,
  });
  return base as unknown as EnemyAI;
}
