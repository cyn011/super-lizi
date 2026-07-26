# 海主题视觉落实规格（sea-visual-spec）

> 文档类型：视觉落实规格（加法扩展，衔接 `art/sea-biome-spec.md` 的 §1/§3/§4/§5，供工程侧落地 1-3 背景与专属敌/障碍皮肤）
> 作者：art-director（林绘澄）
> 上游依据：`art/sea-biome-spec.md`（8 槽权威映射 + tint + jellyfish + 障碍视觉）｜`art/cave-biome-spec.md` §2/§5/§6（同构）｜`art/storm-sky-biome-spec.md`（同构）｜`art/theme-framework.md` §2（背景层结构，概念索引，自由 hex 不进实现）｜`art/art-bible.md` §3·§5·§9｜`art/accessibility.md`（分级口径）｜`src/game/render/theme-palette.ts`（8 槽接口）
> 关联任务：roadmap 批次 2（海 1-3）｜评审强度：lean
> **红线**：锁色板 ≤64、COLOR DELTA = 0 新增 hex（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts`、不 git commit**；theme 名严格 `sea`；MVP 全程序化占位（Graphics，零 PNG，ADR-004）；IP 全原创、避任天堂符号。

---

## 0. 范围与权威色引用（红线基准）

本规格把 `sea-biome-spec.md` 的视觉意图落成**工程可消费的程序化绘制规格**：背景层画法、jellyfish 绘制、潮汐水位视觉、障碍换皮矩阵、可访问性校验、theme-palette 衔接。玩法/数值（tide/current/淹没判定）由对应 GDD 与工程负责，本规格只定义"长什么样 + 怎么画"。

**零 PNG 声明**：本规格全部视觉效果经 Phaser `Graphics` 程序化绘制（ADR-004）；不引入任何 PNG/JPG/SVG；多主题切换 = 调色板数据切换 + 背景层参数变化 + 装饰绘制参数差异。包体增量 ≈ 0。

### 0.1 权威 11 色锁色板（全部引用，0 新增）

| # | 名 | Hex | 本规格用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 海藻 / 珊瑚绿 / `crystalGlow` |
| 2 | 阴影绿 | `#5FA82F` | 海藻暗部（tint 源，可选） |
| 3 | 暖橙 | `#F2933C` | 阳光透射暖意 / 沉船木 / `firelight` |
| 4 | 暖黄 | `#FFD23F` | 气泡核心 / 阳光高光 / 水母核心 / `crystalCore` |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享）/ `outline` |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用，本关不用于敌） |
| 7 | 警示红 | `#E8483B` | 危险语义（暗流警示 / ci_li 等）/ `danger` |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 水母触手辉光 / 深海辉光 / 暗流核 |
| 10 | 环境冷蓝 | `#4A78C0` | **礁岩主面 / 海床基色** / `rockFace` |
| 11 | 天空 | `#5BC8F5` | **水面天光 / 水母半透伞** / `bg` |

### 0.2 本规格使用的 tint 派生（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 礁岩暗面 rockBody | `darken(#4A78C0, 0.5)` ≈ `#254060` | 海床/礁岩底/oneway | 0 新增（tint） |
| 远景水幕剪影 | `darken(#4A78C0, 0.4)` ≈ `#2C486F` | parallax 远层（无描边、低饱和） | 0 新增（tint） |
| 海藻暗部 | `darken(#7CC242, 0.5)` ≈ `#3E6121` | 海藻阴影 | 0 新增（tint） |
| 天空渐变末端点 | `darken(#5BC8F5, 0.12)` ≈ `#4FADD8` | 天空层渐变近海平线端（可选，tint 派生） | 0 新增（tint） |

### 0.3 内部分辨率 / 网格硬约束

