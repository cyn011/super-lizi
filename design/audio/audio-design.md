# S05-4 音频设计契约 / Audio Design Contract

> 负责人：阮和鸣（audio-director）｜阶段：Phase 5（制作）｜Story：S05-4
> 性质：**设计契约**（只定义设计 + 事件映射 + 实现策略，不含引擎/平台代码）
> 上游：GDD 03/04/06/07/09/10/12、concept §6.2｜依赖落地：engineering-lead（程基岩）
> 状态：**待主理人审批**（未 git commit）

---

## 0. 范围与铁律

- **本契约只写文档与事件表，不写引擎代码。** 所有代码落地（WebAudio/WechatAudio 合成、audio-bus 模块）由 engineering-lead 按 §3 策略实现。
- **复用既有 `AudioPort`**（`play(name)` + `unlock()`，见 `src/platform/platform.ts`），**不新建重复接口**（除非 §6 决策点批准扩展）。
- **core 零平台 API / 零 Phaser** 铁律不变：音频播放一律经 `platform.audio` 注入；新增「薄 audio-bus」落在 `src/game/audio/`，**订阅事件总线 → 调 `platform.audio.play(name)`**；core 不反向依赖音频层。
- **项目当前零真实音频素材**：Web 端用 **WebAudio 程序化合成**（OscillatorNode + GainNode 包络，零素材、可测、不膨胀包体）；微信端设计成 **`name → CDN URL` 映射 + `wx.createInnerAudioContext()` 流式**，缺素材期间静默不崩（known limitation，不阻塞主线）。
- **MVP 不播 BGM**（`audio-config.json` 默认 `music:0`）。本契约定义音乐**基调方向 + 未来接入路径**，但本 Story 不实现 BGM 播放。

---

## 1. 音乐方向（基调）

**世界观与情绪**（对齐 concept §6.2 / §P3）：原创"种子精灵唤醒沉睡大地"暖色奇幻世界观，自然主题关卡（草原 / 石窟 / 云端）。情绪 = **温暖、轻快、冒险、童趣但不幼稚**；危险区用冷蓝/紫做反差提示。

**调色板呼应**（concept §6.2）：基底暖橙黄（阳光、活力、友好）、自然青绿/墨绿（草地、丛林）。音乐 timbre 走向 **organic（木琴 / 铃 / 轻拨弦 / 柔和 pad）**，避免合成器 harsh 与任何任天堂风格采样（IP 红线：禁用蘑菇/星/旗杆符号）。

**节拍基准**（GDD 10）：默认 `beat = { enabled:false, bpm:120, grid:8, tracks:[] }` → 未来 BGM 以 **120 BPM、4/4、八分网格（grid=8）** 为基准，并为 GDD 10 Could「节拍驱动平台/陷阱 + 动态音乐同步」预留同步点（`ON_BEAT` 未来由 `BeatClock` 驱动）。

**分层情绪曲线**（按 RunState / 场景）：

| 场景 | 情绪 | 配器动机 |
|---|---|---|
| 探索 / 菜单 | 明亮 major，稀疏琶音，中速 | 木琴 lead + 轻拨弦 bass |
| 战斗 / 冲锋怪接近 | 轻 percussion + 低音脉冲，张力微升但不焦虑 | 加轻木鱼/沙锤 |
| 凯旋之门（通关） | 明亮 major 上行琶音 + 铃 | 与 `sfx:level_clear` 旋律动机呼应 |
| 受伤 / GameOver | 短暂停顿 + 下行，但很快回到温暖基调 | 童趣不悲剧，不 harsh |

**配器建议（MVP 后，未来接入）**：lead = 木琴/钟琴；bass = 拨弦/次中音；pad = 柔和弦乐/合成 pad；perc = 轻木鱼/沙锤。

**未来接入路径**（不阻塞本 Story）：
1. 在 `AudioPort` 增加 `playMusic(name)` / `streamMusic(url)`（待 §6 D2 拍板是否扩展接口）；
2. 微信走远程 URL（不进主包，control-list §2）；
3. 用 `BeatClock`（AudioContext 时钟，GDD 10 Could）对齐 `onBeat`；
4. `music` 音量由 `audio-config.music` 控制，默认 0（MVP 静音）。

---

## 2. SFX 事件表（核心交付）

