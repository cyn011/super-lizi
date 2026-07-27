# 家（室内）主题视觉落实规格（home-visual-spec）

> 文档类型：视觉落实规格（加法扩展，衔接 `art/home-biome-spec.md` 的 §1/§3/§4/§8，供工程侧落地 1-5《归巢》背景与专属敌/障碍/家具皮肤）
> 作者：art-director（林绘澄）
> 上游依据：`art/home-biome-spec.md`（8 槽权威映射 + tint + pet/家具/toy 视觉）｜`art/desert-visual-spec.md`（本规格结构镜像基线）｜`art/sea-visual-spec.md`（同构）｜`art/cave-biome-spec.md` §2/§5/§6（同构）｜`src/game/render/enemy-view.ts`（现有 `drawEnemy` 分支结构，需加 `pet`/`toy` 分支）｜`src/game/scenes/game-scene.ts` 的 `drawDesertBackground` / 五层背景模式（家背景镜像其 5 层结构：天空/远景 far 0.3 / 中景 mid 0.6 / 游戏层 1.0 / 前景 near 1.2，但室内语言替换为天花板/墙/地板/窗光/家具剪影）｜`design/gdd/level-1-5-design.md`（家具 tile-kind 提案）
> 关联任务：roadmap 批次 3（家 1-5）｜评审强度：lean
> **红线**：锁色板 ≤64、COLOR DELTA = 0 新增 hex（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts`、不 git commit**；theme 名严格 `home`；MVP 全程序化占位（Graphics，零 PNG，ADR-004）；IP 全原创、避任天堂符号。

---

## 0. 范围与权威色引用（红线基准）

本规格把 `home-biome-spec.md` 的视觉意图落成**工程可消费的程序化绘制规格**：室内背景层画法、pet/toy/家具绘制、减少动态处理、theme-palette 衔接。玩法/数值（家具 tile-kind 碰撞、pet/toy 伤害回调）由对应 GDD 与工程负责，本规格只定义"长什么样 + 怎么画"。

**零 PNG 声明**：本规格全部视觉效果经 Phaser `Graphics` 程序化绘制（ADR-004）；不引入任何 PNG/JPG/SVG；多主题切换 = 调色板数据切换 + 背景层参数变化 + 装饰绘制参数差异。包体增量 ≈ 0。

### 0.1 权威 11 色锁色板（全部引用，0 新增）

| # | 名 | Hex | 本规格用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 盆栽绿 / 相框内块 / `crystalGlow` |
| 2 | 阴影绿 | `#5FA82F` | 盆栽暗部 tint 源（本规格用 `darken(#7CC242,0.5)`） |
| 3 | 暖橙 | `#F2933C` | **木家具主面 / 地板 / 宠物身 / 台灯架** / `rockFace` / `firelight` 同源 |
| 4 | 暖黄 | `#FFD23F` | 台灯暖晕 / 窗光 / 宠物耳点缀 / `crystalCore` |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享）/ `out-line` |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，**本关不用于敌/障碍**，与生命色解耦） |
| 7 | 警示红 | `#E8483B` | 危险语义（玩具尖角 / 宠物铃铛）/ `danger` |
| 8 | 经济金 | `#F2C94C` | coin（沿用）/ 窗框金边 / 柜把手 / `crystalGlow` 同源 |
| 9 | 蓝紫 | `#6E7BF2` | 屏幕辉光（少用，alpha ≤0.2） |
| 10 | 环境冷蓝 | `#4A78C0` | 冷调投影 tint 源（落于实体下方） |
| 11 | 天空 | `#5BC8F5` | 窗外微光（窗格内，alpha ≤0.5） |

### 0.2 本规格使用的 tint 派生（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 墙/天花板 bg | `darken(#F2933C, 0.55)` ≈ `#6B4220` | 室内后墙·天花板（暖棕） | 0 新增（tint，home-biome-spec §1.2） |
| 家具暗部 rockBody | `darken(#F2933C, 0.5)` ≈ `#79491E` | 沙发暗面/柜门/顶/远景家具剪影/天花板带 | 0 新增（tint，home-biome-spec §1.2） |
| 盆栽暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 盆栽阴影侧 | 0 新增（tint，home-biome-spec §1.3） |
| 冷调投影 | `darken(#4A78C0, 0.4)` ≈ `#2C486F` | 家具/宠物下方冷调投影（非黑，暖中藏冷） | 0 新增（tint，home-biome-spec §1.3） |

> 注：本规格刻意**不引入任何新 tint 名** beyond 上表——天花板带直接复用 `rockBody #79491E`（已落 8 槽），窗光用 `天空 #5BC8F5` + `暖黄 #FFD23F`，盆栽暗部用已声明的 `#3E6121`。全部 0 新增 hex。

### 0.3 内部分辨率 / 网格硬约束

`512×288` 内分辨率，32px 瓦片网格，`pixelArt: true`，整数缩放。所有 Graphics 绘制坐标按此基准；视差通过 `scrollFactor` 实现（墙层 `scrollFactor=0`，远景 0.3，中景 0.6，游戏层 1.0，前景 1.2）。

