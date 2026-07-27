# 关卡设计稿 · 1-7《案牍劳形》（办公主题 · office）

> 文档类型：关卡内容设计稿（GDD 级，加法扩展）｜roadmap 批次 3 · 第四个主题：办公 1-7（收尾）｜office = urban_indoor 家族，冷调办公 tint
> 作者：文策渊（design-strategist）
> 上游依据：`design/gdd/theme-system.md` §3.4（R1 标注 `low_friction` 是唯一需角色控制器小加法的机制——zone 级 `frictionScale`）+ §4（office 行 + §4.2 专属元素速查：paper_pile 文件堆、coffee_spill 咖啡渍）｜`design/gdd/level-1-6-design.md`（街 1-6 设计稿，**本文件结构镜像源**）｜`src/config/levels/1-6.json`（直接照抄 Schema 同构 1-7）｜`src/core/character/character-controller.ts`（第 123 行 `s.vx = approach(s.vx, 0, cfg.friction * dt)`——当前 friction 为全局 `cfg.friction`(1600)；coffee_spill 局部低摩擦需 zone 查询返回 frictionScale 倍率，由角色控制器消费）｜`src/game/damage-resolution.ts`（`applyDamage` 非致死 / `applyFatalDeath` 致死 respawn，对照理解：paper_pile/coffee_spill 均为**非伤害**）｜`src/core/level/level-data.ts`、`src/core/enemy/enemy-ai.ts`（理解实体/AI 家族与联合类型增项）
> **红线**：沿用现有 `LevelData` Schema（tileSize=32、height=9）；零位图（ADR-004，纯 Graphics + 系统字体 + tint）；11 色锁色板（仅引用 office 调色板既有色语义，0 新增 hex）；MVP 全程序化占位；IP 全原创、禁任天堂符号。
> **本文件只写设计稿，不写/改任何 `.ts` 源码，不 git commit。** 标记为「⚙️ 需工程」的为对 `LevelData` / 引擎 / 角色控制器的建议扩展，提交 engineering-lead 落地。

---

## 1. 关卡概述

| 项 | 值 |
|---|---|
| 关卡 id | `1-7` |
| 关名（建议） | **《案牍劳形》**（备选：《格子之间》《通勤夜未央》） |
| 主题 theme | `office`（urban_indoor 家族，冷调办公 tint；palette 由 art-director 另出 `office-biome-spec`/`office-visual-spec`，本稿仅引用） |
| 在世界 1 的位置 | 第 7 关，紧接 1-6 `street`（车流/井盖）之后，作为 world 1 都市/室内家族的「文件堆 + 咖啡渍」收尾关（参见 §10 进度链变更） |
| 难度定位 | 与 1-6 同量级、维度不同：1-6 是「车流横穿 + 井盖蒸汽 timing」；1-7 转为「文件堆可踩平台腾挪 + 咖啡渍局部打滑控制风险」——靠 3 检查点 + 双机制 telegraph（平台实心可站 / 咖啡渍视觉渍迹+低摩擦手感）拉回公平区 |
| 设计支柱对齐 | P1 跳（踩 ci_li/du_fu + 站文件堆越障 + 上高币）｜P2 闯（避咖啡渍打滑 + 避敌碰撞）｜P3 蜕变（保留 seed 实体） |

**定位理由**：world 1 难度曲线 = 1-1 草原教学 → 1-2 山川 → 1-3 海 → 1-4 沙漠 → 1-5 家 → 1-6 街 → **1-7 办公（文件堆+咖啡渍，室内收束）**。office 只叠加 **2 个新机制（paper_pile 可踩平台 + coffee_spill 局部低摩擦）**，符合 theme-system §2.3「每主题只叠加 1–2 个新机制，不造成认知过载」。1-7 用「文件堆作踏脚/掩体 + 咖啡渍制造打滑控制风险」制造挑战，玩家伤害负担为 0（二者均非伤害），死亡率受控（仅 4 通用敌致伤），是 world 1 的「办公收束」。

**关名候选**：
- **《案牍劳形》**（推荐）：office 文书/案头语义 +「劳形」暗合文件堆堆叠与格子间劳作的疲惫感；「案牍」直指 paper_pile 文件堆核心机制。动词「劳形」虽偏叙事，但关名整体与办公语义强绑定、且点出 paper_pile。
- 《格子之间》：突出 office 格子间（cubicle）空间感，但弱化了 paper_pile/coffee_spill 的机制标识，故不推荐为首选。
- 《通勤夜未央》：叙事向（加班通勤），与办公语义有连接，但同样弱化了专属机制标识，作备选。

---

## 2. 关卡结构与尺寸

| 参数 | 1-7 建议 | 对照 1-6 |
|---|---|---|
| `tileSize` | 32 | 32 |
| `width`（瓦片） | **54**（世界宽 1728px） | 54 |
| `height`（瓦片） | 9（=288px） | 9 |
| 地面 | ty=7,8 全宽实心（tx 0..53） | 同 |
| 左右墙 | tx=0 与 tx=53 的 ty 0..6 实心 | 同 |
| 家具地形 | 无（office 无 sofa/table/cabinet；障碍为实体 paper_pile 平台 + 区域 coffee_spill zone） | 街为 vehicle/manhole 实体 |

**布局分区（左→右，按 paper_pile 平台 + coffee_spill zone 编排控制风险）**

