# UX 规格（UX Spec）— super-mali Phase 4

> 版本：v0.1（Phase 4 预制作）｜作者：文策渊（design-strategist）｜评审强度：lean
> 逻辑分辨率基准：`512 × 288`（16:9），坐标均为逻辑 px；HUD 用矢量/系统字体（混合 UI）。

## 对齐矩阵（本规格引用的已锁决策）
| 来源 | 关键内容 |
|---|---|
| 概念文档 `design/concept/00-game-concept.md` | 二段跳保留 1 次；HUD 混合 UI；终点凯旋之门；道具元气果（增益形态） |
| GDD 01 `input-abstraction.md` | `INPUT_LEFT/RIGHT/JUMP/ACTION`；触屏双按钮归一化布局；`InputState` |
| GDD 08 `ui-hud.md` | `HUDModel{lives,coins,score,progress,time,form}`；凯旋之门结算；Standard 档位 |
| ADR-002 `state-management.md` | `RunStateMachine: BOOT→MENU→PLAYING⇄PAUSED→LEVEL_COMPLETE/GAME_OVER` |
| ADR-003 `dual-platform-input.md` | 双端三段式输入；微信"左下左右双按钮+右下跳/动作双按钮"，热区≥48px |
| `art/accessibility.md` | MVP 目标档 = **Standard**；安全底线 Basic 强制（防光敏<3Hz、热区≥48×48） |
| `art/art-bible.md` v1.1 | 像素世界 + 矢量 UI；功能色双编码；Juice 清单（§8） |

---

## 1. 顶层屏幕流（对齐 ADR-002 RunStateMachine）

### 1.1 状态机
主干严格对齐 ADR-002：`BOOT → MENU → PLAYING ⇄ PAUSED → LEVEL_COMPLETE / GAME_OVER`。
`LEVEL_SELECT` 作为 `MENU → PLAYING` 之间的**可选导航态**（见 §1.3），不破坏主干。

```
        ┌─────────┐
        │  BOOT   │ 预加载/资源就绪
        └────┬────┘
             │ auto
             ▼
        ┌─────────┐  开始/继续  ┌──────────────┐
        │  MENU   │──────────▶│ LEVEL_SELECT │ (可选)
        └────┬────┘            └──────┬───────┘
             │ 直接开始(单关)          │ 选关
             │                        ▼
             │                 ┌──────────┐
             └────────────────▶│ PLAYING  │
                                └────┬─────┘
                          ESC/暂停 │     │ 到达凯旋之门
                                     ▼     ▼
                                ┌─────────┐ ┌──────────────┐
                                │ PAUSED  │ │LEVEL_COMPLETE │
                                └────┬────┘ └──────┬───────┘
                          继续 ▲     │ 重试/菜单     │ 下一关/重玩
                              │     ▼              ▼
                              └─────┘        ┌──────────┐
                                    lives==0 │ GAME_OVER│
                                            └────┬─────┘
                                            重试/回菜单
```

### 1.2 状态说明
| 状态 | 进入 | 核心 UI | 退出事件 |
|---|---|---|---|
| BOOT | 启动 | 加载条/logo | `ON_BOOT_DONE` → MENU |
| MENU | BOOT 完成 | 标题、开始/继续、设置入口 | `ON_START` → LEVEL_SELECT 或 PLAYING |
| LEVEL_SELECT | MENU→开始 | 关卡格（解锁/锁）、返回 | `ON_SELECT_LEVEL` → PLAYING |
| PLAYING | 选关/开始 | 游戏世界 + HUD（§2） | `ON_PAUSE`→PAUSED；`ON_LEVEL_COMPLETE`→结算；`ON_GAME_OVER`→失败 |
| PAUSED | PLAYING 暂停 | 遮罩+面板（§5） | `ON_RESUME`→PLAYING；`ON_RESTART`→PLAYING；`ON_MENU`→MENU |
| LEVEL_COMPLETE | 到达终点 | 凯旋之门动画+星级（§5） | `ON_NEXT`→下一关 PLAYING；`ON_REPLAY`→PLAYING |
| GAME_OVER | lives==0 | 温柔失败提示（§5） | `ON_RETRY`→PLAYING（最近检查点）；`ON_MENU`→MENU |

