# 环境主题化系统设计（Theme System）· 草案

> 文档类型：跨系统配置设计（GDD 加法，design-strategist 产出）
> 状态：**DRAFT（供主理人拍板）**｜评审强度：lean
> 依赖：05 Level / 02 Physics / 03 Character / 04 Enemy / 07 Damage；美术 biome 规格（`art/cave-biome-spec.md`、`vine-forest-biome-spec.md`、`storm-sky-biome-spec.md`）；ADR-004 资源预算
> 红线：ADR-004 零位图（纯 Graphics + 系统字体 + tween，不进 PNG）；11 色锁色板，派生色仅由运行时 tint；主题差异 = 调色板 + 程序化装饰层 + 机制配置，**不增图集**
> **本文件只写设计文档，不写/改任何 `.ts` 源码，不 git commit。**

---

## 0. 背景与问题（为什么需要主题系统）

用户反馈：第 1 关（1-1）与第 2 关（1-2）建筑/背景太像——两关 `metadata.theme` 均为 `"grass"`，且敌人组、障碍构成完全一致（同为 `ci_li / chong_feng / du_fu / shi_pao` + 金币/种子/栗子 + 单向平台）。

核查现状（`src/config/levels/`）：

| 关卡 | theme | 敌人组 | 备注 |
|---|---|---|---|
| 1-1 | `grass` | ci_li / chong_feng / du_fu / shi_pao | 教程关 |
| 1-2 | `grass` | ci_li / chong_feng / du_fu / shi_pao | 与 1-1 雷同 |
| 2-1 | `cave` | （cave palette 已 live） | 石窟，palette + gu_bao 已建 |
| 2-2 | `vine_forest` | （vine_forest palette 已 live） | 藤林，palette + bouncy_vine 已建 |
| 2-3 | `storm_sky` | （storm_sky palette 已 live） | 风暴天空，palette + cyclone 已建 |

**关键事实**：`theme-palette.ts` 已支持 `grass / cave / vine_forest / storm_sky` 四套调色板，且 `resolveBiome()` 对未知 theme **回退 `grass`**（fail-safe）。这意味着——

> **改主题 = 改配置（数据 + palette 注册），引擎不需重写。** 1-2 切到 `cave`/`storm_sky`/`vine_forest` 中任意一个，仅需把 `1-2.json` 的 `"theme":"grass"` 改为目标 key，并据新主题的障碍集微调 `entities[]`。这正是本系统要解决的核心。

本草案定义**主题驱动关卡系统**的语义、给出 8 主题（草原/山川/海/沙漠/雨天/家/街/办公）的障碍矩阵、给出 1-1/1-2 立竿见影的改法、并排定主题库落地路线图。

---

## 1. 目的与范围

- **目的**：让「主题」成为关卡的一等公民——`theme` 字段同时决定**背景调色板、装饰层、可用敌人/障碍集、地形机制**，且新增主题 = 新增一份配置（palette entry + 装饰集 + 机制 flag + 敌人白名单），**不改引擎架构**。
- **范围（Must）**：theme 字段语义、ThemeDef 配置 schema、障碍随场景矩阵（8 主题）、1-1/1-2 差异化、主题库路线图、与现有 GDD 衔接。
- **范围（Could）**：主题专属剧情暗示（Narrative 极弱，仅环境叙事）、主题间过渡动画、主题收集图鉴。

---

## 2. 设计原则与约束

### 2.1 美术/技术红线（来自 ADR-004 + 美术圣经 + biome 规格）

1. **零位图资产**：纯 `Graphics` + 系统字体 + tween；多主题靠**调色板 + 程序化背景层**，不增 PNG。
2. **11 色锁色板**：所有主题色取自 `{草绿,阴影绿,暖橙,暖黄,描边,命粉,警示红,经济金,蓝紫,环境冷蓝,天空}`，派生暗面由运行时 `darken/tint` 生成（**0 新增 hex**）。
3. **换色不换形**：1 份 base 瓦片集，主题经 `THEME_PALETTES[theme]` 8 槽映射生成；瓦片网格、功能色语义（solid/oneway/可踩）**不变**，仅换主色与装饰。
4. **装饰层非碰撞**：主题独有装饰（`deco_*`）纯氛围，碰撞仍由 `tiles[]` 决定。
5. **fail-safe**：未知 theme 回退 `grass`，保证旧关/回归稳定。

