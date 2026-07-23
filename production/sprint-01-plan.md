# super-mali · 首个冲刺计划（Sprint 1 — 解风险）

> 阶段：Phase 4 预制作 · 汇编交付
> 作者：游承峰（主理人 / Orchestrator）
> 输入：production/epics.md（程基岩）、design/ux/ux-spec.md（文策渊）、art/asset-manifest.md（林绘澄）、docs/architecture/control-list.md
> 目标：解除最大技术风险 R2（微信 weapp-adapter 运行），打通可运行底座 + 固定步长 + 物理/输入骨架；为 Sprint 2（手感）铺路。

---

## 1. Sprint 1 范围（取自 epics.md Sprint 编排建议 S1）

| Story | Epic | 优先级 | 验收要点（引用 control-list） | 主要产出 |
|---|---|---|---|---|
| E1.S1 微信最小可运行 demo | E1 | **P0 首要** | 微信开发者工具可运行；触屏热区≥48px；逻辑层零 wx/keyboard/touch 分支；过 **R2** | `game/main.ts`、`boot-scene.ts`、`platform/wechat/*`、`platform/detect.ts`、`ui/touch-buttons.ts`、Vite 微信骨架 |
| E1.S2 Vite 双构建（Web+微信） | E1 | P0 | `build:web`/`build:wechat` 均出包；主包 JS≤1.5MB；core 无 wx/DOM 依赖 | `vite.config.ts`、`package.json` scripts、微信工程配置 |
| E1.S3 三层骨架+配置+事件总线 | E1 | P0 | core 零 `import phaser`；EventBus 单测通过；数值全 config 无硬编码 | `core/*`/`platform/*`/`game/*`/`config/*.json` 骨架、`event-bus.ts` |
| E1.S4 固定步长主循环（ADR-005） | E1 | P0 | 同输入序列步进数/ simTimeMs 确定；realDelta 封顶≤250ms | `fixed-step.ts`、`game-scene.ts` 步进骨架 |
| E2.S1 物理/碰撞 | E2 | P1 | 静止 60s 不陷；单向/移动平台正确；穿透 15<32 | `core/physics/*` |
| E2.S2 输入抽象（GDD 01） | E2 | P1 | 双端**完全相同** InputState 序列；逻辑层零键盘/触屏分支 | `core/input/*`、`web-keyboard.ts`、`wechat-touch.ts`、`input-config.json` |

> 顺序：E1.S1 → E1.S2/S3/S4（并行）→ E2.S1/S2。手感(S2.S3+) 留给 Sprint 2。

---

## 2. 本 Sprint 专项质量门（主理人卡点）

1. **R2 解除证明**：E1.S1 必须在微信开发者工具中真实导入运行（空场景+可动精灵+触屏双按钮），否则不得进入 Sprint 2 内容开发。
2. **架构铁律静态扫描**（control-list §4.1）：`core/**` 零 `import phaser`、零 `wx/keyboard/touch/localStorage/AudioContext` 字样 → CI 脚本。
3. **包体预算**（control-list §2）：主包 JS（min）≤1.5MB；music/SFX 不进主包。
4. **输入一致性单测**（testing.md §3-①）：Web 键盘 vs 微信触屏 → 同 InputState 序列，固化断言。

---

## 3. 待用户拍板的决策（阻塞部分 Sprint 2+ 内容，不阻塞 Sprint 1 底座）

> 以下由三路成员在 Phase 4 提出，需在 Sprint 1 收尾前定稿，写入对应 GDD/ADR。详见本文件 §5。

---

## 4. 已知风险与缓解（继承 Phase 3）

| 风险 | 等级 | Sprint 1 缓解 |
|---|---|---|
| R2 微信 weapp-adapter 运行 | 高 | E1.S1 首要交付，真机/模拟器验证 |
| R1 包体 | 中 | E1.S2 预算卡点；atlas 单图集（asset-manifest §5） |
| R3 手感跨端 | 中 | 固定步长+输入固定步采样；Sprint 2 手感沙盒量化 |
| R4 双构建复杂度 | 低 | VITE_PLATFORM 裁剪；先通单构建再复制微信 |

---

## 5. 决策已拍板（2026-07-21 用户确认）

### A. 来自 UX 规格（design-strategist）
- A1 LEVEL_SELECT 是否 MVP 实体化：建议单关 MENU 直进 PLAYING，保留态留多关。
- A2 首关新手引导是否 MVP 必做：建议轻量非阻塞引导（移动→跳→二段跳→踩敌）。
- A3 失败界面是否显示原因文案：建议极简"再试一次"，避免恐吓。
- A4 结算星级权重：时间 vs 金币收集率，建议各 50%。

### B. 来自资产规格（art-director）
- B1 主题切换：建议"基础瓦片集 1 份 + 洞穴/天空运行时 tint 换色"（省图集/工作量）；全量重绘三套仍 <400KB 但美术 ×3。
- B2 锥冲 MVP 消灭路径：归 Could（纯障碍，规避/顶击；不可踩、踩则伤）。若 MVP 需可消灭请告知。
- B3 UI 图标走矢量不入图集（ADR-004 已定，知悉即可，非阻塞）。

> 以上 A1–A4、B1–B2 需在 Sprint 1 收尾前拍板，写入 GDD 08（A1/A3/A4）、GDD 11（A1）、新增 onboarding 约定（A2）、美术圣经/资产规格（B1/B2）。B3 已定无需拍板。

---

## 6. 下一步
- 用户拍板 §5 → 主理人回填 GDD/ADR → 启动 Sprint 1 执行（调度 engineering-lead 落地 E1.S1~S4 + E2.S1/S2，art-director 备 P0 占位资产说明，design-strategist 待 onboarding 定稿）。
- Sprint 1 完成且 R2 解除 → 进入 Sprint 2（手感沙盒量化达标）。
