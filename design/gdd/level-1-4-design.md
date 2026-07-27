# 关卡设计稿 · 1-4《灼沙绿洲》（沙漠主题）

> 文档类型：关卡内容设计稿（GDD 级，加法扩展）｜roadmap 批次 3：沙漠 1-4（高）
> 作者：文策渊（design-strategist）
> 上游依据：`design/gdd/theme-system.md` §4.1（desert 行：通用敌4 + 蝎子 scorpion + 沙漠机制 quicksand + 仙人掌 cactus + deco_dune/pyramid）｜`art/desert-biome-spec.md`（§3 scorpion/cactus 视觉、§3.3 quicksand 视觉、§8 调色板契约 8 hex、§5 背景层）｜`src/config/levels/1-3.json`（1-3 海关卡 JSON Schema）｜`design/gdd/level-1-3-design.md`（1-3 设计文档）
> **红线**：沿用现有 `LevelData` Schema（tileSize=32、height=9）；零位图（ADR-004，纯 Graphics + 系统字体 + tint）；11 色锁色板（仅引用 biome 规格既有色语义，0 新增 hex）；MVP 全程序化占位；IP 全原创、禁任天堂符号。
> **本文件只写设计稿，不写/改任何 `.ts` 源码，不 git commit。** 标记为「⚙️ 需工程」的项为对 `LevelData` / 引擎的建议扩展，提交 engineering-lead 落地。

---

## 1. 关卡概述

| 项 | 值 |
|---|---|
| 关卡 id | `1-4` |
| 关名（建议） | **《灼沙绿洲》**（备选：《赤沙灼日》《瀚海流金》《流沙遗城》） |
| 主题 theme | `desert`（新增 palette，见 `art/desert-biome-spec.md` §1.2 权威 8 槽） |
| 在世界 1 的位置 | 第 4 关，紧接 1-3 `sea`（潮洫）之后，作为世界 1 收尾的「灼热沙海」关 |
| 难度定位 | **比 1-3 略难、略长**；承接 1-3 之后的波浪难度——1-3 是「新奇尖峰（潮汐改路·软伤害）」，1-4 升为「机制压力峰（流沙下陷·触底即死）」，但靠 telegraph + 检查点拉回公平区 |
| 设计支柱对齐 | P1 跳（踩 ci_li/du_fu + 跨流沙跳跃 + bp_desert）｜P2 闯（流沙 timing + 蝎子规避）｜P3 蜕变（保留 seed 实体） |

**定位理由**：world 1 难度曲线 = 1-1 草原教学 → 1-2 山川（落石/gu_bao 一个挑战峰）→ 1-3 海（潮汐·软伤害新奇峰）→ **1-4 沙漠（流沙·触底即死压力峰 + 蝎子/仙人掌新敌障）**。沙漠只引入 **1 个新地形机制（quicksand 流沙）** + **1 个新敌（scorpion 蝎子）** + **1 个新固定障碍（cactus 仙人掌）**，符合 theme-system §2.3「每主题只叠加 1–2 个新机制，不造成认知过载」。

---

## 2. 关卡结构与尺寸

| 参数 | 1-4 建议 | 对照 1-3 |
|---|---|---|
| `tileSize` | 32 | 32 |
| `width`（瓦片） | **54**（世界宽 = 1728px，比 1-3 的 52 略增） | 52 |
| `height`（瓦片） | 9（=288px，逻辑分辨率） | 9 |
| 地面 | ty=7,8 全宽实心（tx 0..53） | 同 |
| 左右墙 | tx=0 与 tx=53 的 ty 0..6 实心（防越界） | 同 |

**布局分区（左→右）**