### 2.2 八槽调色板接口（既有的、直接复用）

来自 `theme-palette.ts` / biome 规格 §6/§8，新增主题只需向 `THEME_PALETTES` 注册一个 entry：

| 引擎字段 | 语义槽 | 角色 |
|---|---|---|
| `bg` | sky | 背景/天空填充 |
| `rockFace` | ground | 地面主面（ground_top / 实心瓦片） |
| `rockBody` | accent | 地面暗面（ground_fill / oneway） |
| `outline` | outline | 全局描边 |
| `firelight` | seed | 暖色点缀 |
| `crystalCore` | trim | 核心高光 |
| `crystalGlow` | foliage | 植披/辉光 |
| `danger` | hazard | 警示红（危险双编码） |

### 2.3 MDA 视角：主题如何服务「自主 / 胜任 / 关联」与心流

> 对齐概念文档 §3（SDT 三大需求）+ 支柱 P1 跳 / P2 闯 / P3 蜕变。

- **自主（Autonomy）**：不同主题提供**不同的移动动词**——草原奔跑、海涉水/随潮汐改路、雨天滑铲、家在家具间腾挪。玩家在每个主题里要重新规划"我的路线"，选择不同通过策略（踩怪线 / 避敌线 / 利用机制线），路线自主权被主题放大。
- **胜任（Competence）**：每个主题**只叠加 1–2 个新机制**（如海=潮汐，沙漠=流沙），循序渐进引入，符合概念文档「前 1/3 关教学化低负担」的梯度；新危险都有**双编码前摇**（形状+颜色）明确 telegraph，给即时正/负反馈，持续"我能行"。
- **关联（Relatedness）**：主题是「世界」的载体，制造旅程感与进度感（草原→山川→海…）；同一套 8 槽视觉语言保证跨主题**凝聚力**，避免割裂；室内主题（家/街/办公）带来可共鸣的日常幻想，弱关联（微信炫耀"我通关了家主题"）更易触发。
- **心流（Flow）**：主题作为**难度风味容器**——每切一关换主题 = 一次"新鲜感尖峰"重新抓住注意力，但每次只加 1 个新机制，**不造成认知过载**（概念文档红线）。1-1/1-2 同 theme 正是心流杀手（单调→注意力掉出心流通道），本系统首要修复它。

---

## 3. 主题驱动关卡系统（核心机制）

### 3.1 `theme` 字段语义

`theme` 是 `LevelData.metadata` 的一个字符串键，作为**索引**指向一份 `ThemeDef` 配置。它**不直接携带颜色**（颜色在 `THEME_PALETTES`），而是声明本关"属于哪个世界"，由主题系统解析出四件事：

1. **背景调色板** → `THEME_PALETTES[theme]` 的 8 槽 hex（渲染层消费）。
2. **装饰层** → 该主题允许的 `deco_*` 实体集（程序化背景/中景/前景）。
3. **可用敌人/障碍集** → 通用基底（4 种）+ 主题专属敌/障碍白名单。
4. **地形机制** → 该主题启用的机制 flag 列表（`tide`/`quicksand`/`low_friction`/`wind`…）。

### 3.2 ThemeDef 配置 Schema（草案）

```jsonc
{
  "key": "sea",                       // 规范 theme key（与 level metadata.theme 对应）
  "family": "natural",               // 'natural' | 'urban_indoor'
  "paletteRef": "sea",               // THEME_PALETTES 中的 entry 名（可复用已有，如 mountain→'cave'）
  "decorationSet": ["deco_wave","deco_coral","deco_bubble"],  // 非碰撞装饰
  "universalEnemies": ["ci_li","chong_feng","du_fu","shi_pao"], // 通用基底（恒含）
  "exclusiveEnemies": ["jellyfish"], // 主题专属敌（1–2 种）
  "terrainMechanics": ["tide","current"],  // 启用的机制 flag
  "exclusiveHazards": ["deep_water","riptide"], // 主题专属陷阱/机关
  "frictionScale": 1.0               // 地面摩擦倍率（1.0=默认；雨天/咖啡渍<1）
}
```

