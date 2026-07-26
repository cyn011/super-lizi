# 家 biome 美术规格（home-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；roadmap 批次 3，urban_indoor family）
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/theme-system.md` §4.1（home 行）｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：roadmap 批次 3（高）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `home`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**家（室内）主题视觉**与**新敌宠物 `pet` 视觉**与**专属障碍（玩具/拖鞋）视觉**；玩法/数值/物理（家具地形化）由对应 GDD 与工程负责。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 盆栽绿 / 植披 |
| 2 | 阴影绿 | `#5FA82F` | 盆栽暗部（可选 tint 源） |
| 3 | 暖橙 | `#F2933C` | **木家具/地板主面 / 宠物身（推荐）/ 台灯暖意** |
| 4 | 暖黄 | `#FFD23F` | 台灯暖光 / 宠物耳点缀 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，**本关不用于敌/障碍**） |
| 7 | 警示红 | `#E8483B` | 危险语义（玩具尖角等） |
| 8 | 经济金 | `#F2C94C` | coin（沿用）/ 相框金边 |
| 9 | 蓝紫 | `#6E7BF2` | 屏幕辉光（少用） |
| 10 | 环境冷蓝 | `#4A78C0` | 冷调投影 tint 源 |
| 11 | 天空 | `#5BC8F5` | 窗外微光（少用） |

> 本 biome 暖调主导（暖橙木/暖黄灯 + 草绿盆栽），全部引用色取自锁色板，**派生暗面由 `#F2933C`/`#4A78C0` 运行时 tint**（0 新增）。
> **⚠️ 命粉 `#F26D8B` 为生命/爱心专属色（art-bible §3.2/§9.1 已做生命色解耦），本关宠物 `pet` 与装饰均**不采用命粉**，避免「粉=生命 vs 危险」语义冲突（详见 §3.1 复核说明）。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 墙面·天花板填充（"天空→墙壁"隐喻） |
| ground | `rockFace` | 地面主面（木地板 / 家具顶面） |
| accent | `rockBody` | 地面暗面（家具暗部 / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 植披 / 辉光（盆栽绿） |
| trim | `crystalCore` | 核心高光（台灯暖晕 / 相框） |
| outline | `out-line` | 全局描边 |
| seed | `firelight` | 暖色点缀（台灯暖意） |

### 1.2 家 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `darken(#F2933C, 0.55)` ≈ `#6B4220` | tint 派生（暖棕墙） | 0 新增 |
| ground | `rockFace` | `#F2933C` | 暖橙 | #3 |
| accent | `rockBody` | `darken(#F2933C, 0.5)` ≈ `#79491E` | tint 派生（家具暗部） | 0 新增 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#7CC242` | 草绿（盆栽） | #1 |
| trim | `crystalCore` | `#FFD23F` | 暖黄（台灯晕） | #4 |
| outline | `out-line` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#FFD23F` | 暖黄（台灯暖意） | #4 |

> 8 个权威 hex（含 2 个 tint 派生）全部落在锁色板内或由其 tint 派生，**无任何新 hex**（tint 不计入新增，见 §7）。
> 注：`crystalCore` 与 `firelight` 同取 `#FFD23F`（台灯暖晕语义一致，属有意复用，非新增）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 墙面 bg | `darken(#F2933C, 0.55)` ≈ `#6B4220` | 室内墙/天花板（暖棕） | 0 新增（tint） |
| 家具暗部 rockBody | `darken(#F2933C, 0.5)` ≈ `#79491E` | 沙发/桌/柜暗面 | 0 新增（tint） |
| 盆栽暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 盆栽阴影 | 0 新增（tint） |
| 冷调投影 | `darken(#4A78C0, 0.4)` ≈ `#2C486F` | 家具落影（非黑，暖中藏冷） | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；家经 theme palette 映射（§1.2）生成，**不另绘家瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原/洞穴一致；仅主色由草绿（base）→ 暖橙 `#F2933C`、身色由暖橙（base）→ 暗暖棕 tint `#79491E`。
- **家具即地形**：沙发/桌/柜经 base 瓦片 tint 映射为"可踩平台/实心 solid"，碰撞仍由 `tiles[]` 决定；装饰性家具（非碰撞）见下。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_rug` 地毯：地面矩形暖橙 `#F2933C` + 暗面 tint + 描边，纯氛围。
  - `deco_frame` 相框：墙上小矩形（`经济金 #F2C94C` 边 + `草绿 #7CC242` 内块），点缀"家"叙事。
  - `deco_plant` 盆栽：草绿 `#7CC242` 团 + 暗部 tint + 描边（与 `crystalGlow` 同源）。
  - MVP：用 `Graphics` 画简单多边形/矩形占位，程序化 tint，无需 PNG。
