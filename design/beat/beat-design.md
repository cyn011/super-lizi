# S05-1 节拍关卡 · 设计契约（Beat-Level Design Contract）

> 文档类型：设计契约（Design Contract，非引擎代码）
> 作者：文策渊（design-strategist）
> 关联：GDD 10（节拍预留接口）· GDD 05（关卡）· 概念文档 §7（差异化内核：音乐节拍化关卡）
> 状态：拟稿待主理人审批（**未 git commit**）
> 范围边界（铁律）：本文只定义**设计 + 数据结构 schema + 集成契约**；不写 `src/**` 引擎代码、不写 `.json` 实际改动（仅给示例值）；核心逻辑必须零 Phaser / 零平台 API、确定性。

---

## 0. 已核实事实（写本契约前已读源码确认，非臆造）

| 项 | 事实 | 出处 |
|---|---|---|
| 节拍时钟 | `BeatClock` 已落地，纯逻辑、确定性。`beatDurationMs = 60000 / bpm / grid`（注释：`grid`=每拍细分，故"一拍"=grid 个 tick）。`getBeat(simTimeMs)=floor(simTimeMs/d)`；`crossedBeat(simTimeMs)` 在整拍序号变化时返回 true；`enabled=false` 时 `beatDurationMs=Infinity`、`getBeat=0`、`crossedBeat=false`。 | `src/core/beat/beat-clock.ts` |
| 谱面占位坑 | `LevelData.beat: BeatDef`，其中 `tracks: unknown[]` —— **这就是 S05-1 要填真实 schema 的坑**。 | `src/core/level/level-data.ts:83-88` |
| 事件总线 | `ON_BEAT = 'ON_BEAT'` 已存在。 | `src/core/events/event-bus.ts:30` |
| headless 已驱动 | `HeadlessSim.run()` 在固定步循环里：`if (this.beatEnabled && this.beat.crossedBeat(simTimeMs)) { this.beatEvents++; this.bus.emit(ON_BEAT); }`，`simTimeMs = i * STEP_DT * 1000`。单测断言 `enabled=true→beatEvents>0`、`false→0`（确定性已验证）。 | `src/core/sim/headless.ts:201-204` |
| game-scene **未**驱动 | `GameScene.stepSim(dt, simTimeMs)` 接收 `simTimeMs`（来自 `FixedStep`，`Math.round(simTimeMs)` 每步 +STEP_MS），但**当前完全没持有/驱动 `BeatClock`**，也没 emit `ON_BEAT`。 | `src/game/scenes/game-scene.ts:375`、`src/game/fixed-step.ts:26-27` |
| 碰撞世界 | `CollisionWorld.isSolidTile(tx,ty)` 是物理唯一真相源；`stepBody`/`resolveAxisY` 都只查它。当前是 `RuntimeLevel` 内 `solid[][]` 网格闭包，**无动态实/虚接口**。 | `src/core/physics/collision.ts`、`src/core/level/level-runtime.ts` |
| 1-1 现状 | 地面 `tx0-39, ty7-8` 连续实心（**无坑，通关路径永不被节拍平台阻断**）；含两块浮空实块 `tx22-23, ty4`、两组单向平台 `tx14-16,ty5` 与 `tx29-31,ty6`；`beat={enabled:false,bpm:120,grid:8,tracks:[]}`；`spawn={64,190}`；`goal=triumph_gate@{1184,160,32,64}`。 | `src/config/levels/1-1.json` |

> 结论：**不要重建时钟**（BeatClock 已存在且 headless 已验证）。S05-1 只需①把 `tracks:unknown[]` 落地为真实 schema；②设计一个有界节拍机制；③设计 core 零平台层 `BeatDrivenSystem` + game-scene 集成点；④给出 1-1 轻量点亮方案。

---

## 1. 玩法定位 / MDA

