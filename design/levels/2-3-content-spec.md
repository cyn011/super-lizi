# 关卡内容规格 · 2-3（机器可转录）

> 配套 `2-3-design.md`（设计意图）。本文件供工程主程**零歧义**转录为 `src/config/levels/2-3.json`。
> 结构对齐 `2-1` / `2-2-content-spec.md`（字段同 schema：tiles / entities / props / checkpoints / goal / beat / metadata / spawn）。
> 本文件**不写完整 JSON**（依任务要求仅给字段规划 / schema 要点 + 精确坐标表）。
> 关联 GDD：15-cyclone-enemy.md（气旋）、05-level-system.md、02-physics-collision.md、12-seed-metamorphosis.md。
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：DS-BC-01。

---

## 1. 字段总表（Field Table）

| 字段 | 值（2-3） | 说明 / 复用依据 |
|---|---|---|
| `id` | `"2-3"` | 世界第二关三关（气旋主题），进度链 2-1→2-2→2-3 |
| `version` | `1` | 首版 |
| `tileSize` | `32` | 全局约定 |
| `width` | `46` | 与 2-2(46) 同章节；内部分辨率 46×32=1472px 宽、9×32=288 高 |
| `height` | `9` | 全局约定 |
| `metadata.name` | `"风暴天空"` | 命名建议（D1：可改） |
| `metadata.theme` | `"storm_sky"` | 新主题；蓝系主导，复用现有锁色（见 §6 + 附录 A）；须扩 `LevelTheme` 联合 + palette 注册 |
| `metadata.parTimeMs` | `78000` | 建议基准值，待 QA 调校（略高于 2-2，气旋更费时） |
| `spawn.x/y` | `64` / `190` | 出生点（tx2，脚底贴地面 ty7 顶 y=224） |
| `goal.type` | `"triumph_gate"` | 凯旋之门（IP 安全终点） |
| `goal.x/y/w/h` | `1408` / `160` / `32` / `64` | x=1408=tx44，x+w=1440<1472 ✅ |
| `beat.enabled` | `false` | **本关不启用节拍平台**（见 §9：仅引入 1 新元素气旋，避免双机制认知过载） |
| `beat.tracks` | `[]` | 无谱面 |
| `beatPlatforms` | 省略 | 无节拍平台 |
| `tiles[]` | 见 §3 | 地面 ty7-8 全宽 + 墙列 + oneway 高台（风暴天空垂直主题） |
| `entities[]` | 见 §4 | 旧敌×3(推荐) + 气旋×4 + 6 seed + 2 checkpoint + 8 coin |
| `checkpoints[]` | `[]` | 检查点走 `entities[]`（同 1-1/1-2/2-1/2-2 形态） |
| `props[]` | `[]` | 无 |

---

## 2. 坐标自洽校验（Coordinate Invariants）

- 内部分辨率：`tileSize=32`，`width=46` → 世界宽 `1472px`；`height=9` → 高 `288px`。约束：`tx∈[0,46)`、`ty∈[0,9)`、`x∈[0,1472)`、`y∈[0,288)`。
- 地面：所有 `tx∈[0,46)`，`ty∈{7,8}`，kind=`solid` → 92 块（连续，无坑）。
- 边界墙：左列 `tx=0` 与右列 `tx=45`，`ty∈[0,8]`，kind=`solid` → 18 块（ty7,ty8 与地面重复，loader 去重）。
- oneway（风暴高台，kind="oneway"）：`(5,6)@ty3`、`(22,23)@ty3`、`(33,34)@ty5` → 6 块。
- 实体 `y` 约定：地面实体 y=200；**气旋 y=224（地面锚点，气柱自此处向上延伸 `params.h`，见 GDD15 §3.2）**；checkpoint y=176；du_fu y=120、shi_pao y=100、chong_feng y=200；高位 seed/coin 落在 oneway 台上（y≈80/96）。
- 边界：最大实体 x=1408(goal) / 1376(checkpoint) <1472 ✅；所有 y<288 ✅。
- 计数（见 §4）：coin×8、cyclone×4、du_fu×2、chong_feng×2、shi_pao×2、seed×6、checkpoint×2 = 共 26。

---

## 3. `tiles[]` 规划（全部 solid / oneway）

**地面 ty7-8（tx 0→45，每列两块）：** 共 92 块，连续无坑。
**边界墙（重复声明风格）：** 左列 tx0: ty0–8（9 块）；右列 tx45: ty0–8（9 块，ty7,ty8 与地面重复）。
**oneway（风暴高台，kind="oneway"）：**
```
(tx5,ty3)(tx6,ty3)(tx22,ty3)(tx23,ty3)(tx33,ty5)(tx34,ty5)   // 6 块
```
> 高台用途：(5,6)@ty3 = 首处气旋教学落点（置 seed_01）；(22,23)@ty3 = 考试气旋落点（置高位 coin）；(33,34)@ty5 = 终前 ledge（节奏回落）。气柱自地面向上托起玩家到 These 高台。

