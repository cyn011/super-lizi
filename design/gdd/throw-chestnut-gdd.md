# 扔栗子机制 + 多段跳 + 弹药经济 系统 GDD（GDD 17，provisional）

> 文档类型：系统 GDD（八节 + 决策点）｜作者：文策渊（design-strategist）
> 上游：`design/concept/00-game-concept.md`（P1/P2/P3）、`src/core/character/character-controller.ts`（`airJumps`）、`src/core/enemy/enemy-ai.ts`、`src/core/enemy/projectile.ts`、`src/game/damage-resolution.ts`、`design/gdd/12-seed-metamorphosis.md`、`design/ux/virtual-controls-spec.md`、`art/art-bible.md` §3/§4.3/§6
> 范围：扔栗子远程攻击机制 + 多段跳决策 + 栗子弹药经济。本文件为玩法机制定义，渲染/资产由美术与 game/ 层落地。
> 评审强度：lean｜依赖：03 Character / 04 Enemy / 07 Damage / 06 Economy / 05 Level / 12 Seed / 08 UI / 01 Input（虚拟控制）
> 关联任务：Phase 5 用户需求（虚拟按钮 + 扔栗子 + 多连跳 + 弹药补给 + 样式升级）

---

## 0. 核心铁律（贯穿全文）

> **core 层零平台 API 铁律**：所有平台相关输入包装在 `src/platform` 或 `src/game`，core 只接收抽象信号。
> 本 GDD 的栗子投掷由 `input.throwPressed`（来自 `InputAbstraction`，第 5 抽象信号，见虚拟控制规格 §3.2）驱动；
> 栗子弹丸逻辑 (`core/attack/*`)、弹药状态 (`core/attack/throw-controller.ts`) 均为**纯逻辑、零 Phaser / 零平台 API**，
> 与现有 `core/enemy/projectile.ts` 同构。渲染在 `game/render/*`，输入在 `game/scene/*`。

> **手感第一红线（P1）**：任何新增机制不得破坏"踩踏核心"与现有二段跳手感；不得引入主导策略（远程无脑刷分 / 平台跳跃被 trivialize）。

---

## 1. 目的与范围

**目的**：把参考图的"扔瓶子"落地为原创 IP 安全的"扔栗子"远程攻击，并配套**栗子弹药经济**与"多连跳"决策，使 super-mali 在保留马里奥式踩踏核心的前提下，获得可控的远程辅助手段。

**支柱映射**
- **P1 · 跳（手感第一）**：多段跳决策以"不破坏已调二段跳手感 + 不 trivialize 6 关挑战峰"为硬约束。
- **P2 · 闯**：栗子弹药来自关卡内补给拾取，奖励探索（弹药线）。
- **P3 · 蜕变**：多段跳（三段）作为种子成熟的成长奖励（决策 D2 选项 A），呼应"成长可触摸"。

**范围（Must）**
- 扔栗子：投掷触发、弹道、射速（冷却）、弹药上限、补给来源、与敌人/场景/炮弹碰撞规则。
- 多段跳：二段跳基线 + 三段跳（成熟度门槛）决策与落地方式。
- 弹药经济：弹药计数、上限、补给拾取、与分数经济正交（不刷分主导策略）。
- 与 4 种现有敌人（ci_li/du_fu/chong_feng/shi_pao）互动矩阵 + 石炮炮弹对消。

**范围外（Could / 不在本期）**
- 栗子弧线抛投（抛物线）、自动瞄准、栗子溅射/AOE、栗子升级树、远程对 Boss（Boss 在 Could）。

---

## 2. Must / Could 分层

### Must（本期实现）
- 第 5 抽象信号 `throw` 接入 `InputAbstraction`（见虚拟控制规格 §3.2，铁律合规）。
- 扔栗子：水平直射弹道（无重力/微重力）、射速冷却、与敌人碰撞（击杀可踩类 / 打断不可踩类）、与石炮炮弹对消、撞墙消失。
- 弹药经济：弹药上限 + 起点弹药 + 关卡内栗子补给拾取 + HUD 显示（底部中央，不冲突现有 HUD）。
- 多段跳：**维持二段跳为全局基线**（`airJumps=1` 不变）。
- 敌人互动矩阵（§3.4）落地。

