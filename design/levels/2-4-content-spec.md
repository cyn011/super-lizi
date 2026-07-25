# 关卡内容规格 · 2-4（剪影回廊 · 机器可转录）

> 配套 `2-4-design.md`（设计意图）。本文件供工程主程**零歧义**转录为 `src/config/levels/2-4.json`。
> 结构对齐 `2-1` / `2-2` / `2-3-content-spec.md`（字段同 schema：tiles / entities / props / checkpoints / goal / beat / metadata / spawn）。
> 本文件**不写完整 JSON**（依章节同构 2-2/2-3，仅给字段规划 / schema 要点 + 精确坐标表）。
> 关联 GDD：16-dufu-silhouette-enemy.md（嘟浮剪影）、05-level-system.md、04-enemy-ai.md、12-seed-metamorphosis.md。
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：DS-D1-01。
> **红线**：锁色板 ≤64、COLOR DELTA = 0 新增色（复用 11 色锁色板 + vine_forest 既有 palette）；不新开 biome；不新增音频键；本文件**只写文档，不写/改任何 `.ts` 代码**。

---

## 1. 字段总表（Field Table）

| 字段 | 值（2-4） | 说明 / 复用依据 |
|---|---|---|
| `id` | `"2-4"` | 世界第二关终关（剪影主题），进度链 2-1→2-2→2-3→2-4 |
| `version` | `1` | 首版 |
| `tileSize` | `32` | 全局约定 |
| `width` | `46` | 与 2-2/2-3 同章节（World 2 收尾关）；内部分辨率 `46×32 = 1472px` 宽、`9×32 = 288` 高 |
| `height` | `9` | 全局约定 |
| `metadata.name` | `"剪影回廊"` | 命名建议（D1：可改） |
| `metadata.theme` | `"vine_forest"` | **推荐复用**（亮背景确保暗剪影高对比）；见 §6 + OPEN-THEME；须 `LevelTheme` 联合已含 `'vine_forest'` |
| `metadata.parTimeMs` | `80000` | **占位**（建议基准值，待 QA 调校，略高于 2-3 因镜像读图更费时） |
| `spawn.x/y` | `64` / `190` | 出生点（tx2，脚底贴地面 ty7 顶 y=224） |
| `goal.type` | `"triumph_gate"` | 凯旋之门（IP 安全终点） |
| `goal.x/y/w/h` | `1408` / `160` / `32` / `64` | x=1408=tx44（墙前一格），x+w=1440<1472 ✅ |
| `beat.enabled` | `false` | **本关不启用节拍平台**（见 §9：仅引入 1 新元素剪影，避免双机制认知过载） |
| `beat.tracks` | `[]` | 无谱面 |
| `beatPlatforms` | 省略 | 无节拍平台 |
| `tiles[]` | 见 §3 | 地面 ty7-8 全宽 + 墙列 + oneway 高台（vine_forest 垂直主题，复用 2-2 布局） |
| `entities[]` | 见 §4 | 新元素 `du_fu_silhouette`×3 + 旧敌×3 类型（`du_fu`×3 / `ci_li`×2 / `shi_pao`×2）+ 6 seed + 2 checkpoint + 8 coin |
| `checkpoints[]` | `[]` | 检查点走 `entities[]`（同 1-1/1-2/2-1/2-2/2-3 形态） |
| `props[]` | `[]` | 无 |

---

## 2. 坐标自洽校验（Coordinate Invariants）

