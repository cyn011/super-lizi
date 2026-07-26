# super-mali · 底部虚拟按钮视觉样式调研（button-style-research）

> 文档类型：UI 视觉调研 / 方案对比（给主理人拍板 + engineering-lead 落盘）  
> 作者：art-director（林绘澄）  
> 日期：2025-07-27  
> 触发：用户反馈"蓝色海背景下按钮样式太深"  
> 范围：仅 `src/ui/touch-buttons.ts` 的**视觉层**（填充/描边/图标/透明度/高光）；**命中区、坐标、半径、输入逻辑一律不动**（任务硬约束）。  
> 评审强度：lean  
> 配套：本文件为调研结论；落盘常量表见 §7（推荐方案 A）。**本文档不修改任何 `.ts` 代码。**

---

## 0. 调研前置（结论速读）

- **"太深"的根因不是单一原因**，而是 4 个叠加：① 方向药丸用了警示红 `#DC4438` 且 alpha 高达 **0.82**（实心感、压在亮蓝天上像一块"重块"）；② 扔栗子用栗色 `#AC703B` 在蓝天上合成出"脏橄榄"；③ 暂停用近黑棕 `#3E2723` 像"黑洞"；④ 3–4px 白边偏粗，整体视觉"重"。
- **当前 4 个填充色全部不在 11 色锁色板内**（`#DC4438`/`#F2C83C`/`#AC703B`/`#3E2723`），且美术侧已定稿的 `art/ui/touch-buttons-spec.md`（变体 B）要求"方向键=白低权重、动作键=暖黄强调"——当前实现与之背离，是"太深"的间接原因。
- 本调研给出 **A/B/C/D 四套方案**，主推 **方案 A（浅色磨砂玻璃）**：保留现有玻璃语言、把 alpha 降到 0.40–0.55、填充全改 11 色锁色板、去掉内圈高光、暂停改浅底深图标。

> ⚠️ **合规备注（需主理人确认）**：本调研将 `0xFFFFFF`（白）视为**通用 UI 中性色**（描边/图标/高光），与全项目既有做法一致（art-bible §3.2「中立/路径 石灰白 #F4EFE6」、全部 biome-spec、当前代码均用白做 UI 边）。11 色锁色板约束的是**填充等显著色相**；白/石灰白作为非色相中性豁免。若主理人要求**严格仅 11 色、连白都不用**，则只有**方案 C（深描边实色亮片）**可落地（其图标仍可接受白，否则需改用锁色板色做图标，对比度会下降——见 §8 决策点 2）。

---

## 1. 问题诊断（为什么显得"深"）

### 1.1 当前实现对照（来自 `src/ui/touch-buttons.ts`，未改）

| 按钮 | 当前 fillColor | 是否锁色板 | fillAlpha | 描边 | 实测观感（蓝海下） |
|---|---|---|---|---|---|
| 方向药丸（左+右合并） | `#DC4438`（暗红） | ❌ 锁色板只有 `#E8483B` | **0.82** | 白 3px | 实心暗红块，压在蓝天上"最重"，是"太深"主因 |
| 跳圆钮 | `#F2C83C`（偏暗黄） | ❌ 锁色板无此值 | 0.55 | 白 4px | 尚可，但非锁色板橙黄 |
| 扔栗圆钮 | `#AC703B`（栗色棕） | ❌ 锁色板无此值 | 0.55 | 白 4px | 棕在蓝上合成脏橄榄，"发闷" |
| 暂停小圆钮 | `#3E2723`（近黑棕） | ❌ 锁色板无此值 | 0.60 | 白 2px | 像黑洞，与"轻快"基调冲突 |
| 通用 | — | — | — | — | 按下描边切 `#FFD23F`（✅ 锁色板 #4）；圆钮带白色内圈高光（alpha 0.15） |

### 1.2 "太深"的四个机制

1. **高不透明度 + 暗色相** → 方向药丸 0.82 红 ≈ 在 `#5BC8F5` 上合成中深色块，读起来"重/深"。
2. **色相与蓝底撞出脏色** → 红/棕在蓝上产生紫/橄榄灰，既不鲜亮也不干净。
3. **暂停近黑** → 在小屏右下/右上形成视觉"黑洞"。
4. **粗白边 + 内圈高光** → 描边与高光都是"加重"元素，叠加后整体偏"厚/深"。

### 1.3 背景双色域（必须同时满足）

海 biome 按钮实际落在两种蓝上（来自 `sea-biome-spec.md` §1.2 / §5）：
- **天空 `#5BC8F5`**（上半，y<0.78 附近）；
- **环境冷蓝 `#4A78C0`**（礁岩地面，y>0.78，比天空**更暗**）。

按钮中心 y≈0.70–0.82，**下半部分压在更暗的冷蓝礁岩上**。因此任何填充必须：
- 在 `#5BC8F5`（亮）与 `#4A78C0`（中暗）上**都**可读；
- 且在草原绿 `#7CC242`、山洞冷蓝棕等其它主题下也不刺眼（调研维度 ①）。

