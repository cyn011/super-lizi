# Phase 6 音频打磨 / Audio Polish Phase 6

> 负责人：阮和鸣（audio-director）｜阶段：Phase 6（打磨）｜上游：S05-4 设计契约（`design/audio/audio-design.md` + `audio-event-map.md`）
> 范围：**只出规格、判定、清单**。音频实现的代码改动归 engineering-lead（程基岩）。本文不写 `src/`、不 git commit。
> 验证基线（均来自对 `src/**` 实际读取，非臆造）：
> - `src/game/audio/audio-bus.ts`（`EVENT_TO_SFX`，21 条映射 + `AudioBus` 订阅）
> - `src/core/events/event-bus.ts`（28 个 `ON_*` 常量）
> - `src/platform/web/web-audio.ts`（18 SFX 程序化合成：`SFX_SPECS` + `SFX_BASE_GAIN`）
> - `src/platform/wechat/wechat-audio.ts`（`SFX_CDN={}` + `streamFrom` seam）
> - `src/game/main.ts`（解锁接线 L59-70）、`src/game/scenes/game-scene.ts`（emit 站点）
> - `src/config/audio-config.json`（`{master:1,sfx:1,music:0,unlockOnInteraction:true}`）

---

## 0. 一句话结论（供主理人速览）

1. **事件覆盖已基本闭合**：S05-4 文档标记的 D1（跳跃）、D3（石炮）、D4（种子蜕变）**在代码中已落地**（`game-scene.ts` 已 emit `ON_JUMP`/`ON_PROJECTILE_SPAWN`/`ON_SEED_METAMORPHOSIS`），文档的 ⚠ GAP 标记已过时，需刷新。当前 **17/18 SFX 有真实触发源**，唯一 orphan 是 `sfx:double_jump`（D5，无二段跳玩法，低优先）。
2. **混音有 2 个真实风险点**（均归 engineering-lead 修，我只给规格）：① 同帧 `stomp+noise+enemy_death` 叠加峰值 ≈1.05 轻微超 1.0（无 MasterBus 限幅）；② 噪声瞬态无 attack 斜坡 → 起始 pop。另建议给明亮方波/锯齿 SFX 加 lowpass 去刺耳。
3. **微信端音频当前全程静默**（空 `SFX_CDN`），属已知限制；`streamFrom` 落地与 D9 素材就位后才能出声。**G3 ⑦ 真机"音频可用"目前是静默误判通过**，必须资产就位后复验。
4. **节拍化音乐（ON_BEAT）超出本打磨范围**（`beat.enabled:false`，仅留接口），本文不覆盖。

---

## 1. 18 SFX 混音打磨建议

### 1.1 频率占位与互掩（masking）分析

程序化合成无素材，但**频谱占位决定混音平衡**。按当前参数落点：

| 频段 | 占用 SFX | 拥挤度 | 风险 |
|---|---|---|---|
| 低频 <200Hz | `land`(150)、`stomp`尾(180)、`death`(120)、`game_over`尾(220) | 稀疏 | 安全 |
| 低中 200–500Hz | `enemy_death`、`hurt`(160–400)、`jump`(320–540) | 中 | 安全 |
| 中 400–900Hz | `respawn`、`restart`、`double_jump`、`projectile_fire`、`seed_metamorph`、`level_clear`、`coin`(低)、`checkpoint`、`pause`、`resume` | **密集** | 多音同发时互相压 |
| 高 900–2000Hz | `coin`(988–1319)、`seed_collect`(1047–1568)、`seed_metamorph`2 次(880–1760)、`checkpoint`(784) | 中高 | 快速采集 spam 时互掩 |
| 极高频 >2000Hz | `stomp`/`hurt`/`pause`/`resume`/`projectile_fire` 的方波/锯齿高次谐波 | — | **刺耳源**（见 1.3） |

> 关键约束：当前 `web-audio.ts` 合成链路为 `osc → gain → ctx.destination`，**没有任何 BiquadFilter / DynamicsCompressor 节点**。所以① 方波/锯齿的高次谐波全频谱直出 → 刺耳风险；② 多音叠加无人看管 → 削波风险（见 1.4）。

