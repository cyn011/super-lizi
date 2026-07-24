# super-mali · Phase 6 Playtest 报告（P6-QA-01）

> 角色：quality-lead（严守真）· 任务：P6-QA-01（P0）
> 主理人：游承峰 · HEAD：`6db53e5`（feat: GDD12 种子蜕变 S06 落地）
> 范围：核心循环手感 / 种子蜕变观感一致性 / 双端（Web+微信）可玩性 / HUD·暂停·结算·存档回归
> 配套：`docs/phase-gates/phase5-phase6-gate.md`（Phase 6 质量门判定）、`production/sprint-06/manual-regression-g3-g9.md`（双端真机清单）
>
> **方法学约定**：本阶段沙箱环境可自动化覆盖"逻辑/类型/确定性/IP/单测-集成"，但**微信真机与模拟器手感/观感无法由沙箱代跑**。本文 3 轮分别为：
> - **R1 沙箱自动化回归**（可自动化部分，已实测）
> - **R2 种子蜕变专项代码评审 + 观感预检**（静态走查，沙箱）
> - **R3 双端真机手测**（必须用户侧真机/模拟器执行，附可勾选脚本与留痕要求）
>
> 严重度口径：P0 = 阻断发布/转阶段；P1 = 真机或核心体验缺陷，须本阶段关闭；P2 = 回归安全性/健壮性缺口，建议补不强阻断。

---

## R1 · 沙箱自动化回归轮（Sandbox Automated Regression）

**测试范围**：全量单测 + 集成 + 冒烟、TypeScript 类型检查、headless 确定性冒烟、IP 红线静态扫描、种子蜕变单测与拾取集成。
**方法**：沙箱可自动化（CI 等价，无真机依赖）。逐条实测并留痕（命令 + 退出码）。

| # | 项 | 命令 / 载体 | 结果 | 判定 |
|---|---|---|---|---|
| 1 | 全量测试 | `npm test` (`vitest run`) | Test Files 38 passed；Tests **268 passed**；exit 0 | ✅ PASS |
| 2 | 类型检查 G7 | `npx tsc --noEmit` | **exit 0**（0 错） | ✅ PASS（G7 关闭，已验证） |
| 3 | headless 确定性 G1/G6 | `tests/smoke/headless-sim.test.ts`（4 tests，含同输入序列→`finalHash` 一致） | 4/4 PASS | ✅ PASS |
| 4 | IP 红线 G5 | `grep` 清晰符号 `mario/luigi/bowser/koopa/mushroom/piranha/goomba/tanooki/warp.?pipe/fire.?flower/turtle/shell/flagpole` 于 `src/`（含 `src/config`） | **0 命中清晰符号**（命中均为 `ON_RESTART`/`startX`/`startY` 的 `star`/`start` 子串；`seed-view.ts` 的 `SHELL_COLOR`=栗色种壳，非龟壳） | ✅ PASS（命名 CONCERN 已闭） |
| 5 | 种子运行时 GDD12 | `tests/unit/seed/seed-runtime.test.ts`（stageFromMaturity 阈值 / cap 1.0 / accumulateOnCollect stageChanged / saveSeedResult 合并+老档兼容） | 12 项全覆盖 PASS | ✅ PASS |
| 6 | 种子拾取集成 | `tests/integration/pickup-checkpoint.test.ts`（S04-3 种子拾取 + 去重） | PASS | ✅ PASS |
| 7 | 关卡种子分桶 | `tests/unit/level/level-loader.test.ts`（1-1 含 6 seeds，seed_01..06） | PASS（已核对 1-2 同为 6 颗） | ✅ PASS |
| 8 | 存档迁移 G5/G3⑧ | `tests/unit/save/save-data.test.ts`（stars→ranks / 损坏档回退 / 缺 seedMeta 补默认） | PASS | ✅ PASS |

