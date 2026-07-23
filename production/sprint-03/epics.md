# super-mali · Sprint 3 Epic / Story 拆分（C1–C5 + QA）

> 阶段：Sprint 3（内容闭环）
> 作者：程基岩（engineering-lead）
> 输入：`production/epics.md`（Phase 4 总拆分）、`docs/architecture/control-list.md`、`docs/architecture/adr/ADR-005-fixed-step-loop.md`、`src/` 现状审计
> 前置（Sprint 2 已交付，质量门 25/25 绿）：`character-controller`（E2.S3，10 项手感单测通过）、`damage-state-machine`（E2.S4）、`physics/body`+`collision`（E2.S1）、`input-abstraction`（E2.S2）、微信 demo 过 R2
> 用法：本文件为 Sprint 3 颗粒度拆分，每个 Story 一个冲刺内可完成并验收。验收以 `control-list.md` 为唯一量化基线。

---

## 0. 现状审计结论（已读代码，关键事实）

| # | 事实 | 位置 | 对 Sprint 3 的影响 |
|---|---|---|---|
| F1 | `body`（`Body`）与 `controller.state`（`CharacterState`）是**两个独立对象**；`stepSim` 在 `consume()` 之后用占位 `this.body.vx = (input.right?MOVE_SPEED:0)-(input.left?MOVE_SPEED:0)` **覆盖** controller 水平输出 | `src/game/scenes/game-scene.ts:95` | C1 核心：controller 的水平手感从未真正驱动 body |
| F2 | `consume()` 在跳跃时设 `controller.state.vy = jumpVelocity`，但**该值从未回写 `body.vy`**；`stepBody` 只积分 `body` 的速度 | `character-controller.ts:128` vs `game-scene.ts:96` | C1 核心：**跳跃实际不产生位移**，controller 的跳跃逻辑被架空 |
| F3 | `controller.state.grounded` 在 `stepBody` **之后**才写入（`game-scene.ts:97`），`consume()` 读到的是上一帧的 grounded（1 帧滞后） | `game-scene.ts:92,97` | C2：coyote/jump-buffer 在集成态下需验证无偏差 |
| F4 | `WebKeyboardProvider.attach()` **从未被调用**，`createWebPlatform()` 只 `new` 不 `attach()` → DOM 监听未绑定 → **Web 键盘输入完全失效** | `src/platform/web/web-platform.ts:10` | C4 阻断项：Web 端点对点必须补 `attach()` |
| F5 | 微信触屏链路在结构上是通的：`WechatTouchProvider` 产出 `touch:left/right/jump/action` → `wechatInputConfig`（`['touch:left']` 等）→ `consume()`；`TouchButtons` 命中区已绘制 | `wechat-touch.ts`、`core/config/index.ts:50`、`ui/touch-buttons.ts` | C4：微信端修好 F1/F2 后应可跑通 |
| F6 | 输入抽象层位于 `src/core/input/`（**非任务假设的 `src/game/input/`**），零平台依赖，已就绪 | `core/input/input-abstraction.ts` | 路径纠正；抽象层无需新建 |
| F7 | `damage-state-machine` 已实现（`FULL→SMALL→DEAD` + 无敌帧 + `sizeScale` + `isGameOver`），但**场景未实例化、未 `update`、未接碰撞回调** | `core/damage/damage-state-machine.ts` | C3：纯接线 + 定义伤害源接口 |
| F8 | 关卡数据 `1-1.json` 为 `tiles:[]`/`entities:[]`（仅 goal 坐标），`LevelLoader.load` 仅为校验壳，无 `CollisionWorld` 构建 / 实体生成 / 终点检测 | `src/config/levels/1-1.json`、`core/level/level-loader.ts` | C5：需真实地图 + Loader 升级 + 终点检测 + 镜头跟随 |
| F9 | 关卡宽 40 tile = 1280px > 逻辑宽 512px，当前场景无镜头跟随，出生点固定写死 | `game-scene.ts:59` | C5：必须加 camera follow 才能跑完整关 |
| F10 | `action` 按钮已映射进 `InputState` 但 `consume()` 不消费它（预留）；落地 `ON_LAND` 事件场景未发 | `input-abstraction.ts:41`、`event-bus.ts` | C2/C4 备注：action 为未来机制预留，非阻塞 |

