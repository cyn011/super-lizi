# 关卡内容规格 · 2-2（机器可转录）

> 配套 `2-2-design.md`（设计意图）。本文件供工程主程**零歧义**转录为 `src/config/levels/2-2.json`。
> 结构对齐 `2-1-content-spec.md`（字段同 schema：tiles / entities / props / checkpoints / goal / beat / metadata / spawn）。
> 本文件**不写完整 JSON**（依任务要求仅给字段规划 / schema 要点 + 精确坐标表），数据取自下方经人工校验的坐标。
> 关联 GDD：14-bouncy-vine-enemy.md（弹藤）、05-level-system.md、04-enemy-ai.md、12-seed-metamorphosis.md。
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：DS-BC-01。

---

## 1. 字段总表（Field Table）

| 字段 | 值（2-2） | 说明 / 复用依据 |
|---|---|---|
| `id` | `"2-2"` | 世界第二关次关（弹藤主题），进度链 2-1→2-2 |
| `version` | `1` | 首版 |
| `tileSize` | `32` | 全局约定 |
| `width` | `46` | 与 2-1(44) 同章节略长；内部分辨率 46×32=1472px 宽、9×32=288 高 |
| `height` | `9` | 全局约定 |
| `metadata.name` | `"藤林回响"` | 命名建议（D1：可改） |
| `metadata.theme` | `"vine_forest"` | 新主题；绿系主导，复用现有锁色（见 §6 + 附录 A）；须扩 `LevelTheme` 联合 + palette 注册 |
| `metadata.parTimeMs` | `76000` | 建议基准值，待 QA 调校 |
| `spawn.x/y` | `64` / `190` | 出生点（tx2，脚底贴地面 ty7 顶 y=224） |
| `goal.type` | `"triumph_gate"` | 凯旋之门（IP 安全终点） |
| `goal.x/y/w/h` | `1408` / `160` / `32` / `64` | x=1408=tx44（墙前一格），x+w=1440<1472 ✅ |
| `beat.enabled` | `false` | **本关不启用节拍平台**（见 §9：仅引入 1 新元素弹藤，避免双机制认知过载） |
| `beat.tracks` | `[]` | 无谱面 |
| `beatPlatforms` | 省略 | 无节拍平台 |
| `tiles[]` | 见 §3 | 地面 ty7-8 全宽 + 墙列 + oneway 高台（藤林垂直主题） |
| `entities[]` | 见 §4 | 旧敌×3(推荐) + 弹藤×4 + 6 seed + 2 checkpoint + 8 coin |
| `checkpoints[]` | `[]` | 检查点走 `entities[]`（同 1-1/1-2/2-1 形态） |
| `props[]` | `[]` | 无 |

---

## 2. 坐标自洽校验（Coordinate Invariants）

- 内部分辨率：`tileSize=32`，`width=46` → 世界宽 `1472px`；`height=9` → 高 `288px`。约束：`tx∈[0,46)`、`ty∈[0,9)`、`x∈[0,1472)`、`y∈[0,288)`。
- 地面：所有 `tx∈[0,46)`，`ty∈{7,8}`，kind=`solid` → 92 块（连续，无坑；垂直主题靠高台而非坑）。
- 边界墙：左列 `tx=0` 与右列 `tx=45`，`ty∈[0,8]`，kind=`solid` → 18 块（ty7,ty8 与地面重复，loader 去重）。
- oneway（藤林高台，kind="oneway"）：`(5,6)@ty3`、`(22,23)@ty4`、`(33,34)@ty5` → 6 块。
- 实体 `y` 约定：地面实体 y=200（敌/coin/seed 脚底贴 ty7 顶 y=224）；**弹藤 y=224（地面锚点，贴地，见 GDD14 §3.2）**；checkpoint y=176（高~48）；du_fu y=120、shi_pao y=100；高位 seed/coin 落在 oneway 台上（y≈80/96）。
- 边界：最大实体 x=1408(goal) / 1376(checkpoint) <1472 ✅；所有 y<288 ✅。
- 计数（见 §4）：coin×8、bouncy_vine×4、ci_li×2、du_fu×2、shi_pao×2、seed×6、checkpoint×2 = 共 26。

---

## 3. `tiles[]` 规划（全部 solid / oneway）

