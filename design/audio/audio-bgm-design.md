# S05-4-BGM 程序化 BGM 设计契约 / BGM Procedural Design Contract

> 负责人：阮和鸣（audio-director）｜阶段：Phase 5（制作）｜Story：S05-4-BGM
> 性质：**设计契约**（只定义音乐设计 + 合成参数 + 调度策略，不含引擎/平台代码）
> 上游：audio-design.md（§0 铁律 / §1 音乐方向 / §3.1 Web 合成基元）、art-bible.md §1/§3、game-scene / title-scene 触发点
> 依赖落地：engineering-lead（程基岩）按本契约在 `web-audio.ts` / `wechat-audio.ts` 与 `AudioPort` 落地双端 WebAudio 程序化 BGM
> 状态：**待主理人审批**（未 git commit）

---

## 0. 依赖与定位

- 本契约是 `audio-design.md` 的**增量补篇**：推翻原 §0「MVP 不播 BGM」默认，实现双 BGM（`music:menu` / `music:stage`），其余 §0 铁律（core 零平台 / 薄 audio-bus / 零素材 / IP 红线）**全部继承并延续**。
- BGM 与 SFX **同构**：复用 `web-audio.ts` 的 `Tone{type,f0,f1,t0,dur,attack,release,gain}` 合成基元 —— BGM 就是「按拍预排的 Tone 序列」，不引入任何 mp3 / 外部音频 / 采样。
- 微信端**本期即走 WebAudio 程序化合成**（经 `wx.createWebAudioContext()` 或全局 `AudioContext`），不再依赖 CDN 素材，故原 D9 素材阻塞已解除。
- 所有音符以「拍」为单位给出（**1 拍 = 1 个八分音符 = 0.25s**），工程按 `t0_sec = startBeat × 0.25`、`dur_sec = durBeats × 0.25` 在 `AudioContext` 上调度。

---

## 1. 范围与铁律

### §1.1 双 BGM 范围
| name | 接入位置 | 本期落地 |
|---|---|---|
| `music:menu` | `title-scene.ts` `create()`（L2 美化，进入标题屏即播） | ✅ 落地 |
| `music:stage` | `game-scene.ts` `create()`（关卡通用 grass 风，进关即播） | ✅ 落地 |
| `music:stage_cave` | 洞穴主题预留接口 | ⛔ 本期不落地（仅留 name 占位） |
| `music:stage_sky` | 天空主题预留接口 | ⛔ 本期不落地（仅留 name 占位） |

> 预留变体不定义音符，仅要求 `playMusic('music:stage_cave')` 在未来可独立挂载而**不破坏**现有 menu/stage 调度；本期调用未定义 name 时 `playMusic` 行为见 §2.1（未知 name → no-op）。

### §1.2 铁律
- **零素材**：BGM 全部 `OscillatorNode + GainNode` 程序化合成（瞬态 perc 可选白噪 `BufferSource`，仍零素材），不引入 mp3 / 外部音频 / 任天堂采样。
- **双端一致**：Web 与微信均走 WebAudio 合成；微信端经 `wx.createWebAudioContext()` 或全局 `AudioContext`，与 `web-audio.ts` 同一套调度逻辑（可由 engineering-lead 抽公共调度器）。
- **IP 红线**：旋律 / 音色禁用任天堂符号与采样，全部原创。两段旋律均为 **C 大调五声（C-D-E-G-A）原创动机**，不与任何 SFX 旋律撞曲（见 §3.5 碰撞核对）。
- **core 零平台**：BGM 播放一律经 `platform.audio.playMusic/stopMusic`；game 层场景直接调用，**不进事件总线**、不 touch `wx.` / `window.AudioContext`（扫描同 §5）。
- **不臆造功能**：仅实现 menu + stage 两段循环 + 可选 intro；战斗 / 凯旋叠层仅文档标注（§3.4），本期不落地。

---

## 2. 接口扩展规格

### §2.1 `AudioPort` 扩展（改 `src/platform/platform.ts`）
在既有 `play(name)` / `unlock()` 基础上**扩展同端口**（不另立 `BgmPort`，D2 已拍板）：

