# 核心循环 UX 规格（core-loop-ux）— super-mali

> 文档类型：UX 状态机 / 流程 / 跨关元循环实现 brief（给 engineering-lead 直接取数）
> 作者：文策渊（design-strategist）｜关联任务：PH4-UX-001｜评审强度：lean
> 上游依据：`docs/architecture/adr/ADR-002`（RunStateMachine）、`src/core/events/event-bus.ts`（`ON_*` 常量）、
> `design/ux/ux-spec.md`、`design/ux/hud-spec.md`（已落地）、`design/ux/click-to-move-design.md`（手势暂停）、
> `design/gdd/08-ui-hud.md`、`design/gdd/11-meta-progression.md`、`design/gdd/05-level-system.md`、`design/gdd/07-damage-statemachine.md`、
> `production/epics.md`（E5.S2 / E5.S3）、`art/art-bible.md` §3/§7/§9、`art/accessibility.md` §2.2/§9
> 逻辑分辨率基准：`512 × 288`（16:9），坐标均为逻辑 px；HUD 与面板用矢量 / 系统字体（混合 UI）。

---

## 1. 概述与范围（与 ux-spec / hud-spec 的分工）

本文件是 `ux-spec.md` 与 `hud-spec.md` 的**补充与细化 brief**，只覆盖"核心循环之外的 UX 流程与状态"，不重复二者已定义内容。

### 1.1 三份 UX 文档的分工矩阵

| UX 面 | 归属文档 | 状态 | 本文件动作 |
|---|---|---|---|
| 命数心形 / 形态图标 / 受击闪红 / 无敌闪烁 / 重生淡入 / Game Over 覆盖层 | `hud-spec.md` | ✅ **已落地（已实现）** | 仅引用，不重定义（§5.4 复用其 depth/事件） |
| HUD 字段布局（生命/金币/分数/进度/计时/形态）、输入回显、触屏按钮、新手引导、Juice 清单、可访问性档位口径 | `ux-spec.md` §2–§8 | 🟡 已设计，部分待实现 | 仅引用其口径；本文件不重抄布局坐标 |
| 顶层屏幕流（ADR-002 主干） | `ux-spec.md` §1 | 🟡 已设计 | 本文件**细化状态机 + 事件映射**（§2） |
| 暂停 / 结算 / 失败（高层） | `ux-spec.md` §5 | 🟡 已设计、UI 待 Sprint04+ | 本文件**给出实现 brief**（§4 / §5） |
| **核心循环 UX 状态机（事件级）** | — | ❌ 未定义 | **本文件 §2 新增** |
| **主菜单 / 关卡选择 UX** | — | ❌ 未定义 | **本文件 §3 新增** |
| **暂停触发细节（含微信 onHide + 双指 tap）** | — | ❌ 未定义 | **本文件 §4 新增** |
| **结算星级双维度算法 + 温柔成功/失败文案** | — | ❌ 未定义 | **本文件 §5 新增** |
| **元循环 / 种子蜕变成长 UI 反馈（跨关进度 + 成长呈现）** | — | ❌ 未定义 | **本文件 §6 新增** |
| **全 UX 面可访问性清单（逐项核对）** | — | ❌ 未逐项 | **本文件 §7 新增** |
| **工程实现提示（事件订阅/字段/层级/字体）** | — | ❌ 未定义 | **本文件 §8 新增** |

### 1.2 设计支柱（沿用概念文档，2 条）
1. **可读性优先**——任何状态/反馈一眼可辨，绝不只靠颜色（形状 > 颜色）。
2. **温柔不恐吓**——失败/死亡用柔和提示，无高压画面（对齐 hud-spec / art-bible §7.2）。

### 1.3 范围红线（本文件不写）
- 不写任何游戏机制数值（伤害/经济/手感常量来自各自 GDD / `*-config.json`）。
- **不臆造"种子蜕变"的游戏机制**——GDD 11 当前**无**种子数据模型/事件（见 §6.1 缺口声明），本文件只定义 UI 呈现层与数据契约，机制须由主理人拍板后补入 GDD。
- 不修改任何 GDD / ADR / 美术文档，仅消费其接口与字段。

---

## 2. 核心循环 UX 状态机

