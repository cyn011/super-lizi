"""生成 src/config/levels/3-4.json —— 3-4《陨雨回廊》（星界 astral，第三章深化 C：**代价轴**）。

权威依据：design/gdd/level-3-4-design.md
          §3（尺寸/分区）/ §4.1（地形清单）/ §4.2（safe_gap 校验表）/ §5.3（entities 数组）/ §6（检查点 4 个）/
          §7（节拍平台 1 簇，红线 ty=4）/ §8（种子 6 颗，4 颗地面主路）/ §9（parTimeMs）/ §10（metadata）/ §11（汇总结构草案）。
结构范式对齐 scripts/gen-level-3-3.py（逐字同构，仅换坐标与规模）。

红线：
  - 云海地面 ty7,8 全宽实心恒存在 → 零坠落死亡、零 soft-lock（公平性地板）。
  - 浮岛全部复用既有 oneway，0 新增 tile kind；entities 0 新增类型；敌人代码 0 改动。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5；本关 1 簇（主动降档，把认知带宽让给弹道读取）。
  - 敌 y 契约零例外：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100。
  - mechanics.glide=true 沿用布尔写法（非对象），0 Schema 变更。
  - goal.x = (width-2)*32 = 1536（tx48），与 3-1/3-2/3-3 严格同构。
  - 本关构图为「横向走廊」而非「塔」：可站立浮岛只用 ty5 / ty4，**零 ty3**（与 3-3 梯列、3-5 三层塔的构图区分手段）。
"""
import json

W, H = 50, 9
TS = 32

tiles = []
# 云海地面 ty7,ty8 整宽（碰撞语义同 solid；主路恒走地面，不挖坑、不加 hazard）
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左墙 tx0 / 右墙 tx49 整高（防越界）
for ty in range(H):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})

