# super-mali · 架构评审（Phase 3）

> 阶段：Phase 3 技术搭建（架构设计）
> 评审强度：lean
> 作者：程基岩（engineering-lead）
> 配套文档：`docs/architecture/architecture.md` + `docs/architecture/adr/ADR-001..005` + `docs/architecture/control-list.md`

## 判定：架构可进入 Phase 4 实现 ✅（含 3 项需主理人拍板的开放问题）

---

## 1. 评审清单（逐项）

| # | 评审项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 11 个 GDD 接口契约均可落地 | ✅ | 架构 §13 映射表逐条标注落地模块与"可实现" |
| 2 | 逻辑层零 Phaser（`core/` 可单测） | ✅ | 架构铁律 1 + §4；`platform/` 唯一平台边界 |
| 3 | 逻辑层零平台分支（`wx`/DOM 不泄漏） | ✅ | 铁律 2 + ADR-003 三段式输入 |
| 4 | 数值集中 config，无硬编码 | ✅ | 铁律 3 + §10 配置表 |
| 5 | 双端输入一致性可验证 | ✅ | §11 + ADR-003 + 单测策略 §9.2(input) |
| 6 | 固定步长 60Hz 与渲染分离 | ✅ | ADR-005 + §7 |
| 7 | 手感可量化（沙盒 + 单测） | ✅ | §9.3 + control-list §1 |
| 8 | 包体策略守 4MB/8MB | ✅ | ADR-004 预算表（主包 ≤2.7MB） |
| 9 | 音频不破包体 | ✅ | ADR-004 远程流式 + WebAudio 合成 |
| 10 | 节拍 `enabled:false` 不驱动机制 | ✅ | §4.8 + GDD 10 |
| 11 | 受伤×形态状态机正交 | ✅ | §4.6 + GDD 07/99 |
| 12 | IP 红线有构建期兜底 | ✅ | control-list §3 |
| 13 | 微信运行前提（weapp-adapter）已识别 | ⚠️ | ADR-003 §6；为 Phase 4 首要验证项（风险 R2） |

---

## 2. 关键风险

### R1 · 包体（主包 4MB / 整包 8MB）
- **风险**：Phaser 引擎 + 业务代码 + 图集可能逼近 4MB；若音乐随包必爆。
- **缓解**：ADR-004 已定（图集 1 个 ≤1MB、音乐远程流式、SFX 合成零文件、代码 tree-shaking、后续关卡走子包）。主包预算 ≤2.7MB 留 ~1.3MB 余量。
- **owner**：engineering-lead｜**gate**：control-list §2 包体预算卡点。

### R2 · 双端一致性（尤其微信 `weapp-adapter` 运行）
- **风险**：微信小游戏需 `weapp-adapter` shim + `game.js`/`game.json` 工程骨架；WebGL 在部分环境回退 CANVAS；`onTouch` 坐标映射易错；自动播放音频限制。
- **缓解**：ADR-003 已隔离适配层；双端共享 `core/`；输入/仿真确定性单测 + headless 冒烟。
- **owner**：engineering-lead｜**gate**：Phase 4 **首要**交付一个"微信最小可运行 demo"（空场景 + 一个可动精灵 + 触屏按钮），再铺内容。control-list §4 双端一致性测试项。

### R3 · 手感跨端差异
- **风险**：键盘（Web）与触屏（微信）手感体感不同（触屏无"按下瞬间"精确边沿、有视觉延迟），即便 `InputState` 序列一致，玩家主观手感可能不同。
- **缓解**：固定步长 + 输入固定步内采样（ADR-005）保证逻辑一致；触屏按钮布局/透明度/左右手预设可调（GDD 01 §8）；手感沙盒以**量化指标**而非主观验收（control-list §1）。
- **owner**：engineering-lead + design-strategist（手感标准）｜**gate**：control-list §1 手感沙盒指标。

### R4 · 引擎/构建复杂度（隐性）
- **风险**：Vite 双构建（Web + 微信）配置、Phaser 按需引入、TypeScript 严格度。
- **缓解**：`vite.config` 以 `IS_WECHAT` define 平台裁剪；Phase 4 脚手架先打通单构建再复制微信变体。
- **owner**：engineering-lead。

---

## 3. GDD 接口可实现性确认（摘要）

全部 11 个 GDD 接口契约经架构 §13 映射确认**可实现、无冲突**。重点复核：
- `InputState` / `InputAbstraction.sample()`（01）→ 纯函数，双端一致 ✅
- `Body`/`stepBody`/`isGrounded`（02）→ 纯函数，穿透安全（15px<32px）✅
- `CharacterState`/`consume()`（03）→ 纯函数 + 事件，参数全 config ✅
- `EnemyState` + 表驱动（04）→ 可踩判定明确、与踩踏互斥 ✅
- `LevelData`/`LevelLoader.load()`（05）→ 纯解析，beat 字段可承载 ✅
- `DamageState`（07）→ 正交矩阵，单点 `sizeScale` ✅
- `BeatClock`（10）→ 纯逻辑时钟，`enabled` 门控 ✅
- `SaveData`（11）→ 经 `platform.storage` 注入 ✅
- `playSfx`（09）/ `HUDModel`（08）→ 占位/订阅，零耦合 ✅

**一致性继承**：Phase 2 一致性评审（99）四维（输入命名/实体 schema/beat 字段/状态机正交）在本架构中由模块边界与事件总线**结构性保证**，非仅靠约定。

---

## 4. IP 合规架构层确认
- 角色/敌人/终点/道具命名与造型由**资产与 GDD 内容**保证（99 §6 已核查通过）。
- 架构侧兜底：control-list §3 的**构建期 IP 合规检查**（扫描源码/配置/资源中是否出现任天堂符号词、禁用水管工轮廓资产），作为 Phase 4 质量门。

---

## 5. 开放问题（带入主理人拍板，不影响骨架）
1. **状态管理手写 vs 库**（ADR-002）：笔者建议手写 + 事件总线，不引 XState。请确认。
2. **图集工具选型**（ADR-004）：笔者建议 `free-tex-packer`（开源），付费备选 `TexturePacker`。请确认。
3. （不阻塞）Phase 2 门 CONCERNS 六项（下穿单向平台/关卡长度/星级权重/音频占位 vs 静音/元循环地图 vs 直进）可在 Phase 4 实现期前拍板，不影响本架构骨架。

## 6. 结论
架构文档 + 5 条 ADR + 控制清单构成 Phase 4 完整输入；11 个 GDD 接口均可落地，三项关键风险（包体/双端/手感）均有明确缓解与质量门。建议主理人确认 §5 两项开放问题后，进入 Phase 4 代码脚手架（先过 R2 微信最小 demo）。
