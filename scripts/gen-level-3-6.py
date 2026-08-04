"""生成 src/config/levels/3-6.json —— 3-6《星穹终启》（**破晓穹顶 zenith**，第三章终章：四轴混编 gauntlet）。

权威依据：design/gdd/level-3-6-design.md
          §3（尺寸/段界，含主理人已拍板的段界微调 R10：S5 = tx46..54）/ §4.1（地形清单：三层塔 + 四块 1 格窄岛）/
          §4.2（safe_gap 校验表 + 反证表）/ §4.4（cyclone 专项）/ §5.3（entities 46 条，逐条照抄）/
          §6（检查点 5 个 = 全项目最多）/ §7（节拍平台 2 簇 = 全章上限，红线 ty=4）/
          §8（种子 6 颗：3 颗地面主路 + 3 颗技能奖励）/ §9（parTimeMs=114000）/ §10（metadata）/ §11（汇总结构草案）。
配套：art/zenith-biome-spec.md §9.1/§9.2（theme='zenith' 契约与 8 槽调色板，落在 theme-palette.ts）。
结构范式对齐 scripts/gen-level-3-5.py（逐字同构，仅换坐标与规模）。

红线：
  - 地面 ty7,8 全宽实心恒存在（tx0..55）→ 主路恒走地面、零坠落死亡、零 soft-lock（公平性地板）。
  - 浮岛 / 塔层 / 窄岛全部复用既有 oneway，0 新增 tile kind；entities 0 新增类型；敌人代码 0 改动。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5；本关 2 簇 = 全章上限（2-6/3-3/3-5 先例）。
  - ⚠️ **零 ty2**：全关最高可站立瓦片 = ty3（z2 / z4 / T3，顶面 y=96）。
    ty3 顶距地面 128px > 满跳+二段跳顶点 119px → **地面纯跳不可直达 ty3 是设计意图**
    （设计稿 §4.2 反证表 / 主计划附录B R6），**实现期不得判为「跳不上去 = bug」**。
    注：左右边界墙（solid）仍整高 ty0..8，与 3-1~3-5 同构 —— 禁令约束的是**可站立层**（oneway / 节拍平台）。
  - 敌 y 契约零例外：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100。
    cyclone.y=224 是**地面锚点**（气柱自 y 向上延伸 h），非敌契约，单独校验。
  - mechanics.glide=true 沿用布尔写法（非对象），0 Schema 变更。
  - goal.x = (width-2)*32 = 1728（tx54），与 3-1~3-5 严格同构；goal 顶 y=160 = g2 顶面 y=160（「平着飘进裂缝」）。
  - metadata.theme = "zenith"（全项目第 15 个 biome，仅本关）。⚠️ 必须与 level-data.ts 的 LevelTheme
    与 theme-palette.ts 的 ZENITH 注册**同批落地**，否则 resolveBiome() 静默回退 grass → 终章画面变草原
    （validateLevelData 不校验 theme 枚举，设计稿 §0 / 附录B R6）。
"""
import json

W, H = 56, 9
TS = 32

tiles = []
# 破晓云海地面 ty7,ty8 整宽（碰撞语义同 solid；主路恒走地面，不挖坑、不加 hazard）
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左墙 tx0 / 右墙 tx55 整高（防越界）
for ty in range(H):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})