```ts
// 设计伪签名（落地由 engineering-lead 实现，非本文件代码）
export interface AudioPort {
  play(name: string): void;
  unlock(): void;
  /** 启动指定 BGM 循环；同 name 重复调用 = idempotent（不叠加第二份循环）；换 name = 先停后起。unlock 前 no-op。 */
  playMusic(name: string): void;
  /** 停止当前 BGM（取消尚未播放的预排 oscillator）。unlock 前 no-op。 */
  stopMusic(): void;
}
```

行为契约（供 mock 测试断言，见 §5）：
1. `unlock()` 未完成（`ctx` 为 null）→ `playMusic` / `stopMusic` 均 **no-op**（静默，不抛错），与既有 `play` 一致。
2. `playMusic(name)`：
   - 若 `name` 为当前正在播放的 BGM → **idempotent**（不重启、不叠加第二份循环）。
   - 若 `name` 与当前不同 → 先 `stopMusic()` 当前，再启动新 BGM。
   - 若 `name` 不在已定义 BGM 表（`music:menu` / `music:stage`）→ **no-op**（未知 name 静默，不崩）。
3. `stopMusic()`：停止当前 BGM，取消所有已预排未触发 oscillator；无当前 BGM 时 no-op。
4. 幂等安全：重复 `playMusic(same)` 不叠加崩溃；`stopMusic` 后再次 `playMusic` 可重启。

### §2.2 `audio-config.json` 调整
当前 `{master:1, sfx:1, music:0, unlockOnInteraction:true}`。用户已要求「加上音乐」，建议：

```json
{ "master": 1, "sfx": 1, "music": 0.5, "unlockOnInteraction": true }
```

- `music` 由 `0` → `0.5`（默认开启、可由设置项调；`0` 时静音等效 MVP）。
- `master` 总闸、`sfx` 音效轨、`music` 音乐轨三者分轨相乘（沿用 §4 施加规则）。

### §2.3 BGM 增益施加
复用 `web-audio.ts` 现有限幅总线（MasterBus `DynamicsCompressor`，-6dB 阈值 / 8:1）。每个 BGM Tone 的有效增益：

```
effectiveGain = master × music × MUSIC_BASE_GAIN[name] × tone.gain
```

- `MUSIC_BASE_GAIN`（BGM 轨基准，类比 `SFX_BASE_GAIN`）：`menu ≈ 0.5`、`stage ≈ 0.5`（避免盖过 SFX）。
- `tone.gain` = 该音在**声部内**的相对增益（声部平衡已烘焙进各 Tone 的 `gain` 字段，见 §3 各声部表末列）。
- 示例（menu，master=1, music=0.5）：lead 有效峰值 ≈ `1 × 0.5 × 0.5 × 1.0 = 0.25`；bass ≈ `1 × 0.5 × 0.5 × 0.9 = 0.225`。多声部瞬时叠加由 MasterBus 限幅收口，BGM + SFX 总峰值 < 1.0（无削波，见 §5）。

---

## 3. BGM 音乐设计（核心交付）

### §3.0 通用合成参数与频率速查

**节拍基准**：120 BPM、4/4、八分网格（grid=8）。1 小节 = 4 拍（四分音符）= 8 拍（八分音符）= **2.0s**。1 拍（八分）= **0.25s**。

**调式 / 调性**：C 大调五声（C-D-E-G-A）暖色、明亮；和弦进行为自然大调七级内进行，旋律音均落在五声内（F 仅作属和弦 F 上的自然经过音，偶发）。

**声部合成档案（默认 Tone 字段，逐音可覆盖）**：

| 声部 | 默认 osc | attack (s) | release (s) | 声部内相对增益 `tone.gain` | 角色 |
|---|---|---|---|---|---|
| lead（木琴/铃） | triangle | 0.005 | 0.12 | 1.0 | 主旋律，明亮高音 |
| bass（拨弦/次中音） | triangle | 0.005 | 0.10 | 0.9 | 根音/五音走和弦 |
| pad（柔和垫） | sine | 0.08 | 0.30 | menu 0.3 / stage 0.2 | 长音和声，低增益 |
| perc（轻击，仅 stage） | square | 0.002 | 0.048 | 0.3 | 短 tick 律动 |

