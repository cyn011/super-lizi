# 关卡内容规格 · 1-1（机器可转录）

> 配套 `1-1-design.md`（待建）。本文件供工程主程**零歧义**直接转录为 `src/config/levels/1-1.json`。
> 所有坐标已自洽校验：`tx∈[0,40)`、`ty∈[0,9)`、`x∈[0,1280)`、`y∈[0,288)`。地面 ty7-8 全宽连续。
> 本文件为**新建**（原 `design/levels/` 仅有 1-2 规格）；结构对齐 `1-2-content-spec.md`，数据取自 `1-1.json`（已含 6 颗种子）。

---

## 1. 字段总表（Field Table）

| 字段 | 值（1-1） | 说明 / 复用依据 |
|---|---|---|
| `id` | `"1-1"` | 同世界首关 |
| `version` | `1` | 首版 |
| `tileSize` | `32` | 全局约定 |
| `width` | `40` | 首关长度 |
| `height` | `9` | 全局约定 |
| `metadata.name` | `"翠野序章"` | 命名 |
| `metadata.theme` | `"grass"` | 调色板/资产 |
| `metadata.parTimeMs` | `60000` | 建议基准值，待 QA 调校 |
| `spawn.x/y` | `64` / `190` | 出生点（tx2，脚底贴地面 ty7 顶 y=224） |
| `goal.type` | `"triumph_gate"` | 凯旋之门（IP 安全终点） |
| `goal.x/y/w/h` | `1184` / `160` / `32` / `64` | x=1184=tx37（墙前一格），x+w=1216<1280 ✅ |
| `beat.enabled` | `true` | 启用节拍平台 |
| `beat.bpm` | `120` | 基准 |
| `beat.grid` | `8` | 基准 |
| `beat.tracks[0].target` | `"bp_pulse_a"` | 引用下方 BeatPlatformDef.id |
| `beat.tracks[0].pattern` | `"SSSSSSSSGGGGGGGG"` | 16 字符，500ms 实/500ms 虚 |
| `beatPlatforms[0].id` | `"bp_pulse_a"` | 唯一 id |
| `beatPlatforms[0].tiles` | tx17,18 @ ty4 | 与下方 `tiles[]` 不重复（initial=solid 不进 tiles） |
| `beatPlatforms[0].initial` | `"solid"` | 第 0 拍前保底相位=实；故**不**列入 `tiles[]` |
| `tiles[]` | 见 §3 | 地面 ty7-8 全宽 + 墙列 + oneway + 悬浮 solid；**节拍平台 tile 不在内** |
| `entities[]` | 见 §4 | 5 敌 + 7 coin + 6 seed + 1 checkpoint（坐标精确） |
| `checkpoints[]` | `[]` | 检查点走 `entities[]` |
| `props[]` | `[]` | 无 |

---

## 2. 坐标自洽校验（Coordinate Invariants）

- 地面：所有 `tx∈[0,40)`，`ty∈{7,8}`，kind=`solid` → 80 块。
- 边界墙：左列 `tx=0` 与右列 `tx=39`，`ty∈[0,8]`，kind=`solid` → 18 块（其中 ty7,ty8 与地面重复，loader 去重即可）。
- oneway：`(14,15,16)@ty5`、`(29,30,31)@ty6` → 6 块，kind=`oneway`。
- 悬浮 solid：`(22,23)@ty4` → 2 块，kind=`solid`。
- 节拍平台：`bp_pulse_a` = `(17,18)@ty4`，initial=solid → **不**进 `tiles[]`，仅由 `beatPlatforms` 声明。
- 所有实体 `y`：地面实体 y=200（敌/coin/seed 脚底贴 ty7 顶 y=224，敌高~24）；checkpoint y=176（高~48）；漂浮 du_fu y=120、shi_pao y=100；高位 coin y=150/96。
- 边界：最大实体 x=1150(<1280) ✅；goal x+w=1216(<1280) ✅；所有 y<288 ✅。

---

## 3. `tiles[]` 清单（全部 solid / oneway）

