# Sprint 3 质量门报告（内容闭环 · 补核门）

> 范围：Sprint 3（内容闭环）代码已落盘，本次为 **补正式 Sprint 3 质量门**（关闭 G8②，见 `docs/phase-gates/phase4-phase5-gate.md` G8②「Sprint 3 代码已落盘但未走正式 Sprint 3 质量门 → open，建议 Phase5 首任务补核验 C1–C5」）
> 角色：quality-lead（严守真）｜独立核验：quality-lead 亲跑 tsc / vitest / 双构建 / core 静态扫描
> 日期：2026-07-24
> 配套：`production/sprint-03/epics.md`、`production/sprint-03/integration-plan.md`、`docs/phase-gates/sprint-01-quality-gate.md`、`docs/phase-gates/sprint-02-quality-gate.md`

> **编号约定（重要）**：本门定义的 **C1–C5 是质量卡点**（类型检查 / 单测 / 双构建 / core 零平台 / 双端一致），与 `sprint-02-quality-gate.md` 的 C1–C6 CONCERN 编号**互不相关**，亦与 `epics.md` 中 Sprint 3 的 Story C1–C5（控制器/输入/关卡/受伤/手感）**互不混用**。下文「各 Story 验收自检」沿用 epics.md 的 Story 命名（C1 控制器…C5 单关），「质量卡点」专指本门 C1–C5。

---

## 1. 判定结论

**判定：PASS（条件通过）** — 5 项质量卡点（C1–C5）全绿，Sprint 3 内容闭环工程侧硬指标达标；唯一余项为真机/模拟器量测（归 `manual-regression-g3-g9.md`，代码层已闭合，不阻塞）。

| 卡点 | 结果 | 证据（本任务实测） |
|------|------|------|
| **C1 类型检查** `tsc --noEmit` | ✅ 0 错误 | `npx tsc --noEmit` → exit 0，stderr 空（此前 G7 的 5 处 @types/node 预存错已随后续提交落地修复） |
| **C2 单测** `vitest run` | ✅ 258 绿 | `npx vitest run` → Test Files **37 passed (37)**；Tests **258 passed (258)**；exit 0 |
| **C3 双构建出包** `build:web` + `build:wechat` | ✅ 成功 | 两命令均 exit 0；Web 主包 ≈1.49 MiB、微信主包 ≈1.65 MiB，均 ≤ 预算（见 §3） |
| **C4 core 零平台 API** | ✅ 0 真实调用 | Grep `src/core` 对 `phaser｜wx｜localStorage｜AudioContext｜navigator｜window｜document` → **仅 1 处 doc 注释命中**（"不读 phaser…不读任何平台 API"字样），0 真实调用 |
| **C5 双端一致 / 真机代码层闭合** | ✅ 代码层闭合 | 逻辑层零平台分支（core-no-platform 3/3）+ 同 InputState 单测 + `dist-wechat/game.js` 入口链 + `LEVEL_ORDER` 进度链；真机量测归手动清单 |

> 与 `phase4-phase5-gate.md` 对应：本门关闭的 G8② 是「Sprint 3 未走正式门」这一**流程缺口**；非新增工程缺陷。Sprint 3 的代码已在 S04–S06 的实测中持续被 258 绿 / 双构建 / core 零平台反复验证。

---

## 2. 各 Story 验收自检（基于当前 258 绿证据回推 Sprint 3 验收）

> 说明：Sprint 3 代码早于 S04–S06 落盘，本门为**补核**。下列自检以当前测试基线（scene-loop 集成 / level-complete / c3-damage / input 系列等）回推 epics.md §2 的 C1–C5 验收项，属 retrospective 自检，非新增实现。

- **Story C1 · 主场景接入 CharacterController（驱动 body）**：`game-scene.ts` 已用同步桥把 `controller.consume()` 输出回灌 `body`（消除 epics F1/F2/F3 双对象失同步）；`scene-loop.test.ts` 集成固化 §1 十项手感（`character 10 / physics 4` 单测亦通过）。`core/**` 0 平台 API（C4）。**验收达成**。
- **Story C2 · 二段跳 / 短跳 / coyote / buffer 集成验证**：`scene-loop` 集成测试 10 项指标落入区间（全跳≈64 / 二段≈51.84 / 短跳≈49% / coyote≤100 / buffer≤120 / 0→满速≤0.2 / 松键停≤0.15）；`character-controller.test.ts` 10 it 通过。**验收达成**。
- **Story C3 · 受伤状态机接入**：`damage-state-machine.test.ts` 6 it + `c3-damage.test.ts` 集成 5 it 覆盖 FULL→SMALL→DEAD→重生 + 击退；`HazardSource` 接口在 `core/damage/`（纯逻辑）。**验收达成**。
- **Story C4 · 双端输入链路打通**：`web-platform.ts` 的 `attach()` 已闭合（修复 epics F4）；`input-abstraction.test.ts`（Web 键盘 ≡ 微信触屏同 InputState）、`wechat-touch.test.ts` 8 it、`wechat-lifecycle.test.ts` 18 it 全过。**验收达成（代码层；真机热区量测归 §8 手动清单）**。
- **Story C5 · 单关卡通跑（出生点 → 凯旋之门）**：`level-loader.test.ts` 10 it + `level-runtime.test.ts` 4 it + `level-complete.test.ts` 集成 2 it 覆盖真实地图 / CollisionWorld / 终点检测；`follow-camera.test.ts` 6 it 覆盖镜头跟随；1-1 可跑通（现扩展至 1-2，见 §4 CONCERN-2）。**验收达成**。
- **Story QA · 手感 smoke + 微信真机复验**：逻辑层可由 headless 集成 + 单测固化（G1/G6）；**真机复验仍 open**，归 `manual-regression-g3-g9.md` §6（G9）与 §8/§9。**验收部分达成（真机待量测）**。

