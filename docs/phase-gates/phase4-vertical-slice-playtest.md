# super-mali · 垂直切片「好玩」验证报告（Phase 4 → 5 门前置）

> 任务：QL-VSLICE-PLAYTEST · 角色：quality-lead（测试策略 / QA 计划 / Playtest 报告）
> 日期：2026-07-23 · 主线 HEAD：3b27130 · Sprint 04 已收口（S04-1~5 全提交）
> 范围：**内容循环「好玩」验证**（V1/V2/V3/V5/V7 + headless 确定性 + 手测清单）；**不实现** S05-2 暂停/结算等系统。
> 上游：`production/sprint-04-plan.md` §4.1（V1–V7）、§4.3（G1–G9）；`production/testing.md` §5（headless）；`design/gdd/*`、`src/config/*`、`src/game/scenes/game-scene.ts`。

---

## 0. 方法与水印

- **自动证据**：`npm test` 165 绿（基线 161 + 本次新增 headless 冒烟 4 项），含 `scene-loop`/`enemy-stomp`/`enemy-nonstompable`/`c3-damage`/`level-complete`/`hud-economy` 等集成/单测。
- **配置水印（均为仓库真实值，非假设）**：
  - 手感：`moveSpeed=140`、`jumpVelocity=-480`、`gravity=1800`、`coyoteMs=100`、`jumpBufferMs=120`、`airJumps=1`、`doubleJumpScale=0.93`、`stompBounce=-300`、`shortHopCut=0.7`（character/physics-config）。
  - 敌人：`ci_li` speed40(可踩) / `du_fu` float60·amp24(可踩) / `chong_feng` detect160·charge220·stun1000·attack48(不可踩) / `shi_pao` fire2000·proj180(不可踩)（enemy-config）。
  - 经济：`stomp+100`/`coin+10`/`goal+500`/`comboWindow1500ms`/`maxMult4`/`initialLives3`（economy-config）。
  - 关卡 1-1：40×9，地板行 7–8，2 段单向台，凯旋之门 `triumph_gate`(x1184,y160,32×64)，出生(64,190)，7 币 / 2 种子 / 1 检查点（1-1.json）。
  - 受伤：`invincible1500ms`/`knockback200·250`/`hitstun250ms`/`initialLives3`（damage-config）。
- **「好玩」判读口径（沿用 sprint-04-plan §4.1）**：V1–V4 + V7 全满足 + 主观体感通过 → 认定核心循环「好玩」。本任务按主理人拍板**先验证内容循环**，V4 缺失不视为内容循环返工红旗，但会阻塞 G1 形式闭合（见 §3 / §5）。

---

## 1. 垂直切片水位复核（V1–V7 现状）

| 项 | 来源 | 现状（已读证代码/配置） | 自动证据 | 结论 |
|---|---|---|---|---|
| V1 真实敌 | S04-1/2/3 | `1-1.json` 含 4 敌（ci_li×2/du_fu×1/chong_feng×1/shi_pao×1）；`game-scene` 经 `createEnemies` 生成、`stepSim` 每步 `e.update`、`resolveHazards` 走 C3 管线；可踩判定三条件（stompable && vy>0 && 底触敌顶） | `enemy-stomp`/`enemy-nonstompable` 集成测试 | ✅ 落地 |
| V2 真实关卡+凯旋之门 | A1(C5)+S04-3 | `LevelLoader` 由真实 `1-1.json` 构建 CollisionWorld；`resolveGoal` 检测 AABB 重叠 → `ON_LEVEL_COMPLETE` | `level-complete` 集成测试（持续右行可达门） | ✅ 落地 |
| V3 经济 HUD 实时 | S04-4/5 | `EconomyController` 订阅 `ON_STOMP/ON_COIN/ON_LEVEL_COMPLETE/ON_DEATH` → 计分/连击；`game-scene` 经 `ON_SCORE_CHANGED` → `hud.setScore/setCoins/setCombo` | `economy` 单测、`hud-economy` 单测 | ✅ 落地（数值流） |
| V4 暂停+结算星级 | S05-2 | **未落地**：`game-scene` 仅 `actionPressed` → 发 `ON_PAUSE`（无处理器）；`ON_LEVEL_COMPLETE` 仅驱动经济，**无结算/星级屏**；`RunStateMachine` 已实现但未接线 | — | ❌ 缺失（E5 范畴） |
| V5 受伤/重生/GameOver | C3(done) | `resolveHazards` → `DamageStateMachine`(FULL→SMALL→DEAD)；有命→重生（落 `respawnPoint`，含检查点）；无命→`ON_GAME_OVER`→冻结+覆盖层+跨端重试 | `c3-damage` 集成测试 | ✅ 落地 |
| V6 双端可玩 | S06-3 | 逻辑层零平台分支 + 同手势→同 InputState（已单测固化）；真机/模拟器手测待 S06-3 | 单测层面 ✅；真机 ⏳ | 🟡 部分（真机待 S06） |
| V7 手感 §1 十项 | Sprint2/3 | `scene-loop` 集成测试固化全跳64/二段51.84/短跳49%/coyote≤100/buffer≤120/二段跳1/0→满速≤0.2/松键停≤0.15/踩踏−300/双端一致 | `scene-loop` 集成测试 | ✅ 达标（回归中） |

