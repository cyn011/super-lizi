# super-mali · Phase 4 Epic / Story 拆分

> 阶段：Phase 4 预制作（Epic/Story 拆分，不含实现）
> 作者：程基岩（engineering-lead）
> 输入：docs/architecture/architecture.md、docs/architecture/adr/ADR-001..005、docs/architecture/control-list.md、design/gdd/（11 系统）
> 已锁决策：手写状态机+事件总线（ADR-002）、free-tex-packer（ADR-004）、固定步长 60Hz（ADR-005）、微信最小 demo 为首要交付（R2）
> 用法：本文件供主理人汇编首个冲刺计划。每个 Story 颗粒度 = 一个冲刺内可完成并验收；验收标准引用控制清单 §1（手感沙盒量化）/§3（IP 合规）/§4（双端一致性）。

---

## 0. 总览

### 0.1 GDD 11 系统 → Epic 覆盖矩阵
| GDD | 系统 | 归属 Epic | Story |
|---|---|---|---|
| 01 | 输入抽象 | E2 核心手感与角色控制器 | E2.S2 |
| 02 | 物理/碰撞 | E2 核心手感与角色控制器 | E2.S1 |
| 03 | 角色控制 | E2 核心手感与角色控制器 | E2.S3 |
| 07 | 受伤状态机（×形态正交） | E2 核心手感与角色控制器 | E2.S4 |
| 04 | 敌人 AI | E3 敌人 AI | E3.S1 / E3.S2 |
| 05 | 关卡系统 | E4 关卡系统 | E4.S1 |
| 06 | 经济/分数 | E4 关卡系统 | E4.S2 |
| 10 | 节拍预留 | E4 关卡系统 | E4.S3 |
| 08 | UI / HUD | E5 UI 与 HUD | E5.S1 / E5.S2 |
| 11 | 元循环/进度 | E5 UI 与 HUD | E5.S3 |
| 09 | 音频占位 | E6 音频占位 | E6.S1 |
| — | 脚手架/双端构建/固定步长 | E1 脚手架与双端构建 | E1.S1~S4 |
| — | 微信适配（深） | E7 微信适配 | E7.S1~S3 |
| — | 垂直切片集成 | E8 垂直切片 | E8.S1~S3 |

> 全部 11 个 GDD 系统均有归属；架构级支撑（脚手架/固定步长/微信适配）单列 Epic。

### 0.2 依赖顺序（文字版，箭头=依赖）
```
E1.S1 微信最小 demo（过 R2）── 首要，无依赖
   └─ E1.S2 Vite 双构建 ─┐
E1.S3 三层骨架+配置+事件总线 ─┤
E1.S4 固定步长主循环(ADR-005) ─┤
                              ├─▶ E2.S1 物理 ─┐
                              │              ├─▶ E2.S2 输入抽象 ─┐
                              │              │                  ├─▶ E2.S3 角色控制器 ─┐
                              │              │                  │                    ├─▶ E2.S4 受伤状态机
                              │              │                  │                    │   （依赖 E3.S1 敌源 + E4.S1 检查点）
                              │              │                  │                    │
                              │              └─▶ E3.S1 可踩敌人 ─┘                    │
                              │                      └─▶ E3.S2 不可踩敌人+弹丸        │
                              │                                                        │
                              └─▶ E4.S1 关卡加载 ─▶ E4.S2 经济 ─▶ E4.S3 节拍时钟       │
                                                                        │          │
                              E5.S1 HUD ◀── E2.S4(sizeScale)/E4.S2(score/lives)         │
                              E5.S2 暂停/结算 ◀── E4.S1(goal)/E2.S4(death)             │
                              E5.S3 元循环存档 ◀── E4.S1(complete)                     │
                                                                        │          │
E6.S1 音频占位 ◀── 事件总线（无强依赖，可并行）                        │          │
E7.S1~S3 微信适配深 ◀── E1.S1 demo 扩展                                │          │
                                                                        ▼          ▼
                                                              E8.S1 垂直切片集成 ─▶ E8.S2 IP 构建检查 ─▶ E8.S3 双端一致性回归
```
**关键路径**：E1.S1 → E1.S2/S3/S4 → E2.S1/S2/S3 → E2.S4 → E4.S1 → E8（垂直切片）。

