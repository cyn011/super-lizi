# ADR-005 · 固定步长 60Hz 主循环与渲染分离

- **状态**：Accepted（手感第一优先级的架构基石）
- **日期**：2026-07-21
- **作者**：程基岩（engineering-lead）

## 背景
手感是本项目第一支柱（P1·跳）。coyote 100ms、jump buffer 120ms、二段跳窗口、短跳比例等均为**时间敏感**指标，须在双端**逐帧一致、可量化复现**。若直接用渲染帧（RAF，频率随设备 30–144Hz 漂移）驱动物理，手感将与设备强相关且不可测。

## 决策
采用 **固定步长累加器（fixed timestep accumulator）**：
- 仿真步长 `STEP_MS = 1000/60 ≈ 16.667ms`，与 GDD 一致（02 `dt=1/60`、03 验收基于 60Hz）。
- `game-scene.update(realDelta)`：累加 `realDelta`（封顶 250ms 防追帧爆炸），`while(acc>=STEP_MS){ stepSimulation(STEP_MS); acc-=STEP_MS; }`，每步推进 `core` 全部系统（输入采样→物理→角色→敌人→受伤→经济→关卡→节拍）。
- 仿真时钟 `simTimeMs` 仅在 `stepSimulation` 内按 `STEP_MS` 累加；所有 ms 计时器（coyote/jumpBuffer/iframe/combo/stun/fire/`jumpPressedAt`）以此为准 → Web 与微信逐帧一致。
- 渲染：`render(alpha=acc/STEP_MS)` 读 `core` 最新 state；像素风 + `roundPixels:true` 默认按整数位置绘制（不强制子像素插值），保证像素不被插值模糊；如需平滑仅对非像素层启用 `alpha` 插值。
- 输入采样在固定步内进行（非渲染帧），避免低端机输入延迟（GDD 01 §8）。

## 备选
- **可变步长（RAF dt 直驱物理）**：手感随帧率漂移、不可量化、双端不一致、且大 dt 易穿透；否决。
- **依赖 Phaser Arcade 物理自动积分**：黑盒、难控 coyote/buffer 细节、不可 headless 单测；否决（本项目自写 `core/physics` 纯函数）。
- **半固定步（如 30Hz 物理 + 插值）**：手感窗口精度下降、与 GDD 60Hz 参数不符；否决。

## 后果
- 正面：手感确定性 + 双端一致 + `core` 可 headless 单测与确定性冒烟（§9.4）+ 手感沙盒指标可复现。
- 负面/风险：实现需严格"状态与渲染分离"纪律（core 不持有任何 Phaser 对象）；`STEP_MS` 与 GDD ms 参数须一致（已在 config 集中，防止漂移）；极端卡顿封顶追帧可能短暂慢动作（可接受）。
