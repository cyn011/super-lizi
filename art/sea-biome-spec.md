# 海 biome 美术规格（sea-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；roadmap 批次 2，世界 1 第 3 关 1-3 优先落地）
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/theme-system.md` §4.1（sea 行）｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：roadmap 批次 2（高优先）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `sea`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**海主题视觉**与**新敌水母 `jellyfish` 视觉**与**专属障碍（深水区 / 暗流）视觉**；玩法/数值/物理（tide/current/淹没判定）由对应 GDD 与工程负责。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 海藻 / 珊瑚绿 |
| 2 | 阴影绿 | `#5FA82F` | 海藻暗部（可选 tint 源） |
| 3 | 暖橙 | `#F2933C` | 阳光透射暖意 / 沉船木 |
| 4 | 暖黄 | `#FFD23F` | 气泡核心 / 阳光高光 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，本关不用于敌） |
| 7 | 警示红 | `#E8483B` | 危险语义（暗流警示 / ci_li 等） |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 水母触手辉光 / 深海辉光 |
| 10 | 环境冷蓝 | `#4A78C0` | **礁岩主面 / 海床基色** |
| 11 | 天空 | `#5BC8F5` | **水面天光 / 水母半透伞** |

> 本 biome 蓝系主导（环境冷蓝 / 天空 / 蓝紫）+ 草绿海藻 + 暖橙暖意反差；全部引用色取自锁色板，**派生暗面由 `#4A78C0` 运行时 tint**（0 新增）。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 水面天光填充 |
| ground | `rockFace` | 地面主面（礁岩 / 海床 / 实心瓦片） |
| accent | `rockBody` | 地面暗面（礁岩底 / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 海藻 / 辉光（冷中藏绿反差） |
| trim | `crystalCore` | 核心高光（气泡 / 阳光核心） |
| outline | `out-line` | 全局描边 |
| seed | `firelight` | 暖色点缀（阳光透射 / 暖意） |

### 1.2 海 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `#5BC8F5` | 天空 | #11 |
| ground | `rockFace` | `#4A78C0` | 环境冷蓝 | #10 |
| accent | `rockBody` | `darken(#4A78C0, 0.5)` ≈ `#254060` | tint 派生 | 0 新增 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#7CC242` | 草绿（海藻） | #1 |
| trim | `crystalCore` | `#FFD23F` | 暖黄（气泡核心） | #4 |
| outline | `out-line` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#F2933C` | 暖橙（阳光透射） | #3 |

> 8 个权威 hex（含 1 个 tint 派生）全部落在锁色板内或由其 tint 派生，**无任何新 hex**（tint 不计入新增，见 §7）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 礁岩暗面 rockBody | `darken(#4A78C0, 0.5)` ≈ `#254060` | 海床/礁岩底/oneway | 0 新增（tint） |
| 远景水幕剪影 | `darken(#4A78C0, 0.4)` ≈ `#2C486F` | parallax 远层（无描边、低饱和） | 0 新增（tint） |
| 海藻暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 海藻阴影 | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；海经 theme palette 映射（§1.2）生成，**不另绘海瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原/洞穴一致；仅主色由草绿（base）→ 环境冷蓝 `#4A78C0`、身色由暖橙（base）→ 暗冷蓝 tint `#254060`。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_wave` 浪线：中景水平波浪线（天空 `#5BC8F5` + alpha ≤0.5），纯氛围。
  - `deco_coral` 珊瑚：礁岩边的草绿 `#7CC242` 分枝 + 暖橙 `#F2933C` 点缀（非碰撞装饰）。
  - `deco_bubble` 气泡：缓浮小圆（天空 `#5BC8F5` alpha ≤0.4 / 暖黄 `#FFD23F` 核心），沿水流上升。
  - MVP：用 `Graphics` 画简单多边形/圆占位，程序化 tint，无需 PNG。
- **IP**：珊瑚/气泡为原创海洋形态，非鱼骨/船锚符号。

---

## 3. 水母 `jellyfish` 视觉规格（新敌种 · 蓝系 · 可踩）