**一句话总结**：core 逻辑层（controller / damage / physics / input）Sprint 2 已全部就绪且单测通过，但 `game-scene.ts` 仍是用占位代码"假装"驱动——**body 与 controller.state 双对象失同步**是 Sprint 3 的头号技术问题，修好它，跳跃/二段跳/短跳/coyote/buffer 才能落地，受伤与关卡才有可被驱动的载体。

---

## 1. Sprint 3 目标

**把已实现的 core 逻辑真正"接进"主场景，跑通单关最小可玩闭环（出生点 → 跳/走 → 凯旋之门），并打通微信触屏与 Web 键盘端点对点。**

- 约束：保持 `src/core/` 零平台 API 铁律（静态扫描 0 命中 wx/keyboard/touch/localStorage/AudioContext）；新增平台相关代码只落在 `src/platform/` 或 `src/game/`。
- 不在本 Sprint 范围（沿用既有决策）：敌人 AI（E3，仅以占位伤害源验证 C3 管线）、经济/分数（E4.S2）、HUD（E5）、音频真实资产（E6）、元循环存档（E5.S3）、IP 构建扫描（E8.S2 已预留）。

### Sprint 3 → Phase 4 Epic 映射
| Sprint 3 Story | 归属 Phase-4 Epic | 复用/新增 |
|---|---|---|
| C1 | E2.S3（角色控制器接入） | 接入（非新建） |
| C2 | E2.S3 / E2.S5（手感验证） | 验证 + 集成测试 |
| C3 | E2.S4（受伤状态机接入） | 接入 + 伤害源接口 |
| C4 | E1.S1 / E2.S2（双端输入链路） | 修 Web attach + 验证 |
| C5 | E4.S1（关卡加载与运行时） | 升级 Loader + 终点 + 镜头 |
| QA | E8.S1/S3（垂直切片 + 双端回归） | 手感 smoke + 真机复验 |

---

## 2. Story 清单

### C1 · 主场景接入 CharacterController（驱动 body）
- **目标**：消除 F1/F2 的 body↔controller 双对象失同步，让 `consume()` 的输出真实驱动物理 body（水平 + 跳跃），删除占位 `MOVE_SPEED` 覆盖逻辑。
- **涉及文件**：
  - 改：`src/game/scenes/game-scene.ts`（`stepSim` 重写：同步协议 + 删占位）、`src/game/scenes/game-scene.ts` 的 `create`（body/controller 初始化对齐）
  - 复用（不动）：`core/character/character-controller.ts`、`core/physics/body.ts`、`core/physics/collision.ts`
- **验收标准**：
  - [ ] `stepSim` 中**不再出现** `body.vx = 占位` 之类的硬编码覆盖；水平速度由 `controller.state.vx` 经同步回写 `body.vx`。
  - [ ] 按跳时 `controller.state.vy`（=jumpVelocity）经同步回写 `body.vy`，角色可见起跳与下落弧线。
  - [ ] `controller.state.grounded` 在 `consume()` **之前**由上一帧 `stepBody` 结果注入（消除 F3 滞后）。
  - [ ] `body` 与 `controller.state` 的 `x/y/w/h/vx/vy` 在每固定步保持一致（同步协议，详见 `integration-plan.md` §2）。
  - [ ] 出生静止站地 60s 不抖/不陷/不下坠（control-list §1 第1项）。
  - [ ] 删除本地 `MOVE_SPEED` 常量（90），改用 `characterConfig.moveSpeed`（140），零硬编码。
  - [ ] `core/**` 仍 0 命中平台 API（静态扫描，§4 第1项）。
- **估点**：M
- **依赖**：无（Sprint 2 的 controller/body 已就绪）

