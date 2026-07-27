# 关卡设计稿 · 1-5《归巢》（家主题 · home）

> 文档类型：关卡内容设计稿（GDD 级，加法扩展）｜roadmap 批次 3 · 第二个主题：家 1-5（高）
> 作者：文策渊（design-strategist）
> 上游依据：`design/gdd/theme-system.md` §4.1（home 行：urban_indoor family；4 通用敌 + **pet** 宠物(地面巡逻·不可踩·友好碰撞→伤) + **家具即地形**(沙发/桌/柜=solid/可踩平台) + **toy** 玩具/拖鞋(小 hazard)；deco_rug/deco_frame）｜`art/home-biome-spec.md`（§1.2 家 8 槽调色板 / §3 pet 视觉 / §4 toy+家具视觉 / §8 契约）｜`src/config/levels/1-4.json`（沙漠 1-4 JSON Schema 参考）｜`design/gdd/level-1-4-design.md`（结构与落地方式照抄）
> **红线**：沿用现有 `LevelData` Schema（tileSize=32、height=9）；零位图（ADR-004，纯 Graphics + 系统字体 + tint）；11 色锁色板（仅引用 biome 规格既有色语义，0 新增 hex）；MVP 全程序化占位；IP 全原创、禁任天堂符号。
> **本文件只写设计稿，不写/改任何 `.ts` 源码，不 git commit。** 标记为「⚙️ 需工程」的项为对 `LevelData` / 引擎的建议扩展，提交 engineering-lead 落地。

---

## 1. 关卡概述

| 项 | 值 |
|---|---|
| 关卡 id | `1-5` |
| 关名（建议） | **《归巢》**（备选：《屋檐之下》《榻上小憩》《温馨一隅》） |
| 主题 theme | `home`（新增 palette，见 `art/home-biome-spec.md` §1.2 权威 8 槽：暖棕墙 + 暖橙木地板 + 暖黄灯晕） |
| 在世界 1 的位置 | 第 5 关，紧接 1-4 `desert`（灼沙绿洲）之后，作为世界 1 室内主题的「日常生活幻想」收尾关 |
| 难度定位 | **与 1-4 同量级、略增维度（更偏向垂直家具腾挪而非死亡率）**；承接 1-4 之后的波浪难度——1-4 是「流沙触底即死压力峰」，1-5 转为「家具即地形 · 垂直平台 + 宠物碰撞致伤的温和压力峰」，靠家具可踩平台 + 检查点拉回公平区 |
| 设计支柱对齐 | P1 跳（踩 ci_li/du_fu + **踩家具上高台**）｜P2 闯（**避宠物** timing + 玩具小 hazard 规避）｜P3 蜕变（保留 seed 实体） |

**定位理由**：world 1 难度曲线 = 1-1 草原教学 → 1-2 山川（落石/gu_bao）→ 1-3 海（潮汐软伤害）→ 1-4 沙漠（流沙致死）→ **1-5 家（家具地形化 · 宠物致伤 · 温和收尾）**。家只叠加 **1 个新地形范式（家具即地形：沙发/桌/柜可踩/实心）** + **1 个新敌（pet 宠物）** + **1 个新小 hazard（toy 玩具）**，符合 theme-system §2.3「每主题只叠加 1–2 个新机制，不造成认知过载」。1-5 用「垂直家具平台」替代「水平流沙宽度」制造挑战，死亡率更低（pet 仅扣血不致死、toy 为小 hazard），是 world 1 的「安心收束」而非「煎熬峰」。

---

## 2. 关卡结构与尺寸

| 参数 | 1-5 建议 | 对照 1-4 |
|---|---|---|
| `tileSize` | 32 | 32 |
| `width`（瓦片） | **54**（世界宽 = 1728px，与 1-4 同量级） | 54 |
| `height`（瓦片） | 9（=288px，逻辑分辨率） | 9 |
| 地面 | ty=7,8 全宽实心（tx 0..53） | 同 |
| 左右墙 | tx=0 与 tx=53 的 ty 0..6 实心（防越界） | 同 |
| 家具地形 | 见 §4 与附录 C（`sofa`/`table`/`cabinet` 瓦片叠加在地面上） | 无（沙漠为 `quicksand` 区域，本关不采用） |

**布局分区（左→右，按家具地形编排垂直度）**

| 区段 | tx 区间 | 内容 | 家具地形 |
|---|---|---|---|
| 引导段 | 1..11 | 平地 + 4 通用敌引入 + 首批币/种 + 首颗栗子 | 无（纯净教学） |
| **F1 家具教学** | 12..21 | 首张沙发 `sofa` 教「踩家具上高台」→ 桌面 `table`(oneway) 高路线 → 第二张沙发落地；首颗 toy 作小 hazard 前摇 | **sofa×2 + table×1** |
| 过渡段 | 22..32 | 首只 `pet`(720) 作新敌教学（避碰撞）+ 柜 `cabinet`(25,26) 挡路须跳上顶；cp1 | **cabinet×1 + table×1** |
| **F2 挑战攀爬** | 33..46 | 沙发+柜组合垂直攀爬：3 格高柜 `cabinet`(38) 须借沙发 `sofa`(36) 踏脚翻越；pet×2 + toy×2 走廊；cp2 在爬前、cp3 在爬后 | **sofa×3 + cabinet×1 + table×1** |
| 收尾段 | 47..53 | 末批币/种 + 末敌 + 凯旋之门 | 无 |

