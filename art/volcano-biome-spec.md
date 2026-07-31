# 火山 biome 美术规格（volcano-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；第二章终章 2-6 落地）
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/theme-system.md` §4.1（volcano 行，待 design-strategist 落 2-6 简报）｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）｜`art/theme-framework.md` 附录 C（权威交叉引用）
> 关联任务：AD-2-6-BIOME（high）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `volcano`；MVP 全程序化占位（Graphics，无 PNG，守 ADR-004）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**火山 / 熔岩主题视觉**与**四类通用敌（gu_bao / ci_li / du_fu / shi_pao）的火山换皮**；玩法 / 数值 / 物理（投掷、碰撞、可踩语义）由对应 GDD 与工程负责，**本 biome 仅换皮、不改任何机制语义**。

> ### ⚠️ 关键美术决策（提请主理人知悉）
> **暖橙 `#F2933C` 已被 `desert` biome 占用为地面主面 `rockFace`**（见 `art/desert-biome-spec.md` §1.2）。若 volcano 也把暖橙作地面主色，将与沙漠"撞色"，违背"不与现有色板撞色"要求。
> **故 volcano 不把暖橙作地面主面**，而采用：**玄武岩黑 `#2A1A12` 作地面主面（黑曜玄武岩，全 biome 唯一）+ 暖橙/暖黄作熔岩辉光点缀（裂隙 / 岩浆河 / 平台顶缘发光边）+ 暗紫天空（`#6E7BF2` 暗化 tint）**。既守住"11 色锁色板 + 0 新增 hex"纪律，又确保与沙漠（暖橙沙地+暖桃天空）、洞穴（冷蓝岩）、风暴（蓝紫浮岛）、海（冷蓝礁）、藤林（草绿）**全异**。

**权威 11 色色板（以本文件为准）**

> **权威 11 色以本文件为准** —— 本 biome 全部引用色取自下表 11 色（即项目全局锁色板），**0 新增 hex**；灰烬灰 / 暗紫天空由运行时 tint 派生，不计入新增（见 §7）。design-strategist 的《2-6 关卡设计简报》须引用此 11 色（主题键统一 `volcano`）。

| # | 火山语义名 | 锁色板名 | Hex | 本 biome 用途 |
|---|---|---|---|---|
| 1 | **玄武岩黑（岩黑）** | 描边 | `#2A1A12` | 游戏层地面主面 / 岩体（黑曜玄武岩）+ 全局描边 |
| 2 | **熔岩橙红** | 暖橙 | `#F2933C` | 熔岩辉光 / 地表裂隙 / 岩浆河 / 危险暖意 |
| 3 | **灼热高光** | 暖黄 | `#FFD23F` | 熔岩核心高光 / 平台顶缘发光边 / 火花 |
| 4 | **暗紫天空** | 蓝紫 | `#6E7BF2` | 天空层主色（暗紫调，运行时 darken 派生；本关唯一紫天空） |
| 5 | 冷岩蓝 | 环境冷蓝 | `#4A78C0` | 玄武岩冷调阴影 / 熔岩边缘冷反差（deco / 阴影 tint 源） |
| 6 | 蒸汽天蓝 | 天空 | `#5BC8F5` | 蒸汽 / 热浪辉光 / 火花粒子（deco） |
| 7 | 警示红 | 警示红 | `#E8483B` | 危险语义（最热岩浆 / 尖刺 / gu_bao 顶刺 / ci_li） |
| 8 | 焦土绿（极少用） | 草绿 | `#7CC242` | 残存焦绿植披（克制使用，避免与 vine_forest 撞色） |
| 9 | 焦土绿暗（极少用） | 阴影绿 | `#5FA82F` | 焦绿暗部 tint 源（极少用） |
| 10 | 命粉 | 命粉 | `#F26D8B` | HUD 爱心（全局沿用） |
| 11 | 经济金 | 经济金 | `#F2C94C` | coin（全局沿用） |