| 区段 | tx 区间 | 内容 | 专属障碍 |
|---|---|---|---|
| 引导段 | 1..11 | 平地 + 4 通用敌引入（ci_li/chong_feng/du_fu/shi_pao 各首现）+ 首批币/种 + 首颗栗子 | 无（纯净教学） |
| **F1 文件堆教学** | 12..21 | 首堆 paper_pile(p1) 2 格高平台教学 + 首块 coffee_spill(cs1) 打滑教学 + du_fu 高空币 + ci_li | paper_pile×1 + coffee_spill×1 |
| 过渡段 | 22..32 | paper_pile×2(p2 宽矮/p3 高) 错落作踏脚 + coffee_spill×1(cs2 较宽更滑) + shi_pao 高台 + cp1/cp2 | paper_pile×2 + coffee_spill×1 |
| **F2 办公挑战** | 33..46 | paper_pile×2(p4/p5) 错落平台 + coffee_spill×2(cs3/cs4) 打滑区 + 通用敌压力 + cp3 | paper_pile×2 + coffee_spill×2 |
| 收尾段 | 47..53 | 末批币/种 + 末敌 + 凯旋之门 | 无 |

**检查点**：3 个（顶层 `checkpoints:[]` 保持空、检查点以 `type:"checkpoint"` 实体声明，同 1-6）：

| 检查点 | x | y | 位置说明 |
|---|---|---|---|
| cp1 | 832 | 176 | F1 之后、cs2 之前（第一块咖啡渍前缓冲） |
| cp2 | 1056 | 176 | F2 平台挑战之前缓冲（p4 前） |
| cp3 | 1376 | 176 | F2 咖啡渍挑战之后、收尾段前 |

**凯旋之门（终点）**：`goal.type="triumph_gate"`，`x=1664`、`y=160`、`w=32`、`h=64`（与 1-1..1-6 同款）。
**出生点**：`spawn={x:64,y:190}`（与 1-1..1-6 同款）。

---

## 3. 敌人配置清单

### 3.1 四通用敌全覆盖（跨主题恒含，theme-system §4 base4）

| 敌种 | 可踩 | 数量 | 典型 x,y | 说明 |
|---|---|---|---|---|
| `ci_li` 刺栗 | 是 | 3 | 224,200 ／ 720,200 ／ 1008,200 | 地面圆球红刺，踩踏弹跳 |
| `chong_feng` 锥冲 | 否 | 2 | 352,200 ／ 960,200 | 地面楔形硬顶，需跳避 |
| `du_fu` 嘟浮 | 是 | 2 | 448,120 ／ 1088,120 | 空中蓝紫实心扁圆，踩踏（office 冷底加描边维持辨识） |
| `shi_pao` 石炮 | 否 | 2 | 800,100 ／ 1312,100 | 冷蓝方块炮口，关卡中后段 |

> 四通用敌沿用既有 `type` 键，仅外观换 office 冷调办公皮（由 `office-visual-spec` 映射绘制，零引擎改动）；致伤语义与 1-1..1-6 完全一致（踩杀 ci_li/du_fu、避 chong_feng/shi_pao）。

### 3.2 专属障碍 · 文件堆 `paper_pile`（office 专属，⚙️ 需工程：新实体作为可踩平台/实心碰撞）

- **数量**：**5**（F1 首现 1 堆 2 格高作平台教学；过渡段 2 堆错落；F2 2 堆作踏脚/掩体）。
- **外观**（权威，theme-system §4.2）：以 office 调色板派生色绘制的「堆叠文件/档案盒」——多层错位的矩形文件块 + 描边；依据锁色板（具体 hex 待 `office-biome-spec` 落盘，沿用 11 色 + tint，0 新增）。形状为**方硬堆叠块**，顶平可站。
- **行为**：作为**静态实心实体（推荐 solidity="solid"）**注册进 CollisionWorld——顶面可站（玩家借其越障/上高币），四壁/底面挡（玩家须跳上或绕过，构成掩体语义）。**非伤害**（overlaps 不参与 damage-resolution，也不实现 HazardSource/StompableHazard）。
- **坐标草案**（x,y = 碰撞盒左上角；h = 堆高；底贴地 224）：
  - p1(416,160,w32,h64) — F1 教学，2 格高平台
  - p2(640,192,w64,h32) — 过渡段宽矮堆（2 格宽、1 格高）作掩体/低踏脚
  - p3(864,160,w32,h64) — 过渡段 2 格高平台
  - p4(1056,192,w32,h32) — F2 单格堆踏脚
  - p5(1248,160,w32,h64) — F2 2 格高平台（收尾前）

### 3.3 专属障碍 · 咖啡渍 `coffee_spill`（office 专属，⚙️ 需工程：新低摩擦 zone · R1 角色控制器小加法）

- **数量**：**4**（F1 首现 1 块教学；过渡段 1 块较宽更滑；F2 2 块错落）。
- **外观**（权威，theme-system §4.2）：地面上一块不规则渍迹（office 调色板暖/冷派生色绘制，0 新增 hex）；纯视觉 telegraph「此处易滑」。
- **行为**：地面上一块**矩形区域（zone）**；玩家身体与该矩形重叠且着地时，水平减速按 `cfg.friction * frictionScale` 计算（即打滑、难急停），**不造成任何伤害**，仅控制风险（详见 §4.2 与 §开放决策 Q2/R1）。
- **坐标草案**（x,y = 区域左上角；w,h = 区域尺寸；y=192,h=32 即贴地 ty6 带，恰好覆盖玩家脚底带）：
  - cs1(512,192,w64,h32,frictionScale:0.35) — F1 教学
  - cs2(768,192,w64,h32,frictionScale:0.30) — 过渡段较宽更滑
  - cs3(1120,192,w64,h32,frictionScale:0.40) — F2（略温和）
  - cs4(1376,192,w64,h32,frictionScale:0.35) — F2 收尾前

---

## 4. 障碍矩阵（office 与街的核心差异）

> 本章明确 office 的两处机制表达。paper_pile 为新实体（静态实心平台，CollisionWorld 注册）；coffee_spill 为新 zone（低摩擦区域，R1 角色控制器消费）。二者均为新实体/区域类型（需联合类型 + 相应落地），但**均非伤害**（区别于 street 的 vehicle 致命 / manhole 蒸汽非致死）。

### 4.1 文件堆 `paper_pile`（⚙️ 需工程：新增静态实心平台实体）

