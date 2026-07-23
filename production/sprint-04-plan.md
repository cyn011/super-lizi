# super-mali · Sprint 04–06 计划（Phase 4 预制作收尾 + 垂直切片）

> 阶段：Phase 4 预制作 · 汇编交付（主理人 游承峰 编排输入之一）
> 作者：程基岩（engineering-lead / 技术方向·主程）
> 输入：`production/epics.md`、`production/testing.md`、`production/sprint-01-plan.md`、`production/sprint-02-plan.md`、`production/sprint-03/{epics,integration-plan}.md`、`docs/architecture/{architecture,control-list}.md` + `adr/ADR-001..005`、`docs/phase-gates/*`、`design/gdd/*`、`art/asset-manifest.md`
> 衔接：Sprint 1–3 已收口（E1 脚手架+双端+黑屏 / E2 手感 / C1–C5 主场景接入与单关闭环）。本文件覆盖剩余 E3·E4(E4.S1 收尾)·E4.S2·E4.S3·E5·E6·E7·E8，落到 Sprint 04/05/06。
> 性质：**只写计划与验收，不写代码**（lean 冲刺 brief）。

---

## 0. 本计划定位 + 代码审计修正（务必先读）

### 0.1 与既有 Sprint 计划的关系
- **Sprint 1**（解风险）：E1.S1–S4 + E2.S1/S2 → ✅ 收口（质量门 PASS/条件）。
- **Sprint 2**（手感）：E2.S3/S4/S5 → ✅ 收口（§1 手感 10 项达标）。
- **Sprint 3**（内容闭环 C1–C5）：同步协议 C1 / 手感集成 C2 / 受伤接入 C3 / 双端输入 C4 / 单关闭环 C5 / QA → ✅ 代码已落盘（已 git 提交），但**未走正式 Sprint 3 质量门**（见 §0.3 偏差②）。
- **本计划 Sprint 04/05/06**：把"已能跑通空关"升级为"含真实 4 敌 + 真实经济 + 暂停结算 + 存档音频 + 双端门禁"的可玩垂直切片，过 Phase 4 → 5 质量门。

### 0.2 代码审计修正（基于 `src/` 实际，非 epics 想当然）
主理人 brief 给出的"当前水位"与磁盘真实代码存在**关键偏差**，下表以实际代码为准（已逐一读证）：

| # | 模块 | brief 假设 | **实际代码（已读证）** | 对计划影响 |
|---|---|---|---|---|
| A1 | **E4.S1 关卡加载** | "硬编码占位关卡，未落地" | **已落地**：`level-loader.ts`+`level-runtime.ts` 由真实 `1-1.json` 构建 `CollisionWorld`（实心/单向/封边）+ 出生点 + 凯旋之门 AABB + follow-camera + 终点检测；`1-1.json` 含真实瓦片/平台/墙/出生点/终点 | Sprint 04 的"真实关卡加载"收窄为**实体/道具生成 + 检查点**（loader/runtime 不再做） |
| A2 | **C3 受伤管线** | "含占位刺栗验证" | **已落地**：`damage-resolution.ts`+`hazard-source.ts`+`placeholder-hazard.ts`；FULL→SMALL→DEAD→重生+击退+无敌帧+GameOver 全链路接好 | 敌人真实化只需替换"占位 hazard"为 `EnemyAI` 驱动实体 |
| A3 | **E5.S1 HUD** | "部分 HUD（命数/形态/受击闪红/无敌闪烁/重生淡入/Game Over 覆盖层）" | **已落地且较完整**：`ui/hud.ts`+`ui/hud-hearts.ts` 已实现命数爱心+形态+受击闪红+无敌闪烁+重生淡入+GameOver 覆盖层+跨端重试；**缺 score/coins/progress/timer 显示**（因经济未接） | Sprint 04 仅补"经济数值显示"，不重做 HUD 框架 |
| A4 | **E7 手势** | "手势替代触屏按钮（已做）" | **已落地**：`platform/gesture-provider.ts`（相对栗宝手势，双态 Tap/Hold、双指暂停、仿真时钟驱动）+ game-scene 路由 | Sprint 05 的 E7 仅剩"深适配"（存储/音频流/生命周期），手势不做 |
| A5 | **E3 四敌** | "未落地" | **确认未落地**：`enemy-ai.ts` 为 `step()` 空 TODO 占位；`enemy-types.ts` 类型已定义 | Sprint 04 重点 |
| A6 | **E4.S2 经济** | "未落地" | **确认未落地**：`economy.ts` `addScore()` 为空 TODO；`economy-config.json` 参数齐备 | Sprint 04 重点 |
| A7 | **E4.S3 节拍** | "仅预留" | **模块已写**：`beat-clock.ts`（`BeatClock`/`crossedBeat`/`getBeat` 完成），但**未接入** game-scene step；事件 `ON_BEAT` 已定义未发射 | Sprint 05 仅"接入 + 门控验证" |
| A8 | **E5.S2 暂停/结算** | "未落地" | **确认未落地**：无 `pause-menu.ts`/`result-screen.ts`；game-scene 发射 `ON_PAUSE`（双指手势）但**无处理器**；`ON_LEVEL_COMPLETE` 仅发未结算 | Sprint 05 重点 |
| A9 | **E5.S3 元循环** | "未落地" | **核心模型已写**：`save-data.ts` `SaveManager`+`StoragePort`；平台 `wechat-storage.ts`/`web-storage.ts` 已存在；但**未接 ON_LEVEL_COMPLETE→持久化** | Sprint 05 仅"接线" |
| A10 | **E6 音频** | "仅事件总线待接" | **确认未落地**：无 `game/audio/audio-bus.ts`；平台 `web-audio.ts`/`wechat-audio.ts` 端口已存在但未订阅事件；`audio-config.json` 已备 | Sprint 05 重点 |
| A11 | **实体/道具渲染** | — | **无 `render/entity-view.ts`**：敌人/coin 渲染为新增（先用 Graphics 占位，对齐 `art/asset-manifest.md` §4 P0 占位策略，atlas 换皮留 E8/S06 或 Phase 5） | Sprint 04 实体故事含占位渲染 |

