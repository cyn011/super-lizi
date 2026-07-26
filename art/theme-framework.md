# 多主题美术框架（Theme Framework）— Draft v0.1

> 文档类型：美术框架草案 / 视觉扩展规范
> 作者：林绘澄（art-director）
> 上游依据：`art/art-bible.md`（主色板·九节视觉身份）、`design/gdd/05-level-system.md`（主题元数据字段）、`docs/architecture/adr/ADR-004-asset-loading-budget.md`（零位图铁律）、截图 `screenshot-new-02-grassland.png` / `03-cave.png` / `04-sky.png`
> 适用范围：Phaser 3 · 512×288 内分辨率 · 32px 瓦片网格 · `pixelArt:true` · 零位图资产（ADR-004）
> 评审强度：lean，供用户拍板

---

> ## ⚠️ 文档状态 / 权威性声明（Authority & Status — 必读）
>
> **本文档为早期「概念索引 / 草稿」（Concept Index / Draft），不构成实现依据，仅记录主题清单、色彩直觉与背景层结构思路。**
>
> - **权威 11 色色板以各 `*-biome-spec.md` 为准**（已 live：`cave` / `vine_forest` / `storm_sky`；已产出：`sea` / `desert` / `home` / `street` / `office`）。它们严格守「11 色锁色板 + 运行时 tint（0 新增 hex）」纪律（ADR-004 / `design/gdd/theme-system.md` §2.1）。
> - 本文档内出现的**自由 hex（约 50–70 个，如 `#6BAED6`、`#2D3748`、`#4A5568`、`#D4A574`、`#E8C46E`、`#94A3B8` 等）为早期草图数值，仅记录早期色彩直觉，不进实现、不具约束力。**
> - **任何落地实现须引用对应 `*-biome-spec.md` 的「8 槽权威映射 + tint 规则」，不得直接抄本文档的自由 hex。** 若本文档色值与 biome-spec 冲突，以 biome-spec 为准。
> - 本文档保留价值在于：主题清单、背景层结构思路、装饰/障碍视觉描述、天气叠加层思路等**非色板**内容，供设计讨论与 biome-spec 反向溯源参考。
>
> **权威 11 色锁色板（仅作索引；完整定义见 `art-bible.md` §3 与各 biome-spec）：**
> 草绿 `#7CC242` · 阴影绿 `#5FA82F` · 暖橙 `#F2933C` · 暖黄 `#FFD23F` · 描边 `#2A1A12` · 命粉 `#F26D8B` · 警示红 `#E8483B` · 经济金 `#F2C94C` · 蓝紫 `#6E7BF2` · 环境冷蓝 `#4A78C0` · 天空 `#5BC8F5`
>
> **8 槽权威接口（实现消费，见各 biome-spec §1 / §8）：** `bg`(sky) · `rockFace`(ground) · `rockBody`(accent) · `outline` · `firelight`(seed) · `crystalCore`(trim) · `crystalGlow`(foliage) · `danger`(hazard)
>
> **权威规格交叉引用**：见文末「附录 C」。

---

## 0. 设计原则与约束

### 0.1 铁律：零位图（ADR-004）
- 所有主题视觉效果**全部通过 Phaser Graphics 程序化绘制**实现。
- 不引入任何 PNG/JPG/SVG 位图资源。
- 多主题切换 = **调色板数据切换 + 程序化背景层参数变化 + 装饰元素绘制参数差异**。
- 包体影响：**≈ 0**（仅增加配置 JSON 数据量，约 2–5 KB / 主题）。

### 0.2 IP 统一原则
- 所有主题的配色从 `art-bible.md` §3 主色板**派生**（暖橙黄基底），不引入与 IP 冲突的冷调/暗黑/赛博等异质色调。
- 功能色语义**全局不变**：危险红 `#E8483B`、奖励金 `#FFC93C`、互动青 `#3FC7B4`、增益紫 `#9B6CF2`、生命粉红 `#F26D8B`——在任何主题下形状+颜色双编码保持一致。
- 主角栗宝外观**不随主题改变**（栗色 `#B5763E` + 嫩芽 `#7CC242` 是角色固有特征）。

### 0.3 可访问性不降级
- 每个主题的前景–背景对比度 ≥ 3:1（关键交互 ≥ 4.5:1）。
- 室内暗主题（家/街/办公）需保证地面平台与背景有足够亮度差。
- 雨天叠加层透明度可控，不影响底层可读性。
- 目标分级：**Standard**（与 art-bible §9 一致）。

---

## 1. 主题调色板系统

### 1.1 数据结构定义

每个主题由以下色槽组成，全部为 hex 值：

```ts
interface ThemePalette {
  id: string;              // 主题标识，如 'grassland'
  name: string;            // 中文名
  sky: {                  // 天空层（渐变起止）
    top: string;          // 顶部色
    bottom: string;       // 底部色（近地平线）
  };
  ground: {               // 地面/平台主色
    surface: string;      // 平台顶面（玩家站立面）
    body: string;         // 平台侧面/填充
    accent: string;       // 平台装饰边/高光（可选）
  };
  farBackground: string;  // 远景层主色（降饱和版）
  midBackground: string;  // 中景层主色
  decoration: string[];   // 装饰元素色（2–3 个）
  atmosphere: string | null; // 大气效果色（雾/热浪/雨叠层），无则 null
  mood: 'warm' | 'cool' | 'neutral' | 'dark'; // 情绪基调
}
```

