# 发布清单 / Go-No-Go 评估 · super-mali

> 角色：release-ops-lead（路远行）· 任务：ROP-P7-RELEASE-PREP（high）
> 基线 HEAD：`dbcf695`（docs(gdd): 批次3 五关 parTime 表/JSON 同步定稿值）
> 当前版本号：`package.json` = **0.10.0**
> 评审强度：lean｜双端：Web（dist/）+ 微信小游戏（dist-wechat/）
> 关联：`production/sprint-06/manual-regression-g3-g9.md`（G3/G9 真机清单）、`docs/wechat-blackscreen-fix.md`、`docs/phase-gates/`

> **约束声明（红线）**：本清单仅产出发布/运维文档，**未做任何 `src/` 改动、未 `git commit`、未改构建配置**。所有高影响动作（版本号 bump、git tag、发布签字、微信提审）须经主理人（游承峰）审批后由工程侧执行。

---

## 0. 版本号建议与 Go-No-Go 结论（速读）

**建议首个正式对外版本号：`v1.0.0`（GA）。**

理由（基于 0.10.0 → 1.0.0 的成熟度）：
- 内容完整度达 GA：8 个开发关卡配置存在（`src/config/levels/1-1…1-7` + `2-1…2-4`），**本次发布范围 7 关（1-1→1-7）全部落地**——批次1 草原/山、批次2 海、批次3 沙漠/家/街/办公。
- 质量基线稳定：`tsc --noEmit` **0 错**；`vitest` **549 passed / 69 files**；web/wechat 双端构建产物齐备；headless 双端确定性固化；IP 红线扫描 0 命中。
- 打磨轨完成：热浪蜃气、全 7 关 parTime 定稿、控制面板独占、子弹敌难度曲线（1-1/1-2 移除石炮）、音频打磨、性能、越界配色、黑屏四层兜底、暂停/结算/重试闭环。

| 发布通道 | 判定 | 说明 |
|---|---|---|
| **Web（独立托管 / 网页版）** | 🟢 **GO-READY** | 代码层全绿、双端构建成功、沙箱确定性已验证。残项仅 G3/G9 的 **Web 端真机冒烟留痕**（主观手感），不阻断可玩。出包 + 静态托管 + 真机冒烟即可发 v1.0.0 网页版。 |
| **微信小游戏 · 审核 / 正式** | 🔴 **NO-GO（条件未满足）** | 两条硬阻塞均未清零：① G3/G9 三端（Web/模拟器/真机）Sign-off（含黑屏四层兜底**真机**验证，即 G9）；② 用户线下外部前置（真实 appid、软著、隐私指引、类目、版号、IP 自审、名称合规）。**在两项清零前不得提审/正式**。 |
| **微信小游戏 · 体验版（内部）** | 🟢 **GO** | 仅供用户跑 G3/G9 真机验证的入口；**不提交审核**。 |

> ⚠️ **版本号 ≠ 发布门控**：`v1.0.0` 是建议的正式版本号（build 前由工程侧 bump，须经主理人审批 + git tag）。是否在 G3/G9 完成前先以 `1.0.0-rc` / 保持 `0.10.0` 灰度，由主理人裁决；**正式 GA 即 1.0.0**。

---

## 1. 当前可发布状态汇总

### 1.1 7 关内容完整性（发布范围 1-1 → 1-7）
| 关 | 名称 | 主题 | 专属机制 | 配置存在 |
|---|---|---|---|---|
| 1-1 | 翠野序章 | grass | 基础跳跃/踩敌/吃币/凯旋之门 + 种子蜕变 | ✅ `1-1.json` |
| 1-2 | 黛峦·续章 | mountain | 山川主题 + 进度链 + 节拍段 `bp_1_2` | ✅ `1-2.json` |
| 1-3 | 《澜屿潮汐》 | sea | 潮汐水位 + 暗流 + 水母 | ✅ `1-3.json` |
| 1-4 | 《灼沙绿洲》 | desert | 流沙致死 + 蝎子/仙人掌 + 热浪 | ✅ `1-4.json` |
| 1-5 | 《归巢》 | home | 家具即地形 + pet/toy | ✅ `1-5.json` |
| 1-6 | 《霓街穿行》 | street | 车辆 + 井盖蒸汽 | ✅ `1-6.json` |
| 1-7 | 《案牍劳形》 | office | 文件堆平台 + 咖啡渍低摩擦 | ✅ `1-7.json` |

