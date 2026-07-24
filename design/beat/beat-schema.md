# S05-1 节拍谱面 · 纯类型草案（Beat Schema Draft）

> 用途：供 engineering-lead 直接转 `src/core/level/level-data.ts` 与 `src/core/beat/*` 的 TS 类型，**零注释、纯契约**。
> 语义与 `beat-design.md` 完全一致；设计理由/边界/验收见主文档。
> 状态：拟稿待主理人审批（**未 git commit**）。

---

```ts
// ===== src/core/level/level-data.ts 新增/收紧 =====

/** 节拍相位：平台可踩/可碰撞(solid) vs 虚化/可穿过(ghost)。 */
export type BeatPhase = 'solid' | 'ghost';

/** 一块由若干 tile 组成的节拍平台（节拍实体）。 */
export interface BeatPlatformDef {
  id: string;
  tiles: Array<{ tx: number; ty: number }>;
  initial?: BeatPhase; // 缺省 'solid'
}

/** 谱面一条目（BeatDef.tracks 的元素）。pattern 与 (beat+action) 二选一。 */
export interface BeatTrackEntry {
  target: string;
  pattern?: string;        // 'S'=solid 'G'=ghost 'T'=toggle；按 beatIndex % len 取字符
  beat?: number;           // 单点模式：精确拍号（0 起）
  action?: BeatPhase;      // 单点模式目标相位（pattern 缺省时生效）
  params?: Record<string, unknown>; // Could 预留
}

export interface BeatDef {
  enabled: boolean;
  bpm: number;             // beats/min
  grid: number;            // 每拍细分（无量纲）；beatDurationMs = 60000 / bpm / grid
  tracks: BeatTrackEntry[];// 原 unknown[]
}

export interface LevelData {
  // ...既有字段不变...
  beat: BeatDef;
  beatPlatforms?: BeatPlatformDef[]; // 新增
}
```

```ts
// ===== src/core/beat/beat-driven-system.ts（新建，零 Phaser / 零平台）=====

import type { BeatClock } from './beat-clock';
import type { BeatPlatformDef, BeatTrackEntry, BeatPhase } from '../level/level-data';

/** RuntimeLevel 实现的动态碰撞控制器接口（beat 模块不反向依赖 level 具体类）。 */
export interface BeatSolidController {
  getBeatPlatformTiles(id: string): number[];        // 键 = ty*width + tx
  setBeatPlatformSolid(id: string, on: boolean): void;
  isBeatSolidAt(tx: number, ty: number): boolean;
}

export class BeatDrivenSystem {
  constructor(
    private readonly beat: BeatClock,
    private readonly platforms: BeatPlatformDef[],
    private readonly tracks: BeatTrackEntry[],
    private readonly ctrl: BeatSolidController,
  );
  tick(simTimeMs: number): void;   // 跨拍时按 tracks 切相位；enabled=false 或 !crossedBeat → no-op
  getPhase(id: string): BeatPhase;
}
```

```ts
// ===== src/core/level/level-runtime.ts 最小扩展（碰撞真相源不变，仅 OR 动态集）=====

export class RuntimeLevel {
  // 新增私有集（键 = ty*width + tx）
  private beatSolid = new Set<number>();
  // 构造：遍历 data.beatPlatforms，initial??'solid'==='solid' 的 tile 写入 beatSolid
  // isSolidTile 改为：ty<0?false : !inBounds?true : (solid[ty][tx] || beatSolid.has(ty*width+tx))
  // 实现 BeatSolidController：getBeatPlatformTiles / setBeatPlatformSolid / isBeatSolidAt
}
```

```ts
// ===== src/game/scenes/game-scene.ts 集成（伪代码，非实际改动）=====

// create():
//   this.beatClock = new BeatClock(this.runtime.data.beat);
//   if (beat.enabled && beatPlatforms?.length)
//     this.beatSystem = new BeatDrivenSystem(beatClock, beatPlatforms, beat.tracks, this.runtime);

// stepSim(dt, simTimeMs) 内（既有仿真之后）:
//   if (this.beatClock?.enabled && this.beatClock.crossedBeat(simTimeMs)) {
//     this.beatSystem?.tick(simTimeMs);
//     this.bus.emit(ON_BEAT, { beat: this.beatClock.getBeat(simTimeMs) });
//   }
```

```jsonc
// ===== src/config/levels/1-1.json 点亮示例（局部节拍段）=====
"beat": {
  "enabled": true,
  "bpm": 120,
  "grid": 8,
  "tracks": [ { "target": "bp_pulse_a", "pattern": "SSSSSSSSGGGGGGGG" } ]
},
"beatPlatforms": [
  { "id": "bp_pulse_a", "initial": "solid",
    "tiles": [ {"tx":22,"ty":4}, {"tx":23,"ty":4} ] }
]
```
