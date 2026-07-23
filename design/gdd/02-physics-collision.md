# 02 物理/碰撞 Physics & Collision

> 分层：Must（深）｜依赖：05 Level（tile 碰撞标志）｜被 03/04/05 调用

## 1. 目的与范围
提供横版平台游戏底层物理：重力积分、AABB 碰撞分轴解算、地面/墙/顶检测、单向平台、移动平台载具，以及供土狼时间/跳跃缓冲的地面状态查询。不实现角色具体行为（在 03）。

## 2. Must / Could 分层
- **Must**：重力、速度积分、AABB vs tilemap 分轴解算、地面/墙/顶检测、单向平台、移动平台随动、最大下落速度限制。
- **Could**：连续碰撞检测(CCD) 全量化、斜坡、可破坏地形、粒子物理。

## 3. 机制详述
- 重力：`GRAVITY = 1800 px/s²`（集中 config，手感沙盒可调）。
- 积分：`v.y += GRAVITY*dt`（仅 Y）；`v.y = min(v.y, MAX_FALL=900)`；`pos += v*dt`。
- 碰撞解算（分轴）：先 X 位移解算墙，再 Y 位移解算地/顶。每轴用扫掠 AABB 与 tile 网格求最近重叠。
- 地面检测 `isGrounded`：角色底与 tile 顶重叠且 `v.y>=0`；返回 `grounded` 供 03 土狼时间。
- 单向平台 `oneWay`：仅当上一帧底 ≤ 平台顶 且 `v.y>=0` 时阻挡；下穿需 `INPUT_DOWN+JUMP`（MVP 可不做，见确认）。
- 移动平台：平台按 `platformVel` 运动，载其上的角色累加平台位移（`pos += platformDelta` 当 grounded 于该平台）。
- 参数：`GRAVITY=1800, MAX_FALL=900, TILE=32`。

## 4. 依赖系统
- 依赖 **05 Level** 提供的 tile 碰撞标志（运行时）。
- 被 **03 Character / 04 Enemy / 05 Level** 调用。

## 5. 接口契约
```ts
interface Body { x:number;y:number;w:number;h:number;vx:number;vy:number; }
interface CollisionResult {
  grounded:boolean; hitCeiling:boolean; hitLeft:boolean; hitRight:boolean;
  groundPlatform?:Body;
}
function stepBody(body:Body, dt:number): CollisionResult
function isGrounded(body:Body): boolean
function registerMovingPlatform(body:Body, vel:{x:number;y:number}): void
```
坐标逻辑 px；`dt` 固定步长 1/60s。

## 6. 数据格式
- tile 碰撞标志存 LevelData：`tiles[i].solid:boolean, .oneWay:boolean`。
- 移动平台（entity/prop）：`{type:"moving_platform", x,y,w,h, path:[{x,y}...], speed:60}`。

## 7. 验收标准
- [ ] 角色静止站 tile 60s 不抖、不陷、不下坠。
- [ ] 单向平台：上方落上阻挡，下方/侧面可穿（符合规则）。
- [ ] 移动平台：角色站其上随动，无相对滑移。
- [ ] 穿透测试：`v*dt = 900/60 = 15px < 32 tile`，无穿 tile。
- [ ] 60fps 物理开销 < 2ms/帧（含 50 实体）。

## 8. 风险与缓解
- 高速穿透 → `MAX_FALL` 与 `dt` 约束保证 `v*dt < TILE`；更快需 CCD（Could）。
- 微信低端机 → 空间哈希宽相剔除 + 实体对象池。
- 移动平台抖动 → 平台与角色同固定步长积分。

## 待主理人确认
是否需要"下穿单向平台"（`INPUT_DOWN+JUMP`）？MVP 建议不做，降低复杂度。