> 频率速查（等律，A4=440Hz）：C4=261.63 D4=293.66 E4=329.63 F4=349.23 G4=392.00 A4=440.00 B4=493.88 ／ C5=523.25 D5=587.33 E5=659.25 F5=698.46 G5=783.99 A5=880.00 C6=1046.50 ／ C3=130.81 D3=146.83 E3=164.81 F2=87.31 G2=98.00 G3=196.00 A2=110.00 A3=220.00 D4=293.66

**时间线字段说明**：下表每行 = 一个 `Tone`；`起始拍` 为**loop 内绝对八分位**（0…63，8 小节 × 8 拍）；`时长(拍)` 为该音占用八分数；`osc` / `相对增益` 见上表默认值（各表末两列即 Tone 的 `type` 与 `gain`）。intro 小节用独立 0/1 序号，在 loop 之前播放一次。

---

### §3.1 `music:menu`（标题屏）

**情绪**：温暖 / 轻快 / 明亮 major / 稀疏琶音（对齐 art-bible §1「午后斜阳」暖调）。
**结构**：可选 intro（2 小节渐入）+ loop（**8 小节**，16.0s，无缝循环）。
**和弦进行**（每小节 1 和弦）：`C | Am | F | G | C | Am | F | G`（温暖，五声兼容）。
**声部**：lead（三角木琴）+ bass（拨弦）+ pad（柔垫）；**无 perc**（菜单稀疏）。

#### §3.1.1 intro（可选，2 小节，loop 前播一次）
| 声部 | 音名 | Hz | 起始拍 | 时长(拍) | osc | 相对增益 |
|---|---|---|---|---|---|---|
| lead | G5 | 783.99 | 0 | 2 | triangle | 1.0 |
| lead | C6 | 1046.50 | 2 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 4 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 6 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 8 | 4 | triangle | 1.0 |
| lead | G4 | 392.00 | 12 | 4 | triangle | 1.0 |
| bass | C3 | 130.81 | 0 | 8 | triangle | 0.9 |
| bass | C3 | 130.81 | 8 | 8 | triangle | 0.9 |
| pad | G4 | 392.00 | 0 | 8 | sine | 0.3 |
| pad | G4 | 392.00 | 8 | 8 | sine | 0.3 |

#### §3.1.2 loop（8 小节，16.0s）—— lead（木琴）
| 声部 | 音名 | Hz | 起始拍 | 时长(拍) | osc | 相对增益 |
|---|---|---|---|---|---|---|
| lead | E5 | 659.25 | 0 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 2 | 2 | triangle | 1.0 |
| lead | A5 | 880.00 | 4 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 6 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 8 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 10 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 12 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 14 | 2 | triangle | 1.0 |
| lead | A4 | 440.00 | 16 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 18 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 20 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 22 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 24 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 26 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 28 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 30 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 32 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 34 | 2 | triangle | 1.0 |
| lead | A5 | 880.00 | 36 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 38 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 40 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 42 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 44 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 46 | 2 | triangle | 1.0 |
| lead | A4 | 440.00 | 48 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 50 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 52 | 2 | triangle | 1.0 |
| lead | F5 | 698.46 | 54 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 56 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 58 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 60 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 62 | 2 | triangle | 1.0 |

