# 藤林 biome 美术规格（vine-forest-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；即 `design/levels/2-2-content-spec.md` 附录 A 的权威落地）
> 作者：art-director（林绘澄）
> 上游依据：`design/levels/2-2-content-spec.md` §6 / 附录 A（theme=`vine_forest`）｜`design/gdd/14-bouncy-vine-enemy.md` §7.3｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：AD-BC-01（high）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `vine_forest`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**藤林主题视觉**与**新元素弹藤 `bouncy_vine` 视觉**；玩法/数值/物理由 GDD14 与工程负责。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 地面主面 / 弹藤藤体 / 藤叶 |
| 2 | 阴影绿 | `#5FA82F` | 地面暗面 / 藤体阴影 |
| 3 | 暖橙 | `#F2933C` | 藤花点缀 / 闪电同源暖意 |
| 4 | 暖黄 | `#FFD23F` | 孢子微光 / 弹藤高光环 / 花蕊 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用） |
| 7 | 警示红 | `#E8483B` | 危险语义（ci_li 等尖刺） |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 辉光（冷中藏暖反差） |
| 10 | 环境冷蓝 | `#4A78C0` | 石炮石身 / 冷调阴影 tint 源 |
| 11 | 天空 | `#5BC8F5` | 背景天空 / 敌眼高光 |

> 本 biome 全部引用色均取自上表；派生暗面/阴影由 `#7CC242`/`#5FA82F`/`#4A78C0` **运行时 tint** 生成，**不计入新增 hex**（对齐 2-2 附录 A·4）。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

cave-biome-spec §6.2 与 theme-palette.ts 的 `ThemePalette` 接口为 8 语义槽。本 biome 用同一套引擎字段名（保证 eng 直接照表注册进 `THEME_PALETTES`），并显式给出与任务要求的**概念别名**对应关系（sky/ground/accent/hazard/foliage/trim/outline/seed）：

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 天空填充 |
| ground | `rockFace` | 地面主面（ground_top / 实心瓦片） |
| accent | `rockBody` | 地面暗面（ground_fill / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 植披 / 辉光（冷中藏暖） |
| trim | `crystalCore` | 核心高光（孢子 / 花蕊 / 果实） |
| outline | `outline` | 全局描边 |
| seed | `firelight` | 暖色点缀（藤花 / 苞 / 暖意） |

### 1.2 藤林 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `#5BC8F5` | 天空 | #11 |
| ground | `rockFace` | `#7CC242` | 草绿 | #1 |
| accent | `rockBody` | `#5FA82F` | 阴影绿 | #2 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#6E7BF2` | 蓝紫 | #9 |
| trim | `crystalCore` | `#FFD23F` | 暖黄 | #4 |
| outline | `outline` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#F2933C` | 暖橙 | #3 |

> 8 个权威 hex 全部落在锁色板内，**无任何新 hex**（tint 不计入新增，见 §7）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 远景树冠剪影 | `darken(#5FA82F, 0.4)` ≈ `#36581B` | parallax 远层（无描边、低饱和） | 0 新增（tint） |
| 藤体/草体阴影 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 藤叶/地面暗部 | 0 新增（tint） |
| 石炮石身暗面 | `darken(#4A78C0, 0.5)` ≈ `#254060` | shi_pao 阴影（见 §4.3） | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；藤林经 theme palette 映射（§1.2）生成，**不另绘藤林瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原、洞穴一致；仅主色由草绿（base）→ 草绿 `#7CC242`、身色由暖橙（base）→ 阴影绿 `#5FA82F` tint。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_vine_hanging` 垂藤：自顶/平台垂下的细长藤（草绿 `#7CC242` + 暗面 tint + 描边），纯氛围。
  - `deco_leaf_cluster` 叶簇：地面/平台边缘的叶团（草绿面 + 阴影绿暗面 + 描边）。
  - `deco_spore` 孢子光点：空气中缓浮小光点（暖黄 `#FFD23F` 半透，alpha ≤0.4，≤2Hz 脉冲，守防光敏），点缀"生机向上"。
  - MVP：用 `Graphics` 画简单多边形/圆点占位，程序化 tint，无需 PNG。
- **IP**：垂藤/叶簇为原创植物形态，非管道/龟壳符号。

---

## 3. 弹藤 `bouncy_vine` 视觉规格（新元素 · 绿系 · 纯辅助）

