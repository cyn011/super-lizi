/**
 * tests/unit/platform/gesture-provider.test.ts — 点击/滑动手势输入（UX-CLICK-TO-MOVE）。
 *
 * 验证核心层零改动前提下的手势状态机：GestureProvider 产出与旧四钮完全一致的
 * touch:left/right/jump/action 信号，全部参数来自 GestureParams（对应 input-config.json）。
 *
 * 覆盖：左/右点走、死区停、上区跳、上划跳、双指暂停、松手停、280ms 自动停、
 * 300ms 满跳（含 CharacterController 集成验证满跳高度）、越中线换向。
 * 不依赖 Phaser / wx / DOM（纯 Node）。
 */
import { describe, it, expect } from 'vitest';
import type { RawInputFrame } from '../../../src/core/input/raw-input';
import { GestureProvider, type GestureParams } from '../../../src/platform/gesture-provider';
import { InputAbstraction } from '../../../src/core/input/input-abstraction';
import { CharacterController } from '../../../src/core/character/character-controller';
import { runStepSim, createFloorWorld } from '../../../src/game/scene-sync';
import { wechatInputConfig, characterConfig } from '../../../src/core/config';
import { STEP_MS, STEP_DT } from '../_step';

const PARAMS: GestureParams = {
  deadzone: 16,
  jumpZoneTop: 100,
  jumpSwipeSlope: 0.5,
  swipeMinDist: 16,
  walkSegmentMs: 280,
  jumpHoldMs: 300,
};

const LOGICAL_W = 512;
const LOGICAL_H = 288;
const LEFT_X = 100; // 左区 (< 232)
const RIGHT_X = 420; // 右区 (> 280)
const MID_X = 256; // 中线 / 死区
const JUMP_Y = 50; // 上区 (< 100)
const WALK_Y = 200; // 行走区 y

function makeProvider(): GestureProvider {
  return new GestureProvider(PARAMS, LOGICAL_W);
}

/** 推进一个固定步（仿真时钟 + 采样），返回该步帧。 */
function tick(p: GestureProvider): RawInputFrame {
  p.advance(STEP_MS);
  return p.sample();
}

/** 跑一次跳跃并测上升最大高度（px）。holdSteps 步后松手；≥循环上限则不松手（计时器保持）。 */
function jumpHeight(holdSteps: number): number {
  const world = createFloorWorld({ tileSize: 32, width: 40, height: 24, floorRow: 20 });
  const restY = 20 * 32 - 34; // 地板顶 - 角色高
  const body = { x: 100, y: restY, w: 24, h: 34, vx: 0, vy: 0 };
  const cc = new CharacterController(characterConfig, { x: body.x, y: body.y, grounded: true });
  const ia = new InputAbstraction(wechatInputConfig);
  const p = makeProvider();
  p.pointerDown(MID_X, JUMP_Y);

  const startY = body.y;
  let minY = body.y;
  let lg = true;
  for (let i = 0; i < 80; i++) {
    if (i === holdSteps) p.pointerUp(MID_X, JUMP_Y);
    p.advance(STEP_MS);
    const frame = p.sample();
    const input = ia.sample(frame, i * STEP_MS);
    const res = runStepSim({ body, controller: cc, world }, input, lg, STEP_DT);
    lg = res.grounded;
    if (body.y < minY) minY = body.y;
  }
  return startY - minY;
}

describe('GestureProvider — 屏幕分区与信号产出', () => {
  it('点左区 → held touch:left（pressed 边沿）', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y);
    const f = p.sample();
    expect(f.down.has('touch:left')).toBe(true);
    expect(f.pressedEdge.has('touch:left')).toBe(true);
  });

  it('点右区 → held touch:right', () => {
    const p = makeProvider();
    p.pointerDown(RIGHT_X, WALK_Y);
    const f = p.sample();
    expect(f.down.has('touch:right')).toBe(true);
    expect(f.pressedEdge.has('touch:right')).toBe(true);
  });

  it('点死区（中线） → 不产出任何移动信号（停）', () => {
    const p = makeProvider();
    p.pointerDown(MID_X, WALK_Y);
    const f = p.sample();
    expect(f.down.size).toBe(0);
    expect(f.pressedEdge.size).toBe(0);
  });

  it('点上区（y<100） → held touch:jump（pressed 边沿）', () => {
    const p = makeProvider();
    p.pointerDown(MID_X, JUMP_Y);
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.pressedEdge.has('touch:jump')).toBe(true);
  });
});

