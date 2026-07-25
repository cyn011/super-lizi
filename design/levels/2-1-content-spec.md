# 关卡内容规格 · 2-1（机器可转录）

> 配套 `2-1-design.md`（待建）。本文件供工程主程**零歧义**直接转录为 `src/config/levels/2-1.json`。
> 所有坐标已自洽校验：`tx∈[0,44)`、`ty∈[0,9)`、`x∈[0,1408)`、`y∈[0,288)`。地面 ty7-8 全宽连续。
> 本文件为**新建**；结构对齐 `1-1-content-spec.md` / `1-2-content-spec.md`，数据取自下方经脚本校验的 JSON 草案。
> 关联 GDD：13-gu-bao-enemy.md（鼓苞）、05-level-system.md、04-enemy-ai.md、12-seed-metamorphosis.md。
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：P-LEVEL-02。

---

## 1. 字段总表（Field Table）

| 字段 | 值（2-1） | 说明 / 复用依据 |
|---|---|---|
| `id` | `"2-1"` | 世界第二关首关（新主题洞穴，进度链 1-2→2-1） |
| `version` | `1` | 首版 |
| `tileSize` | `32` | 全局约定 |
| `width` | `44` | 比 1-1(40)/1-2(48) 居中；洞穴单关长度 |
| `height` | `9` | 全局约定 |
| `metadata.name` | `"石窟回响"` | 命名建议（D1：可改） |
| `metadata.theme` | `"cave"` | 新主题；biome 氛围接线点见附录 A / B |
| `metadata.parTimeMs` | `72000` | 建议基准值，待 QA 调校 |
| `spawn.x/y` | `64` / `190` | 出生点（tx2，脚底贴地面 ty7 顶 y=224） |
| `goal.type` | `"triumph_gate"` | 凯旋之门（IP 安全终点，替代旗杆） |
| `goal.x/y/w/h` | `1344` / `160` / `32` / `64` | x=1344=tx42（墙前一格），x+w=1376<1408 ✅ |
| `beat.enabled` | `false` | **本关不启用节拍平台**（见 §4 机关说明：仅引入 1 新元素 gu_bao，避免双时序认知过载） |
| `beat.tracks` | `[]` | 无谱面 |
| `beatPlatforms` | 省略 | 无节拍平台 |
| `tiles[]` | 见 §3 / §5 | 地面 ty7-8 全宽 + 墙列 + 悬浮 solid + oneway |
| `entities[]` | 见 §4 / §5 | 旧敌×4 + gu_bao×5 + 6 seed + 2 checkpoint + 8 coin |
| `checkpoints[]` | `[]` | 检查点走 `entities[]`（同 1-1/1-2 形态） |
| `props[]` | `[]` | 无 |

---

## 2. 坐标自洽校验（Coordinate Invariants）

- 地面：所有 `tx∈[0,44)`，`ty∈{7,8}`，kind=`solid` → 88 块。
- 边界墙：左列 `tx=0` 与右列 `tx=43`，`ty∈[0,8]`，kind=`solid` → 18 块（其中 ty7,ty8 与地面重复，loader 去重即可）。
- 悬浮 solid（洞穴岩台）：`(28,29)@ty4` → 2 块，kind=`solid`。
- oneway（洞穴窄檐）：`(18,19,20)@ty5` → 3 块，kind=`oneway`。
- 实体 `y` 约定：地面实体 y=200（敌/coin/seed 脚底贴 ty7 顶 y=224）；**gu_bao y=224（地面锚点，苞自此处升起，见 GDD13 §3.2）**；checkpoint y=176（高~48）；du_fu y=120、shi_pao y=100。
- 边界：最大实体 x=1312(<1408) ✅；goal x+w=1376(<1408) ✅；所有 y<288 ✅。
- 脚本校验结果：TILE_COUNT=111，实体计数 `{coin:8, seed:6, gu_bao:5, ci_li:2, du_fu:1, shi_pao:1, checkpoint:2}`，ERRORS=[]（无越界）。

---

## 3. `tiles[]` 清单（全部 solid / oneway）