> 对齐 GDD14 §7.3。形状语言优先：弹藤 = **地面扁圆盘线圈 + 卷曲纹**，与鼓苞（垂直刺柱）、4 旧敌（圆/楔/扁/方）、气旋（半透明蓝气柱）剪影全异。配色：藤体 `草绿 #7CC242`、高光环 `暖黄 #FFD23F`、描边 `#2A1A12`。
> 几何基准（GDD14 §3）：`width=40`、`height=16`，`anchorY=224`（贴地，玩家落点=地面高度）；碰撞盒 `top=208 / bottom=224`。

### 3.1 三态明细

| 态 | 几何 | 配色 | 危害 | 可触发弹起 | 视觉要点 |
|---|---|---|---|---|---|
| **IDLE** | 静止扁线圈（p=0） | 藤体 `草绿 #7CC242` + 暖黄 `#FFD23F` 高光环 | 否（全态非危害） | 是（`launchReady`） | 扁圆盘 + 卷曲纹 + 暖黄环 = **友好辅助**（与鼓苞红刺柱对照） |
| **SPRING** | 压缩→释放（p:0→1），当帧套用弹起速度 | 同上，压缩形变 | 否 | 否 | 线圈下压蓄势→弹开的 squash 动画 |
| **RECOIL** | 回弹松弛（p:1→0），冷却窗口 | 同上 | 否 | 否（冷却防连弹） | 松弛回弹，环仍亮提示"可再来" |

### 3.2 绘制约定（MVP Graphics）

- **藤体**：扁圆盘（宽 40、高 16），`草绿 #7CC242` 填充 + `描边 #2A1A12` 1px；中心卷曲螺旋纹（暗面 tint 描线）。
- **高光环**：`暖黄 #FFD23F` 1–2px 环（alpha 0.6–0.9），明确"可交互/友好"，非危险语义。
- **动画**：SPRING 压缩（垂直 squash ≤0.6）、RECOIL 回弹松弛；≤12fps 节奏，防光敏 <3Hz。

### 3.3 与鼓苞 / 气旋 / 4 旧敌轮廓对比（确保全异 · 色盲安全）

| 元素 | 轮廓 | 主色 | 弹藤区分点 |
|---|---|---|---|
| `gu_bao` 鼓苞 | 垂直刺苞柱 | 暖橙 | 弹藤 = **扁地面线圈 + 暖黄环**（形+色双异，辅助 vs 危害） |
| `cyclone` 气旋 | 半透明蓝气柱 | 天空蓝 | 弹藤 = 实心绿线圈（实心 vs 半透明） |
| `ci_li` 刺栗 | 圆球 + 周身短刺 | 警示红 | 弹藤 = 绿线圈无刺（友好色） |
| `chong_feng` 锥冲 | 长条楔形 | 警示红 | 弹藤 = 扁圆线圈（非楔形） |
| `du_fu` 嘟浮 | 扁圆 + 双翅 | 蓝紫 | 弹藤 = 地面线圈（非飞行扁圆） |
| `shi_pao` 石炮 | 方正石块 + 炮口 | 环境冷蓝 | 弹藤 = 有机线圈（非方块炮台） |

> 结论：弹藤以 **「草绿扁线圈 + 暖黄友好环」** 剪影唯一，与所有危害/其他辅助元素全异；靠**友好绿+暖黄**与鼓苞**橙+红刺**双重区分，色盲安全。

### 3.4 后续像素化路径（AI 生成提示词预留）

- **bouncy_vine**：`pixel art, 32px grid, flat coiled grass vine spring, grass green #7CC242 body, dark outline #2A1A12, warm yellow #FFD23F friendly ring, no mushroom no metal spring, flat toon`
- **vine tile**：`pixel art tile, 32x32, grass green #7CC242 top, shadow green #5FA82F body, 1px dark outline #2A1A12, matte`
- **deco_spore**：`pixel art, tiny floating spore glow, warm yellow #FFD23F, soft, non-threatening`

---

## 4. 敌种视觉规格（着色指引 · 限锁色板内）

> 通用规则（asset-spec §2.5）：可踩顶 = 软（圆润/柔边/无刺）｜不可踩顶 = 硬（尖角/硬棱/炮口）；警示红 `#E8483B` 仅作强化，形状语言为主，色盲安全。
> **越界 reconcile 声明**：asset-spec §2 对 `ci_li`/`du_fu`/`shi_pao` 引用了锁色板外生产色（深红 `#B5302A`、浅 `#A9B8F5`、白眼、石灰白 `#F4EFE6`、深灰 `#8A8276`）。本 biome 严格守 11 色锁色板，将其映射到下表锁色板色 / 运行时 tint（0 新增），并提请主理人据此 reconcile `asset-spec §2`。