describe('GestureProvider — 以栗宝屏幕位置为原点的相对分区（最新拍板）', () => {
  it('setPlayerScreenPos(256,200) 后，点右(300,200) → 右走', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 200);
    p.pointerDown(300, 200);
    const f = p.sample();
    expect(f.down.has('touch:right')).toBe(true);
    expect(f.pressedEdge.has('touch:right')).toBe(true);
  });

  it('setPlayerScreenPos(256,200) 后，点左(212,200) → 左走', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 200);
    p.pointerDown(212, 200);
    const f = p.sample();
    expect(f.down.has('touch:left')).toBe(true);
    expect(f.pressedEdge.has('touch:left')).toBe(true);
  });

  it('setPlayerScreenPos(256,200) 后，点上方(256,160) → 跳', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 200);
    p.pointerDown(256, 160);
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.pressedEdge.has('touch:jump')).toBe(true);
  });

  it('setPlayerScreenPos(256,200) 后，斜向(300,160) → 又跳又右走（斜向优先跳）', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 200);
    p.pointerDown(300, 160);
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.down.has('touch:right')).toBe(true);
  });

  it('setPlayerScreenPos(256,200) 后，点原点(256,200) → 停', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 200);
    p.pointerDown(256, 200);
    const f = p.sample();
    expect(f.down.size).toBe(0);
    expect(f.pressedEdge.size).toBe(0);
  });

  it('setPlayerScreenPos(256,200) 后，点死区内(268,196) → 停', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 200);
    p.pointerDown(268, 196);
    const f = p.sample();
    expect(f.down.size).toBe(0);
    expect(f.pressedEdge.size).toBe(0);
  });
});

describe('GestureProvider — Hold 态（真机触屏：move+up）', () => {
  it('上划（点左后向上滑） → 跳，并释放原行走', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y); // 起始左走
    p.pointerMove(LEFT_X, JUMP_Y); // 竖直上滑：dx=0, dy=-150, dist=150
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.releasedEdge.has('touch:left')).toBe(true); // 行走被释放
    expect(f.down.has('touch:left')).toBe(false);
  });

  it('越过中线 → 行走方向实时换向（左→右）', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y);
    p.pointerMove(RIGHT_X, WALK_Y); // 大位移 → Hold 态；curX=420>280 → 右
    const f = p.sample();
    expect(f.down.has('touch:right')).toBe(true);
    expect(f.down.has('touch:left')).toBe(false);
    expect(f.pressedEdge.has('touch:right')).toBe(true);
    expect(f.releasedEdge.has('touch:left')).toBe(true);
  });

  it('松手 → 释放当前行走', () => {
    const p = makeProvider();
    p.pointerDown(RIGHT_X, WALK_Y);
    p.pointerUp(RIGHT_X, WALK_Y);
    const f = p.sample();
    expect(f.down.has('touch:right')).toBe(false);
    expect(f.releasedEdge.has('touch:right')).toBe(true);
  });
});

describe('GestureProvider — 拖动增强（跳跃中换向 / 地面跟手 / 死区防抖）', () => {
  // 死区半径 16，默认 playerX=256：左区 x<240，右区 x>272，死区 240<=x<=272。
  it('跳跃中拖动到左区 → 产出 touch:jump + touch:left（空中左移）', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(256, 90); // 栗宝上方死区外（dy=-54<-16）→ 跳（Tap 判跳，walkDir=null）
    p.pointerMove(200, 90); // 拖动到左区（200<240）→ 空中左移
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.down.has('touch:left')).toBe(true);
  });

  it('地面 Hold 拖动：起点在栗宝死区内（walkDir=null）也能在拖动到左区后触发 touch:left', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(256, 144); // 栗宝原点死区：walkDir=null，无信号
    p.pointerMove(200, 144); // 拖到左区
    const f = p.sample();
    expect(f.down.has('touch:left')).toBe(true);
  });

  it('地面 Hold 拖动：起点在栗宝死区内（walkDir=null）也能在拖动到右区后触发 touch:right', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(256, 144); // 栗宝原点死区：walkDir=null，无信号
    p.pointerMove(320, 144); // 拖到右区
    const f = p.sample();
    expect(f.down.has('touch:right')).toBe(true);
  });

  it('拖到死区边界不抖动（连续同方向 move 不重复 pressed）', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(100, 144); // 左区起点 → walking left（产生 pressed 边沿）
    p.sample(); // 消费初始 pressed 边沿
    p.pointerMove(220, 144); // 仍在左区（220<240）→ 保持 left，不重发
    p.pointerMove(235, 144); // 接近死区边界仍左区（235<240）→ 保持 left
    const f = p.sample();
    expect(f.down.has('touch:left')).toBe(true);
    expect(f.pressedEdge.has('touch:left')).toBe(false); // 无重复 pressed
  });

  it('拖入死区保持上一方向不抖动（不清除、不重复 pressed）', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(100, 144); // 左走
    p.sample();
    p.pointerMove(250, 144); // 死区内（|250-256|=6<=16）→ 保持 left，不清除
    p.pointerMove(230, 144); // 回到左区边界 → 仍 left
    const f = p.sample();
    expect(f.down.has('touch:left')).toBe(true); // 未被清除
    expect(f.releasedEdge.has('touch:left')).toBe(false);
    expect(f.pressedEdge.has('touch:left')).toBe(false);
  });

  it('松手时跳跃+行走同时释放（down 集合清空两者）', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(256, 90); // 上方 → 跳
    p.pointerMove(200, 90); // 拖到左区 → 左走（跳跃+行走同时）
    p.pointerUp(200, 90); // 松手：两者应一并释放
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(false);
    expect(f.down.has('touch:left')).toBe(false);
    expect(f.releasedEdge.has('touch:jump')).toBe(true);
    expect(f.releasedEdge.has('touch:left')).toBe(true);
  });

  it('上划跳后继续水平拖动 → 空中换向（jump 保持，walk 跟随）', () => {
    const p = makeProvider();
    p.setPlayerScreenPos(256, 144);
    p.pointerDown(256, 200); // 死区：无信号
    p.pointerMove(256, 50); // 上划 → 跳（swipe-jump）
    p.pointerMove(180, 200); // 水平拖到左区（dy=0）→ 空中左移
    const f = p.sample();
    expect(f.down.has('touch:jump')).toBe(true);
    expect(f.down.has('touch:left')).toBe(true);
  });
});

