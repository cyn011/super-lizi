# 12 种子蜕变成长系统 Seed Metamorphosis

> 上游：concept §P3 / art/asset-spec §1 / ux §6.3 / gdd06 / gdd11
> 分层：Must（MVP 机制深）｜Could（能力增益 / meta 元成长 / 图鉴面板）
> 依赖：05 Level（种子实体）｜06 Economy（form 正交）｜07 Damage（sizeScale 不变）｜08 UI（HUD topper）｜09 Audio（SFX_POWERUP）｜11 Meta（持久化）
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：PH4-SEED-001

> **定位**：本文件是 ux/core-loop-ux §6.3 所等待的"机制定义文档"。它把"种子精灵蜕变"从概念（concept §P3 差异内核）与美术契约（art §1.3 `computeGrowth`）**落地为可实现的机制 + 数据/事件契约**，供工程主程直接实现、美术/UX 取数。完成后，ux §6.3 的 R1 阻塞解除。

---

## 1. 目的与范围

**差异内核落地**：以"采集种子 → 蜕变成长"替代任天堂的"吃蘑菇变大"。保留核心爽感（**拾取即成长的可触摸反馈**），但以**头顶嫩芽/藤/花/果的同伴式蜕变**呈现，而非改变身体尺寸——既 IP 安全（无蘑菇/变大轮廓），又不与 DamageState 的 `sizeScale`(FULL/SMALL) 冲突。

**支柱映射**
- **P3 · 蜕变**：种子是可即时感知的"成长动词"（采集→抽枝→开花→结果），呼应 concept §P3"成长变成可触摸的冒险动词"。
- **P1 · 跳（手感第一）**：MVP 蜕变**仅改视觉**，不改数值/尺寸/form，手感稳定红线不可破。
- **P2 · 闯**：种子作为关卡内收集物，奖励探索（隐藏种子 = 收集线）。

**范围**
- 本系统只管：**种子实体采集 → growthPct 累积 → stage 推导（苗/藤/花/果）→ 视觉蜕变（topper/光晕） + 跨关持久化计数**。
- 不管：身体尺寸（07）、能力/数值（form，06）、关卡布局（05 只提供实体放置扩展点）、节拍（10，独立）。

---

## 2. Must / Could 分层

### Must（MVP 必做 · 可玩切片）
- 种子实体在关卡内可采集（新增 `type:'seed'` 实体，复用 00 §1.3 统一 schema）。
- 采集 → 发 `ON_SEED_COLLECTED(seedId)`；本局 `growthPct` 累积（封顶 1.0）。
- 跨阈值 → 发 `ON_SEED_METAMORPHOSIS(stage)`，驱动 art 头顶 topper 切换（苗→藤→花→果，复用 art §1.3 已绘 `char_mali_top_0~3`）+ 暖黄光晕 tween + `SFX_POWERUP`。
- `ON_SEED_GROWTH(growthPct, stage)` 进度事件（供 UI/音频细反馈）。
- 跨关持久化：全局 `SeedMeta.totalCollected` 写入 SaveData（11 扩展点），重载保留。
- **蜕变仅视觉**：MVP 不改 `form`、不改 `sizeScale`、不改任何数值能力。

### Could（后续迭代，明确标注）
- **能力增益**：bloom/果 阶段解锁温和能力（如二段跳强化 / 短暂滞空），**不破坏 P1 手感前提**下做（建议仅增强不削弱、幅度可调）。
- **meta 元成长（hybrid）**：`SeedMeta.totalCollected` 跨关解锁更高 stage 上限 / 形态（art §1.3 `source:'meta'` 路径）；当前 MVP 仅记录计数，gating 留 Could。
- **图鉴 / 成长面板**：ux §6.3 的成长图鉴壳，按 `seedProgress: Record<seedId,SeedProgress>` 渲染；MVP 仅做数据契约，UI 留壳。
- **云端同步**：随 11 云存档 Could。

---

## 3. 机制详述