---

## 1. Epic 1 · 脚手架与双端构建（架构级，过 R2）
**目标**：打通可运行底座，解除最大技术风险（微信 weapp-adapter 运行 R2）。

### E1.S1 微信最小可运行 demo（空场景 + 1 可动精灵 + 触屏按钮）【P0 · 首要】
- 依赖：无（Phase 4 第一个 Story）
- 范围：Vite + Phaser.AUTO + weapp-adapter shim + `wx.createCanvas()`；Boot→空场景；1 个可动精灵（经 InputState 驱动位移）；微信端渲染左下左右双按钮 + 右下跳/动作双按钮（仅 `env==='wechat'`）。
- 验收标准：
  - [ ] 微信开发者工具导入可运行：空场景渲染、精灵随输入位移。
  - [ ] 触屏双按钮命中区 ≥48px，仅微信显示（control-list §4 第3项）。
  - [ ] 输入经 `RawInputProvider→InputAbstraction` 归一，逻辑层零 `wx`/`keyboard`/`touch` 分支（control-list §4 第1项）。
  - [ ] Web 同源构建可运行（双端共享 core）。
  - [ ] 通过架构评审风险 **R2**（微信 weapp-adapter 运行）。
- 产出：`game/main.ts`、`game/scenes/boot-scene.ts`、`platform/wechat/*`（最小）、`platform/detect.ts`、`ui/touch-buttons.ts`（最小）、Vite 微信构建骨架（`game.js`/`game.json`）。
- 备注：**最大技术风险解除点，必须先于一切内容开发。**

### E1.S2 Vite 双构建配置（Web + 微信）
- 依赖：E1.S1
- 范围：`vite.config` 双模式（`--mode web` / `--mode wechat`），`import.meta.env.VITE_PLATFORM` 平台裁剪；微信 `game.json`（`deviceOrientation:landscape`）、`weapp-adapter` 注入；tree-shaking + minify。
- 验收标准：
  - [ ] `npm run build:web` 与 `npm run build:wechat` 均产出可运行包。
  - [ ] 主包 JS（min）≤1.5MB（control-list §2）；music 不进主包。
  - [ ] `core/` 未被打进任何 `wx`/DOM 依赖（静态扫描）。
- 产出：`vite.config.ts`、微信工程配置、`package.json` scripts。

### E1.S3 三层骨架 + 配置注入 + 事件总线
- 依赖：E1.S1
- 范围：`core/`（input/physics/character/enemy/level/damage/economy/beat/meta/state/events/config）、`platform/`、`game/`、`ui/`、`config/*.json` 目录与空模块；`EventBus`（`ON_*`）落地；`config/index.ts` 类型化读取。
- 验收标准：
  - [ ] `core/**` 零 `import 'phaser'`（静态扫描）。
  - [ ] `EventBus` 可发/订阅 `ON_JUMP` 等至少一个事件，单测通过。
  - [ ] 任意 `character-config.json` 数值经 `config/index` 读取，无硬编码常量。
- 产出：目录骨架、`core/events/event-bus.ts`、`core/config/index.ts`、`src/config/*.json`（初值取 GDD 参数）。

### E1.S4 固定步长主循环（ADR-005）
- 依赖：E1.S3
- 范围：`game/fixed-step.ts` 累加器（STEP_MS=1000/60），`GameScene.update` 调用；仿真时钟 `simTimeMs` 仅步进内累加；输入固定步内采样。
- 验收标准：
  - [ ] 同输入序列下，步进数与 `simTimeMs` 增长确定（与帧率无关）。
  - [ ] 极端卡顿封顶 `realDelta` ≤250ms 防追帧爆炸。
  - [ ] 渲染 `alpha` 插值可选，像素层默认整数绘制（`roundPixels`）。
- 产出：`game/fixed-step.ts`、`game/scenes/game-scene.ts`（步进骨架）。

---

## 2. Epic 2 · 核心手感与角色控制器（GDD 01/02/03/07）
**目标**：手感第一优先级（P1·跳），量化达标（control-list §1）。

