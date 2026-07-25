# 14 弹藤敌种 · 扩展 GDD（bouncy_vine）

> 类型：扩展 GDD（加法扩展 GDD04 敌人 AI）｜分层：Must（新元素深）
> 依赖：04 Enemy / 02 Physics / 03 Character / 06 Economy（仅复用通道，零计分）/ 09 Audio（复用占位）
> 评审强度：lean｜作者：文策渊（design-strategist）｜关联任务：DS-BC-01
> 上游提案：design/proposals/new-mechanic-candidates.md（候选方案 B · 弹藤，用户已拍板做 B）
> **正交红线**：不改 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子蜕变）/ 经济 / 种子；不引入新物理子系统（仅套用已有 v.y 覆写通道）；不新增音频键。
> **与 GDD13 关系**：同为新元素扩展 GDD，八节结构逐节对齐；弹藤为**纯辅助（非危害）**，与鼓苞（危害 + 缩回可踩窗口）角色互补、剪影/配色全异。

---

## 1. 概述（目的与范围）

新增**良性新元素** `bouncy_vine`（弹藤跳台），为关卡引入**「垂直越障 / 弧线规划」**这一新决策维度，填补 4 旧敌（ci_li / chong_feng / du_fu / shi_pao）与鼓苞均无"把玩家高高弹起"机制的空白。

- **范围**：仅扩充 `core/enemy` 状态机表（良性，零平台）＋ 关卡实体 ＋ 程序化占位渲染 ＋ 复用现有占位音；**不**引入新物理子系统（仅复用角色层既有的 `v.y` 覆写通道）、**不**改 form / sizeScale / 经济 / 种子。
- **落点层**：`core/enemy`（纯逻辑，零平台，可 headless 单测）＋ `game/render`（占位绘制）＋ 音频复用占位（无新增 SFX 键）。

### 1.1 概念 / MDA（新动词 = 踩 / 弹 / 够）

- **动词**：*踩（落上藤面）/ 弹（被高高弹起）/ 够（借弹起 + 二段跳够高处秘密）*。玩家踩上草藤线圈被弹起，越过宽沟、够到高处隐藏种子、或叠二段跳做更长弧线。
- **Mechanics**：玩家自上落下（`v.y>0`）且底触藤顶的**落地下降边沿**触发弹起，套用 `v.y = -bounceVelocity`（向上）；弹起后进入冷却，期间不可再触发。藤体**恒无害**（纯辅助）。
- **Dynamics**：玩家形成"我算准了弹跳落点"的**胜任感**；"走弹藤线还是绕路"的**自主决策**；高处秘密种子满足 **Discovery**。守"公平失败"支柱（弹起确定性、无随机）。
- **Aesthetics**：Challenge（主，弧线规划）＋ Discovery（隐藏高处）。
- **心流定位**：把"垂直越障"做成**可控的弧线规划**新维度（现有仅靠跳/二段跳，最大 ≈3.6 tile；弹藤显著更高更飘）。不引发认知过载（守 P1 跳 / P2 闯 / P3 蜕变支柱）。

---

## 2. 机制详述（行为规格）

状态机**事件驱动**（仿 GDD04 表驱动，但过渡由"玩家落地边沿"触发，非纯时间驱动），纯函数可单测，core 零平台。

| 状态 | 行为 | 碰撞 / 危害 | 可触发弹起 | 时长 |
|---|---|---|---|---|
| `IDLE` | 静止线圈，待命（p=0） | `overlaps()=true`（仅用于落地检测）；**hazard=false** | **是**（`launchReady=true`） | 持久（无定时器，等接触） |
| `SPRING` | 压缩→释放（p:0→1），**当帧套用弹起速度一次** | hazard=false | 否 | `springMs=80`（默认） |
| `RECOIL` | 回弹松弛（p:1→0），冷却窗口 | hazard=false | 否（冷却，防连弹/卡弹） | `recoilMs=180`（默认） |