> 进度链：`nextLevelId(order, current)`（`src/core/level/level-order.ts`）已落地；1-7 的 `nextLevelId` → `2-1`（末关显隐「下一关」由 `result-screen` 的 `hasNext` 控制）。**逻辑层由单测固化，真机渲染/手感归 G3/G9（§11.5）。**

### 1.2 双端构建产物（磁盘实测，2026-07-28）
| 包 | 文件 | 体积（字节） | 合计 | 阈值 2.7MB | 判定 |
|---|---|---|---|---|---|
| Web | `dist/index.html`(572) + `dist/assets/index-*.js`(1,689,851) + `dist/game.js`(37,723) + `game.json`(134) + `mali-app-icon-144.png`(1,265) | — | **1,729,545（≈1.65 MB）** | ≤2.7MB | ✅ PASS（余量 ~39%） |
| 微信 | `index.js`(1,786,108) + `weapp-adapter.js`(51,324) + `game.js`(44,020) + `game.json`(113) + `project.config.json`(863) + `mali-app-icon-144.png`(1,265) | — | **1,883,693（≈1.80 MB）** | ≤2.7MB | ✅ PASS（余量 ~34%） |

### 1.3 测试 / 类型基线（本机实测，2026-07-28）
- `npx tsc --noEmit` → **exit 0，0 错** ✅
- `npm test`（vitest run）→ **Test Files 69 passed (69)；Tests 549 passed (549)** ✅
- headless 双端确定性、`G5` IP 红线扫描 `grep src/` 0 命中（任天堂符号：水管工/蘑菇/五角星/旗杆均不出现；`SHELL_COLOR`=栗色种壳，`ON_RESTART`/`startX` 为子串误报）✅

### 1.4 已知风险与缓解（摘要，详见 §8）
- 微信黑屏四层兜底（R3/R3-ter/R4-perf/registry）已在**源码/构建/单测**层验证，**从未在模拟器/真机实跑** → 由 G9 真机确认。
- 微信端音频在 D9 CDN 素材就位前**全程静默**（非阻断）。
- `project.config.json` `appid` 仍为 `touristappid`（游客，**不能提审**）。
- 游戏对外显示名「栗宝大冒险」与包名 `super-mali` 不一致（命名合规风险，见 §5.4 / §6）。

---

## 2. 硬阻塞 vs 软项（发布前清零判定）

### 2.1 🔴 硬阻塞（清零前不得发布微信审核/正式；Web 仅建议补齐）
| # | 阻塞项 | 类型 | 责任方 | 阻断范围 | 是否代码层已闭合 |
|---|---|---|---|---|---|
| B1 | **G3/G9 三端真机 Sign-off**（Web/微信模拟器/微信真机，含黑屏兜底 G9） | 验证（用户侧） | 用户/quality-lead | 微信提审 + 建议 Web 冒烟 | 否（须真机跑 `manual-regression-g3-g9.md`） |
| B2 | **微信 `appid` = `touristappid`** | 配置/外部 | 用户 | 微信提审 | 代码 OK，待换真实 appid |
| B3 | **软著（软件著作权）** | 外部资质 | 用户/法务 | 微信提审 | — |
| B4 | **隐私保护指引 + 隐私弹窗**（`wx.requirePrivacyAuthorize` 链路） | 外部/合规 | 用户+工程 | 微信提审 | 链路待配 |
| B5 | **类目匹配**（游戏→小游戏，与主体资质匹配） | 外部 | 用户 | 微信提审 | — |
| B6 | **版号**（商业化公开发行通常要求） | 外部资质 | 用户/法务 | 微信正式全量 | — |
| B7 | **IP 自审声明**（原创、禁任天堂符号、菱形星非五角星、栗宝非马里奥） | 合规 | 主理人 + release-ops | 微信提审 | 自审草稿待主理人确认 |
| B8 | **游戏名称合规**（对外「栗宝大冒险」 vs 包名 `super-mali` 须统一） | 合规/命名 | 主理人 | 微信提审 | — |