### E2.S1 物理 / 碰撞（GDD 02）
- 依赖：E1.S3
- 范围：`core/physics/body.ts`（`Body`/`CollisionResult`/`stepBody`/`isGrounded`）、`collision.ts`（AABB 分轴解算、单向平台、移动平台随动）。
- 验收标准：
  - [ ] 静止站 tile 60s 不抖/不陷/不下坠（GDD 02 §7）。
  - [ ] 单向平台：上方落上阻挡，下方/侧面可穿。
  - [ ] 移动平台：角色随动无相对滑移。
  - [ ] 穿透安全：`MAX_FALL*dt=900/60=15px<TILE 32`（无需 CCD）。
  - [ ] 单测：AABB 分轴、grounded 判定、移动平台随动。
- 产出：`core/physics/*`、`config` 含 `gravity:1800, maxFall:900, tile:32`。

### E2.S2 输入抽象（GDD 01）
- 依赖：E1.S3
- 范围：`core/input/input-abstraction.ts`（`RawInputFrame→InputState`）、`platform/web/web-keyboard.ts`、`platform/wechat/wechat-touch.ts`；`input-config.json`（web 键位 + wechat 按钮归一化坐标）。
- 验收标准：
  - [ ] 双端产生**完全相同** `InputState` 序列（同手势等价 RawInputFrame，单测固化）（control-list §4 第2项）。
  - [ ] `jumpPressedAt` 精度 ≤16ms（固定步 16.67ms 天然满足）。
  - [ ] 平台切换不丢输入状态。
  - [ ] 逻辑层零 `keyboard`/`touch` 分支（control-list §4 第1项）。
- 产出：`core/input/*`、`platform/*/web-keyboard.ts`、`platform/*/wechat-touch.ts`、`src/config/input-config.json`。

### E2.S3 角色控制器（GDD 03）
- 依赖：E2.S1、E2.S2
- 范围：`core/character/character-controller.ts`（`CharacterState` + `consume(input,dt)`）：水平加速/摩擦、单跳、二段跳(1)、coyote、jump buffer、可变跳高、踩踏反弹。
- 验收标准（引用 control-list §1）：
  - [ ] `moveSpeed=140`、`gravity=1800`、`coyoteMs=100`、`jumpBufferMs=120`、`AIR_JUMPS=1`（取自 config）。
  - [ ] Coyote：离地 ≤100ms 内按跳有效；>100ms 无效。
  - [ ] Jump buffer：落地前 ≤120ms 按跳，落地即刻起跳。
  - [ ] 短跳高度 = 全跳 45%~55%（`v.y*=0.5`）。
  - [ ] 二段跳：空中 1 次，落地重置 `airJumpsLeft`。
  - [ ] 水平 0→满速 ≤0.2s；松键 0→停 ≤0.15s。
  - [ ] 踩踏：下落接触敌顶消灭 + 反弹 `BOUNCE=-300`。
- 产出：`core/character/*`、`src/config/character-config.json`（moveSpeed140/accelGround1200/accelAir800/friction1600/jumpVelocity-480/coyoteMs100/jumpBufferMs120/doubleJumpScale0.9/stompBounce-300）。

### E2.S4 受伤状态机 + 重生（GDD 07，×形态正交）
- 依赖：E2.S3、E3.S1（敌源）、E4.S1（检查点）
- 范围：`core/damage/damage-state-machine.ts`：`FULL→SMALL→DEAD` + `INVINCIBLE` 叠加；单点输出 `sizeScale`（FULL=1/SMALL=0.6）；正交复位 `form=BASE`；`lives==0→GAME_OVER`。
- 验收标准：
  - [ ] FULL 受伤→SMALL（缩小+无敌帧 1.5s）。
  - [ ] SMALL 受伤→DEAD；DEAD 有检查点→重生为 FULL 且 form=BASE。
  - [ ] 无敌帧内重复受伤无效。
  - [ ] `lives==0→GAME_OVER`（与 E4.S2 经济联动）。
  - [ ] 他系统禁止直改 `sizeScale`（架构铁律）。
- 产出：`core/damage/*`、`src/config/damage-config.json`（invincibleMs1500/fullScale1/smallScale0.6）。