- **触发条件（集成层派生，零平台）**：`contact = (player.vy > 0) && (player.bottom 与 vine.top 重合) && (上一帧 player 未与藤接触)` —— 即"顶部落地下降边沿"，**非持续重叠**。仅当 `state==IDLE && contact` 时进入 `SPRING`。
- **弹起（一次性）**：进入 `SPRING` 的**当帧**，`justFired=true`；集成层据此将 `player.vy = -bounceVelocity`（覆盖下落速度，确保向上），随后状态自然推进 `SPRING→RECOIL→IDLE`。
- **茎部是否受伤 —— 明确声明（见 §7 + 待确认 OPEN-1）**：**默认/推荐 = 茎部恒无害（`hazard=false` 全态）**。弹藤是纯辅助，玩家从任何方向接触都不受伤；唯一交互是"顶踩触发弹起"。不建议把茎部做成危害（会与鼓苞的危害角色混淆、引发"哪个会扎我"的认知过载）。
- **冷却语义**：`RECOIL` 期间即使玩家仍站在藤上也不重触发；离开后可再次弹起。配合"落地边沿"触发，杜绝"站着自动反复弹"的失控循环。
- **水平操控**：弹起**保留** `INPUT_LEFT/RIGHT`（与正常跳一致），玩家可在空中控横移找落点——守 P1"精准掌控"。

---

## 3. 数据模型（表驱动 + 纯函数 + 零平台落点）

### 3.1 `enemy-config.json` 新增项（集中数值，禁止硬编码）

```json
{
  "bouncy_vine": {
    "bounceVelocity": -680,
    "springMs": 80,
    "recoilMs": 180,
    "width": 40,
    "height": 16,
    "hazard": false,
    "baseYAnchor": "ground"
  },
  "gu_bao": { "...": "不变" }
}
```
> `bounceVelocity` 为负（Y 向下为正，向上为负）。`height=16` 为地面线圈厚度（扁），与鼓苞 `height=48` 垂直柱形态全异。

### 3.2 关卡实体 schema 扩展（per-instance 覆盖）

`EnemyEntityDef` 已含可选 `params`（GDD13 §3.2 已加，向后兼容）。弹藤消费：

```ts
export interface EnemyEntityDef {
  type: EnemyTypeName;          // 含 'bouncy_vine'
  x: number;                    // 世界坐标左（px）
  y: number;                    // 地面锚点 = ty7 顶 y=224（藤贴地，玩家站藤顶=地面高度）
  params?: { power?: 'weak'|'normal'|'strong'; cooldownMs?: number };
}
```
- `params.power`：弹起速度倍率（`weak=0.8` / `normal=1.0` / `strong=1.2`），实例级覆盖默认 `bounceVelocity`。
- 弹藤 `y` 语义：**地面锚点 = ty7 顶 y=224**（同 gu_bao；藤线圈贴地，玩家落点=地面高度）。文档与 JSON 均显式标注。

### 3.3 纯函数状态机（core/enemy 加法，零平台）

```ts
type BouncyVineState = 'IDLE' | 'SPRING' | 'RECOIL';

interface BouncyVineCfg {
  bounceVelocity: number; // 弹起速度（px/s，向上为负；默认 -680）
  springMs: number;       // 压缩/释放动画时长（ms）
  recoilMs: number;       // 冷却（不可再触发）时长（ms）
  width: number;          // 碰撞盒宽（px）
  height: number;         // 碰撞盒高（px，地面线圈厚度 ~16）
}

interface BouncyVineStep {
  state: BouncyVineState; // 推进后状态
  t: number;              // 推进后本态已用 ms
  p: number;              // 压缩/回弹进度 0..1（IDLE=0 / SPRING 升 / RECOIL 降）
  hazard: boolean;        // 恒 false（纯辅助）
  launchReady: boolean;   // IDLE=true，可触发弹起
  justFired: boolean;     // 当帧 IDLE→SPRING = true（集成层据此套用弹起速度一次）
}

/**
 * 单步推进纯函数。
 * @param s 当前态
 * @param t 当前态已用时间（ms）
 * @param dt 步长（秒，固定步长 1/60）
 * @param cfg 状态机数值
 * @param contact 集成层传入的「顶部落地下降边沿」布尔（player.vy>0 且底触藤顶且上帧未接触）
 *        —— 由集成层用 AABB 顶触检测派生，零平台、无 window/phaser 依赖
 * @returns 推进后的 { state, t, p, hazard, launchReady, justFired }
 */
function stepBouncyVine(
  s: BouncyVineState, t: number, dt: number,
  cfg: BouncyVineCfg, contact: boolean
): BouncyVineStep {
  // IDLE  + contact        -> SPRING (t=0, justFired=true, p=0)
  // SPRING: t+=dt*1000; p=t/springMs(clamp1); t>=springMs -> RECOIL(t=0)
  // RECOIL: t+=dt*1000; p=1-t/recoilMs;     t>=recoilMs -> IDLE(t=0,p=0)
  // justFired 仅 IDLE->SPRING 当帧为 true
}
```

