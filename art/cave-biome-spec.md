# 洞穴 biome 美术规格 + 鼓苞视觉（cave-biome-spec）

> 文档类型：biome 美术规格 + 新敌视觉规格（加法扩展，`art/asset-spec.md` §3.1 的洞穴落地）
> 作者：art-director（林绘澄）
> 上游依据：`design/levels/2-1-content-spec.md` §7 / 附录 A、`design/gdd/13-gu-bao-enemy.md` §2·§7.3、`art/art-bible.md` §3·§5.3、`art/asset-spec.md` §3.1（runtime tint）
> 关联任务：P-LEVEL-03｜评审强度：lean
> **红线**：锁色板 ≤64 色、不引入新色；MVP 全程序化占位（Graphics，无 PNG）；IP 全原创、避任天堂符号。

---

## 0. 范围与锁色板（红线基准）

本 biome 仅负责**洞穴主题视觉**与**新敌 gu_bao 视觉**；玩法/数值/物理由对应 GDD 与工程负责。

**权威锁色板（任务指定，11 色，≤64 红线基准）**

| # | 名 | Hex | 本 biome 用途 |
|---|---|---|---|
| 1 | 草绿 | `#7CC242` | 草原沿用（种子嫩芽/栗宝 topper） |
| 2 | 阴影绿 | `#5FA82F` | 草原沿用（草体阴影，可选） |
| 3 | 暖橙 | `#F2933C` | 火光 / gu_bao 苞体 |
| 4 | 暖黄 | `#FFD23F` | 晶体核心 / gu_bao 软顶高光 |
| 5 | 描边 | `#2A1A12` | 全局描边（所有实体共享） |
| 6 | 命粉 | `#F26D8B` | 草原沿用（HUD 爱心） |
| 7 | 警示红 | `#E8483B` | 危险语义（gu_bao 尖刺 / ci_li 等） |
| 8 | 经济金 | `#F2C94C` | 草原沿用（coin） |
| 9 | 蓝紫 | `#6E7BF2` | 晶体辉光（主） |
| 10 | 环境冷蓝 | `#4A78C0` | **岩壁主色 / cave 基色** |
| 11 | 天空 | `#5BC8F5` | 晶体辉光（次）/ 草原 bg |

> 本 biome 全部引用色均取自上表；派生色（岩壁暗面、cave bg）由 `#4A78C0` **运行时 tint** 生成，**不计入新增 hex**（见 §5）。

---

## 1. 洞穴 palette 变体权威映射表

### 1.1 草原默认 → 洞穴冷色：tint / 映射规则（换色不换形）

- **原则（art-spec §3.1 + GDD05 §3）**：绘 **1 份 base 瓦片集**（草原色），洞穴经 **runtime tint / 调色板映射** 生成，结构、瓦片网格、功能色语义（solid/oneway/可踩）**不变**，仅换主色与装饰。保证回归测试稳定。
- **语义槽映射**：base 瓦片的"语义槽"（顶面 / 身 / 描边 / 火光 / 晶体 / 危险）在不同主题下映射到不同 hex，渲染层按 `theme` 选槽，不重绘图集。
- **草原 → 洞穴 映射表（base 语义槽 → cave hex）**

| base 语义槽 | 草原值（参考） | 洞穴值（本 spec 权威） | 备注 |
|---|---|---|---|
| 岩壁主面 rockFace | `#7CC242`（草绿顶） | `#4A78C0`（环境冷蓝） | 冷蓝灰岩面 |
| 岩壁暗面 rockBody | `#F2933C`（暖橙泥） | tint(`#4A78C0`, 0.5) ≈ `#254060` | **运行时 tint**，0 新增 |
| 描边 outline | `#2A1A12` | `#2A1A12` | 全局共享，不变 |
| 火光 firelight | `#F2933C` | `#F2933C` | 暖橙火把/苞同源，呼应暖意 |
| 晶体核心 crystalCore | `#FFD23F` | `#FFD23F` | 暖黄微光 |
| 晶体辉光 crystalGlow | `#5BC8F5` | `#6E7BF2`（主）/ `#5BC8F5`（次） | 蓝紫辉光（冷中藏暖） |
| 危险 red | `#E8483B` | `#E8483B` | 尖刺/危险双编码，形状辅助 |
| 背景 bg | `#5BC8F5`（天空） | tint(`#4A78C0`, 0.38) ≈ `#1C2E49` | **运行时 tint**，0 新增；冷暗洞穴 |

