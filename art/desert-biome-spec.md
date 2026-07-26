# 沙漠 biome 美术规格（desert-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；roadmap 批次 3，urban/indoor family 前哨）
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/theme-system.md` §4.1（desert 行）｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：roadmap 批次 3（高）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `desert`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**沙漠主题视觉**与**新敌蝎子 `scorpion` / 仙人掌 `cactus` 视觉**与**专属障碍（流沙 / 仙人掌）视觉**；玩法/数值/物理（quicksand）由对应 GDD 与工程负责。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 仙人掌绿 / 绿洲植披 |
| 2 | 阴影绿 | `#5FA82F` | 仙人掌暗部（可选 tint 源） |
| 3 | 暖橙 | `#F2933C` | **沙岩主面 / 蝎子身 / 阳光** |
| 4 | 暖黄 | `#FFD23F` | 阳光核心 / 沙金辉光 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，本关不用于敌） |
| 7 | 警示红 | `#E8483B` | 危险语义（蝎尾刺 / 仙人掌刺 / ci_li 等） |
| 8 | 经济金 | `#F2C94C` | coin（沿用）/ 沙金辉光 |
| 9 | 蓝紫 | `#6E7BF2` | 天空辉光（冷中藏暖反差，少用） |
| 10 | 环境冷蓝 | `#4A78C0` | 阴影 tint 源（冷调投影） |
| 11 | 天空 | `#5BC8F5` | 晴空白（少用，暖沙天空以 tint 代） |

> 本 biome 暖调主导（暖橙/暖黄/草绿 + 警示红），全部引用色取自锁色板，**派生暗面/沙金由 `#F2933C`/`#FFD23F` 运行时 tint**（0 新增）。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 沙天空填充 |
| ground | `rockFace` | 地面主面（沙岩 / 实心瓦片） |
| accent | `rockBody` | 地面暗面（沙岩底 / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 植披 / 辉光（沙金/绿洲反差） |
| trim | `crystalCore` | 核心高光（仙人掌绿 / 阳光核心） |
| outline | `out-line` | 全局描边 |
| seed | `firelight` | 暖色点缀（阳光 / 暖意） |

### 1.2 沙漠 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `lighten(#F2933C, 0.4)` ≈ `#F7BE8A` | tint 派生（暖沙晴空） | 0 新增 |
| ground | `rockFace` | `#F2933C` | 暖橙 | #3 |
| accent | `rockBody` | `darken(#F2933C, 0.5)` ≈ `#79491E` | tint 派生（沙暗面） | 0 新增 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#F2C94C` | 经济金（沙金辉光） | #8 |
| trim | `crystalCore` | `#7CC242` | 草绿（仙人掌绿） | #1 |
| outline | `out-line` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#FFD23F` | 暖黄（阳光） | #4 |

> 8 个权威 hex（含 2 个 tint 派生）全部落在锁色板内或由其 tint 派生，**无任何新 hex**（tint 不计入新增，见 §7）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 沙晴空 bg | `lighten(#F2933C, 0.4)` ≈ `#F7BE8A` | 天空填充（暖调，非冷蓝） | 0 新增（tint） |
| 沙岩暗面 rockBody | `darken(#F2933C, 0.5)` ≈ `#79491E` | 沙岩底/oneway | 0 新增（tint） |
| 仙人掌暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 仙人掌阴影 | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；沙漠经 theme palette 映射（§1.2）生成，**不另绘沙漠瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原/洞穴一致；仅主色由草绿（base）→ 暖橙 `#F2933C`、身色由暖橙（base）→ 沙暗面 tint `#79491E`。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_dune` 沙丘：平滑曲线沙丘（暖橙 `#F2933C` + 暗面 tint + 描边），中景。
  - `deco_pyramid` 金字塔/遗迹：钝角三角（暖橙面 + 暗面 tint + 描边），中景地标。
  - `deco_sun` 太阳：圆 + 光芒短线（暖黄 `#FFD23F`，alpha ≤0.5，可脉冲 ≤2Hz），天空点缀。
  - MVP：用 `Graphics` 画简单多边形/圆占位，程序化 tint，无需 PNG。
- **IP**：沙丘/金字塔为原创地貌形态，非任何符号。

---

## 3. 新敌/障碍视觉规格（锁色板内 · 双编码）