| 区段 | tx 区间 | 内容 | 流沙 |
|---|---|---|---|
| 引导段 | 1..12 | 平地 + 4 通用敌引入 + 首批币/种 + 首颗栗子 | 无 |
| **Q1 教学流沙** | 15..21（x480..672） | 缓速窄流沙，教「勿停留·快穿/跳」；首蝎子(720)紧随作新敌前摇教学 | **Q1** |
| 过渡段 | 22..32 | 仙人掌(768/960)障碍 + du_fu/shi_pao + cp1 | 无 |
| **Q2 挑战流沙** | 33..42（x1056..1344） | 快速宽流沙 + 2 踏脚 perch(tx37,38 / tx40,41 ty5) + 蝎子×2 + chong_feng + cp2 | **Q2** |
| 收尾段 | 43..53 | 仙人掌(1500) + ci_li/shi_pao + 末批币/种 + cp3 + 凯旋之门 | 无 |

**平台清单（tile 坐标）**

| 类型 | tx 范围 | ty | 用途 |
|---|---|---|---|
| solid（地面） | 0..53 | 7,8 | 主地面（流沙为地面上的危险区域，非挖空） |
| solid（墙） | 0 / 53 | 0..6 | 边界 |
| solid（perch 踏脚） | 37,38 | 5 | Q2 流沙内跳石①（顶 y=160） |
| solid（perch 踏脚） | 40,41 | 5 | Q2 流沙内跳石②（顶 y=160） |
| oneway / bp | 17,18,19 | 4 | `bp_desert` 节拍平台（Q1 上方补充高路线，非主路径） |

**检查点**：3 个（沿用 1-3 写法，顶层 `checkpoints:[]` 保持空、检查点以 `type:"checkpoint"` 实体声明）：

| 检查点 | x | y | 位置说明 |
|---|---|---|---|
| cp1 | 864 | 176 | 过渡段起点（Q1 之后、首蝎子之后） |
| cp2 | 1024 | 176 | Q2 起点之前（挑战流沙前缓冲） |
| cp3 | 1408 | 176 | Q2 之后、收尾段前 |

**凯旋之门（终点）**：`goal.type="triumph_gate"`，`x=1664`、`y=160`、`w=32`、`h=64`（与 1-1/1-2/1-3 同款终点锚点）。
**出生点**：`spawn={x:64,y:190}`（与 1-1/1-2/1-3 同款）。

---

## 3. 敌人配置清单

### 3.1 四通用敌全覆盖（跨主题恒含，按 theme-system §4.1 base4）

| 敌种 | 可踩 | 数量 | 典型 x,y | 说明 |
|---|---|---|---|---|
| `ci_li` 刺栗 | 是 | 3 | 256,200 ／ 864,200 ／ 1408,200 | 地面圆球红刺，踩踏弹跳 |
| `chong_feng` 锥冲 | 否 | 2 | 416,200 ／ 1184,200 | 地面楔形硬顶，需跳避 |
| `du_fu` 嘟浮 | 是 | 2 | 400,120 ／ 1000,120 | 空中蓝紫实心扁圆，踩踏 |
| `shi_pao` 石炮 | 否 | 2 | 832,100 ／ 1472,100 | 冷蓝方块炮口，关卡中后段 |

> **沙漠换皮命名（视觉仅，引擎 `type` 键不变，对齐 `art/desert-biome-spec.md` §4）**：四通用敌沿用既有 `type` 键，仅外观换沙漠皮（暖橙沙底下靠 `描边 #2A1A12` + 功能色维持辨识；du_fu 加 `暖黄 #FFD23F` 肚皮斑提升反差）。关卡数据 `entities[].type` 仍写原键，美术按 biome-spec 映射绘制，**零引擎改动**。

### 3.2 专属敌 · 蝎子 `scorpion`（desert 专属，⚙️ 需工程：新敌 AI）