> **派生 tint（0 新增，不计入 11 色）**：① 灰烬灰 `lighten(#2A1A12, 0.5)` ≈ `#6B5E55`（远景剪影 / 灰烬 / 焦土）；② 暗紫天空 `darken(#6E7BF2, 0.3)` ≈ `#3F45A8`（天空填充）；③ 玄武岩冷下体 `darken(#4A78C0, 0.6)` ≈ `#1E3050`（岩体底面冷阴影，可选）。
> 全部引用色落在 11 色锁色板内或其 tint 派生，**无任何新 hex**。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 暗紫天空填充 |
| ground | `rockFace` | 地面主面（玄武岩黑 / 实心瓦片） |
| accent | `rockBody` | 地面暗面（岩体底 / oneway，冷调阴影） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 熔岩辉光（暖中藏橙反差） |
| trim | `crystalCore` | 核心高光（灼热黄 / 平台顶缘发光） |
| outline | `outline` | 全局描边 |
| seed | `firelight` | 暖色点缀（熔岩 / 暖意） |

### 1.2 火山 8 槽权威 hex（必须给，全部锁色板色 / tint）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `darken(#6E7BF2,0.3)` ≈ `#3F45A8` | 暗紫天空（tint） | #4 tint, 0 新增 |
| ground | `rockFace` | `#2A1A12` | 玄武岩黑（描边） | #1 |
| accent | `rockBody` | `#2A1A12` | 玄武岩黑（同 rockFace，有意复用） | #1 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#F2933C` | 熔岩橙红（暖橙） | #2 |
| trim | `crystalCore` | `#FFD23F` | 灼热高光（暖黄） | #3 |
| outline | `outline` | `#2A1A12` | 描边 | #1 |
| seed | `firelight` | `#F2933C` | 熔岩橙红（暖橙） | #2 |

> 8 个权威 hex（含 1 个 tint 派生）全部落在锁色板内或由其 tint 派生，**无任何新 hex**（tint 不计入新增，见 §7）。`bg` 与 `rockBody` 取暗化/同色属有意复用，非新增。冷岩蓝 `#4A78C0`、蒸汽天蓝 `#5BC8F5` 作为 deco / 阴影 tint 源使用（见 §2·§3）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 暗紫天空 bg | `darken(#6E7BF2, 0.3)` ≈ `#3F45A8` | 天空填充（暗紫，非冷蓝） | 0 新增（tint） |
| 灰烬灰 | `lighten(#2A1A12, 0.5)` ≈ `#6B5E55` | 远景剪影 / 灰烬粒子 / 焦土 | 0 新增（tint） |
| 玄武岩冷下体 | `darken(#4A78C0, 0.6)` ≈ `#1E3050` | 岩体底面 / oneway 冷阴影（可选） | 0 新增（tint） |
| 熔岩暗裂 | `darken(#F2933C, 0.5)` ≈ `#79491E` | 岩浆河暗部 / 苞体裂隙暗 | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint · 火山游戏层）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；火山经 theme palette 映射（§1.2）生成，**不另绘火山瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原 / 洞穴 / 沙漠一致；仅主色由草绿（base）→ 玄武岩黑 `#2A1A12`、底面由暖橙（base）→ 同黑 / 冷下体 tint。
- **平台顶缘发光边（可站立信号，替代草绿顶边）**：solid 顶面绘 **1–2px 熔岩橙红 `#F2933C` + 内 1px 灼热黄 `#FFD23F` 高光边**，明确表示"可站立"——既守火山主题，又提供强读性的 standability 信号（形状+发光双编码，色盲安全）。
- **节拍平台（beatPlatforms）视觉与渲染红线**：volcano 下节拍平台沿用玄武岩黑 `#2A1A12` 面 + 顶缘熔岩发光边（同 solid），作为可选高路 / 节奏奖励；初始态 `ghost` = 半透玄武岩 + 暗橙边，实体化后转满不透明 + 顶缘炽红发光。**⚠️ 关卡侧红线（design/gdd/level-2-6-design.md §6）：所有节拍平台瓦片必须位于 `ty=4`（y=128，站立角色头顶之上），严禁 `ty=5`（y=160，贴头危险）。** oneway 踏脚石可 `ty3/4/5`，互不影响；仅节拍平台受此约束。视觉呈现时须确保节拍平台在 `ty=4` 高度、其顶缘发光边清晰可见（≥3:1 对比），避免与黑岩背景糊在一起。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_crack` 地表裂隙：地面升起的细橙红发光裂（暖橙 `#F2933C` + 暖黄 `#FFD23F` 核心，无描边或细描边），纯氛围 / 危险 telegraph。
  - `deco_pillar` 玄武岩柱：地面升起的粗黑岩柱（玄武岩黑面 + 冷下体 tint + 顶缘熔岩发光），中景装饰（**不参与碰撞**，碰撞仍由 `tiles[]` 的 solid 决定）。
  - `deco_lava_river` 岩浆河：中景 / 前景水平流动橙红带（暖橙 + 暖黄高光 + 暗裂 tint，≤2Hz 脉冲），纯氛围。
  - MVP：用 `Graphics` 画简单多边形 / 渐变占位，程序化 tint，无需 PNG。