### 1.2 洞穴语义色权威 hex（必给 6 项 + 派生 2 项）

| 语义 | 权威 Hex | 来源 | 是否锁色板 |
|---|---|---|---|
| **岩壁主色** rockFace | `#4A78C0` | 环境冷蓝 | ✅ 锁色板 #10 |
| **描边** outline | `#2A1A12` | 描边 | ✅ 锁色板 #5 |
| **火光** firelight | `#F2933C` | 暖橙 | ✅ 锁色板 #3 |
| **晶体核心** crystalCore | `#FFD23F` | 暖黄 | ✅ 锁色板 #4 |
| **辉光** crystalGlow | `#6E7BF2`（主）·`#5BC8F5`（次） | 蓝紫 / 天空 | ✅ 锁色板 #9 / #11 |
| **危险红** danger | `#E8483B` | 警示红 | ✅ 锁色板 #7 |
| 岩壁暗面 rockBody（派生） | `#254060`（= darken `#4A78C0` ×0.5） | runtime tint | 0 新增 |
| 背景 bg（派生） | `#1C2E49`（= darken `#4A78C0` ×0.38） | runtime tint | 0 新增 |

> 8 个权威 hex 全部落在锁色板内或由其 tint 派生，**无新增色**（tint 不计入新增 hex，见 §5）。

---

## 2. 岩壁瓦片规则（复用 base 集 + runtime tint）

- **复用 1 份 base 瓦片集**，结构/功能语义不变（`ground_top` / `ground_fill` / `oneway` / `interactive_block` 等，详见 asset-spec §3.1）；洞穴经 theme palette 映射（§1.1）生成，**不另绘洞穴瓦片集**（省图集，守 ADR-004）。
- **功能语义不变**：solid / oneway / 可踩判定与草原一致；仅主色由草绿→冷蓝、身色由暖橙→暗冷蓝 tint。
- **主题独有装饰（另绘少量，MVP 可 Graphics 占位）**：
  - `deco_stalactite` 钟乳石：从顶垂下的细长锥（冷蓝 `#4A78C0` + 暗面 tint + 描边），**非碰撞**，纯氛围。
  - `deco_pillar` 岩柱：地面升起的粗柱（冷蓝面 + 暗面 tint + 描边），可作为中景装饰（**不参与碰撞**，碰撞仍由 `tiles[]` 的 solid 决定）。
  - MVP：用 `Graphics` 画简单多边形占位（锥/柱），程序化 tint，无需 PNG。
- **IP**：钟乳/岩柱为原创岩石形态，非管道/龟壳符号。

---

## 3. 晶体 `deco_crystal`（非碰撞装饰）

- **语义**：点缀冷暗背景，制造"冷中藏暖"微光反差；**非碰撞**（碰撞由 `tiles[]` 决定，deco 仅氛围）。
- **配色**：核心 `暖黄 #FFD23F` + 辉光 `蓝紫 #6E7BF2`（主）/ `天空 #5BC8F5`（次）；描边 `#2A1A12`。
- **几何（MVP Graphics 菱形占位）**：
  - 画布 `16×24`（菱形，尖顶尖底），中心 `暖黄` 实心菱形，外扩 1–2px `蓝紫` 半透明辉光环（alpha ≤0.4），描边 1px。
  - 可加轻微 alpha 脉冲（≤2Hz，守防光敏 <3Hz）增强"微光"。
- **尺寸预算**：单 crystal ≤ 16×24px；同屏 ≤ 8 个（氛围克制，不抢路径）。
- **IP**：原创菱形晶体，非星/蘑菇符号。

---

## 4. gu_bao 四态视觉规格（新敌种）