### E2.S5 手感沙盒（量化验收，control-list §1）
- 依赖：E2.S3
- 范围：`game/scenes/sandbox-scene.ts`（dev 构建）：空房间跑真实固定步，浮层实测跳跃高度/滞空/coyote/jumpBuffer/二段跳/水平加速等指标。
- 验收标准：
  - [ ] §1 全部 10 项指标落入容忍区间（全跳≈64px、二段跳≈1.6 tiles、短跳45-55%、coyote≤100ms、buffer≤120ms、二段跳1次、水平≤0.2s、松键≤0.15s、踩踏-300、双端一致）。
  - [ ] 指标不达标**不得**铺关卡内容（GDD 03 §8 风险缓解 / control-list §1 卡点）。
- 产出：`game/scenes/sandbox-scene.ts`、指标浮层。

---

## 3. Epic 3 · 敌人 AI（GDD 04）
**目标**：MVP 4 敌，表驱动状态机，可踩判定正确。

### E3.S1 可踩敌人（刺栗 ci_li / 嘟浮 du_fu）
- 依赖：E2.S1、E2.S3
- 范围：`core/enemy/enemy-ai.ts` 表驱动；刺栗巡逻+边缘/墙掉头+可踩；嘟浮正弦浮动+可踩。
- 验收标准：
  - [ ] 刺栗：巡逻、边缘/墙掉头、可踩死（`ON_STOMP`）。
  - [ ] 嘟浮：浮动；可踩死。
  - [ ] 可踩判定：`enemy.stompable && v.y>0 && 角色底触敌顶`（与 E2.S3 踩踏协作）。
- 产出：`core/enemy/*`、`src/config/enemy-config.json`（ci_li speed40；du_fu float60 amp24）。

### E3.S2 不可踩敌人 + 弹丸（冲锋怪 chong_feng / 石炮 shi_pao）
- 依赖：E3.S1、E2.S4（敌源触发受伤）
- 范围：冲锋怪 detect→charge→wallHit(stun)→idle（踩它玩家受伤）；石炮 aim→fire→cooldown 发射弹丸（独立 hazard）。
- 验收标准：
  - [ ] 冲锋怪：检测→冲锋→撞墙眩晕→idle；踩它玩家受伤（非消灭）。
  - [ ] 石炮：定时朝玩家开火；弹丸碰玩家受伤。
  - [ ] 4 类可踩判定正确（刺栗/嘟浮 顶踩死；冲锋/石炮 踩则伤，与踩踏互斥）。
- 产出：扩展 `core/enemy/*`（`chong_feng detect160/48 charge220 stun1000`；`shi_pao fire2000 proj180`）。

---

## 4. Epic 4 · 关卡系统（GDD 05/06/10）
**目标**：1 可玩关卡加载/运行时 + 经济 + 节拍预留。

### E4.S1 关卡加载与运行时（GDD 05）
- 依赖：E1.S3、E2.S1（tile 碰撞）
- 范围：`core/level/level-data.ts`（类型+校验）、`level-loader.ts`（JSON→RuntimeLevel：tilemesh/实体/检查点/goal）、`level-runtime.ts`。
- 验收标准：
  - [ ] `LevelData` 校验（tileSize/width、beat 字段、goal type）。
  - [ ] 关卡可加载并正确渲染碰撞/视觉。
  - [ ] 检查点触碰更新重生点；死亡于最近检查点重生。
  - [ ] 到达凯旋之门触发 `ON_LEVEL_COMPLETE`。
  - [ ] 主题切换结构不变仅换色（回归测试）。
- 产出：`core/level/*`、`src/config/levels/1-1.json`（含 `beat{enabled:false,bpm:120,grid:8,tracks:[]}`）。

### E4.S2 经济 / 分数（GDD 06）
- 依赖：E2.S3（踩怪）、E4.S1（coin/goal）、E2.S4（生命）
- 范围：`core/economy/economy.ts`：`EconomyState` + 连击倍率；`ON_STOMP`+100、`ON_COIN`+10、goal+500；`lives` 初始 3。
- 验收标准：
  - [ ] 踩怪 +100、金币 +10、通关 +500，HUD 实时。
  - [ ] 连击：1.5s 内连踩倍率递增封顶 ×4，窗超时清零。
  - [ ] 生命：受伤 SMALL→死亡 `lives--`，0 则 `GAME_OVER`（联动 E2.S4 / E5.S2）。