`512×288` 内分辨率，32px 瓦片网格，`pixelArt: true`，整数缩放。所有 Graphics 绘制坐标按此基准；视差通过 `scrollFactor` 实现（天空层 `scrollFactor=0`，远景 0.3，中景 0.6，游戏层 1.0，前景 1.2）。

---

## 1. sea 背景层程序化绘制规格（零 PNG · 全 Graphics）

### 1.1 图层架构（对齐 theme-framework §2.1 + sea-biome-spec §5）

复用 5 层深度结构，仅海主题填充参数；任务要求的"远/中/近三层视差" = 远景(0.3) + 中景(0.6) + 前景近景浪花带(1.2)。

| 层 | depth / scrollFactor | 内容 | 配色（锁色板） | 绘制 API 建议 |
|---|---|---|---|---|
| 天空/水面 | 0（scrollFactor 0） | 竖直渐变（天空 → 海平线） | `bg #5BC8F5` → tint(`darken`) | `fillGradientStyle` + `fillRect` |
| 远景 far | 0.3 | 远礁 / 水幕剪影 | `darken(#4A78C0,0.4)` 剪影，无描边 | `fillPath` / `fillCircle` |
| 中景 mid | 0.6 | 浪线 + 珊瑚 + 气泡 | `#5BC8F5` + `#7CC242` + `#F2933C` | `fillPath` 浪线 / `fillCircle` 气泡 |
| 游戏层 game | 1.0 | 礁岩 / 水母 / 敌 / 道具 / 主角 | `rockFace #4A78C0` / `rockBody #254060` / 描边 | `drawTerrain`（见 sea-biome-spec §8） |
| 前景 near | 1.2（克制） | 动态浪花带 + 偶尔气泡掠过 | `#5BC8F5` alpha ≤0.5 | 相位偏移 `Graphics` / `fillCircle` |
| 海底剪影 | 贴 game 层下方 | 海底 / 礁石剪影带 | `darken(#4A78C0,0.5)` ≈ `#254060` | `fillPath` 起伏带 |

> 海平线（waterline）由 §3 的 `tideLevel` 参数驱动，是天空/水体分界与浪花带锚点。

### 1.2 天空/水面渐变层（scrollFactor 0）

- 用 `fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha)` 画全屏竖直渐变：
  - **顶部** `天空 #5BC8F5`（锁色板 #11）；
  - **近海平线端** `darken(#5BC8F5, 0.12)`（tint 派生，0 新增）或直接衔接水体色 `#4A78C0`；纯 `#5BC8F5` 单色填充亦符合 sea-biome-spec §5（"纯色填充"），渐变仅作纵深增强。
  - 单次 `fillRect(0, 0, W, H)` 即可，极廉价。
- 海平线以下为"水体"：用 `#4A78C0` → `darken(#4A78C0,0.5)` ≈ `#254060` 的竖直渐变（水体向深处加深），见 §3.1。
- 该层 `scrollFactor=0` 不随相机滚动；海平线 Y 由 `tideLevel` 决定（§3）。

### 1.3 远景 far（parallax 0.3）— 远礁 / 水幕剪影

- 远礁剪影：2–3 座低饱和圆顶/不规则礁石，颜色 `darken(#4A78C0, 0.4)` ≈ `#2C486F`（tint 派生），**无描边、低饱和**（对齐 art-bible §5.1「远景降饱和无描边」）。
- 画法：`fillPath`（`moveTo` + 多段 `lineTo`/`arc` 画起伏顶）+ `fillRect` 补到底；或 `fillCircle` 叠圆顶剪影。
- **海底剪影带**（贴 game 层下方，scaled 同 0.3 或 1.0）：一条 `darken(#4A78C0, 0.5)` ≈ `#254060` 起伏带，暗示海床/礁石轮廓，纯氛围非碰撞。
- draw call：far 3–5 次。

### 1.4 中景 mid（parallax 0.6）— 浪线 + 珊瑚 + 气泡

