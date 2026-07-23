# 10 节拍预留接口 Beat Reservation

> 分层：Must（接口/数据结构深）/ Could（完整机制）｜依赖：05 Level（beat 字段）

## 1. 目的与范围
提供节拍时钟接口与数据结构，使关卡数据格式（05）的 `beat` 字段可被解析与消费。完整"关卡随节拍变化"机制→Could，MVP 仅预留接口与数据结构。

## 2. Must / Could 分层
- **Must**：BeatClock 接口 + 数据结构；解析 `level.beat`（bpm/grid）；`getBeat()` / `onBeat()`；MVP 不驱动机制（`enabled:false`）。
- **Could**：节拍驱动平台/陷阱、动态音乐同步、AudioContext 时钟。

## 3. 机制详述
- `beatIndex = floor(elapsedMs / beatDurationMs)`，`beatDurationMs = 60000 / bpm / grid`（grid=每小节节拍数）。
- `BeatClock`：持有 `bpm, grid, startTime`；`getBeat():number`；`onBeat(cb)` 每 beat 边界触发。
- MVP：`enabled=false` → `onBeat` 不触发任何游戏逻辑；仅保证接口与数据可解析、可单测。
- Could 机制占位：`tracks[]` 描述每 beat 事件（平台显隐/陷阱触发），由关卡/物理消费（未实现）。

## 4. 依赖系统
- **05 Level**（beat 字段）、时间源。

## 5. 接口契约
```ts
interface BeatDef { enabled:boolean; bpm:number; grid:number; tracks: BeatTrack[]; }
interface BeatClock { bpm:number; grid:number;
  getBeat():number; getBeatDurationMs():number; onBeat(cb:(beat:number)=>void):void; }
// 函数：createBeatClock(def:BeatDef): BeatClock
```

## 6. 数据格式
同 05 `LevelData.beat`：`{enabled:false, bpm:120, grid:8, tracks:[]}`。

## 7. 验收标准
- [ ] `level.beat` 可解析为 BeatClock。
- [ ] `enabled:false` 时 `onBeat` 不触发机制，游戏正常运行。
- [ ] `enabled:true`（测试态）时 `getBeat` 随时间正确递增，onBeat 边界正确。
- [ ] 数据结构兼容未来 `tracks` 扩展（不破 05 schema）。

## 8. 风险与缓解
- 音频/视觉同步抖动 → 后续用 AudioContext 时钟（Could）；MVP 仅数据层无同步需求。
- 误启用 → `enabled` 门控，默认 false。

## 待主理人确认
MVP 是否需在构建期就接 AudioContext 时钟（为 Could 机制铺路），还是纯逻辑时钟即可？建议纯逻辑时钟，降低 MVP 复杂度。
