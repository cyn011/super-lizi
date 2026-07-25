# Phase 7 发布清单（Release Checklist）· super-mali

> 角色：release-ops-lead（路远行）· 任务：P7-REL-01（P0）
> 基线 HEAD：`c199ad6`（feat(polish): Phase 6 打磨）｜上一发布候选：`6db53e5`（GDD12 种子蜕变）
> 评审强度：lean｜双端：Web + 微信小游戏
> 关联：`docs/phase-gates/phase5-phase6-gate.md`（G1–G9 条件通过）、`production/sprint-06/manual-regression-g3-g9.md`（G3/G9 真机清单）、`docs/wechat-blackscreen-fix.md`（四层兜底）、`docs/phase-gates/phase6-perf-report.md`（G4 包体 / 性能）

> **约束声明**：本清单仅产出发布/运维文档，**未做任何 `src/` 改动、未 git commit**。所有高影响动作（版本号 bump、git tag、发布签字、微信提审）须经主理人（用户）审批后由工程侧执行。

---

## 0. 发布版本号建议与判据

当前 `package.json` 版本为 `0.1.0`（开发占位，**非正式版本号**）。建议首个对外发布版本按下表二选一：

| 建议版本 | 适用判据 | 触发条件 |
|---|---|---|
| **v0.9.0（预发布 / 灰度）** | 自动化门全 PASS，但 **G3/G9 真机/模拟器回归尚未由用户执行** | 用真实设备/模拟器跑完 `manual-regression-g3-g9.md` **之前**即灰度放行（Web 灰度 + 微信**体验版**内部测试） |
| **v1.0.0（正式 GA）** | **G3/G9 三端（Web / 微信模拟器 / 微信真机）回归全勾 + Sign-off 完成** | 用户在三端跑通并留痕、关闭 G3/G9 后正式提审/全量 |

**发布-ops 推荐路径（按风险分级）**：
- **Web 端**：可发 **v0.9.0 灰度**。浏览器渲染确定性强、`headless` 仿真已验证双端等价，真机项归"手感/主观"，不阻断可玩。仍建议做一次 Web 真机手测留痕以闭合 Sign-off。
- **微信端提审（审核/正式）**：**建议阻断至 G3/G9 三端回归完成并 Sign-off**。原因——微信黑屏四层兜底（R3 / R3-ter / R4-perf / registry）仅在"源码级复现 + 构建 + 单测"层面验证，**从未在模拟器/真机实跑**；G9 正是为此而设。一旦提审通过并上线，黑屏类故障**不可热修**（微信审核周期长），风险收益不划算。
- **微信体验版（内部）**：允许在 Sign-off 前上传供内部真机验证，但**不提交审核**。
- 若主理人选择**豁免**（明确 waiver），本清单支持以 v0.9.0 推进微信提审，但须在 §6 Sign-off 与 §8 风险表中显式记录豁免原因。

---

## 1. 构建产物校验（双端出包）

> 门控依据：G4 包体 §2 红线 **Web ≤ 2.7 MB / 微信 ≤ 2.7 MB**；包内 0 音频、0 图集（ADR-004）。

### 1.1 出包命令
```bash
npm run build:web       # → dist/        (Web 包)
npm run build:wechat   # → dist-wechat/  (微信包，含 copy-wechat 脚本)
```

### 1.2 验收阈值（G4）
| 包 | 文件 | raw 阈值 | 音频 | 图集 |
|---|---|---|---|---|
| Web | `dist/index.html` + `dist/assets/index-*.js` | ≤ 2.7 MB | 0 | 0 |
| 微信 | `index.js` + `weapp-adapter.js` + `game.js` + `game.json` + `project.config.json` | ≤ 2.7 MB | 0 | 0 |

### 1.3 当前实测（基于仓库现有 `dist/` `dist-wechat/`，build 后须复测）
| 包 | 体积 | gzip | 判定 |
|---|---|---|---|
| Web 主包 | ≈ 1.49 MB（index.html + assets/index-*.js） | ≈ 355 KB | ✅ PASS（≤2.7MB） |
| 微信主包 | ≈ 1.66 MB（index.js + weapp-adapter.js + game.js + game.json + project.config.json） | ≈ 394 KB | ✅ PASS（≤2.7MB） |

