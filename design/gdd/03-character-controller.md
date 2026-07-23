# 03 角色控制 Character Controller

> 分层：Must（深）｜依赖：01 Input / 02 Physics / 04 Enemy（踩踏目标）/ 07 Damage（sizeScale）｜支柱 P1·跳

## 1. 目的与范围
实现主角"栗宝"核心移动手感：跑动惯性、单跳+二段跳、土狼时间、跳跃缓冲、可变跳高、踩踏反弹。手感为第一优先级（支柱 P1·跳）。范围仅玩家可控移动，不含受伤逻辑（在 07）、不含敌人（在 04）。

## 2. Must / Could 分层
- **Must**：左右加速/摩擦、单跳、二段跳(1 次)、coyote time、jump buffer、可变跳高、踩踏反弹、落地尘土(juice 钩子)。
- **Could**：墙跳、蹬墙、冲刺、滑铲、抓边。

## 3. 机制详述（参数集中 character-config）
- 水平：`MOVE_SPEED=140 px/s`；地面加速 `ACCEL_GROUND=1200`、空气加速 `ACCEL_AIR=800`；地面摩擦 `FRICTION=1600`。
  - `target = dir*MOVE_SPEED`；`v.x = approach(v.x, target, (grounded?ACCEL_GROUND:ACCEL_AIR)*dt)`。
- 跳跃（`GRAVITY` 见 02 =1800）：
  - `JUMP_VELOCITY = -480 px/s`。跳高 `h=480²/(2*1800)≈64px≈2 tiles`；滞空 `2*480/1800≈0.53s`。
  - **Coyote time** `COYOTE=100ms`：离地后 100ms 内视为可跳。
  - **Jump buffer** `JUMP_BUFFER=120ms`：按下跳后 120ms 内若落地立即起跳（消费 `jumpPressedAt`）。
  - **可变跳高**：`jumpReleased` 且 `v.y<0` 时 `v.y *= 0.5`（短跳≈全跳 50%）。
  - **二段跳**：`AIR_JUMPS=1`；空中再跳 `v.y=JUMP_VELOCITY*0.9≈-432`，跳高≈1.6 tiles；落地重置 `airJumpsLeft`。
- 踩踏 Stomp：`v.y>0`（下落）且角色底接触敌人顶 → 敌人消灭（事件 `ON_STOMP`），`v.y=BOUNCE=-300`。
- 状态：`CharacterState{ pos, vel, grounded, coyoteTimer, jumpBufferTimer, airJumpsLeft, facing, sizeScale }`。

## 4. 依赖系统
- **01 Input**（LEFT/RIGHT/JUMP）、**02 Physics**（stepBody/isGrounded）。
- **07 Damage**（提供 `sizeScale`：FULL=1, SMALL=0.6，影响碰撞盒高度）。
- **04 Enemy**（踩踏目标检测）。

## 5. 接口契约
```ts
interface CharacterState {
  x:number;y:number;vx:number;vy:number;
  grounded:boolean; facing:1|-1;
  coyoteTimer:number; jumpBufferTimer:number; airJumpsLeft:number;
  sizeScale:number;            // 来自 07
}
// 输入：consume(input: InputState, dt:number): void
// 事件：ON_JUMP, ON_DOUBLE_JUMP, ON_LAND, ON_STOMP(enemyId:string)
```

## 6. 数据格式
`character-config.json`：
```json
{"moveSpeed":140,"accelGround":1200,"accelAir":800,"friction":1600,
 "gravity":1800,"jumpVelocity":-480,"coyoteMs":100,"jumpBufferMs":120,
 "doubleJumpScale":0.9,"stompBounce":-300}
```

## 7. 验收标准（量化，手感沙盒）
- [ ] Coyote：离地 ≤100ms 内按跳有效；>100ms 无效。
- [ ] Jump buffer：落地前 ≤120ms 内按跳，落地即刻起跳。
- [ ] 短跳高度 = 全跳高度 45%~55%。
- [ ] 二段跳：空中 1 次，落地重置。
- [ ] 踩踏：下落接触敌顶消灭敌人并反弹 `BOUNCE`。
- [ ] 水平 0→满速 ≤0.2s；松键 0→停 ≤0.15s。

## 8. 风险与缓解
- 手感调校难 → 参数全集中 config + 独立"手感沙盒"空房间量化上述指标后再铺内容。
- 双端手感差异 → 逻辑层统一，输入已抽象（01），触屏布局调参（01）。
- 浮点抖动 → 固定步长 60Hz + 渲染取整。

## 待主理人确认
二段跳 MVP 必做？概念文档已列"单跳+二段跳"，建议保留 1 次二段跳（手感与探索双收益）。
