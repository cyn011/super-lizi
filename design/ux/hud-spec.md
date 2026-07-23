# HUD 与受伤反馈 UX 规格（hud-spec）

> 文档类型：UX 规格 / 工程实现合同（给 engineering-lead 直接取数）
> 作者：文策渊（设计 + 叙事）
> 上游依据：`src/core/damage/damage-state-machine.ts`、`src/core/events/event-bus.ts`、`src/game/damage-resolution.ts`、`art/art-bible.md` §3/§7.1/§8/§9、`art/placeholder-spec.md` §2
> 范围：命数 HUD + 形态指示 + 受伤 juice + Game Over 覆盖层。**分数/金币/计时 属 08-ui-hud，本规格不覆盖。**
> 评审强度：lean，未过度设计。

---

## 1. 概述与目标

为 super-mali 横版跳跃（逻辑分辨率 512×288，`pixelArt:true`，Web + 微信双端）定义一套**固定相机层、矢量/系统字体**的 HUD 与受伤反馈。

设计支柱（2 条，来自概念文档）：
1. **可读性优先**——任何反馈必须一眼可辨，绝不只靠颜色。
2. **每次受击都给可看见的回应（juice）**——但克制，不喧宾夺主。

目标：
- 命数用 `ui_heart` 心形图标表示 `damage.lives`（初始 3），满/空靠**实心 vs 空心**区分（形状，非仅靠颜色）。
- 形态指示用小型栗宝头像表示 `damage.state`（FULL/SMALL），表达"体型/能量"而非命数（与心形不重复）。
- 受伤提供三层独立反馈：受击闪红 → 体型缩小（FULL→SMALL）→ 无敌闪烁，任一层都能独立传达状态（色盲安全）。
- Game Over 用全屏暗罩 + 居中系统字体文案，暂停仿真，点击重试。

实现约束（ADR-004 / 美术圣经 §2.6 / §7.1）：HUD 走**矢量 Graphics + 运行时系统字体**，禁用位图字体（规避微信包体膨胀）；世界内拾取物是像素，HUD 图标是矢量，视觉一致即可。

---

## 2. 布局图（ASCII，512×288 坐标系）

HUD 固定屏幕，左上角起，margin 8px。心形行在上，形态图标紧邻其右。

```
逻辑坐标 (0,0) 左上 ┌──────────────────────────────────────────────┐ (512,0)
                   │ ♥ ♥ ♥   🌰   ← HUD 区(scrollFactor 0, depth 1000) │
                   │ (8,8)      (72,8)                                  │
                   │                                                    │
                   │            游戏世界（随相机滚动）：栗宝/刺栗/地形/终点│
                   │                                                    │
                   │  [受击闪红 / 无敌闪烁 跟随栗宝精灵，世界坐标，       │
                   │   depth = 栗宝+1，不进 HUD 层]                      │
                   │                                                    │
        (0,288) └──────────────────────────────────────────────┘ (512,288)
```

元素坐标表（逻辑 px，图标基准 16×16）：

| 元素 | x0 | x1 | y0 | y1 | 说明 |
|---|---|---|---|---|---|
| 心形 slot 0 | 8 | 24 | 8 | 24 | 间距 4px |
| 心形 slot 1 | 28 | 44 | 8 | 24 | 间距 4px |
| 心形 slot 2 | 48 | 64 | 8 | 24 | 间距 4px |
| 形态图标 | 72 | 88 | 8 | 24 | 心形右侧，间隔 8px |

- 总 HUD 行高 16px，顶部留白 8px；HUD 不进入游戏区（游戏区 y ≥ 32 安全）。
- margin 规则：所有 HUD 元素距屏幕边 ≥ 8px（满足手机横屏安全边距）。
- Game Over 覆盖层：全屏矩形覆盖 (0,0)–(512,288)，居中文本。

---

## 3. 元素清单（图标 / 颜色 / 尺寸）

颜色全部引用美术圣经 §3 色板（混合 UI 共享色板）。描边统一 `#2A1A12`。

### 3.1 命数心形（`ui_heart`）
- **数量**：渲染 `max(initialLives, damage.lives)` 个槽位（初始 3）。其中 `damage.lives` 个为**实心满**，其余为**空心暗描边**。
  - 说明：ON_HURT（FULL→SMALL）命数不变；ON_DEATH 扣 1 命后 `damage.lives` 递减，空心槽随之增加。显示总槽位可让玩家看到"已失去几命"（经典马里奥式）。
  - 前瞻：未来若接入 `prop_heart`（加命）使 `lives > initialLives`，HUD 应动态扩槽至 `damage.lives`（不截断）。
