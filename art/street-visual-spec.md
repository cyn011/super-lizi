# 街（城市）主题视觉落实规格（street-visual-spec）

> 文档类型：视觉落实规格（加法扩展，衔接 `art/street-biome-spec.md` 的 §1/§3/§5/§8，供工程侧落地街道 1-x《街》背景与专属障碍 vehicle/manhole 皮肤）
> 作者：art-director（林绘澄）
> 上游依据：`art/street-biome-spec.md`（8 槽权威映射 + tint + vehicle/manhole 视觉）｜`art/home-visual-spec.md`（本规格结构镜像基线）｜`art/desert-visual-spec.md`（同结构参照）｜`art/cave-biome-spec.md` §2/§5/§6、`art/sea-visual-spec.md`（已 live 的 biome 规格，5 层背景与 hazard 几何写法）｜`src/game/render/theme-palette.ts`（既有 8 槽接口，街道调色板仅从其既有 hex / 锁色板 tint 取色）｜`design/gdd/theme-system.md` §4（street 行 + §4.2 专属元素速查：vehicle 大方块+前灯·manhole 圆盖+蒸汽）｜`src/game/scenes/game-scene.ts` 的 `drawDesertBackground`/`drawHomeBackground` 五层背景模式（街背景镜像其 5 层结构）
> 关联任务：roadmap 批次 3（街 street）｜评审强度：lean
> **红线**：锁色板 11 色，COLOR DELTA = 0 新增 hex（仅复用锁色板色 + 其 tint 派生）；ADR-004 零位图（纯 Graphics，绝不引入 PNG/JPG/SVG）；本文件**只写文档，不写/改任何 `.ts`、不 git commit**；theme 名严格 `street`；MVP 全程序化占位（Graphics）；IP 全原创、避任天堂符号。

---

## 0. 概览与权威色引用（红线基准）

本规格把 `street-biome-spec.md` 的视觉意图落成**工程可消费的程序化绘制规格**：五层街道背景画法、vehicle/manhole 绘制、减少动态处理、theme-palette 衔接。玩法/数值（vehicle 周期横穿 / manhole 喷发判定）由对应 GDD 与工程负责，本规格只定义"长什么样 + 怎么画"。

**零 PNG 声明**：本规格全部视觉效果经 Phaser `Graphics` 程序化绘制（ADR-004）；不引入任何 PNG/JPG/SVG；多主题切换 = 调色板数据切换 + 背景层参数变化 + 装饰绘制参数差异。包体增量 ≈ 0。`street` 属 `urban_indoor` 家族，冷灰城市 tint。

### 0.1 权威 11 色锁色板（全部引用，0 新增）

| # | 名 | Hex | 本规格用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 行道树/绿植（少用）/`crystalGlow` 同源极少 |
| 2 | 阴影绿 | `#5FA82F` | 绿植暗部 tint 源（可选） |
| 3 | 暖橙 | `#F2933C` | **路灯/招牌暖橙 / 井盖蒸汽** / `firelight` |
| 4 | 暖黄 | `#FFD23F` | 招牌暖光核心 / 窗光 / `crystalCore` |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享）/ `outline` |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，**本关不用于敌/障碍**，与生命色解耦） |
| 7 | 警示红 | `#E8483B` | 危险语义（车灯 / 井盖红边闪 / ci_li 等）/ `danger` |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 霓虹辉光 / `crystalGlow` |
| 10 | 环境冷蓝 | `#4A78C0` | **建筑/路面主面 / 车身 / 井盖面** / `rockFace` tint 源 |
| 11 | 天空 | `#5BC8F5` | 城市天空（压暗 tint 源）/ 车窗半透 |

### 0.2 本规格使用的 tint 派生（0 新增，且均派生自 theme-palette.ts 既有锁色板 hex）

> 全部街道派生色均由 `#4A78C0`（#10）/ `#5BC8F5`（#11）运行时 `darken/lighten` 生成，二者**字面已存在于 `theme-palette.ts` 现有 entry**（CAVE/SEA/STORM_SKY/VINE_FOREST），故 0 新增 hex。

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 城市天空 bg | `darken(#5BC8F5, 0.3)` ≈ `#408CAC` | 天空填充（阴沉压暗） | 0 新增（tint，源 #11） |
| 建筑主面 rockFace | `darken(#4A78C0, 0.35)` ≈ `#304E7D` | 楼宇/路面冷蓝灰 | 0 新增（tint，源 #10） |
| 路面暗面 rockBody | `darken(#4A78C0, 0.5)` ≈ `#254060` | 路面/建筑底/oneway | 0 新增（tint，源 #10；此 hex **字面已存在于** CAVE.rockBody / SEA.rockBody） |
| 远景建筑剪影 | `darken(#4A78C0, 0.4)` ≈ `#2C486F` | parallax 远层（无描边、低饱和） | 0 新增（tint，源 #10） |

### 0.3 内部分辨率 / 网格硬约束

`512×288` 内分辨率，32px 瓦片网格，`pixelArt: true`，整数缩放。所有 Graphics 绘制坐标按此基准；视差通过 `scrollFactor` 实现（天花板/后墙层 `scrollFactor=0`，远景 0.3，中景 0.6，游戏层 1.0，前景 1.2）。

### 0.4 与 desert / home 同构说明