### 2.1 设计原则
- **主干严格对齐 ADR-002** `RunStateMachine`：`BOOT → MENU → PLAYING ⇄ PAUSED → LEVEL_COMPLETE / GAME_OVER`。
- `LEVEL_SELECT` 作为 `MENU → PLAYING` 之间的**可选导航态**（多关时启用，MVP 单关不出现；ux-spec 附录 A1）。
- **`DEATH_RESPAWN` 不升为顶层状态**：它是 `PLAYING` 内部的**瞬态子覆盖（micro-overlay）**，由 `ON_DEATH(lives>0)` 进入、`ON_RESPAWN` 退出，避免破坏 ADR-002 主干（详见 §2.4）。
- 所有状态切换由 `core/state/RunStateMachine` 持有；UI 仅订阅 `ON_*` 事件做呈现，**逻辑层零 Phaser 依赖**（ADR-002 §2/§4）。

### 2.2 状态机图（事件级）

```
        ┌─────────┐
        │  BOOT   │ 资源预加载 / 配置注入
        └────┬────┘
             │ ON_BOOT_DONE (auto)
             ▼
        ┌─────────┐   ON_START(单关)  ┌──────────────┐
        │  MENU   │──────────────────▶│ LEVEL_SELECT │ (可选, 多关时)
        │ (主菜单)│   ON_START(level)  │ (关卡选择)   │
        └────┬────┘                   └──────┬───────┘
             │ 直接开始(单关)                  │ ON_SELECT_LEVEL(levelId)
             │                               ▼
             │                        ┌──────────┐
             └───────────────────────▶│ PLAYING  │ (游戏中, 含 DEATH_RESPAWN 子态)
                                      └────┬─────┘
                       ON_PAUSE(手动/微信onHide)│     │ ON_LEVEL_COMPLETE / ON_LEVEL_COMPLETE_UI
                                               ▼     ▼
                                          ┌─────────┐ ┌──────────────┐
                                          │ PAUSED  │ │LEVEL_COMPLETE │ (结算)
                                          └────┬────┘ └──────┬───────┘
                                 ON_RESUME ▲  │ ON_RESTART/MENU│ ON_NEXT / ON_REPLAY / ON_MENU
                                            │  ▼              ▼
                                            │   ┌──────────────┐   ┌──────────┐
                                            └───│ (回 PLAYING)  │   │ LEVEL_   │
                                                └──────────────┘   │ SELECT  │
                                                                   └────┬─────┘
                                                                        │ (多关: 看进度)
                           PLAYING 内: ON_DEATH(lives>0) ──▶ DEATH_RESPAWN ──▶ ON_RESPAWN ─┐
                                        ON_DEATH(lives==0) ──▶ ON_GAME_OVER ──▶ GAME_OVER  │
                                                                   GAME_OVER ── ON_RETRY/ON_MENU ─┘ (回到 PLAYING 或 MENU)
```

### 2.3 状态说明表（含事件映射与落地状态）

| 状态 | 进入触发（事件） | 核心 UI | 退出触发（事件） | 落地状态 |
|---|---|---|---|---|
| `BOOT` | 启动 | 加载条 / logo（矢量） | `ON_BOOT_DONE` → MENU | 🟡 脚手架阶段 |
| `MENU` | `ON_BOOT_DONE` | 标题(栗宝/Mali) + 开始/关卡选择/设置（§3） | `ON_START` → PLAYING(单关) 或 LEVEL_SELECT | ❌ 待 Sprint04 |
| `LEVEL_SELECT` | `ON_START`(多关) | 关卡格（锁/解锁/星/最佳时间，§3.2） | `ON_SELECT_LEVEL(levelId)` → PLAYING | ❌ 待 Sprint04（MVP 不出现） |
| `PLAYING` | 选关/开始 | 游戏世界 + HUD（hud-spec 已落地） | `ON_PAUSE`→PAUSED；`ON_LEVEL_COMPLETE_UI`→LEVEL_COMPLETE；`ON_DEATH`→DEATH_RESPAWN/GAME_OVER | ✅ HUD 已落地；其余待04 |
| `DEATH_RESPAWN` | `ON_DEATH(lives>0)` | PLAYING 内软重生（淡入+无敌闪烁+空心心形更新，复用 hud-spec §4/§5） | `ON_RESPAWN` → 回到 PLAYING（子态结束） | ✅ 底层已实现(hud-spec) |
| `PAUSED` | `ON_PAUSE`（手动/微信onHide） | 半透明遮罩+面板（继续/重玩/回菜单/设置，§4） | `ON_RESUME`→PLAYING；`ON_RESTART`→PLAYING；`ON_MENU`→MENU | 🟡 仅事件已通(click-to-move §12.4)，UI 待04 |
| `LEVEL_COMPLETE` | `ON_LEVEL_COMPLETE_UI`（凯旋之门） | 凯旋之门动画+星级双维度+温柔成功（§5） | `ON_NEXT`→下一关 PLAYING；`ON_REPLAY`→PLAYING；`ON_MENU`→MENU | ❌ 待 Sprint04 |
| `GAME_OVER` | `ON_GAME_OVER`(lives==0) | 暗罩+温柔"再试一次"（hud-spec §6 已落地） | `ON_RETRY`→PLAYING（检查点）；`ON_MENU`→MENU | ✅ 已落地（hud-spec §6） |