### 1.3 LEVEL_SELECT 处理
- MVP 若仅 1 关：可由 `MENU` 直接进 `PLAYING`，`LEVEL_SELECT` 态保留但不强制出现（元循环 11 多关时启用）。
- 关卡格按 `unlockedLevels`（GDD 11）显示锁/解锁态；选中触发 `ON_SELECT_LEVEL(levelId)`。

---

## 2. HUD 布局（引用 GDD 08 HUDModel）

### 2.1 字段映射
`HUDModel { lives, coins, score, progress, time, form }` → HUD 元素：
| HUDModel 字段 | HUD 元素 | 备注 |
|---|---|---|
| `lives` | 生命爱心图标 + 数字（左上） | 爱心造型见美术圣经 §6.1（暖粉红，双编码） |
| `coins` | 金币图标 + 数字（中上） | — |
| `score` | 分数数字（中上，金币右侧） | — |
| `progress` | 顶部进度条（0~1） | 随玩家 x / 关卡宽 |
| `time` | 计时（右上） | 倒计时或正计时，按 metadata.parTime |
| `form` | 元气果/形态指示（左上，生命下方） | `BASE`=无；`TRANSFORMED`=元气果激活图标（+剩余时长若限时） |

### 2.2 布局坐标（逻辑 512×288）
- 左上 `(8,8)` 起：生命爱心 ×N + 元气果形态指示（生命下方 1 格）。
- 中上 `(centerX-40, 8)`：金币数 + 分数（图标+数字，替代纯中文）。
- 右上 `(504,8)` 右对齐：计时。
- 顶部 `y=4` 全宽进度条（高 4px，半透明圆角底板）。
- 安全边距：所有 HUD 元素距屏边 ≥ 逻辑 10%（≈51px 宽边距/屏宽 512），避免小屏拥挤（美术圣经 §7.1）。

### 2.3 可见性
- PLAYING：常驻。
- PAUSED：HUD 保留但整体 dim（遮罩下）。
- LEVEL_COMPLETE / GAME_OVER：HUD 隐藏，仅结算/失败面板。
- BOOT / MENU / LEVEL_SELECT：不显示游戏 HUD。

### 2.4 动效
- 受击：生命爱心闪红 + 整体轻微红闪（与 §8 Juice 同步）。
- 金币/分数：`ON_COIN` 时数字 +1 飘字（上浮淡出）；分数滚动递增。
- 进度条：随 `progress` 平滑插值（非瞬切）。
- 元气果：吃到时图标 punch 弹出 + 高光（GDD 03/06）。

### 2.5 混合 UI 约束
- 世界层像素；HUD/中文用矢量或运行时系统字体，中文等效 ≥14px（Standard，accessibility §2.2/#6）。
- 禁用 CJK 像素字（包体风险，美术圣经 §7.1）；系统字体回退栈（GDD 08 §8）。

---

## 3. 输入回显（对齐 GDD 01 / ADR-003）

### 3.1 统一原则
逻辑层消费 `InputState`（含 `left/right/jumpPressed/jumpHeld/jumpReleased/actionPressed/jumpPressedAt`）。**回显由 ui 层依据 `InputState` 渲染，逻辑层零平台分支**（ADR-003）。

### 3.2 键盘（Web）回显
| 物理键 | 抽象事件 | 回显 |
|---|---|---|
| A / ← | `INPUT_LEFT` | 键按下时可选高亮对应提示（设置中可关） |
| D / → | `INPUT_RIGHT` | 同上 |
| Space / W / ↑ | `INPUT_JUMP` | 跳键按下高亮；HUD 不强制显示键位 |
| J / Shift | `INPUT_ACTION` | 动作键高亮 |

Web 端不渲染触屏按钮；键位提示仅在"设置/控制"页静态列出（可选键位高亮关闭以省性能）。

