# 风暴天空 biome 美术规格（storm-sky-biome-spec）

> 文档类型：biome 美术规格（加法扩展，`art/cave-biome-spec.md` 同构；即 `design/levels/2-3-content-spec.md` 附录 A 的权威落地）
> 作者：art-director（林绘澄）
> 上游依据：`design/levels/2-3-content-spec.md` §6 / 附录 A（theme=`storm_sky`）｜`design/gdd/15-cyclone-enemy.md` §7.3｜`art/art-bible.md` §3·§5.3·§9｜`art/asset-spec.md` §2·§3.1｜`art/cave-biome-spec.md`（同构基线）｜`src/game/render/theme-palette.ts`（既有 8 槽接口）
> 关联任务：AD-BC-01（high）｜评审强度：lean
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；本文件**只写文档，不写/改任何 `.ts` 代码**；theme 名严格 `storm_sky`；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**风暴天空主题视觉**与**新元素气旋 `cyclone` 视觉**；玩法/数值/物理由 GDD15 与工程负责。

**权威锁色板（11 色，≤64 红线基准；本 biome 全部引用色取自此表，0 新增）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 卷叶粒子（少用，生机体） |
| 2 | 阴影绿 | `#5FA82F` | 卷叶暗部（少用） |
| 3 | 暖橙 | `#F2933C` | 闪电点缀 / 暖意反差 |
| 4 | 暖黄 | `#FFD23F` | 电光核心 / 上升叶瓣粒子 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | HUD 爱心（沿用） |
| 7 | 警示红 | `#E8483B` | 危险语义（chong_feng/shi_pao） |
| 8 | 经济金 | `#F2C94C` | coin（沿用） |
| 9 | 蓝紫 | `#6E7BF2` | 悬浮岩台主面 / 气旋辉光 |
| 10 | 环境冷蓝 | `#4A78C0` | 阴沉天光 / 石炮石身 |
| 11 | 天空 | `#5BC8F5` | 气旋主体 / 气流辉光 |

> 本 biome 蓝系主导（蓝紫/环境冷蓝/天空/描边）+ 暖橙/暖黄微光反差；全部引用色取自锁色板，**派生暗面由 `#4A78C0`/`#6E7BF2` 运行时 tint**（0 新增，对齐 2-3 附录 A·4）。

---

## 1. theme→palette 8 槽权威映射

### 1.1 概念槽 → 引擎字段映射（同构 cave，便于 eng 直接注册）

| 概念槽（任务命名） | 引擎 `ThemePalette` 字段 | 角色 |
|---|---|---|
| sky | `bg` | 背景 / 天空填充 |
| ground | `rockFace` | 地面主面（悬浮岩台 / 实心瓦片） |
| accent | `rockBody` | 地面暗面（岩台底 / oneway） |
| hazard | `danger` | 警示红（危险双编码） |
| foliage | `crystalGlow` | 气流辉光（冷蓝天光反差） |
| trim | `crystalCore` | 核心高光（电光 / 叶瓣） |
| outline | `outline` | 全局描边 |
| seed | `firelight` | 暖色点缀（闪电 / 暖意） |

### 1.2 风暴天空 8 槽权威 hex（必须给，全部锁色板色）

| 概念槽 | 引擎字段 | 权威 Hex | 来源 | 锁色板 # |
|---|---|---|---|---|
| sky | `bg` | `#4A78C0` | 环境冷蓝 | #10 |
| ground | `rockFace` | `#6E7BF2` | 蓝紫 | #9 |
| accent | `rockBody` | `#4A78C0` | 环境冷蓝（同 bg 冷调） | #10 |
| hazard | `danger` | `#E8483B` | 警示红 | #7 |
| foliage | `crystalGlow` | `#5BC8F5` | 天空 | #11 |
| trim | `crystalCore` | `#FFD23F` | 暖黄 | #4 |
| outline | `outline` | `#2A1A12` | 描边 | #5 |
| seed | `firelight` | `#F2933C` | 暖橙 | #3 |

> 8 个权威 hex 全部落在锁色板内（`bg` 与 `rockBody` 同为 `#4A78C0`，属有意复用，非新增），**无任何新 hex**（tint 不计入新增，见 §7）。

### 1.3 派生 tint 规则（0 新增）