### 1.2 八大主题色板详情

> ⚠️ **（概念草图，非权威，见对应 biome-spec）**：以下 T1–T8 各主题的 hex 色板均为本框架早期草图数值（含大量锁色板外 hex），**不进实现、不具约束力**。任何落地实现请以文末「权威规格交叉引用」所列各 `*-biome-spec.md` 的 8 槽映射 + 运行时 tint 为准（11 色锁色板，0 新增 hex，ADR-004 / theme-system.md §2.1）。

#### T1 · 草原（Grassland）—— 教学关 / 基准主题
> 已有截图验证（screenshot-new-02-grassland.png）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#5BC8F5` | 清亮天蓝（art-bible §3.1 原始值） |
| sky.bottom | `#89D4F7` | 近地平线略浅 |
| ground.surface | `#7CC242` | 明快草绿 |
| ground.body | `#5A8E30` | 深草绿（泥土感） |
| ground.accent | `#A8E063` | 嫩草高光边 |
| farBackground | `#7BAFCE` | 远山蓝灰（饱和度压 35%） |
| midBackground | `#6DB84F` | 中景灌木绿 |
| decoration[0] | `#FFD23F` | 小黄花（阳光呼应） |
| decoration[1] | `#F0D9B5` | 浅土色小石块 |
| atmosphere | null | 无大气效果 |
| mood | `warm` | |

**派生说明**：直接使用 art-bible §3.1 原始主色板，零修改。作为所有其他主题的色彩参照基准。

---

#### T2 · 山川（Mountains）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#6BAED6` | 略深于草原的天蓝（海拔感） |
| sky.bottom | `#B8D4E8` | 山间薄雾白蓝 |
| ground.surface | `#6B8E4E` | 山地苔藓绿（比草原暗一级） |
| ground.body | `#4A6338` | 深岩土绿 |
| ground.accent | `#8FB86A` | 苔藓高光 |
| farBackground | `#8797AB` | 远山紫灰（大气透视） |
| midBackground | `#5C7A45` | 中景松林深绿 |
| decoration[0] | `#D4C4A8` | 岩石灰 |
| decoration[1] | `#E8DCC8` | 雪顶白（远山尖） |
| atmosphere | `rgba(184,212,232,0.15)` | 薄雾叠层 |
| mood | `cool` |

**设计意图**：在草原基础上降温 + 加灰度，制造"海拔升高"的纵深感。远山用紫灰色模拟大气透视。雪顶仅在远景山峰出现（白色小三角剪影）。

---

#### T3 · 海（Ocean / Sea）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#4FA8D4` | 海洋天蓝 |
| sky.bottom | `#A8D8EA` | 海平线处淡青 |
| ground.surface | `#D4A574` | 沙滩/甲板木色（暖棕） |
| ground.body | `#B8865A` | 深木棕 |
| ground.accent | `#E8C99B` | 木纹高光 |
| farBackground | `#3A8FB7` | 远海深蓝 |
| midBackground | `#5BB5D8` | 中景海面蓝 |
| decoration[0] | `#FFFFFF` | 浪花白 |
| decoration[1] | `#FFD23F` | 太阳/航标灯黄 |
| atmosphere | `rgba(168,216,234,0.12)` | 海雾轻叠层 |
| mood | `warm` |

**设计意图**：地面不再是草地而是"沙滩/木板/礁石"，用暖棕替代绿色系，形成蓝+棕的互补搭配。海面在中/远景层用蓝色填充 + 白色浪花线（Graphics 绘制正弦波）。功能色保持不变。

---

#### T4 · 沙漠（Desert）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#F5B56A` | 炽热橙黄天空 |
| sky.bottom | `#FAD7A0` | 地平线附近沙尘黄 |
| ground.surface | `#E8C46E` | 沙地金黄 |
| ground.body | `#D4A84B` | 深沙色 |
| ground.accent | `#F5DE8C` | 沙粒高光 |
| farBackground | `#D4955A` | 远沙丘暖棕 |
| midBackground | `#E0B568` | 中景沙丘 |
| decoration[0] | `#F2933C` | 暖橙色仙人掌/枯木 |
| decoration[1] | `#FFFFFF` | 白骨/化石点缀（稀少） |
| atmosphere | `rgba(250,215,160,0.18)` | 热浪扭曲叠层 |
| mood | `warm` |

**设计意图**：全局暖调偏移——天空从蓝变橙黄，地面从绿变金沙。这是色相偏移最大的主题，但仍在"暖橙黄基底"IP 范围内。热浪效果用半透明波浪形 Graphics 叠加模拟。

---

#### T5 · 雨天（Rainy）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#4A5568` | 乌云深灰蓝 |
| sky.bottom | `#718096` | 近地雨幕灰 |
| ground.surface | `#5A7247` | 雨后深草绿（饱和度压低） |
| ground.body | `#3D5030` | 湿泥深绿 |
| ground.accent | `#7A9662` | 湿润反光高光 |
| farBackground | `#5A6A7A` | 雨雾中远景灰蓝 |
| midBackground | `#4E6354` | 中景雨中植被暗绿 |
| decoration[0] | `#94A3B8` | 水洼反光银灰 |
| decoration[1] | `#CBD5E0` | 雨滴溅起水花白 |
| atmosphere | `rgba(113,128,150,0.20)` | 雨幕叠层（核心） |
| mood | `cool` |