### 0.3 偏差与开放问题登记（主理人需在汇编/执行前知悉）
1. **实体 schema 漂移**：`level-data.ts` 实际 `EntityDef{type,x,y}` / `PropDef{type,x,y}`（无 `id`/`params`）；而 GDD 05 §6 示例为 `{id,type,x,y,params}`。且 `validateLevelData` **不校验** entities/props/checkpoints。→ S04-实体故事须对齐 schema 并补校验。
2. **Sprint 3 质量门未正式走**：C1–C5 已落盘但未出 `sprint-03-quality-gate.md`。→ 建议在 Sprint 04 启动前由主理人补一份 Sprint 3 收口门（或并入 Phase 4 总门），确认"主场景接入 + 单关闭环"达标（§1 卡点前置）。
3. **短跳系数偏差**：`shortHopCut=0.7`（epics 原写 `0.5`），已裁决按 control-list §1（45–55%）。记入此处，Phase 5 资产/手感复核时复核。
4. **检查点未实现**：`1-1.json` `checkpoints:[]`，game-scene 仅用固定 `spawn` 重生。GDD 05 标记 checkpoints 为 Must。→ 单关 MVP 可由 spawn-only 重生兜底，S04-实体故事补"checkpoint 触碰更新重生点"为低成本的 Must 收口。
5. **资产仍占位 Graphics**：`art/asset-manifest.md` 仅规格、未绘正式像素；IP 红线（control-list §3）的"资产审查"项依赖 art-director 产出合规占位/正式资产。→ E8.S2 命名扫描可先跑，资产人工复核项须 art-director 就绪。
6. **双 agent 同名交付冲突**（Sprint 2 过程风险）：每个 Story 必须指定**唯一执行 agent**，禁止两 agent 写同名文件（sprint-02 质量门 C6）。
7. **R2 真机复验仍 open**：Sprint 2 质量门 C1（微信 shim 注入后缺真机红错复验）未关闭。→ 由 S06-双端回归承接，不阻塞 Sprint 04/05。

---

## 1. Sprint 04 — 内容生产基础（E3 四敌 + E4.S1 实体生成 + E4.S2 经济 + HUD 经济收尾）

> **目标**：让关卡从"空跑"变"有内容"——真实 4 敌可踩/可伤、真实经济计分连击、HUD 显分数金币、从关卡 JSON 生成实体。打通"内容生产"基础：**设计师/美术只需往 `levels/*.json` 丢实体，即可出现并行为正确**。

### 1.1 Story 清单（对齐 epics.md E3/E4/E5）

| Story ID | Epic | 优先级 | 验收要点（引用 control-list） | 主要产出 | 依赖 |
|---|---|---|---|---|---|
| **S04-1** | E3.S1 | P0 | 刺栗巡逻/边缘·墙掉头/可踩死；嘟浮浮动/可踩死；可踩判定 `stompable && v.y>0 && 底触敌顶` | `enemy-ai.ts` 填充、扩展 `enemy-types.ts`、敌人单测、Graphics 占位渲染 | E2.S1/S3（已 done） |
| **S04-2** | E3.S2 | P0 | 冲锋怪 detect→charge→wallHit(stun)→idle，踩则伤；石炮 aim→fire→cooldown 弹丸 hazard；4 类可踩判定正确 | `enemy-ai.ts` 续、弹丸状态、`enemy` 单测 | S04-1 |
| **S04-3** | E4.S1(收尾) | P0 | 从 `level.entities[]/props[]` 实例化敌人+coin；玩家↔实体碰撞解算（复用 C3 管线）；替换 `PlaceholderHazard`；schema 对齐+补校验；checkpoint 重生 | 实体/道具生成器、`render` 占位、扩展 `level-data` 校验、game-scene 接线 | S04-1/S04-2、S04-4 |
| **S04-4** | E4.S2 | P0 | 踩怪+100/币+10/通关+500、连击窗1500ms 封顶×4、lives--；发 `ON_STOMP/ON_COIN/ON_SCORE/ON_LIFE_LOST` | `economy.ts` 实装、`economy` 单测 | E1.S3（事件总线，已 done） |
| **S04-5** | E5.S1(收尾) | P1 | HUD 显 score/coins/progress(随玩家x)/timer；实时反映 Economy | 扩展 `ui/hud.ts` | S04-4 |