| 派生 | 计算 | 用途 | 是否新色 |
|---|---|---|---|
| 云层/远景阴影 | `darken(#4A78C0, 0.4)` ≈ `#2C486F` | parallax 远层（无描边、低饱和） | 0 新增（tint） |
| 悬浮岩台暗面 | `darken(#6E7BF2, 0.45)` ≈ `#3A4285` | 岩台底部/oneway | 0 新增（tint） |
| 石炮石身暗面 | `darken(#4A78C0, 0.5)` ≈ `#254060` | shi_pao 阴影（见 §4.3） | 0 新增（tint） |

---

## 2. 瓦片调色板规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；风暴天空经 theme palette 映射（§1.2）生成，**不另绘瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定一致；仅主色由草绿（base）→ 蓝紫 `#6E7BF2`、身色由暖橙（base）→ 环境冷蓝 `#4A78C0`。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位，非碰撞）**：
  - `deco_float_isle` 悬浮岩台：空中漂浮的方/圆角岩块（蓝紫 `#6E7BF2` 面 + 暗面 tint + 描边），中景装饰（不参与碰撞）。
  - `deco_lightning` 闪电纹：背景偶现的之字闪电（暖橙 `#F2933C` / 暖黄 `#FFD23F`，短暂闪现 ≤0.2s、<3Hz，守防光敏），纯氛围。
  - `deco_leaf` 卷叶粒子：随气流上升的小叶/瓣（暖黄 `#FFD23F` / 草绿 `#7CC242`，半透，沿气旋 `phase` 旋转）。
  - MVP：用 `Graphics` 画简单多边形/线占位，程序化 tint，无需 PNG。
- **IP**：悬浮岩台/闪电为原创自然气象形态，非风车/云朵传送带符号。

---

## 3. 气旋 `cyclone` 视觉规格（新元素 · 蓝系 · 纯辅助力场）

> 对齐 GDD15 §7.3。形状语言优先：气旋 = **半透明上升气流蓝气柱 + 漩涡辉光 + 上升叶瓣**，与鼓苞（实心橙刺柱）、弹藤（实心绿线圈）、4 旧敌剪影全异。配色：气柱 `天空 #5BC8F5`（半透）+ 漩涡辉光 `蓝紫 #6E7BF2` + 上升粒子 `暖黄 #FFD23F` + 描边 `#2A1A12`。
> 几何基准（GDD15 §3）：bbox `width=96`、`height=160`（默认 3×5 tile），`(cx,cy)` 为中心/顶；力场 `hazard=false`。

### 3.1 力场态明细（视觉随 `phase` 旋转，非状态机）

| 维度 | 视觉 | 配色 | 危害 | 可踩 |
|---|---|---|---|---|
| 区域气柱 | 半透明竖直气柱，随 `phase` 漩涡旋转 | 气柱 `天空 #5BC8F5` alpha ≤0.35；漩涡辉光 `蓝紫 #6E7BF2` | 否（恒无害） | 否（非实体） |
| 上升粒子 | 沿气柱上升的叶/瓣，随相位流动 | `暖黄 #FFD23F`（或 `草绿 #7CC242`）半透 | 否 | — |
| 边缘 | 气柱轮廓轻描边 | `描边 #2A1A12`（细，alpha 低） | 否 | — |

### 3.2 绘制约定（MVP Graphics）

- **气柱主体**：竖直矩形/微喇叭形（宽 96、高 160），`天空 #5BC8F5` 填充 alpha ≤0.35；内部叠 `蓝紫 #6E7BF2` 螺旋辉光（alpha ≤0.4），随 `phase` 旋转（≤3Hz 防光敏）。
- **上升粒子**：`暖黄 #FFD23F` 小瓣/点，沿气柱自下而上缓移、循环，半透；"减少动态"开关下减半/停首帧。
- **区分强化**：鼓苞=实心橙刺柱（危害）/ 弹藤=实心绿线圈（地面辅助）/ 气旋=**半透明蓝气柱（空中力场）**——形态（实心 vs 半透明气柱）+ 透明度 + 颜色三重区分，色盲安全（靠"实心 vs 半透明"形状语言）。

### 3.3 与鼓苞 / 弹藤 / 4 旧敌轮廓对比（确保全异 · 色盲安全）