#### §3.1.3 loop —— bass（拨弦）/ pad（柔垫）
| 声部 | 音名 | Hz | 起始拍 | 时长(拍) | osc | 相对增益 |
|---|---|---|---|---|---|---|
| bass | C3 | 130.81 | 0 | 4 | triangle | 0.9 |
| bass | G3 | 196.00 | 4 | 4 | triangle | 0.9 |
| bass | A2 | 110.00 | 8 | 4 | triangle | 0.9 |
| bass | E3 | 164.81 | 12 | 4 | triangle | 0.9 |
| bass | F2 | 87.31 | 16 | 4 | triangle | 0.9 |
| bass | C3 | 130.81 | 20 | 4 | triangle | 0.9 |
| bass | G2 | 98.00 | 24 | 4 | triangle | 0.9 |
| bass | D3 | 146.83 | 28 | 4 | triangle | 0.9 |
| bass | C3 | 130.81 | 32 | 4 | triangle | 0.9 |
| bass | G3 | 196.00 | 36 | 4 | triangle | 0.9 |
| bass | A2 | 110.00 | 40 | 4 | triangle | 0.9 |
| bass | E3 | 164.81 | 44 | 4 | triangle | 0.9 |
| bass | F2 | 87.31 | 48 | 4 | triangle | 0.9 |
| bass | C3 | 130.81 | 52 | 4 | triangle | 0.9 |
| bass | G2 | 98.00 | 56 | 4 | triangle | 0.9 |
| bass | D3 | 146.83 | 60 | 4 | triangle | 0.9 |
| pad | G4 | 392.00 | 0 | 8 | sine | 0.3 |
| pad | A3 | 220.00 | 8 | 8 | sine | 0.3 |
| pad | F3 | 174.61 | 16 | 8 | sine | 0.3 |
| pad | G3 | 196.00 | 24 | 8 | sine | 0.3 |
| pad | G4 | 392.00 | 32 | 8 | sine | 0.3 |
| pad | A3 | 220.00 | 40 | 8 | sine | 0.3 |
| pad | F3 | 174.61 | 48 | 8 | sine | 0.3 |
| pad | G3 | 196.00 | 56 | 8 | sine | 0.3 |

---

### §3.2 `music:stage`（关卡 grass 通用）

**情绪**：轻快 / 冒险 / 童趣；明亮 major + 轻 perc 律动（对齐 art-bible §5.3 草原暖绿 + 天蓝）。
**结构**：可选 intro（2 小节）+ loop（**8 小节**，16.0s，无缝循环）。
**和弦进行**（每小节 1 和弦）：`C | G | Am | F | C | G | Am | F`（轻快上行感，五声兼容）。
**声部**：lead（三角木琴）+ bass（拨弦）+ pad（薄垫）+ perc（轻 tick，stage 专用）。

#### §3.2.1 intro（可选，2 小节）
| 声部 | 音名 | Hz | 起始拍 | 时长(拍) | osc | 相对增益 |
|---|---|---|---|---|---|---|
| lead | C5 | 523.25 | 0 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 2 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 4 | 2 | triangle | 1.0 |
| lead | C6 | 1046.50 | 6 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 8 | 4 | triangle | 1.0 |
| lead | E5 | 659.25 | 12 | 4 | triangle | 1.0 |
| bass | C3 | 130.81 | 0 | 8 | triangle | 0.9 |
| bass | C3 | 130.81 | 8 | 8 | triangle | 0.9 |
| pad | G4 | 392.00 | 0 | 8 | sine | 0.2 |
| pad | G4 | 392.00 | 8 | 8 | sine | 0.2 |

#### §3.2.2 loop（8 小节，16.0s）—— lead（木琴）
| 声部 | 音名 | Hz | 起始拍 | 时长(拍) | osc | 相对增益 |
|---|---|---|---|---|---|---|
| lead | C5 | 523.25 | 0 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 2 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 4 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 6 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 8 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 10 | 2 | triangle | 1.0 |
| lead | A5 | 880.00 | 12 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 14 | 2 | triangle | 1.0 |
| lead | A4 | 440.00 | 16 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 18 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 20 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 22 | 2 | triangle | 1.0 |
| lead | F5 | 698.46 | 24 | 2 | triangle | 1.0 |
| lead | A5 | 880.00 | 26 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 28 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 30 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 32 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 34 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 36 | 2 | triangle | 1.0 |
| lead | A5 | 880.00 | 38 | 2 | triangle | 1.0 |
| lead | G5 | 783.99 | 40 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 42 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 44 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 46 | 2 | triangle | 1.0 |
| lead | A4 | 440.00 | 48 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 50 | 2 | triangle | 1.0 |
| lead | E5 | 659.25 | 52 | 2 | triangle | 1.0 |
| lead | A5 | 880.00 | 54 | 2 | triangle | 1.0 |
| lead | F5 | 698.46 | 56 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 58 | 2 | triangle | 1.0 |
| lead | C5 | 523.25 | 60 | 2 | triangle | 1.0 |
| lead | D5 | 587.33 | 62 | 2 | triangle | 1.0 |