- 产出：`core/economy/*`、`src/config/economy-config.json`（initialLives3/stompScore100/coinScore10/goalScore500/comboWindowMs1500/maxMult4）。

### E4.S3 节拍预留接口（GDD 10）
- 依赖：E4.S1
- 范围：`core/beat/beat-clock.ts`：`BeatClock` 纯逻辑（`getBeat`/`getBeatDurationMs`/`onBeat`）；`enabled:false` 不驱动机制；测试态 `enabled:true` 验证。
- 验收标准：
  - [ ] `level.beat` 可解析为 `BeatClock`。
  - [ ] `enabled:false` 时 `onBeat` 不触发机制，游戏正常运行。
  - [ ] 测试态 `getBeat` 随 `simTimeMs` 正确递增、`onBeat` 边界正确。
  - [ ] `tracks` 扩展兼容（不破 05 schema）。
- 产出：`core/beat/*`。

---

## 5. Epic 5 · UI 与 HUD（GDD 08/11）
**目标**：混合 UI（世界像素 + 矢量/系统字体 HUD）、元循环存档。

### E5.S1 HUD（GDD 08）
- 依赖：E4.S2（score/lives/coins）、E2.S4（sizeScale）、E4.S1（progress）
- 范围：`ui/hud.ts` + `game/scenes/ui-scene.ts`：`HUDModel` 渲染（生命/金币/分数/进度条/计时），半透明圆角底板；中文走系统字体（≥14px 等效）。
- 验收标准：
  - [ ] HUD 实时反映 Economy/Damage/Level。
  - [ ] 中文清晰 ≥14px 等效，无 CJK 像素字包体（美术圣经 §7.1）。
  - [ ] 进度条随玩家 x 增长。
  - [ ] 按钮热区/文字符合 §9.2 可读性。
- 产出：`ui/hud.ts`、`game/scenes/ui-scene.ts`、`src/config/ui-config.json`。

### E5.S2 暂停 / 结算
- 依赖：E4.S1（goal）、E2.S4（death）
- 范围：`ui/pause-menu.ts`、`ui/result-screen.ts`：暂停遮罩（继续/重玩）、凯旋之门通关动画 + 星级（时间 + 金币收集率双维度）。
- 验收标准：
  - [ ] `INPUT_ACTION`/专用键 → `ON_PAUSE`；遮罩 + 大圆角按钮。
  - [ ] 到达凯旋之门触发结算；失败温柔提示。
  - [ ] 微信 `onHide` 自动暂停（联动 E7.S3）。
- 产出：`ui/pause-menu.ts`、`ui/result-screen.ts`。

### E5.S3 元循环 / 存档（GDD 11）
- 依赖：E4.S1（complete）、E5.S2
- 范围：`core/meta/save-data.ts` + `platform/*/storage`：`SaveData{unlockedLevels,stars,bestTimes}`；`ON_LEVEL_COMPLETE→`解锁下一关+记录星/时间→持久化。
- 验收标准：
  - [ ] 通关解锁下一关并刷新保留（微信 `wx.setStorageSync` / Web `localStorage`）。
  - [ ] 星数/最佳时间记录正确（双端存储可用，control-list §4 第8项）。
- 产出：`core/meta/*`、`platform/*/storage.ts`。

---

## 6. Epic 6 · 音频占位（GDD 09）
**目标**：音频事件链路占位，不破包体。

### E6.S1 音频占位与解锁
- 依赖：E1.S3（事件总线；可并行）
- 范围：`game/audio/audio-bus.ts`：`playSfx(name)` 枚举占位（静音/日志）；微信首次交互解锁 `AudioContext`（`unlockOnInteraction`）。
- 验收标准：
  - [ ] 9 个 `SfxName` 枚举事件可触发占位不崩（GDD 09 §7）。
  - [ ] 资产就绪后能无缝替换真实音效（结构不破）。
  - [ ] 微信端交互后解锁音频（control-list §4 第7项）。
  - [ ] MVP 零音频文件进主包（合成/远程，ADR-004）。