> **加主题 = 加配置**：新增主题只需 (a) 在 `THEME_PALETTES` 注册 palette entry（8 hex，全锁色板/tint，0 PNG）；(b) 在主题注册表加一条 `ThemeDef`（装饰集/敌人白名单/机制 flag）；(c) 在关卡 JSON 写 `"theme":"<key>"`。**引擎层已有 `resolveBiome()` 解析 palette；机制 flag 由既有的物理/角色/敌人模块按 flag 激活，无需重写系统。**

### 3.3 与现有代码的衔接（不改引擎，仅配置/小 hook）

| 维度 | 现状（已 live） | 主题系统如何接 |
|---|---|---|
| 调色板 | `theme-palette.ts` `THEME_PALETTES` + `resolveBiome()` | 新主题加 entry 即可；未知回退 `grass` 已保底 |
| 关卡数据 | `level-data.ts:163` `metadata:{name,theme:string}` | 保持 `string`（fail-safe）；**建议**后续演进为联合类型 `LevelTheme`（biome 规格已提），非阻断 |
| 装饰层 | 由渲染层按 theme 画（cave/storm 规格已定义 `deco_*`） | 主题注册表声明 `decorationSet`，渲染层照表取 |
| 敌人白名单 | 关卡 `entities[]` 当前直接列 type | 主题系统仅做**校验/推荐**（防止误放主题不兼容敌），不强制改写 |
| 地形机制 | 02/03 已有重力、friction、移动平台 | 机制 flag = 既有模块的**数据开关**（见 §3.4） |

### 3.4 机制 flag 的实现归属（数据驱动，尽量零引擎改动）

| 机制 flag | 含义 | 实现归属（既有模块） | 是否需引擎小改动 |
|---|---|---|---|
| `wind` | 阵风水平推力区 | 02 Physics 区域力场（类比 cyclone 力场） | 复用 15 cyclone 力场模块 |
| `tide` | 潮汐水位周期升降 | 02 Physics + 关卡水位线（淹没=pit 死亡判定，复用 07） | 水位线为关卡数据 + 区域判定，小增 |
| `current` | 水下水平水流推力 | 02 Physics 区域力场（类比 wind） | 复用区域力场 |
| `quicksand` | 流沙持续下陷 | 02/03 下陷速度 + 触底=死亡（复用 07） | 区域下陷，小增 |
| `low_friction` | 地面低摩擦滑行 | **03 Character `friction` 按 zone 降倍率**（现有 `FRICTION=1600`） | ⚠️ 需小 hook：角色控制器消费 zone 提供的 `frictionScale`（现有为全局 `cfg.friction`）——**唯一需程基岩确认的小加法** |
| `sandstorm` / `rain_visual` | 周期粒子遮挡 | 渲染层 deco 粒子（对齐 accessibility 减少动态） | 纯渲染，0 引擎 |

> **诚实标注**：`low_friction`（雨天/咖啡渍滑地）是 8 主题中**唯一需要角色控制器一处小加法**的机制（让 `friction` 可被 zone 覆盖）。其余均可在既有模块上以数据/flag 形式激活。此点列为 §8 待确认项，提交程基岩评估。

---

## 4. 障碍随场景矩阵（8 主题）

**规则**：4 种通用基底敌（`ci_li`/`chong_feng`/`du_fu`/`shi_pao`）跨主题恒可用；每个主题叠加 **1–2 个专属机制 + 0–2 专属敌 + 1–2 专属障碍**。「障碍随场景决定」即由本矩阵强制约束。

### 4.1 总表（主题 → 敌人组 → 地形机制 → 专属障碍）