### 2.2 🟡 软项（可带伤发布 / 已知问题公告兜底）
| # | 软项 | 性质 | 缓解 |
|---|---|---|---|
| S1 | 微信端音频静默（D9 CDN 未就位，`assets/audio/cdn-map.json` = `{}`） | 功能缺口 | 发布说明明示；D9 就位后复验 E7（Web 端 SFX 程序化合成可闻，不受影响） |
| S2 | topper / 关卡 Graphic 仍为矢量占位（G8⑤ 独立 track） | 美术资产 | ADR-004 合规（零 PNG 游戏资产），不阻断可玩；待像素资产交付后启用 |
| S3 | 嘟浮（du_fu）独立剪影未做（当前矢量占位） | 美术资产 | 不阻断可玩 |
| S4 | Reduce Motion 未接系统 `prefers-reduced-motion`（开关已预留，默认 false） | 无障碍增强 | 预留点，非阻断 |
| S5 | 黑屏四层兜底仅源码/构建/单测验证 | 验证缺口 | 归 B1（G9 真机） |

> **结论**：**Web 端无代码层硬阻塞**，可 GO（补 B1 的 Web 冒烟留痕为建议项）。**微信审核/正式全部卡在 B1 + B2–B8（用户线下/真机）**，属 release-ops 不可独立完成项，已显式标注责任方。

---

## 3. 构建产物校验（双端出包）— 与原 release-checklist 的差异更正

> ⚠️ **更正既有文档的两处过期结论**（旧 `release-checklist.md` 写于 v0.9.0 / 268 测试时代）：
> 1. 旧文档称「图集 `find … *.png` → 0 命中 ✅」——**当前不实**。两个构建各含 **1 个 PNG：`mali-app-icon-144.png`（1,265 字节）**，即**微信小游戏必需的 144×144 应用图标**（commit `84d8c1c` 收录）。这是**平台强制资产，非游戏内美术资产**，不构成 ADR-004（零游戏内 PNG）违规。其余全为矢量/JS。
> 2. 旧文档称 Web 主包 ≈1.49MB、微信主包 ≈1.66MB——**当前实测为 1.65MB / 1.80MB**（随 7 关内容增长），仍远低于 2.7MB 红线。

### 3.1 出包命令（不改动，仅引用）
```bash
npm run build:web       # → dist/        (Web 包)
npm run build:wechat   # → dist-wechat/  (微信包，含 copy-wechat.mjs)
```

### 3.2 验收阈值（G4 红线）
| 包 | 文件 | 音频 | 图集（游戏内） |
|---|---|---|---|
| Web | `dist/index.html` + `dist/assets/index-*.js` | 0（程序化合成） | 0（仅 1 个平台 app 图标 PNG，合规） |
| 微信 | `index.js` + `weapp-adapter.js` + `game.js` + `game.json` + `project.config.json` | 0 | 0（同上） |

### 3.3 微信四件齐全核对（来自 manual-regression §0）
- [ ] `dist-wechat/game.js` 存在且含黑屏兜底（R3/R3-ter/R4-perf/registry）
- [ ] `dist-wechat/index.js` 存在（Babel ES5 产物）
- [ ] `dist-wechat/weapp-adapter.js` 存在
- [ ] `dist-wechat/project.config.json` 存在（`appid` 须为真实 appid，见 §5.2）
- [ ] `dist/index.html` + `dist/assets/index-*.js` 存在

> 出包后**逐一 `stat -f '%z %N'` 复测体积并核对文件清单**，确认阈值与文件齐全方进入 §4。

---

## 4. 配置项核对

### 4.1 `assets/audio/cdn-map.json`（⚠ D9 待填）
- 当前内容：`{}`（空 map）。`wechat-audio.ts` 的 `SFX_CDN={}` + `streamFrom` seam 已落地，但 **D9 CDN 素材未就位**。
- 影响：Web 端 SFX 程序化合成可闻；**微信端在 D9 素材就位前全程静默**（S1）。
- [ ] D9 已就位 → 填 CDN URL，模拟器/真机复验音频（关 E7）；否则记 known issue，发布说明明示「微信端音频暂静默」，不阻断。

### 4.2 `platform.reduceMotion` 默认 false（✅ 已落地）
- `src/platform/web/web-platform.ts` 与 `src/platform/wechat/wechat-platform.ts` 均设 `reduceMotion: false`（P6 整改 D3）。`game-scene` 订阅后在 Reduce Motion 下跳过蜕变光晕脉冲 tween（防光敏）。
- [ ] 两平台默认 false ✅｜[ ] 后续接系统 `prefers-reduced-motion`（当前未接线，S4 预留）

