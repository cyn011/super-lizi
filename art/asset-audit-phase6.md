# super-mali 资产审计（Asset Audit）— Phase 6 · P6-ART-01

> 文档类型：**全量资产审计**（美术侧）
> 作者：art-director（林绘澄）
> 上游依据：`art/art-bible.md` v1.1、`art/asset-spec.md`、`art/asset-manifest.md`、`art/ip-review.md`（G5 PASS）、`art/seed-topper-spec.md`、`art/accessibility.md`、`docs/architecture/adr/ADR-004`
> 评审强度：lean
> 审计方法：逐文件读取 `src/**` 运行时渲染源码（Graphics 程序化绘制），逐项核对 ① 是否仍程序化/占位 ② IP 红线 ③ 锁色板合规 ④ 图集预算（ADR-004）⑤ 可访问性（色盲双编码 + 光敏安全）。代码事实以 `文件:行` 标注。
> 范围：主角栗宝 FULL/SMALL、四敌 + 弹丸、HUD（矢量）、种子 topper、瓦片/环境，并补列道具/终点（coin/seed/元气果/爱心/凯旋之门）以覆盖全量实体清单。

---

## 0. 审计基准（锁色板口径）

**任务权威 11 色（硬锁，≤64 色不引入新色）**：

| 角色 | Hex |
|---|---|
| 草绿 | `#7CC242` |
| 阴影绿 | `#5FA82F` |
| 暖橙 | `#F2933C` |
| 暖黄 | `#FFD23F` |
| 描边（近黑棕） | `#2A1A12` |
| 命粉 | `#F26D8B` |
| 警示红 | `#E8483B` |
| 经济金 | `#F2C94C` |
| 蓝紫 | `#6E7BF2` |
| 环境冷蓝 | `#4A78C0` |
| 天空 | `#5BC8F5` |

**文档既有扩展色（已在 art-bible / asset-spec / asset-manifest 定义，审计视为"合法"，非越界）**：栗色 `#B5763E`、浅肚皮 `#F0D9B5`、暗栗 `#8A6A4A`、石灰白 `#F4EFE6`、深灰 `#8A8276`、金币金 `#FFC93C`、互动青 `#3FC7B4`、增益紫 `#9B6CF2`（道具独占）、深红 `#B5302A`、浅红 `#F2A39C`、背光暖紫 `#6E5A8C`、白 `#FFFFFF`、纯黑（仅 Game Over 遮罩 alpha 0.6，INFO 级）。

> ⚠️ **文档口径不一致（低优先）**：art-bible §3.2 与 asset-spec §4 用「金币金 `#FFC93C`」，任务权威与 code 用「经济金 `#F2C94C`」。两者均合法、code 与任务一致 → 不记为违规；建议后期把 bible 文案统一为 `#F2C94C`，使锁色板清单唯一。

---

## 1. 逐项审计总表（5 维度）

> 维度代号：① 占位状态 ② IP ③ 色板 ④ 图集 ⑤ 可访问性
> 结论图例：**OK** = 通过 / **CONCERN** = 通过但需跟进（非阻断）/ **FAIL** = 阻断

