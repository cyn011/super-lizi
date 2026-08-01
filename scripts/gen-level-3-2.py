"""生成 src/config/levels/3-2.json —— 3-2《星隙长渡》（星界 astral，第三章深化 A：**空间轴**）。

权威依据：design/gdd/level-3-2-design.md
          §2（尺寸）/ §3（地形清单）/ §4.1（safe_gap 校验表）/ §5（entities 数组）/ §6（检查点）/
          §7（节拍平台，红线 ty=4）/ §8（种子）/ §9（parTimeMs）/ §10（metadata）/ §11（汇总结构草案）。
结构范式对齐 scripts/gen-level-3-1.py（逐字同构，仅换坐标与规模）。

红线：
  - 云海地面 ty7,8 全宽实心恒存在 → 零坠落死亡、零 soft-lock（公平性地板）。
  - 浮岛全部复用既有 oneway，0 新增 tile kind；entities 0 新增类型；敌人代码 0 改动。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5；本关仅 1 簇（认知预算全给空间轴）。
  - mechanics.glide=true 沿用 3-1 的布尔写法（非对象），0 Schema 变更。
  - goal.x = (width-2)*32 = 1472（tx46），与 3-1 的 tx=width-2 严格同构（设计稿 §0 ⚠️）。
"""
import json

W, H = 48, 9
TS = 32

tiles = []
# 云海地面 ty7,ty8 整宽（视觉为云海层，碰撞语义同 solid；不挖坑、不加 hazard）
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左墙 tx0 / 右墙 tx47 整高（防越界）
for ty in range(H):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})

# oneway 远岛群 fj0..fj5（设计稿 §3；全部为可选高路，羽降失败落回地面继续前进）。
# 结构骨架 = 「上升靠跳，远渡靠飘」交替链（§3.2）：
#   地面 →(直跳升2)→ fj0(ty5) →(纯跳跃 2格 Δ−2)→ fj1(ty3) ══羽降 7格 Δ+2══▶ fj2(ty5)
#   fj2 →(纯跳跃 3格 Δ−2)→ fj3(ty3) ══羽降 6格 Δ+1══▶ fj4(ty4) → bp_b1 → fj5 → 星门
FLOAT_ISLANDS = [
    ((4, 5), 5),          # fj0 阶梯岛        S1 登高第一级（地面直跳可达）
    ((8, 9, 10), 3),      # fj1 高栖岛        S2 长渡①起点（ty3 地面跳不上，须经 fj0 中继）
    ((18, 19), 5),        # fj2 长渡①落点    G2 = 7 格 Δ+2（主教具，必需羽降）
    ((23, 24), 3),        # fj3 高栖岛        S3 反面示范落点 + 长渡②起点（G3 = 3 格 Δ−2 纯跳跃）
    ((31, 32), 4),        # fj4 长渡②落点    G4 = 6 格 Δ+1（必需羽降，载 seed_03）
    ((43, 44), 5),        # fj5 门前高台      S5 收束（载 coin 1408）
]
for txs, ty in FLOAT_ISLANDS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 12（gu_bao×3 / ci_li×3 / du_fu×4 / shi_pao×2）/ 币 13 / 种 5 / 检查点 3；按 x 升序（同 3-1）。
# 敌人 y 契约恒定：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100（全 15 关零例外）。
entities = [
    {"type": "coin", "x": 96, "y": 200},
    {"type": "coin", "x": 160, "y": 128},
    {"type": "gu_bao", "x": 224, "y": 224, "params": {"phaseOffset": 0}},
    {"type": "seed", "x": 256, "y": 200, "seedId": "seed_01"},
    {"type": "coin", "x": 288, "y": 64},
    # cp1 = 长渡①起跑线正下方，把 7 格星隙的重试成本压到零（设计稿 §6）。
    {"type": "checkpoint", "x": 352, "y": 176},
    # 弧①：长渡① 路线 A（中继线）的可视化 —— 45° 斜降 → 踩 du_fu(480) → 续跳再降 → 落 fj2。
    # ⚠️ 勿随意挪动；若 QA 调整 GLIDE_MAX_FALL(140)，此弧 y 步进须同比复算（设计稿 §4.2）。
    {"type": "coin", "x": 416, "y": 56},
    {"type": "coin", "x": 448, "y": 88},
    {"type": "du_fu", "x": 480, "y": 120},
    {"type": "coin", "x": 544, "y": 96},
    {"type": "coin", "x": 576, "y": 128},
    {"type": "ci_li", "x": 608, "y": 200},
    {"type": "seed", "x": 640, "y": 200, "seedId": "seed_02"},
    {"type": "du_fu", "x": 672, "y": 120},
    # cp2 = 反面示范（G3 上跨）之后、长渡② 之前 —— 锁住「上升靠跳」这一课。
    {"type": "checkpoint", "x": 704, "y": 176},
    {"type": "coin", "x": 736, "y": 64},
    {"type": "gu_bao", "x": 768, "y": 224, "params": {"phaseOffset": 265}},
    {"type": "shi_pao", "x": 832, "y": 100},
    # 弧②：长渡② 复用同一 45° 斜率 —— 「这题我做过」（迁移验证，设计稿 §4.3）。
    {"type": "coin", "x": 864, "y": 56},
    {"type": "coin", "x": 896, "y": 88},
    {"type": "du_fu", "x": 928, "y": 120},
    {"type": "coin", "x": 960, "y": 200},
    # seed_03 = 全关唯一技能梯度奖励（须完成「Δ−2 上跨 + 6 格长渡」全链），悬于 fj4(ty4) 上方 32px。
    {"type": "seed", "x": 1024, "y": 96, "seedId": "seed_03"},
    {"type": "ci_li", "x": 1056, "y": 200},
    # cp3 紧贴 S4 压力峰之前（同 3-1 cp3 手法）。
    {"type": "checkpoint", "x": 1088, "y": 176},
    {"type": "shi_pao", "x": 1120, "y": 100},
    {"type": "coin", "x": 1152, "y": 96},
    {"type": "ci_li", "x": 1184, "y": 200},
    {"type": "seed", "x": 1216, "y": 200, "seedId": "seed_04"},
    {"type": "gu_bao", "x": 1248, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "du_fu", "x": 1312, "y": 120},
    {"type": "seed", "x": 1344, "y": 200, "seedId": "seed_05"},
    {"type": "coin", "x": 1408, "y": 128},
]

