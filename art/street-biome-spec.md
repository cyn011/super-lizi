# 街 biome 美术规格（street-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；roadmap 批次 3，urban_indoor family）
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/theme-system.md` §4.1（street 行）｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：roadmap 批次 3（高）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `street`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**街（城市）主题视觉**与**新障碍移动车辆 `vehicle` / 井盖 `manhole` 视觉**；玩法/数值/物理（vehicle 周期横穿）由对应 GDD 与工程负责。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 行道树/绿植（少用） |
| 2 | 阴影绿 | `#5FA82F` | 绿植暗部（可选 tint 源） |
| 3 | 暖橙 | `#F2933C` | **路灯/招牌暖橙 / 井盖蒸汽** |
| 4 | 暖黄 | `#FFD23F` | 招牌暖光核心 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，本关不用于敌） |
| 7 | 警示红 | `#E8483B` | 危险语义（车灯 / ci_li 等） |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 霓虹辉光 |
| 10 | 环境冷蓝 | `#4A78C0` | **建筑/路面主面 / 车身** |
| 11 | 天空 | `#5BC8F5` | 城市天空（压暗） |

> 本 biome 冷调主导（环境冷蓝建筑 + 天空压暗）+ 暖橙路灯 + 蓝紫霓虹反差；全部引用色取自锁色板，**派生暗面由 `#4A78C0`/`#5BC8F5` 运行时 tint**（0 新增）。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 城市天空填充（压暗） |
| ground | `rockFace` | 地面主面（建筑 / 路面 / 实心瓦片） |
| accent | `rockBody` | 地面暗面（建筑底 / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 辉光（霓虹 / 冷蓝天光反差） |
| trim | `crystalCore` | 核心高光（招牌暖光 / 叶瓣） |
| outline | `out-line` | 全局描边 |
| seed | `firelight` | 暖色点缀（路灯 / 暖意） |

### 1.2 街 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `darken(#5BC8F5, 0.3)` ≈ `#408CAC` | tint 派生（压暗天空） | 0 新增 |
| ground | `rockFace` | `darken(#4A78C0, 0.35)` ≈ `#304E7D` | tint 派生（冷蓝建筑灰） | 0 新增 |
| accent | `rockBody` | `darken(#4A78C0, 0.5)` ≈ `#254060` | tint 派生（路面暗面） | 0 新增 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#6E7BF2` | 蓝紫（霓虹） | #9 |
| trim | `crystalCore` | `#FFD23F` | 暖黄（招牌核心） | #4 |
| outline | `out-line` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#F2933C` | 暖橙（路灯） | #3 |

> 8 个权威 hex（含 3 个 tint 派生）全部落在锁色板内或由其 tint 派生，**无任何新 hex**（tint 不计入新增，见 §7）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 城市天空 bg | `darken(#5BC8F5, 0.3)` ≈ `#408CAC` | 天空填充（阴沉压暗） | 0 新增（tint） |
| 建筑主面 rockFace | `darken(#4A78C0, 0.35)` ≈ `#304E7D` | 楼宇/路面（冷蓝灰） | 0 新增（tint） |
| 路面暗面 rockBody | `darken(#4A78C0, 0.5)` ≈ `#254060` | 路面/建筑底 | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；街经 theme palette 映射（§1.2）生成，**不另绘街瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原/洞穴一致；仅主色由草绿（base）→ 冷蓝灰 `#304E7D`、身色由暖橙（base）→ 路面暗面 `#254060`。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_building` 建筑：高低错落矩形（冷蓝灰 `#304E7D` 面 + 暗面 `#254060` + 描边），中景；窗格用 `#408CAC` 浅点阵。
  - `deco_lamp` 路灯：竖线 + 圆头（`暖橙 #F2933C` + 描边），暖光点。
  - `deco_sign` 招牌：横矩形（`蓝紫 #6E7BF2` 辉光 + `暖黄 #FFD23F` 核心）。
  - MVP：用 `Graphics` 画简单矩形/线占位，程序化 tint，无需 PNG。
- **IP**：楼宇/路灯为原创城市形态，非管道/龟壳符号。

---

## 3. 专属障碍视觉规格（锁色板内 · 双编码）