### Could（后续 / 需主理人拍板提升）
- **三段跳（成熟度门槛）**：种子达 fruit 阶段时 `airJumps` 临时 = 2（见决策 D2 选项 A）。**需修订 GDD 12 §2 Could 项"果阶段解锁温和能力"为本期实现**，并写 `airJumps` 覆盖映射表（D2-A 明确标注）。
- 栗子抛物线抛投（弧线，对空 du_fu 更友好）。
- 踩杀软敌后小概率掉 1 颗栗子（ammo drop，默认关，防刷）。
- 栗子弹药容量随种子成熟度提升（growth-gated capacity）。

---

## 3. 机制详述

### 3.1 多段跳（决策 D2）

当前 `character-config.json`：`airJumps: 1`（= 二段跳，已在 6 关调校完成）。`CharacterController.consume` 已支持 `airJumps` 个空中跳，**代码层面扩到 N 跳仅改配置**，零逻辑改动；真正成本是**手感与 6 关挑战峰重调**。

**决策 D2：多连跳 = 维持二段跳，还是扩展到三段跳？**

| 选项 | 内容 | 对手感/关卡影响 | 主导策略风险 | 推荐 |
|---|---|---|---|---|
| **A（推荐）** | 基线保持二段跳（`airJumps=1`）；"多连跳"通过**种子成熟度门槛**交付：本局 maturity≥0.75（fruit 阶段）时 `airJumps` 临时=2（三段跳），离开 fruit 复位 1。 | 基线手感/6 关零改动；三段跳是**成长奖励**，仅后期/高成熟出现。 | 低（门槛 + 每局重置，不 trivialize 早期）。 | ✅ |
| B | 全局三段跳（`airJumps=2` 写死）。 | 需重调 1-1/1-2/2-1..2-4 全部挑战峰与沟宽（否则所有沟可随意跨过，挑战峰 moot）。 | **高**（平台跳跃被 trivialize，主导策略）。 | ❌ MVP 不做 |
| C | 维持二段跳，不做三段（"多连跳"暂不交付）。 | 最安全，但未满足用户"多连跳"表述。 | 无。 | 仅兜底 |

> **推荐 A 的落地方式**（不破坏 GDD 12 MVP"蜕变仅视觉"的前提，需主理人把 GDD 12 §2 的 Could 项提升）：
> - `ThrowController`/角色运行时读取 `SeedRuntimeState.stage`；当 `stage==='fruit'` 时 `CharacterController` 的可用 `airJumps` = `characterConfig.airJumps + 1`。
> - 映射表集中在 `seed-config.json` 或新增 `attack-config.json` 的 `multiJumpStageUnlock: 'fruit'`、`multiJumpBonus: 1`，可调、不硬编码。
> - 仅增强不削弱（幅度 +1 跳），符合 GDD 12 R1。
> - **实现提示（给 engineering-lead）**：`CharacterController` 当前在构造/`grounded` 时把 `airJumpsLeft = cfg.airJumps` 写死；D2-A 需给 controller 暴露一个**可动态设置的 `airJumpBonus` 字段**（默认 0），`airJumpsLeft` 改为 `cfg.airJumps + airJumpBonus`。`game-scene` 在 `loadLevel`/蜕变阶段变化时据此设置（fruit→1，其余→0）。**core 零平台分支不变**。
> - 若主理人不采纳 A，则本期**只交付二段跳（现状）**，扔栗子独立存在，"多连跳"留 Could。

### 3.2 扔栗子投掷

**触发**：`input.throwPressed`（边沿，来自 `INPUT_THROW`）→ 调 `ThrowController.tryThrow(...)`。
- 条件：① 弹药 `ammo > 0`；② 冷却 `cooldownTimer <= 0`。
- 成功：弹药 −1，冷却置 `chestnutCooldownMs`，于**角色嘴前/手前**（朝向侧，贴 body 边缘外推 2px）生成一枚 `ChestnutProjectile`，方向 = `facing`（左/右）。发 `ON_CHESTNUT_THROWN`（sfx:chestnut_throw）。
- 失败（弹药 0 或冷却中）：不生成；可选发空投音（sfx:chestnut_empty，弱）。

**弹道（默认 = 直射，决策 D3）**
- 水平直射：`vx = facing * chestnutSpeed`，`vy = 0`，**无重力**（或 `chestnutGravity=0`）。
- 理由：移动端易瞄准、能同时命中地面（ci_li）与飞行（du_fu）同高度敌人；"辅助手段"定位，保持简单可读。
- 最大射程：`chestnutMaxRange`（如 320px ≈10 格）到达后 `dead`（puff）；越界/撞墙同 `dead`。
- Could 弧线抛投：`vy` 初值向上 + 应用 `chestnutGravity`，对空更友好（见 §2 Could）。