### 1.2 分类目标响度与参考（建议基准）

`effectiveGain = master(1) * sfx(1) * SFX_BASE_GAIN[name]`；下列"目标 peak"为 **baseGain 建议值**（相对 0–1，对应听感大致 −12 ~ −6 dBFS）。

| 类别 | SFX | 设计意图 | 当前 baseGain | 目标 peak | 参考/判定 |
|---|---|---|---|---|---|
| 移动 | `sfx:jump` | 轻快上滑 whoop | 0.50 | **0.45–0.50** | 维持；三角波天然柔和 |
| 移动 | `sfx:land` | 柔和噗 + 瞬态 | 0.35(+noise .30) | **0.35**(noise .25) | 维持，修 noise attack（E2） |
| 移动 | `sfx:double_jump` | 跳跃明亮回声 | 0.45 | **0.45**（休眠，待 D5） | 无触发源，先保规格 |
| 采集 | `sfx:coin` | 经典双音上行 B5→E6 | 0.45 | **0.42–0.45** | 纯正弦无谐波，安全；防 spam（E4） |
| 采集 | `sfx:seed_collect` | 闪亮叮 C6→G6 | 0.45 | **0.42–0.45** | 高频但纯正弦；**高频段最易 spam**（E4） |
| 采集 | `sfx:checkpoint` | 温和铃 G5 | 0.35 | **0.35** | 维持；单音微光 |
| 蜕变 | `sfx:seed_metamorph` | 温暖上行绽放 | 0.45(+2次 .40) | **0.45** | 维持；2 次泛音柔，安全 |
| 受伤 | `sfx:hurt` | 下行"哎"锯齿 | 0.50 | **0.40–0.45** | **降 + lowpass**（1.3/E3） |
| 受伤 | `sfx:death` | 低沉下行 | 0.40 | **0.40** | 维持 |
| 受伤 | `sfx:game_over` | 惆怅下行短句 | 0.40 | **0.40** | 维持；不 harsh |
| 敌人 | `sfx:stomp` | 方波下滑"啵" | 0.50(+noise .40) | **0.45**(noise .25) | 改三角体 + lowpass（E3）；降 noise 削波（E1） |
| 敌人 | `sfx:enemy_death` | 轻噗 | 0.20 | **0.20** | 维持（与 stomp 错开已对） |
| 敌人 | `sfx:projectile_fire` | 短啾 | 0.25 | **0.25** | 维持；可选 lowpass |
| UI | `sfx:pause` | 中性轻咔 | 0.30 | **0.30** | 短，安全；可选 lowpass |
| UI | `sfx:resume` | 略上行 | 0.30 | **0.30** | 同上 |
| UI | `sfx:restart` | 轻快上扫 | 0.40 | **0.40** | 维持；比 resume 亮，区分 OK |
| 通关 | `sfx:level_clear` | 凯旋上行琶音 | 0.50 | **0.50** | 4 音序错峰，无叠加，安全 |
| 通关 | `sfx:respawn` | 柔和上行复活 | 0.40 | **0.40** | 维持 |

### 1.3 刺耳高频（harsh high-frequency）对策

方波/锯齿SFX 含全频谱高次谐波，是最可能的刺耳源：

- `sfx:stomp`（square 600→180 @0.50 + noise .40）：方波奇次谐波丰富（1800/3000/4200Hz…），强度高时刺耳。**建议**：主体改 **triangle** 600→180（保留"啵"音高与瞬态性格），噪声瞬态保留做"咔"；或保留 square 但加 **lowpass ~3kHz**。
- `sfx:hurt`（sawtooth 400→160 @0.50）：锯齿=最亮波形，@0.50 且宽带 → 最刺耳候选。**建议**：降 baseGain 至 0.40–0.45 + 加 **lowpass ~2.5kHz**，保留"哎"反馈但不割耳。伤害音可略粗糙，但受控。
- `sfx:pause`/`sfx:resume`（square 660/880 @0.30，短）：整体可接受；为统一质感建议也过 lowpass（或保持，优先级低）。
- `sfx:projectile_fire`（square/saw 700→300 @0.25，安静）：影响小，可选 lowpass。