| 元素 | 轮廓 | 主色 | 气旋区分点 |
|---|---|---|---|
| `gu_bao` 鼓苞 | 垂直刺苞柱（实心） | 暖橙 | 气旋 = **半透明蓝气柱**（实心 vs 半透） |
| `bouncy_vine` 弹藤 | 扁地面线圈（实心） | 草绿 | 气旋 = 空中半透明柱（地面 vs 空中） |
| `ci_li` 刺栗 | 圆球 + 周身短刺 | 警示红 | 气旋 = 蓝气柱无刺 |
| `chong_feng` 锥冲 | 长条楔形 | 警示红 | 气旋 = 竖直半透柱（非楔形） |
| `du_fu` 嘟浮 | 扁圆 + 双翅 | 蓝紫 | 气旋 = 高耸气柱（非小扁圆） |
| `shi_pao` 石炮 | 方正石块 + 炮口 | 环境冷蓝 | 气旋 = 半透流体（非方块炮台） |

> 结论：气旋以 **「半透明天空蓝气柱 + 蓝紫漩涡 + 暖黄上升叶瓣」** 剪影唯一，与所有实体全异；靠**半透明 vs 实心**形态语言区分，色盲安全。

### 3.4 后续像素化路径（AI 生成提示词预留）

- **cyclone**：`pixel art, 32px grid, translucent sky-blue updraft column, sky blue #5BC8F5 alpha, blue-purple #6E7BF2 swirl glow, warm yellow #FFD23F rising leaf particles, no windmill no cloud-conveyor, flat toon`
- **storm tile**：`pixel art tile, 32x32, blue-purple #6E7BF2 rock face, cold blue #4A78C0 body, 1px dark outline #2A1A12, stormy`
- **deco_lightning**：`pixel art, short zigzag lightning, warm orange #F2933C core, warm yellow #FFD23F edge, brief`

---

## 4. 敌种视觉规格（着色指引 · 限锁色板内）

> 通用规则（asset-spec §2.5）：可踩顶 = 软｜不可踩顶 = 硬；警示红 `#E8483B` 仅强化，形状为主，色盲安全。
> **越界 reconcile 声明**：同 vine_forest §4——将 asset-spec §2 中 `du_fu`/`chong_feng`/`shi_pao` 的越界生产色（`#A9B8F5`/`#B5302A`/`#F2A39C`/白眼/`#F4EFE6`/`#8A8276`）映射到下表锁色板色 / tint（0 新增），提请主理人 reconcile `asset-spec §2`。

### 4.1 `du_fu` 嘟浮（飞行 / 可踩 / 扁圆+翅 / 蓝紫）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `蓝紫 #6E7BF2` | 锁色板 #9（避用增益紫 `#9B6CF2`） |
| 高光（替越界 `#A9B8F5`） | `天空 #5BC8F5` | 锁色板 #11 |
| 翅膜 | `蓝紫 #6E7BF2` 半透（alpha ≤0.5） | — |
| 肚皮强调（蓝底反差·强烈建议） | `暖黄 #FFD23F` 小斑 | 锁色板 #4；本关蓝紫地面/天空下提升辨识 |
| 眼（替白） | `暖黄 #FFD23F` 小点 | 锁色板 #4 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 尺寸/动画沿用 asset-spec §2.3（`36×32` / float 4f / stomped 3f）；soft 顶。

### 4.2 `chong_feng` 锥冲（地面冲锋 / 不可踩 / 长条楔形 / 警示红）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 主体 | `警示红 #E8483B` | 锁色板 #7（与 ci_li 同色，靠楔形轮廓区分） |
| 阴影（替越界 `#B5302A`） | `darken(#E8483B, 0.5)` tint | 0 新增 |
| 前缘高光（替越界 `#F2A39C`） | `lighten(#E8483B, 0.4)` tint（粉调，0 新增） | 强化楔形尖 |
| 眼（替白） | `天空 #5BC8F5` 小点 | 锁色板 #11 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 尺寸/动画沿用 asset-spec §2.2（`48×28` / idle·detect·charge·stun）；hard 顶（楔形前尖，不可踩）。

### 4.3 `shi_pao` 石炮（固定炮台 / 不可踩 / 方+石身 / 环境冷蓝）

| 部位 | 权威色 | 来源 / 备注 |
|---|---|---|
| 石身（替越界 `#F4EFE6`） | `环境冷蓝 #4A78C0` | 锁色板 #10（冷蓝灰石） |
| 阴影（替越界 `#8A8276`） | `darken(#4A78C0, 0.5)` ≈ `#254060` tint | 0 新增 |
| 炮口/警示 | `警示红 #E8483B` 描边/闪 | 锁色板 #7 |
| 弹丸 `fx_projectile` | `警示红 #E8483B` + `暖黄 #FFD23F` 拖尾 | 锁色板 #7/#4 |
| 描边 | `#2A1A12` | 锁色板 #5 |

