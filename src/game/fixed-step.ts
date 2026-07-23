/**
 * game/fixed-step — 固定步长累加器（ADR-005）。
 * 渲染帧 delta 累积，按 STEP_MS 切片驱动仿真；仿真时钟 simTimeMs 仅在此累加。
 * 单步 dt 恒为 1/60，真实帧 delta 上限钳制（≤250ms）防螺旋死亡。
 */

export type StepFn = (dt: number, simTimeMs: number) => void;

export class FixedStep {
  private accumulator = 0;
  private simTimeMs = 0;
  private readonly stepMs: number;
  private readonly maxFrameMs: number;
  private readonly step: StepFn;

  constructor(step: StepFn, stepMs = 1000 / 60, maxFrameMs = 250) {
    this.step = step;
    this.stepMs = stepMs;
    this.maxFrameMs = maxFrameMs;
  }

  /** 每个渲染帧调用，realDeltaMs 为真实帧间隔。 */
  update(realDeltaMs: number): void {
    this.accumulator += Math.min(realDeltaMs, this.maxFrameMs);
    while (this.accumulator >= this.stepMs) {
      this.step(this.stepMs / 1000, Math.round(this.simTimeMs));
      this.simTimeMs += this.stepMs;
      this.accumulator -= this.stepMs;
    }
  }

  /** 当前仿真时钟（ms），供 jumpPressedAt 等使用。 */
  get time(): number {
    return Math.round(this.simTimeMs);
  }
}
