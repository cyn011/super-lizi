# 关卡内容规格 · 1-2（机器可转录）

> 配套 `1-2-design.md`。本文件供工程主程**零歧义**直接转录为 `src/config/levels/1-2.json`。
> 所有坐标已自洽校验：`tx∈[0,48)`、`ty∈[0,9)`、`x∈[0,1536)`、`y∈[0,288)`。地面 ty7-8 全宽连续。
> 网格约定与 `1-1.json` 完全兼容：`tileSize:32`、`height:9`、墙列 tx0/tx47 的 ty0-8 重复声明（同 1-1 风格）。

---

## 1. 字段总表（Field Table）

| 字段 | 值（1-2） | 说明 / 复用依据 |
|---|---|---|
| `id` | `"1-2"` | 同世界第二关，进度链 1-1→1-2 |
| `version` | `1` | 首版 |
| `tileSize` | `32` | 与 1-1 一致 |
| `width` | `48` | 比 1-1(40) 略长，展示流水线可扩展（**D2 待拍板，可回退 40**） |
| `height` | `9` | 与 1-1 一致 |
| `metadata.name` | `"翠野·续章"` | 命名建议（D1：theme 可改） |
| `metadata.theme` | `"grass"` | 与 1-1 调色板/资产零改动复用 |
| `metadata.parTimeMs` | `84000` | 建议基准值，待 QA 调校（D6） |
| `spawn.x/y` | `64` / `190` | 同 1-1（tx2，脚底贴地面 ty7 顶 y=224） |
| `goal.type` | `"triumph_gate"` | 沿用 1-1（IP 安全终点，替代旗杆） |
| `goal.x/y/w/h` | `1472` / `160` / `32` / `64` | x=1472=tx46（墙前一格），x+w=1504<1536 ✅ |
| `beat.enabled` | `true` | 启用节拍平台 |
| `beat.bpm` | `120` | 同 1-1 |
| `beat.grid` | `8` | 同 1-1 |
| `beat.tracks[0].target` | `"bp_1_2"` | 引用下方 BeatPlatformDef.id |
| `beat.tracks[0].pattern` | `"GSGSGSGSGSGSGSGS"` | 16 字符，500ms 实/500ms 虚（D3/D4 待拍板） |
| `beatPlatforms[0].id` | `"bp_1_2"` | 唯一 id |
| `beatPlatforms[0].tiles` | tx19,20,21 @ ty5 | 与下方 `tiles[]` 不重复（initial=ghost 不进 tiles） |
| `beatPlatforms[0].initial` | `"ghost"` | 第 0 拍前保底相位=虚；故**不**列入 `tiles[]` |
| `tiles[]` | 见 §3 | 地面 ty7-8 全宽 + 墙列 + oneway + 悬浮 solid；**节拍平台 tile 不在内** |
| `entities[]` | 见 §4 | 8 敌 + 9 coin + 2 seed + 2 checkpoint（坐标精确） |
| `checkpoints[]` | `[]` | 检查点走 `entities[]`（同 1-1 形态） |
| `props[]` | `[]` | 无 |

---

## 2. 坐标自洽校验（Coordinate Invariants）

- 地面：所有 `tx∈[0,48)`，`ty∈{7,8}`，kind=`solid` → 96 块。
- 边界墙：左列 `tx=0` 与右列 `tx=47`，`ty∈[0,8]`，kind=`solid` → 18 块（其中 ty7,ty8 与地面重复，同 1-1 风格，loader 去重即可）。
- oneway：`(12,13,14)@ty5`、`(33,34,35)@ty6` → 6 块，kind=`oneway`。
- 悬浮 solid：`(26,27)@ty4` → 2 块，kind=`solid`。
- 节拍平台：`bp_1_2` = `(19,20,21)@ty5`，initial=ghost → **不**进 `tiles[]`，仅由 `beatPlatforms` 声明。
- 所有实体 `y`：地面实体 y=200（敌/coin/seed 脚底贴 ty7 顶 y=224，敌高~24）；checkpoint y=176（高~48）；漂浮 du_fu y=120、shi_pao y=100；高位 coin y=150/96。
- 边界：最大实体 x=1344(<1536) ✅；goal x+w=1504(<1536) ✅；所有 y<288 ✅。

---

## 3. `tiles[]` 清单（全部 solid / oneway）