| 实体 | ① 状态 | ② IP | ③ 色板 | ④ 图集 | ⑤ 可访问性 | 备注 |
|---|---|---|---|---|---|---|
| 栗宝 FULL/SMALL | 程序化占位（`placeholder.ts`） | OK | OK | 矢量未入图集（占位为 Graphics） | OK | 圆角块+嫩芽；完整像素未产（ip-review §5 P0） |
| 刺栗 `ci_li` | 程序化占位（`enemy-view.ts:44`） | OK | OK | 同上 | OK（圆+红+刺，软顶可踩） | 圆+刺+红，形状编码 |
| 冲锋 `chong_feng` | 程序化占位（`enemy-view.ts:62`） | OK | OK | 同上 | OK（楔形+红，硬顶不可踩） | 形状双编码与刺栗区分 |
| 嘟浮 `du_fu` | 程序化占位（`enemy-view.ts:39` 复用 drawStompable） | OK | OK | 同上 | **CONCERN** | 同刺栗圆顶块、仅色不同（蓝紫）；最终须补「扁+翅」独立剪影（ip-review §3.4） |
| 石炮 `shi_pao` | 程序化占位（`enemy-view.ts:89`） | OK | **CONCERN** | 同上 | OK | 用中性灰 `0x8a8a8a`/`0x4a4a4a` **非锁色板**（见 §3） |
| 弹丸 `fx_projectile` | 程序化占位（`projectile-view.ts`） | OK | **CONCERN** | 同上 | OK（橙圆+方向尖） | 用 `0xf2994a` **非锁色板**（规格=警示红+暖黄拖尾，见 §3） |
| HUD（矢量） | 矢量即时渲染（`hud.ts` 等） | OK | **CONCERN**（combo 橙） | **OK（不入图集，ADR-004 ✓）** | OK（热区/中文达标） | combo 文本 `#F2994A` 非锁色板（见 §3）；心形形状区分 |
| 种子 topper（苗/藤/花/果 + 光晕） | 程序化占位（`mali-topper.ts`，已实装） | OK | OK | 矢量未入图集 | OK（形状编码+光晕<3Hz） | **见 §4 与 seed-topper-spec §10** |
| 种子实体（拾取物） | 程序化占位（`seed-view.ts`） | OK | OK | 同上 | OK | 栗色种壳+草绿双叶 |
| 金币 `prop_coin` | 程序化占位（`coin-view.ts`） | OK | OK | 同上 | OK（金圆+竖纹） | 经济金 `#F2C94C` |
| 元气果 `prop_buff_fruit` | **world 未绘制**（`ip-review §5 #9`） | — | — | — | — | 规格=果实+嫩芽+增益紫 `#9B6CF2`（道具独占）；待产 |
| 爱心 `prop_heart`（world） | **world 未绘制**（`ip-review §5 #10`） | — | — | — | — | 规格=心形+暖粉红 `#F26D8B`；待产 |
| 凯旋之门 `goal_triumph_gate` | 程序化占位（`game-scene.ts:692` 金框矩形） | OK | OK | 同上 | OK | 非旗杆；待绘发光拱门 |
| 瓦片/环境 | 程序化占位（`ground` 色块） | OK | OK | 同上 | OK | 1 份基础集+主题 tint（省图集） |
| 触屏四钮 | 矢量（`touch-buttons.ts`） | OK | OK | OK（不入图集） | OK（热区≥48×48） | 纯几何 ◀▶▲✦ |

---

## 2. ① 程序化 / 占位状态清点（全量）

**结论：项目目前 0 个 PNG 图集资产，100% 为运行时 Graphics 程序化绘制。**
- 磁盘核查：`dist/assets/` 仅含 `index-*.js`（约 1.55MB 打包 JS）；`public/assets/` 空；`src/`、`production/` 下无 `.png`/`.atlas`/图集 JSON。
- 所有游戏世界实体（栗宝/四敌/弹丸/种子/金币/凯旋之门/瓦片）与 HUD 均由 `Phaser.GameObjects.Graphics` 每帧重绘。
- 此状态与 `sprint-04-plan §0.3 偏差⑤ / R7` 及 `ip-review §4` 一致：**占位造型语义合规，但非正式像素资产**。
- 待正式像素的 P0 项（ip-review §5）：栗宝完整剪影+动画、四敌完整精灵（嘟浮须补扁+翅）、凯旋之门发光拱门、元气果/爱心 world 精灵、瓦片集。

---

## 3. ③ 色板合规性（超色 / 越界色发现）

**审计口径**：以 §0 锁色板（11 权威 + 文档既有扩展）为基准，扫描所有渲染源码 hex 常量。

### 3.1 越界色（CONCERN，3 处，均非锁色板）