---

## 1. 家（室内）背景层程序化绘制规格（零 PNG · 全 Graphics）

> 家是**室内**，无天空。用「天花板 + 后墙 + 地板 + 窗光 + 家具剪影」替代沙漠的「天空/远景/中景」户外语言，但**视差结构 1:1 镜像** `drawDesertBackground` 的五层（depth / scrollFactor 完全一致）。

### 1.1 图层架构（镜像 drawDesertBackground 五层结构 + home-biome-spec §5）

| 层 | depth / scrollFactor | 室内内容 | 配色（锁色板） | 绘制 API 建议 |
|---|---|---|---|---|
| 天花板+后墙 | -10（scrollFactor 0） | 全屏暖棕墙 + 顶部天花板带（竖直渐变） | 墙 `bg #6B4220` → 顶 `rockBody #79491E`（天花板带） | `fillGradientStyle` + `fillRect` |
| 远景 far | -9（scrollFactor 0.3） | 窗光（窗外微光）+ 家具剪影带（沙发背/书架） | 窗=`天空 #5BC8F5` α≤0.5 + `暖黄 #FFD23F` 光晕；剪影=`rockBody #79491E` 无描边 | `fillRect`/`fillPoints` |
| 中景 mid | -8（scrollFactor 0.6） | 相框 + 盆栽 + 台灯（静态）+ 台灯脉冲层 | `#F2C94C` 框边 + `#7CC242` 框内 / `#7CC242` 盆栽 / `#F2933C` 灯架 + `#FFD23F` 灯晕 | `fillRoundedRect`/`fillCircle` |
| 游戏层 game | 0（scrollFactor 1.0） | 木地板/家具地形/敌/障碍/道具/主角 + 家具绘形分支 | `rockFace #F2933C` / `rockBody #79491E` / 描边 | `drawTerrain`（见 §2 家具分支） |
| 前景 near | 4（scrollFactor 1.2，克制） | 偶尔窗帘掠过 / 地毯边 | `#F2933C` alpha ≤0.4 + 暖黄高光点 | 屏幕锚定飘带 `fillPath` |

> 中景台灯脉冲（≤2Hz）与前景窗帘为**每帧轻量重绘**；远景窗光/家具剪影、中景相框/盆栽/灯架为 **create 时一次绘制**，仅 scrollFactor 驱动视差滚动，运行时零重绘。台灯脉冲因需每帧重绘，建议拆到独立小 Graphics `homeLampGfx`（见 §1.4 末"待 eng 确认"）。

### 1.2 天花板+后墙层（scrollFactor 0，depth -10）

- 用 `fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha)` 画全屏竖直渐变：
  - **顶部（天花板带）** `rockBody = #79491E`（暖棕，比墙略深，暗示顶面受光少）；
  - **近地平线端（后墙）** `bg = #6B4220`（暖棕墙，home-biome-spec §1.2 权威）；
  - 单次 `fillRect(0, 0, camW, camH)` 即可，极廉价。天花板带约占顶部 `levelH*0.18`（≈ 52px，约 1.6 格）。
- 该层 `scrollFactor=0` 不随相机滚动；家**无天空/水位线**，全屏纯暖棕室内。
- 可选：天花板与墙交界处一道 `rockBody` 加深线（`lineStyle(2, #79491E)`）强化"顶/壁"分界——纯氛围。

### 1.3 远景 far（parallax 0.3，depth -9）— 窗光 + 家具剪影

- **窗光 `deco_window`（窗外微光）**：后墙上 2–3 扇窗，每扇 = 窗格内填 `天空 #5BC8F5` α≤0.5（"窗外微光"，家 biome 仅此一处用冷蓝，制造"室内暖 vs 窗外凉"反差，art-bible §3.3 冷中藏暖），`经济金 #F2C94C` 细框（1px），窗内叠 `暖黄 #FFD23F` α≤0.3 光晕（+ 轻微脉冲，见 §3）。窗位错落（x ≈ `levelW*0.22 / 0.55 / 0.84`，y ≈ `levelH*0.3`，窗宽 ≈ 44、高 ≈ 56）。
- **家具剪影带**：一条起伏带，颜色 `rockBody #79491E`（tint 派生，0 新增），**无描边、低饱和**（对齐 art-bible §5.1「远景降饱和无描边」），与中景暖橙家具拉开层次。剪影形态 = 矮沙发背 / 书架轮廓（`fillPoints` 折线，amp 10–16px / wl 160–220px），置于约 `levelH * 0.6` 起，纯氛围非碰撞。
- draw call：far ≈ 4（窗×3 + 剪影带 1），均 ≤15。

### 1.4 中景 mid（parallax 0.6，depth -8）— 相框 + 盆栽 + 台灯（静态）

- **相框 `deco_frame`**（墙上点缀"家"叙事）：
  - 外框：`经济金 #F2C94C` `fillRoundedRect`（宽 ≈ 26、高 ≈ 20，厚 2）；
  - 内块：`草绿 #7CC242` `fillRect`（画中"盆栽/窗景"抽象块）；
  - 描边 `#2A1A12`（1px）。2–3 处错落（y ≈ `levelH*0.34`）。
