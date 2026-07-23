# super-mali · 微信触屏四按钮视觉样式规格（Touch Buttons Spec）

> 文档类型：UI 资产规格 + 工程实现参数表
> 作者：art-director（林绘澄）
> 上游依据：`art/art-bible.md` v1.1（§2.6 混合渲染·§3 色板·§7 HUD·§8 动效·§9 可访问性）、`art/accessibility.md`（MVP = Standard）、`art/placeholder-spec.md`（描边/绘制约定）、`docs/architecture/control-list.md` §4（命中区 ≥48px、双端一致）、`src/config/input-config.json`（按钮位置/半径真理源）
> 范围：仅 `env === 'wechat'` 时挂载；位置/半径沿用 `inputConfig.wechat.buttons`；**不动**逻辑层输入
> 评审强度：lean

---

## 0. TL;DR（结论先行）

- **现状痛点**：4 个样式完全相同的白圆 + 深棕描边，无图标、无按压态、四钮无功能区分、玩家"看不出是啥"。
- **推荐方案**：**变体 B「像素图标圆钮 + 双层配色」**（详见 §4）。
  - 方向键（左/右）：白色低饱和 + 像素箭头图标 → "持久可见、低视觉权重"
  - 动作键（跳/动作）：暖黄高饱和 + 像素图标 → "按需强调、视觉锚点"
  - 4 钮 1:1 沿用现有 layout → 命中区/控制清单零变更
  - 按压态：scale 0.94 + 填充 alpha +0.15 + 描边 +1px（瞬时，pointer-down）
- **新增资产**：**零**。所有图标用 Phaser `Graphics` 原子 API 实时绘制（fillTriangle / fillRect / lineBetween），不引入 PNG/SVG。
- **风险**：低。仅替换 `src/ui/touch-buttons.ts` 一文件 + 扩展状态机；不触碰 `wechat-touch.ts`、`input-config.json`、`core/`。

---

## 1. 现状分析

### 1.1 当前实现回顾（`src/ui/touch-buttons.ts`）

```ts
// 当前 37 行：4 个白圆 + 深棕描边，无图标、无按压、无分组
fillStyle(0xffffff, 0.18); fillCircle(cx, cy, r);
lineStyle(2, 0x2a1a12, 0.85); strokeCircle(cx, cy, r);
```

**问题清单**：
1. **零图标**——玩家无法从视觉判别"这是左还是跳"。
2. **零按压反馈**——按下与未按下视觉一致，玩家不确定是否生效（Apple HIG 明确说"无按压态 = 死按钮"）。
3. **零功能分层**——左右（持续按压，方向控制）与跳/动作（离散触发，动作语义）使用完全相同视觉，违反行业最佳实践"方向键持久可见 + 动作键按需强调"。
4. **暖黄闲置**——`#FFD23F` 是美术圣经 §3.1 主色板主色之一，**正适合作为动作键的强调色**，当前完全没用上。
5. **action 按钮"无功能预留态"**——动作无功能时，应在视觉上明确"未来启用"，当前没体现。

### 1.2 几何与配色（不可变约束）

| 项 | 值 | 来源 |
|---|---|---|
| 逻辑分辨率 | 512 × 288 | art-bible §2.3 |
| left 位置 / 半径 | (0.08, 0.82) / r=0.07 → 中心 (41, 236) 半径 35.84px | input-config.json |
| right 位置 / 半径 | (0.22, 0.82) / r=0.07 → 中心 (113, 236) 半径 35.84px | input-config.json |
| jump 位置 / 半径 | (0.82, 0.82) / r=0.08 → 中心 (420, 236) 半径 40.96px | input-config.json |
| action 位置 / 半径 | (0.92, 0.70) / r=0.07 → 中心 (471, 202) 半径 35.84px | input-config.json |
| 最小命中直径 | 71.68px（按宽换算） | 远 ≥ 48px 验收线 |
| 画布背景 | 天蓝 `#5BC8F5`（上半）+ 棕地 `#3a2a1f` / 描边 `#2a1a12`（下半） | placeholder-spec |
| 描边统一 | `#2A1A12` 1px（placeholder-spec §0） | 占位约定 → UI 同理 |
| 像素网格 | 32px tile，UI 矢量/系统字体 | art-bible §2.6 |