### 1.1 Design Pillars 映射（概念文档 §1）
- **P1 · 跳（手感第一）**：节拍平台**绝不改手感参数**（coyote/buffer/二段跳/重力全不动）；它只决定"某块地此刻能不能踩"。手感红线不可破。
- **P2 · 闯（横版推进与探索）**：节拍平台做成**可选节奏挑战/捷径/奖励线**，而非必经路（见 §5 点亮方案——1-1 地面连续，Completion 永不被阻断）。
- **P3 · 蜕变**：本机制与种子蜕变（GDD 12 §3.7）**正交、零共享状态**，并行存在、互不读写（遵循既有决议）。

### 1.2 MDA
| 层 | 内容 |
|---|---|
| **M（机制）** | `BeatClock` 产出确定性整拍序号 → `BeatDrivenSystem` 按谱面 `tracks` 在跨拍瞬间切换目标平台的 `solid/ghost` 相位 → 物理层 `isSolidTile` 实时反映 → 玩家踩踏/穿行随之变化。 |
| **D（动态）** | 跑跳 + 节拍平台相位 = "在鼓点上踩实/穿虚"的连续节奏流；形成"读拍—起跳—落点"的新决策层，呼应 Sensation 美学做成机制（概念 §7）。 |
| **A（美学）** | **Sensation（感官）** 由"氛围"升级为"机制"：平台随乐律明灭、半透明+藤蔓微光（IP 安全：呼应"种子精灵唤醒大地"，**禁星/蘑菇/旗杆命名**）；audio-bus 订阅 `ON_BEAT` 播占位节拍音（GDD 09）。 |

### 1.3 红线自查（设计理论四禁）
- **主导策略（Dominant Strategy）**：节拍平台为**可选/局部**，不提供比常规路径更优且无风险的通用解法 → 无主导策略。
- **经济失衡**：节拍平台**不产分、不产币、不产种子**（参考 GDD 12 §R2 不刷分原则）→ 无经济扰动。
- **认知过载**：MVP 仅 **1 个**机制、1 条短 track、局部区段 → 早期不堆节拍认知。
- **支柱漂移**：机制同时服务 P1（踩踏手感不变）/ P2（可选节奏探索）/ Sensation 美学 → 不漂移。

---

## 2. 谱面数据结构 Schema（填 `tracks:unknown[]` 的坑）

### 2.1 顶层改动（`LevelData`）
在 `src/core/level/level-data.ts` 的 `BeatDef` 与 `LevelData` 上做**最小扩展**（向后兼容：旧 `tracks:[]` 仍合法）：

```ts
// —— 节拍相位：平台可踩/可碰撞 vs 虚化/可穿过 ——
export type BeatPhase = 'solid' | 'ghost';

// —— 节拍实体：一块由若干 tile 组成的"节拍平台" ——
export interface BeatPlatformDef {
  /** 实例唯一 id；tracks[].target 引用此 id。 */
  id: string;
  /** 组成平台的瓦片坐标（逻辑 tile 网格，tx/ty 为整数）。可多块连成一条平台。 */
  tiles: Array<{ tx: number; ty: number }>;
  /** 第 0 拍之前（未触发任何 track 时）的保底相位；缺省 'solid'。 */
  initial?: BeatPhase;
}

// —— 谱面一条目（BeatDef.tracks 的元素）——
export interface BeatTrackEntry {
  /** 目标平台 id（引用 BeatPlatformDef.id）。无匹配 id → 加载期 fail-fast 报错（见 §4.5）。 */
  target: string;
  /**
   * 触发模式（二选一，互斥）：
   *  - 周期模式 pattern：状态串，按 `beatIndex % pattern.length` 取字符映射：
   *      'S'=solid，'G'=ghost，'T'=toggle（相对上一拍相位取反，首拍取 initial）。
   *      例（grid=8,bpm=120→每字符 62.5ms）："SSSSSSSSGGGGGGGG" = 实 500ms / 虚 500ms（1s 周期）。
   *  - 单点模式 beat：在精确拍号触发一次 action（pattern 缺省时生效）。
   */
  pattern?: string;
  beat?: number;
  /** 单点模式下的目标相位；周期模式忽略。 */
  action?: BeatPhase;
  /** 预留扩展（Could）：如 { hold:number } 表示触发后保持 N 拍再回到 default。MVP 不用。 */
  params?: Record<string, unknown>;
}

// —— BeatDef.tracks 由 unknown[] 收紧为 BeatTrackEntry[] ——
export interface BeatDef {
  enabled: boolean;
  bpm: number;
  grid: number;
  tracks: BeatTrackEntry[];   // 原 unknown[]
}

// —— LevelData 新增 beatPlatforms 字段（节拍实体声明，独立于 entities/props）——
export interface LevelData {
  // ...既有字段不变...
  beat: BeatDef;
  beatPlatforms?: BeatPlatformDef[];   // 新增
}
```

