# 种子蜕变系统 · QA 计划（Sprint-Seed / PH4-SEED-001）

> 角色：质量主理（seed-qa）｜分层：Must（MVP）｜阶段：实现前 QA 计划 + 正交设计评审
> 权威验收源：`design/gdd/12-seed-metamorphosis.md` §7（验收标准）+ §8（风险）
> 正交基线：`design/gdd/06-score-economy.md`（form/分数）｜`design/gdd/07-damage-statemachine.md`（sizeScale）
> 范围：**只写计划文档 + 评审清单，不写测试代码**。seed 单测由工程主程（seed-eng）落地。
> 说明：本计划为"验收门控 + 代码评审锚点"，供 seed-eng 实现时逐条对照，供 CI 作为质量门。

---

## 0. 现状基线（与 GDD12 §7 的差距 · 已落地 / 待落地）

> 目的：区分"现在就能测"与"实现后才能测"，避免 QA 门控假绿。基于 2025-07-24 代码快照 + 全量测试基线。

**全量回归基线（写本计划时）**：`npx vitest run` → **37 文件 / 258 测试全部 PASS**，无 flaky。此为本 Story 的回归地板。

### 0.1 已落地（可立即纳入冒烟/单测）
| 项 | 位置 | 说明 |
|---|---|---|
| `ON_SEED_COLLECTED` 常量 | `src/core/events/event-bus.ts:20` | §5.1 三常量中**仅此 1 个已就位** |
| 种子拾取 + 去重 + emit | `src/game/pickup-resolution.ts:78-88` | 仅发事件，不累积 growthPct（注释明示"留专项"） |
| 种子拾取集成测试 | `tests/integration/pickup-checkpoint.test.ts:50-71` | 校验 emit + 去重（partial A1） |
| 种子占位渲染 | `src/game/render/seed-view.ts` | 种壳+双叶占位，无 topper 切换 |
| 采集音效映射 | `src/game/audio/audio-bus.ts:58` `ON_SEED_COLLECTED→sfx:seed_collect` | 采集音已通 |

### 0.2 待落地（实现阻塞，QA 门控须等其就位）
| 阻塞项 | 对应 §7 | 代码现状 |
|---|---|---|
| `ON_SEED_GROWTH` + `ON_SEED_METAMORPHOSIS` 常量 | A6 | **缺失**（见 §5 Flag-1） |
| growthPct 局内累积 + `stageFromMaturity` | A1/A2/A4 | 未实现（pickup-resolution 只发事件） |
| 跨阈值 emit METAMORPHOSIS + topper 切换 | A2 | 未实现（art `computeGrowth` 已定义，须接入） |
| `seedMeta` 持久化 + `saveSeedResult` + 老档兼容 | A5 | `SaveData` 无 `seedMeta`（见 §5 Flag-3） |
| METAMORPHOSIS → `SFX_POWERUP` | A9 | 映射错位（见 §5 Flag-2） |
| `seed-config.json` 参数集中 | A1/A2 | 文件缺失、无 import（见 §5 Flag-4） |
| 正交守卫（seed 不写 form/score/sizeScale） | A3/A7/A8 | 依赖实现，须代码评审（见 §4） |

---

## 1. 冒烟测试清单（对照 §7 九条验收）

> 形式：每次合入/每日 CI 跑的最小门控。每条映射到一个 §7 验收点（A1..A9）。`[ ]`=待 seed-eng 实现后勾选。

- [ ] **A1 触碰→采集+成长**：玩家 body 触碰存活 seed → `ON_SEED_COLLECTED(seedId)` 触发（去重），且运行时 `growthPct += growthPerSeed`，封顶 `growthCap=1.0`。
- [ ] **A2 跨阈值→蜕变+topper**：连续采集使 `growthPct` 跨 `[0.25,0.5,0.75]` → 发 `ON_SEED_METAMORPHOSIS(stage)`，art 头顶 topper 切换 **苗→藤→花→果**，且 `stage === computeGrowth({source:'run', maturity:growthPct}).stage`（与 art §1.3 阶段一致）。
- [ ] **A3 仅视觉（正交）**：蜕变后断言 `DamageState.sizeScale` 不变、`controller` 碰撞盒高不变、`EconomyState.form` 与 `DamageStateMachine.form` 均不变；仅 topper/aura 视觉字段变化。
- [ ] **A4 每局重置**：新关卡 `create` 后 `growthPct === 0` 且 `stage === 'sprout'`（苗）。
- [ ] **A5 跨关持久化**：通关 `saveSeedResult` → `SaveMeta.totalCollected` 写入 `SaveData`；`load()` 重载后保留；**缺 `seedMeta` 字段的老存档不崩**（回默认）。
- [ ] **A6 三常量就位**：`event-bus.ts` 含 `ON_SEED_COLLECTED` / `ON_SEED_GROWTH` / `ON_SEED_METAMORPHOSIS`，命名与 §5.1 完全一致；事件名字符串值 = 常量名。
- [ ] **A7 与 form 正交**：吃元气果（06 链路）→ `form` 变化；采种子 → `form` 不变。两动作可独立发生、互不干扰。
- [ ] **A8 不计入分数**：采集任意数量种子后 `EconomyState.score` / `coins` / `combo` 不变；HUD 分数无跳动。
- [ ] **A9 METAMORPHOSIS 音频**：跨阈值发 `ON_SEED_METAMORPHOSIS` → 音频总线调 `play(SFX_POWERUP 或 sfx:seed_metamorph)`（见 §5 Flag-2 命名裁定）。