→ 结论：**暗红/栗棕/近黑全部出局；亮色（黄/橙）与中性白在所有蓝/绿/棕底上都稳**；纯绿方向药丸会在草原关"绿底绿钮"撞色，故方向键应回归**中性白**（与美术侧变体 B 一致），而非草绿。

---

## 2. 设计原则（本次调研的锚点）

1. **不深：轻质半透 + 亮填充**。填充 alpha 控制在 0.40–0.55（方向药丸从 0.82 大幅下调），让亮蓝透出来；填充色只用 11 色锁色板里的**高明度**色（暖黄 `#FFD23F`、暖橙 `#F2933C`）或中性白，杜绝暗红/栗棕/近黑。
2. **可读：形状先行 + 颜色强化**（对齐 art-bible §9.1 / Standard 档）。图标用箭头/上三角/栗子/双竖线承载功能，颜色只做强调；不靠颜色 alone 区分。暂停用"浅底 + 深图标"保证高对比。
3. **统一：三主钮一套语言**。方向药丸（中性白，低权重）+ 两个动作圆钮（暖黄/暖橙，强调）共享"半透填充 + 同族描边 + 同色图标 + 同一按压反馈"，形成"方向持久可见、动作按需强调"的家族（对齐 `art/ui/touch-buttons-spec.md` 变体 B 的二层配色思想）。
4. **按压明确但不突兀**：按下态沿用"描边切 `#FFD23F`（锁色板 #4）+ scale 弹性"即可；**去掉内圈高光**、**不新增投影**（投影会更"重"，与"不深"目标相反）。

---

## 3. 方案 A — 浅色磨砂玻璃（Tinted Frosted Glass）★ 主推

> **一句话定位**：保留现有玻璃语言，把方向键还原成"白低权重"、动作键用锁色板亮色，整体降到空气感半透，最稳、最轻、最贴合已定稿规范。

| 项 | 方向药丸（左/右） | 跳圆钮 | 扔栗圆钮 | 暂停小圆钮 |
|---|---|---|---|---|
| fillColor | `0xFFFFFF`（中性白） | `0xFFD23F`（暖黄 #4） | `0xF2933C`（暖橙 #3） | `0xFFFFFF`（中性白） |
| fillAlphaDefault | **0.40** | 0.55 | 0.55 | 0.32 |
| fillAlphaPressed | 0.55 | 0.70 | 0.70 | 0.44 |
| lineWidthDefault | 2 | 3 | 3 | 2 |
| lineWidthPressed | 3 | 4 | 4 | 2 |
| lineColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` |
| iconColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0x2A1A12`（描边 #5，浅底深图标） |

- **内圈高光**：移除（`TouchCircle.redraw` 中 `g.strokeCircle(0,0,r*0.82)` 那圈白 0.15 删除）。
- **阴影/投影**：保持无（当前代码本就无投影；不加）。
- **按压反馈**：描边切 `0xFFD23F`（✅ 锁色板 #4）+ 现有 scale（药丸 0.97 / 圆钮 0.92），明确且不突兀。
- **适用场景**：海/天蓝、草原绿、山洞棕全主题；方向白钮在所有底色上低权重不抢戏，动作键亮色在蓝/绿/棕上都跳得出。
- **风险**：方向药丸 alpha 0.40 在极花哨背景（如满屏亮黄币）上可能略"虚"——可用色盲模式白脉冲（见 §6）补强，无需改填充。

---

## 4. 方案 B — 中性幽灵（Neutral Phantom）

> **一句话定位**：四个按钮**全部**统一为同一块"中性磨砂玻璃"，颜色只在按下时由 `#FFD23F` 描边点亮；最轻、最统一，但弱化颜色编码。

| 项 | 方向药丸 | 跳圆钮 | 扔栗圆钮 | 暂停小圆钮 |
|---|---|---|---|---|
| fillColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` |
| fillAlphaDefault | 0.22 | 0.26 | 0.26 | 0.22 |
| fillAlphaPressed | 0.34 | 0.38 | 0.38 | 0.34 |
| lineWidthDefault | 2 | 3 | 3 | 2 |
| lineWidthPressed | 3 | 4 | 4 | 2 |
| lineColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` |
| iconColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0x2A1A12` |

- **内圈高光**：移除。**阴影/投影**：无。
- **按压反馈**：按下时**描边切 `#FFD23F`** 成为唯一彩色（"点亮"反馈），+ scale。
- **适用场景**：追求极致"不存在感"、让游戏世界完全透出；家族感最强（同一材质）。
- **风险**：① alpha 0.22–0.26 在亮背景上可能过虚、可发现性下降；② 失去 art-bible §3.2「颜色=功能」的编码（靠形状仍可辨，色盲安全，但普通玩家少一层提示）。**缓解**：可对跳/扔做「极淡锁色板 tint」（如扔栗填 `#F2933C` alpha 0.18）恢复部分编码——列为可选。

---

## 5. 方案 C — 实色描边亮片（Solid Bright Chips，art-bible 原生语言）

