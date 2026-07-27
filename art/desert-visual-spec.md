# 沙漠主题视觉落实规格（desert-visual-spec）

> 文档类型：视觉落实规格（加法扩展，衔接 `art/desert-biome-spec.md` 的 §1/§3/§5/§8，供工程侧落地 1-4 背景与专属敌/障碍皮肤）
> 作者：art-director（林绘澄）
> 上游依据：`art/desert-biome-spec.md`（8 槽权威映射 + tint + scorpion/cactus/quicksand 视觉）｜`art/sea-visual-spec.md`（本规格结构镜像基线）｜`art/cave-biome-spec.md` §2/§5/§6（同构）｜`src/game/render/enemy-view.ts`（现有 `drawEnemy` 分支结构，需加 scorpion/cactus 分支）｜`src/game/scenes/game-scene.ts` 的 `drawSeaBackground` / 五层背景模式（沙漠背景镜像其 5 层结构：天空/远景 far 0.3 / 中景 mid 0.6 / 游戏层 1.0 / 前景 near 1.2）
> 关联任务：roadmap 批次 3（沙漠 1-4）｜评审强度：lean
> **红线**：锁色板 ≤64、COLOR DELTA = 0 新增 hex（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts`、不 git commit**；theme 名严格 `desert`；MVP 全程序化占位（Graphics，零 PNG，ADR-004）；IP 全原创、避任天堂符号。

---

## 0. 范围与权威色引用（红线基准）

本规格把 `desert-biome-spec.md` 的视觉意图落成**工程可消费的程序化绘制规格**：背景层画法、scorpion/cactus/quicksand 绘制、减少动态处理、theme-palette 衔接。玩法/数值（quicksand 下陷/触底判定）由对应 GDD 与工程负责，本规格只定义"长什么样 + 怎么画"。

**零 PNG 声明**：本规格全部视觉效果经 Phaser `Graphics` 程序化绘制（ADR-004）；不引入任何 PNG/JPG/SVG；多主题切换 = 调色板数据切换 + 背景层参数变化 + 装饰绘制参数差异。包体增量 ≈ 0。

### 0.1 权威 11 色锁色板（全部引用，0 新增）

| # | 名 | Hex | 本规格用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 仙人掌主体 / `crystalCore` / 绿洲植披 |
| 2 | 阴影绿 | `#5FA82F` | 仙人掌暗部 tint 源（可选，本规格用 `darken(#7CC242,0.5)`） |
| 3 | 暖橙 | `#F2933C` | **沙岩主面 / 蝎子身 / 阳光** / `rockFace` / `firelight` 同源 |
| 4 | 暖黄 | `#FFD23F` | 阳光核心 / 沙金辉光 / `crystalCore` 取用 / `firelight` |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享）/ `out-line` |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，本关不用于敌） |
| 7 | 警示红 | `#E8483B` | 危险语义（蝎尾刺 / 仙人掌刺 / quicksand 漩涡核）/ `danger` |
| 8 | 经济金 | `#F2C94C` | coin（沿用）/ 沙金辉光 / `crystalGlow` |
| 9 | 蓝紫 | `#6E7BF2` | 太阳冷辉晕（冷中藏暖反差，极少用，alpha ≤0.2） |
| 10 | 环境冷蓝 | `#4A78C0` | 阴影 tint 源（冷调投影，落于实体下方） |
| 11 | 天空 | `#5BC8F5` | 蝎眼点（小）/ 沙晴空**不**用此冷蓝（沙漠晴空以暖 tint 代） |

### 0.2 本规格使用的 tint 派生（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 沙晴空 bg | `lighten(#F2933C, 0.4)` ≈ `#F7BE8A` | 天空填充（暖调，非冷蓝） | 0 新增（tint） |
| 沙岩暗面 rockBody | `darken(#F2933C, 0.5)` ≈ `#79491E` | 沙岩底/oneway / 远景沙丘剪影 / 流沙漩涡 | 0 新增（tint） |
| 仙人掌暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 仙人掌阴影侧 | 0 新增（tint） |
| 冷调投影 | `darken/darken(#4A78C0, ...)` ≈ `#4A78C0` 直接作半透 | 实体下方冷调投影 | 0 新增（锁色板 #10 原色半透） |

### 0.3 内部分辨率 / 网格硬约束

