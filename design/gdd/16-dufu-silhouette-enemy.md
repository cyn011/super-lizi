# 16 嘟浮剪影 · 扩展 GDD（du_fu_silhouette）

> 类型：扩展 GDD（加法扩展 GDD04 敌人 AI）｜分层：Must（新敌种深）
> 依赖：04 Enemy / 06 Economy（仅复用 `ON_STOMP`） / 07 Damage（仅复用受伤管线） / 可选 biome 复用（vine_forest 推荐｜cave 备选，0 新增色） / 09 Audio（复用占位，无新增键）
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：DS-D1-01（优先级 high）
> 上游：GDD13/14/15 同构（八节对齐）；原版嘟浮 `du_fu` 规格见 art-bible §4.3 / asset-spec §2.3 / `enemy-ai.ts` `updateFloat`。
> **正交红线**：不改 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子蜕变）/ 经济 / 种子；不引入新物理子系统；不新增音频键；COLOR DELTA = 0 新增色（剪影复用 描边 `#2A1A12` 暗涂 + 暖黄 `#FFD23F` 发光边，均在锁色板内）。

---

## 1. 概述（目的与范围）

新增敌种变体 `du_fu_silhouette`（嘟浮剪影）：它是原版漂浮敌 `du_fu`（嘟浮，蓝紫 `#6E7BF2`、上下正弦浮动、可踩）的**暗色剪影重涂变体（silhouette recolor）**。除重涂外，它通过一种**行为扭曲（behavioral twist）**与原版区分，把"读浮动节奏"升级为新的解谜/挑战维度，而不新增物理子系统。

- **与原版嘟浮的关系（明确声明）**：
  - 剪影**复用嘟浮的浮动数学**（`y = baseY + amp·sin(phase)`，峰值竖直速度 `float`、振幅 `amp`），仅在此基础上叠加一种 twist（见 §2.2）。
  - 剪影**不是新物理实体**，是 `du_fu` 的"暗色镜像"——同一类浮空软顶敌，颜色反转 + 一种行为变体。
  - 剪影**同样可踩**（踩顶 → 复用 `ON_STOMP` +100，与 `du_fu` 一致）、**同样侧/底接触有害**（→ 复用 `ON_ENEMY_HIT_PLAYER`，走 GDD07 受伤管线，非瞬杀）。
- **范围**：仅扩充 `core/enemy` 状态机（零平台）＋ 关卡实体 ＋ 程序化占位渲染 ＋ 复用现有占位音；**不**引入新物理子系统、**不**改 form / sizeScale / 经济 / 种子。
- **落点层**：`core/enemy`（纯逻辑，零平台，可 headless 单测）＋ `game/render`（占位绘制）＋ 音频复用占位（无新增 SFX 键）。

### 1.1 行为扭曲（behavioral twist）· 三方案 + 推荐 + OPEN

> **OPEN-TWIST（关键待定项）**：剪影的行为扭曲有 A/B/C 三候选，本 GDD 默认按 **A. 镜像分身** 编写全部数值与状态机；请主理人将 OPEN-TWIST 带回用户拍板。

- **A. 镜像分身（mirror）【推荐】**：剪影与原嘟浮**反相浮动**（相位差 `π`），二者成对出现形成"一个升、它落"的对称解谜。配对的光嘟浮与暗剪影共享 `baseY/amp/float`，仅相位反相 → 纯几何反相，**零新物理、零 RNG、最低风险**。隐喻直给：剪影本就是"反相的暗色镜像"。
- **B. 静态诱饵（decoy）**：静止暗影，玩家靠近（`decoyTriggerDist` 内）才**激活**开始浮动。制造"暗影突袭"张力；代价是需 `IDLE→FLOAT` 唤醒 FSM + 唤醒 telegraph，行为与浮空敌偏离较大、复杂度更高。
- **C. 相位幽灵（phaseghost）**：周期性半透明（`SOLID↔WRAITH` 切换）；`SOLID` 期可见可踩可伤，`WRAITH` 期半透不可踩不可伤（可穿越）。新增"时序可踩窗口"维度；但暗色 + 半透明在暗背景下易糊，需发光边托底（见 §6 / §7.3）。