### 1.3 双色域可读性

按钮跨越天蓝（y < ~0.78）与棕地（y > 0.78，描边色与按钮描边色相同 `#2a1a12`）。需保证：
- 按钮**填充**在天蓝上可见（白色 OK）；在棕地上**也可见**（白色 + 描边可；暖黄更稳）。
- 按钮**描边**在棕地上与背景近色，但**填充亮**足以分离（lum contrast ≥ 3:1）。

---

## 2. 调研摘要（5 个权威来源）

### 2.1 Apple HIG · Game Controls（[来源](https://apple-docs.everest.mt/docs/design/human-interface-guidelines/game-controls)）

> "Make sure frequently used controls are a minimum size of 44x44 pt... Always include visible and tactile press states. A virtual control feels unresponsive without a visual and physical press state. Help players understand when they successfully interact with a button by adding a visual press state effect, such as a glow, **that they can see even when their finger is covering the control**... Use symbols that communicate the actions they perform... Avoid using abstract shapes or controller-based naming like A, X, or R1 as artwork."

**关键 3 条**：
1. **图标必须直接表示动作**（不要用 A/B/X/Y 这种抽象命名）
2. **按压态必须存在且可透过手指看见**（外发光 / 加深 / 缩放）
3. **常用按钮 ≥ 44×44pt**（我们 71.68px 已远超）

### 2.2 Microsoft GDK · Touch Adaptation Kit Designers Guide（[来源](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide)）

- D-pad 4-way（仅四方向）vs 8-way（含对角）选择：马里奥式平台跳跃 = **4-way** 即可（无对角移动）
- touchpad `renderAsButton: true` 模式下，**默认图标是动作语义**，不是按键符号

### 2.3 GameJuice · Responsive UI Feedback（[来源](https://gamejuice.co.uk/patterns/responsive-ui-feedback)）

> "The press animation should trigger on pointer-down, not pointer-up. If you wait for the release to show the feedback, the interaction feels 30 milliseconds slower than it actually is. **That delay is perceptible.**"

**关键 3 条**：
1. 按压响应**必须在 pointer-down 触发**，不是 pointer-up
2. 弹性 scale 0.95 → 1.02 overshoot（按下 95%、释放过冲到 102% 再回 100%）
3. 反馈应"立即到达、然后让位"——别盖住游戏关键信息

### 2.4 Baldauf 2015 · On-Screen Gamepad Designs（[来源](https://matthiasbaldauf.com/publications/Baldauf15a.pdf)）

对照 4 种 gamepad（directional buttons / D-pad 8-way / virtual joystick / gestural tilt）在 **Pac-Man + Super Mario Bros** 的实测：
- 平台跳跃（Mario）→ **directional buttons（圆形按钮十字）** 准确率最高
- 虚拟摇杆在平台跳跃中存在"漂移"问题，玩家拇指在摇杆上需要重新定位
- **胶囊/横条形方向键** 同样有效（业界如 Celeste 移动版用此）

### 2.5 微信小游戏 · 渲染约束（[来源](https://wenku.csdn.net/doc/1h8hyyjr1c)）

> "所有 UI 绘制、事件监听、资产加载、状态管理均需通过微信提供的 wx API 和 Canvas 2D Context 接口完成。Canvas 渲染性能极易受图像尺寸、drawImage 调用频次、路径绘制复杂度影响。"

**关键 3 条**：
1. Phaser `Graphics` 大量 fillStyle 切换会堆 draw call，**应批量绘制同色组**
2. 重复绘制应缓存（GenerateTexture 一次性烤成 RT）
3. 简单几何（圆 + 三角）几乎零成本，无需引入图集

---

## 3. 三个设计变体对比

### 变体 A · 分组差异化（胶囊 + 圆）

**形态**：
- **左下**：一个**横向胶囊**（圆角矩形）含左右两个子热区（左右各半宽度）
- **右下跳**：独立圆（最大 r=0.08）
- **右下动作**：独立圆（次大 r=0.07），位于跳之上

**视觉**：方向键用白色低饱和（白 0.18）；跳用暖黄 0.30 + 暖橙描边；动作用互动青 0.30（呼应 §3.2 互动色）。