- **IP**：玄武岩柱 / 岩浆河为原创地貌形态，非管道 / 龟壳 / 火焰花符号。

---

## 3. 五层视差背景构成（火山 / 熔岩）

> 对齐现有 biome 的 5 层范式（天空 / 远景 / 中景 / 游戏层 / 前景，见 `art-bible.md` §5.1 与 `theme-framework.md` §2.1）。每层给出：内容 / 构成元素 / 运动·相位建议 / **Reduce Motion 冻结首帧要求（光敏安全 ≤3Hz）**。

**氛围意图（2-6 终章《熔心终焉》）**：冷蓝洞穴基调在终章被**熔金与炽红**取代——黑曜玄武岩、暗紫天幕、橙红熔岩裂隙、灰烬飘浮，靠**黑岩主色 + 暗紫天 + 橙黄熔岩辉光**制造"冷寂深渊 → 炽热引爆"的终章反差（对齐 `design/gdd/level-2-6-design.md` §2 叙事落点；对比草原明亮 / 洞穴幽暗 / 沙漠灼热 / 风暴蓝紫）。

**光照**：低环境光、自发光驱动（熔岩为唯一强光源）；熔岩区高饱和高明度，岩体压暗（art-bible §3.3：背景饱和 30–40%、明度 +10%）；任意前景（含发光顶缘）与相邻背景亮度对比 ≥3:1（关键交互 ≥4.5:1），黑岩平台靠**发光顶缘 + 1px 描边**保证分离。

### 3.1 五层明细

| 层 | parallax | 内容 | 构成元素（锁色板） | 运动 / 相位建议 | Reduce Motion / 光敏（≤3Hz） |
|---|---|---|---|---|---|
| **天空** | 0（scrollFactor 0） | 暗紫天幕 | `bg = #3F45A8`（暗紫，tint）；底部近地平线叠 `暖橙 #F2933C` 微辉（岩浆反射，≤2Hz 缓脉） | 静态渐变；底部微辉极缓呼吸（≤1.5Hz） | 微辉冻结首帧（静态渐变），不脉动 |
| **远景** | 0.3 | 火山口 / 远山剪影 | `灰烬灰 #6B5E55`（tint）剪影，无描边、低饱和；远处零星 `暖橙 #F2933C` 裂隙红光（≤2Hz） | 静态 / 极慢漂移；裂隙红光极缓闪（≤2Hz） | 裂隙红光停闪，固定首帧 |
| **中景** | 0.6 | 玄武岩柱 / 岩浆河 / 间歇泉 | `玄武岩黑 #2A1A12` 岩柱 + `灰烬灰` 暗面；`熔岩橙红 #F2933C` + `灼热黄 #FFD23F` 岩浆河与泉眼 | 岩浆河水平缓流（相位偏移，≤2Hz）；间歇泉脉冲上喷（≤2Hz）；灰烬粒子缓升 | 岩浆河停流（冻结首帧）；间歇泉停喷；灰烬粒子密度减半 / 停 |
| **游戏层** | 1.0 | 玄武岩平台 / 裂隙 / 敌 / 道具 / 主角 | `rockFace #2A1A12` 平台 + 顶缘 `暖橙/#FFD23F` 发光边；`deco_crack` 地表裂隙；敌/道具沿用各自锁色板映射（§4） | 平台静态；`deco_crack` 裂隙辉光 ≤2Hz 呼吸 | 裂隙辉光冻结首帧（不呼吸）；其余静态不变 |
| **前景** | 1.2（克制，遮挡 ≤10%） | 偶尔玄武岩柱 / 掠过火星 | `玄武岩黑` 焦土柱 + `蒸汽天蓝 #5BC8F5` / `灼热黄` 火星微光 | 极偶尔焦土柱掠过；火星粒子短拖尾上升（≤3Hz 生成） | 火星粒子停生成 / 密度减半；焦土柱静止 |