**规格（给 engineering-lead，E3）**：在 `web-audio.ts` 合成链 `osc → gain` 之间按 SFX 是否"明亮"插入可选 `BiquadFilterNode{type:'lowpass', frequency: 2500–3500}`。明亮集合 = `{stomp, hurt, pause, resume, projectile_fire}`；其余（正弦/三角主体）不加。

### 1.4 削波 / 同帧叠加风险（最高优先级）

**实测峰值**：触发 `ON_STOMP` 时 `sfx:stomp`(tone .50 + noise .40) 与 `sfx:enemy_death`(.20) **同帧**发出。在 t≈5–20ms 重叠窗口：tone≈.50 + noise≈.35 + enemy_death≈.20 ≈ **1.05 > 1.0** → `ctx.destination`（默认增益 1.0）**硬削波（轻微失真）**。设计契约 §5 验收项 5 声称"峰值 ≤1.0"与实测不符，需修正。

**对策（给 engineering-lead）**：
- **E1（P1，必做）**：在 `web-audio.ts` 加 **MasterBus `DynamicsCompressorNode`**（`osc/gain → compressor → ctx.destination`），参数 `threshold:-6dB, ratio:6–8, attack:0.003, release:0.12, knee:6`。一次性兜住所有同帧/多音叠加峰值，消除削波。这是单点最高收益修复。
- **E1b（P2）**：将 `sfx:stomp` 的 noise gain 由 0.40 降到 **0.25**（主体 tone 维持 0.45–0.50），即使不加压缩也把 stomp 帧峰值压到 ≈0.92 安全区；同时让瞬态更"噗"而非"啪"。

### 1.5 淡入淡出 / attack 修复

- **音色主体**（tone）：当前用 `setValueAtTime(EPS) → expRamp(peak, attack) → hold → expRamp(EPS)`，**attack 2–10ms、release 平滑**，无 click。✅ 维持。
- **噪声瞬态（land/stomp）**（`web-audio.ts` L254-259）：当前 `ng.gain.setValueAtTime(np, ns)` **直接从 0 跳到 np（无 attack 斜坡）** → 瞬态起音 pop/click。
  - **E2（P1）**：改为与 tone 一致：`setValueAtTime(EPS, ns) → expRamp(np, ns+0.002) → expRamp(EPS, ne)`。瞬态仍快（2ms 起音）但无爆音。仅改 `web-audio.ts` 噪声包络，不动音色。

### 1.6 快速重复 SFX 的 spam / 互掩

- `sfx:seed_collect`(1568Hz)、`sfx:coin`(1319Hz) 高频且**可能极快连发**（一帧采多颗种子/币）。18 个 SFX 中这俩落在最挤的高频段，连发会互相压且叠响。
- **E4（P2）**：对高频采集类（`seed_collect`/`coin`）加 **per-SFX 最小间隔节流 40–60ms**，或全局"亮音预算"（同时刻 ≤ N 个高频采集音）。`MAX_VOICES=8` 已限制总数，但 8 个 seed_collect 同帧仍会叠成一片亮噪。建议在 `WebAudio.play` 或对特定 name 加 min-interval。

---

## 2. 事件覆盖 gaps 复查（逐条核对 event-bus ↔ audio-bus）

### 2.1 全事件矩阵（28 个 `ON_*`，来自 `event-bus.ts`）

图例：✅=真实游戏循环已 emit；⚠=常量已定义但当前无 emit 源；—=不映射（设计意图）。