> 形状语言优先：gu_bao = **地面升起的垂直膨胀苞 + 顶刺**，与 4 旧敌剪影全异（见 §4.5）。配色：苞体 `暖橙 #F2933C`、尖刺 `警示红 #E8483B`、软顶 `暖黄 #FFD23F`、描边 `#2A1A12`。
> 几何基准（GDD13 §3.2/§4）：`width=28`、`height=48`、`anchorY=224`（ty7 顶），盒顶 `top = anchorY − p×height`，`p∈[0,1]` 为升起进度。

### 4.1 四态明细

| 态 | 几何 | 配色 | 描边 | 碰撞/危害 | 可踩 | 视觉要点 |
|---|---|---|---|---|---|---|
| **DORMANT** | 地下，零高（p=0）；仅地表裂缝暗示 | 裂缝 `描边 #2A1A12`（低 alpha） | `#2A1A12` | 无（`overlaps=false`） | 否 | 苞体不可见；一条细裂缝标出升起点（公平可读，无尖刺/无红） |
| **EMERGING** | 升起中（p=t/emergeMs，0→1）；顶刺前摇 | 苞体 `暖橙 #F2933C` + 顶刺 `警示红 #E8483B`（渐显） | `#2A1A12` | 危害（telegraph 前摇） | 否 | 苞体自裂缝噗出，红刺随升起出现 = **危险前摇** |
| **ACTIVE** | 全高（p=1）；顶刺全展 | 苞体 `暖橙 #F2933C` + 顶刺 `警示红 #E8483B`（全） | `#2A1A12` | 危害 | 否 | 垂直柱 + 满刺 = 明确危险 |
| **RETRACTING** | 缩回（p=1−t/retractMs，1→0）；顶刺收起、软顶转暖黄 | 苞体 `暖橙 #F2933C` + 顶 `暖黄 #FFD23F` 高光环（软顶） | `#2A1A12` | 非危害 | **是**（顶踩） | 刺收、顶转暖黄高光 = **可踩窗口双编码** |

### 4.2 苞体 / 尖刺绘制约定（MVP Graphics）

- **苞体**：圆角矩形竖柱（宽 28、高 = `p×48`），`暖橙 #F2933C` 填充 + `描边 #2A1A12` 1px；顶缘略鼓（有机苞感，非方块）。
- **尖刺（EMERGING/ACTIVE）**：苞顶 3–4 枚小三角（底宽 ~6px、高 ~6px），`警示红 #E8483B` 填充 + `描边`；EMERGING 期随 p 渐显（alpha = p），ACTIVE 全显。
- **软顶（RETRACTING）**：尖刺隐藏，苞顶绘 `暖黄 #FFD23F` 高光环（2px 描边环 + 中心亮点），明确"可踩"。
- **DORMANT 裂缝**：地表一道 `描边` 色细折线（宽 28、高 ~3px，alpha 0.5），无苞体、无刺。

### 4.3 与 4 旧敌轮廓对比（确保全异 · 色盲安全）

| 敌 | 轮廓 | 主色 | gu_bao 区分点 |
|---|---|---|---|
| `ci_li` 刺栗 | 圆球 + 周身短刺 | 警示红 | gu_bao = **地面垂直柱 + 仅顶刺**，非圆球 |
| `chong_feng` 锥冲 | 长条楔形（前尖后宽） | 警示红 | gu_bao = **从地升起的竖苞**，非水平冲锋楔形 |
| `du_fu` 嘟浮 | 扁圆 + 双翅 | 蓝紫 | gu_bao = 暖橙竖柱（色+形双异） |
| `shi_pao` 石炮 | 方正石块 + 炮口 | 石灰白/灰 | gu_bao = 有机苞体 + 刺，非方块炮台 |

> 结论：gu_bao 以 **「暖橙垂直苞 + 顶刺」** 剪影唯一，与 4 旧敌（圆/楔/扁/方）全异；尖刺虽共用警示红，靠**垂直柱 + 仅顶刺**形状双编码区分，色盲安全。

### 4.4 可踩 / 不可踩视觉语言（对齐资产-spec §2.5）