**发现清单**
- **P2（覆盖率缺口，非阻断）**：种子蜕变在 `game-scene.ts`（L314–330）的**串联胶水**——`ON_SEED_COLLECTED` → `accumulateOnCollect` → 必发 `ON_SEED_GROWTH` / 仅跨阈值发 `ON_SEED_METAMORPHOSIS` → `currentSeedStage` 更新——**无独立集成测试做端到端断言**。现有 `seed-runtime.test.ts` 只覆盖纯函数、`pickup-checkpoint.test.ts` 只覆盖 `ON_SEED_COLLECTED` 发射，胶水路径未被直接断言。建议补 `tests/integration/seed-metamorphosis.test.ts`：用真实 `EventBus` + `game-scene` 订阅逻辑（或抽取可测的 handler）驱动全链路，断言"每次采集发 GROWTH、仅跨阈值发 METAMORPHOSIS、topper stage 正确递进"。
- **P2**：`mali-topper.ts` 的 `drawMaliTopper` / `playMetamorphAura` 无单测（Phaser 依赖，可接受）；其**视觉正确性**归真机观感（见 R2/R3）。
- **无 P0 / P1 阻断**。沙箱全绿。

**修复建议**：补种子蜕变全链路集成测试（P2，建议本阶段内落地，不阻塞转阶段）；其余维持。

---

## R2 · 种子蜕变专项代码评审 + 观感一致性预检（Seed Metamorphosis Code Review）

**测试范围**：GDD 12 落地核查 —— IP 安全、仅视觉红线（不改 form/sizeScale/碰撞盒）、每局重置、跨关持久化、topper/光晕渲染、关卡 6 种子一致。
**方法**：只读静态走查 + 逻辑追踪（沙箱可执行）；**观感一致性须真机**（R3）。

**走查结论（逐条）**
1. **IP 安全（P0 检查）**：`src/` 清晰任天堂符号 0 命中；`event-bus.ts` 已含 `ON_SEED_COLLECTED/GROWTH/METAMORPHOSIS` 三常量；角色/美术全原创（栗宝 + 头顶蜕变物）。✅ 无 P0。
2. **仅视觉红线（GDD 12 §3.4/§3.5）**：`game-scene.ts` L315 注释明确"绝不改 form / sizeScale / 碰撞盒（仅视觉）"；`mali-topper.ts` 仅作 Graphics 绘制，不改 `body`/`sizeScale`/`form`；`accumulateOnCollect`（seed-runtime.ts）只写 `SeedRuntimeState`，不触 `DamageState`/`EconomyState`。✅ 正交守约。
3. **每局重置**：`game-scene.ts` L442 `this.seedRun = createSeedRuntime()` 在 `loadLevel` 内，保证本局 `growthPct=0→sprout`。✅
4. **跨关持久化**：`saveSeedResult`（save-data.ts）合并 `totalCollected++` / `maturity=max` / `currentStage=maxStage` / `unlockedStages` 并集；seedMeta 写入 SaveData（Web localStorage / 微信 wx.setStorageSync 经 StoragePort 对齐）。已有单测覆盖。✅（持久化跨关"真机保留"仍需真机/模拟器复验，归 G3/G9。）
5. **关卡 6 种子**：1-1 与 1-2 各 6 颗（seed_01..06），与 GDD 12 R2 "单关 6–10 颗、前 ~4 触蜕变"一致；`SEED_SIZE=16` 与碰撞盒一致（drawSeed 同源导入），绘制盒==碰撞盒。✅
6. **topper 四阶段 + 光晕**：`drawMaliTopper` 四分支（苗/藤/花/果）程序化绘制；`playMetamorphAura` 暖黄光晕（alpha 0→0.6→0、scale 0.3→1.25、单次脉冲 ≤0.4s、不闪）——与 GDD 12 §3.1 / art §1.3 一致。每帧 `update` 按 `currentSeedStage` 重绘跟随 body（L681–686）。

