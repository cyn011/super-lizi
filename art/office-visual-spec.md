# 办公（室内）主题视觉落实规格（office-visual-spec）

> 文档类型：视觉落实规格（加法扩展，衔接 `art/office-biome-spec.md` 的 §1/§3/§5/§8，供工程侧落地办公 1-1…1-7《办公》背景与专属障碍 paper_pile / coffee_spill 皮肤）
> 作者：art-director（林绘澄）
> 上游依据：`art/office-biome-spec.md`（8 槽提案 + tint + 专属障碍视觉）｜`art/home-visual-spec.md`（**本规格结构镜像基线**）｜`art/street-visual-spec.md`（同结构参照，尤其 §3 逐字取既有 hex 写法）｜`art/cave-biome-spec.md` §2/§5/§6、`art/sea-visual-spec.md`（已 live 的 biome 规格，5 层背景与 hazard 几何写法）｜`src/game/render/theme-palette.ts`（**必读**：列出所有既有主题 entry 的 8 槽 hex，office 调色板只能从中取色/tint，0 新增 hex）｜`design/gdd/theme-system.md` §4（office 行 + §4.2 专属元素速查：paper_pile 文件堆、coffee_spill 咖啡渍）｜`src/game/scenes/game-scene.ts` 的 `drawDesertBackground` / `drawHomeBackground` / `drawStreetBackground` 五层背景模式（办公背景镜像其 5 层结构）
> 关联任务：roadmap 批次 3（办公 office）｜评审强度：lean
> **红线**：11 色锁色板，COLOR DELTA = 0 新增 hex（仅复用 `theme-palette.ts` 既有 hex / 锁色板色，派生暗面仅用**字面已存在于 entry** 的 tint hex）；ADR-004 零位图（纯 Graphics，绝不引入 PNG/JPG/SVG）；本文件**只写文档，不写/改任何 `.ts`、不 git commit**；theme 名严格 `office`；MVP 全程序化占位（Graphics）；IP 全原创、避任天堂符号。

---

## 0. 概览与权威色引用（红线基准）

本规格把 `office-biome-spec.md` 的视觉意图落成**工程可消费的程序化绘制规格**：办公五层背景画法、paper_pile / coffee_spill 绘制、减少动态处理、theme-palette 衔接。玩法/数值（paper_pile 可踩平台碰撞、coffee_spill 的 `low_friction` 局部覆盖）由对应 GDD 与工程负责，本规格只定义"长什么样 + 怎么画"。

**零 PNG 声明**：本规格全部视觉效果经 Phaser `Graphics` 程序化绘制（ADR-004）；不引入任何 PNG/JPG/SVG；多主题切换 = 调色板数据切换 + 背景层参数变化 + 装饰绘制参数差异。包体增量 ≈ 0。`office` 属 `urban_indoor` 家族，冷调办公 tint。

### 0.1 权威 11 色锁色板（全部引用，0 新增）

| # | 名 | Hex | 本规格用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 绿植（deco_plant）/ `crystalCore` |
| 2 | 阴影绿 | `#5FA82F` | 绿植暗部（**字面已存在于 VINE_FOREST.rockBody**，0 新增） |
| 3 | 暖橙 | `#F2933C` | 文件夹/窗框/显示器框/咖啡 crema / `firelight` |
| 4 | 暖黄 | `#FFD23F` | 荧光灯管/窗光晕/纸翻页高光 / `crystalCore` 同源复用 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享）/ `outline` |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，**本关不用于敌/障碍**，与生命色解耦） |
| 7 | 警示红 | `#E8483B` | 危险语义（咖啡渍低摩擦 telegraph）/ `danger` |
| 8 | 经济金 | `#F2C94C` | 文件堆纸面（paper_pile 主色）/ coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 显示器辉光（crystalGlow）/ 前景高光 |
| 10 | 环境冷蓝 | `#4A78C0` | **办公桌/柜体主面 / 冷调灰** / `rockFace` |
| 11 | 天空 | `#5BC8F5` | **荧光白天花板微光（bg）/ 窗内微光 / 湿反光** |

### 0.2 本规格使用的 hex（**全部字面已存在于 `theme-palette.ts` 既有 entry**，0 新增）

> 硬红线：本规格**不写任何未出现在 `theme-palette.ts` 既有 entry 的 hex**。下列全部为既有 entry 字面已有值（含既有 tint 派生色如 `#254060`/`#304E7D`/`#79491E`/`#5FA82F`/`#408CAC` 等），故 0 新增。

| Hex | 字面出处（theme-palette.ts 既有 entry） | 本规格用途 |
|---|---|---|
| `#5BC8F5` | VINE_FOREST.bg / SEA.bg / STORM_SKY.crystalGlow | 天花板微光 bg / 窗光 / 湿反光 |
| `#4A78C0` | CAVE.rockFace / SEA.rockFace / STORM_SKY.rockBody | 办公桌/柜体主面 rockFace / 前景冷蓝 |
| `#254060` | CAVE.rockBody / SEA.rockBody / STREET.rockBody | 柜体暗面 rockBody / 天花板带 / 远景隔断剪影 |
| `#2A1A12` | 全部 entry（outline） | 全局描边 |
| `#F2933C` | GRASS/CAVE/SEA/DESERT/HOME/STORM/VINE/STREET（firelight/rockFace） | 文件夹/窗框/显示器框/咖啡 crema |
| `#7CC242` | GRASS.crystalGlow / VINE.rockFace / DESERT.crystalCore / HOME.crystalGlow / SEA.crystalGlow | 绿植 crystalCore |
| `#6E7BF2` | CAVE.crystalGlow / VINE.crystalGlow / STORM.rockFace / STREET.crystalGlow | 显示器辉光 crystalGlow |
| `#E8483B` | 全部 entry（danger） | 咖啡渍低摩擦 telegraph |
| `#FFD23F` | CAVE.crystalCore / HOME.firelight / SEA.crystalCore / DESERT.firelight / STORM.crystalCore / VINE.crystalCore / STREET.crystalCore | 荧光灯/窗光/纸翻页 |
| `#F2C94C` | GRASS.crystalCore / DESERT.crystalGlow | 文件堆纸面（paper_pile） |
| `#79491E` | DESERT.rockBody / HOME.rockBody | 文件堆暗面 / 咖啡渍暗棕（字面已有 tint 派生） |
| `#304E7D` | STREET.rockFace | 咖啡渍渍面（冷调深渍，字面已有 tint 派生，备选） |
| `#5FA82F` | VINE_FOREST.rockBody | 绿植暗部（阴影绿，字面已有） |