> 事件常量来源：`src/core/events/event-bus.ts`。本文件新增引用约定：
> - `ON_LEVEL_COMPLETE_UI`（UI 面事件，payload 含 `stars/time/coinsCollected/coinsTotal/isNewBest`）驱动**结算面板**；
> - `ON_LEVEL_COMPLETE`（core 事件）驱动**元循环持久化**（GDD 11 / E5.S3）与下一关解锁。
> 两者由同一通关动作先后发出，UI 订阅 `_UI` 版本，存档订阅非 `_UI` 版本，职责分离。

### 2.4 DEATH_RESPAWN 子态（不破坏 ADR-002 的处置）
- **不是顶层状态**：`RunStateMachine` 仍停留在 `PLAYING`。
- **进入**：`ON_DEATH` 且 `damage.lives > 0` → UI 播放"软重生"：hud-spec §4 心形重绘为空心槽 + §5.3 栗宝 200ms 淡入 + §5.2 无敌闪烁（>0 即闪）。期间**仿真不冻结**（栗宝于检查点复活继续），但输入可短暂忽略首帧（防误触，可选）。
- **退出**：`ON_RESPAWN` → 子态结束，回到正常 PLAYING。
- 若 `ON_DEATH` 且 `lives==0` → 不进本子态，直接 `ON_GAME_OVER` → `GAME_OVER`（hud-spec §6 已落地）。

---

## 3. 主菜单与关卡选择 UX

### 3.1 主菜单（MENU）
- **入口**：`BOOT` 完成 `ON_BOOT_DONE` 自动进入。
- **布局（512×288，矢量/系统字体）**：
  - 顶部居中：标题"栗宝 Mali"（系统字体 ≥ 24px 等效，高对比描边 `#2A1A12`；可加 栗宝剪影装饰，像素层）。
  - 中部纵向按钮列（每个 ≥ 48×48 热区，圆角+描边，art-bible §7.2）：
    - **开始游戏** → `ON_START`（MVP 单关：直接进 `PLAYING` level `1-1`；多关：进 `LEVEL_SELECT`）。
    - **关卡选择**（仅多关/已有 `unlockedLevels.length>1` 时显示）→ `ON_START` 带 `openSelect=true`。
    - **设置**（色盲辅助 / 减少动态 开关，accessibility §2.2）→ 设置子面板（MVP Could，见 ux-spec §2.2）。
  - 底部：版权/轻提示（可选，小字 ≥12px 但非关键）。
- **背景**：草原主题静态或慢速漂移云（parallax 0.3，art-bible §5.1），不抢前景。
- **首入引导**：仅首关（SaveData 标记 `onboarded`），由 `ui/onboarding.ts` 在 PLAYING 触发（ux-spec §6），菜单本身不做教程。

### 3.2 关卡选择（LEVEL_SELECT，预留，MVP 不出现）
- **触发**：多关且用户点"关卡选择"。
- **数据来源**：`SaveData.unlockedLevels`（GDD 11）→ 决定锁/解锁；`SaveData.stars[levelId]` / `SaveData.bestTimes[levelId]` → 每关星数与最佳时间。
- **网格**：横向/网格排列关卡格，每个格：
  - **解锁态**：实心圆角格 + 关名（如 `1-1`）+ 该关星级（原创菱形星 ★，art-bible §7.2）+ 最佳时间（`mm:ss`，无则"—"）。
  - **锁定态**：暗化格 + 锁形图标（**形状区分**，非仅靠灰）；不可点（热区禁用或点击给轻柔"未解锁"提示）。
  - **当前可选最高关**：可加高亮描边（暖黄 `#FFD23F`）引导。