`512×288` 内分辨率，32px 瓦片网格，`pixelArt: true`，整数缩放。所有 Graphics 绘制坐标按此基准；视差通过 `scrollFactor` 实现（天空层 `scrollFactor=0`，远景 0.3，中景 0.6，游戏层 1.0，前景 1.2）。

---

## 1. desert 背景层程序化绘制规格（零 PNG · 全 Graphics）

### 1.1 图层架构（镜像 game-scene `drawSeaBackground` 五层结构 + desert-biome-spec §5）

沙漠复用 5 层深度结构，仅沙漠主题填充参数；任务要求的"远/中/近三层视差" = 远景(0.3) + 中景(0.6) + 前景近景沙幕(1.2)。

| 层 | depth / scrollFactor | 内容 | 配色（锁色板） | 绘制 API 建议 |
|---|---|---|---|---|
| 天空 | -10（scrollFactor 0） | 暖沙晴空纯色 / 竖直渐变 + 顶部日光晕 | `bg #F7BE8A` → 顶 `firelight #FFD23F` α≤0.4 | `fillGradientStyle` + `fillRect` |
| 远景 far | -9（scrollFactor 0.3） | 沙丘剪影带 | `darken(#F2933C,0.5)` ≈ `#79491E` 剪影，无描边 | `fillPoints` 起伏带 |
| 中景 mid | -8（scrollFactor 0.6） | 金字塔/遗迹 + 仙人掌 + 太阳 | `#F2933C` + `#7CC242` + `#FFD23F` | `fillPoints`/`fillRoundedRect`/`fillCircle` |
| 游戏层 game | 0（scrollFactor 1.0） | 沙岩地形 + 敌/障碍/道具/主角 + quicksand overlay | `rockFace #F2933C` / `rockBody #79491E` / 描边 | `drawTerrain`（见 desert-biome-spec §8.3） |
| 前景 near | 4（scrollFactor 1.2，克制） | 偶尔沙幕掠过 | `#F2933C` alpha ≤0.4 + 暖黄高光点 | 屏幕锚定飘带 `fillPath` |

> 中景太阳脉冲（≤2Hz）与前景沙幕为**每帧轻量重绘**；远景/金字塔/仙人掌为 **create 时一次绘制**，仅 scrollFactor 驱动视差滚动，运行时零重绘。太阳脉冲因需每帧重绘，建议拆到独立小 Graphics（见 §1.4 末"待 eng 确认"）。

### 1.2 天空层（scrollFactor 0，depth -10）

- 用 `fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha)` 画全屏竖直渐变：
  - **顶部** `bg = lighten(#F2933C,0.4)` ≈ `#F7BE8A`（暖沙晴空，tint 派生，0 新增）；
  - **近地平线端** 衔接 `firelight #FFD23F`（暖黄，α≤0.4）作暖辉光增强"灼热"感；纯 `#F7BE8A` 单色填充亦符合 desert-biome-spec §5（"纯色填充"），渐变仅作纵深增强。
  - 单次 `fillRect(0, 0, camW, camH)` 即可，极廉价。
- 该层 `scrollFactor=0` 不随相机滚动；沙漠**无水位线**，无海平线分界，全屏纯暖空。
- 天空辉光（可选，冷中藏暖反差）：极淡 `蓝紫 #6E7BF2` α≤0.2 叠于顶部一角，仅 1 处、面积 ≤5% 屏，提示"暖中藏冷"（art-bible §3.3）；**默认关，待 eng 确认是否启用**。

### 1.3 远景 far（parallax 0.3，depth -9）— 沙丘剪影

- 沙丘剪影带：一条起伏带，颜色 `darken(#F2933C, 0.5)` ≈ `#79491E`（tint 派生，0 新增），**无描边、低饱和**（对齐 art-bible §5.1「远景降饱和无描边」），与中景暖橙沙岩拉开层次。
- 画法：`fillPoints`（`push` 正弦顶 `amp 12–18px / wl 150–220px` + 收底两角）铺满 `levelW`（= `runtime.data.width * tileSize`）以支撑视差。
- 沙丘剪影带置于地平线附近（约 `levelH * 0.62` 起），纯氛围非碰撞。
- draw call：far 1 次（`fillPoints` 单 path）。

### 1.4 中景 mid（parallax 0.6，depth -8）— 金字塔 + 仙人掌 + 太阳