---

## 4. `entities[]` 精确坐标表

| idx | type | x | y | 备注 |
|---|---|---|---|---|
| 1 | coin | 128 | 200 | 热身·地面 |
| 2 | cyclone | 160 | 224 | 教学气旋 `params{w:96,h:160}`；托起够 (5,6)@ty3 高台 |
| 3 | seed | 176 | 80 | **seed_01**，置于 oneway(5,6)@ty3 台上（高位，需气旋托起） |
| 4 | coin | 224 | 200 | 地面 |
| 5 | du_fu | 288 | 120 | 漂浮（空中协同，气旋把玩家送进其空域） |
| 6 | coin | 352 | 200 | 地面 |
| 7 | seed | 416 | 200 | **seed_02**，藤阶段触发点 |
| 8 | cyclone | 480 | 224 | 中段机动气旋 `params{w:96,h:160}`（闪避/越障） |
| 9 | coin | 512 | 200 | 地面 |
| 10 | seed | 544 | 200 | **seed_03**，花阶段触发点 |
| 11 | chong_feng | 608 | 200 | 冲锋·地面（威胁气旋起飞基地） |
| 12 | shi_pao | 672 | 100 | 石炮·高位（逼垂直闪避） |
| 13 | cyclone | 704 | 224 | 考试气旋 `params{w:96,h:160}`；托起够 (22,23)@ty3 高台 |
| 14 | coin | 736 | 80 | 高位赏金，置于 oneway(22,23)@ty3 台上（气旋奖励） |
| 15 | du_fu | 800 | 120 | 漂浮 |
| 16 | seed | 864 | 200 | **seed_04**，果阶段触发点（mid 检查点前） |
| 17 | checkpoint | 928 | 176 | **mid 检查点** |
| 18 | coin | 1024 | 200 | gauntlet 前·地面 |
| 19 | seed | 1056 | 200 | **seed_05**，收集余量 |
| 20 | chong_feng | 1120 | 200 | 冲锋·gauntlet |
| 21 | shi_pao | 1184 | 100 | 石炮·高位·gauntlet |
| 22 | cyclone | 1248 | 224 | gauntlet 垂直机动气旋 `params{w:96,h:160}` |
| 23 | coin | 1280 | 200 | 地面 |
| 24 | seed | 1312 | 200 | **seed_06**，收集余量 |
| 25 | checkpoint | 1376 | 176 | **gauntlet 前检查点**（防劝退） |
| 26 | coin | 1344 | 200 | 门前赏金 |

> 计数：coin×8、cyclone×4、du_fu×2、chong_feng×2、shi_pao×2、seed×6、checkpoint×2 = 共 26 实体。
> **敌种组合（气旋 + 3 旧敌，明确列出 · OPEN-3 待拍板）**：推荐 = `cyclone`(×4) + `du_fu`(×2) + `chong_feng`(×2) + `shi_pao`(×2)；**有意省略 `ci_li`**（地面刺球与垂直气旋主题协同弱，降密度突出气旋）。`ci_li` 可由用户拍板换入（替换 du_fu/chong_feng 其一）。
>
> **演示路径（前 4 颗触发四阶段）**：按 x 升序可达顺序，前 4 颗种子使玩家一局内走过 苗→藤→花→果（GDD12 §3.3，`growthPerSeed=0.25`）：
> `seed_01(176,高位需气旋) → seed_02(416) → seed_03(544) → seed_04(864)`（sprout→vine→bloom→fruit）；
> 余 `seed_05(1056)`、`seed_06(1312)` 为收集探索余量（不强制四阶段）。
> **垂直必要性**：seed_01 落于 ty3 高台（离地 ~4.5 tile），单/二段跳（≤3.6 tile）不可及，须气旋托起（GDD15：净向上 +800 px/s²、riseMax 220 持续托到柱顶）；考试气旋(13) 落点 (22,23)@ty3 高位 coin(14) 同理。

---

## 5. Level JSON 字段规划（schema 要点 · 非完整 JSON）

> 依任务要求，**不落盘完整 JSON**；以下为转录要点与 schema 增量，供工程主程直接扩写 `2-3.json`。

**顶层字段（同 2-1/2-2 schema）：** `id / version / tileSize(32) / width(46) / height(9) / tiles[] / entities[] / props[] / checkpoints[] / goal / beat / metadata / spawn`。

