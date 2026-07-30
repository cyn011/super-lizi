import json

W, H = 48, 9
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
for tx in (10, 11):
    tiles.append({"tx": tx, "ty": 3, "kind": "oneway"})
for tx in (26, 27):
    tiles.append({"tx": tx, "ty": 4, "kind": "oneway"})
for tx in (40, 41):
    tiles.append({"tx": tx, "ty": 5, "kind": "oneway"})

entities = [
    {"type": "coin", "x": 128, "y": 200},
    {"type": "gu_bao", "x": 192, "y": 224},
    {"type": "coin", "x": 256, "y": 200},
    {"type": "seed", "x": 320, "y": 200, "seedId": "seed_01"},
    {"type": "ci_li", "x": 384, "y": 200},
    {"type": "du_fu", "x": 448, "y": 120},
    {"type": "coin", "x": 512, "y": 200},
    {"type": "shi_pao", "x": 576, "y": 100},
    {"type": "seed", "x": 640, "y": 200, "seedId": "seed_02"},
    {"type": "checkpoint", "x": 656, "y": 176},
    {"type": "gu_bao", "x": 704, "y": 224},
    {"type": "coin", "x": 768, "y": 200},
    {"type": "ci_li", "x": 832, "y": 200},
    {"type": "du_fu", "x": 896, "y": 120},
    {"type": "seed", "x": 960, "y": 200, "seedId": "seed_03"},
    {"type": "coin", "x": 1024, "y": 200},
    {"type": "shi_pao", "x": 1088, "y": 100},
    {"type": "seed", "x": 1152, "y": 200, "seedId": "seed_04"},
    {"type": "checkpoint", "x": 1168, "y": 176},
    {"type": "gu_bao", "x": 1216, "y": 224},
    {"type": "coin", "x": 1280, "y": 200},
    {"type": "ci_li", "x": 1344, "y": 200},
    {"type": "seed", "x": 1408, "y": 200, "seedId": "seed_05"},
    {"type": "coin", "x": 1440, "y": 200},
]

level = {
    "id": "2-5",
    "version": 1,
    "tileSize": TS,
    "width": W,
    "height": H,
    "tiles": tiles,
    "entities": entities,
    "props": [],
    "checkpoints": [],
    "goal": {"type": "triumph_gate", "x": 1440, "y": 160, "w": 32, "h": 64},
    "beat": {
        "enabled": True,
        "bpm": 120,
        "grid": 8,
        "tracks": [{"target": "bp_deep", "pattern": "SSGG"}],
    },
    "beatPlatforms": [
        {
            "id": "bp_deep",
            "initial": "ghost",
            "tiles": [
                {"tx": 20, "ty": 4},
                {"tx": 21, "ty": 4},
                {"tx": 22, "ty": 4},
            ],
        }
    ],
    "metadata": {"name": "深渊回响", "theme": "cave", "parTimeMs": 84000},
    "spawn": {"x": 64, "y": 190},
}

out = "src/config/levels/2-5.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(level, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("wrote", out, "tiles:", len(tiles), "entities:", len(entities))
