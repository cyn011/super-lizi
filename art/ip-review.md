# super-mali · IP 资产复核清单（占位层面）— AD-S06-IP

> 任务 ID：**AD-S06-IP** ｜ 角色：art-director（林绘澄）｜ 阶段：Phase 4→5 门 **G5**
> 复核性质：**占位 Graphics 人工复核**（非最终像素）；重点 = 「造型语义不踩 IP 红线」
> 红线依据：`docs/architecture/control-list.md §3` + `art/art-bible.md §4.2/§4.3/§6/§7.2` + `art/asset-spec.md §0/§4` + `design/gdd/99-consistency-review.md §33-36`
> 约束：本报告**仅文档/复核**；未修改任何渲染代码（见 §3 风险项待主理人拍板）。

---

## 1. 复核覆盖文件范围

**运行时占位渲染（已逐行读取）**
- 主角：`src/ui/placeholder.ts`（`drawLibaoPlaceholder`）+ `src/game/scenes/game-scene.ts:699`（`drawSprite` 调用）、`:675`（`drawLevel` 含凯旋之门占位）
- 敌人：`src/game/render/enemy-view.ts`（刺栗/冲锋/嘟浮/石炮四态）
- 弹丸：`src/game/render/projectile-view.ts`
- 道具：`src/game/render/coin-view.ts`、`src/game/render/seed-view.ts`（元气果 world 占位尚未绘制，见 §5）
- 检查点：`src/game/render/checkpoint-view.ts`
- HUD：`src/ui/hud.ts`、`src/ui/hud-hearts.ts`、`src/ui/hud-economy.ts`
- 触屏钮：`src/ui/touch-buttons.ts`
- 暂停/结算：`src/ui/pause-menu.ts`、`src/ui/result-screen.ts`

**视觉定义（已读取对齐）**
- `art/art-bible.md`（v1.1）、`art/asset-spec.md`、`art/placeholder-spec.md`、`art/ui/touch-buttons-spec.md`
- `design/gdd/99-consistency-review.md`、`design/concept/00-game-concept.md`
- `docs/architecture/control-list.md §3`

**命名扫描（本任务自扫，供比对照）**：对 `src/**/*.ts`、`src/config/**`、`art/**`、`design/**` 扫描任天堂符号词（`mario/luigi/bowser/koopa/mushroom/star/pipe/flag/piranha` 等）。结果见 §3。

---

## 2. 逐项核对表（占位渲染 × 红线）