- **交互**：点解锁格 → `ON_SELECT_LEVEL(levelId)` → PLAYING；返回按钮 → MENU。
- **可访问性**：格热区 ≥ 48×48；星/锁用形状+图标（色盲安全）；最佳时间数字 ≥10px。

---

## 4. 暂停 UX（E5.S2 · PAUSED）

### 4.1 触发（⚠ 与 ux-spec §5.1 的一处冲突已在此统一）
- **手动（手势布局，当前默认）**：双指 tap → `GestureProvider` 产 `touch:action` 边沿 → `game-scene.stepSim` 发射 `ON_PAUSE`（click-to-move-design §5.4 / §12.3）。
- **手动（虚拟布局 / Web）**：`INPUT_ACTION` 按钮 或 Web `Esc` / 键盘 action → `ON_PAUSE`（兼容 ux-spec §5.1 旧描述；虚拟布局已降为可回退调试态，见 click-to-move §10 风险4）。
- **微信生命周期自动**：`wx.onHide` → 平台层发射 `ON_PAUSE`（E7.S3 联动；epics E5.S2 验收项）。
- **冲突说明**：ux-spec §5.1 写"`INPUT_ACTION` 或 Esc → ON_PAUSE"，在**默认 gesture 布局**下已无常驻 action 按钮，故以"双指 tap"为默认手动触发、`Esc`/虚拟 action 为兼容触发。本文件以 click-to-move-design（已落地）为准，**建议**文策渊同步将 ux-spec §5.1 的暂停触发文案修订为"双指 tap（默认）/ Esc / 虚拟 action 按钮"。

### 4.2 遮罩与面板
- **遮罩**：半透明暗罩（≈ `rgba(0,0,0,0.55)`，`scrollFactor(0)`，depth 建议 **1500**），游戏世界与 HUD 置于其下（HUD depth 1000，故被遮罩盖住，符合 ux-spec §2.3"PAUSED 时 HUD dim"）。
- **面板**（depth **1600**，居中，圆角 + 描边 `#2A1A12`，art-bible §7.2）：
  - **继续** → `ON_RESUME` → PLAYING（解除仿真冻结）。
  - **重玩** → `ON_RESTART` → PLAYING（重置当前关，命数复位，同 hud-spec §6.2 的 reset 逻辑）。
  - **回主菜单** → `ON_MENU` → MENU。
  - **设置**（可选，MVP Could）：色盲辅助 / 减少动态 开关入口（accessibility §2.2）。
- 按钮：大圆角，文字 ≥ 14px 等效，热区 ≥ 48×48。

### 4.3 "不丢输入"约束
- 暂停期间仿真冻结（`update` 跳过 `loop.update`，同 hud-spec §6.2 的 gameOver 冻结模式，但**保留输入采样对象**）。
- `GestureProvider` 内部 held/计时器在 `ON_PAUSE` 时 `reset()`（click-to-move §7.3 / §8），`ON_RESUME` 后重新开始采样——**语义上"不丢"= 恢复后手势状态干净连续，而非保留冻结前的按压**（避免恢复瞬间误触发）。
- 微信 `onHide→onShow`：输入状态由平台层连续维护（E7.S3 验收"输入无跳变"），UI 不额外处理。

### 4.4 防光敏
- 遮罩为静态半透明，**无高频闪/强对比脉冲**（安全底线，accessibility §1/§9.3）。

---

## 5. 结算与星级 UX（E5.S2 · LEVEL_COMPLETE）

### 5.1 触发与流程
- 到达凯旋之门 → core 发 `ON_LEVEL_COMPLETE(levelId)`（GDD 05）→ UI 发 `ON_LEVEL_COMPLETE_UI({levelId, stars, time, coinsCollected, coinsTotal, isNewBest})` → 进入 `LEVEL_COMPLETE`。
- UI 面板（depth **2000**，同 hud-spec Game Over 层，置于 HUD 之上）。