**地面 ty7-8（tx 0→47，每列两块）：**
```
(tx0,ty7)(tx0,ty8)(tx1,ty7)(tx1,ty8) … (tx47,ty7)(tx47,ty8)   // 共 96 块
```
**边界墙（同 1-1 重复声明风格）：**
```
左列 tx0: ty0,ty1,ty2,ty3,ty4,ty5,ty6,ty7,ty8   // 9 块
右列 tx47: ty0,ty1,ty2,ty3,ty4,ty5,ty6,ty7,ty8  // 9 块（ty7,ty8 与地面重复）
```
**oneway（kind="oneway"）：**
```
(tx12,ty5)(tx13,ty5)(tx14,ty5)(tx33,ty6)(tx34,ty6)(tx35,ty6)   // 6 块
```
**悬浮 solid（kind="solid"）：**
```
(tx26,ty4)(tx27,ty4)   // 2 块
```
> 节拍平台 (19,20,21,ty5) **不在** 此清单（initial=ghost）。

---

## 4. `entities[]` 精确坐标表

| idx | type | x | y | 备注 |
|---|---|---|---|---|
| 1 | coin | 160 | 200 | 热身·地面 |
| 2 | ci_li | 256 | 200 | 地刺·地面 |
| 3 | coin | 320 | 200 | 热身·地面 |
| 4 | du_fu | 400 | 120 | 漂浮 |
| 5 | coin | 384 | 150 | 高位·oneway(tx12-14,ty5)上方赏金 |
| 6 | seed | 480 | 200 | **seed_01**，前段锚点 |
| 7 | shi_pao | 576 | 100 | 石炮·高位 |
| 8 | chong_feng | 672 | 200 | 冲锋·地面 |
| 9 | coin | 608 | 150 | 节拍段上方赏金（踩 bp_1_2 可抓） |
| 10 | coin | 672 | 96 | 高位赏金 |
| 11 | ci_li | 800 | 200 | 地刺·悬浮 solid(tx26-27,ty4)下方 |
| 12 | du_fu | 864 | 120 | 漂浮 |
| 13 | checkpoint | 960 | 176 | **mid 检查点** |
| 14 | coin | 1024 | 200 | gauntlet 前·地面 |
| 15 | ci_li | 1056 | 200 | 地刺·gauntlet |
| 16 | du_fu | 1120 | 120 | 漂浮·gauntlet |
| 17 | coin | 1152 | 150 | oneway(tx33-35,ty6)上方赏金 |
| 18 | chong_feng | 1184 | 200 | 冲锋·gauntlet |
| 19 | shi_pao | 1216 | 100 | 石炮·高位·gauntlet |
| 20 | checkpoint | 1248 | 176 | **gauntlet 前检查点**（防劝退） |
| 21 | coin | 1280 | 200 | gauntlet 后·地面 |
| 22 | seed | 1312 | 200 | **seed_02**，终前锚点 |
| 23 | coin | 1344 | 200 | 门前赏金 |

> 计数：coin×9、ci_li×3、du_fu×2、chong_feng×2、shi_pao×2、seed×2、checkpoint×2 = 共 23 个实体。

---

## 5. 可直接落盘的 JSON（`src/config/levels/1-2.json`）