- EMERGING/ACTIVE：`hard` 顶（尖刺硬角 + 红）= 不可踩；RETRACTING：`soft` 顶（圆润暖黄高光环）= 可踩。与 4 旧敌 soft/hard 体系一致。

### 4.5 后续像素化路径（AI 生成提示词预留）

- **gu_bao pod**：`pixel art, 32px grid, vertical bulging seed pod, warm orange #F2933C body, dark outline #2A1A12, small red #E8483B spikes on top only, no face, flat toon shading, no Nintendo symbols`
- **cave rock tile**：`pixel art tile, 32x32, cold blue #4A78C0 rock face, darker tinted body, 1px dark outline #2A1A12, matte, no pipes`
- **deco_crystal**：`pixel art, small diamond crystal, warm yellow #FFD23F core, blue-purple #6E7BF2 glow, dark outline, non-threatening`

---

## 5. 锁色板合规声明

- **本 biome 直接引用锁色板色**：`#4A78C0` / `#F2933C` / `#FFD23F` / `#6E7BF2` / `#5BC8F5` / `#E8483B` / `#2A1A12` = **7 色**（锁色板 #3/4/5/7/9/10/11）。
- **派生 tint（0 新增）**：岩壁暗面 `#254060`、cave bg `#1C2E49`，均由 `#4A78C0` 运行时 darken 生成，**不计入新增 hex**（对齐 2-1 附录 A·5「tint 不计数新增 hex」）。
- **草原沿用色（仍在锁色板内）**：关卡 2-1 同屏还存在 `草绿 #7CC242`（种子嫩芽/栗宝 topper）、`经济金 #F2C94C`（coin）、`命粉 #F26D8B`（HUD 爱心）、`阴影绿 #5FA82F`（可选草阴影）——均属锁色板 #1/2/6/8。
- **总色数核算**：全关引用**已锁色板 11 色** + 2 个运行时 tint（0 新增）= **11 色**，远小于 **≤64** 红线，**零新增色**。✅
- **已知越界预存在项（非本 biome 引入，提请主理人 reconcile）**：`art-bible`/`asset-spec` 中角色与道具引用了锁色板外的生产色（栗色 `#B5763E`、石灰白 `#F4EFE6`、炮口灰 `#8A8276`、肚皮 `#F0D9B5` 等），以及 `game-scene.ts` `drawTerrain` 当前硬编码草地棕 `0x3a2a1f`/`0x6a5a3f`（越界色）。这些**非本 biome 引入**；本 spec 的洞穴部分严格守 11 色锁色板，并建议草地 terrain 也迁回锁色板（草绿/暖橙/阴影绿，见 §6 契约 grass 行）。

---

## 6. theme→palette 契约（给 engineering-lead 的接口）

> 这是美术与 `game/render` 的**实现契约**。工程在 `game/render` 实现 theme→palette 解析器时，直接消费下列字段名与常量。本 biome 不写 `src/`，仅定义契约。

### 6.1 字段名（数据契约）

- **字段**：`LevelData.metadata.theme`
- **当前类型**：`level-data.ts:137` 为 `theme: string` → **建议改为联合类型**（利 fail-safe 与类型安全）：
  ```ts
  export type LevelTheme = 'grass' | 'cave';   // 'sky' 预留（后续主题）
  // LevelData.metadata: { name: string; theme: LevelTheme };
  ```
- **取值**：`'grass'`（默认/fail-safe）｜`'cave'`（2-1.json 已写 `"theme": "cave"`）。
- 解析器对未知 theme **回退 `'grass'`**（不抛错，保证旧关/回归稳定）。

### 6.2 调色板注册表（解析器应消费的颜色常量名 + hex 映射）

建议落地 `src/game/render/theme-palette.ts`，导出 `THEME_PALETTES: Record<LevelTheme, ThemePalette>`：