本规格**结构 1:1 镜像 `home-visual-spec.md`**（其本身镜像 `desert-visual-spec.md`）：§0 概览 / §1 五层背景 / §2 专属元素几何 / §3 palette 契约 / §4 Reduce Motion+可访问性 / §5 工程接入点。五层 depth/scrollFactor 与 `drawDesertBackground`/`drawHomeBackground` 完全一致（墙-10 / far-9 / mid-8 / game0 / near4），仅街道主题填充参数；工程可复用同一套绘制骨架。

---

## 1. 街背景层程序化绘制规格（零 PNG · 全 Graphics）

> 街是**城市走廊**（侧视），无自然天空/水位线。用「天花板/后墙 + 远景楼影 + 中景路灯/招牌/行道树 + 路面 + 前景护栏/招牌悬挑」替代沙漠/海的「天空/远景/中景」户外语言，但**视差结构 1:1 镜像** `drawDesertBackground` 的五层（depth / scrollFactor 完全一致）。

### 1.1 图层架构（镜像 drawDesertBackground 五层结构 + street-biome-spec §5）

| 层 | depth / scrollFactor | 街道内容 | 配色（锁色板/tint） | 绘制 API 建议 |
|---|---|---|---|---|
| 天花板+后墙 | -10（scrollFactor 0） | 全屏压暗天空 `#408CAC` + 顶部悬构/后墙带（冷蓝灰） | bg `0x408CAC` → 顶 `rockBody #254060`（悬构带） | `fillGradientStyle` + `fillRect` |
| 远景 far | -9（scrollFactor 0.3） | 楼影剪影带 + 窗光点阵 | 剪影 `darken(#4A78C0,0.4)` ≈ `#2C486F` 无描边；窗光 `暖黄 #FFD23F` α 脉冲 | `fillRect`/`fillPoints` |
| 中景 mid | -8（scrollFactor 0.6） | 路灯 + 霓虹招牌 + 行道树（静态） + 灯晕/霓虹脉冲层 | `暖橙 #F2933C` 灯柱 / `蓝紫 #6E7BF2` 霓虹 + `暖黄 #FFD23F` 核心 / `草绿 #7CC242` 树 | `fillRoundedRect`/`fillCircle`/`fillRect` |
| 游戏层 game | 0（scrollFactor 1.0） | 路面/车辆/敌/障碍/道具/主角 + vehicle/manhole 绘制分支 | `rockFace #304E7D` / `rockBody #254060` / 描边 | `drawTerrain`（见 street-biome-spec §8.3） |
| 前景 near | 4（scrollFactor 1.2，克制） | 偶尔护栏掠过 / 招牌悬挑近景 | `环境冷蓝 #4A78C0` alpha ≤0.4 + 霓虹高光点 | 屏幕锚定飘带 `fillRect`/`fillPath` |

> 中景路灯脉冲 + 霓虹脉冲（≤2Hz）与前景护栏/招牌悬挑为**每帧轻量重绘**；天花板/后墙、远景楼影/窗光、中景路灯/招牌/树本体为 **create 时一次绘制**，仅 scrollFactor 驱动视差滚动，运行时零重绘。灯晕/霓虹因需每帧重绘，建议拆到独立小 Graphics（见 §1.4 末"待 eng 确认"）。

### 1.2 天花板+后墙层（scrollFactor 0，depth -10）

- 用 `fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha)` 画全屏竖直渐变：
  - **顶部（悬构/后墙带）** `rockBody = #254060`（冷蓝灰，比天空略深，暗示头顶高架/建筑内侧受光少）；
  - **近地平线端（城市天空）** `bg = #408CAC`（压暗天空，street-biome-spec §1.2 权威）；
  - 单次 `fillRect(0, 0, camW, camH)` 即可，极廉价。悬构带约占顶部 `levelH*0.16`（≈ 46px，约 1.4 格）。
- 该层 `scrollFactor=0` 不随相机滚动；街**无天空/水位线之分**，全屏纯压暗冷调城市。
- 可选：悬构带与天空交界处一道 `rockBody` 加深线（`lineStyle(2, #254060)`）强化"顶/空"分界——纯氛围。

### 1.3 远景 far（parallax 0.3，depth -9）— 楼影剪影 + 窗光

- **楼影剪影带 `deco_building`（远）**：一条起伏带，颜色 `darken(#4A78C0,0.4)` ≈ `#2C486F`（tint 派生，0 新增），**无描边、低饱和**（对齐 art-bible §5.1「远景降饱和无描边」），与中景冷蓝灰楼宇拉开层次。剪影形态 = 高低错落矩形群（远楼天际线），`fillRect` 群，置于约 `levelH * 0.35` 起，纯氛围非碰撞。
- **窗光 `deco_window`（窗格点阵）**：中/远景楼宇窗格填 `暖黄 #FFD23F` α 呼吸（≤2Hz，防光敏），错落点阵（每栋楼 4–8 格）；`reduceMotion` 下冻结首帧（静态 α=0.85）。
- draw call：far ≈ 3（楼影群 1 + 窗光点阵 1 + 可选天际线 1），均 ≤15。

### 1.4 中景 mid（parallax 0.6，depth -8）— 路灯 + 霓虹招牌 + 行道树（静态）

- **路灯 `deco_lamp`**：
  - 灯柱：`firelight #F2933C` 细杆 + 底座（`fillRoundedRect` 宽 5、高 26 + 底椭圆）；
  - 灯头：`firelight #F2933C` 小圆头；
  - 灯晕（每帧脉冲，见 §4）：`crystalCore #FFD23F` α 呼吸 + 外扩圆；
  - 描边 `#2A1A12`（1px）。2–3 处错落（y ≈ `levelH*0.45`）。