> **一句话定位**：切回锁色板原生视觉——**深棕 `#2A1A12` 描边 + 高明度实色填充**（与 `virtual-controls-art-spec.md` §8、`art/ui/touch-buttons-spec.md` 变体 B 同源）。用"亮"而非"透"解决"太深"；最贴美术圣经，但覆盖面更大。

| 项 | 方向药丸 | 跳圆钮 | 扔栗圆钮 | 暂停小圆钮 |
|---|---|---|---|---|
| fillColor | `0xFFFFFF` | `0xFFD23F`（暖黄 #4） | `0xF2933C`（暖橙 #3） | `0xFFFFFF` |
| fillAlphaDefault | **0.85** | 0.85 | 0.85 | 0.90 |
| fillAlphaPressed | 0.95 | 0.95 | 0.95 | 0.95 |
| lineWidthDefault | 2 | 2 | 2 | 2 |
| lineWidthPressed | 3 | 3 | 3 | 2 |
| lineColor | `0x2A1A12`（描边 #5） | `0x2A1A12` | `0x2A1A12` | `0x2A1A12` |
| iconColor | `0x2A1A12` | `0xFFFFFF` | `0xFFFFFF` | `0x2A1A12` |

- **内圈高光**：移除（实色亮片走扁平，符合 art-bible §2.4 无 AA/扁平）。**阴影/投影**：无（保持干净）。
- **按压反馈**：描边切 `#FFD23F`（亮片上的暖黄描边 pop）+ scale，反馈最强。
- **适用场景**：希望按钮像"实体糖果片"、与游戏世界像素感更咬合；绝对不"深"。
- **风险**：① 0.85 alpha 比玻璃方案覆盖更多游戏世界（变体 B 原 spec §6.3 已接受 0.75，0.85 略增）；② 视觉语言从当前"玻璃"切换到"实色"，是**最大幅的外观变更**，需团队/玩家接受；③ 严格仅 11 色时此方案最合规（见 §0 合规备注）。

---

## 6. 方案 D — 保守微调（Minimal Patch，可今日上线）

> **一句话定位**：**最小 diff**——保持现有玻璃+白边语言，只把 4 个离板色换成锁色板色、方向药丸 alpha 略降、暂停改浅、去掉内圈高光。风险最低、最快止血。

| 项 | 方向药丸 | 跳圆钮 | 扔栗圆钮 | 暂停小圆钮 |
|---|---|---|---|---|
| fillColor | `0xFFFFFF`（原 `#DC4438`） | `0xFFD23F`（原 `#F2C83C`） | `0xF2933C`（原 `#AC703B`） | `0xFFFFFF`（原 `#3E2723`） |
| fillAlphaDefault | 0.58 | 0.55 | 0.55 | 0.42 |
| fillAlphaPressed | 0.72 | 0.70 | 0.70 | 0.55 |
| lineWidthDefault | 3（原 3） | 3（原 4↓） | 3（原 4↓） | 2 |
| lineWidthPressed | 4 | 4 | 4 | 2 |
| lineColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` |
| iconColor | `0xFFFFFF` | `0xFFFFFF` | `0xFFFFFF` | `0x2A1A12` |

- **内圈高光**：移除。**阴影/投影**：无。
- **按压反馈**：沿用现有（描边切 `#FFD23F` + scale）。
- **与方案 A 的区别**：D 把方向药丸 alpha 保留在 **0.58**（比 A 的 0.40 更"实"、更接近原 0.82 的分量感，团队若担心"钮变小了"可用 D）；描边统一 3px（A 是 2/3 分级）。D = "只换色+去高光"，A = "重新设计为统一轻玻璃家族"。
- **适用场景**：Sprint 末班车、先止血再观望；拿到约 80% 的改善，零惊喜。
- **风险**：最低。唯一代价是方向钮仍偏"实"，未完全达到 A 的空气感。

---

## 7. 方案横向对比 + 推荐

| 维度 | A 浅色磨砂玻璃 | B 中性幽灵 | C 实色描边亮片 | D 保守微调 |
|---|---|---|---|---|
| 解决"太深" | ★★★★★ | ★★★★★ | ★★★★（靠实色亮） | ★★★★ |
| 跨主题安全（蓝/绿/棕） | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| 锁色板合规 | ✅（填充全锁色板/中性） | ✅ | ✅（最严） | ✅（修正离板色） |
| 与已定稿规范对齐 | 高（呼应变体 B 二层配色） | 中（弱化颜色编码） | 高（art-bible 原生） | 中（仅修正） |
| 视觉变更幅度 | 中 | 中 | **大** | **最小** |
| 家族统一感 | ★★★★★ | ★★★★★ | ★★★★ | ★★★★ |
| 实现风险 | 低 | 低 | 中（外观大改） | **最低** |

### 推荐：方案 A（浅色磨砂玻璃）

