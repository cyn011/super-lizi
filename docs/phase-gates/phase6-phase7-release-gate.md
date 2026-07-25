# Phase 6 → Phase 7 最终发布门控报告（P7-QA-01）

> 阶段：Phase 6 收官 → Phase 7 发布
> 主理人：游承峰 · 角色：quality-lead（严守真）· 任务：P7-QA-01（P0）
> HEAD：`c199ad6`（feat(polish): Phase 6 打磨 — 性能优化 + 审计整改落地）
> 门定义：`production/sprint-04-plan.md` §4.3（G1–G9）
> 复用资产（升级而非重造）：`docs/phase-gates/phase5-phase6-gate.md`（Phase6 门 = CONCERNS）、`production/sprint-06/playtest-phase6.md`（3 轮 Playtest）、`production/sprint-06/manual-regression-g3-g9.md`（三端真机清单）、`docs/phase-gates/phase6-perf-report.md`（G4 性能）
> 约束：本任务未改任何 `src/`；未做 git commit；仅产出 QA 门控文档。

---

## 综合判定：CONCERNS（条件放行 / Conditional Release）

- **G1–G9 无 FAIL**。
- **代码层（沙箱可验证项）全绿**：`tsc` 0 错 / `vitest` 270 绿(39 文件) / G4 双端包体 ≤2.7MB / G5 IP 零命中 / G6 core 零平台 3/3。
- **唯一未关闭项为环境依赖型（非代码阻塞）**：**G3 双端一致性（③④⑤⑦⑧）**、**G9 微信真机复验**——须用户在 Web / 微信模拟器 / 微信真机三端跑 `manual-regression-g3-g9.md` 并留痕，方转「完全通过」。
- **结论：条件放行（CONCERNS）**——可进入发布准备/灰度；G3/G9 真机回归为发布前收口动作，需真机留痕或主理人明确豁免后方可「完全通过」并签字发布。

---

## 一、G1–G9 最终判定总表

| # | 门控项 | 最终判定 | 一句话证据（本任务实测/复核 + 引用） | 阻塞 | 关闭动作 |
|---|---|---|---|---|---|
| **G1** | 垂直切片可玩闭环 | ✅ PASS | 270 测试绿 + headless 确定性冒烟(4/4) + 3 轮 Playtest GO（playtest-phase6 R1–R3） | 无 | 真机手感归 G3/G9 |
| **G2** | 手感 §1 量化达标 | ✅ PASS | scene-loop 集成固化十项（Sprint04 已达标，回归） | 无 | 真机回归见清单 §3.1 |
| **G3** | 双端一致性 §4 | 🟡 CONCERN | 自动项①②④⑥ PASS（含④ `jumpPressedAt`≤16ms）；③④⑤⑦⑧ 代码闭合，待真机量测 | ③④⑤⑦⑧ 真机/模拟器未跑 | 跑 `manual-regression` §1/§2/§3/§4 |
| **G4** | 包体 §2 | ✅ PASS | 新鲜构建@c199ad6：Web **1.565MB** / 微信 **1.742MB**（均 ≤2.7MB）；包内 0 音频 0 图集 | 无 | 发布前复跑锁定（§五） |
| **G5** | IP 红线 §3 | ✅ PASS | `grep` 清晰任天堂符号于 `src/` → **0 命中**（仅 `SHELL_COLOR`=栗色种壳，原创种子） | 无 | 已闭 |
| **G6** | 架构铁律 | ✅ PASS | `core-no-platform.test.ts` **3/3**；数值全 config 零硬编码 | 无 | 已闭 |
| **G7** | 测试/类型 | ✅ PASS | `tsc --noEmit` exit 0（0 错）；`vitest` **270/270 绿(39 文件)**，exit 0 | 无 | 已闭 |
| **G8** | 开放问题关闭 | ✅ PASS | ②Sprint3 门已关；③短跳裁决已落；⑤资产占位=合规矢量占位(art §1.3，lean 发布可接受)；⑦随 G9 | 无 | 像素资产为独立 track(P6-ART-01)，不阻塞 lean 发布 |
| **G9** | R2 微信真机复验 | 🟡 CONCERN | `dist-wechat/` 代码层闭合；真机无红错复验待用户执行 | 真机复验未跑 | 跑 `manual-regression` §6 |