### 1.2 逐 Story 验收标准 + 依赖

**S04-1 · E3.S1 可踩敌人（刺栗 ci_li + 嘟浮 du_fu）**
- [ ] 刺栗：左右巡逻 `speed=40`（取 `enemy-config.ci_li.speed`）；前方无地面（边缘检测）或撞墙掉头；`stompable=true`；被踩→`dead`+发 `ON_ENEMY_DEATH`+`ON_STOMP`。
- [ ] 嘟浮：原地/正弦浮动 `float=60, amp=24`（取 `enemy-config.du_fu`）；`stompable=true`；可踩死。
- [ ] 可踩判定三条件齐全：`enemy.stompable && body.vy>0 && 角色底触敌顶`（与 `character-controller` 踩踏反弹 −300 协作，control-list §1 踩踏反弹项）。
- [ ] 表驱动状态机（不膨胀）；`tests/unit/enemy/enemy-ai.test.ts` 覆盖 4 类判定与边缘/墙掉头。
- [ ] core 零平台 API（§4 第1项）；数值全来自 `enemy-config.json`，零硬编码。
- [ ] 占位 Graphics 渲染（功能色：刺栗警示红 `#E8483B`、嘟浮蓝紫 `#6E7BF2`，带 `#2A1A12` 描边，对齐 asset-manifest §4 P0），不入 atlas（atlas 换皮留 E8）。
- 依赖：无（E2.S1/S3 已 done）；可与 S04-2、S04-4 并行启动。

**S04-2 · E3.S2 不可踩敌人 + 弹丸（冲锋怪 chong_feng + 石炮 shi_pao）**
- [ ] 冲锋怪：idle→detect（`detect=160` 内且高度差 `<48`）→charge（`charge=220` 直线）→wallHit（撞墙 `stun=1000ms` 回 idle）；`stompable=false`；**踩它→玩家受伤**（非消灭），与踩踏互斥。
- [ ] 冲锋怪 stun 期 `non-hazard`（可被安全越过）——GDD 资产规格 §3.3。
- [ ] 石炮：每 `fire=2000ms` aim 朝玩家→fire 发射弹丸（`proj=180`，独立 hazard 实体）→cooldown；`stompable=false`。
- [ ] 弹丸：`ProjectileState` 独立推进；碰玩家→`ON_ENEMY_HIT_PLAYER`（受伤）；越界/超时回收。
- [ ] 4 类可踩判定总校验：刺栗/嘟浮 顶踩死；冲锋/石炮 踩则伤。
- [ ] `tests/unit/enemy/enemy-ai.test.ts` 续覆盖；core 零平台 API。
- 依赖：S04-1（共用 `enemy-ai` 表驱动骨架）。

**S04-3 · E4.S1 实体/道具生成管线 + 检查点（从 JSON 实例化）**
- [ ] `RuntimeLevel.entities`（实际 schema `{type,x,y}`）在 game-scene `create` 中实例化为 `EnemyState[]`；每固定步 `EnemyAI.step(enemies, projectiles, dt)` 驱动；渲染（占位 Graphics）+ 与玩家 AABB 碰撞解算。
- [ ] **替换** game-scene 中的静态 `PlaceholderHazard`（C3 管线验证物），真实敌人经同一 `damage-resolution`/接触解算路径：可踩→`ON_STOMP`+踩踏反弹；不可踩→`ON_ENEMY_HIT_PLAYER`+击退（复用 C3 hitstun 跳过 consume 机制）。
- [ ] 道具生成（经济内容源最小集）：`props[]` 中 `coin` 实例化为可拾取物，碰玩家→`ON_COIN`（+10，联动 S04-4）。`heart`/`interactive_block`（顶砖出道具）归 Could/Phase 5（避免 S04 膨胀）。
- [ ] **schema 对齐**：`level-data.ts` `EntityDef/PropDef` 与 GDD 05 §6 对齐（建议补全 `id`/`params?` 可选字段以兼容未来）；`validateLevelData` 增加 entities/props/checkpoints 结构校验（至少非空/字段类型）。
- [ ] **检查点**：`checkpoints[]` 触碰→更新 `respawnPoint` 并发 `ON_CHECKPOINT`；死亡重生落最近 checkpoint（GDD 05 Must）；`1-1.json` 至少补 1 个 checkpoint 验证。
- [ ] 单测：`tests/unit/level/level-loader.test.ts` 扩"实体/道具/检查点解析"；集成测试 `tests/integration/` 补"敌人生成→碰撞→受伤"端到端。
- 依赖：S04-1/S04-2（敌人行为）、S04-4（币计分）；建议最后做以串联。