> **为何新增 `beatPlatforms` 而非塞进 `entities`/`props`**：节拍平台需要 `tracks.target` 用 id 精确引用一组 tile，且属于"节拍域"而非"敌人/道具域"；独立数组使 `beat`/`beatPlatforms`/`tracks` 三者自洽、校验清晰、不污染既有 `EntityDef`/`PropDef` union。（备选：用 `props` 的 `type:'beat_platform'`；见 §7 决策点 4。）

### 2.2 纯类型草案另存
供 engineering-lead 直接转 TS 的零注释版本见同目录 **`beat-schema.md`**（与本节语义一致）。

---

## 3. 机制 Spec：节拍平台（BeatPlatform）

> **拍板结论：选 BeatPlatform（节拍平台），不选 BeatHazard（节拍陷阱）。** 理由：平台"实/虚交替"对玩家是**可读的正向节奏挑战**（在鼓点上踩），而陷阱"仅特定拍激活"对玩家是**负向惩罚**，在已验证的 1-1 上更易引发不公平死亡、破坏手感红线（P1）。MVP 只做一个机制，BeatPlatform 更安全、更贴合 Sensation 美学。

### 3.1 相位定义
- `solid`：平台 tile **参与碰撞**（可踩、可撞头顶、阻挡）。
- `ghost`：平台 tile **退出碰撞**（可穿过、可下落穿过、不阻挡）。视觉半透明 + 藤蔓微光提示。

### 3.2 精确切换规则（确定性、可测）
令 `d = beatDurationMs = 60000 / bpm / grid` （单位 ms，bpm 单位 beats/min，grid 无量纲=每拍细分）。
令 `b = BeatClock.getBeat(simTimeMs) = floor(simTimeMs / d)` （整拍序号，从 0 起）。
在每个固定步，`BeatDrivenSystem.tick(simTimeMs)` 执行：

```
若 beat.enabled == false → 不动作（平台恒为 initial 相位，见 §3.4 边界 3）。
否则若 beat.crossedBeat(simTimeMs) == true：
    b = beat.getBeat(simTimeMs)
    对每条 track entry e：
        若 e.pattern 存在：
            ch = e.pattern[ b % e.pattern.length ]
            phase = charToPhase(ch, prevPhase_of_e.target)   // 'S'→solid, 'G'→ghost, 'T'→相对 prev 取反
        否则若 e.beat === b 且 e.action 存在：
            phase = e.action
        据此更新 runtime 中该平台 tile 的 solid/ghost（写入动态碰撞集）
```

- `charToPhase`：`'S'→'solid'`、`'G'→'ghost'`、`'T'→` 与上一拍该 target 相位相反（首拍 `'T'` 取 `initial` 的反）。非法字符（非 S/G/T）→ 该拍保持上一拍相位 + dev 下 `console.warn`（**绝不抛错**，见 §4.5 边界 5）。
- **确定性保证**：`getBeat` 是 `simTimeMs` 的纯函数；同 `simTimeMs` → 同 `b` → 同相位序列。headless 可逐帧复现。