**平台 / 家具清单（tile 坐标，碰撞语义见 §4）**

| 家具 | tx 范围 | ty | kind | 顶面世界 Y | 用途 |
|---|---|---|---|---|---|
| sofa s1 | 12 | 6 | `sofa` | 192 | F1 首教学：跳上顶拿高币/种 |
| table t1 | 17 | 5 | `table`(oneway) | 160 | F1 高路线桌面（从下可穿、从顶可踩） |
| sofa s2 | 20 | 6 | `sofa` | 192 | F1 落地缓冲 |
| cabinet c1 | 25,26 | 5,6 | `cabinet` | 160 | 过渡段 2 格高障碍，须跳上顶或绕 |
| table t2 | 30 | 4 | `table`(oneway) | 128 | 中段高奖励路线（上方 seed） |
| sofa s3 | 33 | 6 | `sofa` | 192 | F2 攀爬前缓冲 |
| sofa s4 | 36 | 6 | `sofa` | 192 | F2 踏脚：借它翻越 c2 |
| cabinet c2 | 38 | 4,5,6 | `cabinet` | 128 | F2 3 格高主障碍（家具地形核心挑战） |
| table t3 | 43 | 5 | `table`(oneway) | 160 | F2 收尾高路线 |
| sofa s5 | 46 | 6 | `sofa` | 192 | F2 收尾缓冲 |

**检查点**：3 个（沿用 1-4 写法，顶层 `checkpoints:[]` 保持空、检查点以 `type:"checkpoint"` 实体声明）：

| 检查点 | x | y | 位置说明 |
|---|---|---|---|
| cp1 | 832 | 176 | F1 之后、首 pet(720) 之后、c1 之前 |
| cp2 | 1056 | 176 | F2 攀爬（c2）之前缓冲 |
| cp3 | 1376 | 176 | F2 攀爬之后、收尾段前 |

**凯旋之门（终点）**：`goal.type="triumph_gate"`，`x=1664`、`y=160`、`w=32`、`h=64`（与 1-1/1-2/1-3/1-4 同款终点锚点）。
**出生点**：`spawn={x:64,y:190}`（与 1-1..1-4 同款）。

---

## 3. 敌人配置清单

### 3.1 四通用敌全覆盖（跨主题恒含，按 theme-system §4.1 base4）

| 敌种 | 可踩 | 数量 | 典型 x,y | 说明 |
|---|---|---|---|---|
| `ci_li` 刺栗 | 是 | 3 | 256,200 ／ 864,200 ／ 1408,200 | 地面圆球红刺，踩踏弹跳 |
| `chong_feng` 锥冲 | 否 | 2 | 416,200 ／ 1184,200 | 地面楔形硬顶，需跳避 |
| `du_fu` 嘟浮 | 是 | 2 | 400,120 ／ 1000,120 | 空中蓝紫实心扁圆，踩踏（家暖底加 `暖黄 #FFD23F` 肚皮斑维持辨识，见 home-biome-spec §4.3） |
| `shi_pao` 石炮 | 否 | 2 | 832,100 ／ 1472,100 | 冷蓝方块炮口，关卡中后段 |

> **家换皮命名（视觉仅，引擎 `type` 键不变，对齐 `art/home-biome-spec.md` §4.3）**：四通用敌沿用既有 `type` 键，仅外观换家皮（暖橙木底 + `描边 #2A1A12` + 功能色维持辨识；du_fu 加 `暖黄 #FFD23F` 肚皮斑提升反差）。关卡数据 `entities[].type` 仍写原键，美术按 biome-spec 映射绘制，**零引擎改动**。

### 3.2 专属敌 · 宠物 `pet`（home 专属，⚙️ 需工程：新敌 AI）

- **数量**：**4**（F1 末首现 1 只作教学，过渡段 1 只，F2 攀爬走廊 2 只作压力）。
- **外观**（权威，`art/home-biome-spec.md` §3）：bbox 36×28 矮圆四足 + 两小耳，暖橙 `#F2933C` 主体 + 暖黄 `#FFD23F` 耳点缀 + `darken(#F2933C,0.5)`≈`#79491E` 暗部 + `天空 #5BC8F5` 眼点 + `描边 #2A1A12`；颈部小铃（警示红 `#E8483B` 圆点）作「非安全」微弱双编码提示。**soft 外观（圆润友好）但碰撞=致伤**。
- **行为**：地面巡逻（x 小幅往返），**不可踩（hard 顶语义）**；接触玩家 = 伤害（**扣 1 级 + 无敌帧，复用 07 伤害系统**），**非致死**（"友好但碰撞致伤"）。
- **首现教学**：F1 末首 pet(720) 前方留空地，玩家先见「矮圆摇摇摆 + 红铃」再接近，降低突袭不公平感；与通用不可踩敌（chong_feng/shi_pao）区分在于 pet 是「碰一下掉血而非踩踏击杀」——**禁止踩**（踩 pet 仍受伤，玩家须闪避而非踩）。
- **坐标草案**：pet(720,200) 教学 ／ pet(960,200) 过渡 ／ pet(1100,200) F2 爬前 ／ pet(1280,200) F2 爬后走廊。

