# super-mali · 技术架构文档（Phase 3）

> 版本：v0.1（Phase 3 技术搭建 · 架构设计阶段，不含游戏源码实现）
> 作者：程基岩（engineering-lead）
> 评审强度：lean
> 依赖决策（已锁定）：Phaser 3（TypeScript + Vite）、Web + 微信小游戏双端、像素风 512×288 / 32px 网格、混合 UI（世界像素 + 矢量/系统字体 HUD）、IP 全原创、MVP=核心手感+1关+基础系统、节拍仅预留接口(`enabled:false`)。
> 本文档为 Phase 4 代码脚手架的**唯一架构输入**；所有代码契约以 GDD 接口为准（见 §13 映射表）。

---

## 1. 架构目标与硬约束

| 约束来源 | 约束 | 架构对策 |
|---|---|---|
| 引擎决策 | Phaser 3 + TS + Vite | `game/` 层薄胶水，逻辑沉到 `core/` |
| 双端 | Web + 微信小游戏 | `platform/` 适配层隔离 `wx`/DOM，逻辑层零平台分支 |
| 包体 | 主包 4MB / 整包 8MB | 图集打包 + 音频远程流式 + 子包；代码 tree-shaking |
| 手感第一 | coyote 100 / buffer 120 / 二段跳 1 / gravity 1800 | 固定步长 60Hz 确定性循环 + 手感沙盒量化 |
| 像素风 | 512×288、pixelArt、FIT、roundPixels | 全局 Scale 配置 + 渲染取整 |
| 节拍预留 | `enabled:false` 不驱动机制 | `BeatClock` 纯逻辑、门控、可单测 |
| IP 红线 | 无任天堂符号 | 构建期 IP 合规检查（见 control-list.md §3） |

**铁律（本架构强制）**
1. `core/` 任何模块 **不得 import `phaser`**；它只依赖纯 TS 与标准库 → 可在 Node 下单测、可 headless 跑完整仿真。
2. 逻辑层（core）**不得出现 `keyboard`/`touch`/`wx`/`localStorage`/`AudioContext` 等平台字样**；一切平台能力经 `platform/` 接口注入。
3. 所有可调数值（手感/敌人/经济/受伤）**集中 `src/config/*.json`**，逻辑层经 `config` 模块读取，禁止硬编码。

---

## 2. 总体分层架构

```
┌──────────────────────────────────────────────────────────────┐
│  platform/  双端适配层（唯一可 import wx / DOM 的地方）          │
│  web/*  ·  wechat/*  ·  detect  ·  RawInputProvider 接口        │
│  职责：原始输入→RawInputFrame、音频、存储、生命周期、env 探测    │
└───────────────────────────────▲──────────────────────────────┘
                                 │ 注入 Platform 接口
┌───────────────────────────────┴──────────────────────────────┐
│  core/  纯逻辑层（零 Phaser，确定性，可单测）                    │
│  input · physics · character · enemy · level · damage ·        │
│  economy · beat · meta · state(run 状态机) · events(事件总线)   │
│  ✔ 消费 InputState ✔ 产出 CharacterState/EconomyState/...      │
│  ✔ 通过 EventBus 发 ON_JUMP/ON_STOMP/ON_HURT/...（解耦）        │
└───────────────────────────────▲──────────────────────────────┘
                                 │ 读取 state / 订阅事件
┌───────────────────────────────┴──────────────────────────────┐
│  game/  Phaser 场景与渲染胶水（连接 core ↔ Phaser）             │
│  scenes(Boot/Preload/Menu/Game/UI/Sandbox) · render · audio    │
│  fixed-step 累加器：60Hz 步长推进 core，渲染读取最新 state       │
└──────────────────────────────────────────────────────────────┘
        ↑ 混合 UI：ui/ 矢量/HUD 组件，中文走系统字体（不进包）
```

**数据流向（每固定步）**：`platform` 采样 `RawInputFrame` → `core.input` 归一为 `InputState` → `game-scene` 调 `core` 各系统 `step(dt)` → `core` 写状态并发事件 → `game/render` 读状态绘帧、`ui` 刷新 HUD、`audio` 播占位音。

---

## 3. 目录结构（src/ 模块 ↔ 11 个 GDD 系统映射）

