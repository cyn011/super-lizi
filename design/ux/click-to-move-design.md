# 点击 / 滑动指引移动 — 设计文档（super-mali）

> **文档 ID**：UX-CLICK-TO-MOVE ｜ **版本**：v0.2（已签核 / 实施中）｜ **状态**：Implemented
> **作者**：文策渊（设计 + 叙事）｜ **实现**：程基岩（平台/引擎）｜ **日期**：2026-07-21（设计）/ 2026-07-22（落地）
> **关联**：`src/core/input/*`、`src/core/character/character-controller.ts`、`src/platform/*`、`src/game/scenes/game-scene.ts`、`src/ui/touch-buttons.ts`、`src/config/input-config.json`、`design/gdd/01-input-abstraction.md`、`design/ux/ux-spec.md`、ADR-003
> **一句话结论**：推荐 **方案 C（轻划/手势式）+ 纯点击降级**。核心层零改动，仅平台层新增 `GestureProvider` + 配置开关；旧四钮保留为可回退调试态。

---

## 1. 背景与目标
- **需求**：去掉屏幕圆圈虚拟按钮，改为「点击 / 滑动屏幕」指引栗宝移动。
- **三条目标行为**（用户原话）：
  - 往前（右）点 → 小人往前走
  - 往后（左）点 → 小人往后走
  - 斜度往上（点击/滑动方向偏上，或向上划弧线）→ 跳起来
- **双端**：必须兼容 Web（鼠标点击）与微信小游戏（触屏）。
- **兼容约束**：微信模拟器鼠标模式只能触发 `pointerdown`（点一下），无法 hold；真机触屏可 hold/slide。

## 2. 现状核实（代码层，已读源码）
### 2.1 关键事实
| 项 | 值 | 来源 |
|---|---|---|
| 逻辑分辨率 | 512 × 288 | `platform/detect.ts` |
| 瓦片 | 32px | `physics-config.json` |
| 固定步长 | `STEP_MS = 1000/60 ≈ 16.67ms`（60Hz） | `core/config/index.ts` |
| moveSpeed | 140 px/s | `character-config.json` |
| accelGround / friction | 1200 / 1600 | 同上 |
| gravity / jumpVelocity | 1800 / -480 | 同上 |
| coyote / jumpBuffer / shortHopCut / airJumps | 100ms / 120ms / 0.7 / 1 | 同上 |

派生：
- **满跳高度** = 480² / (2·1800) = **64px = 2 瓦片**；**满跳上升时长** = 480/1800 ≈ **267ms**（短跳截断必须在此前释放）。
- **短跳高度** = 64 × 0.7² ≈ **31px ≈ 1 瓦片**（控制清单 §1 卡点 45–55% 已满足）。
- `InputAbstraction`（wechat）映射：`left:['touch:left'] / right:['touch:right'] / jump:['touch:jump'] / action:['touch:action']`。
- `CharacterController.consume(input)` 只读：`left/right`(held)、`jumpPressed`(边沿→buffer)、`jumpHeld`(控制短跳)、`jumpReleased`。**不积分位置、不读碰撞、零平台 API**。
- 采样链路：`stepSim` 每固定步调 `platform.input.sample()` → `RawInputFrame` → `InputAbstraction.sample()` → `InputState` → `consume()`。
- 现有按钮：`ui/touch-buttons.ts`（仅 `env==='wechat'` 挂载），命中区来自 `inputConfig.wechat.buttons`；`game-scene.setupPointerInput` 用 Phaser `this.input.on('pointerdown')` 命中四钮 → `platform.input.simulatePress`。**这是微信模拟器唯一可靠输入通道**（原生 `mousedown/up` 不触发，仅 `pointerdown/click`）。

### 2.2 约束硬点（决定方案取舍）
- ⚠️ **微信模拟器只能 `pointerdown`（点一下）**，无 `pointermove/up`、无 `mousedown`。→ 任何依赖「按住 / 滑动」的方案在官方调试器里**无法测试**，必须内置「纯点击降级路径」。
- `src/core` 零平台 API：手势判定用屏幕坐标，必须落在 `src/platform` 层；core 只认 `touch:*` 信号 id。