### 3.3 专属小 hazard · 玩具/拖鞋 `toy`（home 专属，⚙️ 需工程：新 hazard 类型）

- **数量**：**4**（贴地小方块/球，接触伤害）。
- **外观**（`art/home-biome-spec.md` §4.1）：bbox 20×16 小方块/球，`经济金 #F2C94C` 主体 + `警示红 #E8483B` 尖角描边（硬顶+红 = 不可踩双编码）+ `描边`；**不可踩，接触=伤害（小 hazard，扣 1 级 + 无敌帧，复用 07）**。
- **玩法角色**：地面「须跳越」的小障碍，制造节奏断点；区别于 pet（会移动巡逻），toy **静止贴地**，更像可跳的微型路障。
- **坐标草案**：toy(600,200) ／ toy(800,200) ／ toy(1024,200) ／ toy(1360,200)。

---

## 4. 关键机制说明（home 与沙漠的核心差异）

> 本章明确 home 的三处机制表达。前两处（pet / toy）为新 entity 类型（需新 AI / hazard 注册）；第三处（家具即地形）为**对 `LevelData` 的扩展建议**，给出倾向方案并标注 ⚙️ 需工程。

### 4.1 家具即地形（⚙️ 需工程：扩展 tile `kind`，倾向方案见下）

**核心定义**：沙发/桌/柜不是装饰，而是**参与碰撞的地形**——玩家可站上沙发/桌面获得高度、须跳上柜顶或绕开柜。它与沙漠 `quicksand`（区域 hazard）本质不同：家具是**固态可站地形**，提供「垂直腾挪」而非「致死下陷」。

**倾向提案（推荐 · tile-kind 方案，复用既有碰撞体系）**：
在 `LevelData.tiles[]` 的 `kind` 枚举中扩展三种家具 kind，**映射复用既有碰撞语义**，渲染层仅加一个换皮分支：

| 家具 kind | 碰撞语义（复用） | 典型放置 | 玩法 |
|---|---|---|---|
| `sofa` 沙发 | = `solid`（全 AABB 实心，顶面可踩） | 1–2 格矮块（如 ty6） | 跳上顶获高度；侧面试图穿过被挡（实心） |
| `table` 桌 | = `oneway`（仅顶面可踩，从下/侧可穿透） | 1 格厚桌面（如 ty5） | 桌面平台，可从下方跳穿、从顶落脚 |
| `cabinet` 柜 | = `solid`（全 AABB 实心） | 2–3 格高障碍（如 ty4,5,6） | 挡路障碍，须跳上顶或绕开 |

- **碰撞/可踩语义明确**：
  - `sofa`：顶面 soft（可踩、可站、可起跳），四壁与底面 solid（不可穿）。即「矮实心平台」，玩家踩其顶=获得 1–2 格高度（如 s1 顶 y=192），用于够到高处的币/种或越过后方障碍。
  - `table`：oneway 语义——玩家从下方跳起可穿过桌面、从上方落下时落于桌面（顶 y=160/128），适用于「高路线奖励平台」而不阻断地面通行（如 t1/t2/t3）。
  - `cabinet`：纯 solid 高障碍——玩家不能穿过，必须跳上其顶（如 c2 顶 y=128）翻越，或借邻近 `sofa` 踏脚（如 s4→c2）。柜的存在制造「垂直断点」。
- **为何选 tile-kind 而非 entity**：`tiles[]` 已有完整 solid/oneway 碰撞求解；家具若作为 tile kind 仅需把 `sofa/cabinet` 映射到 `solid` 碰撞、`table` 映射到 `oneway` 碰撞，**零新碰撞代码**，仅渲染层 `drawTerrain` 增加家具视觉分支（暖橙 tint + 沙发垫/桌面/柜门绘形，对齐 home-biome-spec §2「换色不换形」）。**备选（不推荐）**：以 entity 形式 `sofa/table/cabinet` 由引擎当 solid/oneway 处理——需为新 entity 接入 AABB 碰撞体系，工作量大且不复用 tiles 碰撞，故不采用。
- **⚙️ 需工程落地项**：
  1. 扩展 `TileKind` 联合类型加 `sofa`/`table`/`cabinet`，并映射到 solid/oneway 碰撞（碰撞逻辑零改，仅 kind→碰撞映射表加项）。
  2. `drawTerrain` 增加家具视觉分支（消费 `THEME_PALETTES['home']` 的 rockFace/rockBody tint + home-biome-spec §2 家具绘形）。
  3. `LevelTheme` 联合类型增 `'home'`（未知回退 `'grass'`，theme-system R6 / home-biome-spec §8.1）。
- **公平性**：所有家具高度 ≤3 格（cabinet c2 顶 y=128，距地面 96px≈3 格，在玩家跳跃能力内，见 1-4 du_fu 置于 y=120 即 104px 高）；并配 `sofa` 踏脚（s4）降低 c2 翻越难度，守公平。

### 4.2 宠物 `pet`（见 §3.2）

