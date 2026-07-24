# Phase 5 → Phase 6 质量门报告（P6-QA-01）

> 阶段：Phase 5 制作收尾 → Phase 6 收尾/发布准备
> 主理人：游承峰 · 角色：quality-lead（严守真）· 任务：P6-QA-01（P0）
> HEAD：`6db53e5`（feat: GDD12 种子蜕变 S06 落地）
> 门定义：`production/sprint-04-plan.md` §4.3（G1–G9）；承接 `phase4-phase5-gate.md` 的 CONCERN 收敛。
> 配套：`production/sprint-06/playtest-phase6.md`（3 轮 Playtest）、`production/sprint-06/manual-regression-g3-g9.md`（双端真机清单）。

---

## 综合判定：CONCERNS（条件通过）

- **G1–G9 无 FAIL**；原 5 项 CONCERN（G3/G5/G7/G8/G9）中 **G5/G7 已关闭**，剩 **G3/G9 待真机**、**G8⑤ 资产占位 OPEN**。
- 本阶段新增特性 **GDD 12 种子蜕变** 代码完整、IP 安全、单测+集成覆盖（268 测试全绿，tsc 0 错），**无 P0 阻断性代码 Bug**。
- 结论：可达 **条件通过**——Phase 6 收尾/发布准备可启动；G3/G9 真机复验须在收口窗口内由用户侧执行并留痕，方转「完全通过」。

---

## 一、G1–G9 判定总表

| # | 门控项 | 判定 | 一句话证据（本任务实测/复核） | 阻塞 | 关闭动作 |
|---|---|---|---|---|---|
| **G1** | 垂直切片可玩闭环 | ✅ PASS | 268 测试绿 + headless 确定性冒烟 + 垂直切片 playtest=GO | 无 | 真机手感归 G3/G9 |
| **G2** | 手感 §1 量化达标 | ✅ PASS | scene-loop 集成固化十项（Sprint04 已达标，回归） | 无 | 真机回归见清单 §7 |
| **G3** | 双端一致性 §4 | 🟡 CONCERN | 自动项①②④⑥ PASS；③④⑤⑦⑧ 代码闭合，待真机量测 | ③④⑤⑦⑧ 真机/模拟器未跑 | 跑 `manual-regression-g3-g9.md` |
| **G4** | 包体 §2 | ✅ PASS | web 1.47MB / wechat 1.57MB（raw），均 ≤2.7MB；包内 0 音频 | 无 | 最终构建 S06-4 复核 |
| **G5** | IP 红线 §3 | ✅ PASS | `src/` 清晰符号 0 命中；`star→rank` 重命名已落（EL-STAR-FIX），评级菱形星；仅余资产占位归 G8⑤ | 仅资产终像素（G8⑤） | 资产复核随 P6-ART-01 |
| **G6** | 架构铁律 | ✅ PASS | `core-no-platform.test.ts` 3/3 PASS（core 零平台 API）；数值全 config 零硬编码 | 无 | 无需 |
| **G7** | 测试/类型 | ✅ PASS | **已验证 `tsc --noEmit` exit 0（0 错）** + `npm test` **268/268 绿**；`@types/node` 预存错已修（commit 4af445c `tests/node-stubs.d.ts`） | 无 | 已闭 |
| **G8** | 开放问题关闭 | 🟡 CONCERN | ②Sprint3 门已关（PASS）；⑤资产占位 OPEN；⑦R2 随 G9 | ⑤资产占位 | ⑤art-director 产出合规资产 |
| **G9** | R2 微信真机复验 | 🟡 CONCERN | `dist-wechat` 代码层闭合；真机无红错复验待用户执行 | 真机复验未跑 | 跑 `manual-regression-g3-g9.md` §6 |

> PASS = 6 项（G1/G2/G4/G5/G6/G7）；CONCERN = 3 项（G3/G8/G9，其中 G8 仅余⑤资产占位）；FAIL = 0 项。

---

## 二、本任务实测证据

### 2.1 测试 + 类型 G7（已验证关闭）
- **命令**：`npx tsc --noEmit` → **exit 0（0 错）**；`npm test`（`vitest run`）→ **Test Files 38 passed (38)；Tests 268 passed (268)；exit 0**。
- 关键覆盖：seed 运行时 12 项（`stageFromMaturity` 阈值 / `cap 1.0` / `accumulateOnCollect` stageChanged / `saveSeedResult` 合并+老档兼容）、种子拾取集成、关卡 6 种子分桶、存档 `stars→ranks` 迁移、result-screen / run-state / wechat-lifecycle / audio-bus 等。
- **结论**：G7 子项"tsc 0 错"与"测试全绿"**双双满足**，G7 关闭（承接 `phase4-phase5-gate.md` §六"已关闭项"）。

### 2.2 IP 红线 G5（命名已闭，复核）
- **命令**：`grep -rIin -E 'mario|luigi|bowser|koopa|mushroom|piranha|goomba|tanooki|warp.?pipe|fire.?flower|turtle|shell|flagpole'` 于 `src/`（含 `src/config`）。
- **结果**：**0 命中清晰符号**。命中点全部为 `ON_RESTART`/`startX`/`startY` 的 `star`/`start` 子串误中，以及 `seed-view.ts` 的 `SHELL_COLOR`（=栗色种壳，原创种子，非龟壳）。`result-screen.ts` 评级星已 `star→rank` 重命名 + 矢量菱形星（EL-STAR-FIX，commit 7573be2）。
- **结论**：命名 CONCERN 关闭；仅余"资产终像素占位"（归 G8⑤，非命名红线）。