> 命名约定：SFX `name` 为传给 `AudioPort.play(name)` 的字符串，采用 `sfx:<意图>` 前缀，与事件名 `ON_*` 明确区分，避免撞名。
> 事件真实性：✅ = 真实游戏循环已 `emit`；⚠ GAP = 事件已定义/被 GDD 要求但当前代码无 emit 源（见 §6 决策点）。

| # | 玩法意图 | 真实事件 (EventName) | SFX name | 设计意图（音色 / 时长 / 音高走向） | 真实性 | 备注 |
|---|---|---|---|---|---|---|
| 1 | 跳跃 | `ON_JUMP` | `sfx:jump` | 轻快上滑"whoop"：三角波 320→540Hz，140ms，attack 5ms/decay 135ms | ✅ | game-scene:534 已 emit（D1 CLOSED） |
| 2 | 二段跳（如有） | `ON_DOUBLE_JUMP` | `sfx:double_jump` | 跳跃的明亮回声：三角 480→700Hz，90ms | ⚠ GAP | 从未 emit（MVP 无二段跳事件源，D5）；`sfx:double_jump` 已合成、audio-bus 已接映射，仅待 emit |
| 3 | 落地 | `ON_LAND` | `sfx:land` | 柔和"噗"：三角 150→110Hz 短衰减 70ms，低增益 | ✅ | game-scene.ts:417 |
| 4 | 踩踏消灭敌人 | `ON_STOMP` + `ON_ENEMY_DEATH`（同源同帧） | `sfx:stomp` + `sfx:enemy_death` | `sfx:stomp`=方波 600→180Hz 下滑"啵"70ms；`sfx:enemy_death`=正弦 400→200Hz 轻"噗"100ms（低增益，避免叠加爆音） | ✅ | damage-resolution.ts:97/98 同帧；两音增益已错开 |
| 5 | 拾取金币 | `ON_COIN` | `sfx:coin` | 经典双音上行：正弦 988→1319Hz（B5→E6）两声 60+60ms，明亮 | ✅ | pickup-resolution.ts:72 |
| 6 | 受伤 | `ON_HURT` | `sfx:hurt` | 下行"哎"：锯齿 400→160Hz 180ms，中增益，略带粗糙 | ✅ | damage-resolution.ts:114，payload `{lives,state}` |
| 7 | 死亡前兆 / 重生（无敌帧结束·复活） | `ON_DEATH` / `ON_RESPAWN` | `sfx:death` / `sfx:respawn` | `sfx:death`=三角/锯齿 500→120Hz 400ms 较低沉；`sfx:respawn`=正弦 300→600Hz 250ms 柔和上行"复活" | ✅ | damage-resolution.ts:121/122/138；"无敌帧结束"无独立事件（D6） |
| 8 | 通关（凯旋之门） | `ON_LEVEL_COMPLETE` | `sfx:level_clear` | 凯旋上行琶音：正弦/三角 C5-E5-G5-C6 (523-659-784-1047) 每音~120ms 顺序，明亮大调 | ✅ | game-scene.ts:488，payload `{levelId}` |
| 9 | GameOver | `ON_GAME_OVER` | `sfx:game_over` | 下行短句：三角 440→330→220Hz 600ms，低增益，略惆怅不 harsh | ✅ | damage-resolution.ts:139 |
| 10 | 暂停 | `ON_PAUSE` | `sfx:pause` | 中性轻"咔"：方波 660Hz 50ms 短促 UI | ✅ | run-lifecycle.ts:42 / game-scene.ts:383 |
| 11 | 恢复 | `ON_RESUME` | `sfx:resume` | 略上行 UI：方波 660→880Hz 60ms | ✅ | run-lifecycle.ts:58 / pause-menu.ts:57 |
| 12 | 重开 | `ON_RESTART` | `sfx:restart` | 轻快上扫：三角 440→880Hz 120ms，比 resume 更亮 | ✅ | result-screen.ts:145 / pause-menu.ts:58 / game-scene.ts:556 |
| 13 | 检查点 | `ON_CHECKPOINT` | `sfx:checkpoint` | 温和铃：正弦 784Hz(G5) 软衰减 300ms 单音微光 | ✅ | pickup-resolution.ts:102 |
| 14 | 种子采集 | `ON_SEED_COLLECTED` | `sfx:seed_collect` | 闪亮"叮"：正弦 1047→1568Hz(C6→G6) 两声 50+50ms，清脆有机 | ✅ | pickup-resolution.ts:85，payload `seedId` |
| 15 | 种子蜕变 stage up | `ON_SEED_METAMORPHOSIS` | `sfx:seed_metamorph`（原 GDD09 `SFX_POWERUP`） | 温暖上行"绽放"：正弦/三角 440→880Hz 300ms + 柔铃泛音，正向生长感 | ✅ | 已接总线（D4 CLOSED）；event-bus 常量已就位、game-scene:321 跨阈值 emit（每次 GROWTH 不 emit） |
| 16 | 石炮开火 | `ON_PROJECTILE_SPAWN` | `sfx:projectile_fire` | 短"啾"：方/锯齿 700→300Hz 80ms，安静 | ✅ | game-scene:549 已 emit（D3 CLOSED） |
| 17 | 分数变化（可选，默认不发声） | `ON_SCORE_CHANGED` | （建议不映射 / 仅连击里程碑） | — | ✅ 但高频 | 每次踩/币/通关都发，默认不接音效避免 spam（D7） |