```
src/
  core/                         # 纯逻辑层（零 Phaser，可单测，确定性）
    input/
      input-abstraction.ts      # 01  RawInputFrame → InputState（归一）
      raw-input.ts              #     RawInputFrame / RawInputProvider 类型
    physics/
      body.ts                   # 02  Body / CollisionResult / stepBody / isGrounded
      collision.ts              # 02  AABB 分轴解算 / 单向平台 / 移动平台
    character/
      character-controller.ts   # 03  CharacterState + consume(input,dt)
    enemy/
      enemy-ai.ts               # 04  4 类状态机（表驱动）+ 弹丸
      enemy-types.ts            # 04  EnemyType / EnemyState
    level/
      level-data.ts             # 05  LevelData / TileDef / EntityDef / PropDef 类型 + 校验
      level-loader.ts           # 05  解析 JSON → RuntimeLevel（tilemesh/实体/检查点/goal）
      level-runtime.ts          # 05  RuntimeLevel 运行时查询（tile 碰撞标志等）
    damage/
      damage-state-machine.ts   # 07  DamageState 正交状态机
    economy/
      economy.ts                # 06  EconomyState + 连击倍率
    beat/
      beat-clock.ts             # 10  BeatClock 纯逻辑时钟（enabled 门控）
    meta/
      save-data.ts              # 11  SaveData 模型（调 platform.storage）
    state/
      run-state-machine.ts      #     顶层 RUN 状态机（BOOT→MENU→PLAYING⇄PAUSED→…）
    events/
      event-bus.ts              #     ON_* 事件总线（解耦 core 与 game/ui/audio）
    config/
      index.ts                  #     集中 config 注入 + 类型化读取

  platform/                     # 双端适配层（唯一可 import wx / DOM）
    platform.ts                 #     Platform 接口（env/input/audio/storage/lifecycle）
    detect.ts                   #     运行时 + 构建期平台探测
    raw-input-provider.ts       #     RawInputProvider 接口
    web/
      web-platform.ts
      web-keyboard.ts           #     DOM 键盘 → RawInputFrame
      web-storage.ts            #     localStorage
      web-audio.ts              #     AudioContext（占位）
    wechat/
      wechat-platform.ts
      wechat-touch.ts           #     触屏虚拟按钮 → RawInputFrame（命中 input-config.wechat.buttons）
      wechat-storage.ts         #     wx.setStorageSync
      wechat-audio.ts           #     wx.createInnerAudioContext（远程流式）
    weapp-adapter.d.ts          #     WeChat 小游戏全局 wx 类型声明（shim）

  game/                         # Phaser 场景与胶水
    main.ts                     #     Phaser.Game 引导（被 index.html 引用）
    scenes/
      boot-scene.ts             #     探测平台→注入 Platform→设 Scale→进 Preload
      preload-scene.ts          #     载 atlas / 音频（远程 URL）/ 关卡 JSON → config
      menu-scene.ts             #     标题/开始
      game-scene.ts             #     固定步长 60Hz 主循环；编排 core.step
      ui-scene.ts               #     HUD/暂停/结算/触屏按钮（并行透明场景）
      sandbox-scene.ts          #     手感沙盒（仅 dev 构建，测手感指标）
    fixed-step.ts               #     固定步长累加器（STEP_MS=1000/60）
    render/
      world-view.ts             #     core state → Phaser 精灵（插值可选）
      tilemap-view.ts
      entity-view.ts            #     敌人/道具/主角视图（对象池）
    audio/
      audio-bus.ts              # 09  playSfx 占位/映射（订阅 EventBus）

  ui/                           # 混合 UI（矢量/HUD，中文系统字体）
    hud.ts                      # 08  HUDModel 渲染（生命/金币/分数/进度/计时）
    touch-buttons.ts            # 08  微信触屏双按钮（命中区 ≥48px）
    pause-menu.ts               # 08  暂停
    result-screen.ts            # 08  结算（凯旋之门 + 星级）

  config/                       # 集中配置 JSON（Phase 4 落地）
    character-config.json       # 03
    enemy-config.json           # 04
    economy-config.json         # 06
    damage-config.json          # 07
    input-config.json           # 01  web/wechat 映射
    ui-config.json              # 08
    audio-config.json           # 09
    levels/1-1.json             # 05  LevelData 实例（含 beat 字段）

tests/                          # Vitest 单测（仅测 core/，零 Phaser）
  input/  physics/  character/  enemy/  level/  damage/  economy/  beat/
```

