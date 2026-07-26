# 虚拟控制输入方案 · Virtual Controls Spec

> 文档类型：UX 规格 / 工程实现合同（给 engineering-lead 取数）
> 作者：文策渊（design-strategist）
> 上游依据：`src/core/input/input-abstraction.ts`、`src/core/input/raw-input.ts`、`src/platform/gesture-provider.ts`、`src/ui/touch-buttons.ts`、`src/config/input-config.json`、`design/gdd/01-input-abstraction.md`、`design/ux/ux-spec.md` §3–§4、`art/art-bible.md` §3/§4/§7/§9、`design/gdd/throw-chestnut-gdd.md`（扔栗子 GDD）
> 范围：微信端屏幕虚拟按钮输入方案——布局、与键盘/手势如何共存、触摸响应、视觉反馈、自适应尺寸、IP 安全图标。
> 评审强度：lean
> 关联任务：Phase 5 制作期用户需求（加虚拟按钮 + 扔栗子 + 多连跳 + 弹药补给 + 样式升级）

---

## 0. 一句话结论（给主理人拍板）

**推荐方案 = 选项 A**：新增 `layout:"buttons"` 作为微信端**默认**布局（左下 ◀▶、右下 ▲跳 + 🌰扔），并把**暂停**独立成右上角小图标按钮；**手势控制保留为设置项可选**（`layout:"gesture"`），手势模式下常驻叠加「扔按钮 + 暂停图标」，并用**排除区**避免手势误判。扔栗子作为**第 5 个抽象信号 `throw`** 接入 `InputAbstraction`（不破坏 core 零平台铁律）。

样式升级点（比参考图好看）：沿用美术圣经 §3 暖色调色板 + 双编码图标 + 已有 TouchButtons 的 juicy 按压反馈（squash + 弹性回弹 + 栗色描边），并补「栗子」专用图标与暂停图标，全部 Graphics 实时绘制、零新增位图资产、IP 安全（无任天堂符号）。

---

## 1. 概述与设计支柱对齐

### 1.1 背景
Phase 5 现状：微信端默认布局为**手势控制**（`wechat.layout:"gesture"`，点击/滑动驱动 `touch:left/right/jump/action`，双指暂停）；虚拟四按钮仅作为非手势提供方时的回退，且 `touch:action` 在 `game-scene` 里被映射为**暂停**（见 `game-scene.ts:545` 的 `input.actionPressed → ON_PAUSE`）。

用户基于参考截图提出：
1. 加屏幕虚拟按钮：左/右在左下、跳在右下（类参考图布局）；
2. 跳跃支持"多连跳"（见扔栗子 GDD 决策）；
3. 参考图"扔瓶子"→ 改为"扔栗子"（远程攻击，见扔栗子 GDD）；
4. 增加栗子数补给（弹药/收集物）；
5. 样式比参考图好看。

本规格只解决 **(1)(5) 及 (2)(3)(4) 的输入层落地**；机制本身在 `design/gdd/throw-chestnut-gdd.md`。

### 1.2 设计支柱对齐
- **P1 · 跳（手感第一）**：按钮布局不得引入输入延迟/歧义；按压反馈即时（≤30ms 可见反馈，对齐 TouchButtons §5.5）。
- **P2 · 闯**：按钮不遮挡关卡可读区（中上/HUD 区、路径区保持无按钮）。
- **可读性优先（hud-spec §1）**：每个按钮形状自解释（◀▶/▲/🌰/⏸），不靠颜色单一区分。
- **可访问性 Standard 档**（art §9）：热区 ≥48×48 逻辑 px、屏宽 10% 安全边距、色盲双编码、减少动态开关兼容。

### 1.3 核心铁律（贯穿全文，不可破）
> **core 层零平台 API 铁律**：所有平台相关输入包装放在 `src/platform` 或 `src/game`，core 只接收抽象信号（`left/right/jump/action/throw`）。`InputAbstraction`、`InputState`、`CharacterController` 不读任何键盘/触屏 API；新信号 `throw` 的接入方式与现有 4 个信号**完全相同**（见 §3.2）。

---

## 2. 关键决策：手势 vs 按钮（3 个选项）

用户问题：*现有手势控制是否保留为可选？还是按钮替代手势？*

