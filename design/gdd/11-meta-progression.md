# 11 元循环/进度 Meta Progression

> 分层：Could（轻 stub）｜依赖：05 Level / 08 UI（结算）

## 1. 目的与范围
关卡解锁、本地存档、星级记录。MVP 单关为主，元循环轻做（完成→解锁下一关 + 本地记录）。

## 2. Must / Could 分层
- **Must(Could-light)**：关卡完成→解锁下一关（localStorage）；记录星数/最佳时间。
- **Could**：云存档、好友排行、成就系统。

## 3. 机制详述
- `SaveData{ unlockedLevels:string[], stars:Record<levelId,number>, bestTimes:Record<levelId,number> }`。
- 流程：`ON_LEVEL_COMPLETE` → 解锁下一关、更新星数/时间 → 存 localStorage。
- 微信：`wx.setStorageSync`；Web：`localStorage`。

## 4. 依赖系统
- **05 Level**（完成事件）、**08 UI**（结算展示）。

## 5. 接口契约
```ts
interface SaveData { unlockedLevels:string[]; stars:Record<string,number>; bestTimes:Record<string,number>; }
function loadSave(): SaveData
function saveLevelResult(levelId:string, stars:number, time:number): void
// 事件：ON_LEVEL_COMPLETE(levelId, stars, time)
```

## 6. 数据格式
`save.json`（localStorage key `super-mali-save`）：同 SaveData。

## 7. 验收标准
- [ ] 通关解锁下一关并刷新保留。
- [ ] 星数/最佳时间记录正确。
- [ ] 微信/Web 双端存储可用。

## 8. 风险与缓解
- 微信 storage 限制 → 小数据，仅关卡进度。
- 多端同步 → Could（云存档）。

## 待主理人确认
MVP 是否需要"关卡选择地图"界面，还是通关后直接进下一关？建议极简：通关→下一关，地图留 Could。