### 3.1 `scorpion` 蝎子（地面 / 不可踩 / 长条+钳+上翘尾刺 / 暖橙+警示红）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `暖橙 #F2933C` | 锁色板 #3 |
| 尾刺（致命） | `警示红 #E8483B` | 锁色板 #7（不可踩双编码：尖刺+红） |
| 钳/腿 | `darken(#F2933C, 0.5)` ≈ `#79491E` tint | 0 新增 |
| 眼（小） | `天空 #5BC8F5` 点 | 锁色板 #11 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 几何：长条身（宽 40、高 24）+ 双钳（前）+ 上翘尾刺（后，红刺朝外）；soft 顶? 否——**hard 顶（尾刺硬角+红）= 不可踩**（对齐 soft/hard 体系）。
- 剪影唯一性：与 4 旧敌（圆/楔/扁/方）+ gu_bao（垂直苞）/bouncy_vine（线圈）/cyclone（气柱）/jellyfish（半透伞）全异；暖橙身+红尾刺区别于 ci_li（圆球红）/chong_feng（楔形红）。
- 尺寸/动画沿用 asset-spec §2 通用基底节奏；idle 钳微张、charge 尾刺上扬 telegraph。

### 3.2 `cactus` 仙人掌（固定 / 不可踩 / 柱+侧刺 / 草绿+警示红）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `草绿 #7CC242` | 锁色板 #1 |
| 侧刺（致命） | `警示红 #E8483B` | 锁色板 #7（不可踩双编码） |
| 暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` tint | 0 新增 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 几何：竖柱（宽 24、高 48）+ 1–2 侧臂 + 周身短红刺；hard 顶 = 不可踩。
- 剪影：草绿柱+红刺，区别于 bramble（贴地低刺丛）、gu_bao（苞+顶刺）。

### 3.3 `quicksand` 流沙区（地形机制陷阱）

- 视觉：地面`rockFace #F2933C` 区域叠 `darken(#F2933C,0.5)` 漩涡纹理 + 缓慢内陷动画（≤3Hz，防光敏）；非碰撞体，由 02/03 下陷速度判定触底=死亡（复用 07）。
- 双编码：下陷漩涡 + 暗色 = "危险地形" telegraph，不靠单色。

---

## 4. 敌种视觉规格（通用基底 · 锁色板内）

> 通用规则（asset-spec §2.5）：可踩顶 = 软｜不可踩顶 = 硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。沙漠关同屏含通用基底 4 敌（ci_li/du_fu 可踩，chong_feng/shi_pao 不可踩），着色沿用各自 biome 的锁色板映射（见 cave/vine/storm §4），本关暖橙沙底下靠 `描边 #2A1A12` + 功能色维持辨识。

| 敌 | topIndicator | 顶缘形状 | 强化色 | stompable |
|---|---|---|---|---|
| 刺栗 ci_li | soft | 圆润 dome，刺朝侧/下 | — | ✅ |
| 嘟浮 du_fu | soft | 扁圆顶，翅在侧 | — | ✅ |
| 冲锋 chong_feng | hard | 楔形前尖 / 硬棱 | 警示红（全主体） | ❌ |
| 石炮 shi_pao | hard | 方硬顶 + 炮口 | 警示红描边 | ❌ |

> scorpion/cactus 已 §3 定义，均 hard 顶不可踩。

---

## 5. 背景视差层级 + 光照 / 氛围（炽热沙漠）

**氛围意图**：炽热暖沙——暖橙沙岩、草绿仙人掌、暖黄阳光，靠**暖橙主色 + 草绿生机 + 暖黄强光**制造"灼热中藏绿"对比（对比洞穴幽暗/风暴压抑）。

**光照**：正午强光、整体高饱和（art-bible §3.3：主体明度 ≥60%、饱和 55–80%）；投影用 `#4A78C0` 冷调 tint 制造"暖中藏冷"反差（非纯黑）。任意前景与背景亮度对比 ≥3:1（关键交互 ≥4.5:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 天空 | — | 暖沙晴空纯色 | `bg = lighten(#F2933C,0.4)` ≈ `#F7BE8A` |
| 远景 | 0.3 | 沙丘剪影 | `darken(#F2933C,0.5)` 剪影，无描边、低饱和 |
| 中景 | 0.6 | 金字塔 / 仙人掌 / 太阳 | `暖橙 #F2933C` + `草绿 #7CC242` + `暖黄 #FFD23F` |
| 游戏层 | 1.0 | 沙岩/敌/道具/主角 | `rockFace #F2933C` / `rockBody #79491E` / 描边 |
| 前景 | 1.2（克制） | 偶尔沙幕掠过 | `暖橙 #F2933C` alpha，遮挡路径 ≤10% |