| 主题(key) | 家族 | 调色板(ref) | 通用敌组(base4) | 专属敌(1–2) | 地形机制 | 专属障碍/陷阱 | 装饰层 | 落地状态 |
|---|---|---|---|---|---|---|---|---|
| **草原 grass** | natural | grass | 4 种 | — | `wind`（微风推力区） | 矮蔷薇刺丛 `bramble`（贴地 hazard，需跳） | deco_grass（摇摆草叶） | ✅ live (1-1) |
| **山川 mountain** | natural | **cave**（复用） | 4 种 | 落石怪 `rockfall`（或复用 gu_bao） | 落石区（定时坠石） | 落石 `rockfall`（顶部坠石 hazard，需 timing） | deco_pillar/岩柱、deco_stalactite（复用 cave） | ⚡ 立即可 reskin |
| **海 sea** | natural | 需 NEW（蓝绿系 tint，art-theme 将出 biome-spec） | 4 种 | 水母 `jellyfish`（漂浮·可踩·天空蓝半透伞+蓝紫触手） | `tide` 潮汐水位升降、`current` 水流推力 | 深水区 `deep_water`（淹没=pit 判定）、暗流 `riptide` | deco_wave/deco_coral/deco_bubble | 🗺️ 待 art-theme 产出 biome-spec（sea 最高优先级） |
| **沙漠 desert** | natural | 需 NEW（暖橙/沙金 tint） | 4 种 | 蝎子 `scorpion`（地面·不可踩·尾刺红） | `quicksand` 流沙下陷 | 流沙区 `quicksand`（持续下陷，触底=死）、仙人掌 `cactus`（刺丛·不可踩） | deco_dune/deco_pyramid | 🗺️ roadmap |
| **雨天 rain** | natural(天气) | **storm_sky**（复用，去 cyclone） | 4 种 | — | `low_friction` 地面低摩擦滑行 | 积水坑 `puddle`（局部低摩擦/易失控） | deco_rain（雨线粒子） | ⚡ 低成本的 storm reskin |
| **家 home** | urban_indoor | 需 NEW（暖色室内 tint） | 4 种 | 宠物 `pet`（地面巡逻·不可踩·友好碰撞→伤） | 家具即地形（沙发/桌/柜=solid/可踩平台） | 玩具/拖鞋 `toy`（小 hazard） | deco_rug/deco_frame | 🗺️ roadmap |
| **街 street** | urban_indoor | 需 NEW（冷灰城市 tint） | 4 种 | — | 移动车辆（水平移动 hazard） | 移动车辆 `vehicle`（周期横穿·不可踩）、井盖 `manhole`（周期喷蒸汽/塌陷陷阱） | deco_building/deco_lamp | 🗺️ roadmap |
| **办公 office** | urban_indoor | 需 NEW（冷调办公 tint） | 4 种 | — | `low_friction`（咖啡渍滑地，局部） | 咖啡渍 `coffee_spill`（局部低摩擦）、文件堆 `paper_pile`（可踩平台/障碍） | deco_desk/deco_plant | 🗺️ roadmap |

### 4.2 专属敌/障碍速查（形状·颜色·可踩，锁色板合规）

| 专属元素 | 形状语言 | 主色（锁色板） | 可踩 | 危险 |
|---|---|---|---|---|
| 水母 jellyfish | 半透明伞+触手（区别 du_fu 扁圆+翅） | 天空 `#5BC8F5` 半透伞 + 蓝紫 `#6E7BF2` 仅触手/辉光 | ✅ soft 顶 | 否 |
| 蝎子 scorpion | 长条+钳+上翘尾刺 | 暖橙 `#F2933C` 身 + 警示红 `#E8483B` 尾刺 | ❌ | 是 |
| 宠物 pet | 矮圆四足 + 耳（友好形） | 暖橙 `#F2933C` 主体 + 暖黄 `#FFD23F` 耳点缀（避命粉） | ❌ | 是（碰撞） |
| 车辆 vehicle | 大方块 + 前灯 | 环境冷蓝 `#4A78C0` 身 + 警示红 `#E8483B` 灯 | ❌ | 是 |
| 矮蔷薇 bramble | 贴地低刺丛 | 阴影绿 `#5FA82F` + 警示红 `#E8483B` 刺 | ❌ | 是 |
| 仙人掌 cactus | 柱+侧刺 | 草绿 `#7CC242` + 警示红 `#E8483B` 刺 | ❌ | 是 |
| 玩具 toy | 小方块/球 | 经济金 `#F2C94C` | ❌ | 是 |
| 井盖 manhole | 地面圆盖 + 蒸汽 | 描边 `#2A1A12` + 暖橙 `#F2933C` 蒸汽 | 可变 | 周期 |