**理由**：
1. **直接消除"太深"**：方向药丸 alpha 0.82→0.40、去掉内圈高光、暂停近黑→浅底，蓝海下整体"透气"；填充全换锁色板亮色（暖黄/暖橙/白），不再有脏红/脏棕。
2. **合规且对齐既有定稿**：填充 100% 来自 11 色锁色板（或中性白），按下描边用锁色板 `#FFD23F`（顺带修正了当前代码与变体 B 里 off-lock 的 `#B5763E` 按下描边）；方向=白低权重、动作=亮色强调，正契合 `art/ui/touch-buttons-spec.md` 变体 B 的二层配色思想。
3. **跨主题稳**：白/暖黄/暖橙在蓝（海/天）、绿（草原）、棕（山洞）底上对比都够，不出现"绿底绿钮"撞色（方向键已避用草绿）。
4. **低风险落地**：沿用现有玻璃+白边语言与按下 scale，玩家与团队零认知负担；hit-area/半径完全不动。
5. **按压清晰不突兀**：保留 `#FFD23F` 描边切换 + scale，去掉高光后反而更干净。

**备选路径**：
- 想**今日止血、零风险** → 走 **方案 D**（约 80% 收益）。
- 想**最轻最统一、且接受弱化颜色编码** → 走 **方案 B**。
- 想**彻底贴美术圣经原生、接受外观大改** → 走 **方案 C**。

---

## 8. 落盘参数表（推荐方案 A，给 engineering-lead 直接取数）

> 仅视觉常量；坐标/半径/命中区/`syncDown` 逻辑全部不动。以下对应 `src/ui/touch-buttons.ts` 现有 `COLOR_*` 与 `BUTTON_VISUAL_SPEC` 结构。

### 8.1 颜色常量替换

```ts
// ---- 颜色（全部来自 11 色锁色板；白为通用 UI 中性，不计入新增 hue）----
const COLOR_OUTLINE        = 0xffffff;   // 通用描边/图标（中性）
const COLOR_PRESSED_OUTLINE= 0xffd23f;   // 暖黄 #FFD23F（锁色板 #4）✅ 替代原 off-lock #B5763E
const COLOR_ICON           = 0xffffff;
const COLOR_PAUSE_ICON     = 0x2a1a12;   // 描边 #2A1A12（锁色板 #5），浅底深图标

// 填充（全部锁色板；方向键回归中性白，呼应变体 B「方向=白低权重」）
const COLOR_FILL_DIRECTION = 0xffffff;   // 中性白（原 #DC4438 离板 → 移除）
const COLOR_FILL_ACTION    = 0xffd23f;   // 暖黄 #FFD23F（锁色板 #4，原 #F2C83C 离板 → 修正）
const COLOR_FILL_THROW     = 0xf2933c;   // 暖橙 #F2933C（锁色板 #3，原 #AC703B 离板 → 修正）
const COLOR_FILL_PAUSE     = 0xffffff;   // 中性白（原 #3E2723 近黑 → 移除）
```

### 8.2 `BUTTON_VISUAL_SPEC` 覆盖值

```ts
export const BUTTON_VISUAL_SPEC: Record<ButtonId, ButtonVisualSpec> = {
  left: {   // 方向药丸（左）
    fillColor: COLOR_FILL_DIRECTION, fillAlphaDefault: 0.40, fillAlphaPressed: 0.55,
    lineWidthDefault: 2, lineWidthPressed: 3, lineAlphaDefault: 1.0, lineAlphaPressed: 1.0,
    pressedScale: 0.97,
  },
  right: {  // 方向药丸（右）—— 与 left 同
    fillColor: COLOR_FILL_DIRECTION, fillAlphaDefault: 0.40, fillAlphaPressed: 0.55,
    lineWidthDefault: 2, lineWidthPressed: 3, lineAlphaDefault: 1.0, lineAlphaPressed: 1.0,
    pressedScale: 0.97,
  },
  jump: {   // 跳圆钮
    fillColor: COLOR_FILL_ACTION, fillAlphaDefault: 0.55, fillAlphaPressed: 0.70,
    lineWidthDefault: 3, lineWidthPressed: 4, lineAlphaDefault: 1.0, lineAlphaPressed: 1.0,
    pressedScale: 0.92,
  },
  action: { // 扔栗圆钮
    fillColor: COLOR_FILL_THROW, fillAlphaDefault: 0.55, fillAlphaPressed: 0.70,
    lineWidthDefault: 3, lineWidthPressed: 4, lineAlphaDefault: 1.0, lineAlphaPressed: 1.0,
    pressedScale: 0.92,
  },
};
```

### 8.3 需同步改动的绘制点（视觉层，非逻辑）

1. `TouchCircle.redraw`：删除内圈高光那一段
   ```ts
   // 删除：g.lineStyle(2, 0xffffff, 0.15); g.strokeCircle(0, 0, r * 0.82);
   ```
2. `PauseIcon` 构造：填充由 `COLOR_BG_DARK, 0.6` 改为 `COLOR_FILL_PAUSE, 0.32`；双竖线填充由 `COLOR_ICON` 改为 `COLOR_PAUSE_ICON`（`0x2A1A12`）。
3. `COLOR_FILL_DIRECTION` / `COLOR_FILL_ACTION` / `COLOR_FILL_THROW` 三处常量按 §8.1 替换（移除离板值）。
4. 暂停默认 alpha 与按下 alpha 按 §8.2 未单列（PauseIcon 为独立类），建议新增 `PAUSE_ALPHA_DEFAULT = 0.32` / `PAUSE_ALPHA_PRESSED = 0.44` 常量。