> 模块 ↔ GDD 一一对应见 §13 映射表。超出 11 系统的 `state/`（RUN 状态机）、`events/`（事件总线）、`game/fixed-step.ts` 为架构级支撑，非 GDD 系统。

---

## 4. 核心逻辑层 `core/`（设计要点）

### 4.1 输入归一（01）
- `RawInputProvider.sample(): RawInputFrame`：`{ down:Set<string>, pressedEdge:Set<string>, releasedEdge:Set<string> }`，其中 `string` 为**物理信号 id**（Web:`KeyboardEvent.code` 如 `"ArrowLeft"`；微信:`"touch:left"` 等）。
- `InputAbstraction` 持有 `input-config.json`（物理 id → `LEFT/RIGHT/JUMP/ACTION` 映射）与状态，输出 `InputState`（见 GDD 01 §5）。`jumpPressedAt` 记录为仿真时钟 ms（GDD 要求精度 ≤16ms，固定步 16.67ms 天然满足）。
- **关键点**：`InputAbstraction` 只读物理 id 集合，永不出现 `keyboard`/`touch` 分支 → 双端一致性可单测（见 §9、control-list §4）。

### 4.2 物理（02）
- `Body{x,y,w,h,vx,vy}`、`CollisionResult{grounded,hitCeiling,hitLeft,hitRight,groundPlatform?}`。
- `stepBody(body,dt)`：仅 Y 加重力 `v.y+=GRAVITY*dt`、`v.y=min(v.y,MAX_FALL)`，分轴解算（先 X 墙后 Y 地/顶）。`dt` 固定 `1/60`。
- `isGrounded(body)` 供角色 coyote；移动平台 `registerMovingPlatform` 随动（角色 grounded 其上累加 `platformDelta`）。
- 穿透安全：`MAX_FALL*dt=900/60=15px<TILE 32`，无需 CCD（CCD 留 Could）。

### 4.3 角色控制（03）
- `CharacterState{ x,y,vx,vy,grounded,facing,coyoteTimer,jumpBufferTimer,airJumpsLeft,sizeScale }`。
- `consume(input:InputState, dt:number)`：水平 `approach` 加速/摩擦；跳跃（coyote/jumpBuffer/可变跳高/二段跳）；踩踏 `v.y>0` 且底触敌顶 → 发 `ON_STOMP` + `v.y=BOUNCE`。参数全部来自 `character-config.json`。
- `sizeScale` 来自 `core.damage`（FULL=1 / SMALL=0.6），影响碰撞盒高度（GDD 07 §3 单点输出）。

### 4.4 敌人 AI（04）
- `EnemyState{ id,type,hp,state,x,y,vx,vy,stompable,dead }`，4 类 `ci_li/chong_feng/du_fu/shi_pao`。
- **表驱动**：每类 `state→transition` 映射（patrol/detect/charge/stun/float/aim/fire…），避免状态机膨胀。弹丸为独立 hazard 实体。
- 可踩判定：`enemy.stompable && 角色v.y>0 && 角色底触敌顶` → `ON_STOMP` 消灭；否则接触 → `ON_ENEMY_HIT_PLAYER`（踩不可踩怪→玩家受伤，与踩踏互斥）。

### 4.5 关卡（05）
- `LevelData{ id,version,tileSize,width,height,tiles,entities,props,checkpoints,goal,beat,metadata }`（GDD 05 §5）。
- `level-loader.ts`：解析 JSON → `RuntimeLevel`（tilemesh 碰撞+视觉、实体实例化、检查点数组、goal）；`beat` 交 `beat-clock`。
- 主题切换仅换主色/装饰（结构不变），回归测试保证。

### 4.6 受伤状态机（07，与形态正交）
- `DamageState{ state:'FULL'|'SMALL'|'DEAD', iframeTimer, sizeScale }`。
- 转换矩阵（GDD 07 §3）：`FULL→SMALL`（scale1→0.6, iframe1.5s, `ON_HURT`）、`SMALL→DEAD`（`ON_DEATH`）、`DEAD→重生`（`FULL`,form=BASE 正交复位,pos=respawn）、`lives==0→GAME_OVER`、`iframe>0` 忽略。
- **单点管理** `sizeScale`，他系统禁止直接改尺寸。

### 4.7 经济（06）
- `EconomyState{ coins,score,lives,combo,comboTimer,form }`；`ON_STOMP`+100、`ON_COIN`+10、goal+500；连击 `COMBO_WINDOW=1500ms`，`mult=min(1+0.5*(combo-1),4)`；`lives` 初始 3。