> **偏离 `office-biome-spec.md` 提案的声明（红线驱动）**：`office-biome-spec.md` §1.2/§8.2 提案的 `bg = lighten(#5BC8F5,0.15) ≈ #74D0F7` 与 `rockFace = darken(#4A78C0,0.2) ≈ #3B609A` 为**新 hex，字面未出现在 `theme-palette.ts` 任何既有 entry**，违反本规格硬红线。本规格将其**偏离**为 `#5BC8F5`（bg）与 `#4A78C0`（rockFace），二者均字面存在于既有 entry，证明 0 新增。详见 §3.1 与文末偏离声明。

### 0.3 内部分辨率 / 网格硬约束

`512×288` 内分辨率，32px 瓦片网格，`pixelArt: true`，整数缩放。所有 Graphics 绘制坐标按此基准；视差通过 `scrollFactor` 实现（天花板/后墙层 `scrollFactor=0`，远景 0.3，中景 0.6，游戏层 1.0，前景 1.2）。

### 0.4 与 home / street 同构说明

本规格**结构 1:1 镜像 `home-visual-spec.md`**（其本身镜像 `desert-visual-spec.md`）：§0 概览 / §1 五层背景 / §2 专属元素几何 / §3 palette 契约 / §4 Reduce Motion+可访问性 / §5 工程接入点。五层 depth/scrollFactor 与 `drawDesertBackground`/`drawHomeBackground`/`drawStreetBackground` 完全一致（墙-10 / far-9 / mid-8 / game0 / near4），仅办公主题填充参数；工程可复用同一套绘制骨架。

---

## 1. 办公背景层程序化绘制规格（零 PNG · 全 Graphics）

> 办公是**室内办公区**（侧视），无自然天空/水位线。用「天花板+后墙 + 远景隔断+窗光 + 中景办公桌+显示器+绿植+荧光灯 + 地面 + 前景隔断悬挑/电线」替代沙漠/海的「天空/远景/中景」户外语言，但**视差结构 1:1 镜像** `drawDesertBackground` 的五层（depth / scrollFactor 完全一致）。

### 1.1 图层架构（镜像 drawDesertBackground 五层结构 + office-biome-spec §5）

| 层 | depth / scrollFactor | 办公内容 | 配色（锁色板/tint，均字面在文件内） | 绘制 API 建议 |
|---|---|---|---|---|
| 天花板+后墙 | -10（scrollFactor 0） | 全屏荧光白天花板 `#5BC8F5` + 顶部冷暗悬构带 `#254060` | bg `0x5BC8F5` → 顶 `rockBody #254060` | `fillGradientStyle` + `fillRect` |
| 远景 far | -9（scrollFactor 0.3） | 隔断剪影带 + 窗光点阵 | 剪影 `0x254060` 无描边；窗=`#5BC8F5` α≤0.5 + `#FFD23F` 光晕 | `fillRect`/`fillPoints` |
| 中景 mid | -8（scrollFactor 0.6） | 办公桌 + 显示器 + 绿植 + 荧光灯（静态） + 灯管/屏光脉冲层 | `冷蓝 #4A78C0` 桌面 / `蓝紫 #6E7BF2` 屏光 / `草绿 #7CC242` 绿植 / `暖黄 #FFD23F` 灯管 | `fillRoundedRect`/`fillCircle`/`fillRect` |
| 游戏层 game | 0（scrollFactor 1.0） | 桌柜地形/敌/障碍/道具/主角 + paper_pile/coffee_spill 绘制分支 | `rockFace #4A78C0` / `rockBody #254060` / 描边 | `drawTerrain`（见 §2 分支） |
| 前景 near | 4（scrollFactor 1.2，克制） | 偶尔隔断悬挑/电线掠过 | `环境冷蓝 #4A78C0` alpha ≤0.4 + 蓝紫 `#6E7BF2` 高光点 | 屏幕锚定飘带 `fillPath` |

> 中景荧光灯管微闪 + 屏光脉冲（≤2Hz）与前景电线/隔断为**每帧轻量重绘**；天花板/后墙、远景隔断/窗光、中景办公桌/显示器框/绿植本体为 **create 时一次绘制**，仅 scrollFactor 驱动视差滚动，运行时零重绘。灯管/屏光因需每帧重绘，建议拆到独立小 Graphics `officeGlowGfx`（见 §1.4 末"待 eng 确认"）。

### 1.2 天花板+后墙层（scrollFactor 0，depth -10）

- 用 `fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha)` 画全屏竖直渐变：
  - **顶部（天花板悬构带）** `rockBody = #254060`（冷暗，暗示头顶吊顶/架空受光少）；
  - **近地平线端（荧光白天花板）** `bg = #5BC8F5`（明亮荧光微光，office-biome-spec §1.2 权威"天花板微光"隐喻）；
  - 单次 `fillRect(0, 0, camW, camH)` 即可，极廉价。天花板带约占顶部 `levelH*0.16`（≈ 46px，约 1.4 格）。
- 该层 `scrollFactor=0` 不随相机滚动；办公**无天空/水位线**，全屏纯荧光冷调室内。
- 可选：天花板与墙交界处一道 `rockBody` 加深线（`lineStyle(2, #254060)`）强化"顶/壁"分界——纯氛围。
- 荧光灯管本体（静态长条）画于此层或 glow 层均可；闪烁见 §1.4 glow。

### 1.3 远景 far（parallax 0.3，depth -9）— 隔断剪影 + 窗光

- **隔断剪影带 `deco_partition`**：一条起伏带，颜色 `#254060`（字面已存在于 CAVE/SEA/STREET rockBody，0 新增），**无描边、低饱和**（对齐 art-bible §5.1「远景降饱和无描边」），与中景冷蓝办公桌拉开层次。剪影形态 = 高低错落隔断/文件柜天际线（`fillRect` 群或 `fillPoints` 折线，amp 10–16px / wl 160–220px），置于约 `levelH * 0.35` 起，纯氛围非碰撞。
  - **偏离 street 写法说明**：street-visual-spec §1.3 用 `darken(#4A78C0,0.4)` ≈ `#2C486F`（非文件内 hex）作远剪影；本规格严格守红线改用字面已有的 `#254060`。
