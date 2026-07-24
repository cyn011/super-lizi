# 栗宝头顶 Topper 视觉规格（Seed Topper Visual Spec）— GDD 12/art §1.3 落地

> 文档类型：**工程实现权威视觉源（mali-topper.ts 据此外接）**
> 作者：art-director（林绘澄）
> 上游依据：`design/gdd/12-seed-metamorphosis.md` §1.3/§3.8、`art/asset-spec.md` §1.3、`art/art-bible.md` §3/§4.2、`art/ip-review.md` §5
> 评审强度：lean（聚焦"工程下一步画什么"，不写代码——`mali-topper.ts` 由 engineering-lead 按本规格实现）
> 渲染方式：**程序化 Graphics 绘制**（像素风，参考 `src/game/render/seed-view.ts` 的 `drawSeed` 范例），非 PNG 图集精灵。

---

## 0. 定位与一句话结论

本文件把 GDD 12「种子精灵蜕变成长系统」的**视觉蜕变**（苗→藤→花→果 + 暖黄光晕）从 `art/asset-spec.md` §1.3 的**参数化契约**落为**逐像素绘制规格**，作为工程实现 `src/game/render/mali-topper.ts` 的权威视觉源。

- 四阶段阈值与 `computeGrowth(maturity)` 完全一致：`<0.25 苗` / `0.25≤m<0.5 藤` / `0.5≤m<0.75 花` / `m≥0.75 果`。
- 全部配色引用美术圣经 §3 锁色板，**禁用增益紫 `#9B6CF2`**（与元气果明确区分）。
- 本 topper 是**最终视觉规格**，但 MVP 以**程序化 Graphics 绘制**落地（与当前 demo 全量 Graphics 渲染一致）；正式 PNG 图集精灵 `char_mali_top_0~3` 为后续换皮目标（见 §7）。

---

## 1. 四阶段绘制规格（权威）

### 1.1 通用约定

| 项 | 规格 |
|---|---|
| 画布 / 局部坐标 | 逻辑 `12×16`，**锚点 = bottom-center `(0,0)`**；`x∈[-6,+6]`，`y` 向上为负（`y=0` 接头顶，`y=-16` 画布顶）。 |
| 朝向 | 顶饰基本竖直对称（嫩芽/花/果均绕中轴），`flipX` 不必；sway 微摆方向可取 `facing` 或呼吸相位（见 §4.3）。 |
| 描边 | 每形体 1px 近黑棕 `#2A1A12`（高对比轮廓，accessibility §9.1/#1）。 |
| 调色板 | 嫩芽/茎/叶/花萼 草绿 `#7CC242`；阴影绿 `#5FA82F`（草绿降明度衍生）；花瓣/果高光/暖黄光晕 暖黄 `#FFD23F`（美术圣经 §3.1，**单一暖黄**，aura 与花瓣统一，覆盖早前 `#FFD27F` 备注）；**果填充 暖橙 `#F2933C`**（美术圣经 §3.1 暖橙，palette-locked，非新增色）；描边 `#2A1A12`。 |
| 绘制原点 | 工程传 `(cx, topY)`（头顶锚点，见 §5），topper 模块在该世界坐标以 `(0,0)=bottom-center` 向上绘制。 |
| 尺寸 | 最高 stage（果）≈ 16px 高，占比远低于栗宝 FULL 40px，符合"头顶小配件"体量（asset-spec §1.3 画布 ~12×16）。 |

### 1.2 逐阶段形状描述（程序化）

> 坐标为相对锚点 `(0,0)` 的局部值；`fillEllipse(cx,cy,w,h)` / `fillCircle(cx,cy,r)` / `fillRect(x,y,w,h)`，单位 px（逻辑）。工程可在此框架内微调弧度/叶片数，但**锁阈值、锁色板、锁体量**。

