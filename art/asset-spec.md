# super-mali 资产规格（Asset Spec）— 正式生产合同 · Phase 4

> 文档类型：**正式可交付资产规格**（升级自 `art/placeholder-spec.md` 开发期占位 + 收敛自 `art/asset-manifest.md` 实体清单）
> 作者：art-director（林绘澄）
> 上游依据：`art/art-bible.md` v1.1（视觉身份九节）、`art/accessibility.md`（MVP = Standard）、`art/asset-manifest.md`、`art/placeholder-spec.md`、`art/ui/touch-buttons-spec.md`、`design/ux/hud-spec.md`、`design/gdd/04-enemy-ai.md`、`design/gdd/11-meta-progression.md`、`design/gdd/08-ui-hud.md`、`design/gdd/05-level-system.md`、`design/gdd/09-audio-placeholder.md`、`docs/architecture/adr/ADR-004`、`MEMORY.md`（IP 红线）
> 评审强度：lean（聚焦"下一步实际要生产什么"，不写代码）
> 用途：美术与程序的 brief——把"占位跑通"升级为"正式生产"的对齐合同；所有配色/尺寸引用既有约定，新增资产标注来源。

---

## 0. 范围与对齐声明

- **本文件替代 / 升级关系**：`placeholder-spec.md` 是 Sprint 1 开发期占位速查（纯色块 + Graphics 绘制），**仅用于跑通闭环**；本文件是其**正式替代与补充**，定义下一步真实生产资产。两者并存期以本文件为准。
- **实体清单真理源**：`asset-manifest.md` §1–§3 的实体 id / 尺寸 / 碰撞盒已锁定，本文件在其上**细化动画、配色、可踩视觉语言、蜕变视觉、音频、管线**，不重造 id。
- **IP 红线（强制，来自 MEMORY.md）**：禁用水管工 / 蘑菇 / 星星 / 旗杆 / 龟壳等任天堂符号；角色与美术全原创。本文件所有造型均经此红线核对（见各小节 ✅ 标记）。
- **可访问性基线**：MVP 目标档 = **Standard**（色盲辅助开关 + 减少动态开关 + 文字 ≥14px + 热区 ≥48×48 + 屏宽 10% 边距）；Basic 底线（防光敏 <3Hz、热区 ≥48×48）不可降级。所有资产落地映射见 §6。
- **混合渲染（已锁定）**：游戏世界（角色/敌人/地形/道具/特效）= 像素；HUD/菜单/中文 = 矢量 + 运行时系统字体，**不入像素图集**（美术圣经 §2.6 + ADR-004）。

---

## 1. 角色栗宝（主角）

### 1.1 FULL / SMALL 两形态（对齐 damage sizeScale 1 / 0.6）

| 形态 | 画布(px) | 碰撞盒 AABB | sizeScale | 来源 |
|---|---|---|---|---|
| **FULL** | `32×40`（w×h） | `24×34`（画布内缩 `(4,4)` 居中） | `1` | damage-config `fullScale:1`；manifest §2.1 锁定约定 |
| **SMALL** | **运行时 scale 0.6 → ≈20×24** | `≈14×20` | `0.6` | damage-config `smallScale:0.6`；**不另绘**，复用 FULL 帧缩放 |

> **碰撞/画布对齐约定（已锁定，不得违背）**：碰撞盒驱动、画布仅为视觉。物理 `Body` = 24×34（FULL），SMALL 运行时 ×0.6 同步缩放；渲染精灵用 32×40 画布按 `(4,4)` 偏移对齐碰撞盒原点，缩放时碰撞与精灵同步、不穿地/不悬空（manifest §2.1，engineering-lead 已确认）。

### 1.2 动画清单（锚点统一 = 画布底中 `(0.5, 1.0)`，对齐地面 / squash-stretch / flipX）

