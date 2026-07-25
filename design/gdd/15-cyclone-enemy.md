# 15 气旋力场 · 扩展 GDD（cyclone）

> 类型：扩展 GDD（加法扩展 GDD02 物理力场 / GDD05 关卡实体）｜分层：Must（新元素深）
> 依赖：02 Physics / 03 Character / 05 Level / 09 Audio（复用占位）
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：DS-BC-01
> 上游提案：design/proposals/new-mechanic-candidates.md（候选方案 C · 翔羽气旋，用户已拍板做 C）
> **正交红线**：不改 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子蜕变）/ 经济 / 种子；**新增极小的纯函数力场叠加**（无新物理子系统概念，仅 `stepCyclone` 力贡献）；不新增音频键。
> **与 GDD13/14 关系**：同为"新元素扩展 GDD"，八节结构对齐；气旋是**区域力场（辅助）**，形态/语义与鼓苞（危害刺柱）、弹藤（地面线圈）全异。

---

## 1. 概述（目的与范围）

新增**良性区域力场** `cyclone`（气旋 / 上升气流柱），为关卡引入**「持续垂直气控」**这一全新压力源与 mastery——现有物理只有重力 + 平台，无"反向持续力"。填补 4 旧敌与鼓苞/弹藤均无"把玩家持续托起"机制的空白。

- **范围**：仅扩充 `core/physics`（极小纯函数力场叠加）＋ 关卡实体（气柱 bbox）＋ 程序化占位渲染 ＋ 复用现有占位音；**不**改 form / sizeScale / 经济 / 种子。
- **落点层**：`core/physics`（纯逻辑，零平台，可 headless 单测）＋ `game/render`（占位气柱/粒子）＋ 音频复用占位（无新增 SFX 键）。

### 1.1 概念 / MDA（新动词 = 乘 / 控 / 离）

- **动词**：*乘（进入气柱被托起）/ 控（在气流中主动横移找出口）/ 离（择机脱离落到高台）*。玩家进入上升气流柱，被缓缓托起，须主动控横移、择机离场。
- **Mechanics**：玩家 body 与气柱 bbox 重叠期间，施加**向上加速度**（净向上），并**钳制上升速度**；玩家**保留水平操控**（INPUT_LEFT/RIGHT 仍生效）。离场后恢复纯重力。
- **Dynamics**：玩家形成"我在气流里也能稳住"的**胜任感**；"乘气流还是走地面"的**自主决策**；隐藏高台满足 **Discovery**。守"公平失败"支柱（力场确定性、可规避）。
- **Aesthetics**：Challenge（主，垂直气控）＋ Sensation（轻飘感）。
- **心流定位**：引入**持续力场**这一全新压力源，逼迫玩家练习**垂直气控**——全新 mastery；设计为**可规避区**（不强制穿越）以守 P1"精准掌控"红线。

> **OPEN-0（关键待定项 · 吸 / 推）**：气旋的受力方向存在两种候选——
> - **(A) 向心吸（centripetal）**：把玩家**拉向气柱中心**（径向向内力）。风险：易在中心形成"陷阱"（吸住 / 拖入墙 / 软锁），且逆玩家操控意志，违背 P1"精准掌控"。
> - **(B) 离心推 / 上抛（centrifugal / updraft）【推荐】**：把玩家**向上托起（上升气流）**，水平保留操控。最直观（"风托着你升"）、最可控、与 storm-sky 主题最契合、风险最低。
> **本 GDD 默认按 (B) 上抛/上升气流 编写全部数值与纯函数**；若用户拍板改 (A) 向心吸，受力模型改为径向内力（见 §4 备选公式），并需额外加"逃逸窗口"防软锁。**请主理人将 OPEN-0 带回用户拍板。**

---

## 2. 机制详述（行为规格）

气旋是**区域力场**（非击杀型实体），纯函数计算每帧力贡献，集成层套用。零平台、可单测。