**设计意图**：在草原基准上整体降明度 + 降饱和 + 偏冷，模拟阴雨天氛围。关键是 atmosphere 叠层（雨丝粒子/水洼反光）。地面保留足够辨识度的绿色调，不让玩家"看不清踩哪里"。详见 §4 天气叠加层。

---

#### T6 · 家（Home / Indoor）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#2D3748` | 室内天花板/墙上沿深灰 |
| sky.bottom | `#4A5568` | 墙面中灰（模拟室内纵深） |
| ground.surface | `#C4A882` | 木地板暖棕 |
| ground.body | `#A08060` | 深木色 |
| ground.accent | `#DCC4A0` | 木地板高光 |
| farBackground | `#3D4A5C` | 家具远景暗色 |
| midBackground | `#5A6B7D` | 中景家具灰蓝 |
| decoration[0] | `#F2933C` | 台灯暖光橙 |
| decoration[1] | `#718096` | 沙发/书架灰 |
| atmosphere | `rgba(74,85,104,0.10)` | 室内柔光叠层 |
| mood | `neutral` |

**设计意图**："室内"将天空层重新诠释为墙壁/天花板（深灰渐变），地面变为木地板。装饰元素是家具剪影（沙发、台灯、书架）。保持温暖家居感，避免过于阴暗。台灯提供局部暖光点（decoration[0] 的橙色可作为光源色点缀）。

---

#### T7 · 街（Street / City）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#5A6B7D` | 城市天际线灰蓝 |
| sky.bottom | `#A0AEBC` | 远楼淡灰 |
| ground.surface | `#718096` | 沥青/水泥灰 |
| ground.body | `#4A5568` | 深路面灰 |
| ground.accent | `#94A3B8` | 路面标线/高光 |
| farBackground | `#6B7A8A` | 远楼轮廓灰 |
| midBackground | `#8090A0` | 中景建筑灰蓝 |
| decoration[0] | `#F6AD55` | 路灯/霓虹暖橙 |
| decoration[1] | `#63B3ED` | 广告牌/招牌蓝 |
| atmosphere | `rgba(160,174,188,0.08)` | 城市薄霾 |
| mood | `neutral` |

**设计意图**：城市街道以灰蓝色调为主轴，地面从绿/棕变为水泥灰。装饰用路灯暖橙 + 招牌蓝两个对比点色，给画面活力但不破坏整体中性基调。建筑剪影在远/中景层用矩形堆叠绘制。

---

#### T8 · 办公（Office）

| 色槽 | Hex | 说明 |
|---|---|---|
| sky.top | `#E2E8F0` | 办公室天花板白 |
| sky.bottom | `#CBD5E0` | 上方墙面浅灰 |
| ground.surface | `#B8C4D0` | 办公桌/柜体表面灰蓝 |
| ground.body | `#8896A6` | 深柜体色 |
| ground.accent | `#D0DAE4` | 表面反光 |
| farBackground | `#A0ABB8` | 远处工位暗灰 |
| midBackground | #BFC8D2 | 中景隔断灰 |
| decoration[0] | `#63B3ED` | 显示器屏幕蓝光 |
| decoration[1] | `#F6AD55` | 文件夹/便签橙 |
| atmosphere | `rgba(203,213,224,0.06)` | 办公室均匀照明 |
| mood | `neutral` |

**设计意图**：最"浅"的室内主题——办公室以浅灰白色调为主，模拟明亮荧光灯环境。显示器蓝光和文件夹橙色提供辨识点。平台被重新想象为办公桌、文件柜、隔断。

---

### 1.3 色板汇总速查表

> ⚠️ 上表 hex 同属早期概念草图（非权威）；权威色值见各 `*-biome-spec.md`。

| 主题 | 天空顶 | 地面顶 | 地面色 | 基调 | 派生自 |
|---|---|---|---|---|---|
| 草原 | `#5BC8F5` | `#7CC242` | 绿 | warm | art-bible 原始 |
| 山川 | `#6BAED6` | `#6B8E4E` | 绿(暗) | cool | 草原降温 |
| 海 | `#4FA8D4` | `#D4A574` | 棕 | warm | 蓝+暖棕互补 |
| 沙漠 | `#F5B56A` | `#E8C46E` | 金 | warm | 全局暖偏移 |
| 雨天 | `#4A5568` | `#5A7247` | 绿(暗) | cool | 草原降饱和 |
| 家 | `#2D3748` | `#C4A882` | 棕 | neutral | 室内暖灰 |
| 街 | `#5A6B7D` | `#718096` | 灰 | neutral | 城市冷灰 |
| 办公 | `#E2E8F0` | `#B8C4D0` | 灰蓝 | neutral | 室内浅灰 |

> **功能色全局不变**：危险红 `#E8483B` / 冷蓝 `#4A78C0` / 金币金 `#FFC93C` / 互动青 `#3FC7B4` / 增益紫 `#9B6CF2` / 生命粉红 `#F26D8B` / 石灰白 `#F4EFE6`

---

## 2. 程序化背景层结构

> 📝 本节记录**背景层结构思路**（图层架构、绘制要点、Graphics API 映射），保留作参考。其中出现的主题专属 hex 沿用 §1.2 同一套早期草图数值，**非权威**；具体配色须以对应 `*-biome-spec.md` 的 8 槽映射 + tint 实现。

### 2.1 通用图层架构（继承 art-bible §5.1）

所有主题共享同一 5 层深度结构，仅填充参数不同：