地面巡逻、硬顶不可踩、接触=扣 1 级 + 无敌帧（复用 07），**非致死**。属「友好但碰撞致伤」新型温和压力，区别于沙漠 scorpion（同样不可踩但属致死流沙关的硬威胁）。⚙️ 需工程：新敌 AI（巡逻 + 不可踩碰撞 + 接触伤害回调），视觉走 `pet-view` 分支（home-biome-spec §8.3）。

### 4.3 玩具 `toy`（见 §3.3）

静止贴地小 hazard，不可踩，接触=扣 1 级 + 无敌帧（复用 07）。属微型路障，制造跳越节奏。⚙️ 需工程：新 hazard 类型注册（可复用现有 hazard 碰撞家族，仅新增 `toy` 视觉 + 伤害回调）。

### 4.4 与 1-4 的复用 / 差异说明（核心）

- **复用（全部沿用，不新增引擎机制种类）**：4 通用敌组、coin/seed/chestnut 经济规模、checkpoint×3 写法、`triumph_gate` 终点、`spawn`、beat/bpm=120/grid=8 节拍框架、`width=54/height=9/tileSize=32` 尺寸。
- **差异（制造新鲜感尖峰）**：
  1. 用 **家具即地形（`sofa`/`table`/`cabinet` tile kind）取代 `quicksand`**——水平致死流沙 → 垂直可踩家具平台，难度维度从「死亡率」转为「空间腾挪」。
  2. 新敌 `pet`（地面不可踩、碰撞致伤、非致死、温和）。
  3. 新小 hazard `toy`（静止贴地、跳越）。
  4. 调色板整体换为 home 暖棕墙 + 暖橙木地板 8 槽（`art/home-biome-spec.md` §1.2）。
  5. 装饰层换 `deco_rug`/`deco_frame`/`deco_plant`（`home-biome-spec.md` §2）。
- **不新增引擎机制种类（守 MVP）**：家具 = tiles 体系内 solid/oneway 映射（仅 kind 枚举扩展，碰撞零改）；pet/toy 为既有「敌/ hazard + 07 伤害」数据驱动的新子类。本关**不含** `quicksand`/`tide` 字段。

---

## 5. 障碍 / 陷阱协同

### 5.1 家具与宠物的协同
- F2 攀爬段：cabinet c2(38) 与 sofa s4(36) 形成「踏脚→翻越」组合；pet(1100)/(1280) 布在攀爬走廊两侧，逼迫「跳家具→落地空隙→避 pet」的时序决策。
- table t2(30)/t3(43) 高路线既奖励跳跃，也提供「从上方绕过地面 pet/toy」的备选线，制造路线自主权（服务自主 Autonomy）。

### 5.2 与四通用敌的协同
- F1 家具教学段内不放置地面通用敌（纯净教学家具动词）；过渡段后 chong_feng(1184)/shi_pao(832,1472) 置于非家具段高台，构成「上岸喘息」缓冲（对齐 1-3/1-4 节奏缓冲）。
- ci_li(864,1408) 作可踩弹跳点，配合家具顶高路线形成「踩敌+踩家具」双重起跳。

### 5.3 与 1-4 的复用 / 差异（汇总，详见 §4.4）
家具地形（垂直）取代流沙（水平致死）；pet/toy 取代 scorpion/cactus 的「致死威胁」为「温和致伤」；palette 由沙漠暖橙沙岩 → 家暖棕墙木地板。整体 world 1 以「家」作安心收束。

---

## 6. 种子 / 币种（保留 seed 蜕变成长系统）

沿用 1-2/1-3/1-4 经济规模（守跨关经济一致，防失衡）：

| 类型 | 数量 | 说明 |
|---|---|---|
| `coin` 金币 | **18** | 沿路 + 家具顶高路线奖励（s1/t1/s2/c2 顶上方均有币，奖励踩家具） |
| `seed` 种子 | **6**（`seed_01`..`seed_06`） | 保留 P3 蜕变；2 颗置于 F2 高路线（奖励「攀爬家具」策略） |
| `chestnut` 栗子（弹药） | **3**（各 `amount:5`） | x=150 / 520 / 920，y=200；供扔栗子系统补给 |

**坐标草案**：见附录 C JSON（coin×18 / seed×6 / chestnut×3 已展开；部分币/种置于家具顶上方作垂直奖励）。

---

## 7. 节拍段（可选 · 家具节拍平台 `bp_home`）

沿用 1-3/1-4 的 BeatDrivenSystem（`beat.enabled:true` + `beatPlatforms[]`，契约见 `design/beat/beat-schema.md`）。

- **`bp_home`**：tiles `tx 33,34 @ ty=3`（F2 攀爬段上方、c2 之顶的高补充路线），`initial:"solid"`，作为**补充高路线**（非主路径；主路径用「s4→c2 翻越」）。
- **track**：`{ "target":"bp_home", "pattern":"SSSGGG" }`（相位 ~1.33Hz，安全无频闪）。
- **bpm/grid**：`bpm:120`、`grid:8`（与 1-1..1-4 一致）。
- **⚠️ 心流保护**：`bp_home` 为**补充**性质（主路不依赖它）。若 QA 实测家具攀爬 + 节拍叠加致认知过载/parTime 崩，建议初版 `beat.enabled:false` 仅留 `bp_home` 常显实体，或整体延后。主理人拍板。

