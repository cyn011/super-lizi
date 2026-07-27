# 关卡设计稿 · 1-6《霓街穿行》（街主题 · street）

> 文档类型：关卡内容设计稿（GDD 级，加法扩展）｜roadmap 批次 3 · 第三个主题：街 1-6（高）
> 作者：文策渊（design-strategist）
> 上游依据：`design/gdd/theme-system.md` §4（street 行 + §4.2 专属元素速查：vehicle 大方块+前灯、manhole 圆盖+蒸汽）｜`design/gdd/level-1-5-design.md`（家 1-5 设计稿，本文件结构镜像源）｜`src/config/levels/1-5.json`（Schema 同构）｜`src/core/level/level-data.ts`（LevelTheme / EnemyEntityType 联合类型，street 须增 `'street'` + `vehicle`/`manhole`）｜`src/core/enemy/enemy-ai.ts`（vehicle 属「水平移动 hazard」家族、manhole 属「周期陷阱」家族，类比 gu_bao / cyclone 表驱动状态机）｜`src/game/damage-resolution.ts`（`applyFatalDeath` 致死 respawn / `resolveHazardContact` 非致死扣血）
> **红线**：沿用现有 `LevelData` Schema（tileSize=32、height=9）；零位图（ADR-004，纯 Graphics + 系统字体 + tint）；11 色锁色板（仅引用 street-visual-spec 既有色语义，0 新增 hex）；MVP 全程序化占位；IP 全原创、禁任天堂符号。
> **本文件只写设计稿，不写/改任何 `.ts` 源码，不 git commit。** 标记为「⚙️ 需工程」的为对 `LevelData` / 引擎 / AI 的建议扩展，提交 engineering-lead 落地。

---

## 1. 关卡概述

| 项 | 值 |
|---|---|
| 关卡 id | `1-6` |
| 关名（建议） | **《霓街穿行》**（备选：《车流之间》《归途长街》） |
| 主题 theme | `street`（urban_indoor 家族，冷灰城市 tint；palette 由 art-director 另出 `street-visual-spec`，本稿仅引用） |
| 在世界 1 的位置 | 第 6 关，紧接 1-5 `home`（归巢）之后，作为 world 1 室内/都市家族的「车流与井盖」收尾关（参见 §10 进度链变更） |
| 难度定位 | 与 1-5 同量级、维度不同：1-5 是「家具垂直腾挪 + 宠物致伤（非致死）」，1-6 转为「车流横穿 timing + 井盖蒸汽间歇 hazard」——靠 3 检查点 + 双机制 telegraph 拉回公平区 |
| 设计支柱对齐 | P1 跳（踩 ci_li/du_fu + 跳越车辆/上高币）｜P2 闯（避车辆撞碰 + 避井盖蒸汽的 timing）｜P3 蜕变（保留 seed 实体） |

**定位理由**：world 1 难度曲线 = 1-1 草原教学 → 1-2 山川 → 1-3 海 → 1-4 沙漠 → 1-5 家 → **1-6 街（车流+井盖，都市 timing 峰）**。街只叠加 **2 个新机制（移动车辆 vehicle + 周期井盖蒸汽 manhole）**，符合 theme-system §2.3「每主题只叠加 1–2 个新机制，不造成认知过载」。1-6 用「横版车流横穿 + 间歇蒸汽」制造挑战，死亡率受控（车辆致命但 telegraph 充分、蒸汽非致死），是 world 1 的「都市收束」。

**关名候选**：
- **《霓街穿行》**（推荐）：street 冷灰都市 + 霓虹（deco_lamp）意象，动词「穿行」直指车流横穿核心机制。
- 《车流之间》：突出 vehicle 错相位横穿的节奏感。
- 《归途长街》：叙事向（归家长街），但弱化了车辆/井盖的机制标识，故不推荐为首选。

---

## 2. 关卡结构与尺寸

