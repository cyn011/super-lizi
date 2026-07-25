# BGM 双端程序化落地 — 交付概览

## 方案
用户选定「双端程序化 + 菜单/关卡 BGM」：Web 与微信端**均改用 WebAudio 程序化合成**，零音频素材。
- 顺带解决微信真机长期静音：原 `WechatAudio` 走 `name→CDN URL` 流式，但 `cdn-map.json` 素材未就位（D9），真机 SFX/BGM 全程静音——本次重构为合成彻底根治。
- 锁色板/音频全零素材，符合 ADR-004（纯 Graphics + 系统字体 + tween）。

## 设计契约（audio-director）
- 文档：`design/audio/audio-bgm-design.md`
- 内容：menu（120BPM 有机风，intro 2 小节→loop 8 小节无缝回绕）/ stage 全部 `Tone` 时间线表、`playMusic(name)/stopMusic()` 接口规格、lookahead 预排调度（25ms setInterval + 0.1s LOOKAHEAD）、验收门槛、IP 撞曲核对（C 大调五声原创动机，无撞曲）。
- 主理人拍板三项：① `audio-config.json` music `0→0.5`；② stage perc 轻击用 square tick（非白噪瞬态）；③ 接 title/game-scene 触发点。

## 工程落地（engineering-lead）
- 共享引擎 `src/platform/shared/synth-engine.ts`：SFX 逻辑完整迁移 + 新增 `MUSIC_SPECS`/`SynthEngine`，SFX+BGM 同构 `Tone` 序列，Web/微信复用同一引擎，ctx 经 `getCtor` 注入。
- `web-audio.ts` 瘦身为委托；`wechat-audio.ts` 重构为合成（删 cdnMap/InnerAudioContext，getCtor = `globalThis.AudioContext || wx.createWebAudioContext`）。
- `platform.ts` AudioPort 扩 `playMusic/stopMusic`；`audio-config.json` music=0.5。
- 触发点：title-scene（首次手势 menu→进游戏切 stage）、game-scene（进关 stage；暂停/失败/通关停；恢复/重开/下一关续播）。
- 测试 +14 项（synth-engine/web-audio/wechat-audio/audio-bus），含 idempotent / 换名先停 / no-op / unlock 前 no-op 行为契约。

## 主理人 trust-but-verify 结果
| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | 0 错 |
| `vitest run` | 390/390 绿（新增 14） |
| `build:wechat` | 成功，dist 1.63MB / gzip 380KB |
| dist 含 BGM 参数 | music:menu×3 / music:stage×7 / playMusic×11 / stopMusic×10 / scheduleTick×3 / createWebAudioContext×2 |
| `src/core` 零平台 | grep 命中 0 处实际调用（仅注释纪律说明） |
| 触发点闭环 | title/game-scene 与 audio-config 端到端接通 |

**BGM 质量门判定：PASS** ✅

## 待办
1. **git commit（待用户「提交」指令）** —— BGM 代码尚未落盘。
2. **双端真机复验**（用户侧）：清缓存+重新预览扫新码 → 标题屏首次点击听 menu、进 1-1 听 stage、真机 SFX 也出声、暂停/失败/通关停与恢复/重开/下一关续播。
3. 历史遗留（非本次）：S06 烧尾 G3/G9 真机手测、parTime 调校（1-1=60000ms/1-2=84000ms 占位）、音乐节拍化主线 enabled:false 骨架、L3 标题屏 V2。