**地面 ty7-8（tx 0→43，每列两块）：**
```
(tx0,ty7)(tx0,ty8)(tx1,ty7)(tx1,ty8) … (tx43,ty7)(tx43,ty8)   // 共 88 块
```
**边界墙（重复声明风格）：**
```
左列 tx0: ty0,ty1,ty2,ty3,ty4,ty5,ty6,ty7,ty8   // 9 块
右列 tx43: ty0,ty1,ty2,ty3,ty4,ty5,ty6,ty7,ty8  // 9 块（ty7,ty8 与地面重复）
```
**悬浮 solid（洞穴岩台，kind="solid"）：**
```
(tx28,ty4)(tx29,ty4)   // 2 块
```
**oneway（洞穴窄檐，kind="oneway"）：**
```
(tx18,ty5)(tx19,ty5)(tx20,ty5)   // 3 块
```
> 完整逐块 JSON 见 §5。

---

## 4. `entities[]` 精确坐标表

| idx | type | x | y | 备注 |
|---|---|---|---|---|
| 1 | coin | 128 | 200 | 热身·地面 |
| 2 | seed | 192 | 200 | **seed_01**，前段锚点（苗） |
| 3 | gu_bao | 256 | 224 | 单苞教学（offset 0） |
| 4 | coin | 288 | 200 | 地面 |
| 5 | ci_li | 320 | 200 | 地刺·地面 |
| 6 | coin | 384 | 200 | 地面 |
| 7 | seed | 416 | 200 | **seed_02**，藤阶段触发点 |
| 8 | gu_bao | 448 | 224 | 交替走廊 A（offset 0） |
| 9 | gu_bao | 544 | 224 | 交替走廊 B（offset 1060 = 半周期错相） |
| 10 | coin | 576 | 200 | 地面（oneway 檐下） |
| 11 | seed | 608 | 200 | **seed_03**，花阶段触发点 |
| 12 | du_fu | 640 | 120 | 漂浮 |
| 13 | shi_pao | 704 | 100 | 石炮·高位 |
| 14 | coin | 768 | 200 | 地面 |
| 15 | ci_li | 832 | 200 | 地刺·地面 |
| 16 | coin | 896 | 200 | 岩台(tx28-29)下方 |
| 17 | seed | 960 | 200 | **seed_04**，果阶段触发点 |
| 18 | checkpoint | 1024 | 176 | **mid 检查点** |
| 19 | seed | 1088 | 200 | **seed_05**，收集余量 |
| 20 | gu_bao | 1120 | 224 | 终前 gauntlet A（offset 0） |
| 21 | coin | 1152 | 200 | 地面 |
| 22 | gu_bao | 1184 | 224 | 终前 gauntlet B（offset 530，错相） |
| 23 | checkpoint | 1216 | 176 | **gauntlet 前检查点**（防劝退） |
| 24 | seed | 1248 | 200 | **seed_06**，收集余量 |
| 25 | coin | 1312 | 200 | 门前赏金 |

> 计数：coin×8、ci_li×2、du_fu×1、shi_pao×1、gu_bao×5、seed×6、checkpoint×2 = 共 25 个实体。
> **敌种组合（2-3 旧敌 + 鼓苞，明确列出）**：旧敌 = `ci_li`(×2) + `du_fu`(×1) + `shi_pao`(×1)（共 3 类型 / 4 实例）；鼓苞 `gu_bao`(×5)。`chong_feng` 本关**有意省略**（降低首洞穴关密度，突出新元素；如需全覆盖可由主理人拍板加回）。
>
> **演示路径（前 4 颗触发四阶段）**：按 x 升序可达顺序，前 4 颗种子使玩家一局内走过 苗→藤→花→果（GDD12 §3.3，`growthPerSeed=0.25`，4 颗满蜕变）：
> `seed_01(192) → seed_02(416) → seed_03(608) → seed_04(960)`（sprout→vine→bloom→fruit）；
> 余 `seed_05(1088)`、`seed_06(1248)` 为收集探索余量（不强制四阶段）。

---

## 5. 可直接落盘的 JSON（`src/config/levels/2-1.json`）