**核心定义**：paper_pile 是一摞文件/档案盒构成的静态实心块。玩家须「跳上顶面站住」或「绕过它」，构成 office 的纵向腾挪与掩体语义。

**行为参数（每实例，写入 `entities[].params` 或顶层字段）**：

| 字段 | 含义 | 单位 | 取值 |
|---|---|---|---|
| `x` | 碰撞盒左上角 x | px | 见 §3.2 草案 |
| `y` | 碰撞盒左上角 y（底贴地 224） | px | 160（2 格高）/192（1 格高） |
| `w` | 碰撞盒宽 | px | 32 或 64 |
| `h` | 碰撞盒高 | px | 32 或 64 |
| `solidity` | 碰撞分类 | — | `"solid"`（推荐）/ `"oneway"`（备选） |

- **碰撞/踩踏语义**：paper_pile 是**静态实心 AABB**，注册进 CollisionWorld（类比 home 的 cabinet/sofa 实体化表达，但 office 走 entity 方案，见附录 D）。`solidity="solid"` → 六面实心（顶可站、四壁/底挡）；`solidity="oneway"` → 仅顶可踩（可从下跳穿、落顶）。**非伤害**：不实现 `HazardSource`，不进入 damage-resolution。
- **致命性**：**非伤害**（文件堆 = 障碍/平台，非 hazard；碰触仅几何阻挡）。理由：office 语义下文件堆作为「踏脚/掩体」更符合直觉，且叠加 coffee_spill 已制造控制风险，文件堆若再致伤会叠加惩罚负担、破坏公平（见 §开放决策 Q1）。
- **telegraph 双编码（形状）**：方硬堆叠块 + 平顶 = 可站平台语义（与可踩圆敌 ci_li/du_fu 的 soft 顶区分靠形状与功能色描边）；非伤害故不施红警示，靠 office 调色板的平台色 + 描边维持可读（对齐 art-bible §9 可访问性）。

### 4.2 咖啡渍 `coffee_spill`（⚙️ 需工程：新增低摩擦 zone · R1）

**核心定义**：coffee_spill 是地面上的一块矩形低摩擦区。玩家踏入该矩形（身体与区域 AABB 重叠且着地）时，水平减速被削弱（`friction * frictionScale`），导致「打滑、难急停」的控制风险。

**行为参数（每实例）**：

| 字段 | 含义 | 单位 | 取值 |
|---|---|---|---|
| `x` | 区域左上角 x | px | 见 §3.3 草案 |
| `y` | 区域左上角 y（贴地带 = 192） | px | 192 |
| `w` | 区域宽 | px | 64 |
| `h` | 区域高 | px | 32（覆盖 ty6 脚底带） |
| `frictionScale` | 摩擦倍率（<1 即更滑） | — | 0.30 ~ 0.40 |

- **状态/查询**：coffee_spill 无状态机、无 AI，是**静态区域**。game-scene 每固定步查询玩家 body 是否与任一 coffee_spill 区域 AABB 重叠且 `grounded`；若重叠，取该区域 `frictionScale`（多区域重叠取最小 = 最滑）注入角色控制器（见 §开放决策 Q2 / 附录 D R1 接口）；否则注入 `1.0`（正常摩擦）。
- **碰撞/伤害语义**：**非伤害**（不实现 HazardSource，不参与 damage-resolution，不触发 `applyFatalDeath`/`resolveHazardContact`）。仅影响 `character-controller` 第 123 行的水平减速系数 → 控制风险，不扣血、不致死。
- **telegraph 双编码（形状 + 视觉渍迹）**：地面渍迹形状 + 可选「微光/边缘高亮」提示「易滑」；因非伤害，不施红警示（区别于 vehicle/manhole 的 hazard 红），靠视觉渍迹维持可读（色盲安全：形状 + 相对位置提示，不依赖单色）。

### 4.3 与 1-6 的复用 / 差异说明

- **复用（全部沿用）**：4 通用敌组、coin/seed/chestnut 经济规模、checkpoint×3 写法、`triumph_gate` 终点、`spawn`、`width=54/height=9/tileSize=32` 尺寸、unknown theme 回退 grass。
- **差异**：用 **paper_pile 静态平台实体 + coffee_spill 低摩擦 zone** 取代街「vehicle/manhole 动态 hazard」——纵向平台腾挪 + 局部打滑控制风险，难度维度从「横向 timing」转为「空间平台 + 局部控制风险」。调色板换 office 冷调办公 tint（`office-visual-spec`）。不含 sofa/table/cabinet tile kind、不含 vehicle/manhole。
- **不新增引擎机制种类（守 MVP）**：paper_pile 为既有的「静态实体碰撞/平台」表达（类比 home cabinet/sofa 实体化）；coffee_spill 为既有「区域力场/区域查询」表达（类比 cyclone 区域力场 / riptide 区域），唯一新增是 R1 让 `friction` 可被 zone 覆盖（见 §开放决策 Q2 / theme-system §3.4 R1）。

---

## 5. 障碍 / 陷阱协同

### 5.1 文件堆与通用敌协同
- F1：p1(416,160) 2 格高平台 + `du_fu`(448,120) 悬于平台上方，构成「站文件堆吃高空币」的复合动词；`ci_li`(720) 置于 p2 之后，作「越堆后再踩栗」的时序点。
- F2：p4(1056)/p5(1248) 错落平台配合 `shi_pao`(1312,100) 高台炮击，逼迫「看平台落点 + 躲炮」的双线决策；`chong_feng`(960) 置于 p3 与 p4 之间过渡缓冲。