## 3. 架构影响分析（核心层零改动）
- 手势 / 点击 → 平台层 `GestureProvider` 产出与现有**完全相同**的信号 id（`touch:left/right/jump/action`）→ `InputAbstraction` + `consume` **原样复用，零改**。
- 切换点仅三处：`platform.input` 的提供者（virtual 按钮 vs gesture）、`input-config.json` 的 `layout` 开关、`TouchButtons` 是否挂载。
- 屏幕分区判定发生在**逻辑分辨率坐标（512×288）**，**不依赖游戏态**（角色/相机），platform 层完全解耦。

## 4. 三方案对比
### 4.1 方案 A：点击点哪走哪
- **交互**：单次点击 → 朝点击侧自动走一段 / 直到障碍或其它输入停下。
- **适用平台**：鼠标点击（Web）、触屏点按（微信，含模拟器 tap-only）。✅ 全平台可测。
- **与 consume 映射**：`down +={'touch:left'|'touch:right'}`（held）一段时长 → `friction` 停；停止时 `releasedEdge`。
- **最大风险**：
  1. 「走多远停下」在滚动相机下难定义（点到世界坐标需相机变换 + 游戏态耦合，违反 core 解耦）。
  2. 纯点击持续移动需连点，手感偏碎。
  3. 跳跃仍需另配（点上方 / 手势），与「点哪走哪」语义略冲突。

### 4.2 方案 B：按住拖拽式
- **交互**：手指按住持续朝拖拽方向走，松手停；拖拽中越过中线可换向。
- **适用平台**：真机触屏（hold/slide 可用）；**微信模拟器不可用**（只能点一下 → 仅 ~100ms 闪一下，几乎走不动）。
- **与 consume 映射**：按住期持续 held `touch:left/right`；松手 `releasedEdge`；换向即切换信号。
- **最大风险**：⚠️ 模拟器无 hold → **开发期无法在官方调试器里正常试玩 / 调手感**，测试闭环断裂；必须另配调试输入（又回到按钮）。**这是 B 被否定的主因。**

### 4.3 方案 C：轻划 / 手势式
- **交互**：根据滑动向量决定走 / 跳（类 Mario Run / 划屏平台跳跃）。上划 = 跳；水平划 / 点 = 走。
- **适用平台**：真机触屏（滑动流畅）；Web 鼠标拖拽也可用；**模拟器仅 tap → 降级为点区域走 / 点上方跳**。
- **与 consume 映射**：滑动向量 → 选 `touch:left/right`(held) 或 `touch:jump`(pressed+held)；上划长划 = 满跳，快划松手 = 短跳（借 `jumpHeld`）。
- **最大风险**：
  1. 上划跳在模拟器（tap-only）测不了 → 需点击降级（已在本方案内解决）。
  2. 误触：斜向划可能判跳或走，须斜率阈值调参。

## 5. 推荐：方案 C + 纯点击降级（Hybrid）
### 5.1 设备双态模型
- **Hold 态（真机触屏 / 能报 move+up 的设备）**：
  - 按下左 / 右半区 → 开始走该方向（持续 held，松手 `friction` 停）。
  - 按住中手指越中线 / 拖动 → 实时换向（地面跟手左右走，松手停）。
  - **跳跃中继续拖动可空中换向**：跳跃态（上划跳或上区跳）期间持续拖动，水平方向实时跟随指针（相对 `playerScreenX`），`jumping` 与 `walkDir` 叠加，空中即换向；松手一并释放跳与走。
  - 向上划（Δy/|Δx| ≥ 0.5 且 Δy<0）→ 跳；划得久（hold）= 满跳，快划即松 = 短跳。
  - **Tap 态（微信模拟器 / 只能 pointerdown）**：
  - 点栗宝右方（`dx>playerDeadzone=16`）→ 走右 `WALK_SEGMENT_MS ≈ 280ms`（≈1.2 瓦片）后自动停。
  - 点栗宝左方（`dx<-16`）→ 走左同段。
  - 点栗宝上方（`dy<-16`）→ 跳（固定保持 300ms = 满跳，模拟器无 hold 故不给短跳）。
  - 斜向（偏上且偏左右）→ 跳 + 走 同时成立（见 §5.3 斜向优先跳）。
  - 点栗宝周围死区（`|dx|<=16 且 |dy|<=16`）→ 停（清当前行走），作「急停」。
  - 连点延长行走距离。
