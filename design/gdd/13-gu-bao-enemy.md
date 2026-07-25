# 13 鼓苞敌种 · 扩展 GDD（gu_bao）

> 类型：扩展 GDD（加法扩展 GDD04 敌人 AI）｜分层：Must（新敌种深）
> 依赖：04 Enemy / 02 Physics / 03 Character / 07 Damage / 06 Economy（仅复用 `ON_STOMP`）
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：P-LEVEL-02
> 上游提案：design/proposals/new-mechanic-candidates.md（候选方案 A · 鼓苞，已拍板）
> **正交红线**：不改 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子蜕变）/ 经济 / 种子；不引入新物理子系统

---

## 1. 概述（目的与范围）

新增第 5 敌种 `gu_bao`（地生喷苞），为现有关卡引入**「位置 / 时间双周期 + 缩回可踩窗口」**的时序决策维度，填补 4 旧敌种（ci_li / chong_feng / du_fu / shi_pao）均无"缩回可踩"窗口的空白。

- **范围**：仅扩充 `core/enemy` 状态机表 + 关卡实体 + 程序化占位渲染 + 复用现有占位音；**不**引入新物理子系统、**不**改 form / sizeScale / 经济 / 种子。
- **落点层**：`core/enemy`（纯逻辑，零平台，可 headless 单测）＋ `game/render`（占位绘制）＋ 音频复用占位（无新增 SFX 键）。

### 1.1 概念 / MDA（新动词 = 读周期 + 等窗口 + 踩杀）

- **动词**：*读（erupt 周期）/ 等（缩回可踩窗口）/ 踩（激进踩杀）*。玩家面对一排从地面裂缝噗出的苞，需在 erupt（危险）期外通过，或在缩回（retract）窗口冒险踩杀。
- **Mechanics**：周期性地生苞（四态 DORMANT→EMERGING→ACTIVE→RETRACTING），危险期接触受伤，缩回期顶变软可踩杀。
- **Dynamics**：玩家形成"我读准了它的节奏"的**胜任感**；"等还是冲"的**自主决策**；可预测的固定周期保证**公平失败**（守"公平失败"支柱）。
- **Aesthetics**：Challenge（主，时序压力）+ Discovery（隐藏节奏走廊）。
- **心流定位**：把时序压力做成**可预测的公平节奏**（固定周期 + 可见前摇），不引发认知过载（守 P1 跳 / P2 闯 / P3 蜕变支柱）。

---

## 2. 机制详述（行为规格）

状态机**表驱动**（仿 GDD04），纯函数可单测，core 零平台。

| 状态 | 行为 | 碰撞 / 危害 | 可踩 | 时长（来自 config） |
|---|---|---|---|---|
| `DORMANT` | 缩于地下裂缝，无碰撞体、无害 | 无（`overlaps()=false`） | **否** | `dormantMs=1100`（默认） |
| `EMERGING` | 自地面升起（尖刺顶），**前摇 telegraph** | 危害（接触 → `ON_ENEMY_HIT_PLAYER`） | 否 | `emergeMs=160` |
| `ACTIVE` | 完全喷出，尖刺顶危险 | 危害（接触 → `ON_ENEMY_HIT_PLAYER`） | 否 | `activeMs=700` |
| `RETRACTING` | 缩回地下，**顶变软** | 非危害 | **是**（踩 → `ON_STOMP`+100+反弹） | `retractMs=160` |

- **循环**：DORMANT → EMERGING → ACTIVE → RETRACTING →（回 DORMANT）。周期 `T = dormantMs+emergeMs+activeMs+retractMs = 2120ms`（默认）。
- **踩杀**：`RETRACTING` 态被玩家自上方踩中（玩家 `v.y>0` 且底触苞顶，且 `isStompable=true`）→ `markStomped()` + `ON_STOMP` +100 + 反弹（复用既有 03/06 踩踏管线，**无新经济项**）。
- **危险期接触**：EMERGING/ACTIVE 态接触 → `ON_ENEMY_HIT_PLAYER`。**走既有 GDD07 受伤管线**（FULL→SMALL→DEAD，与 chong_feng/shi_pao 一致，**非瞬杀**）；与踩踏互斥（同 GDD04 规则）。注：本游戏无"瞬杀"机制，任务所述"危险期接触=死亡"即指致命接触触发既有受伤状态机。
- **缩回静止期（DORMANT）是否可踩 —— 明确声明**：**不可踩，且无碰撞、无害**。DORMANT 期苞体完全在地下，`overlaps()` 返回 false；唯一可踩窗口是 `RETRACTING` 态（160ms）。玩家可选择在 DORMANT 期安全通过（无踩杀、无伤害），或在 RETRACTING 期冒险踩杀（+100）。
- **公平性**：周期**固定**（无 RNG）、EMERGING 起即有视觉 / 音频前摇（telegraph），避免"看不见致死"（守美术可读性）。`dormantMs/activeMs/emergeMs/retractMs/height` 可实例覆盖（`params`），支持"双苞交替"节奏走廊（`phaseOffset`）。

