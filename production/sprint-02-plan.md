# Sprint 2 计划（手感量化 E2.S3/S4/S5）

> 阶段：Phase 4 预制作 → 第 2 个冲刺（核心手感）
> 编排：游承峰（主理人）｜执行：engineering-lead｜验证：主理人独立跑 vitest + 静态扫描
> 前置：Sprint 1 已收口，质量门 PASS（条件）；R2 真机验证可由用户并行完成

## 1. 目标
- 核心手感量化达标（control-list §1 全部 10 项落入区间），解锁后续关卡内容。
- 交付可单测的 `CharacterController`（coyote / jump buffer / 二段跳 / 可变跳高 / 踩踏）与 `DamageStateMachine`（受伤形态 + 无敌帧 + 生命）。
- 提供 dev 手感沙盒场景供人工量化（E2.S5）。

## 2. 范围（Story）
| Story | 交付 | 可验证性 |
|---|---|---|
| E2.S3 角色控制器 | `src/core/character/character-controller.ts` 实现 `consume()` 全逻辑 + `tests/unit/character/character-controller.test.ts` | 单测（主理人跑） |
| E2.S4 受伤状态机 | `src/core/damage/damage-state-machine.ts` + 新建 `src/config/damage-config.json` + `tests/unit/damage/damage-state-machine.test.ts` | 单测 |
| E2.S5 手感沙盒 | `src/scenes/sandbox-scene.ts`（dev 构建，import Phaser 合法）浮层实测 §1 | 手动（不写单测） |

## 3. 铁律与硬约束
- `src/core/**` 零 `import 'phaser'`、零 `wx/localStorage/AudioContext/navigator/window` 运行时分支。
- 所有数值来自 `src/config/*.json`（真理源），经 `src/core/config/index.ts` 读取，禁止硬编码。
- **engineering-lead 只写文件，绝不运行 npm install / build / test / tsc / vitest**（沙盒 OOM 风险；主理人亲自跑验证）。
- 不改 `package.json` / `vite.config` / 构建脚本 / 已有 3 个测试；不删已有文件；不 git commit。

## 4. 规格冲突裁决（重要）
- **短跳高度**：epics 写 `v.y*=0.5`（物理上→高度 25%），但 control-list §1 卡点要求短跳高度 = 全跳 **45–55%**。
- 裁决：**卡点优先**。实现短跳为 `vy *= SHORT_HOP_CUT`，取 `SHORT_HOP_CUT=0.7`→高度≈49%（落入 45–55%）。在 `character-config.json` 新增 `shortHopCut: 0.7` 字段并同步 `CharacterConfig` 接口。偏差记入本报告 §6。
- 其余数值沿用既有 config（moveSpeed140/accelGround1200/accelAir800/friction1600/gravity1800/jumpVelocity-480/coyoteMs100/jumpBufferMs120/doubleJumpScale0.9/stompBounce-300/airJumps1；physics tile32/gravity1800/maxFall900）。

## 5. 验收（引用 control-list §1）
- 全跳高度 ≈64px(60–68) / 二段跳 ≈1.6tiles(50–56) / 短跳 45–55% / coyote 有效≤100ms / jump buffer≤120ms / 二段跳 1 次落地重置 / 水平 0→满速≤0.2s / 松键→停≤0.15s / 踩踏反弹-300 / 双端一致。
- `core/` 零平台 API 静态扫描 0 命中。
- 单测全绿（character + damage）。

## 6. 已知偏差与风险
- §4 短跳系数偏差（epics 0.5 vs 卡点 0.7）— 已裁决按卡点。
- E2.S4 在 epics 依赖图标注依赖 E3.S1/E4.S1，但状态机本身为纯逻辑，本冲刺先行实现模块 + 单测，集成留待 E3/E4。
- E2.S5 沙盒仅 dev，不进主包逻辑；其手感指标以 §5 单测为主证据，沙盒为人工复核。
- 沙盒 OOM：验证由主理人低压跑 vitest，agent 不跑命令。

## 7. 出口门（Sprint 2 质量门）
- 主理人跑 `vitest run` → character + damage 单测全绿。
- Grep `src/core` 零平台 API。
- E2.S5 沙盒场景存在（手动验证随用户 R2 环境）。
- 未达 §5 指标不得进入 Sprint 3 内容铺设（control-list §1 卡点）。