> **推荐理由（A）**：① 最忠实"剪影=反相暗镜像"隐喻；② 复用浮动数学、仅加 `π` 相位差，工程风险最低；③ "反相成对"本身是最强可读线索，天然满足"剪影必须与原嘟浮可区分"的可访问性硬要求（§6）；④ "对称解谜"与 2-4「剪影回廊」主题契合。B/C 作为备选，若用户拍板则按 §2.2 / §4 备选公式切换。

### 1.2 概念 / MDA（新动词 = 读镜像 / 踩暗影）

- **动词**：*读（成对浮动的相位关系）/ 踩（暗色软顶踩杀）/ 避（侧触受伤）*。玩家面对成对的光/暗浮空敌，须读准"一个升、一个落"的反相关系，找干净间隙通过或踩杀。
- **Mechanics**：剪影以反相（A）/ 唤醒（B）/ 半透周期（C）区别于原嘟浮；其余浮动、可踩、侧伤一致。
- **Dynamics**：玩家形成"我看懂了这对镜像"的**胜任感**；"踩哪个、何时过"的**自主决策**；对称构图满足 **Discovery**。守"公平失败"支柱（浮动确定性、无 RNG）。
- **Aesthetics**：Challenge（主，读相位）＋ Discovery（对称构图）。
- **心流定位**：把"浮动节奏"做成**成对对称的可读解谜**（固定反相 + 可见浮动），不引发认知过载（守 P1 跳 / P2 闯 / P3 蜕变支柱）。

---

## 2. 机制详述（行为规格）

剪影沿用 GDD04 表驱动 / 纯函数范式，零平台、可单测。状态机为**简单四态**（IDLE / FLOAT / SOLID / WRAITH），按 twist 启用不同子集：

| 状态 | 适用 twist | 行为 | 碰撞 / 危害 | 可踩 | 说明 |
|---|---|---|---|---|---|
| `IDLE` | B（decoy） | 静止于 `baseY`，无浮动 | `overlaps=false`（休眠无害） | 否 | 仅 decoy 休眠期；mirror/phaseghost 不使用 |
| `FLOAT` | A / B(激活后) / C | 正弦浮动 `y=baseY+amp·sin(phase+offset)` | 危害（侧触 → `ON_ENEMY_HIT_PLAYER`） | 随 twist | 主浮动态；A 恒 FLOAT，B 唤醒后 FLOAT，C 在 FLOAT 内叠加 ghost 子态 |
| `SOLID` | C（phaseghost） | FLOAT 中"可见"子态（`ghostPhase mod 1 < ghostSolidRatio`） | 危害 | **是**（踩 → `ON_STOMP`） | 可踩可伤窗口 |
| `WRAITH` | C（phaseghost） | FLOAT 中"半透"子态（其余相位） | `overlaps=false`（不可伤、可穿越） | 否 | 不可踩、可穿越 |

- **浮动（共用）**：`omega = float/amp`（rad/s，峰值竖直速度 = `float`）；`phase += omega·dt`；`y = baseY + amp·sin(phase + mirrorOffset)`（`mirrorOffset=π` 即反相）。`vx=0`，`vy=float·cos(phase+offset)`。
- **踩杀**：`stompable` 为真且玩家自上方踩中（`v.y>0` 且底触顶）→ 标记死亡 → 集成层发 `ON_STOMP` +100 + 反弹（复用 GDD03/06 既有踩踏管线，**无新经济项**）。
- **危险期接触**：`hazard` 为真且侧/底接触 → `ON_ENEMY_HIT_PLAYER`（走 GDD07 受伤管线，非瞬杀）；与踩踏互斥（GDD04 规则）。
- **公平性**：浮动固定（无 RNG），剪影与配对光嘟浮同 `baseY/amp/float`、仅相位反相 → 反相关系可预测、可"背"（守美术可读性 + 公平失败）。