| 状态 | 帧数 | 帧率 | 锚点 | 说明 |
|---|---|---|---|---|
| `idle` 待机 | 4 | ~6fps | (0.5,1.0) | ±1px 浮动 + 嫩芽摆（sway）；呼吸节奏驱动蜕变 topper 微摆 |
| `run` 跑 | 8 | ~12fps | (0.5,1.0) | "风火轮"短腿循环 |
| `jump` 跳（上升） | 2 | 姿态保持（非循环） | (0.5,1.0) | 起跳 squash → 上升 stretch；顶点切换 `fall` |
| `double-jump` 二段跳 | 2 | ~10fps（一次性） | (0.5,1.0) | 空中二段：身体微旋 + 嫩芽 flare + 下压气浪提示（与 `jump` 区分） |
| `fall` 下落 | 2 | 姿态保持 | (0.5,1.0) | 手臂上扬 / 腿微张 pose |
| `hurt` 受伤 | **0（复用 FULL）** | — | — | iframe 1500ms alpha 闪烁 + 受击闪红叠加（hud-spec §5）；**无独立帧**，与现有受伤链路一致 |
| `death` 死亡 | 3 | ~8fps | (0.5,1.0) | **P1 可选**：squish → poof → 柔和消失（非血腥），衔接 Game Over 覆盖层（见 §8 Q3） |

- 绘制帧合计 ≈ **21**（含 death）/ **18**（不含，MVP 可先不产 death）。
- **SMALL 形态**：上述所有状态运行时 scale 0.6 渲染，不另绘。
- **朝向**：绘制朝右单组帧 + 运行时 `flipX`（`facing:1|-1`）。
- **调色板（引用美术圣经 §3/§4.2，无新 hex）**：主体 栗色 `#B5763E`；浅肚皮 `#F0D9B5`；暖黄高光 `#FFD23F`；嫩芽 草绿 `#7CC242`；腮红（装饰非功能）`#E89B8B`；描边 近黑棕 `#2A1A12`。

### 1.3 种子蜕变成长视觉（差异内核 · 参数化，非写死单一形态）

> 栗宝 = "种子精灵"（MEMORY「差异内核：种子精灵蜕变成长系统」）。其视觉成熟度由**参数驱动**，美术绘制离散 stage 配件，程序按 `maturity` 切换/混合。此为"差异内核"的工程落地：kernel 是纯函数，资产是 stage 资源。

**GrowthKernel 参数契约（给程序）**
```ts
interface GrowthParams {
  source: 'meta' | 'run' | 'hybrid';  // 参数来源（TBD，见 §8 Q1）
  seedsCollected?: number;  // 跨关累计（meta）
  buffsActive?: number;     // 局内增益层数（run）
  maturity: number;         // 归一化 0..1（由 source 推导）
}
interface GrowthVisual {
  stage: 0|1|2|3;     // 苗 / 藤 / 花 / 果
  sproutLen: number;    // 头顶配件高度(px)
  leafCount: number;
  bodyTint: number;     // 叠加色（暖黄为主，禁用增益紫）
  auraAlpha: number;    // 光晕透明度 0..0.6
  auraRadius: number;   // 光晕半径(px)
}
function computeGrowth(p: GrowthParams): GrowthVisual  // 纯函数；美术给阈值/资源，程序驱动
```
**Stage 阈值**：`m<0.25`→苗(0)｜`0.25≤m<0.5`→藤(1)｜`0.5≤m<0.75`→花(2)｜`m≥0.75`→果(3)。

**各 stage 视觉演进（全部引用既有色板，禁用增益紫 `#9B6CF2` 道具独占色）**