**优点**：方向键"持久可见"语义最强，物理手柄心智模型延续，3 个视觉锚点。
**缺点**：改变 layout → input-config.json 需扩展（每个方向键独立 hitZone），动作键的"圆 vs 胶囊"对比在小屏可能不够明显。
**风险**：中等。改变触屏命中布局，需工程同步更新 `wechat-touch.ts` 的 hit 循环。

### 变体 B · 4 圆像素图标（推荐）✅

**形态**：
- 4 个**独立圆**（位置/半径**完全沿用** `input-config.json`）
- 圆内增加**像素风格图标**（左箭头/右箭头/上箭头/✦放射）
- **双层配色**：方向键（左/右）白 0.18 描边 #2a1a12；动作键（跳/动作）暖黄 0.32 描边 #2a1a12
- 动作键**描边加粗 1px**（2 → 3）以强化"按需强调"

**按压态**（pointer-down 触发）：
- scale 0.94（50ms 瞬时 squash）
- 填充 alpha +0.15
- 描边粗 2 → 3（动作键 3 → 4）
- 描边色由 #2a1a12 切换为 #B5763E（栗色，呼应栗宝）

**action 无功能预留态**：alpha 整体 ×0.6，描边改为虚线（4px 实 + 2px 间隔）。

**优点**：
- layout 1:1 沿用，命中区零变更（控制清单 §4 验收零风险）
- 4 个圆钮独立可见，按"方向键 vs 动作键"靠**配色 + 描边粗细 + 图标形状**三维度区分
- 实现简单，Phaser Graphics 原子 API 即可（fillCircle + fillTriangle + fillRect + lineBetween）
- 像素风友好（图标全部由 4-12 个三角/矩形拼成，与 32px tile 网格对齐）
- 新增资产：零

**缺点**：
- 4 个圆在小屏略显"碎"（可接受，参考 Shovel Knight 移动版设计）
- 方向键与动作键的视觉层级依赖颜色 → 色盲辅助模式需增强（详见 §4.5）

**风险**：低。

### 变体 C · D-Pad 单圆 + 内部十字分割

**形态**：
- 左下**一个大圆**（D-Pad），内含十字分割线 + 4 个子扇形热区
- 跳/动作分两个独立圆

**优点**：D-Pad 是平台跳跃的经典心智模型，单一大型"方向控制器"语义强。
**缺点**：
- 实现复杂：需画 4 段扇形（fillPie 或 fillCircle 切分）+ 4 段描边
- 命中区逻辑需重写（极坐标判断：距离 + 角度）
- 视觉过重：一个大圆在左下 + 两个圆在右下 = 不平衡
- 4-way 平台跳跃无对角需求，D-Pad 的"8-way 能力"是浪费

**风险**：高（命中区逻辑重写，可能引入双端不一致）。

### 3.4 三变体总评

| 维度 | 变体 A | **变体 B（推荐）** | 变体 C |
|---|---|---|---|
| 视觉区分度 | ★★★★ | ★★★★ | ★★★★★ |
| 命中区兼容性 | ★★（需改） | ★★★★★（零改） | ★（需重写） |
| 实现复杂度 | 中 | **低** | 高 |
| 像素风契合 | ★★★ | ★★★★ | ★★★ |
| 性能 | ★★★★ | ★★★★★ | ★★ |
| Sprint 末班车风险 | 中 | **低** | 高 |

**为什么选 B 不选 A**：
- Sprint 3 末班车原则：layout 不动 = 命中区/控制清单/双端等价测试零回归
- A 的"胶囊方向键"虽然行业标准更优，但需要工程扩展 input-config 与 wechat-touch 命中循环，**为了一个 UI 改动扩散到逻辑层**得不偿失
- B 通过**配色 + 描边粗细 + 图标形状**三维度已能实现等效分层（详见 §4.5）
- A 可作为"未来可演进"提案记入 backlog

**为什么选 B 不选 C**：
- C 在 4-way 平台跳跃是"杀鸡用牛刀"
- 视觉过重、命中逻辑重写、Phaser Graphics 扇形绘制成本高
- 4-way 平台跳跃玩家的实际预期是"两个圆分别代表左/右"，不是"一个大 D-Pad 圆"

---

## 4. 推荐方案：变体 B 详细规格

### 4.1 形态总览（视觉描述）