**冒烟判定**：A1–A9 全绿 = 通过；任一红 = 质量门 FAIL（建议性门控，最终放行由主理人定）。

---

## 2. 测试用例表（逐条映射 §7 验收点）

> 约定：`STEP_DT = 1000/60` 来自 `tests/unit/_step.ts`；阈值/参数从 `seed-config.json` 读，禁止硬编码魔法数。

| ID | 映射 | 标题 | 步骤 | 期望 |
|---|---|---|---|---|
| TC-01 | A1 | 采集触发事件+成长递增 | 1) 构造 `SeedRuntimeState{growthPct:0}` + EventBus；2) 玩家 body 与 `rt.seeds[0]` 重叠；3) 调采集解算；4) 重复重叠一次 | 首碰：`ON_SEED_COLLECTED('seed_01')` 触发 1 次，`growthPct === growthPerSeed`；二次重叠不重复发（去重） |
| TC-02 | A1 | growthPct 封顶 | 采集 >`1/growthPerSeed` 颗 | `growthPct === min(growthCap, 实际累积)`，且 ≤ `growthCap` |
| TC-03 | A2 | 阶段推导与 art 一致 | 对 `growthPct ∈ {0.1,0.3,0.6,0.9}` 分别调 `stageFromMaturity` | 返回 `'sprout'\|'vine'\|'bloom'\|'fruit'`，且 `=== computeGrowth({source:'run',maturity}).stage`（阈值 `[0.25,0.5,0.75]` 一致） |
| TC-04 | A2 | 跨阈值发 METAMORPHOSIS | 从 0 起连续采集 1→2→3→4 颗（每次重塑 runtime） | 跨 0.25/0.5/0.75 时各发 1 次 `ON_SEED_METAMORPHOSIS`，payload=对应 stage；未跨阈值不发 |
| TC-05 | A2 | 每次采集发 ON_SEED_GROWTH | 每采 1 颗 | 发 `ON_SEED_GROWTH({growthPct, stage})`，即使 stage 未变也发（细反馈源） |
| TC-06 | A2 | 非跨阈值不误发 METAMORPHOSIS | 单关内采集使 growthPct 在 0.25 区间反复（封顶内） | 仅首次达 0.25 发 METAMORPHOSIS；之后同 stage 内采集只发 GROWTH |
| TC-07 | A3 | 蜕变不改 sizeScale | 采满 4 颗至 fruit；读 `damage.sizeScale` 与角色碰撞盒高 | `sizeScale` 不变（FULL=1/SMALL=0.6），碰撞盒高 = `PLAYER_H * damage.sizeScale` 不变 |
| TC-08 | A3 | 蜕变不改 form（双 form 字段） | 同上；读 `economy.state.form` 与 `damage.form` | 两者均不变（仍为 BASE） |
| TC-09 | A4 | 每局 growthPct=0→sprout | 关卡 `create` 后读 SeedRuntimeState | `growthPct===0 && stage==='sprout'` |
| TC-10 | A5 | 跨关 totalCollected 持久化 | 1) 关 A 采 3 颗 → `saveSeedResult`；2) `load()`；3) 关 B 再采 2 颗 → `saveSeedResult`；4) 再 `load()` | `seedMeta.totalCollected === 5` 且两次重载均保留 |
| TC-11 | A5 | 老存档兼容 | `storage` 写入**无 seedMeta** 的旧档 JSON → `load()` | 不抛；`seedMeta` 补全默认 `{totalCollected:0,maturity:0,unlockedStages:['sprout'],currentStage:'sprout'}` |
| TC-12 | A5 | 缺字段迁移不污染他字段 | 旧档缺 `seedMeta` 但含 `ranks/bestTimes` → `load()` | `ranks/bestTimes/bestCoins` 原样保留，`seedMeta` 仅补缺 |
| TC-13 | A6 | 三事件常量一致 | 读 `event-bus.ts` 导出 | `ON_SEED_COLLECTED/GROWTH/METAMORPHOSIS` 存在，字符串值 === 常量名（无拼写漂移） |
| TC-14 | A7 | 采种子不改 form | 仅采种子（不碰元气果）→ 读 `economy.state.form` + `damage.form` | 均 == BASE（正交守卫） |
| TC-15 | A7 | 吃元气果改 form 且 seed 不串 | 仅吃元气果（06 链路）→ 读两 form 字段；再采种子 | 元气果使 `economy.state.form` 变 TRANSFORMED；采种子不回退/不改变它 |
| TC-16 | A8 | 种子不计分 | 采 N 颗（N≥1）前后对比 `EconomyState` | `score/coins/comboCount/comboMult` 完全不变；无 `ON_SCORE`/`ON_COIN` 因 seed 发出 |
| TC-17 | A9 | METAMORPHOSIS 触发音效 | mock `AudioPort.play`；跨阈值触发 METAMORPHOSIS | `play` 被调且入参为蜕变 SFX（见 §5 Flag-2 裁定名） |
| TC-18 | A9/R6 | GROWTH 不 spam 音频 | 单关内多次采集（同 stage 内多次 GROWTH） | `ON_SEED_GROWTH` **不**映射任何 SFX（`audio-bus` 不订阅 GROWTH 发声），避免高频音效噪音 |
| TC-19 | A3/R1 | 手感零回归（headless） | headless 仿真同输入序列含种子采集 | 最终状态 hash 与无种子基线一致（蜕变仅视觉，不改物理/碰撞/手感） |

