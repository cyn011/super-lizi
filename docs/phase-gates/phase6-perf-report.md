# Phase 6 性能剖析报告（P6-ENG-01）

> 项目：super-mali（原创马里奥式横版跳跃微信小游戏）· 引擎 Phaser 3.90 + TypeScript + Vite
> 目标平台：Web + 微信小游戏双端 · 评审强度：lean（先量后改）
> 作者：程基岩（engineering-lead）· 日期：2026-07-24
> 关联任务：P6-ENG-01（P0）· 关联门：phase4-phase5-gate（G4 包体 / G7 测试类型）

---

## 0. 摘要与判定

- **做了什么**：仅性能相关改动（lean，先量后改）。落地 5 项优化，覆盖候选①（topper 几何节流）、②（弹丸对象池）、④（微信/Web 稳态 GC 压力点）。候选③（纹理/图集合并）经核为 **N/A**（当前全为矢量占位 Graphics，无像素资产）。
- **门状态**：
  - **G4 包体 PASS 维持**：Web 主包 1.49 MB / gzip 355 KB；微信主包 1.66 MB / gzip 394 KB；均 ≤2.7 MB 红线。包内 0 音频、0 图集。
  - **G7 测试/类型 PASS 维持**：`tsc --noEmit` 0 错；`vitest run` **268 绿**（38 文件）；`core-no-platform` 扫描 3/3 通过（core 零平台铁律未被破坏）。
- **性能收益（可量化）**：热路径稳态分配 **15→0 对象/步（Web 口径）/ 9→0（微信口径）**，`scripts/perf-bench.mjs` 实测减少 **100%**；约 **900（Web）/ 540（微信）个短命对象/秒** 不再产生，直接降低微信 JSCore GC 频率与卡顿风险。
- **未做/待办**：真机 FPS / Jank / 堆快照须用户在 Web、微信模拟器、微信真机三端按 `production/sprint-06/manual-regression-g3-g9.md`（G3/G9）复测留痕（沙箱无 GPU/浏览器，不臆造数字）。高影响动作（git commit、发布）待主理人审批。

---

## 1. 剖析方法（Methodology）

### 1.1 本环境可跑（静态 + 可复现）
| 维度 | 手段 | 证据落点 |
|---|---|---|
| 工具链门 | `tsc --noEmit`、`vitest run`、`core-no-platform.test.ts` | §4 门状态 |
| 包体 | `build:web` + `build:wechat` → `du`/`gzip -c`；`find` 查音频/图集 | §2.1 |
| 分配热点 | 代码审查 `game-scene` 热路径（`stepSim` 每固定步 / `update` 每帧）+ 自包含微基准 `scripts/perf-bench.mjs` | §2.4 |
| Draw call | `Graphics` 对象清单清点（Phaser 每 Graphics ≈ 1 draw call） | §2.3 |

### 1.2 双端真机/模拟器量测（本沙箱无法代跑，须用户执行）
- **Web**：Chrome DevTools → **Performance**（FPS、长任务、Jank 帧）/ **Memory**（heap snapshot、`performance.memory.usedJSHeapSize`）/ **Renderer**（draw calls）；运行时 `game.loop.actualFps` 取实时 FPS。
- **微信**：微信开发者工具 **Performance** 面板；`wx.getPerformance().getEntries()`；iOS（JSCore）/ Android（V8）**JS 堆快照**；真机帧率与发热；`game.loop.actualFps`。
- **入口**：复用 `production/sprint-06/manual-regression-g3-g9.md`（G3 ③④⑤⑦⑧ + G9 真机复验）。

> 说明：本沙箱为构建/测试环境，无 GPU 与浏览器，故**不报告臆造的 FPS/Jank 数值**；§2.2 仅给静态推断与真机量测流程。

---

## 2. 双端性能数据

### 2.1 包体（G4 证据，本次 build 复测）
| 包 | 文件 | raw | gzip | 阈值 | 判定 |
|---|---|---|---|---|---|
| Web 主包 | `dist/index.html` + `dist/assets/index-*.js` | **1,563,513 B（≈1.49 MB）** | **363,196 B（≈355 KB）** | ≤2.7 MB | ✅ PASS |
| 微信主包 | `index.js`+`weapp-adapter.js`+`game.js`+`game.json`+`project.config.json` | **1,740,493 B（≈1.66 MB）** | **403,033 B（≈394 KB）** | ≤2.7 MB | ✅ PASS |