### 3.3 触屏（微信）回显
- 按钮由 `ui/touch-buttons.ts` 渲染（仅 `env==='wechat'`），依据 `InputState` 实时反馈：
  - `held` → 按钮放大 + 高亮（如 1.1× scale + 描边发光）。
  - `pressed` 边沿 → 短暂按压动画（0.08s 下压）。
  - `released` → 回弹。
- 与逻辑完全解耦：同一 `InputState` 驱动，Web/微信视觉差异仅限"按钮本体存在与否"。

---

## 4. 触屏按钮规范（引用 GDD 01 §6/§8 + accessibility Standard）

### 4.1 布局（已锁：左下左右双按钮 + 右下跳/动作双按钮）
| 按钮 | 抽象事件 | 归一化位置（×逻辑 512×288） | 逻辑坐标近似 |
|---|---|---|---|
| 左 | `INPUT_LEFT` | (0.08, 0.82) | (41, 236) |
| 右 | `INPUT_RIGHT` | (0.22, 0.82) | (113, 236) |
| 跳 | `INPUT_JUMP` | (0.82, 0.82) | (420, 236) |
| 动作 | `INPUT_ACTION` | (0.92, 0.70) | (471, 202) |
（来源：`input-config.json` wechat.buttons；r≈0.07~0.08 归一化半径）

### 4.2 尺寸与热区
- **热区 ≥ 48×48 逻辑 px**（Basic 强制，accessibility §1；GDD 08 §3）。
- 视觉按钮直径 ≈ 64 逻辑 px（热区略大于视觉，留缓冲）。
- 归一化坐标 × 逻辑分辨率渲染（ADR-003：归一化 ×512×288）。

### 4.3 盲区与防误触
- 左右组与跳/动作组分置屏幕两侧下角，间距 > 1/3 屏宽，避免拇指误触跨区。
- 按钮间最小间隙 ≥ 24 逻辑 px。
- 非交互区（屏幕中上/HUD 区）不响应触摸，防游戏中点误触。

### 4.4 左右手预设
- **左手预设（默认）**：左下=左/右，右下=跳/动作（如上表）。
- **右手预设（镜像）**：右下=左/右，左下=跳/动作（坐标 X 取 1−x）。
- 在"设置/控制"页可切换；预设仅镜像，不改变事件语义。

### 4.5 可见性与反馈
- 仅微信端显示（Web 隐藏，ADR-003 §3）。
- 反馈：按压高亮/缩放（§3.3）；无障碍：按钮描边 ≥1px 深色，任何背景不丢失。

---

## 5. 暂停 / 结算 / 失败界面

### 5.1 暂停（PAUSED）
- 触发：`INPUT_ACTION` 或 Esc → `ON_PAUSE`（GDD 08 §3）。
- 元素：半透明遮罩 + 居中面板；按钮：继续 / 重玩 / 回主菜单；**设置入口（含减少动态、色盲辅助开关，§7）**。
- 操作：继续 `ON_RESUME`→PLAYING；重玩 `ON_RESTART`→PLAYING（重置关卡）；回菜单 `ON_MENU`→MENU。
- 视觉：游戏暂停、HUD dim；无高频闪。

### 5.2 结算（LEVEL_COMPLETE）
- 触发：到达凯旋之门 → `ON_LEVEL_COMPLETE`（GDD 05 goal / GDD 08）。
- 元素：凯旋之门亮起动画 + 主角跃入 + 星雨（慢速低对比，减少动态开启时改静态，accessibility §2.2/#8）；星级评价（基于 `time` + 金币收集率，双维度，GDD 08 待确认权重）；分数/星数展示。
- 操作：下一关 `ON_NEXT`→下一关 PLAYING；重玩 `ON_REPLAY`→PLAYING；回菜单 `ON_MENU`。