> **自动 vs 手动分布**：TC-01~TC-19 全部可自动（core 纯逻辑 + 注入桩，符合 `testing.md` 框架）。仅"topper 视觉切换观感 / 光晕 tween ≤0.4s 非高频闪"需 **Playtest 手动签收**（见 §3.4）。

---

## 3. 回归门（现有 pickup/checkpoint/save/audio 测试须仍绿）

> 铁律：种子 Story **不得引入 form / sizeScale / score 回归**。下列套件在合入种子实现后必须全绿（基线 258 测试）。

### 3.1 须保持绿的关键套件（文件级）
| 域 | 文件 | 防回归关注点 |
|---|---|---|
| 拾取/检查点 | `tests/integration/pickup-checkpoint.test.ts` | seed 用例结构（TC-01 前身）须保留；扩展 growthPct 不得破坏去重/coin/checkpoint 断言 |
| 经济 | `tests/unit/economy/economy.test.ts` | seed 采集**不得**使 `score`/`coins` 变化（A8） |
| 受伤/尺寸 | `tests/unit/damage/damage-state-machine.test.ts` | `sizeScale` 正交矩阵（FULL/SMALL/DEAD）不因 seed 改变 |
| 存档 | `tests/unit/save/save-data.test.ts`、`tests/unit/save/save-manager.test.ts` | 加 `seedMeta` 后，**既有 defaultSaveData 精确结构断言**须同步更新（否则误红） |
| 音频 | `tests/unit/audio/audio-bus.test.ts`、`tests/unit/audio/web-audio.test.ts`、`tests/unit/platform/wechat-audio.test.ts` | 新增 `ON_SEED_*` 映射不得破坏现有 EVENT_TO_SFX；GROWTH 不得误发声 |
| 事件总线 | `tests/unit/events/event-bus.test.ts` | 新增 3 常量后 on/emit 行为不变 |
| 冒烟 | `tests/smoke/headless-sim.test.ts` | 确定性 hash 不漂移（A3/R1） |

### 3.2 回归门执行
```
npx vitest run                 # 全量（含上表）→ 须 258(+seed) 全绿
npm run typecheck              # tsc --noEmit 零错
# CI 静态扫描（testing.md §6）：grep core 层出现 wx/localStorage/AudioContext → 0 命中（seed 逻辑须在 core 零平台）
```