| 参数 | 1-6 建议 | 对照 1-5 |
|---|---|---|
| `tileSize` | 32 | 32 |
| `width`（瓦片） | **54**（世界宽 1728px） | 54 |
| `height`（瓦片） | 9（=288px） | 9 |
| 地面 | ty=7,8 全宽实心（tx 0..53） | 同 |
| 左右墙 | tx=0 与 tx=53 的 ty 0..6 实心 | 同 |
| 家具地形 | 无（street 无 sofa/table/cabinet；障碍为动态 vehicle/manhole 实体） | 家为家具地形 |

**布局分区（左→右，按 vehicle/manhole 编排 timing）**

| 区段 | tx 区间 | 内容 | 专属障碍 |
|---|---|---|---|
| 引导段 | 1..11 | 平地 + 4 通用敌引入（ci_li/chong_feng/du_fu/shi_pao 各首现）+ 首批币/种 + 首颗栗子 | 无（纯净教学） |
| **F1 车辆教学** | 12..21 | 首辆 vehicle(v1) 横穿教学 + 首只 manhole(m1) 喷蒸汽前摇 + du_fu 高空币 | vehicle×1 + manhole×1 |
| 过渡段 | 22..32 | 通用敌 + manhole×2(m2/m3) 错相位喷蒸汽 + shi_pao 高台 + cp1 | manhole×2 |
| **F2 车流挑战** | 33..46 | vehicle×2(v2/v3) 错相位横穿 + manhole×1(m4) + 通用敌压力 + cp2/cp3 | vehicle×2 + manhole×1 |
| 收尾段 | 47..53 | 末批币/种 + 末敌 + 凯旋之门 | 无 |

**检查点**：3 个（顶层 `checkpoints:[]` 保持空、检查点以 `type:"checkpoint"` 实体声明，同 1-5）：

| 检查点 | x | y | 位置说明 |
|---|---|---|---|
| cp1 | 832 | 176 | F1 之后、m1 之后、m2/m3 之前 |
| cp2 | 1056 | 176 | F2 车辆挑战之前缓冲 |
| cp3 | 1376 | 176 | F2 车辆挑战之后、收尾段前 |

**凯旋之门（终点）**：`goal.type="triumph_gate"`，`x=1664`、`y=160`、`w=32`、`h=64`（与 1-1..1-5 同款）。
**出生点**：`spawn={x:64,y:190}`（与 1-1..1-5 同款）。

---

## 3. 敌人配置清单

### 3.1 四通用敌全覆盖（跨主题恒含，theme-system §4 base4）

| 敌种 | 可踩 | 数量 | 典型 x,y | 说明 |
|---|---|---|---|---|
| `ci_li` 刺栗 | 是 | 3 | 224,200 ／ 720,200 ／ 1008,200 | 地面圆球红刺，踩踏弹跳 |
| `chong_feng` 锥冲 | 否 | 2 | 352,200 ／ 960,200 | 地面楔形硬顶，需跳避 |
| `du_fu` 嘟浮 | 是 | 2 | 448,120 ／ 1088,120 | 空中蓝紫实心扁圆，踩踏（street 冷底加描边维持辨识） |
| `shi_pao` 石炮 | 否 | 2 | 800,100 ／ 1312,100 | 冷蓝方块炮口，关卡中后段 |

> 四通用敌沿用既有 `type` 键，仅外观换 street 冷灰皮（由 `street-visual-spec` 映射绘制，零引擎改动）。

### 3.2 专属障碍 · 移动车辆 `vehicle`（street 专属，⚙️ 需工程：新敌 AI · 水平移动 hazard 家族）

- **数量**：**3**（F1 首现 1 辆教学，F2 错相位横穿 2 辆作压力）。
- **外观**（权威，theme-system §4.2）：bbox 48×32 大方块 + 前灯；环境冷蓝 `#4A78C0` 身 + 警示红 `#E8483B` 灯；描边 `#2A1A12`。硬顶大方块（无 soft 圆角）= 不可踩双编码；前灯红 = 危险提示。
- **行为**：沿固定 y（地面，bbox 顶 y=192、底 y=224）水平往返，在 `[x, x+range]` 区间以 `speed` 来回；初始方向 `dir`；`phaseOffset` 错相位（详见 §4.1）。不可踩（hard 顶语义）；接触玩家 = **致命（复用 `applyFatalDeath`，respawn 到检查点）**（见 §开放决策 Q1，推荐致命）。
- **坐标草案**：v1(384,192) 教学 ／ v2(1056,192) ／ v3(1344,192)。