**大气叠层（depth 5，可选）**：灰烬幕 `灰烬灰 #6B5E55` alpha ≤0.12 全屏轻叠 + 底部热浪扭曲（横向微偏移正弦，tween 驱动）。**Reduce Motion 下停热浪扭曲、灰烬幕转静态低 alpha。**

### 3.2 光敏安全红线（全层统一）

- 所有脉动 / 闪烁频率 **< 3Hz**（岩浆河 / 裂隙 / 间歇泉 / 天空微辉均 ≤2Hz）。
- 单次高亮 ≤0.2s、不连续 >1s；无全屏高频闪。
- **Reduce Motion 开关开启**：所有动态（岩浆流 / 间歇泉 / 灰烬 / 火星 / 裂隙呼吸 / 热浪）**冻结首帧或密度减半**，仅保留静态构图（对齐 art-bible §9.3 / accessibility.md Basic·Standard）。

---

## 4. 障碍矩阵：主题键 `volcano` 的四类敌换皮

> **仅换皮、不改任何投掷 / 碰撞 / 可踩语义**。四类敌（gu_bao / ci_li / du_fu / shi_pao）的几何、行为、判定沿用各自 GDD 与原 biome-spec；本节只定义火山主题下的**视觉重着色 / 重纹理**。配色全部锁色板内（§0），形状 + 颜色双编码，色盲安全。

| 敌 | 原剪影 / 语义（沿用，不改） | volcano 换皮（仅视觉） | 主色（锁色板） | 可踩 |
|---|---|---|---|---|
| **gu_bao** 鼓苞 | 地面升起的垂直膨胀苞 + 顶刺；ACTIVE 硬顶（刺）/ RETRACTING 软顶可踩（苞顶转暖黄 = 可踩窗口双编码） | 岩浆苞：玄武岩黑苞体 + 橙红裂隙纹理；顶刺 = 警示红 / 暖橙岩刺；RETRACTING 软顶转灼热黄 `#FFD23F` 发光环（可踩窗口双编码，同 cave） | 苞体 `#2A1A12` + 裂隙 `#F2933C` + 顶刺 `#E8483B` + 软顶 `#FFD23F` | **同原语义**（硬/软随态） |
| **ci_li** 刺栗 | 圆球 + 周身短刺，soft 顶可踩 | 火山弹：玄武岩黑球 + 橙红裂隙 + 警示红短刺；圆球 + 侧刺形状不变（色盲靠圆+刺识别） | 主体 `#2A1A12` + 裂隙 `#F2933C` + 刺 `#E8483B` | **同（soft 顶可踩）** |
| **du_fu** 嘟浮 | 扁圆 + 双翅，蓝紫，soft 顶可踩（飞行正弦） | 浮灰精：保持蓝紫 `#6E7BF2` 主体（跨关辨识一致性）+ 暖黄 `#FFD23F` 肚皮斑（暗背景下强反差，同 storm/sea 做法）+ 翅膜灰烬灰 `#6B5E55` 半透 | 主体 `#6E7BF2` + 肚皮 `#FFD23F` + 翅 `#6B5E55`(tint) | **同（soft 顶可踩）** |
| **shi_pao** 石炮 | 方正石块 + 炮口，冷蓝石身，hard 顶不可踩（定点发射） | 熔岩炮：玄武岩黑方块 + 橙红发光炮口（`#F2933C`/`#E8483B` 描边闪）；方硬轮廓 + 红炮口 + 描边维持辨识（同 storm §4.3） | 石身 `#2A1A12` + 炮口 `#F2933C`/`#E8483B` + 弹丸 `#E8483B`+`#FFD23F` 拖尾 | **同（hard 顶不可踩）** |