### 3.3 回归风险点（高亮，给 seed-eng）
- **R-REG-1（save-data 断言脆弱）**：`save-data.test.ts:28-35` 断言 `defaultSaveData()` 的完整结构。新增 `seedMeta` 字段后该用例会**误红**，须同 PR 同步改断言 → 否则阻断 CI。
- **R-REG-2（pickup-resolution 扩展位置）**：现 seed 仅发事件。若把 growthPct 累积塞进 `pickup-resolution`，会污染其"纯实体去重"职责并动摇集成测试结构。建议抽 `SeedGrowthController` 订阅 `ON_SEED_COLLECTED`（见 §5 Flag-8）。

### 3.4 Playtest 签收（手动，不自动）
| 项 | 签收标准 |
|---|---|
| 头顶 topper 切换观感 | 苗→藤→花→果 四个 topper 在跨阈值瞬间干净切换，无错位/闪烁 |
| 光晕 tween | 暖黄光晕 alpha/radius tween ≤0.4s，非高频闪 |
| 新玩家直觉 | 第一次采集即有"成长反馈"（growthPct=0→sprout 即时可见） |
| 无手感突变 | 蜕变全程跳跃/碰撞手感与无种子基线一致 |

---

## 4. 设计评审：seed-state 与 form-state(GDD06) / sizeScale(GDD07) 正交

> 目标：把 GDD12 §3.4/§3.5 "正交，互不写对方字段" 落成**可逐项打勾的代码评审清单**。seed-eng 实现时 + CR 时逐条核对。

### 4.1 状态所有权矩阵（真理源）
| 状态 | 真owner | 字段位置 | seed 可否写 | form/sizeScale 可否被 seed 读 |
|---|---|---|---|---|
| `SeedRuntimeState` | 种子系统（新增） | 新增模块 | ✅ 仅本系统 | — |
| `SeedMeta`（持久化） | 种子系统（11 扩展） | `SaveData.seedMeta` | ✅ 仅本系统 | — |
| `EconomyState.form` | GDD06（元气果道具） | `src/core/economy/economy.ts:38` | ❌ **禁止** | 只读不可写 |
| `EconomyState.score/coins/combo` | GDD06 | economy.ts | ❌ **禁止**（A8） | 只读不可写 |
| `DamageStateMachine.form` | GDD07（仅 respawn 复位） | `src/core/damage/damage-state-machine.ts:37,64,83` | ❌ **禁止** | 只读不可写 |
| `DamageState.sizeScale` | GDD07 | damage-state-machine.ts:88 getter | ❌ **禁止** | 只读不可写 |
| `controller.state.sizeScale`（碰撞盒高） | game-scene 消费 damage | `game-scene.ts:469` | ❌ **禁止** | 只读不可写 |

> ⚠ **关键发现**：代码中存在**两个 `form` 字段** —— `EconomyState.form`（GDD06，道具驱动）与 `DamageStateMachine.form`（GDD07，仅重生复位用，类型被收窄为 `'BASE'`）。GDD12 的"seed 不写 form"必须同时覆盖**两者**，否则正交失效。

### 4.2 代码评审"无跨写"核对清单（CR 必过）
- [ ] **C1** 种子采集/成长代码**无任何** `economy.state.score +=` / `economy.state.coins +=` / `economy.onCoin()` / `economy.onStomp()` 调用（A8）。
- [ ] **C2** 种子代码**不 emit** `ON_COIN` / `ON_SCORE` / `ON_SCORE_CHANGED`（防止 HUD 分数跳动）。
- [ ] **C3** 种子代码**不写** `economy.state.form`（元气果链路独占）。
- [ ] **C4** 种子代码**不写** `damage.form` / `damage.state` / `damage.sizeScale`（含不调 `damage.reset`/`hit`）。
- [ ] **C5** 种子代码**不写** `controller.state.sizeScale`；不修改碰撞盒宽高（A3）。
- [ ] **C6** 果阶段视觉 `+0.05` 缩放**仅渲染层**（art/seed-view），碰撞盒消费处（`game-scene.ts:469-470`）无 seed 写入（A3/R1）。
- [ ] **C7** `stageFromMaturity` 阈值**从 `seed-config.json` 读**，与 art `computeGrowth` 阈值 `[0.25,0.5,0.75]` 单一真理源共享，禁止两处各写一份（防漂移，A2）。
- [ ] **C8** 种子逻辑**不依赖** GDD10 节拍状态、不读写 beat 字段（§3.7 独立）。
- [ ] **C9** 种子模块置于 `src/core/`（零 Phaser/零平台）；`saveSeedResult` 经 `SaveManager` + `StoragePort` 注入，不直连 `localStorage`/`wx.setStorageSync`（core 铁律）。
- [ ] **C10** 元气果改 `form`（06）与采种子改 `SeedRuntimeState`（12）**两链路物理隔离**：无共享 mutable 中间态，无"采种子顺便复位 form"等隐式耦合（A7）。