### 2.2 三 twist 行为细则（默认按 A 编写，B/C 备选）

- **A. mirror（默认）**：`mode` 恒 `FLOAT`，`ghost` 恒 `SOLID`；`mirrorOffset=π`。成对光嘟浮（同 `baseY/amp/float`，`phase` 同基准）与剪影反相 → 一个升它落。无唤醒/无半透，纯几何反相。
- **B. decoy（备选）**：初始 `mode=IDLE`（静止无害）；集成层每帧把玩家邻近布尔写入 `state.playerProximity`（零平台，仅布尔）；`playerProximity && mode==IDLE` → 切 `FLOAT` 并 emit `ACTIVATED`（benign）。唤醒后行为同 A（浮动 + 可踩/可伤）。
- **C. phaseghost（备选）**：`mode` 恒 `FLOAT`；`ghostPhase += dt*1000/ghostPeriodMs`；`ghost = (ghostPhase mod 1) < ghostSolidRatio ? SOLID : WRAITH`。`SOLID`：`stompable=true, hazard=true`；`WRAITH`：`stompable=false, hazard=false`（`overlaps=false`，可穿越）。切换 emit `GHOST_SHIFT`（benign）。

---

## 3. 数据模型（表驱动 + 纯函数 + 零平台落点）

### 3.1 `enemy-config.json` 新增项（集中数值，禁止硬编码）

```json
{
  "du_fu_silhouette": {
    "float": 60,
    "amp": 24,
    "width": 24,
    "height": 24,
    "stompable": true,
    "twist": "mirror",
    "mirrorOffset": 3.14159,
    "decoyTriggerDist": 96,
    "ghostPeriodMs": 2000,
    "ghostSolidRatio": 0.4,
    "baseYAnchor": "air"
  }
}
```
> 数值**全部沿用原嘟浮**（float=60/amp=24/width=24/height=24/stompable=true），保证"同样的浮动手感、只是暗色 + 一种 twist"；twist 相关参数仅剪影消费。

### 3.2 关卡实体 schema 扩展（per-instance 覆盖）

`EnemyEntityDef` 已含可选 `params`（GDD13 §3.2 已加，向后兼容）。剪影消费：

```ts
export interface EnemyEntityDef {
  type: EnemyTypeName;          // 含 'du_fu_silhouette'
  x: number;                    // 世界坐标左（px）
  y: number;                    // 浮动基准 baseY（px），同 du_fu（默认 120）
  params?: {
    twist?: 'mirror'|'decoy'|'phaseghost';
    mirrorOffset?: number;      // 反相位差（默认 π）
    pairId?: number;            // 配对光嘟浮实例 id（mirror 用，集成层据此对齐相位基准）
    decoyTriggerDist?: number;
    ghostPeriodMs?: number;
    ghostSolidRatio?: number;
  };
}
```

### 3.3 纯函数状态机契约草稿（core/enemy 加法，零平台）

> **契约红线**：零平台依赖、**输入仅 `state + dt`**、**输出新 `state` + 事件列表**。cfg 派生数值在构造期烘焙进 `state`（同 gu_bao 将 `guBaoCfg` 预存实例字段），故 `stepDufuSilhouette(state, dt)` 不读外部 config、不碰 window/phaser/wx。