---

## 3. 数据模型（表驱动 + 纯函数 + 零平台落点）

### 3.1 `enemy-config.json` 新增项（集中数值，禁止硬编码）

```json
{
  "gu_bao": {
    "dormantMs": 1100,
    "emergeMs": 160,
    "activeMs": 700,
    "retractMs": 160,
    "height": 48,
    "width": 28,
    "stompable": false,
    "stompableWindow": "retract",
    "baseYAnchor": "ground"
  },
  "projectile": { "width": 10, "height": 10 }
}
```
> `stompable:false` 为静态默认值；运行时由状态覆盖（RETRACTING→true）。其余 4 敌配置不变。

### 3.2 关卡实体 schema 扩展（per-instance 覆盖）

`EnemyEntityDef` 增加可选 `params?: Record<string, unknown>`（仅 gu_bao 消费，向后兼容旧 4 敌）：

```ts
export interface EnemyEntityDef {
  type: EnemyEntityType;          // 含 'gu_bao'
  x: number;                      // 世界坐标左（px）
  y: number;                      // gu_bao = 地面锚点（ty7 顶 224）；其余敌 = 碰撞盒顶（200）
  params?: { phaseOffset?: number; dormantMs?: number; activeMs?: number; height?: number };
}
```

- `phaseOffset`（ms）：初始相位偏移，用于双苞交替（如 `1060` = 半周期）。
- gu_bao 的 `y` 语义：**地面锚点 = ty7 顶 y=224**（苞自此处升起；盒顶随 emerge 进度上移）。与 ci_li 等（y=200=盒顶）不同，文档与 JSON 均显式标注。

### 3.3 纯函数状态机（core/enemy 加法，零平台）

```ts
type GuBaoState = 'DORMANT'|'EMERGING'|'ACTIVE'|'RETRACTING';
interface GuBaoCfg { dormantMs:number; emergeMs:number; activeMs:number; retractMs:number; height:number; }

// 单步推进：返回 { state, t(本态已用 ms), p(0..1 升起进度), hazard, stompable }
function stepGuBao(s: GuBaoState, t: number, dt: number, cfg: GuBaoCfg) {
  // DORMANT:    p=0,     hazard=false, stompable=false
  // EMERGING:   p=t/emergeMs,        hazard=true,  stompable=false
  // ACTIVE:     p=1,     hazard=true,  stompable=false
  // RETRACTING: p=1-t/retractMs,      hazard=false, stompable=true
}
```

- **几何**：盒顶 `top = anchorY - p*height`；盒底 `= anchorY`（固定贴地）。`p=0` → 盒顶=盒底=anchorY（地下，零高）。
- **`overlaps(body)`**：`DORMANT` 返回 false（地下无碰撞）；其余态返回 AABB 相交（同 GDD04 模式，仿 chong_feng `stun` 的非危害短路）。
- **踩踏**：复用 GDD04 `StompableHazard.getBounds()/markStomped()`；`isStompable` 由当前态动态赋值（RETRACTING=true）。

### 3.4 core 零平台落点（具体文件）

| 文件 | 改动 | 平台约束 |
|---|---|---|
| `src/core/enemy/enemy-types.ts` | `EnemyTypeName` 联合**加法**增 `'gu_bao'`；`EnemyEntityDef` 增可选 `params` | 零 phaser/wx/window |
| `src/core/enemy/enemy-ai.ts` | `update()` 增 `gu_bao` 分支（调 `stepGuBao`）；`overlaps()` 按态短路（DORMANT→false）；`isStompable` 随态赋值；`createEnemies` 识别 `'gu_bao'` 并透传 `params` | 零平台，纯函数 |
| `src/config/enemy-config.json` | 增 `gu_bao` 项（§3.1） | 纯 JSON |
| `src/game/render/enemy-view.ts` | 程序化占位绘制苞体 + 尖刺（MVP 无 PNG） | 仅 game/ 层 |
| `src/game/audio/*` | **不新增** SFX 键，复用现有占位音（见 §6） | — |