- **窗光 `deco_window`**：后墙上 2–3 扇窗，每扇 = 窗格内填 `#5BC8F5` α≤0.5（"窗内微光"，与天空同源，art-bible §3.3 冷中藏暖），`暖橙 #F2933C` 细框（1px），窗内叠 `暖黄 #FFD23F` α≤0.3 光晕（+ 轻微脉冲，见 §4）。窗位错落（x ≈ `levelW*0.22 / 0.55 / 0.84`，y ≈ `levelH*0.3`，窗宽 ≈ 44、高 ≈ 56）。
- draw call：far ≈ 4（隔断带 1 + 窗×3），均 ≤15。

### 1.4 中景 mid（parallax 0.6，depth -8）— 办公桌 + 显示器 + 绿植 + 荧光灯（静态）

- **办公桌 `deco_desk`**：
  - 桌面：`rockFace #4A78C0` 圆角矩形（`fillRoundedRect` 宽 ≈ 46、高 ≈ 28，厚 3）+ `rockBody #254060` 暗带（底 1/4）；
  - 描边 `#2A1A12`（1px）。2–3 处错落（y ≈ `levelH*0.5`）。
- **显示器 `deco_monitor`**：
  - 边框：`firelight #F2933C` 矩形（宽 ≈ 26、高 ≈ 18）；
  - 屏底：`outline #2A1A12` 内矩（屏光脉冲见 glow）；
  - 描边 `#2A1A12`（1px）。1–2 处（贴前景办公桌，x ≈ `levelW*0.35/0.7`）。
- **绿植 `deco_plant`**：
  - 主体：`crystalCore #7CC242` 团（`fillCircle` 簇，3 枚 r 6–10）+ `阴影绿 #5FA82F`（字面 VINE_FOREST.rockBody，0 新增）暗部侧（右 1/3 涂暗）；
  - 描边 `#2A1A12`（1px）。2–3 处（与窗/桌错开，y ≈ `levelH*0.5` 贴"地脚"）。
  - **偏离 office-biome-spec 说明**：office-biome-spec §1.3 用 `darken(#7CC242,0.5)` ≈ `#3E6121`（非文件内）作绿植暗部；本规格改用字面已有的 `阴影绿 #5FA82F`，0 新增。
- **荧光灯 `deco_lamp`（灯架静态 + 灯管微闪）**：
  - 灯架：`rockFace #4A78C0` 细杆 + 底座；
  - 灯管：`firelight #FFD23F` 长条（微闪见 §4）；
  - 描边 `#2A1A12`（1px）。1–2 处（x ≈ `levelW*0.4`，y ≈ `levelH*0.18` 贴顶）。
- 中景 create 时一次绘制（桌/显示器框/绿植/灯架本体）；**灯管微闪 + 屏光脉冲因每帧重绘，建议拆到独立小 Graphics `officeGlowGfx`（scrollFactor 0.6, depth -8 同层）每帧重绘仅灯管/屏光，桌/显示器框/绿植/灯架仍 create-once** —— **待 eng 确认**拆层方案。
- draw call：mid 静态（桌×2 + 显示器×2 + 绿植×2 + 灯架×1）≈ 7，均 ≤15。

### 1.5 前景 near（parallax 1.2，depth 4，克制）— 偶尔隔断悬挑 / 电线掠过

- **隔断悬挑/电线 `deco_cable`**：近景偶尔掠过的半透冷蓝隔断悬挑/垂吊电线，营造办公区流动；屏幕锚定（随相机 1.2 视差），相位偏移 `fillPath` 斜悬挑/垂带。
  - 画法：维护 `nearPhase`；`g.clear()` → `fillStyle(#4A78C0, 0.25–0.4)` → `fillPoints` 一条横向悬挑/竖向电线（2–3 段折线拟线缆）+ 数枚 `crystalGlow #6E7BF2` α≤0.3 高光点；
  - **周期性出现，非持续**：用 `sin(nearPhase * 0.2) > 0.6` 门控，仅约 30% 时间可见，其余时间透明（克制遮挡）；
  - 遮挡 ≤10% 路径，仅屏幕侧缘掠过，不挡关键平台/主角。
- **减少动态**：Reduce Motion 下 `nearPhase` 不推进（冻结首帧），悬挑/电线成静态斜带（见 §4）。
- draw call：near 1 次（`fillPath` 单 path + 点）。

### 1.6 性能预算

每层总 draw call ≤ 15（墙 1 + far ≈4 + mid 静态 ≈7 + near 1 + 游戏层地形按 tile 数），远低于移动端阈值。每帧仅 near 悬挑/电线 + 灯管/屏光脉冲（独立层）轻量重绘 ≈ 0.1ms，可忽略；far/mid/墙 create 时一次绘制，仅 scrollFactor 驱动视差滚动，运行时零重绘。

### 1.7 工程接入点（drawLevel 分派，镜像 home/street/desert）

> 以下为**实现指引（非本规格写码）**，供 engineering-lead 落地 `game-scene.ts`；详见 §5。

- `drawLevel()` 内新增 `const isOffice = this.runtime.data.metadata.theme === 'office';`
- 背景分派（镜像 1347/1349 模式）：
  - 现有 `if (!isSea && !isDesert && !isHome && !isStreet && pal.bg !== null)` 平铺分支**须扩展为** `if (!isSea && !isDesert && !isHome && !isStreet && !isOffice && pal.bg !== null)` —— 否则 office 的 `bg=#5BC8F5`（非 null）会先被铺满再被 `drawOfficeBackground` 覆盖，造成双重填充/闪烁。**（关键接入点）**
  - 新增 `if (isOffice) this.drawOfficeBackground(pal);`（镜像 `drawDesertBackground`）。
- 切换清理（镜像 `!isDesert` 块）：新增 `if (!isOffice) { 销毁 officeWallGfx/officeFarGfx/officeMidGfx/officeGlowGfx/officeNearGfx; }`，避免切关残留。
- 5 个 Graphics 句柄命名（镜像 desert 的 `desert*Gfx`）：`officeWallGfx`(0,-10) / `officeFarGfx`(0.3,-9) / `officeMidGfx`(0.6,-8) / `officeGlowGfx`(0.6,-8,每帧) / `officeNearGfx`(1.2,4,每帧)。

---