- **满命（实心）**：填充 生命粉红 `#F26D8B`，描边 `#2A1A12` 1px。
- **已失去（空心）**：仅 `#2A1A12` 描边心形轮廓，内部透明/极低不透明填充（暗），**无粉红填充**。
- **尺寸**：心形 ~16×16；图标间距 4px（见 §2 坐标）。
- **形状区分（可访问性）**：满=实心填充，空=空心轮廓——靠填充状态（形状/图样）区分，而非仅颜色。

### 3.2 形态指示（栗宝头像，次级）
- **用途**：表示 `damage.state`（FULL/SMALL），即"体型/能量"，**不重复命数**。
- **FULL**：满尺寸（16×16）栗色 `#B5763E` 圆角块 + 顶部嫩芽草绿 `#7CC242` 小点（呼应主角剪影 §4.2）。
- **SMALL**：缩小至 ~0.6（约 10×10）且**暗化**（用降饱和暗栗色，如 `#8A6A4A` 或栗色 + 半透明黑叠层），表示能量/体型缩水。
- **位置**：心形右侧（§2 坐标 72,8）。状态改变即重绘（见 §4）。

### 3.3 文本（系统字体）
- 仅 Game Over 覆盖层使用中文文本（"游戏结束" / "点击重试"）。
- 字体：运行时系统字体（Phaser `Text`，`fontFamily` 取系统默认无衬线，如 `'sans-serif'`），**禁用位图字体**。
- 字号：≥ 14px 逻辑（建议 16px），缩放后等效 ≥ 14px（满足 accessibility §9.2）。
- 配色：填充 石灰白 `#F4EFE6`，描边 `#2A1A12`（高对比，暗罩上清晰可读）。

---

## 4. 事件 → 反馈映射表

订阅源：与场景同一 `EventBus`（game-scene 的 `this.bus`）。四个事件 payload 均带 `lives`（来自 `damage-resolution.ts` 实际发放点）。

| 事件 | payload | 触发条件（来自状态机） | HUD 反应 |
|---|---|---|---|
| `ON_HURT` | `{lives, state}` | FULL→SMALL（命数**不变**） | ① 触发 150ms 受击闪红（§5.1）；② 形态图标切 SMALL；③ 心形不变（lives 未变）。 |
| `ON_DEATH` | `{lives}` | SMALL→DEAD，命数 -1 | 心形重绘为 `damage.lives`（出现空心槽）。随后立即跟随 `ON_RESPAWN` 或 `ON_GAME_OVER`。 |
| `ON_RESPAWN` | `{lives}` | DEAD 且有命 → 满血回检查点 | 心形 = `damage.lives`；形态图标切 FULL；栗宝精灵 200ms 淡入（§5.3）；无敌闪烁开始（§5.2）。 |
| `ON_GAME_OVER` | `{lives}` | DEAD 且命耗尽 | 显示 Game Over 覆盖层（§6），暂停仿真。 |

**稳健做法**：HUD 在以上任一事件回调里都**重同步**一次——心形 = `damage.lives`、形态 = `damage.state`，再叠加该事件的瞬态效果（闪红 / 淡入 / 覆盖层）。这样即使事件顺序有边缘情况也不漂移。

状态机关键事实（供工程对齐，非需改）：
- `hit()`：无敌帧内忽略；FULL→SMALL（设 `invincibleTimer=1500`）；SMALL→DEAD 扣 1 命，有命立即重生 FULL（设 `invincibleTimer=1500`），无命 `isGameOver`。
- `sizeScale`：FULL=1 / SMALL=0.6（由 `damage-config.json`，已确认 `fullScale:1, smallScale:0.6, invincibleMs:1500, initialLives:3`）。
- 每固定步 `damage.update(dtMs)` 衰减 `invincibleTimer`（game-scene `stepSim` 已调用）。

---

## 5. 受伤 juice 行为参数（时长 / 频率）

三层反馈**独立**，任一层都可单独传达状态（色盲安全，见 §7）。