### 3.1 总体流程（采集 → 成长 → 蜕变 → 视觉）
```
玩家 body 触碰 seed 实体（存活态，非 DEAD）
  → 移除该 seed 实例 + 发 ON_SEED_COLLECTED(seedId)
  → runtime.growthPct = min(CAP, growthPct + GROWTH_PER_SEED)
  → stage = stageFromMaturity(growthPct)        // 调 art computeGrowth 的阈值
  → 发 ON_SEED_GROWTH(growthPct, stage)
  → if stage 变化：发 ON_SEED_METAMORPHOSIS(stage) + playSfx('SFX_POWERUP')
  → art 用 computeGrowth({source:'run', maturity:growthPct}) 取 GrowthVisual
        → 切换 char_mali_top_{0..3} + 光晕 alpha/radius tween（≤0.4s，非高频闪）
每局开始：runtime.growthPct = 0 → stage = sprout(苗)，保证本局即时反馈清晰
通关：saveSeedResult(runtime) → 合并入 SeedMeta（totalCollected++ 等）
```

### 3.2 数据模型（核心，给工程）
```ts
// 4 阶段权威枚举（对齐 art §1.3 computeGrowth 的 stage:0|1|2|3）
// 苗=sprout(0) 藤=vine(1) 花=bloom(2) 果=fruit(3)
type Stage = 'sprout' | 'vine' | 'bloom' | 'fruit';

// 单一种子类型的进度（局内 / 图鉴）
interface SeedProgress {
  seedId: string;          // 种子类型 id（如 'seed_common'）
  collectedCount: number;  // 已采集数
  stage: Stage;            // 当前蜕变阶段（4-stage，对齐 art）
  growthPct: number;       // 0..1 当前成长进度
}

// 全局蜕变状态（持久化到 SaveData）
interface SeedMeta {
  totalCollected: number;  // 跨关累计采集总数
  maturity: number;        // 0..1 跨关累计成熟度（MVP 仅记录，gating 留 Could）
  unlockedStages: Stage[]; // 已解锁阶段（MVP=['sprout']，Could 随 meta 扩展）
  currentStage: Stage;     // 持久化的最高/当前阶段
}

// 运行时状态（每局重置，不持久化）
interface SeedRuntimeState {
  growthPct: number;       // 0..1 本局累积 → 驱动 computeGrowth
  stage: Stage;            // 当前阶段（由 growthPct 推导）
  collectedThisRun: number;// 本局采集数（用于 saveSeedResult）
}
```

### 3.3 maturity 来源（art §1.3 Q1 的默认方案，本 GDD 定）
**默认 = (b) 局内 buff 驱动为主**（`source:'run'`）：
- `maturity = runtime.growthPct`（0..1），本局累积、进关重置为 0。
- 每次采集：`growthPct += GROWTH_PER_SEED`，封顶 `GROWTH_CAP=1.0`。
- stage 由 `growthPct` 经 art 阈值推导：`<0.25 苗` / `0.25≤m<0.5 藤` / `0.5≤m<0.75 花` / `m≥0.75 果`。

**meta 累计作长期成长（跨关保留）**：
- `SeedMeta.totalCollected` 每局累加，写入 SaveData。
- MVP 仅记录；**`totalCollected → 解锁更高 stage 上限/形态` 留 Could**（不阻塞 MVP）。
- 参数集中在 `seed-config.json`，可调：

```json
// seed-config.json
{
  "growthPerSeed": 0.25,   // 默认：4 颗种子满蜕变（苗→藤→花→果，对应 4 个 0.25 区间）
  "growthCap": 1.0,        // growthPct 封顶，避免无限刷
  "source": "run",         // MVP 默认；'meta'/'hybrid' 为 Could 扩展
  "stageThresholds": [0.25, 0.5, 0.75], // 对齐 art §1.3
  "seedEntityType": "seed",
  "metaGatingEnabled": false // Could：true 时 totalCollected 解锁 stage 上限
}
```
> **hybrid 可叠加（Could）**：`maturity` 可改为 `w1*runGrowth + w2*metaMaturity`，但 MVP 不做（保持 lean + 手感可预测）。

