# super-mali · Sprint 3 接入技术方案

> 配套：`production/sprint-03/epics.md`（Story 拆分）
> 作者：程基岩（engineering-lead）
> 范围：**只做拆分 + 方案 + 风险评估，不含实现代码**。代码实现待主理人确认后启动。

---

## 0. 铁律与基线（不可违反）

1. **`src/core/` 零平台 API**：静态扫描 0 命中 `wx` / `keyboard` / `touch` / `localStorage` / `AudioContext`（control-list §4 第1项）。任何平台相关代码落 `src/platform/` 或 `src/game/`。
2. **固定步长 60Hz（ADR-005）**：所有 ms 计时器（coyote / jumpBuffer / 无敌帧 / 击退 hitstun）以 `simTimeMs` 为准；输入在固定步内采样。
3. **controller 只设 vx/vy，不积分位置、不施加重力**（character-controller.ts 注释铁律）：重力与位置积分由 `stepBody` 负责。
4. **手感 §1 卡点**：10 项手感指标达标方可铺关卡内容；集成态不得扭曲单测已通过的指标。
5. **双端一致（control-list §4）**：Web 键盘与微信触屏必须产出**完全相同**的 `InputState` 序列。

---

## 1. 核心问题：body 与 controller.state 双对象失同步

当前 `game-scene.ts` 虽调用了 `controller.consume(input, dt)`，但**controller 的输出被架空**：

```
game-scene.ts: stepSim(dt)
  frame   = platform.input.sample()
  input   = abstraction.sample(frame, simTimeMs)
  controller.consume(input, dt)          // (A) 写入 controller.state.vx / .vy（含跳跃 vy）
  this.body.vx = (input.right?MOVE_SPEED:0) - (input.left?MOVE_SPEED:0)  // (B) 占位覆盖！丢弃 (A) 的水平结果
  res = stepBody(this.body, dt, world)   // (C) 只积分 body.vx/vy —— controller.state.vy 从未进入 body
  controller.state.grounded = res.grounded || isGrounded(...)  // (D) grounded 在 consume 之后才写，滞后 1 帧
```

**后果**：
- 水平移动用的是占位常量 `MOVE_SPEED=90`，**controller 的加速/摩擦/朝向逻辑完全没生效**（F1）。
- 跳跃时 `controller.state.vy = -480` 写进 controller，**但 body.vy 始终是 0（仅受重力）** → 角色**根本跳不起来**（F2）。
- `consume()` 用的 `grounded` 是上一帧值（F3）。

**根因**：`Body`（`x,y,w,h,vx,vy`）与 `CharacterState`（多了 `grounded/facing/coyoteTimer/jumpBufferTimer/airJumpsLeft/sizeScale`）是**两套独立内存**。controller 在自有 state 上算速度，而真正被 `stepBody` 积分的是 `body`。二者之间没有同步桥。

---

## 2. 同步协议（C1 的核心，stepSim 改造）

**设计原则**：保留现有 `consume(input, dt)` 签名与全部单测（不改动 `core/`），在场景层建立**每固定步的双向同步桥**，让 controller 算出的速度回灌给 `body`，物理结果回灌给 controller。

### 2.1 字段映射表
| 方向 | 源 → 目标 | 字段 | 时机 |
|---|---|---|---|
| in | `body.vx` → `controller.state.vx` | 水平速度连续性 | consume **前** |
| in | `body.vy` → `controller.state.vy` | 跳跃/重力后速度连续性 | consume **前** |
| in | `lastGrounded` → `controller.state.grounded` | 着地状态（去滞后） | consume **前** |
| in | `damage.sizeScale` → `controller.state.sizeScale` | 形态缩放 | consume **前**（C3） |
| out | `controller.state.vx` → `body.vx` | 加速/摩擦/跳跃水平 | stepBody **前** |
| out | `controller.state.vy` → `body.vy` | 跳跃竖直 | stepBody **前** |
| out | `body.x/y` → `controller.state.x/y` | 位置一致性（朝向/调试） | stepBody **后** |
| out | `res.grounded` → `lastGrounded` | 供下一帧 in | stepBody **后** |
| out | `damage.sizeScale` → `body.h` | 碰撞盒随形态缩放 | stepBody **前**（C3） |