| stage | 头顶配件 | 身体 | 光晕（暖黄 `#FFD23F`） | 说明 |
|---|---|---|---|---|
| 0 苗 | 1 小叶（草绿 `#7CC242` ~3px） | 基准 §4.2 | 无 | 当前 FULL 形态 |
| 1 藤 | 2–3 小叶 + 微伸茎（~6px） | 暖黄高光带略增 | alpha 0.15 / r 18 | 生长感初现 |
| 2 花 | 茎顶小花瓣（暖黄 `#FFD23F` 瓣 + 草绿萼） | 略提亮 | alpha 0.30 / r 24 | 盛放 |
| 3 果 | 茎顶小果芽（草绿/暖黄，呼应元气果**形状**但为身体配件、非拾取物） | 视觉微胀 scale +0.05（**仅渲染，碰撞盒不变**，守 damage-config） | alpha 0.50 / r 30 | 成熟 |

**美术交付物（参数化，非写死）**
- 头顶配件 overlay 精灵：`char_mali_top_0/1/2/3`，各 ~`12×16` 画布，草绿 + 暖黄，描边 `#2A1A12`；锚定栗宝头顶（画布顶中，按 FULL/SMALL 偏移）。
- 光晕贴图：`fx_glow_mali` 径向 暖黄 `#FFD23F`，PNG-32（半透明），归 fx 组；alpha/radius 由 `GrowthVisual` 程序 tween。
- 动画：现有 idle/run/jump 等**不新增状态**，sprout 部分随 stage 增大 sway 幅度（topper 叠加 micro-rotation，复用 idle 呼吸节奏）。
- **IP 合规**：用"苗→藤→花→果"自然生长隐喻，全原创；果形态仅作身体配件、非独立拾取物，且**避用增益紫**（与元气果明确区分）。✅

**HUD 形态图标联动**（hud-spec §3.2）：FULL 态下形态栗宝头像叠加当前 stage topper；SMALL 态暗化（`#8A6A4A`）+ topper 缩放。

---

## 2. 四敌人（各自独立小节）

> 通用：每敌带 `topIndicator: 'soft' | 'hard'` 属性（供程序/HUD 一致性检查）；美术据此绘制顶缘。**可踩顶 = 软（圆润/柔边/无刺）｜不可踩顶 = 硬（尖角/硬棱/炮口）**，色盲安全靠**形状语言**而非仅颜色，警示红 `#E8483B` 仅作强化。

### 2.1 刺栗 `ci_li`（地面慢 / 可踩 / 圆+刺 / 警示红）
- **造型（✅ 原创，非龟壳/刺猬）**：圆球 + 周身短刺（**向外侧**，顶缘无刺），警示红 `#E8483B` 主体，深红 `#B5302A` 刺尖/阴影，白眼，描边 `#2A1A12`。
- **尺寸**：画布 `32×32`，AABB `28×28`（圆）。对齐 `SPEED=40`（慢速巡逻）。
- **动画**：`patrol` 4f @8fps（滚动/抖动）；`stomped` 3f @12fps（啪叽压扁消失）。
- **可踩视觉暗示：soft**——顶部圆润 dome，刺只朝侧向/下；顶缘一圈浅高光（暖色，非警示红）→ 形状语言"可站"。色盲安全：圆 + 顶部无刺。

### 2.2 冲锋怪 锥冲 `chong_feng`（地面冲锋 / 不可踩 / 长条楔形 / 警示红 #E8483B）— 重点
- **造型（✅ 原创，非龟壳）**：长条楔形（前尖后宽），**警示红 `#E8483B` 主体**（与刺栗同色，靠楔形轮廓区分；原"钢蓝 `#3D6FB4`"规格已 superseded，S04-2 渲染已落地），深红 `#B5302A` 背光/阴影（复用刺栗阴影色），浅红 `#F2A39C` 前缘高光强化楔形尖，白眼，描边 `#2A1A12`。
- **尺寸**：画布 `48×28`，AABB `44×22`。对齐 `DETECT_X=160`、高度差 `<48`、`CHARGE_SPEED=220`、`STUN=1000`（见 §8 Q4）。
- **动画**：`idle` 2f；`detect` 2f（前端尖闪 + 身体前倾）；`charge` 6f @10fps（蓄势→启动→冲刺拉长 + 速度线→峰值→收→复位）；`stun` 2f（撞墙眩晕，顶旋星标、身体歪斜；**此期 non-hazard**）。
- **可踩视觉暗示：hard**——楔形前尖（警示红主体 + 浅红高光强调尖角）= "硬/别碰顶"；顶部硬棱/尖，形状双编码为主、色为辅（与刺栗圆球软顶区分）。色盲安全：楔形尖角轮廓。`stompable=false`（踩则玩家伤）。
- **配色权威（supersede）**：主理人拍板 `chong_feng` 权威配色 = **警示红 `#E8483B`**（危险暗示强，与可踩敌 soft 圆顶对比）；原"钢蓝 `#3D6FB4`"规格已撤销。与 `ci_li` 同为警示红，靠**形状双编码**（圆球带刺 vs 长条楔形）区分；剪影即可辨能否踩，色盲安全，无歧义（已知权衡，非阻断）。