### 3.4 与 GDD 06 `form` 的关系（关键，避免冲突）
**正交，互不写对方字段**：
- `FormState`（BASE/TRANSFORMED）由**元气果等道具**（props.content）驱动，控制**能力**（06 §3）。
- `SeedMeta/SeedRuntimeState`（sprout..fruit）由**种子采集**驱动，控制**视觉 topper**（art Kernel）。
- **MVP**：采集种子 **不改变 `form`**，仅视觉蜕变。吃元气果才改 `form`（06 自有链路）。
- **Could**：bloom/果 阶段可附加温和能力增益，但属本系统独立状态，仍不写 `form`（避免与 06 道具冲突）；若确需联动，经主理人拍板另立映射表。
- 术语统一：**seed = 采集物/成长驱动；form = 能力态（道具驱动）**。两状态机各管各，消除命名冲突风险。

### 3.5 与 GDD 07 受伤/尺寸的关系
- 蜕变**不改 `sizeScale`**（FULL=1 / SMALL=0.6）。art §1.3 已锁定：果 阶段 `scale +0.05` **仅渲染**，碰撞盒不变，守 damage-config。
- 本系统只读/写 `SeedRuntimeState`，**绝不**改 `DamageState` 任何字段；与 99 评审"受伤/形态状态机正交"一致。

### 3.6 与 GDD 11 存档的关系（扩展点）
- `SaveData` 扩展加 `seedMeta: SeedMeta`（MVP 必做）与可选 `seedProgress: Record<string,SeedProgress>`（图鉴 Could）。
- `loadSave()`：缺 `seedMeta` 时给默认（`{totalCollected:0, maturity:0, unlockedStages:['sprout'], currentStage:'sprout'}`），向后兼容老存档。
- 新增 `saveSeedResult(run: SeedRuntimeState)` 合并入 `seedMeta`（见 §5）。

### 3.7 与 GDD 10 节拍的关系
- **独立，不耦合**。种子蜕变无 beat 依赖、无共享状态；差分内核（种子蜕变）与差异化内核（音乐节拍化关卡）并行存在，互不读写。

### 3.8 与 art `computeGrowth` 的对接
- 本系统**生产** `maturity`（MVP `source:'run'` → `runtime.growthPct`），是 art §1.3 `GrowthParams.maturity` 的提供方。
- art 消费：`computeGrowth({source:'run', maturity}) → GrowthVisual{stage,sproutLen,leafCount,bodyTint,auraAlpha,auraRadius}` → 程序切换 `char_mali_top_0~3` + `fx_glow_mali` tween。
- 本系统不重绘资源，只传 `maturity` 与 `stage`。

---

## 4. 依赖系统
- **05 Level**：种子实体放置（`type:'seed'`，见 §5 扩展点）。本系统订阅碰撞，不负责渲染。
- **06 Economy**：form 正交（§3.4），种子**不写入** EconomyState 分数（防刷分主导策略）。
- **07 Damage**：sizeScale 不变（§3.5）。
- **08 UI / ux §6.3**：订阅 `ON_SEED_*` 做收集反馈 / 蜕变过渡 / 图鉴（Could 壳）。
- **09 Audio**：`SF 'SFX_POWERUP'`（art §5.1 已锁"蜕变 stage up"）在 METAMORPHOSIS 时播放。
- **11 Meta**：持久化 `seedMeta`（§3.6）。

---

## 5. 接口契约

### 5.1 需在 `src/core/events/event-bus.ts` 新增的 3 个事件常量
（由工程主程落地；本 GDD 仅定义契约，不改源码）
```ts
export const ON_SEED_COLLECTED = 'ON_SEED_COLLECTED';       // payload: string (seedId)
export const ON_SEED_GROWTH = 'ON_SEED_GROWTH';             // payload: { growthPct:number; stage:Stage }
export const ON_SEED_METAMORPHOSIS = 'ON_SEED_METAMORPHOSIS'; // payload: Stage
```