> 所有新元素颜色均落在 11 色锁色板内或由 tint 派生；可踩/不可踩沿用「soft 顶=圆润 / hard 顶=尖角+红」双编码，色盲安全（对齐 art-bible §9 / accessibility.md）。
>
> **配色修正（art-theme review，已采纳）**：① jellyfish 主体由蓝紫 `#6E7BF2` 改为**天空 `#5BC8F5` 半透伞**、蓝紫仅作触手/辉光——避免与同场景通用敌 du_fu（蓝紫·可踩）同色同可踩，剪影+颜色双重区分；② pet 由命粉 `#F26D8B` 改为**暖橙 `#F2933C`**——命粉为生命/爱心专属色（art-bible §3.2/§9.1 生命色解耦），pet 为「友好但碰撞致伤」hazard，用命粉会制造语义冲突。两处专属敌其余色（scorpion/vehicle/bramble/cactus）经 art-theme 校验已在锁色板内、剪影唯一。

### 4.3 用户口语主题 ↔ 规范 theme key 映射（一致性 reconcile）

用户提出的 8 个口语主题，需与**已建 biome**对齐，避免重复造调色板（省 ADR-004 预算）：

| 口语主题 | 规范 key | 调色板来源 | 落地状态 | 说明 |
|---|---|---|---|---|
| 草原 | `grass` | 现有 grass | ✅ live | 教程基准 |
| 山川 | `mountain` | **复用 `cave` palette**（冷蓝岩壁） | ⚡ 立即可（art-theme 已确认一致 ✅） | 室外山道版 cave；deco 用岩柱/落石替代钟乳/晶体 |
| 海 | `sea` | 需 NEW palette（蓝绿 tint，art-theme 将出 biome-spec） | 🗺️ 待 art-theme 产出 biome-spec（sea 最高优先级） | art-theme 确认将按 11 色+tint 产出 sea biome-spec（对齐 1-3 建议） |
| 沙漠 | `desert` | 需 NEW palette（暖橙/沙金 tint） | 🗺️ 待 art-theme 产出 biome-spec | art-theme 确认将按 11 色+tint 产出 desert biome-spec |
| 雨天 | `rain` | **复用 `storm_sky` palette**，去 cyclone | ⚡ 低成本（art-theme 已确认一致 ✅） | 加雨线粒子 + `low_friction` |
| 家 | `home` | 需 NEW palette（暖色室内） | 🗺️ 待 art-theme 产出 biome-spec | 室内 family；art-theme 将按 11 色+tint 产出 home biome-spec |
| 街 | `street` | 需 NEW palette（冷灰城市） | 🗺️ 待 art-theme 产出 biome-spec | 城市 family；art-theme 将按 11 色+tint 产出 street biome-spec |
| 办公 | `office` | 需 NEW palette（冷调办公） | 🗺️ 待 art-theme 产出 biome-spec | 室内 family；art-theme 将按 11 色+tint 产出 office biome-spec |

> **已建但未在用户清单中的 bonus 主题**：`vine_forest`（2-2 live）。它也可作为世界 1 的候选差异主题——即 1-2 切到 `vine_forest` 同样是零新资产的立竿见影改法。

---

## 5. 1-1 / 1-2 差异化建议（立竿见影）

### 5.1 现状问题
1-1 与 1-2 同为 `grass` + 同敌组 + 同障碍构成 → 视觉与玩法双重雷同，玩家注意力掉出心流通道（§2.3）。

### 5.2 推荐改法
- **保留 1-1 = `grass` 教程关**：草原是核心动词（跑/跳/踩/扔栗子）的最干净教学场，不宜动。
- **1-2 切到差异最大的主题 → 推荐 `mountain`（复用 `cave` palette）**：
  - **理由（快 + 稳 + 反差强）**：`cave` palette + deco（岩柱/钟乳/晶体）**已 live**（2-1 已用），切换仅需改 `1-2.json` 的 `"theme":"grass"` → `"mountain"`，引擎 `resolveBiome()` 自动换冷蓝岩壁调色板；**零新资产、零引擎改动、秒级生效**。绿→冷蓝的色相对比最强，立刻解决"建筑背景太像"。
  - **备选（同样零新资产）**：`storm_sky`（蓝紫压抑天空）或 `vine_forest`（明绿藤林）——三者 palette 都已建，任选其一即可去雷同。