### 2.3 嘟浮 `du_fu`（飞行 / 可踩 / 扁圆+翅 / 蓝紫）
- **造型（✅ 原创，非星星/鸟）**：扁圆 + 两片小翅（半透），蓝紫 `#6E7BF2` 主体，浅 `#A9B8F5` 高光，翅膜半透，白眼，描边 `#2A1A12`。**避用增益紫 `#9B6CF2`**（道具独占）。
- **尺寸**：画布 `36×32`（含翅展），body AABB `24×24`（翅不碰撞）。对齐 `FLOAT_SPEED=60`、`AMP=24`。
- **动画**：`float` 4f @8fps（翅扇 + 正弦上下）；`stomped` 3f @12fps。
- **可踩视觉暗示：soft**——扁圆顶（圆润、无尖），翅在两侧（非顶）。色盲安全：扁圆 + 翅。`stompable=true`。

### 2.4 石炮 `shi_pao`（固定炮台 / 不可踩 / 方+灰）
- **造型（✅ 原创，非水管/炮塔符号）**：方正石块 + 炮口，石灰白 `#F4EFE6` 石身，深灰 `#8A8276` 炮管/阴影，炮口闪 暖黄/警示红，描边 `#2A1A12`。
- **尺寸**：画布 `32×32` = AABB `32×32` 实心（与瓦片同格）。对齐 `FIRE_INTERVAL=2000`、`PROJECTILE_SPEED=180`。
- **动画**：`idle` 1f；`aim` 2f（朝玩家倾转）；`fire` 2f（后坐 + 炮口闪）；`cooldown` 1f。
- **可踩视觉暗示：hard**——方形硬顶 + 炮口开口（明确"硬/危险，别站"）；炮口可用警示红描边强化（形状为主）。色盲安全：方 + 硬棱 + 炮口。`stompable=false`。
- **弹丸 `fx_projectile`**：画布 `16×16`，警示红 `#E8483B` + 暖黄 `#FFD23F` 拖尾，描边；AABB `10×10`；独立 hazard，碰玩家受伤。

### 2.5 四敌可踩/不可踩视觉语言汇总（系统性规则）

| 敌 | topIndicator | 顶缘形状语言 | 强化色（仅辅助） | stompable |
|---|---|---|---|---|
| 刺栗 | soft | 圆润 dome，刺朝侧/下，顶无刺 | — | ✅ |
| 嘟浮 | soft | 扁圆顶，翅在侧 | — | ✅ |
| 锥冲 | hard | 楔形前尖 / 硬棱 | 警示红（全主体，靠楔形轮廓区分刺栗） | ❌ |
| 石炮 | hard | 方硬顶 + 炮口开口 | 警示红描边 | ❌ |

> 色盲安全底线：所有敌人最小显示尺寸（≈32px）下仅凭**剪影/顶缘形状**即可判断"能否踩"；颜色仅强化不单独承担语义（accessibility §2.2/#1）。

---

## 3. 瓦片与主题

### 3.1 32px 网格瓦片集（草原 base，洞穴/天空 tint）