- **数量**：**3**（Q1 后首现 1 只作教学，Q2 内 2 只作压力）。
- **外观**（权威，`art/desert-biome-spec.md` §3.1）：bbox 40×24 长条身，暖橙 `#F2933C` 身 + 警示红 `#E8483B` 上翘尾刺 + `darken(#F2933C,0.5)`≈`#79491E` 钳/腿 + `天空 #5BC8F5` 眼点 + `描边 #2A1A12`；**hard 顶（尖刺+红）= 不可踩**（双编码，色盲安全）。
- **行为**：地面巡逻（x 小幅往返），**idle 钳微张、charge 尾刺上扬**作为攻击前摇 telegraph；接触=伤害（扣 1 级 + 无敌帧，复用 07）。
- **首现教学**：Q1 后的首蝎子(720)前方留有空地，玩家先见「尾刺上扬」前摇再接近，降低突袭不公平感。
- **坐标草案**：scorpion(720,200) 教学 ／ scorpion(1100,200) Q2 起点 ／ scorpion(1280,200) Q2 中段。

### 3.3 专属固定障碍 · 仙人掌 `cactus`（desert 专属，硬顶不可踩）

- **数量**：**3**（地面柱，强制跳跃跨越）。
- **外观**（`art/desert-biome-spec.md` §3.2）：竖柱 24×48 + 侧臂 + 周身红刺，草绿 `#7CC242` 主体 + 警示红 `#E8483B` 刺 + `darken(#7CC242,0.5)`≈`#3E6121` 暗部 + `描边`；**hard 顶 = 不可踩**。
- **玩法角色**：**固定障碍 / 地形路障**，玩家须「跳过去」或「绕开」；**不作落脚点**（硬顶带红刺，踩=伤，对齐 biome-spec §3.2）。与 bramble（贴地低刺丛）/gu_bao（苞+顶刺）剪影区分。
- **坐标草案**：cactus(768,224) ／ cactus(960,224) ／ cactus(1500,224)。
- **设计澄清（回应任务书的"?"）**：任务书提出「利用仙人掌作落脚点?」——按 biome-spec §3.2 仙人掌为 **hard 顶不可踩**，故**不**作为落脚点；其价值在于「制造必须跳越的节奏断点」与「配合扔栗子封路」（仙人掌可作天然掩体让玩家在侧面用栗子击中蝎子）。是否要一个 soft 顶变体仙人掌（可踩）列为 **Could / 待主理人拍板**，见附录 B。

---

## 4. 流沙机制设计（⚙️ 需工程：quicksand 为机制 flag，theme-system §3.4 标注「区域下陷，小增」）

**核心定义**：流沙 = **地面危险区域，进入后持续下陷，触底即死**的地形机制。区别于 1-3 潮汐（软伤害、可飞越），流沙**致死**但**有 telegraph + 逃脱窗口**，是 world 1 最硬的一次惩罚升级（制造压力峰，仍守公平）。

### 4.1 与既有 Schema 的衔接

⚙️ 建议 `LevelData` 新增字段 `quicksand: QuicksandDef[]`（与 1-3 的 `tideSegments` 同级、同构替换——沙漠**无潮汐**，故 1-4 用 `quicksand` 取代 `tideSegments`/`riptide`）。Schema：

```jsonc
{ "id", "xStart", "xEnd", "surfaceY", "sinkRate", "deathY", "telegraphMs" }
```

- `xStart/xEnd`：世界 px 范围（地面上的流沙带）。
- `surfaceY`：流沙地表世界 Y（= 地面顶 y=224）。
- `sinkRate`：站立其中的下陷速率（px/s）。
- `deathY`：下陷到此世界 Y 即判定「触底死亡」（复用 07 死亡态）。
- `telegraphMs`：进入后到达满速下陷前的渐变前摇（漩涡+暗色渐显），双编码 telegraph。

### 4.2 下陷 / 逃脱 / 死亡规则

- 玩家**脚底进入 `[xStart,xEnd]` 且 y ≥ surfaceY** 即进入流沙 → 叠加下陷速度（经 `telegraphMs` 渐变到 `sinkRate`）。
- **空中（跳跃中）不触发**下陷 → 跳跃跨越 = 安全解法之一。
- **逃脱窗口（派生）**：`escapeWindow = (deathY - surfaceY) / sinkRate`（站立不动到触底的时间）。玩家须在窗口内移出 x 范围或跳离。
- **触底死亡**：`y ≥ deathY` → 重置到最近检查点（复用 07 `respawn`）。
- **公平性**：Q1 窄而缓（可冲刺穿行），Q2 宽而快（须借 perch 跳石逐段跨越）——两种解法并存，避免单一最优。

