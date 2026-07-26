/**
 * E2.S3 角色控制器手感（GDD 03 / control-list §1）。
 * 将需求验收点转为确定性单测：coyote / jump buffer / 二段跳 / 短跳 / 水平加速·摩擦 / 踩踏。
 * 纯 Node，零 Phaser / 零平台；阈值全部从 characterConfig 读取，禁止硬编码魔法数。
 *
 * 测试约定：consume 不读碰撞，grounded 由测试手动写回
 * （state.grounded=false 表示离地、true 表示落地；无物理、无自动 grounded）。
 * STEP_DT 从 ../_step 导入（= STEP_MS/1000）。
 */
import { describe, it, expect } from 'vitest';
import { CharacterController } from '../../../src/core/character/character-controller';
import type { InputState } from '../../../src/core/input/input-abstraction';
import { characterConfig } from '../../../src/core/config';
import { STEP_MS } from '../_step';

/** 固定步长（秒），由 _step 的 STEP_MS 推导，与 core 单一真理源一致。 */
const STEP_DT = STEP_MS / 1000;

/** 构造最小 InputState（未列出的字段默认 false/0）。 */
function mkInput(over: Partial<InputState> = {}): InputState {
  return {
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
    ...over,
  };
}

describe('E2.S3 角色控制器手感 (GDD 03 / control-list §1)', () => {
  it('coyote 有效：离地 ≤100ms 内按跳 → vy<0（满速土狼跳）', () => {
    const cc = new CharacterController();
    cc.state.grounded = false;
    cc.state.coyoteTimer = characterConfig.coyoteMs; // 刚离地，满土狼窗口
    cc.state.airJumpsLeft = 0; // 隔离：有跳必是土狼跳
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT);
    expect(cc.state.vy).toBeLessThan(0);
  });

  it('coyote 有效（部分衰减）：coyoteTimer>0 时按跳 → vy=jumpVelocity', () => {
    const cc = new CharacterController();
    cc.state.grounded = false;
    cc.state.coyoteTimer = characterConfig.coyoteMs / 2; // 离地约半窗口，仍 >0
    cc.state.airJumpsLeft = 0;
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT);
    expect(cc.state.vy).toBeCloseTo(characterConfig.jumpVelocity, 5);
  });

  it('coyote 过期：离地 >100ms 且 airJumpsLeft=0 时按跳 → vy>=0（无跳）', () => {
    const cc = new CharacterController();
    cc.state.grounded = false;
    cc.state.coyoteTimer = characterConfig.coyoteMs;
    cc.state.airJumpsLeft = 0;
    // 离地若干步，土狼窗口耗尽（>100ms；coyoteMs=100，每步 -STEP_MS≈16.67）
    for (let i = 0; i < 7; i++) cc.consume(mkInput(), STEP_DT);
    expect(cc.state.coyoteTimer).toBe(0);
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT);
    expect(cc.state.vy).toBeGreaterThanOrEqual(0);
    expect(cc.state.airJumpsLeft).toBe(0);
  });

  it('jump buffer：落地前 ≤120ms 按跳，落地后即刻起跳 → vy=jumpVelocity', () => {
    const cc = new CharacterController();
    cc.state.grounded = false;
    cc.state.coyoteTimer = 0;
    cc.state.airJumpsLeft = 0; // 隔离：落地后才起跳
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT); // buffer=jumpBufferMs(120)
    // 空中保持（不按），buffer 衰减但仍 >0（≤120ms）
    for (let i = 0; i < 5; i++) cc.consume(mkInput({ jumpHeld: true }), STEP_DT);
    expect(cc.state.jumpBufferTimer).toBeGreaterThan(0);
    // 落地
    cc.state.grounded = true;
    cc.consume(mkInput({ jumpHeld: true }), STEP_DT);
    expect(cc.state.vy).toBeLessThan(0);
    expect(cc.state.vy).toBeCloseTo(characterConfig.jumpVelocity, 5);
  });

  it('jump buffer 过期：>120ms 才落地则不触发跳跃 → vy>=0', () => {
    const cc = new CharacterController();
    cc.state.grounded = false;
    cc.state.coyoteTimer = 0;
    cc.state.airJumpsLeft = 0;
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT);
    for (let i = 0; i < 8; i++) cc.consume(mkInput({ jumpHeld: true }), STEP_DT);
    expect(cc.state.jumpBufferTimer).toBe(0);
    cc.state.grounded = true;
    cc.consume(mkInput({ jumpHeld: true }), STEP_DT);
    expect(cc.state.vy).toBeGreaterThanOrEqual(0);
  });

  it('二段跳：空中 1 次（airJumpsLeft 1→0），再按无效；落地重置 airJumpsLeft', () => {
    const cc = new CharacterController();
    cc.state.grounded = false;
    cc.state.coyoteTimer = 0; // 无土狼
    cc.state.airJumpsLeft = characterConfig.airJumps; // 1
    // 第一次空中跳
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT);
    expect(cc.state.vy).toBeLessThan(0);
    expect(cc.state.vy).toBeCloseTo(characterConfig.jumpVelocity * characterConfig.doubleJumpScale, 5);
    expect(cc.state.airJumpsLeft).toBe(0);
    // 第二次空中跳（无效）
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: true }), STEP_DT);
    expect(cc.state.airJumpsLeft).toBe(0);
    // 落地重置（清空缓冲，隔离「落地重置 airJumps」与「落地触发缓冲跳」）
    cc.state.jumpBufferTimer = 0;
    cc.state.grounded = true;
    cc.consume(mkInput(), STEP_DT);
    expect(cc.state.airJumpsLeft).toBe(characterConfig.airJumps);
  });

  it('短跳：松键后高度 ≈ 全跳 45~55%（shortHopCut 推导）', () => {
    // 控制器直接产出截断速度：vy = jumpVelocity * shortHopCut
    const cc = new CharacterController();
    cc.state.grounded = true;
    cc.state.airJumpsLeft = 0;
    cc.consume(mkInput({ jumpPressed: true, jumpHeld: false, jumpReleased: true }), STEP_DT);
    expect(cc.state.vy).toBeCloseTo(characterConfig.jumpVelocity * characterConfig.shortHopCut, 5);

    // 解析推导：高度 ∝ v²。全跳 H = jumpVelocity²/(2*gravity)；短跳=(jumpVelocity*shortHopCut)²/(2*gravity)。
    // 二者之比 = shortHopCut² = 0.49，落入 45~55%。
    const g = characterConfig.gravity;
    const fullH = (characterConfig.jumpVelocity * characterConfig.jumpVelocity) / (2 * g);
    const shortH = (characterConfig.jumpVelocity * characterConfig.shortHopCut) ** 2 / (2 * g);
    const ratio = shortH / fullH;
    expect(fullH).toBeCloseTo(64, 1); // 480²/(2*1800)=64px（验证公式来源）
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
    expect(ratio).toBeCloseTo(characterConfig.shortHopCut ** 2, 5); // 0.49

    // 交叉验证：离散欧拉积分模拟跳跃弧线，短跳/全跳高度比同样落入区间
    const simApex = (shortHop: boolean): number => {
      const c = new CharacterController();
      c.state.grounded = true;
      c.state.airJumpsLeft = 0;
      c.consume(
        mkInput(
          shortHop
            ? { jumpPressed: true, jumpHeld: false, jumpReleased: true }
            : { jumpPressed: true, jumpHeld: true },
        ),
        STEP_DT,
      );
      let y = 0;
      let vy = c.state.vy;
      let minY = 0;
      while (vy < 0) {
        vy += g * STEP_DT;
        y += vy * STEP_DT;
        if (y < minY) minY = y;
      }
      return -minY;
    };
    const simRatio = simApex(true) / simApex(false);
    expect(simRatio).toBeGreaterThanOrEqual(0.45);
    expect(simRatio).toBeLessThanOrEqual(0.55);
  });

  it('水平加速：0→满速耗时 ≤0.2s', () => {
    const cc = new CharacterController();
    cc.state.grounded = true;
    cc.state.vx = 0;
    let steps = 0;
    while (cc.state.vx < characterConfig.moveSpeed - 1e-6 && steps < 100) {
      cc.consume(mkInput({ right: true }), STEP_DT);
      steps++;
    }
    expect(cc.state.vx).toBeCloseTo(characterConfig.moveSpeed, 5);
    expect(steps * STEP_DT).toBeLessThanOrEqual(0.2);
  });

  it('松键→停：≤0.15s 内减到 0（不可越过 0）', () => {
    const cc = new CharacterController();
    cc.state.grounded = true;
    cc.state.vx = characterConfig.moveSpeed;
    let steps = 0;
    while (cc.state.vx > 1e-6 && steps < 100) {
      cc.consume(mkInput(), STEP_DT);
      steps++;
    }
    expect(cc.state.vx).toBe(0);
    expect(steps * STEP_DT).toBeLessThanOrEqual(0.15);
  });

  it('踩踏：applyStomp → vy === stompBounce(-300)', () => {
    const cc = new CharacterController();
    cc.state.vy = 0;
    cc.applyStomp();
    expect(cc.state.vy).toBe(characterConfig.stompBounce);
  });
});