### 5.2 星级双维度（🔒 权重结构已锁，阈值建议值待平衡确认）
- **锁定决策**（ux-spec 附录 A4 / GDD 08 §5）：时间维度 + 金币收集率维度，**各占 50%**。
- **每维度独立评分**（0–3 星），公式：
  - **时间分 `S_t`**：基于 `timeUsed` vs `metadata.parTime`（GDD 05 LevelData.metadata.parTime）。
    - 建议阈值（⚠ 非锁定，待主理人/平衡确认）：`timeUsed ≤ parTime` → 3；`≤ parTime×1.5` → 2；`≤ parTime×2` → 1；否则 0（仍通关）。
  - **金币收集率分 `S_c`**：`coinFrac = coinsCollected / coinsTotal`（coinsTotal 来自关卡数据；`coinsCollected` 来自 EconomyState）。
    - 建议阈值（⚠ 非锁定）：`coinFrac ≥ 1.0` → 3；`≥ 0.75` → 2；`≥ 0.4` → 1；`> 0` → 0。
  - **总星 `stars = max(1, round((S_t + S_c) / 2))`**：
    - `max(1, …)` = **通关保底 1 星**（温柔成功，避免"到了却 0 星"的挫败）。
    - 双维度加权各 50%（平均即 50/50），与锁定决策一致；**杜绝"单一维度刷分"主导策略**（设计理论红线：无主导策略）。
- **UI 呈现（双维度可见，非仅一个总数）**：
  - 两行子评分：**时间 ★★☆**（`mm:ss` / `par mm:ss`）、**金币 ★★★**（`collected/total`）。
  - 一行总评：**总星 ★★☆**（取 round 平均，保底 1）。
  - 若 `isNewBest`：在总星旁加"新纪录"小徽标（形状+文字，非仅靠色）。

### 5.3 温柔成功 / 失败提示
- **成功**：凯旋之门亮起 + 主角跃入（art-bible §8 通关星雨；减少动态开启时改静态，§9.3）+ "通关啦！"等温柔文案（系统字体 ≥16px，填充 `#F4EFE6` 描边 `#2A1A12`）。
- **失败（GAME_OVER，已落地 hud-spec §6）**：仅"游戏结束 / 再试一次"，极简不恐吓（ux-spec 附录 A3）。本文件不重定义。
- 操作：`ON_NEXT`（下一关，多关）/ `ON_REPLAY`（重玩）/ `ON_MENU`（回菜单）。

### 5.4 与 hud-spec 的衔接
- 结算与 Game Over 共享 depth **2000** 覆盖层约定（hud-spec §8.3）；两者互斥出现（一关结束不会同时结算+失败）。
- HUD 在 `LEVEL_COMPLETE` / `GAME_OVER` 隐藏（ux-spec §2.3），仅面板。

---

## 6. 元循环 / 种子蜕变成长 UI 反馈（E5.S3 + GDD 11）

### 6.1 ⚠ 缺口声明（必读，主理人需拍板）
- **GDD 11 当前内容**（`design/gdd/11-meta-progression.md`）**仅为 SaveData 存档**：`{ unlockedLevels, stars, bestTimes }`，流程 `ON_LEVEL_COMPLETE → 解锁下一关 + 记录星/时间 → 持久化`。**无"种子收集→蜕变→成长"的任何数据模型或事件。**
- **"种子精灵"是主角栗宝的旧占位名**（art-bible §4.2），**不是**种子收集系统；`design/` 全目录检索无 seed/种子蜕变机制定义。
- **本文件不臆造机制**：§6.2 定义 GDD 11 **真实范围**的 UI（跨关进度）；§6.3 提供"种子蜕变成长"的 **UI 呈现壳 + 数据契约**，现已对齐 **GDD 12（12-seed-metamorphosis）**（`Stage='sprout'|'vine'|'bloom'|'fruit'` 四阶段枚举 + `ON_SEED_*` 事件契约）。机制已由 GDD 12 落地，工程可按契约实现 §6.3 数据读取。

### 6.2 跨关卡进度 UI（GDD 11 真实范围，可立即实现）
- **数据契约**（来自 GDD 11 `SaveData`）：
  - `unlockedLevels: string[]` → 关卡格锁/解锁（§3.2）。
  - `stars: Record<levelId, number>` → 每关星级展示（§3.2 / §5.2）。
  - `bestTimes: Record<levelId, number>` → 每关最佳时间（`mm:ss`）。
