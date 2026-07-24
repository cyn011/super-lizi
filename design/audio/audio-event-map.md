# S05-4 音频事件真实性盘点 / Audio Event Map

> 配套 `audio-design.md` §2。所有结论来自对 `src/**` 的 grep / 读取验证（非臆造）。
> 目的：让 engineering-lead 一眼看清「哪些事件真有音效源、哪些事件定义了却没发、哪些 GDD 要求但代码没落地」。

## 验证方法

- 事件名常量来源：`src/core/events/event-bus.ts`（全部 `ON_*` 声明）。
- emit 来源：grep `bus.emit(ON_*` / `.emit(ON_*` 于 `src/core`、`src/game`、`src/ui`。
- 实测结果（2025 调研快照）：

## A. 真实游戏循环已 emit 的事件（✅ 可作音效源）

| 事件 | emit 位置 | payload | 对应 SFX（见 audio-design §2） |
|---|---|---|---|
| `ON_LAND` | game-scene.ts:417（落地边沿） | `{}` | `sfx:land` |
| `ON_STOMP` | damage-resolution.ts:97 | `{type,x,y}` | `sfx:stomp` |
| `ON_ENEMY_DEATH` | damage-resolution.ts:98 | `{type,x,y}` | `sfx:enemy_death` |
| `ON_HURT` | damage-resolution.ts:114 | `{lives,state}` | `sfx:hurt` |
| `ON_DEATH` | damage-resolution.ts:121,138 | `{lives}` | `sfx:death` |
| `ON_RESPAWN` | damage-resolution.ts:122 | `{lives}` | `sfx:respawn` |
| `ON_GAME_OVER` | damage-resolution.ts:139 | `{lives}` | `sfx:game_over` |
| `ON_COIN` | pickup-resolution.ts:72 | 无 | `sfx:coin` |
| `ON_SEED_COLLECTED` | pickup-resolution.ts:85 | `seedId:string` | `sfx:seed_collect` |
| `ON_CHECKPOINT` | pickup-resolution.ts:102 | `{x,y}` | `sfx:checkpoint` |
| `ON_LEVEL_COMPLETE` | game-scene.ts:488 | `{levelId}` | `sfx:level_clear` |
| `ON_PAUSE` | run-lifecycle.ts:42 / game-scene.ts:383 | `{source,background?}` | `sfx:pause` |
| `ON_RESUME` | run-lifecycle.ts:58 / pause-menu.ts:57 | `{source,background?}` | `sfx:resume` |
| `ON_RESTART` | result-screen.ts:145 / pause-menu.ts:58 / game-scene.ts:556,559 | 无 | `sfx:restart` |
| `ON_SCORE_CHANGED` | game-scene.ts:664 | `{score,coins,comboMult}` | （默认不发声，D7） |
| `ON_JUMP` | game-scene.ts:534（`controller.lastJumped && !skipConsume`） | `{}` | `sfx:jump`（D1 CLOSED） |
| `ON_PROJECTILE_SPAWN` | game-scene.ts:549（石炮产出弹丸） | `{count}` | `sfx:projectile_fire`（D3 CLOSED） |

## B. 已定义但全程从未 emit 的事件（⚠ GAP，无音效源）

> 注：`ON_JUMP`、`ON_PROJECTILE_SPAWN` 已于 S05-4 实现期补 emit（game-scene:534 / 549，D1/D3 CLOSED），已转入 §A，下方不再列出。

| 事件 | 定义位置 | 现状 | 影响 / 决策点 |
|---|---|---|---|
| `ON_DOUBLE_JUMP` | event-bus.ts:8 | 从未 emit | 二段跳无音（D5）；`sfx:double_jump` 已合成且 audio-bus 已接映射，唯一孤儿 SFX |
| `ON_ENEMY_HIT_PLAYER` | event-bus.ts:12 | 从未 emit（`ON_HURT` 覆盖玩家受击） | 与 `ON_HURT` 合并即可，不单列 |
| `ON_LIFE_LOST` | event-bus.ts:24 | 从未 emit（`ON_DEATH`/`ON_HURT` 覆盖） | audio-bus 复用 `sfx:hurt`，休眠映射安全 |
| `ON_SCORE` | event-bus.ts:21 | 从未 emit（被 `ON_SCORE_CHANGED` 取代） | 遗留常量，可废弃 |
| `ON_BEAT` | event-bus.ts:30 | **仅** `core/sim/headless.ts:203` emit（仿真）；真实游戏 `BeatClock.enabled:false` 不驱动 | 节拍同步音乐留 Could（GDD 10） |
| `ON_START` | event-bus.ts:31 | 从未 emit | 无首帧音效需求 |
| `ON_FORM_CHANGED` | event-bus.ts:32 | 从未 emit（GDD 06 元气果 form 变化，MVP 无） | audio-bus 复用 `sfx:seed_metamorph`，休眠映射安全 |
| `ON_LEVEL_COMPLETE_UI` | event-bus.ts:33 | 从未 emit | audio-bus 复用 `sfx:level_clear`，休眠映射安全 |