| stage | 名 | 形状描述（自锚点向上） | 高度 | 光晕 α / r |
|---|---|---|---|---|
| **0 苗** | sprout | 短茎 `fillRect(-1,-3,2,3)` 草绿；顶 1 小叶 `fillCircle(0,-5,3)` 草绿 + 描边；可加极小叶尖 `fillCircle(-2,-4,2)`。呼应 `placeholder.ts` 现有嫩芽点（实现时替换之，见 §5.3）。 | ~8px | 无（α=0） |
| **1 藤** | vine | 微伸茎 `fillRect(-1,-7,2,7)` 草绿；沿茎 2–3 小叶：`fillCircle(-3,-5,2)`、`fillCircle(3,-6,2)`、`fillCircle(0,-7,2)` 草绿 + 描边（位置错落模拟舒展）。 | ~10px | α 0.15 / r 18 |
| **2 花** | bloom | 茎 `fillRect(-1,-9,2,9)` 草绿；顶花：5 瓣 暖黄 `#FFD23F`（中心 `(0,-11)`，瓣 r2.5 分布于上/左上/右上/左/右）+ 花心 `fillCircle(0,-11,2)` 草绿萼 + 描边。盛放感。 | ~16px | α 0.30 / r 24 |
| **3 果** | fruit | 茎 `fillRect(-1,-9,2,9)` 草绿；顶果芽：`fillCircle(0,-12,4)` **暖橙 `#F2933C` 主体**（palette-locked 暖橙，呼应成熟果实）+ 暖黄 `#FFD23F` 高光弧（右上 1/4）+ 顶部小叶帽 `fillCircle(0,-15,2)` 草绿；**呼应元气果"果实+嫩芽"形状但改用暖橙/草绿/暖黄（绝不用增益紫）**，且仅为身体配件、非拾取物。 | ~16px | α 0.50 / r 30 |

> **果阶段 `scale +0.05` 说明**：GDD 12 §3.5 / asset-spec §1.3 锁定"果阶段视觉微胀 +0.05 **仅渲染、碰撞盒不变**"。该膨胀在**角色绘制层**处理（render-only），topper 模块本身不负责身体缩放；topper 仅随头顶锚点就位（见 §5）。

### 1.3 与 `computeGrowth` 字段对齐（art §1.3 映射）

| `GrowthVisual` 字段 | topper 模块用法 |
|---|---|
| `stage: 0\|1\|2\|3` | 选 `char_mali_top_{0..3}` 对应形状（procedural 即上表）。 |
| `sproutLen` | 茎高（stage 0≈3 / 1≈7 / 2≈9 / 3≈9 px，上表已锁）。 |
| `leafCount` | stage 0=1 / 1=2–3 / 2=5(瓣) / 3=1(果+帽)。 |
| `bodyTint` | 暖黄叠加（禁用增益紫）；本规格 body 不变色，仅光晕用暖黄。 |
| `auraAlpha` | 暖黄光晕峰值透明度（0 / 0.15 / 0.30 / 0.50）。 |
| `auraRadius` | 暖黄光晕半径（0 / 18 / 24 / 30 px）。 |

### 1.4 四阶段「头顶点位 / 尺寸 / 配色 / 单脉冲时长」一览（权威速查）

> 四阶段**共用同一头顶锚点**：世界坐标 `(cx, topY)`（`cx = body.x + 12`，`topY = body.y + 2`，见 §4/§5）；topper 局部锚点 = bottom-center `(0,0)`，自锚点向上绘制。故"头顶点位"四阶段一致，差异在向上延伸的尺寸 / 形状 / 配色 / 光晕。

| stage | 头顶点位（世界） | 占用画布（局部） | 配色（描边均 `#2A1A12`） | 暖黄光晕 | 单脉冲时长（蜕变时） |
|---|---|---|---|---|---|
| **0 苗** sprout | `(cx, topY)` | 12×8（高 ~8px） | 草绿 `#7CC242`（茎 + 1 小叶） | 无（α0 / r0） | 初始态，无跨阈值脉冲 |
| **1 藤** vine | `(cx, topY)` | 12×10（高 ~10px） | 草绿 `#7CC242`（茎 + 2–3 小叶） | `#FFD23F` α0.15 / r18 | ≤0.4s（ease-out tween） |
| **2 花** bloom | `(cx, topY)` | 12×16（高 ~16px） | 草绿 `#7CC242`（茎 + 萼）+ 暖黄 `#FFD23F`（5 瓣） | `#FFD23F` α0.30 / r24 | ≤0.4s（ease-out tween） |
| **3 果** fruit | `(cx, topY)` | 12×16（高 ~16px） | 暖橙 `#F2933C`（果体）+ 草绿 `#7CC242`（叶帽）+ 暖黄 `#FFD23F` 高光（**禁增益紫**） | `#FFD23F` α0.50 / r30 | ≤0.4s（ease-out tween） |