- **持久化触发**：`ON_LEVEL_COMPLETE(levelId, stars, time)` → `saveLevelResult(levelId, stars, time)`（GDD 11 §5）→ `localStorage`(Web) / `wx.setStorageSync`(微信)。
- **展示面**：`LEVEL_SELECT` 格（§3.2）+ 结算面板"新纪录"徽标（§5.2）+（可选）`MENU` 底部"累计星数 Σstars / 已解锁 N 关"。
- **a11y**：星/锁用形状+图标；数字 ≥10px；热区 ≥48×48。

### 6.3 种子蜕变成长 UI（呈现壳 · GDD 12 已定义机制，MVP 不实现）
> 以下为**视觉/文本呈现层**提案，数据字段对齐 **GDD 12（12-seed-metamorphosis）** 已定义的契约（`Stage` 四阶段枚举与 `ON_SEED_*` 事件），不再阻塞。

- **成长隐喻（对齐 art-bible 嫩芽母题）**：以"栗宝头顶嫩芽 → 抽枝 → 开花"对应 meta 成长阶段，复用既有形状/色彩语言（栗色 `#B5763E`、暖黄 `#FFD23F`、增益紫 `#9B6CF2` 仅道具），保证视觉一致、色盲安全（形状区分阶段）。
- **三阶段反馈**：
  1. **收集反馈**：拾取种子 → 轻量 punch + 中心闪光环 + "+1 种子"飘字（复用 ux-spec §8 Juice #3 收集弹出范式）；避免密集闪光（减少动态时静态）。
  2. **蜕变过渡**：累计达阈值 → 过渡动画（栗宝剪影柔和形变 + 嫩芽生长，≤0.4s，非高频闪），配文字"栗宝蜕变了！"。
  3. **成长呈现**：`成长图鉴/栗宝` 面板展示已收集种子 → 当前形态阶段（sprout → vine → bloom → fruit），文本标签 + 形状进度（非仅靠色）。
- **建议数据契约（待 GDD 确认字段名）**：
  ```
  SeedProgress {
    seedId: string;        // 种子类型
    collected: number;     // 已收集数
    total: number;         // 该类型总数（关卡内/全局）
    stage: 'sprout'|'vine'|'bloom'|'fruit';  // 当前蜕变阶段（4-stage，对齐 GDD 12 附录 A）
    growthPct: number;     // 0..1 当前阶段进度
  }
  ```
- **事件（GDD 12 §5.1 已定义）**：`ON_SEED_COLLECTED(seedId)`、`ON_SEED_METAMORPHOSIS(stage)`、`ON_SEED_GROWTH`——**事件常量由工程主程补入 `event-bus.ts`**（GDD 12 §5.1 契约），UI 即可订阅。
- **MVP 建议**：§6.3 作为 Could（backlog），MVP 只做 §6.2 的 SaveData 跨关进度 UI。

---

## 7. 可访问性清单（逐项核对 ux-spec / accessibility）

> 目标档 = **Standard**（accessibility §2.2）；安全底线 = **Basic 强制**（§1/§9.3）全界面满足。逐项核对全 UX 面（菜单/选关/暂停/结算/GameOver/种子面板）。

