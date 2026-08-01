"""生成 src/config/levels/3-5.json —— 3-5《凌霄绝息》（星界 astral，第三章高压前奏：**链式轴**）。

权威依据：design/gdd/level-3-5-design.md
          §3（尺寸/分区）/ §4.1（地形清单：三层浮岩塔）/ §4.2（safe_gap 校验表）/ §5.3（entities 数组）/
          §6（检查点 4 个）/ §7（节拍平台 2 簇 = 全章上限，红线 ty=4）/ §8（种子 6 颗，3 颗地面 + 三层塔各一）/
          §9（parTimeMs）/ §10（metadata）/ §11（汇总结构草案）。
结构范式对齐 scripts/gen-level-3-3.py / gen-level-3-4.py（逐字同构，仅换坐标与规模）。

红线：
  - 云海地面 ty7,8 全宽实心恒存在 → 零坠落死亡、零 soft-lock（公平性地板）。
  - 浮岛 / 塔层全部复用既有 oneway，0 新增 tile kind；entities 0 新增类型；敌人代码 0 改动。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5；本关 2 簇 = 全章上限（2-6/3-3 先例）。
  - ⚠️ **本关专属**：三层塔可站立层仅 ty5 / ty4 / ty3，**严禁 ty2 可站立瓦片**（height=9 引擎上限，主计划 §2.4）。
    注：左右边界墙（solid）仍整高 ty0..8，与 3-1~3-4 同构 —— 禁令约束的是**可站立层（oneway / 节拍平台）**。
  - 敌 y 契约零例外：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100。
  - mechanics.glide=true 沿用布尔写法（非对象），0 Schema 变更。
  - goal.x = (width-2)*32 = 1600（tx50），与 3-1~3-4 严格同构。
"""
import json

W, H = 52, 9
TS = 32

tiles = []
# 云海地面 ty7,ty8 整宽（碰撞语义同 solid；主路恒走地面，不挖坑、不加 hazard）
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左墙 tx0 / 右墙 tx51 整高（防越界）
for ty in range(H):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})

