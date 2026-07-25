# 本地化覆盖（Localization）· super-mali

> 角色：release-ops-lead（路远行）· 任务：P7-REL-01
> 范围：盘点当前 UI 文案（中文为主）与可本地化 seam；评估 MVP 是否需 i18n。
> 结论先行：**MVP 仅中文 → 本地化标 N/A**；下方给出后续 i18n 预留点，避免后期改造成本。

---

## 1. 结论

- 当前所有用户可见文案均为**简体中文硬编码**，无多语言框架、无字符串表。
- MVP 目标市场为中文（微信小游戏主力），**无需在 v0.9.0 / v1.0.0 做本地化** → 本地化 **N/A**。
- 但项目已具备良好 i18n 预留基础（见 §3），建议在未来多语言需求出现前**仅补"字符串抽取 seam"**，不急于上整套 i18n 框架。

---

## 2. 当前 UI 文案盘点（中文硬编码位置）

> 扫描 `src/`（排除测试）所得；均为运行时 `Phaser.Text` / 字符串常量。

| 文案 | 位置 | 类型 | 备注 |
|---|---|---|---|
| `分数` | `src/ui/hud-economy.ts` `SCORE_PREFIX` | HUD 前缀 | 中文 ≥14px 等效（accessibility §9.2） |
| `×N`（金币） | `src/ui/hud-economy.ts` | HUD | 用乘号 × 避免与连击 x 混淆 |
| `xN`（连击倍率） | `src/ui/hud-economy.ts` | HUD | 仅 mult>1 时显示 |
| `通关！` | `src/ui/result-screen.ts` | 结算标题 | 矢量面板 |
| `下一关` | `src/ui/result-screen.ts` | 结算按钮 | 末关隐藏 |
| `再玩一次` | `src/ui/result-screen.ts` | 结算按钮 | 热区 ≥48×48 |
| `用时 Xs` / `金币 X/Y` | `src/ui/result-screen.ts` | 结算信息行 | 数值格式化 |
| `暂停` | `src/ui/pause-menu.ts` | 暂停标题 | |
| `继续` | `src/ui/pause-menu.ts` | 暂停按钮 | → ON_RESUME |
| `重玩` | `src/ui/pause-menu.ts` | 暂停按钮 | → ON_RESTART |
| 触屏四钮图标（◀▶▲✦） | `src/ui/touch-buttons.ts` | 图形（无文本） | 纯 Graphics 绘制，零文本 |
| 命数心形 / 评级菱形星 | `src/ui/hud-hearts.ts` / `result-screen.ts` | 图形（无文本） | 矢量，无 unicode 字符 |

**观察**：
- 文本量极小（约 10 处），且全部集中在 `ui/` 层（HUD / 结算 / 暂停）。
- 无位图字体（ADR-004：禁位图字体，用系统 `sans-serif`）→ **换语言无需换美术资产**，i18n 成本低。
- 无 RTL 需求（中文/英文均为 LTR）。
- 音频/视觉反馈无文本（SFX 程序化、图形矢量），不受本地化影响。

---

## 3. 可本地化 Seam 分析（i18n 预留点）

### 3.1 已具备的利好 seam
- **系统字体渲染**：`TEXT_FONT = 'sans-serif'`（result-screen / hud），不依赖位图字体 → 切换语言字符串即生效，零资产改动。
- **纯函数文本格式化**：`src/ui/hud-economy.ts` 的 `formatScore/formatCoins/formatCombo` 与 `result-screen.ts` 的 `evaluateRanks` 均为零 Phaser / 零平台纯函数，可单测、易抽取。
- **中枢常量集中**：`SCORE_PREFIX` 等已抽为 `export const`，易于迁移到字符串表。

### 3.2 待补的 i18n 预留点（建议，非阻塞）
| # | 预留点 | 做法 | 优先级 |
|---|---|---|---|
| L1 | **字符串表抽离** | 新增 `src/config/strings.zh.json`（或 `src/i18n/strings.ts`），把所有中文文案迁入；运行时按 `locale` 取。当前硬编码处改为查表 | P3（需求出现前可做） |
| L2 | **locale 注入点** | 在 `Platform` 或 `game-scene` 注入 `locale`（如 `'zh'`），默认 `'zh'`；未来加 `'en'` 等 | P3 |
| L3 | **Reduce Motion 同款开关模式** | 参考 `platform.reduceMotion` 的"可选字段 + 默认 false + 后续注入"模式，i18n 亦可用此轻量模式，不必上重框架 | P3 |
| L4 | **文本长度自适应** | 按钮热区/面板目前按中文 ≥14px 设计；未来英文等较长文本需确认不溢出（result-screen 面板已加高容纳双按钮，有余量） | P3 |
| L5 | **RTL 评估** | 当前无 RTL 语言目标；若未来进入阿拉伯语市场再评估布局镜像 | 暂不需要 |

### 3.3 不建议现在做的事
- 不上整套 i18n 框架（react-i18next 类）— MVP 无多语言需求，过度工程。
- 不引入位图字体本地化管线—与 ADR-004 冲突且增加包体（G4 红线）。

---

## 4. 本地化发布门控

- [x] MVP 文案为中文，符合目标市场 → **本地化 N/A（v0.9.0 / v1.0.0）**
- [ ] 若后续决定多语言：先落 L1（字符串表）+ L2（locale 注入），再扩展语种
- [ ] IP 红线自审已覆盖命名（"栗宝"非"马里奥"、菱形星非五角星），与本地化无关但同属合规

---
*本地化 N/A 结论基于 MVP 中文市场定位；i18n 预留点（L1–L5）为低成本前瞻，不阻塞本次发布。*