```json
{
  "id": "2-1",
  "version": 1,
  "tileSize": 32,
  "width": 44,
  "height": 9,
  "tiles": [
    { "tx": 0, "ty": 7, "kind": "solid" }, { "tx": 0, "ty": 8, "kind": "solid" },
    { "tx": 1, "ty": 7, "kind": "solid" }, { "tx": 1, "ty": 8, "kind": "solid" },
    { "tx": 2, "ty": 7, "kind": "solid" }, { "tx": 2, "ty": 8, "kind": "solid" },
    { "tx": 3, "ty": 7, "kind": "solid" }, { "tx": 3, "ty": 8, "kind": "solid" },
    { "tx": 4, "ty": 7, "kind": "solid" }, { "tx": 4, "ty": 8, "kind": "solid" },
    { "tx": 5, "ty": 7, "kind": "solid" }, { "tx": 5, "ty": 8, "kind": "solid" },
    { "tx": 6, "ty": 7, "kind": "solid" }, { "tx": 6, "ty": 8, "kind": "solid" },
    { "tx": 7, "ty": 7, "kind": "solid" }, { "tx": 7, "ty": 8, "kind": "solid" },
    { "tx": 8, "ty": 7, "kind": "solid" }, { "tx": 8, "ty": 8, "kind": "solid" },
    { "tx": 9, "ty": 7, "kind": "solid" }, { "tx": 9, "ty": 8, "kind": "solid" },
    { "tx": 10, "ty": 7, "kind": "solid" }, { "tx": 10, "ty": 8, "kind": "solid" },
    { "tx": 11, "ty": 7, "kind": "solid" }, { "tx": 11, "ty": 8, "kind": "solid" },
    { "tx": 12, "ty": 7, "kind": "solid" }, { "tx": 12, "ty": 8, "kind": "solid" },
    { "tx": 13, "ty": 7, "kind": "solid" }, { "tx": 13, "ty": 8, "kind": "solid" },
    { "tx": 14, "ty": 7, "kind": "solid" }, { "tx": 14, "ty": 8, "kind": "solid" },
    { "tx": 15, "ty": 7, "kind": "solid" }, { "tx": 15, "ty": 8, "kind": "solid" },
    { "tx": 16, "ty": 7, "kind": "solid" }, { "tx": 16, "ty": 8, "kind": "solid" },
    { "tx": 17, "ty": 7, "kind": "solid" }, { "tx": 17, "ty": 8, "kind": "solid" },
    { "tx": 18, "ty": 7, "kind": "solid" }, { "tx": 18, "ty": 8, "kind": "solid" },
    { "tx": 19, "ty": 7, "kind": "solid" }, { "tx": 19, "ty": 8, "kind": "solid" },
    { "tx": 20, "ty": 7, "kind": "solid" }, { "tx": 20, "ty": 8, "kind": "solid" },
    { "tx": 21, "ty": 7, "kind": "solid" }, { "tx": 21, "ty": 8, "kind": "solid" },
    { "tx": 22, "ty": 7, "kind": "solid" }, { "tx": 22, "ty": 8, "kind": "solid" },
    { "tx": 23, "ty": 7, "kind": "solid" }, { "tx": 23, "ty": 8, "kind": "solid" },
    { "tx": 24, "ty": 7, "kind": "solid" }, { "tx": 24, "ty": 8, "kind": "solid" },
    { "tx": 25, "ty": 7, "kind": "solid" }, { "tx": 25, "ty": 8, "kind": "solid" },
    { "tx": 26, "ty": 7, "kind": "solid" }, { "tx": 26, "ty": 8, "kind": "solid" },
    { "tx": 27, "ty": 7, "kind": "solid" }, { "tx": 27, "ty": 8, "kind": "solid" },
    { "tx": 28, "ty": 7, "kind": "solid" }, { "tx": 28, "ty": 8, "kind": "solid" },
    { "tx": 29, "ty": 7, "kind": "solid" }, { "tx": 29, "ty": 8, "kind": "solid" },
    { "tx": 30, "ty": 7, "kind": "solid" }, { "tx": 30, "ty": 8, "kind": "solid" },
    { "tx": 31, "ty": 7, "kind": "solid" }, { "tx": 31, "ty": 8, "kind": "solid" },
    { "tx": 32, "ty": 7, "kind": "solid" }, { "tx": 32, "ty": 8, "kind": "solid" },
    { "tx": 33, "ty": 7, "kind": "solid" }, { "tx": 33, "ty": 8, "kind": "solid" },
    { "tx": 34, "ty": 7, "kind": "solid" }, { "tx": 34, "ty": 8, "kind": "solid" },
    { "tx": 35, "ty": 7, "kind": "solid" }, { "tx": 35, "ty": 8, "kind": "solid" },
    { "tx": 36, "ty": 7, "kind": "solid" }, { "tx": 36, "ty": 8, "kind": "solid" },
    { "tx": 37, "ty": 7, "kind": "solid" }, { "tx": 37, "ty": 8, "kind": "solid" },
    { "tx": 38, "ty": 7, "kind": "solid" }, { "tx": 38, "ty": 8, "kind": "solid" },
    { "tx": 39, "ty": 7, "kind": "solid" }, { "tx": 39, "ty": 8, "kind": "solid" },
    { "tx": 40, "ty": 7, "kind": "solid" }, { "tx": 40, "ty": 8, "kind": "solid" },
    { "tx": 41, "ty": 7, "kind": "solid" }, { "tx": 41, "ty": 8, "kind": "solid" },
    { "tx": 42, "ty": 7, "kind": "solid" }, { "tx": 42, "ty": 8, "kind": "solid" },
    { "tx": 43, "ty": 7, "kind": "solid" }, { "tx": 43, "ty": 8, "kind": "solid" },
    { "tx": 0, "ty": 0, "kind": "solid" }, { "tx": 0, "ty": 1, "kind": "solid" },
    { "tx": 0, "ty": 2, "kind": "solid" }, { "tx": 0, "ty": 3, "kind": "solid" },
    { "tx": 0, "ty": 4, "kind": "solid" }, { "tx": 0, "ty": 5, "kind": "solid" },
    { "tx": 0, "ty": 6, "kind": "solid" }, { "tx": 0, "ty": 7, "kind": "solid" },
    { "tx": 0, "ty": 8, "kind": "solid" },
    { "tx": 43, "ty": 0, "kind": "solid" }, { "tx": 43, "ty": 1, "kind": "solid" },
    { "tx": 43, "ty": 2, "kind": "solid" }, { "tx": 43, "ty": 3, "kind": "solid" },
    { "tx": 43, "ty": 4, "kind": "solid" }, { "tx": 43, "ty": 5, "kind": "solid" },
    { "tx": 43, "ty": 6, "kind": "solid" }, { "tx": 43, "ty": 7, "kind": "solid" },
    { "tx": 43, "ty": 8, "kind": "solid" },
    { "tx": 28, "ty": 4, "kind": "solid" }, { "tx": 29, "ty": 4, "kind": "solid" },
    { "tx": 18, "ty": 5, "kind": "oneway" }, { "tx": 19, "ty": 5, "kind": "oneway" },
    { "tx": 20, "ty": 5, "kind": "oneway" }
  ],
  "entities": [
    { "type": "coin", "x": 128, "y": 200 },
    { "type": "seed", "x": 192, "y": 200, "seedId": "seed_01" },
    { "type": "gu_bao", "x": 256, "y": 224, "params": { "phaseOffset": 0 } },
    { "type": "coin", "x": 288, "y": 200 },
    { "type": "ci_li", "x": 320, "y": 200 },
    { "type": "coin", "x": 384, "y": 200 },
    { "type": "seed", "x": 416, "y": 200, "seedId": "seed_02" },
    { "type": "gu_bao", "x": 448, "y": 224, "params": { "phaseOffset": 0 } },
    { "type": "gu_bao", "x": 544, "y": 224, "params": { "phaseOffset": 1060 } },
    { "type": "coin", "x": 576, "y": 200 },
    { "type": "seed", "x": 608, "y": 200, "seedId": "seed_03" },
    { "type": "du_fu", "x": 640, "y": 120 },
    { "type": "shi_pao", "x": 704, "y": 100 },
    { "type": "coin", "x": 768, "y": 200 },
    { "type": "ci_li", "x": 832, "y": 200 },
    { "type": "coin", "x": 896, "y": 200 },
    { "type": "seed", "x": 960, "y": 200, "seedId": "seed_04" },
    { "type": "checkpoint", "x": 1024, "y": 176 },
    { "type": "seed", "x": 1088, "y": 200, "seedId": "seed_05" },
    { "type": "gu_bao", "x": 1120, "y": 224, "params": { "phaseOffset": 0 } },
    { "type": "coin", "x": 1152, "y": 200 },
    { "type": "gu_bao", "x": 1184, "y": 224, "params": { "phaseOffset": 530 } },
    { "type": "checkpoint", "x": 1216, "y": 176 },
    { "type": "seed", "x": 1248, "y": 200, "seedId": "seed_06" },
    { "type": "coin", "x": 1312, "y": 200 }
  ],
  "props": [],
  "checkpoints": [],
  "goal": {
    "type": "triumph_gate",
    "x": 1344,
    "y": 160,
    "w": 32,
    "h": 64
  },
  "beat": {
    "enabled": false,
    "bpm": 120,
    "grid": 8,
    "tracks": []
  },
  "metadata": {
    "name": "石窟回响",
    "theme": "cave",
    "parTimeMs": 72000
  },
  "spawn": {
    "x": 64,
    "y": 190
  }
}
```