# oneway 链条区（左 2/3）+ 三层浮岩塔（右 1/3）（设计稿 §4.1）；全部为可选高路，断链落回地面继续。
#   链条区：e0(ty5) e1(ty5) │ e2(ty4) e3(ty4) ══bp_e1(相位中继, ty4)══▶
#   塔：层1/T1(ty5,3格) → 层2/T2(ty4,3格) ══bp_e2(门禁, ty4)══▶ 层3/T3(ty3,2格) = 全关最高可站立面
# ⚠️ 层3（ty3，顶面 y=96）顶距地面 128px > 二段跳顶点 119px → **从地面绝对不可直达**：
#    这是设计意图（bp_e2 是唯一入口，设计稿 §4.2 反证表 / 主计划附录B R6），**实现期不得判为 bug**。
# ⚠️ 踩 du_fu 不能垫高（stompBounce=-300 仅抬 ≈25px）：链条的价值是「续航」不是「抬升」。
FLOAT_ISLANDS = [
    ((4, 5), 5),            # e0 S1 热身低岛
    ((9, 10), 5),           # e1 S1 热身低岛（链条起点）
    ((14, 15), 4),          # e2 S2 双段链第 1 落点
    ((20, 21), 4),          # e3 S2 双段链第 2 落点（#3 = 本关第一处必需 glide 的落点，gap4）
    # bp_e1 见 beatPlatforms（tx25,26,27 @ ty4，ghost = 链条中继站）
    ((33, 34, 35), 5),      # 层1 塔基（宽基座给容错；从地面纯跳可上，64px ≪ 119px）
    ((38, 39, 40), 4),      # 层2 塔中
    # bp_e2 见 beatPlatforms（tx44,45,46 @ ty4，ghost = 塔顶唯一入口）
    ((48, 49), 3),          # 层3 塔顶 = 全关最高可站立面（ty3；⚠️ 严禁再往上放 ty2）
]
for txs, ty in FLOAT_ISLANDS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 16（gu_bao×4 / ci_li×4 / du_fu×5 / shi_pao×3）/ 币 14 / 种 6 / 检查点 4；按 x 升序（同 3-1~3-4）。
# 敌人 y 契约恒定：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100（全 18 关零例外）。
# du_fu×5 = 本章踏板峰（y=120 恰在羽降主带），是链条骨架 + 每处必需 glide 的第二解；
#   间距 5/13/6/6 格 ≥3 → 物理上排除「du_fu 连踩通关」这个潜在主导策略（摆位即上限，零新增规则）。
# shi_pao×3 全部置于跨越空档（tx23/tx28/tx41），不与任何可站立瓦片同列 → 读相位 / 规划链条时头顶无炮口
#   （把 3-4 的代价轴降级为「复用考核」而非二次认知负荷，设计稿 §5.1）。
entities = [
    {"type": "coin", "x": 128, "y": 128},
    {"type": "gu_bao", "x": 192, "y": 224, "params": {"phaseOffset": 0}},
    # seed_01 = 地面主路（公平性地板第 1 颗）。
    {"type": "seed", "x": 224, "y": 200, "seedId": "seed_01"},
    {"type": "coin", "x": 256, "y": 200},
    {"type": "ci_li", "x": 288, "y": 200},
    {"type": "coin", "x": 320, "y": 128},
    # cp1 = S1 末 / S2 双段链入口（链条教学前锁住热身成果）。
    {"type": "checkpoint", "x": 352, "y": 176},
    # du_fu(416=tx13) = #2（e1→e2 升跨）的可选踏板 —— 先建立「它能踩」的认知。
    {"type": "du_fu", "x": 416, "y": 120},
    {"type": "coin", "x": 448, "y": 96},
    {"type": "coin", "x": 512, "y": 112},
    # du_fu(576=tx18) = #3（gap4，本关第一处必需 glide）正中 —— 「踩了还能再飘」的首次考核。
    {"type": "du_fu", "x": 576, "y": 120},
    {"type": "coin", "x": 608, "y": 112},
    # seed_02 = 地面主路（第 2 颗）。
    {"type": "seed", "x": 640, "y": 200, "seedId": "seed_02"},
    {"type": "ci_li", "x": 672, "y": 200},
    {"type": "coin", "x": 688, "y": 96},
    # cp2 = S2 末 / S3 三段链 + 双炮入口。
    {"type": "checkpoint", "x": 704, "y": 176},
    # shi_pao(736=tx23) 守 #4 的起跳段（决策点，不守落点）。
    {"type": "shi_pao", "x": 736, "y": 100},
    {"type": "coin", "x": 800, "y": 96},
    {"type": "gu_bao", "x": 832, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "coin", "x": 864, "y": 200},
    # shi_pao(896=tx28) 守 #5（全关最长跨越 gap5）的起跳段。
    {"type": "shi_pao", "x": 896, "y": 100},
    {"type": "coin", "x": 960, "y": 112},
    # du_fu(992=tx31) = #5 空档尾部的最后一次挽救机会（第二解）。
    {"type": "du_fu", "x": 992, "y": 120},
    # ⚠️ cp3 = x1024（tx32）= S4 塔攀第一格（红线：压力峰前必有 cp）。
    {"type": "checkpoint", "x": 1024, "y": 176},
    # seed_03 = 塔基正下方地面主路（第 3 颗，塔前保底）。
    {"type": "seed", "x": 1056, "y": 200, "seedId": "seed_03"},
    {"type": "ci_li", "x": 1088, "y": 200},
    # seed_04 = 层1（塔基 ty5）顶上方 32px —— 技能梯度第一级（纯跳可得 → 保证满蜕变可达）。
    {"type": "seed", "x": 1120, "y": 128, "seedId": "seed_04"},
    {"type": "coin", "x": 1152, "y": 96},
    # du_fu(1184=tx37) = 层1↔层2 空档踏板（塔的每一级都有第二解）。
    {"type": "du_fu", "x": 1184, "y": 120},
    {"type": "gu_bao", "x": 1248, "y": 224, "params": {"phaseOffset": 265}},
    # seed_05 = 层2（塔中 ty4）顶上方 32px —— 技能梯度第二级。
    {"type": "seed", "x": 1280, "y": 96, "seedId": "seed_05"},
    # shi_pao(1312=tx41) 守层2 右缘起跳点（「要不要现在飘向 bp_e2」的决策点）。
    {"type": "shi_pao", "x": 1312, "y": 100},
    {"type": "coin", "x": 1344, "y": 96},
    # du_fu(1376=tx43) = 层2↔bp_e2 空档踏板（#7 的第二解）。
    {"type": "du_fu", "x": 1376, "y": 120},
    # ⚠️ cp4 = x1408（tx44）= bp_e2 门禁正下方（塔顶重试成本压到最低）。
    {"type": "checkpoint", "x": 1408, "y": 176},
    {"type": "coin", "x": 1440, "y": 96},
    {"type": "ci_li", "x": 1504, "y": 200},
    {"type": "coin", "x": 1520, "y": 64},
    # seed_06 = 层3（塔顶 ty3，顶面 y=96）上方仅 16px —— 走过去就能吃到，
    #   刻意不要求从 ty3 起跳（规避 3-2 §4.6「顶点出画 0.15–0.25s」的不可见风险）。
    {"type": "seed", "x": 1552, "y": 80, "seedId": "seed_06"},
    {"type": "gu_bao", "x": 1568, "y": 224, "params": {"phaseOffset": 795}},
]