- 两套由**同一事件流**统一实现（见 §7.3）：有 move/up → 走 Hold 路径；只有 down → 走 Tap 段路径。

### 5.2 与 consume 的精确映射
| 玩家意图 | 平台层信号（RawInputFrame） | InputAbstraction → InputState | consume 效果 |
|---|---|---|---|
| 右走 | `down +={'touch:right'}` | `right=true`(held) | `vx → +140` |
| 左走 | `down +={'touch:left'}` | `left=true`(held) | `vx → -140` |
| 停 | `down -={'touch:left'/'right'}` (+`releasedEdge`) | `left/right=false` | `friction → 0` |
| 满跳 | `pressedEdge +={'touch:jump'}` + `down +={'touch:jump'}` 保持 ≥300ms | `jumpPressed=true`, `jumpHeld=true`(≥apex) | `vy=-480`，全高 64px |
| 短跳（真机） | `pressedEdge +={'touch:jump'}`，但 <267ms 即 `released` | `jumpPressed` + `!jumpHeld`(上升段) | `vy × 0.7 → ≈31px` |
| 暂停 | 双指 tap（见 §5.4） | 走 action 通道 / 独立事件 | `ON_PAUSE` |

> 注：`InputAbstraction` 的 wechat mapping（`left:['touch:left']`…）**完全不改**；web mapping 仅追加 `touch:*` 与键码并存（见 §7.2）。

### 5.3 以栗宝屏幕位置为原点的相对分区与判定流程（512×288）【最新拍板 · 2026-07-23】
> **替代原 §5.3 的「屏幕中线分区 / 顶部跳跃区」**（v0.2 落地版）。用户拍板：点击意图以「栗宝在屏幕上的位置」为原点判定，而非屏幕固定坐标（中线 x=256 / 顶部 y<100）。
- **原点 `P=(playerScreenX, playerScreenY)`**：每帧由 `game-scene.update` 经相机变换算出屏幕逻辑坐标，通过 `Platform.setPlayerScreenPos`（可选）→ `GestureProvider.setPlayerScreenPos` 喂入；未设置时默认 `(256,144)`（屏幕中心）兜底。
- **死区半径 `playerDeadzone = 16px`**（逻辑分辨率下约 0.5 瓦片，见 `input-config.wechat.gesture`）：`|dx|<=16 且 |dy|<=16` 视为栗宝周围死区 → 停。
- **判定（单次 `pointerdown`，相对 P）**：
  1. 双指 → 暂停（§5.4）。
  2. `dy = y − playerScreenY < −16` → **跳**（点击在栗宝上方死区外）。
  3. `dx = x − playerScreenX > 16` → **右走**；`dx < −16` → **左走**。
  4. **斜向优先跳（用户拍板）**：偏上（`dy<−16`）**同时**偏左/右（`|dx|>16`）→ 跳 + 走 **同时成立**，不互斥（点栗宝右上/左上 = 斜跳着走）。
  5. 死区内（`|dx|<=16 且 |dy|<=16`）→ **停**（清水平方向；跳由 2 控制，纯跳时 |dx|<=16 只跳不走动）。