---

## 6. 转录校验清单（Transcription Checklist for Engineering Lead）

- [ ] 所有 `tx∈[0,44)`、`ty∈[0,9)`；所有 `x∈[0,1408)`、`y∈[0,288)`（goal x+w=1376<1408 ✅）。
- [ ] 地面 `ty7-8` 全 44 列连续；左右墙 `tx0`/`tx43` ty0-8 声明。
- [ ] 悬浮 solid `(28,29)@ty4`、oneway `(18,19,20)@ty5` 已声明（洞穴岩台 / 窄檐）。
- [ ] gu_bao 实体 `y=224`（地面锚点，非 200），`params.phaseOffset` 已保留（gb3=1060、gb5=530 为错相）。
- [ ] 6 颗种子沿通关路径分布（seed_01..seed_06，y=200），前 4 颗可达顺序触发 苗→藤→花→果（见 §4 演示路径）。
- [ ] 2 检查点（x=1024 / x=1216，y=176）已声明；`goal.type` 沿用 `"triumph_gate"`（IP 安全）。
- [ ] `beat.enabled=false`、`tracks:[]`、无 `beatPlatforms`（本关不引入节拍平台，避免与 gu_bao 时序双压）。
- [ ] `metadata.theme="cave"`（biome 氛围接线点，见附录 A / B）。
- [ ] 不引入新 entity type 之外类型：`gu_bao` 为新增类型，需同步扩展 `EnemyEntityDef`（GDD13 §3.2）；其余沿用 ci_li/du_fu/shi_pao/coin/seed/checkpoint + solid/oneway。