- **几何**：碰撞盒 `top = anchorY - height`（`anchorY=224`，`height=16` → `top=208`）；`bottom = anchorY = 224`。玩家落点底触 `top` 触发。
- **`overlaps(body)`**：IDLE 返回 true（供落地检测），但 `hazard=false`；SPRING/RECOIL 返回 true（仍可被踩检测）亦 `hazard=false`。**全态非危害**。
- **弹起套用**：集成层在 `justFired` 帧执行 `player.vy = -cfg.bounceVelocity`（可叠 `params.power` 倍率）。

### 3.4 core 零平台落点（具体文件）

| 文件 | 改动 | 平台约束 |
|---|---|---|
| `src/core/enemy/enemy-types.ts` | `EnemyTypeName` 联合**加法**增 `'bouncy_vine'` | 零 phaser/wx/window |
| `src/core/enemy/enemy-ai.ts` | `update()` 增 `bouncy_vine` 分支（调 `stepBouncyVine`）；`overlaps()` 全态 `hazard=false`；`isStompable=false`（非击杀型）；`createEnemies` 透传 `params.power/cooldownMs` | 零平台，纯函数 |
| `src/core/enemy/bouncy-vine.ts` | 新增（仿 `gu-bao.ts`）：`stepBouncyVine` + `BouncyVineCfg/Step/State` + `resolveBouncyVinePower()` | 零平台，纯函数 |
| `src/config/enemy-config.json` | 增 `bouncy_vine` 项（§3.1） | 纯 JSON |
| `src/game/render/enemy-view.ts` | 程序化占位绘制藤线圈（MVP 无 PNG） | 仅 game/ 层 |
| `src/game/audio/*` | **不新增** SFX 键，复用现有占位音（见 §6） | — |

---

## 4. 公式（时序 / 几何 / 物理，标单位）

- **弹起高度**：`H_bounce = bounceVelocity² / (2 × GRAVITY)`（GRAVITY=1800 px/s²，GDD02）。默认 `bouncy_vine.bounceVelocity = -680` → `H = 680²/(2×1800) = 462400/3600 ≈ 128 px ≈ 4.0 tile`。
  - 对照：单跳 `JUMP_VELOCITY=-480` → 64px ≈ 2.0 tile；二段跳顶点叠加 ≈ 115.8px ≈ 3.6 tile。**弹藤 ≈ 4 tile，明显高过单跳，略高于二段跳顶点**（确立"够高"工具的唯一价值）。
  - **弹藤 + 二段跳**：自弹起顶点再二段跳 `+51.8px` → 约 `180px ≈ 5.6 tile` —— 高处秘密种子（~5 tile）仅此可达（守 Discovery）。
- **弹起速度套用**：`player.vy = max(player.vy, -bounceVelocity)`（确保净向上，覆盖下落）。
- **压缩/回弹进度**：`p(SPRING) = clamp(t/springMs, 0, 1)`；`p(RECOIL) = clamp(1 - t/recoilMs, 0, 1)`；`p(IDLE)=0`。
- **实例速度**：`v_inst = bounceVelocity × powerMul`（`weak=0.8`→-544≈3.2tile；`normal=1.0`→-680；`strong=1.2`→-816≈5.1tile）。
- **冷却总时长**：`T_cool = springMs + recoilMs = 80 + 180 = 260 ms`（默认；`params.cooldownMs` 可覆盖 `recoilMs`）。

---

## 5. 边缘情况（≥3 类）

1. **玩家站在藤上不动（持续重叠）**：因触发为"落地下降边沿"而非"持续重叠"，`contact` 仅首帧为真；弹起一次后进入 RECOIL（冷却），离开再落才重触发 → **无自动反复弹失控循环**。
2. **弹起中玩家从侧/底接触藤体**：`hazard=false` 全态，不伤；侧/底接触不触发弹起（仅顶部落地下沿触发）→ 安全穿越。
3. **强档（strong, -816）叠二段跳越顶**：高度约 5.6 tile，关卡高处平台/种子须据此布置；`bounceVelocity` 集中 config，QA 可下调防"飘出屏"。
4. **冷却帧内的重触发竞态**：RECOIL 期间 `launchReady=false`，同一步内 SPRING→RECOIL 切换后 `launchReady` 随态赋值 false，保证边界不可重弹，避免"差一帧连弹刷高"。
5. **多藤同屏性能**：沿用 GDD04 对象池 + 仅激活屏内 AI；弹藤无弹丸/无额外 GC 压力（纯计时 + 边沿检测状态机）。