### 2.3 种子蜕变（GDD 12）落地核查
- 逻辑层：`src/core/seed/{seed-types,seed-config,seed-runtime}.ts` 纯函数（零平台）；`event-bus.ts` 含 `ON_SEED_COLLECTED/GROWTH/METAMORPHOSIS`；`pickup-resolution.ts` 种子拾取→`ON_SEED_COLLECTED` + 去重。
- 接线层：`game-scene.ts` L316–330 订阅 `ON_SEED_COLLECTED` → `accumulateOnCollect` → 必发 `ON_SEED_GROWTH`、仅跨阈值发 `ON_SEED_METAMORPHOSIS`；L325–330 更新 `currentSeedStage` + `playMetamorphAura`；L442 每关 `createSeedRuntime()` 重置；`update` 按 `currentSeedStage` 重绘 topper（L681–686）。注释明确"绝不改 form / sizeScale / 碰撞盒（仅视觉）"。
- 视觉层：`mali-topper.ts` 四阶段程序化绘制 + 暖黄光晕（≤0.4s 单次脉冲、不闪）；`seed-view.ts` 栗色种壳+草绿双叶，`SEED_SIZE` 与碰撞盒一致。
- 持久化：`save-data.ts` `seedMeta` 合并 + 老档 `stars→ranks` 迁移 + 缺省补默认。
- 关卡：1-1 / 1-2 各 6 颗种子（seed_01..06），与 GDD 12 R2 一致。
- **缺口（P2，非阻断）**：`game-scene` 种子串联胶水无独立集成测试做端到端断言（纯函数与发射已覆盖）。建议补 `tests/integration/seed-metamorphosis.test.ts`。

---

## 三、逐门判定 / 阻塞 / 关闭动作（摘要）

- **G1–G2, G4, G6**：PASS，自动化证据齐，无阻塞。
- **G3**：CONCERN。③④⑤⑦⑧ 代码闭合，待真机量测 → `manual-regression-g3-g9.md` 三端跑。
- **G5**：PASS（命名闭）。仅余资产终像素 → G8⑤。
- **G7**：**PASS（已验证）**。tsc 0 错 + 268 绿。
- **G8**：CONCERN。②已关；⑤资产占位 OPEN（art-director）；⑦随 G9。
- **G9**：CONCERN。代码闭合，待用户真机复验。

---

## 四、阻塞项清单（关闭方可「完全通过」）

| # | 阻塞项 | 性质 | 责任方 | 关闭动作 |
|---|---|---|---|---|
| B1 | **G3 ③④⑤⑦⑧ 真机/模拟器复验** | 环境依赖（非代码阻塞） | 主理人/测试（用户侧） | 跑 `manual-regression-g3-g9.md` §1–§4，三端留痕 |
| B2 | **G9 微信真机复验** | 环境依赖（非代码阻塞） | 主理人/测试（用户侧） | 跑 `manual-regression-g3-g9.md` §6，真机无红错+可玩 |
| B3 | **G8⑤ 资产占位（topper/关卡 Graphic 占位）** | 独立 track（不阻塞主线可玩） | art-director（P6-ART-01） | 产出合规像素资产 + ir/ip-review 复核 |
| B4 | **种子串联胶水缺集成测试（P2）** | 回归安全性（建议补，非阻断） | engineering-lead | 补 `seed-metamorphosis.test.ts` 端到端断言 |

> 说明：B1/B2 阻塞"完全通过"但不阻塞 Phase 6 启动（代码层闭合）；B3 不阻塞主线；B4 为 P2 建议项。

---

## 五、整体结论

**Phase 5 → 6 判定 = 条件通过（CONCERNS）。**

- **已 PASS（6 项）**：G1 可玩闭环、G2 手感、G4 包体、G5 IP 命名、G6 架构铁律、G7 测试/类型（**本次实测 tsc 0 错 + 268 测试绿，确认关闭**）。
- **待办 CONCERN（3 项）**：G3/G9 真机复验（用户侧执行，环境依赖）、G8⑤ 资产占位（art-director）。
- **新增特性 GDD 12 种子蜕变**：代码完整、IP 安全、单测+集成覆盖、**无 P0 阻断**；观感一致性（topper/光晕）与跨关持久化真机保留须真机确认（归 G3/G9）。
- **还差什么才「完全通过」**：跑完双端真机/模拟器回归（关 G3/G9）+ art-director 产出合规资产（关 G8⑤）。
- **放行建议**：可放行 Phase 6 收尾/发布准备；G3/G9 设收口时限（建议 1 周）；最终发布签字须经主理人人工审批（本门为建议性门控，非强制放行）。
- **高影响动作（git commit / 发布签字）须经主理人审批**；本任务未做任何代码修改、未提交。

---

> 备注：本报告为 quality-lead 建议性质量门判定。详细 Playtest 见 `production/sprint-06/playtest-phase6.md`；双端真机清单见 `production/sprint-06/manual-regression-g3-g9.md`。