---

## 7. biome 氛围意图（冷暗洞穴）

- **意图**：冷暗洞穴——岩壁包围、光线幽暗，靠**环境冷蓝**主色 + **暖橙火光**点状暖意 + **晶体微光**点缀制造"冷中藏暖"的对比（对齐 audio-design §22「危险区用冷蓝/紫做反差提示」）。
- **程序化占位**：MVP 全程序化（Graphics 色块 / 简单纹理），**守锁色板**；具体 palette 变体由 art-director 定（见附录 A）。不新增色板色。
- **结构不变**：仅换主色 / 装饰（GDD05 §3「主题切换仅换色不换形」）；tile 网格与功能色语义不变，保证回归测试稳定。

---

## 8. 难度定位（相对 1-1 / 1-2 递进）

- **整体**：略高于 1-2，但以**公平节奏**为主（gu_bao 固定周期 + 前摇），不构成"硬核突然死亡"。
- **波浪曲线**：热身（coin/seed）→ 单苞教学（gb3，记周期）→ 巡逻敌 + 双苞交替走廊（gb8/gb9，错相位练"等窗口"）→ 漂浮 + 石炮 + 巡逻组合 → mid 检查点 → 终前 gu_bao gauntlet（gb20/gb22，错相）→ gauntlet 前检查点 → 缓降终点。
- **新元素密度**：gu_bao 作为唯一新元素，密度克制（5 处，含 2 处错相走廊），不给玩家同时学两个新机制（不组合弹藤，见 §4）。
- **检查点**：2 个（mid + gauntlet 前），防劝退，与 1-2 密度一致。

---

## 9. 机关说明

- **默认不组合弹藤（spring_pad）**：用户拍板仅引入 gu_bao 一个新元素；本关 `beat.enabled=false` 且**不含任何 spring_pad / beatPlatforms**，避免时序 + 弹跳双新机制叠加导致认知过载（守 P1/P2/P3 支柱）。
- 若后续需要，可在 2-x 天空主题再引入弹藤（见 new-mechanic-candidates.md 候选 B），与本关正交。

---

## 附录 A：给 art-director 的洞穴 biome 规格需求

> 以下为**程序化占位 + 锁色板约束**下的需求；最终 palette 变体 / 瓦片纹理 / 晶体样式由 art-director 敲定（art/asset-spec.md §3.1 已定"洞穴 = 冷蓝灰 `#4A78C0` + 暖橙火光"基调）。

