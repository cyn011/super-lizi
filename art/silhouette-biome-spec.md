# 剪影 biome 美术规格（silhouette / 2-4「剪影回廊」）

> 上游依据：`design/levels/2-4-content-spec.md` §6（theme=`silhouette`）｜`design/gdd/16-dufu-silhouette-enemy.md` §7.3/§7.4（暗色剪影 + 暖黄发光边）｜`src/game/render/theme-palette.ts`（已 live 的 `SILHOUETTE` entry）｜`src/game/scenes/game-scene.ts`（`drawSilhouetteBackground` / `drawSilhouetteLamps` 已 live）｜`art/art-bible.md` §3·§9｜`art/asset-spec.md` §2。
>
> **红线**：锁色板 ≤64 色、COLOR DELTA = 0 新增色（仅复用 11 色锁色板，派生色由运行时 tint 生成）；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。本文件为**已落地** biome 的权威规格（代码已 live），供后续剪影关复用与 reconcile。

---

## 1. 概述

`silhouette` 是 2-4「剪影回廊」的**专属主题**（非复用 `vine_forest`）。视觉意图是「逆光辉廊」：

- **亮背景托暗剪影**——明亮天空（逆光）作底，使暗蓝廊柱、地形、以及 `du_fu_silhouette` 暗色敌人形成高对比剪影。
- 暖黄廊灯作为逆光中的「光点焦点」，呼应剪影敌的暖黄发光边（GDD16 §7.3），强化「明—暗—明」的视觉层次。

原 2-4 设计曾复用 `vine_forest`，但 `vine_forest` 无专属背景函数、只会平涂天蓝 + 绿块，读不出「剪影」身份；故独立出 `silhouette` 主题，双方均 0 新增色。

---

## 2. 视觉意图（逆光辉廊分层）

五层视差（`drawSilhouetteBackground`，全部锁色板 / tint 派生，0 新增 hex）：

| 层 | scrollFactor | depth | 内容 | 颜色（锁色板来源） |
|---|---|---|---|---|
| sky | 0 | -10 | 逆光竖直渐变：上 `天空 #5BC8F5` → 下 `暖黄 #FFD23F`（地平线逆光） | #11 / #4 |
| far | 0.3 | -9 | 远景暗剪影丘（圆拱起伏） | #254060（darken(#4A78C0,0.5) 派生） |
| mid | 0.6 | -8 | 中景廊柱剪影（上窄下宽 + 三角冠）+ 暖黄灯座 | #1C2E49（darken(#4A78C0,0.38) 派生）/ 灯座 #FFD23F |
| game | 1.0 | 0 | 地形实心/单向瓦片（由 `pal.rockFace`/`rockBody` 读色，暗蓝剪影） | 见 §6 |
| near | 1.2 | 4 | 前景暗蓝草/枝剪影（静态装饰，不挡角色） | #1C2E49 |
| lamp | 0.6 | -7 | 暖黄脉冲光晕（每帧重绘，≤2Hz，Reduce Motion 冻结为稳态） | #FFD23F |

> 关卡地形瓦片（非 grass/非 mountain）走通用分支：`solid`=`pal.rockFace` 暗蓝实心 + 1px `pal.outline`；`oneway`=`pal.rockBody` 暗面半高 + 1px 描边。故地形天然呈现为暗剪影。

---

## 3. 可访问性红线（art-bible §3.3 / GDD16 §7.4）

- **背景必须亮**：逆光天空（#5BC8F5）+ 地平线暖黄（#FFD23F）保证暗剪影（廊柱/地形/`du_fu_silhouette`）与背景亮度对比 ≥3:1。
- **剪影敌双编码**：`du_fu_silhouette` 已有「暗色 + 暖黄发光边 + 反向翅 + 镜像动效」四重区分（GDD16 §7.4）；在亮天空与暗地形上均高对比可辨。
- 若未来改暗背景（如 cave 复用），须靠暖黄发光边托底，否则违反本红线。

---

## 4. 锁色板映射（敌人 / 装饰）