**地面 ty7-8（tx 0→39，每列两块）：**
```
(tx0,ty7)(tx0,ty8)(tx1,ty7)(tx1,ty8) … (tx39,ty7)(tx39,ty8)   // 共 80 块
```
**边界墙（重复声明风格）：**
```
左列 tx0: ty0,ty1,ty2,ty3,ty4,ty5,ty6,ty7,ty8   // 9 块
右列 tx39: ty0,ty1,ty2,ty3,ty4,ty5,ty6,ty7,ty8  // 9 块（ty7,ty8 与地面重复）
```
**oneway（kind="oneway"）：**
```
(tx14,ty5)(tx15,ty5)(tx16,ty5)(tx29,ty6)(tx30,ty6)(tx31,ty6)   // 6 块
```
**悬浮 solid（kind="solid"）：**
```
(tx22,ty4)(tx23,ty4)   // 2 块
```
> 节拍平台 (17,18,ty4) **不在** 此清单（initial=solid，仍由 beatPlatforms 声明并登入动态实心集）。

---

## 4. `entities[]` 精确坐标表

| idx | type | x | y | 备注 |
|---|---|---|---|---|
| 1 | coin | 200 | 200 | 热身·地面 |
| 2 | ci_li | 320 | 200 | 地刺·地面 |
| 3 | seed | 380 | 200 | **seed_01**，前段锚点 |
| 4 | coin | 400 | 200 | 热身·地面 |
| 5 | coin | 480 | 200 | 地面 |
| 6 | ci_li | 560 | 200 | 地刺·地面 |
| 7 | seed | 600 | 200 | **seed_03**，新增·藤阶段触发点 |
| 8 | coin | 620 | 150 | 高位赏金 |
| 9 | shi_pao | 704 | 100 | 石炮·高位 |
| 10 | du_fu | 720 | 120 | 漂浮 |
| 11 | coin | 760 | 96 | 高位赏金 |
| 12 | coin | 840 | 200 | 地面 |
| 13 | chong_feng | 880 | 200 | 冲锋·地面 |
| 14 | seed | 920 | 200 | **seed_04**，新增·花阶段触发点 |
| 15 | checkpoint | 960 | 176 | **mid 检查点** |
| 16 | seed | 1010 | 200 | **seed_02**，终前锚点（4 阶段演示第 4 颗·果） |
| 17 | coin | 1080 | 200 | 地面 |
| 18 | seed | 1100 | 200 | **seed_05**，新增·收集余量 |
| 19 | seed | 1150 | 200 | **seed_06**，新增·收集余量 |

> 计数：coin×7、ci_li×2、chong_feng×1、du_fu×1、shi_pao×1、seed×6、checkpoint×1 = 共 19 个实体。

> **演示路径（前 4 颗触发四阶段）**：按 x 升序可达顺序，前 4 颗种子使玩家一局内走过 苗→藤→花→果（`growthPerSeed=0.25`，4 颗满蜕变 `cap=1.0`，见 GDD 12 §3.3）：
> `seed_01(380) → seed_03(600) → seed_04(920) → seed_02(1010)`（sprout→vine→bloom→fruit）；
> 余 `seed_05(1100)`、`seed_06(1150)` 为收集探索余量（不强制四阶段）。

---

## 5. 可直接落盘的 JSON（`src/config/levels/1-1.json`）

