import json

W, H = 56, 9
TS = 32
tiles = []
# 地面 ty7,ty8 整宽
for tx in range(W):
    tiles.append({"tx": tx, "ty": 7, "kind": "solid"})
    tiles.append({"tx": tx, "ty": 8, "kind": "solid"})
# 左墙 tx0 / 右墙 tx(W-1) 整高
for ty in range(H):
    tiles.append({"tx": 0, "ty": ty, "kind": "solid"})
    tiles.append({"tx": W - 1, "ty": ty, "kind": "solid"})
# oneway 踏脚石（头顶之上）
for tx in (11, 12):
    tiles.append({"tx": tx, "ty": 3, "kind": "oneway"})
for tx in (25, 26):
    tiles.append({"tx": tx, "ty": 4, "kind": "oneway"})
for tx in (39, 40):
    tiles.append({"tx": tx, "ty": 5, "kind": "oneway"})
for tx in (49, 50):
    tiles.append({"tx": tx, "ty": 4, "kind": "oneway"})

entities = [
    {"type": "coin", "x": 128, "y": 200},
    {"type": "gu_bao", "x": 192, "y": 224, "params": {"phaseOffset": 0}},
    {"type": "coin", "x": 256, "y": 200},
    {"type": "seed", "x": 320, "y": 200, "seedId": "seed_01"},
    {"type": "ci_li", "x": 384, "y": 200},
    {"type": "coin", "x": 416, "y": 200},
    {"type": "checkpoint", "x": 432, "y": 176},
    {"type": "coin", "x": 448, "y": 200},
    {"type": "du_fu", "x": 480, "y": 120},
    {"type": "coin", "x": 512, "y": 200},
    {"type": "gu_bao", "x": 576, "y": 224, "params": {"phaseOffset": 0}},
    {"type": "ci_li", "x": 608, "y": 200},
    {"type": "seed", "x": 672, "y": 200, "seedId": "seed_02"},
    {"type": "shi_pao", "x": 704, "y": 100},
    {"type": "coin", "x": 736, "y": 200},
    {"type": "coin", "x": 768, "y": 200},
    {"type": "checkpoint", "x": 784, "y": 176},
    {"type": "coin", "x": 832, "y": 200},
    {"type": "gu_bao", "x": 864, "y": 224, "params": {"phaseOffset": 530}},
    {"type": "ci_li", "x": 896, "y": 200},
    {"type": "shi_pao", "x": 928, "y": 100},
    {"type": "coin", "x": 960, "y": 200},
    {"type": "seed", "x": 992, "y": 200, "seedId": "seed_03"},
    {"type": "du_fu", "x": 1024, "y": 120},
    {"type": "coin", "x": 1056, "y": 200},
    {"type": "coin", "x": 1120, "y": 200},
    {"type": "checkpoint", "x": 1136, "y": 176},
    {"type": "coin", "x": 1184, "y": 200},
    {"type": "shi_pao", "x": 1216, "y": 100},
    {"type": "du_fu", "x": 1248, "y": 120},
    {"type": "coin", "x": 1280, "y": 200},
    {"type": "seed", "x": 1312, "y": 200, "seedId": "seed_04"},
    {"type": "gu_bao", "x": 1344, "y": 224, "params": {"phaseOffset": 0}},
    {"type": "ci_li", "x": 1376, "y": 200},
    {"type": "shi_pao", "x": 1408, "y": 100},
    {"type": "coin", "x": 1440, "y": 200},
    {"type": "checkpoint", "x": 1488, "y": 176},
    {"type": "coin", "x": 1504, "y": 200},
    {"type": "seed", "x": 1600, "y": 200, "seedId": "seed_05"},
    {"type": "shi_pao", "x": 1632, "y": 100},
    {"type": "coin", "x": 1664, "y": 200},
    {"type": "seed", "x": 1696, "y": 200, "seedId": "seed_06"},
]

level = {
    "id": "2-6",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    "goal": {"type": "triumph_gate", "x": 1728, "y": 160, "w": 32, "h": 64},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [
            {"target": "bp_v1", "pattern": "SSGG"},
            {"target": "bp_v2", "pattern": "SSGG"},
        ],
    },
    "beatPlatforms": [
        {
            "id": "bp_v1",
            "initial": "ghost",
            "tiles": [
                {"tx": 16, "ty": 4},
                {"tx": 17, "ty": 4},
                {"tx": 18, "ty": 4},
            ],
        },
        {
            "id": "bp_v2",
            "initial": "ghost",
            "tiles": [
                {"tx": 36, "ty": 4},
                {"tx": 37, "ty": 4},
                {"tx": 38, "ty": 4},
            ],
        },
    ],
    "metadata": {"name": "熔心终焉", "theme": "volcano", "parTimeMs": 100000},
    "spawn": {"x": 64, "y": 190},
}

out = "src/config/levels/2-6.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("wrote", out, "tiles:", len(tiles), "entities:", len(entities))