### 4.8 节拍（10，纯逻辑）
- `BeatClock{ bpm,grid,getBeat(),getBeatDurationMs(),onBeat(cb) }`，`beatDurationMs=60000/bpm/grid`。
- `enabled:false` → `onBeat` 不触发任何机制；仅保证 `level.beat` 可解析、可单测（测试态 `enabled:true` 验证递增与边界）。

### 4.9 元循环（11）
- `SaveData{ unlockedLevels,stars,bestTimes }`；`ON_LEVEL_COMPLETE→`解锁下一关+记录星/时间→调 `platform.storage` 持久化（微信 `wx.setStorageSync` / Web `localStorage`）。

### 4.10 事件总线（架构级解耦）
- `EventBus` 统一 `ON_*` 事件（`ON_JUMP/ON_DOUBLE_JUMP/ON_LAND/ON_STOMP/ON_ENEMY_DEATH/ON_HURT/ON_DEATH/ON_RESPAWN/ON_GAME_OVER/ON_COIN/ON_SCORE/ON_LEVEL_COMPLETE/ON_CHECKPOINT/ON_PAUSE…`）。
- core 发事件、game/ui/audio 订阅 → 音频占位、juice、HUD 刷新零耦合。

---

## 5. 双端适配层 `platform/`（设计要点）

**唯一允许 `import wx` / DOM 的边界。** 对外暴露 `Platform` 接口，core/game 仅依赖接口。

```ts
// 示意契约（非源码文件，仅为接口约定）
interface Platform {
  env: 'web' | 'wechat';
  input: RawInputProvider;          // sample():RawInputFrame
  audio: AudioPort;                 // play(name):void / unlock():void
  storage: StoragePort;             // get/set(key,val)
  lifecycle: LifecyclePort;         // onHide(cb)/onShow(cb)
}
```

### 5.1 输入
- Web：`web-keyboard.ts` 监听 `keydown/keyup`，维护 `code→down` 集合与边沿，输出 `RawInputFrame`（物理 id=`KeyboardEvent.code`）。
- 微信：`wechat-touch.ts` 监听 `wx.onTouch*`/canvas touch，按 `input-config.wechat.buttons`（归一化坐标 ×逻辑分辨率 512×288）命中测试左右双按钮 + 跳/动作双按钮 → 输出 `RawInputFrame`（物理 id=`touch:left` 等）。**仅微信显示触屏按钮**（由 `ui/touch-buttons.ts` 渲染，`env==='wechat'` 时挂载）。
- 二者都只产出 `RawInputFrame` → 同一 `InputAbstraction` → 完全相同的 `InputState` 序列（GDD 01 §7 验收）。

### 5.2 音频（09 占位 + 包体策略）
- 占位：`AudioBus.play(name)` 仅记录/静音（MVP），资产就绪后映射真实音效，不破结构。
- 微信自动播放限制：`unlockOnInteraction=true`，首次用户交互（`wx.onTouchStart` / Web `click`）后解锁。
- **包体关键**：MVP 音乐走**远程 URL 流式**（`wx.createInnerAudioContext().src=CDN`），**不进主包**；SFX 建议用 **WebAudio 振荡器合成短音**（零音频文件进包），见 ADR-004。

### 5.3 存储（11）
- Web：`localStorage`（key `super-mali-save`）；微信：`wx.setStorageSync`。`SaveData` 体积极小（仅关卡进度/星/时间），远低于微信 storage 限制。

### 5.4 生命周期与 env 探测
- `detect.ts`：构建期 `vite.config` 经 `define: { IS_WECHAT: mode==='wechat' }` 注入编译期常量，回退运行时 `typeof wx!=='undefined'`。Boot 场景据结果注入对应 `Platform` 实现（代码实际采用 IS_WECHAT define，非 VITE_PLATFORM）。
- 微信 `wx.onHide/onShow` → 暂停仿真/恢复（避免后台空跑耗电与计时漂移）。

### 5.5 WeChat 小游戏运行前提（关键技术风险）
- 需 **`weapp-adapter`** shim（提供 `canvas/document/window` 等全局），Phaser 在其上以 `Phaser.AUTO`（WebGL 优先，回退 CANVAS）运行；`canvas: wx.createCanvas()`，`pixelArt:true`。
- 微信工程需 `game.js` 入口 + `game.json`（含 `deviceOrientation:landscape`）；Vite 构建产出由微信开发者工具导入。详见 ADR-003 风险项。