- 内部分辨率：`tileSize=32`，`width=46` → 世界宽 `1472px`；`height=9` → 高 `288px`。约束：`tx∈[0,46)`、`ty∈[0,9)`、`x∈[0,1472)`、`y∈[0,288)`。
- 地面：所有 `tx∈[0,46)`，`ty∈{7,8}`，kind=`solid` → 92 块（连续，无坑；垂直主题靠高台而非坑）。
- 边界墙：左列 `tx=0` 与右列 `tx=45`，`ty∈[0,8]`，kind=`solid` → 18 块（ty7,ty8 与地面重复，loader 去重）。
- oneway（藤林高台，kind="oneway"，复用 2-2 布局）：`(5,6)@ty3`、`(22,23)@ty4`、`(33,34)@ty5` → 6 块。
- 实体 `y` 约定：地面实体 y=200；**剪影/嘟浮 y=120（浮动基准 baseY）**；`shi_pao` y=100（高位）；checkpoint y=176；seed/coin 落地面 y=200（本关刻意不强制高位，聚焦"空中镜像读图"而非垂直越障，与 2-2 差异化）。
- 边界：最大实体 x=1408(goal) / 1376(checkpoint) <1472 ✅；所有 y<288 ✅。
- 计数（见 §4）：coin×8、`du_fu_silhouette`×3、`du_fu`×3、`ci_li`×2、`shi_pao`×2、seed×6、checkpoint×2 = 共 26。

---

## 3. `tiles[]` 规划（全部 solid / oneway）

**地面 ty7-8（tx 0→45，每列两块）：** 共 92 块，连续无坑。
**边界墙（重复声明风格）：** 左列 tx0: ty0–8（9 块）；右列 tx45: ty0–8（9 块，ty7,ty8 与地面重复）。
**oneway（藤林高台，kind="oneway"，复用 2-2）：**
```
(tx5,ty3)(tx6,ty3)(tx22,ty4)(tx23,ty4)(tx33,ty5)(tx34,ty5)   // 6 块
```
> 高台用途：与 2-2 同构但本关**不强制**弹藤够取（剪影关聚焦空中镜像）；高台作视觉/探索余地，避免与 2-2 的"弹藤垂直越障"身份撞车。

---

## 4. `entities[]` 精确坐标表

> **敌种组合（剪影 + 3 旧敌 · OPEN-COMBO 待拍板）**：推荐 = `du_fu_silhouette`(×3) + `du_fu`(×3，镜像配对) + `ci_li`(×2) + `shi_pao`(×2)。剪影为唯一新元素，3 对"光/暗镜像"构成「剪影回廊」核心；`du_fu` 作配对光体、`ci_li` 地面、`shi_pao` 高位。有意省略 `chong_feng`/`bouncy_vine`/`gu_bao`/`cyclone`（降密度、突出剪影、不与 2-2/2-3 身份重叠）。

| idx | type | x | y | 备注 |
|---|---|---|---|---|
| 1 | coin | 128 | 200 | 热身·地面 |
| 2 | du_fu_silhouette | 176 | 120 | **Pair1 暗**（mirror，配对 #3，params.mirrorOffset=π） |
| 3 | du_fu | 240 | 120 | **Pair1 光**（反相：silhouette 升它落） |
| 4 | seed | 304 | 200 | **seed_01** |
| 5 | coin | 368 | 200 | 地面 |
| 6 | ci_li | 432 | 200 | 地刺·地面 |
| 7 | coin | 496 | 200 | 地面 |
| 8 | du_fu_silhouette | 560 | 120 | **Pair2 暗**（配对 #9） |
| 9 | du_fu | 624 | 120 | **Pair2 光** |
| 10 | seed | 688 | 200 | **seed_02** |
| 11 | shi_pao | 752 | 100 | 石炮·高位 |
| 12 | coin | 816 | 200 | 地面 |
| 13 | seed | 880 | 200 | **seed_03** |
| 14 | ci_li | 912 | 200 | 地刺 |
| 15 | checkpoint | 928 | 176 | **mid 检查点** |
| 16 | coin | 960 | 200 | 地面 |
| 17 | du_fu_silhouette | 1024 | 120 | **Pair3 暗**（配对 #18） |
| 18 | du_fu | 1088 | 120 | **Pair3 光** |
| 19 | seed | 1152 | 200 | **seed_04**（mid 检查点前，果阶段触发） |
| 20 | seed | 1200 | 200 | **seed_06**（收集余量） |
| 21 | coin | 1216 | 200 | 地面 |
| 22 | coin | 1248 | 200 | 地面 |
| 23 | shi_pao | 1280 | 100 | 石炮·高位·gauntlet |
| 24 | seed | 1320 | 200 | **seed_05**（收集余量） |
| 25 | coin | 1344 | 200 | 门前赏金 |
| 26 | checkpoint | 1376 | 176 | **gauntlet 前检查点**（防劝退） |

