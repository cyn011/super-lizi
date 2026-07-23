# 07 受伤/状态机 Damage State Machine

> 分层：Must（深）｜依赖：04 Enemy（伤害源）/ 06 Economy（生命）/ 05 Level（检查点）/ 03 Character（sizeScale）｜与形态状态机正交

## 1. 目的与范围
受伤→缩小→死亡→重生状态机，含无敌帧。与形态状态机（FormState）正交（见 00 §1.5）。控制尺寸/无敌/重生，不直接控制移动（03）或生命计数（06）。

## 2. Must / Could 分层
- **Must**：FULL/SMALL/DEAD 三态 + INVINCIBLE 叠加、无敌帧、检查点重生、GAME_OVER、与形态正交。
- **Could**：临时护盾状态、多段血、处决动画。

## 3. 机制详述
- 状态：`DamageState{ state:'FULL'|'SMALL'|'DEAD', iframeTimer:number, sizeScale:number }`。
- 转换矩阵：
  - `FULL --受伤--> SMALL`（sizeScale 1→0.6，iframe 1.5s，事件 ON_HURT）。
  - `SMALL --受伤--> DEAD`（事件 ON_DEATH）。
  - `DEAD --有检查点--> 重生`：`FULL, sizeScale=1, form=BASE`（正交复位），pos=respawnPoint，iframe 1.5s。
  - `DEAD --lives==0--> GAME_OVER`（由 06 判定）。
  - `任意 --受伤且 iframe>0--> 忽略`（无敌）。
- 无敌帧 `INVINCIBLE_MS=1500`：受伤后计时，期间不响应伤害，角色闪烁（juice 钩子）。
- **正交规则**：受伤转换不改 `form`；仅 `DEAD→重生` 复位 `form=BASE`（明确避免与形态状态机冲突，见 99）。
- `sizeScale` 供给 03 调整碰撞盒高度、供给 08 渲染缩放。

## 4. 依赖系统
- **04 Enemy**（伤害源）、**06 Economy**（生命/lives）、**05 Level**（检查点/respawn）、**03 Character**（sizeScale 消费）。

## 5. 接口契约
```ts
type DamageStateName='FULL'|'SMALL'|'DEAD';
interface DamageState { state:DamageStateName; iframeTimer:number; sizeScale:number; }
// 输入：applyDamage(): void  （由 04 调）
// 事件：ON_HURT, ON_DEATH, ON_RESPAWN, ON_GAME_OVER
```

## 6. 数据格式
`damage-config.json`：`{ invincibleMs:1500, fullScale:1, smallScale:0.6 }`。

## 7. 验收标准
- [ ] FULL 受伤→SMALL（缩小+无敌帧）。
- [ ] SMALL 受伤→DEAD。
- [ ] DEAD 有检查点→重生为 FULL 且 form=BASE。
- [ ] 无敌帧内重复受伤无效。
- [ ] lives==0→GAME_OVER。

## 8. 风险与缓解
- 状态冲突 → 明确正交矩阵（状态×事件表），见 99 评审。
- 重生点丢失 → 检查点数组保底（关首默认检查点）。
- 无敌帧误判 → 统一由 07 单点管理，禁止他系统直接改尺寸。

## 待主理人确认
受伤缩小是否保留（FULL/SMALL 两级）？概念文档已列"受伤/缩小/死亡"，建议保留两级以贴合马里奥式成长感。