---

## 8. parTime 建议值

| 关卡 | parTimeMs | 备注 |
|---|---|---|
| 1-1 | 60000 | 占位 |
| 1-2 | 84000 | 占位 |
| 1-3 | 96000 | 占位 |
| 1-4 | 102000 | 占位 |
| **1-5** | **108000**（建议区间 102000–114000） | **初版占位，待 QA 真机调校**（垂直家具攀爬略增耗时 + 宽度同量级） |

> 标注「待 QA 调校」：家具攀爬须玩家规划落点 / 借踏脚，parTime 应比线性长度直觉略宽松；最终以 playtest 中位通关时间 × 系数收敛。

---

## 9. 难度曲线与 MDA 对齐

### 9.1 与 1-4 的差异点
- 1-4：流沙**触底即死**，机制压力峰（死亡率高）。1-5：家具**可踩地形 + 宠物致伤（非致死）**，机制温和峰——惩罚从「死亡 respawn」降为「掉 1 级 + 无敌帧」，靠家具可踩平台 + 3 检查点守住公平，是 world 1 的「安心收束」。
- 难度「维度不同而非更重」：1-5 挑战来自**垂直空间规划**（踩家具上高台、翻越柜），而非 1-4 的「水平致死 timing」；被 **3 检查点 + 家具踏脚 + 非致死 pet/toy** 拉回公平区。

### 9.2 SDT 三大需求 + 心流（对齐 theme-system §2.3 / 概念文档 §3）
- **自主 Autonomy**：家具提供多路线——地面直跑线 vs 家具顶高路线（拿币/种奖励）；pet/toy 踩/避自选；扔栗子仍可清敌。
- **胜任 Competence**：单一新地形范式（家具即地形）渐进引入（F1 教学沙发→桌面 → F2 柜攀爬）；所有危险**双编码 telegraph**（pet 红铃、toy 红尖角、柜 solid 形态），即时反馈持续「我能行」。
- **关联 Relatedness**：家靠 8 槽暖棕墙 + 暖橙木地板 + 暖黄灯晕 + 草绿盆栽制造「安心日常」旅程感与可共鸣幻想（微信炫耀「我通关了家」更易触发）；grass→…→desert→home 跨主题凝聚力。
- **心流 Flow**：家引入 = 一次「新鲜感尖峰」（室内暖调 vs 前关沙漠炽热）；仅 1 新地形范式 + 1 新敌 + 1 新小 hazard → **不认知过载**。

### 9.3 设计理论红线自检（无违规）
- **无主导策略**：地面线 / 家具顶高路线双解；table 高路线提供绕开地面 pet 的备选。
- **无经济失衡**：币/种/弹药规模与 1-4 持平（18 币 / 6 种 / 3 弹药）。
- **无认知过载**：仅 1 新地形范式（家具）+ 1 新敌（pet）+ 1 新小 hazard（toy）；bp_home 可关。
- **无支柱漂移**：P1 跳（踩敌/踩家具）、P2 闯（避 pet/toy timing）、P3 蜕变（seed）全服务。

---

## 10. 进度链（nextLevelId 衔接）

- 现有 `LEVEL_ORDER = ['1-1','1-2','1-3','1-4','2-1','2-2','2-3','2-4']`（含 1-4 已插入）。
- **⚙️ 注册建议**（工程落地时改 `src/core/config/index.ts`，本设计稿不碰 src）：插入 `'1-5'` 于 `'1-4'` 之后 →
  `LEVEL_ORDER = ['1-1','1-2','1-3','1-4','1-5','2-1','2-2','2-3','2-4']`。
- 纯函数 `nextLevelId(LEVEL_ORDER, '1-5')` → **`'2-1'`**（沿用现有 `src/core/level/level-order.ts`，零改）。
- 1-5 自身 JSON 的 `metadata.nextLevelId` **无需字段**（由 `LEVEL_ORDER` 推导，一致于 1-1..1-4）。
- 末关判定：1-5 非末关（后面有 2-1…），结算页「下一关」正常出现并加载 2-1。

---

## 附录 A · 落地依赖清单（⚙️ 需工程 / art）

| # | 项 | 归属 | 状态 |
|---|---|---|---|
| A1 | `theme-palette.ts` 注册 `home` 8 槽（home-biome-spec §8.2：bg=`0x6B4220` / rockFace=`0xF2933C` / rockBody=`0x79491E` / out-line=`0x2A1A12` / firelight=`0xFFD23F` / crystalCore=`0xFFD23F` / crystalGlow=`0x7CC242` / danger=`0xE8483B`） | art→eng | 契约已就绪，待注册 |
| A2 | `LevelTheme` 联合类型增 `'home'`（未知回退 `'grass'`） | eng | theme-system R6 / home-biome-spec §8.1 |
| A3 | `TileKind` 联合类型增 `sofa`/`table`/`cabinet`，并映射到 solid/oneway 碰撞（§4.1） | eng（碰撞零改，仅 kind→碰撞映射加项） | **家具即地形核心** |
| A4 | `drawTerrain` 增加家具视觉分支（sofa/table/cabinet 绘形 + home tint） | eng←art | home-biome-spec §2 |
| A5 | `pet` 敌 AI（地面巡逻 + 不可踩 + 接触伤害扣 1 级 + 无敌帧，复用 07，§3.2） | eng（新敌） | 视觉 spec 已就绪（home-biome-spec §3） |
| A6 | `toy` hazard 类型注册（静止贴地 + 不可踩 + 接触伤害，复用 07，§3.3） | eng（新 hazard） | 视觉 spec 已就绪（home-biome-spec §4.1） |
| A7 | `LEVEL_ORDER` 插入 `'1-5'`（§10） | eng（1 行） | 配置 |
| A8 | 1-5.json 由本设计稿坐标落地（同款 Schema，theme=`home`，不含 quicksand/tide） | eng | 内容 |
| A9 | 四通用敌 `type` 键不变、仅家换皮；pet/toy 走新增 `enemy-view`/`hazard-view` 分支（home-biome-spec §4.3 / §8.3） | art→eng | 视觉仅，零引擎改动 |