| 维度 | 行为（默认 = 上抛 updraft） | 碰撞 / 危害 | 可踩 | 说明 |
|---|---|---|---|---|
| 区域 | 以 `(cx,cy)` 为中心、`w×h` 的竖直气柱 bbox | `overlaps()=true`（区域检测） | 否（非实体） | 玩家 body 与 bbox 重叠即生效 |
| 垂直力 | 施加 `ay = -liftAcc`（向上）；净垂直加速度 `= liftAcc − GRAVITY`（正值=净向上） | hazard=false | — | 持续托起 |
| 速度钳制 | 钳 `player.vy = max(player.vy, −riseMax)`（限制最大上升速度，防无限加速） | — | — | 温和可控 |
| 水平力 | `ax = 0`（保留完整 INPUT_LEFT/RIGHT 操控）【`dragX=0` 默认】 | — | — | 守 P1 精准掌控 |
| 动画态 | `phase` 随时间推进（漩涡视觉，仅渲染用） | — | — | 纯时间驱动 |

- **进入/脱离**：玩家 body 进入 bbox → 力生效；离开 bbox → 力消失，恢复纯重力（自然下落）。**可规避**：玩家可走地面绕开气柱。
- **危害定位（明确声明）**：气旋**恒无危害**（`hazard=false`）；"失控上升"是**挑战**非**伤害**——玩家可主动横移脱离，不会因此受伤（守 GDD07 非瞬杀 + 公平失败）。
- **水平操控保留**：默认 `dragX=0`，玩家在气流中仍可左右移动找出口——这是与"向心吸（逆操控）"的核心区别，也是推荐 (B) 的主因。

---

## 3. 数据模型（纯函数 + 零平台落点）

### 3.1 `enemy-config.json` 新增项（集中数值，禁止硬编码）

```json
{
  "cyclone": {
    "liftAcc": 2600,
    "riseMax": 220,
    "dragX": 0,
    "width": 96,
    "height": 160,
    "phaseSpeed": 3.0,
    "hazard": false
  },
  "bouncy_vine": { "...": "不变" }
}
```
> `liftAcc=2600` → 净向上 `2600−1800=+800 px/s²`（GRAVITY=1800，GDD02）；`riseMax=220` 限制上升速度；`width/height` 定义气柱 bbox（默认 3×5 tile）。

### 3.2 关卡实体 schema 扩展（per-instance 覆盖）

气旋作为 `entities[]` 中一类实体（与弹藤同款 schema 统一性），用 `params` 定义气柱尺寸/强度：

```ts
export interface EnemyEntityDef {
  type: EnemyTypeName;          // 含 'cyclone'
  x: number;                    // 气柱左（px）
  y: number;                    // 气柱顶（px）
  params?: { w?: number; h?: number; liftAcc?: number; riseMax?: number; dragX?: number };
}
```
- `params.w/h`：气柱宽/高（px）；缺省用 config 默认。
- `params.liftAcc/riseMax/dragX`：实例级强度覆盖（如"弱气流"降 `liftAcc`、窄 `w`）。
- 注：气旋也可实现为 `LevelData.zones[]`（提案 C 原案）；本 GDD 为关卡 schema 统一（沿用 `entities[]`），**实现细节由工程层定**，纯函数契约不变。

### 3.3 纯函数状态机（core/physics 加法，零平台）