---

## 2. 内容循环「好玩」四维评估（demo + 代码/配置推断）

> 标注 **[需人工手测]** 的项：逻辑/数值可推断，但「爽感/节奏」需浏览器或微信真机主观确认，详见 `production/sprint-06/qa-checklist.md`。

### 2.1 跳跃顿挫（jump cadence / 手感）
- **推断（利好）**：固定步 60Hz（ADR-005）+ `coyote 100ms` + `jump buffer 120ms` + `airJumps 1` + `shortHopCut 0.7` + `accelGround 1200`(0→满速 ≤0.2s) + `friction 1600`(松键 ≤0.15s) → 控制**宽容且跟手**，落地容错窗覆盖人类反应（~150–250ms 内有效）。全跳≈64px、二段≈51.84px、短跳≈49% 形成清晰的三档高度梯度，利于关卡纵向解谜。
- **风险点**：无 `hitstop`/轻微 `landing squash` 的「打击顿挫」——属 juice 层，需美术/手感沙盒确认是否够「脆」。**[需人工手测]**
- **判定**：机制层 PASS（CI 固化）；主观顿挫 [需人工手测]。

### 2.2 踩敌爽感（stomp satisfaction）
- **推断（利好）**：`stompBounce=-300` 提供明确向上反弹（control-list §1 卡点）；可踩敌（ci_li/du_fu）三条件判定严谨；踩死 +100 且连击倍率 `min(1+0.5*(combo-1),4)` 封顶 ×4，连续踩敌有「滚雪球」正反馈。不可踩敌（chong_feng/shi_pao）踩则受伤、与踩踏互斥，区分清晰。
- **风险点**：踩敌瞬间**无 screen shake / hitstop / 敌人消失特效**（仅 Graphics 占位重绘）——「爽」的视觉/听觉反馈待补（audio 在 S05-4、juice 在 art/手感沙盒）。主观爽感 [需人工手测]。
- **判定**：逻辑/数值层 PASS（enemy-stomp 集成测试 + 经济连击）；juice/主观 [需人工手测]。

### 2.3 收集节奏（collect rhythm）
- **推断（利好）**：7 枚币沿 1-1 主轴 + 浮空位离散分布（x=200/400/480/620/760/840/1080，y≈96–200），与 4 敌、2 单向台穿插，形成「跑→跳→吃→踩」自然节奏；`coin+10`、连击仅踩怪计入（不与币混），节奏清晰不通胀。
- **风险点**：币密度/间距未做「心流曲线」量化评估；是否过疏/过密需体感。**种子(seed)** 仅发 `ON_SEED_COLLECTED` 无蜕变数据模型（phase4-quality-gate CONCERN#1），当前是「收集占位」非「成长反馈」。**节奏主观 [需人工手测]**。
- **判定**：机制层 PASS（pickup-resolution + economy）；节奏主观 [需人工手测]。

### 2.4 抵达凯旋之门体感（arrival feel）
- **推断（利好）**：凯旋之门位于关尾 x=1184（关宽 1280），需持续右行 + 跨越 2 段单向台/敌阵抵达；`resolveGoal` AABB 重叠 → `ON_LEVEL_COMPLETE`（集成测试证明可达、无敌人也可达）。
- **风险点（关键）**：**无结算/星级/通关庆祝**——到达即发事件、经济 +500，但画面无「通关反馈闭环」，**因为 V4(暂停/结算) 未落地**。当前到达 = 「静默停止 + 分数+500」，缺乏「我赢了」的收束感。**此缺口属 E5/S05-2，不阻塞内容循环可玩性，但阻塞 G1 形式闭合（见 §3/G1）。**
- **判定**：可达性 PASS（level-complete）；到达反馈 CONCERN（待 V4）。