- 产出：`game/audio/audio-bus.ts`、`src/config/audio-config.json`。

---

## 7. Epic 7 · 微信适配（深，ADR-003）
**目标**：demo（E1.S1）之外的完整微信适配。

### E7.S1 微信存储适配
- 依赖：E1.S1、E5.S3
- 范围：`platform/wechat/wechat-storage.ts`：`wx.setStorageSync` 封装，对齐 Web `localStorage` 接口。
- 验收标准：读写一致（control-list §4 第8项）；超小数据不触微信 storage 限制。

### E7.S2 微信音频远程流式
- 依赖：E6.S1
- 范围：`platform/wechat/wechat-audio.ts`：`wx.createInnerAudioContext` 远程 URL 流式（音乐不进包）；SFX 合成通道。
- 验收标准：音乐远程加载播放、不占主包（control-list §2）；首交互解锁。

### E7.S3 微信生命周期
- 依赖：E1.S1、E5.S2
- 范围：`platform/wechat` 生命周期：`wx.onHide→暂停仿真`、`wx.onShow→恢复`；输入状态连续不丢（control-list §4 第5项）。
- 验收标准：后台切回输入无跳变、仿真正确暂停/恢复。

---

## 8. Epic 8 · 垂直切片（集成 + 质量门）
**目标**：可玩切片（核心手感 + 1 关 + 4 敌 + 基础系统），过 IP 与双端门。

### E8.S1 垂直切片集成
- 依赖：E2.S5（手感达标）、E3.S2、E4.S1/S2、E5.S1/S2、E6.S1、E7.*
- 范围：串联所有系统跑通 1 关：手感 + 4 敌 + 检查点 + 凯旋之门 + HUD + 音频占位 + 存档。
- 验收标准：
  - [ ] 单关可玩闭环：跑/跳/踩/顶/吃/抵达 全流程无崩溃。
  - [ ] 手感沙盒 §1 指标全达标（回归）。
  - [ ] headless 仿真冒烟通过（testing.md §4）。
- 产出：集成后的 `GameScene` 编排。

### E8.S2 IP 合规构建检查（control-list §3）
- 依赖：E8.S1、资产就绪（art-director）
- 范围：CI/合入门禁脚本扫描源码/配置/资源清单中的任天堂符号词与禁用水管工轮廓资产。
- 验收标准：
  - [ ] 命名扫描：无 `mario/luigi/bowser/koopa/mushroom/star(道具)/pipe/flag` 等。
  - [ ] 角色/敌人/终点/道具造型符合美术圣经 v1.1 红线（人工复核）。
  - [ ] 任一项命中即阻断，回美术/设计修正。
- 产出：IP 合规扫描脚本（CI 步骤）。

### E8.S3 双端一致性回归（control-list §4）
- 依赖：E8.S1、E7.*
- 范围：双端一致性测试项全跑（零平台分支 / 同手势同 InputState / 触屏热区 / jumpPressedAt / 平台切换 / 仿真确定性 / 音频解锁 / 存储）。
- 验收标准：control-list §4 八项全部通过（Web + 微信真机/模拟器）。
- 产出：双端回归测试报告（手测 + 单测）。

---

## 9. 冲刺编排建议（供主理人参考，非强制）
- **Sprint 1（解风险）**：E1.S1（微信 demo，过 R2）→ E1.S2/S3/S4 → 启动 E2.S1/S2。目标：可运行底座 + 固定步长 + 物理/输入骨架。
- **Sprint 2（手感）**：E2.S3/S4/S5（手感沙盒达标）→ E3.S1。目标：核心手感量化通过 + 可踩敌人。
- **Sprint 3（内容）**：E3.S2 → E4.S1/S2/S3 → E5.S1。目标：1 关 + 经济 + HUD。
- **Sprint 4（闭环）**：E5.S2/S3 → E6.S1 → E7.* → E8.*。目标：垂直切片 + IP/双端门通过。
- **并行项**：E6.S1 音频占位（无强依赖，可插任意 Sprint）；E7.* 微信深适配随 demo 后扩展。

> 所有 Story 验收均以 `control-list.md` 为唯一量化基线；手感不达标不入内容（E2.S5 卡点）。