**射速（冷却）**：`chestnutCooldownMs`（默认 220ms）防连发 spam；与弹药上限共同构成节奏闸门。

### 3.3 弹药经济

- `ammo`：当前持有栗子数；`ammoCap`：上限（默认 5）；`ammoStart`：关卡开局弹药（默认 3）。
- 补给来源（Must）：关卡内 **栗子补给拾取物**（`type:"chestnut"` 实体，`params.amount` 默认 +3），重叠即 `ammo = min(ammoCap, ammo+amount)`，发 `ON_AMMO_CHANGED`（HUD 刷新）。与 coin/seed 同走 `pickup-resolution`，但**不进分数经济**（防刷分主导策略，对齐 GDD 12 R2）。
- 补给密度：由 05 关卡设计约束（建议每关 1–3 处补给，匹配挑战峰前的弹药消耗；ammoCap 限制单次囤积）。
- Could：踩杀软敌掉弹（默认关）、容量随成熟度提升（默认关）。
- **与分数经济正交**：栗子击杀软敌给 `stompScore`（100，与踩踏同分），但**弹药稀缺**天然限制远程刷分上限（设计红线：若实测出现远程无脑 farm，下调 `ammoCap` 或击杀分）。

### 3.4 敌人互动矩阵（决策 D4 · 核心）

**统一规则（守 P1 踩踏核心）**：栗子能击杀的敌人 **≡ 可踩（stompable）的敌人**；不可踩的硬敌栗子**杀不死**，仅作可控辅助（打断/对消）。栗子从不超越踩踏的杀伤范围。

| 敌人 | 可踩? | 栗子能否击杀 | 栗子效果 | 与踩踏一致性 |
|---|---|---|---|---|
| ci_li 刺栗 | ✅ | **能** | 击杀（啪叽消失），给 stompScore | 同踩踏 |
| du_fu 嘟浮 | ✅ | **能** | 击杀（含空中），给 stompScore | 同踩踏 |
| chong_feng 锥冲 | ❌ | **不能** | **打断冲锋 + 短暂硬直**（`enemyStunMs`，非致命），硬直期可安全越过；栗子本身消失 | 同踩踏（不可踩→不被远程杀） |
| shi_pao 石炮 | ❌ | **不能**（炮台本体免疫） | 栗子**不能摧毁炮台**；但见 §3.5 与炮弹对消 | 同踩踏（不可踩→不被远程杀） |
| gu_bao 鼓苞 | 阶段相关 | 仅在 RETRACTING（可踩窗）**能**击杀；EMERGING/ACTIVE（危险尖刺期）**不能**（栗子弹开无效） | 与踩踏窗口完全一致 | 同踩踏窗口 |
| du_fu_silhouette 剪影 | 阶段相关 | 仅 hazard&stompable 期（SOLID/mirror）能；WRAITH/decoy-IDLE 穿透 | 与踩踏窗口一致 | 同踩踏窗口 |
| bouncy_vine / cyclone | 非实体辅助 | 穿透（无交互） | 无 | — |

> **设计红线**：栗子**不制造**新的可杀敌类；它只是"踩踏可杀性"的远程投影。硬敌（锥冲/石炮）必须仍靠走位/踩踏/对消处理，远程无法取而代之 → 踩踏核心不破。

### 3.5 石炮炮弹对消（决策 D4 追问）

**规则：栗子弹丸与 shi_pao 炮弹碰撞 → 两者同归于尽（mutual cancel）。**
- 实现：在 `stepSim` 的栗子更新后，遍历 `projectiles`（石炮炮弹），若 `chestnut.overlaps(shell)` → `chestnut.dead = true` + `shell` 经 `Projectile.release` 回收，发 `ON_PROJECTILE_CANCEL`（sfx:chestnut_clink，轻）。
- 意义：给远程工具清晰的**防御性用途**——对石炮时可用栗子"格挡/抵消"炮弹，呼应"对消"想法，且不破坏"炮台本体不可摧毁"（仍要绕/踩时机）。
- 边界：栗子不抵消其它 hazard（藤/气旋非弹）；只与 `Projectile`（石炮炮弹）对消。

### 3.6 与场景/玩家碰撞
- 撞实心 tile → `dead`（puff，无伤）。
- 与玩家 body → 忽略（己方弹丸）。
- 与 coin/seed/checkpoint/凯旋之门 → 穿透（无交互）。
- 出界（关卡宽/高外）→ `dead`。