**发现清单**
- **P1（真机项，非沙箱可判）**：头顶 topper 四阶段**观感一致性**与**暖黄光晕节奏**为程序化绘制，沙箱无法判视觉——须在 Web + 微信真机确认"苗→藤→花→果"切换顺滑、光晕不突兀、不遮挡角色/不被刘海裁切。归 R3。
- **P1（真机项）**：跨关 `seedMeta` 持久化"重载后保留"（含老档 `stars→ranks` 不丢）须在真机/模拟器存档复验。归 G3⑧ / G9。
- **P2（健壮性 note，非阻断）**：`game-scene.ts` 在 `create()` 注册 `ON_SEED_COLLECTED` / `ON_SEED_METAMORPHOSIS` 订阅，仅 `offRestart` 在 `SHUTDOWN` 清理；当前单场景 + `restartGame()`（场景内 reset，非 `scene.restart`）复用订阅，安全。若未来改用 `scene.restart` 会重复绑定——建议健壮性补 `offSeed*` 清理（可选，不阻断）。
- 无 P0。

**修复建议**：P1 两项走 R3 真机；P2 健壮性可选补。

---

## R3 · 双端真机手测轮（Dual-Platform Real-Device Playtest — 用户执行）

> ⚠️ **本轮回主理人/测试在真实环境执行**，沙箱不可代跑微信真机。每条须留痕（截图≥2 / 录屏 / console 无红错日志）。完成勾选后回传严守真，用于关闭 G3/G9。

**范围 / 方法拆分（沙箱可自动化 vs 需真机）**

| 维度 | 沙箱可自动化（已 PASS，见 R1） | 需真机/模拟器（本轮回用户） |
|---|---|---|
| 核心循环手感 V1–V3/V5–V7 | 量化十项由 scene-loop 集成固化；逻辑由单测覆盖 | 主观"好玩/顿挫"、相对栗宝手势踩敌手感、真机帧率 |
| 种子蜕变 | 采集→growthPct→stage 逻辑全单测；IP 安全扫描 PASS | **观感一致性**（topper 四阶段 + 光晕节奏，P1）、跨关持久化真机保留（P1） |
| 双端一致性 §4 | ①②④⑥ 自动 PASS | ③④⑤⑦⑧ 触屏热区 / onHide-onShow / 音频解锁 / 存储（G3） |
| HUD/暂停/结算/存档回归 | HUD 数值流单测；result-screen 单测；save 单测 | 真机布局（刘海/手势区不遮挡）、暂停遮罩、结算评级、重试热区、跨关解锁链 |

**R3 可勾选脚本（Web / 微信模拟器 / 微信真机 三端各跑一遍）**

### 3.1 核心循环手感（V1–V3/V5–V7）
- [ ] Web：4 敌可踩/不可踩判定正确、连击倍率、受伤→SMALL→重生→GameOver 重试；手势（或键位）走/跳/踩自然。
- [ ] 微信：相对栗宝手势点右/左/上=走/走/跳（死区16px、斜向优先跳）；踩敌判定与 Web 一致；无延迟/误触。
- [ ] 主观"好玩"：跳跃跟手、coyote/buffer 容错好、踩敌爽感、收集节奏（[需人工体感]）。

### 3.2 种子蜕变观感一致性（GDD 12，P1）
- [ ] 采集第 1 颗 → topper 苗→藤切换 + 暖黄光晕脉冲（≤0.4s 不闪）。
- [ ] 采集第 2/3/4 颗 → 藤→花→果依次切换，stage 与 `computeGrowth(maturity)` 一致。
- [ ] 每局开始 growthPct=0→苗（本局即时反馈清晰）。
- [ ] topper/光晕**不遮挡角色**、不被刘海/手势区裁切；四阶段视觉辨识度高（色盲安全：形状+颜色双编码）。
- [ ] 蜕变**不改**角色尺寸/碰撞盒/分数（视觉外无任何变化）—— 可观察验证。