### 4.3 静态扫描守卫（CI）
```
# core 层禁止直连平台/存储/音频（testing.md §6.1）
grep -rE "wx\.|localStorage|AudioContext|sf:|\.play\(" src/core   # 期望 0 命中（种子逻辑须全在 core，发声经事件总线）
# 禁止种子代码触及经济/伤害写入口
grep -rn "economy.state.score\|economy.state.form\|damage.sizeScale\s*=" src/core/seed* src/game/*seed*  # 期望 0 命中
```

---

## 5. 风险 Flag（明确给工程主程 seed-eng）

> 以下为代码/设计层已确认的跨写/耦合/契约风险，按优先级排序。实现前须逐一消解，否则 QA 门控无法达标。

### 🔴 Flag-1（阻塞 A6）· 事件常量缺口（D4，已多方确认）
`event-bus.ts` 仅 `ON_SEED_COLLECTED` 就位，**缺 `ON_SEED_GROWTH` 与 `ON_SEED_METAMORPHOSIS`**。GDD12 §5.1/§7 A6 要求 3 常量。
→ **动作**：种子 Story 须把两常量补进 `event-bus.ts`（命名同 §5.1），并在跨阈值时 emit METAMORPHOSIS、每次采集 emit GROWTH。
→ 参见 `design/audio/audio-design.md:183`、`design/audio/audio-event-map.md:51-54`（D4 同一问题）。

### 🔴 Flag-2（阻塞 A9）· SFX 命名/事件源冲突（高优先，需主理人+audio 拍板）
GDD12 §7 A9 要求 `ON_SEED_METAMORPHOSIS → SFX_POWERUP`，但现状三处不一致：
1. `audio-bus.ts:59` 把蜕变音映射到 **`ON_FORM_CHANGED → sfx:seed_metamorph`**，并注释"**勿引用 ON_SEED_METAMORPHOSIS**"；
2. `art/asset-spec.md:190` 把 `SFX_POWERUP` 语义定为"06 元气果 / **蜕变 stage up**"；
3. `audio-design.md:68` 用运行时名 `sfx:seed_metamorph`（注明"原 GDD09 `SFX_POWERUP`"）。
→ **冲突点**：(a) 事件源错位——蜕变音挂在 `ON_FORM_CHANGED`（form 变化）上，违背 GDD12 §3.4 正交（seed 蜕变 ≠ form 变化）；(b) 枚举名不一致——`SFX_POWERUP`(GDD09/12) vs `sfx:seed_metamorph`(audio-design 运行时名)。
→ **动作**：① 新增 `ON_SEED_METAMORPHOSIS → 正确 SFX` 映射，移除对 `ON_FORM_CHANGED` 的蜕变音借用；② 主理人/audio 拍板统一 SFX 枚举名（`SFX_POWERUP` 作为 GDD 契约别名，`sfx:seed_metamorph` 作为运行时名，二选一或建立别名映射）。**此 flag 不消解，A9 无法验收。**

### 🔴 Flag-3（阻塞 A5）· seedMeta 持久化缺口 + save-data 回归
`SaveData`（`save-data.ts:12-23`）**无 `seedMeta` 字段**；`defaultSaveData` 与 `migrate()` 均未处理。`save-data.test.ts:28-35` 断言 `defaultSaveData()` 精确结构，加字段会误红。
→ **动作**：① `SaveData` 加 `seedMeta: SeedMeta`；② `defaultSaveData` 给默认（`{totalCollected:0,maturity:0,unlockedStages:['sprout'],currentStage:'sprout'}`）；③ `migrate()` 对缺 `seedMeta` 老档补全默认（R7 向后兼容）；④ 新增 `saveSeedResult(run)` 合并逻辑（`totalCollected += collectedThisRun` 等，见 §5.3）；⑤ **同 PR 同步改 `save-data.test.ts` 断言**（R-REG-1）。

### 🟠 Flag-4（阻塞 A1/A2）· seed-config.json 缺失
`src/config` 无 `seed-config.json`，代码无 import。GDD12 §3.3/§6 要求 `growthPerSeed/growthCap/stageThresholds/source/metaGatingEnabled` 集中可调。
→ **动作**：创建 `src/config/seed-config.json`（值同 GDD12 §3.3），`stageFromMaturity` 与阈值断言从该 config 读（C7）。测试禁止硬编码阈值。