- 音频：`find dist dist-wechat -iname '*.mp3' -o -iname '*.wav' -o -iname '*.ogg'` → **0 命中** ✅
- 图集：`find dist dist-wechat -iname '*.png' -o -iname '*.atlas'` → **0 命中** ✅（全矢量占位）

### 1.4 微信四件齐全核对（来自 manual-regression §0）
- [ ] `dist-wechat/game.js` 存在且含黑屏兜底（R3 / R3-ter / R4-perf / registry）
- [ ] `dist-wechat/index.js` 存在（Babel ES5 产物）
- [ ] `dist-wechat/weapp-adapter.js` 存在
- [ ] `dist-wechat/project.config.json` 存在（`appid` 须为真实 appid，见 §4）
- [ ] Web：`dist/index.html` + `dist/assets/index-*.js` 存在

> 出包后**逐一** `du -b` 复测体积并核对文件清单，确认阈值与文件齐全方进入 §2。

---

## 2. 上线清单（staging → prod）

### 2.1 Web（staging → prod）
- [ ] `npm run build:web` 通过，§1 体积/文件核对 PASS
- [ ] 部署到静态托管 / CDN（`base: './'` 已设，产物可直接托管）
- [ ] staging 域名冒烟：首屏无红错、栗宝可见、1-1 可玩跑通
- [ ] 留痕：console 无红错日志截图
- [ ] 切 prod 域名 / 刷新 CDN 缓存
- [ ] prod 冒烟（同上）通过 → 标记 Web 上线完成

### 2.2 微信（体验版 → 审核 → 发布）
- [ ] `npm run build:wechat` 通过，§1 体积/四件核对 PASS
- [ ] 微信开发者工具导入 `dist-wechat/` → 模拟器无红错、可玩
- [ ] 上传为**体验版**（内部真机验证入口）
- [ ] **提审前置（见 §5）**：`appid` 真实、类目、软著、自审(IP)、隐私协议、适龄提示齐备
- [ ] 提交审核 → 审核通过 → 发布（建议**分阶段发布**灰度，保留上一稳定版便于回滚）
- [ ] 真机复验（G9）：体验版/正式版扫码进入，无红错 + 可玩 ✅

> ⚠️ 微信提审 **必须**在 G3/G9 三端回归 Sign-off 后（或主理人显式豁免）方可提交（见 §0、§8）。

---

## 3. 回滚预案（Rollback）

> 原则：所有回滚命令须在**主理人审批**后由工程侧执行；本清单仅提供可执行步骤，不代为执行（且全程未 commit）。

### 3.1 代码级回滚（git）
```bash
# 方案 A（推荐，保留历史）：revert 发布提交
git revert <发布commit>            # 生成反向提交，安全可审计

# 方案 B（紧急）：检出上一稳定版文件树（须重新 build）
git checkout 6db53e5 -- .          # 上一发布候选（GDD12）
# 或回退到发布前：git checkout c199ad6~1 -- .

# 版本锚定（发布时由主理人审批后打 tag）
git tag -a v0.9.0 -m "super-mali v0.9.0 预发布" <发布commit>
```

### 3.2 构建产物回退
- 发布前**归档上一稳定版** `dist/`、`dist-wechat/`（如按版本号目录备份：`dist-v0.8/`、`dist-wechat-v0.8/`）。
- 回滚时：恢复归档产物 → 重新部署（Web）/ 重新上传体验版（微信），**无需重新 build 源码**。

### 3.3 微信端回退
- **体验版**：直接重新上传上一稳定版 `dist-wechat/` 即可覆盖。
- **正式版**：微信无"一键回滚"，须**重新提审**或利用**分阶段发布**将流量切回上一稳定版（故强烈建议首次发布走分阶段发布）。
- 黑屏等致命故障：立即将分阶段发布流量降为 0 + 重新上传体验版验证修复 → 再提审。