## C. GDD 要求但代码尚未落地的事件（⚠ GDD↔代码不一致）

| 事件 | GDD 出处 | 代码现状 | 影响 |
|---|---|---|---|
| `ON_SEED_GROWTH` | GDD 12 §5.1（要求新增） | **event-bus 常量待工程主程补入** | 种子成长进度细反馈（GDD 供 UI/音频）；**音频侧不映射**（采集反馈已由 `ON_SEED_COLLECTED→sfx:seed_collect` 覆盖，每次 GROWTH 再响会每采双音，故无声，留 UI 进度条） |
| `ON_SEED_METAMORPHOSIS` | GDD 12 §5.1（要求新增） | event-bus 常量已就位（`ON_SEED_COLLECTED`/`ON_SEED_GROWTH`/`ON_SEED_METAMORPHOSIS` 均在）；audio-bus 已接映射（D4 CLOSED） | game-scene:321 跨阈值 emit 时响 `sfx:seed_metamorph`（SFX_POWERUP） |

> 结论：GDD 12 要求 event-bus 新增 3 个 `ON_SEED_*` 常量（`ON_SEED_COLLECTED`/`ON_SEED_GROWTH`/`ON_SEED_METAMORPHOSIS`）**均已就位**。`game-scene.ts:319-321` 在 seed growth **跨阈值** emit `ON_SEED_METAMORPHOSIS`。**音频侧总线已接好**：`ON_SEED_METAMORPHOSIS → sfx:seed_metamorph`（D4 CLOSED）；`ON_SEED_GROWTH` 音频侧**不映射**（避免每采双音）。

## D. audio-bus 订阅清单（最终映射，含 GAP 标注）

> 详见 `audio-design.md` §3.3。下表为「事件 → SFX name」最终映射，标注是否当前可触发。

| 事件 | SFX name | 当前可触发？ |
|---|---|---|
| `ON_JUMP` | `sfx:jump` | ✅（D1 CLOSED，game-scene:534） |
| `ON_DOUBLE_JUMP` | `sfx:double_jump` | ❌ 待 D5（未 emit，唯一孤儿 SFX） |
| `ON_LAND` | `sfx:land` | ✅ |
| `ON_STOMP` | `sfx:stomp` | ✅ |
| `ON_ENEMY_DEATH` | `sfx:enemy_death` | ✅ |
| `ON_COIN` | `sfx:coin` | ✅ |
| `ON_HURT` | `sfx:hurt` | ✅ |
| `ON_LIFE_LOST` | `sfx:hurt` | ✅ 复用（事件未 emit，休眠映射） |
| `ON_DEATH` | `sfx:death` | ✅ |
| `ON_RESPAWN` | `sfx:respawn` | ✅ |
| `ON_GAME_OVER` | `sfx:game_over` | ✅ |
| `ON_LEVEL_COMPLETE` | `sfx:level_clear` | ✅ |
| `ON_LEVEL_COMPLETE_UI` | `sfx:level_clear` | ✅ 复用（事件未 emit，休眠映射） |
| `ON_PAUSE` | `sfx:pause` | ✅ |
| `ON_RESUME` | `sfx:resume` | ✅ |
| `ON_RESTART` | `sfx:restart` | ✅ |
| `ON_CHECKPOINT` | `sfx:checkpoint` | ✅ |
| `ON_SEED_COLLECTED` | `sfx:seed_collect` | ✅ |
| `ON_SEED_METAMORPHOSIS` | `sfx:seed_metamorph` | ✅（D4 CLOSED，game-scene:321 跨阈值 emit） |
| `ON_FORM_CHANGED` | `sfx:seed_metamorph` | ✅ 复用（事件未 emit，休眠映射） |
| `ON_PROJECTILE_SPAWN` | `sfx:projectile_fire` | ✅（D3 CLOSED，game-scene:549） |
| `ON_SEED_GROWTH` | （不映射） | — 由 `ON_SEED_COLLECTED` 覆盖采集反馈；每采双音风险，故无声（GDD 12 §5.1 细反馈留 UI 进度条） |
| `ON_SCORE_CHANGED` | （不映射） | — D7 |

## E. 一句话结论

- **17 个事件真实可触发音效**（`ON_SCORE_CHANGED` 默认不计），覆盖用户要求的全部意图——D1（跳跃）/D3（石炮）/D4（种子蜕变）**均已 CLOSED**。
- **种子蜕变 `ON_SEED_METAMORPHOSIS → sfx:seed_metamorph` 已接总线且已 emit（D4 CLOSED）**：game-scene:321 跨阈值 emit 即自动发声（每次 `ON_SEED_GROWTH` 不响）。`ON_SEED_GROWTH` 音频侧**不映射**。
- **仅剩 1 个真实事件缺口**（二段跳 D5 → `sfx:double_jump` 孤儿 SFX，无二段跳玩法，低优先）；`ON_LIFE_LOST`/`ON_LEVEL_COMPLETE_UI`/`ON_FORM_CHANGED` 为休眠映射（复用既有 SFX，事件源到位即自动发声），安全。