### 4.3 `project.config.json` — appid（⚠ 用户侧必填）
- 当前 `"appid": "touristappid"`（游客 appid，**不能用于正式提审** → B2）。
- [ ] 替换为真实注册的微信小游戏 appid（用户侧提供）｜[ ] `compileType: "game"`、`libVersion: "3.17.0"` 与引擎匹配｜[ ] `setting.urlCheck: false`（开发期；提审前按需调整）

### 4.4 其它配置（来自既有文档 + 源码注释，出包后复测）
- [ ] `game.json`：`deviceOrientation: "landscape"`、`showStatusBar: false`、`networkTimeout.request: 10000` ✅ 合理
- [ ] `src/config/audio-config.json`：`{master:1, sfx:1, music:0, unlockOnInteraction:true}` ✅（music=0 远程流式占位，符合 ADR-004）
- [ ] `vite.config.ts`：`IS_WECHAT` define 双端裁剪、`base: './'` ✅（须出包后复测确认未改）

---

## 5. 微信提审材料清单（专项）— 标注「需用户线下处理」

> 按微信小游戏现行规范梳理；**标注「需用户线下处理」的项 release-ops 不代填，须主理人/运营/法务线下解决**。

| # | 材料 / 项 | 说明 | 责任 | 状态 |
|---|---|---|---|---|
| 1 | **真实 appid** | `project.config.json` 替换 `touristappid` | 用户侧 | 🔴 待提供（B2） |
| 2 | **类目** | 游戏 → 小游戏（须与主体资质匹配） | 用户侧/运营 | 🔴 待确认（B5） |
| 3 | **软著（软件著作权）** | 微信小游戏提审通常要求软著或代理 | 用户侧/法务 | 🔴 待提供（B3） |
| 4 | **IP 自审声明** | 原创、禁任天堂符号；结算用矢量菱形星（非五角星）；命名「栗宝」非「马里奥」、种子替代蘑菇。附自审 attestation | release-ops 起草 + 主理人确认 | 🟡 起草中（B7） |
| 5 | **隐私保护指引** | 《隐私保护指引》配置 + 隐私弹窗（`wx.requirePrivacyAuthorize` 链路） | 用户侧/工程 | 🔴 待配置（B4） |
| 6 | **适龄提示** | 健康游戏忠告 / 适龄分级 | 用户侧 | 🔴 待提供 |
| 7 | **游戏名称** | 对外应统一为「**栗宝大冒险**」（标题屏 `title-scene.ts:272` + 分享标题 `main.ts:64`）；包名 `super-mali` 仅内部使用。须确认无商标冲突 | 主理人 | 🔴 待复核（B8，见 §5.4） |
| 8 | **版号** | 商业化公开发行通常需版号；体验版/内测无需。正式全量前确认主体与版号要求 | 用户侧/法务 | 🔴 待确认（B6） |
| 9 | **提审包体** | `dist-wechat/` 四件齐全、体积 ≤2.7MB、无红错 | 工程/release-ops | ✅ 可构建 |
| 10 | **自测报告** | G3/G9 三端回归 Sign-off（§7）+ 无红错留痕 | 主理人/测试 | 🔴 待执行（B1） |

> **提审前置硬门槛**：**1、4、5、7、10** 不齐全不得提交审核（4/10 由本清单与回归文档支撑；1/5/7 为用户侧必填/必决）。

### 5.1 命名一致性风险（B8 详情）
仓库内存在**三处命名不一致**，提审前须主理人拍板统一：
- 包名 / `project.config.json` `projectname`：`super-mali`
- 标题屏大标题（`title-scene.ts:272`）：`栗宝大冒险`
- 微信分享转发标题（`main.ts:64`）：`栗宝大冒险 · 一起来跳！`
- 关卡名（`src/config/levels/*.json`）：如 `翠野序章` / `《澜屿潮汐》` / `《案牍劳形》` 等（中文，CN-only 合规）

> 玩家可见名「栗宝大冒险」为原创、IP 安全；但 `super-mali` 含 "mali" 近音 "Mario"，**仅作内部/包名无碍，不应作为对外游戏名称**。提审「游戏名称」字段建议填「栗宝大冒险」。

---

## 6. 发布 Sign-off 表（逐项勾选）