> 计数：coin×8、du_fu_silhouette×3、du_fu×3、ci_li×2、shi_pao×2、seed×6、checkpoint×2 = 共 26 实体（全部 x<1408，y<288）。
>
> **镜像配对（剪影如何塑造关卡）**：3 对（#2/#3、#8/#9、#17/#18）光/暗嘟浮反相浮动，玩家须读"一个升、一个落"的对称关系找间隙通过或踩杀；剪影带暖黄发光边 + 反向翅（GDD16 §7.4），在 vine_forest 亮背景下高对比可辨。
>
> **演示路径（前 4 颗触发四阶段）**：按 x 升序可达顺序，前 4 颗种子使玩家一局内走过 苗→藤→花→果（GDD12 §3.3，`growthPerSeed=0.25`）：`seed_01(304) → seed_02(688) → seed_03(880) → seed_04(1152)`（sprout→vine→bloom→fruit）；余 `seed_06(1200)`、`seed_05(1320)` 为收集探索余量。

---

## 5. Level JSON 字段规划（schema 要点 · 非完整 JSON）

> 依章节同构 2-2/2-3，**不落盘完整 JSON**；以下为转录要点与 schema 增量，供工程主程扩写 `2-4.json`。

**顶层字段（同 2-1/2-2/2-3 schema）：** `id / version / tileSize(32) / width(46) / height(9) / tiles[] / entities[] / props[] / checkpoints[] / goal / beat / metadata / spawn`。

**`entities[]` 类型增量（schema 要点）：**
```jsonc
{
  "type": "du_fu_silhouette",   // 新增类型（须同步扩 EnemyTypeName 联合 + enemy-config + enemy-ai 分支 + 纯函数 du-fu-silhouette.ts）
  "x": 176, "y": 120,           // y=120 = 浮动基准 baseY（同 du_fu）
  "params": { "twist": "mirror", "mirrorOffset": 3.14159, "pairId": 3 }  // 反相 + 配对光嘟浮实例 id
}
// 其余类型（du_fu/ci_li/shi_pao/coin/seed/checkpoint）沿用 2-1..2-3 schema；
// seed 带 "seedId"；所有本关 seed/coin 落地面 y=200（不强制高位，差异化 2-2）。
```
> 注：若 OPEN-TWIST 拍板为 B/C，则 `params.twist` 改为 `decoy`/`phaseghost` 并带对应参数（GDD16 §3.2）。

**`beat` 字段：** `{ "enabled": false, "bpm": 120, "grid": 8, "tracks": [] }`（沿用占位，无节拍平台）。

**`metadata` 字段：** `{ "name": "剪影回廊", "theme": "vine_forest", "parTimeMs": 80000 }`（`theme` 复用 `'vine_forest'`，联合已含）。

**`goal` 字段：** `{ "type": "triumph_gate", "x": 1408, "y": 160, "w": 32, "h": 64 }`。

**可选节拍段（enabled:false · 占位）：** 本关 `beat.enabled=false`，无 `beatPlatforms`。若后续 World 3 需节拍关，再开 `enabled:true` + `tracks`（独立任务，不在本关）。

---

## 6. biome 氛围意图（藤林 · 绿系主导 · 推荐复用）