- **IP**：沙发/相框/盆栽为原创家居形态，非管道/龟壳符号。

---

## 3. 宠物 `pet` 视觉规格（新敌种 · 暖调 · 不可踩 · 碰撞致伤）

> 对齐 theme-system §4.2（home 专属敌）。形状语言优先：pet = **矮圆四足 + 耳（友好形但 collision 致伤）**，与 4 旧敌 + gu_bao/bouncy_vine/cyclone/jellyfish 全异。
> **⚠️ 复核修正（已在 design-theme 复核中提示）**：theme-system §4.2 原给 pet = `命粉 #F26D8B`/`暖橙 #F2933C`。命粉是生命/爱心专属色（art-bible §3.2/§9.1 生命色解耦），pet 是"友好但碰撞致伤"的 hazard，用命粉会重新制造"粉=生命 vs 危险"语义冲突。**本 spec 将 pet 主体改为 `暖橙 #F2933C`（家主题暖调），`暖黄 #FFD23F` 耳点缀，彻底避开命粉。**

### 3.1 视觉明细

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `暖橙 #F2933C` | 锁色板 #3（避用命粉） |
| 耳/点缀 | `暖黄 #FFD23F` | 锁色板 #4 |
| 暗部 | `darken(#F2933C, 0.5)` ≈ `#79491E` tint | 0 新增 |
| 眼（小） | `天空 #5BC8F5` 点 | 锁色板 #11 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 几何：矮圆身（宽 36、高 28）+ 四短足 + 两小耳；soft 外观（圆润）→ **但 collision = 致伤（不可踩，需闪避）**。
- 危险双编码：虽外形友好（暖橙圆润），靠**移动轨迹 + 碰撞判定** telegraph；可加 `警示红 #E8483B` 小项圈/铃铛作为"非安全"微弱提示（形状+颜色双编码，色盲安全）。

### 3.2 绘制约定（MVP Graphics）

- **主体**：圆角矩形/椭圆（宽 36、高 28），`暖橙 #F2933C` 填充 + `描边 #2A1A12` 1px；耳为两小圆角三角（暖黄 `#FFD23F` 内）。
- **暗部**：`darken(#F2933C,0.5)` 底部阴影。
- **危险提示**：颈部小铃（警示红 `#E8483B` 圆点）或地面投影 `darken(#4A78C0,0.4)` —— 明确"碰我受伤"。
- **动画**：patrol 4f（矮胖摇摇摆），idle 耳微动；≤12fps 节奏，防光敏 <3Hz。

### 3.3 与 4 旧敌 / 其他新元素轮廓对比（确保全异 · 色盲安全）

| 元素 | 轮廓 | 主色 | pet 区分点 |
|---|---|---|---|
| `ci_li` 刺栗 | 圆球 + 周身短刺 | 警示红 | pet = 暖橙圆润四足（无刺） |
| `chong_feng` 锥冲 | 长条楔形 | 警示红 | pet = 矮圆（非楔形） |
| `du_fu` 嘟浮 | 扁圆 + 双翅 | 蓝紫 | pet = 地面四足（非飞行扁圆） |
| `shi_pao` 石炮 | 方正石块 + 炮口 | 环境冷蓝 | pet = 有机圆润（非方块炮台） |
| `gu_bao` 鼓苞 | 垂直刺苞柱 | 暖橙 | pet = 矮圆四足（非垂直苞） |
| `jellyfish` 水母 | 半透伞+触手 | 天空蓝 | pet = 实心暖橙（非半透） |
| `scorpion` 蝎子 | 长条+钳+尾刺 | 暖橙 | pet = 圆润无钳尾（同为暖橙，靠圆 vs 长条区分） |