| # | 颜色 | 出现位置 | 用途 | 规格应取值 | 建议修正 |
|---|---|---|---|---|---|
| C1 | `0x8a8a8a`（中性灰） | `enemy-view.ts:17` `SHI_PAO_COLOR` | 石炮石身 | 石灰白 `#F4EFE6`（asset-spec §2.4 / manifest §2.5）或深灰 `#8A8276` | 石身→`#F4EFE6`，阴影/炮管→`#8A8276` |
| C2 | `0x4a4a4a`（深中性灰） | `enemy-view.ts:18` `SHI_PAO_MUZZLE` | 石炮炮口 | 深灰 `#8A8276` | →`#8A8276` |
| C3 | `0xf2994a`（橙，非 `#F2933C`） | `projectile-view.ts:11` `PROJECTILE_COLOR`、`enemy-view.ts:19` `FLASH_COLOR`、`hud.ts:51` `COLOR_COMBO_TEXT` | 弹丸主体 / 石炮闪光 / 连击文本 | 弹丸→警示红 `#E8483B`+暖黄 `#FFD23F` 拖尾（manifest §2.6）；闪光→暖黄 `#FFD23F`；combo 文本→经济金 `#F2C94C` 或保留为强调但需入册 | 弹丸/闪光→`#E8483B`/`#FFD23F`；combo→`#F2C94C` |

> 说明：C1/C2/C3 出现在**占位代码**中，占位期可接受；但属明确的"越界色"，正式像素化前必须归位到锁色板（否则破坏 ≤64 色一致性）。均为 **CONCERN（非阻断）**，记 engineering-lead 在像素化里程碑统一修正。

### 3.2 其余源码颜色核对（OK）

- `placeholder.ts`：栗色 `#B5763E`、草绿 `#7CC242`、描边 `#2A1A12` — 均合法。
- `mali-topper.ts`：`#7CC242`/`#FFD23F`/`#F2933C`/`#2A1A12` — 全合法（果=暖橙，禁增益紫 ✓）。
- `seed-view.ts`：栗色+草绿+描边 — 合法。
- `coin-view.ts`：经济金 `#F2C94C`+描边 — 合法。
- `hud.ts`：命粉 `#F26D8B`/栗色 `#B5763E`/草绿/暗栗 `#8A6A4A`/经济金 `#F2C94C`/石灰白 `#F4EFE6` — 合法（仅 C3 combo 橙越界）。
- `result-screen.ts`：评级菱形星（暖黄 `#FFD23F` 填充 / 描边），合法（ip-review §2 #18 PASS）。

---

## 4. ② IP 合规复核（无任天堂符号剪影）

- 继承 `ip-review.md` G5 结论：**18 项占位造型语义层面 0 例任天堂符号**（无帽檐/背带裤/胡子/水管工/蘑菇/龟壳/旗杆/星之道具）。
- **G5 命名 CONCERN 已关闭**：`result-screen.ts` 已由 **EL-STAR-FIX** 落地 — 标识符 `star`→`rank`（`ranks`/`RANK_GAP`/`drawRank`），结算星为**矢量原创菱形星**（非五角星）。本审计 grep 确认无残留 `star`/`COLOR_STAR` 字面量。
- 种子 topper（苗→藤→花→果）：自然生长隐喻，全原创；果阶段用暖橙 `#F2933C`+草绿+暖黄，**禁用增益紫 `#9B6CF2`**，与元气果双重区分（果为身体配件、非拾取物）。✅ IP 安全。
- 本审计未引入新资产、未改动任何代码符号，**IP 合规 = PASS**。

---

## 5. ④ 图集预算（ADR-004）

