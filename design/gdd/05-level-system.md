# 05 关卡 Level System

> 分层：Must（深）｜依赖：02 Physics / 04 Enemy / 06 Economy / 07 Damage / 08 UI / 10 Beat｜MVP ≥1 关

## 1. 目的与范围
关卡序列化/加载/运行时管理：tile 布局、实体放置、props（可顶砖/道具）、检查点、终点凯旋之门、beat 预留字段。MVP 至少 1 可玩关卡。

## 2. Must / Could 分层
- **Must**：tile 层、实体层、props（互动块含内容）、检查点、凯旋之门 goal、beat 字段预留、主题切换（草原/洞穴/天空，结构不变仅换色）。
- **Could**：流式加载超大关、关卡编辑器产出（00 附录 A.3）、多结局。

## 3. 机制详述
- 加载：解析 LevelData → 构建 tilemesh（碰撞+视觉）、实例化 entities（04）、props（含互动块内容）、检查点数组、goal。
- 检查点：玩家触碰更新 `respawnPoint`；死亡（07）于最近检查点重生。
- 终点凯旋之门 `triumph_gate`：玩家到达 → `ON_LEVEL_COMPLETE`（触发 08 结算 + 11 解锁）。
- 主题：仅换主色/装饰（见美术圣经），tile 网格与功能色语义不变。
- beat 预留：读取 `beat` 字段交 10 BeatClock（MVP `enabled:false`，不驱动机制）。

## 4. 依赖系统
- **02 Physics**（tile 碰撞）、**04 Enemy**（spawn）、**06 Economy**（coin/prop）、**08 UI**（progress/goal）、**10 Beat**（beat 字段）、**07 Damage**（检查点重生）。

## 5. 接口契约
```ts
interface LevelData {
  id:string; version:number; tileSize:number; width:number; height:number;
  tiles: TileDef[]; entities: EntityDef[]; props: PropDef[];
  checkpoints: {x:number;y:number}[]; goal: {x:number;y:number;type:string};
  beat: BeatDef; metadata: Record<string,unknown>;
}
// 函数：LevelLoader.load(id): RuntimeLevel
// 事件：ON_LEVEL_COMPLETE(levelId), ON_CHECKPOINT(x,y)
```

## 6. 数据格式（含 beat 预留，跨 GDD 一致性核查点）
```json
{
  "id":"1-1","version":1,"tileSize":32,"width":200,"height":16,
  "tiles":[{"x":0,"y":15,"t":"ground","solid":true}],
  "entities":[{"id":"e1","type":"ci_li","x":120,"y":200,"params":{}}],
  "props":[{"id":"p1","type":"interactive_block","x":64,"y":96,"content":"buff_fruit"}],
  "checkpoints":[{"x":400,"y":200}],
  "goal":{"x":6200,"y":180,"type":"triumph_gate"},
  "beat":{"enabled":false,"bpm":120,"grid":8,"tracks":[]},
  "metadata":{"theme":"grassland","parTime":60}
}
```
`beat.tracks` 为节拍事件轨道（完整机制→Could），MVP 空数组不影响运行。

## 7. 验收标准
- [ ] 关卡可加载并正确渲染碰撞/视觉。
- [ ] 检查点触碰更新重生点；死亡于最近检查点重生。
- [ ] 到达凯旋之门触发通关。
- [ ] `beat` 字段存在且 `enabled:false` 时不影响 MVP 运行；10 能解析 bpm/grid。

## 8. 风险与缓解
- 关卡过大性能 → 分块/流式（Could）；MVP 单关 ≤200 格可控。
- 包体 → tile/prop 走图集（atlas，见美术圣经）。
- 主题切换出错 → 结构不变仅换色，回归测试。

## 待主理人确认
MVP 关卡长度目标？建议 1 关 ≈ 180~220 格（约 1.5~2 分钟速通），确认以定 parTime。