- **意图**：明亮藤林——草绿植被包裹、暖橙花点缀、半透绿荫，靠**草绿主色 + 暖橙暖意 + 暖黄微光**制造"生机向上"对比（对齐 2-2 §6）。**选 vine_forest 的关键理由**：亮背景（`天空 #5BC8F5` / `草绿 #7CC242`）使暗色剪影（`描边 #2A1A12`）**高亮度对比（≥3:1，art-bible §3.3）**，直接满足"剪影必须可区分、防认知混淆"的可访问性硬要求（GDD16 §7.4）。
- **程序化占位**：MVP 全程序化（Graphics 色块），**守锁色板**；具体 palette 由 art-director 定（见附录 A）。不新增色板色。
- **结构不变**：仅换主色 / 装饰（GDD05 §3「主题切换仅换色不换形」）；tile 网格与功能色语义不变。
- **COLOR DELTA：0 新增色**。本关全部引用色取自 11 色锁色板（草绿/阴影绿/暖橙/暖黄/描边/命粉/警示红/经济金/蓝紫/环境冷蓝/天空），无新增 hex，总色数 ≤64 红线。剪影暗涂 `#2A1A12` + 发光边 `#FFD23F` 均在锁色板内。

---

## 7. 难度定位（相对 2-3 递进）

- **整体**：略高于 2-3，但以**镜像读图为主**（成对反相浮动的对称解谜），不构成"硬核突然死亡"。
- **波浪曲线**：热身（coin/seed）→ 教学镜像对（Pair1，记反相关系）→ 地面/高位威胁（ci_li/shi_pao）+ 第二镜像对（Pair2）→ mid 检查点 → 第三镜像对（Pair3，考试"读双反相"）→ gauntlet 前检查点 → 缓降终点。
- **新元素密度**：剪影作为唯一新元素，密度克制（3 对镜像），不给玩家同时学两个新机制（不组合弹藤/气旋/beat）。
- **检查点**：2 个（mid + gauntlet 前），防劝退，与 2-1/2-2/2-3 密度一致。

---

## 8. 机关说明

- **默认不组合弹藤 / 气旋 / 鼓苞 / beat**：用户拍板仅引入剪影一个新元素；本关 `beat.enabled=false` 且**不含任何 bouncy_vine / cyclone / gu_bao / beatPlatforms**，避免"浮动镜像 + 弹跳/力场/时序"多新机制叠加导致认知过载（守 P1/P2/P3 支柱）。
- 若 OPEN-COMBO 拍板加 1–2 `bouncy_vine` 做垂直点缀，须确保不与 2-2 的"弹藤垂直越障"身份混淆（本关弹藤仅作过渡，非核心）。

---

## 9. 转录校验清单（Transcription Checklist for Engineering Lead）

- [ ] `tileSize=32`、`width=46`、`height=9`；所有 `tx∈[0,46)`、`ty∈[0,9)`；所有 `x∈[0,1472)`、`y∈[0,288)`（goal x+w=1440<1472 ✅）。
- [ ] 地面 `ty7-8` 全 46 列连续；左右墙 `tx0`/`tx45` ty0-8 声明。
- [ ] oneway `(5,6)@ty3`、`(22,23)@ty4`、`(33,34)@ty5` 已声明（藤林高台，复用 2-2）。
- [ ] 剪影实体 `y=120`（浮动基准，同 du_fu），`params.twist/mirrorOffset/pairId` 已保留。
- [ ] 6 颗种子沿通关路径分布（seed_01..seed_06，全部 y=200、x<1408）；前 4 颗可达顺序触发 苗→藤→花→果。
- [ ] 2 检查点（x=928 / x=1376，y=176）已声明；`goal.type` 沿用 `"triumph_gate"`（IP 安全）。
- [ ] `beat.enabled=false`、`tracks:[]`、无 `beatPlatforms`（本关不引入节拍平台，避免与剪影双新机制）。
- [ ] `metadata.theme="vine_forest"`（biome 氛围接线点，见附录 A）；`LevelTheme` 联合已含 `'vine_forest'`。
- [ ] 不引入新 entity type 之外类型：`du_fu_silhouette` 为新增类型，需同步扩展 `EnemyTypeName`（+ `params`）、`enemy-config.json`、`du-fu-silhouette.ts` 纯函数、`enemy-ai.ts` 分支、`enemy-view.ts` 占位（GDD16 §3.4）；其余沿用 du_fu/ci_li/shi_pao/coin/seed/checkpoint + solid/oneway。
- [ ] 音频：仅复用现有占位音（ON_STOMP / 受伤管线 / benign ACTIVATED·GHOST_SHIFT），无新增 SFX 键（GDD16 §6）。
- [ ] **LEVEL_ORDER 追加**：`['1-1','1-2','2-1','2-2','2-3']` → `['1-1','1-2','2-1','2-2','2-3','2-4']`（World 2 收尾）。