# oneway 走廊踏石 st0..st8（设计稿 §4.1；全部为可选高路，失败落回地面继续前进）。
# 「回廊」= 顶面 y 只有 128 / 160 两个取值的一条近水平廊道，其中 **5 座只有 1 格宽**：
#   st0(ty5,2格) st1(ty5,2格) │ st2(ty4,1格) st3(ty4,2格) │ st4(ty4,1格) ══bp_d1(相位,ty4)══ st5(ty4,1格)
#   │ st6(ty4,1格) st7(ty4,1格) ⚠️三炮走廊 │ st8(ty5,2格) 门前岛
# ⚠️ 全关无 ty3 瓦片（设计稿 §3.1 / 附录 A「节拍 ty 红线」行）：本关是走廊不是塔。
# ⚠️ 全部 ty4 岛顶距地面 96px < 二段跳顶点 119px → 高路随时可从地面重入，零 soft-lock。
FLOAT_ISLANDS = [
    ((4, 5), 5),      # st0 S1 热身低岛
    ((8, 9), 5),      # st1 S1 热身低岛（走廊入口）
    ((13,), 4),       # st2 窄岛#1 —— 教具原点：炮(tx15)正压在 st2→st3 跨越上方
    ((17, 18), 4),    # st3 单炮试探落点（2 格宽给容错）
    ((22,), 4),       # st4 窄岛#2
    # bp_d1 见 beatPlatforms（tx26,27,28 @ ty4，ghost = 唯一相位簇，置于压力峰之外）
    ((31,), 4),       # st5 窄岛#3（走廊入口前最后一块）
    ((35,), 4),       # st6 窄岛#4（三炮走廊内）
    ((40,), 4),       # st7 窄岛#5（代价轴靶心：#8 跨越 gap4 = 全关唯一必需 glide 的落点）
    ((45, 46), 5),    # st8 门前岛（星门在 tx48）
]
for txs, ty in FLOAT_ISLANDS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 14（gu_bao×3 / ci_li×3 / du_fu×3 / shi_pao×5）/ 币 14 / 种 6 / 检查点 4；按 x 升序（同 3-1/3-2/3-3）。
# 敌人 y 契约恒定：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100（全 18 关零例外）。
# shi_pao×5 = 本章火力峰，5 门全在 y=100 排成一条贯穿全关的火线（1 门 S2 教学样本 + 1 门 S3 出口 + 3 门 S4 走廊）。
# du_fu×3 间距 400px（12.5 格）≫ 3 格下限 → 不存在 du_fu 连踩链（那是 3-5 的教学内容，本关不抢跑）。
entities = [
    {"type": "coin", "x": 128, "y": 200},
    {"type": "coin", "x": 160, "y": 128},
    {"type": "gu_bao", "x": 192, "y": 224, "params": {"phaseOffset": 0}},
    # seed_01 = 地面主路（公平性地板第 1 颗）。
    {"type": "seed", "x": 224, "y": 200, "seedId": "seed_01"},
    {"type": "coin", "x": 288, "y": 128},
    # cp1 = S1 末 / S2 单炮试探入口（第一门炮前）。
    {"type": "checkpoint", "x": 320, "y": 176},
    # du_fu(384) = 跨越 #2（st1→st2 升跨）的第二解，兼「踏板仍然存在」的安抚信号。
    {"type": "du_fu", "x": 384, "y": 120},
    {"type": "coin", "x": 432, "y": 96},
    # shi_pao(480=tx15) = 教具原点：正压在 st2→st3（gap3）上方 28px，同一跨越两种代价。
    {"type": "shi_pao", "x": 480, "y": 100},
    {"type": "coin", "x": 512, "y": 112},
    # cp2 = S2 末 / S3 窄岛夹击入口。
    {"type": "checkpoint", "x": 576, "y": 176},
    # seed_02 = 地面主路（第 2 颗）。
    {"type": "seed", "x": 608, "y": 200, "seedId": "seed_02"},
    {"type": "coin", "x": 640, "y": 200},
    {"type": "ci_li", "x": 672, "y": 200},
    {"type": "coin", "x": 704, "y": 96},
    {"type": "coin", "x": 768, "y": 112},
    # du_fu(784≈tx24.5) = bp_d1 相位跨越（#5）的第二解。
    {"type": "du_fu", "x": 784, "y": 120},
    # cp3 = bp_d1 相位段起点正下方（相位失败 = 落回地面即被覆盖）。
    {"type": "checkpoint", "x": 832, "y": 176},
    # seed_05 悬于 bp_d1(tx26..28 @ty4) 顶上方 32px —— 相位路径奖励（低门槛高路）。
    {"type": "seed", "x": 880, "y": 96, "seedId": "seed_05"},
    {"type": "gu_bao", "x": 896, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "coin", "x": 928, "y": 200},
    # shi_pao(960) 压在 S3 出口 —— 预告走廊。
    {"type": "shi_pao", "x": 960, "y": 100},
    # ⚠️ cp4 = x1024（tx32）= S4 三炮走廊第一格（红线：压力峰前必有 cp，紧贴入口）。
    {"type": "checkpoint", "x": 1024, "y": 176},
    # seed_03 = 走廊内地面主路（代价轴的公平性核心：不擅长弹幕也拿得到）。
    {"type": "seed", "x": 1056, "y": 200, "seedId": "seed_03"},
    {"type": "shi_pao", "x": 1088, "y": 100},
    {"type": "coin", "x": 1120, "y": 96},
    # ci_li(1152) 在地面惩罚「干脆全程走地面」的懒解。
    {"type": "ci_li", "x": 1152, "y": 200},
    # du_fu(1184=tx37) = #8（st6→st7，gap4，全关唯一必需 glide）的第二解，落在 4 格空档正中。
    {"type": "du_fu", "x": 1184, "y": 120},
    {"type": "coin", "x": 1216, "y": 112},
    {"type": "shi_pao", "x": 1248, "y": 100},
    # seed_06 悬于 st7 窄岛（tx40）顶上方 32px —— 全关最贵的一颗（三炮火线正中的 1 格窄岛）。
    {"type": "seed", "x": 1296, "y": 96, "seedId": "seed_06"},
    {"type": "shi_pao", "x": 1344, "y": 100},
    # seed_04 = 地面主路（第 4 颗，星门前保底 → 纯地面路线亦可满蜕变）。
    {"type": "seed", "x": 1376, "y": 200, "seedId": "seed_04"},
    {"type": "coin", "x": 1392, "y": 128},
    {"type": "gu_bao", "x": 1408, "y": 224, "params": {"phaseOffset": 265}},
    {"type": "coin", "x": 1456, "y": 128},
    {"type": "ci_li", "x": 1472, "y": 200},
    {"type": "coin", "x": 1504, "y": 200},
]