```ts
interface CycloneCfg {
  liftAcc: number;   // 上抛加速度（px/s²，向上为正；套用时 ay=-liftAcc 因 Y 向下为正）
  riseMax: number;   // 上升速度上限（px/s，正值；套用 vy=max(vy,-riseMax)）
  dragX: number;     // 水平拖拽系数（1/s，默认 0=保留完整操控）
  width: number;     // 气柱宽（px）
  height: number;    // 气柱高（px）
  phaseSpeed: number;// 漩涡动画角速度（rad/s，仅视觉）
}

interface PlayerBody { x:number; y:number; vx:number; vy:number; w:number; h:number; }

interface CycloneStep {
  phase: number;     // 漩涡动画相位（0..2π，时间推进，仅渲染）
  inZone: boolean;   // 玩家是否位于气柱内
  fx: number;        // 本帧水平力贡献（px/s²；默认 0，dragX>0 时作回中拖拽）
  fy: number;        // 本帧垂直力贡献（px/s²，向上为负；inZone 时 =-liftAcc，否则 0）
}

/**
 * 单步力场纯函数。
 * @param cfg 力场数值
 * @param player 玩家只读 body（x/y/vx/vy/w/h 由集成层传入，零平台派生）
 * @param dt 步长（秒，固定步长 1/60）
 * @returns { phase, inZone, fx, fy } —— 集成层在 stepBody 后叠加：
 *          player.vy += fy*dt（并钳 max(·,-riseMax)）；player.vx += fx*dt（dragX>0 时）
 *
 * 任务所述 stepCyclone(state, dt) 中 state 对应本规格的 phase（漩涡动画态）；
 * 因力场需玩家位置算力，完整签名为 stepCyclone(cfg, player, dt)（输入仅 cfg+只读 body+dt，零平台）。
 */
function stepCyclone(cfg: CycloneCfg, player: PlayerBody, dt: number): CycloneStep {
  // inZone = AABB(player) 与 气柱(cx±w/2, cy..cy+h) 相交
  // fy = inZone ? -cfg.liftAcc : 0
  // fx = inZone ? (cfg.dragX>0 ? -cfg.dragX*(player.cx - colCx) : 0) : 0  // 默认 0
  // phase = (prevPhase + cfg.phaseSpeed*dt) mod 2π  // 仅动画
}
```

- **集成套用**：在既有 `stepBody`（GDD02）之后调用；`player.vy += fy*dt`，再钳 `player.vy = max(player.vy, -riseMax)`；`player.vx += fx*dt`。离场后 `fy=0` 自然恢复重力。
- **`overlaps(body)`**：返回 body 与气柱 bbox 是否相交（区域检测），`hazard=false`。

### 3.4 core 零平台落点（具体文件）

| 文件 | 改动 | 平台约束 |
|---|---|---|
| `src/core/enemy/enemy-types.ts` | `EnemyTypeName` 联合**加法**增 `'cyclone'` | 零 phaser/wx/window |
| `src/core/physics/cyclone.ts` | 新增（仿纯函数）：`stepCyclone` + `CycloneCfg/Step` + `cycloneForce()` | 零平台，纯函数 |
| `src/core/physics/index.ts` 或 `stepBody` 调用点 | 在 `stepBody` 后叠加 `applyCyclone`（遍历关卡的 cyclone 实体） | 零平台 |
| `src/config/enemy-config.json` | 增 `cyclone` 项（§3.1） | 纯 JSON |
| `src/game/render/cyclone-view.ts` | 程序化占位绘制半透明气柱 + 上升粒子（MVP 无 PNG） | 仅 game/ 层 |
| `src/game/audio/*` | **不新增** SFX 键，复用现有占位音（见 §6） | — |

---

## 4. 公式（受力 / 几何，标单位）

- **净垂直加速度**：`a_net_y = liftAcc − GRAVITY`（Y 向下为正）。默认 `2600 − 1800 = +800 px/s²`（净向上）。
- **上升速度钳制**：`vy = max(vy, −riseMax)`；默认 `riseMax=220` → 最大上升速度 220 px/s（温和可控，约 1.6 tile/s 持续上升）。
- **气柱内持续上升高度**：以 `riseMax=220` 持续上升，`h=160px`（5 tile）气柱内可稳定托到柱顶；出柱后自然下落。
- **水平**：`ax = 0`（默认）→ 玩家横移速度不变；若 `dragX>0`，`ax = −dragX·(player.cx − colCx)`（朝柱心轻回中，帮助留在气流），默认关闭以保操控。
- **几何**：气柱 bbox = `[cx−w/2, cx+w/2] × [cy, cy+h]`；`overlaps` 用 AABB 相交。

