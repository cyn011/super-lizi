"""生成 src/config/levels/3-3.json —— 3-3《鸣星回阶》（星界 astral，第三章深化 B：**时间轴**）。

权威依据：design/gdd/level-3-3-design.md
          §3（尺寸/分区）/ §4.1（地形清单）/ §4.2（safe_gap 校验表）/ §5.3（entities 数组）/ §6（检查点）/
          §7（节拍平台 2 簇，红线 ty=4）/ §8（种子 6 颗）/ §9（parTimeMs）/ §10（metadata）/ §11（汇总结构草案）。
结构范式对齐 scripts/gen-level-3-1.py / gen-level-3-2.py（逐字同构，仅换坐标与规模）。

红线：
  - 云海地面 ty7,8 全宽实心恒存在 → 零坠落死亡、零 soft-lock（公平性地板）。
  - 浮岛全部复用既有 oneway，0 新增 tile kind；entities 0 新增类型；敌人代码 0 改动。
  - 节拍平台瓦片必须 ty=4（y=128），严禁 ty=5；本关 2 簇 = 全章上限（2-6 先例）。
  - 两簇共用同一 beat 块，bpm/grid/pattern 与 3-1/3-2 完全一致 → 相位记忆可无损迁移（防过载）。
  - mechanics.glide=true 沿用布尔写法（非对象），0 Schema 变更。
  - goal.x = (width-2)*32 = 1536（tx48），与 3-1/3-2 的 tx=width-2 严格同构。
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

# oneway 上行梯列 st0..st6（设计稿 §4.1；全部为可选高路，相位失败落回地面继续前进）。
# 「回阶」= 同一模式出现两次：ty5 → ty4 → (beat ty4) → ty3。
#   梯列 A：st0(ty5) → st1(ty4) ══bp_c1(相位)══▶ st2(ty3，梯顶 A) ──D1 降落──▶ st_a/st3(ty5)
#   梯列 B：st3(ty5) → st4(ty4) ══bp_c2(相位)══▶ st5(ty3，梯顶 B) ──D2 降落──▶ st6(ty5) → 星门
# ⚠️ st2 / st5 两座 ty3 梯顶「从地面/相邻均不可直达」（直接跨越 gap=9 ≫ 3 格上升红线）——
#    这是设计意图的技能门槛（时间轴 payoff），不是 bug（设计稿 §4.2 反证行 / 附录 B R1）。
FLOAT_ISLANDS = [
    ((3, 4), 5),          # st0  梯列 A 第一级（热身，地面直跳可达）
    ((7, 8), 4),          # st1  梯列 A 第二级（P1 起跳台）
    ((18, 19), 3),        # st2  梯顶 A（ty3，仅经 bp_c1 抵达；载 seed_06 首登 payoff）
    ((25, 26), 5),        # st_a D1 降落复习落点（Δ+2 / gap5，复习 3-2 空间轴）
    ((27, 28), 5),        # st3  梯列 B 基座（与 st_a 邻接成休息台）
    ((32, 33), 4),        # st4  梯列 B 第二级（P2 起跳台）
    ((43, 44), 3),        # st5  梯顶 B（ty3，仅经 bp_c2 抵达）
    ((46, 47), 5),        # st6  门前岛（贴右墙侧，星门在 tx48）
]
for txs, ty in FLOAT_ISLANDS:
    for tx in txs:
        tiles.append({"tx": tx, "ty": ty, "kind": "oneway"})

# 敌 13（gu_bao×3 / ci_li×3 / du_fu×4 / shi_pao×3）/ 币 13 / 种 6 / 检查点 3；按 x 升序（同 3-1/3-2）。
# 敌人 y 契约恒定：gu_bao=224 / ci_li=200 / du_fu=120 / shi_pao=100（全 16 关零例外）。
# 留白纪律：S2(tx11..21) / S4(tx33..43) 两个相位段各仅 1 只 du_fu（可踩第二解，零弹幕）——
#           相位读取时不叠加任何威胁，这是本关防认知过载的核心手段（设计稿 §3.1 / §5.2）。
entities = [
    {"type": "coin", "x": 128, "y": 160},
    {"type": "gu_bao", "x": 160, "y": 224, "params": {"phaseOffset": 0}},
    {"type": "seed", "x": 224, "y": 200, "seedId": "seed_01"},
    {"type": "coin", "x": 256, "y": 128},
    {"type": "ci_li", "x": 320, "y": 200},
    # cp1 = S1 末 / 进入 S2「P1 相位教学」前（锁住热身学习成果）。
    {"type": "checkpoint", "x": 352, "y": 176},
    {"type": "coin", "x": 400, "y": 112},
    # seed_04 悬于 bp_c1(tx12..14 @ty4) 上方 —— 相位路径奖励（用节拍台才够得到）。
    {"type": "seed", "x": 416, "y": 112, "seedId": "seed_04"},
    {"type": "coin", "x": 560, "y": 96},
    {"type": "du_fu", "x": 576, "y": 120},
    # seed_06 = 梯顶 A（st2, ty3）顶 —— 「第一次真的往上」的叙事 payoff。
    {"type": "seed", "x": 592, "y": 80, "seedId": "seed_06"},
    {"type": "coin", "x": 672, "y": 200},
    # cp2 = S2 末 / 进入 S3「地面压力峰」前（红线：压力峰前必有 cp）。
    {"type": "checkpoint", "x": 704, "y": 176},
    {"type": "gu_bao", "x": 736, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "coin", "x": 784, "y": 160},
    {"type": "ci_li", "x": 800, "y": 200},
    {"type": "seed", "x": 832, "y": 200, "seedId": "seed_02"},
    {"type": "du_fu", "x": 864, "y": 120},
    {"type": "coin", "x": 896, "y": 160},
    {"type": "shi_pao", "x": 928, "y": 100},
    {"type": "coin", "x": 960, "y": 200},
    {"type": "shi_pao", "x": 992, "y": 100},
    {"type": "coin", "x": 1056, "y": 128},
    # cp3 = S3 末 / 进入 S4「P2 相位峰」前（st4 起跳台左侧，梯列 B 重试成本最低）。
    {"type": "checkpoint", "x": 1088, "y": 176},
    {"type": "coin", "x": 1136, "y": 200},
    {"type": "du_fu", "x": 1152, "y": 120},
    {"type": "coin", "x": 1216, "y": 112},
    # seed_05 悬于 bp_c2(tx38..40 @ty4) 上方 —— 相位峰专属奖励。
    {"type": "seed", "x": 1248, "y": 112, "seedId": "seed_05"},
    {"type": "coin", "x": 1376, "y": 96},
    {"type": "shi_pao", "x": 1408, "y": 100},
    {"type": "gu_bao", "x": 1440, "y": 224, "params": {"phaseOffset": 265}},
    {"type": "seed", "x": 1456, "y": 200, "seedId": "seed_03"},
    {"type": "ci_li", "x": 1472, "y": 200},
    {"type": "du_fu", "x": 1504, "y": 120},
    {"type": "coin", "x": 1520, "y": 200},
]

level = {
    "id": "3-3",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    # goal.x = (W-2)*TS = 1536（tx48），右墙在 tx49；与 3-1/3-2 严格同构。
    "goal": {"type": "triumph_gate", "x": 1536, "y": 160, "w": 32, "h": 64},
    # 羽降总开关（布尔，与 3-1/3-2 完全一致）；本关把 glide 从「射程工具」深化为「相位半拍修正键」。
    "mechanics": {"glide": True},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_c1", "pattern": "SSGG"},
            {"target": "bp_c2", "pattern": "SSGG"},
        ],
    },
    # 红线：两簇节拍平台瓦片必须 ty=4（y=128），严禁 ty=5。
    # bp_c1 = P1 相位教学（st1→gap3）；bp_c2 = P2 相位峰（st4→gap4）。均 ghost 起、均 3 格宽（3-1 已验证规模）。
    "beatPlatforms": [
        {
            "id": "bp_c1",
            "initial": "ghost",
            "tiles": [
                {"tx": 12, "ty": 4},
                {"tx": 13, "ty": 4},
                {"tx": 14, "ty": 4},
            ],
        },
        {
            "id": "bp_c2",
            "initial": "ghost",
            "tiles": [
                {"tx": 38, "ty": 4},
                {"tx": 39, "ty": 4},
                {"tx": 40, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "鸣星回阶", "theme": "astral", "parTimeMs": 96000},
    "spawn": {"x": 64, "y": 190},
}

# —— 生成期自检（红线守卫，失败即中断，不产出坏数据）——
assert level["goal"]["x"] + level["goal"]["w"] < W * TS, "goal 超出世界右边界"
assert level["goal"]["x"] == (W - 2) * TS, "goal.x 必须 = (width-2)*tileSize（与 3-1/3-2 同构）"
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
assert n_enemy == 13, f"敌数应为 13，实际 {n_enemy}"
assert n_seed == 6, f"种子数应为 6，实际 {n_seed}"
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

out = "src/config/levels/3-3.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(
    "wrote", out,
    "tiles:", len(tiles),
    "entities:", len(entities),
    f"(enemy={n_enemy} coin={n_coin} seed={n_seed} checkpoint={n_cp})",
)
