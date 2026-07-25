# super-mali · 系统设计索引（Phase 2 GDD Index）

> 版本：v0.1（Phase 2 系统设计，lean）
> 作者：文策渊（design-strategist）
> 评审强度：lean（关键阶段过质量门）
> 依赖已锁定决策（Phase 1 PASS + 美术圣经 v1.1）：Phaser 3（TS+Vite）、Web+微信双端、像素风、主角"栗宝"、终点"凯旋之门"、HUD/中文走矢量或运行时系统字体（混合 UI）、IP 全原创（禁任天堂符号）。

---

## 1. 全局约定（所有 GDD 共用，评审一致性基线）

### 1.1 坐标系与单位
- 内部逻辑分辨率：`512 × 288`（严格 16:9），瓦片 `32 × 32 px` → 满屏 16×9 格。
- 世界坐标单位 = 逻辑像素（px）。**速度单位 px/s，加速度 px/s²，持续时间 ms，角度 degree。**
- 重力方向为 +Y（向下）。

### 1.2 统一输入事件命名（见 01-input-abstraction，跨 GDD 强制一致）
| 常量 | 语义 | 平台来源 |
|---|---|---|
| `INPUT_LEFT` | 向左移动（held 状态） | 键盘 A/←、触屏左按钮 |
| `INPUT_RIGHT` | 向右移动（held 状态） | 键盘 D/→、触屏右按钮 |
| `INPUT_JUMP` | 跳跃（pressed/held/released） | 键盘 Space/W/↑、触屏跳按钮 |
| `INPUT_ACTION` | 动作/使用道具（pressed） | 键盘 J/Shift、触屏动作按钮 |

> 逻辑层只消费这 4 个抽象事件，绝不出现 `keyboard`/`touch` 分支。

### 1.3 统一实体配置 Schema（敌人/道具/机关共用基字段，详见 99 评审）
```json
{
  "id": "e1",            // 实例唯一 id
  "type": "ci_li",      // 类型枚举（见各系统）
  "x": 120, "y": 200,   // 世界坐标（px，左上锚点）
  "width": 32, "height": 32,
  "variant": "default", // 变体（可选）
  "params": {},         // 类型专属参数
  "tags": ["enemy","stompable"]
}
```

### 1.4 关卡数据格式（含 beat 预留字段，详见 05-level-system）
顶层含 `tiles / entities / props / checkpoints / goal / beat / metadata`，其中 `beat` 字段为节拍预留接口（MVP `enabled:false`，完整机制→Could）。

### 1.5 形态与受伤状态机正交约定（详见 07 / 99）
- **受伤状态机**（DamageState）：`FULL → SMALL → DEAD`，含 `INVINCIBLE` 叠加态，控制尺寸/无敌/重生。
- **形态状态机**（FormState）：`BASE / TRANSFORMED`（道具树→Could 扩展），控制能力。
- 二者**正交**：受伤转换不清除形态；`DEAD→重生` 时复位 `FormState=BASE`、`DamageState=FULL`。

---

## 2. 系统清单与依赖排序

### 2.1 系统列表（编号 = 文件路径 NN）
| NN | 系统 | 文件 | 分层 |
|---|---|---|---|
| 01 | 输入抽象 Input Abstraction | 01-input-abstraction.md | Must（深） |
| 02 | 物理/碰撞 Physics & Collision | 02-physics-collision.md | Must（深） |
| 03 | 角色控制 Character Controller | 03-character-controller.md | Must（深） |
| 04 | 敌人 AI Enemy AI | 04-enemy-ai.md | Must（深） |
| 05 | 关卡 Level System | 05-level-system.md | Must（深） |
| 06 | 经济/分数 Score & Economy | 06-score-economy.md | Must（中深） |
| 07 | 受伤/状态机 Damage State Machine | 07-damage-statemachine.md | Must（深） |
| 08 | UI / HUD | 08-ui-hud.md | Must（中深） |
| 09 | 音频占位 Audio Placeholder | 09-audio-placeholder.md | Could（轻 stub） |
| 10 | 节拍预留接口 Beat Reservation | 10-beat-reservation.md | Must（接口深）/ Could（机制） |
| 11 | 元循环/进度 Meta Progression | 11-meta-progression.md | Could（轻 stub） |
| 12 | 种子蜕变成长 Seed Metamorphosis（依赖 05/06/07/08/09/11） | 12-seed-metamorphosis.md | Must（MVP 机制深） |
| 13 | 鼓苞敌种 Gu Bao Enemy（依赖 04/06/07） | 13-gu-bao-enemy.md | Must（新敌种深） |
| 14 | 弹藤敌种 Bouncy Vine（依赖 04/02/03/06/09） | 14-bouncy-vine-enemy.md | Must（新元素深） |
| 15 | 气旋力场 Cyclone（依赖 02/03/05/09） | 15-cyclone-enemy.md | Must（新元素深） |
| 16 | 嘟浮剪影敌种 Du Fu Silhouette（依赖 04/06/07 · 可选 biome 复用 vine_forest/cave · audio 复用占位） | 16-dufu-silhouette-enemy.md | Must（新敌种变体深） |