- **滑动**（Hold 态，`pointerup` 结算）：位移 ≥16px 且 `Δy<0` 且 `|Δy| ≥ 0.5|Δx|` → 跳；否则按水平分量走（`move` 期间已相对 `playerScreenX` 实时换向）。
- **拖动换向不再要求「先判出方向」**（2025-07-23 增强）：进入 Hold 态（位移 ≥ `SWIPE_MIN_DIST`）后，即便拖动起点落在栗宝死区（`walkDir=null`），只要指针 x 相对 `playerScreenX` 超出死区即触发左/右走，松手停；拖回死区保持上一方向（`p.walkDir` 原值，防抖），不清除、不重发。→ 地面按住拖动实时跟手左右走；起点在死区也能起步行走。
- **跳跃中可拖动换向**（2025-07-23 增强）：`pointerMove` 不再因 `jumping` 提前返回。跳跃态（上划跳或上区跳）期间继续拖动，水平方向实时跟随指针（相对 `playerScreenX`），`jumping` 与 `walkDir` 叠加，空中即换向；松手时跳与走作为两个独立分支一并释放（避免行走信号残留）。

```
            栗宝在屏幕位置 P = (playerScreenX, playerScreenY)
                      ●(P)
                ┌─────┼─────┐
                │ 上  │ 跳  │    dy < -16 → 跳
                │(死区│     │    斜向(偏上+偏左右)→ 跳+走
        dx<-16  ├─────P─────┤  dx > 16 → 走
        左走    │ 死区 │ 右走│
                │     │     │
                └─────┴─────┘
               |dx|<=16 且 |dy|<=16 → 停(急停)
```

### 5.4 暂停 / 动作 入口
- 真机 / Web：**双指 tap**（两枚 pointer 同时 down）→ `ON_PAUSE`；避免占屏按钮、与手势区零冲突。
- Web：保留 Esc / 键盘 action（mapping 并存）。
- 调试：`virtual` 布局下仍用原 action 钮 + Esc。

## 6. 精确工程参数（5 项逐条）
### 6.1 五个核心参数
1. **死区半径（以栗宝屏幕位置为原点）**：`playerDeadzone = 16 px`（逻辑，见 `input-config.wechat.gesture`）。判定（相对 `P=(playerScreenX, playerScreenY)`）：`dx>16 → 右`；`dx<-16 → 左`；`dy<-16 → 跳`；`|dx|<=16 且 |dy|<=16 → 死区(停)`。理由：≈0.5 瓦片，原点随栗宝移动，点「栗宝右/左/上」即走/跳（**用户最新拍板，替代原屏幕中线 256 分区**）。原 `horizontalDeadzoneX=24` 键保留但已弃用（兼容旧配置），跳跃原 `jumpZoneTop=100` 键保留但已弃用（改相对栗宝 Y）。
2. **垂直判定（跳跃斜率 / 角度）**：`JUMP_SWIPE_SLOPE = 0.5`（即 `|Δy| ≥ 0.5·|Δx|` 且 `Δy<0` 向上）。→ 角度阈值 = `atan(0.5) ≈ 26.6°` 高于水平。最小滑距 `SWIPE_MIN_DIST = 16 px`（0.5 瓦片）区分滑 vs 点。Tap 态跳改为「上半区 `y<100`」判定（不依赖斜率）。
3. **长按持续移动采样 / 换向频率**：方向在每次 `pointermove` **实时刷新**（设备率）；`platform.input.sample()` 每固定步（`STEP_MS≈16.67ms`，60Hz）被 `stepSim` 调用，消费最新方向。即「每帧刷新方向」，无独立轮询。
4. **摇杆区 / 右侧跳跃热区**：**不设摇杆区**（整屏即输入面）；**不保留常驻右侧跳钮**。跳入口 = 上半屏 tap（Tap 态）+ 上划（Hold 态）。旧右侧 jump 钮仅存于 `virtual` 调试布局。
5. **离点击点多远停**：
   - Hold 态：松手即停（玩家控距）；`friction=1600` 停距 ≈6px，几乎即停。
   - Tap 态：`WALK_SEGMENT_MS = 280 ms` → 行走距离 ≈ `moveSpeed·t = 140×0.28 = 39px ≈ 1.2 瓦片`后自动停（再加 friction≈6px → 总 ≈45px≈1.4 瓦片）。可调 250–350ms。
   - 另：`JUMP_HOLD_MS = 300 ms`（≥ 满跳上升 267ms）→ Tap 态跳固定满跳，避免模拟器只能短跳测不了满跳关卡。