| # | 类别 | 文件 / 位置 | 当前占位造型 | 红线要求 | 结论 |
|---|---|---|---|---|---|
| 1 | 主角·栗宝 | `placeholder.ts:16` | 圆角块 24×34 + 顶部嫩芽圆点 + 朝向眼；栗色 `#B5763E`+草绿 `#7CC242` | 圆润栗形+嫩芽；无帽檐/背带裤/胡子/水管工轮廓/蘑菇头/龟壳 | ✅ PASS |
| 2 | 敌人·刺栗 `ci_li` | `enemy-view.ts:44` | 圆顶圆角块 + 双编码眼；警示红 `#E8483B`（软顶=可踩） | 圆+红+可踩；非龟壳/刺猬 | ✅ PASS |
| 3 | 敌人·冲锋 `chong_feng` | `enemy-view.ts:62` | 硬角矩形 + 朝 facing 楔形前尖；警示红 `#E8483B`（硬=不可踩） | 楔形硬角、警示红；非龟壳 | ✅ PASS |
| 4 | 敌人·嘟浮 `du_fu` | `enemy-view.ts:39`→`drawStompable` | 圆顶圆角块 + 眼；蓝紫 `#6E7BF2`（软顶=可踩） | 蓝紫 `#6E7BF2`、避增益紫 `#9B6CF2`；非星星/鸟 | ✅ PASS（见 §3.4 形状细化待办） |
| 5 | 敌人·石炮 `shi_pao` | `enemy-view.ts:89` | 方顶灰块 `#8A8A8A` + 方炮口 + 闪光 | 方+灰+炮口；非水管/炮塔符号 | ✅ PASS |
| 6 | 弹丸 `fx_projectile` | `projectile-view.ts` | 橙 `#F2994A` 圆 + 运动方向尖 | 危险弹丸，独立 hazard | ✅ PASS |
| 7 | 道具·金币 | `coin-view.ts` | 金圆 `#F2C94C` + **中心竖纹**（非星） | 圆币+形状编码；非星星符号 | ✅ PASS |
| 8 | 道具·种子 | `seed-view.ts` | 栗色种壳 `#B5763E` + 草绿双叶嫩芽 `#7CC242` | 种子（蜕变母题）；非蘑菇/星 | ✅ PASS |
| 9 | 道具·元气果（world） | 占位**尚未绘制** | —（spec 定 果实+嫩芽 增益紫 `#9B6CF2`） | 果实+嫩芽；非蘑菇/星星/火焰花 | ⚠️ 待绘（见 §5） |
| 10 | 道具·爱心（world） | 占位**尚未绘制**（HUD 心形已矢量） | —（spec 定 心形 暖粉红 `#F26D8B`） | 心形；暖粉红（非警示红） | ⚠️ 待绘（见 §5） |
| 11 | 检查点 | `checkpoint-view.ts` | 原创小石碑（圆角碑身+顶光点+底座） | 原创非旗杆标记 | ✅ PASS |
| 12 | 终点·凯旋之门 | `game-scene.ts:692` | 纯金框矩形 `fillRect`+`strokeRect`（`#F2C94C`） | 凯旋之门（**非旗杆**） | ✅ PASS（非旗杆；待绘为发光拱门，见 §5） |
| 13 | HUD·命数心形 | `hud.ts:266` | 心形（两瓣+尖）；实心粉红 `#F26D8B`/空心描边 | 心形；形状区分（非仅色）；暖粉红 | ✅ PASS |
| 14 | HUD·形态栗宝头 | `hud.ts:291` | 16×16 栗色圆角块 + 嫩芽 | 同主角，无水管工符号 | ✅ PASS |
| 15 | HUD·金币图标 | `hud.ts:358` | 金圆 + 中心竖纹 | 同 #7 | ✅ PASS |
| 16 | 触屏四钮 | `touch-buttons.ts:251` | ◀▶ 方向三角 / ▲ 跳三角 / ✦ 动作放射（纯几何） | 通用几何图标；无任天堂符号 | ✅ PASS（✦ 见 §3.5） |
| 17 | 暂停菜单 | `pause-menu.ts` | 遮罩+面板+「继续/重玩」圆角钮+系统字体 | 无符号 | ✅ PASS |
| 18 | 结算·星级 | `result-screen.ts:221` | **矢量原创菱形星（Graphics 旋转菱形）+ `rank${i}` 标识符** | art-bible §7.2 定「原创菱形星（非五角星）」 | ✅ PASS（EL-STAR-FIX 落地，见 §3.1 RESOLVED） |

**汇总**：造型语义层面 **0 例任天堂符号剪影**（无帽檐/背带裤/胡子/水管工/蘑菇/龟壳/旗杆/路易吉/库巴/碧奇花/星之道具）。原 #18 结算 ★ 已由 **EL-STAR-FIX 修复**（矢量菱形星 + rank 标识符），**G5 命名 CONCERN 关闭**。

---

## 3. 红线风险发现（命名 / 造型语义）

### 3.1 [RESOLVED] 结算星级 `★`/star 标识符 —— 已由 EL-STAR-FIX 修复
- **证据**：`src/ui/result-screen.ts:221` 用系统字体字面量 `'★'`（U+2605 五角星）作 1–3 星评级；同文件标识符 `star${i}`（:138/:227）、`COLOR_STAR_ON`、`COLOR_STAR_OFF`、`STAR_COIN_COLLECT_RATE`、`BASE_STARS_ON_CLEAR` 含 `star` 词。
- **红线比对**：
  - control-list §3 命名扫描列 `star`(道具) 为禁词——本例是**完成度评级星**而非「道具/增益星」，语义上不属 `star`(道具)；但命名扫描若为子串匹配，会命中 `result-screen.ts` 全部 `star` 标识符 → **G5「命名扫描 0 命中」存在告警风险**。
  - art-bible §7.2 已明确规定「星级评价（★ 用**原创菱形星**）」；asset-spec §4 `ui_star` 标注「原创菱形星（**非五角星 IP 符号**✅）」。占位直接用了通用五角星字形，**偏离美术圣经的 IP 安全设计意图**。
- **严重程度**：中（占位期；最终 `ui_star` 已按菱形星规格定义，故正式像素会合规；但占位若进任何截图/构建即出现五角星）。
- **修正建议（二选一，待主理人拍板）**：
  1. **推荐**：将 `result-screen.ts` 标识符 `star`→`rank`（如 `rank${i}`/`COLOR_RANK_ON`/`RANK_COIN_RATE`/`BASE_RANKS_ON_CLEAR`），并改用**矢量绘制的原创菱形星**替换 `★` 字面量（与 asset-spec §4 一致）。一步到位消除命名扫描命中 + 去除五角星。
  2. 若暂不动占位：须确认 CI 命名扫描对 `star` 的匹配**限定为「道具/增益」语义上下文**，并书面豁免评级星；同时保证最终 `ui_star` 严格为菱形星。**不推荐**（留下五角星入镜风险）。