### 4.3 流沙区布局表

| 区 | id | x 区间(px/tx) | surfaceY | sinkRate(px/s) | deathY | 逃脱窗口(派生) | telegraph | 角色 |
|---|---|---|---|---|---|---|---|---|
| **Q1 教学** | `qs_q1` | 480..672（tx15..21） | 224 | 35 | 304（下沉 80px≈2.5 格） | ≈2.3s | 漩涡 `darken(#F2933C,0.5)`≈`#79491E` 渐显 + 缓动 ≤3Hz | 窄缓：冲刺/跳越即可过，教「勿停留」 |
| **Q2 挑战** | `qs_q2` | 1056..1344（tx33..42） | 224 | 55 | 336（下沉 112px≈3.5 格） | ≈2.0s | 强漩涡 + 更快渐变（350ms） | 宽快：须借 perch(37,38 / 40,41 ty5) 跳石逐段过 |

> 两区 `surfaceY=224` 与地面顶齐平；死亡阈值均深于地面（代表「陷没沙底」）。视觉双编码（漩涡形状 + 暗色，非单色）保证色盲可读（`art/desert-biome-spec.md` §3.3 / §6）。

---

## 5. 障碍 / 陷阱协同

### 5.1 仙人掌与流沙的协同
- 过渡段 cactus(768)/(960) 作为「跳越节奏断点」，与 Q2 流沙前的 cp2 形成「缓→急」过渡；收尾 cactus(1500) 在凯旋门前做最后一道轻挑战。
- 仙人掌可作**扔栗子的天然掩体**：玩家侧面用栗子击杀蝎子时，仙人掌挡住蝎子走位，制造「卡位投掷」策略（服务 P2 闯 + 扔栗子动词）。

### 5.2 与四通用敌的协同
- Q1 流沙带内不放置地面敌（教学纯净）；Q2 流沙带外缘放 scorpion(1100)/chong_feng(1184)/scorpion(1280)，逼迫「跳石→落地空隙→避敌」的时序决策。
- `shi_pao`(832)/(1472) 置于非流沙段高台，构成「上岸喘息」缓冲，避免连续高压（对齐 1-3 节奏缓冲设计）。

### 5.3 与 1-3 的复用 / 差异说明（核心）
- **复用**：4 通用敌组、coin/seed/chestnut 经济规模、checkpoint×3 写法、`triumph_gate` 终点、`spawn`、beat/bpm=120/grid=8 节拍框架——**全部沿用，不新增引擎机制种类**。
- **差异（制造新鲜感尖峰）**：① 用 `quicksand` **取代** `tideSegments`（潮汐软伤害 → 流沙触底即死，惩罚升级）；② 新敌 `scorpion`（地面不可踩、尾刺前摇）；③ 新障碍 `cactus`（硬顶跳越路障）；④ 调色板整体换为沙漠暖橙 8 槽（`art/desert-biome-spec.md` §1.2）；⑤ 装饰层换 `deco_dune`/`deco_pyramid`/`deco_sun`。
- **不新增引擎机制种类**：流沙 = 既有「区域下陷 + 触底死亡」数据驱动（theme-system §3.4 标「小增」），与潮汐同属「区域 hazard」家族，仅参数与死亡语义不同。

---

## 6. 种子 / 币种（保留 seed 蜕变成长系统）

沿用 1-2/1-3 经济规模（守跨关经济一致，防失衡）：

