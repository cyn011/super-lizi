# 01 输入抽象 Input Abstraction

> 分层：Must（深）｜依赖：无（最底层）｜被 03/04/08 消费

## 1. 目的与范围
将 Web（键盘）与微信小游戏（触屏虚拟按钮）的物理输入，统一抽象为 4 个平台无关的输入事件，使逻辑层（角色控制/敌人/UI）完全不感知输入来源。范围覆盖：键盘绑定、触屏虚拟按钮布局、输入三态（pressed/held/released）采集。跳跃缓冲的"消费"在 03 角色控制，本层只记录按下边沿时间戳。

## 2. Must / Could 分层
- **Must**：4 事件 `INPUT_LEFT/RIGHT/JUMP/ACTION`；键盘(Web) 与触屏虚拟按钮(微信) 双端映射；held/pressed/released 三态；触屏按钮热区 ≥ 48px；运行时切换平台。
- **Could**：自定义键位、手柄、陀螺仪/体感、按键音效、长按连发。

## 3. 机制详述
- 抽象事件（全局常量，见 index §1.2）：`INPUT_LEFT, INPUT_RIGHT, INPUT_JUMP, INPUT_ACTION`。
- 每事件状态机：`IDLE → PRESSED（本帧刚按下）→ HELD（持续）→ RELEASED（本帧抬起）→ IDLE`。
- 采集：每帧由平台后端（Keyboard / Touch）写入原始状态，InputAbstraction 归一为 `InputState` 暴露逻辑层。
- 跳跃缓冲：本层**仅记录 `jumpPressedAt` 时间戳**（ms）**，消费在 03（jump buffer 120ms）。本层不含游戏逻辑。
- 触屏布局：左下"左/右"双按钮 + 右下"跳/动作"双按钮（仅微信显示，Web 隐藏）；归一化坐标运行时乘分辨率。
- 死区：虚拟摇杆（若采用）死区 15%，避免漂移。

## 4. 依赖系统
无。被 03 Character / 04 Enemy（动作触发）/ 08 UI（暂停/菜单）消费。

## 5. 接口契约
```ts
// 全局常量（跨 GDD 强制一致，见 00-index §1.2）
const INPUT_LEFT='INPUT_LEFT'; INPUT_RIGHT='INPUT_RIGHT';
const INPUT_JUMP='INPUT_JUMP'; INPUT_ACTION='INPUT_ACTION';

interface InputState {
  left: boolean; right: boolean;                      // held
  jumpPressed: boolean; jumpHeld: boolean; jumpReleased: boolean;
  actionPressed: boolean; actionHeld: boolean; actionReleased: boolean;
  jumpPressedAt: number;                              // ms 时间戳，供 03 缓冲
}
// 输出：InputAbstraction.sample(): InputState
// 事件：platformChanged(platform: 'web'|'wechat')
```

## 6. 数据格式
`input-config.json`：
```json
{
  "web": { "left":["ArrowLeft","KeyA"], "right":["ArrowRight","KeyD"],
           "jump":["Space","ArrowUp","KeyW"], "action":["KeyJ","ShiftLeft"] },
  "wechat": { "layout":"virtual", "buttons": {
      "left":{"x":0.08,"y":0.82,"r":0.07}, "right":{"x":0.22,"y":0.82,"r":0.07},
      "jump":{"x":0.82,"y":0.82,"r":0.08}, "action":{"x":0.92,"y":0.70,"r":0.07} } }
}
```
坐标归一化 (0~1)，运行时乘逻辑分辨率。

## 7. 验收标准
- [ ] 双端运行，逻辑层代码零 `keyboard`/`touch` 分支。
- [ ] Web 键盘与微信触屏产生**完全相同**的 `InputState` 序列（同输入场景）。
- [ ] 触屏按钮热区 ≥ 48px，误触率测试 < 5%。
- [ ] `jumpPressedAt` 精度 ≤ 16ms。
- [ ] 平台切换不丢输入状态。

## 8. 风险与缓解
- 触屏手感差 → 按钮布局可调透明度/位置，提供"左手/右手"预设。
- 低端机输入延迟 → 输入采样在固定步长（与物理同 60Hz）而非渲染帧。
- 按键冲突（空格滚页）→ Web 端 `preventDefault`。

## 待主理人确认
触屏是否采用"左右双按钮 + 跳/动作双按钮"（更贴马里奥式，建议）还是"左摇杆 + 跳/动作"？