### 4.1 换皮一致性要点

- **形状优先**：四类敌剪影（垂直苞 / 圆球 / 扁圆+翅 / 方块+炮口）在火山下**完全不变**，仅重着色 + 加火山纹理（裂隙 / 发光口）；颜色为辅、形状为主，色盲安全。
- **跨关辨识**：du_fu 保持蓝紫主体（全局敌身份），仅加暖黄肚皮斑；gu_bao / ci_li / shi_pao 的"黑岩 + 橙裂 / 红刺 / 红口"是火山专属皮肤，不改变任何判定盒。
- **危险双编码**：所有不可踩 / 危害部位（gu_bao 刺、ci_li 刺、shi_pao 炮口、最热岩浆）一律 警示红 `#E8483B` + 尖角形状，绝不靠单色。
- **IP**：火山弹 / 熔岩炮 / 浮灰精为原创岩石·熔岩形态，非龟壳 / 火焰花 / 星符号。

### 4.2 后续像素化路径（AI 生成提示词预留）

- **volcano tile**：`pixel art tile, 32x32, black basalt rock face #2A1A12, 1-2px glowing lava-orange #F2933C top edge with warm yellow #FFD23F core, no outline needed (self-dark), flat toon, volcanic`
- **gu_bao magma pod**：`pixel art, 32px grid, vertical basalt magma pod #2A1A12 with orange #F2933C cracks, red #E8483B top spikes, warm yellow #FFD23F soft-top when retracting, no face`
- **ci_li volcanic bomb**：`pixel art, round black basalt ball #2A1A12, orange #F2933C cracks, red #E8483B short spikes, stompable top`
- **shi_pao magma cannon**：`pixel art, square black basalt block #2A1A12, glowing orange #F2933C cannon mouth with red #E8483B rim, no Nintendo symbols`
- **deco_lava_river**：`pixel art, horizontal lava river, orange #F2933C with warm yellow #FFD23F highlight and dark #79491E cracks, flowing`

---

## 5. 五层背景占位资产方案（程序化占位 · 待真美术替换）

> **占位，待真美术替换。** 本期按 ADR-004 走 **Graphics 程序化占位**（纯色 / 简单渐变，无 PNG 上线）；下列 PNG/JPG 为**真美术替换对照清单**——真美术后续按此命名 / 尺寸交付，工程在 `THEME_PALETTES['volcano']` 就绪后一键替换。所有占位仅用 §0 的 11 色 / tint，0 新增 hex。

| 层 | 文件（建议） | 格式 | 建议尺寸 | 内容 / 配色（占位） | 透明 |
|---|---|---|---|---|---|
| 天空 | `art/volcano/volcano-sky-v1.jpg` | JPG | 512×288 | 暗紫渐变 `#3F45A8`(顶)→`#2A1A12`(底)，底部叠暖橙微辉 | 否 |
| 远景 | `art/volcano/volcano-backdrop-v1.png` | PNG | 512×288 | 火山口剪影 `灰烬灰 #6B5E55`，远裂隙红光点 | 是（剪影外透明） |
| 中景 | `art/volcano/volcano-mid-v1.png` | PNG | 512×288 | 玄武岩柱 `#2A1A12`+灰烬灰暗面、岩浆河橙红带 | 是 |
| 游戏层瓦片 | `art/volcano/volcano-tile-solid-v1.png` | PNG | 32×32（瓦片） | solid：玄武岩黑面 + 顶缘橙红/黄发光边 | 否 |
| 游戏层瓦片 | `art/volcano/volcano-tile-oneway-v1.png` | PNG | 32×32（瓦片） | oneway：玄武岩黑 + 暖黄单向指示边 | 否 |
| 前景 | `art/volcano/volcano-foreground-v1.png` | PNG | 512×288 | 偶尔焦土柱 `#2A1A12` + 火星微光，遮挡 ≤10% | 是 |
| 大气（可选） | `art/volcano/volcano-ash-overlay-v1.png` | PNG | 512×288 | 灰烬幕 `灰烬灰` alpha≤0.12 噪声 | 是 |