| # | 事件 | audio-bus 映射 | 真实 emit？ | 判定 |
|---|---|---|---|---|
| 1 | `ON_JUMP` | `sfx:jump` | ✅ game-scene:534 | **已闭合**（S05-4 标 GAP 已过时） |
| 2 | `ON_DOUBLE_JUMP` | `sfx:double_jump` | ⚠ 无 emit | **孤儿 SFX（D5）**；无二段跳玩法，低优先 |
| 3 | `ON_LAND` | `sfx:land` | ✅ game-scene:537 | ✅ |
| 4 | `ON_STOMP` | `sfx:stomp` | ✅ damage-resolution | ✅ |
| 5 | `ON_ENEMY_DEATH` | `sfx:enemy_death` | ✅ | ✅ |
| 6 | `ON_ENEMY_HIT_PLAYER` | （不映射） | ⚠ 无 emit | 由 `ON_HURT` 覆盖，合理不单列 |
| 7 | `ON_PROJECTILE_SPAWN` | `sfx:projectile_fire` | ✅ game-scene:549 | **已闭合**（S05-4 标 GAP 已过时） |
| 8 | `ON_HURT` | `sfx:hurt` | ✅ | ✅ |
| 9 | `ON_DEATH` | `sfx:death` | ✅ | ✅ |
| 10 | `ON_RESPAWN` | `sfx:respawn` | ✅ | ✅ |
| 11 | `ON_GAME_OVER` | `sfx:game_over` | ✅ | ✅ |
| 12 | `ON_COIN` | `sfx:coin` | ✅ | ✅ |
| 13 | `ON_SEED_COLLECTED` | `sfx:seed_collect` | ✅ | ✅ |
| 14 | `ON_SEED_GROWTH` | （不映射） | ✅ game-scene:319 | **设计意图（D4）**：每采细反馈留 UI，不发声，避免每采双音 |
| 15 | `ON_SEED_METAMORPHOSIS` | `sfx:seed_metamorph` | ✅ game-scene:321 | **已闭合**（跨阈值 emit） |
| 16 | `ON_SCORE` | （不映射） | ⚠ 无 emit | 遗留常量，建议废弃（被 `ON_SCORE_CHANGED` 取代） |
| 17 | `ON_SCORE_CHANGED` | （不映射） | ✅ game-scene:664 | **设计意图（D7）**：高频不发声，避免 spam |
| 18 | `ON_LIFE_LOST` | `sfx:hurt`（复用） | ⚠ 无 emit | 休眠映射，事件源到位即响，安全 |
| 19 | `ON_LEVEL_COMPLETE` | `sfx:level_clear` | ✅ | ✅ |
| 20 | `ON_CHECKPOINT` | `sfx:checkpoint` | ✅ | ✅ |
| 21 | `ON_PAUSE` | `sfx:pause` | ✅ | ✅ |
| 22 | `ON_RESUME` | `sfx:resume` | ✅ | ✅ |
| 23 | `ON_RESTART` | `sfx:restart` | ✅ | ✅ |
| 24 | `ON_BEAT` | （不映射） | ⚠ 仅 headless | 节拍同步音乐留 Could（`beat.enabled:false`） |
| 25 | `ON_START` | （不映射） | ⚠ 无 emit | 无首帧音效需求，合理 |
| 26 | `ON_FORM_CHANGED` | `sfx:seed_metamorph`（复用） | ⚠ 无 emit | 休眠映射（元气果系统设计），安全 |
| 27 | `ON_LEVEL_COMPLETE_UI` | `sfx:level_clear`（复用） | ⚠ 无 emit | 休眠映射，安全 |
| 28 | `ON_NEXT_LEVEL` | （不映射） | ✅ result-screen→game-scene | UI 转场事件，无 SFX 需求，合理 |

### 2.2 gaps 判定（结论）

- **「有事件无音效」且非设计意图**：**0 个**。`ON_SCORE_CHANGED`、`ON_SEED_GROWTH` 不映射是明确设计决策（D7/D4），`ON_ENEMY_HIT_PLAYER`/`ON_LIFE_LOST`/`ON_START`/`ON_BEAT` 由 HURT/复用语义/无首帧需求/节拍 deferred 覆盖——**均非缺口**。
- **「有音效无触发」（孤儿 SFX）**：**1 个** —— `sfx:double_jump`（对应 `ON_DOUBLE_JUMP` 从未 emit，D5）。优先级低（MVP 无二段跳玩法）。**建议**：保持合成与映射预留，等二段跳玩法明确后由 engineering-lead 在 `CharacterController`/`game-scene` emit `ON_DOUBLE_JUMP` 即自动发声，无需改 audio-bus。
- **休眠映射（事件未 emit，但复用既有 SFX，无孤儿）**：`ON_LIFE_LOST→hurt`、`ON_LEVEL_COMPLETE_UI→level_clear`、`ON_FORM_CHANGED→seed_metamorph`。**安全，不建议改动**——事件源一旦到位即自动出声。
- **对 S05-4 文档的纠错**：其 §2 / §6 将 D1(`ON_JUMP`)、D3(`ON_PROJECTILE_SPAWN`) 标 ⚠ GAP、D4 标"event-bus 常量待补入"——**代码已落地全部三项**（`event-bus.ts` 已有常量，`game-scene.ts` 已 emit）。文档 gap 表已过时，需刷新（见 §5 E8）。