### C2 · 接入二段跳 / 短跳 / 土狼时间 / 跳跃缓冲（集成验证）
- **目标**：在 C1 的真实驱动链路上，验证 controller 四项时间敏感机制无失真，并补齐"集成态"测试证据（单测已覆盖，但需证明同步协议未扭曲手感）。
- **涉及文件**：
  - 改：`src/game/scenes/game-scene.ts`（落地检测发 `ON_LAND`，用于 juice/音频预留）、可选 `src/game/scenes/sandbox-scene.ts`（接入真实固定步测 §1 指标）
  - 新增：`tests/integration/scene-loop.test.ts`（headless：controller+body+CollisionWorld+InputAbstraction 直驱，验证同步协议下 10 项指标仍达标）
  - 复用：`tests/unit/character/character-controller.test.ts`（已通过）
- **验收标准**：
  - [ ] 全跳高度 ≈64px（60–68）、二段跳高度 ≈1.6 tile（50–56px）、短跳高度 = 全跳 45–55%（control-list §1）。
  - [ ] Coyote：离地 ≤100ms 内按跳有效、>100ms 无效。
  - [ ] Jump buffer：落地前 ≤120ms 按跳、落地即刻起跳。
  - [ ] 二段跳：空中恰好 1 次，落地重置 `airJumpsLeft`。
  - [ ] 水平 0→满速 ≤0.2s、松键→停 ≤0.15s。
  - [ ] 集成测试（headless）10 项指标落入区间，作为 C1 同步协议的测试证据。
  - [ ] `action` 字段在 `InputState` 中正确透传（即便 controller 暂未消费，F10）。
- **估点**：S
- **依赖**：C1

### C3 · 接入受伤状态机（碰敌受伤 / 无敌帧 / 击退）
- **目标**：把 `DamageStateMachine` 接进场景 update 与碰撞回调，定义"伤害源"接口，并用一个**占位伤害源**（静态 hazard 或单只可踩占位敌）打通 FULL→SMALL→DEAD→重生 全链路；实现击退与 `sizeScale` 对碰撞盒的反馈。
- **涉及文件**：
  - 改：`src/game/scenes/game-scene.ts`（实例化 DamageStateMachine、`update(dtMs)` 每固定步、碰撞回调 `hit()` + 击退、sizeScale→body.h、发 `ON_HURT`/`ON_DEATH`/`ON_RESPAWN`）
  - 新增：`src/core/damage/hazard-source.ts`（最小 `HazardSource` 接口：`overlaps(body): boolean` + `knockbackDir(body)` + `isStompable`），供 C5 实体与未来 E3 敌人复用
  - 新增（占位）：`src/game/debug/placeholder-hazard.ts`（单只静态刺栗占位，仅用于 C3 管线验证，非 MVP 敌）
  - 复用：`core/damage/damage-state-machine.ts`、`event-bus.ts`
- **验收标准**：
  - [ ] `FULL` 受伤 → `SMALL`（碰撞盒 `h*=smallScale 0.6`、无敌帧 `invincibleMs` 内重复受伤无效）。
  - [ ] `SMALL` 受伤 → `DEAD`；有命则**立即重生**为 `FULL` 且 `form=BASE`，发 `ON_RESPAWN`；命耗尽发 `ON_GAME_OVER`（control-list §1/E2.S4）。
  - [ ] 击退：命中瞬间对 body 施加水平（远离源）+ 向上冲量，角色可见被推开与短暂停控（hitstun）；hitstun 期间不消费输入方向，由物理衰减（设计见 `integration-plan.md` §5）。
  - [ ] `core/**` 零平台 API；伤害源接口在 `core/`（纯逻辑），占位 hazard 渲染在 `game/`。
  - [ ] 新增单测：`damage-state-machine` 已覆盖；补充"场景级受伤→击退→重生"集成测试（headless）。
- **估点**：M
- **依赖**：C1（需被驱动的 body 才能施加击退）；C5 的实体/碰撞世界可后置，占位 hazard 即可验证