### 6.1 工程（engineering-lead 域，release-ops 代核）
- [ ] 双端构建通过（§3）
- [ ] G4 包体 ≤2.7MB（双端）✅（实测 1.65/1.80 MB）
- [ ] G7：`tsc --noEmit` 0 错 + 测试全绿（549）✅（本机实测）
- [ ] 微信四层黑屏兜底已落地（R3/R3-ter/R4-perf/registry）
- [ ] 配置核对通过（§4：cdn-map 状态已知、reduceMotion=false、appid 待换）

### 6.2 质量（quality-lead 域）
- [ ] G1/G2/G4/G5/G6/G7 PASS ✅（沙箱）
- [ ] **G3/G9 三端真机回归执行并 Sign-off（发布阻断项，B1）** 🔴
- [ ] G8⑤ 资产占位（topper/关卡 Graphic）状态已知（独立 track，不阻断主线）

### 6.3 商店 / 平台（release-ops + 用户侧）
- [ ] 微信 `appid` 真实（§4.3 / B2）🔴
- [ ] 提审材料齐备（§5：软著/隐私/类目/版号/名称/IP 自审）🔴
- [ ] 版本号 bump 至 **1.0.0**（须经主理人审批后由工程侧执行）⚠️ 待裁决

### 6.4 法务 / IP
- [ ] IP 红线自审通过（无任天堂符号；菱形星非五角星）🟡
- [ ] 名称/商标冲突复核（§5.1）🔴

### 6.5 社区 / 发布沟通
- [ ] 补丁说明（`changelog.md`）就绪 ✅
- [ ] 已知问题公告（微信静默音频等）就绪 ✅
- [ ] 灰度/正式发布公告草稿

### 6.6 主理人最终签字
- [ ] **发布 go / no-go 决策**（含 G3/G9 是否豁免、版本号裁决）____________________

---

## 7. 已知发布风险与缓解（摘要）

| 风险 | 性质 | 缓解 | 是否阻断发布 |
|---|---|---|---|
| 微信黑屏兜底未真机验证 | 环境依赖 | G9 三端回归 Sign-off 后提审；否则仅发体验版 | **阻断微信提审**（B1，可豁免） |
| G3 ③④⑤⑦⑧ 未真机量测 | 环境依赖 | 跑 manual-regression 三端留痕 | 不阻断 Web；阻断微信 Sign-off |
| 微信端音频静默（D9 未就位） | 功能缺口 | 发布说明明示；D9 就位后复验 E7 | 非阻断（S1） |
| `appid=touristappid` | 配置缺 | 用户侧提供真实 appid | **阻断提审**（B2） |
| 软著/隐私/类目/版号/名称 | 外部资质 | 用户线下处理 | **阻断提审**（B3–B8） |
| 命名不一致（栗宝大冒险 vs super-mali） | 合规 | 主理人统一为「栗宝大冒险」 | 阻断提审（B8），须早决 |
| 候选③图集合并（G8⑤） | 独立 track | 随美术像素资产交付后启用 | 非阻断（S2） |

> 详细已知问题见 `changelog.md`「Known Issues」章节。

---

## 8. 待主理人审批项（Handoff）

1. **版本号裁决**：建议 **v1.0.0（GA）**。当前 `0.10.0` 已具备 7 关完整内容 + 549 测试 + 打磨轨完成，成熟度达 GA。若 G3/G9 完成前先灰度，可用 `1.0.0-rc` 或维持 `0.10.0`；正式 GA 即 `1.0.0`。
2. **G3/G9 阻断性裁决**：建议 **不豁免**——微信提审仍阻断至 G3/G9 三端 Sign-off（B1）；Web 端可 GO-READY（补 Web 冒烟留痕为建议项）。体验版内部验证不受限。
3. **用户侧提供项（均「需用户线下处理」）**：真实 appid、软著、隐私指引、适龄提示、类目/版号资质、IP 自审声明、游戏名称统一（栗宝大冒险）。
4. **是否授权工程侧执行**：版本号 bump（0.10.0 → 1.0.0）+ git tag + 出包。**当前约束：release-ops 未 commit / 未改代码 / 未改构建配置**，须主理人授权工程侧执行。

---

*本清单为 release-ops 发布门控文档；所有「待执行/待提供」项均非本角色可独立完成，已显式标注责任方。与既有 `release-checklist.md`（v0.9.0 时代）的差异已在 §3 更正。*