| 项 | 现状 | 结论 |
|---|---|---|
| 单图集 PNG-8 ≤1MB | **当前 0 个图集、0 MB**（全 Graphics） | ✅ 远优于上限 |
| UI 矢量不入图集 | HUD/触屏钮/结算/暂停全部 Graphics+系统字体（`hud.ts`/`touch-buttons.ts`/`result-screen.ts`/`pause-menu.ts`），零进图集 | ✅ 符合 ADR-004 #1/#5 |
| 音乐远程 | `audio-bus.ts` WebAudio 合成占位，音乐远程 URL（ADR-004 #2） | ✅ |
| 预计像素化后 | 按 `asset-manifest §5` 单 atlas PNG-8 ≈150–300KB（含 topper 4 帧+光晕 <2KB），仍 ≪1MB | ✅ 安全 |

**图集预算 = PASS（健康）**；像素化里程碑前无包体风险。

---

## 6. ⑤ 可访问性复查（色盲双编码 + 光敏安全）

**基线口径**：`art/accessibility.md` MVP = **Standard**（色盲双编码内建 + 色盲辅助开关 + 减少动态开关 + 文字≥14px + 热区≥48×48 + 防光敏<3Hz 硬底线）。

### 6.1 色盲双编码（形状+颜色）
- 全部敌人均形状+颜色双编码（`enemy-view.ts`）：刺栗=圆+刺+红 / 锥冲=楔形+红 / 嘟浮=圆顶+蓝紫 / 石炮=方+灰。危险/可踩由**形状语言（软顶圆 / 硬顶尖方）**主导，颜色仅强化。✅
- 道具：金币=圆+竖纹、种子=种壳+双叶、爱心=心形（HUD 实心/空心形状区分）。✅
- **CONCERN（D1）**：嘟浮当前复用 `drawStompable`（与刺栗同款圆顶块，仅蓝紫区分），**形状未独立**。功能上两者皆"软顶可踩"，色盲玩家对"能否踩"判断一致（OK）；但视觉辨识度弱、且违背 art-bible §4.3「扁圆+翅」剪影规范。最终像素**必须**给嘟浮独立「扁+翅」剪影（ip-review §3.4，asset-spec §2.3）。非阻断。
- **CONCERN（D2）**：弹丸用越界橙 `0xf2994a`（C3）。规格要求弹丸=警示红 `#E8483B`+暖黄拖尾，红=危险语义更强、与锁色板一致。修正后色盲/语义更清晰。

### 6.2 光敏安全（防癫痫）
- 蜕变光晕 `playMetamorphAura`（`mali-topper.ts:112`）：单次脉冲 scale 0.3→1.25 + alpha 0→0.6→0（yoyo），总时长 400ms，**单次、非重复、非 strobe**，<3Hz。✅（spec §2 上限 ≤0.4s 满足）
- 受击反馈：`hud.ts`/damage 为半透明红叠 + 角色闪烁（非全屏高频白闪）。✅
- **CONCERN（D3）**：`playMetamorphAura` **未接 Reduce Motion 开关** — 开启"减少动态"时仍播放光晕 tween，违背 accessibility #8。需在全局 Reduce Motion 实现后于此 gate（engineering-lead 跟进）。非阻断（开关本身为 Standard 增量）。

### 6.3 最小尺寸 / 热区
- 敌/道具 ≥1 格（32px 逻辑），缩放等效 ≥48 设备 px。✅
- HUD 热区 / 中文 ≥14px（`hud.ts` SCORE_FONT_SIZE=14px；`touch-buttons.ts` 热区≥48×48）。✅

---

## 7. 关键发现汇总（CONCERNS，按优先级）