### C4 · 微信虚拟按钮 / Web 键盘 → consume() 端到端链路打通
- **目标**：两端输入都能端到端驱动 `controller.consume()`。修复 F4 的 Web 键盘失效，验证微信触屏链路（F5）在 C1 修复后真实生效。
- **涉及文件**：
  - 改：`src/platform/web/web-platform.ts`（调用 `input.attach()`，或改 `WebKeyboardProvider` 构造即绑定）
  - 验证：`src/platform/wechat/wechat-touch.ts`、`src/ui/touch-buttons.ts`、`core/config/index.ts`（`wechatInputConfig`）
  - 复用测试：`tests/unit/input/input-abstraction.test.ts`（同手势→同 InputState，control-list §4 第2项）
- **验收标准**：
  - [ ] Web 端键盘（Arrow/WASD/Space/W/Shift）可驱动角色移动与跳跃（修复 F4）。
  - [ ] 微信端四虚拟按钮（左/右/跳/动作）命中可由 `WechatTouchProvider` 产出 `touch:*` → `consume()` 驱动；真机/模拟器量测按钮热区 ≥48px（control-list §4 第3项）。
  - [ ] 双端产生**完全相同** `InputState` 序列（同手势等价 RawInputFrame 单测固化，§4 第2项）。
  - [ ] `jumpPressedAt` 精度 ≤16ms（固定步采样，天然满足，§4 第4项）。
  - [ ] 平台切换（onHide/onShow）不丢输入状态（§4 第5项）。
  - [ ] **范围澄清**：MVP 采用离散四按钮（已落 `input-config.wechat.buttons`），"虚拟摇杆"非 MVP 项；若主理人要求摇杆，列为后续增强，不在 C4。
- **估点**：S
- **依赖**：C1（consume 须真实驱动）；Web attach 修复可与 C1 并行、无依赖

### C5 · 单关卡通跑（出生点 → 凯旋之门）
- **目标**：用真实关卡数据替换占位地板，跑通"出生→跳/走→抵达凯旋之门"的最小可玩闭环；含 Loader 升级、CollisionWorld 构建、终点检测、镜头跟随。
- **涉及文件**：
  - 改：`src/config/levels/1-1.json`（补 `tiles` 真实地图：地面 + 若干平台/缺口 + 出生点 + 凯旋之门位置）、`src/core/level/level-loader.ts`（JSON→`CollisionWorld` + 实体/终点）、`src/core/level/level-runtime.ts`（运行时持有 world/goal/spawn）
  - 改：`src/game/scenes/game-scene.ts`（用 `LevelLoader` 建 world 替换 FLOOR_ROW 占位；出生点初始化 body/controller；加 camera follow；goal AABB 重叠 → 发 `ON_LEVEL_COMPLETE`）
  - 新增：`src/game/camera/follow-camera.ts`（跟随玩家 x、钳制到关卡边界）
  - 复用：`core/physics/collision.ts`、`event-bus.ts`、`constants.ts`
- **验收标准**：
  - [ ] `1-1.json` 经 `LevelLoader` 构建出有效 `CollisionWorld`，角色与真实 tile 正确碰撞（站地/撞墙/落平台）。
  - [ ] 镜头跟随玩家且不越出关卡边界（40 tile 宽 = 1280px > 512 逻辑宽，F9）。
  - [ ] 抵达凯旋之门 AABB 重叠 → 发 `ON_LEVEL_COMPLETE`，闭环成立（无敌人也可达，因 MVP 敌人留待 E3）。
  - [ ] 出生点正确初始化 body/controller（位置、grounded、sizeScale），无"开场即掉穿"。
  - [ ] `LevelData` 校验通过；`beat.enabled:false` 不驱动任何机制（GDD 10 预留）。
  - [ ] 双端（Web + 微信）均可跑完该关（§4 回归）。
- **估点**：L
- **依赖**：C1（需被驱动的 body）；C3 终点检测本身不依赖，但建议 C3 后做以复用碰撞回调；Loader 升级为新增工作