**游戏层瓦片火山配色建议（solid / oneway）**
- **solid**：`ground_top` = 玄武岩黑 `#2A1A12` 填充 + 顶 1–2px `熔岩橙红 #F2933C` 发光边 + 内 1px `灼热黄 #FFD23F` 高光（standability 信号）；`ground_fill` = 同黑 / 冷下体 tint `#1E3050`。
- **oneway**：玄武岩黑 + 单向 `灼热黄 #FFD23F` 指示边（明确"可从下穿 / 单向站"），其余同 solid。
- **interactive_block（✦ 互动块）**：玄武岩黑底 + `熔岩橙红` 外发光 + 中心"✦"（互动语义不变，仅换皮）。

> 命名遵循 art-bible §2.5（`{类别}_{名称}_{状态}_{序号}.png`）；占位期由 Graphics 直绘，无需实际落盘这些 PNG；真美术替换时按上表交付即可。

---

## 6. 可访问性（对齐 Standard 分级）

> 目标档位 **Standard**（见 `art/accessibility.md` §2.2 / §4）：色盲双编码内建 + 色盲辅助开关 + 减少动态开关 + 文字尺寸达标 + 防光敏硬底线。本 biome 严格守此档。

- **主题色相区分（不撞色）**：grass=草绿、cave/sea=冷蓝、storm=蓝紫、desert=暖橙沙、vine=草绿——**volcano = 玄武岩黑地面 `#2A1A12` + 暗紫天空 `#3F45A8` + 橙黄熔岩辉光**，黑岩+紫天+橙熔岩的组合全 biome 唯一；色盲玩家靠**地面 hue（近黑玄武岩）+ 顶缘发光边形态 + 装饰形态（岩柱/岩浆河）**即可分辨。
- **双编码**：平台可站立 = 顶缘发光边（形状+发光）；危险 = 警示红 + 尖角；熔岩裂隙 = 发光 + 地形暗示；均不靠单色。
- **敌种反差**：黑岩背景下 du_fu 加暖黄肚皮斑、ci_li/gu_bao 红刺、shi_pao 红炮口，靠描边 + 功能色维持辨识（§4）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"；熔岩脉动 / 间歇泉 / 火星 ≤3Hz（防光敏）。
- **减少动态**：岩浆流 / 间歇泉 / 灰烬 / 火星 / 裂隙呼吸 / 热浪在"减少动态"开关下冻结首帧或密度减半（§3.2）。
- **防光敏硬底线**：全屏闪烁 <3Hz、单次日闪 ≤0.2s、半透明叠加（安全底线，Basic 即满足）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#2A1A12` / `#F2933C` / `#FFD23F` / `#6E7BF2` / `#4A78C0` / `#5BC8F5` / `#E8483B` / `#7CC242` / `#5FA82F` / `#F26D8B` / `#F2C94C` = **11 色**（锁色板全 11 色）。
- **派生 tint（0 新增）**：暗紫天空 `darken(#6E7BF2,0.3)`、灰烬灰 `lighten(#2A1A12,0.5)`、玄武岩冷下体 `darken(#4A78C0,0.6)`、熔岩暗裂 `darken(#F2933C,0.5)`，均由锁色板色运行时生成，**不计入新增 hex**。
- **全局沿用色**：同屏还含 `命粉 #F26D8B`（HUD 爱心）、`经济金 #F2C94C`（coin）——均属锁色板 #10/#11。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **越界 reconcile**：本 biome 严格守 11 色锁色板；提请主理人据 cave/vine/storm/sea/desert §7 既有 reconcile 结论更新 asset-spec §2 越界生产色（非本 biome 引入）。
- **与沙漠不撞色确认**：暖橙 `#F2933C` 在 desert 作 `rockFace` 地面主面；本 biome 暖橙仅作**熔岩辉光点缀**（非地面主面），地面主面改玄武岩黑 `#2A1A12`，故二者视觉主导 hue 全异，无撞色（详见 §0 决策说明）。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`｜`'vine_forest'`｜`'storm_sky'`｜`'sea'`｜`'desert'`｜**`'volcano'`（2-6，新增）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'volcano'`（fail-safe 回退 `'grass'`）。