```
┌──────────────────────────────────────────┐
│  天蓝 #5BC8F5                             │
│                                           │
│                            ○ 动作(✦)      │  ← y=0.70 互动青顶
│                                           │
│  ○左  ○右                  ○ 跳(▲)       │  ← y=0.82 暖黄顶
│ ──────────────────棕地 #3a2a1f──────────  │
│ #2a1a12 描边                              │
└──────────────────────────────────────────┘
   ↑白底0.18           ↑暖黄0.32
   描边2px #2a1a12      描边3px #2a1a12
```

### 4.2 双层配色规则

| 组 | 按钮 | 默认态 fill | 默认态描边 | 形状语言 |
|---|---|---|---|---|
| **方向键（持久）** | left / right | `#FFFFFF` alpha **0.18** | `#2A1A12` 2px alpha 0.85 | 低饱和、退到背景层 |
| **动作键（强调）** | jump | `#FFD23F` alpha **0.32** | `#2A1A12` **3px** alpha 0.95 | 暖黄高饱和、视觉锚点 |
| **动作键（强调）** | action | `#FFD23F` alpha **0.32** | `#2A1A12` **3px** alpha 0.95 | 同上（无功能预留态见 §4.6） |

**为什么暖黄 `#FFD23F` 而不是互动青 `#3FC7B4`**：
- 暖黄是美术圣经 §3.1 主色板"主色"之一，全场最高优先级
- 互动青用于"互动块"（头顶出道具的 ✦ 块），语义已被占
- 暖黄也是"增益/高光"色，能给动作键一种"重点按下"的心理暗示
- 暖黄在棕地（暖色背景）上对比度更好（亮度差 > 4:1）

### 4.3 图标方案（4 钮像素图标）

**通用规则**：
- 图标**全部用三角/矩形原子拼成**，对齐 4px 子网格（32px tile 内的 8×8 子块）
- 图标颜色 = 描边色 `#2A1A12`（统一、可读性最高）
- 跳/动作的图标色 = 同描边色 → 在暖黄填充上对比度 > 7:1（极强）
- 图标尺寸：直径的 50% 区域（r=35.84 → 图标 36px 容纳区；r=40.96 → 图标 41px 容纳区）

**左箭头 ◀**（left）：
- 主体：`fillTriangle` 3 个像素化三角形拼成左指箭头
- 中心 (cx, cy) = (41, 236)，图标范围 28×28
- 步骤：3 个三角形由左到右递减（右尖在 cx+10，左尾在 cx-10）
  - 大三角（左半）：顶点 (cx-10, cy-7), (cx-10, cy+7), (cx+4, cy)
  - 中三角：顶点 (cx-2, cy-5), (cx-2, cy+5), (cx+6, cy)
  - 顶/底两小方块（增强像素感）：(cx-12, cy-3, 4×2) + (cx-12, cy+1, 4×2)
  - **可优化**：直接用 1 个大三角 + 2 个小方块
- 像素风简化版：单 fillTriangle 大三角 + fillRect 双层

**右箭头 ▶**（right）：左箭头的水平镜像。

**上箭头 ▲**（jump）：
- 大三角向上（指向天空 = "跳"）
- 顶点 (cx, cy-10), (cx-8, cy+4), (cx+8, cy+4)
- 底部加 1px 横线 fillRect(cx-10, cy+6, 20, 2) —— 像素风"脚"

**放射 ✦**（action，预留）：
- 八角形"光芒"图标，呼应互动块 `interactive_block` 的中心 ✦ 标记（placeholder-spec §1.4）
- 步骤：fillRect 4 条短线呈 "+" 状 + fillRect 4 条斜短线呈 "×" 状
  - 水平：(cx-10, cy-1, 20, 2)
  - 垂直：(cx-1, cy-10, 2, 20)
  - 斜线（可选，像素化为小方块）：
    - 4 个 fillRect 2×2 在 (cx±5, cy±5) 周围
- 共 5-9 个原子形状，绘制成本极低

### 4.4 按压态（pointer-down 触发，pointer-up 恢复）

**核心规则**（GameJuice 共识）：
- 触发时机：**pointer-down 即时**（不是 pointer-up）
- 持续时间：< 50ms 完成 squash
- 释放时长：150-200ms，弹性 overshoot 1.0 → 1.02 → 1.0
- 同时叠加 2-3 个反馈维度（不只一个）