### 5.2 咖啡渍与文件堆协同
- 咖啡渍全布于文件堆之外的地面段（cs1 tx16 / cs2 tx24 / cs3 tx35 / cs4 tx43），不与文件堆重叠（仅边界相邻）→ 避免「同格既滑又挡」的认知过载；玩家在咖啡渍段靠「提前减速/借惯性过渍」控制风险，在文件堆段靠「跳上平台」越障，两种控制挑战分域训练。
- cs2(768) 置于 F2 入口前（p3 之后），作为「进平台挑战前最后一块咖啡渍」的缓冲教学（较宽更滑，frictionScale 0.30）。

### 5.3 与四通用敌协同
- 引导段纯净教学 4 通用敌；过渡段后 `shi_pao`(800/1312) 置于非平台高台；`ci_li`(224/720/1008) 作可踩弹跳点，配合高币/种形成「踩敌 + 站堆 + 上高」组合。

---

## 6. 种子 / 币种（保留 seed 蜕变成长系统）

沿用 1-5/1-6 经济规模（守跨关经济一致，防失衡）：

| 类型 | 数量 | 说明 |
|---|---|---|
| `coin` 金币 | **18** | 沿路 + 平台上方高币（奖励站文件堆）+ 咖啡渍上方/内部币（奖励控制风险通过） |
| `seed` 种子 | **6**（`seed_01`..`seed_06`） | 保留 P3 蜕变；2 颗置于高路线（奖励站堆/上高） |
| `chestnut` 栗子（弹药） | **3**（各 `amount:5`） | x=150/520/920，y=200；扔栗子系统补给 |

**坐标草案**：见附录 C JSON（coin×18 / seed×6 / chestnut×3 已展开；部分币/种置于文件堆上方作平台奖励、置于咖啡渍区作控制风险奖励）。

---

## 7. 节拍段（可选 · bp_office，默认关）

沿用 BeatDrivenSystem（`bpm:120` / `grid:8`）。**初版默认 `beat.enabled:false`，无 `beatPlatforms`（bp_office 默认关，待主理人拍板）**。

- **候选 bp_office 位置（若启用）**：tiles `tx 33,34 @ ty=3`（F2 平台段上方补充高路线），`initial:"solid"`，作为**补充**非主路径。
- **心流保护 / 推荐关**：office 已叠加 2 个新机制（paper_pile 平台 + coffee_spill 低摩擦），若再叠 beat 平台 = 第 3 层 timing，违反「不认知过载」红线。故初版推荐关；若 QA 实测平台+打滑未致认知过载，可后续启用 bp_office 作补充高路线。详见 §开放决策 Q3。

---

## 8. parTime 建议值

| 关卡 | parTimeMs | 备注 |
|---|---|---|
| 1-1 | 60000 | 占位 |
| 1-2 | 84000 | 占位 |
| 1-3 | 96000 | 占位 |
| 1-4 | 102000 | 占位 |
| 1-5 | 108000 | 占位 |
| 1-6 | 112000 | 占位 |
| **1-7** | **114000**（建议区间 108000–120000） | **初版占位，待 QA 真机调校**（文件堆平台跳跃 + 咖啡渍打滑控速略增耗时 + 宽度同量级） |

> 标注「待 QA 调校」：文件堆平台跳跃 + 咖啡渍打滑控速需玩家更谨慎通过，parTime 应比线性长度直觉略宽松；最终以 playtest 中位通关时间 × 系数收敛。

---

## 9. 难度曲线与 MDA 对齐

### 9.1 与 1-6 的差异点
- 1-6：车流横穿（致命）+ 井盖蒸汽（非致死），横向 timing 峰；惩罚组合「车辆致命 respawn + 蒸汽非致死扣血」靠 3 检查点守住公平。
- 1-7：文件堆可踩平台（非伤害）+ 咖啡渍局部打滑（非伤害），纵向平台 + 局部控制风险峰；**玩家伤害来源仅 4 通用敌**，文件堆/咖啡渍零伤害负担，靠 3 检查点守住公平。
- 难度维度不同：1-7 挑战来自**空间平台规划（站堆越障）+ 局部控制风险（咖啡渍打滑）**，而非 1-6 的横向 timing 规划。

### 9.2 SDT 三大需求 + 心流（对齐 theme-system §2.3 / 概念文档 §3）
- **自主 Autonomy**：文件堆可「站顶越障」或「绕过」双解；咖啡渍可「提前减速稳过」或「借惯性冲过」；扔栗子仍可清敌。
- **胜任 Competence**：文件堆为实心可站平台（形状 telegraph 明确「可站」）、咖啡渍为视觉渍迹 telegraph「易滑」；2 新机制渐进引入（F1 各教学 1 个 → F2 叠加）。
- **关联 Relatedness**：office 冷调办公 + deco_desk/deco_plant 制造「格子间劳作」旅程感（微信炫耀更易触发）；grass→…→home→street→office 跨主题凝聚力。
- **心流 Flow**：office = world 1 第四次新鲜感尖峰（冷调办公 vs 前关暖棕家/冷灰街）；仅 2 新机制 → 不认知过载。

### 9.3 设计理论红线自检（无违规）
- **无主导策略**：文件堆「站/绕」双解；咖啡渍「稳过/冲过」双解；高币奖励多路线。
- **无经济失衡**：币/种/弹药规模与 1-5/1-6 持平（18 币 / 6 种 / 3 弹药）。
- **无认知过载**：仅 2 新机制（paper_pile + coffee_spill）；bp_office 默认关。
- **无支柱漂移**：P1 跳（踩敌/站堆/上高币）、P2 闯（避打滑/避敌）、P3 蜕变（seed）全服务。

---

## 10. 进度链（nextLevelId 衔接）

- 现有 `LEVEL_ORDER`（1-6 设计稿记录）= `['1-1','1-2','1-3','1-4','1-5','1-6','2-1','2-2','2-3','2-4']`。
- **⚙️ 注册建议**（工程落地时改 `src/core/config/index.ts`，本设计稿不碰 src）：插入 `'1-7'` 于 `'1-6'` 之后 →
  `LEVEL_ORDER = ['1-1','1-2','1-3','1-4','1-5','1-6','1-7','2-1','2-2','2-3','2-4']`。