- **本任务未改代码**；后续由 engineering-lead 以 **EL-STAR-FIX** 落地「推荐方案」：标识符 `star`→`rank`（`rank${i}`/`COLOR_RANK_ON`/`COLOR_RANK_OFF`/`RANK_COIN_COLLECT_RATE`/`BASE_RANKS_ON_CLEAR`）+ 矢量绘制的原创菱形星替换 `★` 字面量（与 asset-spec §4 一致）。**已提交，G5 命名 CONCERN 关闭，200 测试绿。**

### 3.2 [INFO] 文档中 "Mario / Super Mario Bros" 引用
- `art/art-bible.md:37`、`art/ui/touch-buttons-spec.md:90-91`、`design/concept/00-game-concept.md`、`design/ux/click-to-move-design.md:65` 出现 "Mario"。均为「仅借结构/手感，不借美术与命名」的研究/参考陈述，**非资产、非代码符号**。
- 若命名扫描覆盖 `.md` 全文会误命中。建议扫描范围**限定为源码 + 配置 + 资源清单**（control-list §3 原文即此范围），文档参考词不计入。

### 3.3 [LOW] 金币「中心星点」文案 vs 占位「中心竖纹」
- art-bible §3.2/§6.1 与 placeholder-spec §1.5 文字写「中心星点暖黄」，但 `coin-view.ts` 实际画**中心竖纹**（`fillRect` 竖条）。占位实现**反而更 IP 安全**（无星形）。
- 建议：文档措辞改为「中心竖纹/高光」，并使最终金币美术保持非星形装饰，与占位一致。

### 3.4 [LOW] 嘟浮占位复用 `drawStompable`（与刺栗同圆顶，仅色不同）
- `enemy-view.ts` 中 `du_fu` 走 `else` 分支 = 与 `ci_li` 同款圆顶圆角块+眼，仅颜色蓝紫区分。占位可接受，但**违反美术圣经 §4.3「嘟浮=扁圆+两翅」的剪影双编码**。
- 风险：最终像素若仍仅靠颜色区分刺栗/嘟浮，色盲模式下不可辨（撞 Standard 基线 §9.1）。**最终像素必须给嘟浮「扁+翅」独立剪影**（spec §2.3 已定）。

### 3.5 [MONITOR] ✦ 互动/动作标记
- 触屏「动作」钮（`touch-buttons.ts:270`）与美术圣经 §5.2 互动块标记用 ✦（八芒放射）。属通用 sparkle，非五角星；最终须渲染为**明确非五角星的几何 sparkle/菱形**，与 §7.2 菱形星语言一致。当前占位无风险，列为正式绘制时的形态约束。

---

## 4. 占位层合规结论

> **结论：PASS（造型语义层面）** —— 当前所有占位渲染**无任天堂符号剪影**，主角/敌人/道具/终点/UI 均与美术圣经、control-list §3、GDD 99 一致性审查对齐。
>
> 占位资产人工复核 **PASS**；原唯一阻塞项 **§3.1 结算 `★`/star 标识符** 已由 **EL-STAR-FIX 修复**（矢量菱形星 + rank 标识符），**G5 命名 CONCERN 关闭**。不影响本任务「占位资产人工复核通过」结论（最终像素 `ui_star` 已合规规格）。

---

## 5. 最终像素资产待绘清单（供 S06-2 / E8 / R7）