### 6.2 派生数值表
| 参数 | 值 | 来源 / 推导 |
|---|---|---|
| 逻辑分辨率 | 512×288 | `detect.ts` |
| 瓦片 | 32px | physics |
| 固定步 | 16.67ms（60Hz） | `STEP_MS` |
| 满跳高度 | 64px = 2 瓦片 | v²/2g |
| 满跳上升时长 | 267ms | \|v\|/g |
| 短跳高度 | ≈31px = 1 瓦片 | ×0.49 |
| 行走段距（Tap） | ≈39px ≈1.2 瓦片 | 140×0.28 |
| 停距（friction） | ≈6px | 140/1600 |

## 7. 实现落点
### 7.1 新增 / 修改文件
- **新增 `src/platform/gesture-provider.ts`**：`class GestureProvider implements RawInputProvider, PointerSink`；含全部手势 / 分区判定与内部状态机（down/pressed/released 维护、tap 计时器、jump hold 计时器）。**零 wx/DOM/Phaser 依赖**，只吃逻辑坐标。
- **改 `src/platform/wechat/wechat-platform.ts`**：按 `inputConfig.wechat.layout` 选 `GestureProvider`（默认）或旧 `WechatTouchProvider`（virtual 调试）。
- **改 `src/platform/web/web-platform.ts`**：同样接 `GestureProvider`；键码与 `touch:*` 并存（Web 既能键也能点）。
- **改 `src/game/scenes/game-scene.ts`**：`setupPointerInput` 由「命中四钮 → simulatePress」改为「转发 `this.input.on('pointerdown'/'pointermove'/'pointerup')` → `platform.input` 的 `PointerSink` 方法」。virtual 布局仍走旧按钮命中（保留）。
- **改 `src/ui/touch-buttons.ts` 挂载条件**：仅 `layout==='virtual'` 时 `new TouchButtons`；gesture 布局下不创建（旧代码保留可回退）。
- **改 `src/config/input-config.json`**：`wechat.layout` 默认 `"gesture"`；保留 `"virtual"` 作为回退值。

### 7.2 配置开关（回退按钮模式）
```json
"wechat": {
  "layout": "gesture",          // 默认 gesture；改 "virtual" 即回退四钮
  "buttons": { "left": {...}, "right": {...}, "jump": {...}, "action": {...} },  // 原四钮保留
  "gesture": {
    "horizontalDeadzoneX": 24,   // 已弃用：屏幕中线分区改用 playerDeadzone
    "playerDeadzone": 16,        // 死区半径：以栗宝屏幕位置为原点（|dx|/|dy|<=此值判停）
    "jumpZoneTop": 100,          // 已弃用：Tap 跳跃改相对栗宝 Y（dy < -playerDeadzone 判跳）
    "jumpSwipeSlope": 0.5,
    "swipeMinDist": 16,
    "walkSegmentMs": 280,
    "jumpHoldMs": 300
  }
}
```
- Web：`webInputConfig` 追加 `touch:left/right/jump/action` 到对应数组（与键码并存）。
- 调试强制按钮：`?buttons=1` 或 `DEBUG_FORCE_VIRTUAL` 常量 → 无视 layout 用 virtual。

### 7.3 事件转发（scene → provider）
- scene 检测 `if ('pointerDown' in platform.input)` 则转发 Phaser 指针事件（逻辑坐标经 `pointer.x/y` 直接取；Phaser 已归一化到逻辑分辨率）。
- `pointerdown(x,y)`：记起点、起 tap 计时、按 §5.3 优先级定意图；Hold 态同时起 held。
- `pointermove(x,y)`：Hold 态实时换向 / 判定上划；取消 tap 计时（有移动 = 非纯点）。
- `pointerup(x,y)`：Hold 态结算上划 → 跳 或 停；Tap 态由计时器在 `WALK_SEGMENT_MS` 后自动 `released`。
- 计时器用**仿真时钟**（随固定步累加），暂停时 `reset()` 清状态，避免 `setTimeout` 漂移。