| 类型 | 数量 | 说明 |
|---|---|---|
| `coin` 金币 | **18** | 沿路 + 高路线奖励（部分置于 perch/流沙上方，奖励跳跃/timing） |
| `seed` 种子 | **6**（`seed_01`..`seed_06`） | 保留 P3 蜕变；2 颗置于 Q2 高路线（奖励「跨流沙」策略） |
| `chestnut` 栗子（弹药） | **3**（各 `amount:5`） | x=150 / 520 / 920，y=200；供扔栗子系统补给 |

**坐标草案**：见附录 C JSON（coin×18 / seed×6 / chestnut×3 已展开）。

---

## 7. 节拍段（可选 · 沙漠节拍平台 `bp_desert`）

沿用 1-3 的 BeatDrivenSystem（`beat.enabled:true` + `beatPlatforms[]`，契约见 `design/beat/beat-schema.md`）。

- **`bp_desert`**：tiles `tx 17,18,19 @ ty=4`（Q1 区上方、流沙之上），`initial:"solid"`，作为**补充高路线**（非主路径；主路径用「冲刺/跳越穿 Q1」）。
- **track**：`{ "target":"bp_desert", "pattern":"SSSGGG" }`（相位 ~1.33Hz，安全无频闪）。
- **bpm/grid**：`bpm:120`、`grid:8`（与 1-1/1-2/1-3 一致）。
- **⚠️ 心流保护**：`bp_desert` 为**补充**性质（主路不依赖它）。若 QA 实测流沙 + 节拍叠加致认知过载/parTime 崩，建议初版 `beat.enabled:false` 仅留 `bp_desert` 常显实体，或整体延后。主理人拍板。

---

## 8. parTime 建议值

| 关卡 | parTimeMs | 备注 |
|---|---|---|
| 1-1 | 60000 | 占位 |
| 1-2 | 84000 | 占位 |
| 1-3 | 96000 | 占位 |
| **1-4** | **102000**（建议区间 96000–108000） | **初版占位，待 QA 真机调校**（流沙等待 + 宽度略增 + 新机制） |

> 标注「待 QA 调校」：流沙须玩家等 telegraph / 借跳石 timing，parTime 应比线性长度直觉略宽松；最终以 playtest 中位通关时间 × 系数收敛。

---

## 9. 难度曲线与 MDA 对齐

### 9.1 与 1-3 的差异点
- 1-3：潮汐**软伤害**（触水扣血+击退），机制新奇尖峰。1-4：流沙**触底即死**，机制压力峰——惩罚升级但 telegraph + 3 检查点 + 双解法（冲刺穿 / 跳石跨）守住公平。
- 难度「略难」来自：① 关卡更长（54 vs 52）；② 流沙致死 + 蝎子新敌；但被 **3 检查点 + 双解法 + 前摇 telegraph** 拉回公平区。

### 9.2 SDT 三大需求 + 心流（对齐 theme-system §2.3 / 概念文档 §3）
- **自主 Autonomy**：流沙重排路线 → 「冲刺快穿 Q1」或「借 perch 跳石跨 Q2」自选；敌障踩/避/投掷亦自选。
- **胜任 Competence**：单一新机制（quicksand）渐进引入（Q1 教学 → Q2 挑战）；所有危险**双编码 telegraph**（流沙漩涡+暗色、蝎尾上扬、仙人掌红刺），即时反馈持续「我能行」。
- **关联 Relatedness**：沙漠靠 8 槽暖橙 palette + deco_dune/pyramid/sun 制造「灼热沙海」旅程感；grass→mountain→sea→desert 跨主题凝聚力。
- **心流 Flow**：沙漠引入 = 一次「新鲜感尖峰」；仅 1 新机制 + 1 新敌 + 1 新障碍 → **不认知过载**。

### 9.3 设计理论红线自检（无违规）
- **无主导策略**：Q1 冲刺穿 / Q2 跳石跨双解；流沙上方可走 bp_desert 补充线。
- **无经济失衡**：币/种/弹药规模与 1-3 持平（18 币 / 6 种 / 3 弹药）。
- **无认知过载**：仅 1 新机制（quicksand）+ 1 新敌（scorpion）+ 1 新障碍（cactus）；bp_desert 可关。
- **无支柱漂移**：P1 跳（踩敌/跨流沙/bp）、P2 闯（流沙 timing/蝎子规避）、P3 蜕变（seed）全服务。

