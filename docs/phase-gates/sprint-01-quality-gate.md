# Sprint 1 质量门报告（S1-ENG）

> 范围：E1.S1~S4 + E2.S1/S2（解风险底座）
> 编制：主理人游承峰（独立核验 engineering-lead 交付）
> 日期：2026-07-21

## 1. 判定结论

**判定：PASS（条件通过）** — 工程侧全部硬指标绿灯，唯一余项 R2 需人工真机/模拟器验证（代码层已确保闭合）。

| 指标 | 结果 | 证据 |
|------|------|------|
| `tsc --noEmit` 类型检查 | ✅ 0 错误 | engineering-lead 收口后跑通（已修复 character-controller / wechat-platform 类型） |
| `vitest run` 确定性单测 | ✅ 10/10（3 文件） | 主理人独立复跑通过 |
| `build:web` 出包 | ✅ dist/ | index.html + assets/index-*.js ≈1.42MB（gzip 343KB）≤1.5MB |
| `build:wechat` 出包 | ✅ dist-wechat/ | index.js ≈1.42MB + weapp-adapter.js 51KB + game.js + game.json；主包≈1.48MB ≤2.7MB |
| `src/core` 零平台 API | ✅ 通过 | 主理人 Grep：`phaser|wx|localStorage|AudioContext|navigator|window` 零命中 |
| R2 入口链闭合 | ✅ 代码层 | `dist-wechat/game.js:3-4` → `require('./weapp-adapter')` → `require('./index')` |
| 双端输入一致性 | ✅ 通过 | `input-abstraction.test.ts:25` `expect(wx).toEqual(web)` |

## 2. 各 Story 验收自检（来自 engineering-lead，主理人抽检）

- **E1.S1 微信最小可运行 demo**：main.ts / boot-scene / game-scene / platform/wechat/* / ui/touch-buttons 齐备；触屏按钮半径 0.07~0.08×512≈36~41px → 直径 72~82px ≥48px（配置层达标，真机量测随 R2）；逻辑层零平台分支。
- **E1.S2 Vite 双构建**：web/wechat 均出包；core 无 wx/DOM 依赖。包体 1.42MB 紧贴预算（Phaser 占主体）。
- **E1.S3 三层骨架+配置+事件总线**：core/platform/game/ui 三层齐备；EventBus 单测 4 项通过；数值全来自 `src/config/*.json`。
- **E1.S4 固定步长主循环**：`fixed-step.ts` 累加器，`STEP_MS=1000/60`，`realDelta` 封顶 250ms，`simTimeMs` 仅步进内累加（确定性）。
- **E2.S1 物理/碰撞**：`body.stepBody`（3 参 + `CollisionWorld`）/ `collision.CollisionWorld` / `isGrounded`；单测 4 项覆盖自由落体确定性、穿透 15<32、isGrounded、分轴解算。
- **E2.S2 输入抽象**：input-abstraction / raw-input / web-keyboard / wechat-touch / input-config 齐备；单测 2 项验证「Web 键盘 ≡ 微信触屏 同 InputState」+ `jumpPressedAt` 精度。

## 3. 已知风险与缓解（CONCERNS）

1. **R2 真机验证（人工项）**：本沙盒无微信开发者工具/GUI，无法自验真正跑通。代码层已确保入口链闭合、adapter 注入、逻辑层零 wx/DOM 分支。
   - 缓解：请质量/主理人在微信开发者工具导入 `dist-wechat/` 验证「空场景 + 可动栗宝 + 触屏双按钮」。
2. **角色控制器占位（E2.S3 范围）**：`CharacterController.consume` 当前为占位空操作骨架；coyote/buffer/二段跳单测按 testing.md §8 归属 Sprint 2。本期未做。
   - 缓解：Sprint 2 控制器实装后立即补 §4.3 单测。
3. **工具链版本钉死（待决策）**：本工程钉 `phaser ^3.90 / vite ^5.4 / vitest ^2.1 / ts ^5.9 / weapp-adapter ^1.0`，而非 latest（Phaser 4 / Vite 8 / Vitest 4 / TS 7）。
   - 缓解：建议保持稳定钉版至发布后；升级大版本属高风险动作，需单独评估。
4. **Vitest 池配置（环境适配）**：本沙盒 fork 池会被 SIGKILL（内存），已改 `vitest.config` `pool:'threads'`（纯逻辑 Node 单测无影响）。CI 资源充足可还原 fork。
5. **包体紧贴上限**：1.42MB 紧邻 1.5MB（Web）/2.7MB（微信）预算。
   - 缓解：Sprint 2 起做 Phaser/逻辑分包或 atlas 单图集（asset-manifest §5）留余量。

## 4. 主理人独立核验记录

- Grep `src/core` 对 `phaser|wx|localStorage|AudioContext|navigator|window`：零命中 ✅
- 主理人复跑 `vitest run`：10 passed (3 files) ✅
- `dist/` 产物：`index.html` + `assets/index-DwqXUxew.js`(1,490,347B) ✅
- `dist-wechat/` 产物：`index.js`(1,489,616B) + `weapp-adapter.js`(51,324B) + `game.js` + `game.json` ✅
- `dist-wechat/game.js:3-4` 入口链闭合 ✅
- `vite.config.ts` 双构建 + `IS_WECHAT` define 对齐文档 ✅
- `package.json` 钉版确认 ✅

## 5. 出口决策

- R2 真机验证可由用户在微信开发者工具并行完成，不阻塞 Sprint 2 启动。
- 建议：进入 **Sprint 2（手感量化：E2.S3/S4/S5）**，并确认版本钉版策略（见 §3-③）。
- 未做 git commit（按指令）。