---

## 6. UI 接口（渲染 / 音频，程序化占位）

- **渲染**：`game/render/enemy-view.ts` 程序化占位（Phaser Graphics 画扁圆盘线圈 + 卷曲纹；SPRING 期压缩、RECOIL 期回弹松弛）。MVP 无 PNG，沿用 enemy-view 对象池。藤体颜色见 §7.3。
- **音频（用户拍板：复用现有占位音，不新增 SFX 键）**：
  - 弹起触发：复用既有 `SFX_JUMP`（launch 占位）路径 —— **不新增任何 SFX 键**。
  - 玩家落地后：复用既有 `SFX_LAND` 路径（如关卡已有）。
  - 不在 `SfxName` 枚举增项（守 GDD09「不新增音频键」决议）。
- **集成事件（重要，守经济红线）**：弹藤**不**发射 `ON_STOMP`（该事件在 GDD06 会触发 +100 计分 + 敌死亡；反复弹跳刷分 = 主导策略风险）。改为发射**逻辑事件 `ON_BOUNCE`**（非 SFX 键、非经济事件），仅作"套用弹起速度"的信号；物理层消费后 `player.vy = -bounceVelocity`。
  - *若工程层希望借 `ON_STOMP` 通道套用弹起速度，须确保**绕过** GDD06 计分分支（仅取弹起响应，不进 +100 / 不杀敌）；推荐独立 `ON_BOUNCE` 零经济副作用事件。*

---

## 7. 依赖与正交性 / IP / 配色

### 7.1 与 GDD06（form）/ GDD07（sizeScale）/ GDD12（种子）正交声明

- **GDD06（06-score-economy.md，form 字段）**：弹藤只读 / 写 `EnemyState`，**不**写 `form` 字段；发射 `ON_BOUNCE`（零计分），**不**改 form、不新增经济项（守"无主导策略"红线）。
- **GDD07（07-damage-statemachine.md，sizeScale）**：弹藤 **不**改 `sizeScale`（FULL=1 / SMALL=0.6）；碰撞盒尺寸由本 GDD `width/height` 决定，与受伤尺寸状态机正交；重生复位逻辑不变。
- **GDD12（12-seed-metamorphosis.md，种子蜕变）**：弹藤与种子**零耦合**；种子不进分数经济，弹藤不读写成长。
- **core 零平台**：新增枚举 / 状态 / 纯函数全部零 phaser/wx/window，可 headless 单测（仿 GDD04/13）。
- **物理子系统**：仅复用角色层既有 `v.y` 覆写通道（GDD02/03 既有能力），**不引入新物理子系统**。

### 7.2 IP 原创（草藤线圈，非蘑菇弹簧）

- 命名"弹藤"= 弹性藤蔓线圈，自然隐喻，呼应"种子唤醒大地"世界观；**非**任天堂蘑菇 / 弹簧高跷符号（无蘑菇帽、无金属簧）。
- 剪影：地面上一枚**压缩的草藤线圈**（扁圆盘 + 卷曲纹），弹起时拉伸。与鼓苞（垂直刺苞柱）、4 旧敌（圆刺球 / 楔形 / 扁浮 / 方炮）轮廓全异。

### 7.3 锁色板配色建议（与鼓苞 / 4 旧敌区分，限锁色板内）

锁色板（≤64，11 色权威）：草绿 `#7CC242` / 阴影绿 `#5FA82F` / 暖橙 `#F2933C` / 暖黄 `#FFD23F` / 描边 `#2A1A12` / 命粉 `#F26D8B` / 警示红 `#E8483B` / 经济金 `#F2C94C` / 蓝紫 `#6E7BF2` / 环境冷蓝 `#4A78C0` / 天空 `#5BC8F5`。