### 2.3 audio-bus 映射与文档不一致

- `audio-bus.ts` `EVENT_TO_SFX` 实际 **21 条**；S05-4 §3.3 仅列 **17 条**。
- 多出的 4 条（`ON_DOUBLE_JUMP`、`ON_LIFE_LOST`、`ON_LEVEL_COMPLETE_UI`、`ON_FORM_CHANGED`）为 S05-4 实现期合理扩展（多为复用既有 SFX 的休眠映射）。**判定：合规，建议把 §3.3 补全为 21 条**（E8）。

---

## 3. 微信端 `streamFrom` 落地建议

### 3.1 现状（seam 已留，资产未就位）

- `wechat-audio.ts`：`SFX_CDN = {}`（空）、`play(name)` 在 `!unlocked` 或 `!url` 时静默 no-op、`streamFrom(url)` 为 `TODO(S05-4)` 空钩子。
- 结果：**微信端全程静默**（known limitation，D9 待主理人提供 CDN base URL）。Web 端因程序化合成，已可出声。

### 3.2 落地规格（给 engineering-lead，E5）

1. **`SFX_CDN` 外置**：抽 `assets/audio/cdn-map.json`（结构 `Record<SfxName,string>`），`wechat-audio.ts` 运行期读取；改素材不碰代码（对齐 S05-4 §3.2）。命名约定建议 `https://<cdn>/sfx/<name>.mp3`。
2. **`streamFrom(url)`** 实现：
   - 守卫：`!unlocked || !url || !wx` → 静默返回。
   - 池取/建 `InnerAudioContext`（`acquire`，见 3.4 池大小）；设 `.src=url`、`.volume = audioConfig.master * audioConfig.sfx`、`.play()`。
   - 生命周期：`.onEnded`/`.onStop` 回收进池；`.onError` **仅 log + 回收，绝不抛**（真机弱网卡顿/404 不应崩）。
   - `play(name)` 内部改为 `this.streamFrom(SFX_CDN[name])`，复用同一钩子。
3. **音量**：微信端 `InnerAudioContext.volume` 仅 0–1 单总线系数 → **无法运行时逐 SFX 调增益**（WebAudio 才做得到）。故微信端"逐 SFX 混音"必须在**素材制作阶段**按 §1.2 目标响度表渲染（见 3.5）。微信侧只做 `master*sfx` 总线调节。

### 3.3 远程 / 分包加载策略

- **主包限制**：微信主包 ≤2MB，**音频素材不得进主包**（control-list §2）。
- **首选 CDN 流式**（设计已假设）：`SFX_CDN` 远程 URL，首播略延迟可接受，零包体负担。
- **分包（subpackage）备选**：若必须本地，放分包目录（非 main），走分包预下载；但 SFX 量小、流式更简单，优先 CDN。
- **预热（warmup）**：设计原话"无预加载"。**建议微调**：首次 unlock 后，静默预热 3–5 个最高频 SFX（`coin`/`seed_collect`/`jump`/`land`/`stomp`）以削首播延迟；其余保持懒加载。可选，非必须。

### 3.4 池大小与 iOS 并发

- 当前 `MAX_POOL = 6`。**iOS 旧版对同时播放的 `InnerAudioContext` 实例数有硬上限（约 4–5）**。
- **建议**：按平台调池——iOS 设 **4**，其余设 6；或加"活跃实例计数"guard，超出丢弃最旧。归 engineering-lead 实现（E5）。

### 3.5 真机注意事项（G3 ⑦ / G9 音频侧）