# oneway 地形（设计稿 §4.1，剪影读法「宽 → 窄 → 塔 → 缝」）；全部为可选高路，失手落回地面继续。
#   S1 回望：z1(ty5) → z2(ty3 回望台) ══X3 长渡 Δ+2/gap5══▶ z3(ty5)
#   S2 律动：bp_z1(ty4, ghost, 见 beatPlatforms) → z4(ty3 律动高台 = 相位专属奖励区)
#   S3 陨雨：n1(ty5, 1 格窄岛) ══X7 必需 glide/gap4══▶ n2(ty5, 1 格窄岛)
#   S4 攀塔：T1(ty5,3格) → bp_z2(ty4, ghost = 登顶门禁) → T3(ty3,2格 = 全关最高可站立面)
#   S5 破穹：g1(ty4, 1 格窄岛) → g2(ty5, 1 格窄岛，顶面 y=160 = 门顶 y) → 破穹之门
# ⚠️ 三处 ty3（z2 / z4 / T3，顶面 y=96）顶距地面 128px > 二段跳顶点 119px → **从地面绝对不可直达**：
#    z2 ← z1 中继；z4 ← bp_z1 相位（独家）；T3 ← bp_z2 相位 或 cyclone（双解）。**实现期不得判为 bug**。
# ⚠️ ty4（bp_z1 / bp_z2 / g1，顶面 y=128）距地面 96px < 119px → **地面纯跳可上** = 本关的「公平性地板」。
# ⚠️ 踩 du_fu 不能垫高（stompBounce=-300 仅抬 ≈25px）：链条的价值是「续航」不是「抬升」。
FLOAT_ISLANDS = [
    ((3, 4), 5),            # z1  S1 起手低岛（地面纯跳可上，64px）
    ((7, 8), 3),            # z2  S1 回望台（ty3，经 z1 中继抵达）
    ((14, 15), 5),          # z3  S1 X3 长渡（Δ+2 / gap5 / 必需 glide）落点
    # bp_z1 见 beatPlatforms（tx18,19,20 @ ty4，ghost = z4 的唯一入口）
    ((23, 24), 3),          # z4  S2 律动高台（ty3，seed_04 所在，相位专属奖励区）
    # ⚠️ n1 必须是 tx29；改回 tx28 会让 gap 降到 3 = 安全值上限，玩家可从 n1 反向回跳绕过
    #    bp_z1 相位登上 z4，时间轴独家奖励失效（设计稿 §4.2 反证表，主理人已拍板）。
    ((29,), 5),             # n1  S3 窄岛①（1 格，落点精度考核）
    ((34,), 5),             # n2  S3 窄岛②（X7 必需 glide 的落点）
    ((36, 37, 38), 5),      # T1  S4 三层塔·塔基（宽基座给容错；地面纯跳可上，64px）
    # bp_z2 见 beatPlatforms（tx40,41,42 @ ty4，ghost = 塔中层 = 登顶门禁）
    ((44, 45), 3),          # T3  S4 三层塔·塔顶 = 全关最高可站立面（ty3；⚠️ 严禁再往上放 ty2）
    ((50,), 4),             # g1  S5 gauntlet 窄岛①（XF1 落点；地面纯跳可上，96px）
    ((53,), 5),             # g2  S5 gauntlet 窄岛② = 破穹之门的等高踏板（顶面 y=160 = 门顶 y=160）
]
for txs, ty in FLOAT_ISLANDS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 18（gu_bao×4 / ci_li×4 / du_fu×5 / shi_pao×5）+ cyclone×1 / 币 16 / 种 6 / 检查点 5 = 46 条；按 x 严格升序。
# 敌人 y 契约恒定：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100（全 19 关零例外）。
# 密度 18/56 = 0.3214 = **全项目峰**（> 3-5 的 0.308 > 2-6 的 0.286）；分母含 cyclone 会算错，cyclone 不计入 18。
# du_fu×5 = 本关公平性骨架（y=120 恰在羽降主带），5 只精确落在 X3/X4/X7/X9/XF1 五处跨越的空档中；
#   间距 6/14/8/8 格 ≥3 → 物理上排除「du_fu 连踩通关」这个潜在主导策略（摆位即上限，零新增规则）。
# shi_pao×5 = 全项目火力峰（3-4 峰值重现）：三炮走廊 tx26/30/35 + gauntlet 双炮 tx48/51；
#   5 门全部不与任何可站立瓦片同列 → 玩家「站定读相位 / 站上窄岛」时头顶无炮口（设计稿 §5.1 摆位纪律）。
#   ⚠️ 主理人已**预授权** QA：若实测密度 0.321 过载，可直接删 shi_pao(x=1120, tx35) 那门
#      （5 门中信息量最低，只守 n2→T1 的 gap1 短跳），**不得削 du_fu**（du_fu 是三处必需 glide 的第二解）。
entities = [
    {"type": "coin", "x": 128, "y": 128},
    {"type": "gu_bao", "x": 192, "y": 224, "params": {"phaseOffset": 0}},
    # coin(224,64) 在 z2（回望台 ty3，顶面 96）上方 32px。
    {"type": "coin", "x": 224, "y": 64},
    # seed_01 = 地面主路（公平性地板第 1 颗）。
    {"type": "seed", "x": 256, "y": 200, "seedId": "seed_01"},
    {"type": "coin", "x": 288, "y": 80},
    # cp1 = S1 中段 / X3 长渡空档正下方（长渡失手即落在覆盖内）。
    {"type": "checkpoint", "x": 320, "y": 176},
    # du_fu(352=tx11) 落在 X3 空档（tx9..13）正中 —— 既是第二解，也是「你还记得能踩它」的无字提示。
    {"type": "du_fu", "x": 352, "y": 120},
    {"type": "coin", "x": 384, "y": 112},
    {"type": "coin", "x": 448, "y": 128},
    {"type": "coin", "x": 512, "y": 112},
    # du_fu(544=tx17) 在 X4 空档内：踩一下 → 重置下落 → 再飘一会儿等相位（链式轴 × 时间轴首次轻量合流）。
    {"type": "du_fu", "x": 544, "y": 120},
    {"type": "coin", "x": 576, "y": 96},
    # cp2 = bp_z1 正下方（相位段的地面锚点，同 3-5 cp4 手法）。
    {"type": "checkpoint", "x": 608, "y": 176},
    {"type": "coin", "x": 640, "y": 96},
    {"type": "ci_li", "x": 672, "y": 200},
    # seed_02 = 地面主路（第 2 颗）。
    {"type": "seed", "x": 704, "y": 200, "seedId": "seed_02"},
    # seed_04 = z4（律动高台 ty3，顶面 y=96）上方仅 16px —— 走过去即得，规避「顶点出画」；
    #   ⭐ 时间轴独家奖励：bp_z1 相位是唯一入口（n1 定在 tx29 已封死反向回跳旁路）。
    {"type": "seed", "x": 736, "y": 80, "seedId": "seed_04"},
    {"type": "gu_bao", "x": 768, "y": 224, "params": {"phaseOffset": 265}},
    # ⚠️ cp3 = x800（tx25）= 三炮走廊入口（红线：火力峰前必有 cp）。
    {"type": "checkpoint", "x": 800, "y": 176},
    # shi_pao(832=tx26) 守 z4→n1 的起跳段。
    {"type": "shi_pao", "x": 832, "y": 100},
    {"type": "coin", "x": 864, "y": 128},
    {"type": "coin", "x": 928, "y": 128},
    # shi_pao(960=tx30) 守 X7（必需 glide）的滞空段 —— 「飘得越久，暴露越久」最狠的一次重放。
    {"type": "shi_pao", "x": 960, "y": 100},
    # du_fu(992=tx31) 落在 X7 空档（tx30..33）内，是走廊里唯一的空中救济。
    {"type": "du_fu", "x": 992, "y": 120},
    # seed_03 = 地面主路（第 3 颗，三炮走廊正中：安全但不轻松）。
    {"type": "seed", "x": 1024, "y": 200, "seedId": "seed_03"},
    # 弹道走廊币：刻意置于 shi_pao 火线（y=100）附近 → 贪心即暴露（代价轴的经济表达）。
    {"type": "coin", "x": 1056, "y": 112},
    {"type": "ci_li", "x": 1088, "y": 200},
    # shi_pao(1120=tx35) 守 n2→T1 的起跳缘。⚠️ QA 预授权可删的就是这一门（见文件头 / 上方说明）。
    {"type": "shi_pao", "x": 1120, "y": 100},
    # cp4 = S4 攀塔入口（T1 左缘正下方）。
    {"type": "checkpoint", "x": 1152, "y": 176},
    {"type": "ci_li", "x": 1184, "y": 200},
    {"type": "coin", "x": 1216, "y": 128},
    # du_fu(1248=tx39) 正在 T1↔bp_z2 的单格空档，是塔的链条中继。
    {"type": "du_fu", "x": 1248, "y": 120},
    {"type": "coin", "x": 1280, "y": 96},
    {"type": "gu_bao", "x": 1312, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "coin", "x": 1344, "y": 96},
    # ⭐ cyclone（上升气流）唯一 1 处，0 代码、params 与 2-3.json 的 4 个实例逐值相同。
    #   几何（enemy-ai.ts:293-304 实测）：x = 气柱**左缘**、y = **地面锚点**，气柱自 y 向上延伸 h=160
    #   → bbox = x 1376..1472（tx43,44,45）× y 64..224，水平完全覆盖 T3(tx44,45) → 托到 y≈64 后正落塔顶。
    #   三重角色：T3 的保底解（相位读不准也能取 seed_06）/ gauntlet 重试站（紧邻 cp5 x=1472 = 气柱右缘，
    #   复活点刚好不与气柱重叠）/ 章末新鲜感一击。hazard=false、dragX=0 → 不产生横移，无软锁。
    #   ⚠️ 回退（QA 若判定干扰地面主路）：D1 = x 改 1504（tx47，XF1 空档正下方，变「长渡救生垫」）；
    #      D2 = 整体删除（0 依赖，仅 T3 失去保底解）。两级均为纯 JSON 一行改动。
    {
        "type": "cyclone",
        "x": 1376,
        "y": 224,
        "params": {"w": 96, "h": 160, "liftAcc": 2600, "riseMax": 220, "dragX": 0},
    },
    # ci_li(1408) 在 T3 正下方 → 从塔顶摔下来有成本但无死亡。
    {"type": "ci_li", "x": 1408, "y": 200},
    # seed_06 = T3（塔顶 ty3，顶面 y=96）上方仅 16px —— 「破穹前的最后一颗种子」，
    #   刻意不要求从 ty3 起跳（规避 3-2 §4.6「顶点出画 0.15–0.25s」，同 3-5 seed_06 手法）。
    {"type": "seed", "x": 1440, "y": 80, "seedId": "seed_06"},
    # ⚠️⚠️ cp5 = x1472（tx46）= final gauntlet 入口 = cyclone bbox 右缘（主计划 §4.3 硬要求）：
    #   与气柱组成「落地 → 复活 → 左移 1 格 → 乘气流回塔顶」的最短重试环。
    {"type": "checkpoint", "x": 1472, "y": 176},
    # du_fu(1504=tx47) = XF1（S5 长渡）的续航中继，也是 gauntlet 唯一的空中救济。
    {"type": "du_fu", "x": 1504, "y": 120},
    # shi_pao(1536=tx48) 正压在 XF1 的滞空段中点（代价轴），落点是 1 格窄岛 g1。
    {"type": "shi_pao", "x": 1536, "y": 100},
    {"type": "coin", "x": 1568, "y": 112},
    # seed_05 = g1（gauntlet 窄岛 ty4，顶面 y=128）上方仅 16px —— 1 格窄岛上站着就能吃到，不需起跳；
    #   ⭐ 公平性关键：g1 从地面纯跳可上（96px < 119px）→ 完全不玩四轴的玩家也能满蜕变（第 4 颗）。
    {"type": "seed", "x": 1600, "y": 112, "seedId": "seed_05"},
    # shi_pao(1632=tx51) 守最后一跳 XF2。
    {"type": "shi_pao", "x": 1632, "y": 100},
    {"type": "coin", "x": 1664, "y": 128},
    # gu_bao(1696) 在 g2 正下方 —— 门前最后一个音符，然后就是裂缝。
    {"type": "gu_bao", "x": 1696, "y": 224, "params": {"phaseOffset": 795}},
]