### 5.1 受击闪红（ON_HURT 触发）
- **对象**：栗宝精灵（世界坐标，跟随 `body`）。
- **方式**：叠加 警示红 `#E8483B` 半透明覆盖（ silhouette/矩形均可）。⚠️ **非全白高频闪**（对齐美术圣经 §8）。
- **时长**：150ms，alpha 从 ~0.85 衰减到 0（线性或 ease-out）。
- **可选闪白**：首 ~40ms 可叠一层白色核心（alpha ~0.6）做"闪白"pop，随后转红——避免持续白闪。
- **引擎注意**：Phaser `Graphics` 无原生 tint；推荐（a）在 `drawLibaoPlaceholder` 增加可选 `flashColor` 参数重绘，或（b）在栗宝精灵上挂一个同尺寸覆盖 `Graphics`/矩形，150ms 后隐藏。二选一，lean 即可。

### 5.2 无敌帧闪烁（invincibleTimer > 0 期间）
- **对象**：栗宝精灵 alpha。
- **频率**：~10Hz（周期 100ms，明 50ms / 暗 50ms）。
- **幅度**：alpha 在 1.0 ↔ 0.4 之间脉冲（**永不彻底消失**，降低光敏风险）。
- **持续**：直到 `damage.invincibleTimer` 归 0（约 1500ms）。
- **辅助性质**：这是 juice，**不是唯一指示**——体型缩小（FULL→SMALL）与受击闪红已是独立状态反馈（§7）。
- **可访问性**：该闪烁是**局部精灵**（非全屏），美术圣经 §9.3「全屏闪烁 <3Hz」不直接约束；但仍建议（a）用 alpha 脉冲而非硬切；（b）尊重「减少动态（Reduce Motion）」开关——开启时以**稳态半透明（alpha 0.7）或静态描边环**替代闪烁。

### 5.3 重生淡入（ON_RESPAWN 触发）
- **对象**：栗宝精灵 alpha。
- **时长**：200ms，alpha 0 → 1 线性淡入。
- **优先级**：淡入期间**压制**无敌闪烁（避免 alpha 双重逻辑冲突）；淡入结束后，剩余无敌窗口再走 §5.2 闪烁。
- **组合**：重生即设 `invincibleTimer=1500`，总无敌 1500ms = 淡入 200ms + 闪烁 ~1300ms。

### 5.4（可选）全屏红闪
- 美术圣经 §8 提到「受击全屏 0.15s 红闪」。若主程希望加入，用全屏 `#E8483B` 半透明矩形叠加 150ms（单次日闪 ≤0.2s，非连续，满足 §9.3），**独立于** §5.1 的精灵局部闪红。MVP 可省略，保持 lean。

---

## 6. Game Over 覆盖层

### 6.1 视觉
- **暗罩**：全屏矩形 (0,0)–(512,288)，填充 `rgba(0,0,0,0.6)`（≈0.6 不透明黑），`scrollFactor(0)`，`depth 2000`。
- **主文案**："游戏结束"，居中，系统字体，字号 ≥16px，填充 `#F4EFE6`，描边 `#2A1A12`（高对比）。
- **提示文案**："点击重试"（或"轻触屏幕重新开始"），居中文案下方，字号 ≥14px，同配色或稍降不透明。
- **风格**：圆角 + 统一描边 `#2A1A12`，与 HUD 视觉一致（美术圣经 §7.2 失败用温柔提示，非恐吓画面）。

### 6.2 行为
- **触发**：`ON_GAME_OVER` → 显示覆盖层，**暂停仿真**（冻结 `stepSim`：推荐置 `gameOver` 标志，在 `update` 中跳过 `this.loop.update(delta)`，仅保留覆盖层渲染与输入）。
- **重试**：点击 / 触摸覆盖层任意处（热区 = 全屏 ≥48×48，满足 §9.2）→ 发 `ON_RESTART` 事件（事件总线已有常量），由主场景（game-scene）监听并做干净 reset：
  - 重建 `new DamageStateMachine(initialLives, damageConfig)`（命数复位 3）；
  - `body` 复位到 `spawn`，`controller` 复位，`levelComplete` 清零；
  - 隐藏覆盖层，清 `gameOver` 标志，恢复 `loop.update`。
  - （备选：直接 `this.scene.restart()`；但 `ON_RESTART` 方案更可控、状态更干净，推荐。）

---

## 7. 可访问性