level = {
    "id": "3-4",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    # goal.x = (W-2)*TS = 1536（tx48），右墙在 tx49；与 3-1/3-2/3-3 严格同构。
    "goal": {"type": "triumph_gate", "x": 1536, "y": 160, "w": 32, "h": 64},
    # 羽降总开关（布尔，与 3-1/3-2/3-3 完全一致）；本关把 glide 从「资产」翻成「负债」（滞空 = 暴露）。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_d1", "pattern": "SSGG"},
        ],
    },
    # 红线：节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。
    # 本关**主动降回 1 簇**且置于 S3（压力峰之外）：S4 走廊内零节拍瓦片、零相位读取（防认知过载）。
    "beatPlatforms": [
        {
            "id": "bp_d1",
            "initial": "ghost",
            "tiles": [
                {"tx": 26, "ty": 4},
                {"tx": 27, "ty": 4},
                {"tx": 28, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "陨雨回廊", "theme": "astral", "parTimeMs": 98000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（红线守卫，失败即中断，不产出坏数据）——
assert level["goal"]["x"] + level["goal"]["w"] < W * TS, "goal 超出世界右边界"
assert level["goal"]["x"] == (W - 2) * TS, "goal.x 必须 = (width-2)*tileSize（与 3-1/3-2/3-3 同构）"
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
assert n_enemy == 14, f"敌数应为 14，实际 {n_enemy}"
assert n_coin == 14, f"币数应为 14，实际 {n_coin}"
assert n_seed == 6, f"种子数应为 6，实际 {n_seed}"
assert n_cp == 4, f"检查点数应为 4，实际 {n_cp}"
by_type = {t: sum(1 for e in entities if e["type"] == t) for t in ENEMY_TYPES}
assert by_type == {"gu_bao": 3, "ci_li": 3, "du_fu": 3, "shi_pao": 5}, f"敌种组合错误: {by_type}"
Y_CONTRACT = {"gu_bao": 224, "ci_li": 200, "du_fu": 120, "shi_pao": 100}
for e in entities:
    if e["type"] in Y_CONTRACT:
        assert e["y"] == Y_CONTRACT[e["type"]], f"敌人 y 契约违规: {e}"
xs = [e["x"] for e in entities]
assert xs == sorted(xs), "entities 未按 x 升序排列"
assert len(set(xs)) == len(xs), "entities 存在重复 x（坐标自洽性）"
# 检查点 y 契约（全部 176）。
for e in entities:
    if e["type"] == "checkpoint":
        assert e["y"] == 176, f"检查点 y 应为 176: {e}"
# 公平性地板：种子 ≥3 颗在地面主路（y=200）→ 不碰高路也能满蜕变（本关实为 4 颗）。
ground_seeds = [e for e in entities if e["type"] == "seed" and e["y"] == 200]
assert len(ground_seeds) >= 3, f"地面主路种子应 ≥3，实际 {len(ground_seeds)}"
# 公平性地板：云海地面 ty7,8 全宽实心（零坠落死亡、零 soft-lock）。
ground = {(t["tx"], t["ty"]) for t in tiles if t["kind"] == "solid"}
for tx in range(W):
    assert (tx, 7) in ground and (tx, 8) in ground, f"云海地面缺口 tx={tx}"
# 构图红线：本关为走廊非塔 —— 可站立 oneway 只允许 ty4 / ty5（零 ty3、零 ty2）。
for t in tiles:
    if t["kind"] == "oneway":
        assert t["ty"] in (4, 5), f"走廊构图红线违规（oneway 仅允许 ty4/ty5）: {t}"
# 节拍平台瓦片不得与 tiles[] 静态瓦片重叠（initial=ghost 语义，同 1-2/3-1/3-3）。
static = {(t["tx"], t["ty"]) for t in tiles}
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert (t["tx"], t["ty"]) not in static, f"节拍平台与静态瓦片重叠: {t}"

out = "src/config/levels/3-4.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} coin={n_coin} seed={n_seed} checkpoint={n_cp})",
)