1. **冷暗 palette 变体（限锁色板内，≤64 色）**
   - 岩壁主色：`环境冷蓝 #4A78C0`（冷蓝灰，洞穴 base）。
   - 描边：`#2A1A12`（全局描边，与草原一致）。
   - 暖橙火光点缀：`暖橙 #F2933C`（洞穴火把 / 苞体同源色，呼应温暖反差）。
   - 晶体发光核心：`暖黄 #FFD23F`；晶体辉光次级：`蓝紫 #6E7BF2` / `天空 #5BC8F5`（二选一或叠用）。
   - 危险语义红：`警示红 #E8483B`（仅用于 gu_bao 尖刺顶 + ci_li/chong_feng，须与"可踩"语义解耦，靠剪影双编码）。
   - 背景：暗化冷蓝（由 `#4A78C0` 派生更暗 shade，仍须在 64 色预算内；建议经 runtime tint 生成，不另绘新色）。
2. **岩壁瓦片（cave rock tiles）**：复用 1 份基础瓦片集经 **runtime tint / 调色板映射** 生成洞穴版（art-spec §3.1「换色不换形」），结构 / 功能色语义不变；仅"主题独有装饰"（钟乳石、岩柱）另绘少量。
3. **晶体（deco_crystal）**：非碰撞装饰，点缀冷暗背景；建议 `暖黄 #FFD23F` 核心 + `蓝紫 #6E7BF2` 辉光（或 `天空 #5BC8F5`），呼应"冷中藏暖"。MVP 可先用 Graphics 简单菱形 / 多边形占位。
4. **gu_bao 占位绘制**：苞体 `暖橙 #F2933C` + 描边 `#2A1A12`；尖刺顶 `警示红 #E8483B`（危险）；RETRACTING 期尖刺收起、顶转 `暖黄 #FFD23F` 高光环（可踩提示）。详见 GDD13 §7.3。
5. **不新增色板色**：所有洞穴视觉须在现有 8 色锁色板内派生（tint 不计数新增 hex，但须保证总 ≤64）。

---

## 附录 B：给 engineering-lead 的实现清单

1. **core/enemy 鼓苞表**
   - `src/core/enemy/enemy-types.ts`：`EnemyTypeName` 联合加法增 `'gu_bao'`；`EnemyEntityDef` 增可选 `params?: Record<string,unknown>`（仅 gu_bao 消费，向后兼容旧 4 敌）。
   - `src/core/enemy/enemy-ai.ts`：`update()` 增 `gu_bao` 分支（调 `stepGuBao` 纯函数）；`overlaps()` 按态短路（DORMANT→false）；`isStompable` 随态赋值（RETRACTING=true）；`createEnemies` 识别 `'gu_bao'` 并透传 `params`。
   - `src/config/enemy-config.json`：增 `gu_bao` 项（`dormantMs/emergeMs/activeMs/retractMs/height/width/stompable/stompableWindow/baseYAnchor`，见 GDD13 §3.1）。
2. **2-1.json**：落盘 `src/config/levels/2-1.json`（即用 §5 校验过 JSON）。
3. **LEVEL_ORDER 追加**：`src/core/config/index.ts` 的 `LEVEL_ORDER` 由 `['1-1','1-2']` → `['1-1','1-2','2-1']`（进度链续接）。
4. **levels 注册表续链**：`src/core/config/index.ts` 的 `levels` 记录增 `'2-1': level2_1Json as LevelData`，并 `import level2_1Json from '../../config/levels/2-1.json'`（同时 `nextLevelId(LEVEL_ORDER, '1-2')` 纯函数自动返回 `'2-1'`，无需改函数体）。
5. **biome 氛围接线点**：`metadata.theme="cave"` 已写入 2-1.json；当前代码**未消费** `theme`（grep 确认仅 JSON + `LevelData` 类型）。需在 `game/render`（tilemap-view / 背景绘制）新增 `theme → palette` 解析器，按 `level.metadata.theme` 选洞穴 tint（冷蓝 `#4A78C0` base + 暖橙火光 + 晶体辉光），MVP 仅程序化占位、不进 PNG。
6. **音频**：仅复用现有占位音，无新增 SFX 键（erupt telegraph 复用通用占位、踩杀复用 `ON_STOMP` 路径）。
7. **回归**：`validateLevelData` 应通过；loader 去重地面/墙重复 tile；gu_bao 走既有踩踏 / 受伤管线，不破坏 4 旧敌与 GDD06/07/12 正交性。

---

*机器规格交付完毕，未 git commit；待主理人（游承峰）审批后由工程主程落盘 `src/config/levels/2-1.json` 并按附录 B 实施。本文件与 GDD13 同步新建，未修改现有 GDD、未写其他 `src/` 文件。*
