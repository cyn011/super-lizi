"""生成 src/config/levels/3-1.json —— 3-1《浮空初息》（星界 astral，第三章 opener）。

权威依据：design/gdd/level-3-1-design.md §5.2（地形清单）/ §6.4（entities 数组）/ §7（检查点）/
          §8（节拍平台，红线 ty=4）/ §11（metadata）/ §12（汇总结构草案）。
结构范式对齐 scripts/gen-level-2-6.py。

红线：
  - 云海地面 ty7,8 全宽实心恒存在 → 零坠落死亡、零 soft-lock（公平性地板）。
  - 浮岛全部复用既有 oneway，0 新增 tile kind；entities 0 新增类型；敌人代码 0 改动。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。
  - mechanics.glide=true 为本关唯一 Schema 新增字段（旧 13 关缺省 = 关闭，零回归）。
"""
import json

W, H = 46, 9
TS = 32

tiles = []
# 云海地面 ty7,ty8 整宽（视觉为云海层，碰撞语义同 solid；不挖坑、不加 hazard）
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左墙 tx0 / 右墙 tx45 整高（防越界）
for ty in range(H):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})

# oneway 浮岛群 fi0..fi6（设计稿 §5.2；全部为可选高路，羽降失败落回地面继续前进）
FLOAT_ISLANDS = [
    ((4, 5), 5),          # fi0 阶梯岛      S1 登高第一级
    ((8, 9, 10), 3),      # fi1 高栖岛      S1 羽降起点（载 seed_01）
    ((16, 17), 5),        # fi2 岛链起      S2 → fi3 为 5 格 gap（必需羽降）
    ((23, 24), 5),        # fi3 岛链终      S2
    ((28, 29), 4),        # fi4 抬升岛      S3 → fi5 为 4 格 gap（羽降 or 踩 du_fu）
    ((34, 35), 4),        # fi5 走廊岛      S3/S4 交界
    ((42, 43), 5),        # fi6 门前岛      S5 探索奖励（载 seed_05）
]
for txs, ty in FLOAT_ISLANDS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 11（gu_bao×3 / ci_li×3 / du_fu×3 / shi_pao×2）/ 币 12 / 种 5 / 检查点 3；按 x 升序（同 2-6）。
# 敌人 y 契约恒定：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100（全 14 关零例外）。
entities = [
    {"type": "coin", "x": 96, "y": 200},
    {"type": "gu_bao", "x": 224, "y": 224, "params": {"phaseOffset": 0}},
    {"type": "coin", "x": 288, "y": 80},
    {"type": "seed", "x": 320, "y": 80, "seedId": "seed_01"},
    # S1 教学装置：四连金币 45° 下降弧，与 glide.fallMax=140 的羽降轨迹斜率精确匹配。
    # ⚠️ 勿随意挪动；若 QA 调整 GLIDE_MAX_FALL，此弧 y 步进须同比调整（设计稿 §6.4）。
    {"type": "coin", "x": 352, "y": 112},
    {"type": "coin", "x": 384, "y": 136},
    {"type": "coin", "x": 416, "y": 160},
    {"type": "coin", "x": 448, "y": 184},
    {"type": "ci_li", "x": 480, "y": 200},
    {"type": "checkpoint", "x": 512, "y": 176},
    {"type": "coin", "x": 544, "y": 128},
    {"type": "seed", "x": 608, "y": 200, "seedId": "seed_02"},
    {"type": "du_fu", "x": 640, "y": 120},
    {"type": "coin", "x": 672, "y": 128},
    {"type": "coin", "x": 736, "y": 128},
    {"type": "checkpoint", "x": 800, "y": 176},
    {"type": "gu_bao", "x": 832, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "seed", "x": 864, "y": 200, "seedId": "seed_03"},
    {"type": "coin", "x": 896, "y": 128},
    {"type": "du_fu", "x": 992, "y": 120},
    {"type": "ci_li", "x": 1024, "y": 200},
    {"type": "coin", "x": 1056, "y": 200},
    # cp3 紧贴 S4 弹幕走廊之前 —— 把「反向教学峰」的重试成本压到最低。
    {"type": "checkpoint", "x": 1088, "y": 176},
    {"type": "shi_pao", "x": 1120, "y": 100},
    {"type": "du_fu", "x": 1152, "y": 120},
    {"type": "seed", "x": 1184, "y": 200, "seedId": "seed_04"},
    {"type": "ci_li", "x": 1216, "y": 200},
    {"type": "gu_bao", "x": 1280, "y": 224, "params": {"phaseOffset": 265}},
    {"type": "shi_pao", "x": 1312, "y": 100},
    {"type": "coin", "x": 1344, "y": 128},
    {"type": "seed", "x": 1376, "y": 128, "seedId": "seed_05"},
]

level = {
    "id": "3-1",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    "goal": {"type": "triumph_gate", "x": 1408, "y": 160, "w": 32, "h": 64},
    # ★ 本关唯一 Schema 新增：Ch3 新机制「羽降」总开关（旧 13 关缺省 = 关闭，零回归）。
    #   数值（fallMax=140 / activateVy=60）集中在 src/config/physics-config.json，QA 统一调校。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_a1", "pattern": "SSGG"},
        ],
    },
    # 红线：节拍平台瓦片必须 ty=4（y=128，站立角色头顶之上），严禁 ty=5。opener 仅 1 簇（防认知过载）。
    "beatPlatforms": [
        {
            "id": "bp_a1",
            "initial": "ghost",
            "tiles": [
                {"tx": 38, "ty": 4},
                {"tx": 39, "ty": 4},
                {"tx": 40, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "浮空初息", "theme": "astral", "parTimeMs": 88000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（红线守卫，失败即中断，不产出坏数据）——
assert level["goal"]["x"] + level["goal"]["w"] < W * TS, "goal 超出世界右边界"
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert t["ty"] == 4, f"节拍平台 ty 红线违规: {t}"
ENEMY_TYPES = ("gu_bao", "ci_li", "du_fu", "shi_pao")
n_enemy = sum(1 for e in entities if e["type"] in ENEMY_TYPES)
n_seed = sum(1 for e in entities if e["type"] == "seed")
n_coin = sum(1 for e in entities if e["type"] == "coin")
n_cp = sum(1 for e in entities if e["type"] == "checkpoint")
assert n_enemy == 11, f"敌数应为 11，实际 {n_enemy}"
assert n_seed == 5, f"种子数应为 5，实际 {n_seed}"
assert n_cp == 3, f"检查点数应为 3，实际 {n_cp}"
Y_CONTRACT = {"gu_bao": 224, "ci_li": 200, "du_fu": 120, "shi_pao": 100}
for e in entities:
    if e["type"] in Y_CONTRACT:
        assert e["y"] == Y_CONTRACT[e["type"]], f"敌人 y 契约违规: {e}"
xs = [e["x"] for e in entities]
assert xs == sorted(xs), "entities 未按 x 升序排列"

out = "src/config/levels/3-1.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} coin={n_coin} seed={n_seed} checkpoint={n_cp})",
)