### 3.3 周期与单位（给验收/调参用）
- 单拍时长 `d`（ms）。例：`bpm=120, grid=8 → d = 60000/120/8 = 62.5 ms`。
- 平台相位周期 `T = pattern.length × d`（ms）。例：`pattern="SSSSSSSSGGGGGGGG"`（16 字符）→ `T=1000 ms`，其中 `solid 500ms / ghost 500ms`。
- 推荐 MVP 节拍段用 500/500ms（舒适可读）；更紧可用 250/250ms（grid=8 下 `pattern` 长度 8），但仅限短段。

### 3.4 边界情况（≥3，设计理论/工程必覆盖）
1. **玩家站在平台上→平台变 ghost**：该 tile 退出碰撞 → `resolveAxisY` 不再着地 → 重力接管 → 玩家下落。确定性、符合预期。
2. **玩家重叠在平台 tile 内→平台重新变 solid**：下一拍 `isSolidTile` 恢复 true；若玩家在该 tile 内，`resolveAxisY`（在 `vy>0` 时）会把玩家推到 `minTop - body.h`（顶出）。因平台仅 1 tile 高且置于离地 ≥1 tile 处，重叠深度 ≤32px，弹出 ≤1 tile，**可接受**。缓解：节拍平台不放在紧贴实心地面的正上方，避免深重叠。
3. **`beat.enabled=false`**：`BeatDrivenSystem` 不构造（或构造后永不 `tick`）→ 所有平台锁在 `initial`（默认 solid）→ 与"普通实心 tile"行为完全一致 → **1-1 现状零回归**（且 1-1 今天本就无 `beatPlatforms`）。
4. **声明了 `beatPlatforms` 但 `beat.enabled=false`**：同上，平台按 `initial` 永久实心、静态渲染，不脉动。无副作用。
5. **非法字符 / 空 pattern**：见 §3.2；保持上一拍相位 + dev warn，不崩溃。
6. **`target` 无对应 `BeatPlatformDef.id`**：加载期 fail-fast（构造 `BeatDrivenSystem` 或 `LevelLoader` 校验时抛错），把作者笔误挡在运行前（见 §4.5 / §6 验收 1）。

---

## 4. 集成点设计（core 零平台 + game-scene）

### 4.1 核心层 `BeatDrivenSystem`（落 `src/core/beat/beat-driven-system.ts`，**零 Phaser / 零平台**）
职责：持有 `BeatClock` + 平台相位表 + 动态碰撞 handle；在跨拍瞬间按 `tracks` 切换目标平台 tile 的 solid/ghost。**不反向依赖渲染/音频**。

```ts
// 由 RuntimeLevel 实现的动态碰撞控制器接口（beat 模块不反向依赖 level 具体类）
export interface BeatSolidController {
  /** 取某平台的所有 tile（编码为 ty*width+tx 的单整数键）。 */
  getBeatPlatformTiles(id: string): number[];
  /** 设/取消该平台全部 tile 的"节拍实心"状态。 */
  setBeatPlatformSolid(id: string, on: boolean): void;
  /** 查某 tile 当前是否处于节拍实心（供渲染/查询，可选）。 */
  isBeatSolidAt(tx: number, ty: number): boolean;
}

export class BeatDrivenSystem {
  constructor(
    private readonly beat: BeatClock,
    private readonly platforms: BeatPlatformDef[],
    private readonly tracks: BeatTrackEntry[],
    private readonly ctrl: BeatSolidController,   // 实际传 RuntimeLevel
  ) {
    // 加载期 fail-fast：任一 track.target 无匹配平台 → 抛错
    for (const e of tracks) {
      if (!platforms.some((p) => p.id === e.target))
        throw new Error(`[Beat] track.target="${e.target}" 无对应 beatPlatforms.id`);
    }
  }
  /** 每固定步调用（game-scene / headless）：跨拍时刷新相位。 */
  tick(simTimeMs: number): void {
    if (!this.beat.enabled || !this.beat.crossedBeat(simTimeMs)) return;
    const b = this.beat.getBeat(simTimeMs);
    for (const e of this.tracks) {
      const phase = e.pattern
        ? charToPhase(e.pattern[b % e.pattern.length], this.prevPhase(e.target))
        : (e.beat === b && e.action ? e.action : this.prevPhase(e.target));
      this.applyPhase(e.target, phase);
    }
  }
  getPhase(id: string): BeatPhase { return this.prevPhase(id); }
}
```