### 4.1 `ci_li` 刺栗（地面慢 / 可踩 / 圆+刺 / 警示红）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `警示红 #E8483B` | 锁色板 #7 |
| 阴影（替越界 `#B5302A`） | `darken(#E8483B, 0.5)` tint | 0 新增 |
| 周身短刺 | `警示红 #E8483B`（顶缘无刺） | 软顶可踩 |
| 眼（替白） | `天空 #5BC8F5` 小点 | 锁色板 #11 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 尺寸/动画沿用 asset-spec §2.1（`32×32` / patrol 4f / stomped 3f）；soft 顶（圆润 dome、刺朝侧下）。

### 4.2 `du_fu` 嘟浮（飞行 / 可踩 / 扁圆+翅 / 蓝紫）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `蓝紫 #6E7BF2` | 锁色板 #9（避用增益紫 `#9B6CF2`） |
| 高光（替越界 `#A9B8F5`） | `天空 #5BC8F5` | 锁色板 #11（更亮蓝） |
| 翅膜 | `蓝紫 #6E7BF2` 半透（alpha ≤0.5） | — |
| 肚皮强调（蓝 biome 反差） | `暖黄 #FFD23F` 小斑 | 锁色板 #4；**风暴天空关强烈建议**，提升蓝底对比 |
| 眼（替白） | `暖黄 #FFD23F` 小点 | 锁色板 #4 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 尺寸/动画沿用 asset-spec §2.3（`36×32` / float 4f / stomped 3f）；soft 顶（扁圆、翅在侧）。

### 4.3 `shi_pao` 石炮（固定炮台 / 不可踩 / 方+石身 / 环境冷蓝）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 石身（替越界 `#F4EFE6`） | `环境冷蓝 #4A78C0` | 锁色板 #10（冷蓝灰石，读作"冷光石台"） |
| 阴影（替越界 `#8A8276`） | `darken(#4A78C0, 0.5)` ≈ `#254060` tint | 0 新增 |
| 炮口/警示 | `警示红 #E8483B` 描边/闪 | 锁色板 #7（硬顶+炮口=不可踩双编码） |
| 弹丸 `fx_projectile` | `警示红 #E8483B` + `暖黄 #FFD23F` 拖尾 | 锁色板 #7/#4 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 尺寸/动画沿用 asset-spec §2.4（`32×32` 实心 / idle·aim·fire·cooldown）；hard 顶（方硬顶+炮口）。
- **风暴天空关对比提示**：石身 `#4A78C0` 与 storm bg/rockBody 同色，靠 `描边 #2A1A12` + 红炮口 + 方硬轮廓 + 多置于蓝紫 `#6E7BF2` 平台之上维持辨识（见 §6）。

### 4.4 四敌可踩/不可踩视觉语言汇总（与 cave/storm 一致）

| 敌 | topIndicator | 顶缘形状 | 强化色 | stompable |
|---|---|---|---|---|
| 刺栗 ci_li | soft | 圆润 dome，刺朝侧/下 | — | ✅ |
| 嘟浮 du_fu | soft | 扁圆顶，翅在侧 | — | ✅ |
| 石炮 shi_pao | hard | 方硬顶 + 炮口 | 警示红描边 | ❌ |

---

## 5. 背景视差层级 + 光照 / 氛围（明亮藤林）

**氛围意图**（2-2 §6）：明亮藤林——草绿植被包裹、暖橙花点缀、半透绿荫，靠**草绿主色 + 暖橙暖意 + 暖黄微光**制造"生机向上"对比（对比洞穴幽暗）。

**光照**：午后斜阳、暖调、高明度高饱和（art-bible §3.3：主体明度 ≥60%、饱和 55–80%）。无冷黑阴影；任意前景与背景亮度对比 ≥3:1（关键交互 ≥4.5:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 天空 | — | 纯色填充 | `bg = #5BC8F5`（明亮天光） |
| 远景 | 0.3 | 树冠剪影 | `darken(#5FA82F,0.4)` 剪影，无描边、低饱和 |
| 中景 | 0.6 | 垂藤/叶簇装饰 | `草绿 #7CC242` + `阴影绿 #5FA82F` |
| 游戏层 | 1.0 | 地形/弹藤/敌/道具/主角 | `rockFace #7CC242` / `rockBody #5FA82F` / 描边 |
| 前景 | 1.2（克制） | 偶尔叶掠过 | `草绿 #7CC242` alpha，遮挡路径 ≤10% |

**与洞穴的明暗反差**：洞穴 bg=`#1C2E49`（暗）、地面冷蓝；藤林 bg=`#5BC8F5`（亮）、地面草绿——同套 8 槽接口下，仅靠 hex 即拉开"幽暗→明绿"的基调差。