**MVP 必接（真实事件已存在）**：#1–#16 均已落地——#1 跳跃 game-scene:534 emit（D1 CLOSED）、#15 种子蜕变 game-scene:321 跨阈值 emit（D4 CLOSED）、#16 石炮 game-scene:549 emit（D3 CLOSED）。
**GAP / 延后（待决策点）**：#2（二段跳 `ON_DOUBLE_JUMP`，D5，从未 emit，无二段跳玩法，低优先；`sfx:double_jump` 已合成且 audio-bus 已接映射）。
**可选**：#17。

---

## 3. 实现策略

### 3.1 Web：`WebAudio` 程序化合成（零素材）

- **入口**：`src/platform/web/web-audio.ts` 的 `WebAudio.play(name)` 当前静默占位；engineering-lead 增加「`name → 合成参数`」查表 + 合成器。
- **合成基元**：`OscillatorNode` + `GainNode`（包络）。多音类用第二 `OscillatorNode` 叠和声，或单 OscillatorNode + `frequency.setValueAtTime` 分段调度。瞬态（land/stomp 的"咔"）可用运行时生成的短 `BufferSource` 白噪（仍零素材）。
- **解锁**：`unlock()` 已建 `AudioContext` 并 `resume()`（`main.ts` 首交互调用）。`play()` 在 `ctx` 为 null 时 no-op（即解锁前静默）。
- **音量施加**（见 §4）：`effectiveGain = audioConfig.master * audioConfig.sfx * SFX_BASE_GAIN[name]`。
- **复音/性能**：每次 `play` 新建 OscillatorNode+GainNode，`onended` 后自动 GC；同发上限低（≤8），无需池化。踩踏同帧双音已错开增益（`sfx:enemy_death` 仅 `sfx:stomp` 的 ~40%）避免削波。

**SFX name → 合成参数参考表**（供 engineering-lead 落地 `web-audio.ts`）：

| name | osc | f0→f1 (Hz) | dur (s) | attack (s) | release (s) | baseGain |
|---|---|---|---|---|---|---|
| `sfx:jump` | triangle | 320→540 | 0.14 | 0.005 | 0.135 | 0.50 |
| `sfx:land` | triangle | 150→110 | 0.07 | 0.004 | 0.066 | 0.35 |
| `sfx:stomp` | square | 600→180 | 0.07 | 0.003 | 0.067 | 0.50 |
| `sfx:enemy_death` | sine | 400→200 | 0.10 | 0.005 | 0.095 | 0.20 |
| `sfx:coin` | sine | 988→1319（两音） | 0.06×2 | 0.003 | 0.057 | 0.45 |
| `sfx:hurt` | sawtooth | 400→160 | 0.18 | 0.005 | 0.175 | 0.50 |
| `sfx:death` | triangle/saw | 500→120 | 0.40 | 0.010 | 0.390 | 0.40 |
| `sfx:respawn` | sine | 300→600 | 0.25 | 0.010 | 0.240 | 0.40 |
| `sfx:game_over` | triangle | 440→330→220（三步） | 0.20×3 | 0.010 | 0.190 | 0.40 |
| `sfx:pause` | square | 660 | 0.05 | 0.002 | 0.048 | 0.30 |
| `sfx:resume` | square | 660→880 | 0.06 | 0.002 | 0.058 | 0.30 |
| `sfx:restart` | triangle | 440→880 | 0.12 | 0.004 | 0.116 | 0.40 |
| `sfx:level_clear` | triangle | 523→659→784→1047（四音序） | 0.12×4 | 0.005 | 0.115 | 0.50 |
| `sfx:checkpoint` | sine | 784 | 0.30 | 0.010 | 0.290 | 0.35 |
| `sfx:seed_collect` | sine | 1047→1568（两音） | 0.05×2 | 0.003 | 0.047 | 0.45 |
| `sfx:seed_metamorph` | sine/triangle | 440→880 | 0.30 | 0.010 | 0.290 | 0.45（+泛音） |
| `sfx:projectile_fire` | square/saw | 700→300 | 0.08 | 0.003 | 0.077 | 0.25 |