| # | 特性（accessibility） | 要求 | 本文件各 UX 面落地 | 状态 |
|---|---|---|---|---|
| 1 | 色盲双编码（形状>颜色） | Basic 内建 | 心形满/空=实心/空心(hud-spec §3.1)；锁=锁形图标(§3.2)；星=原创菱形星(art-bible §7.2)；种子阶段=形状进度(§6.3) | ✅ 设计覆盖 |
| 2 | 色盲辅助开关（白描边脉冲） | Standard | 设置页开关 → 危险元素/爱心加白描边脉冲（ux-spec §7） | 🟡 待实现 |
| 3 | 多类型色盲滤镜 | Comprehensive | 不在 MVP | ⬜ backlog |
| 4 | 最小可辨尺寸（物体≥32px/等效≥48px） | Basic | 关卡格/角色/道具 ≥32px | ✅ |
| 5 | 最小热区（按钮≥48×48 逻辑） | Basic 强制 | 菜单/暂停/结算按钮、关卡格热区 ≥48×48；GameOver 重试=全屏（hud-spec §6.2） | ✅ 设计覆盖 |
| 6 | 文字尺寸（中文≥14px/数字≥10px） | Standard | 标题≥24px、按钮/文案≥14px、时间数字≥10px；禁用 CJK 像素字（混合 UI，art-bible §7.1） | ✅ 设计覆盖 |
| 7 | UI 缩放 90–150% | Comprehensive | 不在 MVP | ⬜ backlog |
| 8 | 减少动态开关 | Standard | 设置页开关 → 关屏震/粒子减半/星雨改静态/无敌闪烁改稳态(ux-spec §7 / hud-spec §5.2) | 🟡 待实现 |
| 9 | Reduce Motion 增强 | Comprehensive | 不在 MVP | ⬜ backlog |
| 10 | 防光敏（<3Hz/单闪≤0.2s/半透明） | Basic 强制 | 受击=半透明红非白闪(hud-spec §5.1)；遮罩/结算无高频闪；星雨慢速低对比(§5.3) | ✅ 设计覆盖 |
| 11 | 低闪烁舒适预设 | Comprehensive | 不在 MVP | ⬜ backlog |
| 12 | 控制热区边距（屏宽10%） | Standard | HUD/面板按屏宽 10% 安全边距(ux-spec §2.2)；按钮间距≥24px | ✅ 设计覆盖 |
| 13 | 非颜色状态提示（多重反馈） | Basic | 受击=红闪+击退+无敌闪烁(hud-spec §7)；吃道具=闪光+缩放；顶块=上顶+✦(ux-spec §8) | ✅ 设计覆盖 |
| 14 | 完整字幕系统 | Comprehensive | 不在 MVP | ⬜ backlog |
| 15 | 音效文字化 | Comprehensive | 不在 MVP | ⬜ backlog |

**结论**：Standard 档的 4 个低成本项（#2 开关、#6 文字、#8 开关、#12 边距）中，#6/#12 已在设计中达标；#2/#8 两个开关待 Sprint04 实现（accessibility §4：仅此二项可暂降级，#5/#10 为硬底线不可降级）。Comprehensive 全为 backlog。

---

## 8. 给工程主程的实现提示（事件订阅 / 字段 / 层级 / 字体）

### 8.1 状态机归属
- `RunStateMachine` 放 `core/state/`（ADR-002），持有 BOOT/MENU/PLAYING/PAUSED/LEVEL_COMPLETE/GAME_OVER + 可选 LEVEL_SELECT；`DEATH_RESPAWN` 作为 PLAYING 内部标记（非顶层），由 `damage` 事件驱动。
- UI 场景（`ui-scene.ts`，ADR-002 §4 并行透明场景）**仅订阅 `ON_*` 做呈现**，不直接改 `RunStateMachine`（由 game-scene 编排）。

### 8.2 事件订阅清单（本文件涉及的 `ON_*`）
| 事件（event-bus 常量） | 订阅者（UI） | 用途 |
|---|---|---|
| `ON_BOOT_DONE` | Menu UI | 进入 MENU |
| `ON_START` | Menu/RunState | 进 PLAYING 或 LEVEL_SELECT |
| `ON_SELECT_LEVEL(levelId)` | RunState | 进指定关 PLAYING |
| `ON_PAUSE` | Pause UI | 显示遮罩+面板（手动/微信onHide） |
| `ON_RESUME` | Pause UI | 隐藏遮罩，恢复 |
| `ON_RESTART` | Game/RunState | 重置当前关 |
| `ON_MENU` | RunState | 回 MENU |
| `ON_LEVEL_COMPLETE_UI({levelId,stars,time,coinsCollected,coinsTotal,isNewBest})` | Result UI | 结算面板 |
| `ON_LEVEL_COMPLETE(levelId,stars,time)` | Meta/Save | 持久化（GDD 11） |
| `ON_NEXT` / `ON_REPLAY` | RunState | 下一关/重玩 |
| `ON_GAME_OVER` | GameOver UI | 暗罩+重试（hud-spec §6，已落地） |
| `ON_DEATH(lives)` / `ON_RESPAWN(lives)` | HUD | 心形/形态/淡入（hud-spec，已落地） |
| `ON_HURT` / `ON_LIFE_LOST` | HUD | 受击反馈（hud-spec，已落地） |
| `ON_SEED_COLLECTED` / `ON_SEED_METAMORPHOSIS` / `ON_SEED_GROWTH` | Seed UI | §6.3，GDD 12 §5.1 已定义，事件常量由工程主程补入 event-bus |