- **金字塔/遗迹 `deco_pyramid`**：钝角三角（2 面拼一角）
  - 左受光面：`rockFace #F2933C`；右暗面：`rockBody #79491E`（tint 派生）；
  - 描边 `#2A1A12`（1px，仅中景地标轻微描边，区别于远景无描边）；
  - 几何：`fillPoints` 左三角 `{顶, 底左, 底中}` + 右三角 `{顶, 底中, 底右}`，底宽 ~64–96px、高 ~48–72px；2–3 座错落（x ≈ `levelW*0.18 / 0.52 / 0.8`）。
- **仙人掌 `deco_cactus`（中景装饰，非碰撞）**：
  - 主体：`crystalCore #7CC242` 竖柱 + `darken(#7CC242,0.5)` ≈ `#3E6121` 暗部侧（柱右 1/3 涂暗）；
  - 侧臂：1–2 条 `fillRoundedRect` 短臂（宽 ~8、高 ~16）自柱中向两侧上伸；
  - 刺：周身短 `danger #E8483B` 点（中景装饰刺非致死，仅形态点缀，≤6 点）；
  - 描边 `#2A1A12`（1px）。2–3 处与金字塔错开。
- **太阳 `deco_sun`**：
  - 圆：`firelight #FFD23F` `fillCircle`（r ≈ 18–24，置于天空上部 `levelH*0.18` 附近）；
  - 光芒：8–12 条短 `lineStyle(2, #FFD23F, 0.5)` 放射线（长 ~10px）；
  - **脉冲（≤2Hz）**：整体缩放 `1 + sin(phase)*0.06` + 核心 α 在 0.7–1.0 间呼吸（防光敏 <3Hz）；Reduce Motion 下冻结首帧（见 §3）。
- 中景 create 时一次绘制（金字塔/仙人掌/太阳本体）；**太阳脉冲因每帧重绘，建议拆到独立小 Graphics `desertSunGfx`（scrollFactor 0.6, depth -8 同层）每帧重绘仅光晕+缩放，金字塔/仙人掌仍 create-once** —— **待 eng 确认**拆层方案。
- draw call：mid 静态（金字塔×3 + 仙人掌×3 + 太阳×1）≈ 7，均 ≤15。

### 1.5 前景 near（parallax 1.2，depth 4，克制）— 偶尔沙幕掠过

- **沙幕 `deco_sandveil`**：近景偶尔掠过的半透沙幕，营造风沙流动；屏幕锚定（随相机 1.2 视差），相位偏移 `fillPath` 斜飘带。
  - 画法：维护 `veilPhase`；`g.clear()` → `fillStyle(#F2933C, 0.25–0.4)` → `fillPoints` 一条斜向飘带（2–3 段折线拟沙流）+ 数枚 `firelight #FFD23F` α≤0.3 高光点；
  - **周期性出现，非持续**：用 `sin(veilPhase * 0.2) > 0.6` 门控，仅约 30% 时间可见，其余时间透明（克制遮挡）；
  - 遮挡 ≤10% 路径，仅屏幕侧缘掠过，不挡关键平台/主角。
- **减少动态**：Reduce Motion 下 `veilPhase` 不推进（冻结首帧），沙幕成静态斜带（见 §3）。
- draw call：near 1 次（`fillPath` 单 path + 点）。

### 1.6 性能预算

每层总 draw call ≤ 15（sky 1 + far 1 + mid 静态 ~7 + near 1 + 游戏层地形按 tile 数），远低于移动端阈值。每帧仅 near 沙幕 + 太阳脉冲（独立层）轻量重绘 ≈ 0.1ms，可忽略；far/mid/sky create 时一次绘制，仅 scrollFactor 驱动视差滚动，运行时零重绘。quicksand overlay（§2.3）每帧重绘但为局部区域，draw call ≈ 2–4。

---

## 2. 新敌/障碍视图占位几何（scorpion / cactus / quicksand）

> 权威定义见 desert-biome-spec §3；本节约为工程可消费的绘制伪代码级描述（对齐 `drawJellyfish` 写法）。碰撞盒与各自类型一致，仅外观换皮；几何读 `EnemyAI.getBounds()`，单一真相源，与碰撞盒一致。

### 2.1 `scorpion` 蝎子（地面 / 不可踩 / hard 顶 / 暖橙+警示红）

