# Sprint 2 质量门报告（手感量化 E2.S3 / S4 / S5 + R2 真机修复）

> 编排：游承峰（主理人）｜执行：engineering-lead-2（D1/D2/D3 文件落地）｜独立验证：主理人亲跑 vitest + 静态扫描 + R2 代码层核验
> 评审强度：lean（仅出口门过质量门）
> 前置：Sprint 1 质量门 PASS（条件）；control-list §1 卡点为硬出口

## 判定：PASS（条件） — 5 CONCERNS（均非阻塞）

---

## 一、交付物清单（已落盘）

| ID | Story | 路径 | 可验证性 |
|----|-------|------|----------|
| D1 | E2.S3 角色控制器 | `src/core/character/character-controller.ts` + `tests/unit/character/character-controller.test.ts`（8 it） | 单测 |
| D2 | E2.S4 受伤状态机 | `src/core/damage/damage-state-machine.ts` + `src/config/damage-config.json` + `tests/unit/damage/damage-state-machine.test.ts`（6 it） | 单测 |
| D3 | E2.S5 手感沙盒 | `src/game/scenes/sandbox-scene.ts`（DEV 守卫，import Phaser 合法） | 手动 |
| R2 | 真机 'in' 修复 | 三处 `game.js` shim：根目录 / `public/` / `dist-wechat/`（注入事件属性 polyfill） | 代码层闭合 |

---

## 二、独立核验证据（主理人亲跑，非 agent 自报）

1. **单元测试**：`npx vitest run`（NODE_OPTIONS=--max-old-space-size=1024），结果 **5 files / 25 tests 全过**，1.78s，stderr 为空。
   - character 10 · damage 5 · physics 4 · input 2 · events 4
   - 修订轨迹：D1/D2 初版落盘为 24/24（character 8 + damage 6，engineering-lead-2）；engineering-lead 后续同名交付覆盖为 25 tests 且 **1 失败**（其 test #2 对 `coyoteTimer` 的断言写错——要求起跳后仍 >0，但 `consume()` 在 `character-controller.ts:130` 已正确将 `coyoteTimer` 置 0）。主理人定位并删除该错误断言一行后回归 **25/25**（详见 §八）。
2. **core 零平台 API 静态扫描**：Grep `src/core` 对 `phaser|wx|localStorage|AudioContext|navigator|window|document` —— **0 处真实调用**（唯一命均为 doc 注释中的"零 Phaser / 零平台依赖"字样）。铁律保持。
3. **数值推导复核**（engineering-lead-2 提供，落 plan §5 卡点）：
   - 全跳 ≈64px ／ 二段跳 ≈51.84px ／ 短跳 ≈49% ／ 水平 0→满速 ≈0.117s ／ 松键→停 ≈0.0875s ／ 踩踏 -300
   - 全部落入 control-list §1 区间。
4. **R2 shim 核验**：根 `game.js` IIFE 完整（`defineIfMissing` 守卫 + `try/catch` 退化赋值），`dist-wechat/game.js` 与 `public/game.js` 已同步同一 shim。Phaser `Device/Features` 的 `'ontouchstart' in window` 等检测不再抛 `TypeError`。

---

## 三、control-list §1 卡点对照

| 指标 | 卡点 | 实测 | 结论 |
|------|------|------|------|
| 全跳高度 | 60–68px | ≈64px | ✅ |
| 二段跳高度 | 50–56px（≈1.6 tile） | ≈51.84px | ✅ |
| 短跳高度 | 45–55% | ≈49%（shortHopCut=0.7） | ✅ |
| coyote 有效 | ≤100ms | 100ms | ✅ |
| jump buffer | ≤120ms | 120ms | ✅ |
| 二段跳次数 | 1（落地重置） | airJumps=1 | ✅ |
| 水平 0→满速 | ≤0.2s | ≈0.117s | ✅ |
| 松键→停 | ≤0.15s | ≈0.0875s | ✅ |
| 踩踏反弹 | -300 | stompBounce=-300 | ✅ |
| 双端一致 | 是 | core 零平台分支（同 InputState） | ✅ |

---

## 四、规格冲突裁决记录（已记入 plan §4 / §6）

- **短跳系数**：epics 写 `vy *= 0.5`（物理高度仅 25%），与卡点 45–55% 冲突。**裁决：卡点优先**，实现为 `vy *= shortHopCut`，取 `shortHopCut = 0.7` → 高度 ≈49%。`character-config.json` 新增 `shortHopCut` 并同步 `CharacterConfig` 接口。

---

## 五、质量门判定

**PASS（条件）**