- **浪线带**：水平正弦波（`moveTo` + 多段 `lineTo` 正弦曲线，`fillPath` 或 `strokePath`），颜色 `天空 #5BC8F5` + alpha ≤0.5；波幅 4–8px、波长 30–50px（对齐 theme-framework §2.2 T3）；置于海平线附近。
- **珊瑚 `deco_coral`**：礁岩边的草绿 `#7CC242` 分枝（2–3 叉）+ 暖橙 `#F2933C` 点缀尖端（非碰撞装饰，sea-biome-spec §2）。`fillPath` 画枝、`fillCircle` 画点。
- **气泡 `deco_bubble`**：缓浮小圆，外圈 `天空 #5BC8F5` alpha ≤0.4 + 核心 `暖黄 #FFD23F`（sea-biome-spec §2）；沿水流上升，≤3Hz（防光敏）。`fillCircle` ×N。
- draw call：mid 5–8 次。

### 1.5 前景 near（parallax 1.2，克制）— 动态浪花带（相位偏移）

- **浪花带 `deco_wave`**：近景动态浪花，沿海平线/水边水平铺展；用**逐帧 clear+重绘**或**相位偏移**的 Graphics 实现（对齐 theme-framework §2.3「正弦波浪 fillPath ~20 段/屏宽」）。
  - 画法：维护 `phase` 变量（每帧 `+= dt × speed`，speed 对应 ≤2Hz）；`graphics.clear()` → `lineStyle(2, 0x5BC8F5, 0.5)` → `moveTo(x0, y0 + sin(phase))` → 每段 `lineTo(x+i·step, y + sin(phase + i·k)·amp)` → `strokePath()`。
  - 浪花尖：波峰处叠 `暖黄 #FFD23F` 短高光（alpha ≤0.5），强化"浪花"可读性。
  - 遮挡 ≤10% 路径（克制），仅海平线附近，不挡关键平台。
- **偶尔气泡掠过**：同 mid 气泡，但 parallax 1.2、alpha 更低，数量 ≤2（遮挡 ≤10%）。
- **减少动态**：Reduce Motion 下 `phase` 不推进（冻结首帧），浪花带成静态波线（见 §5）。
- draw call：near 1–2 次。

### 1.6 性能预算

每层总 draw call ≤ 15（sky 1 + far 3–5 + mid 5–8 + near 1–2 + 海底剪影 1），远低于移动端阈值。每帧 near 浪花带 clear+重绘 ≈ 0.1ms，可忽略（theme-framework §2.3）。far/mid/sky/海底剪影 create 时一次绘制，仅 near 浪花带每帧轻量重绘；scrollFactor 驱动视差滚动，运行时零重绘。

---

## 2. jellyfish 水母皮肤视觉（新敌 · 蓝系 · 可踩）

> 权威定义见 sea-biome-spec §3；本节约为工程可消费的绘制伪代码级描述。碰撞盒与 4 旧敌一致（bbox `36×40`），仅外观换皮。

### 2.1 视觉明细（引用 sea-biome-spec §3.1）

| 维度 | 几何 | 配色 | 危害 | 可踩 |
|---|---|---|---|---|
| 伞盖 | 半圆穹顶（半透明） | `天空 #5BC8F5` alpha ≤0.5 + `描边 #2A1A12` 细边 | 否 | 是（soft 顶） |
| 触手 | 伞下 3–4 条飘带 | `蓝紫 #6E7BF2` alpha ≤0.6 | 否 | — |
| 核心 | 伞内小点 | `暖黄 #FFD23F` | 否 | — |

### 2.2 绘制伪代码（MVP Graphics）