- **霓虹招牌 `deco_sign`**：
  - 牌面：`crystalGlow #6E7BF2` 横矩形（霓虹辉光）+ `crystalCore #FFD23F` 核心细条（招牌字抽象）；
  - 霓虹脉冲（≤2Hz）：整体 α 呼吸（防光敏 <3Hz）；`reduceMotion` 下冻结首帧（静态 α=0.85）；
  - 描边 `#2A1A12`（1px）。1–2 处（贴前景楼宇面，x ≈ `levelW*0.35/0.7`）。
- **行道树 `deco_tree`（绿植点缀，少用）**：
  - 树冠：`crystalGlow #7CC242` 团（`fillCircle` 簇，3 枚 r 6–10）+ `darken(#7CC242,0.5)` ≈ `#3E6121` 暗部侧；
  - 树干：`rockBody #254060` 短柱；
  - 描边 `#2A1A12`（1px）。1–2 处（与路灯/招牌错开，y ≈ `levelH*0.55` 贴"地脚"）。
- 中景 create 时一次绘制（路灯柱/头、招牌牌面、树本体）；**路灯灯晕 + 霓虹脉冲因每帧重绘，建议拆到独立小 Graphics `streetGlowGfx`（scrollFactor 0.6, depth -8 同层）每帧重绘仅灯晕/霓虹，柱/牌面/树仍 create-once** —— **待 eng 确认**拆层方案。
- draw call：mid 静态（路灯×2 + 招牌×2 + 树×1）≈ 5，均 ≤15。

### 1.5 前景 near（parallax 1.2，depth 4，克制）— 偶尔护栏掠过 / 招牌悬挑

- **护栏 `deco_guardrail`**：近景偶尔掠过的半透冷蓝护栏/广告条，营造街景流动；屏幕锚定（随相机 1.2 视差），相位偏移 `fillRect` 横条。
  - 画法：维护 `nearPhase`；`g.clear()` → `fillStyle(#4A78C0, 0.25–0.4)` → `fillRect` 1–2 条横栏（高 ~6–10px）+ 数枚 `crystalGlow #6E7BF2` α≤0.3 霓虹高光点；
  - **周期性出现，非持续**：用 `sin(nearPhase * 0.2) > 0.6` 门控，仅约 30% 时间可见，其余时间透明（克制遮挡）；
  - 遮挡 ≤10% 路径，仅屏幕侧缘掠过，不挡关键平台/主角。
- **减少动态**：Reduce Motion 下 `nearPhase` 不推进（冻结首帧），护栏成静态横条（见 §4）。
- draw call：near 1 次（`fillRect` 单 path + 点）。

### 1.6 性能预算

每层总 draw call ≤ 15（墙 1 + far ≈3 + mid 静态 ≈5 + near 1 + 游戏层地形按 tile 数），远低于移动端阈值。每帧仅 near 护栏 + 灯晕/霓虹脉冲（独立层）轻量重绘 ≈ 0.1ms，可忽略；far/mid/墙 create 时一次绘制，仅 scrollFactor 驱动视差滚动，运行时零重绘。

### 1.7 工程接入点（drawLevel 分派，镜像 home/desert）

> 以下为**实现指引（非本规格写码）**，供 engineering-lead 落地 `game-scene.ts`；详见 §5。

- `drawLevel()` 内新增 `const isStreet = this.runtime.data.metadata.theme === 'street';`
- 背景分派（镜像 desert/home 1347/1349 模式）：
  - 现有 `if (!isSea && !isDesert && !isHome && pal.bg !== null)` 平铺分支**须扩展为** `if (!isSea && !isDesert && !isHome && !isStreet && pal.bg !== null)` —— 否则 street 的 `bg=#408CAC`（非 null）会先被铺满再被 `drawStreetBackground` 覆盖，造成双重填充/闪烁。**（关键接入点）**
  - 新增 `if (isStreet) this.drawStreetBackground(pal);`（镜像 `drawDesertBackground`）。
- 切换清理（镜像 1321 的 `!isDesert` 块）：新增 `if (!isStreet) { 销毁 streetCeilWallGfx/streetFarGfx/streetMidGfx/streetGlowGfx/streetNearGfx; }`，避免切关残留。
- 5 个 Graphics 句柄命名（镜像 desert 的 `desert*Gfx`）：`streetCeilWallGfx`(0,-10) / `streetFarGfx`(0.3,-9) / `streetMidGfx`(0.6,-8) / `streetGlowGfx`(0.6,-8,每帧) / `streetNearGfx`(1.2,4,每帧)。

---

## 2. 专属障碍视图占位几何（vehicle / manhole）

> 权威定义见 street-biome-spec §3；本节约为工程可消费的绘制伪代码级描述（对齐 `drawScorpion`/`drawCactus` 写法）。碰撞盒与各自类型一致（`vehicle` 不可踩移动块、`manhole` 可变可踩圆盖），仅外观换皮；几何读 `EnemyAI.getBounds()` 或障碍 AABB，单一真相源，与碰撞盒一致。**两者均禁用命粉 `#F26D8B`。**

### 2.1 `vehicle` 移动车辆（周期横穿 / 不可踩 / hard 顶 / 环境冷蓝+警示红）