---

## 10. 进度链（nextLevelId 衔接）

- 现有 `LEVEL_ORDER = ['1-1','1-2','1-3','2-1','2-2','2-3','2-4']`（含 1-3 已插入）。
- **⚙️ 注册建议**（工程落地时改 `src/core/config/index.ts`，本设计稿不碰 src）：插入 `'1-4'` 于 `'1-3'` 之后 →
  `LEVEL_ORDER = ['1-1','1-2','1-3','1-4','2-1','2-2','2-3','2-4']`。
- 纯函数 `nextLevelId(LEVEL_ORDER, '1-4')` → **`'2-1'`**（沿用现有 `src/core/level/level-order.ts`，零改）。
- 1-4 自身 JSON 的 `metadata.nextLevelId` **无需字段**（由 `LEVEL_ORDER` 推导，一致于 1-1/1-2/1-3）。
- 末关判定：1-4 非末关（后面有 2-1…），结算页「下一关」正常出现并加载 2-1。

---

## 附录 A · 落地依赖清单（⚙️ 需工程 / art）

| # | 项 | 归属 | 状态 |
|---|---|---|---|
| A1 | `theme-palette.ts` 注册 `desert` 8 槽（desert-biome-spec §8.2：bg=`#F7BE8A` / rockFace=`#F2933C` / rockBody=`#79491E` / out-line=`#2A1A12` / firelight=`#FFD23F` / crystalCore=`#7CC242` / crystalGlow=`#F2C94C` / danger=`#E8483B`） | art→eng | 契约已就绪，待注册 |
| A2 | `LevelTheme` 联合类型增 `'desert'`（未知回退 `'grass'`） | eng | theme-system R6 |
| A3 | `quicksand` 字段 + 区域下陷 / 触底死亡判定（§4，字段名对齐 biome-spec §3.3） | eng（小增，theme-system §3.4） | 新机制 |
| A4 | `scorpion` 敌 AI（巡逻 + 尾刺上扬前摇，§3.2） | eng（新敌） | 视觉 spec 已就绪 |
| A5 | `cactus` 障碍碰撞（硬顶不可踩，§3.3） | eng（新障碍） | 视觉 spec 已就绪 |
| A6 | `LEVEL_ORDER` 插入 `'1-4'`（§10） | eng（1 行） | 配置 |
| A7 | 1-4.json 由本设计稿坐标落地（同款 Schema，theme=`desert`） | eng | 内容 |
| A8 | 四通用敌 `type` 键不变、仅沙漠换皮；scorpion/cactus 走新增 `enemy-view` 分支（desert-biome-spec §8.3） | art→eng | 视觉仅，零引擎改动 |

## 附录 B · 待主理人拍板

1. 关名是否用《灼沙绿洲》（或备选《赤沙灼日》《瀚海流金》《流沙遗城》）？
2. 流沙触底即死（respawn 到检查点）初版是否接受？（备选：软伤害 + 击退，与 1-3 同款——但会削弱「压力峰」定位）
3. `bp_desert` 初版启用还是关（§7 心流保护）？
4. parTime 102000 是否接受为占位（待 QA）？
5. **仙人掌是否要 soft 顶可踩变体**（任务书提出的「作落脚点?」）——当前按 biome-spec §3.2 定为 hard 顶不可踩；若主理人想要可踩变体作落脚点，列为新增小机制，需 art+eng 评估。
6. 蝎子/仙人掌数量（各 3）与流沙区数（2）是否合适（待手感调校）？

---

## 附录 C · 1-4.json 草拟（工程可直接采用）