| 瓦片 | 内容 | 配色（引用圣经 §3） |
|---|---|---|
| `ground_top` | 草顶 + 暖橙泥身 | 草绿 `#7CC242` 顶（亮草边 4px）+ 暖橙 `#F2933C` 泥 |
| `ground_fill` | 泥身 | 暖橙 `#F2933C` |
| `ground_top_L` / `ground_top_R` | 边角 | 同 ground_top |
| `platform` | 单向平台 | 薄（8–12px 厚）草绿顶 |
| `slope` | 斜坡（可选） | 45° 半砖 |
| `interactive_block` | 互动块（替代"?"） | 石灰白 `#F4EFE6` + 互动青 `#3FC7B4` 外发光 + 中心"✦"；pop 2f |
| `deco_bush` / `deco_flower` / `deco_crystal` / `deco_vine` | 装饰（非碰撞） | 主题色 |

- 约 **12–16 块/主题**；瓦片静态（1f），仅 `interactive_block` pop 2f。碰撞由 LevelData `tiles[].solid` 决定（GDD 05）。
- **主题切换 = 换色不换形**（已定，用户拍板）：绘 1 份基础瓦片集，洞穴（冷蓝灰 `#4A78C0` + 暖橙火光）/ 天空（天蓝 `#5BC8F5` + 暖黄云）经**运行时 tint / 调色板映射**生成（省图集）；仅主题独有装饰（钟乳、浮岛）另绘少量。结构与功能色语义不变（GDD 05 §3）。

### 3.2 凯旋之门 `goal_triumph_gate`（替代旗杆 ✅ 原创）
- **尺寸**：`64×96`（2 格宽 × 3 格高）。
- **动画**：`idle` 1f；`activate` 通关 4f（亮起 + 光爆）。
- **碰撞**：重叠触发区（非实心）→ `ON_LEVEL_COMPLETE`（GDD 05）。
- **配色**：互动青 `#3FC7B4` 光 + 暖黄 `#FFD23F` 光柱 + 石灰白 `#F4EFE6` 门框；规避旗杆符号。✅

---

## 4. UI 矢量项（对齐 hud-spec 与 08-ui-hud；混合 UI，不入像素图集）

> 渲染层：矢量 Graphics + 运行时系统字体（ADR-004 + 美术圣经 §2.6 + 08-ui-hud）。**不进入像素 atlas**。共享色板 + 统一描边 `#2A1A12`。中文 ≥14px 等效；触控热区 ≥48×48（Basic 强制）。

| 项 | 规格 | 状态 |
|---|---|---|
| **`ui_heart`** 命数心形 | 实心（满，生命粉红 `#F26D8B` 填充）/ 空心（失，仅描边轮廓）16×16，间距 4px；**形状区分**（非仅颜色，accessibility） | ✅ **已对齐既有实现**（hud-spec §3.1） |
| **形态栗宝头像** | FULL 16×16 栗色 `#B5763E` + 嫩芽草绿；SMALL ~10×10 暗化（`#8A6A4A`）+ 可叠加蜕变 stage topper | ✅ **已对齐既有实现**（hud-spec §3.2） |
| **`ui_coin`** 分数/金币显示 | 矢量金币图标（金币金 `#FFC93C` + 中心星点暖黄 `#FFD23F`）~16×16 + 数字（系统字体） | 🆕 **新增待生产**（hud-spec 未覆盖，08-ui-hud 仅提"中上分数/金币"） |
| **`ui_star`** 结算星级 | **原创菱形星**（非五角星 IP 符号 ✅，bible §7.2）；填充 暖黄 `#FFD23F` / 空 描边；基于 time+金币率双维度各 50%（08-ui-hud A4） | 🆕 **新增待生产** |
| **暂停 / 结算 / 主菜单 按钮与面板** | 半透明圆角底板（石灰白 60% + 暖描边 `#2A1A12`）；大圆角按钮（继续/重玩/开始）文字 ≥14px；Game Over 暗罩（黑 0.6，"游戏结束"/"点击重试"，温柔非恐吓 ✅） | 暂停/GameOver ✅ 部分已对齐（hud-spec §6）；**主菜单 MENU 态 🆕 新增**（08-ui-hud A1 保留未实现） |
| **`ui_progress`** 进度条 | 顶部细条，随玩家 x 0→1；圆角 + 暖色填充（暖黄/草绿）+ 描边；凯旋之门图标作终点标记 | 🆕 **新增待生产**（08-ui-hud 提"顶部进度条"但未规格） |
| **触屏四按钮** | 变体 B（像素图标圆钮 + 双层配色），Graphics 实时绘制，**零新增资产** | ✅ **已对齐**（touch-buttons-spec，引用不重述） |