```text
// bbox: 36×40，anchor 居中；floatPhase 由 enemy 状态机提供
// 1) 漂浮：正弦上下浮动 + 伞盖 squash/stretch pulse
bobY  = sin(floatPhase) * 12           // ±12px 浮动（period≈3000ms，柔和；与 GDD §3.2 一致）
pulse = 1 + sin(floatPhase * 2) * 0.06 // 伞盖轻微缩放 6%
// 2) 伞盖（半透明天空蓝穹顶）
g.fillStyle(0x5BC8F5, 0.5)             // 天空蓝半透
g.fillEllipse(cx, cy + bobY, 34 * pulse, 22 * pulse)  // 半圆穹顶
g.lineStyle(1, 0x2A1A12, 1)            // 描边细边
g.strokeEllipse(cx, cy + bobY, 34 * pulse, 22 * pulse)
// 3) 触手（3–4 条蓝紫半透飘带，相位摆动 ≤2Hz）
for i in 0..3:
  tx = cx - 12 + i * 8
  g.lineStyle(3, 0x6E7BF2, 0.6)        // 蓝紫半透
  g.beginPath()
  g.moveTo(tx, cy + bobY + 10)          // 伞下起
  g.lineTo(tx + sin(floatPhase * 2 + i) * 3,       cy + bobY + 26) // 中段摆
  g.lineTo(tx + sin(floatPhase * 2 + i + 1) * 4,   cy + bobY + 38) // 末段摆
  g.strokePath()
// 4) 核心（暖黄小点）
g.fillStyle(0xFFD23F, 0.8)
g.fillCircle(cx, cy + bobY - 2, 3)
// 5) 可踩提示：半透伞盖无尖刺 = soft 顶（与硬顶敌形状双编码区分）
```

### 2.3 与 du_fu 的同色系区分（色盲安全）

- `du_fu`（通用）= **实心蓝紫 `#6E7BF2` 扁圆 + 双翅 + 暖黄肚皮斑**（sea-biome-spec §3.3 / storm §4.1）；
- `jellyfish`（专属）= **半透明天空蓝 `#5BC8F5` 伞盖 + 蓝紫触手 + 暖黄核心**。
- 双重区分：**色相（天空蓝半透 vs 蓝紫实心）+ 透明度（0.5 vs 1.0）+ 形态（伞+触手 vs 扁圆+翅）** → 色盲安全。海关联同屏含 du_fu + jellyfish 时，依此区分。
- 结论：水母以「半透明天空蓝伞 + 蓝紫触手 + 暖黄核心」剪影唯一，soft 顶可踩，与所有敌/元素全异。

---

## 3. 潮汐水位视觉（tideLevel 参数驱动）

> 玩法水位判定（tide/current/淹没）由 GDD + 工程负责；本规格定义"水位线如何与背景层海平线联动"的视觉参数。**水位线 = 背景层海平线**，单一参数源。

### 3.1 水位线参数化（waterSurfaceY，与 GDD level-1-3-design.md 同源同名）

- **权威公式（与 GDD §潮汐一致）**：`waterSurfaceY = lowY + (highY − lowY) × tideLevel`
  - `tideLevel` ∈ [0,1]：工程侧按段归一化传入（0=最低潮、1=最高潮）；GDD 已给 `tideLevel(t)∈[0,1]` 公式。
  - `lowY` = 低潮海平线（= 本规格 `horizonBaseY`，较大 Y 值，淹没最少）；
  - `highY` = 高潮海平线（较小 Y 值，淹没最多）；`highY < lowY`。
  - 本规格原写法 `waterSurfaceY = horizonBaseY − tideOffset(tideLevel)` 与之等价：`horizonBaseY = lowY`、`tideOffset(tideLevel) = (lowY − highY) × tideLevel`。
- **幅度按段参数化，禁止硬编码**：`lowY` / `highY` 由 GDD 各潮汐段给出，本规格**不固定幅度**。示例（非默认值）：GDD T1/T2 振幅 = 3 格 = 96px（淹没 ty5..8 / ty4..8）。工程从 GDD 读 `lowY`/`highY` 推导，美术按段消费 `waterSurfaceY`，**切勿将幅度写死为 36px / 1 格**。
- 背景层据此重算：
  - 天空渐变止于 `waterSurfaceY`；其下为水体渐变（`rockFace #4A78C0` → `darken(#4A78C0,0.5)` ≈ `#254060`）；
  - 浪花带（§1.5）绘制在 `waterSurfaceY`；
  - 海底剪影带随之上/下平移。