> 多音类（coin / seed_collect / game_over / level_clear）：用两个 OscillatorNode 或单 OscillatorNode + `setValueAtTime` 分段频率，按表"×N"总时长。频率走向用 `frequency.setValueAtTime` + `linearRampToValueAtTime` 实现 f0→f1。

### 3.2 微信：`name → CDN URL` 映射 + `wx.createInnerAudioContext()` 流式

- **结构**：`wechat-audio.ts` 持有 `SFX_CDN: Record<SfxName, string>`（或抽到 `assets/audio/cdn-map.json`）。缺素材期间 URL 缺省为空串/undefined。
- **`play(name)`**：若 `!unlocked` → return（静默，不崩）；若 `map[name]` 存在 → 取/复用一个 `InnerAudioContext` 实例（建议**实例池**，≥4 复用，避免频繁 new），设 `.src = url`、`.play()`；否则 **no-op**（known limitation：素材未就位）。
- **`streamFrom(url)`** 已是 seam（`TODO(S05-4)`），可复用：`play` 内部调 `streamFrom(map[name])`。
- **静默策略**：素材缺失 → 任何 name 都静默返回，绝不抛错/阻塞主线程；素材到位即响（仅改 map，不破结构）。
- **性能**：`InnerAudioContext` 实例池上限（建议 6），超出丢弃最旧；无预加载（远程流式，首播略延迟可接受）。
- **已知限制**：当前无 CDN 素材 → 微信端全程静默，属 known limitation，不阻塞主线（与 GDD 09 §8 一致）。

### 3.3 薄 audio-bus（game 层，订阅 → play）

- **新增** `src/game/audio/audio-bus.ts`（路径落 game，不破 core 零依赖）。
- **职责**：构造时接收 `(bus: EventBus, audio: AudioPort)`；内部维护 `EVENT → SFX_NAME` 映射表；对每个真实事件 `bus.on(event, () => audio.play(SFX_MAP[event]))`；提供 `destroy()` 统一解绑（场景 shutdown 调用）。
- **映射表**（仅含本 Story 真实/计划接入事件；GAP 项注释标注）：

  ```
  ON_JUMP                → sfx:jump              // ✅ game-scene:534 已 emit（D1 CLOSED）
  ON_DOUBLE_JUMP         → sfx:double_jump       // ⚠ 未 emit（D5 延后，无二段跳玩法）；audio-bus 已接映射
  ON_LAND                → sfx:land
  ON_STOMP               → sfx:stomp
  ON_ENEMY_DEATH         → sfx:enemy_death
  ON_COIN                → sfx:coin
  ON_HURT                → sfx:hurt
  ON_LIFE_LOST           → sfx:hurt              // 复用 hurt（无独立 life_lost 合成）
  ON_DEATH               → sfx:death
  ON_RESPAWN             → sfx:respawn
  ON_GAME_OVER           → sfx:game_over
  ON_LEVEL_COMPLETE      → sfx:level_clear
  ON_LEVEL_COMPLETE_UI   → sfx:level_clear       // UI 变体，复用 level_clear
  ON_PAUSE               → sfx:pause
  ON_RESUME              → sfx:resume
  ON_RESTART             → sfx:restart
  ON_CHECKPOINT          → sfx:checkpoint
  ON_SEED_COLLECTED      → sfx:seed_collect
  ON_SEED_METAMORPHOSIS  → sfx:seed_metamorph    // ✅ game-scene:321 跨阈值 emit（D4 CLOSED）
  ON_FORM_CHANGED        → sfx:seed_metamorph    // GDD06 元气果（MVP 未 emit），暂复用绽放音
  ON_PROJECTILE_SPAWN    → sfx:projectile_fire   // ✅ game-scene:549 已 emit（D3 CLOSED）
  // ON_SCORE_CHANGED 默认不映射（D7）
  ```
