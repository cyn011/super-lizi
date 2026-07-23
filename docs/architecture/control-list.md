# super-mali · 实现前控制清单（Control List）

> 阶段：Phase 3 → Phase 4 质量门（架构交付，供编码前/中卡点核查）
> 评审强度：lean
> 作者：程基岩（engineering-lead）
> 用法：Phase 4 每个 Story 实现/合入前，对照本清单对应项逐项确认打勾；未达标不得合入主包构建。

---

## §1 手感沙盒验收指标（P1·跳，来自 GDD 03 §7）

> 在 `SandboxScene`（dev 构建）空房间跑真实固定步循环，浮层实测，全部落入区间方达标。

| 指标 | 目标值 | 容忍区间 | 来源 |
|---|---|---|---|
| 全跳高度 | ≈64px（≈2 tiles） | 60–68px | JUMP_VELOCITY -480 / GRAVITY 1800 |
| 二段跳高度 | ≈1.6 tiles | 50–56px | doubleJumpScale 0.9 → -432 |
| 短跳高度（松键） | 全跳 50% | 45–55% | 可变跳高 `v.y*=0.5` |
| Coyote 窗口 | 离地 ≤100ms 内可跳 | 有效≤100ms；>100ms 无效 | coyoteMs 100 |
| Jump Buffer | 落地前 ≤120ms 按跳即起 | 有效≤120ms | jumpBufferMs 120 |
| 二段跳次数 | 空中 1 次 | 恰好 1，落地重置 | AIR_JUMPS 1 |
| 水平 0→满速 | ≤0.2s | ≤0.22s | MOVE_SPEED 140 / ACCEL |
| 水平松键→停 | ≤0.15s | ≤0.17s | FRICTION 1600 |
| 踩踏反弹 | `v.y=BOUNCE=-300` | 落敌顶消灭+反弹 | stompBounce -300 |
| 固定步一致 | 同输入序列双端逐帧同 | 完全一致 | ADR-005 |

**卡点**：上述 10 项全部达标，方可铺关卡内容（GDD 03 §8 风险缓解）。

---

## §2 包体预算（微信硬约束：主包 4MB / 整包 8MB）

> Phase 4 每次主包构建后核对；超限即阻断。

| 项 | 预算上限 | 计量方式 | 超出动作 |
|---|---|---|---|
| 业务+引擎 JS（min+gzip 前） | ≤1.5MB | 构建产物 `dist/` JS 合计 | tree-shaking / 按需引 Phaser |
| 图集 atlas（PNG-8 索引） | ≤1.0MB | 单图集文件 | 拆分仍主包内 / 降色 |
| config + 主关 JSON | ≤100KB | `src/config/**` | 压缩/外置 |
| SFX（若用文件非合成） | ≤100KB | 音频文件 | 改 WebAudio 合成 |
| **主包合计** | **≤2.7MB（红线 4MB）** | 主包目录总大小 | 阻断 + 复盘 |
| 整包（含子包/远程音频） | ≤8MB | 全量包 | 关卡走子包 / 音乐远程 |

**卡点**：主包 ≤2.7MB 常态、峰值 <4MB；音乐**绝不进主包**（远程 URL）。

---

## §3 IP 合规构建检查（红线，来自美术圣经 v1.1 + 99 §6）

> 作为 Phase 4 CI / 合入门禁脚本（扫描源码、配置、资源清单、命名）。

- [ ] **命名扫描**：源码/配置/资源不含任天堂符号词（`mario`/`luigi`/`bowser`/`koopa`/`mushroom`/`star`(道具)/`pipe`/`flag`/`piranha` 等）；项目代号 `super-mali` 与 "栗宝 Mali" 仅作原创命名，无混淆。
- [ ] **角色造型**：主角"栗宝"无帽檐/背带裤/胡子/水管工轮廓/蘑菇头/龟壳（美术资产审查）。
- [ ] **敌人造型**：刺栗/冲锋/嘟浮/石炮 无蘑菇/乌龟/星星/龟壳；冲锋怪警示红 `#E8483B`（与刺栗同色，靠楔形区分）、嘟浮蓝紫 `#6E7BF2` 已避开增益紫 `#9B6CF2`。
- [ ] **终点**：凯旋之门（非旗杆）。
- [ ] **道具**：元气果（果实+嫩芽，非蘑菇/星星/火焰花）；爱心暖粉红 `#F26D8B` 非警示红。
- [ ] **音乐/机制**：仅借鉴横版跳跃结构，全原创；无任天堂音频采样。
- [ ] **资源审查**：`art/` 资产与 `atlas` 源图人工复核无混淆剪影。

**卡点**：任一项命中即阻断，回美术/设计修正（依据 99 §6 红线）。

---

## §4 双端一致性测试项（来自 ADR-003 + GDD 01 §7）

| 测试项 | 方法 | 通过标准 |
|---|---|---|
| 逻辑层零平台分支 | 静态扫描 `core/` 无 `wx`/`keyboard`/`touch`/`localStorage`/`AudioContext` | 0 命中 |
| 同手势→同 InputState | 单测：构造 Web `RawInputFrame`（keyboard code）与微信 `RawInputFrame`（touch id）等价序列 → 同一 `InputAbstraction` | 输出 `InputState` 序列完全一致 |
| 触屏按钮热区 | 微信构建真机/模拟器量测 `input-config.wechat.buttons` 渲染命中区 | ≥48px |
| `jumpPressedAt` 精度 | 固定步采样 | ≤16ms（步长 16.67ms 天然满足） |
| 平台切换不丢输入 | 微信 `onHide/onShow` 模拟 | 恢复后输入状态连续无跳变 |
| 仿真确定性 | headless 跑完整仿真 N 步（脚本输入） | 同输入同输出、无异常、无漂移 |
| 音频解锁 | 首次交互后 `playSfx` | 微信 `onTouchStart`/Web `click` 后解锁，不崩 |
| 存储双端 | `saveLevelResult` → `loadSave` | 微信 `wx.setStorageSync` / Web `localStorage` 均可读写 |

**卡点**：前两项（零平台分支 + 同手势同 InputState）为架构铁律，CI 必跑；其余在微信最小 demo（R2）与真机回归验证。

---

## §5 实现前总闸（Phase 4 启动顺序建议）
1. 先过 **R2 微信最小可运行 demo**（空场景 + 1 可动精灵 + 触屏双按钮 + 输入单测等价）→ 解除最大技术风险。
2. 落地 `core/` 纯逻辑 + Vitest 单测（§4 表驱动覆盖）。
3. 手感沙盒达标（§1）后再铺关卡内容。
4. 每次主包构建核对 §2；合入门禁跑 §3 IP 扫描 + §4 静态/单测。

> 本清单与 `architecture.md`、`adr/`、`architecture-review.md` 配套；任何指标调整须同步回 `src/config/*.json` 并复测。