### 3.2 淹没区半透叠层

- 凡 `y > waterSurfaceY` 的实体/地形，叠加半透水体：`rockFace #4A78C0` alpha ≤0.6 矩形/路径（对齐 sea-biome-spec §4.1 deep_water 水体），制造"水下"观感；**非碰撞，仅氛围**。
- 危险暗示：淹没=死亡，在水面顶部叠 `警示红 #E8483B` 细波纹（alpha ≤0.5，可选，telegraph）。

### 3.3 浪花拍打边沿（edge foam）

- 水体与**实心地形边缘**相交处，画拍打浪花：`天空 #5BC8F5` 短弧线（alpha ≤0.5）+ `暖黄 #FFD23F` 溅点，随相位断续出现（≤2Hz）；位置由地形碰撞盒边沿推导，纯视觉 telegraph。
- 暗流区（§4.5）出口同样叠拍岸泡沫，强化"水流推出"可读性。

### 3.4 联动要点（给工程）

- `waterSurfaceY` 为**单一参数源**：背景渐变、浪花带、淹没叠层、edge foam 全部读它；
- 潮汐动画：tideLevel 由工程侧按段驱动（如每段线性插值），`waterSurfaceY` 平滑过渡；Reduce Motion 下可保留水位变化（必要玩法）但**浪花/泡沫相位冻结**（见 §5）；
- 复用 §1 背景层结构，不新增层。

---

## 4. 海主题障碍皮肤矩阵（碰撞盒不变 · 锁色板色）

> 通用规则（asset-spec §2.5）：可踩顶=软｜不可踩顶=硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。所有"皮肤"仅换外观，碰撞盒/行为由 GDD 决定，本规格不重定义。

### 4.1 四通用敌海换皮

| 敌 | 原轮廓/主色 | 海换皮（形状+色） | 可踩 | 备注 |
|---|---|---|---|---|
| `ci_li` 刺栗 | 圆球+周身短刺 / 警示红 | **珊瑚刺**：圆体 `警示红 #E8483B` + 珊瑚枝刺（`草绿 #7CC242` 枝 + `警示红 #E8483B` 尖），顶无刺=soft | ✅ | 珊瑚形态换皮，危险色双编码保持 |
| `chong_feng` 锥冲 | 长条楔形 / 警示红 | **潮蟹**：楔形蟹身 `警示红 #E8483B` + 双螯前突（硬角硬顶），`描边 #2A1A12` | ❌ | 楔→蟹，前螯=冲锋方向语言 |
| `du_fu` 嘟浮 | 扁圆+翅 / 蓝紫 | **水母近亲（实心）**：实心蓝紫 `#6E7BF2` 小穹顶 + `暖黄 #FFD23F` 肚皮斑 + 侧鳍；alpha=1.0（vs jellyfish 半透） | ✅ | 实心 vs jellyfish 半透双区分（§2.3） |
| `shi_pao` 石炮 | 方正石+炮口 / 越界白 | **蚌炮**：石身 `环境冷蓝 #4A78C0` + 暗面 `darken(#4A78C0,0.5)` + 红炮口 `警示红 #E8483B` + `描边` | ❌ | 同 storm §4.3，靠描边+红炮口+方硬轮廓辨识 |

- `du_fu` / `ci_li` 加 `暖黄 #FFD23F` 斑（蓝/红底反差，同 storm §4.1），提升海蓝底辨识。

### 4.2 海专属陷阱视觉