## 8. 平台兼容与降级
- **微信真机**：`wx.onTouchStart/Move/End` → 同 `GestureProvider`；完整 Hold + 划跳。
- **微信模拟器（鼠标）**：仅 `pointerdown` → 自动走 Tap 段路径；跳走上半区；可完整试玩 / 调参。
- **Web 鼠标**：Phaser pointer 事件同源；键盘并存。
- **边界处理**：① 滑动中越过中线换向；② 快速连点同侧叠加距离；③ 暂停时 `reset()` 清所有 held / 计时。

## 9. 可访问性 / 调试
- 热区：整屏分区远大于 48×48（满足 Basic）；死区防误触。
- 减少动态：跳跃尘土 / 落地的 juice 仍走既有事件，不受输入改法影响。
- 调试：`virtual` 回退 + `?buttons=1`；手势参数全在 config，可热调。

## 10. 风险 / 取舍 / 待拍板
- **风险 1（设计理论红线·支柱漂移）**：去按钮后「精准操作」感下降。缓解：死区 + 斜率阈值保精度；保留 virtual 调试。
- **风险 2**：上划跳在模拟器测不了 → 靠上半区 tap 跳覆盖（已含）。
- **风险 3**：Tap 态不能短跳（模拟器无 hold）。取舍：模拟器跳 = 满跳，真机才有短跳；可接受。
- **风险 4（一致性·已锁决策）**：本方案将 **GDD 01 §3/§6 的「虚拟按钮 Must」**、**ADR-003 §3 的「双按钮布局」** 由默认改为 opt-in 调试态。需主理人确认是否修订 GDD/ADR（建议：降为「默认 gesture、virtual 可回退」）。
- **待拍板**：
  1. 默认布局定 `gesture` 是否同意？（建议是）
  2. 暂停用「双指 tap」是否接受？还是想要常驻暂停图标？
  3. 上半区跳阈值 `y<100`（≈上 35%）是否 OK？或改其它分区？
  4. Tap 行走段 `280ms`（≈1.2 瓦片）是否合适（可 250–350 调）？

## 11. 验收标准
- [x] 微信真机：点右 / 左半 → 走；上划 → 跳；按住 → 持续走、松手停；越过中线换向。
- [x] 微信模拟器：点右 / 左半 → 走一段自停；点上半屏 → 满跳；点中部 → 停；可到达凯旋之门。
- [x] Web：鼠标点 / 划等价于真机；键盘仍可用。
- [x] 核心层（`InputAbstraction` / `CharacterController`）**零改动**，逻辑层代码零 `touch`/`wx` 分支。
- [x] `layout:"virtual"` 或 `?buttons=1` → 旧四钮完整回归。
- [x] 双指 tap → 暂停生效。
- [x] 参数全在 `input-config.json`，默认 `gesture`。

---

## 12. 实施记录（v0.2 · 按主理人拍板落地）

### 12.1 落地结论
- 默认布局 `gesture` 已落地；`virtual` 作为可回退调试态（设计 §10 风险 4 / 一致性声明所建议的「双按钮由 Must 降为 opt-in」**已获主理人拍板授权**）。建议由文策渊同步将 GDD 01 §6、ADR-003 §3 的「双按钮 Must」修订为「默认 gesture、virtual 可回退」（数值不变）。
- **core 零改动已验证**：`npm test` 93 项全绿（含 `core-no-platform` 红线测试），`npm run build:wechat` 与 `npm run build:web` 均成功。

### 12.2 实际文件路径（与 §7.1 草案写法不同，功能一致）
| 草案写法 | 实际路径 |
|---|---|
| `src/core/input-config.json` | `src/config/input-config.json`（JSON，由 `src/core/config/index.ts` 类型化读取） |
| `src/core/input-abstraction.ts` | `src/core/input/input-abstraction.ts` |
| `src/core/input/raw-input.ts` | 同（RawInputFrame / RawInputProvider / SignalId） |
- 新增 `src/platform/gesture-provider.ts`（`GestureProvider implements RawInputProvider, PointerSink`），零 Phaser / 零 wx 依赖。
- 新增 `PointerSink` 接口于 `src/platform/raw-input-provider.ts`。