**S04-4 · E4.S2 经济/分数（真实实现）**
- [ ] `Economy` 订阅/响应事件：`ON_STOMP`+100、`ON_COIN`+10、到达 goal+500（由 S05-结算或 game-scene 转发 `ON_LEVEL_COMPLETE`→+500）。
- [ ] 连击：`comboWindowMs=1500` 内连续踩怪 `combo++`，`mult=min(1+0.5*(combo-1),4)`，`score+=base*mult`；窗超时清零（仅踩怪计入）。
- [ ] 生命：`lives` 初始 `initialLives=3`；`ON_LIFE_LOST`（SMALL→死亡）`lives--`；`0`→`ON_GAME_OVER`（与 C3/E2.S4 联动，已接 game-scene）。
- [ ] `tests/unit/economy/economy.test.ts` 覆盖计分/连击封顶/生命递减；core 零平台 API。
- [ ] 数值全取自 `economy-config.json`，零硬编码。
- 依赖：无（事件总线已 done）；可与 S04-1/S04-2 并行。

**S04-5 · E5.S1 HUD 经济显示收尾**
- [ ] `ui/hud.ts` 扩展显示：`score`、`coins`、`progress`（随玩家 x / 关卡宽，GDD 08 §7）、`timer`（仿真时钟累计，暂停停走）。
- [ ] 中文系统字体 ≥14px 等效（美术圣经 §7.1 / control-list §3 无 CJK 像素字）；HUD 实时反映 Economy/Damage/Level。
- [ ] 不持有游戏状态（架构铁律：ui 只订阅 core 事件/读 state）；保持 `getDamage()` getter 防过期实例陷阱（已立）。
- 依赖：S04-4（EconomyState 字段）。

### 1.3 Sprint 04 出口门（主理人卡点）
- `npm test`（`tests/unit/enemy`+`economy`+`level` 扩）全绿；`tsc --noEmit` 0 错。
- `grep src/core` 零平台 API（§4 第1项）。
- 双端（Web+微信）此关：出生→踩敌/吃币/受伤重生→凯旋之门 可跑通，HUD 显 命数/形态/分数/金币/进度。
- 不达标不得进 Sprint 05（§1 手感已前置达标，本门聚焦"内容正确性"）。

### 1.4 依赖顺序
```
S04-1(E3.S1) ─┐
S04-4(E4.S2) ─┼─（并行）─▶ S04-3(E4.S1实体) ─▶ S04-5(E5.S1b)
S04-2(E3.S2) ─┘（依赖 S04-1）
关键路径：S04-1 → S04-2 → S04-3 → S04-5；S04-4 可全程并行。
```

---

## 2. Sprint 05 — 系统闭环（E4.S3 节拍 + E5.S2 暂停结算 + E5.S3 元循环 + E6 音频 + E7 深适配）

> **目标**：把"可玩关卡"升级为"完整游戏循环"——暂停/结算星级、存档解锁下一关、音频占位与解锁、微信深适配（存储/音频流/生命周期）。

### 2.1 Story 清单

| Story ID | Epic | 优先级 | 验收要点（引用 control-list） | 主要产出 | 依赖 |
|---|---|---|---|---|---|
| **S05-1** | E4.S3 | P2 | `BeatClock` 接入 game-scene step；`enabled:false` 不驱动机制；`getBeat`/`crossedBeat` 正确 | game-scene 接入 `beat-clock`、`tests/unit/beat` 续 | E4.S1（已 done） |
| **S05-2** | E5.S2 | P0 | `ON_PAUSE`→遮罩+继续/重玩；凯旋之门通关→结算+星级（时间50%/金币收集率50%）；RunState 机 BOOT→MENU→PLAYING⇄PAUSED→LEVEL_COMPLETE/GAME_OVER | `ui/pause-menu.ts`、`ui/result-screen.ts`、`core/state/run-state-machine.ts` 接线 | S04-3/E4.S1、S04-5 |
| **S05-3** | E5.S3 | P1 | `ON_LEVEL_COMPLETE`→`SaveManager.save`（解锁下一关+星+最佳时间）；boot 时 `load`；双端存储可用 | game-scene/SaveManager 接线、`tests/unit/meta` 续 | S04-3、S05-2 |
| **S05-4** | E6.S1 | P1 | 9 `SfxName` 占位不崩；WebAudio 合成短音（零文件）；微信远程流式（music 不进包）；首次交互解锁（§4 第7项） | `game/audio/audio-bus.ts`、订阅 EventBus | E1.S3（事件总线） |
| **S05-5** | E7.S1/S2/S3 | P1 | 微信 `setStorageSync` 接线（S05-3 用）；音频流接线（S05-4 用）；`wx.onHide/onShow`→暂停/恢复且输入连续（§4 第5项） | `platform/wechat/*` 接线、lifecycle 钩子 | S05-2/S05-3/S05-4 |

