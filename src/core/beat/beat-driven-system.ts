/**
 * core/beat/beat-driven-system — 节拍驱动系统（S05-1，GDD 10）。
 *
 * 持有 BeatClock + 平台相位表 + RuntimeLevel 动态碰撞句柄；在跨拍瞬间按 tracks
 * 切换目标平台 tile 的 solid/ghost。core 零 Phaser / 零平台 API、确定性。
 *
 * 设计要点（与 game-scene / headless 对齐）：
 *   - 本系统只通过 RuntimeLevel.setBeatTileSolid 翻转碰撞，不反向依赖渲染/音频。
 *   - applyBeat(beatIndex) 不在内部调 beat.crossedBeat()（状态已由 game-scene 每步
 *     消费一次，见 advanceBeat）；beatIndex 由调用方传入（来自 BeatClock.getBeat）。
 *   - 构造期按 target 在 level.data.beatPlatforms 解析平台 tiles；无匹配 → fail-fast 抛错。
 */
import type { BeatClock } from './beat-clock';
import type { RuntimeLevel } from '../level/level-runtime';
import type { BeatTrackEntry, BeatPhase } from '../level/level-data';

/** 解析后的平台：tile 列表 + 初始相位。 */
interface ResolvedPlatform {
  tiles: Array<{ tx: number; ty: number }>;
  initial: BeatPhase;
}

export class BeatDrivenSystem {
  /** target → 解析后的平台（构造期 fail-fast 建好）。 */
  private readonly resolved = new Map<string, ResolvedPlatform>();
  /** target → 上一拍相位（供 'T' toggle 与单点模式保持用）；缺省回退到平台 initial。 */
  private readonly prevPhase = new Map<string, BeatPhase>();

  constructor(
    private readonly level: RuntimeLevel,
    private readonly beat: BeatClock,
    private readonly tracks: BeatTrackEntry[],
  ) {
    const platforms = level.data.beatPlatforms ?? [];
    for (const e of tracks) {
      const p = platforms.find((pl) => pl.id === e.target);
      if (!p) {
        throw new Error(
          `[Beat] track.target="${e.target}" 无对应 beatPlatforms.id（加载期 fail-fast）`,
        );
      }
      this.resolved.set(e.target, {
        tiles: p.tiles,
        initial: p.initial ?? 'ghost',
      });
    }
  }

  /**
   * 跨拍时刷新相位（由 game-scene / headless 每步至多调用一次）。
   * 禁用时 no-op（平台锁在 initial，与「普通实心 tile」行为一致，零回归）。
   * @param beatIndex 当前整拍序号（来自 BeatClock.getBeat(simTimeMs)）。
   */
  applyBeat(beatIndex: number): void {
    if (!this.beat.enabled) return;
    for (const e of this.tracks) {
      const r = this.resolved.get(e.target);
      if (!r) continue;
      const phase = this.resolvePhase(e, r.initial, beatIndex);
      const on = phase === 'solid';
      for (const t of r.tiles) this.level.setBeatTileSolid(t.tx, t.ty, on);
      this.prevPhase.set(e.target, phase);
    }
  }

  /** 查某平台当前相位（供渲染/查询；缺省回退 initial）。 */
  getPhase(target: string): BeatPhase {
    return this.prevPhase.get(target) ?? this.resolved.get(target)?.initial ?? 'ghost';
  }

  /** 按 pattern / 单点模式解析该 track 在 beatIndex 下的相位。 */
  private resolvePhase(e: BeatTrackEntry, initial: BeatPhase, beatIndex: number): BeatPhase {
    // —— 周期模式 pattern ——
    if (e.pattern) {
      const len = e.pattern.length;
      if (len === 0) return this.prevPhase.get(e.target) ?? initial;
      const ch = e.pattern[((beatIndex % len) + len) % len]; // 防负 index
      if (ch === 'S') return 'solid';
      if (ch === 'G') return 'ghost';
      if (ch === 'T') {
        // toggle：相对上一拍取反；首拍（无 prev）取 initial 的反
        const base = this.prevPhase.get(e.target) ?? initial;
        return base === 'ghost' ? 'solid' : 'ghost';
      }
      // 非法字符：保持上一拍相位 + dev warn（绝不抛错，见设计契约 §3.4 边界 5）
      console.warn(`[Beat] 非法 pattern 字符 "${ch}"，保持上一拍相位`);
      return this.prevPhase.get(e.target) ?? initial;
    }
    // —— 单点模式 (beat + action) ——
    if (e.beat !== undefined && e.beat === beatIndex && e.action) {
      return e.action;
    }
    // 非触发拍：保持上一拍相位（首拍回退 initial）
    return this.prevPhase.get(e.target) ?? initial;
  }
}