- 纯函数 `nextLevelId(LEVEL_ORDER, '1-7')` → **`'2-1'`**（沿用现有 `src/core/level/level-order.ts`，零改）。
- 1-7 自身 JSON 的 `metadata.nextLevelId` **无需字段**（由 `LEVEL_ORDER` 推导，一致于 1-1..1-6）。
- 末关判定：1-7 非末关（后面有 2-1…），结算页「下一关」正常出现并加载 2-1。
- **注**：本插入将 world 1 由 6 关扩为 7 关（1-1..1-7），属 roadmap 批次 3 主题增量，需主理人确认 world 1 终局是否含 office（原 theme-system §6 推荐 world 1 = grass/mountain/sea/rain，office 进世界 2+；本关作为 office 首落，建议 world 1 终局扩为含 office 或保留 office 为 world 2 首关——见附录 B 开放决策附加项）。

---

## 附录 A · 落地依赖清单（⚙️ 需工程 / art）

| # | 项 | 归属 | 状态 |
|---|---|---|---|
| A1 | `theme-palette.ts` 注册 `office` 8 槽（office-visual-spec 权威：冷调办公 tint，0 新增 hex） | art→eng | 契约待 `office-visual-spec` 落盘 |
| A2 | `LevelTheme` 联合类型增 `'office'`（未知回退 `'grass'`） | eng | theme-system R6 |
| A3 | `EnemyEntityType` 联合类型增 `'paper_pile'` / `'coffee_spill'`；`createEnemies` 白名单加二项；`EntityDef` 联合增 `PaperPileEntityDef` / `CoffeeSpillEntityDef`（见附录 D） | eng | 新实体/区域 |
| A4 | `paper_pile` 平台碰撞（静态实心 AABB，CollisionWorld 注册为 solid/oneway；`solidity` 由字段决定；非伤害、不入 damage-resolution） | eng | 碰撞/平台 |
| A5 | `coffee_spill` 低摩擦 zone（zone 列表注册；game-scene 每固定步查询玩家重叠 → 注入 `controller.currentFrictionScale`；**R1 角色控制器第 123 行小加法**） | eng | 区域查询 + R1 |
| A6 | `LEVEL_ORDER` 插入 `'1-7'`（§10） | eng（1 行） | 配置 |
| A7 | 1-7.json 由本设计稿坐标落地（同款 Schema，theme=`office`，paper_pile/coffee_spill 以 `entities[]` 表达） | eng | 内容 |
| A8 | 装饰层 `deco_desk` / `deco_plant`（非碰撞，程序化） | art→eng | `office-visual-spec` |

---

## 附录 B · 开放决策（待主理人拍板）

**Q1 paper_pile 性质**：推荐「**可踩平台（solid 堆叠物，可站可借越障，非伤害）**」。理由：office 语义下文件堆作为「踏脚/掩体」更符合直觉（文件堆可站、可借越障）；且叠加 coffee_spill 已制造控制风险，文件堆若再致伤会叠加惩罚负担、破坏公平（设计理论红线自检「无经济失衡/无认知过载」）。备选：硬性障碍（不可踩、碰撞致伤）——更强阻挡但增加伤害负担，且与 office 语义（文件堆可踩）冲突。

**Q2 coffee_spill 低摩擦范围**：推荐「**局部 zone（仅咖啡渍矩形内打滑，R1 正确落点）**」。理由：theme-system §3.4 R1 明确 `low_friction` 是「zone 级 `frictionScale`」——仅玩家踏入咖啡渍矩形且着地时减速削弱，其他区域手感不变，精准、可控、不破坏全关；若改「整关全局 low_friction」则全关变滑、破坏非咖啡渍区域（引导段/收尾段）的正常手感，且 R1 落点从「zone 查询」退化为「theme 级 frictionScale」，失去局部精度。备选：整关全局 low_friction（更简单，但全关变滑、破坏其他区域手感）。

**Q3 bp_office（节拍系统）**：推荐「**关（`beat.enabled:false`，无 `beatPlatforms`）**」。理由：office 已叠加 2 个新机制（paper_pile 平台 + coffee_spill 低摩擦），再叠 beat 平台 = 第 3 层 timing，违反「不认知过载」红线；home(1-5) 初版亦关、street(1-6) 初版亦关，office 初版应关以守公平。备选：启用（bp_office 作 F2 平台段上方补充高路线，需在 QA 验证未致过载后开启）。

**附加开放项（非三问，供参考）**：
- **A. world 1 是否扩为 7 关含 office**（本关作为 world 1 收尾）？抑或 office 留作 world 2 首关、world 1 维持原 6 关（grass/mountain/sea/rain/home/street）？→ 设计侧倾向「world 1 含 office 作办公收束」（玩家体验更连贯），但需主理人定 world 1 终局。
- **B. paper_pile 尺寸（建议 32×32 / 32×64 / 64×32）与 solidity（推荐 solid）初版值是否接受**（待手感调校）？
- **C. coffee_spill 的 `frictionScale` 初版值 0.30~0.40 是否接受**（待手感调校；越低越滑、控制风险越高）？

---

## 附录 C · 1-7.json 草拟（工程可直接采用）

> 字段对齐 1-6.json：`id/version/tileSize/width/height/tiles/entities/props/checkpoints/goal/spawn/beat/metadata` 全保留；office **不含** sofa/table/cabinet/vehicle/manhole。`theme` 必须为 `"office"`。entities 含 4 通用敌 + paper_pile×5 + coffee_spill×4 + 3 检查点 + 凯旋之门 + chestnut×3 + coin×18 + seed×6。beat.enabled=false（bp_office 默认关）。坐标语义：enemy y = bbox 顶（地面敌底贴地 224）；paper_pile(x,y,w,h) = 静态实心平台碰撞盒左上角+尺寸（底贴地 224）；coffee_spill(x,y,w,h,frictionScale) = 地面低摩擦区域（y=192,h=32 覆盖脚底带 ty6）。