- **藤体**：**草绿 `#7CC242`**（草原藤色，与鼓苞暖橙 `#F2933C`、4 旧敌钢蓝/石灰明显区分）。
- **高光环（可交互语义）**：**暖黄 `#FFD23F`** 环（友好辅助提示，与鼓苞 RETRACTING 软顶暖黄同源但语境不同：藤=常态友好、苞=限时可踩）。
- **描边**：`#2A1A12`。**不新增色板色**。
- **区分强化（防认知过载）**：形态上鼓苞=**高垂直刺柱（危险）**、弹藤=**扁地面线圈（友好）**；语义上鼓苞有警示红刺、弹藤用草绿+暖黄友好色 → 玩家一眼分辨"哪个会扎我、哪个托我"。

---

## 8. 验收标准

- [ ] 弹藤三态状态机由纯函数驱动（事件驱动，contact 触发），可单测（headless）。
- [ ] IDLE：待命、`launchReady=true`、hazard=false、非危害。
- [ ] 顶部落地下降边沿触发 → SPRING → `justFired=true` 当帧套用 `player.vy=-bounceVelocity`；弹起高度 ≈4 tile（默认 -680）。
- [ ] RECOIL 冷却期内不可重触发；离开后可再弹；无"站着自动反复弹"失控。
- [ ] **全态 hazard=false**（纯辅助，茎部不伤）；侧/底接触安全。
- [ ] 弹起保留水平操控（`INPUT_LEFT/RIGHT` 生效）。
- [ ] 与 GDD06 form / GDD07 sizeScale / GDD12 种子正交：不改 form / sizeScale / 种子；**发射 `ON_BOUNCE` 零计分**（不发射 `ON_STOMP` 防刷分）。
- [ ] 音频：仅复用现有占位音（`SFX_JUMP`/`SFX_LAND`），无新增 SFX 键。
- [ ] 配色限锁色板内（草绿藤体 + 暖黄高光），与鼓苞 / 4 旧敌区分（形态 + 颜色双编码）。
- [ ] IP 安全：草藤线圈、非蘑菇弹簧、非任天堂符号。

---

## 9. 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 弹起过高破坏 P1 手感（飘出屏 / 难控落点） | `bounceVelocity` 集中 config 可调；默认 -680≈4tile 克制；强档 -816 仅用于秘密段；手感沙盒量化 |
| R2 | 连续弹跳刷分（主导策略） | **不发射 `ON_STOMP`**，改零计分 `ON_BOUNCE`（§6 红线已锁） |
| R3 | 站在藤上自动反复弹（失控） | 触发限"落地下降边沿" + RECOIL 冷却（§2/§5 边缘情况 1） |
| R4 | 与 GDD04 踩踏管线冲突 | 弹藤 `isStompable=false`，走独立 `ON_BOUNCE` 通道，不改 4 旧敌 / 鼓苞 |
| R5 | 与鼓苞认知混淆（都"新元素"） | 形态（刺柱 vs 线圈）+ 颜色（橙 vs 绿）+ 角色（危害 vs 辅助）三重区分（§7.3） |
| R6 | 认知过载（新元素 + 新主题） | 首个弹藤关仅引入 1 新元素（弹藤），不组合鼓苞 / beat（见 2-2 content-spec §9） |

---

## 待主理人确认（OPEN 项）

- **OPEN-1（茎部危险？）**：默认推荐**茎部恒无害（纯辅助）**。备选 = 茎部带轻微接触伤害（走 GDD07 受伤管线）。**推荐保持非危害**，以与鼓苞危害角色清晰分离、避免认知过载。请带回用户拍板。
- **OPEN-2（弹起速度默认值）**：默认 `bounceVelocity=-680`（≈4 tile，明显高过单跳、略高于二段跳）。是否合适（可随 QA 调校至 -620~-760）？
- **OPEN-3（事件通道）**：本 GDD 选零计分 `ON_BOUNCE`（防刷分）。若工程层坚持复用 `ON_STOMP` 通道，须确保绕过 GDD06 计分分支——请确认采用哪种。
- **OPEN-4（2-2 旧敌组合）**：见 2-2-content-spec §4，本 GDD 推荐 `ci_li + du_fu + shi_pao`（省略 `chong_feng`），最终 3 选由用户拍板。

*本扩展 GDD 仅新增 14 + 配套 2-2 content-spec/design；未改动现有 GDD、未写 `src/`、未 git commit。*
