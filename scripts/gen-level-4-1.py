"""生成 src/config/levels/4-1.json —— 4-1《拾掷回声》（翠野 grass，第四章 opener）。

权威依据：design/gdd/level-4-1-design.md
          §4.1（地形清单）/ §5.3（entities 数组，40 项）/ §6（检查点）/
          §7（节拍平台，红线 ty=4）/ §11（metadata）/ §12（汇总结构草案）/ §13.1（E1–E14 断言）。
章级依据：design/gdd/chapter-4-plan.md §1.2 / §3.3 / §3.4 / §7。
结构范式对齐 scripts/gen-level-3-1.py。

红线：
  - 地面 ty7,8 全宽实心恒存在 → 零坠落死亡、零 soft-lock（公平性地板）。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。
  - 全部复用既有 schema：0 新增 tile kind、0 新增 entity 类型、0 引擎代码改动。
  - ⚠️ mechanics 只有 {"glide": true}。**严禁写 "throw": true** —— LevelMechanicsDef 无此字段，
    投掷是全局常驻能力（无 feature flag、无 mechanics 门），加了会被忽略或报错（设计稿 §12）。
  - entities 按 x **非降序**（允许同 x 不同 y：本关有 6 组，见 §5.3）。
"""
import json

W, H = 48, 9
TS = 32

tiles = []
# 地面 ty7,ty8 整宽 solid（无坑、无 hazard）→ 所有 gap 下方均为地面，坠落即回主路。
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左右墙 tx0 / tx47 的 ty0..ty6 solid（防越界；ty7/ty8 已由地面覆盖）
for ty in range(7):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})