> ⚠️ 以上为**实现指引**，本文档未改动代码；落盘由 engineering-lead（程基岩）执行。

---

## 9. 可访问性（对齐 art-bible §9.4 Standard 档）

- **色盲双编码**：图标形状（◀▶ 箭头 / ▲ 上三角 / 栗子 / ‖ 双竖线）已承载功能，颜色仅强化；方案 B 虽弱化颜色，形状仍保证可辨。✅
- **最小可点热区**：沿用 `inputConfig.wechat.buttons` 半径（71.68px 直径 ≫ 48px 线），本调研不动。✅
- **防光敏**：按压为 scale + 描边色变，无高频闪烁；色盲模式脉冲沿用现有白脉冲（≤1.5Hz）。✅
- **减少动态**：开启后按压降级为仅色变（保持现有行为）。✅
- **暂停浅底深图标**：`0x2A1A12` 双竖线在白色半透底上对比 ≥ 4.5:1，优于原近黑底白图标。✅

---

## 10. 待主理人拍板的决策点

1. **主推 A 是否采纳**（或改走 D 今日止血 / B 极简 / C 原生亮片）？—— 我建议 **A**。
2. **白色是否豁免 11 色锁色板**？本调研默认白为中性豁免；若要求严格仅 11 色（连白都不用），则：
   - 方向/暂停的"中性白"需改用锁色板色（如天空 `#5BC8F5` 或石灰白——但石灰白 `#F4EFE6` 也不在 11 色内），对比度会下降；
   - 最合规落地是 **方案 C**（深棕 `#2A1A12` 描边 + 亮填充，图标用白仍属中性豁免；若连白都禁，图标需换锁色板色，对比度受损）。
   - 请主理人确认"白中性豁免"是否成立，以锁定最终合规口径。
3. **方向药丸是否接受"中性白"**（而非草绿）？—— 草绿会在草原关撞色，白最稳；若坚持草绿语义，需接受草原关对比风险（不推荐）。
4. **暂停是否接受"浅底深图标"**（当前是深底白图标）？—— 浅底更轻、更贴"不深"目标，建议采纳。

---

## 附：四方案在蓝海背景下的可视化对比（SVG 草模）

> 每个面板 = 海 biome 双色域（上 `#5BC8F5` 天空 / 下 `#4A78C0` 冷蓝礁岩），绘制四钮：左下方向药丸、右下跳、右下上扔栗、右上暂停。仅示意，非像素级。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 600" width="680">
  <style> text{font-family:sans-serif;font-size:13px;font-weight:bold;} .sub{font-size:11px;font-weight:normal;} </style>

  <!-- ===== Panel A ===== -->
  <g transform="translate(10,30)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#4A78C0"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.40" stroke="#FFFFFF" stroke-width="2"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFD23F" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#F2933C" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.32" stroke="#FFFFFF" stroke-width="2"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">A · 浅色磨砂玻璃（主推）</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">方向白0.40 / 跳暖黄0.55 / 扔暖橙0.55 / 暂停浅底深标</text>
  </g>

  <!-- ===== Panel B ===== -->
  <g transform="translate(350,30)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#4A78C0"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.22" stroke="#FFFFFF" stroke-width="2"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFFFFF" fill-opacity="0.26" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#FFFFFF" fill-opacity="0.26" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.22" stroke="#FFFFFF" stroke-width="2"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">B · 中性幽灵</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">四钮全中性白（0.22–0.26），仅按下点亮#FFD23F</text>
  </g>

  <!-- ===== Panel C ===== -->
  <g transform="translate(10,310)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#4A78C0"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.85" stroke="#2A1A12" stroke-width="2"/>
    <polygon points="55,222 70,213 70,231" fill="#2A1A12"/>
    <polygon points="98,222 83,213 83,231" fill="#2A1A12"/>
    <circle cx="275" cy="212" r="26" fill="#FFD23F" fill-opacity="0.85" stroke="#2A1A12" stroke-width="2"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#F2933C" fill-opacity="0.85" stroke="#2A1A12" stroke-width="2"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.90" stroke="#2A1A12" stroke-width="2"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">C · 实色描边亮片</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">深棕#2A1A12描边 + 亮填充0.85（art-bible原生）</text>
  </g>

  <!-- ===== Panel D ===== -->
  <g transform="translate(350,310)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#4A78C0"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.58" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFD23F" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#F2933C" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.42" stroke="#FFFFFF" stroke-width="2"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">D · 保守微调（可今日上线）</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">仅换锁色板色+去高光，方向白0.58最"实"</text>
  </g>
</svg>

---

## 11. 第二轮优化：降低抢眼度（Round 2 · De-Attention）