### 2.2 新 stepSim 顺序（伪代码，非实现）
```
stepSim(dt, simTimeMs):
  // —— 1. 同步 in（让 controller 看到当前真实状态）——
  controller.state.vx = body.vx
  controller.state.vy = body.vy
  controller.state.grounded = lastGrounded
  controller.state.sizeScale = damage.sizeScale        // C3
  body.h = BASE_H * damage.sizeScale                    // C3：碰撞盒随形态

  // —— 2. 受伤状态机 tick（C3）——
  damage.update(dt * 1000)                              // 无敌帧衰减
  if hitstunTimer > 0: hitstunTimer -= dt*1000; input = NEUTRAL_INPUT   // 击退期间吞掉方向
  // （hitstun 由碰撞回调 set，见 §5）

  // —— 3. controller 消费输入，算出 vx/vy ——
  controller.consume(input, dt)

  // —— 4. 同步 out（把算出的速度灌回 body）——
  body.vx = controller.state.vx
  body.vy = controller.state.vy

  // —— 5. 物理积分 + 碰撞解算 ——
  res = stepBody(body, dt, world)

  // —— 6. 同步 out（位置/着地回灌）——
  controller.state.x = body.x
  controller.state.y = body.y
  lastGrounded = res.grounded

  // —— 7. 落地边沿（可选 juice）——
  if (!prevGrounded && res.grounded) events.emit(ON_LAND)

  // —— 8. 碰撞/伤害/终点回调（C3/C5）——
  resolveHazards()     // → damage.hit() + 击退（§5）
  resolveGoal()        // → ON_LEVEL_COMPLETE（§6）
```

**为什么在 consume 前注入 grounded（而非沿用当前的"consume 后写"）**：原地消除 F3 的 1 帧滞后，使 coyote/buffer 在集成态下与单测语义完全一致（单测是手动写 `state.grounded` 后立刻 consume）。

**为什么不把 controller 和 body 合并为同一个对象**：现有 `consume` 单测依赖独立 `CharacterState`，合并需改 `core/` 与全部测试，风险高；同步桥改动仅限 `game/`，符合"core 已锁"的现状。合并列为**未来重构候选**（不在 Sprint 3）。

---

## 3. game-scene.ts 改造清单（C1）

| 项 | 动作 |
|---|---|
| 删除 | 本地 `const MOVE_SPEED = 90`（game-scene.ts:26）及 `stepSim` 中的 `body.vx = 占位` 覆盖（:95） |
| 删除 | `FLOOR_ROW` 硬编码地板 world（:50-56）—— 由 C5 的 `LevelLoader` 产出真实 world 替代；C1 阶段可暂用最小地板 world 验证驱动 |
| 新增 | `lastGrounded: boolean` 字段（初始 true） |
| 新增 | `stepSim` 按 §2.2 顺序重写（同步桥 + 调用，不内联占位物理） |
| 保留 | `FixedStep` 调用、`abstraction.sample`、Sprite 绘制（`body.x/y` 驱动） |
| 保留 | 微信 `TouchButtons` 挂载、`type: Phaser.CANVAS` / `Scale.NONE` 等 R2 既有修复**一字不改**（在 `main.ts`，不归本 Sprint 改） |

> 验收即对 `epics.md` C1 的勾选项 + `core/**` 静态扫描 0 平台命中。

---

## 4. 输入映射：物理信号 → consume() 所需 InputState

`consume()` 需要的 `InputState`（已定义于 `core/input/input-abstraction.ts`）：
```
{ left, right, jumpPressed, jumpHeld, jumpReleased,
  actionPressed, actionHeld, actionReleased, jumpPressedAt }
```