> **PASS = 7 项**（G1/G2/G4/G5/G6/G7/G8）；**CONCERN = 2 项**（G3/G9）；**FAIL = 0 项**。

---

## 二、本任务实测补充证据（沙箱，@ HEAD c199ad6）

> 以下为 quality-lead 本次在沙箱复跑/抽测的补充证据，与主理人亲核证据（tsc 0 错 / vitest 270 绿 / G4 双端包体 / core 零平台 3/3 / 越界色 grep=0）一致。

| # | 项 | 命令 | 结果 | 判定 |
|---|---|---|---|---|
| 1 | 类型检查 G7 | `npx tsc --noEmit` | exit 0（0 错） | ✅ |
| 2 | 全量测试 G7 | `npx vitest run` | Test Files **39 passed**；Tests **270 passed**；exit 0 | ✅ |
| 3 | 架构铁律 G6 | `npx vitest run tests/unit/architecture/core-no-platform.test.ts` | **3 passed (3)** | ✅ |
| 4 | IP 红线 G5 | `grep -rIin -E 'mario\|luigi\|...\|shell\|flagpole' src/` | **0 命中清晰符号**（仅 `seed-view.ts` 的 `SHELL_COLOR`=栗色种壳，非龟壳） | ✅ |
| 5 | 包体 G4 | `npm run build:web && npm run build:wechat` | Web **1,565,076 B**(1.565MB/1.49MiB)；微信 **1,741,960 B**(1.742MB/1.66MiB)；`find` 音频/PNG = **0** | ✅ |
| 6 | headless 确定性 G1/G6 | `tests/smoke/headless-sim.test.ts`(4) | 4/4 PASS（同输入序列→`finalHash` 一致） | ✅ |
| 7 | 种子蜕变全链路 B4 闭环 | `tests/integration/seed-metamorphosis.test.ts`(2) | 2/2 PASS → 前 Phase6 门 P2 建议项 **B4 关闭** | ✅ |

**关键说明（审计发现）**

- **G7 测试数 268→270（+2）、文件 38→39（+1）**：新增 `tests/integration/seed-metamorphosis.test.ts`（2 tests），即前 Phase6 门 P2 建议项 **B4「种子串联胶水缺集成测试」**，已于 commit `c199ad6` 落地 → **B4 关闭**。代码层回归安全性提升。
- **G4 包体单位澄清（无真差异）**：本任务新鲜构建 Web = 1,565,076 B。perf 报告标「≈1.49 MB」用的是 **MiB**（÷1048576），亲核 brief 标「1.56MB」用的是 **十进制 MB**（÷1e6）——**同一文件，仅单位口径不同，无真差异**。
  - ⚠️ **brief 中「微信 1.58MB」疑为转录笔误**：工程-lead `phase6-perf-report.md` 实测微信 = 1.66 MiB，本任务新鲜构建微信 = 1,741,960 B = **1.742 MB（十进制）/ 1.66 MiB**，两者吻合；brief 的「1.58MB」与二者均不符。无论取何值均 **< 2.7MB**，G4 PASS 不受影响。建议发布前以本新鲜构建数字（Web 1.565MB / 微信 1.742MB）为准锁定。
- **G8⑤ 资产占位**：仓库当前**无像素资产**（全矢量占位 Graphics），但占位符合 `art/art-bible.md` §1.3 / GDD12 规格（工程-lead 已标注「占位合规」）。**lean 评审下占位即合规资产 → G8⑤ PASS**；最终像素资产（ADR-004 单图集）属 P6-ART-01 独立 track，**不阻塞本 lean 发布门**。
- **主理人亲核另含「越界色 grep=0」**：边界/越界相关静态扫描 0 命中，作为 G5/G6 上下文证据（本任务以 G5 IP grep 0 命中 + G6 core 3/3 直接佐证）。

---

## 三、G3 / G9 处理建议（条件放行 vs 等真机）

**判定：条件放行（CONCERNS），G3/G9 待用户真机回归关闭。**

**依据**：G3（③④⑤⑦⑧）与 G9 的代码层已在 S05-3/4/5 + R2 shim 三轮注入 + 微信 lifecycle 钩子闭合，并由单测/集成/`tsc` 固化（见 `manual-regression-g3-g9.md` §A「沙箱已自动化 PASS」项）。但以下维度**沙箱不可代跑**微信真机/模拟器，须用户在三端执行并留痕：