| 陷阱 | 视觉 | 配色（锁色板） | 可读/危险双编码 |
|---|---|---|---|
| 暗流推挤区 `riptide` | 区域力场：短弧流线（方向暗示推力）+ 微弱辉光核 | 流线 `天空 #5BC8F5` alpha ≤0.5；核 `蓝紫 #6E7BF2` 微辉 | 流线方向=推力方向（形语言）；非实体，类比 cyclone |
| 浪花击退 | 边沿泡沫爆发：拍岸泡沫 + 溅点，击退前摇 | `天空 #5BC8F5` 弧 + `暖黄 #FFD23F` 溅点 | 泡沫累积=前摇 telegraph（形语言） |
| 深水区 `deep_water` | 半透水体 + 水面线 + 危险波纹 | 水体 `环境冷蓝 #4A78C0` alpha ≤0.6；水面线 `天空 #5BC8F5`；危险 `警示红 #E8483B` 波纹 | 淹没=死亡，红波纹 telegraph |

> 以上陷阱视觉均为**非碰撞体**，由水位线/力场判定触发；碰撞盒由 GDD 决定（本规格不重定义）。

### 4.3 形状双编码总览（海主题）

- **可踩**：jellyfish（半透伞+触手）、du_fu（实心蓝紫+暖黄肚皮+翅）、ci_li（圆珊瑚刺顶 soft）—— soft 顶 + 圆润形态。
- **不可踩**：chong_feng 潮蟹（硬角螯）、shi_pao 蚌炮（方硬+红炮口）、cyclone（力场非实体）。
- 危险语义统一靠 `警示红` + 尖/硬形态，色盲安全。

---

## 5. 可访问性校验（Sea · 目标档 Standard）

> 口径：art-bible §9 + `art/accessibility.md`（MVP 目标 = **Standard**；防光敏 / 最小热区为硬底线）。逐项检查 sea 主题。

| # | 检查项 | 结论 | 说明 |
|---|---|---|---|
| 1 | 前景/背景对比（≥3:1，关键≥4.5:1） | ⚠️→✅ | 礁岩 `#4A78C0` vs 天空 `#5BC8F5` 亮度约 **2.3:1**（略低于 3:1）；靠**强制 1px 描边 `#2A1A12`**（描边 vs 天空 ≈8.8:1）+ `rockBody` 暗面 `#254060` 兜底 → 平台顶缘边界 >4.5:1 达标。实体（栗宝/敌）均有暗描边，与亮天空高对比。 |
| 2 | 色盲安全（形状+色双编码） | ✅ | 地面 hue=环境冷蓝+草绿海藻（海唯一「冷蓝+草绿」组合）；jellyfish 半透天空蓝 vs du_fu 实心蓝紫（透明+色相双区分）；危险=警示红+尖/硬形。 |
| 3 | 减少动态 / 静态 fallback | ✅ | 浪花带/气泡/触手/潮汐泡沫相位在 Reduce Motion 下冻结首帧（静态波线/静止气泡）；潮汐水位变化（玩法必需）保留，但动态泡沫停。 |
| 4 | 防光敏（<3Hz，单闪≤0.2s） | ✅ | 浪花 ≤2Hz、触手摆 ≤2Hz、气泡升 ≤3Hz、潮汐过渡平滑非闪烁；无全屏高频闪。 |
| 5 | 最小可辨/可点尺寸 | ✅ | 实体≥32px（jellyfish 36×40、敌≥32px）；UI 热区≥48×48（继承全局）。 |
| 6 | 非颜色状态提示 | ✅ | 受击=红闪+击退+无敌闪；踩怪=压扁+弹；暗流=流线方向；深水=红波纹 telegraph。 |

**结论**：Sea 主题可达 **Standard 档**（MVP 目标）。唯一注意项 = 海平线以上礁岩平台与天空蓝的亮度对比临界（≈2.3:1），**强制平台 1px 描边**即达标（与 cave/vine/storm 通用缓解一致）。全部零新增色，守 ADR-004。