| 部位 | 几何（bbox 40×24，anchor 居中） | 配色（锁色板） | 危害 | 可踩 |
|---|---|---|---|---|
| 主体 | 长条身 `fillRoundedRect(b.x, b.y, 40, 24, {tl:8,tr:8,bl:6,br:6})` | `暖橙 #F2933C` (#3) | 否 | 否 |
| 钳（前×2） | 两个小三角 `fillTriangle`，自前缘向 facing 外伸（宽 ~10、高 ~8） | `darken(#F2933C,0.5)` ≈ `#79491E` (tint) | 否 | — |
| 尾（后，上翘） | 分段尾：2–3 节 `fillCircle`（r 4→3→2）+ 末节上扬；尾尖朝外 | 节 `暖橙 #F2933C`，尖 `danger #E8483B` | 尖刺致命 | — |
| 腿（下×4–6） | 短 `lineStyle(2, #79491E)` 自腹底向下微张 | `darken(#F2933C,0.5)` | 否 | — |
| 眼（小×2） | 头顶 `fillCircle(r 2)` | `天空 #5BC8F5` (#11) | 否 | — |
| 描边 | 全身 `lineStyle(1, #2A1A12)` | `#2A1A12` (#5) | — | — |

**双编码（hard 顶 = 不可踩）**：上翘尾刺 + 警示红尖 = 致命/不可踩形状语言，与软顶圆角敌（ci_li/du_fu）清晰区分。

**动画 / telegraph（idle / charge）**：
- `idle`：钳微张（前伸角 ±6°）、尾自然下垂微摆（≤1Hz，防光敏）；主体静止。
- `charge`（蓄力 telegraph）：尾刺**上扬**（尾末节角度抬升至朝天/朝玩家）+ 尾尖 `danger #E8483B` α 在 0.7–1.0 间闪（≤2Hz，提示"即将攻击"）；钳收拢前探。charge 结束回 idle。
- 绘制伪代码（MVP Graphics）：

```text
// bbox: 40×24，anchor 居中；state 由 enemy 状态机提供（idle/charge）
const cx = b.x + b.w / 2, cy = b.y + b.h / 2
// 1) 主体（长条圆角）
g.fillStyle(0xF2933C, 1); g.fillRoundedRect(b.x, b.y, 40, 24, {tl:8,tr:8,bl:6,br:6})
g.lineStyle(1, 0x2A1A12, 1); g.strokeRoundedRect(b.x, b.y, 40, 24, {tl:8,tr:8,bl:6,br:6})
// 2) 腿（下 4–6 条，暗面）
g.lineStyle(2, 0x79491E, 1)
for i in 0..4: g.lineBetween(b.x+6+i*7, b.y+b.h, b.x+4+i*7, b.y+b.h+5)
// 3) 钳（前 ×2，朝 facing dir）
const fx = dir>0 ? b.x+b.w : b.x
g.fillStyle(0x79491E, 1)
g.fillTriangle(fx, cy-6, fx+dir*10, cy-9, fx+dir*10, cy-2)  // 上钳
g.fillTriangle(fx, cy+6, fx+dir*10, cy+9, fx+dir*10, cy+2)  // 下钳
// 4) 尾（后，上翘；charge 时抬高）
const tailBaseX = dir>0 ? b.x : b.x+b.w
const raise = state==='charge' ? -14 : -6      // charge 上扬更高
g.fillStyle(0xF2933C, 1)
g.fillCircle(tailBaseX - dir*4, cy, 4)
g.fillCircle(tailBaseX - dir*10, cy-4, 3)
g.fillCircle(tailBaseX - dir*15, cy+raise, 2.5)
// 5) 尾尖（danger，charge 时闪光）
const tipA = state==='charge' ? 0.7 + 0.3*Math.sin(t*8) : 1  // ≤2Hz
g.fillStyle(0xE8483B, tipA)
g.fillTriangle(tailBaseX-dir*15-2, cy+raise, tailBaseX-dir*15+2, cy+raise, tailBaseX-dir*20, cy+raise-6)
// 6) 眼（天空蓝点）
g.fillStyle(0x5BC8F5, 1); g.fillCircle(cx+dir*10, b.y+8, 2); g.fillCircle(cx+dir*10, b.y+16, 2)
```

> 入 `drawEnemy` 分支：`if (e.type === 'scorpion') { drawScorpion(g, e); return; }`（仿 `jellyfish` 分支）。

### 2.2 `cactus` 仙人掌（固定 / 不可踩 / hard 顶 / 草绿+警示红）

| 部位 | 几何（bbox 24×48，anchor 底中贴地） | 配色（锁色板） | 危害 | 可踩 |
|---|---|---|---|---|
| 主体 | 竖柱 `fillRoundedRect(b.x, b.y, 24, 48, {tl:10,tr:10,bl:4,br:4})` | `草绿 #7CC242` (#1) | 否 | 否 |
| 暗部 | 柱右 1/3 涂暗 | `darken(#7CC242,0.5)` ≈ `#3E6121` (tint) | 否 | — |
| 侧臂 | 1–2 条 `fillRoundedRect`（宽 ~8、高 ~14）自柱中向两侧上伸 | `草绿 #7CC242` + 暗部 | 否 | — |
| 刺（周身） | 短 `lineStyle(1, #E8483B)` 向四方放射（每面 2–3 根，长 ~4px） | `danger #E8483B` (#7) | 刺致命 | — |
| 描边 | 全身 `lineStyle(1, #2A1A12)` | `#2A1A12` (#5) | — | — |

**双编码（hard 顶 = 不可踩）**：草绿柱 + 周身红刺 = 危险形状语言；固定不动物，无 idle/charge 区分（静态 telegraph 即可读）。

**绘制伪代码（MVP Graphics）**：

```text
// bbox: 24×48，anchor 底中贴地
const cx = b.x + b.w / 2
// 1) 主体（竖柱）
g.fillStyle(0x7CC242, 1); g.fillRoundedRect(b.x, b.y, 24, 48, {tl:10,tr:10,bl:4,br:4})
g.lineStyle(1, 0x2A1A12, 1); g.strokeRoundedRect(b.x, b.y, 24, 48, {tl:10,tr:10,bl:4,br:4})
// 2) 暗部（右 1/3）
g.fillStyle(0x3E6121, 1); g.fillRoundedRect(b.x+16, b.y, 8, 48, {tl:0,tr:10,bl:0,br:4})
// 3) 侧臂（左/右各一）
g.fillStyle(0x7CC242, 1)
g.fillRoundedRect(b.x-8, b.y+20, 10, 16, 4)   // 左臂
g.fillRoundedRect(b.x+22, b.y+14, 10, 18, 4)  // 右臂
g.lineStyle(1, 0x2A1A12, 1)
g.strokeRoundedRect(b.x-8, b.y+20, 10, 16, 4); g.strokeRoundedRect(b.x+22, b.y+14, 10, 18, 4)
// 4) 刺（周身红，短放射）
g.lineStyle(1, 0xE8483B, 1)
for i in 0..5:  // 主体左右刺
  const yy = b.y + 8 + i*7
  g.lineBetween(b.x, yy, b.x-4, yy-2); g.lineBetween(b.x+24, yy, b.x+28, yy-2)
// 5) 顶刺（强化 hard 顶）
g.lineBetween(cx, b.y, cx-3, b.y-5); g.lineBetween(cx, b.y, cx+3, b.y-5)
```

> 入 `drawEnemy` 分支：`if (e.type === 'cactus') { drawCactus(g, e); return; }`。

### 2.3 `quicksand` 流沙区（地形机制陷阱·非碰撞体）

- **视觉**：地面 `rockFace #F2933C` 区域叠 `darken(#F2933C,0.5)` ≈ `#79491E` **漩涡/同心纹理** + 缓慢内陷动画（≤3Hz，防光敏）；非碰撞体，由 GDD 02/03 下陷速度判定触底=死亡（复用 07）。
- **双编码**：下陷漩涡 + 暗色 = "危险地形" telegraph，不靠单色（色盲安全）。
- **几何（建议 overlay Graphics，世界坐标，scrollFactor 1.0，depth 3，介于地形 0 与实体 7–12 之间，每帧重绘）**：
  - 区域矩形 `fillStyle(#F2933C, 1)` 铺底（与周围沙岩同色，无缝融入）；
  - 漩涡：`fillPoints` 同心多圈（2–3 圈，半径递减压扁）涂 `#79491E` α 0.3–0.6，中心最暗；
  - 内陷动画：`sinkPhase` 驱动同心圈半径缓慢收缩（`r *= 1 - 0.02*sin(sinkPhase)`，≤3Hz），暗示"被吸入"；
  - 边缘：`lineStyle(1, #2A1A12, 0.4)` 轻描边区分流沙边界（可选，弱）。
- **Reduce Motion**：`sinkPhase` 冻结（静态同心圈，不收缩），仍保留暗色漩涡 = 危险可读（见 §3）。
- **待 eng 确认**：quicksand 为新增每帧 overlay 层（类比 `tideGfx`），需工程在 `drawLevel` 内按 `theme==='desert'` 创建 `quicksandGfx`（depth 3）并在 `update` 每帧 `drawQuicksandOverlay()`；其触发/触底死亡判定由 GDD 02/03/07 负责，本规格不重定义碰撞盒。

```text
// 每帧：drawQuicksandOverlay(g, zones, elapsedMs, reduceMotion)
g.clear()
const SAND = 0xF2933C, SWIRL = 0x79491E, OUT = 0x2A1A12
if (!reduceMotion) sinkPhase += dt * 1.5   // ≤3Hz 内陷
for z in zones:
  g.fillStyle(SAND, 1); g.fillRect(z.x, z.y, z.w, z.h)   // 融入沙底
  for ring in 0..2:
    const rr = (z.h*0.4) * (1 - ring*0.28) * (1 - 0.04*Math.sin(sinkPhase+ring))
    g.fillStyle(SWIRL, 0.35 + ring*0.12)
    g.fillEllipse(z.x+z.w/2, z.y+z.h/2, rr*2, rr)        // 同心内陷
  g.lineStyle(1, OUT, 0.4); g.strokeRect(z.x, z.y, z.w, z.h)
```

### 2.4 与既有敌/元素剪影区分（色盲安全）

- **scorpion**：暖橙长条身 + 红尾刺 + 暗钳，区别于 4 旧敌（圆/楔/扁/方）；区别于 cactus（草绿柱）、gu_bao（暖橙苞+顶刺）、jellyfish（半透天空蓝伞）、bouncy_vine（草绿线圈）、cyclone（半透气柱）。
- **cactus**：草绿柱 + 红刺，区别于 bramble（贴地低刺丛）、gu_bao（苞+顶刺）、scorpion（移动长条）。
- **quicksand**：暗漩涡下陷地形，区别于普通沙岩（无漩涡/无内陷）。
- 三者均靠**形状 + 颜色双编码**（红刺/红尾/暗漩涡 = 危险），不依赖单色，色盲安全。

---

## 3. 减少动态（Reduce Motion）

> 来源：`platform.reduceMotion`（game-scene 已注入 `this.reduceMotion`，见 game-scene.ts:312）；对齐 desert-biome-spec §5/§6 与 art-bible §9.3。沙漠动态元素 3 项，均"冻结首帧/停相位"。

| 动态元素 | 正常行为 | Reduce Motion 处理 | 频率合规 |
|---|---|---|---|
| 太阳脉冲（中景） | 缩放 `1±0.06` + α 呼吸 ≤2Hz | 冻结首帧（静态圆 + 固定 α=0.85，无缩放/呼吸） | ≤2Hz 正常亦合规 |
| 沙幕（前景 near） | `veilPhase` 推进，斜带飘移 | `veilPhase` 不推进，静态斜带（门控可见时保持首帧形态） | — |
| 热浪（可选，底部 30px） | 横向微偏移正弦扭曲 ≤3Hz | 冻结首帧（零偏移静态） | ≤3Hz 正常亦合规 |
| quicksand 内陷 | `sinkPhase` 同心圈收缩 ≤3Hz | `sinkPhase` 冻结（静态同心圈，仍暗色可读） | ≤3Hz 正常亦合规 |

- **统一机制**：所有沙漠相位累加器（`sunPhase` / `veilPhase` / `heatPhase` / `sinkPhase`）在 `reduceMotion === true` 时不推进，渲染用首帧常量（对齐 sea 的 `tidePhase`/`seaNearPhase` 冻结写法）。
- **保留**：静态轮廓/暗色/红刺等全部保留 → 危险可读性与色盲安全不降级。
- **热浪待 eng 确认**：desert-biome-spec §5 将热浪标为"可选 weather"，沙漠 MVP 是否实装热浪由工程/主理人拍板；若实装须遵守本表 Reduce Motion 冻结。

---

## 4. theme-palette 契约（desert 8 槽 hex 表）

> 直接复制 `desert-biome-spec.md` §8.2，供 eng 注册到 `THEME_PALETTES['desert']`。本规格不写 `src/`。

### 4.1 沙漠调色板注册表（解析器应消费的颜色常量名 + hex 映射）

| 引擎字段 | desert Hex | 锁色板来源 | 备注 |
|---|---|---|---|
| `bg` | `0xF7BE8A` | `lighten(#F2933C,0.4)` tint，0 新增 | 暖沙晴空 |
| `rockFace` | `0xF2933C` | 暖橙 #3 | 沙岩主面 |
| `rockBody` | `0x79491E` | `darken(#F2933C,0.5)` tint，0 新增 | 沙岩暗面/oneway |
| `out-line` | `0x2A1A12` | 描边 #5 | 全局描边 |
| `firelight` | `0xFFD23F` | 暖黄 #4 | 阳光核心 |
| `crystalCore` | `0x7CC242` | 草绿 #1 | 仙人掌绿 |
| `crystalGlow` | `0xF2C94C` | 经济金 #8 | 沙金辉光 |
| `danger` | `0xE8483B` | 警示红 #7 | 危险双编码 |

### 4.2 fail-safe 回退（同 sea §6.2）

- 工程 `resolveBiome(theme)` 对未知/缺省 theme **回退 `grass`**（现有行为）；
- 若 `THEME_PALETTES['desert']` 尚未注册，背景/地形自动走 grass 常量（现有硬编码棕），**不抛错、零回归**；
- `LevelData.metadata.theme` 增 `'desert'`（联合类型 `'grass'|'cave'|'vine_forest'|'storm_sky'|'sea'|'desert'`），未知回退 `'grass'`；
- 本规格**不写 src**；desert entry 由 engineering-lead 按 §4.1 注册。

### 4.3 消费点映射（工程落地指引，非本规格写码）

| 消费点 | desert 取值 |
|---|---|
| `drawTerrain` 地面填充 | `THEME_PALETTES['desert'].rockFace`(#F2933C) / `.rockBody`(#79491E) |
| 背景色/天空 | `setBackgroundColor(THEME_PALETTES['desert'].bg)`(#F7BE8A)；渐变见 §1.2 |
| `scorpion` 分支（`enemy-view.ts` 新增） | 身=`0xF2933C`、尾尖=`danger`(#E8483B)、钳/腿=`0x79491E`、眼=`0x5BC8F5`、描边=`out-line` |
| `cactus` 分支（`enemy-view.ts` 新增） | 主体=`crystalCore`(#7CC242)、暗部=`0x3E6121`、刺=`danger`(#E8483B)、描边=`out-line` |
| quicksand overlay | 底=`rockFace`(#F2933C)、漩涡=`rockBody`(#79491E)、描边=`out-line` |
| 4 旧敌/gu_bao 在暖底关 | 沿用各自 biome 锁色板映射；靠 `out-line` + 功能色维持辨识（同 desert-biome-spec §4） |

---

## 5. 可访问性校验（Desert · 目标档 Standard）

> 口径：art-bible §9 + `art/accessibility.md`（MVP 目标 = **Standard**；防光敏 / 最小热区为硬底线）。逐项检查沙漠主题。

| # | 检查项 | 结论 | 说明 |
|---|---|---|---|
| 1 | 前景/背景对比（≥3:1，关键≥4.5:1） | ⚠️→✅ | 沙岩 `#F2933C` vs 沙晴空 `#F7BE8A` 亮度约 **1.3:1**（暖同色系，偏低）；靠**强制 1px 描边 `#2A1A12`**（描边 vs 晴空 ≈7:1）+ `rockBody` 暗面 `#79491E` 兜底 → 平台顶缘边界 >4.5:1 达标。实体均有暗描边，与亮天空高对比。**待 eng 确认**：暖同色系天空/地面对比是沙漠唯一弱项，强制描边即达标（与 cave/vine/storm/sea 通用缓解一致）。 |
| 2 | 色盲安全（形状+色双编码） | ✅ | 地面 hue=暖橙（沙漠唯一「暖橙沙」组合）；scorpion=暖橙身+红尾刺（hard 顶）、cactus=草绿柱+红刺、quicksand=暗漩涡下陷——均形状+颜色双编码。危险=警示红+尖/硬形。 |
| 3 | 减少动态 / 静态 fallback | ✅ | 太阳脉冲/沙幕/热浪(可选)/quicksand 内陷相位在 Reduce Motion 下冻结首帧（静态），对齐 §3。 |
| 4 | 防光敏（<3Hz，单闪≤0.2s） | ✅ | 太阳脉冲 ≤2Hz、沙幕飘移 ≤2Hz（相位推进）、热浪 ≤3Hz、quicksand 内陷 ≤3Hz；无全屏高频闪。 |
| 5 | 最小可辨/可点尺寸 | ✅ | 实体≥32px（scorpion 40×24 宽≥32、cactus 24×48、quicksand 区域更大）；UI 热区≥48×48（继承全局）。 |
| 6 | 非颜色状态提示 | ✅ | 受击=红闪+击退+无敌闪；踩怪=压扁+弹；scorpion charge=尾刺上扬+红闪 telegraph；quicksand=内陷漩涡 telegraph。 |

**结论**：Desert 主题可达 **Standard 档**（MVP 目标）。唯一注意项 = 沙晴空 `#F7BE8A` 与沙岩 `#F2933C` 的亮度对比临界（≈1.3:1），**强制平台 1px 描边**即达标。全部零新增色，守 ADR-004。

### 5.1 与 cave / vine / storm / sea 色相区分

| 主题 | 主色相 | 沙漠区分点 |
|---|---|---|
| cave | 冷蓝灰 | 沙漠=暖橙沙岩（非冷） |
| vine_forest | 草绿 | 沙漠=暖橙主导，草绿仅仙人掌点缀（非满屏绿） |
| storm_sky | 蓝紫 | 沙漠=暖黄阳光+暖橙（非冷紫） |
| sea | 冷蓝天光+草绿 | 沙漠=**暖沙晴空（非冷蓝天空 #5BC8F5）**+暖橙沙，暖调唯一 |

> 沙漠暖调（暖橙沙岩 + 暖沙晴空）在五个主题中**色相唯一**，色盲玩家靠地面 hue（暖橙）+ 装饰形态（沙丘/金字塔/仙人掌）即可分辨，不撞色。

---

## 附：与 desert-biome-spec 的交叉引用

- 本规格为 `desert-biome-spec.md` 的**视觉落实扩展**：§1 背景层画法 → desert-biome-spec §5（视差层级）；§2 新敌几何 → §3（scorpion/cactus/quicksand）；§3 Reduce Motion → §5/§6；§4 palette 衔接 → §1/§8；§5 可访问性 → §6。
- 实现须以 desert-biome-spec 的 8 槽权威 hex + tint 为准；本规格不引入任何新 hex。
- 工程契约见 desert-biome-spec §8；本规格 §4 为视觉侧对齐摘录。
- 结构镜像 `sea-visual-spec.md`（§0 红线 / §1 背景层 / §2 新敌几何 / §3 Reduce Motion / §4 palette / §5 可访问性 / 附 交叉引用），保证多主题视觉规格同构、工程可复用同一套绘制骨架。

---

## 待 eng / 主理人确认的开放点（汇总）

1. **中景太阳脉冲拆层**：太阳脉冲需每帧重绘，但 `drawSeaBackground` 的 mid 是 create-once。建议拆独立 `desertSunGfx`（scrollFactor 0.6, depth -8）每帧重绘脉冲光晕，金字塔/仙人掌仍 create-once。**待 eng 确认拆层方案。**
2. **热浪（heat shimmer）是否实装**：desert-biome-spec §5 标为"可选 weather"。沙漠 MVP 是否实装底部 30px 热浪扭曲由主理人/工程拍板；若实装须遵守 §3 Reduce Motion 冻结。
3. **quicksand overlay 层**：需新增每帧 overlay（类比 `tideGfx`，depth 3），其触发/触底死亡判定由 GDD 02/03/07 负责，本规格只定义视觉。待 eng 落地 `drawQuicksandOverlay()` 接入 `drawLevel` + `update`。
4. **天空辉光（蓝紫 #6E7BF2）**：默认关，仅作"冷中藏暖"可选点缀。是否启用待主理人拍板。
5. **暖同色系对比（§5 #1）**：天空 `#F7BE8A` 与沙岩 `#F2933C` 对比 ≈1.3:1，依赖强制 1px 描边达标。若主理人认为需更强区分，可调整 `bg` tint 明度（仍须 0 新增 hex，仅调 `lighten` 系数）——**待主理人拍板是否调参**。

> 本文件为沙漠主题视觉落实规格（加法），roadmap 批次 3（世界 1 第 4 关 1-4）；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 desert-biome-spec §8 契约 + 本规格 §1–§2 绘制参数）。