- **iOS 首次手势解锁**：`WechatAudio.unlock()` 仅置 `unlocked=true`，**不创建 AudioContext**（微信不用 WebAudio）。真正的"出声"依赖 `InnerAudioContext.play()` 在**用户手势链内首次调用**来解锁 iOS 媒体会话。当前 SFX_CDN 空 → 全 no-op，未真正解锁。
  - **建议（D9 资产就位后）**：首次用户手势（tap）时在微信侧**静默预热播放一次**常用 SFX（或 1 帧静音 buffer）以解锁 iOS 媒体会话，确保后续 gameplay SFX 能出声。归 engineering-lead。
- **后台暂停 / 恢复（onHide/onShow）**：`InnerAudioContext` 在 `onHide`（切后台/锁屏）会暂停；`onShow` **不会自动续播已 start 的实例**。本项目 SFX 均 <1s（最长 `game_over` 0.6s），基本播放完即止，影响极小。
  - **建议**：`onHide` 时无需特殊操作（短音自行结束）；若未来接 BGM（`playMusic`），需 `onShow` 重新 `play` 并对齐 `ON_BEAT`。当前阶段不阻塞。
- **G3 ⑦ 回归陷阱（重要）**：§4 ⑦ 微信步骤"首次 touchstart → 其后 SFX 无红错"——**当前因 SFX_CDN 空，play 全程 no-op，必 PASS 但实为静默**。这是**假通过**。
  - **建议**：D9 资产就位、`streamFrom` 落地后，**必须再用真实 CDN URL 重跑 §4 ⑦**（含踩敌/吃币/跳/通关真出声 + 无红错），否则 G3 音频门是空壳。标为回归阻断项（E7）。
- **G9 真机复验**：当前"真机无红错"因 audio no-op 而成立；D9 后须真机确认 InnerAudioContext 实际出声、并发不崩、音量合理。
- **微信勿误用 WebAudio**：确认 `createPlatform(env==='wechat')` 注入 `WechatAudio` 而非 `WebAudio`（微信无 `AudioContext`；即便误用，`web-audio.unlock()` 有 try/catch 吞错，静默安全）。建议 engineering-lead 核对 platform 工厂分支（E5 顺带核对）。

---

## 4. 打磨结论 + 待工程落地项清单

### 4.1 打磨结论

- 事件覆盖**健康**：17/18 SFX 有真实触发，唯一孤儿 `sfx:double_jump`（D5，低优先，保持预留）。
- S05-4 文档的 D1/D3/D4 GAP 标记**已过时**（代码已闭合），需文档刷新。
- 混音**有 2 个真实音频质量风险**（无 MasterBus 限幅致同帧叠加削波 ≈1.05；噪声瞬态无 attack 致 pop）+ 1 个质感建议（方波/锯齿加 lowpass 去刺耳）+ 1 个 spam 建议（高频采集节流）。
- 微信端音频**功能性静默**，落地依赖 D9 素材 + `streamFrom` 实现；G3 ⑦ 当前为静默假通过。

### 4.2 待工程落地项（归 engineering-lead；我只出规格与判定）