- **动画时长约束**：跨阈值 `ON_SEED_METAMORPHOSIS` 触发的"生长脉冲"= pop scale（≤0.4s）+ 光晕 α/r ease-out tween（≤0.4s），**单次脉冲 ≤0.4s**、非高频闪（防光敏 <3Hz，accessibility §9.3）。
- **idle 微摆（micro-sway）**：复用呼吸相位（~6fps），幅度随 stage 增大（苗→果）；非独立状态、不计入 0.4s 脉冲上限。
- **Reduce Motion**：开启后脉冲 tween 跳终值 / 停首帧（§2.1）。

### 1.5 四阶段最终 Palette（裁定收口 · 供 seed-eng 替换占位矢量）

| 用途 | Hex | 来源 / 裁定 | 用于 stage |
|---|---|---|---|
| 草绿（嫩芽 / 茎 / 藤叶 / 花萼 / 果叶帽） | `#7CC242` | art-bible §3.1 | 0 / 1 / 2 / 3 |
| 阴影绿（草绿降明度衍生，非主色） | `#5FA82F` | 草绿衍生 | 0 / 1 / 2 / 3 |
| 暖橙（果主体填充） | `#F2933C` | **裁定 §6.2**：palette-locked 暖橙，非新增莓红 | 3 |
| 暖黄（花瓣 / 果高光 / 暖黄光晕） | `#FFD23F` | **裁定 §6.1**：art-bible 权威，aura 与花瓣共用单一暖黄，覆盖早前 `#FFD27F` | 2 / 3 + 光晕全 stage |
| 描边（高对比轮廓） | `#2A1A12` | art-bible §3 / §9.1 | 0 / 1 / 2 / 3 |
| 暖黄光晕 α / r | 0/0 → 0.15/18 → 0.30/24 → 0.50/30 | asset-spec §1.3 | 0 / 1 / 2 / 3 |

> 全部 hex 均出自 art-bible 锁色板（≤64 色），**无新增色**（莓红不引入）；增益紫 `#9B6CF2` 全程禁用。

---

## 2. 暖黄光晕（Aura）规格

| 参数 | 值 |
|---|---|
| 颜色（主，art-bible 权威） | **暖黄 `#FFD23F`**（美术圣经 §3.1 / art-bible §1.3 / asset-spec §1.3 / GDD 12 §3.8 统一值；aura 与花瓣共用单一暖黄，**显式覆盖**早前 `#FFD27F` 备注）。 |
| 颜色（核心提亮） | （无需独立核心色；`#FFD23F` 即唯一暖黄，光晕径向由同心圆 alpha 递增模拟，见本表"程序化近似"）。 |
| 峰值 alpha | stage0=0 → stage1=0.15 → stage2=0.30 → stage3=0.50（≤0.6 上限，asset-spec）。 |
| 半径 | stage0=0 → stage1=18 → stage2=24 → stage3=30 px（`GrowthVisual.auraRadius`）。 |
| 中心 | 头顶锚点上方约 6px：`(cx, topY-6)`（halo 包裹顶饰）。 |
| **时长上限** | **≤0.4s**（GDD 12 §3.1/§3.8；非高频闪、非 strobe）。 |
| 触发 | 仅在 `ON_SEED_METAMORPHOSIS(stage)`（跨阈值）时做 alpha/radius **ease-out tween** 到新值。 |
| 程序化近似（径向） | 用 3–4 层同心圆由外→内 alpha 递增模拟径向衰减：<br>`for i in 0..3: r = auraR*(1-i/4); a = auraA*(0.35+0.2*i); fillCircle(cx, topY-6, r)`（最内最亮）。 |

### 2.1 减少动态 / 防光敏
- 开启 **Reduce Motion**（accessibility §9.3）：光晕 tween 直接跳到终值（或停首帧），不播放过渡；顶饰 sway 停摆。
- 防光敏：单次光晕上升 ≤0.4s、不连续闪烁、整体 <3Hz（accessibility §9.3/#10 硬底线）。