---

## 6. 可访问性（与 cave + storm_sky 明显区分）

- **主题色相区分（三关不撞色）**：
  - cave = **冷蓝灰** 地面（`#4A78C0`）+ 暗背景 → "幽暗"。
  - vine_forest = **草绿** 地面（`#7CC242`）+ 亮天空 → "明绿生机"（本关唯一绿系地面）。
  - storm_sky = **蓝紫** 地面（`#6E7BF2`）+ 冷蓝天光 → "压抑风暴"（本关唯一紫蓝地面）。
  - 地面主色即首要区分信号，色盲玩家靠**地面 hue + 装饰形态**（藤/晶/气旋）即可分辨。
- **新元素双编码**：弹藤=绿色扁线圈+暖黄环（友好辅助），与鼓苞橙刺柱（危害）、气旋蓝气柱（力场）形态/透明度/颜色三重区分，色盲安全。
- **敌种在蓝底关的反差**：`du_fu` 在 storm_sky 加 `暖黄 #FFD23F` 肚皮斑；`shi_pao` 靠描边+红炮口+方硬轮廓维持辨识（§4.3）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"（§4.4）；受击/弹起动效 ≤3Hz（防光敏）。
- **减少动态**：cyclone/孢子等粒子在"减少动态"开关下减半或停首帧（对齐 art-bible §9.3 / asset-spec §6.5）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#5BC8F5` / `#7CC242` / `#5FA82F` / `#2A1A12` / `#F2933C` / `#FFD23F` / `#6E7BF2` / `#E8483B` = **8 色**（锁色板 #1/2/3/4/5/7/9/11）。
- **派生 tint（0 新增）**：远景树冠 `darken(#5FA82F,0.4)`、藤体阴影 `darken(#7CC242,0.5)`、石炮阴影 `darken(#4A78C0,0.5)`，均由锁色板色运行时 darken 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心）、`经济金 #F2C94C`（coin）、`环境冷蓝 #4A78C0`（石炮石身）——均属锁色板 #6/8/10。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **越界 reconcile**：本 biome 将 asset-spec §2 中 `ci_li`/`du_fu`/`shi_pao` 的越界生产色（`#B5302A`/`#A9B8F5`/白眼/`#F4EFE6`/`#8A8276`）映射到上表锁色板色 / tint，提请主理人据此更新 asset-spec §2（非本 biome 引入，属全局 reconcile）。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`（2-1）｜**`'vine_forest'`（2-2，新增）**｜`'storm_sky'`（2-3，新增，预留）。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定；cave §6.1 已定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'vine_forest' | 'storm_sky'`（fail-safe 回退 `'grass'`）。

### 8.2 藤林调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段（`bg`/`rockFace`/`rockBody`/`outline`/`firelight`/`crystalCore`/`crystalGlow`/`danger`），**仅 add 一个 `vine_forest` entry**，不改动接口。下表为注册数据（非代码）：

| 引擎字段 | vine_forest Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x5BC8F5` | 天空 #11 |
| `rockFace` | `0x7CC242` | 草绿 #1 |
| `rockBody` | `0x5FA82F` | 阴影绿 #2 |
| `outline` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xF2933C` | 暖橙 #3 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4 |
| `crystalGlow` | `0x6E7BF2` | 蓝紫 #9 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（藤林取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['vine_forest'].rockFace`(`#7CC242`) / `.rockBody`(`#5FA82F`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['vine_forest'].bg)`(`#5BC8F5`) |
| 弹藤占位（`enemy-view.ts` 新增分支） | 藤体=`rockFace`(`#7CC242`)、高光环=`crystalCore`(`#FFD23F`)、描边=`outline` |
| 敌种/装饰绘制 | 见 §4 锁色板映射；石炮石身=`环境冷蓝 #4A78C0`（`THEME_PALETTES` 未单独存，由 `#4A78C0` 常量取） |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme: 'grass' | 'cave' | 'vine_forest' | 'storm_sky'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES[theme]` 的 8 字段（`bg`/`rockFace`/`rockBody`/`outline`/`firelight`/`crystalCore`/`crystalGlow`/`danger`）。
- **藤林映射**：bg=`#5BC8F5`、rockFace=`#7CC242`、rockBody=`#5FA82F`、outline=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#FFD23F`、crystalGlow=`#6E7BF2`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['vine_forest']`；弹藤走新增 `enemy-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为藤林 biome 美术规格（加法），即 `design/levels/2-2-content-spec.md` 附录 A 的权威落地；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