**变体 B 按压态配方**（每钮 3 维反馈）：

| 维度 | 方向键（left/right） | 动作键（jump/action） |
|---|---|---|
| **缩放** | scale 1.0 → 0.94 | scale 1.0 → 0.92 |
| **填充 alpha** | 0.18 → 0.33（+0.15） | 0.32 → 0.50（+0.18） |
| **描边宽度** | 2px → 3px | 3px → 4px |
| **描边色** | `#2A1A12` → `#B5763E`（栗色，呼应栗宝） | `#2A1A12` → `#B5763E` |
| **图标缩放** | 跟随按钮 0.94 | 跟随按钮 0.92 |
| **图标色** | 不变 | 不变 |

**实现方式**（Phaser）：
- 推荐方案：每个按钮用**独立 Container**（`Phaser.GameObjects.Container`），按下时 `container.setScale(0.94)`，松开回弹
- 填充/描边变化：可接受 redraw（4 钮 4 frame 重绘成本可忽略）
- **替代方案**：生成两张 GenerateTexture（default + pressed），按下切 setTexture（更高效但需要离屏渲染）

### 4.5 色盲安全 + 按压叠加（accessibility §3 / Standard 档）

**色盲模式开启时**（accessibility #2），按钮额外加：
- 描边白脉冲：`#FFFFFF` 2px 外描边 + 0.5 透明度 1.5Hz 缓慢呼吸
- 不增加新交互，仅做色盲安全冗余
- **实现**：增加一个 Container child layer，纯描边圆，定期 alpha tween

**减少动态模式开启时**（accessibility #8），按压态降级：
- 缩放取消（保持 1.0）
- 仅保留"填充 alpha +0.15 + 描边色切换"两个静态维度
- 释放时无 overshoot 弹回，直接瞬时复位

### 4.6 action 无功能预留态

- 整体 fillStyle alpha 系数 ×0.6（即从 0.32 → 0.19）
- 描边改为**虚线**（4 实 2 间隔，Phaser 用 `lineStyle` 配合 `strokePoints` 实现）
- 图标 alpha ×0.6
- 文案不做修改（玩家尚不知道 action 是什么）
- **触发**：当 `inputConfig.wechat.buttons.action.disabled === true` 或 `core` 层通过事件总线告知（具体 API 由工程决定）

### 4.7 视觉一致性自查表（对照美术圣经）

| 检查项 | 达标 | 来源 |
|---|---|---|
| 像素风（无玻璃拟态/模糊/光晕） | ✅ 仅 fillCircle + fillTriangle + lineBetween | §2.1/§2.4 |
| 主色板引用 | ✅ 暖黄 `#FFD23F`、白、栗 `#B5763E`、深棕描边 | §3.1 |
| 描边统一 | ✅ `#2A1A12` | placeholder-spec §0 |
| 1px 内描边 silhouette | ✅ 按钮 2-3px 描边（比游戏世界略粗，因 UI） | §2.4 |
| HUD 圆角底板风格延续 | ✅ 圆 + 描边 + 暖黄高亮 | §7.1 |
| 色盲双编码 | ✅ 图标形状 + 颜色双通道 | §9.1 |
| 最小可点热区 ≥48px | ✅ 71.68px | §9.2 |
| 防光敏（<3Hz） | ✅ 无高频闪烁；色盲模式脉冲 1.5Hz（< 3Hz 安全） | §9.3 |
| 文字尺寸 | N/A（本规格无文字） | §9.2 |
| 减少动态开关可降级 | ✅ §4.5 已规定 | accessibility #8 |

---

## 5. 精确工程实现参数表（给 engineering-lead）

### 5.1 按钮基础数据（从 `input-config.json` 读取，不变）

| id | nx | ny | nr | 中心 (cx, cy) 逻辑px | 半径 r 逻辑px | 直径 逻辑px | 直径 等效设备px (×3) |
|---|---|---|---|---|---|---|---|
| left | 0.08 | 0.82 | 0.07 | (41, 236.16) | 35.84 | 71.68 | ~215 |
| right | 0.22 | 0.82 | 0.07 | (112.64, 236.16) | 35.84 | 71.68 | ~215 |
| jump | 0.82 | 0.82 | 0.08 | (419.84, 236.16) | 40.96 | 81.92 | ~246 |
| action | 0.92 | 0.70 | 0.07 | (471.04, 201.6) | 35.84 | 71.68 | ~215 |