### 8.2 火山区调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段，仅 add 一个 `volcano` entry。下表为注册数据（非代码）：

| 引擎字段 | volcano Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x3F45A8` | darken(#6E7BF2,0.3) tint，0 新增（暗紫天空） |
| `rockFace` | `0x2A1A12` | 玄武岩黑（描边 #1） |
| `rockBody` | `0x2A1A12` | 玄武岩黑（同 rockFace，有意复用） |
| `outline` | `0x2A1A12` | 描边 #1 |
| `firelight` | `0xF2933C` | 熔岩橙红 #2 |
| `crystalCore` | `0xFFD23F` | 灼热高光 #3 |
| `crystalGlow` | `0xF2933C` | 熔岩橙红 #2（辉光） |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（火山取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['volcano'].rockFace`(`#2A1A12`)；平台顶缘另绘 `crystalGlow`(`#F2933C`)+`crystalCore`(`#FFD23F`) 发光边（standability 信号） |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['volcano'].bg)`(`#3F45A8`) |
| 敌种占位（`enemy-view.ts` 分支） | 见 §4 锁色板映射；gu_bao 苞体=`rockFace`、裂隙=`crystalGlow`、顶刺=`danger`、软顶=`crystalCore`；ci_li 同；du_fu 主体=`0x6E7BF2`+肚皮=`crystalCore`；shi_pao 石身=`rockFace`、炮口=`crystalGlow`/`danger` |
| 装饰绘制 | `deco_crack`/`deco_lava_river`/`deco_pillar` 读 `crystalGlow`/`crystalCore`/`rockFace` + tint |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme` 增 `'volcano'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['volcano']` 的 8 字段。
- **火山映射**：bg=`#3F45A8`(tint)、rockFace=`#2A1A12`、rockBody=`#2A1A12`、outline=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#FFD23F`、crystalGlow=`#F2933C`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['volcano']`；平台顶缘发光边走新增绘制分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG（占位资产见 §5，待真美术替换）。

---

## 9. 与 design-strategist《2-6 关卡设计简报》对齐

> 对齐依据：`design/gdd/level-2-6-design.md`（《熔心终焉》2-6 关卡设计简报，文策渊）。本 biome-spec 为其"唯一美术新增依赖"（该简报附录 B 之 B1）。

