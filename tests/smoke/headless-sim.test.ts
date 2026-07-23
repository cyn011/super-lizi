/**
 * tests/smoke/headless-sim.test.ts — 无头确定性仿真冒烟（testing.md §5 / S06-1 门禁）。
 *
 * 不依赖 Phaser / WebGL / canvas：createHeadlessSim() 仅编排 core 模块，Node 环境可跑。
 * 若 src/core/sim/headless.ts 不存在则本测试无法 import（脚手架缺失）；本任务确认其缺失并已新建。
 *
 * 三个约定断言：
 *   ① 同输入序列 → 确定性可复现（同 finalHash + 同 events，双端等价证据）
 *   ② 无异常、状态有界（角色不穿地、不飞出世界）
 *   ③ beat.enabled=false 时不触发任何节拍机制（GDD10）
 * 外加 ④ 证明门控是真实开关（enabled=true 时确实跨拍），避免「恒 0」假阴性。
 */
import { describe, it, expect } from 'vitest';
import { createHeadlessSim } from '../../src/core/sim/headless';
import { SCRIPTED_INPUTS } from '../fixtures/scripted-inputs';

describe('Headless 仿真冒烟 (不依赖 Phaser/WebGL, testing.md §5)', () => {
  it('同输入序列 → 确定性可复现（双端等价证据）', () => {
    const a = createHeadlessSim().run(SCRIPTED_INPUTS, 600);
    const b = createHeadlessSim().run(SCRIPTED_INPUTS, 600);
    expect(a.crashed).toBe(false);
    expect(a.finalHash).toEqual(b.finalHash); // 逐位一致
    expect(a.events).toEqual(b.events);
  });

  it('无异常、状态有界（角色不穿地 / 不飞出世界）', () => {
    const r = createHeadlessSim().run(SCRIPTED_INPUTS, 600);
    expect(r.crashed).toBe(false);
    // y 有界：0 ≤ y < 关卡像素高（9*32=288）
    expect(r.finalState.character.y).toBeGreaterThanOrEqual(0);
    expect(r.finalState.character.y).toBeLessThan(9 * 32);
    // x 有界：0 ≤ x < 关卡像素宽（40*32=1280）
    expect(r.finalState.character.x).toBeGreaterThanOrEqual(0);
    expect(r.finalState.character.x).toBeLessThan(40 * 32);
  });

  it('beat.enabled=false 时不触发任何节拍机制（GDD10）', () => {
    const r = createHeadlessSim({ beatEnabled: false }).run(SCRIPTED_INPUTS, 600);
    expect(r.beatEvents).toBe(0);
    expect(r.events.filter((e) => e === 'ON_BEAT')).toEqual([]);
  });

  it('beat.enabled=true 时确实跨拍（证明门控是真实开关，非恒 0 假阴性）', () => {
    const r = createHeadlessSim({ beatEnabled: true }).run(SCRIPTED_INPUTS, 600);
    expect(r.beatEvents).toBeGreaterThan(0);
  });
});