> 字段对齐 1-3.json：`id/version/tileSize/width/height/tiles/entities/props/checkpoints/goal/spawn/beat/beatPlatforms/metadata` 全保留；沙漠以 `quicksand` 字段**取代** 1-3 的 `tideSegments`/`riptide`（同构替换，无潮汐）。`theme` 必须为 `"desert"`。entities 含 4 通用敌 + scorpion×3 + cactus×3 + quicksand 区域声明 + 3 检查点 + 凯旋之门。

```json
{
  "id": "1-4",
  "version": 1,
  "tileSize": 32,
  "width": 54,
  "height": 9,
  "tiles": [
    {
      "tx": 0,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 1,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 1,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 2,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 2,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 3,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 3,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 4,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 4,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 5,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 5,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 6,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 6,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 7,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 7,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 8,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 8,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 9,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 9,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 10,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 10,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 11,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 11,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 12,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 12,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 13,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 13,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 14,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 14,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 15,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 15,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 16,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 16,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 17,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 17,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 18,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 18,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 19,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 19,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 20,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 20,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 21,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 21,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 22,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 22,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 23,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 23,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 24,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 24,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 25,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 25,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 26,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 26,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 27,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 27,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 28,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 28,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 29,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 29,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 30,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 30,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 31,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 31,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 32,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 32,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 33,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 33,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 34,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 34,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 35,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 35,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 36,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 36,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 37,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 37,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 38,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 38,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 39,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 39,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 40,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 40,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 41,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 41,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 42,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 42,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 43,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 43,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 44,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 44,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 45,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 45,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 46,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 46,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 47,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 47,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 48,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 48,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 49,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 49,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 50,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 50,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 51,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 51,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 52,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 52,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 7,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 8,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 0,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 0,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 1,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 1,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 2,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 2,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 3,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 3,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 4,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 4,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 5,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 5,
      "kind": "solid"
    },
    {
      "tx": 0,
      "ty": 6,
      "kind": "solid"
    },
    {
      "tx": 53,
      "ty": 6,
      "kind": "solid"
    },
    {
      "tx": 37,
      "ty": 5,
      "kind": "solid"
    },
    {
      "tx": 38,
      "ty": 5,
      "kind": "solid"
    },
    {
      "tx": 40,
      "ty": 5,
      "kind": "solid"
    },
    {
      "tx": 41,
      "ty": 5,
      "kind": "solid"
    }
  ],
  "entities": [
    {
      "type": "ci_li",
      "x": 256,
      "y": 200
    },
    {
      "type": "du_fu",
      "x": 400,
      "y": 120
    },
    {
      "type": "chong_feng",
      "x": 416,
      "y": 200
    },
    {
      "type": "chestnut",
      "x": 150,
      "y": 200,
      "params": {
        "amount": 5
      }
    },
    {
      "type": "chestnut",
      "x": 520,
      "y": 200,
      "params": {
        "amount": 5
      }
    },
    {
      "type": "scorpion",
      "x": 720,
      "y": 200
    },
    {
      "type": "cactus",
      "x": 768,
      "y": 224
    },
    {
      "type": "shi_pao",
      "x": 832,
      "y": 100
    },
    {
      "type": "ci_li",
      "x": 864,
      "y": 200
    },
    {
      "type": "checkpoint",
      "x": 864,
      "y": 176
    },
    {
      "type": "cactus",
      "x": 960,
      "y": 224
    },
    {
      "type": "chestnut",
      "x": 920,
      "y": 200,
      "params": {
        "amount": 5
      }
    },
    {
      "type": "du_fu",
      "x": 1000,
      "y": 120
    },
    {
      "type": "checkpoint",
      "x": 1024,
      "y": 176
    },
    {
      "type": "scorpion",
      "x": 1100,
      "y": 200
    },
    {
      "type": "chong_feng",
      "x": 1184,
      "y": 200
    },
    {
      "type": "scorpion",
      "x": 1280,
      "y": 200
    },
    {
      "type": "ci_li",
      "x": 1408,
      "y": 200
    },
    {
      "type": "checkpoint",
      "x": 1408,
      "y": 176
    },
    {
      "type": "shi_pao",
      "x": 1472,
      "y": 100
    },
    {
      "type": "cactus",
      "x": 1500,
      "y": 224
    },
    {
      "type": "coin",
      "x": 200,
      "y": 200
    },
    {
      "type": "coin",
      "x": 320,
      "y": 200
    },
    {
      "type": "coin",
      "x": 384,
      "y": 150
    },
    {
      "type": "coin",
      "x": 480,
      "y": 200
    },
    {
      "type": "coin",
      "x": 608,
      "y": 150
    },
    {
      "type": "coin",
      "x": 832,
      "y": 150
    },
    {
      "type": "coin",
      "x": 896,
      "y": 150
    },
    {
      "type": "coin",
      "x": 960,
      "y": 200
    },
    {
      "type": "coin",
      "x": 1024,
      "y": 150
    },
    {
      "type": "coin",
      "x": 1100,
      "y": 80
    },
    {
      "type": "coin",
      "x": 1184,
      "y": 200
    },
    {
      "type": "coin",
      "x": 1216,
      "y": 150
    },
    {
      "type": "coin",
      "x": 1280,
      "y": 200
    },
    {
      "type": "coin",
      "x": 1344,
      "y": 150
    },
    {
      "type": "coin",
      "x": 1408,
      "y": 200
    },
    {
      "type": "coin",
      "x": 1472,
      "y": 150
    },
    {
      "type": "coin",
      "x": 1500,
      "y": 200
    },
    {
      "type": "coin",
      "x": 1568,
      "y": 150
    },
    {
      "type": "seed",
      "x": 384,
      "y": 200,
      "seedId": "seed_01"
    },
    {
      "type": "seed",
      "x": 640,
      "y": 200,
      "seedId": "seed_02"
    },
    {
      "type": "seed",
      "x": 800,
      "y": 200,
      "seedId": "seed_03"
    },
    {
      "type": "seed",
      "x": 1100,
      "y": 80,
      "seedId": "seed_04"
    },
    {
      "type": "seed",
      "x": 1216,
      "y": 80,
      "seedId": "seed_05"
    },
    {
      "type": "seed",
      "x": 1408,
      "y": 200,
      "seedId": "seed_06"
    }
  ],
  "props": [],
  "checkpoints": [],
  "quicksand": [
    {
      "id": "qs_q1",
      "xStart": 480,
      "xEnd": 672,
      "surfaceY": 224,
      "sinkRate": 35,
      "deathY": 304,
      "telegraphMs": 500
    },
    {
      "id": "qs_q2",
      "xStart": 1056,
      "xEnd": 1344,
      "surfaceY": 224,
      "sinkRate": 55,
      "deathY": 336,
      "telegraphMs": 350
    }
  ],
  "goal": {
    "type": "triumph_gate",
    "x": 1664,
    "y": 160,
    "w": 32,
    "h": 64
  },
  "spawn": {
    "x": 64,
    "y": 190
  },
  "beat": {
    "enabled": true,
    "bpm": 120,
    "grid": 8,
    "tracks": [
      {
        "target": "bp_desert",
        "pattern": "SSSGGG"
      }
    ]
  },
  "beatPlatforms": [
    {
      "id": "bp_desert",
      "initial": "solid",
      "tiles": [
        {
          "tx": 17,
          "ty": 4
        },
        {
          "tx": 18,
          "ty": 4
        },
        {
          "tx": 19,
          "ty": 4
        }
      ]
    }
  ],
  "metadata": {
    "name": "《灼沙绿洲》",
    "theme": "desert",
    "parTimeMs": 102000
  }
}
```

*本文件为 1-4 沙漠主题关卡内容设计稿（加法），roadmap 批次 3；未修改现有 GDD / `src/` / `assets`；未 git commit。待主理人（游承峰）审批后由 engineering-lead 与 art-director 分别落地（A1–A8）。*