### 3.3 专属障碍 · 井盖 `manhole`（street 专属，⚙️ 需工程：新周期陷阱 AI）

- **数量**：**4**（F1 首现 1 只，过渡段 2 只，F2 入口 1 只，均错相位）。
- **外观**（权威，theme-system §4.2）：地面圆盖（描边 `#2A1A12`）+ 周期喷蒸汽（暖橙 `#F2933C` 蒸汽柱）。盖平时可踩（地面 solid 自动满足），蒸汽喷发时盖上方形成危险区。
- **行为**：周期状态机 `SAFE`（盖可踩，无蒸汽）→ `TELEGRAPH`（盖脉冲/微震 telegraphMs 预警）→ `STEAM`（盖上方 steamHeight 列危险区 activeMs）→ 回 `SAFE`；`phaseOffset` 错相位。蒸汽危险区接触玩家 = **非致死扣 1 级 + 无敌帧（复用 `resolveHazardContact` 非致死路径）**（见 §开放决策 Q2，推荐非致死）。
- **坐标草案**：m1(640,224) ／ m2(768,224) ／ m3(928,224) ／ m4(1024,224)。

---

## 4. 障碍矩阵（street 与家的核心差异）

> 本章明确 street 的两处机制表达。二者均为新 entity 类型（需新 AI / 周期状态机注册）；vehicle 属「水平移动 hazard」家族，manhole 属「周期陷阱」家族。

### 4.1 移动车辆 `vehicle`（⚙️ 需工程：新增水平振荡 AI）

**核心定义**：vehicle 是沿固定 y 水平往返的移动硬顶方块。玩家须「在车不在时横穿」或「跳过车顶」（但落上硬顶=致命），构成 street 的横向 timing 压力。

**行为参数（每实例，写入 `entities[].params`）**：

| 参数 | 含义 | 单位 | v1 | v2 | v3 |
|---|---|---|---|---|---|
| `x` | 振荡区间左端（bbox 左上角 x） | px | 384 | 1056 | 1344 |
| `y` | 固定 y（bbox 顶，底 = y+height 贴地） | px | 192 | 192 | 192 |
| `speed` | 水平速度 | px/s | 90 | 120 | 105 |
| `range` | 振荡跨度（右端 = x+range） | px | 224 | 224 | 192 |
| `dir` | 初始方向（1=右 / -1=左） | — | 1 | -1 | 1 |
| `width` | bbox 宽 | px | 48 | 48 | 48 |
| `height` | bbox 高 | px | 32 | 32 | 32 |
| `phaseOffset` | 相位偏移（错相位，避免三车同步） | ms | 0 | 600 | 1200 |

- **碰撞/可踩语义**：vehicle 实现 `HazardSource`，`isStompable=false`（硬顶）；`overlaps` 在 bbox 与玩家相交即返回 true（恒危险，无安全相位）。
- **致命性**：**推荐致命**（撞车 = `applyFatalDeath` → 扣 1 命 + respawn 检查点）。理由：street 都市「车流」语义下，撞车致死符合直觉与公平（充分 telegraph：大方块 + 前灯红 + 可见运动轨迹）；且车辆速度有限、路线固定，玩家可预判横穿窗口（见 §开放决策 Q1）。
- **telegraph 双编码（形状 + 颜色）**：① 形状 = 大实心方块 + 前灯凸起（无 soft 圆角，区别于可踩圆敌 ci_li/du_fu）；② 颜色 = 冷蓝 `#4A78C0` 车身 + 警示红 `#E8483B` 前灯（红=危险），色盲安全（不靠单色）。

### 4.2 井盖 `manhole`（⚙️ 需工程：新增周期陷阱状态机）

**核心定义**：manhole 是地面圆盖 + 周期蒸汽陷阱。盖平时可踩（地面 solid 已满足），蒸汽喷发时盖上方形成垂直危险区，玩家须「在蒸汽间歇横穿盖面」。