```json
{
  "id": "1-7",
  "version": 1,
  "tileSize": 32,
  "width": 54,
  "height": 9,
  "tiles": [
    { "tx": 0, "ty": 7, "kind": "solid" },
    { "tx": 1, "ty": 7, "kind": "solid" },
    { "tx": 2, "ty": 7, "kind": "solid" },
    { "tx": 3, "ty": 7, "kind": "solid" },
    { "tx": 4, "ty": 7, "kind": "solid" },
    { "tx": 5, "ty": 7, "kind": "solid" },
    { "tx": 6, "ty": 7, "kind": "solid" },
    { "tx": 7, "ty": 7, "kind": "solid" },
    { "tx": 8, "ty": 7, "kind": "solid" },
    { "tx": 9, "ty": 7, "kind": "solid" },
    { "tx": 10, "ty": 7, "kind": "solid" },
    { "tx": 11, "ty": 7, "kind": "solid" },
    { "tx": 12, "ty": 7, "kind": "solid" },
    { "tx": 13, "ty": 7, "kind": "solid" },
    { "tx": 14, "ty": 7, "kind": "solid" },
    { "tx": 15, "ty": 7, "kind": "solid" },
    { "tx": 16, "ty": 7, "kind": "solid" },
    { "tx": 17, "ty": 7, "kind": "solid" },
    { "tx": 18, "ty": 7, "kind": "solid" },
    { "tx": 19, "ty": 7, "kind": "solid" },
    { "tx": 20, "ty": 7, "kind": "solid" },
    { "tx": 21, "ty": 7, "kind": "solid" },
    { "tx": 22, "ty": 7, "kind": "solid" },
    { "tx": 23, "ty": 7, "kind": "solid" },
    { "tx": 24, "ty": 7, "kind": "solid" },
    { "tx": 25, "ty": 7, "kind": "solid" },
    { "tx": 26, "ty": 7, "kind": "solid" },
    { "tx": 27, "ty": 7, "kind": "solid" },
    { "tx": 28, "ty": 7, "kind": "solid" },
    { "tx": 29, "ty": 7, "kind": "solid" },
    { "tx": 30, "ty": 7, "kind": "solid" },
    { "tx": 31, "ty": 7, "kind": "solid" },
    { "tx": 32, "ty": 7, "kind": "solid" },
    { "tx": 33, "ty": 7, "kind": "solid" },
    { "tx": 34, "ty": 7, "kind": "solid" },
    { "tx": 35, "ty": 7, "kind": "solid" },
    { "tx": 36, "ty": 7, "kind": "solid" },
    { "tx": 37, "ty": 7, "kind": "solid" },
    { "tx": 38, "ty": 7, "kind": "solid" },
    { "tx": 39, "ty": 7, "kind": "solid" },
    { "tx": 40, "ty": 7, "kind": "solid" },
    { "tx": 41, "ty": 7, "kind": "solid" },
    { "tx": 42, "ty": 7, "kind": "solid" },
    { "tx": 43, "ty": 7, "kind": "solid" },
    { "tx": 44, "ty": 7, "kind": "solid" },
    { "tx": 45, "ty": 7, "kind": "solid" },
    { "tx": 46, "ty": 7, "kind": "solid" },
    { "tx": 47, "ty": 7, "kind": "solid" },
    { "tx": 48, "ty": 7, "kind": "solid" },
    { "tx": 49, "ty": 7, "kind": "solid" },
    { "tx": 50, "ty": 7, "kind": "solid" },
    { "tx": 51, "ty": 7, "kind": "solid" },
    { "tx": 52, "ty": 7, "kind": "solid" },
    { "tx": 53, "ty": 7, "kind": "solid" },
    { "tx": 0, "ty": 8, "kind": "solid" },
    { "tx": 1, "ty": 8, "kind": "solid" },
    { "tx": 2, "ty": 8, "kind": "solid" },
    { "tx": 3, "ty": 8, "kind": "solid" },
    { "tx": 4, "ty": 8, "kind": "solid" },
    { "tx": 5, "ty": 8, "kind": "solid" },
    { "tx": 6, "ty": 8, "kind": "solid" },
    { "tx": 7, "ty": 8, "kind": "solid" },
    { "tx": 8, "ty": 8, "kind": "solid" },
    { "tx": 9, "ty": 8, "kind": "solid" },
    { "tx": 10, "ty": 8, "kind": "solid" },
    { "tx": 11, "ty": 8, "kind": "solid" },
    { "tx": 12, "ty": 8, "kind": "solid" },
    { "tx": 13, "ty": 8, "kind": "solid" },
    { "tx": 14, "ty": 8, "kind": "solid" },
    { "tx": 15, "ty": 8, "kind": "solid" },
    { "tx": 16, "ty": 8, "kind": "solid" },
    { "tx": 17, "ty": 8, "kind": "solid" },
    { "tx": 18, "ty": 8, "kind": "solid" },
    { "tx": 19, "ty": 8, "kind": "solid" },
    { "tx": 20, "ty": 8, "kind": "solid" },
    { "tx": 21, "ty": 8, "kind": "solid" },
    { "tx": 22, "ty": 8, "kind": "solid" },
    { "tx": 23, "ty": 8, "kind": "solid" },
    { "tx": 24, "ty": 8, "kind": "solid" },
    { "tx": 25, "ty": 8, "kind": "solid" },
    { "tx": 26, "ty": 8, "kind": "solid" },
    { "tx": 27, "ty": 8, "kind": "solid" },
    { "tx": 28, "ty": 8, "kind": "solid" },
    { "tx": 29, "ty": 8, "kind": "solid" },
    { "tx": 30, "ty": 8, "kind": "solid" },
    { "tx": 31, "ty": 8, "kind": "solid" },
    { "tx": 32, "ty": 8, "kind": "solid" },
    { "tx": 33, "ty": 8, "kind": "solid" },
    { "tx": 34, "ty": 8, "kind": "solid" },
    { "tx": 35, "ty": 8, "kind": "solid" },
    { "tx": 36, "ty": 8, "kind": "solid" },
    { "tx": 37, "ty": 8, "kind": "solid" },
    { "tx": 38, "ty": 8, "kind": "solid" },
    { "tx": 39, "ty": 8, "kind": "solid" },
    { "tx": 40, "ty": 8, "kind": "solid" },
    { "tx": 41, "ty": 8, "kind": "solid" },
    { "tx": 42, "ty": 8, "kind": "solid" },
    { "tx": 43, "ty": 8, "kind": "solid" },
    { "tx": 44, "ty": 8, "kind": "solid" },
    { "tx": 45, "ty": 8, "kind": "solid" },
    { "tx": 46, "ty": 8, "kind": "solid" },
    { "tx": 47, "ty": 8, "kind": "solid" },
    { "tx": 48, "ty": 8, "kind": "solid" },
    { "tx": 49, "ty": 8, "kind": "solid" },
    { "tx": 50, "ty": 8, "kind": "solid" },
    { "tx": 51, "ty": 8, "kind": "solid" },
    { "tx": 52, "ty": 8, "kind": "solid" },
    { "tx": 53, "ty": 8, "kind": "solid" },
    { "tx": 0, "ty": 0, "kind": "solid" },
    { "tx": 53, "ty": 0, "kind": "solid" },
    { "tx": 0, "ty": 1, "kind": "solid" },
    { "tx": 53, "ty": 1, "kind": "solid" },
    { "tx": 0, "ty": 2, "kind": "solid" },
    { "tx": 53, "ty": 2, "kind": "solid" },
    { "tx": 0, "ty": 3, "kind": "solid" },
    { "tx": 53, "ty": 3, "kind": "solid" },
    { "tx": 0, "ty": 4, "kind": "solid" },
    { "tx": 53, "ty": 4, "kind": "solid" },
    { "tx": 0, "ty": 5, "kind": "solid" },
    { "tx": 53, "ty": 5, "kind": "solid" },
    { "tx": 0, "ty": 6, "kind": "solid" },
    { "tx": 53, "ty": 6, "kind": "solid" }
  ],
  "entities": [
    { "type": "ci_li", "x": 224, "y": 200 },
    { "type": "ci_li", "x": 720, "y": 200 },
    { "type": "ci_li", "x": 1008, "y": 200 },
    { "type": "chong_feng", "x": 352, "y": 200 },
    { "type": "chong_feng", "x": 960, "y": 200 },
    { "type": "du_fu", "x": 448, "y": 120 },
    { "type": "du_fu", "x": 1088, "y": 120 },
    { "type": "shi_pao", "x": 800, "y": 100 },
    { "type": "shi_pao", "x": 1312, "y": 100 },
    { "type": "paper_pile", "x": 416, "y": 160, "w": 32, "h": 64, "solidity": "solid" },
    { "type": "paper_pile", "x": 640, "y": 192, "w": 64, "h": 32, "solidity": "solid" },
    { "type": "paper_pile", "x": 864, "y": 160, "w": 32, "h": 64, "solidity": "solid" },
    { "type": "paper_pile", "x": 1056, "y": 192, "w": 32, "h": 32, "solidity": "solid" },
    { "type": "paper_pile", "x": 1248, "y": 160, "w": 32, "h": 64, "solidity": "solid" },
    { "type": "coffee_spill", "x": 512, "y": 192, "w": 64, "h": 32, "frictionScale": 0.35 },
    { "type": "coffee_spill", "x": 768, "y": 192, "w": 64, "h": 32, "frictionScale": 0.30 },
    { "type": "coffee_spill", "x": 1120, "y": 192, "w": 64, "h": 32, "frictionScale": 0.40 },
    { "type": "coffee_spill", "x": 1376, "y": 192, "w": 64, "h": 32, "frictionScale": 0.35 },
    { "type": "chestnut", "x": 150, "y": 200, "params": { "amount": 5 } },
    { "type": "chestnut", "x": 520, "y": 200, "params": { "amount": 5 } },
    { "type": "chestnut", "x": 920, "y": 200, "params": { "amount": 5 } },
    { "type": "checkpoint", "x": 832, "y": 176 },
    { "type": "checkpoint", "x": 1056, "y": 176 },
    { "type": "checkpoint", "x": 1376, "y": 176 },
    { "type": "coin", "x": 160, "y": 200 },
    { "type": "coin", "x": 288, "y": 200 },
    { "type": "coin", "x": 512, "y": 200 },
    { "type": "coin", "x": 608, "y": 200 },
    { "type": "coin", "x": 736, "y": 200 },
    { "type": "coin", "x": 960, "y": 200 },
    { "type": "coin", "x": 992, "y": 200 },
    { "type": "coin", "x": 1136, "y": 200 },
    { "type": "coin", "x": 1600, "y": 200 },
    { "type": "coin", "x": 1648, "y": 200 },
    { "type": "coin", "x": 352, "y": 150 },
    { "type": "coin", "x": 672, "y": 150 },
    { "type": "coin", "x": 800, "y": 150 },
    { "type": "coin", "x": 1408, "y": 150 },
    { "type": "coin", "x": 416, "y": 128 },
    { "type": "coin", "x": 864, "y": 128 },
    { "type": "coin", "x": 1248, "y": 128 },
    { "type": "coin", "x": 1088, "y": 80 },
    { "type": "seed", "x": 320, "y": 200, "seedId": "seed_01" },
    { "type": "seed", "x": 544, "y": 200, "seedId": "seed_02" },
    { "type": "seed", "x": 928, "y": 200, "seedId": "seed_03" },
    { "type": "seed", "x": 1152, "y": 80, "seedId": "seed_04" },
    { "type": "seed", "x": 1216, "y": 80, "seedId": "seed_05" },
    { "type": "seed", "x": 1616, "y": 200, "seedId": "seed_06" }
  ],
  "props": [],
  "checkpoints": [],
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
    "enabled": false,
    "bpm": 120,
    "grid": 8,
    "tracks": []
  },
  "metadata": {
    "name": "《案牍劳形》",
    "theme": "office",
    "parTimeMs": 114000
  }
}
```