| ID | 维度 | 严重度 | 发现 | 位置 | 归属 |
|---|---|---|---|---|---|
| C1 | 色板 | 中 | 石炮石身用中性灰 `0x8a8a8a` 非锁色板 | `enemy-view.ts:17` | 像素化里程碑（eng） |
| C2 | 色板 | 中 | 石炮炮口 `0x4a4a4a` 非锁色板 | `enemy-view.ts:18` | 像素化里程碑（eng） |
| C3 | 色板/IP语义 | 中 | 弹丸/闪光/combo 用 `0xf2994a` 非锁色板（规格=警示红+暖黄） | `projectile-view.ts:11`/`enemy-view.ts:19`/`hud.ts:51` | 像素化里程碑（eng） |
| D1 | 可访问性 | 低 | 嘟浮复用刺栗圆顶块，缺「扁+翅」独立剪影 | `enemy-view.ts:39` | 像素化里程碑（art+eng） |
| D2 | 可访问性 | 低 | 弹丸橙削弱"危险红"语义（同 C3） | `projectile-view.ts` | 同 C3 |
| D3 | 可访问性 | 中 | 蜕变光晕未接 Reduce Motion 开关 | `mali-topper.ts:112` | 全局 Reduce Motion 落地时（eng） |
| S1 | 占位/真机观感 | 中 | **双重芽点**：`placeholder.ts:22-26` 硬编码嫩芽未移除，与 topper stage0 苗叠加 → 真机 stage0 头顶出现两个芽 | `placeholder.ts` + `game-scene.ts:686` | 占位期即修（eng，见 seed-topper-spec §10.3） |
| S2 | 占位/真机观感 | 低 | 光晕中心实现置于 body 中心 `(cx,cy)`，规格为头顶上方 `(cx, topY-6)` | `game-scene.ts:328` vs spec §2 | 换皮时修正（eng） |
| S3 | 占位/真机观感 | 低 | topper 稳态光晕（α/r 阶梯）未实装，仅蜕变瞬脉冲 | `mali-topper.ts` | 换皮时补（eng，见 §10.3） |

> 全部为 **CONCERN（非阻断）**；无 FAIL。项目整体处于"占位语义合规、等待像素化"阶段，与全局 posture 一致。

---

## 8. 待主理人 / 工程 / 质量跟进

1. **C1/C2/C3（越界色）**：像素化里程碑统一把 `0x8a8a8a`/`0x4a4a4a`/`0xf2994a` 归位到锁色板（石炮→`#F4EFE6`/`#8A8276`；弹丸→`#E8483B`+`#FFD23F`；combo→`#F2C94C`）。建议 quality-lead 在命名/色值扫描 CI 增一条"锁色板白名单"校验。
2. **S1（双芽点）**：engineering-lead 在占位期即移除 `placeholder.ts:22-26` 硬编码嫩芽（seed-topper-spec §4.3 已知项），消除真机 stage0 双芽。此为**真机观感最优先修复**。
3. **D1（嘟浮剪影）**：美术在像素化时产出「扁圆+两翅」独立精灵，替换 `drawStompable` 复用。
4. **D3（Reduce Motion）**：全局 Reduce Motion 开关落地时，于 `playMetamorphAura` 处 gate（开启则跳终值/停首帧）。
5. **G8⑤（种子 topper）**：见 `art/seed-topper-spec.md §10` —— 本审计判定 **PASS（CONCERNS）**，OPEN 关闭，MVP 保留程序化占位，换皮路径归 engineering-lead。

---

## 9. Handoff 摘要（回传主理人）

- **审计结论**：全量资产 100% 程序化占位（0 PNG），IP 合规 PASS（G5 命名 CONCERN 已随 EL-STAR-FIX 关闭），图集预算健康（0 MB / ≤1MB），可访问性基础达标（色盲双编码内建 + 光敏<3Hz）；**3 处越界色 + 双芽点 + 嘟浮同形 + Reduce Motion 未接光晕** 共 9 项 CONCERN（均非阻断），待像素化里程碑/占位期修复。
- **最高优先真机修复**：S1 双芽点（移除 `placeholder.ts` 硬编码嫩芽）。
- **G8⑤ 判定**：PASS（CONCERNS），OPEN→CLOSED（详见 `seed-topper-spec.md §10`）。
- **不写 src/、不 git commit**（本审计仅文档产出）。

— 美术指导 林绘澄 / P6-ART-01