---

## 6. 与 theme-palette 衔接（sea 8 槽注册 + fail-safe）

### 6.1 sea 应注册的 8 槽权威 hex（取自 sea-biome-spec §1.2 / §8.2，0 新增）

| 引擎字段 | sea Hex | 锁色板来源 | 备注 |
|---|---|---|---|
| `bg` | `0x5BC8F5` | 天空 #11 | 水面天光 |
| `rockFace` | `0x4A78C0` | 环境冷蓝 #10 | 礁岩主面 |
| `rockBody` | `0x254060` | `darken(#4A78C0,0.5)` tint | 0 新增（礁岩暗面） |
| `outline` | `0x2A1A12` | 描边 #5 | 全局描边 |
| `firelight` | `0xF2933C` | 暖橙 #3 | 阳光透射 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4 | 气泡核心 |
| `crystalGlow` | `0x7CC242` | 草绿 #1 | 海藻/辉光 |
| `danger` | `0xE8483B` | 警示红 #7 | 危险双编码 |

> 8 槽全部落在 11 色锁色板内或由 tint 派生，**0 新增 hex**（tint 不计入新增）。蓝紫 `#6E7BF2`（#9）用于 jellyfish 触手 / riptide 辉光，作为常量 `0x6E7BF2` 在绘制分支直接引用（非 palette 槽，已含在锁色板内）。

### 6.2 fail-safe 回退

- 工程 `resolveBiome(theme)` 对未知/缺省 theme **回退 `grass`**（sea-biome-spec §8.1 / theme-palette.ts 现有行为）；
- 若 `THEME_PALETTES['sea']` 尚未注册，背景/地形自动走 grass 常量（现有硬编码棕），**不抛错、零回归**；
- `LevelData.metadata.theme` 增 `'sea'`（建议联合类型 `'grass'|'cave'|'vine_forest'|'storm_sky'|'sea'`），未知回退 `'grass'`；
- 本规格**不写 src**；sea entry 由 engineering-lead 按 §6.1 注册。

### 6.3 消费点映射（工程落地指引，非本规格写码）

| 消费点 | sea 取值 |
|---|---|
| `drawTerrain` 地面填充 | `THEME_PALETTES['sea'].rockFace`(#4A78C0) / `.rockBody`(#254060) |
| 背景色/天空 | `setBackgroundColor(THEME_PALETTES['sea'].bg)`(#5BC8F5)；渐变见 §1.2 |
| `jellyfish-view` 分支 | 伞盖=`bg`(#5BC8F5)+alpha；触手=常量 `0x6E7BF2`；核心=`crystalCore`(#FFD23F)；描边=`outline` |
| 障碍/敌换皮 | 见 §4（ci_li→珊瑚刺 / chong_feng→潮蟹 / du_fu→实心水母近亲 / shi_pao→蚌炮） |
| 潮汐水位 | 背景渐变/浪花带/淹没叠层读 `waterSurfaceY`（§3） |

---

## 附：与 sea-biome-spec 的交叉引用

- 本规格为 `sea-biome-spec.md` 的**视觉落实扩展**：§1 背景层画法 → sea-biome-spec §5（视差层级）；§2 jellyfish 绘制 → §3；§3 潮汐视觉 → §4.1/§4.2（deep_water/riptide）；§4 障碍换皮 → §4.3/§4（敌/专属障碍）；§5 可访问性 → §6；§6 palette 衔接 → §1/§8。
- 实现须以 sea-biome-spec 的 8 槽权威 hex + tint 为准；本规格不引入任何新 hex。
- 工程契约见 sea-biome-spec §8；本规格 §6 为视觉侧对齐摘录。

> 本文件为海主题视觉落实规格（加法），roadmap 批次 2（世界 1 第 3 关 1-3）；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 sea-biome-spec §8 契约 + 本规格 §1–§4 绘制参数）。
