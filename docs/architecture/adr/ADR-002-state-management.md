# ADR-002 · 状态管理与场景架构

- **状态**：Accepted（主理人 2026-07-21 拍板：手写而非引入状态机库）
- **日期**：2026-07-21
- **作者**：程基岩（engineering-lead）

## 背景
本项目含多类"状态"：顶层会话流（启动/菜单/游玩/暂停/通关/失败）、实体受伤状态机（`DamageState`）、形态状态机（`FormState`，MVP 仅 BASE）、各敌人行为状态机、输入三态、关卡运行时状态。需要一致的、可测试、确定性的状态管理方案，且不得让逻辑层依赖 Phaser 生命周期。

## 决策
采用 **三层架构 + 手写显式状态机 + 轻量事件总线**：

1. **三层**：`core/`（纯逻辑，零 Phaser）/`platform/`（双端适配）/`game/`（Phaser 场景胶水）。逻辑全在 `core/`，场景仅编排与渲染。
2. **手写状态机**：
   - 顶层 `RunStateMachine`（`BOOT→MENU→PLAYING⇄PAUSED→LEVEL_COMPLETE/GAME_OVER`）于 `core/state/`，独立于实体状态。
   - `DamageState` 状态机于 `core/damage/`，按 GDD 07 §3 转换矩阵实现（FULL/SMALL/DEAD + INVINCIBLE 叠加，与 `FormState` 正交）。
   - 敌人 4 类行为**表驱动**（`state→transition` 映射）于 `core/enemy/`。
   - 输入三态由 `InputAbstraction` 维护。
3. **事件总线** `core/events/event-bus.ts`：core 发 `ON_*`、game/ui/audio 订阅，解耦音频占位、juice、HUD。
4. **场景**：Boot/Preload/Menu/Game/UI 场景（§6.1），Game 持有固定步长循环，UI 为并行透明场景。

## 备选
- **XState（状态机库）**：表达力强，但对本项目小型、已在 GDD 中以矩阵明确的有限状态机属过重；增加包体（违背 4MB）、引入学习成本、且确定性与可测性不如手写纯函数；lean 阶段不推荐。
- **Redux/Zustand 等全局 store**：适合数据而非时序状态机（coyote/buffer 窗口为时序），且包体与心智不符；否决。
- **Phaser 内置 Scene/State 承载全部状态**：会把逻辑绑死在 Phaser 生命周期，破坏 `core/` 可测性与双端一致性；否决。

## 后果
- 正面：状态机小而显式、可单测、确定性好、包体最小、与 GDD 矩阵一一对应、无外部依赖。
- 负面/风险：手写需纪律（禁止他系统直改 `sizeScale` 等单点状态，已在 GDD 07 与架构铁律约束）；复杂状态（未来 Boss 多阶段）需表驱动纪律维持。
- 已确认：主理人 2026-07-21 拍板认可"手写而非引入状态机库"。手写显式状态机 + 轻量事件总线为终稿方案，无需 XState/Redux。