- **盆栽 `deco_plant`**：
  - 主体：`crystalGlow #7CC242` 团（`fillCircle` 簇，3 枚 r 6–10）+ `darken(#7CC242,0.5)` ≈ `#3E6121` 暗部侧（右 1/3 涂暗）；
  - 描边 `#2A1A12`（1px）。2–3 处（与窗/相框错开，y ≈ `levelH*0.5` 贴"地脚"）。
- **台灯 `deco_lamp`（灯架静态 + 灯晕脉冲）**：
  - 灯架：`rockFace #F2933C` 细柱 + 底座（`fillRoundedRect` 宽 6、高 22 + 底椭圆）；
  - 灯罩：`rockFace #F2933C` 梯形（上窄下宽）；
  - 灯晕（每帧脉冲，见 §3）：`crystalCore #FFD23F` α 呼吸 + 外扩圆；
  - 描边 `#2A1A12`（1px）。1–2 处（x ≈ `levelW*0.4`，y ≈ `levelH*0.42`）。
- 中景 create 时一次绘制（相框/盆栽/灯架本体）；**台灯脉冲因每帧重绘，建议拆到独立小 Graphics `homeLampGfx`（scrollFactor 0.6, depth -8 同层）每帧重绘仅灯晕，相框/盆栽/灯架仍 create-once** —— **待 eng 确认**拆层方案。
- draw call：mid 静态（相框×3 + 盆栽×3 + 灯架×1）≈ 7，均 ≤15。

### 1.5 前景 near（parallax 1.2，depth 4，克制）— 偶尔窗帘掠过

- **窗帘 `deco_curtain`**：近景偶尔掠过的半透暖橙窗帘，营造室内微风流动；屏幕锚定（随相机 1.2 视差），相位偏移 `fillPath` 斜飘带。
  - 画法：维护 `curtainPhase`；`g.clear()` → `fillStyle(#F2933C, 0.25–0.4)` → `fillPoints` 一条竖向飘带（2–3 段折线拟布褶）+ 数枚 `firelight #FFD23F` α≤0.3 高光点；
  - **周期性出现，非持续**：用 `sin(curtainPhase * 0.2) > 0.6` 门控，仅约 30% 时间可见，其余时间透明（克制遮挡）；
  - 遮挡 ≤10% 路径，仅屏幕侧缘掠过，不挡关键平台/主角。
- **减少动态**：Reduce Motion 下 `curtainPhase` 不推进（冻结首帧），窗帘成静态斜带（见 §3）。
- draw call：near 1 次（`fillPath` 单 path + 点）。

### 1.6 性能预算

每层总 draw call ≤ 15（墙 1 + far ≈4 + mid 静态 ≈7 + near 1 + 游戏层地形按 tile 数），远低于移动端阈值。每帧仅 near 窗帘 + 台灯脉冲（独立层）轻量重绘 ≈ 0.1ms，可忽略；far/mid/墙 create 时一次绘制，仅 scrollFactor 驱动视差滚动，运行时零重绘。

### 1.7 工程接入点（drawLevel 分派，镜像 desert）

> 以下为**实现指引（非本规格写码）**，供 engineering-lead 落地 `game-scene.ts`：

- `drawLevel()` 内新增 `const isHome = this.runtime.data.metadata.theme === 'home';`
- 背景分派（镜像 1347/1349）：
  - 现有 `if (!isSea && !isDesert && pal.bg !== null)` 平铺分支**须扩展为** `if (!isSea && !isDesert && !isHome && pal.bg !== null)` —— 否则 home 的 `bg=#6B4220`（非 null）会先被铺满再被 `drawHomeBackground` 覆盖，造成双重填充/闪烁。**（关键接入点）**
  - 新增 `if (isHome) this.drawHomeBackground(pal);`（镜像 `drawDesertBackground`）。
- 切换清理（镜像 1321 的 `!isDesert` 块）：新增 `if (!isHome) { 销毁 homeWallGfx/homeFarGfx/homeMidGfx/homeLampGfx/homeNearGfx; }`，避免切关残留。
- 5 个 Graphics 句柄命名（镜像 desert 的 `desert*Gfx`）：`homeWallGfx`(0,-10) / `homeFarGfx`(0.3,-9) / `homeMidGfx`(0.6,-8) / `homeLampGfx`(0.6,-8,每帧) / `homeNearGfx`(1.2,4,每帧)。

---

## 2. 新敌/障碍/家具视图占位几何（pet / toy / sofa / table / cabinet）

> 权威定义见 home-biome-spec §3/§4；本节约为工程可消费的绘制伪代码级描述（对齐 `drawScorpion`/`drawCactus` 写法）。碰撞盒与各自类型一致，仅外观换皮；几何读 `EnemyAI.getBounds()`（pet/toy）或 `tile.kind`（家具），单一真相源，与碰撞盒一致。

### 2.1 `pet` 宠物（地面 / 不可踩 hard 顶 / 暖橙圆润四足 / 接触致伤·非致死）