**行为参数（每实例，写入 `entities[].params`）**：

| 参数 | 含义 | 单位 | m1 | m2 | m3 | m4 |
|---|---|---|---|---|---|---|
| `x` | 盖中心 x（危险列中心） | px | 640 | 768 | 928 | 1024 |
| `y` | 盖面 y（地面顶，=224） | px | 224 | 224 | 224 | 224 |
| `period` | 完整周期 | ms | 3000 | 3200 | 3000 | 3400 |
| `activeMs` | 蒸汽危险窗口时长 | ms | 900 | 900 | 900 | 1000 |
| `telegraphMs` | 喷发前预警时长（盖脉冲） | ms | 500 | 500 | 500 | 600 |
| `steamHeight` | 危险列高度（盖上方） | px | 96 | 96 | 96 | 96 |
| `width` | 盖/危险列宽 | px | 32 | 32 | 32 | 32 |
| `phaseOffset` | 相位偏移（错相位） | ms | 0 | 800 | 1600 | 1000 |

- **状态机**：`SAFE`（无蒸汽，盖可踩）→ `TELEGRAPH`（telegraphMs：盖脉冲/微震，双编码预警）→ `STEAM`（activeMs：危险列 `[x-w/2, x+w/2]×[y-steamHeight, y]` 生效，非致死）→ `SAFE`。
- **碰撞/可踩语义**：manhole 自身 bbox（盖）**非危险**（可踩）；危险区由 `STEAM` 相位独立查询 `getSteamBounds()` 返回列 AABB（仅 STEAM 期非空），由 damage-resolution 检查。
- **致命性**：**推荐非致死**（蒸汽 = 复用 `resolveHazardContact` 非致死路径，扣 1 级 + 无敌帧）。理由：蒸汽是间歇 small hazard，盖平时可踩、蒸汽窗口有限且有 telegraph，非致死更符合「间歇惩罚 + 可学习 timing」的 street 节拍；若致命则井盖与车辆双重致死、认知/惩罚过载，破坏公平（见 §开放决策 Q2）。
- **telegraph 双编码（形状 + 颜色）**：① 形状 = 盖面脉冲/微震 + 蒸汽柱升起（动态前摇）；② 颜色 = 暖橙 `#F2933C` 蒸汽（与冷灰街景地面形成对比），telegraph 期盖面转暖橙脉冲预警；色盲安全（形状动 + 色双编码）。

### 4.3 与 1-5 的复用 / 差异说明

- **复用（全部沿用）**：4 通用敌组、coin/seed/chestnut 经济规模、checkpoint×3 写法、`triumph_gate` 终点、`spawn`、`width=54/height=9/tileSize=32` 尺寸、unknown theme 回退 grass。
- **差异**：用 **动态 vehicle/manhole 实体** 取代家「家具即地形」——水平车流 timing + 间歇蒸汽陷阱，难度维度从「垂直腾挪」转为「横向 timing」。调色板换 street 冷灰城市 tint（`street-visual-spec`）。不含 sofa/table/cabinet tile kind、不含 quicksand/tide。
- **不新增引擎机制种类（守 MVP）**：vehicle/manhole 为既有「敌/hazard + 07 伤害」数据驱动的新子类 + 新 AI（类比 pet/toy/gu_bao）。

---

## 5. 障碍 / 陷阱协同

### 5.1 车辆与通用敌协同
- F1：v1 横穿车道 + `du_fu`(448,120) 高空悬于车道上方，构成「等车过 + 跳起吃高空币」的复合动词；`ci_li`(720) 在 v1 车道右侧，作「车过后再踩栗」的时序点。
- F2：v2/v3 错相位（phaseOffset 600/1200）在 tx33-48 形成「车流节奏」，配合 `shi_pao`(1312,100) 高台炮击，逼迫「看车相位 + 躲炮」的双线决策；`chong_feng`(960) 置于 v2 前过渡缓冲。