level = {
    "id": "3-2",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    # goal.x = (W-2)*TS = 1472（tx46），右墙在 tx47；与 3-1 的 tx=width-2 严格同构。
    "goal": {"type": "triumph_gate", "x": 1472, "y": 160, "w": 32, "h": 64},
    # 羽降总开关（布尔，沿用 3-1 实测形态）；数值集中在 src/config/physics-config.json。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_b1", "pattern": "SSGG"},
        ],
    },
    # 红线：节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。本关仅 1 簇，且只作 S5 可选高路，
    # 不与任何长渡叠加（认知预算全部给空间轴，设计稿 §7）。
    "beatPlatforms": [
        {
            "id": "bp_b1",
            "initial": "ghost",
            "tiles": [
                {"tx": 36, "ty": 4},
                {"tx": 37, "ty": 4},
                {"tx": 38, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "星隙长渡", "theme": "astral", "parTimeMs": 92000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（红线守卫，失败即中断，不产出坏数据）——
assert level["goal"]["x"] + level["goal"]["w"] < W * TS, "goal 超出世界右边界"
assert level["goal"]["x"] == (W - 2) * TS, "goal.x 必须 = (width-2)*tileSize（与 3-1 同构）"
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert t["ty"] == 4, f"节拍平台 ty 红线违规: {t}"
ENEMY_TYPES = ("gu_bao", "ci_li", "du_fu", "shi_pao")
n_enemy = sum(1 for e in entities if e["type"] in ENEMY_TYPES)
n_seed = sum(1 for e in entities if e["type"] == "seed")
n_coin = sum(1 for e in entities if e["type"] == "coin")
n_cp = sum(1 for e in entities if e["type"] == "checkpoint")
assert n_enemy == 12, f"敌数应为 12，实际 {n_enemy}"
assert n_seed == 5, f"种子数应为 5，实际 {n_seed}"
assert n_cp == 3, f"检查点数应为 3，实际 {n_cp}"
Y_CONTRACT = {"gu_bao": 224, "ci_li": 200, "du_fu": 120, "shi_pao": 100}
for e in entities:
    if e["type"] in Y_CONTRACT:
        assert e["y"] == Y_CONTRACT[e["type"]], f"敌人 y 契约违规: {e}"
xs = [e["x"] for e in entities]
assert xs == sorted(xs), "entities 未按 x 升序排列"
# 公平性地板：云海地面 ty7,8 全宽实心（零坠落死亡、零 soft-lock）。
ground = {(t["tx"], t["ty"]) for t in tiles if t["kind"] == "solid"}
for tx in range(W):
    assert (tx, 7) in ground and (tx, 8) in ground, f"云海地面缺口 tx={tx}"
# 节拍平台瓦片不得与 tiles[] 静态瓦片重叠（initial=ghost 语义，同 1-2/3-1）。
static = {(t["tx"], t["ty"]) for t in tiles}
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert (t["tx"], t["ty"]) not in static, f"节拍平台与静态瓦片重叠: {t}"

out = "src/config/levels/3-2.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} coin={n_coin} seed={n_seed} checkpoint={n_cp})",
)