---

## 附录 A：给 art-director 的藤林 biome 规格需求（0 新增色 · 复用 2-2）

> 程序化占位 + 锁色板约束下的需求；最终 palette 变体由 art-director 敲定。所有色取自 11 色锁色板，**0 新增 hex**。剪影专用绘制见 GDD16 §7.3。

1. **藤林 palette 变体（限锁色板内，≤64 色）**：同 2-2 附录 A（bg `#5BC8F5` / rockFace `#7CC242` / rockBody `#5FA82F` / outline `#2A1A12` / firelight `#F2933C` / crystalCore `#FFD23F` / crystalGlow `#6E7BF2` / danger `#E8483B`）。
2. **剪影占位绘制（GDD16 §7.3）**：主体 `描边 #2A1A12`（暗涂）+ **暖黄 `#FFD23F` 1px 发光边** + 反向翅（翅尖朝下）/ 撕裂缺口；phaseghost 的 WRAITH 期 alpha≤0.4。与原嘟浮（蓝紫 `#6E7BF2`、翅朝上、无暖黄边）形状/颜色双异。
3. **不新增色板色**：全部藤林 + 剪影视觉须在现有 11 色锁色板内；派生暗面由运行时 tint 生成（0 新增）。

---

## 附录 B：给 engineering-lead 的实现清单（要点）

1. **core/enemy 剪影表**（GDD16 §3.4）：`enemy-types.ts` 联合增 `'du_fu_silhouette'`（+ `params`）；`du-fu-silhouette.ts` 新增纯函数 `stepDufuSilhouette`；`enemy-ai.ts` 增分支 + `overlaps()` 按 `mode/ghost` 短路；`enemy-config.json` 增 `du_fu_silhouette` 项。
2. **2-4.json**：按 §5 schema 要点落盘（width=46 / theme=vine_forest / 26 实体 / 3 对镜像）。
3. **LEVEL_ORDER 追加**：`['1-1','1-2','2-1','2-2','2-3']` → `['1-1','1-2','2-1','2-2','2-3','2-4']`。
4. **biome 氛围接线**：`metadata.theme="vine_forest"` 已存在于 `LevelTheme` 联合（`'grass'|'cave'|'vine_forest'|'storm_sky'`）+ `THEME_PALETTES`（2-2 已注册），本关**无需新增 biome**，零新增色。
5. **音频**：仅复用 ON_STOMP / 受伤管线 / benign 占位，无新增 SFX 键。
6. **回归**：`validateLevelData` 通过；loader 去重地面/墙；剪影走既有踩踏 / 受伤管线，不破坏原嘟浮 / 4 旧敌 / GDD06/07/12 正交性。

---

*机器规格交付完毕（字段规划 + 坐标表，未落完整 JSON），未 git commit；待主理人（游承峰）审批后由工程主程落盘 `src/config/levels/2-4.json` 并按附录 B 实施。本文件与 GDD16 同步新建，未修改现有 GDD、未写其他 `src/` 文件。*