> 关键：**`BeatDrivenSystem` 只通过 `BeatSolidController` 接口改碰撞**，不直接碰 `CollisionWorld`。`RuntimeLevel` 实现该接口，`stepBody` 等物理代码**零改动**。

### 4.2 `RuntimeLevel` 需加的最小支撑（碰撞真相源不变，只 OR 一个动态集）
在 `src/core/level/level-runtime.ts` 增加：
- `private beatSolid = new Set<number>()`（键 = `ty*width + tx`）。
- 构造时：遍历 `data.beatPlatforms ?? []`，把 `initial ?? 'solid' === 'solid'` 的平台 tile 写入 `beatSolid`（保证边界 3/4：禁用时仍实心）。
- `isSolidTile(tx,ty)` 改为：`return (ty<0)?false : (!inBounds)?true : (this.solid[ty][tx] || this.beatSolid.has(ty*this.world.width+tx))`。
- 实现 `BeatSolidController`：`getBeatPlatformTiles / setBeatPlatformSolid / isBeatSolidAt`。

> 这样 `stepBody` / `resolveAxisX/Y` 完全不改，自动尊重节拍实/虚（单一真相源原则）。

### 4.3 game-scene 集成点（对齐 headless 行为）
在 `src/game/scenes/game-scene.ts`：
- `create()`：用 `this.runtime.data.beat` 建 `BeatClock`；若 `beat.enabled && beatPlatforms?.length`，建 `BeatDrivenSystem(beat, beatPlatforms, beat.tracks, this.runtime)` 并持有。
- `stepSim(dt, simTimeMs)`：在既有仿真之后、`this.sprite.setPosition(...)` 之前，补一段（注意 `simTimeMs` 来自 `FixedStep`，与 headless 的 `i*STEP_DT*1000` 同源、仅亚毫秒取整差异，见 §4.4）：
  ```ts
  // 节拍门控：对齐 headless——跨拍时先切相位、再 emit ON_BEAT（让音频/juice 读到新相位）
  if (this.beatClock?.enabled && this.beatClock.crossedBeat(simTimeMs)) {
    this.beatSystem?.tick(simTimeMs);              // 先刷新平台相位
    this.bus.emit(ON_BEAT, { beat: this.beatClock.getBeat(simTimeMs) });
  }
  ```
- **暂停即冻结**：`stepSim` 顶部的 `if (this.paused || this.gameOver || this.levelComplete) return;` 已早退，节拍因 `simTimeMs` 不推进而自然冻结，与 headless 行为一致。
- **渲染**：`ON_BEAT` 已被 `audio-bus`（GDD 09）订阅播占位节拍音；平台虚化视觉（半透明+微光）由 `game/render` 据 `beatSystem.getPhase(id)` 绘制（core 不负责）。

### 4.4 双端确定性对齐说明（已知小差异，非阻断）
`FixedStep` 传 `Math.round(this.simTimeMs)`，`headless` 用 `i*STEP_DT*1000`（未取整）。二者在 `floor(simTimeMs/d)` 下，因浮点累积在极大 `i`（数万步）时可能差 1 拍；对玩法无感知影响（且仅在长跑极限出现）。若主理人要严格逐拍一致，可让 `FixedStep` 也传未取整 `simTimeMs` —— 列为 §7 决策点之外的**可选打磨项**，不阻塞 S05-1。

### 4.5 边界 5/6 的工程落地要求（对应 §3.4）
- 边界 5（非法字符）：`charToPhase` 对 S/G/T 以外字符返回上一拍相位 + dev warn。**生产不抛错**。
- 边界 6（target 无匹配）：`BeatDrivenSystem` 构造期遍历 `tracks` 校验，`throw`（fail-fast）。`LevelLoader.validateLevelData` 亦可在 E4.S1 扩展中加同名校验。