### 3.7 核心循环定位（决策 D5）

**决策 D5：拾取种子→成长→是否解锁扔栗子？还是默认自带？**

| 选项 | 内容 | 与 GDD 12 关系 |
|---|---|---|
| **A（推荐）** | 扔栗子**默认自带**（基础操作，类跳）；弹药来自补给拾取。种子→**视觉蜕变**（保持 GDD 12 MVP 仅视觉，不耦合）。"多连跳"三段跳才是种子成熟解锁的能力（D2-A）。 | 不改 GDD 12 MVP 规则；关注点分离（扔=基础工具，跳+=成长奖励）。 |
| B | 扔栗子**门槛解锁**（如 vine/bloom 阶段才获得）。 | 冲突 GDD 12 MVP"仅视觉"，延迟基础控制，早关无远程 → 认知负担；不推荐 MVP。 |
| C | 混合：扔默认，但弹药容量/射速随成熟度提升。 | 需改 GDD 12，复杂度高；留 Could。 |

> **推荐 A**：扔栗子是人人开局即有的基础操作（弹药经济提供 stakes）；种子成熟解锁的是**三段跳**（成长感），二者分离、互不污染 GDD 12 的 MVP 契约。

---

## 4. 依赖系统
- **01 Input / 虚拟控制规格**：`INPUT_THROW` 信号接入（铁律合规）。
- **03 Character**：`airJumps` 多段跳（D2）；`facing` 供栗子朝向。
- **04 Enemy**：敌人 `isStompable` / 阶段状态（gu_bao/剪影）驱动 §3.4 矩阵；`chong_feng` 硬直接口。
- **07 Damage**：栗子不触发受伤（己方）；击杀软敌走与踩踏相同的经济事件（`ON_STOMP`/`ON_ENEMY_DEATH` 复用，保证计分一致）。
- **06 Economy**：栗子击杀给 `stompScore`；**弹药不进分数**（正交，R2）。
- **05 Level**：栗子补给拾取物实体放置（`type:"chestnut"`）。
- **12 Seed**：多段跳三段门槛读 `SeedRuntimeState.stage`（D2-A，需修订 GDD 12 Could→实现）。
- **08 UI / 虚拟控制规格**：弹药 HUD（底部中央）、扔按钮图标。
- **09 Audio**：`sfx:chestnut_throw` / `chestnut_clink` / `chestnut_empty` / `chestnut_hit`。

---

## 5. 接口契约

### 5.1 新增抽象信号（虚拟控制规格 §3.2）
`INPUT_THROW` → `InputState.throwPressed/throwHeld/throwReleased`（无 `throwPressedAt`）。

### 5.2 core 新增（纯逻辑，零平台）
```ts
// core/attack/chestnut-projectile.ts（镜像 core/enemy/projectile.ts）
class ChestnutProjectile {
  x:number; y:number; vx:number; vy:number;
  readonly width:number; height:number; facing:1|-1;
  dead:boolean;
  update(dt:number, world:CollisionWorld): void; // 直射无重力；越界/撞墙→dead
  overlaps(b:Body):boolean;
  getBounds():{x:number;y:number;w:number;h:number};
}

// core/attack/throw-controller.ts
class ThrowController {
  ammo:number; ammoCap:number; cooldownTimer:number;
  constructor(cfg: AttackConfig);
  /** 冷却/弹药校验；成功扣弹+置冷却+返回弹丸，失败返回 null。纯逻辑。 */
  tryThrow(facing:1|-1, originX:number, originY:number): ChestnutProjectile | null;
  addAmmo(n:number): void;          // 补给拾取
  update(dtMs:number): void;        // 冷却衰减
  reset(startAmmo:number): void;     // 每关/重生
}
```

### 5.3 game 层接入（不破铁律）
- `game-scene.ts`：`this.throw = new ThrowController(attackConfig)`；`stepSim` 中：
  - `if (input.throwPressed) { const c = this.throw.tryThrow(...); if (c) { this.chestnuts.push(c); bus.emit(ON_CHESTNUT_THROWN); } }`
  - 每步 `this.throw.update(dtMs)`；更新 `chestnuts`（移动/撞墙/出界 dead）。
  - 栗子 vs 敌人：复用 `damage-resolution` 的"可踩击杀 / 硬直"语义（栗子命中 `isStompable` 敌 → `markStomped()` + 给 stompScore 事件；命中 `chong_feng` → 置其 `stunTimer`）。
  - 栗子 vs 石炮炮弹： mutual cancel（§3.5）。
  - 补给定点：在 `resolvePickups` 增加 `type:"chestnut"` 分支 → `this.throw.addAmmo(amount)` + `ON_AMMO_CHANGED`。