| ID | 优先级 | 项 | 规格要点 | 归属 |
|---|---|---|---|---|
| E1 | **P1** | 加 MasterBus `DynamicsCompressorNode` | `osc/gain → compressor → destination`；`threshold:-6dB,ratio:6–8,attack:0.003,release:0.12,knee:6`；消同帧叠加削波 | engineering-lead |
| E1b | P2 | `sfx:stomp` noise gain 0.40→0.25 | 即使不加压缩也把 stomp 帧峰值压到 <0.95 | engineering-lead |
| E2 | **P1** | 噪声瞬态补 attack 斜坡 | `web-audio.ts` land/stomp noise：`setValueAtTime(EPS)→expRamp(np,ns+0.002)→expRamp(EPS,ne)`；消起音 pop | engineering-lead |
| E3 | P2 | 明亮 SFX 加 lowpass | 在 `stomp/hurt/pause/resume/projectile_fire` 的 `osc→gain` 间插 `BiquadFilter lowpass 2500–3500Hz`；或 stomp/hurt 主体改 triangle | engineering-lead |
| E4 | P2 | 高频采集 SFX 节流 | `seed_collect`/`coin` 加 per-SFX min-interval 40–60ms 或亮音并发预算；防同帧多颗叠加过响/互掩 | engineering-lead |
| E5 | P3 | 微信 `streamFrom` 落地 + CDN 外置 | `assets/audio/cdn-map.json`；`streamFrom` 实现（池/volume/onError guard/iOS 池=4）；核对 platform 工厂微信分支 | engineering-lead |
| E6 | P3 | 微信端混音前移素材制作 | 按 §1.2 目标响度表在 mp3 渲染阶段固定每 SFX 响度；微信侧仅 master*sfx 总线（无逐 SFX 运行时增益） | 美术/音频资产 + engineering-lead |
| E7 | P3（阻断） | G3 ⑦ 复验 | D9 资产就位后，用真实 CDN URL 重跑 §4 ⑦（真出声 + 无红错），消除静默假通过 | QA + engineering-lead |
| E8 | P3（doc） | 刷新 S05-4 文档 | `audio-design.md` §3.3 补为 21 条映射；标注 D1/D3/D4 **CLOSED**；`audio-event-map.md` gap 表同步刷新 | audio-director（我） |
| E9 | P4（可选） | D5 二段跳事件 | 若 MVP 决定加二段跳，由 engineering-lead 在角色/场景 emit `ON_DOUBLE_JUMP`（audio-bus 已就绪）；否则保持休眠 | engineering-lead（待主理人拍板） |
| E10 | deferred | 节拍化音乐 / ON_BEAT 音频 | `beat.enabled:false`，仅留接口；本打磨不覆盖，未来接 BGM 时再定（关联 D2/BGM 接口扩展） | — |

> 说明：E1/E2 为**音质硬伤修复**（削波 + pop），建议 P1 随本打磨一并落地；E3/E4 为质感打磨；E5–E7 为微信真机出声前置；E8 由我直接更新文档（不写 src/）。

---

## 5. 与 S05-4 文档的差异 / 待更新项（E8 明细）

1. `audio-design.md` §2 表：D1/D3 行"⚠ GAP"→ 改"✅（game-scene 已 emit）"；D4 行删"event-bus 常量待补入"——常量已在 `event-bus.ts`。
2. `audio-design.md` §3.3 `EVENT_TO_SFX`：由 17 条补为 **21 条**，新增 `ON_DOUBLE_JUMP→sfx:double_jump`、`ON_LIFE_LOST→sfx:hurt`、`ON_LEVEL_COMPLETE_UI→sfx:level_clear`、`ON_FORM_CHANGED→sfx:seed_metamorph`（与 `audio-bus.ts` 对齐）。
3. `audio-design.md` §5 验收项 5："同帧双音峰值 ≤1.0"→ 改为"峰值 ≤1.0（需 E1 MasterBus 限幅或 E1b noise 降增益兜底）"，并补 E2（噪声 attack）验收。
4. `audio-event-map.md` §B/C：D1(`ON_JUMP`)/D3(`ON_PROJECTILE_SPAWN`) 由"⚠ 从未 emit"改为"✅ game-scene 已 emit"；D4 标 CLOSED；补 `ON_DOUBLE_JUMP` 为唯一剩余真实缺口（D5）。
5. §6 决策点：D1/D3/D4 标记 **CLOSED**；D5 维持（低优先）。

---

## 6. 附录：本打磨不覆盖项（明确边界）

- **BGM**：`music:0`，不播；未来接入路径见 S05-4 §1，本打磨不动。
- **节拍化音频（ON_BEAT）**：`beat.enabled:false`，仅留接口；不在音频打磨范围。
- **VO / 配音**：本项目无角色配音需求（程序化音效即全部音频），无 VO 方向。
- **代码改动**：全部 E1–E7 归 engineering-lead 实现；本文仅规格/判定/清单，未写 `src/`、未 git commit。

---

> 产出者：阮和鸣（audio-director）｜复核：待主理人（游承峰）+ engineering-lead（程基岩）落地 E1–E7 后回验。