**地面 ty7-8（tx 0→45，每列两块）：** 共 92 块，连续无坑。
**边界墙（重复声明风格）：** 左列 tx0: ty0–8（9 块）；右列 tx45: ty0–8（9 块，ty7,ty8 与地面重复）。
**oneway（藤林高台，kind="oneway"）：**
```
(tx5,ty3)(tx6,ty3)(tx22,ty4)(tx23,ty4)(tx33,ty5)(tx34,ty5)   // 6 块
```
> 高台用途：(5,6)@ty3 = 首处弹藤教学落点（置 seed_01）；(22,23)@ty4 = 强档弹藤高台（置高位 coin）；(33,34)@ty5 = 终前ledge（节奏回落）。高台营造"垂直越障"主题，不另挖坑（避免引入坑死语义，守基线）。

---

## 4. `entities[]` 精确坐标表

| idx | type | x | y | 备注 |
|---|---|---|---|---|
| 1 | coin | 128 | 200 | 热身·地面 |
| 2 | bouncy_vine | 160 | 224 | 教学弹藤（normal）；弹起够 (5,6)@ty3 高台 |
| 3 | seed | 176 | 80 | **seed_01**，置于 oneway(5,6)@ty3 台上（高位，需弹藤够取） |
| 4 | coin | 224 | 200 | 地面 |
| 5 | ci_li | 288 | 200 | 地刺·地面巡逻 |
| 6 | coin | 352 | 200 | 地面 |
| 7 | seed | 416 | 200 | **seed_02**，藤阶段触发点 |
| 8 | bouncy_vine | 480 | 224 | normal；中段垂直机动点 |
| 9 | coin | 512 | 200 | 地面 |
| 10 | seed | 544 | 200 | **seed_03**，花阶段触发点 |
| 11 | du_fu | 608 | 120 | 漂浮（空中协同） |
| 12 | shi_pao | 672 | 100 | 石炮·高位（逼垂直闪避） |
| 13 | coin | 736 | 200 | 地面 |
| 14 | ci_li | 800 | 200 | 地刺·地面 |
| 15 | seed | 864 | 200 | **seed_04**，果阶段触发点（mid 检查点前） |
| 16 | checkpoint | 928 | 176 | **mid 检查点** |
| 17 | bouncy_vine | 992 | 224 | **strong**（params.power=strong，-816≈5.1tile）；够 (22,23)@ty4 高台 |
| 18 | coin | 1024 | 96 | 高位赏金，置于 oneway(22,23)@ty4 台上（强档弹藤奖励） |
| 19 | seed | 1056 | 200 | **seed_05**，收集余量 |
| 20 | du_fu | 1120 | 120 | 漂浮 |
| 21 | shi_pao | 1184 | 100 | 石炮·高位 |
| 22 | bouncy_vine | 1248 | 224 | normal；gauntlet 垂直机动 |
| 23 | coin | 1280 | 200 | 地面 |
| 24 | seed | 1312 | 200 | **seed_06**，收集余量 |
| 25 | checkpoint | 1376 | 176 | **gauntlet 前检查点**（防劝退） |
| 26 | coin | 1344 | 200 | 门前赏金 |

> 计数：coin×8、bouncy_vine×4、ci_li×2、du_fu×2、shi_pao×2、seed×6、checkpoint×2 = 共 26 实体。
> **敌种组合（弹藤 + 3 旧敌，明确列出 · OPEN-4 待拍板）**：推荐 = `bouncy_vine`(×4) + `ci_li`(×2) + `du_fu`(×2) + `shi_pao`(×2)；**有意省略 `chong_feng`**（水平冲锋与垂直主题协同弱，降密度突出弹藤）。`chong_feng` 可由用户拍板换入（替换 ci_li/du_fu 其一）。
>
> **演示路径（前 4 颗触发四阶段）**：按 x 升序可达顺序，前 4 颗种子使玩家一局内走过 苗→藤→花→果（GDD12 §3.3，`growthPerSeed=0.25`）：
> `seed_01(176,高位需弹藤) → seed_02(416) → seed_03(544) → seed_04(864)`（sprout→vine→bloom→fruit）；
> 余 `seed_05(1056)`、`seed_06(1312)` 为收集探索余量（不强制四阶段）。
> **垂直必要性**：seed_01 落于 ty3 高台（离地 ~4.5 tile），单/二段跳（≤3.6 tile）不可及，须弹藤（≈4 tile）或弹藤+二段（≈5.6 tile）；强档弹藤(17) + 二段可达 ty4 高台(18)。

---

## 5. Level JSON 字段规划（schema 要点 · 非完整 JSON）

> 依任务要求，**不落盘完整 JSON**；以下为转录要点与 schema 增量，供工程主程直接扩写 `2-2.json`。