#### §3.2.3 loop —— bass / pad / perc
| 声部 | 音名 | Hz | 起始拍 | 时长(拍) | osc | 相对增益 |
|---|---|---|---|---|---|---|
| bass | C3 | 130.81 | 0 | 4 | triangle | 0.9 |
| bass | G3 | 196.00 | 4 | 4 | triangle | 0.9 |
| bass | G2 | 98.00 | 8 | 4 | triangle | 0.9 |
| bass | D3 | 146.83 | 12 | 4 | triangle | 0.9 |
| bass | A2 | 110.00 | 16 | 4 | triangle | 0.9 |
| bass | E3 | 164.81 | 20 | 4 | triangle | 0.9 |
| bass | F2 | 87.31 | 24 | 4 | triangle | 0.9 |
| bass | C3 | 130.81 | 28 | 4 | triangle | 0.9 |
| bass | C3 | 130.81 | 32 | 4 | triangle | 0.9 |
| bass | G3 | 196.00 | 36 | 4 | triangle | 0.9 |
| bass | G2 | 98.00 | 40 | 4 | triangle | 0.9 |
| bass | D3 | 146.83 | 44 | 4 | triangle | 0.9 |
| bass | A2 | 110.00 | 48 | 4 | triangle | 0.9 |
| bass | E3 | 164.81 | 52 | 4 | triangle | 0.9 |
| bass | F2 | 87.31 | 56 | 4 | triangle | 0.9 |
| bass | C3 | 130.81 | 60 | 4 | triangle | 0.9 |
| pad | G3 | 196.00 | 0 | 8 | sine | 0.2 |
| pad | D4 | 293.66 | 8 | 8 | sine | 0.2 |
| pad | A3 | 220.00 | 16 | 8 | sine | 0.2 |
| pad | C4 | 261.63 | 24 | 8 | sine | 0.2 |
| pad | G3 | 196.00 | 32 | 8 | sine | 0.2 |
| pad | D4 | 293.66 | 40 | 8 | sine | 0.2 |
| pad | A3 | 220.00 | 48 | 8 | sine | 0.2 |
| pad | C4 | 261.63 | 56 | 8 | sine | 0.2 |
| perc | (tick) | 1000.00 | 0 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 4 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 8 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 12 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 16 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 20 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 24 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 28 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 32 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 36 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 40 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 44 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 48 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 52 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 56 | 0.2 | square | 0.3 |
| perc | (tick) | 1000.00 | 60 | 0.2 | square | 0.3 |

> perc 为短 tick（方波 1000Hz，`f0=f1`），`durBeats=0.2` ≈ 0.05s，低增益（0.3），营造轻跳跃律动；如工程希望更「沙锤」质感，可改为 `web-audio.ts` 既有白噪瞬态（同 SFX 的 `noise` 字段，仍零素材），`noise:{t0,dur:0.04,gain:0.2}`，本契约两种皆可，由 engineering-lead 二选一。

---

### §3.3 落地数据结构（伪结构，对齐 `SFX_SPECS`）
供 engineering-lead 在 `web-audio.ts` 内建同构表（**伪代码，非本文件产出代码**）：

```
MUSIC_BASE_GAIN = { 'music:menu': 0.5, 'music:stage': 0.5 }

MUSIC_SPECS = {
  'music:menu':  { loopBars: 8, introBars: 2, tones: [ ...§3.1 全部 Tone... ] },
  'music:stage': { loopBars: 8, introBars: 2, tones: [ ...§3.2 全部 Tone... ] },
}
// 每个 Tone 字段：{ type, f0, f1, t0(秒,=起始拍×0.25+intro偏移), dur(秒,=时长拍×0.25),
//                   attack, release, gain(声部相对增益) }
// f1 恒等于 f0（BGM 无滑音，全部稳态音；如需 rubato 可在 lead 个别音加微滑，本期不用）
```

- `t0` 为**绝对秒**：intro 段 `t0 = introBar×2.0 + posInBar×0.25`；loop 段 `t0 = (introBars×8 + loopBar×8 + posInBar) × 0.25`。
- 调度器播放时，intro 段一次后进入 loop 段；loop 末尾回绕（见 §4）。

