# super-mali · Phase 3 质量门报告（技术搭建 / 架构设计）

> 评审强度：lean
> 主理人：游承峰（Orchestrator）
> 输入产物：
> - `docs/architecture/architecture.md`（主架构）
> - `docs/architecture/adr/ADR-001..005`（5 条决策记录）
> - `docs/architecture/architecture-review.md`（架构评审）
> - `docs/architecture/control-list.md`（控制清单）
> - `art/accessibility.md`（可访问性规范，MVP=Standard）

---

## 判定：**PASS（条件通过，2 项开放问题需主理人/用户拍板）**

架构骨架完整、11 个 GDD 接口契约全部可落地、三层隔离（core/platform/game）与确定性主循环设计到位，可以进入 Phase 4 实现。但有 2 项非阻塞性开放问题需用户拍板后才写入 ADR 终稿（不阻塞脚手架启动）。

---

## 1. 质量门清单（lean：聚焦关键门控项）

| # | 门控项 | 结论 | 证据 |
|---|---|---|---|
| G1 | 11 个 GDD 接口均可落地（无冲突/无悬空） | ✅ PASS | 架构 §13 逐条映射，评审 §3 摘要确认 |
| G2 | `core/` 零 Phaser 依赖、可 Node 单测 | ✅ PASS | 铁律 1 + §4；platform 唯一平台边界 |
| G3 | 逻辑层零平台分支（`wx`/DOM 不泄漏） | ✅ PASS | 铁律 2 + ADR-003 三段式输入 |
| G4 | 数值集中 config，无硬编码 | ✅ PASS | 铁律 3 + §10 配置表 |
| G5 | 固定步长 60Hz + 渲染分离 | ✅ PASS | ADR-005 + §7 |
| G6 | 包体策略守主包≤2.7MB/整包 8MB | ✅ PASS | ADR-004 预算表 |
| G7 | 双端输入一致性可验证（单测策略） | ✅ PASS | §11 + ADR-003 |
| G8 | IP 红线构建期兜底 | ✅ PASS | control-list §3 |
| G9 | 微信运行前提（weapp-adapter）已识别 | ⚠️ CONCERN | ADR-003 §6；列为 Phase 4 首要验证项 R2 |

> 说明：lean 强度下不逐条复跑 13 项全清单（详见 `architecture-review.md` 完整版），仅对门控项核验。G9 为已知风险而非架构缺陷，已纳入缓解计划，不构成 FAIL。

---

## 2. 关键风险（继承架构评审，带入 Phase 4）

| 风险 | 等级 | 缓解 | Phase 4 门控 |
|---|---|---|---|
| R1 包体（Phaser+图集逼近 4MB） | 中 | 图集≤1MB、音乐远程流式、SFX 合成、tree-shaking、子包 | control-list §2 |
| R2 微信 weapp-adapter 运行 | 高 | 适配层隔离；**Phase 4 先交付微信最小可运行 demo** | control-list §4 |
| R3 手感跨端差异 | 中 | 固定步长+输入固定步采样；手感沙盒量化指标 | control-list §1 |
| R4 双构建复杂度 | 低 | IS_WECHAT define 裁剪；先通单构建再复制微信变体 | — |

---

## 3. 待用户拍板开放问题（已定稿，2026-07-21 用户拍板）

### Q1 · 状态管理：手写 vs 库（ADR-002）— ✅ 已确认
- **决策**：手写显式状态机 + 轻量事件总线，**不引入 XState**。
- ADR-002 状态已置 Accepted。

### Q2 · 图集打包工具选型（ADR-004）— ✅ 已确认
- **决策**：`free-tex-packer`（开源零成本，输出 Phaser 兼容 atlas JSON），纳入 Vite 构建脚本；付费备选 `TexturePacker` 不采用。
- ADR-004 已回填确认。

> 2 项均已定稿，Phase 3 门全部关闭，无残留阻塞。进入 Phase 4。

---

## 4. 结论与下一步

- **Phase 3 关闭**：架构、5 ADR、评审、控制清单、可访问性规范齐备，判定 **PASS**。
- **进入 Phase 4 预制作**：并行产出 UX 规格、资产规格（含冲锋怪"锥冲"像素资产，弥补美术圣经仅有剪影规范的缺口）、Epic/Story 拆分、测试脚手架；汇编首个冲刺计划，并做垂直切片（1 关可玩）验证核心循环。
- **Phase 4 首要硬交付**：微信最小可运行 demo（空场景 + 1 可动精灵 + 触屏按钮），过 R2。
- **2 项开放问题**：见 §3，待用户拍板后回填 ADR 终稿。

---

## 附：与 Phase 2 门 CONCERNS 的衔接
Phase 2 门记录的 6 项次要开放问题（下穿单向平台 / 关卡长度 parTime / 结算星级权重 / 音频占位 vs 静音 / 元循环地图 vs 直进 / 节拍时钟）不阻塞本架构骨架，带入 Phase 4 实现期前拍板。