> **§4 备选（若 OPEN-0 拍板 = 向心吸 centripetal）**：
> - 径向内力：`ax = −k·(player.cx−colCx)`、`ay = −k·(player.cy−colCy) + (−liftAcc)`（朝心 + 上抛），`k` 为吸力系数；玩家被拉向中心。
> - 须加**逃逸窗口**：`inZone` 持续 > `escapeMs`（如 1500ms）后力衰减 / 反向推离，防中心软锁；且碰撞墙时不叠伤（守 GDD07）。
> - 风险显著高于上抛，故**不推荐**作为默认。

---

## 5. 边缘情况（≥3 类）

1. **玩家在气柱顶出柱**：`inZone=false` → `fy=0`，力消失，恢复纯重力自然下落；不会"射出柱顶"（无额外上抛脉冲）。
2. **上升速度超 `riseMax`**：每帧钳 `vy=max(vy,−riseMax)`，杜绝无限加速 / 飘出屏。
3. **玩家高速自侧方坠入气柱**：`inZone` 成立即生效，`fy=-liftAcc`作用（实际净向上）→ 下落被抵消并转为上升；无需"干净进入"。
4. **多气柱重叠**：各 cyclone 独立算 `fy` 后**叠加**；最终 `vy` 仍钳 `max(·,−riseMax)`，不会因叠柱突破上限。
5. **气柱 + 弹藤接力**：弹藤把玩家弹入气柱，气柱续托更高 → 可达 ~5.6 tile 秘密（设计预期，非 bug）；坐标由关卡确保落点安全。
6. **气柱内横向离场寻路**：因 `ax=0`（默认），玩家可随时 INPUT 脱离；若误入，横移两步即出柱下落——无软锁（守 P1）。

---

## 6. UI 接口（渲染 / 音频，程序化占位）

- **渲染**：`game/render/cyclone-view.ts` 程序化占位（半透明天蓝气柱 `#5BC8F5` alpha≤0.35 + 蓝紫 `#6E7BF2` 漩涡辉光 + 上升叶片/花瓣粒子，沿 `phase` 旋转）。MVP 无 PNG。颜色见 §7.3。
- **音频（用户拍板：复用现有占位音，不新增 SFX 键）**：
  - 进入气柱：可复用既有 `SFX_JUMP`（轻"起"占位）或**不发声**（静默力场）；**不新增任何 SFX 键**（守 GDD09 决议）。
  - 不在 `SfxName` 枚举增项。
- **集成事件**：气旋为**连续力场**，无离散事件；仅通过 `stepCyclone` 每帧力贡献驱动物理。不发射 `ON_STOMP`/`ON_BOUNCE`/任何经济事件（守"无主导策略"红线）。

---

## 7. 依赖与正交性 / IP / 配色

### 7.1 与 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子）正交声明

- **GDD06（form）**：气旋只读 `player.vy/vx`，**不**写 `form`；零经济事件（不进分）。
- **GDD07（sizeScale）**：气旋 **不**改 `sizeScale`；力场仅改 `vy` 积分，与受伤尺寸状态机正交。
- **GDD12（种子）**：气旋与种子**零耦合**；不读写成长、不进分。
- **core 零平台**：`stepCyclone` 纯函数，输入仅 `cfg + 只读 player + dt`，无 window/phaser。
- **物理子系统**：仅**加法**极小力场叠加（仿提案 C `applyZones`），不引入新子系统概念。

### 7.2 IP 原创（升叶旋风，非任天堂机关）

- 命名"翔羽气旋"= 卷着落叶/花瓣上升的气旋，自然隐喻；**非**任何任天堂机关（无风车、无云朵传送带）。
- 视觉：半透明天蓝气柱 + 上升叶片粒子，与鼓苞（橙刺柱）、弹藤（绿线圈）形态全异。

### 7.3 锁色板配色建议（限锁色板内）

锁色板（≤64，11 色权威，见 cave-biome-spec §0）：天蓝 `#5BC8F5` / 蓝紫 `#6E7BF2` / 环境冷蓝 `#4A78C0` / 描边 `#2A1A12` / 暖黄 `#FFD23F` / 警示红 `#E8483B` / 草绿 `#7CC242` / 暖橙 `#F2933C` / 阴影绿 `#5FA82F` / 命粉 `#F26D8B` / 经济金 `#F2C94C`。

