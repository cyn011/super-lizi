# 本地化覆盖检查（Localization Coverage）· super-mali

> 角色：release-ops-lead（路远行）· 任务：ROP-P7-RELEASE-PREP
> 范围：盘点当前 UI / 内容文案的语言策略、硬编码/未覆盖文本、多语言需求，给出是否 CN-only 充分的结论。
> 关联：`release-checklist.md` §5.1（命名一致性）、`src/game/scenes/title-scene.ts`（CJK 字体栈）。

---

## 1. 结论（先行）

- **MVP 仅中文 → 本地化 N/A（v1.0.0 不引入 i18n 框架）。**
- 当前所有**玩家可见文案均为简体中文**，无多语言框架、无字符串表、无位图字体。
- 目标市场为中文（微信小游戏主力），**无需在 v1.0.0 做本地化**。
- 字体策略为**系统字体栈**（无位图字体），与 ADR-004（禁位图字体、零游戏内 PNG）一致，**换语言无需换美术资产，i18n 成本极低**。
- **唯一须主理人拍板的非本地化风险**：对外显示名「栗宝大冒险」与包名 `super-mali` 不一致（见 §4，转 `release-checklist.md` §5.1 / B8）。

> 说明：既有 `production/release/localization.md` 为更早版本的窄口径盘点（仅 UI 层 10 处）。本文件为 Phase 7 全量复核，覆盖**新增的分享标题、关卡名（JSON 数据）、标题屏大标题**，结论一致（CN-only 充分）。

---

## 2. 玩家可见文案全量盘点（2026-07-28 实测）

> 扫描 `src/`（排除 `*.test.ts`）所得。分三类：UI 标签（代码硬编码）、分享/标题（代码硬编码）、关卡名（JSON 数据）。

### 2.1 UI 标签（代码硬编码，集中在 `src/ui/`）
| 文案 | 位置 | 类型 | 备注 |
|---|---|---|---|
| `分数` | `src/ui/hud-economy.ts` `SCORE_PREFIX` | HUD 前缀 | 中文 ≥14px 等效（accessibility） |
| `×N`（金币） | `src/ui/hud-economy.ts` | HUD | 用 × 避免与连击 x 混淆 |
| `xN`（连击倍率） | `src/ui/hud-economy.ts` | HUD | 仅 mult>1 时显示 |
| `通关！` | `src/ui/result-screen.ts` | 结算标题 | 矢量面板 |
| `下一关` | `src/ui/result-screen.ts` | 结算按钮 | 末关隐藏 |
| `再玩一次` | `src/ui/result-screen.ts` | 结算按钮 | 热区 ≥48×48 |
| `用时 Xs` / `金币 X/Y` | `src/ui/result-screen.ts` | 结算信息行 | 数值格式化 |
| `暂停` | `src/ui/pause-menu.ts` | 暂停标题 | — |
| `继续` | `src/ui/pause-menu.ts` | 暂停按钮 | → ON_RESUME |
| `重玩` | `src/ui/pause-menu.ts` | 暂停按钮 | → ON_RESTART |
| 触屏四钮图标（◀▶▲✦） | `src/ui/touch-buttons.ts` | 图形（无文本） | 纯 Graphics，零文本 |
| 命数心形 / 评级菱形星 | `src/ui/hud-hearts.ts` / `result-screen.ts` | 图形（无文本） | 矢量，无 unicode |

### 2.2 分享 / 标题（代码硬编码）
| 文案 | 位置 | 类型 | 备注 |
|---|---|---|---|
| `栗宝大冒险 · 一起来跳！` | `src/game/main.ts:64`（`enableShare`） | 微信转发分享标题 | **玩家可见**（右上角「…」转发菜单） |
| `栗宝大冒险` | `src/game/scenes/title-scene.ts:272` | 标题屏大标题 | 玩家首屏可见 |

### 2.3 关卡名（JSON 数据，非代码硬编码）
| 文案 | 位置 | 备注 |
|---|---|---|
| `翠野序章`(1-1) / `黛峦·续章`(1-2) / `《澜屿潮汐》`(1-3) / `《灼沙绿洲》`(1-4) / `《归巢》`(1-5) / `《霓街穿行》`(1-6) / `《案牍劳形》`(1-7) | `src/config/levels/1-1…1-7.json` `"name"` | 策划数据；是否上屏取决于关卡载入界面，属内容文本而非 UI 标签 |
| `石窟回响`(2-1)/`藤林回响`(2-2)/`风暴天空`(2-3)/`剪影回廊`(2-4) | `src/config/levels/2-*.json` | 仓库内存在但**不在本次 7 关发布范围**，仅数据占位 |