---

## 5. 音频资产清单

### 5.1 统一 SfxName（调和 GDD 09 枚举 ↔ 任务书意图）

**已锁定（GDD 09 枚举，代码合同，不可改）**

| SfxName | 触发点 | 音色方向（占位=WebAudio 合成） |
|---|---|---|
| `SFX_JUMP` | 03 起跳 | 短促上滑方波 blip（~120ms，320→520Hz） |
| `SFX_DOUBLE_JUMP` | 03 空中二段跳 | 更亮上滑（520→720Hz）区别于一段 |
| `SFX_STOMP` | 04 顶踩死 | "啪叽"短噪声 burst + 低频 thud |
| `SFX_LAND` | 03 着地 | 闷响短低音（更柔、无噪声，区别于 stomp） |
| `SFX_HURT` | 07 `ON_HURT` | 下行锯齿短音（警示感、非刺耳） |
| `SFX_COIN` | 06 拾币 | 明亮双音上行（原创波形） |
| `SFX_POWERUP` | 06 元气果 / **蜕变 stage up** | 上行琶音 sparkle（呼应"成长"） |
| `SFX_CLEAR` | 05 `ON_LEVEL_COMPLETE`（凯旋之门） | 胜利小调和弦（暖、非恐吓） |
| `SFX_FIRE` | 04 石炮发射 | 短促"噗"噪声 + 下滑 |

**建议扩展（任务书意图含 death/checkpoint/ui，GDD 09 无此三项 → 待 §8 Q2 拍板）**

| SfxName（proposed） | 触发点 | 音色方向 |
|---|---|---|
| `SFX_DEATH` | 07 `ON_DEATH`/`ON_GAME_OVER` | 柔和下行（温柔，对齐 bible §7.2 失败温柔提示） |
| `SFX_CHECKPOINT` | 05 `ON_CHECKPOINT` | 轻"叮"确认音 |
| `SFX_UI` | 暂停/按钮/主菜单点击 | 极轻 30ms blip（touch-buttons-spec §7 backlog） |

> **任务书 9 语义 ↔ 枚举映射**：jump→`SFX_JUMP`、stomp→`SFX_STOMP`、hurt→`SFX_HURT`、coin→`SFX_COIN`、goal→`SFX_CLEAR`、transform→`SFX_POWERUP`、death→`SFX_DEATH`(proposed)、checkpoint→`SFX_CHECKPOINT`(proposed)、ui→`SFX_UI`(proposed)；另 `DOUBLE_JUMP`/`LAND`/`FIRE` 为既有合同额外项。

### 5.2 背景音乐（远程 URL 流式，不进主包）
- 曲目 slot（URL TBD）：`BGM_GRASS` / `BGM_CAVE` / `BGM_SKY`，按 theme 切换；远程 URL 流式（`wx.createInnerAudioContext` / Web `Audio`），**不进主包**（ADR-004 #2）。
- 首玩离线可静音（占位可接受），不阻塞 MVP。