### 5.3 失败（GAME_OVER）
- 触发：`lives==0` → `ON_GAME_OVER`（GDD 06/07）。
- 元素：**温柔提示**（非恐吓画面）；显示"再试一次"；可选最简失败原因（如"被冲撞怪击中"）。
- 操作：重试 `ON_RETRY`→PLAYING（最近检查点）；回菜单 `ON_MENU`。
- 防光敏：失败画面无高频闪/强对比脉冲（安全底线）。

---

## 6. 首关新手引导 Onboarding

### 6.1 原则
非阻塞、融入首关前段（不做独立教程关）；用箭头/文字气泡 + 触发式提示，玩家可立即试做。

### 6.2 步骤与触发时机
| 步骤 | 教学内容 | 触发时机 | 消失条件 |
|---|---|---|---|
| 1 | 移动（左右） | 出生点，首次 PLAYING | 玩家完成一次左+右移动 |
| 2 | 跳（单跳） | 遇到第一个小沟/台阶前 | 完成一次 `INPUT_JUMP` 起跳 |
| 3 | 二段跳 | 出现需二段跳够到的隐藏砖/高台前（GDD 03） | 完成一次 `ON_DOUBLE_JUMP` |
| 4 | 踩敌（stomp） | 首个可踩敌人（刺栗/嘟浮）出现前 | 完成一次 `ON_STOMP` |

### 6.3 实现要点
- 提示由 `ui/onboarding.ts` 依据状态事件（`ON_JUMP/ON_DOUBLE_JUMP/ON_STOMP` + 玩家 x 位置）触发，非模态。
- 文字气泡用系统字体 ≥14px；可随"减少动态"关闭动画。
- 仅首关（levelId=首个）触发；二周目/其他关不显示（可由 SaveData 标记已引导）。

---

## 7. 可访问性 Standard 落地 UX 项（引用 accessibility.md §2.2/§6）

| UX 项 | 档位 | 落地形式 | 入口 |
|---|---|---|---|
| 色盲辅助模式开关 | Standard | 危险元素/爱心加白色描边脉冲（美术圣经 §9.1） | 设置页 |
| 减少动态（Reduce Motion）开关 | Standard | 关屏震、粒子减半、星雨改静态（美术圣经 §9.3） | 设置页 |
| 文字尺寸达标 | Standard | 中文 ≥14px、数字 ≥10px 逻辑（已满足，§2.5） | 默认达标 |
| 控制热区达标 | Standard | 按钮 ≥48×48 + 屏宽10%边距（§4.2/§2.2） | 默认达标 |
| **安全底线（Basic 强制）** | Basic | 防光敏全屏闪 <3Hz、单闪 ≤0.2s、半透明叠加；热区 ≥48×48 | 不可降级 |

- UX 文档档位标注（按 accessibility §6）：本 UX 各界面目标 **Standard**，安全底线 Basic 强制全界面满足（与 GDD 08 §6 档位标注一致）。
- Comprehensive 项（UI 缩放 90–150%、多类型色盲滤镜等）属 backlog，MVP 不做（accessibility §4）。

---

## 8. Juice / 反馈清单（仅清单 + 触发事件，不写代码）

| # | 反馈 | 触发事件 | 视觉处理 | 来源 |
|---|---|---|---|---|
| 1 | 受击闪白/红 | `ON_HURT` (GDD 07) | 全屏 0.15s 半透明红闪 + 主角击退 + 无敌闪烁 1.5s | 美术圣经 §8 |
| 2 | 踩敌弹跳 | `ON_STOMP` (GDD 03/04) | 敌人啪叽压扁 + 主角上弹弧 + 同色碎屑 | 美术圣经 §8 |
| 3 | 收集弹出 | `ON_COIN` / `ON_SCORE` (GDD 06) | 道具缩放 punch + 中心闪光环 + 数字飘字 | 美术圣经 §8 |
| 4 | 落地尘土 | `ON_LAND` (GDD 03) | 脚底 3–5 粒暖橙尘土，0.3s 消散；落地 squash | 美术圣经 §8 |
| 5 | 起跳/二段跳 | `ON_JUMP` / `ON_DOUBLE_JUMP` (GDD 03) | 起跳微尘 + 二段跳小光环 | 美术圣经 §8 |
| 6 | 顶互动块 | 互动块顶出 (GDD 05 props) | 块上顶 4px 回弹 + "✦"弹出道具 + 小星光 | 美术圣经 §8 |
| 7 | 通关星雨 | `ON_LEVEL_COMPLETE` (GDD 05) | 凯旋之门亮起 + 慢速低对比星雨（减少动态时静态） | 美术圣经 §8 |
| 8 | 吃元气果 | `ON_FORM_CHANGED` (GDD 06) | 元气果吞入膨胀 + 主角紫光（form=TRANSFORMED） | 美术圣经 §4.2/§6.1 |