### 3.3 双端可玩性 + §4 ③④⑤⑦⑧（G3）
- [ ] ③ 触屏按钮热区 ≥48px（微信四钮中心+四角 ±24px 均触发，无重叠误触）。
- [ ] ⑤ onHide/onShow 切后台冻结、回前台输入不丢/不卡死/不重复。
- [ ] ⑦ 首次交互解锁音频，踩敌/吃币/跳/通关 SFX 无红错。
- [ ] ⑧ 通关写入解锁+评级(rank)+最佳时间；Web localStorage / 微信 wx.setStorageSync 双端语义对齐；刷新/重进读取保持。

### 3.4 HUD / 暂停 / 结算 / 存档回归
- [ ] HUD 实时：分数/金币/连击/命数/形态；真机布局不被遮挡、中文 ≥14px。
- [ ] 双指暂停（或专用键/微信 onHide）→ 暂停遮罩 + 继续/重玩（热区 ≥48×48）。
- [ ] 抵达凯旋之门 → 结算屏 + 评级菱形星（时间50%+金币50%）+「再玩一次」；末关「下一关」隐藏。
- [ ] 进度链：1-1 通关解锁 1-2 →「下一关」加载 1-2（非重开 1-1）→ 末关仅「再玩一次」。
- [ ] 跨关 `seedMeta` 持久化：通关后 `totalCollected` 累加、重载保留、老档不崩。

**R3 发现（待用户执行填写）**
> 主理人/测试跑完上述脚本后，将"通过/失败 + 截图/日志"回填此表，严守真据以关闭 G3/G9。

| 项 | Web | 微信模拟器 | 微信真机 | 留痕 | 备注 |
|---|---|---|---|---|---|
| 3.1 手感 | ☐ | ☐ | ☐ | | |
| 3.2 蜕变观感(P1) | ☐ | ☐ | ☐ | | |
| 3.3 §4 ③④⑤⑦⑧(G3) | ☐ | ☐ | ☐ | | |
| 3.4 HUD/暂停/结算/存档 | ☐ | ☐ | ☐ | | |

**预期严重度**：若 3.2/3.3 真机项失败 → P1（须本阶段关闭，回 engineering-lead 路由）；逻辑层沙箱已 PASS，真机失败多属渲染/平台适配，非核心逻辑回归。

---

## 综合判定 · Phase 6 质量门（详见 `docs/phase-gates/phase5-phase6-gate.md`）

**判定 = CONCERNS（条件通过，非 FAIL、非完全 PASS）**

- **已 PASS（6 项）**：G1 可玩闭环、G2 手感、G4 包体、G5 IP 命名、G6 架构铁律、**G7 测试/类型（已验证 tsc 0 错 + 268 测试绿）**。
- **CONCERN / 待用户真机（2 项）**：**G3 双端一致性**（③④⑤⑦⑧）、**G9 微信真机复验**——代码层已闭合，须用户在 Web/微信模拟器/微信真机三端跑 `manual-regression-g3-g9.md` 并留痕方可转完全通过。
- **OPEN（非阻断，独立 track）**：**G8⑤ 资产占位**（topper/关卡仍为占位 Graphics，待 art-director P6-ART-01）；G8② Sprint3 门已关、G8⑦ 随 G9。
- **无 P0 阻断性代码 Bug**：沙箱全绿、IP 安全、种子蜕变代码完整且正交守约；唯一 P2 为"game-scene 种子串联胶水缺集成测试"（建议补，不阻塞转阶段）。

**阻塞项清单（须关闭方可「完全通过」）**
1. **G3/G9 真机复验**（用户侧执行，环境依赖，非代码阻塞）—— 阻塞"完全通过"，不阻塞 Phase 6 启动。
2. **G8⑤ 资产占位**（art-director，独立 track）—— 不阻塞主线可玩性。

**放行建议**：Phase 6 可放行进入收尾/发布准备；G7 已闭、G5 已闭；G3/G9 设真机复验为收口动作（建议 1 周内）；最终发布签字须经主理人人工审批（本门为建议性门控）。高影响动作（git commit / 发布）未经主理人审批不得执行。