> 结论：pet 以 **「暖橙矮圆四足 + 暖黄耳」** 剪影唯一，与所有敌/元素全异；避用命粉，与生命色解耦一致，色盲安全。

### 3.4 后续像素化路径（AI 生成提示词预留）

- **pet**：`pixel art, 32px grid, short round four-legged pet, warm orange #F2933C body, dark outline #2A1A12, warm yellow #FFD23F ears, small red #E8483B bell collar, no face, friendly but hazardous, flat toon`
- **home tile**：`pixel art tile, 32x32, warm orange #F2933C wood floor, darker tinted body, 1px dark outline #2A1A12, cozy indoor`
- **deco_plant**：`pixel art, small potted plant, grass green #7CC242, dark outline, cozy home decor`

---

## 4. 专属障碍视觉规格（着色指引 · 限锁色板内）

> 通用规则（asset-spec §2.5）：可踩顶 = 软｜不可踩顶 = 硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。

### 4.1 `toy` 玩具/拖鞋（小 hazard · 不可踩）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `经济金 #F2C94C` | 锁色板 #8（玩具亮色） |
| 尖角/危险边 | `警示红 #E8483B` 描边 | 锁色板 #7（硬顶+红=不可踩） |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 几何：小方块/小球（宽 20、高 16），`经济金` 主体 + 警示红尖角 = 不可踩双编码。

### 4.2 家具地形化（solid/oneway 复用）

- 沙发/桌/柜经 base 瓦片 tint（`rockFace #F2933C` / `rockBody #79491E`）映射为可踩平台/实心；碰撞由 `tiles[]` 决定，纯外观换皮（对齐 art-bible §5.3 "换色不换形"）。

### 4.3 四通用敌可踩/不可踩（与 cave/vine/storm/sea 一致）

海关同屏含通用基底 4 敌（ci_li/du_fu 可踩，chong_feng/shi_pao 不可踩），着色沿用各自 biome 的锁色板映射；家暖橙底下令蓝紫 du_fu 加 `暖黄 #FFD23F` 肚皮斑维持辨识（同 storm_sky §4.1）。

---

## 5. 背景视差层级 + 光照 / 氛围（温暖家居）

**氛围意图**：温暖家居——暖橙木地板、暖黄台灯、草绿盆栽，靠**暖橙主色 + 暖黄微光 + 草绿生机**制造"安心日常"对比（对比洞穴幽暗/风暴压抑）。

**光照**：室内暖光（台灯/窗光），整体高饱和暖调（art-bible §3.3：主体明度 ≥60%、饱和 55–80%）；投影用 `darken(#4A78C0,0.4)` 冷调（非纯黑，暖中藏冷）；任意前景与背景亮度对比 ≥3:1（关键交互 ≥4.5:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 墙/天花板 | — | 纯色填充（"天空→墙壁"隐喻） | `bg = darken(#F2933C,0.55)` ≈ `#6B4220`（暖棕墙） |
| 远景 | 0.3 | 家具剪影（沙发背/书架） | `darken(#F2933C,0.5)` 剪影，无描边、低饱和 |
| 中景 | 0.6 | 相框/盆栽/台灯 | `暖橙 #F2933C` + `草绿 #7CC242` + `暖黄 #FFD23F` |
| 游戏层 | 1.0 | 木地板/家具地形/敌/道具/主角 | `rockFace #F2933C` / `rockBody #79491E` / 描边 |
| 前景 | 1.2（克制） | 偶尔地毯边掠过 | `暖橙 #F2933C` alpha，遮挡路径 ≤10% |

**与洞穴/藤林/风暴/海的基调反差**：洞穴暗冷蓝、藤林明绿、风暴紫蓝、海清凉蓝——家 = 暖棕墙 + 暖橙木地板，同套 8 槽接口下仅靠 hex 即拉开"幽暗→明绿→压抑→清凉→温暖家居"的序列差。

---

## 6. 可访问性（与 cave/vine/storm/sea/desert 明显区分）