describe('GestureProvider — Tap 态（微信模拟器：仅 pointerdown）', () => {
  it('点左 → 持续 held，约 280ms 后自动 released（自停）', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y);
    let releasedAt = -1;
    for (let i = 0; i < 40; i++) {
      const f = tick(p);
      if (!f.down.has('touch:left')) {
        releasedAt = (i + 1) * STEP_MS;
        expect(f.releasedEdge.has('touch:left')).toBe(true);
        break;
      }
    }
    expect(releasedAt).toBeGreaterThan(260); // ≈ 280ms（步长粒度容忍）
    expect(releasedAt).toBeLessThan(300);
  });

  it('点上区 → jump 保持约 300ms 后自动 released（满跳保持）', () => {
    const p = makeProvider();
    p.pointerDown(MID_X, JUMP_Y);
    let releasedAt = -1;
    for (let i = 0; i < 40; i++) {
      const f = tick(p);
      if (!f.down.has('touch:jump')) {
        releasedAt = (i + 1) * STEP_MS;
        expect(f.releasedEdge.has('touch:jump')).toBe(true);
        break;
      }
    }
    expect(releasedAt).toBeGreaterThan(280); // ≥ 满跳上升 267ms
    expect(releasedAt).toBeLessThan(320);
  });

  it('满跳：点上区（jump 保持 300ms）→ 上升高度 ≈ 满跳 64px（2 瓦片）', () => {
    const h = jumpHeight(999); // 不松手，计时器保持 300ms
    expect(h).toBeGreaterThan(58);
    expect(h).toBeLessThan(70);
  });

  it('对照：当帧松手 → 短跳高度 ≈ 31px（1 瓦片），证明可区分满/短跳', () => {
    const h = jumpHeight(0); // 当帧松手（上升段最早）：vy 截断 → 短跳
    expect(h).toBeGreaterThan(26);
    expect(h).toBeLessThan(38);
  });
});

describe('GestureProvider — 双指暂停', () => {
  it('两枚 pointer 同时 down → 产出 touch:action（暂停），并清掉当前行走', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y); // 主指针：左走
    p.pointerDown(RIGHT_X, WALK_Y, 1); // 第二指
    const f = p.sample();
    expect(f.down.has('touch:action')).toBe(true);
    expect(f.pressedEdge.has('touch:action')).toBe(true);
    expect(f.down.has('touch:left')).toBe(false); // 移动被清
  });

  it('双指抬起 → 释放 touch:action', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y);
    p.pointerDown(RIGHT_X, WALK_Y, 1);
    p.pointerUp(LEFT_X, WALK_Y);
    p.pointerUp(RIGHT_X, WALK_Y, 1);
    const f = p.sample();
    expect(f.down.has('touch:action')).toBe(false);
    expect(f.releasedEdge.has('touch:action')).toBe(true);
  });
});

describe('GestureProvider — reset 清空状态', () => {
  it('reset() 后无任何 held 信号', () => {
    const p = makeProvider();
    p.pointerDown(LEFT_X, WALK_Y);
    p.reset();
    const f = p.sample();
    expect(f.down.size).toBe(0);
    expect(f.pressedEdge.size).toBe(0);
  });
});