# oneway 单向平台群 P1..P6（设计稿 §4.1；**全部 ty5**，顶面 y=160）
# 站上 ty5 → oy=139.6，落在 du_fu 命中窗 (84,168) 内 = 本关「站位即瞄准」的物理基础。
ONEWAY_CLUSTERS = [
    ((5, 6), 5),      # P1 观景低台（死胡同，C1 gap=6 刻意不可跨）
    ((13, 14), 5),    # P2 左射台 ⭐ 本关第一个「正确的高度」
    ((18, 19), 5),    # P3 右台（du_fu@576 空域 + seed_02）
    ((25, 26), 5),    # P4 起跳台 ⭐ S3 组合段起点
    ((32, 33), 5),    # P5 落点台 ⭐⭐ du_fu@1056 悬其上方
    ((41, 42), 5),    # P6 对消观察位（C5 gap=7 刻意不可跨）
]
for txs, ty in ONEWAY_CLUSTERS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 14（ci_li×6 / chong_feng×3 / du_fu×2 / gu_bao×2 / shi_pao×1）/ 币 13 / 种 6 / 栗 4 / cp 3 = 40 实体。
# 敌人 y 契约恒定（全项目零例外）：gu_bao=224 / ci_li·chong_feng·chestnut=200 / du_fu=120 /
#                                 shi_pao=100 / checkpoint=176。
# ⚠️ x 为**非降序**：6 组同 x 异 y（192/448/992/1120/1184/1408），validateLevelData 不校验顺序。
entities = [
    {"type": "coin", "x": 96, "y": 200},                                    # S1 射线示意 1/3
    {"type": "coin", "x": 128, "y": 200},                                   # S1 射线示意 2/3
    {"type": "coin", "x": 160, "y": 200},                                   # S1 射线示意 3/3
    # ⚠️ 上三枚金币 y=200 与地面发射线 oy=203.6 视觉同线 —— 这是本关「零文字教投掷」的唯一诱因，
    #    勿改 y（设计稿 §5.2 S1）。
    {"type": "ci_li", "x": 192, "y": 200},                                  # T1 射线尽头
    {"type": "coin", "x": 192, "y": 128},                                   # P1 台上（tx6 上方）
    {"type": "seed", "x": 224, "y": 200, "seedId": "seed_01"},              # 地面主路
    {"type": "ci_li", "x": 288, "y": 200},                                  # T2 巩固
    {"type": "checkpoint", "x": 320, "y": 176},                             # cp1（距 chong_feng@384 = 2 格）
    {"type": "chestnut", "x": 352, "y": 200, "params": {"amount": 5}},      # 补给 1/4
    {"type": "chong_feng", "x": 384, "y": 200},                             # T3 不可踩 → 投掷是主动解
    {"type": "coin", "x": 448, "y": 128},                                   # P2 上方引导（「跳上来」）
    {"type": "chong_feng", "x": 448, "y": 200},                             # T4 地面对照组
    {"type": "coin", "x": 544, "y": 96},                                    # du_fu 上方奖励
    {"type": "du_fu", "x": 576, "y": 120},                                  # ⭐ T5/T6 高度教具（本关教学心脏）
    {"type": "seed", "x": 608, "y": 128, "seedId": "seed_02"},              # P3 上方（低门槛高路）
    {"type": "ci_li", "x": 672, "y": 200},                                  # S2 收尾
    {"type": "chestnut", "x": 736, "y": 200, "params": {"amount": 5}},      # 补给 2/4
    {"type": "checkpoint", "x": 768, "y": 176},                             # cp2（距 P4 起跳台@800 = 1 格）
    {"type": "seed", "x": 832, "y": 128, "seedId": "seed_03"},              # P4 起跳台上方
    {"type": "ci_li", "x": 896, "y": 200},                                  # T7 地面第二解
    # 45° 羽降弧（y 步进 32px/格）—— 与 3-1 同手法：为 C4 的「羽降 + 投掷」画出落点预告。
    {"type": "coin", "x": 928, "y": 64},                                    # ⭐ 羽降弧 1/3
    {"type": "coin", "x": 960, "y": 96},                                    # ⭐ 羽降弧 2/3
    {"type": "coin", "x": 992, "y": 128},                                   # ⭐ 羽降弧 3/3
    {"type": "seed", "x": 992, "y": 200, "seedId": "seed_04"},              # 地面主路
    {"type": "chong_feng", "x": 1024, "y": 200},                            # T9 落点台下方
    {"type": "du_fu", "x": 1056, "y": 120},                                 # ⭐⭐ T8 落点威胁（本关核心）
    {"type": "chestnut", "x": 1088, "y": 200, "params": {"amount": 5}},     # 补给 3/4
    {"type": "coin", "x": 1120, "y": 96},                                   # bp_a1 上方（走过即得，y=96 防出画）
    {"type": "gu_bao", "x": 1120, "y": 224, "params": {"phaseOffset": 0}},  # ⭐ T10 几何免疫
    {"type": "coin", "x": 1184, "y": 96},                                   # 高路奖励
    {"type": "gu_bao", "x": 1184, "y": 224, "params": {"phaseOffset": 530}},# ⭐ T10 第二只（相位错开）
    {"type": "seed", "x": 1216, "y": 200, "seedId": "seed_05"},             # 地面主路
    {"type": "ci_li", "x": 1248, "y": 200},                                 # ⭐ T11 对照组（打得中！）
    {"type": "checkpoint", "x": 1280, "y": 176},                            # cp3（距 shi_pao@1376 = 3 格）
    {"type": "coin", "x": 1312, "y": 128},                                  # P6 上方
    {"type": "seed", "x": 1344, "y": 128, "seedId": "seed_06"},             # P6 上方高路
    {"type": "shi_pao", "x": 1376, "y": 100},                               # ⭐ T12/T13 对消（tx43，不与可站立 tx 重叠）
    {"type": "chestnut", "x": 1408, "y": 200, "params": {"amount": 5}},     # 补给 4/4
    {"type": "coin", "x": 1408, "y": 128},
    {"type": "ci_li", "x": 1440, "y": 200},                                 # T14 goal 前守门
]