### 2.5 四维小结
内容循环**机制完整、数值健康、自动化证据充分**，无返工红旗；主观「爽感/节奏/到达反馈」需人工手测，且到达反馈的「收束感」硬缺口即 V4。

---

## 3. G1–G9 门控判定（逐项 PASS / CONCERN / FAIL + 证据）

> 标记 **[现在可判]** = 依据现有代码/测试/配置即可判定；**[等 E5/S06]** = 依赖 S05-x 或 S06-x 才能闭合。

| # | 门控项 | 判定 | 证据 / 阻塞 | 现在可判？ |
|---|---|---|---|---|
| **G1** | 垂直切片可玩闭环（V1–V4+V7，单关无崩溃） | **CONCERN** | V1✅(enemy-stomp/nonstompable + game-scene resolveHazards)、V2✅(level-complete + resolveGoal)、V3✅(economy+hud 单测)、V5✅(c3-damage)、V7✅(scene-loop)；**V4❌ 缺失**(暂停/结算未落地) → 闭环「可暂停/有结算」缺口。headless 冒烟 PASS（本次新增）。 | 内容循环[现在可判]=PASS；形式闭合**[等 E5/S05-2]** |
| **G2** | 手感 §1 量化达标（10 项落入区间） | **PASS** | `scene-loop` 集成测试固化全跳64/二段51.84/短跳49%/coyote≤100/buffer≤120/二段跳1/0→满速≤0.2/松键停≤0.15/踩踏−300/双端一致，落入 control-list §1。 | [现在可判] |
| **G3** | 双端一致性 §4（八项） | **CONCERN** | 自动项 PASS：①零平台分支(core-no-platform 扫描 0 命中，含本次 headless.ts) ②同手势→同InputState(input-abstraction 单测) ④jumpPressedAt≤16ms ⑥仿真确定性(本次 headless 双端等价) ⑧存储桩(save-data)。手动项待真机：③触屏热区≥48px ⑤onHide/onShow 不丢输入 ⑦音频首次解锁。 | 自动项[现在可判]=PASS；手动项**[等 S06-3/G9]** |
| **G4** | 包体 §2（主包 ≤2.7MB，music 不进包） | **CONCERN** | 需 `build:web`/`build:wechat` 后量体积；本次未量。代码层 ADR-004 已约束（音乐远程流式 / SFX 合成），但实测待 S06-4。 | **[等 S06-4]**（缺数据） |
| **G5** | IP 红线 §3（命名扫描 0 + 资产复核） | **CONCERN** | 代码层已审无任天堂符号（mario/luigi/bowser/koopa/mushroom/star/pipe/flag/piranha）；CI 扫描脚本待 S06-2。资产人工复核：当前仍占位 Graphics（§0.3 偏差⑤），需 art-director 产出合规占位/正式资产。 | 代码层[现在可判]=PASS；资产复核**[等 art-director/S06-2]** |
| **G6** | 架构铁律（core 零平台 0 + 数值全 config） | **PASS** | `core-no-platform` 扫描 0 命中（含本次新增 `src/core/sim/headless.ts`）；enemy/economy/character/physics/damage 数值全部 JSON 驱动（已查 configs），无硬编码魔法数。 | [现在可判] |
| **G7** | 测试/类型（npm test 全绿 + tsc 0 错） | **CONCERN** | `npm test` 165 绿（本次 +4 headless）。**但 `tsc --noEmit` 在 `core-no-platform.test.ts` 因缺 `@types/node`(fs/path/__dirname) 预存报错**——既有文件，非本次引入；建议补 `@types/node` 或将该文件 types 排除。 | 测试[现在可判]=PASS；类型检查有**预存红灯**（建议修，非本次阻断） |
| **G8** | 开放问题关闭（§0.3 偏差②/③/⑤/⑦） | **CONCERN** | ③短跳 0.7 裁决=已记(close)；②Sprint3 门未走=open(建议 Phase5 首任务补)；⑤资产就绪=open(等 art-director)；⑦R2 真机=open(等 G9/S06-3)。 | 部分 close；余**[等主理人/S06]** |
| **G9** | R2 真机复验（微信 dist-wechat 无红错、可玩） | **CONCERN** | 微信 `dist-wechat` 真机/模拟器复验未做；R2 代码层已缓解（weapp-adapter 三轮注入）。 | **[等 S06-3/G9]**（缺真机复验） |

