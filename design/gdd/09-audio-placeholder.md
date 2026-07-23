# 09 音频占位 Audio Placeholder

> 分层：Could（轻 stub）｜被 03/04/06/07/08 调用 `playSfx`

## 1. 目的与范围
MVP 音频事件占位：定义音频事件枚举与占位接口（`playSfx`），无实际资产。完整音乐/音效资产→后续 Phase。

## 2. Must / Could 分层
- **Must(Could-light)**：音频事件枚举 + 占位 `playSfx(name)` 接口，静音/日志不崩。
- **Could**：实际音效资产、动态音乐、节拍同步（见 10）。

## 3. 机制详述
- 事件枚举：`SFX_JUMP, SFX_DOUBLE_JUMP, SFX_STOMP, SFX_LAND, SFX_HURT, SFX_COIN, SFX_POWERUP, SFX_CLEAR, SFX_FIRE`。
- 占位：`AudioBus.play(name)` 仅记录/静音；资产就绪后映射到实际音效。
- 微信自动播放限制：首次用户交互后解锁 AudioContext（标记 TODO）。

## 4. 依赖系统
无强依赖；被 03/04/06/07/08 调用。

## 5. 接口契约
```ts
type SfxName='SFX_JUMP'|'SFX_DOUBLE_JUMP'|'SFX_STOMP'|'SFX_LAND'|'SFX_HURT'|'SFX_COIN'|'SFX_POWERUP'|'SFX_CLEAR'|'SFX_FIRE';
function playSfx(name:SfxName): void
```

## 6. 数据格式
`audio-config.json`：`{ master:1, sfx:1, music:0, unlockOnInteraction:true }`。

## 7. 验收标准
- [ ] 所有枚举事件可触发占位不崩。
- [ ] 资产就绪后能无缝替换为实际音效。
- [ ] 微信端交互后解锁音频。

## 8. 风险与缓解
- 微信音频限制 → `unlockOnInteraction` 标志 + 首次 tap 解锁。
- 包体 → MVP 可暂静音或极短占位音，资产后补不破结构。

## 待主理人确认
MVP 是否需极简占位音效（如单音）还是纯静音？建议保留轻量占位以验证事件链路。