---

## 3. 动画 / 微摆（复用既有节奏，不新增状态）

- 现有 `idle/run/jump` 等**不新增状态**（asset-spec §1.3）。
- topper 叠加 **micro-rotation / sway**：幅度随 stage 增大（苗轻微 → 果明显），复用 idle 呼吸相位（~6fps 呼吸）驱动，非独立动画。
- 蜕变瞬间可加一次性 **pop scale**（≤0.4s ease-out），强化"生长"反馈，不与光晕叠加成高频。

---

## 4. 头顶锚点算法（给工程主程接线）

### 4.1 锚点推导（来自 `game-scene.ts` + `placeholder.ts`）

- 物理 `Body` = `{x, y, w, h}` 左上角坐标；`PLAYER_W=24`、`PLAYER_H=34`（FULL）。
- `stepSim` 中**仅 `h` 随 `sizeScale` 缩放**（`newH = PLAYER_H*sizeScale`），**`w` 恒为 24**；故水平中心 `cx` 两形态一致。
- `placeholder.ts` 在 `(0,0)=body 左上` 起绘 24×34 圆角块，嫩芽点画于局部 `(12,4)` → 即 body 顶部居中偏下 4px。
- 头顶 Crown（嫩芽生长点）相对 body 顶约 `2px` 下（局部 y≈2–4）。

### 4.2 推荐算法（在 `update()` 紧贴 `drawSprite()` 之后调用）

```ts
// body: {x,y,w,h} 碰撞盒左上（gdd03 / stepSim 维护）
// 注：w 不受 sizeScale 影响 → cx 恒为 body.x + 12
const cx = this.body.x + this.body.w / 2;     // 头部水平中心 = body.x + 12（FULL & SMALL 同）
const HEAD_CROWN_DY = 2;                       // 头顶 Crown 相对 body 顶偏移
const topY = this.body.y + HEAD_CROWN_DY;      // 头顶锚点 y

// topperGfx：create() 中建 this.topperGfx = this.add.graphics().setDepth(12)
this.topperGfx.clear();
drawMaliTopper(
  this.topperGfx,
  cx, topY,                 // 锚点（bottom-center 向上绘）
  this.currentStage,        // 'sprout'|'vine'|'bloom'|'fruit'（或 0..3）
  this.growthPct,           // 0..1（驱动 micro-sway 幅度 / 可选混合）
  this.auraState,           // {alpha, radius} 经 METAMORPHOSIS tween 后的值
  this.damage.sizeScale,    // 当前 1 / 0.6（见 §4.3）
  this.controller.state.facing
);
```

### 4.3 深度 / sizeScale / 协调点

- **深度**：`topperGfx` 深度建议 **12**（sprite=10 < flash=11 < topper=12），使顶饰压在受击红闪之上、不被身体红叠遮盖；顶饰本身在 hurt 时不随身体红闪（保持绿/黄，可接受）。
- **sizeScale**：当前 demo 角色视觉**未实际缩放**（placeholder 恒绘 24×34，`stepSim` 仅缩 `h` 物理盒）。故 MVP 顶饰 `sizeScale` 传 1（不缩放）即可对齐。⚠️ 待主理人/工程确认：若后续角色视觉真正 0.6 缩放，则 `topperGfx.setScale(sizeScale)` 同步缩放，保持贴合。
- **协调点（重要）**：`placeholder.ts:22-26` 已硬编码一枚嫩芽点 `(12,4)`。实现 topper 后**应移除该硬编码点**，改由 `drawMaliTopper` 统一绘制 stage0 苗（避免双芽重叠）。此改动属工程实现范围，提请注意。

---

## 5. 实现备注（mali-topper.ts）