---

## 3. C1–C5 核验证据表（独立核验记录）

### C1 类型检查（实测）
- 命令：`npx tsc --noEmit`
- 结果：**exit 0**，stderr 空，**0 错误**。
- 注：此前 `phase4-phase5-gate.md` G7 记录的 5 处 `@types/node` 预存错（`core-no-platform.test.ts` 缺类型）已在后续提交落地修复（与 brief 基线「tsc 0 错」一致）。

### C2 单测（实测）
- 命令：`npx vitest run`
- 结果：
  ```
  Test Files  37 passed (37)
       Tests  258 passed (258)
  Duration  32.57s
  ```
- 关键固化（与 Sprint 3 相关）：`character-controller`(10) / `damage-state-machine`(6) / `c3-damage`(5) / `input-abstraction`(2) / `wechat-touch`(8) / `wechat-lifecycle`(18) / `level-loader`(10) / `level-runtime`(4) / `level-complete`(2) / `scene-loop`(集成) / `core-no-platform`(3) 等全绿。

### C3 双构建出包（实测）
- 命令：`npm run build:web` + `npm run build:wechat`（均 exit 0）。
- **Web 主包**（运行时实际加载 = `index.html` + `assets/index-*.js`）：
  | 文件 | raw (B) |
  |---|---|
  | dist/index.html | 572 |
  | dist/assets/index-C7nBkFoj.js | 1,557,529 |
  | **合计** | **1,558,101 B（≈1.49 MiB / 1.56 MB）** |
  > `dist/game.js`(37,723 B) 由 `public/` 拷入，Web 不加载，不计入 Web 主包。包内 0 音频（ADR-004）。
- **微信主包**（`dist-wechat/` 全量，运行时必需）：
  | 文件 | raw (B) | 说明 |
  |---|---|---|
  | dist-wechat/index.js | 1,644,106 | Babel ES5 转译后实际产物（build 日志为转译前 1,572,010 B） |
  | dist-wechat/weapp-adapter.js | 51,324 | 微信适配器 |
  | dist-wechat/game.js | 37,723 | 入口链（见 C5） |
  | dist-wechat/game.json / project.config.json | 976 | 配置 |
  | **合计** | **1,734,129 B（≈1.65 MiB / 1.73 MB）** |
- **阈值对照**：Web ≤1.5 MiB（项目既有 MiB 口径，与 sprint-01 实测 1.42 MiB、phase4 1.47 MiB 一致）= 1,572,864 B；Web 实测 1,558,101 B **< 阈值，PASS（余量 ≈14.4 KiB，偏紧）**。微信 ≤2.7 MiB = 2,831,155 B；实测 1,734,129 B **PASS（余量充足）**。
- **度量口径提示（待主理人确认）**：若阈值按十进制 MB（Web ≤1,500,000 B）计，实测 1,558,101 B 将**超出约 58 KB**。考虑到 sprint-01/phase4 均按 MiB 口径标注（1.42/1.47 MB 实为 MiB），本门以 MiB 为 PASS 判定，但**标记包体增长为 CONCERN-1**（见 §4）。

### C4 core 零平台 API（实测）
- 命令：Grep `src/core` 对 `phaser|wx|localStorage|AudioContext|navigator|window|document`（含 `document` 以对齐 sprint-02 范围）。
- 结果：**仅 1 命中** → `src/core/character/character-controller.ts:9` 为 doc 注释「- 不读 phaser、不读任何平台 API（core 层铁律）。」**0 处真实调用**。铁律保持（与 G6 / core-no-platform 3/3 一致）。