```ts
// 新增文件：src/core/enemy/du-fu-silhouette.ts（仿 gu-bao.ts / bouncy-vine.ts / cyclone.ts，零平台）
// 签名严格：stepDufuSilhouette(state, dt) —— 输入仅 state + dt，输出新 state + 事件列表。

type DufuSilhouetteTwist = 'mirror' | 'decoy' | 'phaseghost';
type DufuSilhouetteMode  = 'IDLE' | 'FLOAT';       // IDLE=decoy 休眠；FLOAT=浮动态（A/B激活/C 共用）
type DufuSilhouetteGhost = 'SOLID' | 'WRAITH';      // 仅 phaseghost：SOLID=可见可踩可伤；WRAITH=半透穿越

interface DufuSilhouetteState {
  mode: DufuSilhouetteMode;
  ghost: DufuSilhouetteGhost;     // 仅 twist=phaseghost 使用；其余恒 'SOLID'
  phase: number;                  // 浮动正弦相位（rad）
  ghostPhase: number;             // 相位幽灵半透周期相位（0..1）
  baseY: number;                  // 浮动基准 y（px）
  x: number; y: number;           // 当前世界坐标（px）；y = baseY + amp·sin(phase + mirrorOffset)
  vx: number; vy: number;
  playerProximity: boolean;       // 集成层每帧写入（decoy 激活用；零平台，仅布尔）
  // —— cfg 派生数值（构造期烘焙进 state，保证"输入仅 state+dt"）——
  twist: DufuSilhouetteTwist;
  float: number;                  // 峰值竖直速度（px/s，默认 60）
  amp: number;                    // 振幅（px，默认 24）
  mirrorOffset: number;           // 反相位差（默认 π）
  decoyTriggerDist: number;       // 激活距离（px，默认 96）
  ghostPeriodMs: number;          // 整周期（默认 2000）
  ghostSolidRatio: number;        // SOLID 占比（默认 0.4）
  stompable: boolean;             // 由 mode/ghost 动态赋值
  hazard: boolean;                // 由 mode/ghost 动态赋值
  dead: boolean;
}

type DufuSilhouetteEvent =
  | 'ACTIVATED'     // decoy：IDLE→FLOAT（benign，复用现有占位音，不新增键）
  | 'GHOST_SHIFT'   // phaseghost：SOLID↔WRAITH 切换（benign）
  | 'IDLE';         // 占位（无事件）

interface DufuSilhouetteStep {
  state: DufuSilhouetteState;     // 推进后新 state
  events: DufuSilhouetteEvent[];  // 本步 benign 事件（踩杀/受伤由集成层 on 碰撞发 ON_STOMP / ON_ENEMY_HIT_PLAYER）
}

/**
 * 单步推进纯函数（零平台；输入仅 state + dt；输出新 state + 事件列表）。
 * - mirror：y = baseY + amp·sin(phase + mirrorOffset)；mode 恒 FLOAT；stompable/hazard 同 du_fu。
 * - decoy ：playerProximity 且 mode=IDLE → 切 FLOAT（emit ACTIVATED）；否则静止于 baseY。
 * - phaseghost：ghostPhase += dt*1000/ghostPeriodMs；ghost=(ghostPhase mod 1)<ghostSolidRatio?SOLID:WRAITH；
 *             SOLID→stompable=hazard=true；WRAITH→stompable=hazard=false（overlaps=false，可穿越）；切换 emit GHOST_SHIFT。
 * 踩杀/接触受伤由集成层（overlaps + markStomped）派生，复用 ON_STOMP / ON_ENEMY_HIT_PLAYER，不在此函数内发。
 */
function stepDufuSilhouette(s: DufuSilhouetteState, dt: number): DufuSilhouetteStep {
  // const omega = s.float / s.amp;
  // s.phase += omega * dt;
  // s.y = s.baseY + s.amp * Math.sin(s.phase + s.mirrorOffset);
  // s.vy = s.float * Math.cos(s.phase + s.mirrorOffset);
  // —— twist 分支（见 §2.2）——
  // mirror: s.mode='FLOAT'; s.stompable=s.hazard=true;
  // decoy : if (s.playerProximity && s.mode==='IDLE'){ s.mode='FLOAT'; events.push('ACTIVATED'); }
  //         s.stompable = s.hazard = (s.mode==='FLOAT');
  // phaseghost: s.ghostPhase = (s.ghostPhase + dt*1000/s.ghostPeriodMs) % 1;
  //         const solid = s.ghostPhase < s.ghostSolidRatio;
  //         if (solid !== (s.ghost==='SOLID')){ s.ghost = solid?'SOLID':'WRAITH'; events.push('GHOST_SHIFT'); }
  //         s.stompable = s.hazard = (s.ghost==='SOLID');
  // return { state: s, events };
}
```
> 注：本函数为**规格草稿**，不实现；落地由 engineering-lead 在 `src/core/enemy/du-fu-silhouette.ts` 完成（零平台）。