- **主题键统一为 `volcano`**：简报 §9–§10 `metadata.theme="volcano"` 与本文件及 §8 契约一致（fail-safe 回退 `"grass"`）。✅
- **本关为 NEW 专属调色板，非复用任一份已有 biome 换皮**：简报问"确认复用哪份已建 biome 调色板作 reskin"——答：**都不复用**。因 `desert` 已占用暖橙 `#F2933C` 作地面主色，volcano 无法借 desert 调色板（会撞色）；其余 cave/sea/storm/vine 主色亦各异。故 volcano 是一份**独立新 biome-spec**（黑玄武岩地面 + 暗紫天 + 橙黄熔岩辉光），与砂/穴/风暴/海/藤全异。
- **"熔金 + 炽红"暖调落地说明**：简报 §2 叙事要求"冷蓝洞穴调色板被熔金与炽红取代"。本规格以**玄武岩黑 `#2A1A12` 为深渊冷调基底**（呼应前序 2-1/2-4/2-5 冷蓝洞穴），其上以 **熔岩橙红 `#F2933C`（熔金）+ 灼热黄 `#FFD23F`（高光）+ 警示红 `#E8483B`（炽红 hottest）** 的熔岩辉光层覆盖，使终章视觉读感由"冷寂"翻转为"炽热引爆"，与简报 §2 段 2 情绪落点一致。暖调 dominance 来自熔岩辉光，基底黑岩乃被覆盖的"旧深渊"。
- **熔岩仅视觉主题（红线对齐）**：简报 §1 红线"不引入任何新危险/碰撞（无 lava pit、无新 hazard 判定）"。本规格 §2 的 `deco_crack`/`deco_lava_river`/`deco_pillar` 均为 `deco_*` 非碰撞装饰层，碰撞仍由 `tiles[]` 决定；§4 四敌仅换皮、不改投掷/碰撞/可踩语义。exclusiveHazards=[]、terrainMechanics=[]、exclusiveEnemies=[]（纯换皮）。✅
- **节拍平台 ty=4 红线（已落到 §2）**：简报 §6 / 红线"节拍平台瓦片必须 ty=4（y=128，头顶之上），严禁 ty=5"。本规格 §2 已载明：volcano 节拍平台沿用玄武岩黑 + 顶缘熔岩发光边，且**视觉呈现须确保位于 ty=4 高度、顶缘发光边 ≥3:1 对比清晰**，与关卡侧红线一致。
- **四通用敌 type 键不变（已落到 §4）**：universalEnemies=[gu_bao, ci_li, du_fu, shi_pao]，仅火山换皮绘制；关卡数据仍写原 type 键，引擎 `resolveBiome()` 自动换皮（对齐简报附录 B 之 B6）。✅
- **色板供其引用**：简报所有视觉引用须引用本文件 §0 的 **11 色权威色板（以本文件为准）**，0 新增 hex；熔岩辉光 = 暖橙 `#F2933C`、灼热高光 = 暖黄 `#FFD23F`、岩黑 = `#2A1A12`、暗紫天空 = `#3F45A8`(tint)、灰烬灰 = `#6B5E55`(tint)。
- **可访问性**：简报须引用 Standard 档（§6），标注 2-6 达到 Standard（色盲双编码 + 减少动态 + 防光敏 ≤3Hz）。
- **⚠️ fail-safe 取舍（提请主理人 C-5 拍板）**：若本 sprint 不排期 volcano 调色板（简报附录 C-5），则 B3 的 `LevelTheme` 联合类型未含 `'volcano'`，未知 theme 回退 `'grass'` 换皮——终章将退化为草原绿换皮，失去"熔金炽红引爆"的 climax 体验。本规格已就绪、可立即排期 B1（`theme-palette.ts` 注册 `volcano` 8 槽），**建议本次 sprint 即排期**，避免终章打折。

---

## 附录 · 美术圣经增补段落（需合并进 `art/art-bible.md`）

> 以下段落应并入 `art/art-bible.md`，使 volcano 进入 biome 列表与关键色引用。合并位置：① §3.3 后增「火山」行；② §5.3 主题切换表增「火山」行；③ 文件头 biome 清单补 `volcano`。未自动修改原文件，待主理人审批后由 art-director 执行合并。

### A.1 并入 `art-bible.md` §3.3（明暗与饱和度策略）后 —— 火山关键色引用

> **火山 / 熔岩（volcano）关键色**：地面主面 = 玄武岩黑 `#2A1A12`（全 biome 唯一近黑地面）；熔岩辉光 = 暖橙 `#F2933C` + 灼热高光 `#FFD23F`；天空 = 暗紫 `#3F45A8`（蓝紫 `#6E7BF2` 暗化 tint，0 新增）；灰烬灰 `#6B5E55`（描边 tint，0 新增）。完整 11 色权威色板见 `art/volcano-biome-spec.md` §0（以该文件为准）。

### A.2 并入 `art/art-bible.md` §5.3（主题切换表）后 —— biome 列表增补

| 主题 | 主色倾向 | 关键元素 | 危险语言 |
|---|---|---|---|
| 火山 / 熔岩（volcano，2-6 终章） | 玄武岩黑 + 暗紫天 + 橙黄熔岩 | 岩浆河 / 玄武岩柱 / 灰烬 / 裂隙 | 最热岩浆 + 红刺（冷蓝=危险环境反差仍适用） |

> 切换时**保留 32px 网格与功能色语义不变**，仅换主色（玄武岩黑）与装饰元素（岩浆/岩柱/灰烬），保证玩家迁移零成本。

### A.3 并入 `art/art-bible.md` 文件头 biome 清单

> 现有 biome 清单（grass / mountain / sea / desert / home / street / office / cave / vine_forest / storm_sky / rain / silhouette）增补：**volcano（火山 / 熔岩，第二章终章 2-6）**。权威规格见 `art/volcano-biome-spec.md`。

---

*本文件为火山 / 熔岩 biome 美术规格（加法），第二章终章 2-6；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