*说明（对工程的提醒，非阻塞）*：
1. paper_pile/coffee_spill 为新增 entity/zone 类型，须先落 A2/A3/A4/A5（联合类型 + 碰撞/zone 查询）方可被识别；在落地前加载本 JSON，二者将被白名单跳过（不渲染/不生效），属已知前置。
2. 本 JSON `beat.enabled:false` 且**无** `beatPlatforms`（bp_office 默认关，待主理人拍板 Q3）；若启用，按 §7 候选位置补 `beatPlatforms[]` + `beat.tracks[]`。
3. 坐标语义：(a) 地面敌 y=200 即 bbox 顶、底贴地 224；(b) paper_pile(x,y,w,h) = 静态实心平台碰撞盒左上角，底贴地 224（y=160→2 格高，y=192→1 格高）；(c) coffee_spill(x,y,w,h,frictionScale) = 地面低摩擦区域（y=192,h=32 覆盖脚底带 ty6），玩家着地重叠时减速按 `friction*frictionScale` 计算（R1）。

*本文件为 1-7 办公主题关卡内容设计稿（加法），roadmap 批次 3；未修改现有 GDD / `src/` / `assets`；未 git commit。待主理人（游承峰）审批后由 engineering-lead 与 art-director 分别落地（A1–A8）。*