---

## 5. 点亮方案（1-1 轻量局部节拍段）

### 5.1 原则
- **不破坏已验证体验**：1-1 地面 `tx0-39` 连续、无坑 → Completion 永不被节拍平台阻断。节拍段为**可选节奏挑战**。
- **最小几何改动**：复用已存在的浮空实块 `tx22-23, ty4`（非必经路），将其转为一个 BeatPlatform，配 1 条短 track。
- **可选奖励**：可在该平台上方加 2-3 枚金币（节拍奖励线），鼓励"踩准鼓点"——不强制、不产分失衡。

### 5.2 推荐改 `src/config/levels/1-1.json` 的字段（示例值）
```jsonc
"beat": {
  "enabled": true,            // 由 false → true（仅本局部段生效）
  "bpm": 120,                 // 保持
  "grid": 8,                  // 保持 8（用 pattern 长度控制切换周期，见 §7 决策点 3）
  "tracks": [
    { "target": "bp_pulse_a", "pattern": "SSSSSSSSGGGGGGGG" }  // 实 500ms / 虚 500ms，1s 周期
  ]
},
"beatPlatforms": [           // 新增字段
  { "id": "bp_pulse_a", "initial": "solid",
    "tiles": [ {"tx":22,"ty":4}, {"tx":23,"ty":4} ] }
]
// 可选：在 tiles 上方加金币（奖励线，非必经）
// "entities": [ ...原有..., {"type":"coin","x":704,"y":64}, {"type":"coin","x":736,"y":64} ]
```
> 说明：`bpm=120, grid=8 → d=62.5ms`；`pattern` 长 16 → `T=1000ms`，实/虚各 500ms。玩家看到 `bp_pulse_a` 在鼓点上明灭：踩准实相位的拍子可借力跳跃，虚相位则穿落回下层。

### 5.3 不改动项（回归安全）
- 地面 tile、单向平台 `tx14-16/ty5` 与 `tx29-31/ty6`、敌人/金币/种子/检查点、`spawn`、`goal` **全部不动**。
- `enabled=false` 时（如回滚或新关卡）本方案零影响（边界 3/4）。

---

## 6. 验收门槛建议（给 engineering-lead）

| # | 验收项 | 断言/方法 |
|---|---|---|
| 1 | 谱面解析 + fail-fast | `tracks` 解析为 `BeatTrackEntry[]`；任一 `target` 无对应 `beatPlatforms.id` → 加载/构造抛错。 |
| 2 | game-scene 启用发 `ON_BEAT`、禁用不发 | 集成测试：`beat.enabled=true` 时固定步推进 N 步 → 订阅 `ON_BEAT` 捕获数 > 0；`enabled=false` → 0。对齐 headless 既有断言（`beatEvents>0`/`==0`）。 |
| 3 | 机制按图案正确切换 | 单测：`bpm=120,grid=8` + 平台 `bp` + `pattern="SSSSSSSSGGGGGGGG"`；`simTimeMs` 推进断言 `getPhase('bp')`：beat 0–7（0–500ms）=solid，beat 8–15（500–1000ms）=ghost，周期复现。 |
| 4 | headless 确定性 beat>0 + 相位确定性 | 既有 `enabled=true→beatEvents>0` 保持；**新增**：headless 接入 `BeatDrivenSystem`（当 `beat.enabled && tracks.length>0`）后，断言同输入序列 → 同相位序列（`finalHash` 含 beat 相位）。 |
| 5 | 禁用零副作用 | `enabled=false`：平台恒 `initial`（solid），碰撞世界与未启用前逐位一致（headless 状态哈希不变）。 |
| 6 | 物理复用无回归 | `stepBody`/`resolveAxisY` 不改动；仅 `isSolidTile` OR 动态集；既有物理单测全绿。 |
| 7 | 边界覆盖 | 至少补：①玩家站台上变 ghost→下落；②非法 pattern 字符→保持上一相位不崩；③`target` 无匹配→fail-fast。 |