### 🟠 Flag-5（正交核心）· 双 form 字段须同时守护
见 §4.1。seed 代码须显式避开 `EconomyState.form` 与 `DamageStateMachine.form` 两处。CR 清单 C3/C4 必过。

### 🟠 Flag-6（A3 手感红线）· 果阶段 +0.05 渲染缩放不得泄漏到碰撞
art §1.3 锁 fruit 阶段 `scale +0.05` **仅渲染**。须核对 `game-scene.ts:469-470` 碰撞盒高消费处无 seed 写入（C5/C6）。headless 仿真（TC-19）守手感零回归。

### 🟡 Flag-7（A9/R6）· ON_SEED_GROWTH 高频不 spam 音频
GDD12 §5.2：每次采集即发 GROWTH（即使 stage 未变）→ 可能高频。`audio-bus` 已约定 `ON_SCORE_CHANGED` 因高频不映射。须确保 `EVENT_TO_SFX` **不含** `ON_SEED_GROWTH`（TC-18）。

### 🟡 Flag-8（架构）· 累积逻辑放置位置
`pickup-resolution.ts` 现仅发 `ON_SEED_COLLECTED`。建议抽 `SeedGrowthController`（新 `src/core/seed/`）订阅 `ON_SEED_COLLECTED`，负责 growthPct 累积 + 发 GROWTH/METAMORPHOSIS + 驱动 `computeGrowth`。保持 `pickup-resolution` 纯"实体去重+事件"，稳定 `pickup-checkpoint.test.ts`（R-REG-2）。

### 🟡 Flag-9（命名 reconciliation）· ux §6.3 三阶段已被 GDD12 四阶段 supersede
GDD12 附录 A：ux §6.3 的 `'seed'|'sprout'|'bloom'` 三阶段提案**非权威**，以 art 四阶段（苗/藤/花/果）为准。UI/图鉴实现层须按四阶段枚举调整（待主理人确认 §待确认-3）。QA 验收以四阶段为唯一真理源。

---

## 6. 质量门判定 + 待主理人确认项

### 6.1 当前质量门判定（写计划时）
- **实现前状态：⚠️ CONCERNS（非 FAIL）**。§7 九条中，A1(部分)/A6(部分) 已有最小地基，A2/A3/A4/A5/A6(余)/A7/A8/A9 均**待实现**。冒烟门控在 seed-eng 落地前只能跑 partial A1，不可判 PASS。
- **回归地板**：258 测试绿（基线），种子 PR 不得使其变红。

### 6.2 给主理人（游承峰）的待确认项（摘自 GDD12 §待主理人确认，QA 视角的阻塞）
1. **Flag-2 SFX 命名**：`SFX_POWERUP`(GDD09/12) 与 `sfx:seed_metamorph`(audio-design) 统一为哪个？是否建别名映射？**不裁定则 A9 无法验收。**
2. **Flag-9 四阶段 supremacy**：确认以 art 四阶段取代 ux §6.3 三阶段，并据此修订 ux §6.3 契约示例（影响 UI 测试数据）。
3. **GROWTH_PER_SEED=0.25**（4 颗满蜕变）默认是否合适？影响单关种子密度（GDD12 §8 R2 建议 6–10/关，仅前 ~4 触蜕变）。
4. **seedMeta 迁移策略**：确认 `SaveData.seedMeta` 加字段 + 老档默认补全方案（Flag-3），纳入 99-consistency-review 正交核查。

### 6.3 交付清单（本文件）
- [x] §1 冒烟清单（对照 §7 A1–A9）
- [x] §2 测试用例表（TC-01~TC-19，逐条映射 §7）
- [x] §3 回归门（pickup/checkpoint/save/audio 须绿 + 回归风险点）
- [x] §4 正交设计评审（状态所有权矩阵 + C1–C10 无跨写核对清单 + 静态扫描）
- [x] §5 风险 Flag（Flag-1~Flag-9，明确给 seed-eng，含 3 个 🔴 阻塞）
- [x] §6 质量门判定 + 待主理人确认项

> 注：本文件**不含测试代码**。TC-01~TC-19 与 §1 冒烟项由 seed-eng 在 `tests/unit/seed/`、`tests/integration/` 落地单测/集成测试时实现；本 QA 计划作为验收门控锚点。