---

## 6. 场景与游戏运行状态管理

### 6.1 Phaser 场景
| 场景 | 职责 |
|---|---|
| `BootScene` | 探测平台 → 注入 `Platform` → 设全局 `Scale`（512×288, FIT, roundPixels, pixelArt）→ 进 Preload |
| `PreloadScene` | 载 atlas（图集）、远程音频 URL 注册、关卡 JSON、config；建 `EventBus` 与 `RunStateMachine` |
| `MenuScene` | 标题/开始（`ON_START` → `PLAYING`） |
| `GameScene` | **固定步长 60Hz 主循环**；持有 core 仿真编排；渲染世界 |
| `UIScene` | 并行透明场景：HUD/暂停/结算/微信触屏按钮 |
| `SandboxScene` | 仅 dev 构建：空房间跑真实循环 + 手感指标浮层（验证 §9.1） |

### 6.2 顶层 RUN 状态机（架构级，独立于实体 DamageState）
```
BOOT ──▶ MENU ──▶ PLAYING ◀─▶ PAUSED
                 │              │(ON_RESUME)
                 │(ON_LEVEL_COMPLETE)
                 ▼
            LEVEL_COMPLETE ──▶ (下一关 / MENU)
                 │(lives==0, ON_GAME_OVER)
                 ▼
            GAME_OVER ──▶ MENU
```
- `run-state-machine.ts` 管理会话流；与 `DamageState`（实体级）正交，互不写入。
- 暂停：`INPUT_ACTION`（或专用键）→ `ON_PAUSE`；微信 `onHide` 自动暂停。

---

## 7. 固定步长 60Hz 主循环与渲染分离

**决策**：仿真以固定 `STEP_MS=1000/60≈16.667ms` 推进，渲染随 RAF；累加器模式解耦。理由：手感确定性（coyote/buffer/二段跳窗口在固定步下可量化复现）、双端一致、可 headless 单测。

```ts
// game/fixed-step.ts 示意（架构契约，非落地源码）
const STEP_MS = 1000 / 60;
let acc = 0;
function update(realDeltaMs: number) {
  acc += Math.min(realDeltaMs, 250);       // 防卡顿后追帧爆炸
  while (acc >= STEP_MS) {
    stepSimulation(STEP_MS);                // 推进 core：输入采样→物理→角色→敌人→受伤→经济→关卡→节拍
    acc -= STEP_MS;
  }
  const alpha = acc / STEP_MS;              // 渲染插值因子（像素风可省略，见下）
  render(alpha);                            // 读 core 最新 state 绘帧
}
```

- **渲染取整**：像素风 + `roundPixels:true`，默认按核心状态最新整数位置绘制（不强制子像素插值，保证像素不被插值模糊）；如需平滑可启用 `alpha` 插值（仅非像素层）。
- **计时一致**：仿真时钟 `simTimeMs` 仅在 `stepSimulation` 内按 `STEP_MS` 累加；`jumpPressedAt`、coyote/jumpBuffer/iframe/combo 等 ms 计时器均以此为准 → Web 与微信结果逐帧一致。
- **输入采样同步**：输入在固定步内采样（非渲染帧），避免低端机输入延迟（GDD 01 §8）。

---

## 8. 资源加载策略（包体优先）

| 资产 | 策略 | 包体去向 |
|---|---|---|
| 像素图集 atlas | 全角色/敌人/地形/道具/UI 图标打包为 **1 个图集**（PNG-8 索引色 ≤64 色，32px 网格对齐） | 主包（预算 ≤1MB） |
| 音频-音乐 | **远程 URL 流式**（`wx.createInnerAudioContext` / Web `Audio()`），**不进包** | 远程/CDN |
| 音频-SFX | MVP **WebAudio 振荡器合成短音**（零文件），或用极短占位音 | 主包（可选，极小） |
| 关卡 JSON | 主关随包；后续关卡走**微信子包**（subpackage） | 子包（计入 8MB） |
| 字体 | HUD/中文走**运行时系统字体**（矢量），不进包；数字像素字可选自绘位图（小） | 系统/主包(小) |