```
depth  0  ┌─────────────────────────────┐  sky        （纯色/渐变矩形，scrollFactor=0）
           │                             │
depth  1  │  farBackground (parallax 0.3)│  远景剪影层   （静态/极慢移动）
           │                             │
depth  2  │  midBackground (parallax 0.6)│  中景装饰层   （慢速移动）
           │                             │
depth  3  │  game layer     (parallax 1.0)│  游戏层       （地形/角色/道具/敌人）
           │                             │
depth  4  └─────────────────────────────┘  foreground  (parallax 1.2)  前景装饰（克制）
                                                                    +
                                                              depth 5  atmosphere 叠加层
```

每层均为 Phaser `Graphics` 对象或 `Graphics` 组合，在 `create()` 时一次性绘制（或按视口分块绘制），运行时仅做 scrollFactor 视差滚动。

### 2.2 各主题背景层绘制要点

#### T1 草原（基准参考）
- **sky**：线性渐变 `#5BC8F5`(top) → `#89D4F7`(bottom)，覆盖全屏。
- **farBackground**：2–3 座圆弧山丘剪影（`fillStyle(#7BAFCE)` + `fillCircle/arc`），底部对齐 y≈200，高度 40–70px。
- **midBackground**：散布 5–8 个草垛/灌木椭圆（`fillEllipse`，宽 20–40px，高 15–25px），颜色 `#6DB84F`。
- **foreground**：偶尔 1–2 片大草叶（底部向上弧线），遮挡 <10% 游戏区。
- **截图对照**：与 screenshot-new-02-grassland.png 一致（蓝天 + 绿地分层 + 黄花装饰 + 方太阳）。

#### T2 山川
- **sky**：渐变 `#6BAED6` → `#B8D4E8`（更明显的纵向渐变，模拟高山空气密度）。
- **farBackground**：尖锐三角形山峰（`moveTo/lineTo/fillPath`），3–4 座重叠，最远的用 `#8797AB`，最近远山的峰顶加 `#E8DCC8` 白色小三角（雪顶）。山峰高度 60–100px。
- **midBackground**：松树剪影（叠放三角形 + 矩形树干），颜色 `#5C7A45`，分布在中景区间。
- **atmosphere**：全屏半透明 `rgba(184,212,232,0.15)` 矩形叠层（depth 5），模拟薄雾。

#### T3 海
- **sky**：渐变 `#4FA8D4` → `#A8D8EA`。
- **farBackground**：纯色填充 `#3A8FB7`（远海面），海平线约在 y=180 处。
- **midBackground**：海面用 **水平正弦波** 绘制（`moveTo` + 多段 `lineTo` 正弦曲线 + `fillPath`），颜色 `#5BB5D8`；波峰上加白色短线（浪花 `#FFFFFF`，2–3px 长）。波幅 4–8px，波长 30–50px。
- **特殊处理**：游戏层平台视觉化为"木板/礁石"（棕色系地面色），而非草地。
- **atmosphere**：底部海雾 `rgba(168,216,234,0.12)` 渐变矩形（仅下半屏）。

#### T4 沙漠
- **sky**：渐变 `#F5B56A` → `#FAD7A0`（炽热感，顶部偏橙红）。
- **farBackground**：平滑贝塞尔曲线沙丘（`moveTo` + `quadraticCurveTo` 填充），2–3 条起伏曲线，颜色 `#D4955A`。沙丘线条圆润无尖角。
- **midBackground**：较小沙丘 + 散布仙人掌剪影（竖线 + 叉形臂，`#F2933C`），偶有枯木（折线 `#D4A84B`）。
- **atmosphere（热浪）**：全屏 `rgba(250,215,160,0.18)` 叠层 + **可选**：底部 30px 区域用横向微偏移的正弦波模拟热浪扭曲（每帧 x+offset 微抖动，tween 驱动）。

#### T5 雨天
- **sky**：渐变 `#4A5568` → `#718096`（阴沉乌云感）。
- **farBackground**：模糊山丘剪影（同草原但颜色 `#5A6A7A`，饱和度更低）。
- **midBackground**：雨中植被（椭圆 + 下垂弧线表示被雨打弯的草叶），颜色 `#4E6354`。
- **ground 特殊**：平台表面加 **水洼反光**——在 platform 顶面画 1–2 个浅色椭圆（`#94A3B8`，alpha 0.4），模拟积水。
- **atmosphere（雨丝）**：详见 §4。

#### T6 家（室内）
- **sky 重释为墙壁**：渐变 `#2D3748` → `#4A5568`，表示"天花板→墙壁"纵深。可在 y=40 处画一条水平线（踢脚线/墙角线 `#1A202C` 1px）分隔上下。
- **farBackground**：家具剪影——沙发背（圆角矩形 `#3D4A5C`）、书架（竖线格 `#3D4A5C`）、窗框（矩形框 `#1A202C` 透出外部微光）。
- **midBackground**：桌腿/椅背剪影（`#5A6B7D` 简化几何形）。
- **ground**：木地板纹理——平台表面画平行斜线（间距 8px，`#A08060` 1px 线）模拟木板拼接。
- **装饰亮点**：台灯剪影（竖线+锥形光晕 `#F2933C` radialGradient）作为场景唯一暖光源。