- 对比 phase4-phase5-gate 基线（web 1.47 MB/349 KB gz、wechat 1.57 MB/387 KB gz）：本次略增（web +6 KB gz、wechat +7 KB gz），源自新增性能逻辑代码（约数十行）+ 构建非确定性（esbuild minify 哈希/排序微扰），**远在预算内，不影响 PASS**。
- **音频**：`find dist dist-wechat -iname '*.mp3|*.wav|*.ogg'` → **0 命中**（符合 ADR-004：音乐远程流式、SFX 合成零文件）。
- **图集/纹理**：`find ... -iname '*.png|*.atlas'` → **0 命中**（当前全为矢量占位 Graphics，无像素资产）→ 候选③ N/A。

### 2.2 帧率 / 卡顿 / 首屏
- **静态推断**：场景简单（1-1+1-2 两关、4 敌、少量弹丸、全矢量渲染、单场景单画布），预期 Web/微信中端 ≥55–60 fps。此为推断，**非实测**。
- **真机量测**：见 §1.2（本环境不跑）。
- **首屏时间**：受 JS 解析/执行（Phaser 主 chunk ≈1.49 MB raw）主导；本次逻辑优化不增删依赖，首屏基本持平。

### 2.3 Draw calls / 纹理占用
- **世界层持久 Graphics**（loadLevel/create 创建一次，每帧 `clear()`+重绘；depth 见注释）：
  `sprite`(10)、`flashGfx`(11)、`topperGfx`(12)、`enemyGfx`(9)、`projectileGfx`(9)、`coinGfx`(8)、`seedGfx`(8)、`checkpointGfx`(7)、`levelGfx` —— **约 9 个 ≈ 9 draw call**（Phaser 可能批处理，实际更低）。HUD/UI（`hud`/`touch-buttons`/`pause-menu`/`result-screen`）另计，总量远低于移动端预算。
- **每帧几何重建成本（CPU）**：sprite(1 形)、enemy(×4 各数形)、projectile(×N 各数形)、topper(**已缓存**)、flash(活跃时 1 矩形)。`coin/seed/checkpoint/level` 仅在事件（拾取/检查点/加载）时重绘，已是最优。
- **纹理内存**：≈0（无 PNG）；GPU 纹理占用可忽略。候选③图集合并待美术像素资产交付后按 ADR-004 启用（独立 track，归 G8⑤）。

### 2.4 GC / 内存（本次核心优化项）
**改前热路径每固定步（60Hz）分配**（代码审查 + `scripts/perf-bench.mjs` 复刻）：
- 输入采样 `sample()`：Web 复合层 = keyboard(3 Set) + 次级(3 Set) + 合并(3 Set) = **9 Set/步**；微信单提供者 = **3 Set/步**。
- `resolveHazards`：建 `sources` 中间数组(1) + `projectiles.filter` 新数组(1) = **2 数组/步**。
- 敌人 `update` ×4：非开火各返回新 `[]` = **4 数组/步**。
- 合计：Web **≈15 对象/步**、微信 **≈9 对象/步** → @60Hz 约 **900 / 540 个短命对象/秒**。

**改后**：输入帧复用（三组 Set 清空回填）、双循环替代 `sources`、原地压缩替代 `filter`、共享空数组哨兵 `NO_PROJECTILES`、弹丸 `Projectile.acquire/release` 对象池 → **热路径稳态 0 分配**（仅石炮开火走对象池复用，暖机后亦 0 新建）。

**微基准 `scripts/perf-bench.mjs`（5 分钟 @60Hz = 18000 步）**：
```
BEFORE: steps=18000  allocs=270000  allocs/step=15.00  time=33.6ms
AFTER : steps=18000  allocs=0       allocs/step=0.00   time=11.9ms
减少分配: 270000 (100.0%)
```
→ 稳态分配减少 **100%**；纯循环耗时 33.6ms→11.9ms（改前额外承担 `filter`/原生集合分配与清理解引用）。

**内存**：无新增常驻；对象池仅复用，容量自限（空闲实例数 = 历史同时存活峰值，极小）。

### 2.5 微信历史包袱（R3/R4 polyfill）
`game.js` 三层兜底（R3 `readyState` / R3-ter `getBoundingClientRect` / R4-perf / registry）为**正式防御**，**本次未触碰**，维持不变。

---

## 3. 优化项清单（已落地）