### 2.2 依赖图（文字版，箭头 = 依赖）
```
01 Input
  └─> 03 Character ──> 07 Damage ──> 06 Economy ──> 08 UI/HUD
        │  ▲                │
        │  └────────────────┤
        ▼                   ▼
02 Physics ──> 03 Character   04 Enemy AI ──> 07 Damage
        │                   │
        ├──> 05 Level ──────┤
        │        │          │
        │        ├──> 04 Enemy (spawn/collision)
        │        ├──> 06 Economy (coin/prop)
        │        └──> 08 UI (progress/goal)
        │
10 Beat Reservation ──> 05 Level (读取 beat 字段)
        │
11 Meta Progression ──> 05 Level / 08 UI (解锁/结算)
        │
12 Seed Metamorphosis ──> 05/06/07/08/09/11 (种子实体/经济正交/受伤尺寸/UI/音频/存档)
        │
13 Gu Bao Enemy ──> 04/06/07 (敌种基础/form/sizeScale，正交扩展 GDD04)
        │
14 Bouncy Vine ──> 04/02/03 (敌种基础/物理 v.y 覆写/角色操控) · 复用 06 ON_BOUNCE(零经济) · 09 音频复用占位(SFX_JUMP/LAND)
        │
15 Cyclone ──> 02 Physics(力场叠加) · 03 Character(操控保留) · 05 Level(实体/zone) · 09 音频复用占位(无新增键)
        │
16 Du Fu Silhouette ──> 04/06/07 (敌种基础/经济 ON_STOMP/受伤管线) · 复用 du_fu 浮动数学(core, 零平台) · 可选 biome 复用(vine_forest 推荐/cave 备选, 0 新增色) · 09 音频复用占位(无新增键)
        │
09 Audio Placeholder ── (被 03/04/06/07/08 调用 playSfx，无强依赖)
```

### 2.3 推荐构建顺序
`01 → 02 → 03 → 04 → 05 → 07 → 06 → 08 → 10 → 09 → 11 → 13 → 14 → 15 → 16`（13/14/15/16 为敌种/元素扩展，依赖早期 04/06/07，可在 11 后追加）
（受伤 07 排在角色 03 后、经济 06 前，因经济依赖受伤的生命事件；节拍 10 与关卡 05 耦合，紧跟其后；音频 09 / 元循环 11 最末且轻量。）

---

## 3. 路径表
| 文档 | 绝对路径 |
|---|---|
| 本索引 | `design/gdd/00-index.md` |
| 01 输入抽象 | `design/gdd/01-input-abstraction.md` |
| 02 物理/碰撞 | `design/gdd/02-physics-collision.md` |
| 03 角色控制 | `design/gdd/03-character-controller.md` |
| 04 敌人 AI | `design/gdd/04-enemy-ai.md` |
| 05 关卡 | `design/gdd/05-level-system.md` |
| 06 经济/分数 | `design/gdd/06-score-economy.md` |
| 07 受伤/状态机 | `design/gdd/07-damage-statemachine.md` |
| 08 UI/HUD | `design/gdd/08-ui-hud.md` |
| 09 音频占位 | `design/gdd/09-audio-placeholder.md` |
| 10 节拍预留接口 | `design/gdd/10-beat-reservation.md` |
| 11 元循环/进度 | `design/gdd/11-meta-progression.md` |
| 12 种子蜕变成长 | `design/gdd/12-seed-metamorphosis.md` |
| 13 鼓苞敌种 | `design/gdd/13-gu-bao-enemy.md` |
| 14 弹藤敌种 | `design/gdd/14-bouncy-vine-enemy.md` |
| 15 气旋力场 | `design/gdd/15-cyclone-enemy.md` |
| 16 嘟浮剪影敌种 | `design/gdd/16-dufu-silhouette-enemy.md` |
| 一致性评审 | `design/gdd/99-consistency-review.md` |

---

## 附录 A：Could 系统 Stub（Boss / 道具树 / 编辑器 / 社交）
以下系统本期不做深设计，仅给八节轻量 stub，供后续 Phase 唤醒。完整节拍机制已并入 10-beat-reservation 的 Could 节。

### A.1 Boss 战（Could）
1. 目的：世界终点守护者，考验综合操作。2. 分层：Could。3. 机制：多阶段状态机（冲撞/弹幕/召唤），弱点窗口。4. 依赖：04/03/07。5. 接口：`BossState`。6. 数据：boss-config。7. 验收：三阶段可过。8. 风险：工作量→留 Could。

### A.2 道具树 / 多形态成长（Could）
1. 目的：扩展 FormState 多分支（BASE→A/B/C）。2. 分层：Could。3. 机制：技能树解锁形态，每形态独特能力。4. 依赖：07/06。5. 接口：`FormState` 扩展。6. 数据：form-tree.json。7. 验收：形态切换正确。8. 风险：平衡→后续。

### A.3 关卡编辑器（Could）
1. 目的：内部量产工具，导出 level JSON。2. 分层：Could。3. 机制：网格放置 tile/entity/prop。4. 依赖：05。5. 接口：导出 LevelData。6. 数据：同 05 schema。7. 验收：导出可被 05 加载。8. 风险：工期→留 Could。

### A.4 社交 / 微信分享（Could）
1. 目的：成绩炫耀/好友排行（弱关联）。2. 分层：Could。3. 机制：通关后分享卡/排行榜。4. 依赖：11/08。5. 接口：`shareScore()`。6. 数据：share-payload。7. 验收：可分享不崩溃。8. 风险：隐私/平台审核→Could。

---

## 附录 B：本阶段开放问题（供主理人评审）
- 见各 GDD 末尾"待主理人确认"及 99 评审"开放问题"。最关键两项已在回传中单列。