> 对齐 theme-system §4.2（海专属敌）。形状语言优先：水母 = **半透明伞盖 + 触手 + 暖黄核心**，与 4 旧敌 + gu_bao/bouncy_vine/cyclone 全异。配色：伞盖 `天空 #5BC8F5`（半透）+ 触手 `蓝紫 #6E7BF2` + 核心 `暖黄 #FFD23F` + 描边 `#2A1A12`。
> 几何基准：bbox `width=36`、`height=40`，漂浮正弦运动；soft 顶 = 可踩。

### 3.1 视觉明细

| 维度 | 几何 | 配色 | 危害 | 可踩 |
|---|---|---|---|---|
| 伞盖 | 半圆穹顶（半透明） | `天空 #5BC8F5` alpha ≤0.5 + `描边 #2A1A12` 细边 | 否 | 是（soft 顶） |
| 触手 | 伞下 3–4 条飘带 | `蓝紫 #6E7BF2` alpha ≤0.6 | 否 | — |
| 核心 | 伞内小点 | `暖黄 #FFD23F` | 否 | — |

### 3.2 绘制约定（MVP Graphics）

- **伞盖**：半圆 `fillStyle(0x5BC8F5, 0.5)` 填充 + `lineStyle(1, 0x2A1A12)` 描边；随漂浮轻微 squash。
- **触手**：`蓝紫 #6E7BF2` 半透曲线（alpha ≤0.6），随相位摆动（≤2Hz，防光敏）。
- **核心**：`暖黄 #FFD23F` 小圆点（alpha 0.8）。
- **可踩提示**：半透伞盖 + 无尖刺 = 明确 soft 顶；与硬顶敌（锥冲/石炮）形状双编码区分。

### 3.3 与 du_fu / 4 旧敌 / 其他新元素轮廓对比（确保全异 · 色盲安全）

| 元素 | 轮廓 | 主色 | 水母区分点 |
|---|---|---|---|
| `du_fu` 嘟浮 | 扁圆 + 双翅（**实心**） | 蓝紫 `#6E7BF2` | 水母 = **半透明天空蓝伞 + 触手**（实心 vs 半透 + 翅 vs 触手） |
| `ci_li` 刺栗 | 圆球 + 周身短刺 | 警示红 | 水母 = 半透伞无刺 |
| `chong_feng` 锥冲 | 长条楔形 | 警示红 | 水母 = 圆穹顶（非楔形） |
| `shi_pao` 石炮 | 方正石块 + 炮口 | 环境冷蓝 | 水母 = 有机半透（非方块） |
| `cyclone` 气旋 | 半透明蓝气柱 | 天空 `#5BC8F5` | 水母 = **有核心+触手的实体伞**（力场 vs 敌） |

> **⚠️ 与 du_fu 同色系风险（已在 theme-system 复核中提示 design-theme）**：du_fu 主体 = 蓝紫 `#6E7BF2`，水母触手也用蓝紫。本 spec 将水母**主体伞盖强制为天空蓝 `#5BC8F5` 半透**（区别于 du_fu 的实心蓝紫），蓝紫仅作触手/辉光点缀 → 与 du_fu 拉开「天空蓝半透 vs 蓝紫实心」色相 + 透明度双重区分，色盲安全更稳。海关联同时出现 du_fu（通用）+ jellyfish（专属），依此区分。
> 结论：水母以 **「半透明天空蓝伞 + 蓝紫触手 + 暖黄核心」** 剪影唯一，soft 顶可踩，与所有敌/元素全异；色盲安全。

### 3.4 后续像素化路径（AI 生成提示词预留）

- **jellyfish**：`pixel art, 32px grid, translucent sky-blue jellyfish umbrella, sky blue #5BC8F5 alpha, blue-purple #6E7BF2 tentacles, warm yellow #FFD23F core, dark outline #2A1A12, no fish no anchor, flat toon`
- **sea tile**：`pixel art tile, 32x32, cold blue #4A78C0 rock face, darker tinted body, 1px dark outline #2A1A12, underwater`

---

## 4. 专属障碍视觉规格（着色指引 · 限锁色板内）

> 通用规则（asset-spec §2.5）：可踩顶 = 软｜不可踩顶 = 硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。

### 4.1 `deep_water` 深水区（淹没 = pit 判定）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 水体 | `环境冷蓝 #4A78C0` 填充 alpha ≤0.6 | 锁色板 #10（深水域） |
| 水面线 | `天空 #5BC8F5` 细线 + alpha | 锁色板 #11 |
| 危险暗示 | 顶部 `警示红 #E8483B` 细波纹（可选） | 锁色板 #7（淹没=死亡，需 telegraph） |