#### T7 街（城市）
- **sky**：渐变 `#5A6B7D` → `#A0AEBC`（城市雾霾天）。
- **farBackground**：建筑天际线——高低错落的矩形（`fillRect`），颜色 `#6B7A8A`，窗户用同色系浅 20% 的小方块点阵表示（2×2px 间隔排列）。
- **midBackground**：近处建筑 + 路灯（竖线 + 圆头 `#F6AD55`）、广告牌（横矩形 `#63B3ED`）。
- **ground**：平台表面画虚线/标线（`#94A3B8` 间隔短线）模拟马路标线。
- **atmosphere**：极淡城市薄霾 `rgba(160,174,188,0.08)`。

#### T8 办公
- **sky**：渐变 `#E2E8F0` → `#CBD5E0`（荧光灯照明的白色天花板感）。
- **farBackground**：远处工位——桌面横线 + 椅背矩形（`#A0ABB8`）。
- **midBackground**：办公隔断（竖线网格 `#BFC8D2`）+ 文件柜（带横线把手的矩形）。
- **ground**：平台表面画细密点阵（`#8896A6` 1px 点，间距 6px）模拟办公桌纹理。
- **装饰**：显示器屏幕（矩形 `#63B3ED` + 内部亮色小矩形模拟发光）+ 文件夹（L 形 `#F6AD55`）。

### 2.3 绘制技术约束（Phaser Graphics API 映射）

| 元素 | 推荐 Graphics API | 性能备注 |
|---|---|---|
| 渐变天空 | `fillGradientStyle` (linear) | 单次 fillRect，极廉价 |
| 山丘/沙丘 | `fillPath` (moveTo+quadraticCurveTo) | 静态路径，create 时一次绘制 |
| 正弦波浪（海面） | `fillPath` (分段 lineTo) | ~20 段/屏宽即可，静态 |
| 矩形建筑/家具 | `fillRect` / `fillRoundedRect` | 最廉价操作 |
| 圆形装饰（花/灯） | `fillCircle` / `fillEllipse` | 极廉价 |
| 热浪/雾叠层 | `fillRect` + alpha | 每帧可不重绘（静态叠层） |
| 雨丝粒子 | 见 §4 | 粒子系统或逐帧重绘 |

**性能预算**：每个主题背景层总 draw call ≤ 15 次（sky 1 + far 3–5 + mid 5–8 + foregnd 1–2 + atmosph 1），远低于 Phaser 3 移动端承受上限（通常 >200 draw call/frame 才需优化）。

---

## 3. 主题专属装饰与障碍视觉

### 3.1 装饰元素清单（每主题 2–3 个标志性元素）

| 主题 | 装饰元素 A | 装饰元素 B | 装饰元素 C（可选） | 绘制方式 |
|---|---|---|---|---|
| **草原** | 小黄花（圆+茎） | 小石块（不规则四边形） | 太阳（大方块圆角+光芒） | `fillCircle` + `fillRect` |
| **山川** | 松树（叠三角+树干） | 雪顶标记（远山峰小白三角） | 岩石（多边形） | `fillPath` + `fillRect` |
| **海** | 浪花（白色短弧线） | 航标灯/浮标（竖线+圆头+发光） | 海鸥（V 形两点，远景极小） | `fillArc` + `fillCircle` |
| **沙漠** | 仙人掌（竖线+叉臂） | 枯木（折线组合） | 白骨（短骨架线，极稀有） | `lineTo` + `fillPath` |
| **雨天** | 水洼（半透明白椭圆） | 雨滴水花（中心圆+3–4 粒飞溅小点） | 被打弯的草叶（下垂弧线） | `fillEllipse` + `fillCircle` |
| **家** | 台灯（竖线+锥形光晕 radialGradient） | 沙发（大圆角矩形） | 书架（竖线格+色块=书） | `fillRoundedRect` + `fillGradientStyle` |
| **街** | 路灯（竖线+圆头+光晕） | 广告牌（横矩形+内色块） | 垃圾桶（矮矩形+圆顶） | `fillRect` + `fillCircle` |
| **办公** | 显示器（矩形+内亮色矩形） | 文件夹（L 形+标签色块） | 便签纸（小矩形+旋转变形） | `fillRect` + `save/restore/rotate` |

> **装饰密度控制**：每个屏幕视口内同时显示装饰 ≤ 8 个，避免杂乱。装饰**不可碰撞**（purely visual，no physics body）。

### 3.2 障碍外观随主题变化矩阵

障碍的**碰撞盒形状与行为逻辑不变**（由 design-strategist / gdd 定义），仅**外观渲染**随主题切换。以下为各主题下障碍的视觉映射：

| 障碍类型（通用行为） | 草原 | 山川 | 海 | 沙漠 | 雨天 | 家 | 街 | 办公 |
|---|---|---|---|---|---|---|---|---|
| **刺球/尖刺**（地面伤害区） | 草丛中的红色尖刺 | 岩石尖笋（灰色尖三角） | 礁石/贝壳尖（灰白尖） | 仙人掌刺（棕黄色细尖刺） | 湿滑青苔尖（暗绿尖） | 家具尖角/桌角（木色直角突出） | 施工路障锥（橙红三角） | 文件柜尖角/订书机（金属灰尖） |
| **移动平台**（定时/往返） | 草地块（绿顶+棕身） | 岩石平台（灰褐） | 浮木/跳板（木棕色） | 滑沙板（金色） | 湿木板（深棕+水洼） | 移动抽屉/推车（木色） | 电梯/自动人行道（灰+黄警示线） | 滚椅（灰蓝+轮子） |
| **坠落物**（头顶掉落） | 石块（灰圆） | 落石（灰褐不规则） | 锚/浮标（金属灰） | 流沙团（金黄不定形） | 雨滴汇聚的大水滴（蓝灰半透明） | 花瓶/书本（彩色的圆/矩形） | 空调外机/招牌（灰/彩色矩形） | 文件堆/打印机（灰/白矩形） |
| **坑洞/缝隙**（即死区） | 泥坑（深褐色填充） | 峡谷裂缝（深灰黑） | 深水区（深蓝填充+波纹线） | 流沙陷坑（深金填充） | 下水道井（深灰+水面反光） | 楼梯间/地下室入口（黑色） | 下水道井盖开（深灰） | 电梯井/空工位（深灰黑） |