### 3.1 `vehicle` 移动车辆（周期横穿 / 不可踩 / 大方块+前灯 / 环境冷蓝+警示红）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 车身 | `环境冷蓝 #4A78C0` | 锁色板 #10（冷蓝灰车体） |
| 暗部 | `darken(#4A78C0, 0.5)` ≈ `#254060` tint | 0 新增 |
| 前灯（致命） | `警示红 #E8483B` | 锁色板 #7（硬顶+红灯=不可踩双编码） |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 几何：大方块（宽 48、高 32）+ 前缘红灯；周期横穿（水平移动 hazard）。
- **蓝底辨识**：车身 `#4A78C0` 与 street bg/rockBody 同色系，靠 `描边 #2A1A12` + 红前灯 + 方硬轮廓 + 多置于 `#408CAC` 天空前维持辨识（同 storm_sky §4.3 石炮方案）。
- hard 顶（方硬顶+红灯）= 不可踩。

### 3.2 `manhole` 井盖（周期喷蒸汽/塌陷陷阱 / 可变）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 盖体 | `描边 #2A1A12` 圆盖 + `环境冷蓝 #4A78C0` 面 | 锁色板 #5/#10 |
| 蒸汽（周期） | `暖橙 #F2933C` alpha ≤0.5 | 锁色板 #3（暖意反差） |
| 危险暗示 | `警示红 #E8483B` 边闪（开启期） | 锁色板 #7 |

- 地面圆盖，周期喷蒸汽/塌陷 = 陷阱；开启期靠红边闪 + 蒸汽 telegraph（形状+颜色双编码）。
- 可踩/不可踩随周期状态切换（静止可踩、喷发不可踩），靠视觉状态明确。

---

## 4. 敌种视觉规格（通用基底 · 锁色板内）

> 通用规则（asset-spec §2.5）：可踩顶 = 软｜不可踩顶 = 硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。
> 街关联屏含通用基底 4 敌（ci_li/du_fu 可踩，chong_feng/shi_pao 不可踩），着色沿用各自 biome 的锁色板映射（见 cave/vine/storm §4）。

### 4.1 蓝底关反差（与 storm_sky 同方案）

- `du_fu` 嘟浮：加 `暖黄 #FFD23F` 肚皮斑（蓝紫身上暖点，强对比）；眼 `暖黄 #FFD23F` 小点。
- `shi_pao` 石炮：石身 `#4A78C0` 与 street 同色，靠 `描边 #2A1A12` + 红炮口 + 方硬轮廓 + 多置于 `#408CAC` 天空前维持辨识（同 storm_sky §4.3）。
- `ci_li` / `chong_feng`：沿用各自锁色板映射，靠描边 + 形状区分。

### 4.2 四敌可踩/不可踩视觉语言汇总

| 敌 | topIndicator | 顶缘形状 | 强化色 | stompable |
|---|---|---|---|---|
| 刺栗 ci_li | soft | 圆润 dome，刺朝侧/下 | — | ✅ |
| 嘟浮 du_fu | soft | 扁圆顶，翅在侧 | 暖黄肚皮斑 | ✅ |
| 冲锋 chong_feng | hard | 楔形前尖 / 硬棱 | 警示红（全主体） | ❌ |
| 石炮 shi_pao | hard | 方硬顶 + 炮口 | 警示红描边 | ❌ |

> vehicle/manhole 为街区专属障碍，见 §3；与 4 旧敌剪影全异（大方块车 vs 圆/楔/扁/方敌）。

---

## 5. 背景视差层级 + 光照 / 氛围（冷调城市）

**氛围意图**：冷调城市——冷蓝灰建筑、压暗天空、暖橙路灯、蓝紫霓虹，靠**冷蓝主色 + 暖橙微光 + 蓝紫霓虹**制造"都市冷中藏暖"对比。

**光照**：overcast 冷调、整体降低饱和（art-bible §3.3：背景饱和度压到 30–40%、明度 +10%）；前景/实体保持高对比（任意前景与背景亮度对比 ≥3:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 天空 | — | 纯色填充（压暗） | `bg = #408CAC`（阴沉冷蓝） |
| 远景 | 0.3 | 楼影剪影 | `darken(#4A78C0,0.4)` 剪影，无描边、低饱和 |
| 中景 | 0.6 | 建筑 / 路灯 / 招牌 | `环境冷蓝 #4A78C0` + `暖橙 #F2933C` + `蓝紫 #6E7BF2` |
| 游戏层 | 1.0 | 路面/车辆/敌/道具/主角 | `rockFace #304E7D` / `rockBody #254060` / 描边 |
| 前景 | 1.2（克制） | 偶尔电线/广告掠过 | `环境冷蓝 #4A78C0` alpha，遮挡路径 ≤10% |