### 选项 A — 按钮为默认，手势为可选（**推荐**）
- 新增 `wechat.layout:"buttons"` 为默认；`wechat.layout:"gesture"` 保留为设置项。
- 按钮布局（左下 ◀▶、右下 ▲跳 + 🌰扔）+ 右上 ⏸暂停图标。
- 手势模式下：常驻叠加「🌰扔按钮 + ⏸暂停图标」，移动/跳仍由手势驱动；用**排除区**避免手势把按按钮的手指误判成走/跳。
- **对现有代码影响**：
  - core：`InputAbstraction`/`InputState` 加 `throw`（扩展，非破坏）。
  - `input-config.json`：加 `web.throw`、按钮加 `throw`、新增 `pause` 图标项。
  - `touch-buttons.ts`：加 `throw` 按钮 + `pause` 图标，`BUTTON_ORDER` 扩为 5。
  - `gesture-provider.ts`：加**排除区** `exclusionRects`（来自 UI 层注入的按钮热区）。
  - `game-scene.ts`：消费 `input.throwPressed → 扔栗子`；`input.actionPressed → ON_PAUSE`（保留双指暂停）；暂停图标单独走 UI 回调。
  - 测试：现有「双指暂停」「手势走/跳」单测仍通过；新增「按钮扔栗子」「排除区」单测。
- **对手感影响**：最稳。默认走按钮（触点明确、零学习成本），手势作为偏好保留；扔栗子必须有按钮（手势无法表达"扔"），故手势模式叠加扔按钮是合理的。

### 选项 B — 最小改造：复用 `action` 通道，不新增 `throw` 信号
- 不扩 `InputState`；把现有 `touch:action` 的语义从「暂停」改为「扔栗子」。
- 暂停改为：右上 ⏸图标按钮（直接 `ON_PAUSE`）+ 保留手势双指 pause（手势 provider 仍发 `touch:action` 作暂停，与按钮语义冲突 → 需手势双指改发独立 `touch:pause` 信号）。
- **对现有代码影响**：core 改动更小（不扩 InputState），但 `touch:action` 语义被复用/重载，文档与既有「action=暂停/道具」约定（00-index §1.2）产生**语义漂移**；手势 provider 需改双指信号。
- **对手感影响**：与 A 相近，但语义更乱、未来再加「道具键」会再次撞车。**不推荐**，除非主理人要求 core 零改动优先。

### 选项 C — 按钮替代手势（删除手势）
- 移除手势 provider 使用，键盘 + 按钮为唯一输入。
- **对现有代码影响**：删 `gesture-provider` 接线、删 `isGestureInput` 分支；最简单。
- **对手感影响**：**丢失已交付的 Phase 5 手势特性与单指可达性**（手势对大屏/单手友好）；参考图是按钮布局，但本项目已投入手势开发，回退浪费。**不推荐**。

> **决策建议**：选 **A**。它满足"加虚拟按钮"且保留手势投资，并把"扔"干净地提升为第 5 抽象信号，对未来扩展（道具键、技能键）零债。

---

## 3. 布局与信号映射

### 3.1 按钮几何（归一化 0~1 × 逻辑 512×288；r 按宽换算，与现有 wechat-touch 命中公式一致）

| 按钮 | 抽象信号 | 归一化位置 (x,y) | r(归一化) | 逻辑坐标近似 | 类型 |
|---|---|---|---|---|---|
| 左 ◀ | `INPUT_LEFT` | (0.07, 0.80) | 0.075 | (36, 230) | direction |
| 右 ▶ | `INPUT_RIGHT` | (0.19, 0.80) | 0.075 | (97, 230) | direction |
| 跳 ▲ | `INPUT_JUMP` | (0.80, 0.82) | 0.085 | (410, 236) | action |
| 扔 🌰 | `INPUT_THROW` | (0.93, 0.78) | 0.075 | (476, 225) | action |
| 暂停 ⏸ | UI 直接 `ON_PAUSE` | (0.965, 0.05) | 0.045 | (494, 14) | ui |

> 说明：扔按钮紧贴跳按钮右上，右手拇指可同区覆盖（跳+扔）；左/右组与跳/扔组间距 > 1/3 屏宽，防误触跨区。暂停图标在右上角 HUD 安全区外、不挤占心形/分数/计时行（见 §6 弹药 HUD 说明）。

### 3.2 信号到 core 的接入（零平台铁律落地）

`INPUT_THROW` 与既有 4 信号走**完全相同**管道：
- `src/core/input/raw-input.ts`：`SignalId` 已是 `string`，无需改类型。
- `src/core/input/input-abstraction.ts`：
  - `InputMapping` 加 `throw: string[]`。
  - `InputState` 加 `throwPressed / throwHeld / throwReleased: boolean`（扔为瞬时动作，**不需要** `throwPressedAt` 缓冲，区别于 jump）。
  - `sample()` 增 `throw` 三态（复用 `pressed/held/released` 集合）。