### 3.4 core 零平台落点（具体文件）

| 文件 | 改动 | 平台约束 |
|---|---|---|
| `src/core/enemy/enemy-types.ts` | `EnemyTypeName` 联合**加法**增 `'du_fu_silhouette'`；`EnemyEntityDef` 增可选 `params`（twist/pairId 等，向后兼容） | 零 phaser/wx/window |
| `src/core/enemy/du-fu-silhouette.ts` | 新增（仿 `gu-bao.ts`）：`stepDufuSilhouette` + `DufuSilhouetteState/Cfg/Step/Twist` + `resolveSilhouetteCfg()` | 零平台，纯函数 |
| `src/core/enemy/enemy-ai.ts` | `update()` 增 `du_fu_silhouette` 分支（调 `stepDufuSilhouette`）；`overlaps()` 按 `mode/ghost` 短路（IDLE/WRAITH→false）；`isStompable` 随态赋值；`createEnemies` 识别并透传 `params` | 零平台，纯函数 |
| `src/config/enemy-config.json` | 增 `du_fu_silhouette` 项（§3.1） | 纯 JSON |
| `src/game/render/enemy-view.ts` | 程序化占位绘制暗色剪影（MVP 无 PNG） | 仅 game/ 层 |
| `src/game/audio/*` | **不新增** SFX 键，复用现有占位音（见 §6） | — |

> **工程备注（OPEN-BASE-REFACTOR，非阻塞）**：原版 `du_fu` 当前是 `enemy-ai.ts` 内联 `updateFloat`，**无独立 `stepDufu` 纯函数文件**（与 gu_bao/bouncy_vine/cyclone 的范式不一致）。本 GDD 新拆 `du-fu-silhouette.ts` 独立纯函数；建议后续将 `updateFloat` 抽为 `stepDufu(state, dt)` 以与本范式完全对齐（不影响玩法，纯重构）。

---

## 4. 公式（时序 / 几何，标单位）

- **浮动角速度**：`omega = float / amp`（rad/s）；默认 `60/24 = 2.5 rad/s` → 周期 `T_float = 2π/omega ≈ 2.513 s`。
- **浮动位置**：`y(px) = baseY(px) + amp(px)·sin(phase + mirrorOffset)`，`amp=24 px`；`vy(px/s) = float·cos(phase+offset)`，峰值 `= float = 60 px/s`。
- **反相（mirror）**：`mirrorOffset=π` ⇒ 剪影与配对光嘟浮 `y` 恒相差 `2·amp·|sin|` 峰值 `48px`，且二者 `vy` 反号（一个升它落）。
- **唤醒（decoy）**：`decoyTriggerDist=96 px`（=3 tile）；玩家中心距 ≤ 该值且 `mode=IDLE` → 切 `FLOAT`。
- **相位幽灵（phaseghost）**：`ghostPeriodMs=2000`；`SOLID` 窗口 `= ghostSolidRatio × ghostPeriodMs = 0.4×2000 = 800 ms`（可踩可伤）；`WRAITH` 窗口 `= 1200 ms`（可穿越）。
- **踩杀反弹**：复用 GDD03 既有 `stompBounce = -300 px/s`，不新增。

---

## 5. 边缘情况（≥3 类）