- 尺寸/动画沿用 asset-spec §2.4（`32×32` 实心）；hard 顶。
- **本关对比提示**：石身 `#4A78C0` 与 storm bg/rockBody 同色，靠 `描边 #2A1A12` + 红炮口 + 方硬轮廓 + 多置于蓝紫 `#6E7BF2` 岩台之上维持辨识（见 §6）。

### 4.4 三敌可踩/不可踩视觉语言汇总（与 cave/vine 一致）

| 敌 | topIndicator | 顶缘形状 | 强化色 | stompable |
|---|---|---|---|---|
| 嘟浮 du_fu | soft | 扁圆顶，翅在侧 | — | ✅ |
| 冲锋 chong_feng | hard | 楔形前尖 / 硬棱 | 警示红（全主体，靠楔形区分） | ❌ |
| 石炮 shi_pao | hard | 方硬顶 + 炮口 | 警示红描边 | ❌ |

---

## 5. 天空视差层级 + 风效 / 气流氛围（风暴天空）

**氛围意图**（2-3 §6）：阴沉风暴天空——蓝紫岩台悬浮、冷蓝天光、暖橙闪电点缀、半透气旋卷叶，靠**蓝紫主色 + 冷蓝天光 + 暖橙微光**制造"压抑中藏生机"对比。

**光照**：overcast 冷调、整体降低饱和（art-bible §3.3：背景饱和度压到 30–40%、明度 +10%）；前景/实体保持高对比（任意前景与背景亮度对比 ≥3:1）。

**视差层级（建议 4–5 层）**

| 层 | parallax | 内容 | 配色（锁色板） |
|---|---|---|---|
| 天空 | — | 纯色填充 | `bg = #4A78C0`（阴沉冷蓝） |
| 远景 | 0.3 | 浮岛剪影 / 云层 | `darken(#4A78C0,0.4)` 剪影，无描边、低饱和 |
| 中景 | 0.5–0.6 | 悬浮岩台 / 闪电纹 | `蓝紫 #6E7BF2` + `暖橙 #F2933C` 闪电 |
| 游戏层 | 1.0 | 岩台/气旋/敌/道具/主角 | `rockFace #6E7BF2` / `rockBody #4A78C0` / 描边 |
| 前景 | 1.2（克制） | 卷叶粒子 / 风线掠过 | `天空 #5BC8F5` alpha，遮挡路径 ≤10% |

**风效 / 气流**：半透明风线（`天空 #5BC8F5` alpha ≤0.3，横向短划）随视差流动；气旋（§3）为核心气流载体。闪电（`deco_lightning`）短暂闪现 ≤0.2s、<3Hz，守防光敏。

**与藤林 / 洞穴的基调反差**：洞穴暗冷蓝、藤林明绿——风暴天空=冷蓝天光 + 蓝紫岩台，同套 8 槽接口下仅靠 hex 即拉开"幽暗→明绿→压抑风暴"的序列差。

---

## 6. 可访问性（与 vine_forest + cave 明显区分）

- **主题色相区分（三关不撞色）**：
  - cave = **冷蓝灰** 地面（`#4A78C0`）+ 暗背景 → "幽暗"。
  - vine_forest = **草绿** 地面（`#7CC242`）+ 亮天空 → "明绿生机"。
  - storm_sky = **蓝紫** 地面（`#6E7BF2`）+ 冷蓝天光（`#4A78C0`）→ "压抑风暴"（本关唯一紫蓝地面 + 唯一半透明气柱）。
  - 地面主色 + 天空色即首要区分信号，色盲玩家靠**地面 hue + 装饰形态**（晶/藤/气旋）即可分辨。
- **新元素双编码**：气旋=半透明蓝气柱（形态+透明度独一），与鼓苞实心橙刺柱、弹藤实心绿线圈三重区分，色盲安全。
- **敌种在蓝底关的反差**：`du_fu` 加 `暖黄 #FFD23F` 肚皮斑（蓝紫身上暖点，强对比）；`chong_feng` 楔形尖 + 粉调高光；`shi_pao` 靠描边+红炮口+方硬轮廓 + 置于蓝紫岩台之上维持辨识（§4.3）。
- **静态可读**：所有实体最小显示尺寸 ≥32px 下仅凭剪影判"能否踩"（§4.4）；闪电/气旋旋转 ≤3Hz（防光敏）。
- **减少动态**：气旋粒子、风线、闪电在"减少动态"开关下减半或停首帧（对齐 art-bible §9.3 / asset-spec §6.5）。