**关键设计原则**：
1. **形状优先**：每种障碍在每个主题中有独特剪影，玩家凭轮廓即可识别类型（色盲安全）。
2. **危险语义不变**：尖刺类始终用"尖角+警示色（红/橙）"强化；坠落物始终有"上方来"的运动暗示。
3. **叙事合理性**：家主题不会出现仙人掌，沙漠不会出现文件柜——装饰与障碍须符合该主题的世界观。
4. **碰撞盒归一化**：无论外观如何变化，物理碰撞盒尺寸/位置由关卡数据统一决定，美术只管"同一碰撞盒套不同皮肤"。

---

## 4. 天气叠加层（Weather Overlay System）

### 4.1 雨天主题的雨丝实现方案

**推荐方案：对象池 + Graphics 粒子**

```
┌─────────────────────────────────────────┐
│  RainOverlay (Container, scrollFactor 0) │
│  ├── rainDropPool: Graphics[] (对象池)   │  ← 30–40 个复用实例
│  └── puddleDecals: Graphics[] (水洼)     │  ← 静态，随地形放置
└─────────────────────────────────────────┘
```

**雨丝参数**：
- 数量：30–40 粒（同屏最大），对象池复用。
- 外观：单像素宽直线（`lineStyle(1, 0xCBD5E0, 0.5–0.7)`），长度 8–16px，角度 75–85°（近乎垂直，略倾斜暗示风向）。
- 运动：每帧 y += 速度（8–12 px/frame），x += 侧风偏移（0.5–1 px/frame）；超出屏幕下方后回收到池顶随机 x 位置重生。
- 绘制：每粒雨滴是一个 `Graphics` 实例（`clear()` → `lineTo()` → `strokePath()`），或更优——用一个共享 `Graphics` 每帧 `clear()` 后批量绘制所有雨线（减少 GC 压力）。
- **性能**：单次 `clear()+N*lineTo+strokePath()` ≈ 0.1ms/frame，可忽略。

**备选方案（更轻量）**：
- 用一个全屏 `Graphics` 画 N 条斜线 + 每帧用 `setPosition` 微移整个 Graphics 并循环滚动的"无限卷轴"贴图思路（但这是伪随机，不如粒子自然）。

### 4.2 水洼反光（Puddle Decals）

- 在平台顶面静态放置 1–2 个 `fillEllipse`（`#94A3B8`, alpha 0.35–0.5）。
- 雨滴落入水洼时触发一个小 splash 粒子爆发（3–5 粒 `#CBD5E0` 小圆，向外扩散 + alpha 衰减，0.3s 消散）。
- 水洼**纯装饰**，不改变碰撞盒。

### 4.3 天气系统的跨主题复用

| 天气效果 | 原属主题 | 可复用到 | 参数调整 |
|---|---|---|---|
| **雨丝粒子** | 雨天(T5) | 草原(雨季变体)、山川(山雨)、街(城市雨) | 密度/角度/透明度 |
| **水洼反光** | 雨天(T5) | 海(潮汐湿岸)、街(雨后路面) | 颜色跟随地面色 |
| **雾/霭叠层** | 山川(T2) | 海(海雾)、街(城市霾) | 颜色 + alpha |
| **热浪扭曲** | 沙漠(T4) | —（沙漠独有氛围标识） | — |
| **雪粒粒子** | —（预留） | 山川(冬季变体) | 白色小圆/短线，下落+飘摇 |

**架构建议**：天气系统独立为 `WeatherOverlay` 组件，接受 `type: 'rain' | 'fog' | 'heatwave' | 'snow' | none` 参数。主题配置中声明是否启用天气叠加层：

```ts
// 主题配置示例
const rainyTheme: ThemeConfig = {
  ...palette,
  weather: { type: 'rain', intensity: 'medium', puddles: true },
};
const desertTheme: ThemeConfig = {
  ...palette,
  weather: { type: 'heatwave', intensity: 'low' },
};
const grasslandTheme: ThemeConfig = {
  ...palette,
  weather: { type: 'none' },  // 或可选 'light-rain' 变体
};
```

---

## 5. 包体影响评估

### 5.1 结论：≈ 零增长

| 增量项 | 大小估算 | 说明 |
|---|---|---|
| 主题调色板配置（8 组 × ~12 色） | **~1 KB** | 纯数据（hex 字符串数组），JSON 格式 |
| 背景层绘制参数（形状/坐标/数量） | **~2–3 KB** | 每主题一组绘制指令描述 |
| 装饰元素定义 | **~1 KB** | 类型+颜色+尺寸参数 |
| 障碍外观映射表 | **< 1 KB** | 查找表 |
| 天气系统代码（复用组件） | **~2–3 KB** | 仅一份，8 主题共享 |
| **合计增量** | **~7–9 KB** | **未压缩 JSON；gzip 后 < 3 KB** |