1. **mirror 配对相位基准未对齐**：构造期剪影与配对光嘟浮共享 `baseY/amp/float` 且 `phase` 同基准、`mirrorOffset=π` → 反相从 `t=0` 成立、无 RNG、无漂移；单测覆盖反相关系。
2. **decoy 玩家反复进出触发距离**：`playerProximity` 每帧重写；仅 `IDLE→FLOAT` 边沿 emit `ACTIVATED`，离开后保持 `FLOAT`（不退回 IDLE，避免"闪烁唤醒"）；若需休眠可加冷却（config 可选）。
3. **phaseghost 切换帧的踩踏竞态**：同一步内 `SOLID→WRAITH` 切换，踩踏判定以**切换后** `stompable` 为准（WRAITH→false），保证边界不可踩、公平；`overlaps` 同步 `false` 防误伤。
4. **WRAITH 期玩家与剪影重叠**：`overlaps=false` → 不伤不踩、可穿越（纯视觉暗影），无卡死。
5. **多剪影同屏性能**：沿用 GDD04 对象池 + 仅激活屏内 AI；纯计时状态机、无弹丸、无额外 GC 压力。

---

## 6. UI 接口（渲染 / 音频，程序化占位）

- **渲染**：`game/render/enemy-view.ts` 程序化占位（Phaser Graphics 画暗色扁圆 + 反向翅 + 暖黄发光边；phaseghost 的 WRAITH 期 alpha 降至 ≤0.4）。MVP 无 PNG，沿用 enemy-view 对象池。剪影配色见 §7.3。
- **音频（用户拍板：复用现有占位音，不新增 SFX 键）**：
  - 踩杀：复用既有 `ON_STOMP` 音频路径（与 `du_fu` 一致）。
  - 接触受伤：复用 `ON_ENEMY_HIT_PLAYER` 音频路径（GDD07 受伤管线）。
  - decoy 唤醒 `ACTIVATED` / phaseghost `GHOST_SHIFT`：复用现有通用占位音（impact/idle stub），**不新增任何 SFX 键**（守 GDD09「不新增音频键」决议）。
- **集成事件（守经济红线）**：踩杀复用 `ON_STOMP`（+100，无新经济项）；接触受伤复用 `ON_ENEMY_HIT_PLAYER`；`ACTIVATED`/`GHOST_SHIFT` 为 **benign 占位事件**（不进经济、不新增音频键）。

---

## 7. 依赖与正交性 / IP / 配色

### 7.1 与 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子）正交声明

- **GDD06（form）**：剪影只读 / 写 `EnemyState`，**不**写 `form`；踩杀仅触发 `ON_STOMP`（经济 +100），**不**改 form、不新增经济项（守"无主导策略"红线）。
- **GDD07（sizeScale）**：剪影 **不**改 `sizeScale`（FULL=1 / SMALL=0.6）；碰撞盒 `width/height=24` 同原嘟浮，与受伤尺寸状态机正交；重生复位逻辑不变。
- **GDD12（种子）**：剪影与种子**零耦合**；种子不进分数经济，剪影踩杀进分但不影响成长；互不读写。
- **core 零平台**：`stepDufuSilhouette` 纯函数，输入仅 `state + dt`，无 window/phaser/wx，可 headless 单测（仿 GDD04/13/14/15）。
- **物理子系统**：仅复用角色层既有浮动数学（与原 `du_fu` 同），**不引入新物理子系统**。

### 7.2 IP 原创（暗色镜像嘟浮，非任天堂符号）

- 命名"嘟浮剪影"= 嘟浮的暗色镜像变体，自然隐喻，呼应"种子唤醒大地"世界观；**非**任何任天堂敌人（无帽子/龟壳/管道）。
- 剪影：暗色扁圆 + **反向翅（翅尖朝下 / 撕裂缺口）**，与原嘟浮（翅朝上）轮廓即分；加暖黄发光边强化"暗中显形"。

### 7.3 锁色板配色建议（限锁色板内 · COLOR DELTA = 0）