- **切换后障碍集变化（以 1-2 → mountain/cave 为例）**：
  - 通用基底 4 敌保留（教学延续性）。
  - **新增专属**：落石区 `rockfall`（顶部定时坠石，需 timing 穿过）+ 可复用 `gu_bao`（cave 专属升降刺苞，作为中段挑战峰）。
  - **装饰**：岩柱/钟乳/晶体替代草原草叶。
  - 难度曲线：保持 1-2 作为"教学后第一挑战关"，落石+gu_bao 构成 1 个新挑战峰，符合概念文档波浪难度。

### 5.3 大胆备选（若主理人想要最大机制新奇）
- **1-2 → `sea`（海）**：引入潮汐水位升降 + 水母漂浮敌 + 水下低重力，**机制新奇度最高**，但需 NEW sea palette（art 出 biome-spec）+ 2 个机制模块（tide/current）+ jellyfish 敌 AI → 属 roadmap 项，**不宜作为 immediate 修复**，建议放到世界 1 第 3 关（1-3）。

> **结论**：立即修雷同 = 1-2 改 `mountain`（cave reskin，零成本）；最大新奇 = `sea` 留作 1-3 路线图。

---

## 6. 主题库路线图（优先级与落地顺序）

目标：先落地 **3–4 个**解决世界 1 雷同与多样性，其余进路线图。

### 批次 1 · 雷同急救 + 世界 1 基底（≈0 新资产，立即可）
| 主题 | 落地动作 | 成本 |
|---|---|---|
| `grass` | 已 live（1-1 教程） | 0 |
| `mountain`（cave reskin） | 1-2 改 theme key + 加落石/gu_bao 障碍 | 极低（palette/deco 已建，仅障碍调参） |
| `vine_forest`（已建，作世界1备选差异） | 可选置于 1-x | 0 |

### 批次 2 · 高对比新机制（需 1–2 新 biome-spec + 机制模块）
| 主题 | 落地动作 | 成本 |
|---|---|---|
| `sea`（海） | 新 palette（蓝绿 tint）+ tide/current 机制 + jellyfish 敌 | 中（新 biome-spec + 2 机制 + 1 敌） |
| `rain`（storm reskin） | 复用 storm_sky palette，去 cyclone，加雨线粒子 + `low_friction`（需 §3.4 小 hook） | 低–中 |

### 批次 3 · 路线图（urban/indoor family，需全新 art + 多机制）
| 主题 | 落地动作 | 成本 |
|---|---|---|
| `desert` 沙漠 | 新 palette + quicksand/sandstorm + scorpion/cactus | 高 |
| `home` 家 | 新 palette + 家具地形化 + pet 敌 | 高 |
| `street` 街 | 新 palette + vehicle/manhole 动态 hazard | 高 |
| `office` 办公 | 新 palette + paper_pile/coffee_spill + low_friction | 高 |

**推荐世界 1 终局（4 主题解决多样性）**：`grass`(1-1) → `mountain`(1-2) → `sea`(1-3) → `rain`(1-4)。其余 4 个进世界 2+ 路线图。

---

## 7. 与现有 GDD 衔接

### 7.1 本文件（theme-system.md）章节结构
- §0 背景与问题（雷同核查）
- §1 目的与范围
- §2 设计原则与约束（ADR-004 / 八槽接口 / MDA·SDT·心流）
- §3 主题驱动关卡系统（theme 字段语义 / ThemeDef schema / 加主题=加配置 / 机制 flag 实现归属）
- §4 障碍随场景矩阵（8 主题总表 + 专属元素速查 + 口语↔规范映射）
- §5 1-1/1-2 差异化建议
- §6 主题库路线图
- §7 与现有 GDD 衔接（本节）
- §8 风险与待主理人确认