**映射链（双端同源）**：
```
平台原始事件 → RawInputProvider.sample() → RawInputFrame{down, pressedEdge, releasedEdge}
             → InputAbstraction.sample(frame, simTimeMs) → InputState
             → controller.consume(input, dt)
```
- **Web**：`WebKeyboardProvider` 产出 `RawInputFrame`（signal = `KeyboardEvent.code`）；`webInputConfig` 映射 `left:['ArrowLeft','KeyA']` 等。
- **微信**：`WechatTouchProvider` 产出 `RawInputFrame`（signal = `touch:left/right/jump/action`）；`wechatInputConfig` 映射 `left:['touch:left']` 等；`TouchButtons` 仅视觉。
- **`jumpPressedAt`**：由 `InputAbstraction.sample` 在 `jumpPressed` 时填入 `simTimeMs`（固定步时钟），精度 ≤16.67ms，满足 §4 第4项。

**C4 必做修复（F4）**：`createWebPlatform()` 当前只 `new WebKeyboardProvider()`，**未调用 `.attach()`**，导致 DOM 监听不绑定、Web 键盘全失效。修复：在 `createWebPlatform` 内 `input.attach()`，或改为构造即绑定（二选一，一行级改动，落在 `src/platform/web/`）。

**范围澄清**：MVP 为**离散四按钮**（左/右/跳/动作），非虚拟摇杆；"摇杆"若主理人后续要求，列为增强，不在 C4。

---

## 5. 受伤状态机接入（C3）

### 5.1 接线点
- **实例化**：场景 `create` 内 `new DamageStateMachine(initialLives, damageConfig)`（`initialLives` 来自 `economyConfig.initialLives`，C5 经济接入前先用常量 3）。
- **每固定步 tick**：`stepSim` 第 2 步 `damage.update(dt*1000)` 衰减无敌帧。
- **碰撞回调 `resolveHazards()`**：当玩家 AABB 与某 `HazardSource` 重叠且 `damage.invincibleTimer<=0` → `damage.hit()` + 施加击退 + 设 `hitstunTimer` + 发 `ON_HURT`；若 `damage.isGameOver` → 发 `ON_GAME_OVER`。

### 5.2 伤害源接口（新增于 `core/damage/`，纯逻辑）
```
interface HazardSource {
  overlaps(body: Body): boolean
  knockbackDir(body: Body): 1 | -1      // 远离源的方向
  isStompable: boolean                   // 顶踩是否消灭（未来 E3 用）
}
```
C3 用**占位 hazard**（如 `game/debug/placeholder-hazard.ts` 单只静态刺栗）验证 FULL→SMALL→DEAD→重生 全链路；真实敌人（E3）后续实现该接口即可复用，不返工。

### 5.3 击退与 controller 的协同（R3 设计）
- controller 当前**无 hitstun API**；若击退仅写 `body.vx` 而仍每帧 `consume()`，下一帧 controller 用 `approach(vx, dir*moveSpeed, friction*dt)` 会把击退速度快速摩擦归零（friction 1600 → ~0.15s 停），击退感被吃掉。
- **方案**：命中时设 `hitstunTimer`（建议 200–300ms，来自 config），`stepSim` 第 2 步若 `hitstunTimer>0` 则把 `input` 替换为"中性输入"（无方向、无跳），并**跳过 `controller.consume`**（§2.2 注释处）。此时 `body` 仅由 `stepBody` 积分击退冲量（重力 + 阻尼），击退干净可见；hitstun 结束后恢复正常 consume。
- `sizeScale`：受伤变 `SMALL` 时 `body.h = BASE_H * 0.6`，并把 `body.y` 下推 `(oldH-newH)` 保持脚底贴地，避免瞬沉。

---

## 6. 关卡系统接入（C5）

### 6.1 数据
- `1-1.json` 当前 `tiles:[]`。需补真实关卡：地面实心行 + 若干悬浮平台/缺口 + 出生点（`spawn` 或沿用首个可站立点）+ 凯旋之门（`goal` 已有坐标 `(1184,160)`）。
- 拓扑与难度不在本方案细化（属设计/美术），但 Loader 接口需先定。

