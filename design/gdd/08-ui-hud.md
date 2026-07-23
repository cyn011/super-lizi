# 08 UI / HUD

> 分层：Must（中深）｜依赖：06 Economy / 07 Damage / 05 Level / 01 Input / 09 Audio｜混合 UI（矢量/系统字体）

## 1. 目的与范围
HUD（生命/金币/分数/进度/计时）、暂停、结算；混合 UI（矢量或运行时系统字体，中文）。触屏虚拟按钮（仅微信）由 01 提供布局，本系统渲染。

## 2. Must / Could 分层
- **Must**：HUD 顶部常驻（生命爱心图标+数字、金币、分数、关卡进度条、计时）；暂停菜单；结算（凯旋之门通关动画+星级）；矢量/系统字体中文；触屏按钮渲染。
- **Could**：设置页（音量 / 减少动态开关 / 色盲辅助开关，按可访问性权威口径 `art/accessibility.md` 落地，MVP 目标档 Standard）、多语言。

## 3. 机制详述
- HUD 读取 `EconomyState`（lives/coins/score）、`DamageState`（sizeScale 影响心形）、`Level` progress（0~1）、`timer`。
- 布局：左上生命、中上分数/金币、右上计时、顶部进度条；半透明圆角底板（矢量）。
- 中文：运行时系统字体或矢量位图字（≥14px 等效，文字尺寸达标为 Standard 项，见 `art/accessibility.md` §2.2/#6），避免 CJK 像素字包体风险（美术圣经 §7.1）。
- 暂停：游戏中 `INPUT_ACTION`（或专用键）→`ON_PAUSE`；遮罩+大圆角按钮（继续/重玩）。
- 结算：凯旋之门亮起 + 星级（基于 time/coins）；失败温柔提示。
- 触屏按钮：仅微信端显示 01 布局，热区 ≥48px（安全底线，Basic 强制；防光敏全屏闪烁 <3Hz、热区 ≥48×48 不可降级，见 `art/accessibility.md`）。

## 4. 依赖系统
- **06 Economy**、**07 Damage**、**05 Level**（progress/goal）、**01 Input**（暂停/触屏）、**09 Audio**（音效钩子）。

## 5. 接口契约
```ts
interface HUDModel { lives:number; coins:number; score:number;
  progress:number; time:number; form:string; }
// 输入（来自 01）：pause requested
// 事件：ON_PAUSE, ON_RESUME, ON_RESTART, ON_LEVEL_COMPLETE_UI
```

## 6. 数据格式
`ui-config.json`：`{ hudLayout, font:'system', minFontSizePx:14, touchButtonsFromInput:true }`。

**可访问性档位标注（按 `art/accessibility.md` §6）**：本 UX 各界面目标档位与安全底线如下——
- HUD：Standard（色盲辅助开关 + 减少动态开关 + 文字≥14px + 热区≥48×48 + 屏宽10%边距）
- 暂停菜单：Standard
- 结算界面：Standard
- 安全底线（Basic 强制，不可降级）：防光敏全屏闪烁 <3Hz、单次日闪 ≤0.2s、半透明叠加；触控热区 ≥48×48 逻辑 px

## 7. 验收标准
- [ ] HUD 实时反映 Economy/Damage/Level。
- [ ] 中文清晰 ≥14px 等效，无 CJK 像素字包体。
- [ ] 触屏按钮热区 ≥48px（仅微信）。
- [ ] 暂停/结算正确触发。
- [ ] 进度条随玩家 x 增长。

## 8. 风险与缓解
- CJK 包体 → 系统字体/矢量，不进包（已定混合 UI）。
- 小屏拥挤 → HUD 用 10% 安全边距，图标+数字替代纯中文。
- 微信字体缺失 → 系统字体回退栈。

## 已锁定决策（2026-07-21 用户拍板）
- **结算星级**：时间 + 金币收集率双维度，**权重各 50%**（A4）。
- **失败界面**：极简"再试一次"，不显示恐吓性失败原因文案（A3）。
- **LEVEL_SELECT**：MVP 单关由 MENU 直进 PLAYING，LEVEL_SELECT 态保留但暂不出现（A1，多关时启用）。
- **新手引导**：MVP 做轻量非阻塞引导（移动→跳→二段跳→踩敌，触发式），非模态（A2）。