- **图集工具**：推荐 `free-tex-packer`（开源 CLI，零成本，输出 Phaser 兼容 atlas JSON）；`TexturePacker` 为付费备选（见 ADR-004 开放问题）。
- **像素资产规范**（对齐美术圣经 §2.3–2.5）：`antialias:false`、nearest-neighbor、单帧对齐 32 倍数、共用 `palette.png`（≤64 色）、PNG-8 索引色。

---

## 9. 测试策略（lean）

### 9.1 框架选择：**Vitest**（Vite 原生、Node 运行、无需浏览器）
- 因 `core/` 零 Phaser 依赖，`core/**` 全部可纯 Node 单测，启动快、CI 便宜，契合 lean。
- **不测渲染**：Phaser 渲染/场景测试排除（lean），只测逻辑与契约。

### 9.2 单测覆盖（风险优先，仅 core/）
| 模块 | 用例（关键） |
|---|---|
| `beat` | `level.beat` 解析；`enabled:false` 不触发；测试态 `getBeat` 随 `simTimeMs` 递增、`onBeat` 边界正确；`tracks` 扩展兼容 |
| `level` | `LevelData` 校验（tileSize/width、beat 字段、goal type）；loader 产出 RuntimeLevel；主题切换结构不变 |
| `input` | `RawInputFrame→InputState`（含 `jumpPressedAt` 边沿、held/released 三态）；同手势双端 RawInputFrame 等价 |
| `character` | 喂 `InputState`+固定 `dt` 循环：coyote≤100ms 有效、jumpBuffer≤120ms 有效、短跳 45–55%、二段跳 1 次落地重置、水平 0→满速 ≤0.2s、松键 ≤0.15s、踩踏反弹 |
| `physics` | 静止站 tile 不抖/不陷；单向平台规则；移动平台随动；穿透安全 |
| `enemy` | 4 类状态机转表；可踩判定（刺栗/嘟浮 顶踩死；冲锋/石炮 踩则伤）；弹丸 hazard |
| `damage` | 转换矩阵；无敌帧内忽略；`DEAD→重生` 复位 form=BASE；lives==0→GAME_OVER |
| `economy` | 计分（+100/+10/+500）；连击倍率递增封顶 ×4、窗超时清零；lives 递减 |

### 9.3 手感沙盒（数据化验收，非纯单测）
- `SandboxScene`（dev 构建）：空房间跑**真实固定步循环**，浮层显示实测指标：跳跃高度(px)、滞空(s)、coyote 窗口(ms)、jumpBuffer 有效性、二段跳高度、水平加速/减速时间。
- 验收：指标落入 GDD 03 §7 区间（如全跳≈64px、短跳 45–55%、二段跳≈1.6 tiles）→ 达标再铺内容。指标阈值见 control-list §1。

### 9.4 Headless 仿真冒烟（确定性）
- 因 core 纯函数化，可脚本化跑完整仿真 N 步（脚本输入序列），断言：无异常、输出确定性（同输入同输出）、状态不漂移 → 双端逻辑等价的有利证据。

### 9.5 CI（lean）
- `npm test`（Vitest）在 push 触发；`tsc --noEmit` 类型检查。无重 E2E。微信构建冒烟作为人工质量门（见控制清单）。

---

## 10. 配置集中（config）

所有数值经 `src/config/*.json` + `core/config/index.ts` 类型化读取。逻辑层**禁止硬编码**。GDD 已定的可选默认值：

| 配置 | 关键参数（来自 GDD） |
|---|---|
| character-config | moveSpeed140, accelGround1200, accelAir800, friction1600, gravity1800, jumpVelocity-480, coyoteMs100, jumpBufferMs120, doubleJumpScale0.9, stompBounce-300 |
| enemy-config | ci_li speed40；chong_feng detect160/48 charge220 stun1000；du_fu float60 amp24；shi_pao fire2000 proj180 |
| economy-config | initialLives3, stompScore100, coinScore10, goalScore500, comboWindowMs1500, maxMult4 |
| damage-config | invincibleMs1500, fullScale1, smallScale0.6 |
| input-config | web 键位；wechat 按钮归一化坐标（左/右 0.08/0.22×0.82；跳 0.82×0.82 r0.08；动作 0.92×0.70） |
| beat（关卡内） | enabled:false, bpm120, grid8, tracks:[] |
| ui-config | hudLayout, font:'system', minFontSizePx14, touchButtonsFromInput:true |
| audio-config | master1, sfx1, music0, unlockOnInteraction:true |

---

## 11. 双端一致性保障（设计内建）