### 2.2 逐 Story 验收标准 + 依赖

**S05-1 · E4.S3 节拍时钟接入**
- [ ] game-scene `stepSim` 每固定步调 `BeatClock.crossedBeat(simTimeMs)`；`enabled:true`（测试态）时发 `ON_BEAT`；`enabled:false`（MVP 默认）时**不驱动任何机制**、不影响运行。
- [ ] `tests/unit/beat/beat-clock.test.ts` 验证：`getBeat` 随 `simTimeMs` 递增、`crossedBeat` 边界、`enabled:false` 全程 0 触发、`tracks` 扩展兼容（不破 05 schema）。
- 依赖：无（模块已写）；可与 S05-2 并行。

**S05-2 · E5.S2 暂停 + 结算 + RunState 机**
- [ ] 暂停：`ON_PAUSE`（双指手势/专用键/微信 onHide）→ 遮罩 + 大圆角按钮（继续/重玩），仿真冻结、输入不丢。
- [ ] 结算：`ON_LEVEL_COMPLETE`→凯旋之门通关动画 + 星级（时间维度 50% + 金币收集率 50%，A4 已拍板）；失败温柔提示（A3：极简"再试一次"）。
- [ ] `RunStateMachine`（架构 §6.2 已定义于 `core/state/run-state-machine.ts`，需接线）：`PLAYING⇄PAUSED`、`LEVEL_COMPLETE`/`GAME_OVER` 流转；与实体 `DamageState` 正交（互不写）。
- [ ] 微信 `onHide` 自动暂停（联动 S05-5 lifecycle）。
- [ ] 按钮热区 ≥48×48（§9.2 / control-list §4 第3项）；中文 ≥14px。
- 依赖：S04-3（关卡 complete）、S04-5（HUD 基础）；RunState 机为架构级，先接线不重写。

**S05-3 · E5.S3 元循环存档接入**
- [ ] `ON_LEVEL_COMPLETE`→`SaveManager.save`：解锁下一关（`unlockedLevels`）、记录 `stars`（S05-2 星级）、`bestTimes`（S05-2 计时）。
- [ ] 启动/进入关卡前 `load` 存档，决定解锁态；双端存储可用（Web `localStorage` / 微信 `wx.setStorageSync`，§4 第8项）。
- [ ] `tests/unit/meta/save-data.test.ts` 用 `StoragePort` 注入桩验证读写一致。
- 依赖：S05-2（结算产出星/时间）、S04-3；存储端口已就绪（E7.S1 接线由本 Story 与 S05-5 协作）。

**S05-4 · E6 音频占位与解锁**
- [ ] `game/audio/audio-bus.ts` 订阅 `ON_JUMP/ON_DOUBLE_JUMP/ON_LAND/ON_STOMP/ON_ENEMY_DEATH/ON_HURT/ON_DEATH/ON_COIN/ON_LEVEL_COMPLETE` 等；`playSfx(name)` 枚举占位（静音/日志/合成）。
- [ ] 9 个 `SfxName` 枚举（GDD 09 §7）；资产就绪后无缝替换真实音效（结构不破）。
- [ ] 微信：`wx.createInnerAudioContext` 远程 URL 流式（music 不进包，§2 红线）；SFX WebAudio 振荡器合成（零文件）。
- [ ] 首次交互解锁 `AudioContext`（§4 第7项）：微信 `onTouchStart`/Web `click` 后 `unlockOnInteraction`。
- [ ] MVP 零音频文件进主包（ADR-004）。
- 依赖：事件总线（已 done）；可与 S05-1/2 并行。

**S05-5 · E7 微信深适配（存储/音频流/生命周期）**
- [ ] E7.S1 存储：确认 `wechat-storage.ts` 与 Web `localStorage` 接口对齐（S05-3 用），读写一致（§4 第8项）。
- [ ] E7.S2 音频流：`wechat-audio.ts` 远程 URL 流式接线（S05-4 用），不占主包。
- [ ] E7.S3 生命周期：`wx.onHide`→暂停仿真、`wx.onShow`→恢复；输入状态连续不丢（§4 第5项）；与 S05-2 暂停遮罩协同。
- 依赖：S05-2/S05-3/S05-4。

### 2.3 Sprint 05 出口门
- 单测全绿（beat/economy 续/meta 续/audio 占位）；core 零平台 API。
- 双端：暂停/结算/存档/音频解锁 在 Web+微信均可用；`enabled:false` 节拍不破运行。
- 微信 `onHide/onShow` 暂停/恢复输入连续（§4 第5项）。
- 不达标不得进 Sprint 06（垂直切片集成）。