> 所有 UI 回调在场景 `shutdown` 时用 `bus.on` 返回的 off 函数解绑（同 hud-spec §8.1）。

### 8.3 层级（depth）建议（与 hud-spec §8.3 对齐）
| 层 | depth | 说明 |
|---|---|---|
| 世界层（地形/敌人） | 0 | — |
| 栗宝精灵 | 10 | — |
| 受伤覆盖层（闪红/闪烁） | 11 | 世界坐标跟随 body |
| HUD（心形/形态/分数等） | 1000 | `scrollFactor(0)` |
| 暂停遮罩 | 1500 | 盖住 HUD |
| 暂停面板 | 1600 | — |
| 结算 / Game Over 覆盖层 | 2000 | 置于最上，与 hud-spec 一致 |

### 8.4 字体与渲染（混合 UI 铁律）
- **系统字体**（Phaser `Text`，`fontFamily:'sans-serif'` 或系统回退栈），**禁用位图/CJK 像素字**（ADR-004 / art-bible §7.1 / hud-spec §1）。
- **字号下限**：中文 ≥14px 逻辑（标题 ≥24px，按钮/文案 ≥14px，时间数字 ≥10px）；缩放后等效仍 ≥14px。
- **高对比**：填充 `#F4EFE6`、描边 `#2A1A12`（暗罩上清晰，hud-spec §3.3）。
- **矢量图标**：心形/锁/星/种子阶段用 `Graphics` 矢量绘制（形状区分），非位图（规避包体）。

### 8.5 不变量 / 红线
- UI 只读 `SaveData` / `EconomyState` / `DamageState` 等字段，**不硬编码**数值（来自 `*-config.json` / GDD）。
- 不引入位图字体（ADR-004）。
- 不靠颜色单独传关键信息（§7 #1/#13）。
- 防光敏：任何全屏闪 <3Hz、单次日闪 ≤0.2s（#10 硬底线）。

---

## 9. 待主理人拍板 / 风险登记

| # | 事项 | 建议 | 阻塞？ |
|---|---|---|---|
| R1 | **"种子蜕变成长"机制未定义**（原 GDD 11 仅为 SaveData） | **已解决**：另立 **GDD 12** 定义机制、`Stage` 四阶段枚举与 `ON_SEED_*` 事件（§5.1）；事件常量由工程主程补入 `event-bus.ts`。MVP 仅做 §6.2 | ✅ 已解（GDD 12 落地，非 MVP 阻断） |
| R2 | 暂停触发文案冲突（ux-spec §5.1 "INPUT_ACTION" vs 默认 gesture "双指 tap"） | 以 click-to-move-design 为准修订 ux-spec §5.1 | 否（本文已统一） |
| R3 | 星级阈值（§5.2 建议值） | 主理人/平衡确认 parTime 倍率与收集率阈值 | 否（结构已锁，阈值可调） |
| R4 | 关卡选择 MVP 是否启用 | 维持 ux-spec A1：MVP 单关直进，LEVEL_SELECT 预留 | 否 |
| R5 | 设置页（色盲/减少动态开关）MVP 范围 | 建议 MVP 做（Standard 低成本项 #2/#8） | 否（可暂降级，见 accessibility §4） |

---

## 附录 A：与 ux-spec 的重复/冲突处理小结
- **重复**：HUD 布局坐标(§2)、输入回显(§3)、触屏按钮(§4)、Juice 清单(§8) —— 本文件**不重抄**，仅引用口径。
- **细化（非冲突）**：ux-spec §1 状态流 + §5 暂停/结算 为本文件的**父级**；本文件给出事件级状态机(§2)与实现 brief(§4/§5)，是 §5 的落地细化。
- **冲突与统一**：暂停触发(§4.1) 以已落地的 click-to-move-design 为准，修订建议见 R2；LEVEL_SELECT(§3.2) 与 ux-spec §1.3 一致（MVP 预留）；星级(§5.2) 与 ux-spec 附录 A4 一致（50/50 已锁）。
- **新增（无上游）**：核心循环事件级状态机、主菜单/选关 UX、暂停遮罩细节、结算星级算法、元循环跨关进度 UI、种子蜕变 UI 壳、全 UX 面 a11y 清单、工程提示——均为本文件独有交付。
