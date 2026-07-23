# 06 经济/分数 Score & Economy

> 分层：Must（中深）｜依赖：03/04（踩怪） / 05（coin/prop/goal） / 07（生命） / 08（HUD）

## 1. 目的与范围
金币/分数/生命/连击/形态库存的运行时管理（形态库存 MVP 仅 BASE，树→Could）。HUD（08）读取，受伤（07）扣生命。

## 2. Must / Could 分层
- **Must**：金币计数、分数（踩怪/金币/到达）、连击倍率、生命（初始3）、当前形态字段。
- **Could**：道具树多形态库存、商店、货币兑换。

## 3. 机制详述
- 分数：`ON_STOMP` +100；`ON_COIN` +10；到达 goal +500。
- 连击：`COMBO_WINDOW=1500ms` 内连续踩怪，`combo++`，`mult=min(1+0.5*(combo-1), 4)`，`score += base*mult`。
- 金币：`coins++`（HUD 显示）。
- 生命：`lives` 初始 3；`ON_LIFE_LOST`（07 受伤且已 SMALL→死亡）`lives--`；`lives==0`→GAME_OVER。
- 形态：`form: 'BASE'|'TRANSFORMED'`；吃道具（props.content）切换（树→Could 扩展）。

## 4. 依赖系统
- **03/04**（踩怪事件）、**05**（coin/prop/goal）、**07**（生命事件）、**08**（HUD 读取）。

## 5. 接口契约
```ts
interface EconomyState { coins:number; score:number; lives:number;
  combo:number; comboTimer:number; form:string; }
// 事件：ON_COIN, ON_SCORE(delta), ON_LIFE_LOST, ON_FORM_CHANGED(form)
```

## 6. 数据格式
`economy-config.json`：`{initialLives:3, stompScore:100, coinScore:10, goalScore:500, comboWindowMs:1500, maxMult:4}`。

## 7. 验收标准
- [ ] 踩怪 +100，金币 +10，通关 +500，HUD 实时。
- [ ] 连击：1.5s 内连踩倍率递增，封顶 ×4。
- [ ] 生命：受伤 SMALL→死亡 `lives--`，0 则 GAME_OVER。
- [ ] 形态字段随道具切换。

## 8. 风险与缓解
- 数值通胀 → 分值表集中 config 易调。
- 连击误判 → 仅踩怪计入连击，窗超时清零。

## 待主理人确认
初始生命 3 是否合适？（经典为 3，建议保留）