### 5.2 各事件 payload 与触发时机
| 事件 | payload | 触发时机 | 主要订阅者 |
|---|---|---|---|
| `ON_SEED_COLLECTED` | `seedId: string` | 玩家 body 触碰 seed 且存活（非 DEAD），seed 实例移除瞬间 | 06?否 / 08 UI（收集飘字）/ 本系统（累积 growthPct） |
| `ON_SEED_GROWTH` | `{ growthPct:number(0..1); stage:Stage }` | 每次采集后重算 growthPct 即发（即使 stage 未变） | UI 进度条（Could）/ 音频细反馈 |
| `ON_SEED_METAMORPHOSIS` | `stage: Stage` | **仅当 stage 跨阈值变化**（苗→藤→花→果） | art（topper 切换 + 光晕 tween）/ ux §6.3 蜕变过渡 / 09（SFX_POWERUP） |

### 5.3 函数契约
```ts
// 运行时
function stageFromMaturity(m: number): Stage  // 用 seed-config.stageThresholds → 0|1|2|3 → Stage
function onSeedCollected(seedId: string): void // 见 §3.1 流程，发 3 事件

// 持久化（GDD 11 扩展）
function loadSave(): SaveData
function saveLevelResult(levelId:string, stars:number, time:number): void
function saveSeedResult(run: SeedRuntimeState): void
//   → SeedMeta.totalCollected += run.collectedThisRun
//   → SeedMeta.maturity = max(SeedMeta.maturity, run.growthPct)
//   → SeedMeta.currentStage = maxStage(SeedMeta.currentStage, run.stage)
//   → SeedMeta.unlockedStages ∪ 已抵达 stages
//   → 写回 SaveData（localStorage / wx.setStorageSync）
```

### 5.4 GDD 05 扩展点（种子实体）
在 `LevelData.entities` 新增类型，复用 00 §1.3 统一 schema：
```json
{"id":"s1","type":"seed","x":200,"y":160,"width":16,"height":16,"params":{"seedId":"seed_common"}}
```
- 碰撞：与玩家 body overlap 即采集；采集后实例移除（不重复计数）。
- 视觉/音效：复用 ux §6.3 收集范式（punch + 闪光环 + "+1 种子"飘字），减少动态开启时改静态。

---

## 6. 数据格式

**seed-config.json**（集中可调，见 §3.3）：
```json
{ "growthPerSeed": 0.25, "growthCap": 1.0, "source": "run",
  "stageThresholds": [0.25, 0.5, 0.75], "seedEntityType": "seed", "metaGatingEnabled": false }
```

**SaveData 扩展**（localStorage key `super-mali-save`，对齐 11）：
```ts
interface SaveData {
  unlockedLevels: string[];
  stars: Record<string, number>;
  bestTimes: Record<string, number>;
  seedMeta: SeedMeta;                              // 新增（MVP）
  seedProgress?: Record<string, SeedProgress>;     // 新增（Could 图鉴，MVP 可省略）
}
```

**运行时**（不持久化，每局重置）：
`SeedRuntimeState { growthPct:0 → 'sprout'; collectedThisRun:0 }` 于关卡 `create` 初始化。

---

## 7. 验收标准
- [ ] 触碰种子实体 → `ON_SEED_COLLECTED(seedId)` 触发，`growthPct` 按 `growthPerSeed` 递增。
- [ ] `growthPct` 跨阈值 → `ON_SEED_METAMORPHOSIS(stage)`，art 头顶 topper 切换 **苗→藤→花→果**，与 `computeGrowth(maturity)` 阶段一致。
- [ ] 蜕变**仅改视觉**（topper/aura），**不改** `sizeScale`/碰撞盒、**不改** `form`（MVP）。
- [ ] 每局开始 `growthPct=0` → stage=sprout（苗），保证本局即时反馈。
- [ ] 跨关：`SeedMeta.totalCollected` 持久化到 SaveData，重载后保留；缺字段老存档不崩。
- [ ] 3 个 `ON_SEED_*` 常量已加入 `event-bus.ts`，命名一致。
- [ ] 与 GDD 06 正交：吃元气果改 `form`，采种子不改 `form`（MVP）。
- [ ] 种子**不计入** EconomyState 分数（杜绝刷分主导策略）。
- [ ] `ON_SEED_METAMORPHOSIS` 触发 `SFX_POWERUP`（art §5.1 已锁）。

