# 办公 biome 美术规格（office-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；roadmap 批次 3，urban_indoor family）
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/theme-system.md` §4.1（office 行）｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：roadmap 批次 3（高）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `office`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**办公（室内）主题视觉**与**专属障碍（咖啡渍 / 文件堆）视觉**；玩法/数值/物理（low_friction 局部）由对应 GDD 与工程负责。办公**无专属敌**（theme-system §4.1 office 行「专属敌 无」），同屏仅通用基底 4 敌。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 绿植点缀（crystalCore 核心绿） |
| 2 | 阴影绿 | `#5FA82F` | 绿植暗部（可选 tint 源） |
| 3 | 暖橙 | `#F2933C` | 文件夹/便签暖橙（firelight 暖意） |
| 4 | 暖黄 | `#FFD23F` | 屏幕高光 / 暖意（少） |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，本关不用于敌/障碍） |
| 7 | 警示红 | `#E8483B` | 危险语义（ci_li 等 / 咖啡渍边警示） |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | **显示器蓝光（crystalGlow 辉光）** |
| 10 | 环境冷蓝 | `#4A78C0` | **办公桌/柜体主面 / 冷调灰** |
| 11 | 天空 | `#5BC8F5` | 天花板微光（bg tint 源） |

> 本 biome 冷调主导（环境冷蓝桌柜 + 蓝紫屏幕 + 天空天花板微光）+ 暖橙文件夹/绿植反差；全部引用色取自锁色板，**派生暗面/天花板由 `#4A78C0`/`#5BC8F5` 运行时 tint**（0 新增）。
> **⚠️ 命粉 `#F26D8B` 为生命/爱心专属色（art-bible §3.2/§9.1 已做生命色解耦），本关咖啡渍/文件堆均不采用命粉，避免「粉=生命 vs 危险」语义冲突。**

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 天花板微光填充（"天空→天花板"隐喻） |
| ground | `rockFace` | 地面主面（办公桌 / 柜体 / 实心瓦片） |
| accent | `rockBody` | 地面暗面（柜体底 / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalCore` | 植披核心（绿植绿） |
| trim | `crystalGlow` | 辉光（蓝紫屏幕光 / 荧光反差） |
| outline | `out-line` | 全局描边 |
| seed | `firelight` | 暖色点缀（文件夹 / 便签暖橙） |

### 1.2 办公 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `lighten(#5BC8F5, 0.15)` ≈ `#74D0F7` | tint 派生（天花板微光） | 0 新增 |
| ground | `rockFace` | `darken(#4A78C0, 0.2)` ≈ `#3B609A` | tint 派生（冷调桌柜灰） | 0 新增 |
| accent | `rockBody` | `darken(#4A78C0, 0.5)` ≈ `#254060` | tint 派生（柜体暗面） | 0 新增 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalCore` | `#7CC242` | 草绿（绿植） | #1 |
| trim | `crystalGlow` | `#6E7BF2` | 蓝紫（屏幕辉光） | #9 |
| outline | `out-line` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#F2933C` | 暖橙（文件夹） | #3 |

> 8 个权威 hex（含 3 个 tint 派生）全部落在锁色板内或由其 tint 派生，**无任何新 hex**（tint 不计入新增，见 §7）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 天花板微光 bg | `lighten(#5BC8F5, 0.15)` ≈ `#74D0F7` | 荧光白天花板 | 0 新增（tint） |
| 冷调桌柜灰 rockFace | `darken(#4A78C0, 0.2)` ≈ `#3B609A` | 办公桌/柜体主面 | 0 新增（tint） |
| 柜体暗面 rockBody | `darken(#4A78C0, 0.5)` ≈ `#254060` | 柜体底/oneway | 0 新增（tint） |
| 绿植暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 绿植阴影 | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；办公经 theme palette 映射（§1.2）生成，**不另绘办公瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原/洞穴一致；仅主色由草绿（base）→ 冷调桌柜灰 `darken(#4A78C0,0.2)`、身色由暖橙（base）→ 柜体暗面 `darken(#4A78C0,0.5)`。
- **家具即地形**：办公桌/文件柜经 base 瓦片 tint 映射为"可踩平台/实心 solid"，碰撞仍由 `tiles[]` 决定；装饰性家具（非碰撞）见下。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_desk` 办公桌：矩形桌面（冷调灰 `#3B609A` 面 + 暗面 tint + 描边），中景。
  - `deco_plant` 绿植：草绿 `#7CC242` 团 + 暗部 tint + 描边（crystalCore 同源）。
  - `deco_monitor` 显示器：矩形屏（蓝紫 `#6E7BF2` 屏光 + 暖橙 `#F2933C` 边框），纯氛围点缀。
  - MVP：用 `Graphics` 画简单多边形/矩形占位，程序化 tint，无需 PNG。
- **IP**：办公桌/绿植/显示器为原创办公形态，非管道/龟壳符号。

---

## 3. 专属障碍视觉规格（锁色板内 · 双编码）

> 办公**无专属敌**（§0）；专属障碍为地形机制类。通用规则（asset-spec §2.5）：可踩顶 = 软｜不可踩顶 = 硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。

### 3.1 `coffee_spill` 咖啡渍（局部低摩擦 / 不可踩陷阱区）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 渍面 | `darken(#4A78C0, 0.35)` ≈ `#304E7D` tint（深冷渍） | 0 新增，地面局部斑块 |
| 边缘警示 | `警示红 #E8483B` 细描边（闪烁 ≤2Hz） | 锁色板 #7（低摩擦 telegraph） |
| 高光 | `天空 #5BC8F5` alpha ≤0.4（湿反光） | 锁色板 #11 |

- 非碰撞体（由 03 Character `frictionScale` 局部覆盖触发滑地，见 theme-system §3.4 R1）；视觉为地面深渍 + 红边闪 + 湿反光，明确"此地易失控"。

### 3.2 `paper_pile` 文件堆（可踩平台 / 障碍）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 纸堆体 | `暖橙 #F2933C` 面 + `darken(#F2933C,0.5)` ≈ `#79491E` 暗面 | 锁色板 #3 / tint |
| 纸张边 | `描边 #2A1A12` 1px | 锁色板 #5 |
| 高光页 | `暖黄 #FFD23F` 小矩形 | 锁色板 #4（翻页亮页） |

- 可踩平台语义（soft 顶，圆润纸堆顶）；亦可作为中段障碍（高度差）。与 4 旧敌剪影全异（方纸堆 vs 圆/楔/扁/方敌；石炮为方块炮台，paper_pile 为有机纸堆 + 暖橙，区分明显）。

---

## 4. 敌种视觉规格（通用基底 · 锁色板内）

> 办公**无专属敌**，同屏仅通用基底 4 敌（ci_li/du_fu/chong_feng/shi_pao）。着色沿用各自 biome 的锁色板映射（见 cave/vine/storm §4），本关冷调桌柜灰底下维持辨识：
- `du_fu` 嘟浮：加 `暖黄 #FFD23F` 肚皮斑（蓝紫身上暖点，强对比，同 storm_sky §4.1）。
- `shi_pao` 石炮：石身 `#4A78C0` 与 office rockFace `darken(#4A78C0,0.2)` 近色，靠 `描边 #2A1A12` + 红炮口 + 方硬轮廓 + 多置于蓝紫 `#6E7BF2` 显示器前维持辨识（同 cave/storm 方案）。
- `ci_li` / `chong_feng`：沿用各自锁色板映射，靠描边 + 形状区分。
- 四敌可踩/不可踩汇总（与 cave/vine/storm 一致）：刺栗/嘟浮 soft 顶可踩；冲锋/石炮 hard 顶不可踩。

---

## 5. 背景视差层级 + 光照 / 氛围（明亮办公）

**氛围意图**：明亮荧光办公——冷调桌柜、蓝紫屏幕光、草绿绿植、暖橙文件夹，靠**冷调主色 + 蓝紫屏幕辉光 + 暖橙微光**制造"规整中藏生机"对比（对比洞穴幽暗/沙漠炽热）。

**光照**：荧光灯均匀照明、整体明度偏高、饱和中（art-bible §3.3：主体明度 ≥60%、饱和 55–80%）。无冷黑阴影；任意前景与背景亮度对比 ≥3:1（关键交互 ≥4.5:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 天花板 | — | 纯色填充（"天空→天花板"隐喻） | `bg = #74D0F7`（荧光白微光） |
| 远景 | 0.3 | 工位剪影 / 隔断 | `darken(#4A78C0,0.4)` 剪影，无描边、低饱和 |
| 中景 | 0.6 | 办公桌 / 绿植 / 显示器 | `冷调灰 #3B609A` + `草绿 #7CC242` + `蓝紫 #6E7BF2` |
| 游戏层 | 1.0 | 桌柜地形/敌/道具/主角 | `rockFace #3B609A` / `rockBody #254060` / 描边 |
| 前景 | 1.2（克制） | 偶尔纸张掠过 | `暖橙 #F2933C` alpha，遮挡路径 ≤10% |

**与洞穴/藤林/风暴/海/沙漠/家/街的基调反差**：同套 8 槽接口下，办公 = 冷调桌柜灰（`darken(#4A78C0,0.2)`）+ 天花板微光（`lighten(#5BC8F5,0.15)`）+ 蓝紫屏幕，靠 hex 即拉开"幽暗→明绿→压抑→清凉→炽热→温暖→都市冷→规整办公"的序列差。

---

## 6. 可访问性（与全主题明显区分）

- **主题色相区分（不撞色）**：
  - cave = 冷蓝灰地面（`#4A78C0`）+ 暗背景 → "幽暗"。
  - vine_forest = 草绿地面（`#7CC242`）+ 亮天空 → "明绿生机"。
  - storm_sky = 蓝紫地面（`#6E7BF2`）+ 冷蓝天光 → "压抑风暴"。
  - sea = 环境冷蓝地面（`#4A78C0`）+ 天空蓝水面 → "清凉海洋"。
  - desert = 暖橙沙岩（`#F2933C`）+ 暖沙晴空 → "炽热沙漠"。
  - home = 暖橙木地板（`#F2933C`）+ 暖棕墙 → "温暖家居"。
  - street = 冷蓝灰建筑（`#304E7D`）+ 压暗天空 → "都市冷调"。
  - **office = 冷调桌柜灰（`#3B609A`）+ 天花板微光（`#74D0F7`）** → "规整办公"（本关唯一"荧光白天花板 + 蓝紫屏幕"组合）。
  - 地面主色 + 天花板色即首要区分信号，色盲玩家靠**地面 hue + 装饰形态**（桌/绿植/显示器）即可分辨。
- **专属障碍双编码**：coffee_spill = 深渍 + 红边闪 + 湿反光（低摩擦 telegraph）；paper_pile = 暖橙纸堆 + 暖黄翻页（可踩平台）。均形状+颜色双编码，色盲安全。
- **敌种在冷底关的反差**：du_fu 加暖黄肚皮斑；shi_pao 靠描边+红炮口+方硬轮廓（§4）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"；屏幕光/ Coffee 边闪 ≤3Hz（防光敏）。
- **减少动态**：显示器闪/纸张掠过在"减少动态"开关下减半或停首帧（对齐 art-bible §9.3）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#4A78C0` / `#6E7BF2` / `#5BC8F5` / `#7CC242` / `#2A1A12` / `#F2933C` / `#FFD23F` / `#E8483B` = **8 色**（锁色板 #1/3/4/5/7/9/10/11）。
- **派生 tint（0 新增）**：天花板 `lighten(#5BC8F5,0.15)`、桌柜灰 `darken(#4A78C0,0.2)`、柜体暗面 `darken(#4A78C0,0.5)`、绿植暗部 `darken(#7CC242,0.5)`，均由锁色板色运行时 tint 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心，本关不用于敌）、`经济金 #F2C94C`（coin）、`阴影绿 #5FA82F`（绿植暗部 tint 源）——均属锁色板 #2/6/8。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **命粉规避声明**：本 biome 严格避用 `命粉 #F26D8B` 于任何敌/障碍（含 coffee_spill/paper_pile），与 art-bible §3.2/§9.1 生命色解耦一致。
- **越界 reconcile**：将 asset-spec §2 中越界生产色映射到锁色板色 / tint（同 cave/vine/storm §7），提请主理人据此更新 asset-spec §2（非本 biome 引入，属全局 reconcile）。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`｜`'vine_forest'`｜`'storm_sky'`｜`'sea'`｜`'desert'`｜`'home'`｜`'street'`｜**`'office'`（新增，roadmap 批次 3）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'office'`（fail-safe 回退 `'grass'`）。

### 8.2 办公调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段，仅 add 一个 `office` entry。下表为注册数据（非代码）：

| 引擎字段 | office Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x74D0F7` | lighten(#5BC8F5,0.15) tint，0 新增 |
| `rockFace` | `0x3B609A` | darken(#4A78C0,0.2) tint，0 新增 |
| `rockBody` | `0x254060` | darken(#4A78C0,0.5) tint，0 新增 |
| `out-line` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xF2933C` | 暖橙 #3 |
| `crystalCore` | `0x7CC242` | 草绿 #1 |
| `crystalGlow` | `0x6E7BF2` | 蓝紫 #9 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（办公取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['office'].rockFace`(`#3B609A`) / `.rockBody`(`#254060`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['office'].bg)`(`#74D0F7`) |
| 专属障碍占位（`office-obstacle-view.ts` 新增） | coffee_spill=暗面 tint+`danger`边闪+`天空`反光；paper_pile=`firelight`(`#F2933C`)+暗面 tint+`crystalCore`翻页；描边=`out-line` |
| 敌种/装饰绘制 | 见 §4 锁色板映射；石炮石身=`环境冷蓝 #4A78C0`（`THEME_PALETTES` 未单独存，由 `#4A78C0` 常量取） |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme` 增 `'office'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['office']` 的 8 字段（`bg`/`rockFace`/`rockBody`/`out-line`/`firelight`/`crystalCore`/`crystalGlow`/`danger`）。
- **办公映射**：bg=`#74D0F7`(tint)、rockFace=`#3B609A`(tint)、rockBody=`#254060`(tint)、out-line=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#7CC242`、crystalGlow=`#6E7BF2`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['office']`；咖啡渍/文件堆走新增 `office-obstacle-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。
- **无专属敌**：办公同屏仅通用基底 4 敌（§4），无需新增敌 view 分支。

---

*本文件为办公 biome 美术规格（加法），roadmap 批次 3；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