### 5.2 井盖与车辆协同
- 井盖全布于车辆车道之外的地面段（tx20/24/29/32，即 [608,1056] 安全区），不与车辆重叠 → 避免「同格双致死」的认知过载；玩家在车辆车道靠 timing 横穿，在井盖段靠蒸汽间歇横穿，两种 timing 分域训练。
- m4(1024) 置于 F2 入口（v2 之前），作为「进车流前最后一只井盖」的缓冲教学。

### 5.3 与四通用敌协同
- 引导段纯净教学 4 通用敌；过渡段后 `shi_pao`(800/1312) 置于非车道高台；`ci_li`(224/720/1008) 作可踩弹跳点，配合高币/种形成「踩敌 + 跳车 + 上高」组合。

---

## 6. 种子 / 币种（保留 seed 蜕变成长系统）

沿用 1-5 经济规模（守跨关经济一致，防失衡）：

| 类型 | 数量 | 说明 |
|---|---|---|
| `coin` 金币 | **18** | 沿路 + 车道上方高币（奖励跳车/ timing）/ 井盖上方高币（奖励横穿） |
| `seed` 种子 | **6**（`seed_01`..`seed_06`） | 保留 P3 蜕变；2 颗置于高路线（奖励跳车/上高） |
| `chestnut` 栗子（弹药） | **3**（各 `amount:5`） | x=150/520/920，y=200；扔栗子系统补给 |

**坐标草案**：见附录 C JSON（coin×18 / seed×6 / chestnut×3 已展开；部分币/种置于车道/井盖上方作 timing 奖励）。

---

## 7. 节拍段（可选 · bp_street，默认关）

沿用 BeatDrivenSystem（`bpm:120` / `grid:8`）。**初版默认 `beat.enabled:false`，无 `beatPlatforms`（bp_street 默认关，待主理人拍板）**。

- **候选 bp_street 位置（若启用）**：tiles `tx 33,34 @ ty=3`（F2 车流段上方补充高路线），`initial:"solid"`，作为**补充**非主路径。
- **心流保护 / 推荐关**：street 已叠加 2 个新 timing 机制（vehicle + manhole），若再叠 beat 平台 = 第 3 层 timing，违反「不认知过载」红线。故初版推荐关；若 QA 实测车流+蒸汽未致认知过载，可后续启用 bp_street 作补充高路线。详见 §开放决策 Q3。

---

## 8. parTime 建议值

| 关卡 | parTimeMs | 备注 |
|---|---|---|
| 1-1 | 26000 | 定稿（可达档） |
| 1-2 | 34000 | 定稿（可达档） |
| 1-3 | 40000 | 定稿（可达档，潮汐等待已计入） |
| 1-4 | 44000 | 定稿（可达档，流沙等待已计入） |
| 1-5 | 46000 | 定稿（可达档，家具攀爬已计入） |
| 1-6 | 48000 | 定稿（可达档，车流/蒸汽等待已计入） |
| 1-7 | 52000 | 定稿（可达档，文件堆/咖啡渍已计入） |

> 定稿说明：parTime 已放宽至可达档（QA 调校完成）。语义为「时间评级达标门槛」而非「速通极限」——普通玩家从容通关即满足 `elapsedMs ≤ parTimeMs`（见 `result-screen.ts` 二元门槛）。

---

## 9. 难度曲线与 MDA 对齐

### 9.1 与 1-5 的差异点
- 1-5：家具可踩地形 + 宠物致伤（非致死），垂直腾挪温和峰。1-6：车流横穿（致死）+ 井盖蒸汽（非致死），横向 timing 峰；惩罚组合「车辆致命 respawn + 蒸汽非致死扣血」靠 3 检查点守住公平。
- 难度维度不同：1-6 挑战来自**横向 timing 规划**（等车相位、避蒸汽窗口），而非 1-5 的垂直空间规划。