| 部位 | 几何（bbox 48×32，anchor 底中贴地） | 配色（锁色板） | 危害 | 可踩 |
|---|---|---|---|---|
| 车身 | 大方块 `fillRoundedRect(b.x, b.y, 48, 28, {tl:6,tr:6,bl:4,br:4})` | `环境冷蓝 #4A78C0` (#10) | 否（致命） | 否（hard 顶） |
| 暗部 | 车身底/右侧暗带 | `darken(#4A78C0,0.5)` ≈ `#254060` (tint) | 否 | — |
| 车窗 | 半透小矩形 | `天空 #5BC8F5` (#11) α≤0.6 | 否 | — |
| 车轮 | 2 圆 `fillCircle` | `描边 #2A1A12` + 暗面 `#254060` | 否 | — |
| 前灯（致命） | 前缘小三角 `fillTriangle` | `警示红 #E8483B` (#7) α 闪 ≤2Hz | 致命 telegraph | — |
| 描边 | 全身 `lineStyle(1, #2A1A12)` | `#2A1A12` (#5) | — | — |

**双编码（hard 顶 = 不可踩）**：冷蓝大方块 + 警示红灯 = "硬顶不可踩"形状语言（与 cactus 红刺、scorpion 红尾同源）；车身与 street bg/rockBody 同冷色系，靠 `描边 #2A1A12` + 红前灯 + 方硬轮廓 + 多置于 `#408CAC` 天空前维持辨识（同 storm_sky §4.3 石炮方案）。

**动画 / telegraph（patrol 横穿）**：
- `patrol`：x 水平往返（由 AI 驱动，非渲染），整体保持方块形态；前灯 `headPhase` 红灯闪烁（≤2Hz）作致命 telegraph。
- 渲染仅供视觉的微动（≤12fps 节奏，防光敏 <3Hz）；**Reduce Motion 下 `headPhase` 冻结首帧（静态红灯 α=1.0，无闪烁），但 patrol 位移为玩法不冻结**。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: 48×32，anchor 底中贴地；dir 由障碍状态机提供（facing）
const cx = b.x + b.w / 2
const BODY = 0x4A78C0, DARK = 0x254060, OUT = 0x2A1A12
const WIN  = 0x5BC8F5, LAMP = 0xE8483B   // 禁用品红 #F26D8B
// 1) 车身（大方块）
g.fillStyle(BODY, 1); g.fillRoundedRect(b.x, b.y, 48, 28, {tl:6,tr:6,bl:4,br:4})
g.lineStyle(1, OUT, 1); g.strokeRoundedRect(b.x, b.y, 48, 28, {tl:6,tr:6,bl:4,br:4})
// 2) 暗部（底带）
g.fillStyle(DARK, 1); g.fillRect(b.x+2, b.y+20, 44, 8)
// 3) 车窗（半透天空蓝）
g.fillStyle(WIN, 0.6); g.fillRect(b.x+8, b.y+6, 16, 10)
g.lineStyle(1, OUT, 0.6); g.strokeRect(b.x+8, b.y+6, 16, 10)
// 4) 车轮（×2）
g.fillStyle(OUT, 1); g.fillCircle(b.x+12, b.y+30, 5); g.fillCircle(b.x+36, b.y+30, 5)
g.fillStyle(DARK, 1); g.fillCircle(b.x+12, b.y+30, 3); g.fillCircle(b.x+36, b.y+30, 3)
// 5) 前灯（前缘，致命，红灯闪烁 ≤2Hz）
const fx = dir > 0 ? b.x + 48 : b.x
const lampA = reduceMotion ? 1.0 : (0.7 + 0.3 * Math.sin(headPhase))   // ≤2Hz
g.fillStyle(LAMP, lampA)
g.fillTriangle(fx, b.y+8, fx, b.y+20, fx + dir*6, b.y+14)
// 硬顶 = 方硬顶 + 红灯 = 不可踩（双编码）
```

> 入绘制分支：`if (o.type === 'vehicle') { drawVehicle(g, o); return; }`（建议加 `street-obstacle-view.ts`，与 cactus 同族静态/移动障碍写法）。

### 2.2 `manhole` 井盖（地面圆盖 / 周期喷蒸汽 / 可变可踩）

| 部位 | 几何（bbox 圆形盖，直径≈ b.w，贴地） | 配色（锁色板） | 危害 | 可踩 |
|---|---|---|---|---|
| 盖体 | 地面圆盖 `fillCircle` + `strokeCircle` | `环境冷蓝 #4A78C0` (#10) 面 + `描边 #2A1A12` (#5) 环 | 否（静止） | 静止=✅ / 喷发=❌ |
| 格栅纹 | 盖面细线 `lineBetween` | `描边 #2A1A12` (#5) α≤0.6 | 否 | — |
| 蒸汽（周期） | 暖橙半透 blob 向上喷发（盖上方危险区） | `暖橙 #F2933C` (#3) α 呼吸 ≤3Hz | 喷发期致命 | 喷发期不可踩 |
| 危险边闪（开启期） | 盖缘 `strokeCircle` 红闪 | `警示红 #E8483B` (#7) α 闪 ≤3Hz | telegraph | — |

**双编码（状态 telegraph）**：静止 = 平盖可踩；喷发期 = 暖橙蒸汽柱 + 红边闪 = "危险不可踩"形状+颜色双编码（对齐 cactus/scorpion 红语义，但可踩态随周期切换）。**禁用命粉 `#F26D8B`。**

**动画 / telegraph（周期喷发）**：
- 周期：静止期（可踩）→ 喷发期（蒸汽柱上升 + 红边闪，危险区在盖上方）；蒸汽相位 `steamPhase` 推进（≤3Hz），`reduceMotion` 下冻结首帧（静态半透蒸汽 + 静态红边 α=0.5，无闪烁）。
- 危险区：喷发期在盖上方形成半透暖橙危险区（贴形状的圆形/椭圆区域），经碰撞盒/GDD 判定不可踩。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: 圆形盖，直径 = b.w，anchor 贴地（圆心 cy = b.y + b.h）
const cx = b.x + b.w / 2, cy = b.y + b.h, r = b.w / 2
const COVER = 0x4A78C0, OUT = 0x2A1A12
const STEAM = 0xF2933C, DANG = 0xE8483B   // 禁用品红 #F26D8B
// 1) 盖体圆面
g.fillStyle(COVER, 1); g.fillCircle(cx, cy, r)
g.lineStyle(2, OUT, 1); g.strokeCircle(cx, cy, r)
// 2) 格栅纹（盖面细线）
g.lineStyle(1, OUT, 0.6)
for i in -1..1: g.lineBetween(cx - r, cy + i*4, cx + r, cy + i*4)
// 3) 蒸汽（周期，暖橙半透 blob 向上喷发；喷发期红边闪 telegraph）
const active = steamPhase < STEAM_DURATION      // 喷发期标志（由障碍状态机给）
if (active) {
  const sa = reduceMotion ? 0.5 : (0.3 + 0.3 * Math.sin(steamPhase))   // ≤3Hz
  g.fillStyle(STEAM, sa)
  for k in 0..2: g.fillCircle(cx + Math.sin(steamPhase + k) * 4,
                              cy - 6 - k * 10, 6 - k * 1.5)
  const edgeA = reduceMotion ? 0.5 : (0.4 + 0.4 * Math.sin(steamPhase * 1.5))
  g.lineStyle(1, DANG, edgeA); g.strokeCircle(cx, cy, r)   // 红边闪 = 危险 telegraph
}
// 静止可踩 / 喷发不可踩：视觉状态明确（蒸汽 + 红闪 = 危险）
```

> 入绘制分支：`if (o.type === 'manhole') { drawManhole(g, o); return; }`（建议加 `street-obstacle-view.ts`；蒸汽/红边为每帧 overlay，GDD 负责喷发期不可踩判定，本规格只定义视觉）。

### 2.3 与既有敌/元素剪影区分（色盲安全）

- **vehicle**：冷蓝大方块 + 红前灯，区别于 4 旧敌（圆/楔/扁/方）+ gu_bao（暖橙苞+顶刺）/jellyfish（半透天空蓝）/scorpion（暖橙长条+红尾）/cactus（草绿柱+红刺）。vehicle 以「冷蓝方块 + 车轮 + 红灯」剪影唯一，避用命粉（与生命色解耦）。
- **manhole**：环境冷蓝圆盖 + 周期暖橙蒸汽 + 红边闪，区别于 cactus（草绿大柱）/ 普通路面。可踩态随周期切换，靠蒸汽+红闪 telegraph。
- 两者均靠**形状 + 颜色双编码**（红灯/红边闪 = 危险；平盖 = 可踩），不依赖单色，色盲安全。

---

## 3. street 8 槽 palette 契约（STREET 常量 · 证明 0 新增 hex）

> 直接复制 `street-biome-spec.md` §8.2 权威映射，供 eng 注册到 `THEME_PALETTES['street']`。本规格不写 `src/`。**每个槽位均标注取自 `theme-palette.ts` 既有 hex / 锁色板 #N，证明 0 新增。**

### 3.1 STREET 注册表（解析器应消费的颜色常量名 + hex 映射 + 来源证明）

| 引擎字段 | STREET Hex | 取自 theme-palette.ts 既有 hex / 锁色板 | 0 新增证明 |
|---|---|---|---|
| `bg` | `0x408CAC` | `darken(#5BC8F5, 0.3)` 派生；**源 `#5BC8F5`（锁色板 #11）字面已存在于** SEA.bg / VINE_FOREST.bg / STORM_SKY.crystalGlow / CAVE 注释 | tint 派生（源锁色板 #11），0 新增 |
| `rockFace` | `0x304E7D` | `darken(#4A78C0, 0.35)` 派生；**源 `#4A78C0`（锁色板 #10）字面已存在于** CAVE.rockFace / SEA.rockFace / STORM_SKY.rockBody | tint 派生（源锁色板 #10），0 新增 |
| `rockBody` | `0x254060` | `darken(#4A78C0, 0.5)` 派生；**此 hex 字面已存在于** CAVE.rockBody (`0x254060`) / SEA.rockBody (`0x254060`) | **既有 entry 已有 hex 直接复用**，0 新增 |
| `outline` | `0x2A1A12` | 描边（锁色板 #5），已存在于全部 entry | 锁色板 #5，0 新增 |
| `firelight` | `0xF2933C` | 暖橙（锁色板 #3），已存在于 GRASS/CAVE/SEA/DESERT/HOME/STORM_SKY/VINE_FOREST | 锁色板 #3，0 新增 |
| `crystalCore` | `0xFFD23F` | 暖黄（锁色板 #4），已存在于 CAVE/HOME/SEA/DESERT/STORM_SKY/VINE_FOREST | 锁色板 #4，0 新增 |
| `crystalGlow` | `0x6E7BF2` | 蓝紫（锁色板 #9），已存在于 CAVE.crystalGlow / VINE_FOREST.crystalGlow / STORM_SKY.rockFace | 锁色板 #9，0 新增 |
| `danger` | `0xE8483B` | 警示红（锁色板 #7），已存在于全部 entry | 锁色板 #7，0 新增 |

> **0 新增 hex 总证**：8 槽中，`rockBody` 为 `theme-palette.ts` 既有 entry 字面已有 hex（CAVE/SEA）；`outline/firelight/crystalCore/crystalGlow/danger` 为锁色板直引色（均字面存在于现有 entry）；`bg/rockFace` 为锁色板色 `#5BC8F5`/`#4A78C0` 的运行时 `darken` tint 派生（源色均字面存在于现有 entry）。**全 8 槽可追溯到 theme-palette.ts 既有 hex 或锁色板色 + 其 tint 派生，0 新增 hex。** 蓝紫 `#6E7BF2`（#9）亦作为霓虹常量在绘制分支直接引用（不进 palette 槽，已在锁色板内）。

### 3.2 fail-safe 回退

- 工程 `resolveBiome(theme)` 对未知/缺省 theme **回退 `grass`**（现有行为，street-biome-spec §8.1）；
- 若 `THEME_PALETTES['street']` 尚未注册，背景/地形自动走 grass 常量（现有硬编码棕），**不抛错、零回归**；
- `LevelData.metadata.theme` 增 `'street'`（联合类型 `'grass'|'cave'|'vine_forest'|'storm_sky'|'sea'|'desert'|'home'|'street'`），未知回退 `'grass'`；
- 本规格**不写 src**；street entry 由 engineering-lead 按 §3.1 注册。

### 3.3 消费点映射（工程落地指引，非本规格写码）

| 消费点 | street 取值 |
|---|---|
| `drawTerrain` 地面填充 | `THEME_PALETTES['street'].rockFace`(#304E7D) / `.rockBody`(#254060) |
| 背景色/天花板+后墙 | `setBackgroundColor(THEME_PALETTES['street'].bg)`(#408CAC)；渐变见 §1.2 |
| `vehicle` 分支（`street-obstacle-view.ts` 新增） | 车身=`环境冷蓝 #4A78C0`、暗部=`#254060`、前灯=`danger`(#E8483B)、车窗=`#5BC8F5`、描边=`outline`；**禁用品红 `#F26D8B`** |
| `manhole` 分支（`street-obstacle-view.ts` 新增） | 盖面=`环境冷蓝 #4A78C0`、蒸汽=`firelight`(#F2933C)、红边=`danger`(#E8483B)、描边=`outline`；**禁用品红 `#F26D8B`** |
| 装饰层（`drawStreetBackground`） | 楼影=`#2C486F`(tint)、窗光=`crystalCore`(#FFD23F)、路灯=`firelight`(#F2933C)、霓虹=`crystalGlow`(#6E7BF2)+`crystalCore`(#FFD23F)、行道树=`#7CC242`+`#254060`、护栏=`#4A78C0` |
| 4 旧敌/gu_bao 在蓝底关 | 沿用各自 biome 锁色板映射；靠 `outline` + 功能色维持辨识（同 street-biome-spec §4，du_fu 加 `暖黄 #FFD23F` 肚皮斑、shi_pao 石身=`#4A78C0`） |

---

## 4. Reduce Motion + 可访问性 Standard

### 4.1 减少动态（Reduce Motion）

> 来源：`platform.reduceMotion`（game-scene 已注入 `this.reduceMotion`，见 game-scene.ts:1312 附近）；对齐 street-biome-spec §6 / art-bible §9.3。街动态元素相位累加器在 Reduce Motion 下冻结首帧（≤3Hz 光敏安全）。

| 动态元素 | 正常行为 | Reduce Motion 处理 | 频率合规 |
|---|---|---|---|
| 窗光脉冲（远景） | 暖黄窗格 α 呼吸 ≤2Hz | 冻结首帧（静态 α=0.85，无呼吸） | ≤2Hz 正常亦合规 |
| 路灯灯晕（中景） | 暖黄灯晕 α 呼吸 + 外扩 ≤2Hz | 冻结首帧（静态灯晕 α=0.85，无缩放/呼吸） | ≤2Hz 正常亦合规 |
| 霓虹招牌（中景） | 蓝紫牌面 α 呼吸 ≤2Hz | 冻结首帧（静态 α=0.85，无呼吸） | ≤2Hz 正常亦合规 |
| 前景护栏/招牌悬挑（near） | `nearPhase` 推进，横栏飘移 | `nearPhase` 不推进，静态横栏（门控可见时保持首帧形态） | — |
| 车辆前灯（vehicle） | 红灯 `headPhase` 闪烁 ≤2Hz | `headPhase` 冻结（静态红灯 α=1.0，无闪烁）；**patrol 位移为玩法不冻结** | ≤2Hz 正常亦合规 |
| 井盖蒸汽（manhole） | 暖橙蒸汽 `steamPhase` 上升 + 红边闪 ≤3Hz | `steamPhase` 冻结（静态半透蒸汽 + 静态红边 α=0.5，无闪烁） | ≤3Hz 正常亦合规 |

- **统一机制**：所有街相位累加器（`windowPhase` / `lampPhase` / `neonPhase` / `nearPhase` / `headPhase` / `steamPhase`）在 `reduceMotion === true` 时不推进，渲染用首帧常量（对齐 desert 的 `sunPhase`/`veilPhase`、home 的 `lampPhase`/`windowPhase` 冻结写法）。
- **保留**：静态轮廓/暗色/红前灯/红边闪等全部保留 → 危险可读性与色盲安全不降级。

### 4.2 可访问性校验（Street · 目标档 Standard）

> 口径：art-bible §9 + `art/accessibility.md`（MVP 目标 = **Standard**；防光敏 / 最小热区为硬底线）。逐项检查街主题。

| # | 检查项 | 结论 | 说明 |
|---|---|---|---|
| 1 | 前景/背景对比（≥3:1，关键≥4.5:1） | ⚠️→✅ | 建筑主面 `#304E7D` vs 压暗天空 `#408CAC` 亮度约 **2.2:1**（冷同色系，偏低）；靠**强制 1px 描边 `#2A1A12`**（描边 vs 天空 ≈8:1）+ `rockBody` 暗面 `#254060` 兜底 → 平台顶缘边界 >4.5:1 达标。实体（车辆/敌）均有暗描边，与亮天空高对比。（同 sea 缓解） |
| 2 | 色盲安全（形状+色双编码） | ✅ | 地面 hue=冷蓝灰（街唯一「冷蓝灰建筑+压暗天空」组合）；vehicle=冷蓝方块+红前灯（hard 顶）、manhole=冷蓝圆盖+周期蒸汽/红边闪（状态 telegraph）——均形状+颜色双编码。危险=警示红+尖/硬形。 |
| 3 | 减少动态 / 静态 fallback | ✅ | 窗光/路灯/霓虹脉冲/护栏/车辆灯/蒸汽相位在 Reduce Motion 下冻结首帧（静态），对齐 §4.1。 |
| 4 | 防光敏（<3Hz，单闪≤0.2s） | ✅ | 窗光 ≤2Hz、路灯/霓虹 ≤2Hz、车辆灯 ≤2Hz、蒸汽/红边 ≤3Hz；无全屏高频闪。 |
| 5 | 最小可辨/可点尺寸 | ✅ | 实体≥32px（vehicle 48×32、manhole 直径≥32、敌≥32px）；UI 热区≥48×48（继承全局）。 |
| 6 | 非颜色状态提示 | ✅ | 受击=红闪+击退+无敌闪；踩怪=压扁+弹；vehicle=红前灯 telegraph；manhole=蒸汽+红边闪 telegraph（状态切换）。 |

**结论**：Street 主题可达 **Standard 档**（MVP 目标）。唯一注意项 = 压暗天空 `#408CAC` 与建筑主面 `#304E7D` 的亮度对比临界（≈2.2:1），**强制平台 1px 描边**即达标（与 cave/vine/storm/sea/desert/home 通用缓解一致）。全部零新增色，守 ADR-004。

### 4.3 与 cave / vine / storm / sea / desert / home 色相区分

| 主题 | 主色相 | 街区分点 |
|---|---|---|
| cave | 冷蓝灰+暗背景 | 街=压暗天空 `#408CAC` + 冷蓝灰楼宇 `#304E7D`（非洞穴暗蓝 `#1C2E49` bg）+ 暖橙路灯/蓝紫霓虹点缀 |
| vine_forest | 草绿 | 街=冷蓝灰主导，草绿仅行道树点缀（非满屏绿） |
| storm_sky | 蓝紫 | 街=冷蓝灰建筑+暖橙路灯（非冷紫风暴） |
| sea | 冷蓝天光+草绿 | 街=**压暗天空 `#408CAC`（非亮天空 `#5BC8F5`）+ 城市楼宇**（海无楼宇） |
| desert | 暖橙沙 | 街=冷蓝灰（非暖橙） |
| home | 暖橙木+暖棕墙 | 街=冷蓝灰城市（非室内暖调） |

> 街冷调（冷蓝灰建筑 + 压暗天空 + 暖橙路灯 + 蓝紫霓虹）在七主题中**色相唯一（纯都市冷调）**，色盲玩家靠建筑 hue + 路灯/霓虹形态即可分辨，不撞色。

---

## 5. 工程接入点提示（供 engineering 参考）

> 以下为**实现指引（非本规格写码）**，供 engineering-lead 落地 `game-scene.ts`；结构与 home/desert 同构。

1. **`drawLevel` 平铺分支排除 `isStreet`（防 bg 双重填充）**：
   - 现有平铺分支 `if (!isSea && !isDesert && !isHome && pal.bg !== null)` **须扩展为**
     `if (!isSea && !isDesert && !isHome && !isStreet && pal.bg !== null)`。
   - 否则 street 的 `bg=#408CAC`（非 null）会被先铺满再被 `drawStreetBackground` 覆盖，造成双重填充/闪烁。**（关键接入点）**

2. **`drawLevel` 分派 `drawStreetBackground`**：
   - 在 home/desert 分派之后新增：`if (isStreet) this.drawStreetBackground(pal);`（镜像 `drawDesertBackground` 签名 `drawStreetBackground(pal: ThemePalette)`）。
   - `pal` 来自 `biomeForLevel(this.runtime.data)`（已含 `THEME_PALETTES['street']`）。

3. **切关清理块**：
   - 镜像 desert/home 的 `!isDesert`/`!isHome` 清理块，新增 `if (!isStreet) { 销毁 streetCeilWallGfx / streetFarGfx / streetMidGfx / streetGlowGfx / streetNearGfx; }`，避免切关残留 Graphics。

4. **5 个 Graphics 句柄命名（镜像 desert 的 `desert*Gfx`）**：
   - `streetCeilWallGfx`(scrollFactor 0, depth -10) — 天花板+后墙（create-once）
   - `streetFarGfx`(scrollFactor 0.3, depth -9) — 楼影+窗光（create-once）
   - `streetMidGfx`(scrollFactor 0.6, depth -8) — 路灯/招牌/树本体（create-once）
   - `streetGlowGfx`(scrollFactor 0.6, depth -8, 每帧) — 路灯灯晕 + 霓虹脉冲（独立层每帧重绘）
   - `streetNearGfx`(scrollFactor 1.2, depth 4, 每帧) — 护栏/招牌悬挑（独立层每帧重绘）

5. **主题驱动系统纪律**：
   - 背景/地形按 `theme` 字段走 `THEME_PALETTES` 8 槽 + `drawStreetBackground` 分派；
   - 未知 theme 走 `resolveBiome` 回退 `grass`（不要破坏既有 fail-safe）；
   - 不引入任何 PNG/JPG/SVG（ADR-004），vehicle/manhole 全 Graphics 绘制。

6. **Reduce Motion 冻结**：
   - 所有街相位累加器（`windowPhase`/`lampPhase`/`neonPhase`/`nearPhase`/`headPhase`/`steamPhase`）在 `this.reduceMotion === true` 时停推进，渲染用首帧常量（见 §4.1）。

---

## 附：与 street-biome-spec 的交叉引用

- 本规格为 `street-biome-spec.md` 的**视觉落实扩展**：§1 背景层画法（五层）→ street-biome-spec §5（视差层级）；§2 专属障碍几何 → §3（vehicle/manhole）；§4 Reduce Motion+可访问性 → §6；§3 palette 衔接 → §1/§8；§4 可访问性 → §6。
- 实现须以 street-biome-spec 的 8 槽权威 hex + tint 为准；本规格不引入任何新 hex。
- 工程契约见 street-biome-spec §8；本规格 §3 为视觉侧对齐摘录。
- 结构镜像 `home-visual-spec.md`（§0 概览 / §1 五层背景 / §2 专属元素几何 / §3 palette / §4 Reduce Motion+可访问性 / §5 工程接入点），保证多主题视觉规格同构、工程可复用同一套绘制骨架。

---

## 待 eng / 主理人确认的开放点（汇总）

1. **`drawLevel` 背景分派排除 street**：现有 `if (!isSea && !isDesert && !isHome && pal.bg !== null)` 平铺分支须扩展为排除 `isStreet`，否则 street 的 `bg=#408CAC`（非 null）先被铺满再被 `drawStreetBackground` 覆盖，双重填充/闪烁。**关键接入点，需工程落地时处理（§1.7/§5）。**
2. **路灯灯晕 + 霓虹脉冲拆层**：需每帧重绘，但 `drawStreetBackground` 的 mid 是 create-once。建议拆独立 `streetGlowGfx`（scrollFactor 0.6, depth -8）每帧重绘灯晕/霓虹，柱/牌面/树仍 create-once。**待 eng 确认拆层方案（§1.4）。**
3. **vehicle/manhole 绘制分支归属**：建议加 `src/game/render/street-obstacle-view.ts`（与 cactus 同族静态/移动障碍），亦可走 `enemy-view.ts` 分支。**待 eng 确认。**
4. **manhole 喷发期不可踩判定**：蒸汽/红边为视觉 telegraph，喷发期不可踩由 GDD/物理模块据障碍状态机判定（本规格只定义视觉）。**待 eng 落地消费 `steamPhase`/`active` 标志。**
5. **冷同色系对比（§4.2 #1）**：天空 `#408CAC` 与建筑 `#304E7D` 对比 ≈2.2:1，依赖强制 1px 描边达标。若主理人认为需更强区分，可调整 `bg`/`rockFace` tint 明度（仍须 0 新增 hex，仅调 `darken` 系数）——**待主理人拍板是否调参。**
6. **行道树 `deco_tree` 密度**：street-biome-spec §0 标注绿植"少用"；本规格默认 1–2 处点缀，密度由主理人/工程拍板（避免与草绿主导主题撞色）。

> 本文件为街（城市）主题视觉落实规格（加法），roadmap 批次 3（街道 1-x）；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 street-biome-spec §8 契约 + 本规格 §1–§2 绘制参数）。

---

*偏离 theme-system.md §4.2 早期配色核查（回应任务红线）：street-biome-spec §3 与 theme-system §4.2 的 vehicle 配色均为**环境冷蓝 `#4A78C0` + 警示红 `#E8483B` 前灯**、manhole 配色均为**描边 `#2A1A12` + 暖橙 `#F2933C` 蒸汽**，**无任何偏离，未将 `#4A78C0` 替换为其他冷色**；上述 hex 全部在锁色板内（#10/#7/#5/#3），0 新增。theme-framework.md 早期草稿的自由 hex（如 `#1A202C`/`#2D3748`/`#3FC7B4` 等，R8 已标注不进实现）本规格一律未采用。*