### 5.3 占位期 ↔ 正式期过渡
- **占位期（当前 MVP）**：SFX = WebAudio 振荡器合成短音（ADR-004 #3，零文件进包），`playSfx(name)` 仅静音/日志或合成 stub；音乐静音/占位。
- **正式期**：SFX 可替换为 (a) 更精致合成 或 (b) 实际音效文件（若包体余量允许，≤100KB SFX 预算，ADR-004）；音乐维持远程 URL 流式。
- **过渡零破坏**：接口 `playSfx(name)` 不变，仅换底层实现，不破事件链路（GDD 09 §3）。

---

## 6. 资产管线约定

### 6.1 图集策略（守 ADR-004）
- 工具 **`free-tex-packer`** → 输出 **1 个 atlas**（PNG-8 索引色 ≤64 色 + Phaser 兼容 JSON）。**UI 矢量不入图集**（见 §0/§4）。
- 体积：单图集 PNG-8 实测 **150–300KB**（manifest §5 估算），**远低于 ≤1.0MB 上限**。

### 6.2 命名规范（snake_case + 系统前缀）
- 前缀：`char_`（主角）/ `en_`（敌人）/ `fx_`（特效/弹丸/光晕）/ `tile_`（地形）/ `prop_`（道具）/ `goal_`（终点）。UI 矢量（`ui_*`）运行时绘制，不入图集。
- 帧名：`{prefix}{name}_{state}_{NN}`（如 `en_chong_feng_charge_02`、`char_mali_idle_01`）；atlas JSON 帧名对应实体 id。

### 6.3 尺寸 / 格式
- 角色/敌人/地形/道具 → **PNG-8 索引色（≤32–64 色/图）**；含半透明特效（fx 粒子 / 光晕 / 拖尾）→ **PNG-32**。
- 单帧对齐 32 倍数；序列帧横向排布，配套 `.json` 帧数据。
- 全项目共用一份调色板（美术圣经 §3，≤64 色），保证跨资产色彩一致。

### 6.4 图集打包上限（微信主包约束）
- 微信硬限：主包 **4MB**、整包 **8MB**（ADR-004）。本作主包预算 **≤2.7MB**（留 ~1.3MB 余量）：JS ≤1.5MB、图集 ≤1.0MB、config+主关 JSON ≤100KB、SFX 合成 ≤100KB。
- 主题 tint 不重绘 → 仅 1 份瓦片集，省图集空间。

### 6.5 可访问性色板与热区落地（映射 accessibility.md 矩阵）
- **高对比轮廓**：每个像素实体带 1–2px 近黑棕 `#2A1A12` 描边，任意背景可辨（#1）。
- **色盲双编码**：全部功能色引用圣经 §3.2（形状+颜色）；六者色相/形状各异（#1）。
- **减少动态**：每实体提供静态首帧（frame 0）；开启后动画停首帧、粒子/视差关闭（#8）。
- **防光敏**：无全屏高频闪；受击为半透明红叠 + 角色闪烁（<3Hz）（#10 硬底线）。
- **热区 / 文字**：UI 热区 ≥48×48、HUD 屏宽 10% 边距、中文 ≥14px（#5/#6/#12）。

### 6.6 文档一致性提示（非阻塞）
- ADR-004 #1 措辞含"UI 图标"入图集，但本作 HUD 全矢量（美术圣经 §2.6 + 08-ui-hud），`ui_*` 不入像素图集。**建议工程在 ADR-004 加注澄清**（"UI 图标"指若未来有像素 HUD 图标才入图集），避免双端构建误打包。

---

## 7. 状态标记汇总

**✅ 已对齐既有实现（直接取用，不重产）**
- `ui_heart`（hud-spec §3.1）、形态栗宝头像（hud-spec §3.2）、触屏四按钮（touch-buttons-spec 变体 B）
- 凯旋之门概念/尺寸（manifest §2.9）、四敌剪影/配色（art-bible §4.3 + manifest §2/§3）
- 图集/命名/格式/包体（manifest §5 + ADR-004）