---

## 4. 公式（时序 / 几何，标单位）

- **周期**：`T = dormantMs + emergeMs + activeMs + retractMs`（默认 `1100+160+700+160 = 2120 ms`）。
- **危险占比**：`(emergeMs+activeMs)/T = 860/2120 ≈ 40.6%`；安全通过窗口（DORMANT）= `1100/2120 ≈ 51.9%`；踩杀窗口（RETRACTING）= `160/2120 ≈ 7.5%`。
- **升起进度**：`p(t_in_state) = (EMERGING)? t/emergeMs : (ACTIVE)? 1 : (RETRACTING)? 1 - t/retractMs : 0`，`t∈[0, stateMs]`。
- **碰撞盒顶**：`top(px) = anchorY(px) - p × height(px)`，`anchorY = 224 px`（ty7 顶），`height = 48 px`。
- **交替双苞相位**：苞 B 起始计时 `t0_B = (t0_A + phaseOffset) mod T`；`phaseOffset=1060ms` ⇒ 半周期错相，制造"一上一下"节奏走廊。
- **踩杀反弹**：复用 03 既有 `stompBounce = -300 px/s`，不新增。

---

## 5. 边缘情况（≥3 类）

1. **DORMANT 期间玩家站在苞位**：盒在地下，`overlaps()=false`，不伤不踩；玩家可站立于该格（等价普通地面），无异常。
2. **RETRACTING 窗口内玩家自侧方接触（非顶踩）**：`stompable=true` 仅对"玩家 `v.y>0` 且底触顶"生效（GDD04 判定）；侧 / 底接触不触发踩杀，且 RETRACTING `hazard=false`，也不受伤 → **安全穿越**（可借缩回期从侧面挤过，无惩罚）。
3. **状态切换帧的踩踏竞态**：若同一固定步内苞从 ACTIVE 切到 RETRACTING，踩踏判定以**切换后**的 `isStompable` 为准（RETRACTING→true），保证窗口边界可踩，避免"差一帧不可踩"的不公平。
4. **phaseOffset ≥ T**：`t0 = phaseOffset mod T` 归一化，防止超周期偏移导致初始相位异常。
5. **多苞同屏性能**：沿用 GDD04 对象池 + 仅激活屏内 AI；gu_bao 无弹丸、无额外 GC 压力（纯计时状态机）。

---

## 6. UI 接口（渲染 / 音频，程序化占位）

- **渲染**：`game/render/enemy-view.ts` 程序化占位（Phaser Graphics 画苞体圆角矩形 + 三角尖刺；RETRACTING 期尖刺收起 / 变色表示"软顶可踩"）。MVP 无 PNG，沿用 enemy-view 对象池。苞体颜色见 §7.3。
- **音频（用户拍板：复用现有占位音，不新增 SFX 键）**：erupt 前摇 telegraph 复用现有通用占位音（如 impact/land stub）；踩杀复用既有 `ON_STOMP` 音频路径。**不新增任何 SFX 键**（守"不新增音效"决议）。

---

## 7. 依赖与正交性 / IP / 配色

### 7.1 与 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子）正交声明

- **GDD06（06-score-economy.md，form 字段）**：gu_bao 只读 / 写 `EnemyState`，**不**写 `form` 字段；踩杀仅触发 `ON_STOMP`（经济 +100），**不**改 form、不新增经济项（守"无主导策略"红线）。
- **GDD07（07-damage-statemachine.md，sizeScale）**：gu_bao **不**改 `sizeScale`（FULL=1 / SMALL=0.6）；碰撞盒高度由本 GDD `height=48` 决定，与受伤尺寸状态机正交；重生复位逻辑不变。
- **GDD12（12-seed-metamorphosis.md，种子蜕变）**：gu_bao 与种子**零耦合**；种子不进分数经济，gu_bao 踩杀进分但不影响成长；互不读写。
- **core 零平台**：新增枚举 / 状态 / 纯函数全部零 phaser/wx/window，可 headless 单测（仿 GDD04）。