**顶层字段（同 2-1 schema）：** `id / version / tileSize(32) / width(46) / height(9) / tiles[] / entities[] / props[] / checkpoints[] / goal / beat / metadata / spawn`。

**`entities[]` 类型增量（schema 要点）：**
```jsonc
{
  "type": "bouncy_vine",      // 新增类型（须同步扩 EnemyTypeName 联合 + enemy-config + enemy-ai 分支）
  "x": 160, "y": 224,         // y=224 = 地面锚点（贴地，见 GDD14 §3.2）
  "params": { "power": "normal" }   // 可选：'weak'|'normal'|'strong'；默认 normal
}
// 其余类型（ci_li/du_fu/shi_pao/coin/seed/checkpoint）沿用 2-1 schema；
// seed 带 "seedId"；高位 seed/coin 用 elevated y（落在 oneway 台上）。
```

**`beat` 字段：** `{ "enabled": false, "bpm": 120, "grid": 8, "tracks": [] }`（沿用 2-1 占位，无节拍平台）。

**`metadata` 字段：** `{ "name": "藤林回响", "theme": "vine_forest", "parTimeMs": 76000 }`（`theme` 为新增取值，见 §6 + 附录 A）。

**`goal` 字段：** `{ "type": "triumph_gate", "x": 1408, "y": 160, "w": 32, "h": 64 }`。

---

## 6. biome 氛围意图（藤林 · 绿系主导）

- **意图**：明亮藤林——草绿植被包裹、暖橙花点缀、半透绿荫，靠**草绿主色 + 暖橙暖意 + 暖黄微光**制造"生机向上"的对比（对齐 P3 蜕变世界观"种子唤醒大地"）。
- **程序化占位**：MVP 全程序化（Graphics 色块），**守锁色板**；具体 palette 由 art-director 定（见附录 A）。不新增色板色。
- **结构不变**：仅换主色 / 装饰（GDD05 §3「主题切换仅换色不换形」）；tile 网格与功能色语义不变。
- **COLOR DELTA：0 新增色**。本关全部引用色取自 11 色锁色板（草绿/阴影绿/暖橙/暖黄/描边/命粉/警示红/经济金/蓝紫/环境冷蓝/天空），无新增 hex，总色数 ≤64 红线。

---

## 7. 难度定位（相对 2-1 递进）

- **整体**：略高于 2-1，但以**垂直越障为主**（弹藤确定性弹起 + 高台落点），不构成"硬核突然死亡"。
- **波浪曲线**：热身（coin/seed）→ 教学弹藤（idx2→oneway 高台 seed_01，记弹起）→ 地面敌 + 空中协同（du_fu/shi_pao/ci_li）→ mid 检查点 → 强档弹藤高台（idx17→ty4 高位 coin，考试"弹藤+二段"）→ gauntlet 垂直机动（idx22）→ gauntlet 前检查点 → 缓降终点。
- **新元素密度**：弹藤作为唯一新元素，密度克制（4 处，含 1 强档），不给玩家同时学两个新机制（不组合气旋/鼓苞/beat）。
- **检查点**：2 个（mid + gauntlet 前），防劝退，与 2-1 密度一致。

---

## 8. 机关说明

- **默认不组合气旋 / 鼓苞 / beat**：用户拍板仅引入弹藤一个新元素；本关 `beat.enabled=false` 且**不含任何 cyclone / gu_bao / beatPlatforms**，避免"垂直力场 + 弹跳 + 时序"多新机制叠加导致认知过载（守 P1/P2/P3 支柱）。
- 宽沟穿越（提案 B 原案）留 **Could**：本 MVP 用**高台垂直够取**展示弹藤必要性（更稳，不引入坑死语义）；若后续要坑，可在 2-x 衍生关加 pit。

---

## 9. 转录校验清单（Transcription Checklist for Engineering Lead）