---

## 7. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#4A78C0` / `#6E7BF2` / `#5BC8F5` / `#2A1A12` / `#F2933C` / `#FFD23F` / `#E8483B` = **7 色**（锁色板 #3/4/5/7/9/10/11）；`bg` 与 `rockBody` 同取 `#4A78C0`（有意复用，非新增）。
- **派生 tint（0 新增）**：云层 `darken(#4A78C0,0.4)`、岩台暗面 `darken(#6E7BF2,0.45)`、石炮阴影 `darken(#4A78C0,0.5)`，均由锁色板色运行时 darken 生成，**不计入新增 hex**。
- **草原/全局沿用色（仍在锁色板内）**：同屏还含 `命粉 #F26D8B`（HUD 爱心）、`经济金 #F2C94C`（coin）、`草绿 #7CC242`/`阴影绿 #5FA82F`（卷叶粒子）——均属锁色板 #1/2/6/8。
- **总色数核算**：全关引用**已锁色板 11 色** + 若干运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **越界 reconcile**：同 vine_forest §4，将 asset-spec §2 中 `du_fu`/`chong_feng`/`shi_pao` 的越界生产色映射到上表锁色板色 / tint，提请主理人据此更新 asset-spec §2（非本 biome 引入，属全局 reconcile）。

---

## 8. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 现有 `theme-palette.ts` 实现 theme→palette 解析器时，直接消费下列字段名与常量。**本 biome 不写 `src/`，仅定义契约。**

### 8.1 字段与取值

- **字段**：`LevelData.metadata.theme`
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`（2-1）｜`'vine_forest'`（2-2）｜**`'storm_sky'`（2-3，新增）**。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。
- **需扩展**：`level-data.ts` 的 `LevelTheme` 联合类型增 `'vine_forest' | 'storm_sky'`（fail-safe 回退 `'grass'`）。

### 8.2 风暴天空调色板注册表（解析器应消费的颜色常量名 + hex 映射）

> 复用既有 `ThemePalette` 接口 8 字段，仅 add 一个 `storm_sky` entry。下表为注册数据（非代码）：

| 引擎字段 | storm_sky Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x4A78C0` | 环境冷蓝 #10 |
| `rockFace` | `0x6E7BF2` | 蓝紫 #9 |
| `rockBody` | `0x4A78C0` | 环境冷蓝 #10（同 bg） |
| `outline` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xF2933C` | 暖橙 #3 |
| `crystalCore` | `0xFFD23F` | 暖黄 #4 |
| `crystalGlow` | `0x5BC8F5` | 天空 #11 |
| `danger` | `0xE8483B` | 警示红 #7 |

### 8.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点 | 应改为（风暴天空取值） |
|---|---|
| `drawTerrain` 地面填充 | 读 `THEME_PALETTES['storm_sky'].rockFace`(`#6E7BF2`) / `.rockBody`(`#4A78C0`) |
| 背景色 | 运行时 `setBackgroundColor(THEME_PALETTES['storm_sky'].bg)`(`#4A78C0`) |
| 气旋占位（`cyclone-view.ts` 新增） | 气柱=`crystalGlow`(`#5BC8F5`)+alpha；漩涡=`rockFace`(`#6E7BF2`)；粒子=`crystalCore`(`#FFD23F`)；描边=`outline` |
| 敌种/装饰绘制 | 见 §4 锁色板映射；石炮石身=`环境冷蓝 #4A78C0`（`THEME_PALETTES` 未单独存，由 `#4A78C0` 常量取） |

### 8.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme: 'grass' | 'cave' | 'vine_forest' | 'storm_sky'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES[theme]` 的 8 字段（`bg`/`rockFace`/`rockBody`/`outline`/`firelight`/`crystalCore`/`crystalGlow`/`danger`）。
- **风暴天空映射**：bg=`#4A78C0`、rockFace=`#6E7BF2`、rockBody=`#4A78C0`、outline=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#FFD23F`、crystalGlow=`#5BC8F5`、danger=`#E8483B`；派生暗面由锁色板色运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES['storm_sky']`；气旋走新增 `cyclone-view` 分支。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为风暴天空 biome 美术规格（加法），即 `design/levels/2-3-content-spec.md` 附录 A 的权威落地；未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §8 契约）。*