- **文件**：`src/game/render/mali-topper.ts`，导出 `drawMaliTopper(g, cx, topY, stage, maturity, aura, sizeScale, facing)`。
- **风格**：与 `seed-view.ts` 一致——纯 `Phaser.GameObjects.Graphics` 程序化绘制，零 PNG 依赖；每帧 `clear()` 后重绘（与 enemy/projectile 同模式）。
- **computeGrowth 参考实现**（阈值来自 asset-spec §1.3，供工程直接取数）：
  ```ts
  const TH = [0.25, 0.5, 0.75];
  function stageFromMaturity(m: number): 0|1|2|3 {
    if (m < TH[0]) return 0; if (m < TH[1]) return 1; if (m < TH[2]) return 2; return 3;
  }
  // aura 表：[[0,0],[0.15,18],[0.30,24],[0.50,30]][stage]
  ```
- **事件接线**：`ON_SEED_METAMORPHOSIS(stage)` → 设 `currentStage` + 起 aura alpha/radius ease-out tween（≤0.4s）。`ON_SEED_GROWTH` 仅更新 `growthPct`（sway 幅度），不改 stage。
- **图集换皮目标**（后续 E8/S06，非 MVP）：本规格即 `char_mali_top_0~3`（各 12×16）+ `fx_glow_mali`（径向暖黄 PNG-32）的绘制蓝本；届时 `drawMaliTopper` 可改为贴图，坐标系不变。

---

## 6. 颜色裁定（收口 · 两处取色）

### 6.1 暖黄光晕色 — 裁定 `#FFD23F`（art-bible 权威，单一暖黄）
- **裁定**：暖黄光晕**唯一权威值 = `#FFD23F`**，与 art-bible §1.3 / asset-spec §1.3 / GDD 12 §3.8 一致；**显式覆盖**本规格早前 `#FFD27F` 备注（原为主理人临时指定，现收口至圣经锁色）。
- 理由：全项目锁一份暖黄色板（`#FFD23F` 已用于花瓣 / 高光），aura 与其共用同一 hex，避免引入 `#FFD27F` 这类近义第二暖黄、破坏 ≤64 色调色板一致性。
- 光晕径向由同心圆 alpha 递增模拟（§2 程序化近似），无需独立核心色。

### 6.2 果阶段填充 — 裁定 `#F2933C`（暖橙，palette-locked）
- **裁定**：果主体填充 = **暖橙 `#F2933C`**（美术圣经 §3.1 暖橙，palette-locked），**不新增莓红 hex**。
- 理由：① `#F2933C` 已在锁色板（泥土 / 木质暖橙），零新增色；② 橙 = 成熟果实语义清晰，与草绿嫩芽 / 暖黄花瓣形成「绿 → 黄 → 橙」成熟递进；③ 避用增益紫 `#9B6CF2`、且与警示红 `#E8483B` 区分（橙 ≠ 红，形状 + 色相双编码安全）。
- 果 = 暖橙 `#F2933C` 主体 + 草绿 `#7CC242` 叶帽 + 暖黄 `#FFD23F` 高光弧；呼应元气果"果实 + 嫩芽"形状但**绝不用紫**。

---

## 7. IP 合规

- 成长隐喻 = "苗→藤→花→果"自然生长，全原创，**无** 蘑菇/星/旗杆/龟壳等任天堂符号。
- **禁用增益紫 `#9B6CF2`**：果阶段用草绿 `#7CC242`（叶帽）+ 暖橙 `#F2933C`（果体）+ 暖黄 `#FFD23F`（高光），与元气果（紫果）在颜色与归属上双重区分（果为身体配件、非拾取物）。✅ 契合 ip-review 红线。

---

## 8. G8⑤ 资产占位状态报告

> G8 = sprint-04-plan §4.3 九门之一「开放问题关闭」；**⑤ = 其 §0.3 偏差⑤「资产就绪」**：要求 art-director 在 Sprint 06 前产出合规占位/正式资产，当前**全量资产仍为 Graphics 占位**（见 sprint-04-plan §0.3 偏差⑤、R7；ip-review §4 结论 PASS 仅指"占位造型语义合规"，非最终像素）。

### 8.1 本次 topper 性质
- **本规格 = 最终视觉契约**（阈值/色板/体量/光晕全锁）。
- 但 MVP 以**程序化 Graphics** 实现（与当前 demo 全量 Graphics 一致），**不是 PNG 图集精灵**。
- 结论：**最终规格、程序化落地（非占位形状，亦非最终 atlas PNG）**；`char_mali_top_0~3` atlas 精灵列为"后续换皮目标"。