### 7.2 IP 原创（地生苞，非管道植物）

- 命名"鼓苞"= 鼓胀的花苞，自然隐喻，呼应"种子唤醒大地"世界观；**非**任天堂食人花 / 管道植物（无管道、无大嘴）。
- 剪影：地面裂缝中升起的一枚**带尖刺的膨胀苞**（垂直柱状体），与现有四类（圆刺球 / 楔形 / 扁浮 / 方炮）轮廓全异。

### 7.3 锁色板配色建议（与 4 旧敌区分，限锁色板内）

锁色板（≤64）：草绿 `#7CC242` / 暖橙 `#F2933C` / 暖黄 `#FFD23F` / 警示红 `#E8483B` / 描边 `#2A1A12` / 环境冷蓝 `#4A78C0` / 天空 `#5BC8F5` / 蓝紫 `#6E7BF2`。

- **苞体**：**暖橙 `#F2933C`**（泥土 / 植物色，与 4 旧敌的草绿 / 钢蓝 / 方灰 / 警示红明显区分）。
- **尖刺顶（危险双编码）**：**警示红 `#E8483B`**（尖刺形状 + 红 = 危险语义，与 ci_li/chong_feng 共用红但靠"垂直柱 + 尖刺"剪影区分；色盲安全）。
- **缩回软顶（可踩提示）**：尖刺收起，苞顶转**暖黄 `#FFD23F`** 高光环（可踩语义），与互动青区分。
- **描边**：`#2A1A12`。**不新增色板色**。

---

## 8. 验收标准

- [ ] gu_bao 四态状态机由纯函数驱动，周期 = 2120ms（默认），可单测（headless）。
- [ ] DORMANT：地下、无碰撞、无害、不可踩（`overlaps=false`）。
- [ ] EMERGING/ACTIVE：危害，接触 → `ON_ENEMY_HIT_PLAYER`（走 GDD07 受伤管线，非瞬杀），不可踩。
- [ ] RETRACTING：非危害、可踩；玩家顶踩 → `ON_STOMP` +100 + 反弹（复用 03/06 管线）。
- [ ] 缩回静止期（DORMANT）明确不可踩、无害。
- [ ] 固定周期 + 可见前摇（telegraph），无 RNG、无"看不见致死"。
- [ ] `phaseOffset` 实例覆盖生效（双苞交替走廊可建）。
- [ ] 与 GDD06 form / GDD07 sizeScale / GDD12 种子正交：不改 form / sizeScale / 种子；仅复用 `ON_STOMP`。
- [ ] 音频：仅复用现有占位音，无新增 SFX 键。
- [ ] 配色限锁色板内（暖橙苞体 + 警示红刺 + 暖黄软顶），与 4 旧敌区分。
- [ ] IP 安全：地生苞、非管道植物、非任天堂符号。

---

## 9. 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 缩回窗口（160ms）过短导致不公平 | 窗口时长集中 config 可调（`retractMs`）；前摇 telegraph 保证可读；headless 单测验证周期边界 |
| R2 | 双苞交替相位错乱 | `phaseOffset mod T` 归一化；单测覆盖半周期错相 |
| R3 | 与 GDD04 踩踏管线冲突 | 纯加法扩展 `StompableHazard`，复用既有 `getBounds/markStomped`；不改动 4 旧敌 |
| R4 | 渲染占位与碰撞盒不一致 | 渲染读同一 emerge 进度 `p` 计算盒顶，单一真相源 |
| R5 | 认知过载（新敌 + 新主题） | 首个洞穴关仅引入 1 新元素（gu_bao），不组合弹藤；详见 2-1 content-spec |

---

## 待主理人确认

1. 默认周期 2120ms / 缩回窗口 160ms 是否合适（可随 QA 调校）？
2. gu_bao 是否保留"缩回可踩"奖励窗口（已定保留；若改纯计时危险需回退）？
3. `EnemyEntityDef` 增加可选 `params` 是否认可（仅 gu_bao 消费，向后兼容旧 4 敌实体）？

*本扩展 GDD 仅新增 13 + 配套 2-1 content-spec；未改动现有 GDD、未写 `src/`、未 git commit。*