- 非碰撞体（由水位线/淹没判定触发 pit death，复用 07）；视觉为半透水体 + 水面线，纯氛围 + 危险暗示。

### 4.2 `riptide` 暗流（水平水流推力区）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 流线 | `天空 #5BC8F5` 短弧线（alpha ≤0.5） | 锁色板 #11 |
| 核心涌动 | `蓝紫 #6E7BF2` 微弱辉光 | 锁色板 #9 |

- 区域力场视觉（类比 cyclone），非实体；靠流线方向暗示推力。

### 4.3 四通用敌可踩/不可踩（与 cave/storm 一致）

海关同屏含通用基底 4 敌（ci_li/du_fu 可踩，chong_feng/shi_pao 不可踩），着色沿用各自 biome 的锁色板映射（见 cave/vine/storm §4），本关蓝底下 du_fu 加 `暖黄 #FFD23F` 肚皮斑提升辨识（同 storm_sky §4.1）。

---

## 5. 背景视差层级 + 光照 / 氛围（明亮海洋）

**氛围意图**：明亮海洋——环境冷蓝礁岩、天空蓝水面、草绿海藻、暖橙阳光透射，靠**冷蓝主色 + 草绿生机 + 暖橙微光**制造「清凉中藏暖」对比。

**光照**：水下斜阳、整体明度偏高、饱和中高（art-bible §3.3：主体明度 ≥60%、饱和 55–80%）。无冷黑阴影；任意前景与背景亮度对比 ≥3:1（关键交互 ≥4.5:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 天空/水面 | — | 纯色填充 | `bg = #5BC8F5`（水面天光） |
| 远景 | 0.3 | 水幕剪影 / 远礁 | `darken(#4A78C0,0.4)` 剪影，无描边、低饱和 |
| 中景 | 0.6 | 浪线 / 珊瑚 / 气泡 | `天空 #5BC8F5` + `草绿 #7CC242` + `暖橙 #F2933C` |
| 游戏层 | 1.0 | 礁岩/水母/敌/道具/主角 | `rockFace #4A78C0` / `rockBody #254060` / 描边 |
| 前景 | 1.2（克制） | 偶尔气泡掠过 | `天空 #5BC8F5` alpha，遮挡路径 ≤10% |

**与洞穴/藤林/风暴的基调反差**：洞穴暗冷蓝、藤林明绿、风暴紫蓝——海 = 冷蓝天光 + 冷蓝礁岩 + 草绿海藻，同套 8 槽接口下仅靠 hex 即拉开「幽暗→明绿→压抑→清凉海洋」的序列差。

---

## 6. 可访问性（与 cave/vine/storm 明显区分）

- **主题色相区分（不撞色）**：
  - cave = 冷蓝灰地面（`#4A78C0`）+ 暗背景 → "幽暗"。
  - vine_forest = 草绿地面（`#7CC242`）+ 亮天空 → "明绿生机"。
  - storm_sky = 蓝紫地面（`#6E7BF2`）+ 冷蓝天光 → "压抑风暴"。
  - **sea = 环境冷蓝地面（`#4A78C0`）+ 天空蓝水面（`#5BC8F5`）+ 草绿海藻** → "清凉海洋"（本关唯一「冷蓝 + 草绿生机」组合）。
  - 地面主色 + 海藻形态即首要区分信号，色盲玩家靠**地面 hue + 装饰形态**（珊瑚/气泡/海藻）即可分辨。