### 3.4 应急决策
| 故障 | 判定 | 动作 |
|---|---|---|
| Web 首屏崩 / 真机红错 | blocker | 回退 CDN 到上一稳定产物（3.2） |
| 微信黑屏（未真机验证即上线） | 致命 | 分阶段流量降 0 + 重新上传验证（3.3）；复盘 G9 放行流程 |
| 音频异常（爆音/无声音） | 非致命 | 记 known issue，下个热修；Web 可热更，微信走体验版验证后提审 |

---

## 4. 配置项核对

### 4.1 `assets/audio/cdn-map.json`（⚠ 待填 CDN）
当前内容：`{}`（空 map）。
- 含义：`wechat-audio.ts` 的 `SFX_CDN={}` + `streamFrom` seam 已落地，但 **D9 CDN 素材未就位**。
- 影响：**Web 端 SFX 程序化合成可闻；微信端在 D9 素材就位前全程静默**（已知限制，非阻断 v0.9.0 视觉可玩，但 E7 音频真机复验须等 D9）。
- 发布前核对：
  - [ ] 若 D9 已就位：填入各 SFX 的 CDN URL，并在微信模拟器/真机复验"音频可用"（关 E7）。
  - [ ] 若 D9 未就位：本项记 known issue，发布说明明示"微信端音频暂静默"，不阻断发布。

### 4.2 `platform.reduceMotion` 默认 false（✅ 已落地）
- `src/platform/web/web-platform.ts:112` 与 `src/platform/wechat/wechat-platform.ts:71` 均设 `reduceMotion: false`（P6 整改 D3）。
- `game-scene` 订阅：`this.reduceMotion = this.platform.reduceMotion ?? false`；开启时跳过蜕变光晕脉冲 tween（防光敏）。
- 核对：
  - [ ] 两平台默认值均为 `false` ✅
  - [ ] 后续可由系统 `prefers-reduced-motion` / 设置项注入（当前未接线，记预留点）

### 4.3 `project.config.json` — appid（⚠ 用户侧必填）
- 当前 `"appid": "touristappid"`（游客 appid，**不能用于正式提审**）。
- 核对：
  - [ ] **替换为真实注册的微信小游戏 appid**（用户侧提供）
  - [ ] `compileType: "game"`、`libVersion: "3.17.0"` 与引擎匹配
  - [ ] `setting.urlCheck: false`（开发期；提审前按需调整）

### 4.4 其它配置
- [ ] `game.json`：`deviceOrientation: "landscape"`、`showStatusBar: false`、`networkTimeout.request: 10000` ✅ 合理
- [ ] `src/config/audio-config.json`：`{master:1, sfx:1, music:0, unlockOnInteraction:true}` ✅（music 为 0 = 远程流式占位，符合 ADR-004）
- [ ] `vite.config.ts`：`IS_WECHAT` define 双端裁剪、`base: './'` ✅

---

## 5. 微信提审材料清单（专项）

> 按微信小游戏 current 规范梳理；**标注「用户侧提供」的项须主理人/运营提供，release-ops 不代填**。

| # | 材料 / 项 | 说明 | 责任 | 状态 |
|---|---|---|---|---|
| 1 | **真实 appid** | `project.config.json` 替换 `touristappid` | 用户侧 | ⚠ 待提供 |
| 2 | **类目** | 游戏 → 小游戏（须与主体资质匹配） | 用户侧/运营 | ⚠ 待确认 |
| 3 | **软著（软件著作权）** | 微信小游戏提审通常要求软著或代理 | 用户侧 | ⚠ 待提供 |
| 4 | **IP 自审声明** | **关键**：本作原创、IP 红线禁用水管工/蘑菇/五角星/旗杆符号；结算用矢量菱形星（非五角星），命名"栗宝"非"马里奥"，种子替代蘑菇。须附自审 attestation | release-ops 起草 + 主理人确认 | 🟡 起草中 |
| 5 | **隐私保护指引** | 微信要求《隐私保护指引》配置 + 隐私弹窗（`wx.requirePrivacyAuthorize` 链路） | 用户侧/工程 | ⚠ 待配置 |
| 6 | **适龄提示** | 健康游戏忠告 / 适龄分级 | 用户侧 | ⚠ 待提供 |
| 7 | **游戏名称** | "super-mali"（须确认无商标冲突；建议主理人复核命名） | 主理人 | 🟡 待复核 |
| 8 | **版号** | 商业化公开发行通常需版号；体验版/内测无需。正式全量前确认主体与版号要求 | 用户侧/法务 | ⚠ 待确认 |
| 9 | **提审包体** | `dist-wechat/` 四件齐全、体积 ≤2.7MB、无红错 | 工程/release-ops | ✅ 可构建 |
| 10 | **自测报告** | G3/G9 三端回归 Sign-off（§6）+ 无红错留痕 | 主理人/测试 | ⚠ 待执行 |