1. **唯一差异点** = `platform/` 的 `RawInputProvider` + 音频/存储/生命周期实现；逻辑层完全共享。
2. **输入等价**：Web 键盘与微信触屏都只产 `RawInputFrame` → 同一 `InputAbstraction`。单测固化"等价手势→等价 RawInputFrame→等价 InputState"。
3. **仿真确定性**：固定步长 + 仿真时钟 → 同输入序列在两端逐帧一致（headless 仿真冒烟验证）。
4. **一致性测试项**：见 control-list §4。

---

## 12. 与美术圣经的对齐

- 分辨率/网格/像素：`Scale` 全局 `512×288`、`pixelArt:true`、`FIT`、`roundPixels:true`、`antialias:false`（§2.3、2.4）。
- 混合 UI：世界像素（atlas），HUD/中文矢量/系统字体（§2.6、7.1）→ `ui/` 层不依赖像素字库，规避 CJK 包体风险。
- 可读性/可访问性：`ui/` 按钮热区 ≥48px（§9.2）；色盲双编码由美术资产落地，逻辑层不干预；减少动态/色盲模式开关留 Could（§9.3）。
- 粒子预算 ≤60、屏震 ≤4px（§8 juice）→ `render` 层对象池 + 设置开关（Could）。

---

## 13. GDD 接口契约 → 架构可实现性映射

| GDD | 接口契约 | 落地模块 | 可实现？ |
|---|---|---|---|
| 01 | `InputState`、`InputAbstraction.sample()` | core/input | ✅ 纯函数，可单测 |
| 02 | `Body`/`CollisionResult`/`stepBody`/`isGrounded` | core/physics | ✅ 纯函数 |
| 03 | `CharacterState`、`consume(input,dt)`、`ON_*` | core/character | ✅ 纯函数 + 事件 |
| 04 | `EnemyType`/`EnemyState`、`ON_STOMP`/`ON_ENEMY_HIT_PLAYER`/`ON_PROJECTILE_SPAWN` | core/enemy | ✅ 表驱动 |
| 05 | `LevelData`/`TileDef`/`EntityDef`/`PropDef`、`LevelLoader.load()`、`ON_LEVEL_COMPLETE`/`ON_CHECKPOINT` | core/level | ✅ 纯解析 |
| 06 | `EconomyState`、`ON_COIN`/`ON_SCORE`/`ON_LIFE_LOST`/`ON_FORM_CHANGED` | core/economy | ✅ 纯函数 |
| 07 | `DamageState`/`DamageStateName`、`applyDamage()`、`ON_HURT`/`ON_DEATH`/`ON_RESPAWN`/`ON_GAME_OVER` | core/damage | ✅ 状态机 |
| 08 | `HUDModel`、`ON_PAUSE`/`ON_RESUME`/`ON_RESTART`/`ON_LEVEL_COMPLETE_UI` | ui/ + game/ui-scene | ✅ 订阅 core 事件 |
| 09 | `playSfx(name)`、`SfxName` 枚举 | game/audio/audio-bus | ✅ 占位不崩 |
| 10 | `BeatDef`/`BeatClock`、`createBeatClock(def)` | core/beat | ✅ 纯逻辑时钟 |
| 11 | `SaveData`、`loadSave()`/`saveLevelResult()`、`ON_LEVEL_COMPLETE` | core/meta + platform/storage | ✅ 接口注入 |

> 结论：11 个 GDD 接口契约**全部可被现有架构落地、无冲突**；IP 红线由资产与命名保证，构建期检查兜底（control-list §3）。

---

## 14. 待主理人确认（开放问题，附带笔者建议）

1. **状态管理：手写 vs 库**（ADR-002）：建议**手写显式状态机 + 轻量事件总线**，不引入 XState（lean、包体小、状态机已在 GDD 中以矩阵明确、且需确定性可测）。请确认。
2. **图集打包工具选型**（ADR-004）：建议 `free-tex-packer`（开源零成本，Phaser 兼容）；付费备选 `TexturePacker`。请确认。
3. （不阻塞，沿用 phase2 门已锁决策）二段跳保留 1 次、触屏双按钮、`enabled:false` 纯逻辑节拍均已锁定，架构据此落地。
4. （带入实现期）下穿单向平台/关卡长度 parTime/结算星级权重/音频占位 vs 静音/元循环地图 vs 直进，依 phase2 门 CONCERNS 后续拍板，不影响本架构骨架。