```json
{
  "id": "1-1",
  "version": 1,
  "tileSize": 32,
  "width": 40,
  "height": 9,
  "tiles": [
    { "tx": 0, "ty": 8, "kind": "solid" }, { "tx": 0, "ty": 7, "kind": "solid" },
    { "tx": 1, "ty": 8, "kind": "solid" }, { "tx": 1, "ty": 7, "kind": "solid" },
    { "tx": 2, "ty": 8, "kind": "solid" }, { "tx": 2, "ty": 7, "kind": "solid" },
    { "tx": 3, "ty": 8, "kind": "solid" }, { "tx": 3, "ty": 7, "kind": "solid" },
    { "tx": 4, "ty": 8, "kind": "solid" }, { "tx": 4, "ty": 7, "kind": "solid" },
    { "tx": 5, "ty": 8, "kind": "solid" }, { "tx": 5, "ty": 7, "kind": "solid" },
    { "tx": 6, "ty": 8, "kind": "solid" }, { "tx": 6, "ty": 7, "kind": "solid" },
    { "tx": 7, "ty": 8, "kind": "solid" }, { "tx": 7, "ty": 7, "kind": "solid" },
    { "tx": 8, "ty": 8, "kind": "solid" }, { "tx": 8, "ty": 7, "kind": "solid" },
    { "tx": 9, "ty": 8, "kind": "solid" }, { "tx": 9, "ty": 7, "kind": "solid" },
    { "tx": 10, "ty": 8, "kind": "solid" }, { "tx": 10, "ty": 7, "kind": "solid" },
    { "tx": 11, "ty": 8, "kind": "solid" }, { "tx": 11, "ty": 7, "kind": "solid" },
    { "tx": 12, "ty": 8, "kind": "solid" }, { "tx": 12, "ty": 7, "kind": "solid" },
    { "tx": 13, "ty": 8, "kind": "solid" }, { "tx": 13, "ty": 7, "kind": "solid" },
    { "tx": 14, "ty": 8, "kind": "solid" }, { "tx": 14, "ty": 7, "kind": "solid" },
    { "tx": 15, "ty": 8, "kind": "solid" }, { "tx": 15, "ty": 7, "kind": "solid" },
    { "tx": 16, "ty": 8, "kind": "solid" }, { "tx": 16, "ty": 7, "kind": "solid" },
    { "tx": 17, "ty": 8, "kind": "solid" }, { "tx": 17, "ty": 7, "kind": "solid" },
    { "tx": 18, "ty": 8, "kind": "solid" }, { "tx": 18, "ty": 7, "kind": "solid" },
    { "tx": 19, "ty": 8, "kind": "solid" }, { "tx": 19, "ty": 7, "kind": "solid" },
    { "tx": 20, "ty": 8, "kind": "solid" }, { "tx": 20, "ty": 7, "kind": "solid" },
    { "tx": 21, "ty": 8, "kind": "solid" }, { "tx": 21, "ty": 7, "kind": "solid" },
    { "tx": 22, "ty": 8, "kind": "solid" }, { "tx": 22, "ty": 7, "kind": "solid" },
    { "tx": 23, "ty": 8, "kind": "solid" }, { "tx": 23, "ty": 7, "kind": "solid" },
    { "tx": 24, "ty": 8, "kind": "solid" }, { "tx": 24, "ty": 7, "kind": "solid" },
    { "tx": 25, "ty": 8, "kind": "solid" }, { "tx": 25, "ty": 7, "kind": "solid" },
    { "tx": 26, "ty": 8, "kind": "solid" }, { "tx": 26, "ty": 7, "kind": "solid" },
    { "tx": 27, "ty": 8, "kind": "solid" }, { "tx": 27, "ty": 7, "kind": "solid" },
    { "tx": 28, "ty": 8, "kind": "solid" }, { "tx": 28, "ty": 7, "kind": "solid" },
    { "tx": 29, "ty": 8, "kind": "solid" }, { "tx": 29, "ty": 7, "kind": "solid" },
    { "tx": 30, "ty": 8, "kind": "solid" }, { "tx": 30, "ty": 7, "kind": "solid" },
    { "tx": 31, "ty": 8, "kind": "solid" }, { "tx": 31, "ty": 7, "kind": "solid" },
    { "tx": 32, "ty": 8, "kind": "solid" }, { "tx": 32, "ty": 7, "kind": "solid" },
    { "tx": 33, "ty": 8, "kind": "solid" }, { "tx": 33, "ty": 7, "kind": "solid" },
    { "tx": 34, "ty": 8, "kind": "solid" }, { "tx": 34, "ty": 7, "kind": "solid" },
    { "tx": 35, "ty": 8, "kind": "solid" }, { "tx": 35, "ty": 7, "kind": "solid" },
    { "tx": 36, "ty": 8, "kind": "solid" }, { "tx": 36, "ty": 7, "kind": "solid" },
    { "tx": 37, "ty": 8, "kind": "solid" }, { "tx": 37, "ty": 7, "kind": "solid" },
    { "tx": 38, "ty": 8, "kind": "solid" }, { "tx": 38, "ty": 7, "kind": "solid" },
    { "tx": 39, "ty": 8, "kind": "solid" }, { "tx": 39, "ty": 7, "kind": "solid" },
    { "tx": 0, "ty": 0, "kind": "solid" }, { "tx": 39, "ty": 0, "kind": "solid" },
    { "tx": 0, "ty": 1, "kind": "solid" }, { "tx": 39, "ty": 1, "kind": "solid" },
    { "tx": 0, "ty": 2, "kind": "solid" }, { "tx": 39, "ty": 2, "kind": "solid" },
    { "tx": 0, "ty": 3, "kind": "solid" }, { "tx": 39, "ty": 3, "kind": "solid" },
    { "tx": 0, "ty": 4, "kind": "solid" }, { "tx": 39, "ty": 4, "kind": "solid" },
    { "tx": 0, "ty": 5, "kind": "solid" }, { "tx": 39, "ty": 5, "kind": "solid" },
    { "tx": 0, "ty": 6, "kind": "solid" }, { "tx": 39, "ty": 6, "kind": "solid" },
    { "tx": 0, "ty": 7, "kind": "solid" }, { "tx": 39, "ty": 7, "kind": "solid" },
    { "tx": 0, "ty": 8, "kind": "solid" }, { "tx": 39, "ty": 8, "kind": "solid" },
    { "tx": 14, "ty": 5, "kind": "oneway" }, { "tx": 15, "ty": 5, "kind": "oneway" },
    { "tx": 16, "ty": 5, "kind": "oneway" },
    { "tx": 29, "ty": 6, "kind": "oneway" }, { "tx": 30, "ty": 6, "kind": "oneway" },
    { "tx": 31, "ty": 6, "kind": "oneway" },
    { "tx": 22, "ty": 4, "kind": "solid" }, { "tx": 23, "ty": 4, "kind": "solid" }
  ],
  "entities": [
    { "type": "ci_li", "x": 320, "y": 200 },
    { "type": "ci_li", "x": 560, "y": 200 },
    { "type": "chong_feng", "x": 880, "y": 200 },
    { "type": "du_fu", "x": 720, "y": 120 },
    { "type": "shi_pao", "x": 704, "y": 100 },
    { "type": "coin", "x": 200, "y": 200 },
    { "type": "coin", "x": 400, "y": 200 },
    { "type": "coin", "x": 480, "y": 200 },
    { "type": "coin", "x": 620, "y": 150 },
    { "type": "coin", "x": 760, "y": 96 },
    { "type": "coin", "x": 840, "y": 200 },
    { "type": "coin", "x": 1080, "y": 200 },
    { "type": "seed", "x": 380, "y": 200, "seedId": "seed_01" },
    { "type": "seed", "x": 1010, "y": 200, "seedId": "seed_02" },
    { "type": "seed", "x": 600, "y": 200, "seedId": "seed_03" },
    { "type": "seed", "x": 920, "y": 200, "seedId": "seed_04" },
    { "type": "seed", "x": 1100, "y": 200, "seedId": "seed_05" },
    { "type": "seed", "x": 1150, "y": 200, "seedId": "seed_06" },
    { "type": "checkpoint", "x": 960, "y": 176 }
  ],
  "props": [],
  "checkpoints": [],
  "goal": {
    "type": "triumph_gate",
    "x": 1184,
    "y": 160,
    "w": 32,
    "h": 64
  },
  "beat": {
    "enabled": true,
    "bpm": 120,
    "grid": 8,
    "tracks": [
      { "target": "bp_pulse_a", "pattern": "SSSSSSSSGGGGGGGG" }
    ]
  },
  "beatPlatforms": [
    { "id": "bp_pulse_a", "initial": "solid", "tiles": [ { "tx": 17, "ty": 4 }, { "tx": 18, "ty": 4 } ] }
  ],
  "metadata": {
    "name": "翠野序章",
    "theme": "grass",
    "parTimeMs": 60000
  },
  "spawn": {
    "x": 64,
    "y": 190
  }
}
```