---

## 7. 待主理人拍板决策点

| # | 决策点 | 我的推荐 | 备选 |
|---|---|---|---|
| 1 | **机制选型** | **BeatPlatform（节拍平台）**——正向可读节奏挑战，不破 P1 手感红线。 | BeatHazard（节拍陷阱）——负向惩罚，1-1 上易不公平死亡，不推荐 MVP。 |
| 2 | **点亮方式** | **转换现有浮空实块 `tx22-23,ty4` 为 `bp_pulse_a`**（最小几何改动，复用已验证布局）；可选加奖励金币。 | 新增一小段独立节拍平台+捷径（新几何，改动更大）。 |
| 3 | **grid 是否保持 8** | **保持 8**，用 `pattern` 长度控制周期（`"SSSSSSSSGGGGGGGG"`=500/500ms）。 | 改 `grid=1,bpm=120` → 直接 500ms/拍（更简单但改了 1-1 既有 grid 值）。 |
| 4 | **是否新增实体类型** | **新增独立 `beatPlatforms: BeatPlatformDef[]` 字段**（节拍域自洽，`tracks.target` 用 id 引用）。 | 用 `props` 的 `type:'beat_platform'`（复用既有 prop 管线，但污染 prop 语义）。 |
| 5 | **pattern 字符集** | 保留 `S/G/T`，但 **MVP 仅用 S/G**；`T`（取反）留 Could 表现用。 | 只保留 S/G（更简，但丢失取反表达能力）。 |
| 6 | **invalid target 处理** | **fail-fast 加载期抛错**（边界 6）。 | 静默忽略（更易漏掉作者笔误）。 |
| 7 | **`FixedStep` 是否传未取整 `simTimeMs`** | 非阻塞打磨项；建议保持现状（round 足够），后续若要逐拍严格一致再改。 | 改为传未取整（与 headless 逐拍一致）。 |

> 决策点 1–4 为 S05-1 落地前必拍；5–7 可在落地中按需拍。

---

## 8. 风险与缓解（设计层）
| 风险 | 缓解 |
|---|---|
| 节拍平台重新 solid 时把玩家弹出 | 平台 1 tile 高、不贴实心地面正上方；弹出 ≤32px 可接受（§3.4 边界 2）。 |
| 全开节拍破坏 1-1 手感 | 仅局部段、可选、不阻断 Completion（§5）。 |
| 与种子蜕变耦合 | 正交、零共享状态（§1.1 / GDD 12 §3.7）。 |
| 双端节拍不一致 | 纯逻辑 `BeatClock` + 统一 `simTimeMs` 来源，headless 已验证确定性（§4.4）。 |
| IP 红线 | 命名/视觉用"种子/藤蔓/明灭"，禁星/蘑菇/旗杆（§1.2）。 |

---

## 附录 A：集成架构示意
```
[LevelData]
  beat{enabled,bpm,grid,tracks:[{target,pattern}]}
  beatPlatforms:[{id,tiles,initial}]
        │  LevelLoader → RuntimeLevel
        ▼
  RuntimeLevel.world.isSolidTile = baseSolid OR beatSolid集   ← 物理唯一真相源（stepBody 零改）
        ▲ setBeatPlatformSolid(id,on)
        │
  BeatDrivenSystem(core,零Phaser)  ──tick(simTimeMs)──▶ 跨拍时按 tracks 切相位
        ▲ 持有
   BeatClock(core,已存在)  ← crossedBeat/getBeat
        ▲
  GameScene.stepSim / HeadlessSim.run  ── 每固定步 ──▶ beat.crossedBeat? → beatSystem.tick + bus.emit(ON_BEAT)
        │                                              │
   audio-bus(订阅ON_BEAT→占位节拍音)            game/render(据getPhase→半透明+微光)
```