**`entities[]` 类型增量（schema 要点）：**
```jsonc
{
  "type": "cyclone",            // 新增类型（须同步扩 EnemyTypeName 联合 + enemy-config + physics 力场叠加）
  "x": 160, "y": 224,           // y=224 = 地面锚点（气柱自此处向上延伸 params.h）
  "params": { "w": 96, "h": 160, "liftAcc": 2600, "riseMax": 220, "dragX": 0 }
  // w/h 气柱尺寸；liftAcc/riseMax/dragX 实例级强度覆盖（默认见 GDD15 §3.1）
}
// 其余类型（du_fu/chong_feng/shi_pao/coin/seed/checkpoint）沿用 2-1/2-2 schema；
// seed 带 "seedId"；高位 seed/coin 用 elevated y（落在 oneway 台上）。
```
> 注：气旋也可实现为 `LevelData.zones[]`（提案 C 原案）；本 GDD 为关卡 schema 统一（沿用 `entities[]`），**实现细节由工程层定**，纯函数契约（GDD15 §3.3 `stepCyclone`）不变。

**`beat` 字段：** `{ "enabled": false, "bpm": 120, "grid": 8, "tracks": [] }`（沿用占位，无节拍平台）。

**`metadata` 字段：** `{ "name": "风暴天空", "theme": "storm_sky", "parTimeMs": 78000 }`（`theme` 为新增取值，见 §6 + 附录 A）。

**`goal` 字段：** `{ "type": "triumph_gate", "x": 1408, "y": 160, "w": 32, "h": 64 }`。

---

## 6. biome 氛围意图（风暴天空 · 蓝系主导）

- **意图**：阴沉风暴天空——蓝紫岩台悬浮、冷蓝天光、暖橙闪电点缀、半透气旋卷叶，靠**蓝紫主色 + 冷蓝天光 + 暖橙微光**制造"压抑中藏生机"的对比（对齐 P3 蜕变世界观）。
- **程序化占位**：MVP 全程序化（Graphics 色块 + 半透明气柱），**守锁色板**；具体 palette 由 art-director 定（见附录 A）。不新增色板色。
- **结构不变**：仅换主色 / 装饰（GDD05 §3「主题切换仅换色不换形」）；tile 网格与功能色语义不变。
- **COLOR DELTA：0 新增色**。本关全部引用色取自 11 色锁色板（蓝紫/环境冷蓝/天空/暖橙/暖黄/描边/警示红/草绿/阴影绿/命粉/经济金），无新增 hex，总色数 ≤64 红线。

---

## 7. 难度定位（相对 2-2 递进）

- **整体**：略高于 2-2，但以**垂直气控为主**（气旋持续托起 + 主动横移脱离），不构成"硬核突然死亡"。
- **波浪曲线**：热身（coin/seed）→ 教学气旋（idx2→oneway 高台 seed_01，记托起）→ 空中协同 + 地面威胁（du_fu/chong_feng/shi_pao）→ mid 检查点 → 考试气旋（idx13→ty3 高位 coin，考试"乘气流+控横移"）→ gauntlet 垂直机动（idx22）→ gauntlet 前检查点 → 缓降终点。
- **新元素密度**：气旋作为唯一新元素，密度克制（4 处，含 1 考试），不给玩家同时学两个新机制（不组合弹藤/鼓苞/beat）。
- **检查点**：2 个（mid + gauntlet 前），防劝退，与 2-1/2-2 密度一致。

---

## 8. 机关说明

- **默认不组合弹藤 / 鼓苞 / beat**：用户拍板仅引入气旋一个新元素；本关 `beat.enabled=false` 且**不含任何 bouncy_vine / gu_bao / beatPlatforms**，避免"垂直力场 + 弹跳 + 时序"多新机制叠加导致认知过载（守 P1/P2/P3 支柱）。
- 气旋"向心吸"变体（提案 C 外）留 **Could**：本 MVP 按 GDD15 默认**上抛/上升气流**（可控、低风险）；若用户拍板改"向心吸"，须加逃逸窗口防软锁（见 GDD15 §4 备选 + OPEN-0）。

---

## 9. 转录校验清单（Transcription Checklist for Engineering Lead）