- 渲染 / 手势 / 触屏热区（§1 ③ ≥48px、§3 ⑦ 音频解锁、§4 ⑧ 存储持久化保留）
- 平台生命周期（§2 ⑤ onHide/onShow 不丢输入）
- 主观手感 / 帧率 / 观感（种子蜕变四阶段观感、节拍平台实/虚相位、1-2 进度链）
- 微信真机无红错复验（§6 G9）

**关闭路径（直接引用 `manual-regression-g3-g9.md`，不重造）**

| 真机项 | 步骤 | 判定 |
|---|---|---|
| §1 ③ 热区 ≥48px | 真机/模拟器点按四钮中心 + 四角 ±24px | 四钮均触发、无重叠误触 → PASS |
| §2 ⑤ onHide/onShow | 切后台冻结 + 回前台无缝、输入不丢 | 冻结+恢复无缝 → PASS |
| §3 ⑦ 音频解锁 | 首次交互后 SFX 无红错 | 解锁后可用无红错 → PASS |
| §4 ⑧ 存储双端 | Web localStorage / 微信 wx.setStorageSync 双端读写一致、刷新保持 | 双端语义对齐 → PASS |
| §4 ⑧-a 旧档迁移 | 预制 `stars` 旧档/损坏档 → 不崩、迁移 `ranks` | 不崩且迁移正确 → PASS |
| §5 S05-2 暂停/结算/重试 | 双指暂停 + 结算评级菱形星 + 重试 | V4 闭环 → PASS |
| §6 G9 真机复验 | 真机导入无红错、可玩跑通 1 关 + 留痕 | 无红错且可玩 → G9 关闭 |
| §7 种子蜕变观感 | 采集 1–4 颗 → 苗→藤→花→果 + 暖黄光晕 | 四阶段顺滑、仅视觉 → PASS |
| §8 节拍平台 | 1-1 `bp_pulse_a`(500/500)、1-2 `bp_1_2`(187.5/187.5) 实/虚相位 | 可踩实/穿虚/下落安全 → PASS |
| §9 新关卡 1-2 + 进度链 | 1-1 通关解锁 1-2 →「下一关」加载 1-2 → 末关仅「再玩一次」，双端一致 | 解锁/显隐/加载一致 → PASS |

**Sign-off 汇总（待真机，引用 `manual-regression` §10）**

| 回归项 | Web | 微信(模拟器) | 微信(真机) | 状态 |
|---|---|---|---|---|
| §1 ③ 热区 ≥48px | ☐ | ☐ | ☐ | **待真机** |
| §2 ⑤ onHide/onShow | ☐ | ☐ | ☐ | **待真机** |
| §3 ⑦ 音频解锁 | ☐ | ☐ | ☐ | **待真机** |
| §4 ⑧ 存储双端 | ☐ | ☐ | ☐ | **待真机(持久化保留)** |
| §4 ⑧-a 旧档迁移(stars→ranks) | ☐ | ☐ | ☐ | **待真机** |
| §5 暂停/结算/重试 | ☐ | ☐ | ☐ | **待真机** |
| §6 G9 真机复验(R2) | — | ☐ | ☐ | **待真机** |
| §7 种子蜕变观感(P1) | ☐ | ☐ | ☐ | **待真机(观感)** |
| §8 节拍平台(1-1/1-2) | ☐ | ☐ | ☐ | **待真机(观感)** |
| §9 新关卡 1-2 + 进度链 | ☐ | ☐ | ☐ | **待真机** |

> **转「完全通过」条件（二选一）**：
> 1. **真机留痕**：上述 §1–§9 在 Web / 微信(模拟器) / 微信(真机) 全勾 + 留痕（截图 ≥2 / 录屏 / console 无红错）→ 关闭 G3/G9，本门由 CONCERNS 转 PASS。
> 2. **主理人显式豁免**：若基于 lean 评审决定以「合规占位 + 沙箱全绿」直接放行（跳过真机），须**显式书面豁免** G3/G9 真机项，记录豁免理由与风险接受，方转「完全通过」签字。
>
> 二者皆未达成 → 维持**条件放行（CONCERNS）**。

---

## 四、阻塞项清单（关闭方可「完全通过」）