### 6.2 Loader 升级（`core/level/level-loader.ts`）
- 由 `tiles: TileDef[]` 构建 `CollisionWorld`：`isSolidTile(tx,ty)` 查 tile 网格；`isOneWayTile` 按 kind 判定。
- 产出 `RuntimeLevel { world: CollisionWorld, spawn: {x,y}, goal: AABB, entities: EntityDef[] }`。
- `level-data.ts` 校验已够用（`validateLevelData`），可扩展 tile 数量/范围校验。

### 6.3 场景改造
- `create`：用 `LevelLoader.load(level1_1)` 建 `RuntimeLevel`；`this.world = runtime.world`；`body`/`controller` 初始化到 `spawn`（替换写死的 `64, FLOOR_ROW*TILE-34`）。
- 新增 `follow-camera.ts`：`camera.startFollow(sprite)` 或手动 `scrollX = clamp(player.x - LOGICAL_WIDTH/2, 0, levelWidth - LOGICAL_WIDTH)`（关宽 1280 > 512，F9）。
- `resolveGoal()`：每步检测 `body` AABB 与 `goal` AABB 重叠 → 发 `ON_LEVEL_COMPLETE`（C5 闭环，即便无敌人也可达）。

### 6.4 风险
- R4：地图为空 → C5 内需先创作 `1-1.json` 真实数据（设计协作）。
- R5：无镜头 → 必须加 follow-camera，否则看不到全程。

---

## 7. 风险与依赖阻塞汇总

| ID | 风险 | 等级 | 阻塞点 | 缓解（归属 Story） |
|---|---|---|---|---|
| R1 | body/controller 失同步，跳跃没接上 | 高 | C1 | §2 同步桥 |
| R2 | Web 键盘 `attach()` 未调用 | 高（易修） | C4 / 阻断 Web 路径 | 一行修复，与 C1 并行 |
| R3 | 击退被 controller 摩擦吃掉 | 中 | C3 | §5.3 hitstun 跳过 consume |
| R4 | 关卡/Loader 为空 | 中 | C5 | C5 内含数据 + Loader 升级 |
| R5 | 镜头未跟随 | 中 | C5 | follow-camera 钳制边界 |
| R6 | `src/game/input/` 路径假设偏差 | 低 | 无 | 抽象层在 `src/core/input/`，已纠正 |
| R7 | 集成态手感失真 | 低 | C2 | §2 拷贝顺序 + 集成测试兜底 |
| R8 | 微信触屏真机未复验 | 中 | QA | QA 真机复验清单 |

**依赖阻塞图**：`C1` 是唯一硬前置；`C4` 的 Web attach 修复**零依赖**可立即做；`C3/C5` 在 C1 后并行；`QA` 收口。

---

## 8. 待主理人确认的决策点（ADR 候选）

1. **同步桥 vs 合并对象**：本方案选**同步桥**（改 `game/`，不动 `core/` 与既有单测）。若主理人倾向"controller 直接操作 Body"的合并方案，需额外评估测试改动成本 → 建议列为未来重构，不进 Sprint 3。
2. **击退 hitstun 时长与跳过 consume 策略**：默认 200–300ms（config 化）；是否接受"hitstun 期间跳过 consume"（最简单、击退最干净）？备选：controller 内增 `stun` 字段（需改 core）。倾向前者。
3. **C5 关卡数据归属**：`1-1.json` 真实地图由谁产出（设计/美术协作）？本方案只定义 Loader 接口，地图内容需主理人排期。
4. **MVP 输入形态**：确认离散四按钮（已落 `input-config.wechat.buttons`），"虚拟摇杆"不进 MVP。
5. **C3 是否需真敌人**：本方案用占位 hazard 验证管线，真实 4 敌留 E3；若主理人希望 Sprint 3 就含 1 只可踩敌（刺栗）以更真实验证，可把 E3.S1 的刺栗前移——但属范围扩张，需确认。

> 以上决策确认后，方可启动 `epics.md` 各 Story 的代码实现。