- 硬阻塞项：无
- **CONCERNS（非阻塞，需跟踪）**：
  - **C1 — R2 真机复验待确认**：shim 已在代码层闭合（R2 + R2-bis 两轮修复），但缺真机/微信开发者工具实测证据。需用户重新编译 `dist-wechat/` 确认红色 `TypeError` 消失。**R2-bis（2026-07-22 03:16）**：用户复验仍报红，错误从 `'in' in game.js` 变为 `'in' in **undefined**`——说明首轮 shim 对 window/document 已生效，但 `document.documentElement` 在微信环境下为 undefined，原 shim 的 `if` 守卫跳过了它。已补 `ensureDomNode()` 在注入前创建缺失 DOM 节点为空对象，三处 game.js 同步。
  - **C2 — D4 主场景未接入**：`game-scene` 尚未调用 `controller.consume()` + `stepBody()` 真实手感；当前手感证据来自沙盒 + 单测，主场景集成手感偏差风险未消除。
  - **C3 — `dist/game.js` 为 stale 旧版**：使用裸 `require('weapp-adapter')` 且无 shim，与 `dist-wechat/` 不同步（R2 导入目标是 `dist-wechat/`，故不影响 R2；但属潜在混淆源）。
  - **C4 — shortHopCut=0.7 偏离 epics**（已知偏差，已裁决，记 plan §6）。
  - **C5 — 端到端"手感"无自动化断言**：control-list 数值已在单测覆盖，但真实跳感（如落地顿挫、输入延迟体感）依赖人工沙盒复核，无 CI 断言。
  - **C6 — 双 agent 同名交付冲突（过程风险）**：engineering-lead 与 engineering-lead-2 均交付了 Sprint 2 同名文件；后者（晚到）覆盖前者并引入 1 个失败测试，已由主理人修复。后续冲刺**须指定唯一执行 agent**，禁止两个 agent 写同一组文件，避免重复覆盖与口径分歧。

---

## 六、已知风险与缓解

| 风险 | 缓解 |
|------|------|
| R2 真机复验未过 | shim 已注入；请用户在微信开发者工具重新编译 `dist-wechat/` 看红错是否消失，若仍报错截图继续修。 |
| D4 接入后手感漂移 | 建议 Sprint 3 首 Story 将沙盒指标搬到 `game-scene` 实测，并补 1 个"接入后手感回归"冒烟用例（手动）。 |
| `dist/` 不同步 | 建议统一构建入口或删除 stale `dist/`（如不再使用），避免后续混淆。 |
| 版本控制缺失 | cwd 当前 **非 git 仓库**（`git status` 报 not a git repository），"未 commit"实为无仓库；如要纳入版本管理需 `git init` + 首提交。 |

---

## 七、出口结论

Sprint 2 工程落地达标，质量门 **PASS（条件）**。R2 代码修复已闭合，待用户真机复验（C1）确认后即为完全 PASS。据此可解锁 Sprint 3 内容铺设（E3.S2 敌人 AI → E4.* 关卡 → E5.S1），前提是 **C2（主场景接入）在 Sprint 3 早期补做**，否则"沙盒过 ≠ 实场景手感过"。

---

## 八、过程事件与修订（audit trail）

- **事件**：Sprint 2 收口后，两名 teammate（engineering-lead、engineering-lead-2）各自交付了同名文件（`character-controller.ts` / `damage-state-machine.ts` / 其测试）。初版（engineering-lead-2）经主理人核验为 **24/24 全绿**；随后 engineering-lead 的晚到写覆盖为 **25 tests 且 1 失败**。
- **根因**：engineering-lead 在其 `character-controller.test.ts` 的 coyote "部分衰减"用例（test #2）中，于 `consume()` 之后断言 `coyoteTimer > 0`，但 `consume()` 在土狼/单跳成功时于 `character-controller.ts:130` 将 `coyoteTimer` 置 0（已消耗土狼窗口，标准且正确行为）。该断言与实现自相矛盾——属**测试写错，非源码缺陷**（同文件 test #1 已正确证明土狼跳触发且未做此错误断言）。
- **处置**：主理人将错误断言一行（`expect(cc.state.coyoteTimer).toBeGreaterThan(0)`）删除，保留 `vy === jumpVelocity` 断言；复跑 vitest 得 **25/25 全绿**，且覆盖优于初版（10 character + 5 damage）。
- **偏差说明**：本应路由 engineering-lead 自修，但其 `SendMessage` 因框架 "400 input length too long" 失败，teammate 进入 failed 态；主理人遂就地做最小化一行修正（编排者原则例外，因通道故障且修正已完全诊断），并以主理人亲自复跑 vitest 保留 oversight。
- **后续纪律**：Sprint 3 起每个 Story 仅指定**一名**执行 agent，避免双写同名文件；agent 失败后优先用极短指令续修，长文走文件/工件而非聊天通道。