### §3.4 战斗 / 凯旋变体（文档标注，本期不落地）
- **战斗叠层（stage + RunState 进入战斗，如 `chong_feng` 冲锋怪接近）**：在现有 stage loop 之上叠加 ① perc 密度加倍（每八分都 tick，即 `起始拍` 0/1/2/3/4/5/6/7 各一小击）+ ② 低音脉冲（额外一条 `sine`/`square` 60–70Hz 短脉冲，每拍 1 次，相对增益 ~0.4）。张力微升但不焦虑，符合 audio-design §1 分层曲线。
- **凯旋收尾（通关 `ON_LEVEL_COMPLETE`）**：`game-scene` 已有 `sfx:level_clear`（C5-E5-G5-C6 上行琶音）发声；建议 BGM 在触发时 `stopMusic()` 让凯旋音独奏，或在 loop 末尾插入同动机上行琶音收束。本期推荐「`stopMusic()` + 复用 `sfx:level_clear`」最简路径。
- **受伤 / GameOver**：沿用 audio-design §1 曲线——BGM 不强行变调，由 `sfx:hurt` / `sfx:game_over` 提供反馈；可选在 `ON_HURT` 时 `music` 增益瞬时降半（见 §4）。

### §3.5 与 SFX 旋律碰撞核对（IP 红线 + 不撞曲）
- **BGM 旋律域**：lead 全部落在 C 大调五声 C-D-E-G-A（偶发 F 自然经过音），音区 octave 4–5；**无 C5→E5→G5→C6 上行整句复制**。
- **已知旋律型 SFX**：`sfx:level_clear` = C5-E5-G5-C6（四音序，octave5→6 收顶）；`sfx:coin` = B5→E6；`sfx:seed_collect` = C6→G6；`sfx:seed_metamorph` = 440→880 滑音。
- **核对结论**：menu/stage lead 为 octave5 五声 bounce 动机，轮廓与任一 SFX 均不重合；音区与 `level_clear` 的 C6 收顶、`coin`/`seed_collect` 的 C6+ 高位均错开；无任何任天堂符号/采样引用。**原创、零撞曲**，符合 IP 红线。

---

## 4. 循环调度策略（给工程的方向，非代码）

1. **预排调度器**：BGM 由「按拍预排的 Tone 列表」+ 一个 lookahead 调度器实现。维护 `nextNoteTime`（AudioContext 时间）与当前 loop 内拍指针；每帧（或每 ~25ms 定时器）检查 `ctx.currentTime + LOOKAHEAD(≈0.1s)`，若需排下一批 Tone，则按 `t0 = loopStartTime + 起始拍×0.25` 创建 `OscillatorNode+GainNode`（包络同 `web-audio.ts` `synth` 逻辑），`start/stop` 排定；拍指针越界 `(loopBars×8)` 则回绕到 loop 起点，实现**无缝循环**。
2. **intro → loop**：先以 `introBars` 段排程一次，intro 结束后无缝接 loop；若 `introBars=0` 则直接进 loop。
3. **增益施加**：每个 oscillator 的 GainNode 峰值 = `master × music × MUSIC_BASE_GAIN[name] × tone.gain`，经现有 MasterBus 限幅（`DynamicsCompressor` -6dB/8:1）后入 `destination`；与 SFX 共用同一总线，BGM+SFX 峰值 < 1.0。
4. **暂停 / 结算 / GameOver**：
   - **推荐 `stopMusic()`**：取消所有已预排未触发 oscillator（调度器持有引用，`stop()` 截断），仿真冻结即音乐停；恢复时 `playMusic(name)` 重启（从 loop 起点，可接受，无相位残留）。
   - **或「临时 duck」**：不取消调度，仅把 `music` 增益瞬时降半（`master × (music×0.5) × ...`），保留底噪律动；恢复时还原。二选一，推荐 `stopMusic` 最简、零 desync。
   - 受伤反馈（`ON_HURT`）可选同 duck 思路瞬时降半 150ms。
5. **复音预算**：本设计每八分同时活跃声部 ≤ 4（lead+bass+pad+perc），远低于 `web-audio.ts` 的 `MAX_VOICES=8`；调度器只需保证 lookahead 窗口内活跃 oscillator 数 ≤ 8，安全。
6. **双端一致**：Web 与微信均复用同一调度逻辑（微信经 `wx.createWebAudioContext()` 或全局 `AudioContext`）；`unlock()` 前 `ctx` 为 null → `playMusic`/`stopMusic` no-op。