---

## 附录 D · 联合类型增量与 R1 接口（供 engineering 落地）

### D.1 联合类型增量

- **`LevelTheme`** 增 `'office'`：
  `| 'grass' | 'cave' | 'mountain' | 'vine_forest' | 'storm_sky' | 'sea' | 'desert' | 'home' | 'street' | 'office'`。未知回退 `'grass'`（theme-system R6）。
- **`EnemyEntityType`** 增 `'paper_pile'` / `'coffee_spill'`：
  `| ... | 'vehicle' | 'manhole' | 'paper_pile' | 'coffee_spill'`。`createEnemies` 白名单同步加二项（若未加，加载期将被跳过、不渲染/不生效——属已知落地前置）。
- **`EntityDef`** 联合增两个专属实体定义：
  ```ts
  export interface PaperPileEntityDef {
    type: 'paper_pile';
    x: number;            // 碰撞盒左上角 x（px）
    y: number;            // 碰撞盒左上角 y（px，底贴地 224）
    w: number;            // 碰撞盒宽（px）
    h: number;            // 碰撞盒高（px）
    solidity: 'solid' | 'oneway';  // 碰撞分类（推荐 'solid'）
  }
  export interface CoffeeSpillEntityDef {
    type: 'coffee_spill';
    x: number;            // 区域左上角 x（px）
    y: number;            // 区域左上角 y（px，贴地带 = 192）
    w: number;            // 区域宽（px）
    h: number;            // 区域高（px，=32 覆盖脚底带 ty6）
    frictionScale: number; // 摩擦倍率（0<frictionScale<1；越小越滑）
  }
  ```
- **不新增 `TileKind`**：paper_pile 走实体方案（CollisionWorld 注册静态实心 AABB），coffee_spill 走区域方案（zone 列表），office 无 sofa/table/cabinet 类地形 tile kind。

### D.2 R1 接口 · 角色控制器消费 zone `frictionScale`

**精确落点描述**（对应 `src/core/character/character-controller.ts` 第 123 行附近）：

```ts
// character-controller.ts
export class CharacterController {
  /**
   * 当前地面摩擦倍率（zone 提供；缺省 1.0 = 全局 cfg.friction）。
   * 由 game-scene 每固定步在 consume() 之前注入：
   *   - 若玩家 body 与任一 coffee_spill 区域 AABB 重叠且 grounded → 取该区域 frictionScale（多区域重叠取最小 = 最滑）；
   *   - 否则 = 1.0（正常摩擦）。
   */
  currentFrictionScale = 1.0;

  consume(input: InputState, dt: number): void {
    // ... 其他逻辑 ...
    // 第 123 行附近：无方向输入 → 按 friction * currentFrictionScale 朝 0 减速
    } else {
      s.vx = approach(s.vx, 0, cfg.friction * this.currentFrictionScale * dt);
    }
    // ...
  }
}
```

**game-scene 每固定步注入逻辑（伪代码，供 engineering 落地 A5）**：

```text
// 在 controller.consume(input, dt) 之前：
let fs = 1.0
if (player.grounded) {
  for (const z of runtime.coffeeSpillZones) {        // 由 entities[] 中 coffee_spill 构建的区域列表
    if (aabbOverlap(player.body, z)) {               // 玩家 body 与区域 AABB 重叠
      fs = Math.min(fs, z.frictionScale)             // 多区域重叠取最滑
    }
  }
}
controller.currentFrictionScale = fs
controller.consume(input, dt)
```

> **R1 诚实标注**（与 theme-system §3.4/§8 R1 一致）：`low_friction`（咖啡渍滑地）是 8 主题中**唯一需要角色控制器一处小加法**的机制——让 `friction` 可被 zone 覆盖（第 123 行乘 `currentFrictionScale`）。其余 office 机制（paper_pile 静态平台）均可在既有 CollisionWorld 上以数据/实体形式激活，无引擎小改动。此点提交 engineering-lead（程基岩）评估并落地 A5。