**可达状态速览**：G2/G6 = PASS；G1/G3/G4/G5/G7/G8/G9 = CONCERN（均非代码返工，分别等 V4/E5、S06-3、S06-4、art-director、@types/node、主理人拍板、真机复验）。

---

## 4. Headless 确定性冒烟结果（testing.md §5）

- **探查结论**：`src/core/sim/headless.ts` 在任务前**不存在**（§5 约定目标未落地）→ 本次按约定 scaffold。
- **新建文件**：
  - `src/core/sim/headless.ts`：`HeadlessSim` 编排器（纯 core、零 Phaser/零平台；就地内联同步协议，仅用 core 模块：`InputAbstraction→CharacterController→stepBody(+CollisionWorld)→EnemyAI/Projectile→Economy/DamageStateMachine/BeatClock`，事件经 `EventBus` 捕获）。产出 `{ steps, crashed, finalHash, events, beatEvents, score, coins, lives, finalState }`。
  - `tests/fixtures/scripted-inputs.ts`：确定性脚本输入（全程右行 + 固定步跳跃边沿，600 帧）。
  - `tests/smoke/headless-sim.test.ts`：4 项断言。
- **断言结果（全部通过）**：
  1. 同输入序列 → 同 `finalHash` + 同 `events`（双端等价证据）✅
  2. 无异常、状态有界（y∈[0,288)、x∈[0,1280)）✅
  3. `beat.enabled=false` → `beatEvents===0`（GDD10 门控）✅
  4. `beat.enabled=true` → `beatEvents>0`（证明门控是真实开关，非恒 0 假阴性）✅
- **`npm test`**：161 → **165 绿**（全绿，headless 冒烟增绿）。
- **类型**：本次新增 3 文件零 `tsc` 错误（见 G7 预存红灯说明，非本次引入）。

---

## 5. 好玩判定结论

> **好玩判定：GO（核心内容循环可玩、可验证、无返工红旗）**；但 **G1 的「可玩闭环」形式闭合 = CONCERN**，因 V4（暂停/结算星级）未落地。

**理由**：
1. V1/V2/V3/V5/V7 全部落地，且均有自动化测试或集成测试固化（见 §1）；数值健康、无逻辑返工红旗。
2. 主观「爽感/节奏/顿挫」需浏览器/微信人工体感确认（见 §2 标注 + `production/sprint-06/qa-checklist.md`），但配置层无异常。
3. **唯一硬缺口是 V4**：到达凯旋之门后无结算/星级/通关反馈闭环，且无法暂停——这是 E5/S05-2 元系统，**不影响「内容循环好玩」判定**，但阻塞 G1 形式闭合与 G3 第③⑤⑦手动项、G9 真机复验（同属 S06 收尾）。

**建议主理人下一步**：内容循环已可进 E5；先调度 **S05-2（暂停+结算+RunState 机）** 闭合 V4 → 关闭 G1，再走 S06 双端回归（G3/G9）、包体（G4）、IP（G5）、开放问题（G8）。

---

## 6. 交付物索引

| 产出 | 路径 | 说明 |
|---|---|---|
| 本 Playtest 报告 | `docs/phase-gates/phase4-vertical-slice-playtest.md` | 内容循环好玩评估 + G1–G9 判定 |
| Headless 冒烟（新增） | `src/core/sim/headless.ts` + `tests/fixtures/scripted-inputs.ts` + `tests/smoke/headless-sim.test.ts` | testing.md §5 落地；npm test +4 绿 |
| 手测清单 | `production/sprint-06/qa-checklist.md` | V1–V7 逐项勾选 + Web/微信双端步骤 + §4 八项映射 |

> 注：本次**未实现** S05-2 暂停/结算等系统代码（按主理人约束），V4 缺口仅在报告中标注。**未 git commit**（高影响动作待主理人审批）。