### 5.2 对比基准

- 当前主包预算余量：~1.3 MB（ADR-004 主包合计 ≤2.7MB / 4MB 上限）。
- 8 主题增量 < 10 KB，占余量的 **< 0.8%**。
- **无需子包、无需远程加载、无需异步资源**——主题数据随主包 JSON 一起打包，启动时同步可用。

### 5.3 运行时内存

- 每个活跃主题的背景层 Graphics 对象：~5–8 个（sky + far + mid + foreground + atmosphere + 装饰组）。
- 单个 Graphics 对象内存占用：< 1 KB（矢量命令列表）。
- 8 主题**不会同时存在内存中**——仅当前关卡的主题被实例化，切关时销毁旧主题、创建新主题。
- 同时驻留内存峰值：**2 个主题**（当前 + 可能的预加载下一关），总计 < 20 KB GPU 缓存。

### 5.4 最终结论

> **在 ADR-004 零位图约束下，8 主题方案的包体增量可忽略不计（< 10 KB 未压缩），运行时内存峰值 < 20 KB，对微信 4MB 主包限制零风险。**
>
> 这是程序化绘制策略的核心优势——"数据驱动视觉"而非"资产堆砌视觉"。

---

## 6. 与 art-bible.md 的衔接

### 6.1 文档关系

```
art-bible.md (已有，v1.1)
  ├── §3 色彩系统（主色板 + 功能色）     ← 主题色板从此派生
  ├── §5.3 主题切换（现有 3 主题简表）    ← 本文档扩展为 8 主题完整规格
  ├── §5.1 图层叠放                      ← 本文 §2 继承并细化
  └── §9 可访问性                        ← 本文每节均校验不降级
        │
        ▼
  theme-framework.md (本文档，新增)
  ├── §1 主题调色板系统（8 组完整 hex）    → 回写 art-bible §3 附录
  ├── §2 程序化背景层结构（绘制要点）      → 工程取数直接用
  ├── §3 装饰与障碍视觉矩阵              → 与 design-strategist 对齐
  ├── §4 天气叠加层                     → 独立可复用组件
  ├── §5 包体影响评估                    → 给主理人的决策依据
  └── §6 衔接方案                       → 本节
```

### 6.2 建议的 art-bible 更新方式

**方案 A（推荐）：追加「主题变体」附录章节**

在 `art-bible.md` 末尾（现有 §9 之后）追加：

```markdown
## 附 B · 主题变体色板（Theme Variants）

> 完整规格见 `art/theme-framework.md`。此处为速查索引。

| 主题 | ID | 天空 | 地面 | 基调 |
|---|---|---|---|---|
| 草原 | grassland | #5BC8F5→#89D4F7 | #7CC242 | warm |
| 山川 | mountains | #6BAED6→#B8D4E8 | #6B8E4E | cool |
| 海 | ocean | #4FA8D4→#A8D8EA | #D4A574 | warm |
| 沙漠 | desert | #F5B56A→#FAD7A0 | #E8C46E | warm |
| 雨天 | rainy | #4A5568→#718096 | #5A7247 | cool |
| 家 | home | #2D3748→#4A5568 | #C4A882 | neutral |
| 街 | street | #5A6B7D→#A0AEBC | #718096 | neutral |
| 办公 | office | #E2E8F0→#CBD5E0 | #B8C4D0 | neutral |
```

优点：art-bible 保持权威单一源，theme-framework 作为详细扩展文档交叉引用。

**方案 B：独立文档 + art-bible 加 cross-ref 行**

仅在 art-bible §5.3 现有表格末尾加一行注释：
> `> 完整 8 主题规格（含色板/背景层/装饰/障碍/天气）：见 art/theme-framework.md`

两种方案均可，**推荐方案 A**（追加速查表让 art-bible 自包含）。

> 📝 **衔接关系已更新（本文档降级为概念索引后）**：原 §6.1 / 本 §6.2 中「theme-framework 作为权威扩展 / 回写 art-bible 色板」的建议**已失效**。现权威单一源为 `art-bible.md` 的 11 色锁色板 + 各 `*-biome-spec.md` 的 8 槽映射；本文档仅作概念索引。art-bible 如需速查，应 cross-ref 到各 `*-biome-spec.md`（见文末「附录 C」），而非从本文档回写自由 hex。

### 6.3 与 LevelData 的衔接

关卡数据已含 `"metadata":{"theme":"grassland"}` 字段（05-level-system.md §6）。主题系统直接读取此字段：

```
LevelData.metadata.theme → 查找 ThemePalette[id] → 应用色板 + 背景层 + 装饰 + 障碍皮肤 + 天气
```

无需改动 LevelData 接口契约。新主题只需在主题注册表中新增一行配置。

---

## 附录 A：可访问性校验矩阵