### 8.2 仍占位 / 未最终化资产（聚焦 topper / 种子相关）

| 实体 | 当前状态 | 与 topper/种子关系 | 来源 |
|---|---|---|---|
| **栗宝蜕变 topper（苗/藤/花/果）** | **无绘制**（ip-review §5 标"无"）→ 本规格首次定义，将由 `mali-topper.ts` 程序化实现 | **直接相关（本职）** | ip-review §5 / asset-spec §1.3 |
| **暖黄光晕 `fx_glow_mali`** | 无绘制 → 随 topper 程序化实现 | 直接相关 | asset-spec §1.3 |
| **种子实体（drawSeed）** | 已程序化绘制（`seed-view.ts`，栗色种壳+草绿双叶），IP 合规 PASS（ip-review #8） | 蜕变母题本体，已就绪（procedural placeholder） | ip-review #8 |
| 栗宝 FULL/SMALL 本体 | 占位圆角块（`placeholder.ts`），**未最终** | topper 锚定其上 | ip-review §5 |
| 元气果 `prop_buff_fruit` | **未绘制**（ip-review #9 待绘） | 与果 topper 形状呼应但颜色区分（紫 vs 绿/黄） | ip-review #9 |
| 爱心 `prop_heart`（world） | **未绘制**（ip-review #10 待绘） | 无关 | ip-review #10 |
| 凯旋之门 / 四敌 / 地形 / 金币 等 | 占位 Graphics，IP 合规但**非最终像素** | 无关 | ip-review §5 |

### 8.3 G8⑤ 判定
- topper 从"无"→"已定义 + 已程序化实现"，资产就绪度已达标（详见 §10 关闭判定，**G8⑤ = CLOSED**）；整体资产仍处 Graphics 占位期（与 sprint-04-plan R7 一致），**MVP 保留程序化占位（与全局一致）**，正式图集换皮路径见 §10.4。
- 本规格即**唯一权威视觉契约**（阈值 / 头顶点位 / 尺寸 / 配色 / 光晕 / 单脉冲时长 全锁），满足"art-director 产出合规视觉契约"前置；实现（`mali-topper.ts`）由 engineering-lead 据本规格完成。

---

## 9. 待主理人 / 工程确认项

1. **两处取色裁定（已收口，见 §6）**：① 暖黄光晕 = `#FFD23F`（art-bible 权威，覆盖早前 `#FFD27F` 备注）；② 果填充 = 暖橙 `#F2933C`（palette-locked，不新增莓红）。其余取色已对齐 art-bible：草绿 `#7CC242`（嫩芽/藤/花萼）、花瓣暖黄 `#FFD23F`、描边 `#2A1A12`。
2. **sizeScale 与顶饰缩放**：当前角色视觉未实际 0.6 缩放，MVP 顶饰 `sizeScale=1`；若后续角色视觉真正缩放，需 `topperGfx.setScale(sizeScale)` 同步（§4.3）。
3. **移除 placeholder 硬编码嫩芽点**：实现 topper 时删 `placeholder.ts:22-26` 的嫩芽，改由 `drawMaliTopper` 统一绘制（§4.3）。
4. **果阶段 `scale +0.05` 渲染膨胀**：确认在角色绘制层实现（render-only），topper 不负责（§1.2 注）。

---

> 美术指导 林绘澄 · 本文件为 GDD 12 视觉蜕变落地规格，供 `mali-topper.ts` 实现与后续 atlas 换皮共引。

---

## 10. G8⑤ 关闭判定 + 正式图集换皮规格（主理人判门用 · 置于规格末）

**G8⑤ = sprint-04-plan §4.3 G8「开放问题关闭」之 ⑤「资产就绪」**：要求 art-director 在 Sprint 06 前产出合规占位 / 正式资产。本 § 把原 OPEN 状态**转为正式像素/图集规格 + 关闭结论**。

### 10.0 一句话结论

**G8⑤ = PASS（CONCERNS）** —— 美术侧已交付合规视觉契约（本文件全锁）+ 程序化实现已 live（IP/色板/可访问性达标），**OPEN 状态关闭**；MVP 保留程序化占位（与全局全量 Graphics 一致），正式图集换皮路径见 §10.4，归 engineering-lead。