---

## 8. 风险与缓解
| # | 风险 | 缓解 |
|---|---|---|
| R1 | 蜕变破坏手感平衡 | MVP **仅视觉蜕变**（不改数值/尺寸/form），守 P1 手感红线；能力增益留 Could 且只增强不削弱、幅度可调。 |
| R2 | 种子密度 / 刷分 | 种子**不进分数经济**；`growthPct` 封顶 1.0；单关种子数受 05 关卡设计约束（建议 6–10/关，仅前 ~4 触蜕变，余量作收集探索）；拾取即移除，无重复计数。 |
| R3 | 命名冲突（seed vs form） | 术语统一：seed=采集物/成长驱动，form=能力态（道具驱动）；两状态机正交，互不写对方字段（§3.4）。 |
| R4 | art / ux 命名不一致（ux §6.3 三阶段 vs art 四阶段） | **本 GDD 以 art 四阶段（苗/藤/花/果）为权威**，ux §6.3 的 `'seed'\|'sprout'\|'bloom'` 提案**由此 superseded**（见附录 A）。需主理人确认此 reconciliation。 |
| R5 | maturity 来源未定（art Q1） | 本 GDD 定默认 (b) run-buff 驱动；meta 累计作 Could 长期成长；**不阻塞美术**（art 已按 stage 抽 topper）。 |
| R6 | 与 GDD 10 节拍耦合 | 独立（§3.7），无共享状态，无耦合风险。 |
| R7 | 持久化迁移 | `loadSave` 缺 `seedMeta` 给默认，向后兼容老存档（§3.6）。 |

---

## 附录 A：与 ux §6.3 / art §1.3 命名对齐说明（reconciliation）
- **art §1.3（权威）**：4 离散 stage `0|1|2|3` = **苗 / 藤 / 花 / 果**，阈值 `[0.25,0.5,0.75]`。
- **ux §6.3（提案，待机制）**：`SeedProgress.stage: 'seed'|'sprout'|'bloom'`（3 阶段）。该提案为本 GDD 等待前的占位，**非权威**。
- **本 GDD 裁决**：采用 **4-stage 枚举 `Stage = 'sprout'|'vine'|'bloom'|'fruit'`**（苗/藤/花/果）为唯一真理源；`growthPct` 0 即 `sprout`(苗)，故 ux 的 `'seed'`（未采集初态）并入"maturity=0 → 苗"，无独立 `seed` 阶段。ux §6.3 实现层须按本枚举调整（主理人确认后，建议同步修订 ux §6.3 的契约示例）。

## 附录 B：与 GDD 11 / 00-index 的衔接
- 建议主理人确认后，于 `design/gdd/00-index.md` §2.1 系统列表与 §3 路径表**新增 GDD 12 行**（分层 Must，依赖 05/06/07/08/11），并在 §2.2 依赖图补 `12 → 05/06/07/08/09/11`。
- `99-consistency-review.md` 应在下次评审纳入 12 与 06(form)/07(sizeScale)/11(SaveData) 的正交核查。

## 待主理人确认
1. **maturity 默认来源 = (b) run-buff 驱动**（已定默认，可改 meta/hybrid 为 Could）——是否认可？
2. **MVP 蜕变仅视觉、不改 form/能力**——是否认可（能力增益留 Could）？
3. **4-stage 命名 supremacy**（苗/藤/花/果 取代 ux §6.3 三阶段提案）——是否确认，并据此修订 ux §6.3？
4. `GROWTH_PER_SEED=0.25`（4 颗满蜕变）默认值是否合适（影响单关种子密度与节奏）？
5. 是否据此进入 **Sprint 04 种子蜕变实现**（art topper 已定义、事件已契约，阻塞已解）？