- **新元素双编码**：水母 = 半透明天空蓝伞 + 蓝紫触手（形态+透明度+颜色三重区分于 du_fu 实心蓝紫扁圆）；deep_water/riptide 靠半透水体 + 流线方向暗示。
- **敌种在蓝底关的反差**：du_fu 加 `暖黄 #FFD23F` 肚皮斑；shi_pao 靠描边+红炮口+方硬轮廓（同 storm_sky §4.3）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"；水母漂浮/气泡 ≤3Hz（防光敏）。
- **减少动态**：气泡/流线/水母触手摆动在"减少动态"开关下减半或停首帧（对齐 art-bible §9.3）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#5BC8F5` / `#4A78C0` / `#7CC242` / `#2A1A12` / `#F2933C` / `#FFD23F` / `#E8483B` / `#6E7BF2` = **8 色**（锁色板 #1/3/4/5/7/9/10/11）。
- **派生 tint（0 新增）**：礁岩暗面 `darken(#4A78C0,0.5)`、远景水幕 `darken(#4A78C0,0.4)`、海藻暗部 `darken(#7CC242,0.5)`，均由锁色板色运行时 darken 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心）、`经济金 #F2C94C`（coin）、`阴影绿 #5FA82F`（海藻暗部 tint 源）——均属锁色板 #2/6/8。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **越界 reconcile**：本 biome 严格守 11 色锁色板；提请主理人据 cave/vine/storm §7 既有 reconcile 结论更新 asset-spec §2 越界生产色。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`｜`'vine_forest'`｜`'storm_sky'`｜**`'sea'`（1-3，新增）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'sea'`（fail-safe 回退 `'grass'`）。

### 8.2 海调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段（`bg`/`rockFace`/`rockBody`/`out-line`/`firelight`/`crystalCore`/`crystalGlow`/`danger`），**仅 add 一个 `sea` entry**。下表为注册数据（非代码）：

| 引擎字段 | sea Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x5BC8F5` | 天空 #11 |
| `rockFace` | `0x4A78C0` | 环境冷蓝 #10 |
| `rockBody` | `0x254060` | darken(#4A78C0,0.5) tint，0 新增 |
| `out-line` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xF2933C` | 暖橙 #3 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4 |
| `crystalGlow` | `0x7CC242` | 草绿 #1 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（海取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['sea'].rockFace`(`#4A78C0`) / `.rockBody`(`#254060`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['sea'].bg)`(`#5BC8F5`) |
| 水母占位（`jellyfish-view.ts` 新增分支） | 伞盖=`bg`(`#5BC8F5`)+alpha；触手=`crystalGlow`? 否 → 用常量 `0x6E7BF2`（蓝紫 #9）；核心=`crystalCore`(`#FFD23F`)；描边=`out-line` |
| 敌种/装饰绘制 | 见 §4 锁色板映射；石炮石身=`环境冷蓝 #4A78C0` |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme` 增 `'sea'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['sea']` 的 8 字段。
- **海映射**：bg=`#5BC8F5`、rockFace=`#4A78C0`、rockBody=`#254060`(tint)、out-line=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#FFD23F`、crystalGlow=`#7CC242`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['sea']`；水母走新增 `jellyfish-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

## 9. 视觉落实交叉引用（→ sea-visual-spec.md）

> 本 biome-spec 专注"8 槽权威映射 + tint + jellyfish/障碍视觉意图"；**程序化绘制落地规格**见 `art/sea-visual-spec.md`（同项目、lean、0 新增 hex）。

- 背景层画法（天空渐变 / 海平线 / 远中近三层视差 / 动态浪花带 / 海底剪影）→ sea-visual-spec **§1**。
- jellyfish 绘制伪代码（伞盖半透 + 触手 + 核心 + 漂浮 pulse）→ sea-visual-spec **§2**（对齐本文件 §3）。
- 潮汐水位视觉（`waterSurfaceY` 参数联动背景 / 浪花 / 淹没叠层 / edge foam）→ sea-visual-spec **§3**（对齐本文件 §4.1/§4.2）。
- 障碍换皮矩阵（ci_li→珊瑚刺 / chong_feng→潮蟹 / du_fu→实心水母近亲 / shi_pao→蚌炮 + 专属陷阱视觉）→ sea-visual-spec **§4**（对齐本文件 §4）。
- 可访问性校验（Standard 档，含对比度临界缓解）→ sea-visual-spec **§5**（对齐本文件 §6）。
- theme-palette 8 槽注册 + fail-safe → sea-visual-spec **§6**（对齐本文件 §1/§8）。

> 实现须以本文件 §1/§8 的 8 槽权威 hex + tint 为准；sea-visual-spec 不引入新 hex。

---

*本文件为海 biome 美术规格（加法），roadmap 批次 2 优先（世界 1 第 3 关 1-3）；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约 + sea-visual-spec 绘制参数）。*