---

### 10.1 四阶段 topper 图集切片规格（atlas 换皮目标）

| 切片名 | 画布(px) | 帧数 | 锚点 | 配色（描边均 `#2A1A12`，禁增益紫） | 说明 |
|---|---|---|---|---|---|
| `char_mali_top_0` | `12×16` | 1（静态） | bottom-center `(0,0)`，向上生长 | 草绿 `#7CC242`（茎+1小叶） | 苗 sprout |
| `char_mali_top_1` | `12×16` | 1 | 同上 | 草绿 `#7CC242`（茎+2–3 小叶） | 藤 vine |
| `char_mali_top_2` | `12×16` | 1 | 同上 | 草绿 `#7CC242`（茎+萼）+ 暖黄 `#FFD23F`（5 瓣） | 花 bloom |
| `char_mali_top_3` | `12×16` | 1 | 同上 | 暖橙 `#F2933C`（果体）+ 草绿 `#7CC242`（叶帽）+ 暖黄 `#FFD23F`（高光） | 果 fruit |

- **命名前缀**：`char_`（asset-spec §6.2）；与 `char_mali` 本体精灵同 atlas。
- **动画策略**：topper **无独立动画帧**（4 帧即 4 stage）；micro-sway 由运行时对精灵做 micro-rotation（复用 idle 呼吸相位，幅度随 stage 增大），**不计入图集帧**（spec §3）。
- **建议切片坐标（示意，最终由 `free-tex-packer` 自动排布，2048×2048 atlas 内）**：横排 4 片 + 2px padding，光晕另置。

  | 帧 | 示意 x | y | w×h |
  |---|---|---|---|
  | `char_mali_top_0` | 0 | 0 | 12×16 |
  | `char_mali_top_1` | 14 | 0 | 12×16 |
  | `char_mali_top_2` | 28 | 0 | 12×16 |
  | `char_mali_top_3` | 42 | 0 | 12×16 |
  | `fx_glow_mali` | 56 | 0 | 64×64（径向暖黄，半径 30→直径 60，pad 到 64） |

- **光晕贴图 `fx_glow_mali`**：径向暖黄 `#FFD23F`（PNG-32 半透明），归 `fx_` 组；α/radius 由 `GrowthVisual` 程序 tween（spec §1.3 / §2）。

---

### 10.2 暖黄光晕参数表（α / r）

> 权威值来自 spec §1.4 / §2；色板仅用锁色暖黄 `#FFD23F`，禁增益紫。

| stage | 稳态 α | 稳态 r(px) | 蜕变脉冲 α(峰) | 脉冲 r(峰) | 单脉冲时长 | 中心 |
|---|---|---|---|---|---|---|
| 0 苗 | 0 | 0 | — | — | — | — |
| 1 藤 | 0.15 | 18 | 0.15 | 18 | ≤0.4s ease-out | `(cx, topY-6)` |
| 2 花 | 0.30 | 24 | 0.30 | 24 | ≤0.4s ease-out | `(cx, topY-6)` |
| 3 果 | 0.50 | 30 | 0.50 | 30 | ≤0.4s ease-out | `(cx, topY-6)` |

- **防光敏硬底线**：单次脉冲 ≤0.4s、非重复、非 strobe、整体 <3Hz（accessibility #10 / spec §2.1）。
- **Reduce Motion**：开启时脉冲 tween 跳终值 / 停首帧，不播放过渡（spec §2.1）。

---

### 10.3 与现有程序化占位的映射关系（implementation drift 清单）