- **气柱主体**：**天空 `#5BC8F5`**（半透明，storm-sky 主题主色）＋ alpha≤0.35。
- **漩涡辉光**：**蓝紫 `#6E7BF2`**（次级蓝调，冷中藏暖对比）。
- **上升粒子（叶/瓣）**：**暖黄 `#FFD23F`** 点缀（轻暖反差，非危险语义）。
- **描边**：`#2A1A12`。**不新增色板色**。
- **区分强化**：鼓苞=实心橙刺柱（危害）/ 弹藤=实心绿线圈（地面辅助）/ 气旋=**半透明蓝气柱（空中力场）**——形态（实心柱 vs 线圈 vs 气柱）+ 透明度 + 颜色三重区分，色盲安全（靠"实心 vs 半透明气柱"形状语言）。

---

## 8. 验收标准

- [ ] 气旋力场由纯函数 `stepCyclone(cfg, player, dt)` 驱动，返回 `{phase, inZone, fx, fy}`，可单测（headless）。
- [ ] 默认上抛：净向上 `liftAcc−GRAVITY=+800 px/s²`；`riseMax=220` 钳速生效。
- [ ] 玩家保留水平操控（`ax=0` 默认）；离场恢复纯重力。
- [ ] **全态 hazard=false**（纯辅助，无伤害）；可规避（走地面绕开）。
- [ ] 多气柱叠加仍钳 `vy≤riseMax`；无无限加速 / 飘出屏。
- [ ] 与 GDD06 form / GDD07 sizeScale / GDD12 种子正交：不改 form / sizeScale / 种子；零经济事件。
- [ ] 音频：仅复用现有占位音，无新增 SFX 键。
- [ ] 配色限锁色板内（天蓝气柱 + 蓝紫辉光 + 暖黄粒子），与鼓苞 / 弹藤区分。
- [ ] IP 安全：升叶旋风、非任天堂机关。
- [ ] **OPEN-0（吸/推）已拍板为"上抛 updraft"**（若改向心吸，须附逃逸窗口并通过软锁评审）。

---

## 9. 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 持续力场破坏 P1 手感（失控上升） | `riseMax` 钳速 + `liftAcc` 集中 config + 可规避设计；手感沙盒量化 |
| R2 | 向心吸软锁（若 OPEN-0 选 A） | 默认推荐上抛（B）；若选 A 须加逃逸窗口 + 评审（§4 备选） |
| R3 | 与弹藤/二段跳叠加过高 | 叠加后仍钳 `riseMax`；关卡落点由 content-spec 校准 |
| R4 | 多气柱性能 | 沿用对象池 + 仅激活屏内力场；纯函数无 GC 压力 |
| R5 | 认知过载（新元素 + 新主题） | 首个气旋关仅引入 1 新元素（气旋），不组合鼓苞/beat（见 2-3 content-spec §9） |
| R6 | 与 GDD04 踩踏管线冲突 | 气旋非实体、非可踩、`isStompable=false`，走独立力场通道 |

---

## 待主理人确认（OPEN 项）

- **OPEN-0（吸 / 推 · 关键）**：默认推荐 **(B) 离心上抛 / 上升气流**（可控、低风险、主题契合）。备选 (A) 向心吸（拉向中心，需逃逸窗口防软锁，风险高）。**请带回用户拍板。**
- **OPEN-1（力场强度）**：默认 `liftAcc=2600`（`net +800`）、`riseMax=220`。是否合适（可随 QA 调校）？
- **OPEN-2（水平操控）**：默认 `dragX=0`（保留完整操控，守 P1）。是否需轻微回中（`dragX>0`）帮助留在气流？
- **OPEN-3（2-3 旧敌组合）**：见 2-3-content-spec §4，本 GDD 推荐 `du_fu + chong_feng + shi_pao`（省略 `ci_li`），最终 3 选由用户拍板。

*本扩展 GDD 仅新增 15 + 配套 2-3 content-spec/design；未改动现有 GDD、未写 `src/`、未 git commit。*