| 部位 | 几何（bbox 36×28，anchor 居中） | 配色（锁色板） | 危害 | 可踩 |
|---|---|---|---|---|
| 主体 | 矮圆身 `fillRoundedRect(b.x, b.y, 36, 28, {tl:14,tr:14,bl:10,br:10})` | `暖橙 #F2933C` (#3) | 否（致伤） | 否（hard 顶） |
| 耳（上×2） | 两小圆角三角 `fillTriangle`，自顶缘向两侧上伸（宽 ~8、高 ~10） | `暖黄 #FFD23F` (#4) 内 | 否 | — |
| 暗部 | 底部 `darken(#F2933C,0.5)` ≈ `#79491E` 阴影带（底 1/3） | `rockBody #79491E` (tint) | 否 | — |
| 四足 | 4 短 `fillRoundedRect`（宽 ~6、高 ~7）自腹底向下 | `暖橙 #F2933C` + 描边 | 否 | — |
| 眼（小×2） | 头顶 `fillCircle(r 2)` | `天空 #5BC8F5` (#11) | 否 | — |
| 铃铛（颈） | 小圆 `fillCircle(r 2.5)` | `警示红 #E8483B` (#7) | 双编码提示 | — |
| 描边 | 全身 `lineStyle(1, #2A1A12)` | `#2A1A12` (#5) | — | — |

**双编码（hard 顶 = 不可踩）**：外形友好（暖橙圆润 + 暖黄耳 + 红铃），靠**红铃 + 碰撞判定** telegraph"非安全"——形状语言（圆润无刺）与硬顶敌（chong_feng 方/shi_pao 炮口）区分靠"是否可踩"语义 + 红铃微弱提示，色盲安全（不以单色判危险）。

**动画 / telegraph（idle / patrol）**：
- `patrol`：x 小幅往返（由 AI 驱动，非渲染），矮胖摇摇摆（整体 ±3px 微 bob，≤1Hz）；idle 耳微动（耳角 ±6°）。
- 渲染仅供视觉的微动（≤12fps 节奏，防光敏 <3Hz）；**Reduce Motion 下冻结微动首帧（见 §3），patrol 位移为玩法不冻结**。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: 36×28，anchor 居中；dir 由 enemy 状态机提供（facing）
const cx = b.x + b.w / 2, cy = b.y + b.h / 2
const BODY = 0xF2933C, EAR = 0xFFD23F, DARK = 0x79491E
const EYE = 0x5BC8F5, BELL = 0xE8483B, OUT = 0x2A1A12
// 1) 主体（矮圆）
g.fillStyle(BODY, 1); g.fillRoundedRect(b.x, b.y, 36, 28, {tl:14,tr:14,bl:10,br:10})
g.lineStyle(1, OUT, 1); g.strokeRoundedRect(b.x, b.y, 36, 28, {tl:14,tr:14,bl:10,br:10})
// 2) 暗部（底 1/3）
g.fillStyle(DARK, 1); g.fillRoundedRect(b.x+2, b.y+b.h*0.7, b.w-4, b.h*0.3, {tl:0,tr:0,bl:8,br:8})
// 3) 耳（上 ×2，暖黄）
g.fillStyle(EAR, 1)
g.fillTriangle(cx-10, b.y+2, cx-2, b.y+2, cx-6, b.y-8)   // 左耳
g.fillTriangle(cx+10, b.y+2, cx+2, b.y+2, cx+6, b.y-8)   // 右耳
g.lineStyle(1, OUT, 1)
g.strokeTriangle(cx-10, b.y+2, cx-2, b.y+2, cx-6, b.y-8)
g.strokeTriangle(cx+10, b.y+2, cx+2, b.y+2, cx+6, b.y-8)
// 4) 四足（下 ×4）
g.fillStyle(BODY, 1)
for i in 0..3: g.fillRoundedRect(b.x+4+i*9, b.y+b.h-4, 6, 7, 2)
// 5) 眼（天空蓝点）
g.fillStyle(EYE, 1); g.fillCircle(cx-6, b.y+11, 2); g.fillCircle(cx+6, b.y+11, 2)
// 6) 铃铛（颈，警示红，双编码"非安全"）
g.fillStyle(BELL, 1); g.fillCircle(cx, b.y+b.h*0.55, 2.5)
```

> 入 `drawEnemy` 分支：`if (e.type === 'pet') { drawPet(g, e); return; }`（仿 `scorpion` 分支）。

### 2.2 `toy` 玩具/拖鞋（地面 / 不可踩 / 小 hazard · 静止贴地）

| 部位 | 几何（bbox 20×16，anchor 底中贴地） | 配色（锁色板） | 危害 | 可踩 |
|---|---|---|---|---|
| 主体 | 小方块/小球 `fillRoundedRect(b.x, b.y, 20, 16, 5)` | `经济金 #F2C94C` (#8) | 否（致伤） | 否 |
| 尖角/危险边 | 四角小三角 `fillTriangle`（朝上/侧） | `警示红 #E8483B` (#7) 描边/尖 | 双编码"硬顶不可踩" | — |
| 描边 | 全身 `lineStyle(1, #2A1A12)` | `#2A1A12` (#5) | — | — |

**双编码（hard 顶 = 不可踩）**：经济金亮主体 + 警示红尖角 = "硬顶不可踩"形状语言（与 cactus 红刺同源但更小），静止贴地，无 idle/charge 区分（静态 telegraph 即可读）。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: 20×16，anchor 底中贴地
const cx = b.x + b.w / 2
const TOY = 0xF2C94C, SPIKE = 0xE8483B, OUT = 0x2A1A12
// 1) 主体（小圆角块）
g.fillStyle(TOY, 1); g.fillRoundedRect(b.x, b.y, 20, 16, 5)
g.lineStyle(1, OUT, 1); g.strokeRoundedRect(b.x, b.y, 20, 16, 5)
// 2) 尖角（上×2 + 侧×2，警示红，暗示硬顶不可踩）
g.fillStyle(SPIKE, 1)
g.fillTriangle(b.x+2, b.y, b.x+7, b.y, b.x+4.5, b.y-5)    // 左上尖
g.fillTriangle(b.x+13, b.y, b.x+18, b.y, b.x+15.5, b.y-5) // 右上尖
g.fillTriangle(b.x, b.y+4, b.x, b.y+12, b.x-5, b.y+8)     // 左尖
g.fillTriangle(b.x+20, b.y+4, b.x+20, b.y+12, b.x+25, b.y+8) // 右尖
```

> 入绘制分支：`if (e.type === 'toy') { drawToy(g, e); return; }`（建议加 `enemy-view.ts`，与 cactus 同族静态障碍写法；若工程倾向 hazard-view 分支亦可，**待 eng 确认**）。

### 2.3 家具地形化（sofa/table/cabinet = solid/oneway 复用 · 渲染分支）

> 家具经 base 瓦片 tint 映射为"可踩平台/实心 solid"，碰撞由 `tiles[]` 决定（tile-kind 方案，见 level-1-5-design §4.1），纯外观换皮（对齐 art-bible §5.3 "换色不换形"）。渲染在 `drawLevel` 瓦片循环内加 `kind` 分支。

**家具 kind → 碰撞语义（复用，0 新碰撞）**：

| 家具 kind | 碰撞语义 | 渲染主色 | 典型放置 |
|---|---|---|---|
| `sofa` 沙发 | = `solid`（全 AABB 实心，顶面可踩） | `rockFace #F2933C` + 暗面 `rockBody #79491E` | 矮块（1 格，ty6） |
| `table` 桌 | = `oneway`（仅顶面可踩） | `rockFace #F2933C` 桌面 + `rockBody #79491E` 腿 | 1 格厚桌面（ty5/4） |
| `cabinet` 柜 | = `solid`（全 AABB 实心） | `rockFace #F2933C` + 经济金 `#F2C94C` 把手 | 2–3 格高障碍 |

**渲染分支伪代码（在 `drawLevel` 瓦片循环内，替换原 `fillRect` 平铺）**：

```text
// 对每个 (tx,ty) 瓦片：
const k = tileKind(tx, ty)   // 待 eng 确认：暴露 kind 的 API（见 §2.5 待 eng 确认）
const X = tx*ts, Y = ty*ts
if (k === 'sofa' || k === 'cabinet') {
  // solid 家具：暖橙面 + 暗面 + 1px 描边 + 家具细节
  g.fillStyle(0xF2933C, 1); g.fillRect(X, Y, ts, ts)                 // 木面
  g.fillStyle(0x79491E, 1); g.fillRect(X, Y, ts, 6)                  // 顶暗带（受光少）
  g.lineStyle(1, 0x2A1A12, 1); g.strokeRect(X, Y, ts, ts)
  if (k === 'cabinet') {                                            // 柜：门缝 + 金把手
    g.lineStyle(1, 0x79491E, 1); g.lineBetween(X+ts/2, Y+4, X+ts/2, Y+ts-4)
    g.fillStyle(0xF2C94C, 1); g.fillCircle(X+ts/2-3, Y+ts/2, 1.5)
  } else {                                                          // 沙发：顶两坐垫凸
    g.fillStyle(0xF2933C, 1)
    g.fillRoundedRect(X+3, Y+2, ts/2-5, 6, 3)
    g.fillRoundedRect(X+ts/2+2, Y+2, ts/2-5, 6, 3)
  }
} else if (k === 'table') {
  // oneway 桌：仅顶半画桌面（同 oneway 行为），加桌沿高光 + 两短腿
  g.fillStyle(0xF2933C, 1); g.fillRect(X, Y, ts, ts/2)              // 桌面（顶半）
  g.lineStyle(1, 0xFFD23F, 0.8); g.lineBetween(X, Y+1, X+ts, Y+1)   // 桌沿暖黄高光
  g.lineStyle(1, 0x2A1A12, 1); g.strokeRect(X, Y, ts, ts/2)
  g.fillStyle(0x79491E, 1); g.fillRect(X+5, Y+ts/2, 4, ts/2-2); g.fillRect(X+ts-9, Y+ts/2, 4, ts/2-2) // 腿
} else if (isSolidTile) { /* 原逻辑：rockFace 平铺 */ }
  else if (isOneWayTile) { /* 原逻辑：rockBody 顶半 */ }
```

> 跨多格家具（如 cabinet c1 = tx25,26 两格宽）：单格画法会显"拼缝"。MVP 可接受；**待 eng 确认**是否按家具"run"合并绘制（检测连续同 kind 瓦片一次性画外形）。
> 家具顶面强制 1px `out-line` 描边（可访问性，vs 暖棕墙高对比，见 §5）。

### 2.4 与既有敌/元素剪影区分（色盲安全）

- **pet**：暖橙矮圆四足 + 暖黄耳 + 红铃，区别于 4 旧敌（圆/楔/扁/方）+ gu_bao（暖橙苞+顶刺）/jellyfish（半透天空蓝）/scorpion（暖橙长条+红尾）/cactus（草绿柱+红刺）。pet 以「圆润四足 + 耳」剪影唯一，避用命粉（与生命色解耦）。
- **toy**：经济金小方块 + 红尖角，区别于 pet（圆润无尖）、cactus（草绿大柱）。
- **家具**：暖橙木面 + 金把手（柜）/ 暖黄桌沿（桌），与地形 base 同色系但靠**家具细节（坐垫/门缝/腿）**区分装饰与碰撞，纯外观不引入新碰撞语义。
- 三者均靠**形状 + 颜色双编码**（红铃/红尖角 = 危险；金把手/暖黄沿 = 家具），不依赖单色，色盲安全。

### 2.5 待 eng 确认（家具渲染接入）

`drawLevel` 现有瓦片循环用 `isSolidTile/isOneWayTile` 判断，**未暴露 `tile.kind`**。加家具分支需工程暴露 kind（如 `this.world.getTileKind(tx,ty)` 或遍历 `runtime.data.tiles`）。**待 eng 确认** API 形态；本规格不写 src。

---

## 3. 减少动态（Reduce Motion）

> 来源：`platform.reduceMotion`（game-scene 已注入 `this.reduceMotion`，见 game-scene.ts:1312 附近）；对齐 home-biome-spec §5/§6 与 art-bible §9.3。家动态元素 4 项，均"冻结首帧/停相位"。

| 动态元素 | 正常行为 | Reduce Motion 处理 | 频率合规 |
|---|---|---|---|
| 台灯脉冲（中景） | 灯晕 α 呼吸 + 外扩 ≤2Hz | 冻结首帧（静态灯晕 + 固定 α=0.85，无缩放/呼吸） | ≤2Hz 正常亦合规 |
| 窗光脉冲（远景） | 窗内暖黄光晕 α 呼吸 ≤2Hz | 冻结首帧（静态光晕 α=0.3） | ≤2Hz 正常亦合规 |
| 窗帘（前景 near） | `curtainPhase` 推进，斜带飘移 | `curtainPhase` 不推进，静态斜带（门控可见时保持首帧形态） | — |
| 宠物微动（耳摆/摇曳） | 耳角 ±6° / 矮胖 bob ≤1Hz | 冻结微动首帧（静态耳 + 无 bob）；**patrol 位移为玩法不冻结** | ≤1Hz 正常亦合规 |
| 盆栽摇曳（中景，可选） | 叶尖 ±3px ≤2Hz | 冻结首帧（零偏移静态） | ≤2Hz 正常亦合规 |

- **统一机制**：所有家相位累加器（`lampPhase` / `windowPhase` / `curtainPhase` / `petBobPhase`）在 `reduceMotion === true` 时不推进，渲染用首帧常量（对齐 desert 的 `sunPhase`/`veilPhase` 冻结写法）。
- **保留**：静态轮廓/暗色/红铃/红尖角等全部保留 → 危险可读性与色盲安全不降级。
- **盆栽摇曳待 eng 确认**：home-biome-spec §5 将盆栽摇曳标为"可选 weather"，家 MVP 是否实装由工程/主理人拍板；若实装须遵守本表 Reduce Motion 冻结。

---

## 4. theme-palette 契约（home 8 槽 hex 表）

> 直接复制 `home-biome-spec.md` §8.2，供 eng 注册到 `THEME_PALETTES['home']`。本规格不写 `src/`。

### 4.1 家调色板注册表（解析器应消费的颜色常量名 + hex 映射）

| 引擎字段 | home Hex | 锁色板来源 | 备注 |
|---|---|---|---|
| `bg` | `0x6B4220` | `darken(#F2933C,0.55)` tint，0 新增 | 暖棕墙/天花板 |
| `rockFace` | `0xF2933C` | 暖橙 #3 | 木地板/家具主面 |
| `rockBody` | `0x79491E` | `darken(#F2933C,0.5)` tint，0 新增 | 家具暗面/天花板带/oneway |
| `out-line` | `0x2A1A12` | 描边 #5 | 全局描边 |
| `firelight` | `0xFFD23F` | 暖黄 #4 | 台灯暖晕/窗光/桌沿 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4（同 firelight，有意复用） | 台灯核心/相框内 |
| `crystalGlow` | `0x7CC242` | 草绿 #1 | 盆栽/相框内块 |
| `danger` | `0xE8483B` | 警示红 #7 | 玩具尖角/宠物铃铛 |

### 4.2 fail-safe 回退（同 desert §4.2）

- 工程 `resolveBiome(theme)` 对未知/缺省 theme **回退 `grass`**（现有行为）；
- 若 `THEME_PALETTES['home']` 尚未注册，背景/地形自动走 grass 常量（现有硬编码棕），**不抛错、零回归**；
- `LevelData.metadata.theme` 增 `'home'`（联合类型 `'grass'|'cave'|'vine_forest'|'storm_sky'|'sea'|'desert'|'home'`），未知回退 `'grass'`；
- 本规格**不写 src**；home entry 由 engineering-lead 按 §4.1 注册。

### 4.3 消费点映射（工程落地指引，非本规格写码）

| 消费点 | home 取值 |
|---|---|
| `drawTerrain` 地面/家具填充 | `THEME_PALETTES['home'].rockFace`(#F2933C) / `.rockBody`(#79491E) |
| 背景（天花板+墙） | `setBackgroundColor`/渐变用 `bg`(#6B4220) → `rockBody`(#79491E)（见 §1.2） |
| `pet` 分支（`enemy-view.ts` 新增） | 身=`0xF2933C`、耳=`0xFFD23F`、暗部=`0x79491E`、眼=`0x5BC8F5`、铃=`danger`(#E8483B)、描边=`out-line`；**禁用品红 `#F26D8B`** |
| `toy` 分支（`enemy-view.ts` 新增） | 主体=`0xF2C94C`、尖角=`danger`(#E8483B)、描边=`out-line` |
| 家具渲染分支（`drawLevel` 瓦片循环） | sofa/cabinet=`rockFace`(#F2933C)+`rockBody`(#79491E)+`out-line`；table=`rockFace` 桌面+`firelight` 沿+`rockBody` 腿；柜把手=`0xF2C94C` |
| 4 旧敌/gu_bao 在暖底关 | 沿用各自 biome 锁色板映射；靠 `out-line` + 功能色维持辨识（同 home-biome-spec §4.3，du_fu 加 `暖黄 #FFD23F` 肚皮斑） |

---

## 5. 可访问性校验（Home · 目标档 Standard）

> 口径：art-bible §9 + `art/accessibility.md`（MVP 目标 = **Standard**；防光敏 / 最小热区为硬底线）。逐项检查家主题。

| # | 检查项 | 结论 | 说明 |
|---|---|---|---|
| 1 | 前景/背景对比（≥3:1，关键≥4.5:1） | ✅ | 木地板 `#F2933C` vs 暖棕墙 `#6B4220` 亮度约 **1.5:1**（暖同色系，偏低）；靠**强制 1px 描边 `#2A1A12`**（描边 vs 墙 ≈7:1）+ `rockBody` 暗带 `#79491E` 兜底 → 平台顶缘边界 >4.5:1 达标。实体均有暗描边，与暖棕墙高对比。 |
| 2 | 色盲安全（形状+色双编码） | ✅ | 地面 hue=暖橙（家唯一「暖橙木地板+暖棕墙」组合）；pet=暖橙圆润四足+红铃（hard 顶）、toy=经济金块+红尖角、家具=暖橙木面+金把手/暖黄沿——均形状+颜色双编码。危险=警示红+尖/铃。 |
| 3 | 减少动态 / 静态 fallback | ✅ | 台灯/窗光脉冲/窗帘/盆栽摇曳（可选）/宠物微动相位在 Reduce Motion 下冻结首帧（静态），对齐 §3。 |
| 4 | 防光敏（<3Hz，单闪≤0.2s） | ✅ | 台灯/窗光脉冲 ≤2Hz、窗帘飘移 ≤2Hz、盆栽摇曳 ≤2Hz、宠物微动 ≤1Hz；无全屏高频闪。 |
| 5 | 最小可辨/可点尺寸 | ✅ | 实体≥32px（pet 36×28、toy 20×16 宽≥20 贴地小障，配合红尖角可读；家具单格 32×32）；UI 热区≥48×48（继承全局）。 |
| 6 | 非颜色状态提示 | ✅ | 受击=红闪+击退+无敌闪；踩怪=压扁+弹；pet 接触=掉血（红铃 telegraph）；toy=红尖角 telegraph；家具=实心形态 telegraph。 |

**结论**：Home 主题可达 **Standard 档**（MVP 目标）。唯一注意项 = 暖棕墙 `#6B4220` 与木地板 `#F2933C` 的亮度对比临界（≈1.5:1），**强制平台 1px 描边**即达标（与 cave/vine/storm/sea/desert 通用缓解一致）。全部零新增色，守 ADR-004。

### 5.1 与 cave / vine / storm / sea / desert 色相区分

| 主题 | 主色相 | 家区分点 |
|---|---|---|
| cave | 冷蓝灰 | 家=暖棕墙+暖橙木地板（非冷） |
| vine_forest | 草绿 | 家=暖橙木主导，草绿仅盆栽/相框点缀（非满屏绿） |
| storm_sky | 蓝紫 | 家=暖黄灯光+暖橙（非冷紫） |
| sea | 冷蓝天光+草绿 | 家=**暖棕室内墙（非冷蓝天空 #5BC8F5）**+暖橙木，暖调唯一 |
| desert | 暖橙沙岩+暖沙晴空 | 家=**暖棕墙（非晴空）+ 室内窗光/家具语言**（沙漠无家具/窗），且家墙面=暗暖棕 `#6B4220` 与沙漠晴空 `#F7BE8A` 明显异；地面同为暖橙但家多「木纹+家具形态」区分 |

> 家暖调（暖棕墙 + 暖橙木地板 + 暖黄灯晕 + 草绿盆栽）在六个主题中**色相唯一（纯室内暖调）**，色盲玩家靠地面 hue（暖橙）+ 室内形态（窗/相框/盆栽/家具）即可分辨，不撞色。

---

## 附：与 home-biome-spec 的交叉引用

- 本规格为 `home-biome-spec.md` 的**视觉落实扩展**：§1 背景层画法（室内）→ home-biome-spec §5（视差层级）；§2 新敌/障碍/家具几何 → §3（pet）/§4（toy+家具）；§3 Reduce Motion → §5/§6；§4 palette 衔接 → §1/§8；§5 可访问性 → §6。
- 实现须以 home-biome-spec 的 8 槽权威 hex + tint 为准；本规格不引入任何新 hex。
- 工程契约见 home-biome-spec §8；本规格 §4 为视觉侧对齐摘录。
- 结构镜像 `desert-visual-spec.md`（§0 红线 / §1 背景层 / §2 新敌几何 / §3 Reduce Motion / §4 palette / §5 可访问性 / 附 交叉引用），保证多主题视觉规格同构、工程可复用同一套绘制骨架。

---

## 待 eng / 主理人确认的开放点（汇总）

1. **`drawLevel` 背景分派排除 home**：现有 `if (!isSea && !isDesert && pal.bg !== null)` 平铺分支须扩展为排除 `isHome`，否则 home 的 `bg=#6B4220`（非 null）先被铺满再被 `drawHomeBackground` 覆盖，双重填充/闪烁。**关键接入点，需工程落地时处理（§1.7）。**
2. **家具渲染 kind 暴露**：`drawLevel` 瓦片循环现仅 `isSolidTile/isOneWayTile`，未暴露 `tile.kind`。加家具分支需工程暴露 kind（如 `getTileKind` 或遍历 `runtime.data.tiles`）。**待 eng 确认 API 形态（§2.5）。**
3. **中景台灯脉冲拆层**：台灯脉冲需每帧重绘，但 `drawDesertBackground` 的 mid 是 create-once。建议拆独立 `homeLampGfx`（scrollFactor 0.6, depth -8）每帧重绘灯晕，相框/盆栽/灯架仍 create-once。**待 eng 确认拆层方案（§1.4）。**
4. **窗光脉冲是否实装**：home-biome-spec §5 将窗光标为可含轻微脉冲；家 MVP 是否实装窗内暖黄光晕脉冲由主理人/工程拍板；若实装须遵守 §3 Reduce Motion 冻结。
5. **盆栽摇曳是否实装**：home-biome-spec §5 标为"可选 weather"。家 MVP 是否实装盆栽叶尖摇曳由主理人/工程拍板；若实装须遵守 §3 Reduce Motion 冻结。
6. **跨多格家具合并绘制**：cabinet c1 = 2 格宽，单格画法显拼缝；MVP 可接受，**待 eng 确认**是否按家具"run"合并绘制。
7. **toy 绘制分支归属**：toy 为小 hazard，建议加 `enemy-view.ts`（与 cactus 同族静态障碍），亦可走 hazard-view 分支。**待 eng 确认。**
8. **暖同色系对比（§5 #1）**：墙 `#6B4220` 与地板 `#F2933C` 对比 ≈1.5:1，依赖强制 1px 描边达标。若主理人认为需更强区分，可调整 `bg` tint 明度（仍须 0 新增 hex，仅调 `darken` 系数）——**待主理人拍板是否调参**。
9. **家具表达方式（tile-kind vs entity）**：设计侧倾向 tile-kind 方案（level-1-5-design §4.1），本规格渲染分支按 tile-kind 撰写；若主理人拍板改 entity 方案，渲染分支改由 `enemy-view` 的 `sofa/table/cabinet` 实体分支绘制（碰撞由实体 AABB 接管），本规格 §2.3 伪代码需相应迁移。**待主理人拍板（附录 B-2 of level-1-5-design）。**

> 本文件为家（室内）主题视觉落实规格（加法），roadmap 批次 3（世界 1 第 5 关 1-5《归巢》）；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 home-biome-spec §8 契约 + 本规格 §1–§2 绘制参数）。
