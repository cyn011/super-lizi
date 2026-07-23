# Phase 4 预制作质量门（Quality Gate）

> 阶段：Phase 4 预制作收尾 → Phase 5 制作
> 主理人：游承峰（Yoan Summit）
> 日期：2026-07-23
> 上游：production/epics.md、production/testing.md、sprint-01/02/03、design/gdd/*、art/*、docs/architecture/*

---

## 一、交付清单（主理人汇编）

| 产出 | 负责人 | 路径 | 状态 |
|---|---|---|---|
| 正式资产规格（升级自 placeholder） | art-director（林绘澄） | `art/asset-spec.md` | ✅ 已交付 |
| 核心循环外 UX 规格（菜单/暂停/结算/元循环/种子蜕变 UI 壳） | design-strategist（文策渊） | `design/ux/core-loop-ux.md` | ✅ 已交付 |
| Sprint 04–06 蓝图 + 垂直切片"好玩"验收方案 | engineering-lead（程基岩） | `production/sprint-04-plan.md` | ✅ 已交付 |

---

## 二、质量门判定

**综合判定：PASS（条件通过 / CONDITIONAL PASS）**

### 通过项（PASS）
- **G1** 三份预制作产物齐全且交叉引用一致：资产规格对齐 GDD 04/05/08/09/11；UX 对齐 ADR-002 + hud-spec；冲刺对齐 epics.md 依赖图。
- **G2** 垂直切片"就绪"判定已定义（`sprint-04-plan.md` §4.3 九项门 G1–G8），含验证方法三段（headless 仿真冒烟 + 手感沙盒指标 + 双端手动回归）。
- **G3** 代码审计修正已确认：C3 受伤管线（`damage-resolution.ts`）、C5 关卡加载（`level-loader.ts`+`level-runtime.ts` 由真实 `1-1.json` 构建）均已真实落地——纠正了"硬编码占位未落地"的错误假设。
- **G4** 资产规格守住 ADR-004（单图集 PNG-8 ≤1MB / UI 矢量不入图集 / 音乐远程流式不进主包 / 主包预算 ≤2.7MB 留余量）。

### 待拍板项（CONCERNS，非阻塞 MVP 但事关差异内核）
1. **种子蜕变成长机制 GDD 缺失（关键）**：`design/concept/00-game-concept.md` §P3 将"种子精灵蜕变"列为**差异内核**（替代"蘑菇变大"），长期 MEMORY 亦记为差异内核；但 `design/gdd/11-meta-progression.md` 实际仅 `SaveData` 存档，`design/` 全目录无 seed/蜕变数据模型或事件常量。art-director 的蜕变视觉（`computeGrowth(maturity)` 参数化）与 design-strategist 的蜕变 UI 壳（`ON_SEED_COLLECTED/METAMORPHOSIS`）**均无数据来源**。
   → 须用户拍板方向：**A) MVP 砍掉蜕变、只做存档元循环**；**B) 补 GDD**（GDD 11 增 seed 子模型 或 另立 GDD 12）+ 加 `ON_SEED_*` 事件常量。
2. art-director 开放问题 **Q1**（蜕变参数来源：局内 buff / meta 累计 / hybrid）、**Q2**（音频枚举 +3：`SFX_DEATH`/`CHECKPOINT`/`UI`）——均非阻塞，建议 Sprint 04 启动前顺手拍板。
3. Sprint 3 代码已落盘（git 提交 `b85d7d7` 等）但**未走正式 Sprint 3 质量门**（`sprint-04-plan.md` §0.3 偏差②）——建议 Phase 5 首任务补核验 C1–C5 达标，作为手感卡点前置。

### 阻塞项（FAIL）：无

---

## 三、Phase 4 → Phase 5 放行结论

- 预制作底座扎实，可放行进入 **Phase 5 制作（Sprint 04 起）**。
- **放行条件**：用户就 CONCERNS #1（种子蜕变机制）给出方向；Q1/Q2 可在 Sprint 04 内顺手定。
- 若用户选择 **A) MVP 砍蜕变**：art-director §1 蜕变视觉、design-strategist §6.3 直接降级为 Could，不影响 Sprint 04 主线（4 敌 / 经济 / 关卡实体 / 暂停结算 / 存档 / 音频 / 双端）。
- 若用户选择 **B) 补 GDD**：由 design-strategist 出种子蜕变 GDD（数据模型 + 事件），再驱动 art/ux 实现，排期并入后续 Sprint。

> 备注：本质量门仅评审预制作文档产物与代码现状审计；真机/模拟器的 C4 双端复验仍属 Phase 5 首任务（sprint-04-plan R2 / G9）。