> 触发：用户反馈方案 A（浅色磨砂玻璃）落地后"还是很抢眼"（截图场景 = 蓝海 `#5BC8F5` + 棕色礁岩）。
> 范围：同 §0 — **仅视觉层参数**；不读/不改 `src/`，不改命中区/半径/输入逻辑。
> 约束：**填充色全部落在 11 色锁色板内**（或白/深褐 UI 中性色，见 §0 合规备注）；暖黄 `#FFD23F`(锁#4) / 暖橙 `#F2933C`(锁#3) / 深褐 `#2A1A12`(锁#5, 中性) 均合规。
> 背景域：按用户截图 = 蓝海 `#5BC8F5` + 棕色礁岩（当前 build 地面偏棕 `#5C4636` 系；`sea-biome-spec.md` 目标 `#4A78C0` 更暗冷蓝，二者均"比天空更暗"，可读性结论一致）。

### 11.0 为什么方案 A 仍"抢眼"（根因复盘）

方案 A 把方向 alpha 从 0.82 降到 0.40、跳/扔 0.55、去掉内圈高光、暂停改浅底——但画面里仍有三个持续的"可见度来源"在抢眼：

1. **白描边 2–4px**：在蓝海与棕色礁岩上都是一条明亮硬边，是全屏里最"跳"的元素之一；
2. **饱和暖填充**：跳=暖黄 0.55、扔=暖橙 0.55，在蓝海上与背景是冷暖互补高对比，在棕礁上是"暖上加暖"的色块，都持续拉视线；
3. **白图标**：圆钮内白色三角/栗子在亮填充上对比有限，但作为亮色点仍被看见。

→ 结论：要进一步降抢眼，必须**同时压低填充 alpha + 削弱/去除白描边 + 弱化静止态色相**。下面三套分别从这三个旋钮下手。

### 11.1 三套方案速读

| 方案 | 定位 | 静止态核心变化 vs A | 降抢眼力度 | 可读性风险 |
|---|---|---|---|---|
| **E · 更淡玻璃** | A 的"轻量版" | alpha 0.18–0.30（≈减半）+ 白边收到 1px 细线 | 中 | 低（最接近 A，最稳） |
| **F · 中性幽灵** ★推荐 | 四钮统一中性白雾，仅图标浮于背景，按下才点亮 | 静止态去掉所有饱和色相，白边 1px@0.35（或 0）；alpha 0.14–0.22 | 强 | 中（静止态极淡，靠图标 + 按压点亮补） |
| **G · 无描边柔雾** | 彻底去掉白边，只靠填充 + 图标 | 白边 = 0；alpha 0.25–0.40；保留暖色填充 | 中–强 | 中（无描边边界，靠填充晕 + 图标） |

### 11.2 精确参数表

> 表头：按钮 / `fillColor`(静止) / `fillAlphaDefault` / `fillAlphaPressed` / `pressedFillColor`(按下点亮) / `lineWidth` / `lineColor` / `pressedLineColor` / `iconColor`。
> `lineColor` 行内括注为建议 `lineAlpha`（现有代码已支持 `lineAlphaDefault/Pressed`）。暂停图标色沿用 `#2A1A12`（浅底深图标，对比 ≥4.5:1）。

**E · 更淡玻璃（Fainter Glass）**

| 按钮 | fillColor | fillAlphaDefault | fillAlphaPressed | pressedFillColor | lineWidth | lineColor | pressedLineColor | iconColor |
|---|---|---|---|---|---|---|---|---|
| 方向药丸（左/右） | `0xFFFFFF` | 0.20 | 0.30 | 同静止 | 1 | `0xFFFFFF` | 同 `lineColor` | `0xFFFFFF` |
| 跳圆钮 | `0xFFD23F`(锁#4) | 0.30 | 0.42 | 同静止 | 1 | `0xFFFFFF` | 同 `lineColor` | `0xFFFFFF` |
| 扔栗圆钮 | `0xF2933C`(锁#3) | 0.30 | 0.42 | 同静止 | 1 | `0xFFFFFF` | 同 `lineColor` | `0xFFFFFF` |
| 暂停小圆钮 | `0xFFFFFF` | 0.18 | 0.28 | 同静止 | 1 | `0xFFFFFF` | 同 `lineColor` | `0x2A1A12` |

- 与 A 的区别：alpha 整体≈减半（方向 0.40→0.20、跳/扔 0.55→0.30、暂停 0.32→0.18），白边从 2–4px 收到 1px。暖色编码与图标全部保留，肉眼变化小、风险最低。

**F · 中性幽灵（Neutral Phantom）★推荐**

| 按钮 | fillColor | fillAlphaDefault | fillAlphaPressed | pressedFillColor(按下点亮) | lineWidth | lineColor | pressedLineColor | iconColor |
|---|---|---|---|---|---|---|---|---|
| 方向药丸（左/右） | `0xFFFFFF` | 0.14 | 0.30 | `0xFFFFFF` | 1 | `0xFFFFFF`(α0.35) | `0xFFD23F`(锁#4) | `0xFFFFFF` |
| 跳圆钮 | `0xFFFFFF` | 0.16 | 0.40 | `0xFFD23F`(锁#4) | 1 | `0xFFFFFF`(α0.35) | `0xFFD23F`(锁#4) | `0xFFFFFF` |
| 扔栗圆钮 | `0xFFFFFF` | 0.16 | 0.40 | `0xF2933C`(锁#3) | 1 | `0xFFFFFF`(α0.35) | `0xFFD23F`(锁#4) | `0xFFFFFF` |
| 暂停小圆钮 | `0xFFFFFF` | 0.14 | 0.30 | `0xFFFFFF` | 1 | `0xFFFFFF`(α0.35) | `0xFFD23F`(锁#4) | `0x2A1A12` |

- **静止态**：四钮统一中性白雾（0.14–0.16）、白边仅 1px@α0.35（近乎不可见），画面里只剩 4 个白色功能图标浮在背景上——**没有任何饱和色相持续在场**。
- **按下点亮**：fill alpha 升到 0.30–0.40，且 fill **tint 到锁色板色**（跳→暖黄 / 扔→暖橙 / 方向·暂停→白），同时 lineColor 切 `0xFFD23F`(锁#4)、lineWidth 升 2，形成唯一彩色反馈（对齐 §3 方案 B 的"点亮"思路）。这是"仅图标可见、按下才点亮"的落法。
- 若主理人想要更干净的静止态，可把 `lineWidth` 设 0（完全无描边），其余不变。

**G · 无描边柔雾（Borderless Soft Mist）**

| 按钮 | fillColor | fillAlphaDefault | fillAlphaPressed | pressedFillColor | lineWidth | lineColor | pressedLineColor | iconColor |
|---|---|---|---|---|---|---|---|---|
| 方向药丸（左/右） | `0xFFFFFF` | 0.28 | 0.40 | 同静止 | 0 | —（无描边） | — | `0xFFFFFF` |
| 跳圆钮 | `0xFFD23F`(锁#4) | 0.32 | 0.46 | 同静止 | 0 | — | — | `0xFFFFFF` |
| 扔栗圆钮 | `0xF2933C`(锁#3) | 0.32 | 0.46 | 同静止 | 0 | — | — | `0xFFFFFF` |
| 暂停小圆钮 | `0xFFFFFF` | 0.25 | 0.36 | 同静止 | 0 | — | — | `0x2A1A12` |

- 与 A 的区别：彻底删除白描边（最"跳"的元素），只靠填充晕 + 图标；alpha 取 0.25–0.40（比 E 略高以补偿无描边的边界损失）。暖色填充保留。

### 11.3 SVG 四方案对比（A 参照 + E/F/G）

> 每个面板 = 蓝海 `#5BC8F5`（上）+ 棕色礁岩 `#5C4636`（下，按用户截图）；四钮：左下方向药丸、右下跳、右下上扔栗、右上暂停。F 面板右下角小圆为"按下点亮"示意（跳钮按下态）。仅草模，非像素级。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 600" width="680">
  <style> text{font-family:sans-serif;font-size:13px;font-weight:bold;} .sub{font-size:11px;font-weight:normal;} </style>

  <!-- ===== Panel A (reference) ===== -->
  <g transform="translate(10,30)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#5C4636"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.40" stroke="#FFFFFF" stroke-width="2"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFD23F" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#F2933C" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.32" stroke="#FFFFFF" stroke-width="2"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">A · 浅色磨砂玻璃（参照·当前落地）</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">方向白0.40 / 跳暖黄0.55 / 扔暖橙0.55 / 白边2–4px</text>
  </g>

  <!-- ===== Panel E (fainter glass) ===== -->
  <g transform="translate(350,30)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#5C4636"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.20" stroke="#FFFFFF" stroke-width="1"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFD23F" fill-opacity="0.30" stroke="#FFFFFF" stroke-width="1"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#F2933C" fill-opacity="0.30" stroke="#FFFFFF" stroke-width="1"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.18" stroke="#FFFFFF" stroke-width="1"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">E · 更淡玻璃</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">alpha 0.18–0.30 + 白边1px（A 的轻量版）</text>
  </g>

  <!-- ===== Panel F (neutral phantom, recommended) ===== -->
  <g transform="translate(10,310)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#5C4636"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.14" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.35"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFFFFF" fill-opacity="0.16" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.35"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#FFFFFF" fill-opacity="0.16" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.35"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.14" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.35"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <!-- pressed light-up hint (jump) -->
    <circle cx="305" cy="150" r="13" fill="#FFD23F" fill-opacity="0.40" stroke="#FFD23F" stroke-width="2"/>
    <polygon points="305,143 299,151 311,151" fill="#FFFFFF"/>
    <text x="300" y="172" fill="#2A1A12" class="sub">按</text>
    <text x="8" y="14" fill="#2A1A12">F · 中性幽灵（推荐）</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">四钮统一白雾0.14–0.22，仅图标可见，按下点亮</text>
  </g>

  <!-- ===== Panel G (borderless soft mist) ===== -->
  <g transform="translate(350,310)">
    <rect x="0" y="0" width="320" height="250" fill="#5BC8F5"/>
    <rect x="0" y="155" width="320" height="95" fill="#5C4636"/>
    <rect x="18" y="200" width="112" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.28"/>
    <polygon points="55,222 70,213 70,231" fill="#FFFFFF"/>
    <polygon points="98,222 83,213 83,231" fill="#FFFFFF"/>
    <circle cx="275" cy="212" r="26" fill="#FFD23F" fill-opacity="0.32"/>
    <polygon points="275,197 262,214 288,214" fill="#FFFFFF"/>
    <circle cx="232" cy="160" r="20" fill="#F2933C" fill-opacity="0.32"/>
    <circle cx="232" cy="160" r="7" fill="#FFFFFF"/>
    <circle cx="296" cy="28" r="12" fill="#FFFFFF" fill-opacity="0.25"/>
    <rect x="292" y="22" width="3" height="12" fill="#2A1A12"/>
    <rect x="298" y="22" width="3" height="12" fill="#2A1A12"/>
    <text x="8" y="14" fill="#2A1A12">G · 无描边柔雾</text>
    <text x="8" y="244" fill="#2A1A12" class="sub">去白边，仅填充+图标，alpha 0.25–0.40</text>
  </g>
</svg>

### 11.4 推荐：F（中性幽灵）

**理由（为什么能解决"还是很抢眼"）**：

1. **直接消除抢眼根因**：静止态去掉所有饱和暖色相（跳/扔不再有暖黄/暖橙色块），白边从 2–4px 降到 1px@α0.35（近乎不可见）；画面里只剩 4 个白色功能图标浮在蓝海/棕礁上——三套里对"还是很抢眼"削减最彻底。
2. **功能不丢**：图标形状（◀▶/▲/🌰/⏸）自带语义，色盲双编码（art-bible §9.1）成立；按下"点亮"（fill→0.30–0.40 + tint 锁色板色 + 描边切暖黄 `#FFD23F`），反馈明确且不喧宾。
3. **跨主题稳**：静止态是中性白雾，在蓝海/棕礁/草原绿/山洞冷蓝上都低存在感，不引入新色相冲突；暖色仅在按下瞬间出现，不污染常态画面。
4. **锁色板/中性合规**：填充静止=白（中性）或按下瞬间暖黄/暖橙（锁#4/#3），描边按压切 `#FFD23F`（锁#4）；零新增 hex。
5. **更贴美术圣经**：art-bible §3「形状先说话、颜色做强化」、§9.1 色盲双编码——F 正是"形状主导、颜色退场"，比 A（暖色常态在场）更贴这条原则。

**备选路径**：
- 想**最小改动、最稳** → 走 **E（更淡玻璃）**：A 的直接轻量版，保留暖色编码，肉眼变化小、风险低，但降抢眼力度不如 F。
- 想**彻底去白边、实测"无描边是否可读"** → 走 **G（无描边柔雾）**：去掉最跳的白环，但在蓝海上暖色圆仍会有些许暖点；可读性需在棕礁+蓝海双域实测，建议灰度小批量验证。
- 仍嫌不够 → F 已是三套里最激进；若还要更淡，可把 F 静止 alpha 再降到 0.10 档（discoverability 风险上升，需配合色盲白脉冲 + 首关引导）。

### 11.5 风险与缓解（三套共享）

- **可发现性**：极低 alpha 下，玩家初见可能"找不到按钮"。缓解：① 图标形状够大够白（已在）；② 色盲辅助模式白脉冲（art-bible §9.1 / 现有实现）让按钮呼吸可见；③ 首关加一次性手指引导（虚线指向四钮）；④ 按下点亮提供强反馈闭环。
- **棕礁对比**：白雾在棕礁上是"微微提亮"，比 A 的白环+暖块柔和得多；且棕礁上白图标对比反而最好（白 on 棕）。
- **动作键暖色编码弱化**（F/G 静止态去暖色）：靠形状区分，符合 art-bible 双编码；若主理人坚持"动作键常态暖色强调"，改走 E。
- **实现**：仅改 `BUTTON_VISUAL_SPEC` 与 `COLOR_*` 常量 + `PauseIcon` 两处 alpha（同 §8.3 落盘点），不动逻辑层。

### 11.6 待主理人拍板

1. 三套选哪套？**推荐 F**。保守选 E，实验无描边选 G。
2. F 的静止 alpha 档：本稿 0.14–0.22，还是更激进 0.10 档？（影响可发现性）
3. F 是否接受"动作键静止态去暖色"（弱化颜色编码）？→ 接受则 F；不接受则 E。
4. F 的白边：1px@α0.35（本稿，留一丝边界助发现）还是完全 0？（更干净）

---

*本文件为按钮视觉样式调研（lean）。未修改任何 `src/` 代码。§0–§10 待主理人对决策点拍板；§11 第二轮三方案待主理人从 **F（中性幽灵，推荐）/ E（更淡玻璃）/ G（无描边柔雾）** 中拍板后，由 art-director 与 engineering-lead 落地。*