| 规格要求 | 程序化实现现状（`mali-topper.ts` / `game-scene.ts`） | 偏差 | 处理 |
|---|---|---|---|
| 四阶段形状（苗/藤/花/果） | `drawMaliTopper` 四分支齐全，形状与 spec §1.2 基本一致 | 苗分支树叶略简化（spec 多点，实现 2 小叶）；属细节 | 换皮严格按 spec §1.2 像素化；可接受 |
| 每 stage 稳态光晕 α/r 阶梯 | `playMetamorphAura` 仅在蜕变时一次性脉冲（`0→0.6→0`，scale `0.3→1.25`），**无稳态光晕** | 缺失稳态光晕；脉冲峰 α=0.6（> 稳态 0.50，但 ≤0.6 cap） | 换皮加稳态光晕对象（S3，CONCERNS） |
| 光晕中心 `(cx, topY-6)` 头顶上方 | 实现置于 body 中心 `(cx, cy)`（`game-scene.ts:328`） | 位置偏移约半身高 | 换皮修正锚点到 `topY-6`（S2，低） |
| `drawMaliTopper(g,cx,topY,stage,maturity,aura,sizeScale,facing)` | 实际 `(g,cx,topY,stage)` 4 参 | 简化签名（maturity/aura/sizeScale/facing 未传） | 换皮改贴图模式无需这些参数；可接受 |
| 移除 `placeholder.ts` 硬编码嫩芽点 | **未移除**（`placeholder.ts:22-26` 仍在），与 topper stage0 苗叠加 | **双重芽点**（stage0 头顶两芽） | 占位期即移除（S1，**真机最高优先修复**，eng） |
| Reduce Motion 关闭光晕 tween | 未接 Reduce Motion 开关 | 光晕不随减少动态关闭 | 全局 Reduce Motion 落地时 gate（D3，中） |

---

### 10.4 可落地生产清单（MVP 保留程序化占位 + 后续换皮）

**MVP 判定：保留程序化占位，G8⑤ 关闭。**
- 理由：① 全项目资产均占位期，topper 不另设门禁；② 程序化实现已 IP 无符号 / 色板仅用锁色（草绿 `#7CC242`、暖黄 `#FFD23F`、暖橙 `#F2933C`、描边 `#2A1A12`）/ 可访问性（形状编码 + 光晕 <3Hz + 头顶安全）达标；③ 图集换皮属全局像素化里程碑，非 topper 单点阻断。

**后续换皮路径（归 engineering-lead，非 MVP 阻断）**：
1. 产出 `char_mali_top_0~3`（12×16，4 帧）像素精灵 + `fx_glow_mali`（PNG-32 径向暖黄），按 §10.1 切片。
2. 接入 `free-tex-packer` 单 atlas（ADR-004，≤1MB；topper 4 帧+光晕 <2KB，对 ≤300KB 预算无影响）。
3. `drawMaliTopper` 改为贴图：按 `currentSeedStage` 选帧，位置对齐 `(cx, topY)`，sizeScale 同步缩放（spec §4.3）。
4. 稳态光晕：按 §10.2 α/r 表常驻或 tween；蜕变时 pulse ≤0.4s；中心 `(cx, topY-6)`。
5. 修正光晕中心到 `(cx, topY-6)`；移除 `placeholder.ts` 硬编码嫩芽点（消除双芽 S1）。
6. 接 Reduce Motion：开启时跳过光晕 tween / 停首帧（D3）。
7. 像素化须整数网格对齐（`pixelArt:true` + `roundPixels`），保证缩放后 topper 圆/线不糊不抖（G3 真机核对项）。

---

### 10.5 G8⑤ 关闭判定（主理人判门）

- **判定**：**PASS（CONCERNS）**。状态 **OPEN → CLOSED**。
- **理由（PASS）**：
  1. 美术已交付合规视觉契约（本文件阈值/坐标/尺寸/配色/光晕/脉冲时长全锁）；
  2. 程序化实现已 live（`mali-topper.ts` + `game-scene.ts` 接线），IP 无任天堂符号、色板仅用锁色、可访问性（形状编码 + 光晕 <3Hz）达标；
  3. 全局 MVP 即程序化占位，topper 不另设门禁，符合 sprint-04-plan R7 的"占位就绪"口径。
- **CONCERNS（非阻断，记 engineering-lead 跟进）**：① S1 双芽点（placeholder 硬编码未移除）② S3 稳态光晕缺失（仅瞬脉冲）③ S2 光晕中心偏移 ④ D3 Reduce Motion 未接光晕。均属像素化/打磨期修复，不阻塞 G8⑤ 关闭。
- **后续**：随全局像素化里程碑（Sprint 06 后）统一换皮时一并落实 §10.4。

> 美术指导 林绘澄 · G8⑤ 关闭登记于 `art/asset-audit-phase6.md` §8 / 本 §10。