### 12.3 与草案的少量实现偏差（行为一致，仅落点更优）
1. **Web 映射追加 `touch:*`**：草案 §7.2 写「改 `webInputConfig`」，但该映射硬编码于 `src/core/config/index.ts`（core 不可改）。改为在 `input-config.json` 的 `web.left/right/jump/action` 数组**直接追加** `touch:left/right/jump/action`，core 自动透传 → 零改 core，效果等价。
2. **`?buttons=1` 在平台层解析**：Web 端读 `location.search`（`?buttons=1`）；微信无 URL，由 `inputConfig.wechat.layout === 'virtual'` 驱动。二者都让平台工厂返回 virtual provider，`game-scene` 用结构性检测 `'pointerDown' in platform.input` 自动路由（gesture 有 / virtual 无），无需在 game-scene 内写 URL 解析。
3. **双指暂停「生效」**：`GestureProvider` 产出 `touch:action` 后，`game-scene.stepSim` 对 `input.actionPressed` 发射 `ON_PAUSE`（架构 §5 / GDD 08：action → 暂停）。暂停**遮罩 UI 属未来 epic 08**，本期仅打通事件链路（双指 → ON_PAUSE 边沿），不引入 UI。
4. **双指暂停释放时机**：两指同时 down 触发，任一指抬起即释放 `touch:action`（非必须双指同松），手感更顺。
5. **`touch-buttons.ts` 未改内部**：四钮「是否创建」的决策统一收口到 `game-scene`（仅 `!isGestureInput()` 时 `new TouchButtons`），文件本身无需改动。
6. **Hold 态上划跳高度**：由「松手早晚」决定——按住 ≥267ms（或计时器满 300ms）为满跳（≈64px / 2 瓦片），上升段早松为短跳（≈31px / 1 瓦片）。该区分已由 `tests/unit/platform/gesture-provider.test.ts` 集成 `CharacterController` 验证（满跳 58–70px、短跳 26–38px）。

### 12.4 待主理人注意的风险
- **真机双通道输入**：真机触屏走 `wx.onTouchStart/Move/End`（wechat-platform 转发到 GestureProvider），模拟器走 Phaser `pointerdown`（game-scene 转发）。两套在各自环境独立生效；若某真机环境 Phaser 也回吐 pointer 事件，可能与 wx 事件**重复触发**（详见正文 §8 边界）。建议真机自测一次，必要时在 game-scene 按 `typeof wx` 屏蔽 Phaser 转发。
- **暂停 UI 缺口**：本期只产出 `ON_PAUSE` 事件，无遮罩/继续按钮（epic 08 范围）。双指当前会「触发暂停事件」但画面无遮罩反馈，属已知待办。
- **`tsc --noEmit` 既有告警**：`tests/unit/architecture/core-no-platform.test.ts` 用到 `fs/path/__dirname`（Node 全局），在 `types:[]` 下报类型缺失——属仓库既有问题，不影响 `vitest` 与 `vite build`（本任务未改该测试）。