---

## 5. 验收门槛

1. **双端可闻**：Web + 微信真机均能在标题屏听到 `music:menu`、进关卡听到 `music:stage`；intro 可选（无声亦可）。
2. **无爆音**：BGM + SFX 同时播放峰值 < 1.0，复用 `web-audio.ts` 现有 MasterBus 限幅（阈值 -6dB / 8:1）不削波。
3. **core 零平台扫描**：`grep -rnE "wx\.|window\.AudioContext|new AudioContext|createInnerAudioContext" src/core` → **0 命中**（音频实现仅在 `platform/`；`playMusic`/`stopMusic` 由 game 层场景经 `platform.audio` 调用，core 不感知）。
4. **mock AudioPort 测试**：
   - `playMusic('music:menu')` 被调用 → 记录一次启动；其后 BGM 以 loop 周期持续排程（可断言调度器在 `currentTime` 后注入了首拍 Tone）。
   - **重复调用同 name 不叠加崩溃**：连续两次 `playMusic('music:menu')` → 仅一份循环在播（idempotent）。
   - 换 name：`playMusic('music:stage')` 在 menu 播放中调用 → 先停 menu 再起 stage，无双循环叠加。
   - `stopMusic()` 被调用 → 当前 BGM 停止、已预排未触发 oscillator 被取消。
   - 未知 name：`playMusic('music:stage_cave')` → no-op 不崩。
5. **unlock 闸门**：`unlock()` 前 `playMusic`/`stopMusic` 均 no-op（`ctx` 为 null 静默）。
6. **零素材**：无任何新增 mp3 / png / 字体；BGM 全程序化合成。
7. **配置生效**：`audio-config.json` `music` 默认 0.5 时出声；置 0 时静音（等效 MVP）。
8. **无回归**：既有 SFX（audio-design.md §2 全部事件）照常发声，BGM 不抢占 `play()` 复音上限（≤8）。

---

## 6. 与既有文档 / 资产对齐

- **audio-design.md**：
  - §0 铁律（core 零平台 / 薄 audio-bus / 零素材 / IP 红线）继承；仅推翻「MVP 不播 BGM」默认。
  - §1 音乐方向（120 BPM / 4/4 / 八分网格 / 温暖轻快童趣 / organic timbre / 分层情绪曲线）严格遵循；menu=明亮稀疏琶音、stage=轻 perc+低音脉冲、凯旋=复用 `sfx:level_clear` 动机均对齐。
  - §3.1 合成基元（`Tone` / `SfxSpec` / `SFX_BASE_GAIN`）同构复用；BGM 仅新增 `MUSIC_BASE_GAIN` 与 `MUSIC_SPECS`。
  - §4 增益施加规则延伸：`BGM gain = master × music × MUSIC_BASE_GAIN[name] × tone.gain`。
  - §6 D2（扩展 `AudioPort` 加 `playMusic`/`stopMusic` 而非另立端口）已拍板并落地于本契约 §2.1；D9（微信素材）因微信改 WebAudio 合成已解除阻塞。
- **art-bible.md**：menu/stage 暖橙黄 + 草绿/天蓝情绪呼应；童趣不幼稚、危险用冷蓝/紫做反差（BGM 不介入危险语义，仅暖色基调）。
- **触发点**：`title-scene.ts` `create()` 播 `music:menu`；`game-scene.ts` `create()` 播 `music:stage`；暂停/结算/GameOver 按 §4 建议 `stopMusic()` 或 duck。
- **IP 红线**：旋律/音色全部原创五声动机，无任何任天堂符号/采样，且与现有 SFX 旋律不撞曲（§3.5）。

---

## 7. 交付物清单
- `design/audio/audio-bgm-design.md`（本文件，主交付）
- 落地依赖（由 engineering-lead 实现，非本文件产出）：`platform.ts` 扩 `AudioPort`、双端 `web/wechat-audio` 增 `playMusic/stopMusic` + `MUSIC_SPECS` + 调度器、`audio-config.json` `music` 改 0.5、`title-scene`/`game-scene` 接 `playMusic` 调用点。