> 半径按 `LOGICAL_WIDTH=512` 换算（与 `wechat-touch.ts` 公式一致），直径 71.68px >> 48px 验收线。

### 5.2 按钮类型与图标

| id | type | 图标 | 图标绘制（Phaser Graphics API） |
|---|---|---|---|
| left | direction | ◀ 左箭头 | `fillTriangle(cx-10, cy, cx+6, cy-8, cx+6, cy+8)` + `fillRect(cx-12, cy-3, 4, 2)` + `fillRect(cx-12, cy+1, 4, 2)` |
| right | direction | ▶ 右箭头 | left 的水平镜像（cx 取反） |
| jump | action | ▲ 上箭头（"跳") | `fillTriangle(cx, cy-10, cx-8, cy+4, cx+8, cy+4)` + `fillRect(cx-10, cy+6, 20, 2)`（底部脚线） |
| action | action | ✦ 八角形（"动作"预留） | 4 条 fillRect 短线呈 "+"：水平 (cx-10, cy-1, 20, 2) + 垂直 (cx-1, cy-10, 2, 20) + 4 个 2×2 fillRect 斜位填充 |

### 5.3 默认态 / 按下态参数表

> 所有 fill/line 调用前必须 `g.clear()` 或按钮用独立 Container；推荐每钮一个 Container。

| id | 默认 fillStyle | 默认 lineStyle | 按下 fillStyle | 按下 lineStyle | 按下 scale | 描边色（按下切换） |
|---|---|---|---|---|---|---|
| left | `0xFFFFFF, 0.18` | `2, 0x2A1A12, 0.85` | `0xFFFFFF, 0.33` | `3, 0xB5763E, 0.95` | `0.94` | 栗色 `#B5763E` |
| right | `0xFFFFFF, 0.18` | `2, 0x2A1A12, 0.85` | `0xFFFFFF, 0.33` | `3, 0xB5763E, 0.95` | `0.94` | 栗色 `#B5763E` |
| jump | `0xFFD23F, 0.32` | `3, 0x2A1A12, 0.95` | `0xFFD23F, 0.50` | `4, 0xB5763E, 1.0` | `0.92` | 栗色 `#B5763E` |
| action | `0xFFD23F, 0.32` | `3, 0x2A1A12, 0.95` | `0xFFD23F, 0.50` | `4, 0xB5763E, 1.0` | `0.92` | 栗色 `#B5763E` |

### 5.4 完整绘制顺序（每帧 update 时 redraw 推荐顺序，批量 fillStyle 优化）