---

## 6. 转录校验清单（Transcription Checklist for Engineering Lead）

- [ ] `beat.tracks[].target` = `"bp_pulse_a"` 与 `beatPlatforms[].id` 一致。
- [ ] `beatPlatforms[0].tiles` (17,18 @ ty4) **未**出现在 `tiles[]` 中（initial=solid 仍由加载器登入动态实心集）。
- [ ] 地面 `ty7-8` 全 40 列连续；左右墙 `tx0`/`tx39` ty0-8 声明。
- [ ] 所有 `tx∈[0,40)`、`ty∈[0,9)`；所有 `x∈[0,1280)`、`y∈[0,288)`（goal x+w=1216<1280 ✅）。
- [ ] 无新增 entity type / tile kind（仅 ci_li/du_fu/chong_feng/shi_pao/coin/seed/checkpoint + solid/oneway）。
- [ ] `goal.type` 沿用 `"triumph_gate"`（IP 安全）。
- [ ] 6 颗种子沿通关路径分布（seed_01..seed_06，y=200），前 4 颗可达顺序触发 苗→藤→花→果（见 §4 演示路径）。

---

*机器规格交付完毕，未 git commit，待主理人（游承峰）审批后由工程主程落盘 `src/config/levels/1-1.json`（本文件与 JSON 已同步为 6 颗种子）。*