- `game/render/chestnut-view.ts`：`drawChestnut(g, c)`（像素栗子，对齐虚拟控制规格 §5.2 图标）。
- `ui/hud.ts` 或新增 `ui/ammo-hud.ts`：订阅 `ON_AMMO_CHANGED` → 底部中央画栗子图标 + `×N`。

### 5.4 事件（加 `event-bus.ts`）
```ts
export const ON_CHESTNUT_THROWN = 'ON_CHESTNUT_THROWN'; // payload: {x,y,facing}
export const ON_AMMO_CHANGED    = 'ON_AMMO_CHANGED';    // payload: {ammo:number; cap:number}
export const ON_PROJECTILE_CANCEL = 'ON_PROJECTILE_CANCEL'; // payload: {x,y} (栗子×炮弹对消)
```
> 栗子击杀软敌**复用** `ON_STOMP` / `ON_ENEMY_DEATH`（与踩踏同事件 → 同计分/同 juice），不新增击杀事件，保证一致性。

---

## 6. 数据格式

### 6.1 新增 `src/config/attack-config.json`（集中可调，零硬编码）
```json
{
  "chestnutSpeed": 320,        // px/s 水平直射速度
  "chestnutGravity": 0,        // 0=直射；>0=弧线（Could）
  "chestnutCooldownMs": 220,   // 投掷冷却（射速闸门）
  "chestnutMaxRange": 320,     // 最大射程（px），到点 dead
  "chestnutWidth": 12,
  "chestnutHeight": 12,
  "ammoCap": 5,                // 弹药上限
  "ammoStart": 3,              // 开局弹药
  "pickupAmount": 3,           // 单处补给 +N
  "enemyStunMs": 800,          // 栗子打断锥冲硬直时长
  "scorePerKill": 100,         // 栗子击杀软敌分（=stompScore，弹药稀缺限刷）
  "multiJumpStageUnlock": "fruit", // D2-A：达此阶段 airJumps+1（需 GDD12 修订）
  "multiJumpBonus": 1
}
```

### 6.2 关卡实体扩展（05 schema）
```json
{ "type":"chestnut", "x":500, "y":200, "params":{"amount":3} }
```
- 碰撞：与玩家 body overlap → `ammo = min(cap, ammo+amount)`，发 `ON_AMMO_CHANGED`，实例移除。

### 6.3 弹药 HUD 位置（不与现有 HUD 冲突，决策 D6）
- **位置**：屏幕**底部中央** ≈ 逻辑 `(256, 278)`（栗子图标 16×16 + `×N` 数字），**不在顶部 HUD 行**（心形/金币/分数/计时行保持原样，hud-spec §2 / ux-spec §2）。
- 底部中央在按钮布局下为空白（左/右左下、跳/扔右下），无遮挡。
- 表现：栗子图标（栗色+暖黄高光+绿芽，与扔按钮同图标，双编码）+ 数字；弹药 0 时图标半透明 + 不闪（不靠颜色告警，align §7）。
- Could：扔按钮上方叠加计数徽标（就近），但主指示器仍在底部中央。

---

## 7. 验收标准
- [ ] `INPUT_THROW` 经 `InputAbstraction` 产出 `throwPressed`；键盘 `KeyJ` 与微信 🌰按钮产生**相同**投掷行为（铁律：core 零平台分支）。
- [ ] 按扔 → 生成栗子弹丸（朝向 = facing），冷却内/弹药 0 时不生成。
- [ ] 栗子直射命中 ci_li/du_fu → 击杀 + 给 stompScore（与踩踏同分同事件）。
- [ ] 栗子命中 chong_feng → 不击杀，仅打断冲锋 + `enemyStunMs` 硬直。
- [ ] 栗子命中 shi_pao 本体 → 不摧毁；栗子与石炮炮弹碰撞 → 两者同毁（`ON_PROJECTILE_CANCEL`）。
- [ ] 栗子撞实心 tile / 出界 / 达 `chestnutMaxRange` → dead（puff，无伤）。
- [ ] 栗子不伤玩家、不触发 `damage` 受伤。
- [ ] 弹药上限 `ammoCap` 生效；补给拾取 `+amount` 且封顶；`ON_AMMO_CHANGED` 驱动底部中央 HUD。
- [ ] 弹药**不进分数经济**（无刷分主导策略）。
- [ ] 多段跳：基线二段跳（`airJumps=1`）不变；若采纳 D2-A，fruit 阶段 `airJumps` 临时=2 且仅本局有效。
- [ ] 敌人互动矩阵（§3.4）逐类符合"栗子杀伤 ≡ 可踩"规则。
- [ ] 弹药 HUD 在底部中央，不与顶部心形/金币/分数/计时行冲突。