**🆕 新增待生产（本 spec 首次精确定义，供美术/程序）**
- 栗宝完整动画帧（idle/run/jump/double-jump/fall/hurt/death）—— 占位仅圆角块
- 栗宝种子蜕变成长视觉（差异内核 参数化 topper sprites + aura）—— 全新
- 四敌完整像素精灵 + 动画（占位仅色块）
- 瓦片集完整 + 主题 tint 映射 + 主题独有装饰
- `ui_coin` / `ui_star` / 主菜单面板 / `ui_progress` —— 矢量，未在生产
- 音频：SFX 音色方向（合成占位→正式替换）；新增 `SFX_DEATH`/`CHECKPOINT`/`UI`（待 Q2 确认枚举扩展）；音乐远程曲目 slot
- 弹丸 / 光晕 / 粒子 fx 精灵

---

## 8. 开放问题（下一步生产前建议拍板，均非阻塞）

- **Q1（蜕变参数来源）**：GDD 11 实际内容为 meta-progression（存档/星数/解锁），与 MEMORY/任务书"差异内核=种子精灵蜕变成长系统"**不一致**。蜕变视觉的 `maturity` 来源需拍板：(a) 绑定 meta 跨关累计种子；(b) 局内 buff 层数；(c) hybrid。**建议先 (b) 局内 buff 驱动（与元气果即时反馈），meta 累计作长期成长（标题/HUD），双源可叠加**。不阻塞美术（topper 资源按 stage 抽，程序接入 `source` 即可）。
- **Q2（音频枚举扩展）**：任务书 9 SfxName 含 death/checkpoint/ui，但 GDD 09 枚举无此三项（有 `DOUBLE_JUMP`/`LAND`/`FIRE`）。**是否扩展枚举 +3（`SFX_DEATH`/`CHECKPOINT`/`UI`）？建议扩展**（低成本，不破 `playSfx` 接口）。
- **Q3（栗宝 death 动画）**：任务书列 death 动画，但 MVP 栗宝死亡 = Game Over 覆盖层接管，无独立 sprite death 帧。**是否 MVP 必须？建议 P1 可选**（squish+poof），不阻塞。
- **Q4（冲锋怪 STUN）**：GDD 04 待确认 `STUN=1000ms`（建议 800~1200）。影响眩晕帧时长（程序驱动，不阻塞美术）。
- **Q5（主包 UI 图标措辞）**：ADR-004 #1 "UI 图标入图集" 与 本作矢量 UI 不入图集 不一致，**建议工程加注澄清**（见 §6.6，非阻塞）。

---

## 9. Handoff 摘要（给主理人游承峰）

- **规格文档路径**：`art/asset-spec.md`（新建，正式生产合同；取代 placeholder-spec 占位角色）。
- **关键决策**：
  1. 栗宝蜕变视觉以 **GrowthKernel 参数化（差异内核）** 落地——纯函数 `computeGrowth(maturity)` 推导 stage（苗/藤/花/果），美术仅绘离散 topper + 暖黄光晕；顶芽生长隐喻全原创、禁增益紫，IP 安全。
  2. 四敌可踩/不可踩视觉暗示系统化——**soft（圆润顶/无刺）vs hard（尖角/硬棱/炮口）**，形状语言为主、警示红仅强化，色盲安全。
  3. 图集策略守住 **ADR-004**：free-tex-packer 单 atlas（PNG-8 ≤1.0MB）、UI 全矢量不入图集、音乐远程流式不进主包。
- **开放问题**：见 §8（Q1 蜕变来源 / Q2 音频枚举扩展 建议先拍板；Q3–Q5 非阻塞）。
- **Sprint 04 建议**：✅ **建议据此进入 Sprint 04 实现**。所有下一步生产资产已参数化 + 对齐既有实现 + 标注开放问题（均非阻塞），程序/美术可直接取数；建议先用 5 分钟就 Q1、Q2 拍板以避免返工。