---
### 12.5 最新拍板：点击原点改为「栗宝屏幕位置」（2026-07-23）
- **动因**：原 v0.2 以「屏幕固定坐标」分区（中线 x=256、顶部 y<100），用户要求改为以主角「栗宝」在屏幕上的位置为原点，点栗宝右/左/上分别走/跳，周围死区停，斜向优先跳。
- **判定**：`dx=x−P.x, dy=y−P.y`；`dy<−16 → 跳`；`dx>16 → 右`；`dx<−16 → 左`；`|dx|<=16 且 |dy|<=16 → 停`；斜向（偏上+偏左右）**跳+走同时成立**（用户拍板，不互斥）。死区 `playerDeadzone=16px`（≈0.5 瓦片）。
- **原点来源**：`game-scene.update` 每帧算栗宝屏幕逻辑坐标 `(body中心 − cam.scroll)·zoom`，经 `Platform.setPlayerScreenPos?.(x,y)`（平台层可选方法）→ `GestureProvider.setPlayerScreenPos` 喂入；未设默认 `(256,144)`。
- **改文件**：`src/platform/gesture-provider.ts`（删 `midX`/`leftThreshold`/`rightThreshold`，改 `beginIntent` 相对 P；新增 `playerX/playerY` 与 `setPlayerScreenPos`；`GestureParams` 以 `deadzone` 替代 `horizontalDeadzoneX`）、`src/config/input-config.json`（新增 `playerDeadzone:16`，`horizontalDeadzoneX`/`jumpZoneTop` 保留标注弃用）、`src/game/scenes/game-scene.ts`（每帧喂 P）、`src/platform/platform.ts`（可选 `setPlayerScreenPos`）、`src/platform/web/web-platform.ts` 与 `src/platform/wechat/wechat-platform.ts`（实现并转发到次级输入；virtual 的 `WechatTouchProvider` 无此方法 → no-op）、`tests/unit/platform/gesture-provider.test.ts`（新增 6 例覆盖相对 P 判定）。
- **验证**：`npm test` 99 项全绿（原 93 + 新增 6）；`npm run build:wechat` / `npm run build:web` 均成功。core 仍零改动（仅 `platform.ts` 接口加可选方法，非核心逻辑）。
- **已知风险**：若相机 `zoom≠1` 或相机带 deadzone 导致栗宝屏幕坐标偏移，可能需微调死区；建议真机点栗宝正上方确认跳、正右方确认走。

### 12.6 拖动增强：跳跃中换向 + 地面跟手（2025-07-23）
- **动因**（用户真机反馈）：①「跳起来的时候也支持往左拖动」——原 `pointerMove` 第 143 行 `if (p.jumping) return;` 导致跳跃态完全忽略移动，空中不能换向；②「小人也支持往左往右拖动」——原实时换向逻辑包在 `if (p.walkDir)` 内，只有已判出方向才刷新，拖动起点落在栗宝死区（`walkDir=null`）时拖动永不触发行走。
- **改动（仅 `src/platform/gesture-provider.ts`，core 零改动，信号 id 不变）**：
  1. 删除 `if (p.jumping) return;`：跳跃态 `pointerMove` 继续处理水平移动。
  2. 实时换向逻辑从 `if (p.walkDir)` 改为 `if (p.isHold)`：进入 Hold 态后依据当前指针 x 相对 `this.playerX` 实时决定方向（`x<playerX-deadzone`→左、`x>playerX+deadzone`→右、死区内保持上一方向防抖）；不再要求「先判出方向」，死区起步也能走。
  3. `pointerUp` 将 `else if (p.walkDir)` 拆为并列 `if (p.walkDir)`：跳跃+行走同时发生时松手一并释放，避免行走信号残留。
- **验证**：`npm test` 106 项全绿（原 99 + 新增 7）；`npm run build:wechat` 通过。新增 7 例覆盖：空中左移（jump+left）、死区起步拖左/右、死区边界不抖动、死区保持上一方向、松手同时释放跳+走、上划跳后水平拖动空中换向。
- **设计取舍（待主理人拍板）**：上划跳本帧仍 `return`（纯上滑只产跳、释放行走），「斜向 = 跳+走」通过「上划跳后继续水平拖动」实现，与 §5.3「滑动→跳；否则按水平分量走」一致，且保留原「上划（点左后向上滑）→ 跳，并释放原行走」单测不变。若希望「单次上划斜滑即 jump+walk 同时成立」，可移除该 `return` 并相应更新该单测（行为变更）。

---

**附录 · 一致性声明**：本方案不修改任何 GDD/ADR 的**数值**，仅将 GDD 01 §6、ADR-003 §3 的「双按钮」由 Must 降为「默认 gesture、virtual 可回退」。**此降级已获主理人拍板授权（2026-07-22）**；建议文策渊补刀修订 GDD/ADR 文案以与代码一致。