- **初始化点**：`game-scene.ts` 的 `create()` 中，在 `this.bus` / `this.platform` 就绪后**最早订阅处**实例化 `this.audioBus = new AudioBus(this.bus, this.platform.audio)`；`shutdown()` 调 `this.audioBus.destroy()`。理由：`bus` 已挂 registry/globalThis（`main.ts:46-47`），`platform.audio` 由 `createPlatform(env)` 注入（web/wechat-platform 各自 `new WebAudio()/new WechatAudio()`）；audio-bus 在 game 层组装，core 不感知。
- **注意**：`EventBus` 同步多播，audio-bus 订阅顺序不影响其他订阅者；但须在 `create()` 早期注册，避免错过首个事件。本游戏无首帧必需音效（无 `ON_START` 类），安全。
- **依赖合规**：audio-bus 仅依赖 `core/events/event-bus`（常量 + `EventBus` 类型）与 `platform` 的 `AudioPort` 类型；不 import 任何平台实现，符合分层。

---

## 4. `audio-config.json` 用法

- **字段**：`{ master:1, sfx:1, music:0, unlockOnInteraction:true }`（`src/config/audio-config.json`）。
- **读取**：`core/config/index.ts` 已 `import audioJson from '../../config/audio-config.json'` → 暴露为 `audioConfig`。`WebAudio` / `WechatAudio` 应消费该配置。
- **施加规则**：
  - **SFX 播放增益** = `audioConfig.master * audioConfig.sfx * SFX_BASE_GAIN[name]`（§3.1 表末列）。
  - **未来 BGM 增益** = `audioConfig.master * audioConfig.music * MUSIC_BASE_GAIN`（`music=0` → 静音）。
  - `unlockOnInteraction:true` → 首次用户交互调 `platform.audio.unlock()`（`main.ts:60` 已做；WebAudio 建并 resume `AudioContext`，WechatAudio 置 `unlocked=true`）。unlock 前 `play` 静默。
- **调参**：`master` 总闸；`sfx` / `music` 分轨。MVP `music=0` 即不播 BGM。

---

## 5. 验收门槛建议（engineering-lead 落地后）

1. **事件→play 计数**：自动化/集成测试构造 `EventBus` + mock `AudioPort`（记录 `play(name)` 调用序列），依次 emit 各真实事件，断言每个 emit 触发**恰好一次**对应 name 的 `play`，且 name 与 §2 映射一致。
2. **unlock 闸门**：未 unlock 时 emit 任意事件 → `play` 被调用 0 次；unlock 后 → 记录 N 次。
3. **core 零平台扫描**：`grep -rnE "wx\.|window\.AudioContext|new AudioContext|createInnerAudioContext" src/core` → **0 命中**（音频实现仅在 `platform/`）。
4. **分层合规**：audio-bus 位于 `src/game/audio`；core 无 import audio；core 仅 emit 事件。
5. **同帧双音不爆**：触发 `ON_STOMP` 时 `sfx:stomp` 与 `sfx:enemy_death` 同时发声但合成增益已错开（实测峰值 ≤ 1.0，无削波）。
6. **无回归**：`core/sim/headless` 仿真仍通过——audio-bus 不在 headless 使用，事件照常 emit，仿真不受影响。
7. **跳跃音修复验证**（D1 CLOSED）：game-scene 起跳 emit `ON_JUMP`（game-scene:534）→ `sfx:jump` 被 `play`。
8. **微信静默不崩**：缺 CDN map → 全事件 `play` no-op，无异常、无主线程阻塞。

---

## 6. 已知限制 / 待主理人拍板项（Decision Points）