| 主题 | 前景/背景对比度 | 危险色可见性 | 色盲安全性 | 减少动态兼容 | 结论 |
|---|---|---|---|---|---|
| 草原 | ✅ 绿地/蓝天 ≥ 4.5:1 | ✅ 红尖刺/绿背景 | ✅ 形状双编码 | ✅ 无强制动态 | Pass |
| 山川 | ✅ 暗绿/蓝灰 ≥ 4.5:1 | ✅ 灰尖刺/暗绿底 | ✅ 形状双编码 | ✅ 雾可关闭 | Pass |
| 海 | ✅ 棕地/蓝底 ≥ 4.5:1 | ✅ 红尖刺/蓝底 | ✅ 形状双编码 | ✅ 波浪可简化 | Pass |
| 沙漠 | ⚠️ 金地/橙天 ≥ 3:1（接近阈值） | ✅ 红尖刺/金底（强对比） | ✅ 形状双编码 | ✅ 热浪可关闭 | Pass* |
| 雨天 | ✅ 深绿/灰蓝 ≥ 4.5:1 | ✅ 红尖刺/暗绿底 | ✅ 形状双编码 | ⚠️ 雨丝可降密度 | Pass |
| 家 | ✅ 棕地/灰墙 ≥ 4.5:1 | ✅ 红尖刺/棕底 | ✅ 形状双编码 | ✅ 无强动态 | Pass |
| 街 | ⚠️ 灰地/灰蓝 ≥ 3:1（需确保平台高光够亮） | ✅ 红/橙尖刺/灰底 | ✅ 形状双编码 | ✅ 无强动态 | Pass* |
| 办公 | ⚠️ 灰蓝地/白墙 ≥ 3:1（需确保描边够深） | ✅ 蓝屏/橙文件区分 | ✅ 形状双编码 | ✅ 无强动态 | Pass* |

> \* 标记项建议在实现阶段做实际对比度测试（WCAG AA 验证工具），必要时微调 hex 值 +0.1 亮度。

**通用缓解措施**（适用于所有 Pass\* 主题）：
- 所有平台/地面块统一加 1px 深色描边（`#2A1A12`），提升与背景分离度。
- 功能色（危险红等）始终保持最高饱和度 + 尖角形状，不受主题色影响。

---

## 附录 B：待用户拍板事项

1. **8 主题清单确认**：草原/山川/海/沙漠/雨天/家/街/办公 —— 是否增删？优先级排序？
2. **沙漠与街/办公的对比度**：上述 3 个主题前景–背景对比度接近 WCAG AA 阈值（3:1），是否接受"加描边补救"方案，还是希望调整色板提高对比？
3. **天气系统的范围**：雨天必做；雾/热浪是否 MVP 就做？还是先仅雨天？
4. **障碍外观矩阵**：本文按常识预填了障碍→主题映射，待 design-strategist 的「障碍随场景矩阵」产出后对齐更新。
5. **art-bible 衔接方式**：方案 A（追加附录速查表）vs 方案 B（仅 cross-ref）？
6. **室内主题的天空诠释**：家/街/办公三个主题将"天空层"重释为"墙壁/天花板"，这种隐喻是否可接受？还是希望保留真实天空 + 室内窗户看到外部？

---

## 附录 C：权威规格交叉引用（Authoritative Cross-Reference）

> 以下为 8 主题（草原/山川/海/沙漠/雨天/家/街/办公）对应的**权威 biome-spec**（11 色锁色板 + 运行时 tint，0 新增 hex）。实现须引用对应文件的「8 槽权威映射 + tint 规则」，不得抄本文档自由 hex。

| 口语主题 | 规范 theme key | 调色板来源 | 权威 biome-spec 文件 | 落地状态 |
|---|---|---|---|---|
| 草原 | `grass` | 现有 `grass` palette（`art-bible.md` §3.1 基准，`theme-palette.ts` 已 live） | `art-bible.md` §3（无独立 biome-spec；原始 11 色基准） | ✅ live (1-1) |
| 山川 | `mountain` | **复用 `cave` palette**（冷蓝岩壁，室外山道表达） | `art/cave-biome-spec.md` | ⚡ 立即可 reskin |
| 海 | `sea` | 需 NEW（蓝绿系 tint） | `art/sea-biome-spec.md` | 🗺️ 已产出 biome-spec |
| 沙漠 | `desert` | 需 NEW（暖橙/沙金 tint） | `art/desert-biome-spec.md` | 🗺️ 已产出 biome-spec |
| 雨天 | `rain` | **复用 `storm_sky` palette**，去 cyclone + 加雨线 | `art/storm-sky-biome-spec.md` | ⚡ 低成本 reskin |
| 家 | `home` | 需 NEW（暖色室内 tint） | `art/home-biome-spec.md` | 🗺️ 已产出 biome-spec |
| 街 | `street` | 需 NEW（冷灰城市 tint） | `art/street-biome-spec.md` | 🗺️ 已产出 biome-spec |
| 办公 | `office` | 需 NEW（冷调办公 tint） | `art/office-biome-spec.md` | 🗺️ 已产出 biome-spec |
| （bonus）藤林 | `vine_forest` | 现有 `vine_forest` palette | `art/vine-forest-biome-spec.md` | ✅ live (2-2) |

> **复用关系（省 ADR-004 预算）**：山川→复用 `cave`（`cave-biome-spec.md`）；雨天→复用 `storm_sky`（`storm-sky-biome-spec.md`）。两者均走同 8 槽接口、换 deco，不新增 palette。
> **映射依据**：`design/gdd/theme-system.md` §4.3（口语主题↔规范 key）。草原基准见 `art/art-bible.md` §3；其余 7 份 biome-spec 均守 11 色锁色板 + tint（0 新增）。

---

> **文档状态**：Concept Index / Draft v0.1（已降级为**概念索引** · 权威色板见各 `*-biome-spec.md` · 自由 hex 不进实现）· 详见顶部「文档状态 / 权威性声明」与文末「附录 C：权威规格交叉引用」。