### 9.2 SDT 三大需求 + 心流（对齐 theme-system §2.3 / 概念文档 §3）
- **自主 Autonomy**：车道可「等车横穿」或「跳车顶越过」双解；井盖可「间歇横穿」；扔栗子仍可清敌。
- **胜任 Competence**：vehicle/manhole 均双编码 telegraph（形状+色），即时反馈「我能行」；2 新机制渐进引入（F1 各教学 1 个 → F2 叠加）。
- **关联 Relatedness**：street 冷灰城市 + deco_building/deco_lamp 霓虹制造「都市夜归」旅程感（微信炫耀更易触发）；grass→…→home→street 跨主题凝聚力。
- **心流 Flow**：街 = world 1 第三次新鲜感尖峰（冷灰都市 vs 前关暖棕家）；仅 2 新机制 → 不认知过载。

### 9.3 设计理论红线自检（无违规）
- **无主导策略**：车道「等/跳」双解；井盖「间歇横穿」；高币奖励多路线。
- **无经济失衡**：币/种/弹药规模与 1-5 持平（18 币 / 6 种 / 3 弹药）。
- **无认知过载**：仅 2 新机制（vehicle + manhole）；bp_street 默认关。
- **无支柱漂移**：P1 跳（踩敌/跳车/上高币）、P2 闯（避车/避蒸汽）、P3 蜕变（seed）全服务。

---

## 10. 进度链（nextLevelId 衔接）

- 现有 `LEVEL_ORDER`（1-5 设计稿记录）= `['1-1','1-2','1-3','1-4','1-5','2-1','2-2','2-3','2-4']`。
- **⚙️ 注册建议**（工程落地时改 `src/core/config/index.ts`，本设计稿不碰 src）：插入 `'1-6'` 于 `'1-5'` 之后 →
  `LEVEL_ORDER = ['1-1','1-2','1-3','1-4','1-5','1-6','2-1','2-2','2-3','2-4']`。
- 纯函数 `nextLevelId(LEVEL_ORDER, '1-6')` → **`'2-1'`**（沿用现有 `src/core/level/level-order.ts`，零改）。
- 1-6 自身 JSON 的 `metadata.nextLevelId` **无需字段**（由 `LEVEL_ORDER` 推导，一致于 1-1..1-5）。
- 末关判定：1-6 非末关（后面有 2-1…），结算页「下一关」正常出现并加载 2-1。
- **注**：本插入将 world 1 由 5 关扩为 6 关（1-1..1-6），属 roadmap 批次 3 主题增量，需主理人确认 world 1 终局是否含 street（原 theme-system §6 推荐 world 1 = grass/mountain/sea/rain，street 进世界 2+；本关作为 street 首落，建议 world 1 终局扩为含 street 或保留 street 为 world 2 首关——见附录 B 开放决策附加项）。

---

## 附录 A · 落地依赖清单（⚙️ 需工程 / art）

| # | 项 | 归属 | 状态 |
|---|---|---|---|
| A1 | `theme-palette.ts` 注册 `street` 8 槽（street-visual-spec 权威：冷灰城市 tint，0 新增 hex） | art→eng | 契约待 `street-visual-spec` 落盘 |
| A2 | `LevelTheme` 联合类型增 `'street'`（未知回退 `'grass'`） | eng | theme-system R6 |
| A3 | `EnemyEntityType` 联合类型增 `'vehicle'` / `'manhole'`；`createEnemies` 白名单加二项 | eng | 新敌 |
| A4 | `vehicle` AI（水平振荡 `[x, x+range]`，speed/dir/phaseOffset；`isStompable=false`；`overlaps` 恒危险；致命走 `applyFatalDeath`） | eng（新敌） | 视觉 spec 待 `street-visual-spec` |
| A5 | `manhole` AI（周期状态机 SAFE→TELEGRAPH→STEAM；`getSteamBounds()` 返回蒸汽列 AABB 仅 STEAM 期非空；非致死走 `resolveHazardContact`） | eng（新陷阱） | 视觉 spec 待 `street-visual-spec` |
| A6 | `LEVEL_ORDER` 插入 `'1-6'`（§10） | eng（1 行） | 配置 |
| A7 | 1-6.json 由本设计稿坐标落地（同款 Schema，theme=`street`，vehicle/manhole 以 `entities[]` 表达） | eng | 内容 |
| A8 | 装饰层 `deco_building` / `deco_lamp`（非碰撞，程序化） | art→eng | `street-visual-spec` |