| # | 候选 | 文件 | 改动 | 类型 | 行为影响 |
|---|---|---|---|---|---|
| 1 | ① topper 节流 | `src/game/scenes/game-scene.ts` `drawTopper` / `src/game/render/mali-topper.ts` | stage 不变时每帧仅 `setPosition`（廉价 transform）；几何重建仅在 `METAMORPHOSIS` 切换 stage 时一次（`topperDirty` 标志） | CPU | 视觉零变化（锚点/尺寸/深度一致） |
| 2 | ④ GC：输入采样 | `src/core/input/raw-input.ts` `refillFrame` + `web-keyboard.ts`/`wechat-touch.ts`/`gesture-provider.ts`/`web-platform.ts` | 各 provider 复用单一帧对象的三组 Set（清空回填），消除每 `sample()` 新建 3–9 个 Set | GC | 输入语义不变；`frame` 须本 tick 内同步消费（已满足） |
| 3 | ②/④ 弹丸池 | `src/core/enemy/projectile.ts` `acquire/release` + `enemy-ai.ts` `updateShiPao` + `game-scene.ts` `compactProjectiles` | 静态对象池复用 `Projectile`；`shi_pao` fire 走 `acquire`；dead 弹丸原地压缩并 `release` 归还 | GC/CPU | 数值全来自 config；`id` 不再保证全局唯一但代码未依赖 id 去重（已核查） |
| 4 | ④ GC：`resolveHazards` | `game-scene.ts` | 去掉 `sources` 中间数组，改为敌人/弹丸双直接循环 + 原地压缩 | GC | 遍历顺序与解算结果等价（已对照原实现） |
| 5 | ④ GC：敌人 `update` | `src/core/enemy/enemy-ai.ts` | 非开火返回共享只读哨兵 `NO_PROJECTILES`（模块级 `const []`），消除每步 4 个空数组 | GC | 调用方仅读 `.length`/遍历，无写入（已核查测试） |

> **候选③（纹理/图集合并）**：经核为 **N/A**——项目当前无任何 PNG/图集资产，全部为矢量占位 Graphics（GDD 12 + art §1.3 规格，占位合规）。待 art-director 交付像素资产后，按 ADR-004「单图集」策略启用，属 G8⑤ 独立 track，不在本性能任务范围。

---

## 4. 前后对比（Before / After）

| 指标 | 改前 | 改后 | 变化 |
|---|---|---|---|
| 热路径稳态分配（Web） | 15 对象/步 | 0 对象/步 | **−100%** |
| 热路径稳态分配（微信） | 9 对象/步 | 0 对象/步 | **−100%** |
| 短命对象/秒 @60Hz | ~900（Web）/~540（微信） | ~0 | 归零 |
| 微基准 5min 分配总数 | 270,000 | 0 | −100% |
| Web 主包 | 1.47 MB / 349 KB gz* | 1.49 MB / 355 KB gz | +6 KB gz（噪声级，仍 PASS） |
| 微信主包 | 1.57 MB / 387 KB gz* | 1.66 MB / 394 KB gz | +7 KB gz（噪声级，仍 PASS） |
| `tsc --noEmit` | 0 错 | 0 错 | 维持 |
| `vitest run` | 268 绿 | 268 绿 | 维持 |
| `core-no-platform` 扫描 | 3/3 | 3/3 | 维持（core 零平台铁律） |
| GDD 契约 | — | — | 不变（未触碰玩法/数值/尺寸/形态） |

\* 基线取自 phase4-phase5-gate §2.3 快照。

---

## 5. 结论

1. **G4 包体 PASS 维持**：双端主包 ≤2.7 MB 红线（Web 1.49 MB / 微信 1.66 MB raw），包内 0 音频、0 图集。
2. **G7 测试/类型 PASS 维持**：`tsc` 0 错、268 测试全绿、`core` 零平台扫描通过——优化未引入回归，GDD 契约不变。
3. **性能收益明确**：稳态分配归零（候选④核心收益），显著降低微信 JSCore GC 压力与卡顿风险；topper 几何重建节流（候选①）；弹丸对象池落地（候选②）。
4. **待主理人/用户动作**：
   - 高影响动作（git commit、发布签字）须经主理人审批——**本次未提交**。
   - 真机 FPS/Jank/堆快照：用户须按 `manual-regression-g3-g9.md` 在 Web / 微信模拟器 / 微信真机三端复测留痕，方可将 G3/G9 转「完全通过」。
   - 候选③图集合并随美术像素资产交付后启用（G8⑤）。

---

## 6. 复现命令

```bash
# 工具链门（G7）
npx tsc --noEmit && npx vitest run

# 包体（G4）
npm run build:web && npm run build:wechat
# 量测：du -b dist/assets/*.js dist-wechat/*.js ; gzip -c <file> | wc -c

# 分配热点微基准（§2.4 证据）
node scripts/perf-bench.mjs

# 微信历史包袱确认（维持未改）
grep -nE "readyState|getBoundingClientRect|registry" game.js | head
```