**观察**
- 文本量极小（UI 约 11 处 + 分享/标题 2 处 + 关卡名 11 个）。
- 全部集中在 `ui/` + `main.ts` 分享 + `title-scene.ts` + 关卡 JSON，**无散落硬编码**。
- 无位图字体（见 §3），无 RTL 需求（中/英均 LTR），音频/视觉反馈无文本（SFX 程序化、图形矢量），不受本地化影响。

---

## 3. 字体策略与微信真机渲染（规避包体风险）

| 位置 | 字体声明 | 性质 | 微信真机风险 |
|---|---|---|---|
| `src/game/scenes/title-scene.ts:41` | `'PingFang SC', 'Microsoft YaHei', 'Heiti SC', 'Noto Sans SC', sans-serif` | **CJK 系统字体栈** | ✅ 显式 CJK 回退，避免真机大字不渲染 |
| `src/ui/*.ts`（hud / hud-economy / ammo-hud / pause-menu / result-screen） | `'sans-serif'` | 系统字体 | ✅ 系统字体，零资产 |
| `src/platform/wechat/wechat-platform.ts` 等 | 无字体资产引用 | — | ✅ 无 .ttf/.woff 进包 |

> **结论**：全程使用**运行时系统字体**，零位图/零字体文件进包 → **不增加微信包体**（规避 G4 红线），且**未来换语言字符串即生效，无需改美术资产**。CJK 栈在 `title-scene` 显式声明，专门规避微信真机中文渲染失败（与既有 `docs/wechat-blackscreen-fix.md` 的"真机字体回退"思路一致）。

---

## 4. 命名一致性风险（非本地化，但同属合规 — 转 release-checklist §5.1 / B8）

仓库内存在**三处命名不一致**，虽非本地化问题，但影响 IP / 提审，须主理人早决：
- 包名 / `project.config.json` `projectname`：`super-mali`
- 标题屏大标题 + 分享标题：**「栗宝大冒险」**
- 关卡名：全中文（CN-only 合规）

> 玩家可见名「栗宝大冒险」为原创、IP 安全；`super-mali` 含 "mali" 近音 "Mario"，**仅作内部/包名无碍，不应作为对外游戏名称**。提审「游戏名称」建议统一填「栗宝大冒险」。详见 `release-checklist.md` §5.1。

---

## 5. 可本地化 Seam 分析（i18n 预留点，低成本前瞻）

### 5.1 已具备的利好 seam
- **系统字体渲染**：切换语言字符串即生效，零资产改动（§3）。
- **纯函数文本格式化**：`src/ui/hud-economy.ts` 的 `formatScore/formatCoins/formatCombo` 与 `result-screen.ts` 的 `evaluateRanks` 均为零 Phaser / 零平台纯函数，可单测、易抽取。
- **中枢常量集中**：`SCORE_PREFIX` 等已抽为 `export const`，易于迁移到字符串表。

### 5.2 待补的 i18n 预留点（建议，非阻塞）
| # | 预留点 | 做法 | 优先级 |
|---|---|---|---|
| L1 | 字符串表抽离 | 新增 `src/config/strings.zh.json`（或 `src/i18n/strings.ts`），把所有中文文案迁入；运行时按 `locale` 取。硬编码处改为查表 | P3（需求出现前可做） |
| L2 | locale 注入点 | 在 `Platform` 或 `game-scene` 注入 `locale`（如 `'zh'`），默认 `'zh'`；未来加 `'en'` 等 | P3 |
| L3 | Reduce Motion 同款轻量模式 | 参考 `platform.reduceMotion` 的"可选字段 + 默认 false + 后续注入"模式，i18n 亦可用此轻量模式，不必上重框架 | P3 |
| L4 | 文本长度自适应 | 按钮热区/面板按中文 ≥14px 设计；未来较长文本（英文等）需确认不溢出（result-screen 面板已加高容纳双按钮，有余量） | P3 |
| L5 | RTL 评估 | 当前无 RTL 语言目标；若进入阿拉伯语市场再评估布局镜像 | 暂不需要 |

### 5.3 不建议现在做的事
- 不上整套 i18n 框架（react-i18next 类）— MVP 无多语言需求，过度工程。
- 不引入位图字体本地化管线 — 与 ADR-004 冲突且增加包体（G4 红线）。

---

## 6. 本地化发布门控

- [x] MVP 文案为中文，符合目标市场 → **本地化 N/A（v1.0.0）**
- [x] 字体策略为系统字体栈，零字体/位图资产进包 → 包体安全、未来 i18n 成本低
- [ ] 若后续决定多语言：先落 L1（字符串表）+ L2（locale 注入），再扩展语种
- [ ] 命名一致性（§4）须主理人拍板，与本地化无关但同属提审合规（转 `release-checklist.md` B8）

*本地化 N/A 结论基于 MVP 中文市场定位；i18n 预留点（L1–L5）为低成本前瞻，不阻塞本次发布。*