| # | 阻塞项 | 性质 | 责任方 | 关闭动作 |
|---|---|---|---|---|
| **B1** | G3 ③④⑤⑦⑧ 真机/模拟器复验 | 环境依赖（非代码阻塞） | 主理人/测试（用户侧） | 跑 `manual-regression` §1–§4 / §7–§9，三端留痕 |
| **B2** | G9 微信真机复验 | 环境依赖（非代码阻塞） | 主理人/测试（用户侧） | 跑 `manual-regression` §6，真机无红错 + 可玩 |
| **B3** | G8⑤ 像素资产（独立 track，**不阻塞 lean 发布**） | 独立 track | art-director（P6-ART-01） | 交付合规像素资产 + ir/ip-review（发布后/下阶段） |

> B1/B2 阻塞「完全通过」但**不阻塞发布准备/灰度**（代码层闭合）；B3 不阻塞 lean 发布（占位合规）。

---

## 五、发布前冒烟复跑建议（最小命令集 · 绿灯证据）

> 以下命令主理人/你可在沙箱复跑，作为发布绿灯证据。本任务已抽测 subset 并记入 §二；全量亲核可由主理人执行。

```bash
# 1) 类型检查 G7
npx tsc --noEmit

# 2) 全量测试 G7（270 绿 / 39 文件）
npx vitest run

# 3) 架构铁律 G6（core 零平台 3/3）
npx vitest run tests/unit/architecture/core-no-platform.test.ts

# 4) IP 红线 G5（清晰任天堂符号 0 命中；过滤 ON_RESTART/startX/startY 子串误中）
grep -rIin -E 'mario|luigi|bowser|koopa|mushroom|piranha|goomba|tanooki|warp.?pipe|fire.?flower|turtle|shell|flagpole' src/ | grep -viE 'ON_RESTART|startX|startY'

# 5) 包体 G4（Web / 微信 ≤2.7MB；0 音频 0 图集）
npm run build:web && npm run build:wechat
stat -f%z dist/assets/index-*.js                                                        # Web raw bytes（期望 ≈1.57MB）
stat -f%z dist-wechat/index.js dist-wechat/weapp-adapter.js dist-wechat/game.js         # 微信三项求和（期望 ≈1.74MB）
find dist dist-wechat \( -iname '*.mp3' -o -iname '*.wav' -o -iname '*.png' \) | wc -l   # 期望 0

# 6) headless 确定性 G1/G6（可独立抽跑作为冒烟绿灯）
npx vitest run tests/smoke/headless-sim.test.ts
```

> macOS 无 `du -b`，改用 `stat -f%z`（字节）。微信包体取 `index.js + weapp-adapter.js + game.js` 三项之和（不含 project.config.json / game.json 等配置元数据）。

---

## 六、整体结论

**Phase 6 → Phase 7 最终发布门控判定 = 条件放行（CONCERNS）。**

- **已 PASS（7 项）**：G1 可玩闭环、G2 手感、G4 包体、G5 IP 红线、G6 架构铁律、G7 测试/类型、G8 开放问题。代码层全绿，沙箱证据齐。
- **待用户真机 CONCERN（2 项）**：G3 双端一致性、G9 微信真机复验。代码层闭合，须三端真机跑 `manual-regression-g3-g9.md` 并留痕，或主理人显式豁免，方转完全通过。
- **无 P0 阻断性代码 Bug**：`tsc` 0 错 / 270 测试绿 / IP 安全 / core 零平台。前 Phase6 P2 建议（B4 种子蜕变全链路集成）已于 `c199ad6` 落地关闭。
- **放行建议**：
  1. 可**条件放行**进入发布准备/灰度（代码层闭合，无阻断）。
  2. G3/G9 设真机回归为发布前收口动作（建议 1 周内）；完成并留痕 → 转完全通过。
  3. 或主理人基于 lean 评审**显式豁免** G3/G9 真机项，记录风险接受 → 转完全通过。
  4. **最终发布签字须经主理人人工审批**（本门为建议性门控，非强制放行）。
  5. 高影响动作（git commit / 发布签字）未经主理人审批不得执行。本任务未做任何代码修改、未提交。

---

> 备注：本报告为 quality-lead 建议性质量门判定。详细 Playtest 见 `production/sprint-06/playtest-phase6.md`；双端真机清单见 `production/sprint-06/manual-regression-g3-g9.md`；G4 性能基线见 `docs/phase-gates/phase6-perf-report.md`；Phase6 门（CONCERNS）见 `docs/phase-gates/phase5-phase6-gate.md`。