对齐美术圣经 §9（目标 Standard 级）：
- **心形满/空靠形状区分**：实心填充 vs 空心轮廓，不止颜色（§3.1）。
- **生命色解耦**：心形用 生命粉红 `#F26D8B`，非警示红，避免"红=危险/红=生命"冲突（§9.1）。
- **中文文本 ≥14px 等效**（§9.2），高对比描边（§3.3 / §6.1）。
- **无敌闪烁非唯一指示**：体型缩小 + 受击闪红为独立反馈，色盲可辨（§5.2 / §9.1）。
- **防光敏**：受击闪红为半透明红、非全白高频；可选全屏红闪单次日闪 ≤0.2s（§5.1 / §5.4 / §9.3）。
- **触控热区**：Game Over 重试热区全屏（≥48×48）；HUD 图标为显示层，不直接响应触摸（§9.2）。
- **减少动态开关**：开启时无敌闪烁改为稳态半透明 / 静态描边环，并建议关闭屏幕震动与粒子（§5.2 / §9.3）。
- **（可选，Comprehensive）色盲辅助模式**：开启后心形加白色描边脉冲（§9.1），MVP 不强制。

---

## 8. 工程实现提示（字段 / 订阅 / 层级）

### 8.1 订阅事件（来自 `this.bus`）
- `ON_HURT` / `ON_DEATH` / `ON_RESPAWN` / `ON_GAME_OVER`。
- 回调内统一重同步 `damage.lives` 与 `damage.state`，再叠加瞬态效果（§4）。
- 场景 `shutdown` 时取消订阅（用 `bus.on` 返回的 off 函数）。

### 8.2 读取字段（来自 `damage` 状态机实例）
- `damage.lives` —— 心形数量 / 满槽数。
- `damage.state`（'FULL'|'SMALL'）—— 形态图标。
- `damage.invincibleTimer`（ms） —— 驱动无敌闪烁（每帧读，>0 即闪）。
- `damage.sizeScale`（1 / 0.6） —— 由 `stepSim` 已用于 `body.h`/碰撞盒；HUD 不直接依赖，仅作参考。

### 8.3 渲染与层级
- HUD 容器：`Graphics`（矢量画心形/形态图标）+ `Phaser.GameObjects.Text`（系统字体，仅 Game Over 用）。
- **固定相机层**：`setScrollFactor(0)`，不被 FollowCamera 滚动影响。
- **depth 建议值**：
  - 世界图层（地形/敌人）：0
  - 栗宝精灵 `this.sprite`：建议提到 **10**（高于世界，避免被后绘地形遮挡——当前 game-scene 中 `drawLevel` 在 sprite 之后 add，建议显式设 depth）
  - 受伤覆盖层（闪红/闪烁所在）：**11**（= 栗宝 +1，世界坐标跟随 body）
  - HUD（心形 + 形态图标）：**1000**
  - Game Over 覆盖层：**2000**
- 心形 / 形态图标**仅在事件时重绘**（开销低），无需每帧重画；闪烁 / 闪红 / 淡入在 `update` 每帧按计时驱动（见下）。

### 8.4 与 game-scene 的衔接点
- **`create`**：建 `damage` 之后即建 HUD 容器（Graphics + Text），`setScrollFactor(0)` + `depth 1000`；订阅四个事件；订阅返回的 off 函数存入实例，shutdown 解绑。
- **`update(time, delta)`**：在 `this.loop.update(delta)` 之后、`drawSprite()` 之前/之后，驱动受伤计时：
  - 读 `damage.invincibleTimer` → 计算栗宝 `alpha`（§5.2 脉冲）。
  - 维护 `respawnFadeTimer`（ON_RESPAWN 时设 200）→ 淡入期间压制闪烁（§5.3）。
  - 受击闪红计时（ON_HURT 时设 150）→ 驱动覆盖层 alpha（§5.1）。
  - `bloom/闪白时机`：即上述闪红脉冲的触发时刻（ON_HURT）；若未来接入 Phaser postFX bloom，在 ON_HURT 脉冲一次即可（MVP 不要求 bloom 管线）。
- **`stepSim`**：`damage.update(dt*1000)` 已在每固定步衰减无敌计时，HUD 只读不必改。
- **`ON_GAME_OVER` 处理**：置 `gameOver` 标志使 `update` 跳过 `loop.update`（冻结仿真）；覆盖层全屏可点；点击发 `ON_RESTART`，主场景 reset（§6.2）。

### 8.5 不变量 / 红线
- 不写死数值：命数初始、无敌时长、缩放均来自 `damage-config.json` / `economy-config.json`，HUD 只读 `damage.*`，不硬编码。
- 不引入位图字体（ADR-004）。
- 不靠颜色单独传关键信息（§7）。