---

## 附录 B · 开放决策（待主理人拍板）

**Q1 vehicle 致命性**：推荐「**致命**（被车撞 = respawn，复用 `applyFatalDeath`）」。理由：street 车流语义下撞车致死符合直觉；车辆路线固定、速度有限、telegraph 充分（大方块 + 红前灯 + 可见轨迹），致死公平且维持张力；若改非致死扣血则车辆威胁降级、与「车流」语义冲突。备选：非致死扣血（更温和，但弱化了 street 独有压力）。

**Q2 manhole 蒸汽致命性**：推荐「**非致死（蒸汽喷发 = 扣 1 级 + 无敌帧，复用 `resolveHazardContact` 非致死路径）**」。理由：蒸汽是间歇 small hazard，盖平时可踩、蒸汽窗口有限且有 telegraph，非致死符合「可学习 timing + 间歇惩罚」；若致命则井盖与车辆双重致死、惩罚/认知过载，破坏公平。备选：致命（更强惩罚，但风险过高）。

**Q3 bp_street（节拍系统）**：推荐「**关（`beat.enabled:false`，无 `beatPlatforms`）**」。理由：street 已叠加 2 个新 timing 机制（vehicle + manhole），再叠 beat 平台 = 第 3 层 timing，违反「不认知过载」红线；home(1-5) 初版亦关、desert(1-4) 开，street 初版应关以守公平。备选：启用（bp_street 作 F2 车流段上方补充高路线，需在 QA 验证未致过载后开启）。

**附加开放项（非三问，供参考）**：
- **A. world 1 是否扩为 6 关含 street**（本关作为 world 1 收尾）？抑或 street 留作 world 2 首关、world 1 维持原 5 关（grass/mountain/sea/rain/home）？→ 设计侧倾向「world 1 含 street 作都市收束」（玩家体验更连贯），但需主理人定 world 1 终局。
- **B. vehicle 高度（建议 32px / 1 tile）与速度（90–120 px/s）初版值是否接受**（待手感调校）？
- **C. manhole 蒸汽高度（96px / 3 tile）与周期（3000–3400ms）初版值是否接受**（待手感调校）？

---

## 附录 C · 1-6.json 草拟（工程可直接采用）

> 字段对齐 1-5.json：`id/version/tileSize/width/height/tiles/entities/props/checkpoints/goal/spawn/beat/metadata` 全保留；street **不含** sofa/table/cabinet/quicksand/tide。`theme` 必须为 `"street"`。entities 含 4 通用敌 + vehicle×3 + manhole×4 + 3 检查点 + 凯旋之门 + chestnut×3 + coin×18 + seed×6。beat.enabled=false（bp_street 默认关）。坐标语义：enemy y = bbox 顶（地面敌底贴地 224）；manhole y = 盖面 224；vehicle y = bbox 顶 192（底 224 贴地）。