### 7.2 在 `00-index.md` 登记
已在 `design/gdd/00-index.md` 的 §2.1 系统列表与 §3 路径表追加：
- 系统列表新增：`| 18 | 环境主题化 Theme System | theme-system.md | Must（配置深）/ 跨 05·02·03·04·07 |`
- 路径表新增：`| 18 环境主题化 | design/gdd/theme-system.md |`
- 依赖图补充：`theme-system → 05 Level（theme 字段）/ 02·03（机制 flag）/ 04·07（专属敌·死亡判定）/ art biome-spec（palette）`

> 主题系统**不是独立运行系统**，而是「关卡数据的语义层 + 配置注册表」，因此作为跨系统 GDD（编号 18）登记，不破坏既有 01–17 编号。

---

## 8. 风险与待主理人确认

| # | 风险 / 开放问题 | 建议 / 处置 |
|---|---|---|
| R1 | `low_friction`（雨天/咖啡渍）需角色控制器消费 zone 级 `frictionScale`，现有为全局 `cfg.friction` | 提交程基岩评估：最小加法（zone 查询返回 friction 倍率）；或妥协为"全局主题级 frictionScale"（整关统一，更简单但雨天关全关变滑） |
| R2 | `sea`/`desert`/`home`/`street`/`office` 需 NEW palette，依赖 art 出 biome-spec | **art-theme 已确认将按 11 色+tint 同构产出 5 份 biome-spec（sea 最高优先级）**，待其落盘即解锁批次 3 |
| R3 | 用户口语「山川」与已建 `cave` 语义重叠 | 本草案将 山川 映射为 cave palette 的「室外山道」表达（同 8 槽、换 deco）；若主理人想要真正的户外山岳 palette，则升为 NEW palette（批次 3） |
| R4 | 用户口语「雨天」与已建 `storm_sky` 语义重叠 | 本草案将 雨天 作为 storm_sky 的「去 cyclone + 加雨」reskin；若主理人想要非风暴的晴雨切换，则升为 NEW palette |
| R5 | 主题专属敌（jellyfish/scorpion/pet/vehicle）是新 sprite 资产 | MVP 走 Graphics 占位（对齐 ADR-004 + biome 规格模式），不进 PNG；像素化留 Phase 4。**配色已按 art-theme review 修正**（jellyfish 改天空蓝半透、pet 改暖橙避命粉，见 §4.2） |
| R6 | `LevelTheme` 当前是 `string`，类型安全弱 | biome 规格已建议演进为联合类型；非阻断，保持 fail-safe 回退 `grass` |
| R7 | 包体（ADR-004）：新 palette 为 8 hex 数据，0 PNG，安全；新敌 sprite 走 Graphics 占位，安全 | 持续守 11 色锁色板 + tint，不破预算 |
| R8 | art-theme 早期 `art/theme-framework.md` 含 ~50 个锁色板外 hex（实测 70 个 distinct hex token，如 `#1A202C`/`#2D3748`/`#4A5568`/`#3FC7B4`/`#3A8FB7` 等），与 ADR-004「11 色锁色板 + tint（0 新增）」纪律冲突 | 该文件降级为「概念索引」，权威色板以各 `*-biome-spec.md`（11 色 + tint，0 新增）为准；其自由 hex 仅作早期草图，**不进实现**。本 theme-system.md 仅用锁色板色 |
| R9 | sea/desert/home/street/office 的 5 份 biome-spec，art-theme 已确认将产出，但截至本稿撰写**尚未落盘**（`art/` 仅见 cave/vine/storm 三份已 live） | 待 art-theme 实际产出后，本矩阵对应 paletteRef 与专属元素以 biome-spec 为权威；建议主理人跟进 art-theme 交付，再解锁批次 3 |

### 待主理人拍板
1. **1-2 切哪个主题？** 推荐 `mountain`（cave reskin，零成本）；或 `storm_sky`/`vine_forest`（同样零成本）；或 `sea`（最大新奇，roadmap）。
2. **「山川」「雨天」是否复用 cave/storm_sky palette（省资产）还是独立新 palette？** 本草案默认复用。
3. **`low_friction` 的小引擎 hook 是否接受？**（R1）
4. **世界 1 是否定为 4 主题（grass/mountain/sea/rain）？** 其余进路线图。

---

*本文件为环境主题化系统设计草案（加法），未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 design-strategist 与 engineering-lead / art-director 分别落地。*
