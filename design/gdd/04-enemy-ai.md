# 04 敌人 AI Enemy AI

> 分层：Must（深）｜依赖：02 Physics / 03 Character / 05 Level / 07 Damage｜MVP 4 敌

## 1. 目的与范围
实现 MVP 4 种敌人（刺栗/冲锋怪/嘟浮/石炮）行为状态机，处理可踩判定、伤害源、弹丸。钻地怪→Could。

## 2. Must / Could 分层
- **Must**：4 种敌人状态机、可踩判定（刺栗/嘟浮 顶踩死；冲锋/石炮 踩则玩家伤）、弹丸、边缘/墙检测。
- **Could**：钻地怪、群体 AI、巡逻路径点编辑器。

## 3. 机制详述（参数集中 enemy-config）
通用 `EnemyState{ id, type, hp:1, state, x,y,vx,vy, stompable, dead }`。可踩判定由 03/04 协作：角色 `v.y>0` 且角色底接触敌顶且 `enemy.stompable` → `ON_STOMP`；否则接触且 `!stompable` → `ON_ENEMY_HIT_PLAYER`。

- **刺栗 ci_li**（地面慢/可踩/圆+刺/警示红）：`patrol` 左右巡走 `SPEED=40`；遇墙或前方无地面（边缘检测）掉头；`stompable=true`；被踩→`dead` + `ON_ENEMY_DEATH`。
- **冲锋怪 chong_feng**（地面冲锋/不可踩/长条楔形/钢蓝）：`idle`→`detect`（玩家在 `DETECT_X=160` 内且高度差 `<48`）→`charge`（朝玩家方向 `CHARGE_SPEED=220` 直线，不可踩）→`wallHit`（撞墙眩晕 `STUN=1000ms` 回 idle）。踩它→玩家受伤。`stompable=false`。
- **嘟浮 du_fu**（飞行/可踩/带翅/蓝紫）：`float` 沿 `path` 或原地正弦浮动 `FLOAT_SPEED=60, AMP=24`；`stompable=true`；可踩死。
- **石炮 shi_pao**（固定炮台/不可踩/方+灰）：`aim`（每 `FIRE_INTERVAL=2000ms` 朝玩家方向）→`fire`（发射弹丸 `PROJECTILE_SPEED=180`，弹丸 hazard 碰玩家受伤）→`cooldown`。`stompable=false`；弹丸为独立 hazard 实体。

## 4. 依赖系统
- **02 Physics**（移动/碰撞）、**03 Character**（玩家位置/踩踏）、**05 Level**（spawn/边界）、**07 Damage**（受伤事件）。

## 5. 接口契约
```ts
type EnemyType = 'ci_li'|'chong_feng'|'du_fu'|'shi_pao';
interface EnemyState { id:string; type:EnemyType; hp:number; state:string;
  x:number;y:number;vx:number;vy:number; stompable:boolean; dead:boolean; }
// 事件：ON_ENEMY_DEATH(id), ON_ENEMY_HIT_PLAYER(enemyId),
//       ON_PROJECTILE_SPAWN(x,y,vx,vy)
```

## 6. 数据格式
`enemy-config.json` 含每类参数。关卡 `entities[]` 引用 `type + x,y + params`（见 05 统一 schema）。

## 7. 验收标准
- [ ] 刺栗：巡逻、边缘/墙掉头、可踩死。
- [ ] 冲锋怪：检测→冲锋→撞墙眩晕→idle；踩它玩家受伤（非消灭）。
- [ ] 嘟浮：浮动；可踩死。
- [ ] 石炮：定时朝玩家开火；弹丸碰玩家受伤。
- [ ] 4 类可踩判定正确（刺栗/嘟浮 顶踩死；冲锋/石炮 踩则伤）。

## 8. 风险与缓解
- 状态机膨胀 → 表驱动（每类 state→transition 映射）。
- 性能（多敌人）→ 对象池 + 仅激活屏内 AI。
- 冲锋怪误伤 → 明确"接触且非顶部"才伤，与踩踏互斥。

## 待主理人确认
冲锋怪撞墙眩晕 `STUN=1000ms` 是否合适？（建议 800~1200ms）