| 元素 | 颜色 | 锁色板来源 |
|---|---|---|
| 廊柱 / 前景草影 / 地形暗面 | `#1C2E49` | darken(#4A78C0,0.38) 派生（0 新增） |
| 远景丘 / 地形主面 | `#254060` | darken(#4A78C0,0.5) 派生（0 新增） |
| 廊灯辉光 / 凯旋之门核心 | `#FFD23F` | 暖黄 #4 |
| 逆光天空 | `#5BC8F5` | 天空 #11 |
| 描边 / 地形轮廓 | `#2A1A12` | 描边 #5 |
| 辉光（备用） | `#6E7BF2` | 蓝紫 #9 |
| 危险双编码 | `#E8483B` | 警示红 #7 |

> 11 色锁色板未含 `#1C2E49`/`#254060`，但它们是 `#4A78C0`（锁色板 #10）的运行时 darken tint，按 ADR-004 不计入新增 hex。

---

## 6. 八槽权威映射（解析器应消费的颜色常量 + hex）

> 复用既有 `ThemePalette` 接口 8 字段（`bg`/`rockFace`/`rockBody`/`outline`/`firelight`/`crystalCore`/`crystalGlow`/`danger`），**仅 add 一个 `silhouette` entry**，不改动接口。下表为注册数据（与 `theme-palette.ts` `SILHOUETTE` 一致）：

| 引擎字段 | silhouette Hex | 锁色板来源 |
|---|---|---|
| `bg` | `0x5BC8F5` | 天空 #11（逆光基底；天空渐变上色） |
| `rockFace` | `0x254060` | darken(#4A78C0,0.5) 派生（地形主面/廊柱投影） |
| `rockBody` | `0x1C2E49` | darken(#4A78C0,0.38) 派生（单向平台/最深剪影） |
| `outline` | `0x2A1A12` | 描边 #5 |
| `firelight` | `0xFFD23F` | 暖黄 #4（廊灯辉光 / 天空渐变下色） |
| `crystalCore` | `0xFFD23F` | 暖黄 #4（凯旋之门核心） |
| `crystalGlow` | `0x6E7BF2` | 蓝紫 #9 |
| `danger` | `0xE8483B` | 警示红 #7 |

---

## 8. 解析器消费点 + 契约要点

| 消费点 | 取值 |
|---|---|
| `drawLevel` 派发 | `metadata.theme === 'silhouette'` → `drawSilhouetteBackground(pal)`；从平涂兜底中排除（天空由渐变层绘制） |
| 地形填充 | 通用分支读 `pal.rockFace`(`#254060`) / `pal.rockBody`(`#1C2E49`) + `pal.outline` |
| 逆光天空 | `drawSilhouetteBackground` 用 `fillGradientStyle(#5BC8F5,#5BC8F5,#FFD23F,#FFD23F)`（= `pal.bg` 上 / `pal.firelight` 下） |
| 廊灯脉冲 | `drawSilhouetteLamps` 每帧重绘，`silhouetteLampPhase` 由 `update` 按 ≤2Hz 推进（Reduce Motion 冻结） |
| 凯旋之门 | 读 `pal.crystalCore`(`#FFD23F`) |

**契约要点**：

- **字段**：`LevelData.metadata.theme: 'grass' | ... | 'office' | 'silhouette'`（联合类型已含，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES['silhouette']` 的 8 字段。
- **映射**：bg=`#5BC8F5`、rockFace=`#254060`、rockBody=`#1C2E49`、outline=`#2A1A12`、firelight=`#FFD23F`、crystalCore=`#FFD23F`、crystalGlow=`#6E7BF2`、danger=`#E8483B`；暗面由 `#4A78C0` 运行时 tint（0 新增）。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为剪影 biome 美术规格（已落地）：代码在 `theme-palette.ts`（`SILHOUETTE`）、`game-scene.ts`（`drawSilhouetteBackground` / `drawSilhouetteLamps`）、`2-4.json`（`theme:"silhouette"`）已 live；未修改其它 GDD / 资产文档；未 git commit。*