- **主题色相区分（不撞色）**：
  - cave = 冷蓝灰地面 + 暗背景 → "幽暗"。
  - vine_forest = 草绿地面 + 亮天空 → "明绿生机"。
  - storm_sky = 蓝紫地面 + 冷蓝天光 → "压抑风暴"。
  - sea = 环境冷蓝地面 + 天空蓝水面 → "清凉海洋"。
  - desert = 暖橙沙岩 + 暖沙晴空 → "炽热沙漠"。
  - **home = 暖橙木地板 + 暖棕墙（`darken(#F2933C,0.55)`）** → "温暖家居"（本关唯一纯暖调室内，墙面=暗暖棕）。
  - 地面主色 + 墙面色即首要区分信号，色盲玩家靠**地面 hue + 家具形态**（沙发/相框/盆栽）即可分辨。
- **新元素双编码**：pet=暖橙圆润四足（避用命粉，与生命色解耦）；toy=经济金+红尖角（硬顶不可踩）。
- **敌种在暖底关的反差**：du_fu 加 `暖黄 #FFD23F` 肚皮斑；shi_pao 靠描边+红炮口+方硬轮廓（同 storm_sky §4.3）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"；台灯脉冲 ≤3Hz（防光敏）。
- **减少动态**：盆栽摇曳/台灯脉冲在"减少动态"开关下减半或停首帧（对齐 art-bible §9.3）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#F2933C` / `#7CC242` / `#FFD23F` / `#2A1A12` / `#E8483B` / `#F2C94C` / `#5BC8F5` / `#4A78C0` = **8 色**（锁色板 #1/3/4/5/7/8/10/11）。
- **派生 tint（0 新增）**：墙面 `darken(#F2933C,0.55)`、家具暗部 `darken(#F2933C,0.5)`、盆栽暗部 `darken(#7CC242,0.5)`、冷调投影 `darken(#4A78C0,0.4)`，均由锁色板色运行时 darken 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心，本关不用于敌）、`阴影绿 #5FA82F`（盆栽暗部 tint 源）、`蓝紫 #6E7BF2`（屏幕辉光少用）——均属锁色板 #2/6/9。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **命粉规避声明**：本 biome 严格避用 `命粉 #F26D8B` 于任何敌/障碍（含 pet），与 art-bible §3.2/§9.1 生命色解耦一致；提请主理人据此 reconcile theme-system §4.2 的 pet 配色（由命粉改为暖橙）。
- **越界 reconcile**：将 asset-spec §2 中越界生产色映射到锁色板色 / tint（同 cave/vine/storm §7），提请主理人更新 asset-spec §2。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`｜`'vine_forest'`｜`'storm_sky'`｜`'sea'`｜`'desert'`｜**`'home'`（新增，roadmap 批次 3）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'home'`（fail-safe 回退 `'grass'`）。

### 8.2 家调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段，仅 add 一个 `home` entry。下表为注册数据（非代码）：

| 引擎字段 | home Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x6B4220` | darken(#F2933C,0.55) tint，0 新增 |
| `rockFace` | `0xF2933C` | 暖橙 #3 |
| `rockBody` | `0x79491E` | darken(#F2933C,0.5) tint，0 新增 |
| `out-line` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xFFD23F` | 暖黄 #4 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4（同 firelight，有意复用） |
| `crystalGlow` | `0x7CC242` | 草绿 #1 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（家取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['home'].rockFace`(`#F2933C`) / `.rockBody`(`#79491E`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['home'].bg)`(`#6B4220`) |
| 宠物占位（`pet-view.ts` 新增分支） | 主体=`firelight`(`#F2933C`)、耳=`crystalCore`(`#FFD23F`)、描边=`out-line`；**禁用品红 `#F26D8B`** |
| 敌种/装饰绘制 | 见 §4 锁色板映射；du_fu 肚皮斑=`crystalCore`(`#FFD23F`) |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme` 增 `'home'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['home']` 的 8 字段。
- **家映射**：bg=`#6B4220`(tint)、rockFace=`#F2933C`、rockBody=`#79491E`(tint)、out-line=`#2A1A12`、firelight=`#FFD23F`、crystalCore=`#FFD23F`、crystalGlow=`#7CC242`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **pet 禁用品红**：宠物主体=`暖橙 #F2933C`，避用 `命粉 #F26D8B`（生命色解耦）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['home']`；宠物走新增 `pet-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为家 biome 美术规格（加法），roadmap 批次 3；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