- [ ] `tileSize=32`、`width=46`、`height=9`；所有 `tx∈[0,46)`、`ty∈[0,9)`；所有 `x∈[0,1472)`、`y∈[0,288)`（goal x+w=1440<1472 ✅）。
- [ ] 地面 `ty7-8` 全 46 列连续；左右墙 `tx0`/`tx45` ty0-8 声明。
- [ ] oneway `(5,6)@ty3`、`(22,23)@ty3`、`(33,34)@ty5` 已声明（风暴高台）。
- [ ] 气旋实体 `y=224`（地面锚点，气柱向上延伸 `params.h`）；`params.w/h/liftAcc/riseMax` 已保留。
- [ ] 6 颗种子沿通关路径分布（seed_01..seed_06）；seed_01 高位（y=80）需气旋托起；前 4 颗可达顺序触发 苗→藤→花→果。
- [ ] 2 检查点（x=928 / x=1376，y=176）已声明；`goal.type` 沿用 `"triumph_gate"`（IP 安全）。
- [ ] `beat.enabled=false`、`tracks:[]`、无 `beatPlatforms`（本关不引入节拍平台，避免与气旋双新机制）。
- [ ] `metadata.theme="storm_sky"`（biome 氛围接线点，见附录 A）；须扩 `LevelTheme` 联合 + palette 注册。
- [ ] 不引入新 entity type 之外类型：`cyclone` 为新增类型，需同步扩展 `EnemyTypeName`、力场纯函数（`core/physics/cyclone.ts` + `stepBody` 叠加）、`enemy-config.json`、占位渲染（GDD15 §3.4）；其余沿用 du_fu/chong_feng/shi_pao/coin/seed/checkpoint + solid/oneway。
- [ ] 音频：仅复用现有占位音（无新增 SFX 键，GDD15 §6）。

---

## 附录 A：给 art-director 的风暴天空 biome 规格需求（0 新增色）

> 程序化占位 + 锁色板约束下的需求；最终 palette 变体由 art-director 敲定。所有色取自 11 色锁色板，**0 新增 hex**。

1. **风暴天空 palette 变体（限锁色板内，≤64 色）**
   - 背景 bg：`环境冷蓝 #4A78C0`（阴沉天光，锁色板 #10）。
   - 岩壁/悬浮台主面 rockFace：`蓝紫 #6E7BF2`（风暴岩台基色，锁色板 #9）。
   - 岩壁暗面 rockBody：`环境冷蓝 #4A78C0`（同 bg 冷调，锁色板 #10）。
   - 描边 outline：`#2A1A12`（全局描边，锁色板 #5）。
   - 闪电/暖意 firelight：`暖橙 #F2933C`（闪电点缀，锁色板 #3）。
   - 微光 crystalCore：`暖黄 #FFD23F`（电光核心，锁色板 #4）。
   - 辉光 crystalGlow：`天空 #5BC8F5`（冷蓝天光反差，锁色板 #11）。
   - 危险红 danger：`警示红 #E8483B`（仅 chong_feng/shi_pao 等，与气旋友好色解耦）。
2. **主题独有装饰（另绘少量，MVP Graphics 占位）**：悬浮岩台、闪电纹、卷叶粒子（非碰撞）。
3. **气旋占位绘制（GDD15 §7.3）**：半透明气柱 `天空 #5BC8F5`（alpha≤0.35）+ 漩涡辉光 `蓝紫 #6E7BF2` + 上升叶/瓣粒子 `暖黄 #FFD23F`；随 `phase` 旋转。与鼓苞（橙刺柱）/ 弹藤（绿线圈）形态 + 颜色全异（实心 vs 半透明气柱）。
4. **不新增色板色**：全部风暴视觉须在现有 11 色锁色板内；如确需派生暗面，由 `#4A78C0`/`#6E7BF2` 运行时 tint 生成（0 新增）。

---

## 附录 B：给 engineering-lead 的实现清单（要点）

1. **core/physics 气旋力场**（GDD15 §3.4）：`enemy-types.ts` 联合增 `'cyclone'`（与 `'bouncy_vine'` 同批）；`core/physics/cyclone.ts` 新增 `stepCyclone` 纯函数；`stepBody` 后叠加 `applyCyclone`（遍历关卡 cyclone 实体）；`enemy-config.json` 增 `cyclone` 项。
2. **2-3.json**：按 §5 schema 要点落盘（width=46 / theme=storm_sky / 26 实体）。
3. **LEVEL_ORDER 追加**：`['1-1','1-2','2-1','2-2']` → `['1-1','1-2','2-1','2-2','2-3']`。
4. **biome 氛围接线**：`metadata.theme="storm_sky"` 须扩 `LevelTheme` 联合（`'grass'|'cave'|'vine_forest'|'storm_sky'`）+ `THEME_PALETTES` 增 `storm_sky` 条目（附录 A 8 槽映射，全锁色板色，0 新增）。
5. **音频**：无新增 SFX 键（气旋为连续力场，复用占位或不发声，GDD15 §6）。
6. **回归**：`validateLevelData` 通过；loader 去重地面/墙；气旋走独立力场通道（GDD15），不破坏 4 旧敌 / 鼓苞 / 弹藤 / GDD06/07/12 正交性。

---

*机器规格交付完毕（字段规划 + 坐标表，未落完整 JSON），未 git commit；待主理人（游承峰）审批后由工程主程落盘 `src/config/levels/2-3.json` 并按附录 B 实施。本文件与 GDD15 同步新建，未修改现有 GDD、未写其他 `src/` 文件。*