level = {
    "id": "3-6",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    # goal.x = (W-2)*TS = 1728（tx54），右墙在 tx55；与 3-1~3-5 严格同构。
    # goal 顶 y=160 = g2（最后一块 1 格窄岛 ty5）顶面 y=160 → 全项目唯一「门与终点平台等高」的收束：
    #   从最后一块岩「平着飘进裂缝」，而不是落地再走进门（设计稿 §1.4）。
    "goal": {"type": "triumph_gate", "x": 1728, "y": 160, "w": 32, "h": 64},
    # 羽降总开关（布尔，与 3-1~3-5 完全一致）；本关把 glide 收束为「四轴混编」的公共底座。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_z1", "pattern": "SSGG"},
            {"target": "bp_z2", "pattern": "SSGG"},
        ],
    },
    # 红线：两簇节拍平台瓦片必须 ty=4（y=128），严禁 ty=5（ty5 与站立角色重叠，solid 相位会把角色弹回/卡死）。
    # bp_z1 = z4（律动高台）的**唯一**入口（相位是门票，不是捷径）；
    # bp_z2 = 三层塔的**塔中层** = T3 登顶门禁（这是 3-6 相对 3-5 的结构升级：节拍平台本身成为塔的一层）。
    # 两簇共用同一 beat 块，bpm/grid/pattern 与 3-1/3-3/3-5 完全一致 → 相位记忆可无损迁移（防过载）。
    # 回退（心流保护）：beat.enabled=false 使两簇转常显 oneway → z4/T3 仍可达、seed_04/06 不丢、
    #   主路与章末 payoff 全不受影响。优先级明确：砍节拍，不砍 glide。
    "beatPlatforms": [
        {
            "id": "bp_z1",
            "initial": "ghost",
            "tiles": [
                {"tx": 18, "ty": 4},
                {"tx": 19, "ty": 4},
                {"tx": 20, "ty": 4},
            ],
        },
        {
            "id": "bp_z2",
            "initial": "ghost",
            "tiles": [
                {"tx": 40, "ty": 4},
                {"tx": 41, "ty": 4},
                {"tx": 42, "ty": 4},
            ],
        },
    ],
    # ⚠️ theme="zenith" 是全项目第 15 个 biome，仅本关使用（art/zenith-biome-spec.md §9.1）。
    #   必须与 level-data.ts 的 LevelTheme 联合类型、theme-palette.ts 的 ZENITH 注册同批落地，
    #   否则 resolveBiome() 静默回退 grass → 终章画面变草原（且测试仍会全绿，故 loader 测试已加
    #   biomeForLevel(3-6).bg === 0xffe695 这条脚本级红线）。
    "metadata": {"name": "星穹终启", "theme": "zenith", "parTimeMs": 114000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（红线守卫，失败即中断，不产出坏数据）——
assert level["goal"]["x"] + level["goal"]["w"] < W * TS, "goal 超出世界右边界"
assert level["goal"]["x"] == (W - 2) * TS, "goal.x 必须 = (width-2)*tileSize（与 3-1~3-5 同构）"
# 「平着飘进裂缝」：门顶 y 必须等于 g2（tx53 @ ty5）顶面 y = 5*32 = 160。
assert level["goal"]["y"] == 5 * TS, "goal 顶 y 必须 = g2 顶面 y=160（门与终点平台等高，设计稿 §1.4）"
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert t["ty"] == 4, f"节拍平台 ty 红线违规: {t}"
# 每条 track 的 target 必须能在 beatPlatforms 中找到（否则加载期 fail-fast）。
bp_ids = {bp["id"] for bp in level["beatPlatforms"]}
for tr in level["beat"]["tracks"]:
    assert tr["target"] in bp_ids, f"beat.track target 无对应平台: {tr}"
ENEMY_TYPES = ("gu_bao", "ci_li", "du_fu", "shi_pao")
n_enemy = sum(1 for e in entities if e["type"] in ENEMY_TYPES)
n_cyclone = sum(1 for e in entities if e["type"] == "cyclone")
n_seed = sum(1 for e in entities if e["type"] == "seed")
n_coin = sum(1 for e in entities if e["type"] == "coin")
n_cp = sum(1 for e in entities if e["type"] == "checkpoint")
assert n_enemy == 18, f"战斗敌数应为 18，实际 {n_enemy}"
assert n_cyclone == 1, f"cyclone 应为 1 处，实际 {n_cyclone}"
assert n_coin == 16, f"币数应为 16，实际 {n_coin}"
assert n_seed == 6, f"种子数应为 6，实际 {n_seed}"
assert n_cp == 5, f"检查点数应为 5，实际 {n_cp}"
assert len(entities) == 46, f"entities 应为 46 条，实际 {len(entities)}"
by_type = {t: sum(1 for e in entities if e["type"] == t) for t in ENEMY_TYPES}
assert by_type == {"gu_bao": 4, "ci_li": 4, "du_fu": 5, "shi_pao": 5}, f"敌种组合错误: {by_type}"
# 密度分子是 18（战斗敌），**不含 cyclone**；0.3214 = 全项目峰。
assert abs(n_enemy / W - 0.3214) < 0.001, f"密度应为 0.3214，实际 {n_enemy / W}"
Y_CONTRACT = {"gu_bao": 224, "ci_li": 200, "du_fu": 120, "shi_pao": 100}
for e in entities:
    if e["type"] in Y_CONTRACT:
        assert e["y"] == Y_CONTRACT[e["type"]], f"敌人 y 契约违规: {e}"
# cyclone 单独校验（y=224 是地面锚点语义，不并入敌契约）；params 与 2-3.json 逐值相同。
cyc = next(e for e in entities if e["type"] == "cyclone")
assert cyc["x"] == 1376 and cyc["y"] == 224, f"cyclone 坐标错误: {cyc}"
assert cyc["params"] == {"w": 96, "h": 160, "liftAcc": 2600, "riseMax": 220, "dragX": 0}, (
    f"cyclone params 必须与 2-3.json 逐值相同: {cyc}"
)
xs = [e["x"] for e in entities]
assert xs == sorted(xs), "entities 未按 x 升序排列"
assert len(set(xs)) == len(xs), "entities 存在重复 x（坐标自洽性）"
assert max(xs) < (W - 1) * TS, "entities 越过右墙 tx55"
# 检查点 y 契约（全部 176）+ 5 个 x 位（cp3 = 火力峰前、cp5 = gauntlet 入口 = 气柱右缘）。
cp_xs = [e["x"] for e in entities if e["type"] == "checkpoint"]
assert cp_xs == [320, 608, 800, 1152, 1472], f"检查点 x 位错误: {cp_xs}"
assert cp_xs[-1] == cyc["x"] + cyc["params"]["w"], "cp5 必须落在 cyclone bbox 右缘（复活点不被气流托起）"
for e in entities:
    if e["type"] == "checkpoint":
        assert e["y"] == 176, f"检查点 y 应为 176: {e}"
# gu_bao 四相位均分（避免同屏同步鼓动）。
gu_offsets = [e["params"]["phaseOffset"] for e in entities if e["type"] == "gu_bao"]
assert gu_offsets == [0, 265, 530, 795], f"gu_bao 相位错误: {gu_offsets}"
# 公平性地板：种子 ≥3 颗在地面主路（y=200）；第 4 颗（seed_05）在 g1（ty4，96px < 119px）→ 满蜕变可达。
ground_seeds = [e for e in entities if e["type"] == "seed" and e["y"] == 200]
assert len(ground_seeds) >= 3, f"地面主路种子应 ≥3，实际 {len(ground_seeds)}"
# du_fu 摆位纪律：相邻间距 ≥3 格 → 物理上排除 du_fu 连踩链。
du_fu_xs = [e["x"] for e in entities if e["type"] == "du_fu"]
assert du_fu_xs == [352, 544, 992, 1248, 1504], f"du_fu 摆位错误: {du_fu_xs}"
for a, b in zip(du_fu_xs, du_fu_xs[1:]):
    assert (b - a) / TS >= 3, f"du_fu 相邻间距 <3 格: {a} → {b}"
# 公平性地板：地面 ty7,8 全宽实心（零坠落死亡、零 soft-lock）。
ground = {(t["tx"], t["ty"]) for t in tiles if t["kind"] == "solid"}
for tx in range(W):
    assert (tx, 7) in ground and (tx, 8) in ground, f"地面缺口 tx={tx}"
# ⚠️ 本关专属红线：可站立层（oneway）仅 ty5 / ty4 / ty3 —— 零 ty2（height=9 的物理上限，三层即顶）。
for t in tiles:
    if t["kind"] == "oneway":
        assert t["ty"] in (3, 4, 5), f"零 ty2 红线违规（oneway 仅允许 ty3/ty4/ty5）: {t}"
assert min(t["ty"] for t in tiles if t["kind"] == "oneway") == 3, "最高可站立瓦片必须是 ty3"
# 边界墙之外不得出现任何 ty<3 的瓦片（禁令的等价脚本表述）。
for t in tiles:
    if t["ty"] < 3:
        assert t["tx"] in (0, W - 1), f"非边界墙瓦片出现在 ty<3（零 ty2 禁令）: {t}"
# 可站立 tx 集合（oneway + 节拍平台）—— shi_pao 摆位纪律：5 门炮与之无交集（读相位 / 站窄岛时头顶无炮口）。
stand_txs = {t["tx"] for t in tiles if t["kind"] == "oneway"}
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        stand_txs.add(t["tx"])
pao_txs = [e["x"] // TS for e in entities if e["type"] == "shi_pao"]
assert pao_txs == [26, 30, 35, 48, 51], f"shi_pao 摆位错误: {pao_txs}"
for tx in pao_txs:
    assert tx not in stand_txs, f"shi_pao(tx={tx}) 与可站立瓦片同列（摆位纪律违规）"
# ⚠️ n1 必须是 tx29（主理人拍板）：改回 tx28 会让 z4→n1 的 gap 降到 3 = 上升跨越安全值上限，
#    玩家可从 n1 反向回跳绕过 bp_z1 相位登上 z4 → seed_04 的时间轴独家奖励失效（设计稿 §4.2 反证表）。
n1_txs = [t["tx"] for t in tiles if t["kind"] == "oneway" and t["ty"] == 5 and 26 <= t["tx"] <= 32]
assert n1_txs == [29], f"n1 必须是 tx29（严禁改回 tx28，否则 z4 相位门禁失效）: {n1_txs}"
# 节拍平台瓦片不得与 tiles[] 静态瓦片重叠（initial=ghost 语义，同 1-2/3-1/3-3/3-4/3-5）。
static = {(t["tx"], t["ty"]) for t in tiles}
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert (t["tx"], t["ty"]) not in static, f"节拍平台与静态瓦片重叠: {t}"
# 可达性事实（设计意图，非 bug）：ty3 顶距地面 128px > 满跳+二段跳顶点 119px；ty4 为 96px < 119px。
assert (7 - 3) * TS == 128 and (7 - 3) * TS > 119, "ty3 应为地面不可直达（三处 ty3 各有专属入口）"
assert (7 - 4) * TS == 96 and (7 - 4) * TS < 119, "ty4 应为地面纯跳可达（公平性地板）"

out = "src/config/levels/3-6.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} cyclone={n_cyclone} coin={n_coin} seed={n_seed} checkpoint={n_cp})",
)