### QA · 手感 smoke test + 微信真机复验
- **目标**：以 `control-list.md` 为基线，建立 Sprint 3 验收证据：手感量化 smoke + 微信真机复验项清单。
- **涉及文件**：
  - 改/新增：`tests/integration/scene-loop.test.ts`（C2 已建，此处汇总）、`src/game/scenes/sandbox-scene.ts`（dev 构建手感浮层，接入真实固定步）
  - 产出：`production/sprint-03/qa-checklist.md`（手测脚本 + 真机复验清单）—— **若主理人需要可单列，本 Sprint 先以 `integration-plan.md` §7 + 本 Story 验收项承载**
- **验收标准**：
  - [ ] 手感 10 项指标（§1）在集成态（非仅单测）落入区间，作为铺内容前的卡点（§1 卡点）。
  - [ ] headless 仿真冒烟：同输入序列双端逐帧一致（§4 第6项）。
  - [ ] 微信真机：启动→渲染→触屏四按钮驱动→跳跃弧线可见→抵达凯旋之门，全链路无崩（R2 复验 + C5 闭环）。
  - [ ] `core/**` 静态扫描 0 平台 API 命中（§4 第1项）纳入 CI。
- **估点**：M
- **依赖**：C1、C2、C3、C4、C5 全部完成

---

## 3. 估点与依赖

### 3.1 估点汇总
| Story | 估点 | 性质 |
|---|---|---|
| C1 | M | 接入（去占位 + 同步协议） |
| C2 | S | 验证 + 集成测试 |
| C3 | M | 接入 + 伤害源接口 + 占位 hazard |
| C4 | S | 修 Web attach + 双端验证 |
| C5 | L | Loader 升级 + 终点 + 镜头 + 真实地图 |
| QA | M | smoke + 真机复验 |

### 3.2 依赖顺序
```
C1（驱动 body，无依赖，首要）
 ├─▶ C2（手感集成验证）
 ├─▶ C3（受伤接入，依赖被驱动 body；占位 hazard 即可）
 ├─▶ C4（双端输入链路，Web attach 可与 C1 并行）
 └─▶ C5（单关闭环，依赖被驱动 body + Loader 升级）
            │
            ▼
          QA（全部完成后手感 smoke + 真机复验）
```
**关键路径**：`C1 → {C2, C3, C4, C5} → QA`。C1 是唯一硬前置；C2/C3/C4/C5 在 C1 后可并行推进。

---

## 4. 风险登记（摘要，详 `integration-plan.md` §7）

| 风险 | 等级 | 说明 | 缓解 |
|---|---|---|---|
| R1 body/controller 双对象失同步 | 高 | F1/F2：当前跳跃完全没接上 | C1 同步协议（in/out 双向拷贝） |
| R2 Web 键盘失效 | 高（易修） | F4：`attach()` 未调用 | C4 一行修复，与 C1 并行 |
| R3 击退与 controller 冲突 | 中 | controller 无 hitstun API，摩擦会快速吃掉击退速度 | C3 引入 hitstun：期间跳过 consume，纯物理积分击退（§5） |
| R4 关卡数据/Loader 为空 | 中 | F8：C5 需先有真实地图与 Loader 升级 | C5 内含数据创作 + Loader 升级 |
| R5 镜头未跟随 | 中 | F9：关宽 > 逻辑宽，不跟随之看不到全程 | C5 加 follow-camera，钳制边界 |
| R6 路径假设偏差 | 低 | `src/game/input/` 不存在，抽象层在 `src/core/input/` | 已纠正，无需新建 |
| R7 手感在集成态失真 | 低 | 同步协议若拷贝顺序错会扭曲 §1 指标 | C2 集成测试兜底 |

---

## 5. 建议推进顺序（供主理人拍板）
1. **最先做 C1 + R2(Web attach)**：C1 是头号技术问题（跳跃没接上），Web attach 是一行可立即修的阻断项，二者并行可在最短时间让"输入→可见跳跃"在双端成立。
2. **随后 C4 验证双端 + C2 手感验证**：确认 core 逻辑在真实链路下指标达标（§1 卡点）。
3. **C3 受伤管线 + C5 单关闭环** 并行推进。
4. **QA** 收口：手感 smoke + 微信真机复验。

> 注：本文件为拆分与方案，**不含实现代码**；代码实现待主理人确认方案后启动。