锁色板（≤64，11 色权威）：草绿 `#7CC242` / 阴影绿 `#5FA82F` / 暖橙 `#F2933C` / 暖黄 `#FFD23F` / 描边 `#2A1A12` / 命粉 `#F26D8B` / 警示红 `#E8483B` / 经济金 `#F2C94C` / 蓝紫 `#6E7BF2` / 环境冷蓝 `#4A78C0` / 天空 `#5BC8F5`。

- **剪影主体**：**描边 `#2A1A12`**（暗涂，与原嘟浮 蓝紫 `#6E7BF2` 明度反差极大）。
- **发光边（可访问性关键）**：**暖黄 `#FFD23F`** 1px 边（复用锁色板，0 新增）→ 把暗剪影从任何背景"勾"出来，且与原嘟浮（无暖黄边）形状双编码区分。
- **描边**：`#2A1A12`。**不新增色板色 → COLOR DELTA = 0**。

### 7.4 可访问性（重点 · 与原嘟浮区分 + 防认知混淆）

> 剪影是暗色重涂，**必须与原版嘟浮可区分**。提供**四重区分线索**（形状 + 颜色/明度 + 发光边 + 动效），满足 art-bible §9.1「绝不只用颜色传递关键信息」：

1. **颜色/明度（主）**：原嘟浮=亮蓝紫 `#6E7BF2`；剪影=暗 `#2A1A12`。明度差大 → 一眼区分。仅靠此不够，故叠加下三项。
2. **形状（轮廓）**：剪影**翅尖反向（朝下）/ 边缘撕裂缺口**，原嘟浮翅朝上 → 轮廓即分（art-bible §4.3 剪影法则：轮廓优先）。
3. **发光边（描边强化）**：剪影带**暖黄 `#FFD23F` 发光边**，原嘟浮无 → 进一步分离，且防暗背景吞噬。
4. **动效（mirror twist 最强）**：剪影与配对光嘟浮**反相浮动**（一个升它落）→ 成对的镜像动效本身是最强可读线索；phaseghost 下周期性半透闪烁；decoy 下静止→激活突变动效。
- **色盲安全**：区分依赖**明度（暗 vs 亮）+ 形状（翅向）+ 动效（反相）**，非仅靠 hue → 色盲可辨；暖黄发光边在「色盲辅助模式」（白描边脉冲，art-bible §9.1）下仍成立。
- **亮背景依赖（决定主题选择）**：art-bible §3.3 要求前景/背景亮度对比 ≥3:1。vine_forest 亮背景（天空 `#5BC8F5`/草绿 `#7CC242`）使暗剪影**高对比可辨**；cave 暗背景（`#1C2E49`）会使暗剪影融入 → 故**推荐 2-4 复用 vine_forest**（见 OPEN-THEME）。

> **OPEN-A11Y（区分线索）**：四重线索（暗色 + 反向翅 + 暖黄发光边 + 镜像动效）**全选为推荐**；请用户确认是否全选，或精简（如去掉发光边以更"纯剪影"，但需承担暗背景对比风险）。

---

## 8. 验收标准