| 实体 | 占位现状 | 正式必须造型（IP 约束） | 优先级 | 关联 spec |
|---|---|---|---|---|
| 栗宝 FULL/SMALL | 圆角块+嫩芽 | 完整剪影（栗色+暖黄高光+嫩芽，无水管工符号）+ idle/run/jump/double-jump/fall/hurt(+death 可选) | P0 | asset-spec §1 |
| 栗宝蜕变 topper（苗/藤/花/果） | 无 | 参数化头顶配件 + 暖黄光晕；**禁增益紫**；成长隐喻全原创 | P0 | asset-spec §1.3 |
| 刺栗 `ci_li` | 圆顶块 | 圆球+周身短刺（顶无刺）+ 白眼；警示红 | P0 | asset-spec §2.1 |
| 冲锋 `chong_feng` | 楔矩形 | 长条楔形前尖 + 警示红；不可踩硬顶 | P0 | asset-spec §2.2 |
| 嘟浮 `du_fu` | 圆顶块（同刺栗） | **扁圆 + 两翅**（独立剪影，与刺栗形状区分）；蓝紫 `#6E7BF2` | P0 | asset-spec §2.3 / §3.4 |
| 石炮 `shi_pao` | 方灰块 | 方正石块+炮口；灰+深灰 | P0 | asset-spec §2.4 |
| 弹丸 | 橙圆+尖 | 警示红+暖黄拖尾；独立 hazard | P0 | asset-spec §2.4 |
| 凯旋之门 `goal_triumph_gate` | 金框矩形 | **发光拱门**（互动青+暖黄光柱+石灰白门框）；非旗杆 | P0 | asset-spec §3.2 |
| 金币 | 金圆+竖纹 | 浮动+拾取闪光；中心竖纹/高光（**禁星形**） | P0 | asset-spec §3.1 / §3.3 |
| 种子 | 种壳+双叶 | 种壳+双叶嫩芽（蜕变母题） | P0 | placeholder-spec §1.5 |
| 元气果 `prop_buff_fruit` | **未绘制** | 果实+顶部嫩芽；增益紫 `#9B6CF2`；**非蘑菇/星星/火焰花** | P0 | placeholder-spec §1.5 / art-bible §6.1 |
| 爱心 `prop_heart`（world） | **未绘制**（HUD 已矢量） | 心形；暖粉红 `#F26D8B`（非警示红） | P0 | placeholder-spec §1.5 |
| `ui_star` 结算星级 | 通用 `★` | **原创菱形星**（非五角星）；填充暖黄/空描边 | P0（替换 §3.1） | asset-spec §4 / art-bible §7.2 |
| 互动块 `interactive_block` | 无（占位仅地形块） | 石灰白+互动青外发光+中心 ✦（**非五角星几何**） | P0 | asset-spec §3.1 / §3.5 |
| 壳珠 `prop_shield`（若落地） | 无 | 六边形环；互动青 `#3FC7B4` | P1 | art-bible §6.1 |
| 地形瓦片集 + 主题 tint | 纯色块 | 草绿顶+暖橙泥；草原/洞穴/天空换色不换形 | P0 | asset-spec §3.1 |
| 触屏四钮图标 | 矢量 ◀▶▲✦ | 保持纯几何；✦ 渲染为非五角星 sparkle | ✅ 已对齐 | touch-buttons-spec |

---

## 6. 命名合规建议（给 CI 扫描 / quality-lead）

1. **重命名**（消除扫描命中）：`result-screen.ts` 中 `star`→`rank`（见 §3.1 建议 1）。
2. **扫描范围**：限定 源码 + 配置 + 资源清单（`control-list §3` 原文），**排除** `.md` 文档参考词与 `dist*`/`node_modules` 构建产物（Phaser 内部 `register("star",…)` 会误命中）。
3. **语义豁免**：若保留评级星标识符，须将 `star`(道具) 规则限定为「道具/增益」语义上下文，书面豁免完成度评级星。

---

## 7. Handoff（回传主理人 · 中文）

① **占位资产 IP 合规结论**：**PASS（造型语义层面）**。无任天堂符号剪影；主角/敌人/道具/终点/UI 全对齐美术圣经与 control-list §3。**G5 命名 CONCERN（原结算 `★`/star 标识符）已由 EL-STAR-FIX 修复关闭**（见 ②）。
② **红线风险（已修复）**：原 1 项 CONCERN——`result-screen.ts` 用通用五角星 `★` 且标识符含 `star`。已由 **EL-STAR-FIX** 落地推荐方案（重命名为 rank + 矢量菱形星），**G5 命名 CONCERN 关闭**。非 `star`(道具) 硬红线，最终像素 `ui_star` 已合规规格。
③ **最终像素待绘清单**：见 §5（栗宝完整剪影+蜕变 / 四敌完整精灵[嘟浮须补扁+翅] / 凯旋之门发光拱门 / 金币竖纹[禁星] / 种子 / 元气果[果实+嫩芽] / 爱心[暖粉红] / ui_star 菱形星 / 互动块 ✦ 非五角星 / 地形瓦片集）。
④ **复核覆盖文件范围**：见 §1（运行时占位 18 项逐行 + 视觉定义 5 份 + 命名自扫）。

— 美术指导 林绘澄 / AD-S06-IP