```ts
// 语义槽 → hex（所有值来自锁色板或由其 tint 派生，0 新增）
export interface ThemePalette {
  bg: number;          // 背景/天空填充
  rockFace: number;    // 岩壁主面（ground_top 等价）
  rockBody: number;    // 岩壁暗面（ground_fill 等价）
  outline: number;     // 全局描边
  firelight: number;   // 暖橙火光点缀
  crystalCore: number; // 晶体暖黄核心
  crystalGlow: number; // 晶体辉光（主）
  danger: number;      // 警示红（危险双编码）
}

export const THEME_PALETTES: Record<LevelTheme, ThemePalette> = {
  grass: {
    bg:          0x5BC8F5, // 天空（锁色板 #11）
    rockFace:    0x7CC242, // 草绿顶（#1）
    rockBody:    0xF2933C, // 暖橙泥（#3）— 替换当前越界棕 0x6a5a3f
    outline:     0x2A1A12, // 描边（#5）
    firelight:   0xF2933C, // 暖橙
    crystalCore: 0xFFD23F, // 暖黄（#4）
    crystalGlow: 0x5BC8F5, // 天空（#11）
    danger:      0xE8483B, // 警示红（#7）
  },
  cave: {
    bg:          0x1C2E49, // darken(0x4A78C0, 0.38) 派生 tint，0 新增
    rockFace:    0x4A78C0, // 环境冷蓝（#10）
    rockBody:    0x254060, // darken(0x4A78C0, 0.50) 派生 tint，0 新增
    outline:     0x2A1A12, // 描边（#5）
    firelight:   0xF2933C, // 暖橙（#3）
    crystalCore: 0xFFD23F, // 暖黄（#4）
    crystalGlow: 0x6E7BF2, // 蓝紫（#9，主）
    danger:      0xE8483B, // 警示红（#7）
  },
};
```

### 6.3 解析器消费点（实现指引，非本 biome 写码）

| 消费点（当前代码） | 现状 | 应改为 |
|---|---|---|
| `src/game/scenes/game-scene.ts` `drawTerrain`（~L862–882） | 硬编码 `0x3a2a1f`(填充)、`0x6a5a3f`(身) | 读 `THEME_PALETTES[theme].rockFace` / `.rockBody`；同时替换越界棕回锁色板 |
| `src/game/main.ts:32` `backgroundColor` / `sandbox-scene.ts:45` | 硬编码 `'#5BC8F5'` | 运行时 `this.cameras.main.setBackgroundColor(THEME_PALETTES[theme].bg)`（按 `runtime.data.metadata.theme`） |
| 晶体/钟乳装饰绘制（新增） | — | 读 `crystalCore`/`crystalGlow`/`firelight` 槽 |
| gu_bao 占位绘制（`enemy-view.ts` 新增分支） | — | 苞体=`firelight`(`#F2933C`)、尖刺=`danger`(`#E8483B`)、软顶=`crystalCore`(`#FFD23F`)、描边=`outline` |

### 6.4 契约要点（一句话回传主理人）

- **字段**：`LevelData.metadata.theme: 'grass' | 'cave'`（建议联合类型，未知回退 `'grass'`）。
- **常量**：解析器消费 `THEME_PALETTES[theme]` 的 8 个语义槽（`bg`/`rockFace`/`rockBody`/`outline`/`firelight`/`crystalCore`/`crystalGlow`/`danger`）。
- **洞穴映射**：rockFace=`#4A78C0`、outline=`#2A1A12`、firelight=`#F2933C`、crystalCore=`#FFD23F`、crystalGlow=`#6E7BF2`、danger=`#E8483B`；rockBody/bg 由 `#4A78C0` 运行时 tint（0 新增）。
- **消费点**：`drawTerrain` 与背景色读取须改读 `THEME_PALETTES`（同时把当前越界棕回锁色板）。
- **约束**：所有 hex 落在 11 色锁色板内或由其 tint 派生；MVP 全 Graphics 占位，不进 PNG。

---

*本文件为洞穴 biome 美术规格（加法），未修改现有 GDD / 资产文档 / `src/`；未 git commit。待主理人（游承峰）审批后由 art-director 与 engineering-lead 分别落地（美术走像素化路径、工程走 §6 契约）。*