```json
{
  "id": "1-6",
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
    { "type": "vehicle", "x": 384, "y": 192, "params": { "speed": 90, "range": 224, "dir": 1, "width": 48, "height": 32, "phaseOffset": 0 } },
    { "type": "vehicle", "x": 1056, "y": 192, "params": { "speed": 120, "range": 224, "dir": -1, "width": 48, "height": 32, "phaseOffset": 600 } },
    { "type": "vehicle", "x": 1344, "y": 192, "params": { "speed": 105, "range": 192, "dir": 1, "width": 48, "height": 32, "phaseOffset": 1200 } },
    { "type": "manhole", "x": 640, "y": 224, "params": { "period": 3000, "activeMs": 900, "telegraphMs": 500, "steamHeight": 96, "width": 32, "phaseOffset": 0 } },
    { "type": "manhole", "x": 768, "y": 224, "params": { "period": 3200, "activeMs": 900, "telegraphMs": 500, "steamHeight": 96, "width": 32, "phaseOffset": 800 } },
    { "type": "manhole", "x": 928, "y": 224, "params": { "period": 3000, "activeMs": 900, "telegraphMs": 500, "steamHeight": 96, "width": 32, "phaseOffset": 1600 } },
    { "type": "manhole", "x": 1024, "y": 224, "params": { "period": 3400, "activeMs": 1000, "telegraphMs": 600, "steamHeight": 96, "width": 32, "phaseOffset": 1000 } },
    { "type": "chestnut", "x": 150, "y": 200, "params": { "amount": 5 } },
    { "type": "chestnut", "x": 520, "y": 200, "params": { "amount": 5 } },
    { "type": "chestnut", "x": 920, "y": 200, "params": { "amount": 5 } },
    { "type": "checkpoint", "x": 832, "y": 176 },
    { "type": "checkpoint", "x": 1056, "y": 176 },
    { "type": "checkpoint", "x": 1376, "y": 176 },
    { "type": "coin", "x": 160, "y": 200 },
    { "type": "coin", "x": 288, "y": 200 },
    { "type": "coin", "x": 672, "y": 200 },
    { "type": "coin", "x": 800, "y": 200 },
    { "type": "coin", "x": 864, "y": 200 },
    { "type": "coin", "x": 992, "y": 200 },
    { "type": "coin", "x": 1296, "y": 200 },
    { "type": "coin", "x": 1328, "y": 200 },
    { "type": "coin", "x": 1600, "y": 200 },
    { "type": "coin", "x": 1648, "y": 200 },
    { "type": "coin", "x": 480, "y": 150 },
    { "type": "coin", "x": 608, "y": 150 },
    { "type": "coin", "x": 768, "y": 150 },
    { "type": "coin", "x": 928, "y": 150 },
    { "type": "coin", "x": 1024, "y": 150 },
    { "type": "coin", "x": 1088, "y": 80 },
    { "type": "coin", "x": 1344, "y": 80 },
    { "type": "coin", "x": 1408, "y": 150 },
    { "type": "seed", "x": 320, "y": 200, "seedId": "seed_01" },
    { "type": "seed", "x": 544, "y": 200, "seedId": "seed_02" },
    { "type": "seed", "x": 896, "y": 200, "seedId": "seed_03" },
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
    "name": "《霓街穿行》",
    "theme": "street",
    "parTimeMs": 48000
  }
}
```

*说明（对工程的提醒，非阻塞）*：
1. vehicle/manhole 为新增 entity 类型，须先落 A2/A3/A4/A5（联合类型 + AI）方可被 `createEnemies` 识别；在落地前加载本 JSON，二者将被白名单跳过（不渲染），属已知前置。
2. 本 JSON `beat.enabled:false` 且**无** `beatPlatforms`（bp_street 默认关，待主理人拍板 Q3）；若启用，按 §7 候选位置补 `beatPlatforms[]` + `beat.tracks[]`。
3. 坐标语义：(a) 地面敌 y=200 即 bbox 顶、底贴地 224；(b) vehicle y=192 即 bbox 顶、底 224 贴地，沿固定 y 水平往返；(c) manhole y=224 即盖面（地面顶），蒸汽危险列在其上方 `[y-steamHeight, y]`。

*本文件为 1-6 街主题关卡内容设计稿（加法），roadmap 批次 3；未修改现有 GDD / `src/` / `assets`；未 git commit。待主理人（游承峰）审批后由 engineering-lead 与 art-director 分别落地（A1–A8）。*

---

## 附录 D · 联合类型增量（供 engineering 落地）

- **`LevelTheme`** 增 `'street'`：
  `| 'grass' | 'cave' | 'mountain' | 'vine_forest' | 'storm_sky' | 'sea' | 'desert' | 'home' | 'street'`。未知回退 `'grass'`（theme-system R6）。
- **`EnemyEntityType`** 增 `'vehicle'` / `'manhole'`：
  `| ... | 'pet' | 'toy' | 'vehicle' | 'manhole'`。`createEnemies` 白名单同步加二项（若未加，加载期将被跳过、不渲染——属已知落地前置）。
- **不新增 `TileKind`**：manhole 盖可踩由既有地面 solid 满足；vehicle 为移动实体，非 tile。street 无 sofa/table/cabinet 类地形 tile kind。