- [ ] `du_fu_silhouette` 由纯函数 `stepDufuSilhouette(state, dt)` 驱动，输入仅 `state+dt`，输出新 `state + 事件列表`，可单测（headless）。
- [ ] 浮动数学与原 `du_fu` 一致（float=60/amp=24，周期 ≈2.513s），无新物理子系统。
- [ ] **twist=mirror（默认）**：剪影与配对光嘟浮反相（`mirrorOffset=π`），一个升它落；可预测、无 RNG。
- [ ] 踩杀（顶踩且 `stompable`）：复用 `ON_STOMP` +100 + 反弹（GDD03/06 管线）。
- [ ] 侧/底接触（`hazard`）：复用 `ON_ENEMY_HIT_PLAYER`（GDD07 受伤管线，非瞬杀）。
- [ ] decoy（备选）：`playerProximity` 且 `IDLE` → `FLOAT` + emit `ACTIVATED`；无闪烁唤醒。
- [ ] phaseghost（备选）：`SOLID` 可踩可伤、`WRAITH` 不可踩可穿越（`overlaps=false`）；切换 emit `GHOST_SHIFT`。
- [ ] 与 GDD06 form / GDD07 sizeScale / GDD12 种子正交：不改 form / sizeScale / 种子；仅复用 `ON_STOMP`。
- [ ] 音频：仅复用现有占位音，无新增 SFX 键。
- [ ] 配色限锁色板内（暗涂 `#2A1A12` + 暖黄发光边 `#FFD23F`），`COLOR DELTA = 0`。
- [ ] 可访问性：四重区分线索（暗色 + 反向翅 + 暖黄边 + 镜像动效）生效，与原嘟浮可区分、防认知混淆、色盲安全。
- [ ] IP 安全：暗色镜像嘟浮、非任天堂符号。

---

## 9. 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 暗色剪影在洞穴暗背景下对比不足（融入背景） | **推荐 2-4 复用 vine_forest 亮背景**（高对比）；若改 cave，须靠暖黄发光边托底（§7.3/§7.4） |
| R2 | 玩家误判"暗=无害阴影"而撞上 | 暖黄发光边 + 反向翅 + 镜像动效三重区分；且剪影与 du_fu 同为可踩/可伤，误踩无害（仅受伤同原嘟浮） |
| R3 | 镜像配对相位错乱 | `mirrorOffset=π` 恒反相 + 配对共享 baseY/amp/float，无 RNG；headless 单测覆盖反相 |
| R4 | 相位幽灵可踩窗口过短 → 不公平 | `ghostSolidRatio` 集中 config（默认 0.4）；边界以切换后 `stompable` 为准（§5） |
| R5 | 认知过载（新变体 + 新主题） | 2-4 仅引入 1 新元素（剪影），不组合弹藤/气旋/beat；检查点密度一致（2 个） |
| R6 | 与 GDD04 踩踏管线冲突 | 复用既有 `StompableHazard` 接口（`getBounds/markStomped`），不改旧敌 / 原嘟浮 |

---

## 待主理人确认（OPEN 项）

- **OPEN-TWIST（行为扭曲 A/B/C · 关键）**：默认推荐 **A. 镜像分身（mirror，反相成对）**。备选 B. 静态诱饵（decoy）/ C. 相位幽灵（phaseghost）。**请带回用户拍板**（本 GDD 全部数值按 A 编写，B/C 见 §2.2/§4 备选）。
- **OPEN-THEME（2-4 落点 / 主题）**：默认推荐 **新建 2-4「剪影回廊」+ 复用 `vine_forest`**（亮背景确保暗剪影高对比）。备选：① 融入 2-2（vine_forest，替换部分弹藤密度）；② 复用 `cave`（暗背景，需暖黄边托底）。**请带回用户拍板**。
- **OPEN-A11Y（区分线索）**：推荐**四重全选**（暗色 + 反向翅 + 暖黄发光边 + 镜像动效）。可精简？请用户确认。
- **OPEN-COMBO（旧敌组合）**：推荐 `du_fu_silhouette`(×3) + `du_fu`(×3，镜像配对) + `ci_li`(×2) + `shi_pao`(×2)（3 对镜像 + 地面/高位威胁）。`bouncy_vine` 可选加 1–2 做垂直点缀（默认省略以保剪影为星）。请用户确认。
- **OPEN-BASE-REFACTOR（工程备注，非阻塞）**：原 `du_fu` 为 `enemy-ai.ts` 内联 `updateFloat`，无独立 `stepDufu`；建议后续抽 `stepDufu` 与本纯函数范式对齐。

*本扩展 GDD 仅新增 16 + 配套 2-4 content-spec/design；未改动现有 GDD 数值、未写 `src/`、未 git commit。*