### 2.4 依赖顺序
```
S05-1(E4.S3) ─┐
S05-4(E6) ────┼─（并行）─▶ S05-2(E5.S2) ─▶ S05-3(E5.S3) ─▶ S05-5(E7深)
S05-2 ────────┘
关键路径：S05-2 → S05-3 → S05-5；S05-1/S05-4 可全程并行。
```

---

## 3. Sprint 06 — 垂直切片收尾与发布准备（E8 + 质量门）

> **目标**：串联全系统跑通 1 关、过 IP/双端门、移交 release-ops。本 Sprint 以**集成 + 门禁 + 回归**为主，不新增系统机制。

### 3.1 Story 清单

| Story ID | Epic | 优先级 | 验收要点（引用 control-list） | 主要产出 | 依赖 |
|---|---|---|---|---|---|
| **S06-1** | E8.S1 | P0 | 单关可玩闭环（跑/跳/踩/顶/吃/抵达）无崩溃；§1 指标回归；headless 冒烟通过（testing.md §5） | 集成编排、`tests/smoke` 续、手感沙盒回归 | S04+S05 全部 |
| **S06-2** | E8.S2 | P0 | 命名扫描无 `mario/luigi/bowser/koopa/mushroom/star(道具)/pipe/flag/piranha` 等；资产审查钩子（art-director 责任） | CI 扫描脚本 + 资产审查清单 | 资产就绪（art-director） |
| **S06-3** | E8.S3 | P0 | §4 八项全跑（零平台分支/同手势同InputState/热区≥48px/jumpPressedAt/平台切换/仿真确定性/音频解锁/存储双端）；真机/模拟器手动回归报告 | 双端回归报告（手测+单测） | S06-1、R2 真机复验 |
| **S06-4** | 发布准备 | P1 | 主包 `≤2.7MB`（红线 4MB）；微信工程配置最后检查；构建脚本；文档 handoff（quality-lead/release-ops 接管） | 发布 checklist、构建核对 | S06-1/2/3 |

### 3.2 逐 Story 验收标准 + 依赖

**S06-1 · E8.S1 垂直切片集成**
- [ ] 串联全部系统跑通 1 关：手感（§1）+ 4 敌 + 检查点 + 凯旋之门 + HUD（含经济）+ 音频占位 + 存档。
- [ ] 手感沙盒 §1 指标全达标（回归，control-list §1 卡点）。
- [ ] headless 仿真冒烟通过（testing.md §5：`tests/smoke/headless-sim.test.ts` 同输入序列确定性、状态有界、无异常）。
- [ ] `core/**` 零平台 API 静态扫描 0 命中（CI）。
- 依赖：S04+S05 全部。

**S06-2 · E8.S2 IP 合规构建检查（control-list §3 红线）**
- [ ] 命名扫描（CI 步骤）：源码/配置/资源清单不含任天堂符号词（`mario/luigi/bowser/koopa/mushroom/star(道具)/pipe/flag/piranha` 等）；命中即阻断。
- [ ] 角色/敌人/终点/道具造型符合美术圣经 v1.1 红线（人工复核，art-director 责任）：栗宝无帽檐/背带裤/胡子/水管工轮廓；终点凯旋之门（非旗杆）；元气果（非蘑菇/星星）。
- [ ] 触发阻断回美术/设计修正（依据 99 §6 红线）。**注**：当前资产仍占位 Graphics（§0.3 偏差⑤），资产人工复核项须 art-director 在 Sprint 06 前产出合规占位/正式资产。
- 依赖：资产就绪（art-director）；扫描脚本可先行。

**S06-3 · E8.S3 双端一致性回归（control-list §4）**
- [ ] 八项全跑：①逻辑层零平台分支（CI 静态）②同手势→同 InputState（单测固化）③触屏热区≥48px（真机量测）④`jumpPressedAt`≤16ms（单测）⑤平台切换不丢输入（模拟器 wx.onHide/onShow）⑥仿真确定性（headless）⑦音频解锁（模拟器首次交互）⑧存储双端（单测+模拟器）。
- [ ] 产出双端回归报告（手测脚本 + 单测证据），Web 与微信真机/模拟器均通过。
- [ ] 承接 R2 真机复验（§0.3 偏差⑦ / sprint-02 C1）。
- 依赖：S06-1、R2 真机复验。

**S06-4 · 发布准备（移交 release-ops）**
- [ ] 主包构建核对：`build:web`/`build:wechat` 后主包 `≤2.7MB`（红线 4MB）；music 不进主包（§2）。
- [ ] 微信工程配置最后检查：`game.json`（`deviceOrientation:landscape`）、`weapp-adapter` 注入、shim 同步（sprint-02 C1/R2）。
- [ ] 构建脚本/CI 收尾（含 §2 包体、§3 IP 扫描、§4 静态/单测、tsc）。
- [ ] 文档 handoff：本计划 + 各 Sprint 质量门 → quality-lead / release-ops 接管 Phase 5。
- 依赖：S06-1/2/3。