- [ ] `tileSize=32`、`width=46`、`height=9`；所有 `tx∈[0,46)`、`ty∈[0,9)`；所有 `x∈[0,1472)`、`y∈[0,288)`（goal x+w=1440<1472 ✅）。
- [ ] 地面 `ty7-8` 全 46 列连续；左右墙 `tx0`/`tx45` ty0-8 声明。
- [ ] oneway `(5,6)@ty3`、`(22,23)@ty4`、`(33,34)@ty5` 已声明（藤林高台）。
- [ ] 弹藤实体 `y=224`（地面锚点，非 200），`params.power` 已保留（idx17=strong）。
- [ ] 6 颗种子沿通关路径分布（seed_01..seed_06）；seed_01 高位（y=80）需弹藤够取；前 4 颗可达顺序触发 苗→藤→花→果。
- [ ] 2 检查点（x=928 / x=1376，y=176）已声明；`goal.type` 沿用 `"triumph_gate"`（IP 安全）。
- [ ] `beat.enabled=false`、`tracks:[]`、无 `beatPlatforms`（本关不引入节拍平台，避免与弹藤双新机制）。
- [ ] `metadata.theme="vine_forest"`（biome 氛围接线点，见附录 A）；须扩 `LevelTheme` 联合 + palette 注册。
- [ ] 不引入新 entity type 之外类型：`bouncy_vine` 为新增类型，需同步扩展 `EnemyTypeName`（+ `cyclone` 预留）、`enemy-config.json`、`enemy-ai.ts` 分支、`enemy-view.ts` 占位（GDD14 §3.4）；其余沿用 ci_li/du_fu/shi_pao/coin/seed/checkpoint + solid/oneway。
- [ ] 音频：仅复用现有占位音（`SFX_JUMP`/`SFX_LAND`），无新增 SFX 键（GDD14 §6）。

---

## 附录 A：给 art-director 的藤林 biome 规格需求（0 新增色）

> 程序化占位 + 锁色板约束下的需求；最终 palette 变体由 art-director 敲定。所有色取自 11 色锁色板，**0 新增 hex**。

1. **藤林 palette 变体（限锁色板内，≤64 色）**
   - 背景 bg：`天空 #5BC8F5`（森林天光，锁色板 #11）。
   - 岩壁/地面主面 rockFace：`草绿 #7CC242`（藤林基色，锁色板 #1）。
   - 岩壁暗面 rockBody：`阴影绿 #5FA82F`（草体阴影，锁色板 #2）。
   - 描边 outline：`#2A1A12`（全局描边，锁色板 #5）。
   - 花/暖意 firelight：`暖橙 #F2933C`（藤花点缀，锁色板 #3）。
   - 微光 crystalCore：`暖黄 #FFD23F`（孢子/微光，锁色板 #4）。
   - 辉光 crystalGlow：`蓝紫 #6E7BF2`（冷中藏暖，锁色板 #9）。
   - 危险红 danger：`警示红 #E8483B`（仅 ci_li 等，与弹藤友好色解耦）。
2. **主题独有装饰（另绘少量，MVP Graphics 占位）**：垂藤、叶簇、孢子光点（非碰撞）。
3. **弹藤占位绘制（GDD14 §7.3）**：藤体 `草绿 #7CC242` + 描边 `#2A1A12`；高光环 `暖黄 #FFD23F`（友好辅助）；SPRING 压缩 / RECOIL 松弛动画。与鼓苞（橙刺柱）形态 + 颜色双异。
4. **不新增色板色**：全部藤林视觉须在现有 11 色锁色板内；如确需派生暗面，由 `#7CC242`/`#5FA82F` 运行时 tint 生成（0 新增）。

---

## 附录 B：给 engineering-lead 的实现清单（要点）

1. **core/enemy 弹藤表**（GDD14 §3.4）：`enemy-types.ts` 联合增 `'bouncy_vine'`（+ `'cyclone'` 预留）；`enemy-ai.ts` 增分支 + `overlaps()` 全态 `hazard=false`；`bouncy-vine.ts` 新增纯函数；`enemy-config.json` 增 `bouncy_vine` 项。
2. **2-2.json**：按 §5 schema 要点落盘（width=46 / theme=vine_forest / 26 实体）。
3. **LEVEL_ORDER 追加**：`['1-1','1-2','2-1']` → `['1-1','1-2','2-1','2-2']`。
4. **biome 氛围接线**：`metadata.theme="vine_forest"` 须扩 `LevelTheme` 联合（`'grass'|'cave'|'vine_forest'|'storm_sky'` 预留）+ `THEME_PALETTES` 增 `vine_forest` 条目（附录 A 8 槽映射，全锁色板色，0 新增）。
5. **音频**：仅复用 `SFX_JUMP`/`SFX_LAND` 占位，无新增 SFX 键。
6. **回归**：`validateLevelData` 通过；loader 去重地面/墙；弹藤走独立 `ON_BOUNCE` 通道（GDD14 §6），不破坏 4 旧敌 / 鼓苞 / GDD06/07/12 正交性。

---

*机器规格交付完毕（字段规划 + 坐标表，未落完整 JSON），未 git commit；待主理人（游承峰）审批后由工程主程落盘 `src/config/levels/2-2.json` 并按附录 B 实施。本文件与 GDD14 同步新建，未修改现有 GDD、未写其他 `src/` 文件。*