## 附录 B · 待主理人拍板

1. 关名是否用《归巢》（或备选《屋檐之下》《榻上小憩》《温馨一隅》）？
2. **家具表达方式是否采纳「tile-kind 方案」**（`sofa`/`table`/`cabinet` 扩展 `TileKind` 映射 solid/oneway，碰撞零改）？抑或主理人/工程更倾向 entity 方案（工作量更大，见 §4.1 备选）？——**设计侧倾向 tile-kind 方案**。
3. `pet` 接触伤害「扣 1 级 + 无敌帧、非致死」初版是否接受？（备选：致死 respawn——但会破坏「家=安心收束」定位，不建议）
4. `bp_home` 初版启用还是关（§7 心流保护）？
5. parTime 108000 是否接受为占位（待 QA）？
6. pet(4)/toy(4)/家具件数（sofa×5 / table×3 / cabinet×2）是否合适（待手感调校）？
7. cabinet c2 设为 3 格高（顶 y=128）是否过难？备选降为 2 格高（顶 y=160，更易翻越）。

---

## 附录 C · 1-5.json 草拟（工程可直接采用）

> 字段对齐 1-4.json：`id/version/tileSize/width/height/tiles/entities/props/checkpoints/goal/spawn/beat/beatPlatforms/metadata` 全保留；家**不含** `quicksand`/`tide`（无流沙/潮汐）。`theme` 必须为 `"home"`。entities 含 4 通用敌 + pet×4 + toy×4 + 3 检查点 + 凯旋之门；家具以 `tiles[]` 内 `kind:"sofa"/"table"/"cabinet"` 表达（§4.1 提案）。坐标与落地依赖见 §2/§3/§4。

