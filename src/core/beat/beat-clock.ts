/**
 * core/beat/beat-clock — 纯逻辑节拍时钟（GDD 10，E1.S3 落地）。
 * enabled:false 时不驱动任何机制（仅返回 0 / 不跨拍）。可单测、确定性。零 Phaser。
 */
export interface BeatDef {
  enabled: boolean;
  bpm: number;
  grid: number;
  tracks: unknown[];
}

export class BeatClock {
  private lastBeat = -1;

  constructor(public readonly def: BeatDef) {}

  get enabled(): boolean {
    return this.def.enabled;
  }

  /** 单拍时长 ms = 60000 / bpm / grid；禁用或非法参数返回 Infinity。 */
  get beatDurationMs(): number {
    if (!this.enabled || this.def.bpm <= 0 || this.def.grid <= 0) return Infinity;
    return 60000 / this.def.bpm / this.def.grid;
  }

  /** 给定仿真时钟 ms 的整拍序号（禁用返回 0）。 */
  getBeat(simTimeMs: number): number {
    if (!this.enabled) return 0;
    const d = this.beatDurationMs;
    if (!isFinite(d) || d <= 0) return 0;
    return Math.floor(simTimeMs / d);
  }

  /** 每固定步调用：若跨过整拍返回 true（调用方据 ON_BEAT 触发机制）。 */
  crossedBeat(simTimeMs: number): boolean {
    if (!this.enabled) return false;
    const b = this.getBeat(simTimeMs);
    if (b !== this.lastBeat) {
      this.lastBeat = b;
      return true;
    }
    return false;
  }
}