```json
{
  "id": "1-2",
  "version": 1,
  "tileSize": 32,
  "width": 48,
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
    { "tx": 44, "ty": 7, "kind": "solid" }, { "tx": 44, "ty": 8, "kind": "solid" },
    { "tx": 45, "ty": 7, "kind": "solid" }, { "tx": 45, "ty": 8, "kind": "solid" },
    { "tx": 46, "ty": 7, "kind": "solid" }, { "tx": 46, "ty": 8, "kind": "solid" },
    { "tx": 47, "ty": 7, "kind": "solid" }, { "tx": 47, "ty": 8, "kind": "solid" },
    { "tx": 0, "ty": 0, "kind": "solid" }, { "tx": 0, "ty": 1, "kind": "solid" },
    { "tx": 0, "ty": 2, "kind": "solid" }, { "tx": 0, "ty": 3, "kind": "solid" },
    { "tx": 0, "ty": 4, "kind": "solid" }, { "tx": 0, "ty": 5, "kind": "solid" },
    { "tx": 0, "ty": 6, "kind": "solid" }, { "tx": 0, "ty": 7, "kind": "solid" },
    { "tx": 0, "ty": 8, "kind": "solid" },
    { "tx": 47, "ty": 0, "kind": "solid" }, { "tx": 47, "ty": 1, "kind": "solid" },
    { "tx": 47, "ty": 2, "kind": "solid" }, { "tx": 47, "ty": 3, "kind": "solid" },
    { "tx": 47, "ty": 4, "kind": "solid" }, { "tx": 47, "ty": 5, "kind": "solid" },
    { "tx": 47, "ty": 6, "kind": "solid" }, { "tx": 47, "ty": 7, "kind": "solid" },
    { "tx": 47, "ty": 8, "kind": "solid" },
    { "tx": 12, "ty": 5, "kind": "oneway" }, { "tx": 13, "ty": 5, "kind": "oneway" },
    { "tx": 14, "ty": 5, "kind": "oneway" },
    { "tx": 33, "ty": 6, "kind": "oneway" }, { "tx": 34, "ty": 6, "kind": "oneway" },
    { "tx": 35, "ty": 6, "kind": "oneway" },
    { "tx": 26, "ty": 4, "kind": "solid" }, { "tx": 27, "ty": 4, "kind": "solid" }
  ],
  "entities": [
    { "type": "coin", "x": 160, "y": 200 },
    { "type": "ci_li", "x": 256, "y": 200 },
    { "type": "coin", "x": 320, "y": 200 },
    { "type": "du_fu", "x": 400, "y": 120 },
    { "type": "coin", "x": 384, "y": 150 },
    { "type": "seed", "x": 480, "y": 200, "seedId": "seed_01" },
    { "type": "shi_pao", "x": 576, "y": 100 },
    { "type": "chong_feng", "x": 672, "y": 200 },
    { "type": "coin", "x": 608, "y": 150 },
    { "type": "coin", "x": 672, "y": 96 },
    { "type": "ci_li", "x": 800, "y": 200 },
    { "type": "du_fu", "x": 864, "y": 120 },
    { "type": "checkpoint", "x": 960, "y": 176 },
    { "type": "coin", "x": 1024, "y": 200 },
    { "type": "ci_li", "x": 1056, "y": 200 },
    { "type": "du_fu", "x": 1120, "y": 120 },
    { "type": "coin", "x": 1152, "y": 150 },
    { "type": "chong_feng", "x": 1184, "y": 200 },
    { "type": "shi_pao", "x": 1216, "y": 100 },
    { "type": "checkpoint", "x": 1248, "y": 176 },
    { "type": "coin", "x": 1280, "y": 200 },
    { "type": "seed", "x": 1312, "y": 200, "seedId": "seed_02" },
    { "type": "coin", "x": 1344, "y": 200 }
  ],
  "props": [],
  "checkpoints": [],
  "goal": {
    "type": "triumph_gate",
    "x": 1472,
    "y": 160,
    "w": 32,
    "h": 64
  },
  "beat": {
    "enabled": true,
    "bpm": 120,
    "grid": 8,
    "tracks": [
      { "target": "bp_1_2", "pattern": "GSGSGSGSGSGSGSGS" }
    ]
  },
  "beatPlatforms": [
    { "id": "bp_1_2", "initial": "ghost", "tiles": [ { "tx": 19, "ty": 5 }, { "tx": 20, "ty": 5 }, { "tx": 21, "ty": 5 } ] }
  ],
  "metadata": {
    "name": "翠野·续章",
    "theme": "grass",
    "parTimeMs": 84000
  },
  "spawn": {
    "x": 64,
    "y": 190
  }
}
```

---

## 6. 转录校验清单（Transcription Checklist for Engineering Lead）

- [ ] `beat.tracks[].target` = `"bp_1_2"` 与 `beatPlatforms[].id` 一致（fail-fast 引用校验通过）。
- [ ] `beatPlatforms[0].tiles` (19,20,21 @ ty5) **未**出现在 `tiles[]` 中（initial=ghost）。
- [ ] 地面 `ty7-8` 全 48 列连续；左右墙 `tx0`/`tx47` ty0-8 声明。
- [ ] 所有 `tx∈[0,48)`、`ty∈[0,9)`；所有 `x∈[0,1536)`、`y∈[0,288)`（goal x+w=1504<1536 ✅）。
- [ ] 无新增 entity type / tile kind（仅 ci_li/du_fu/chong_feng/shi_pao/coin/seed/checkpoint + solid/oneway）。
- [ ] `goal.type` 沿用 `"triumph_gate"`（IP 安全）。
- [ ] width=48 与 D2 决议一致；若主理人选 40，需按 §2 重投影所有 x 坐标（本 spec 整体右移压缩）。

---
*机器规格交付完毕，未 git commit，待主理人（游承峰）审批后由工程主程落盘 `src/config/levels/1-2.json`。*
