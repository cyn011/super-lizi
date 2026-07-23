# ADR-001 · 引擎选型：Phaser 3（TypeScript + Vite）

- **状态**：Accepted（已在 Phase 1 概念 + Phase 2 系统设计中锁定）
- **日期**：2026-07-21
- **作者**：程基岩（engineering-lead）

## 背景
项目为原创"马里奥式"横版跳跃微信小游戏，需 Web + 微信小游戏双端、像素风、核心手感优先、lean 评审、MVP 包体严格（主包 4MB / 整包 8MB）。需在 Phase 3 正式确认引擎，作为后续所有代码骨架的根基。

## 决策
采用 **Phaser 3 + TypeScript + Vite**。

理由（与项目约束对齐）：
1. **双端覆盖**：Phaser 3 在 Web 经标准 `Phaser.Game` 运行；在微信小游戏经 `weapp-adapter` shim + `wx.createCanvas()` 运行（`Phaser.AUTO`），社区已验证可行。
2. **像素风友好**：原生 `pixelArt:true` + `Scale.FIT` + `roundPixels:true` + `antialias:false`，完美匹配美术圣经 512×288 / 32px 网格规范，无需额外管线。
3. **手感确定可控**：提供场景循环与渲染，但**物理/角色逻辑由本项目 `core/` 自写固定步长实现**（非依赖 Arcade 物理的自动积分），手感参数全集中 config，便于沙盒量化。
4. **TypeScript + Vite**：类型安全降低 lean 模式返工；Vite 提供快构建、tree-shaking、JSON 直导、`weapp-adapter` 打包，且 Vitest 原生测试。
5. **生态/成本**：开源免费、文档充足、图集/音频/对象池等内建支持，契合零成本 lean。

## 备选
- **纯自研 Canvas/WebGL 引擎**：完全可控但工作量与风险远超 lean MVP，否决。
- **Unity / Cocos Creator**：Cocos 对微信更原生，但本项目已定 TypeScript 心智模型、Phaser 轻量且包体更可控；Unity 导出微信成本高、包体大，否决。
- **PixiJS（仅渲染）**：更轻，但缺场景/输入/音频/物理统筹，需自研更多，否决。

## 后果
- 正面：双端统一代码库、像素管线开箱即用、TS+Vite 工具链顺滑、确定性强。
- 负面/风险：微信需 `weapp-adapter` 适配层（见 ADR-003）；Phaser 包体本身需 tree-shaking 与按需引入以守 4MB；WebGL 在部分微信环境回退 CANVAS 需验证。
- 约束：`game/` 仅作薄胶水，重逻辑下沉 `core/`，避免被 Phaser 生命周期绑定导致不可测。