> 提审前置硬门槛：**1、4、5、10** 四项不齐全不得提交审核（4/10 由本清单与回归文档支撑；1/5 为用户侧必填）。

---

## 6. 发布 Sign-off 表（逐项勾选）

> 跨部门核对；高影响动作须经主理人审批。勾选 `[x]` = 已确认。

### 6.1 工程（engineering-lead 域，release-ops 代核）
- [ ] 双端构建通过（§1）
- [ ] G4 包体 ≤2.7MB（双端）✅
- [ ] G7：`tsc --noEmit` 0 错 + 测试全绿（268）✅
- [ ] 微信四层黑屏兜底已落地（R3/R3-ter/R4-perf/registry）
- [ ] 配置核对通过（§4：cdn-map 状态已知、reduceMotion=false、appid 待换）

### 6.2 质量（quality-lead 域）
- [ ] G1/G2/G4/G5/G6/G7 PASS ✅
- [ ] G3/G9 三端真机回归执行并 Sign-off（**发布阻断项，见 §0/§8**）
- [ ] G8⑤ 资产占位（topper/关卡 Graphic）状态已知（独立 track，不阻断主线）

### 6.3 商店 / 平台（release-ops + 用户侧）
- [ ] 微信 `appid` 真实（§4.3）
- [ ] 提审材料齐备（§5：软著/隐私/适龄/自审/IP）
- [ ] 版本号 bump（0.1.0 → 0.9.0 或 1.0.0，主理人审批）

### 6.4 法务 / IP
- [ ] IP 红线自审通过（无任天堂符号）
- [ ] 名称/商标冲突复核

### 6.5 社区 / 发布沟通
- [ ] 补丁说明（changelog.md）就绪
- [ ] 已知问题公告（微信静默音频等）就绪
- [ ] 灰度/正式发布公告草稿

### 6.6 主理人最终签字
- [ ] **发布 go / no-go 决策**（含 G3/G9 是否豁免）____________________

---

## 7. 已知发布风险与缓解（摘要）

| 风险 | 性质 | 缓解 | 是否阻断发布 |
|---|---|---|---|
| 微信黑屏兜底未真机验证 | 环境依赖 | G9 三端回归 Sign-off 后提审；否则仅发体验版 | **阻断微信提审**（可豁免） |
| G3 ③④⑤⑦⑧ 未真机量测 | 环境依赖 | 跑 manual-regression 三端留痕 | 不阻断 Web；阻断微信 Sign-off |
| 微信端音频静默（D9 未就位） | 功能缺口 | 发布说明明示；D9 就位后复验 E7 | 非阻断 |
| `appid=touristappid` | 配置缺 | 用户侧提供真实 appid | **阻断提审** |
| 候选③图集合并（G8⑤） | 独立 track | 随美术像素资产交付后启用 | 非阻断（占位合规） |

> 详细已知问题见 `changelog.md`「Known Issues」章节。

---

## 8. 待主理人审批项（Handoff）

1. **版本号裁决**：v0.9.0（灰度，G3/G9 未跑）vs v1.0.0（G3/G9 闭合后正式）。
2. **G3/G9 阻断性裁决**：是否豁免微信提审阻断（建议不豁免，先体验版真机验证）。
3. **用户侧提供项**：真实 appid、软著、隐私指引、适龄提示、类目/版号资质。
4. **是否允许 bump 版本号 + git tag**（当前约束：release-ops 未 commit，须主理人授权工程侧执行）。

---
*本清单为 release-ops 发布门控文档；所有"待执行/待提供"项均非本角色可独立完成，已显式标注责任方。*