## 2. 专属障碍视图占位几何（paper_pile / coffee_spill）

> 权威定义见 office-biome-spec §3；本节约为工程可消费的绘制伪代码级描述（对齐 `drawScorpion`/`drawCactus` 写法）。碰撞盒与各自类型一致（paper_pile 可踩平台 / coffee_spill 非碰撞 low_friction zone），仅外观换皮；几何读碰撞盒 AABB（tile-kind 或 entity），单一真相源，与碰撞盒一致。**两者均禁用命粉 `#F26D8B`。**

### 2.1 `paper_pile` 文件堆（可踩平台 / soft 顶 / 暖金纸面）

| 部位 | 几何（bbox 依瓦片/实体，anchor 底中贴地） | 配色（锁色板，均字面在文件内） | 危害 | 可踩 |
|---|---|---|---|---|
| 纸堆主体 | 堆叠圆角矩形 `fillRoundedRect` | `经济金 #F2C94C` (#8) | 否 | ✅ soft 顶 |
| 暗面 | 右侧/底暗带 | `暗棕 #79491E` (#3 派生 tint，字面 DESERT/HOME rockBody) | 否 | — |
| 歪斜纸片（顶×2–3） | 微旋矩形 `fillRoundedRect` | `经济金 #F2C94C` (#8) + 描边 | 否 | — |
| 高光翻页 | 小矩形亮页 | `暖黄 #FFD23F` (#4) | 否（纸感 telegraph） | — |
| 描边 | 全身 `lineStyle(1, #2A1A12)` | `#2A1A12` (#5) | — | — |
| 顶缘 1px 描边 | 顶线 `lineBetween` | `#2A1A12` (#5) | 可踩提示 | — |

**双编码（soft 顶 = 可踩）**：暖金纸堆 + 暖黄翻页 + 圆润纸顶 = "可踩平台"形状语言（与硬顶敌方硬+红尖区分）；靠暖金 hue + 圆润纸形 telegraph"可踩"，不以单色判危险。与 4 旧敌剪影全异（方纸堆 vs 圆/楔/扁/方敌；石炮为方块炮台，paper_pile 为有机纸堆 + 暖金，区分明显）。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: paper pile platform，anchor 底中贴地；可读作 tile-kind 或 entity，碰撞由 AABB 决定
const cx = b.x + b.w / 2
const PAPER = 0xF2C94C, PAGE = 0xFFD23F, DARK = 0x79491E, OUT = 0x2A1A12  // 禁用品红 #F26D8B
// 1) 纸堆主体（堆叠矩形，微歪）
g.fillStyle(PAPER, 1); g.fillRoundedRect(b.x, b.y, b.w, b.h*0.7, 3)
g.lineStyle(1, OUT, 1); g.strokeRoundedRect(b.x, b.y, b.w, b.h*0.7, 3)
// 2) 暗面（右侧，体积感）
g.fillStyle(DARK, 1); g.fillRect(b.x + b.w*0.72, b.y, b.w*0.28, b.h*0.7)
// 3) 歪斜纸片（顶上几张）
for i in 0..2:
  const px = b.x + 3 + i*5, py = b.y - 4 - i*4, pw = b.w - 10 - i*6
  g.fillStyle(PAPER, 1); g.fillRoundedRect(px, py, pw, 5, 2)
  g.lineStyle(1, OUT, 0.8); g.strokeRoundedRect(px, py, pw, 5, 2)
// 4) 高光翻页（暖黄亮页，纸感 + 可踩 telegraph）
g.fillStyle(PAGE, 1); g.fillRect(b.x + 4, b.y + 4, b.w*0.4, 4)
// 5) 顶缘 1px 描边（可访问性，soft 顶可踩提示）
g.lineStyle(1, OUT, 1); g.lineBetween(b.x, b.y, b.x + b.w, b.y)
// soft 顶 = 圆润纸顶 + 暖金 = 可踩（双编码）
```

> 入绘制分支：`if (k === 'paper_pile' || e.type === 'paper_pile') { drawPaperPile(g, b); return; }`（建议加 `office-obstacle-view.ts`，与 cactus 同族静态平台写法；若工程倾向 tile-kind 方案则嵌入 `drawLevel` 瓦片循环，见 §5.7）。
>
> **偏离 office-biome-spec 说明**：office-biome-spec §3.2 将 paper_pile 纸面定为 `暖橙 #F2933C`；本规格按任务红线指令改为 `经济金 #F2C94C`（纸面）+ `暖黄 #FFD23F`（翻页）+ `暗棕 #79491E`（暗面），三者均字面在文件内。#F2C94C 亦为锁色板 #8（coin 同源），"纸堆=金"语义更贴"文件/纸张"。

### 2.2 `coffee_spill` 咖啡渍（地面局部低摩擦 / 非碰撞 zone / 暗棕半透）

| 部位 | 几何（bbox 地面不规则斑块，贴地） | 配色（锁色板，均字面在文件内） | 危害 | 可踩 |
|---|---|---|---|---|
| 渍面 | 不规则半透斑块 `fillPoints` | `暗棕 #79491E` (#3 派生 tint，字面 DESERT/HOME rockBody) α≤0.55 | 否（zone 视觉） | 否（low_friction） |
| crema 内圈 | 较小半透斑块 | `暖橙 #F2933C` (#3) α≤0.4 | 否 | — |
| 湿反光 | 小椭圆高光 | `天空 #5BC8F5` (#11) α≤0.4 | 否 | — |
| 边缘警示 | 斑块外缘 `strokePoints` 红闪 | `警示红 #E8483B` (#7) α 闪 ≤2Hz | low_friction telegraph | — |
| 细微波纹（可选） | 内椭圆 `strokeEllipse` | `天空 #5BC8F5` α≤0.3，≤2Hz | telegraph | — |

**双编码（low_friction telegraph）**：暗棕渍 + 红边闪 = "此地易失控"形状+颜色双编码（对齐 cactus/scorpion 红语义）；非碰撞 body，仅 zone 视觉，触发由 03 Character `frictionScale` 局部覆盖（theme-system §3.4 R1）。**禁用命粉 `#F26D8B`。**

**动画 / telegraph（周期红边闪）**：
- 周期：红边 `coffeeRipplePhase` 推进（≤2Hz），`reduceMotion` 下冻结首帧（静态红边 α=0.5，无闪烁）；细微波纹同冻结。
- 危险区：在渍面范围形成半透暗棕区（贴形状的不规则区域），经碰撞盒/GDD 判定 low_friction。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: coffee spill zone rect on ground；非碰撞（low_friction zone），视觉 telegraph
const cx = b.x + b.w / 2, cy = b.y + b.h
const STAIN = 0x79491E, CREMA = 0xF2933C, OUT = 0x2A1A12
const WET = 0x5BC8F5, EDGE = 0xE8483B   // 禁用品红 #F26D8B
// 1) 暗棕半透不规则斑块（fillPoints 拟泼洒，rx=b.w*0.5, ry=b.h*0.4）
g.fillStyle(STAIN, 0.55); g.fillPoints(blobPoints(cx, cy, b.w*0.5, b.h*0.4, seed=1), true)
// 2) 内圈 crema 暖橙（浅咖）
g.fillStyle(CREMA, 0.4); g.fillPoints(blobPoints(cx, cy, b.w*0.32, b.h*0.26, seed=2), true)
// 3) 湿反光高光（天空蓝，α≤0.4）
g.fillStyle(WET, 0.35); g.fillEllipse(cx - 4, cy - 3, b.w*0.25, b.h*0.15)
// 4) 边缘警示红闪（low_friction telegraph，≤2Hz）
const ea = reduceMotion ? 0.5 : (0.35 + 0.35 * Math.sin(coffeeRipplePhase))   // ≤2Hz
g.lineStyle(1.5, EDGE, ea); g.strokePoints(blobPoints(cx, cy, b.w*0.5, b.h*0.4, seed=1), true)
// 5) 细微波纹（≤2Hz，可选）
if (!reduceMotion) {
  const ra = 0.3 * Math.sin(coffeeRipplePhase * 1.2)
  g.lineStyle(1, WET, Math.max(0, ra)); g.strokeEllipse(cx, cy, b.w*0.4, b.h*0.3)
}
// 非碰撞：仅 zone 视觉；low_friction 触发由 physics 据 zone 判定
```

> 入绘制分支：`if (z.type === 'coffee_spill') { drawCoffeeSpill(g, z); return; }`（建议加 `office-obstacle-view.ts`；红边/波纹为每帧 overlay，GDD 负责 low_friction 判定，本规格只定义视觉）。
>
> **偏离 office-biome-spec 说明**：office-biome-spec §3.1 将 coffee_spill 渍面定为冷调 `darken(#4A78C0,0.35)` ≈ `#304E7D`；本规格按任务红线指令改为**暗棕 `#79491E`（暖咖，字面 DESERT/HOME rockBody）+ 暖橙 `#F2933C` crema**，二者均字面在文件内，更贴"咖啡渍=棕/橙"真实语义。#304E7D 仍可作为冷调备选渍面（字面 STREET.rockFace），但本规格主选 #79491E。

### 2.3 与既有敌/元素剪影区分（色盲安全）

- **paper_pile**：暖金圆润纸堆 + 暖黄翻页，区别于 4 旧敌（圆/楔/扁/方）+ gu_bao（暖橙苞+顶刺）/jellyfish（半透天空蓝）/scorpion（暖橙长条+红尾）/cactus（草绿柱+红刺）。paper_pile 以「暖金纸堆 + 歪斜纸片」剪影唯一，避用命粉（与生命色解耦）。
- **coffee_spill**：暗棕不规则半透渍 + 红边闪，区别于 cactus（草绿大柱）/ 普通路面。靠渍形 + 红边闪 telegraph low_friction。
- 两者均靠**形状 + 颜色双编码**（暖金纸=可踩；红边闪=低摩擦危险），不依赖单色，色盲安全。
- 办公**无专属敌**（office-biome-spec §0 / theme-system §4.1 office 行「专属敌 无」），同屏仅通用基底 4 敌（ci_li/du_fu/chong_feng/shi_pao），着色沿用各自 biome 锁色板映射；du_fu 加 `暖黄 #FFD23F` 肚皮斑、shi_pao 石身=`#4A78C0` 维持冷底辨识。

---

## 3. office 8 槽 palette 契约（OFFICE 常量 · 证明 0 新增 hex）

> 直接复制/收紧 `office-biome-spec.md` §8.2 权威映射，但**严格守红线**：每个槽位 hex 均**字面已存在于 `theme-palette.ts` 既有 entry**（含既有 tint 派生色）。本规格不写 `src/`；由 engineering-lead 按 §3.1 注册 `THEME_PALETTES['office']`。**每个槽位均标注取自哪个既有 entry 的 hex，证明 0 新增。**

### 3.1 OFFICE 注册表（解析器应消费的颜色常量名 + hex 映射 + 来源证明）

| 引擎字段 | OFFICE Hex | 取自 theme-palette.ts 既有 hex（字面出处） | 0 新增证明 |
|---|---|---|---|
| `bg` | `0x5BC8F5` | **字面已存在于** VINE_FOREST.bg (`0x5bc8f5`) / SEA.bg (`0x5bc8f5`) / STORM_SKY.crystalGlow (`0x5bc8f5`) | 锁色板 #11（天空），0 新增 |
| `rockFace` | `0x4A78C0` | **字面已存在于** CAVE.rockFace (`0x4a78c0`) / SEA.rockFace (`0x4a78c0`) / STORM_SKY.rockBody (`0x4a78c0`) | 锁色板 #10（环境冷蓝），0 新增 |
| `rockBody` | `0x254060` | **字面已存在于** CAVE.rockBody (`0x254060`) / SEA.rockBody (`0x254060`) / STREET.rockBody (`0x254060`) | 既有 entry 已有 hex 直接复用，0 新增 |
| `outline` | `0x2A1A12` | 描边（锁色板 #5），已存在于全部 entry | 锁色板 #5，0 新增 |
| `firelight` | `0xF2933C` | 暖橙（锁色板 #3），已存在于 GRASS/CAVE/SEA/DESERT/HOME/STORM/VINE/STREET | 锁色板 #3，0 新增 |
| `crystalCore` | `0x7CC242` | 草绿（锁色板 #1），已存在于 GRASS.crystalGlow / VINE.rockFace / DESERT.crystalCore / HOME.crystalGlow / SEA.crystalGlow | 锁色板 #1，0 新增 |
| `crystalGlow` | `0x6E7BF2` | 蓝紫（锁色板 #9），已存在于 CAVE.crystalGlow / VINE.crystalGlow / STORM.rockFace / STREET.crystalGlow | 锁色板 #9，0 新增 |
| `danger` | `0xE8483B` | 警示红（锁色板 #7），已存在于全部 entry | 锁色板 #7，0 新增 |

> **0 新增 hex 总证**：8 槽中，`rockBody`/`outline`/`firelight`/`crystalCore`/`crystalGlow`/`danger` 为锁色板直引色（均字面存在于现有 entry）；`bg`（`#5BC8F5`）与 `rockFace`（`#4A78C0`）亦为锁色板直引色（字面存在于 VINE/SEA/STORM / CAVE/SEA/STORM 等 entry）。**全 8 槽字面存在于 `theme-palette.ts` 既有 entry，0 新增 hex。** 蓝紫 `#6E7BF2`（#9）、暖黄 `#FFD23F`（#4）、经济金 `#F2C94C`（#8）、暗棕 `#79491E`（#3 派生 tint 字面 DESERT/HOME rockBody）、阴影绿 `#5FA82F`（VINE.rockBody）亦作为装饰/障碍常量在绘制分支直接引用（不进 palette 槽，均字面在锁色板/文件内）。
>
> **对照 office-biome-spec §1.2/§8.2 的偏离（红线驱动）**：该提案 `bg=#74D0F7`（`lighten(#5BC8F5,0.15)`）、`rockFace=#3B609A`（`darken(#4A78C0,0.2)`）为**新 hex，字面未出现在 `theme-palette.ts` 任何既有 entry**，违反本规格硬红线。本规格偏离为 `bg=#5BC8F5`、`rockFace=#4A78C0`（均字面存在），证明 0 新增。详见文末偏离声明。

### 3.2 fail-safe 回退

- 工程 `resolveBiome(theme)` 对未知/缺省 theme **回退 `grass`**（现有行为，office-biome-spec §8.1）；
- 若 `THEME_PALETTES['office']` 尚未注册，背景/地形自动走 grass 常量（现有硬编码棕），**不抛错、零回归**；
- `LevelData.metadata.theme` 增 `'office'`（联合类型 `'grass'|'cave'|'vine_forest'|'storm_sky'|'sea'|'desert'|'home'|'street'|'office'`），未知回退 `'grass'`；
- 本规格**不写 src**；office entry 由 engineering-lead 按 §3.1 注册。

### 3.3 消费点映射（工程落地指引，非本规格写码）

| 消费点 | office 取值 |
|---|---|
| `drawTerrain` 地面/桌柜填充 | `THEME_PALETTES['office'].rockFace`(#4A78C0) / `.rockBody`(#254060) |
| 背景色/天花板+后墙 | `setBackgroundColor(THEME_PALETTES['office'].bg)`(#5BC8F5)；渐变见 §1.2 |
| `paper_pile` 分支（`office-obstacle-view.ts` 新增） | 纸面=`经济金 #F2C94C`、暗面=`#79491E`、翻页=`crystalCore`(#FFD23F)、描边=`outline`；**禁用品红 `#F26D8B`** |
| `coffee_spill` 分支（`office-obstacle-view.ts` 新增） | 渍面=`暗棕 #79491E`、crema=`firelight`(#F2933C)、湿反光=`#5BC8F5`、红边=`danger`(#E8483B)、描边=`outline`；**禁用品红 `#F26D8B`** |
| 装饰层（`drawOfficeBackground`） | 天花板=`bg`(#5BC8F5)→`rockBody`(#254060)；隔断剪影=`#254060`；窗光=`#5BC8F5`+`#FFD23F`；办公桌=`rockFace`(#4A78C0)+`rockBody`(#254060)；显示器=`firelight`(#F2933C)+`crystalGlow`(#6E7BF2)；绿植=`crystalCore`(#7CC242)+`#5FA82F`；荧光灯=`firelight`(#FFD23F)；前景=`rockFace`(#4A78C0)+`crystalGlow`(#6E7BF2) |
| 4 旧敌在冷底关 | 沿用各自 biome 锁色板映射；靠 `outline` + 功能色维持辨识（同 office-biome-spec §4，du_fu 加 `暖黄 #FFD23F` 肚皮斑、shi_pao 石身=`#4A78C0`） |

---

## 4. Reduce Motion + 可访问性 Standard

### 4.1 减少动态（Reduce Motion）

> 来源：`platform.reduceMotion`（game-scene 已注入 `this.reduceMotion`，见 game-scene.ts:1312 附近）；对齐 office-biome-spec §5/§6 与 art-bible §9.3。办公动态元素相位累加器在 Reduce Motion 下冻结首帧（≤3Hz 光敏安全）。

| 动态元素 | 正常行为 | Reduce Motion 处理 | 频率合规 |
|---|---|---|---|
| 荧光灯管微闪（中景） | 暖黄灯管 α 微闪 ≤2Hz | 冻结首帧（静态灯管 α=0.9，无闪烁） | ≤2Hz 正常亦合规 |
| 窗光脉冲（远景） | 窗内暖黄光晕 α 呼吸 ≤2Hz | 冻结首帧（静态光晕 α=0.3） | ≤2Hz 正常亦合规 |
| 屏幕光脉冲（中景） | 蓝紫屏光 α 呼吸 ≤2Hz | 冻结首帧（静态屏光 α=0.85，无呼吸） | ≤2Hz 正常亦合规 |
| 前景隔断/电线（near） | `nearPhase` 推进，斜悬挑/垂带飘移 | `nearPhase` 不推进，静态斜带（门控可见时保持首帧形态） | — |
| 咖啡渍红边闪/波纹（coffee_spill） | 红边 `coffeeRipplePhase` 闪 + 细波纹 ≤2Hz | `coffeeRipplePhase` 冻结（静态红边 α=0.5，无闪烁/波纹） | ≤2Hz 正常亦合规 |

- **统一机制**：所有办公相位累加器（`fluorescentPhase` / `windowPhase` / `screenPhase` / `nearPhase` / `coffeeRipplePhase`）在 `reduceMotion === true` 时不推进，渲染用首帧常量（对齐 desert 的 `sunPhase`/`veilPhase`、home 的 `lampPhase`/`windowPhase`、street 的 `windowPhase`/`lampPhase`/`neonPhase` 冻结写法）。
- **保留**：静态轮廓/暗色/红边闪等全部保留 → 危险可读性与色盲安全不降级。

### 4.2 可访问性校验（Office · 目标档 Standard）

> 口径：art-bible §9 + `art/accessibility.md`（MVP 目标 = **Standard**；防光敏 / 最小热区为硬底线）。逐项检查办公主题。

| # | 检查项 | 结论 | 说明 |
|---|---|---|---|
| 1 | 前景/背景对比（≥3:1，关键≥4.5:1） | ⚠️→✅ | 桌柜主面 `#4A78C0` vs 天花板 `#5BC8F5` 亮度约 **2.0:1**（冷同色系，偏低）；靠**强制 1px 描边 `#2A1A12`**（描边 vs 天花板 ≈8:1）+ `rockBody` 暗面 `#254060` 兜底 → 平台顶缘边界 >4.5:1 达标。实体均有暗描边，与亮天花板高对比。 |
| 2 | 色盲安全（形状+色双编码） | ✅ | 地面 hue=冷蓝（`#4A78C0`，办公唯一「冷蓝桌柜+亮天花板」组合）；paper_pile=暖金纸堆+暖黄翻页（soft 顶可踩）、coffee_spill=暗棕渍+红边闪（low_friction telegraph）——均形状+颜色双编码。危险=警示红+红边闪。 |
| 3 | 减少动态 / 静态 fallback | ✅ | 荧光灯/窗光/屏光脉冲/前景电线/咖啡渍红边闪相位在 Reduce Motion 下冻结首帧（静态），对齐 §4.1。 |
| 4 | 防光敏（<3Hz，单闪≤0.2s） | ✅ | 荧光灯 ≤2Hz、窗光 ≤2Hz、屏光 ≤2Hz、前景电线 ≤2Hz、咖啡渍红边/波纹 ≤2Hz；无全屏高频闪。 |
| 5 | 最小可辨/可点尺寸 | ✅ | 实体≥32px（paper_pile ≥32×24、coffee_spill zone ≥32 宽、敌≥32px）；UI 热区≥48×48（继承全局）。 |
| 6 | 非颜色状态提示 | ✅ | 受击=红闪+击退+无敌闪；踩怪=压扁+弹；paper_pile=暖金圆润顶 telegraph 可踩；coffee_spill=红边闪 telegraph low_friction。 |

**结论**：Office 主题可达 **Standard 档**（MVP 目标）。唯一注意项 = 天花板 `#5BC8F5` 与桌柜 `#4A78C0` 的亮度对比临界（≈2.0:1），**强制平台 1px 描边**即达标（与 cave/vine/storm/sea/desert/home/street 通用缓解一致）。全部零新增色，守 ADR-004。

### 4.3 与 cave / vine / storm / sea / desert / home / street 色相区分

| 主题 | 主色相 | 办公区分点 |
|---|---|---|
| cave | 冷蓝灰+暗背景 | 办公=亮天花板 `#5BC8F5` + 冷蓝桌柜 `#4A78C0`（非洞穴暗蓝 `#1C2E49` bg）+ 蓝紫屏幕/绿植/暖橙文件夹点缀 |
| vine_forest | 草绿 | 办公=冷蓝桌柜主导，草绿仅绿植点缀（非满屏绿） |
| storm_sky | 蓝紫 | 办公=冷蓝桌柜+暖橙文件夹（非冷紫风暴） |
| sea | 冷蓝天光+草绿 | 办公=**亮天花板 `#5BC8F5`（非水面开放感）+ 桌柜/显示器/绿植办公形态**（海无桌/显示器）；地面同为冷蓝但办公多「桌/屏/植」区分 |
| desert | 暖橙沙 | 办公=冷蓝桌柜（非暖橙） |
| home | 暖橙木+暖棕墙 | 办公=冷蓝桌柜（非室内暖调） |
| street | 冷蓝灰建筑+压暗天空 | 办公=**亮天花板 `#5BC8F5`（非压暗 `#408CAC`）+ 办公桌/显示器/绿植**（街为楼宇/路灯/霓虹，无桌/显示器） |

> 办公冷调（亮天花板 + 冷蓝桌柜 + 蓝紫屏幕 + 草绿绿植 + 暖橙文件夹）在八主题中**色相唯一（纯室内办公冷调）**，色盲玩家靠地面 hue（冷蓝）+ 办公形态（桌/屏/植/窗）即可分辨，不撞色。

---

## 5. 工程接入点提示（供 engineering 参考）

> 以下为**实现指引（非本规格写码）**，供 engineering-lead 落地 `game-scene.ts`；结构与 home/desert/street 同构。

1. **`drawLevel` 平铺分支排除 `isOffice`（防 bg 双重填充）**：
   - 现有平铺分支 `if (!isSea && !isDesert && !isHome && !isStreet && pal.bg !== null)` **须扩展为**
     `if (!isSea && !isDesert && !isHome && !isStreet && !isOffice && pal.bg !== null)`。
   - 否则 office 的 `bg=#5BC8F5`（非 null）会被先铺满再被 `drawOfficeBackground` 覆盖，造成双重填充/闪烁。**（关键接入点）**

2. **`drawLevel` 分派 `drawOfficeBackground`**：
   - 在 home/desert/street 分派之后新增：`if (isOffice) this.drawOfficeBackground(pal);`（镜像 `drawDesertBackground` 签名 `drawOfficeBackground(pal: ThemePalette)`）。
   - `pal` 来自 `biomeForLevel(this.runtime.data)`（含 `THEME_PALETTES['office']`）。

3. **切关清理块**：
   - 镜像 desert/home/street 的 `!isDesert`/`!isHome`/`!isStreet` 清理块，新增 `if (!isOffice) { 销毁 officeWallGfx / officeFarGfx / officeMidGfx / officeGlowGfx / officeNearGfx; }`，避免切关残留 Graphics。

4. **5 个 Graphics 句柄命名（镜像 desert 的 `desert*Gfx`）**：
   - `officeWallGfx`(scrollFactor 0, depth -10) — 天花板+后墙（create-once）
   - `officeFarGfx`(scrollFactor 0.3, depth -9) — 隔断剪影+窗光（create-once）
   - `officeMidGfx`(scrollFactor 0.6, depth -8) — 办公桌/显示器框/绿植/灯架本体（create-once）
   - `officeGlowGfx`(scrollFactor 0.6, depth -8, 每帧) — 荧光灯管微闪 + 屏光脉冲 + 窗光脉冲（独立层每帧重绘）
   - `officeNearGfx`(scrollFactor 1.2, depth 4, 每帧) — 隔断悬挑/电线（独立层每帧重绘）

5. **主题驱动系统纪律**：
   - 背景/地形按 `theme` 字段走 `THEME_PALETTES` 8 槽 + `drawOfficeBackground` 分派；
   - 未知 theme 走 `resolveBiome` 回退 `grass`（不要破坏既有 fail-safe）；
   - 不引入任何 PNG/JPG/SVG（ADR-004），paper_pile/coffee_spill 全 Graphics 绘制。

6. **Reduce Motion 冻结**：
   - 所有办公相位累加器（`fluorescentPhase`/`windowPhase`/`screenPhase`/`nearPhase`/`coffeeRipplePhase`）在 `this.reduceMotion === true` 时停推进，渲染用首帧常量（见 §4.1）。

7. **paper_pile / coffee_spill 渲染分支接入**：
   - **paper_pile**：建议加 `src/game/render/office-obstacle-view.ts`（与 cactus 同族静态平台写法），亦可走 `drawLevel` 瓦片循环 tile-kind 分支（`if (k === 'paper_pile')`）或 entity 分支（`if (e.type === 'paper_pile')`），碰撞由 AABB 决定，本规格 §2.1 伪代码可迁移。**待 eng 确认** 表达方式（tile-kind vs entity）。
   - **coffee_spill**：zone 矩形渲染，非碰撞；红边闪/波纹为每帧 overlay（§2.2 伪代码），low_friction 触发由 physics 据 zone `frictionScale` 判定（theme-system §3.4 R1）。**待 eng 落地消费 `coffeeRipplePhase`/`active` 标志。**

---

## 附：与 office-biome-spec 的交叉引用

- 本规格为 `office-biome-spec.md` 的**视觉落实扩展**：§1 背景层画法（五层）→ office-biome-spec §5（视差层级）；§2 专属障碍几何 → §3（paper_pile/coffee_spill）；§4 Reduce Motion+可访问性 → §5/§6；§3 palette 衔接 → §1/§8；§4 可访问性 → §6。
- 实现须以 `office-biome-spec.md` 视觉意图为准，但**本规格将 8 槽 hex 收紧为 `theme-palette.ts` 字面既有值**（见 §3.1 与文末偏离声明），本规格不引入任何新 hex。
- 工程契约见 office-biome-spec §8；本规格 §3 为视觉侧对齐摘录（已守 0 新增 hex 红线）。
- 结构镜像 `home-visual-spec.md`（§0 概览 / §1 五层背景 / §2 专属元素几何 / §3 palette / §4 Reduce Motion+可访问性 / §5 工程接入点），保证多主题视觉规格同构、工程可复用同一套绘制骨架。

---

## 偏离 theme-system.md / office-biome-spec 早期配色核查（回应任务红线）

> 本规格严格守「每个 hex 字面存在于 `theme-palette.ts` 既有 entry，0 新增」红线。下列为相对早期设计文档（`office-biome-spec.md` §1.2/§3.1/§3.2、以及 street-visual-spec 的 tint 写法）的**偏离决定**，全部为将"非文件内 tint 新 hex"替换为"文件内既有 hex"，无任何新增 hex：

1. **8 槽 `bg`/`rockFace` 偏离 office-biome-spec §1.2/§8.2**：
   - 提案 `bg = #74D0F7`（`lighten(#5BC8F5,0.15)`）、`rockFace = #3B609A`（`darken(#4A78C0,0.2)`）——**二者字面未出现在 `theme-palette.ts` 任何既有 entry**，违反红线。
   - 本规格偏离为 `bg = #5BC8F5`（字面 VINE_FOREST.bg / SEA.bg / STORM_SKY.crystalGlow）、`rockFace = #4A78C0`（字面 CAVE.rockFace / SEA.rockFace / STORM_SKY.rockBody）。两者均为锁色板直引色，0 新增。
2. **coffee_spill 渍面偏离 office-biome-spec §3.1**：提案冷调 `#304E7D`（`darken(#4A78C0,0.35)`）；本规格按任务指令改为**暗棕 `#79491E`（字面 DESERT/HOME rockBody，#3 派生 tint）+ 暖橙 `#F2933C` crema**，更贴"咖啡=棕/橙"语义，均字面在文件内。#304E7D 仍保留为冷调备选渍面（字面 STREET.rockFace）。
3. **paper_pile 纸面偏离 office-biome-spec §3.2**：提案 `暖橙 #F2933C`；本规格按任务指令改为**经济金 `#F2C94C`（纸面）+ 暖黄 `#FFD23F`（翻页）+ 暗棕 `#79491E`（暗面）**，均字面在文件内（#F2C94C 锁色板 #8、#FFD23F 锁色板 #4、#79491E DESERT/HOME rockBody）。
4. **远景区隔断剪影偏离 street-visual-spec §1.3 的 `#2C486F` 写法**：street 用 `darken(#4A78C0,0.4)` ≈ `#2C486F`（非文件内）；本规格改用字面已有的 `#254060`（CAVE/SEA/STREET rockBody），守红线。
5. **绿植暗部偏离 office-biome-spec §1.3 的 `#3E6121` 写法**：提案 `darken(#7CC242,0.5)` ≈ `#3E6121`（非文件内）；本规格改用字面已有的 `阴影绿 #5FA82F`（VINE_FOREST.rockBody），0 新增。
6. **命粉 `#F26D8B` 全程禁用**：paper_pile/coffee_spill 及所有装饰均不使用命粉，与 art-bible §3.2/§9.1 生命色解耦一致。
7. **theme-framework.md 早期自由 hex（R8 已标注不进实现）一律未采用**：本规格所有 hex 均来自 `theme-palette.ts` 既有 entry 或锁色板直引色，无任何 `#1A202C`/`#2D3748`/`#3FC7B4` 等自由 hex。

> 以上偏离均**不引入任何新 hex**，且使办公调色板 100% 可追溯至 `theme-palette.ts` 既有 entry，满足任务硬红线与 STREET §3「0 新增」证明口径。

---

*本文件为办公（室内）主题视觉落实规格（加法），roadmap 批次 3（办公 office 1-1…1-7）；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 office-biome-spec §8 契约 + 本规格 §1–§2 绘制参数）。*