```json
{
  "id": "1-5",
  "version": 1,
  "tileSize": 32,
  "width": 54,
  "height": 9,
  "tiles": [
    { "tx": 0, "ty": 7, "kind": "solid" },
    { "tx": 0, "ty": 8, "kind": "solid" },
    { "tx": 1, "ty": 7, "kind": "solid" },
    { "tx": 1, "ty": 8, "kind": "solid" },
    { "tx": 2, "ty": 7, "kind": "solid" },
    { "tx": 2, "ty": 8, "kind": "solid" },
    { "tx": 3, "ty": 7, "kind": "solid" },
    { "tx": 3, "ty": 8, "kind": "solid" },
    { "tx": 4, "ty": 7, "kind": "solid" },
    { "tx": 4, "ty": 8, "kind": "solid" },
    { "tx": 5, "ty": 7, "kind": "solid" },
    { "tx": 5, "ty": 8, "kind": "solid" },
    { "tx": 6, "ty": 7, "kind": "solid" },
    { "tx": 6, "ty": 8, "kind": "solid" },
    { "tx": 7, "ty": 7, "kind": "solid" },
    { "tx": 7, "ty": 8, "kind": "solid" },
    { "tx": 8, "ty": 7, "kind": "solid" },
    { "tx": 8, "ty": 8, "kind": "solid" },
    { "tx": 9, "ty": 7, "kind": "solid" },
    { "tx": 9, "ty": 8, "kind": "solid" },
    { "tx": 10, "ty": 7, "kind": "solid" },
    { "tx": 10, "ty": 8, "kind": "solid" },
    { "tx": 11, "ty": 7, "kind": "solid" },
    { "tx": 11, "ty": 8, "kind": "solid" },
    { "tx": 12, "ty": 7, "kind": "solid" },
    { "tx": 12, "ty": 8, "kind": "solid" },
    { "tx": 13, "ty": 7, "kind": "solid" },
    { "tx": 13, "ty": 8, "kind": "solid" },
    { "tx": 14, "ty": 7, "kind": "solid" },
    { "tx": 14, "ty": 8, "kind": "solid" },
    { "tx": 15, "ty": 7, "kind": "solid" },
    { "tx": 15, "ty": 8, "kind": "solid" },
    { "tx": 16, "ty": 7, "kind": "solid" },
    { "tx": 16, "ty": 8, "kind": "solid" },
    { "tx": 17, "ty": 7, "kind": "solid" },
    { "tx": 17, "ty": 8, "kind": "solid" },
    { "tx": 18, "ty": 7, "kind": "solid" },
    { "tx": 18, "ty": 8, "kind": "solid" },
    { "tx": 19, "ty": 7, "kind": "solid" },
    { "tx": 19, "ty": 8, "kind": "solid" },
    { "tx": 20, "ty": 7, "kind": "solid" },
    { "tx": 20, "ty": 8, "kind": "solid" },
    { "tx": 21, "ty": 7, "kind": "solid" },
    { "tx": 21, "ty": 8, "kind": "solid" },
    { "tx": 22, "ty": 7, "kind": "solid" },
    { "tx": 22, "ty": 8, "kind": "solid" },
    { "tx": 23, "ty": 7, "kind": "solid" },
    { "tx": 23, "ty": 8, "kind": "solid" },
    { "tx": 24, "ty": 7, "kind": "solid" },
    { "tx": 24, "ty": 8, "kind": "solid" },
    { "tx": 25, "ty": 7, "kind": "solid" },
    { "tx": 25, "ty": 8, "kind": "solid" },
    { "tx": 26, "ty": 7, "kind": "solid" },
    { "tx": 26, "ty": 8, "kind": "solid" },
    { "tx": 27, "ty": 7, "kind": "solid" },
    { "tx": 27, "ty": 8, "kind": "solid" },
    { "tx": 28, "ty": 7, "kind": "solid" },
    { "tx": 28, "ty": 8, "kind": "solid" },
    { "tx": 29, "ty": 7, "kind": "solid" },
    { "tx": 29, "ty": 8, "kind": "solid" },
    { "tx": 30, "ty": 7, "kind": "solid" },
    { "tx": 30, "ty": 8, "kind": "solid" },
    { "tx": 31, "ty": 7, "kind": "solid" },
    { "tx": 31, "ty": 8, "kind": "solid" },
    { "tx": 32, "ty": 7, "kind": "solid" },
    { "tx": 32, "ty": 8, "kind": "solid" },
    { "tx": 33, "ty": 7, "kind": "solid" },
    { "tx": 33, "ty": 8, "kind": "solid" },
    { "tx": 34, "ty": 7, "kind": "solid" },
    { "tx": 34, "ty": 8, "kind": "solid" },
    { "tx": 35, "ty": 7, "kind": "solid" },
    { "tx": 35, "ty": 8, "kind": "solid" },
    { "tx": 36, "ty": 7, "kind": "solid" },
    { "tx": 36, "ty": 8, "kind": "solid" },
    { "tx": 37, "ty": 7, "kind": "solid" },
    { "tx": 37, "ty": 8, "kind": "solid" },
    { "tx": 38, "ty": 7, "kind": "solid" },
    { "tx": 38, "ty": 8, "kind": "solid" },
    { "tx": 39, "ty": 7, "kind": "solid" },
    { "tx": 39, "ty": 8, "kind": "solid" },
    { "tx": 40, "ty": 7, "kind": "solid" },
    { "tx": 40, "ty": 8, "kind": "solid" },
    { "tx": 41, "ty": 7, "kind": "solid" },
    { "tx": 41, "ty": 8, "kind": "solid" },
    { "tx": 42, "ty": 7, "kind": "solid" },
    { "tx": 42, "ty": 8, "kind": "solid" },
    { "tx": 43, "ty": 7, "kind": "solid" },
    { "tx": 43, "ty": 8, "kind": "solid" },
    { "tx": 44, "ty": 7, "kind": "solid" },
    { "tx": 44, "ty": 8, "kind": "solid" },
    { "tx": 45, "ty": 7, "kind": "solid" },
    { "tx": 45, "ty": 8, "kind": "solid" },
    { "tx": 46, "ty": 7, "kind": "solid" },
    { "tx": 46, "ty": 8, "kind": "solid" },
    { "tx": 47, "ty": 7, "kind": "solid" },
    { "tx": 47, "ty": 8, "kind": "solid" },
    { "tx": 48, "ty": 7, "kind": "solid" },
    { "tx": 48, "ty": 8, "kind": "solid" },
    { "tx": 49, "ty": 7, "kind": "solid" },
    { "tx": 49, "ty": 8, "kind": "solid" },
    { "tx": 50, "ty": 7, "kind": "solid" },
    { "tx": 50, "ty": 8, "kind": "solid" },
    { "tx": 51, "ty": 7, "kind": "solid" },
    { "tx": 51, "ty": 8, "kind": "solid" },
    { "tx": 52, "ty": 7, "kind": "solid" },
    { "tx": 52, "ty": 8, "kind": "solid" },
    { "tx": 53, "ty": 7, "kind": "solid" },
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
    { "tx": 53, "ty": 6, "kind": "solid" },
    { "tx": 12, "ty": 6, "kind": "sofa" },
    { "tx": 17, "ty": 5, "kind": "table" },
    { "tx": 20, "ty": 6, "kind": "sofa" },
    { "tx": 25, "ty": 5, "kind": "cabinet" },
    { "tx": 25, "ty": 6, "kind": "cabinet" },
    { "tx": 26, "ty": 5, "kind": "cabinet" },
    { "tx": 26, "ty": 6, "kind": "cabinet" },
    { "tx": 30, "ty": 4, "kind": "table" },
    { "tx": 33, "ty": 6, "kind": "sofa" },
    { "tx": 36, "ty": 6, "kind": "sofa" },
    { "tx": 38, "ty": 4, "kind": "cabinet" },
    { "tx": 38, "ty": 5, "kind": "cabinet" },
    { "tx": 38, "ty": 6, "kind": "cabinet" },
    { "tx": 43, "ty": 5, "kind": "table" },
    { "tx": 46, "ty": 6, "kind": "sofa" }
  ],
  "entities": [
    { "type": "ci_li", "x": 256, "y": 200 },
    { "type": "du_fu", "x": 400, "y": 120 },
    { "type": "chong_feng", "x": 416, "y": 200 },
    { "type": "chestnut", "x": 150, "y": 200, "params": { "amount": 5 } },
    { "type": "chestnut", "x": 520, "y": 200, "params": { "amount": 5 } },
    { "type": "toy", "x": 600, "y": 200 },
    { "type": "sofa", "x": 0, "y": 0 },
    { "type": "pet", "x": 720, "y": 200 },
    { "type": "ci_li", "x": 864, "y": 200 },
    { "type": "checkpoint", "x": 832, "y": 176 },
    { "type": "shi_pao", "x": 832, "y": 100 },
    { "type": "toy", "x": 800, "y": 200 },
    { "type": "chestnut", "x": 920, "y": 200, "params": { "amount": 5 } },
    { "type": "pet", "x": 960, "y": 200 },
    { "type": "du_fu", "x": 1000, "y": 120 },
    { "type": "toy", "x": 1024, "y": 200 },
    { "type": "checkpoint", "x": 1056, "y": 176 },
    { "type": "pet", "x": 1100, "y": 200 },
    { "type": "chong_feng", "x": 1184, "y": 200 },
    { "type": "pet", "x": 1280, "y": 200 },
    { "type": "ci_li", "x": 1408, "y": 200 },
    { "type": "checkpoint", "x": 1376, "y": 176 },
    { "type": "shi_pao", "x": 1472, "y": 100 },
    { "type": "toy", "x": 1360, "y": 200 },
    { "type": "coin", "x": 200, "y": 200 },
    { "type": "coin", "x": 320, "y": 200 },
    { "type": "coin", "x": 384, "y": 150 },
    { "type": "coin", "x": 480, "y": 200 },
    { "type": "coin", "x": 544, "y": 128 },
    { "type": "coin", "x": 640, "y": 200 },
    { "type": "coin", "x": 688, "y": 192 },
    { "type": "coin", "x": 880, "y": 200 },
    { "type": "coin", "x": 960, "y": 150 },
    { "type": "coin", "x": 1024, "y": 200 },
    { "type": "coin", "x": 1100, "y": 80 },
    { "type": "coin", "x": 1184, "y": 200 },
    { "type": "coin", "x": 1216, "y": 150 },
    { "type": "coin", "x": 1280, "y": 200 },
    { "type": "coin", "x": 1344, "y": 150 },
    { "type": "coin", "x": 1408, "y": 200 },
    { "type": "coin", "x": 1472, "y": 150 },
    { "type": "coin", "x": 1504, "y": 150 },
    { "type": "coin", "x": 1568, "y": 150 },
    { "type": "seed", "x": 384, "y": 200, "seedId": "seed_01" },
    { "type": "seed", "x": 640, "y": 200, "seedId": "seed_02" },
    { "type": "seed", "x": 880, "y": 200, "seedId": "seed_03" },
    { "type": "seed", "x": 1152, "y": 80, "seedId": "seed_04" },
    { "type": "seed", "x": 1216, "y": 80, "seedId": "seed_05" },
    { "type": "seed", "x": 1440, "y": 200, "seedId": "seed_06" }
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
    "enabled": true,
    "bpm": 120,
    "grid": 8,
    "tracks": [
      {
        "target": "bp_home",
        "pattern": "SSSGGG"
      }
    ]
  },
  "beatPlatforms": [
    {
      "id": "bp_home",
      "initial": "solid",
      "tiles": [
        { "tx": 33, "ty": 3 },
        { "tx": 34, "ty": 3 }
      ]
    }
  ],
  "metadata": {
    "name": "《归巢》",
    "theme": "home",
    "parTimeMs": 108000
  }
}
```

*说明（对工程的两条提醒，非阻塞）*：
1. 家具在 `tiles[]` 中以 `kind:"sofa"/"table"/"cabinet"` 表达（§4.1 提案）；若主理人拍板改用 entity 方案，则相应 tile 删除、改放 `entities[]` 的 `sofa/table/cabinet`（见附录 B-2）。
2. 本草拟在 `entities[]` 中放了一个占位 `{ "type": "sofa", "x": 0, "y": 0 }` 仅作「家具也可 entity 化」的标记示例——**若采用 tile-kind 方案，请工程忽略/删除该行**（家具已全在 `tiles[]`）。保留它以直观展示两种表达的可切换性。

*本文件为 1-5 家主题关卡内容设计稿（加法），roadmap 批次 3；未修改现有 GDD / `src/` / `assets`；未 git commit。待主理人（游承峰）审批后由 engineering-lead 与 art-director 分别落地（A1–A9）。*