- **D1（跳跃音源缺口）— ✅ CLOSED**：`ON_JUMP` 原仅在 headless 仿真 emit；现 `game-scene.ts:534` 在 `controller.lastJumped && !skipConsume` 时 `emit(ON_JUMP)`，跳跃音已有统一真实源（S05-4 实现期落地）。
- **D2（BGM 接口扩展）**：是否本 Story 预接 BGM？建议否（`music=0`，仅锁基调）。若未来需 BGM，**是否扩展 `AudioPort`（新增 `playMusic`/`streamMusic`）还是另立 `BgmPort`**？请拍板（影响架构）。
- **D3（石炮开火事件）— ✅ CLOSED**：`ON_PROJECTILE_SPAWN` 现 `game-scene.ts:549` 在石炮产出弹丸时 `emit(ON_PROJECTILE_SPAWN)`，触发 `sfx:projectile_fire`（S05-4 实现期落地）。
- **D4（种子蜕变事件缺口，GDD↔代码不一致）— ✅ CLOSED（GDD 12 §5.1 已定义 `ON_SEED_*` 事件契约）**：`audio-bus.ts` 已接 `ON_SEED_METAMORPHOSIS → sfx:seed_metamorph`（与 `web-audio.ts` 合成 440→880Hz/0.30s 对齐）。event-bus.ts 常量已就位；`game-scene.ts:319-321` 在 seed growth **跨阈值**时 emit `ON_SEED_METAMORPHOSIS`（每次 `ON_SEED_GROWTH` 不 emit，避免 spam）；`ON_SEED_GROWTH` 音频侧**不映射**（采集反馈已由 `ON_SEED_COLLECTED→sfx:seed_collect` 覆盖，避免每采双音）。
- **D5（二段跳）**：`ON_DOUBLE_JUMP` 从未 emit；MVP 角色有 `airJumps` 但无对应事件。`sfx:double_jump` 已在 `web-audio.ts` 合成、`audio-bus` 已接映射，但无触发源 → **唯一孤儿 SFX**。建议暂不接（与跳跃共用 `sfx:jump` 也可），待二段跳玩法明确后由工程补 emit 即自动发声。
- **D6（无敌帧结束音）**：用户要求"无敌帧结束"反馈，但当前无独立事件（`invincibleTimer` 归零不发事件）。建议用 `ON_RESPAWN` 触发 `sfx:respawn` 作为"重生/恢复"反馈；若需精准"无敌结束"提示，需新增 `ON_INVINCIBLE_END` 事件（建议不做以免琐碎）。
- **D7（`ON_SCORE_CHANGED` 是否发声）**：该事件高频（每次踩/币/通关都发）。默认建议**不映射音效**（仅 HUD 视觉），避免 spam；如要听觉奖励，仅对连击里程碑（`comboMult` 跳变）触发轻音。请拍板。
- **D8（新增 AudioPort 方法？）**：当前 `play`/`unlock` 够用（name→音效 由平台内部解释）。是否需 `setVolume(bus, v)` 或 `playMusic`？建议保持最小接口，音量统一走 `audio-config`；如未来 BGM 需要再扩展（关联 D2）。
- **D9（微信素材来源）**：CDN base URL 与命名约定（如 `https://cdn.example.com/sfx/<name>.mp3`）待提供；缺素材期静默（known limitation）。
- **D10（包体/性能预算）**：Web 合成零素材（优）；微信流式不进主包（control-list §2 优）。同发语音上限建议 ≤8（Web）/ 池化 ≤6（微信）。

---

## 7. 与既有资产/文档对齐

- **GDD 09 旧 `SfxName` 枚举**（`SFX_JUMP…SFX_FIRE`）已被本契约的**字符串 `name` 方案**取代（`play(name:string)` 架构）。旧枚举可视为 name 同义，但新代码用 §2 的 `sfx:*` 命名。
- **GDD 12 对齐**：种子音 `sfx:seed_collect`（采集）+ `sfx:seed_metamorph`（蜕变，已接总线 D4 CLOSED）。
- **GDD 10 对齐**：BGM 未来 120 BPM；`ON_BEAT` 当前仅 headless emit，真实游戏未驱动（`BeatClock.enabled:false`），故节拍同步音乐留 Could。
- **IP 红线**：音色/旋律禁用任天堂符号（蘑菇/星/旗杆采样），全部原创/程序化。

---

## 8. 交付物清单

- `design/audio/audio-design.md`（本文件，主交付）
- `design/audio/audio-event-map.md`（事件真实性盘点：真实 emit vs 仅定义未 emit vs GDD 要求但未落地）