### 3.3 Sprint 06 出口门 = Phase 4 → 5 总质量门（见 §4.3）

---

## 4. 垂直切片验证方案（独立小节）

### 4.1 "核心循环好玩"最小可玩切片验收清单
基于现有 demo（蓝天 + 栗宝 + 相对栗宝手势 + C3 受伤 + HUD 命数/形态 + 单关闭环），**补齐到"可玩切片"的最小集**（brief 指定）：

| # | 最小可玩切片项 | 来源 Story | 验收 |
|---|---|---|---|
| V1 | ≥1 真实可踩敌（刺栗）+ ≥1 真实不可踩敌（冲锋/石炮）实际出现在关卡并由 JSON 生成 | S04-1/S04-2/S04-3 | 关卡 `entities[]` 含敌；可踩死得分、不可踩致伤 |
| V2 | ≥1 真实可加载关卡（非占位）+ 凯旋之门通关 | A1(C5) + S04-3 | 出生→跑/跳/踩/吃→抵达凯旋之门，发 `ON_LEVEL_COMPLETE` |
| V3 | 经济 HUD 实时（分数/金币/连击/命数/形态） | S04-4/S04-5 | 踩敌+100、吃币+10、通关+500、HUD 实时 |
| V4 | 暂停可用（继续/重玩）+ 结算星级 | S05-2 | 双指/键→暂停遮罩；通关→星级（时间50%/币50%） |
| V5 | 受伤/重生/GameOver 完整（已 done，切片内复核） | C3（done） | FULL→SMALL→DEAD→重生；命耗尽 GameOver+跨端重试 |
| V6 | 双端（Web+微信）此切片均可玩、手感一致 | S06-3 | §4 八项通过 |
| V7 | 手感 §1 10 项指标达标（切片前提，非新增） | Sprint 2/3（done） | control-list §1 卡点 |

> **"好玩"判读**：V1–V4 全满足 + V7 已达标 + 主理人/测试人工体感（跳跃顿挫、踩敌爽感、节奏）通过，即认定核心循环"好玩"。**不应**在切片内追求 Live Ops/赛季/多关（lean，见 §5）。

### 4.2 验证方法（三段互补）
1. **headless 仿真冒烟（testing.md §5）**：`createHeadlessSim()` 不 import Phaser，按固定步长串联 InputAbstraction→CharacterController→physics→enemy→damage→economy→level→beat；脚本输入跑 N 步断言：①确定性（同输入同最终 hash）②无异常/状态有界 ③`beat.enabled=false` 不触发机制。CI 无 canvas 环境即可跑，作为双端逻辑等价证据。
2. **手感沙盒指标（control-list §1）**：`sandbox-scene.ts`（dev 构建）空房间跑真实固定步，浮层实测 10 项（全跳≈64px、二段跳≈51.84px、短跳≈49%、coyote≤100ms、buffer≤120ms、二段跳1次、水平0→满速≤0.2s、松键→停≤0.15s、踩踏−300、双端一致）。指标不达标不得铺内容（§1 卡点，V7）。
3. **真机/模拟器双端手动回归**：Web（浏览器）+ 微信（开发者工具/真机）按 V1–V6 手测脚本逐项勾选；重点：手势操作手感、触屏热区≥48px、onHide/onShow 暂停恢复、音频首次交互解锁、存储读写。产出 `sprint-06/qa-checklist.md`（手测 + 真机复验报告）。

### 4.3 Phase 4 → Phase 5 就绪判定（质量门 PASS 条件）
> 格式对齐 `docs/phase-gates/` 门控表。全部满足方可解锁 Phase 5（production 内容产出 / 正式资产 / 多关）。

| # | 门控项 | 通过条件 | 证据 |
|---|---|---|---|
| G1 | 垂直切片可玩闭环 | V1–V4 + V7 全满足，单关无崩溃跑通（S06-1） | headless 冒烟 + 手测报告 |
| G2 | 手感 §1 量化达标 | 10 项落入区间（回归） | 沙盒浮层 + 单测 |
| G3 | 双端一致性 §4 | 八项全 PASS（Web+微信） | 单测 + 真机回归报告（S06-3） |
| G4 | 包体 §2 | 主包 `≤2.7MB`（红线 4MB）；music 不进包 | `build:*` 后体积核对 |
| G5 | IP 红线 §3 | 命名扫描 0 命中 + 资产人工复核通过 | CI 扫描 + art-director 复核 |
| G6 | 架构铁律 | `core/**` 零平台 API 0 命中；数值全 config 零硬编码 | CI 静态扫描 |
| G7 | 测试/类型 | `npm test` 全绿（unit+smoke）；`tsc --noEmit` 0 错 | CI |
| G8 | 开放问题关闭 | §0.3 偏差②（Sprint 3 门）/③（短跳裁决）/⑤（资产就绪）/⑦（R2 真机）均关闭或明确归属 | 门报告 |
| G9 | R2 真机复验 | 微信 `dist-wechat/` 导入真机/模拟器无红错、可玩 | 真机复验截图/报告 |