- `src/core/config/index.ts`：
  - `webInputConfig.throw = ['KeyJ']`（并把 `action` 在 Web 端收窄为 `['ShiftLeft']`，Pause 走 Esc 全局）。
  - `wechatInputConfig.throw = ['touch:throw']`。
- `src/config/input-config.json`：加 `web.throw: ["KeyJ"]`；`wechat.buttons` 加 `throw` 项（见 §3.1）；新增 `wechat.pauseIcon` 项（UI 用，非抽象信号）。

> core 层不出现任何 `touch:`/`KeyJ` 字面量以外的平台分支；按键到信号的映射全部在 config，符合铁律。

### 3.3 与键盘共存
- Web 端**不渲染按钮**（ADR-003 §3），保留键盘：`←/A` 左、`→/D` 右、`Space/W/↑` 跳、`J` 扔、`Esc` 暂停。
- Web 端 `webInputConfig` 已含 `touch:left` 等（双端归一），但 Web 不触发 touch，无副作用。

### 3.4 与手势共存（选项 A 下的细节）
- `wechat.layout:"gesture"` 时：`GestureProvider` 仍产出 `touch:left/right/jump/action`（双指 pause 仍发 `touch:action` → `ON_PAUSE`）。
- **排除区（关键）**：UI 层（TouchButtons）把「扔按钮 + 暂停图标」的热区矩形注入 `GestureProvider.setExclusion(rects)`；`pointerDown` 若落在排除区内则**不 beginIntent**（交按钮处理），避免把手指误判成走/跳。
- 手势模式下的「扔」：玩家用右手拇指点 🌰扔按钮（在排除区内，纯按钮逻辑）；移动/跳用左手/手势。

---

## 4. 触摸响应

### 4.1 边沿检测与反馈（沿用 TouchButtons §5.5）
- 每固定步 `game-scene` 调 `touchButtons.syncDown(frame.down)`，按钮自检 pressed/released 边沿触发 tween。
- 按下即时 squash（`setScale(pressedScale)`），释放 `Back.Out` 200ms 弹性回 1.0。
- 扔按钮建议：按一次扔一次（**点按即扔**，不需要 hold）；`throwPressed` 边沿即触发一次投掷（冷却见扔栗子 GDD §3）。

### 4.2 死区与防误触
- 按钮间最小间隙 ≥ 24 逻辑 px（沿用 ux-spec §4.3）。
- 非交互区（屏幕中上/HUD 行、关卡路径区）不响应触摸。
- 排除区机制（§3.4）避免手势与按钮冲突。
- 多指：扔按钮支持独立手指（与移动手指并存），不互相吞信号。

### 4.3 输入不丢（暂停/失焦）
- `RawInputProvider.reset()` 在失焦/暂停时清空按住（现有逻辑保留）；按钮 `syncDown` 下一帧自动回弹。
- 暂停期间 `game-scene` 早退仿真但保留输入采样（现有逻辑），恢复后手指原样保留（连续性）。

### 4.4 自适应尺寸
- **基准**：逻辑分辨率 512×288，`Scale.FIT` 整数缩放；按钮归一化坐标 × 当前逻辑分辨率渲染（天然适配不同屏）。
- **安全区（刘海/圆角）**：右上暂停图标与底部按钮内缩到屏宽 10% 边距（≈51px 逻辑宽边距），避让挖孔/圆角。
- **左右手预设**（沿用 ux-spec §4.4）：
  - 左手默认：左下 ◀▶、右下 ▲跳+🌰扔（如上）。
  - 右手：X 镜像（左/右与跳/扔对调），仅镜像坐标、不改事件语义。
  - 预设在"设置/控制"页切换（Could，本期可先给默认左手）。

### 4.5 减少动态（Reduce Motion）兼容
- 按压 tween 在 Reduce Motion 开启时改为**瞬时态切换**（无弹性过冲），避免多余动效（对齐 art §9.3）。

---

## 5. 视觉反馈与样式升级（比参考图好看）

### 5.1 设计语言（对齐美术圣经）
- **双层配色**（沿用现有 TouchButtons）：方向键白 0.18 描边 2px；动作键（跳/扔）暖黄 `#FFD23F` 0.32 描边 3px；按下态描边转栗色 `#B5763E` + 加粗 + 填充 alpha +0.15（沿用 `BUTTON_VISUAL_SPEC`）。
- **矢量 Graphics 实时绘制**（零新增位图，规避微信包体，ADR-004）。
- **圆角 + 统一描边 `#2A1A12`**（对齐 art §2.6 混合方案边界弥合）。