- 粒子预算 ≤60/屏、单粒子 ≤8×8px、对象池（美术圣经 §8）；屏震幅度 ≤4px、时长 ≤0.2s，设置可关（§4.3 可访问性）。
- 防光敏：全屏闪 <3Hz、单次日闪 ≤0.2s（accessibility §1 安全底线）。

---

## 9. Story 拆分对齐（engineering-lead）

> 以下 UX 块建议对应工程 Story，供 `production/epics.md` 拆分引用。每个 UX 块标注建议 Story 名与依赖。

| UX 块 | 建议 Story | 依赖（GDD/ADR） | 优先级 |
|---|---|---|---|
| HUD 渲染（生命/金币/分数/进度/计时/形态） | `STORY-HUD-RENDER` | GDD 08 HUDModel、混合 UI | 高 |
| 菜单流（BOOT/MENU/LEVEL_SELECT 状态 UI） | `STORY-MENU-FLOW` | ADR-002 RunStateMachine | 高 |
| 触屏输入 UI（双按钮渲染+反馈） | `STORY-TOUCH-INPUT-UI` | GDD 01 §6、ADR-003 §3 | 高 |
| 暂停界面 | `STORY-PAUSE-UI` | GDD 08 §5、ADR-002 PAUSED | 中 |
| 结算界面（凯旋之门+星级） | `STORY-CLEAR-UI` | GDD 05 goal、GDD 08 §5 | 中 |
| 失败界面 | `STORY-GAMEOVER-UI` | GDD 06/07、GDD 08 §5 | 中 |
| 新手引导 | `STORY-ONBOARDING` | GDD 03（二段跳/踩敌）、§6 | 中 |
| 可访问性设置 UI（色盲/减少动态开关） | `STORY-A11Y-SETTINGS` | accessibility.md §2.2、GDD 08 §6 | 中 |
| Juice/反馈接入 | `STORY-JUICE-FEEDBACK` | 八节事件表（§8）、美术圣经 §8 | 低 |

- 共享依赖：`core/events/event-bus.ts`（ADR-002 §3）作为所有 `ON_*` 事件总线；UI 为并行透明场景（ADR-002 §4）。
- 输入三态由 `InputAbstraction` 提供，UI 仅消费 `InputState`（ADR-003）。

---

## 附录 A：关键决策点（已拍板，2026-07-21）
1. **LEVEL_SELECT 是否 MVP 实体化**：**已定 — MVP 单关由 MENU 直进 PLAYING**，LEVEL_SELECT 态保留但暂不出现（多关时启用，GDD 11）。（用户拍板）
2. **新手引导是否 MVP 必做**：**已定 — 做轻量非阻塞引导**（移动→跳→二段跳→踩敌，§6）。（用户拍板）
3. **失败界面是否显示失败原因文案**：**已定 — 极简"再试一次"**，避免恐吓（§5.3）。（按建议采纳）
4. **结算星级权重**：**已定 — 时间 vs 金币收集率各 50%**（GDD 08 §5）。（按建议采纳）

## 附录 B：与美术/可访问性一致性
- HUD 档位、触屏热区、安全底线均与 `art/accessibility.md` §6 一致（Standard / Basic 强制）。
- 按钮/爱心/元气果造型与功能色双编码遵循美术圣经 v1.1 §3/§4/§6。
- 本规格不修改任何 GDD/ADR/美术文档，仅消费其接口与字段。