---

## 8. 风险与缓解
| # | 风险 | 缓解 |
|---|---|---|
| R1 | 远程无脑刷分（主导策略） | 弹药稀缺（cap 5 + 仅补给）+ 击杀同 stompScore；实测偏松则降 `ammoCap`/击杀分（§3.3 红线）。 |
| R2 | 多段跳 trivialize 平台跳跃（主导策略） | D2 推荐 A（基线二段 + 成熟门槛三段），不全局三段；若强行 B 需重调 6 关挑战峰（明确拒绝 MVP）。 |
| R3 | 栗子破坏踩踏核心 | §3.4 统一规则：栗子杀伤 ≡ 可踩；硬敌仅打断/对消，不可远程杀（P1 红线）。 |
| R4 | 与 GDD 12 MVP"蜕变仅视觉"冲突 | D2-A 需主理人把 GDD 12 §2 Could 提升为本期实现并写 `airJumps` 映射；否则本期只交付二段跳。 |
| R5 | 输入层铁律破坏 | 栗子投掷仅经 `INPUT_THROW` 抽象信号；弹丸/弹药逻辑在 core 纯函数，渲染在 game/（§0 铁律）。 |
| R6 | HUD 拥挤/冲突 | 弹药 HUD 固定底部中央，避开顶部 HUD 行与两下角按钮（§6.3）。 |
| R7 | 对消逻辑误伤其它 hazard | 仅与 `Projectile`（石炮炮弹）对消，不波及藤/气旋（§3.5 边界）。 |
| R8 | 小屏可读性（栗子 vs 硬币） | 栗子图标形状/色双编码（栗色+绿芽 vs 金币圆+星），6px 不混（虚拟控制规格 §5.2）。 |

---

## 附录 A：5 个关键决策点速查（给主理人）

| # | 问题 | 推荐 | 备选 |
|---|---|---|---|
| D1 | 手势保留可选 vs 按钮替代？ | **按钮为默认 + 手势可选**（虚拟控制规格 §2 选项 A）；扔/暂停按钮在手势模式叠加 + 排除区 | B 复用 action 通道 / C 删手势 |
| D2 | 多连跳：二段 vs 三段？ | **基线二段 + 成熟门槛三段**（fruit 阶段 `airJumps+1`，需修订 GDD12） | B 全局三段（拒）/ C 仅二段 |
| D3 | 栗子弹道？ | **水平直射**（无重力，移动端易瞄） | B 抛物线弧线（Could） |
| D4 | 敌人互动 + 炮弹对消？ | **栗子杀伤 ≡ 可踩**；硬敌仅打断/对消；**石炮炮弹可与栗子对消** | — |
| D5 | 核心循环：种子解锁扔 vs 默认自带？ | **扔默认自带**（弹药来自补给）；种子成熟解锁的是三段跳（关注点分离，不污染 GDD12） | B 种子门槛解锁扔（冲突 GDD12 MVP） |
| D6 | 弹药 HUD 不冲突？ | **底部中央**栗子图标+`×N`，避开顶部 HUD 行 | Could 扔按钮徽标 |

## 附录 B：与现有代码/文档的衔接
- `character-config.json` `airJumps:1` 不变（D2 基线）；三段跳经 `attack-config.multiJump*` 覆盖，不写死在 controller。
- `enemy-ai.ts` `chong_feng` 已有 `stunTimer` 接口 → 栗子打断复用之（§3.4）。
- `damage-resolution.ts` 踩踏击杀语义 → 栗子击杀软敌直接复用 `markStomped` + `ON_STOMP`（§5.3），单一真实实现。
- `00-index.md`：建议新增 GGD 17 行（依赖 01/03/04/05/06/07/08/12/虚拟控制）；并在 §2.2 补 `17 → 03/04/07/06/08/12`。
- 虚拟控制规格（`design/ux/virtual-controls-spec.md`）为输入侧落地；本文为机制侧。