### 5.2 图标规范（IP 安全 · 双编码）
全部用 `fillTriangle/fillRect/fillCircle` 实时绘制，形状自解释、不靠颜色：

| 按钮 | 图标 | 绘制要点（逻辑坐标，原点为按钮中心） | IP 安全检查 |
|---|---|---|---|
| 左 ◀ | 大左三角 + 尾翼 | `fillTriangle(-10,0, 6,-8, 6,8)` + 两尾翼小方块（沿用现有） | ✅ 无任天堂符号 |
| 右 ▶ | 左的水平镜像 | 同上镜像 | ✅ |
| 跳 ▲ | 上三角 + 底部"脚"横线 | `fillTriangle(0,-10, -8,4, 8,4)` + `fillRect(-10,6,20,2)`（沿用现有） | ✅ |
| 扔 🌰 | **栗子** | 栗色 `#B5763E` 圆角块（主体）+ 暖黄 `#FFD23F` 高光点（呼应栗宝 §4.2）+ 顶部 1 枚嫩绿小芽 `#7CC242`（呼应主角芽，区别于硬币圆形金） | ✅ 原创"栗子精"家族语言，无蘑菇/星星 |
| 暂停 ⏸ | 双竖条 | 两枚 `fillRect(-4,-8,3,16)` / `fillRect(2,-8,3,16)`，描边 `#2A1A12` | ✅ 通用暂停符 |

> **栗子图标 vs 硬币**：硬币=金圆+星点（art §6.1）；栗子=栗色圆角块+暖黄高光+绿芽，**形状/色双区分**，6px 小屏不混。弹药 HUD 复用同一栗子图标（见扔栗子 GDD §6）。

### 5.3 比参考图好在哪（给主理人陈述）
1. **统一 IP 语言**：按钮配色/描边/圆角与栗宝、HUD 同源（美术圣经 §2.6/§3），参考图通常是孤立的通用按钮。
2. **双编码可读性**：每个按钮形状自解释（◀▶/▲/🌰/⏸），色盲安全（art §9.1）；参考图多靠纯色块。
3. **Juicy 反馈**：squash + 弹性回弹 + 栗色描边态（已有 TouchButtons 实现），参考图多为静态。
4. **空间布局**：左/右、跳/扔分组分置两下角、间距 >1/3 屏宽、避让 HUD 与路径区（ux-spec §4.3），比参考图更防误触。
5. **可访问性达标**：热区 ≥48×48、安全边距、Reduce Motion 兼容（Standard 档），参考图常缺失。

---

## 6. 与现有 HUD 的共存（弹药 HUD 位置约定）

> 详细弹药 HUD 在扔栗子 GDD §6。此处只定**位置不冲突**原则。

- 现有 HUD 行（hud-spec §2）：左上心形+形态、中上金币+分数、右上计时、顶部进度条。
- **弹药指示器放屏幕底部中央**（约 (256, 278)，栗子图标 + `×N`），**不在顶部 HUD 行**，避免与心形/金币/分数/计时挤占。
- 底部中央在按钮布局下为空白区（左/右在左下、跳/扔在右下），无遮挡。
- Could：在扔按钮上方叠加小计数徽标（就近显示），但主指示器仍在底部中央，双处一致来源。

---

## 7. 接口契约（给工程）

```ts
// core/input/input-abstraction.ts 扩展（向后兼容）
interface InputMapping { left:string[]; right:string[]; jump:string[]; action:string[]; throw:string[]; }
interface InputState {
  left:boolean; right:boolean;
  jumpPressed:boolean; jumpHeld:boolean; jumpReleased:boolean; jumpPressedAt:number;
  actionPressed:boolean; actionHeld:boolean; actionReleased:boolean;
  throwPressed:boolean; throwHeld:boolean; throwReleased:boolean; // 新增
}

// ui/touch-buttons.ts 扩展
type ButtonId = 'left'|'right'|'jump'|'throw'|'pause'; // pause 仅供 UI 回调，不进 InputState
BUTTON_ORDER 增加 'throw'（pause 单独渲染，不入边沿同步集）

// platform/gesture-provider.ts 扩展
GestureProvider.setExclusion(rects: {x:number;y:number;w:number;h:number}[]): void
// pointerDown 落在排除区 → 不 beginIntent
```