```ts
// 伪代码：1 个 Graphics 对象覆盖 4 个按钮（最简方案，draw call 友好）
// 进阶：4 个独立 Container（按下独立 scale/alpha，结构更清晰）

// === 1. 批量填方向键底（共享 fillStyle）===
g.fillStyle(0xFFFFFF, isDown('left') ? 0.33 : 0.18);
g.fillCircle(left.cx, left.cy, left.r);
g.fillStyle(0xFFFFFF, isDown('right') ? 0.33 : 0.18);
g.fillCircle(right.cx, right.cy, right.r);

// === 2. 批量填动作键底（共享 fillStyle）===
g.fillStyle(0xFFD23F, isDown('jump') ? 0.50 : 0.32);
g.fillCircle(jump.cx, jump.cy, jump.r);
g.fillStyle(0xFFD23F, isDown('action') ? 0.50 : 0.32);
g.fillCircle(action.cx, action.cy, action.r);

// === 3. 批量描边（共享 lineStyle）===
g.lineStyle(2, 0x2A1A12, 0.85);
g.strokeCircle(left.cx, left.cy, left.r);
g.strokeCircle(right.cx, right.cy, right.r);
g.lineStyle(3, 0x2A1A12, 0.95);
g.strokeCircle(jump.cx, jump.cy, jump.r);
g.strokeCircle(action.cx, action.cy, action.r);

// === 4. 描图标（描边色 fill）===
g.fillStyle(0x2A1A12, 1.0);  // 统一图标色 = 描边色
// left ◀
g.fillTriangle(left.cx - 10, left.cy, left.cx + 6, left.cy - 8, left.cx + 6, left.cy + 8);
g.fillRect(left.cx - 12, left.cy - 3, 4, 2);
g.fillRect(left.cx - 12, left.cy + 1, 4, 2);
// right ▶（镜像）
g.fillTriangle(right.cx + 10, right.cy, right.cx - 6, right.cy - 8, right.cx - 6, right.cy + 8);
g.fillRect(right.cx + 8, right.cy - 3, 4, 2);
g.fillRect(right.cx + 8, right.cy + 1, 4, 2);
// jump ▲
g.fillTriangle(jump.cx, jump.cy - 10, jump.cx - 8, jump.cy + 4, jump.cx + 8, jump.cy + 4);
g.fillRect(jump.cx - 10, jump.cy + 6, 20, 2);
// action ✦
g.fillRect(action.cx - 10, action.cy - 1, 20, 2);
g.fillRect(action.cx - 1, action.cy - 10, 2, 20);
g.fillRect(action.cx - 6, action.cy - 6, 4, 4);
g.fillRect(action.cx + 2, action.cy - 6, 4, 4);
g.fillRect(action.cx - 6, action.cy + 2, 4, 4);
g.fillRect(action.cx + 2, action.cy + 2, 4, 4);
```

**注意**：上面是"静态"绘制——按压态的"scale 0.94"和"描边色切换到栗色"需要重建图形（清除重画）。两种实现策略：

**策略 1（推荐，结构清晰）**：每个按钮一个 `Phaser.GameObjects.Container`，子节点包含 `Graphics`（圆 + 描边 + 图标）。按下时：
```ts
container.setScale(isDown ? 0.94 : 1.0);  // 50ms 弹性 tween
// 同时重绘子 graphics 用栗色描边
```

**策略 2（性能最优，但 cache 复杂度）**：每按钮预生成 2 个 GenerateTexture（default / pressed），按下切 setTexture。优点：1 个 draw call，零运行时计算。缺点：需离屏 render texture、占内存。

**Sprint 3 末班车建议**：策略 1。Phaser `Container.setScale` + 50ms 弹性 tween（参考 gamejuice 公式 `cubic-bezier(0.34, 1.56, 0.64, 1)` 的近似 `Phaser.Math.Easing.Back.Out`）。

### 5.5 状态机与触发

```ts
// 与 wechat-touch.ts 对接：WechatTouchProvider 的 sample() 返回的 down Set
// 4 个按钮 id: 'touch:left' | 'touch:right' | 'touch:jump' | 'touch:action'
// TouchButtons 在每帧 update 中读这些 down 状态

class TouchButtons {
  private down = new Set<string>();
  // 由外部（scene.update 或 input layer）调用
  syncDown(downSet: Set<SignalId>): void {
    // 检测 downSet 变化，对新按下的按钮启动 tween
    for (const id of downSet) {
      if (!this.down.has(id)) {
        this.buttons[id].container.setScale(0.94);  // 立即（squash）
        this.redraw(id, pressed=true);
      }
    }
    for (const id of this.down) {
      if (!downSet.has(id)) {
        // 释放：弹性回 1.0
        this.scene.tweens.add({
          targets: this.buttons[id].container,
          scale: 1.0,
          duration: 200,
          ease: 'Back.Out',  // 1.0 → 1.02 → 1.0 overshoot
        });
        this.redraw(id, pressed=false);
      }
    }
    this.down = new Set(downSet);
  }
}
```

### 5.6 性能预算（对齐控制清单 §2 + Phaser Graphics 经验值）

| 指标 | 目标 | 备注 |
|---|---|---|
| 按钮 Graphics 节点数 | 4（容器）+ 4（graphics 子节点）= 8 | 不堆叠 |
| 每帧重绘次数 | 仅状态变化时 ≤4 次 | 静止时 0 重绘 |
| 单次重绘 API 调用数 | ~6 fillStyle + ~6 lineStyle + ~14 fillTriangle/fillRect | 总量 ~30 draw call/重绘 |
| 60FPS 下 draw call 预算 | 微信小游戏 WebGL 模式 100-200 | 30 << 200，充裕 |
| 内存 | 0 PNG 资产 = 0 字节 | GenerateTexture 仅在策略 2 启用 |