**热浪（可选 weather）**：底部 30px 区域用横向微偏移正弦波模拟热浪扭曲（每帧 x+offset 微抖，tween 驱动）；"减少动态"开关下停首帧（对齐 art-bible §9.3）。

---

## 6. 可访问性（与 cave/vine/storm/sea 明显区分）

- **主题色相区分（不撞色）**：cave=冷蓝灰、vine=草绿、storm=蓝紫、sea=冷蓝天光+草绿——**沙漠 = 暖橙沙岩 + 暖沙晴空（非冷蓝）**，暖调唯一，色盲玩家靠**地面 hue（暖橙）+ 装饰形态（沙丘/金字塔/仙人掌）**即可分辨。
- **新元素双编码**：scorpion=暖橙身+红尾刺（hard 顶）、cactus=草绿柱+红刺、quicksand=暗漩涡下陷——均形状+颜色双编码，色盲安全。
- **敌种在暖底关的反差**：4 旧敌 + scorpion/cactus 均靠 `描边 #2A1A12` + 功能色（红/蓝紫/草绿）维持辨识；du_fu 在暖橙沙底加 `暖黄 #FFD23F` 肚皮斑提升蓝紫身反差。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"；热浪/阳光脉冲 ≤3Hz（防光敏）。
- **减少动态**：热浪/阳光脉冲在"减少动态"开关下减半或停首帧。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#F2933C` / `#7CC242` / `#FFD23F` / `#2A1A12` / `#E8483B` / `#F2C94C` / `#5BC8F5` = **7 色**（锁色板 #1/3/4/5/7/8/11）。
- **派生 tint（0 新增）**：沙晴空 `lighten(#F2933C,0.4)` ≈ `#F7BE8A`、沙岩暗面 `darken(#F2933C,0.5)` ≈ `#79491E`、仙人掌暗部 `darken(#7CC242,0.5)` ≈ `#3E6121`，均由锁色板色运行时 tint 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心）、`环境冷蓝 #4A78C0`（冷调投影 tint 源）、`蓝紫 #6E7BF2`（辉光少用）——均属锁色板 #6/9/10。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **越界 reconcile**：本 biome 严格守 11 色锁色板；提请主理人据 cave/vine/storm §7 既有 reconcile 结论更新 asset-spec §2 越界生产色（非本 biome 引入）。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`｜`'vine_forest'`｜`'storm_sky'`｜`'sea'`｜**`'desert'`（新增，roadmap 批次 3）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'desert'`（fail-safe 回退 `'grass'`）。

### 8.2 沙漠调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段，仅 add 一个 `desert` entry。下表为注册数据（非代码）：

| 引擎字段 | desert Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0xF7BE8A` | lighten(#F2933C,0.4) tint，0 新增 |
| `rockFace` | `0xF2933C` | 暖橙 #3 |
| `rockBody` | `0x79491E` | darken(#F2933C,0.5) tint，0 新增 |
| `out-line` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xFFD23F` | 暖黄 #4 |
| `crystalCore` | `0x7CC242` | 草绿 #1 |
| `crystalGlow` | `0xF2C94C` | 经济金 #8 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（沙漠取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['desert'].rockFace`(`#F2933C`) / `.rockBody`(`#79491E`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['desert'].bg)`(`#F7BE8A`) |
| 蝎子/仙人掌占位（`enemy-view.ts` 新增分支） | 蝎身=`firelight`? 否 → 暖橙用常量 `0xF2933C`、尾刺=`danger`(`#E8483B`)、描边=`out-line`；仙人掌=`crystalCore`(`#7CC242`)、刺=`danger` |
| 敌种/装饰绘制 | 见 §3/§4 锁色板映射；du_fu 肚皮斑=`firelight`(`#FFD23F`) |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme` 增 `'desert'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['desert']` 的 8 字段。
- **沙漠映射**：bg=`#F7BE8A`(tint)、rockFace=`#F2933C`、rockBody=`#79491E`(tint)、out-line=`#2A1A12`、firelight=`#FFD23F`、crystalCore=`#7CC242`、crystalGlow=`#F2C94C`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['desert']`；scorpion/cactus 走新增 `enemy-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为沙漠 biome 美术规格（加法），roadmap 批次 3；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