### C5 双端一致 / 真机代码层闭合（实测 + 既有结论引用）
- 逻辑层零平台分支：`core-no-platform.test.ts` 3/3 通过（C4 已佐证运行时零平台）。
- 同手势→同 InputState：`input-abstraction.test.ts` 2/2；`wechat-touch` / `wechat-lifecycle` 单测固化。
- 微信入口链闭合：`dist-wechat/game.js`（37,723 B）为入口，经 `weapp-adapter` + `index.js`（`require` 注入），与 sprint-01 §4 既有结论一致。
- 进度链双端同源：`LEVEL_ORDER=['1-1','1-2']`（`core/config/index.ts:49`），`SaveManager` 注入 `LEVEL_ORDER` 推导解锁，`hasNext` 驱动「下一关」按钮（`result-screen.ts`），双端同逻辑。
- 真机/模拟器量测（热区、onHide/onShow、音频解锁、存储、节拍平台、1-2 进度链）**代码层已闭合，待 `manual-regression-g3-g9.md` §1/§2/§3/§4/§8/§9 真机执行**（环境依赖，沙箱不可跑微信真机）。

---

## 4. 已知风险与 CONCERNS

1. **CONCERN-1 · Web 包体增长、逼近上限**：Web 主包由 phase4 的 ≈1.47 MiB 增至 ≈1.49 MiB（增量 ≈16 KiB，来自 1-2 关卡数据 / BeatClock / SaveManager / 进度链等）。按 MiB 口径仍 PASS（余量 ≈14 KiB），但余量偏紧，与 sprint-02 C5「包体紧贴上限」同性质。
   - 缓解：建议 S06-4 最终构建做 Phaser/逻辑分包或 atlas 单图集（asset-manifest §5）留余量；确认阈值口径（MiB vs 十进制 MB）。**非阻塞**。
2. **CONCERN-2 · 真机量测仍 open（归 G3/G9）**：Sprint 3 的 C4 触屏热区、QA 真机复验，与 S05-1 节拍平台、S05-3 存档迁移、1-2 进度链，均需用户在 Web / 微信模拟器 / 微信真机三端执行（清单 §8/§9 已纳入）。代码层闭合，不阻塞 Phase 5。
   - 缓解：执行 `production/sprint-06/manual-regression-g3-g9.md`（§1/§2/§3/§4/§8/§9），留痕后关闭 G3/G9。
3. **CONCERN-3 · 评级标识符历史债已结清（G5）**：`result-screen.ts` 已由 `star`→`rank` 重命名 + 矢量原创菱形星（`drawRank`），`art/ip-review.md` 标 RESOLVED；旧档 `stars`→`ranks` 迁移见 §8 手测。仅作记录，无新增风险。
4. **沿用 sprint-02 既有过程纪律**：Sprint 3 收口后各 Story 须唯一执行 agent，禁止双写同名文件（sprint-02 C6 纪律）。

---

## 5. 主理人独立核验记录（quality-lead 亲跑）

- `npx tsc --noEmit` → **exit 0，0 错** ✅（C1）
- `npx vitest run` → **37 files / 258 tests 全过**，exit 0 ✅（C2）
- `npm run build:web` → exit 0；`dist/index.html`(572) + `dist/assets/index-C7nBkFoj.js`(1,557,529) = 1,558,101 B ✅（C3）
- `npm run build:wechat` → exit 0；`dist-wechat/index.js`(1,644,106) + `weapp-adapter.js`(51,324) + `game.js`(37,723) + 配置(976) = 1,734,129 B ✅（C3）
- Grep `src/core` 平台 API → 仅 1 doc 注释命中，0 真实调用 ✅（C4）
- `core/config/index.ts:49` `LEVEL_ORDER=['1-1','1-2']`、`result-screen.ts` `hasNext` / `drawRank`、`save-data.ts` `migrate()` 代码层核对 ✅（C5 / G5）

---

## 6. 出口决策

- Sprint 3 的 5 项质量卡点（C1 类型检查 / C2 单测 / C3 双构建 / C4 core 零平台 / C5 双端一致）**全部达标**，工程侧判定 **PASS（条件通过）**。
- 唯一未闭环项为**真机/模拟器量测**（CONCERN-2），代码层已闭合，归 `manual-regression-g3-g9.md`，不阻塞 Phase 5 启动。
- **关闭 G8②：Sprint 3 质量门补核完成** —— G8②「Sprint 3 代码已落盘但未走正式 Sprint 3 质量门 → open」经本门补核后，由 open 转为 closed（流程缺口消除；工程侧本无 FAIL）。
- 待主理人确认：① 包体阈值口径（MiB vs 十进制 MB，CONCERN-1）；② 是否需对 Sprint 3 C1–C5 卡点定义做微调（本门沿用项目既有门框架，未作新增）。

> 备注：本门为 quality-lead 建议性质量门判定；高影响动作（git commit / 发布签字）须经主理人审批。**未做 git commit（按指令）**。
