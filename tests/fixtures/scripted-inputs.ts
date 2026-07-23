/**
 * tests/fixtures/scripted-inputs — headless 仿真用的确定性脚本输入（testing.md §5）。
 *
 * 不进入 vitest 测试集（仅 tests 下以 .test.ts 结尾的文件被 include）。导出固定长度
 * SCRIPTED_INPUTS 与可生成任意长度的 buildScriptedInputs()，供 tests/smoke/headless-sim.test.ts 复用。
 *
 * 序列设计（确定性、无随机数）：全程按住右行（ArrowRight），在固定步触发 5 次跳跃边沿
 * （短按 → 短跳），用于驱动角色在真实关卡碰撞世界里移动、离地/落地、抵达凯旋之门。
 * 同序列喂两次必须产出逐位一致的最终哈希（双端等价证据）。
 */
import type { RawInputFrame } from '../../src/core/input/raw-input';
import { emptyFrame } from '../../src/core/input/raw-input';

/** 在以下步触发一次「按下→下一帧松开」的跳跃（短跳，确定性）。 */
const JUMP_STEPS = [20, 120, 220, 320, 420];

/** 生成 steps 帧的脚本输入：全程右行 + 固定步跳跃边沿。 */
export function buildScriptedInputs(steps: number): RawInputFrame[] {
  const frames: RawInputFrame[] = [];
  for (let i = 0; i < steps; i++) {
    const down = new Set<string>(['ArrowRight']);
    const pressedEdge = new Set<string>();
    const releasedEdge = new Set<string>();
    if (JUMP_STEPS.includes(i)) {
      down.add('Space');
      pressedEdge.add('Space');
    } else if (JUMP_STEPS.includes(i - 1)) {
      // 上一帧按下的键本帧松开（形成一次性短按）
      releasedEdge.add('Space');
    }
    frames.push({ down, pressedEdge, releasedEdge });
  }
  return frames;
}

/** 默认固定序列（600 步），与 testing.md §5 的 run(SCRIPTED_INPUTS, 600) 对齐。 */
export const SCRIPTED_INPUTS: RawInputFrame[] = buildScriptedInputs(600);

/** 空帧导出（fixture 自检用，避免与 src 重复耦合）。 */
export const EMPTY_FRAME: RawInputFrame = emptyFrame();