level = {
    "id": "3-5",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    # goal.x = (W-2)*TS = 1600（tx50），右墙在 tx51；与 3-1~3-4 严格同构。
    "goal": {"type": "triumph_gate", "x": 1600, "y": 160, "w": 32, "h": 64},
    # 羽降总开关（布尔，与 3-1~3-4 完全一致）；本关把 glide 深化为「可被踩踏续航的链条节点」。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_e1", "pattern": "SSGG"},
            {"target": "bp_e2", "pattern": "SSGG"},
        ],
    },
    # 红线：两簇节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。
    # bp_e1 = 链条中继站（S3，链条进行中读一次相位）；bp_e2 = 塔顶门禁（S4，层3 的唯一入口）。
    # 两簇共用同一 beat 块，bpm/grid/pattern 与 3-1~3-4 完全一致 → 相位记忆可无损迁移（防过载）。
    "beatPlatforms": [
        {
            "id": "bp_e1",
            "initial": "ghost",
            "tiles": [
                {"tx": 25, "ty": 4},
                {"tx": 26, "ty": 4},
                {"tx": 27, "ty": 4},
            ],
        },
        {
            "id": "bp_e2",
            "initial": "ghost",
            "tiles": [
                {"tx": 44, "ty": 4},
                {"tx": 45, "ty": 4},
                {"tx": 46, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "凌霄绝息", "theme": "astral", "parTimeMs": 104000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（红线守卫，失败即中断，不产出坏数据）——
assert level["goal"]["x"] + level["goal"]["w"] < W * TS, "goal 超出世界右边界"
assert level["goal"]["x"] == (W - 2) * TS, "goal.x 必须 = (width-2)*tileSize（与 3-1~3-4 同构）"
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert t["ty"] == 4, f"节拍平台 ty 红线违规: {t}"
# 每条 track 的 target 必须能在 beatPlatforms 中找到（否则加载期 fail-fast）。
bp_ids = {bp["id"] for bp in level["beatPlatforms"]}
for tr in level["beat"]["tracks"]:
    assert tr["target"] in bp_ids, f"beat.track target 无对应平台: {tr}"
ENEMY_TYPES = ("gu_bao", "ci_li", "du_fu", "shi_pao")
n_enemy = sum(1 for e in entities if e["type"] in ENEMY_TYPES)
n_seed = sum(1 for e in entities if e["type"] == "seed")
n_coin = sum(1 for e in entities if e["type"] == "coin")
n_cp = sum(1 for e in entities if e["type"] == "checkpoint")
assert n_enemy == 16, f"敌数应为 16，实际 {n_enemy}"
assert n_coin == 14, f"币数应为 14，实际 {n_coin}"
assert n_seed == 6, f"种子数应为 6，实际 {n_seed}"
assert n_cp == 4, f"检查点数应为 4，实际 {n_cp}"
by_type = {t: sum(1 for e in entities if e["type"] == t) for t in ENEMY_TYPES}
assert by_type == {"gu_bao": 4, "ci_li": 4, "du_fu": 5, "shi_pao": 3}, f"敌种组合错误: {by_type}"
Y_CONTRACT = {"gu_bao": 224, "ci_li": 200, "du_fu": 120, "shi_pao": 100}
for e in entities:
    if e["type"] in Y_CONTRACT:
        assert e["y"] == Y_CONTRACT[e["type"]], f"敌人 y 契约违规: {e}"
xs = [e["x"] for e in entities]
assert xs == sorted(xs), "entities 未按 x 升序排列"
assert len(set(xs)) == len(xs), "entities 存在重复 x（坐标自洽性）"
assert max(xs) < (W - 1) * TS, "entities 越过右墙 tx51"
# 检查点 y 契约（全部 176）。
for e in entities:
    if e["type"] == "checkpoint":
        assert e["y"] == 176, f"检查点 y 应为 176: {e}"
# 公平性地板：种子 ≥3 颗在地面主路（y=200）；第 4 颗（seed_04）在纯跳可达的层1 → 满蜕变可达。
ground_seeds = [e for e in entities if e["type"] == "seed" and e["y"] == 200]
assert len(ground_seeds) >= 3, f"地面主路种子应 ≥3，实际 {len(ground_seeds)}"
# du_fu 摆位纪律：相邻间距 ≥3 格 → 物理上排除 du_fu 连踩链。
du_fu_xs = [e["x"] for e in entities if e["type"] == "du_fu"]
for a, b in zip(du_fu_xs, du_fu_xs[1:]):
    assert (b - a) / TS >= 3, f"du_fu 相邻间距 <3 格: {a} → {b}"
# 公平性地板：云海地面 ty7,8 全宽实心（零坠落死亡、零 soft-lock）。
ground = {(t["tx"], t["ty"]) for t in tiles if t["kind"] == "solid"}
for tx in range(W):
    assert (tx, 7) in ground and (tx, 8) in ground, f"云海地面缺口 tx={tx}"
# ⚠️ 本关专属红线：可站立层（oneway）仅 ty5 / ty4 / ty3 —— 零 ty2（height=9 的物理上限，三层即顶）。
for t in tiles:
    if t["kind"] == "oneway":
        assert t["ty"] in (3, 4, 5), f"三层塔红线违规（oneway 仅允许 ty3/ty4/ty5）: {t}"
# 边界墙之外不得出现任何 ty<3 的瓦片（禁令的等价脚本表述）。
for t in tiles:
    if t["ty"] < 3:
        assert t["tx"] in (0, W - 1), f"非边界墙瓦片出现在 ty<3（ty2 禁令）: {t}"
# 节拍平台瓦片不得与 tiles[] 静态瓦片重叠（initial=ghost 语义，同 1-2/3-1/3-3/3-4）。
static = {(t["tx"], t["ty"]) for t in tiles}
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert (t["tx"], t["ty"]) not in static, f"节拍平台与静态瓦片重叠: {t}"

out = "src/config/levels/3-5.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} coin={n_coin} seed={n_seed} checkpoint={n_cp})",
)
