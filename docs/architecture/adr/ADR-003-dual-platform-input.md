# ADR-003 · 双端适配层与输入抽象实现

- **状态**：Accepted（基于 Phase 2 已锁决策：双按钮触屏布局、`enabled:false` 纯逻辑节拍）
- **日期**：2026-07-21
- **作者**：程基岩（engineering-lead）

## 背景
Web（键盘）与微信小游戏（触屏虚拟按钮）物理输入不同，但逻辑层必须**零平台分支**消费统一 `InputState`（GDD 01 §5）。同时音频（自动播放限制）、存储（`localStorage` vs `wx.setStorageSync`）、生命周期（`onHide/onShow` vs `blur/focus`）双端差异需隔离。目标：双端产生**完全相同**的 `InputState` 序列（GDD 01 §7 验收）。

## 决策
1. **适配层边界**：`platform/` 是唯一可 `import wx` / DOM 的模块，对外暴露 `Platform` 接口（`env/input/audio/storage/lifecycle`）。core/game 仅依赖接口。
2. **输入三段式**：
   - `RawInputProvider.sample(): RawInputFrame { down:Set<string>, pressedEdge:Set<string>, releasedEdge:Set<string> }`，`string` = **物理信号 id**（Web:`KeyboardEvent.code`；微信:`touch:left` 等）。
   - `InputAbstraction`（core，纯函数）读 `input-config.json`（物理 id → `LEFT/RIGHT/JUMP/ACTION`）与 `RawInputFrame` → `InputState`（含 `jumpPressedAt` 仿真时钟 ms）。**永不出现 `keyboard`/`touch` 分支**。
   - Web 键盘/微信触屏各自只负责产出 `RawInputFrame`；二者经同一 `InputAbstraction` → 同 `InputState`。
3. **触屏布局**：微信端"左下左右双按钮 + 右下跳/动作双按钮"，命中区 ≥48px，`input-config.wechat.buttons` 归一化坐标 ×逻辑分辨率；仅 `env==='wechat'` 时由 `ui/touch-buttons.ts` 渲染。
4. **音频/存储/生命周期**：分别用 `wx.createInnerAudioContext`/`wx.setStorageSync`/`wx.onHide|onShow` 与 Web AudioContext/`localStorage`/`blur|focus` 实现同接口。
5. **env 探测**：构建期 `vite.config` 以 `define: { IS_WECHAT: mode==='wechat' }` 注入编译期常量，运行时 `detectEnv()` 探测 `typeof wx!=='undefined'` 回退；Boot 场景据此注入对应 `Platform` 实现（代码实际采用 IS_WECHAT，非 VITE_PLATFORM）。
6. **WeChat 运行前提**：需 `weapp-adapter` shim 提供 `canvas/document/window` 全局；Phaser `type:Phaser.AUTO`、`canvas:wx.createCanvas()`、`pixelArt:true`；工程含 `game.js` 入口 + `game.json`（`deviceOrientation:landscape`）。

## 备选
- **逻辑层直接读 `wx`/`keyboard`**：破坏双端一致性、不可测、违反 GDD 铁律；否决。
- **触屏改用左摇杆 + 跳/动作**：Phase 2 门已锁"双按钮"更贴马里奥式且实现简单；否决。
- **输入在渲染帧采样**：低端机延迟、且与固定步不同步；否决（固定步内采样）。

## 后果
- 正面：双端逻辑完全共享、输入一致性可单测、平台差异收敛到单一适配层、便于后续手柄/自定义键位（Could）扩展。
- 负面/风险：
  - **WeChat `weapp-adapter` + 工程骨架**为最大技术风险，需 Phase 4 优先验证最小可运行 demo。
  - 微信 `onTouch` 坐标系与逻辑分辨率映射需仔细处理（归一化坐标 ×512×288）。
  - 包体：Phaser + 适配层 + 业务代码须 tree-shaking 守 4MB（见 ADR-004）。
- 验收：GDD 01 §7（双端零 `keyboard/touch` 分支、同手势同 `InputState`、热区 ≥48px、`jumpPressedAt` ≤16ms、平台切换不丢状态）。