**与藤林 / 洞穴 / 风暴 / 海 / 沙漠的基调反差**：同套 8 槽接口下，街 = 冷蓝灰建筑 + 压暗天空，靠 hex 即拉开"幽暗→明绿→压抑→清凉→炽热→都市冷"的序列差。

---

## 6. 可访问性（与全主题明显区分）

- **主题色相区分（不撞色）**：cave=冷蓝灰+暗背景、vine=草绿+亮天空、storm=蓝紫+冷蓝天光、sea=冷蓝天光+草绿、desert=暖橙沙、home=暖橙木+暖棕墙——**street = 冷蓝灰建筑（`#304E7D`）+ 压暗天空（`#408CAC`）**，冷调唯一（无草绿/暖橙地面主导），色盲玩家靠**建筑 hue + 路灯/霓虹形态**即可分辨。
- **新元素双编码**：vehicle=冷蓝方块+红前灯（硬顶不可踩）；manhole=圆盖+周期蒸汽/红闪（状态 telegraph）；均形状+颜色双编码，色盲安全。
- **敌种在蓝底关的反差**：du_fu 加暖黄肚皮斑；shi_pao 靠描边+红炮口+方硬轮廓（§4.1）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"；霓虹/蒸汽 ≤3Hz（防光敏）。
- **减少动态**：霓虹脉冲、蒸汽、车辆移动在"减少动态"开关下减半或停首帧（对齐 art-bible §9.3）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#4A78C0` / `#6E7BF2` / `#5BC8F5` / `#2A1A12` / `#F2933C` / `#FFD23F` / `#E8483B` / `#7CC242` = **8 色**（锁色板 #1/3/4/5/7/9/10/11）。
- **派生 tint（0 新增）**：城市天空 `darken(#5BC8F5,0.3)`、建筑主面 `darken(#4A78C0,0.35)`、路面暗面 `darken(#4A78C0,0.5)`，均由锁色板色运行时 darken 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心）、`经济金 #F2C94C`（coin）、`阴影绿 #5FA82F`（绿植暗部 tint 源）——均属锁色板 #2/6/8。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **越界 reconcile**：将 asset-spec §2 中越界生产色映射到锁色板色 / tint（同 cave/vine/storm §7），提请主理人据此更新 asset-spec §2。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`｜`'vine_forest'`｜`'storm_sky'`｜`'sea'`｜`'desert'`｜`'home'`｜**`'street'`（新增，roadmap 批次 3）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'street'`（fail-safe 回退 `'grass'`）。

### 8.2 街调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段，仅 add 一个 `street` entry。下表为注册数据（非代码）：

| 引擎字段 | street Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x408CAC` | darken(#5BC8F5,0.3) tint，0 新增 |
| `rockFace` | `0x304E7D` | darken(#4A78C0,0.35) tint，0 新增 |
| `rockBody` | `0x254060` | darken(#4A78C0,0.5) tint，0 新增 |
| `out-line` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xF2933C` | 暖橙 #3 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4 |
| `crystalGlow` | `0x6E7BF2` | 蓝紫 #9 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（街取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['street'].rockFace`(`#304E7D`) / `.rockBody`(`#254060`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['street'].bg)`(`#408CAC`) |
| 车辆/井盖占位（`street-obstacle-view.ts` 新增） | 车身=`环境冷蓝 #4A78C0`、前灯=`danger`(`#E8483B`)、蒸汽=`firelight`(`#F2933C`)；描边=`out-line` |
| 敌种/装饰绘制 | 见 §4 锁色板映射；石炮石身=`环境冷蓝 #4A78C0` |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme` 增 `'street'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['street']` 的 8 字段。
- **街映射**：bg=`#408CAC`(tint)、rockFace=`#304E7D`(tint)、rockBody=`#254060`(tint)、out-line=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#FFD23F`、crystalGlow=`#6E7BF2`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['street']`；车辆/井盖走新增 `street-obstacle-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为街 biome 美术规格（加法），roadmap 批次 3；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