level = {
    "id": "4-1",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],  # 检查点以 entities[] 表达（沿用 2-1..3-6 写法），顶层留空
    "goal": {"type": "triumph_gate", "x": 1472, "y": 160, "w": 32, "h": 64},
    # 羽降沿用 Ch3；⚠️ 无 "throw" 字段（schema 不存在，投掷全局常驻）。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_a1", "pattern": "SSGG"},
        ],
    },
    # 红线：节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。opener 仅 1 簇（防认知过载）。
    # 位置 tx34-36 = 两只 gu_bao 正上方 → S4 反向教学的「绕过去」出口。
    "beatPlatforms": [
        {
            "id": "bp_a1",
            "initial": "ghost",
            "tiles": [
                {"tx": 34, "ty": 4},
                {"tx": 35, "ty": 4},
                {"tx": 36, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "拾掷回声", "theme": "grass", "parTimeMs": 98000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（设计稿 §13.1 E1–E14 红线守卫，失败即中断，不产出坏数据）——
STANDABLE_TXS = {5, 6, 13, 14, 18, 19, 25, 26, 32, 33, 34, 35, 36, 41, 42}

# E1：entities 按 x 非降序（允许同 x 不同 y）
xs = [e["x"] for e in entities]
assert xs == sorted(xs), "E1 违规：entities 未按 x 非降序排列"

# E2：敌人 / 检查点 y 契约零例外
Y_CONTRACT = {
    "gu_bao": 224, "ci_li": 200, "chong_feng": 200, "chestnut": 200,
    "du_fu": 120, "shi_pao": 100, "checkpoint": 176,
}
for e in entities:
    if e["type"] in Y_CONTRACT:
        assert e["y"] == Y_CONTRACT[e["type"]], f"E2 违规：y 契约 {e}"

# E3：节拍平台全 ty=4
for bp in level["beatPlatforms"]:
    for t in bp["tiles"]:
        assert t["ty"] == 4, f"E3 违规：节拍平台 ty 红线 {t}"

# E4：零 ty2 —— 除左右边界墙外不得出现 ty<3 的瓦片
for t in tiles:
    if t["ty"] < 3:
        assert t["tx"] in (0, W - 1), f"E4 违规：非边界墙出现 ty<3 {t}"
oneway_tys = [t["ty"] for t in tiles if t["kind"] == "oneway"]
assert min(oneway_tys) >= 3, "E4 违规：oneway 出现 ty<3"

# E5：shi_pao 所在 tx 不与任何可站立 tx 重叠
for e in entities:
    if e["type"] == "shi_pao":
        assert e["x"] % TS == 0 and e["x"] // TS not in STANDABLE_TXS, f"E5 违规：{e}"

# E6：相邻 chestnut 间距 ≥ 8 格
chest_xs = [e["x"] for e in entities if e["type"] == "chestnut"]
chest_gaps = [(b - a) // TS for a, b in zip(chest_xs, chest_xs[1:])]
assert all(g >= 8 for g in chest_gaps), f"E6 违规：chestnut 间距 {chest_gaps}"

# E7：地面主路 seed（y=200）≥ 3 颗（满蜕变公平性：3 地面 + 1 低门槛高路）
ground_seeds = [e for e in entities if e["type"] == "seed" and e["y"] == 200]
assert len(ground_seeds) >= 3, f"E7 违规：地面 seed 仅 {len(ground_seeds)} 颗"

# E8：goal 底贴地面顶面，且不越右边界
g = level["goal"]
assert g["y"] + g["h"] == 224, "E8 违规：goal 底未贴地面顶面 224"
assert g["x"] + g["w"] <= (W - 1) * TS, "E8 违规：goal 超出世界右边界"

# E9：bp_a1 所在 tx 列上不得有 y<96 的可收集物（防 ty4 满跳顶点出画）
bp_txs = {t["tx"] for bp in level["beatPlatforms"] for t in bp["tiles"]}
COLLECTIBLE = ("coin", "seed", "chestnut")
for e in entities:
    if e["type"] in COLLECTIBLE and e["x"] // TS in bp_txs:
        assert e["y"] >= 96, f"E9 违规：bp 列上出现 y<96 可收集物 {e}"

# E10：无两个实体同 (x, y)
pos = [(e["x"], e["y"]) for e in entities]
assert len(pos) == len(set(pos)), "E10 违规：存在同 (x,y) 实体"

# E11：地面 ty7/ty8 在 tx0..47 全覆盖无缺口
solid = {(t["tx"], t["ty"]) for t in tiles if t["kind"] == "solid"}
for tx in range(W):
    assert (tx, 7) in solid and (tx, 8) in solid, f"E11 违规：地面缺口 tx={tx}"

# E12：每个 checkpoint 距其下游最近压力峰 ≤ 6 格
PRESSURE_TXS = sorted(
    {e["x"] // TS for e in entities if e["type"] in ("ci_li", "chong_feng", "du_fu", "gu_bao", "shi_pao")}
    | {min(txs) for txs, _ in ONEWAY_CLUSTERS}
)
for e in entities:
    if e["type"] == "checkpoint":
        cp_tx = e["x"] // TS
        nearest = min((p - cp_tx for p in PRESSURE_TXS if p > cp_tx), default=None)
        assert nearest is not None and nearest <= 6, f"E12 违规：cp@{e['x']} 距压力峰 {nearest} 格"

# E13：每个 oneway/beat 簇均可从地面（ty7 顶面）单点跳达（上升 ≤ 119px）
JUMP_APEX_PX = 119
for txs, ty in ONEWAY_CLUSTERS:
    assert (7 - ty) * TS <= JUMP_APEX_PX, f"E13 违规：oneway ty{ty} 上升 {(7 - ty) * TS}px 超顶点"
assert (7 - 4) * TS <= JUMP_APEX_PX, "E13 违规：bp_a1 ty4 上升超顶点"

# E14：Δ=0 时羽降安全值 5.0 格；> 5 格的 gap 为刻意不可跨（C1/C5），其下方必须是全宽地面
GLIDE_SAFE_TILES = 5
cluster_bounds = [(min(txs), max(txs)) for txs, _ in ONEWAY_CLUSTERS]
for (_, a_end), (b_start, _) in zip(cluster_bounds, cluster_bounds[1:]):
    gap = b_start - a_end - 1
    if gap > GLIDE_SAFE_TILES:
        # 刻意不可跨：非路径，但下方必须全是地面（零坠落死亡）
        for tx in range(a_end + 1, b_start):
            assert (tx, 7) in solid and (tx, 8) in solid, f"E14 违规：不可跨 gap 下方缺地面 tx={tx}"

ENEMY_TYPES = ("gu_bao", "ci_li", "du_fu", "shi_pao", "chong_feng")
n_enemy = sum(1 for e in entities if e["type"] in ENEMY_TYPES)
n_seed = sum(1 for e in entities if e["type"] == "seed")
n_coin = sum(1 for e in entities if e["type"] == "coin")
n_chestnut = sum(1 for e in entities if e["type"] == "chestnut")
n_cp = sum(1 for e in entities if e["type"] == "checkpoint")
assert len(entities) == 40, f"实体总数应为 40，实际 {len(entities)}"
assert n_enemy == 14, f"敌数应为 14，实际 {n_enemy}"
assert n_seed == 6, f"种子数应为 6，实际 {n_seed}"
assert n_chestnut == 4, f"栗子补给应为 4，实际 {n_chestnut}"
assert n_cp == 3, f"检查点数应为 3，实际 {n_cp}"
assert "throw" not in level["mechanics"], "mechanics 严禁 throw 字段（schema 不存在）"

out = "src/config/levels/4-1.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} coin={n_coin} seed={n_seed} chestnut={n_chestnut} checkpoint={n_cp})",
    f"chestnut_gaps={chest_gaps}",
)