---

## 6. 验证与回归清单

### 6.1 控制清单 §4 验收（不破坏既有契约）

- [ ] §4 命中区 ≥48px：`r=0.07 × 512 = 35.84px`，**直径 71.68px >> 48** ✅
- [ ] §4 双端一致：Web 端键盘输入不依赖此 UI（`wechat-touch.ts` 唯一触屏 provider）
- [ ] §4 平台切换不丢输入：按钮 Graphics 仅是视觉，与 `WechatTouchProvider.down` Set 解耦
- [ ] §4 jumpPressedAt 精度：N/A（本规格不动逻辑层）

### 6.2 美术圣经 §9 验收（accessibility Standard 档）

- [ ] §9.1 色盲双编码：图标形状 + 颜色（即使颜色盲，箭头/三角/放射形状仍可辨）✅
- [ ] §9.2 最小可点热区 ≥48px：71.68px ✅
- [ ] §9.3 防光敏：色盲模式脉冲 1.5Hz < 3Hz 安全线 ✅
- [ ] §9.4 分级 = Standard：色盲辅助模式叠加白脉冲（详见 §4.5）✅

### 6.3 IP 合规（控制清单 §3）

- [ ] 按钮无任何任天堂符号（旗杆/水管/蘑菇/星星/字母 A/B）✅（像素箭头/三角/放射为通用）
- [ ] 颜色板全在美术圣经 §3.1/§3.2 内（白、暖黄、栗、棕、互动青）✅

### 6.4 视觉回归自测（Phase 4 实现后）

- [ ] 静止态截图：4 钮在 6 寸手机 1080p 上清晰可辨，方向键退到背景层、动作键为视觉锚点
- [ ] 按压态截图：scale 0.94 + 描边变栗色 + alpha +0.15 全部生效
- [ ] 双色域测试：在天蓝上半屏（y < 0.78）与棕地下半屏（y > 0.78）上，4 钮**填充 vs 背景**亮度对比 ≥ 3:1
- [ ] 色盲辅助模式：开启后，4 钮加白色外脉冲，不喧宾夺主
- [ ] 减少动态模式：开启后，按压态无缩放、仅静态色变
- [ ] action 预留态（如启用 disabled）：视觉降级为虚线 + alpha 0.6

---

## 7. 未来可演进（不进 Sprint 3，登记 backlog）

| 演进项 | 描述 | 何时做 |
|---|---|---|
| 变体 A 迁移 | 方向键合胶囊、动作键分圆，input-config 扩展 | Phase 5 玩家反馈"4 圆太碎"时 |
| 自定义热区 | Comprehensive 档（accessibility #12）支持玩家调热区大小 | Comprehensive 冲刺 |
| 振动反馈 | 微信小游戏 `wx.vibrateShort` 短振（与按压视觉同步） | Phase 5 触感增强 |
| 音效反馈 | 按下时播放 `sfx_btn_press`（极轻 30ms blip） | Phase 5 听觉增强 |
| 漂移动画 | jump 按钮在 idle 时 0.8Hz 轻微"呼吸"alpha 0.32 ↔ 0.40，强化动作键视觉锚点 | Phase 5 polish |

---

## 8. 引用与下游

- **engineering-lead**（程基岩）：按 §5.1–5.5 直接落地 `src/ui/touch-buttons.ts` 重写 + 新增 Container 包装 + tween。**不修改** `wechat-touch.ts` / `input-config.json` / `core/`。
- **design-strategist**（文策渊）：在 UX 规格中标注触屏按钮达到 accessibility Standard 档。
- **art-bible §7.1** 引用：本规格是 §7.1 HUD/UI 风格在"触屏控制器"子领域的具体化。
- **placeholder-spec** 不变：本规格属于"运行时系统字体/矢量 UI"层（art-bible §2.6），不入像素图集。

> 本文件 Phase 1 v1（lean）。后续若玩家反馈强烈（4 圆太碎、动作键不够醒目）可升级到变体 A；若做 Comprehensive 档冲刺可加 §7 的"漂移动画 + 振动 + 音效"三件套。