> 判定：G1–G8 全 PASS 即**条件通过**；G9（R2）若仍 open 但代码层闭合，可附 CONCERN 移交 Phase 5 首任务（不阻塞 Phase 5 启动，但须 1 周内关闭）。

---

## 5. 风险与缓解（聚焦 MVP 闭环，不规划 Live Ops/赛季）

| 风险 | 等级 | 出现 Sprint | 缓解（对应 ADR / control-list） |
|---|---|---|---|
| **R1 微信包体**（Phaser+atlas 逼近 4MB） | 中 | S06-4 | 单图集 PNG-8 ≤1MB（asset-manifest §5 预估 150–300KB）；music 远程流式、SFX 合成（ADR-004）；tree-shaking + `IS_WECHAT` 裁剪；主包 `≤2.7MB` 卡点（§2）。后续关卡走子包。 |
| **R2 微信 weapp-adapter 运行**（真机复验） | 高（已缓解代码层） | S06-3/G9 | E1.S1 已过代码层；shim 三轮注入；真机/模拟器复验由 S06-3 承接，G9 跟踪。 |
| **R3 手感跨端一致** | 中 | 已前置 | 固定步长 60Hz（ADR-005）+ 输入固定步采样 + 沙盒量化（§1）；S06-3 §4 第2/4/6 项固化。 |
| **R4 双构建复杂度** | 低 | 已 done | `IS_WECHAT` define 裁剪；先通单构建再复制微信变体（ADR-003 §5）。 |
| **R5 敌人↔玩家碰撞管线**（踩踏 vs 受伤互斥、stun 期 non-hazard、弹丸独立 hazard） | 中 | S04-2/S04-3 | 复用 C3 `damage-resolution`；可踩判定三条件（A5）；冲锋 stun 期 non-hazard（资产规格 §3.3）；`enemy` 单测 + 集成测试覆盖。 |
| **R6 实体 schema 漂移**（GDD 05 §6 vs 实际 `tx/ty/kind`、`EntityDef` 无 id/params、校验缺失） | 低 | S04-3 | S04-3 对齐 schema + 补 `validateLevelData` 对 entities/props/checkpoints 校验。 |
| **R7 IP 红线**（资产仍占位 Graphics，正式像素未绘） | 中（红线） | S06-2 | 命名扫描先跑（CI 阻断）；资产人工复核依赖 art-director 在 S06 前产出合规占位/正式资产（§0.3 偏差⑤）；控制清单 §3。 |
| **R8 手势输入真机手感**（gesture-provider 已写未充分真机验证） | 中 | S06-3 | 真机/模拟器手动回归（§4.2 方法③），重点死区/双指暂停/空中换向；Web 端 Phaser pointer 已验证通道。 |
| **R9 双 agent 同名交付冲突**（Sprint 2 过程风险） | 低（规程） | 全程 | 每个 Story 指定**唯一执行 agent**，禁两 agent 写同名文件；长文走文件非聊天通道（sprint-02 质量门 C6）。 |
| **R10 检查点/parTime 未定**（影响结算星/计时） | 低 | S04-3/S05-2 | S04-3 补 checkpoint 最低 Must；parTime 由主理人拍板（GDD 05 待确认），影响星级阈值，S05-2 前定。 |

---

## 6. 建议与出口（给主理人）

1. **建议主理人据此汇编 Phase 4 预制作交付**：本计划 + 既有 `epics.md`/`testing.md`/`sprint-01~03` + `architecture`/`control-list`/ADR + 各 Sprint 质量门，构成 Phase 4 完整交付物。
2. **建议先补 Sprint 3 收口门**（§0.3 偏差②）：C1–C5 已落盘但未走正式门，建议在 Sprint 04 启动前由主理人核验"主场景接入 + 单关闭环"达标，作为 §1 手感卡点前置。
3. **建议 Phase 4 → 5 门按 §4.3 九项执行**：G1–G8 全 PASS 即条件通过；R2 真机复验（G9）可附 CONCERN 移交 Phase 5 首任务。
4. **不建议**在垂直切片内规划 Live Ops/赛季/多关（lean，聚焦 MVP 闭环）；多关/编辑器/道具树归 Phase 5+（Could）。
5. **待主理人拍板开放项**：冲锋怪 `STUN=1000ms` 是否调整（GDD 04 待确认）、关卡 `parTime`（影响结算星/计时）、Sprint 3 收口门归属。

> 本文件为 Phase 4 冲刺 brief（计划 + 验收），不含实现代码；代码实现待主理人确认方案后调度唯一执行 agent 启动。