暂停图标交互（UI 层，不进抽象信号）：
```ts
// TouchButtons 构造时接收 onPause 回调；pause 图标 pointerdown → onPause() → scene.emit(ON_PAUSE)
new TouchButtons(scene, { onPause: () => this.bus.emit(ON_PAUSE, { source: 'ui-pause' }) });
```

---

## 8. 数据格式

`src/config/input-config.json` 提议改写（仅 wechat 段 + 加 web.throw）：
```json
{
  "web": {
    "left":  ["ArrowLeft","KeyA","touch:left"],
    "right": ["ArrowRight","KeyD","touch:right"],
    "jump":  ["Space","ArrowUp","KeyW","touch:jump"],
    "action":["ShiftLeft","touch:action"],
    "throw": ["KeyJ","touch:throw"]
  },
  "wechat": {
    "layout": "buttons",
    "buttons": {
      "left":   { "x": 0.07, "y": 0.80, "r": 0.075 },
      "right":  { "x": 0.19, "y": 0.80, "r": 0.075 },
      "jump":   { "x": 0.80, "y": 0.82, "r": 0.085 },
      "throw":  { "x": 0.93, "y": 0.78, "r": 0.075 }
    },
    "pauseIcon": { "x": 0.965, "y": 0.05, "r": 0.045 },
    "gesture": { "...": "保留现有手势参数（作为 layout:\"gesture\" 可选）" }
  }
}
```
> `wechat.layout` 取值：`"buttons"`（默认）| `"gesture"`（设置项可选）。`game-scene` 据 `layout` 决定 `isGestureInput` 判定（手势 provider 仅当 `layout==="gesture"` 注入）。

---

## 9. 验收标准
- [ ] 微信默认 `layout:"buttons"`：左/右在左下、跳在右下、扔在跳右上、暂停在右上，热区 ≥48×48 逻辑 px。
- [ ] 按 🌰扔按钮 → 产生 `INPUT_THROW` → `InputState.throwPressed` → 扔栗子 GDD 的投掷触发；与键盘 `KeyJ` 产生**完全相同**的投掷行为。
- [ ] core 层（`InputAbstraction`/`InputState`/`CharacterController`）**零** `touch:`/`KeyJ` 平台分支（铁律达标）。
- [ ] 手势模式（`layout:"gesture"`）下：移动/跳仍由手势驱动；按扔/暂停按钮**不**触发走/跳误判（排除区生效）。
- [ ] 双指暂停在手势模式仍可用；按钮模式暂停走右上图标。
- [ ] 图标全部 Graphics 实时绘制、IP 安全（无任天堂符号），色盲双编码。
- [ ] Reduce Motion 开启时按压反馈无弹性过冲。
- [ ] 左右手预设镜像正确、事件语义不变。
- [ ] 弹药 HUD 在底部中央，不与顶部心形/金币/分数/计时行冲突。

---

## 10. 风险与缓解
| # | 风险 | 缓解 |
|---|---|---|
| R1 | 手势+按钮双模式维护成本 | 选项 A 用排除区解耦；按钮逻辑与手势逻辑正交，单测各自覆盖。 |
| R2 | `throw` 信号扩张导致 core 改动面 | 严格按 §3.2 只扩 `InputMapping`/`InputState`/`sample`，不动 `CharacterController` 逻辑分支；现有单测仍过。 |
| R3 | 暂停语义漂移（原 action=暂停） | 暂停独立成 UI 图标回调 + 手势双指保留 `touch:action→ON_PAUSE`；按钮模式不再有 touch:action 按钮，语义清晰。 |
| R4 | 小屏按钮遮挡路径 | 按钮仅两下角 + 右上；路径区/中上 HUD 区无按钮（§4.2/§6）。 |
| R5 | 参考图风格预期落差 | §5.3 明确升级点（IP 同源/双编码/Juicy/布局/可达性），主理人可逐项核对。 |
| R6 | 微信包体 | 图标零位图（Graphics 实时绘制），不增包体（ADR-004）。 |

---

## 附录：与扔栗子 GDD / 其它文档的衔接
- 本规格 §3.2 的 `INPUT_THROW` 是扔栗子 GDD §5 接口契约的输入侧；投掷触发逻辑在扔栗子 GDD §3。
- 弹药 HUD 位置见本规格 §6 + 扔栗子 GDD §6。
- 多连跳（二段/三段）属角色控制层，决策见扔栗子 GDD §3.1，本规格不重复。
- 如需把本方案登记进 GDD 索引，建议在 `00-index.md` 新增「UX·虚拟控制」指向本文件（非 NN 编号 GDD，属 UX 规格族）。
