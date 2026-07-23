# super-mali · 测试框架脚手架方案（Phase 4）

> 阶段：Phase 4 预制作（测试脚手架方案，不含完整工程实现）
> 作者：程基岩（engineering-lead）
> 输入：docs/architecture/architecture.md（§9 测试策略）、docs/architecture/adr/ADR-005（固定步长）、docs/architecture/control-list.md（§1/§4）
> 配套：`production/epics.md`
> 说明：本文为**方案 + 骨架示例**。具体 `package.json` / `src/` / `tests/` 落地在冲刺执行期；下列代码块为"示意骨架"，标注（骨架）者将在 `tests/` 下创建，不在本阶段写入工程。

---

## 1. 测试框架选型与理由

- **框架：Vitest**（Vite 原生、Node 运行、极快启动、TS 一等公民）。
- **理由（对齐架构 §9.1）**：`core/` 零 Phaser 依赖 → 全部逻辑单测可在 **Node 环境**跑，无需浏览器/WebGL/canvas；CI 便宜、本地快；与 Vite 构建同源配置，无额外工具链。
- **不测渲染**：Phaser 渲染/场景测试排除（lean）；只测逻辑与契约（架构铁律：core 可单测）。
- **确定性优先**：所有 core 模块**禁止读取 `Date.now()` / `Math.random()`**；时间来自注入的 `simTimeMs`，随机源（若有）来自可注入种子。保证单测可复现、双端等价。

---

## 2. Vitest 配置（骨架）

> 落点：`vitest.config.ts`（Phase 4 创建）。

```ts
// vitest.config.ts  （骨架·示意）
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',                 // core 纯逻辑，无需 jsdom / canvas
    include: ['tests/**/*.test.ts'],     // 仅测 tests/，不碰 src 渲染层
    globals: true,                       // 直接用 describe/it/expect
    // 确定性：core 单测互相独立，但禁用按文件并发以免误用共享状态
    fileParallelism: false,
    sequence: { hooks: 'list' },
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      // lean：不要求高覆盖率，仅风险模块（character/physics/input/damage）重点覆盖
      thresholds: { lines: 0 },         // 不卡阈值，lean 模式只跑不强制 %
    },
  },
});
```

`package.json` scripts（骨架）：
```jsonc
{
  "scripts": {
    "test": "vitest run",            // CI / 本地一次性
    "test:watch": "vitest",          // 开发
    "test:smoke": "vitest run tests/smoke",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": { "vitest": "^2", "typescript": "^5" }
}
```

---

## 3. core 单测目录结构与命名约定

镜像 `src/core/` 模块，便于"改一处逻辑即改一处测试"：

```
tests/
  unit/                        # 确定性逻辑单测（Node）
    input/
      input-abstraction.test.ts        # GDD01
    physics/
      body.test.ts                     # GDD02 stepBody/isGrounded
      collision.test.ts                # AABB 分轴/单向/移动平台
    character/
      character-controller.test.ts     # GDD03 coyote/buffer/二段跳/短跳/踩踏
    enemy/
      enemy-ai.test.ts                 # GDD04 4 类状态机 + 弹丸
    level/
      level-loader.test.ts             # GDD05 校验 + 解析
      level-runtime.test.ts            # 检查点/goal
    damage/
      damage-state-machine.test.ts     # GDD07 正交矩阵
    economy/
      economy.test.ts                  # GDD06 计分/连击
    beat/
      beat-clock.test.ts               # GDD10 门控/递增/边界
    meta/
      save-data.test.ts                # GDD11 模型（storage 注入桩）
  smoke/
    headless-sim.test.ts               # §4 headless 冒烟
  fixtures/
    level-1-1.json                    # 样本 LevelData（含 beat 字段）
    input-frames.ts                    # 等价手势 RawInputFrame 样本（Web/微信）
```

**命名约定**
- 文件：`<module>.test.ts`，与 `src/core/<module>` 同名；一个文件覆盖该系统全部 GDD 验收点。
- `describe` 第一层 = GDD 编号 + 系统名；第二层 = 行为（如 `'coyote 窗口'`）。
- 测试名用行为断言句式：`'离地 ≤100ms 内按跳有效'`。
- 给定常量：`STEP_MS = 1000/60`，统一在 `tests/unit/_step.ts` 导出，禁止各测试硬编码步长。
- 断言阈值从 `src/config/*.json` 读取（与游戏同参），不复制魔法数。
- **禁止**在 `tests/unit/**` 中出现 `import 'phaser'` 或 `canvas`/`wx`/`localStorage`。

---

## 4. 确定性单测示例骨架（3 个可运行 stub）

> 下列为**示意骨架**，展示"如何写"；冲刺执行时落到 §3 对应路径。全部不依赖 Phaser/WebGL，纯 Node 可跑。

### 4.1 InputState 双端一致性（GDD01 · control-list §4.2）

```ts
// tests/unit/input/input-abstraction.test.ts  （骨架·示意）
import { describe, it, expect } from 'vitest';
import { InputAbstraction } from '../../../src/core/input/input-abstraction';
import type { RawInputFrame } from '../../../src/core/input/raw-input';
import { webInputConfig, wechatInputConfig } from '../../../src/config/input-config';
import { STEP_MS } from '../_step';

// 等价手势：Web 按 ArrowLeft 一帧  vs  微信触屏 left 按钮一帧
function webLeftHeldFrame(): RawInputFrame {
  return { down: new Set(['ArrowLeft']), pressedEdge: new Set(['ArrowLeft']), releasedEdge: new Set() };
}
function wechatLeftHeldFrame(): RawInputFrame {
  return { down: new Set(['touch:left']), pressedEdge: new Set(['touch:left']), releasedEdge: new Set() };
}

describe('GDD01 双端 InputState 一致性 (control-list §4.2)', () => {
  it('Web 键盘 与 微信触屏 产出相同 InputState', () => {
    const t = STEP_MS * 10; // 仿真时钟 ms
    const web = new InputAbstraction(webInputConfig).sample(webLeftHeldFrame(), t);
    const wx  = new InputAbstraction(wechatInputConfig).sample(wechatLeftHeldFrame(), t);
    expect(wx).toEqual(web);          // 完全一致 → 逻辑层零平台分支的可测证据
    expect(web.left).toBe(true);
  });

  it('jumpPressedAt 精度 ≤16ms（固定步 16.67ms 天然满足）', () => {
    const f = { down: new Set(['Space']), pressedEdge: new Set(['Space']), releasedEdge: new Set() };
    const ia = new InputAbstraction(webInputConfig);
    const s = ia.sample(f, 1000);
    expect(s.jumpPressed).toBe(true);
    expect(s.jumpPressedAt).toBe(1000);   // 记录仿真时钟，非 wall clock
  });
});
```

### 4.2 固定步长物理（GDD02 · ADR-005 · E1.S4）

```ts
// tests/unit/physics/body.test.ts  （骨架·示意）
import { describe, it, expect } from 'vitest';
import { stepBody, isGrounded } from '../../../src/core/physics/body';
import { STEP_MS, TILE, GRAVITY, MAX_FALL } from '../../../src/config/physics-config';

function makeBody(over = {}) {
  return { x: 0, y: 0, w: TILE, h: TILE, vx: 0, vy: 0, ...over };
}

describe('GDD02 固定步长物理 (ADR-005)', () => {
  it('自由落体 1s 后 vy 确定性 = min(gravity*1s, maxFall)', () => {
    const b = makeBody();
    for (let i = 0; i < 60; i++) stepBody(b, STEP_MS / 1000);   // 60 固定步 = 1s
    expect(b.vy).toBeCloseTo(Math.min(GRAVITY * 1, MAX_FALL), 1); // = 900
    // 再跑一次完全一致（确定性）
    const c = makeBody();
    for (let i = 0; i < 60; i++) stepBody(c, STEP_MS / 1000);
    expect(c).toEqual(b);
  });

  it('穿透安全：v*dt < TILE（无需 CCD）', () => {
    expect(MAX_FALL * (STEP_MS / 1000)).toBeLessThan(TILE); // 900/60=15 < 32
  });

  it('isGrounded 当且仅当底触地且 vy>=0', () => {
    const b = makeBody({ y: TILE * 5, vy: 0 });
    expect(isGrounded(b)).toBe(true);
    const air = makeBody({ y: 0, vy: -100 });
    expect(isGrounded(air)).toBe(false);
  });
});
```

### 4.3 角色 coyote / jump buffer 窗口（GDD03 · control-list §1）

```ts
// tests/unit/character/character-controller.test.ts  （骨架·示意）
import { describe, it, expect } from 'vitest';
import { CharacterController } from '../../../src/core/character/character-controller';
import { STEP_MS } from '../_step';
import { characterConfig } from '../../../src/config/character-config';
import type { InputState } from '../../../src/core/input/input-abstraction';

const NO_INPUT: InputState = {
  left:false, right:false, jumpPressed:false, jumpHeld:false, jumpReleased:false,
  actionPressed:false, actionHeld:false, actionReleased:false, jumpPressedAt:0,
};
function tapJump(atStep: number): InputState {
  return { ...NO_INPUT, jumpPressed: true, jumpHeld: true, jumpPressedAt: atStep * STEP_MS };
}

describe('GDD03 coyote / jump buffer 窗口 (control-list §1)', () => {
  it('离地 ≤100ms 内按跳有效（coyote）', () => {
    const cc = new CharacterController(characterConfig, { grounded: true });
    // 第 0 步离地
    for (let i = 0; i < 6; i++) cc.consume(NO_INPUT, STEP_MS / 1000); // ~100ms 内
    cc.consume(tapJump(6), STEP_MS / 1000);
    expect(cc.state.vy).toBeLessThan(0);   // 成功起跳
  });

  it('离地 >100ms 按跳无效（coyote 过期）', () => {
    const cc = new CharacterController(characterConfig, { grounded: true });
    for (let i = 0; i < 12; i++) cc.consume(NO_INPUT, STEP_MS / 1000); // >100ms 仍空中
    cc.consume(tapJump(12), STEP_MS / 1000);
    expect(cc.state.vy).toBeGreaterThanOrEqual(0); // 未起跳
  });

  it('落地前 ≤120ms 按跳，落地即刻起跳（jump buffer）', () => {
    const cc = new CharacterController(characterConfig, { grounded: false, vy: 50 }); // 下落中
    cc.consume(tapJump(0), STEP_MS / 1000);            // 提前按跳（缓冲）
    for (let i = 0; i < 6; i++) cc.consume(NO_INPUT, STEP_MS / 1000); // 期间落地
    expect(cc.state.vy).toBeLessThan(0);               // 落地后即刻消费缓冲起跳
  });

  it('二段跳：空中 1 次，落地重置 AIR_JUMPS', () => {
    const cc = new CharacterController(characterConfig, { grounded: false, vy: -100, airJumpsLeft: 1 });
    cc.consume(tapJump(0), STEP_MS / 1000);
    expect(cc.state.airJumpsLeft).toBe(0);             // 用掉 1 次
    cc.consume(tapJump(1), STEP_MS / 1000);            // 再按无效
    expect(cc.state.vy).toBeLessThan(0);               // 仍是第一次二段跳的初速，未叠加
  });
});
```

> 上述 stub 直接对应 control-list §1 量化项（coyote≤100ms、buffer≤120ms、二段跳1次、moveSpeed140/gravity1800 取自 config）。落地为真实测试后，手感沙盒（E2.S5）与单测共用同一 config → 指标一致。

---

## 5. headless 仿真冒烟方案（不依赖 Phaser/WebGL）

**目标**：因 `core/` 纯函数化，可在 Node 跑"完整仿真"断言，验证双端逻辑等价与无崩溃（架构 §9.4）。

**做法**：新增 `src/core/sim/headless.ts`（Phase 4 落地）——一个**不 import phaser** 的编排器，按固定步长把 `InputAbstraction → CharacterController → physics → enemy → damage → economy → level → beat` 串起来，返回 `{ steps, finalStateHash, events[] }`。测试构造脚本化输入序列，跑 N 步断言。

```ts
// tests/smoke/headless-sim.test.ts  （骨架·示意）
import { describe, it, expect } from 'vitest';
import { createHeadlessSim } from '../../src/core/sim/headless';  // 纯 core，无 Phaser
import { SCRIPTED_INPUTS } from '../fixtures/scripted-inputs';

describe('Headless 仿真冒烟 (不依赖 Phaser/WebGL)', () => {
  it('同输入序列 → 确定性可复现（双端等价证据）', () => {
    const a = createHeadlessSim().run(SCRIPTED_INPUTS, 600);
    const b = createHeadlessSim().run(SCRIPTED_INPUTS, 600);
    expect(a.finalHash).toEqual(b.finalHash);   // 逐位一致
    expect(a.events).toEqual(b.events);
  });

  it('无异常、状态有界（角色不穿地/不飞出世界）', () => {
    const r = createHeadlessSim().run(SCRIPTED_INPUTS, 600);
    expect(r.crashed).toBe(false);
    expect(r.finalState.character.y).toBeGreaterThanOrEqual(0);
    expect(r.finalState.character.y).toBeLessThan(16 * 32 * 100);  // 世界高度有界
  });

  it('beat.enabled=false 时不触发机制（GDD10）', () => {
    const r = createHeadlessSim({ beatEnabled: false }).run(SCRIPTED_INPUTS, 600);
    expect(r.beatEvents.length).toBe(0);     // 不驱动任何机制
  });
});
```

- **运行**：`npm run test:smoke`（`vitest run tests/smoke`）→ CI 可在无 canvas 环境通过。
- **价值**：把"双端逻辑一致"从主观宣称变为可重复断言；也是微信最小 demo（E1.S1）之外第二道确定性保险。

---

## 6. 双端一致性测试项（control-list §4 落地）

下表将 control-list §4 八项映射到具体测试载体。**单测可固化者**进 `tests/unit`；**需真机/模拟器者**进 E8.S3 手动回归清单。

| §4 项 | 测试载体 | 落点文件 / 方法 | 类型 |
|---|---|---|---|
| 1 逻辑层零平台分支 | 静态扫描 | CI：`grep -r "wx\|keyboard\|localStorage\|AudioContext" src/core` 期望 0 命中 | 自动（CI） |
| 2 同手势→同 InputState | 单测 | `tests/unit/input/input-abstraction.test.ts` §4.1 | 自动 |
| 3 触屏按钮热区 ≥48px | 真机量测 | E8.S3 手动：渲染 `input-config.wechat.buttons` 命中区 | 手动 |
| 4 `jumpPressedAt` ≤16ms | 单测 | `tests/unit/input/input-abstraction.test.ts` §4.1 | 自动 |
| 5 平台切换不丢输入 | 模拟器 | E8.S3 手动：`wx.onHide/onShow` 切换后输入连续 | 手动 |
| 6 仿真确定性 | 单测 | `tests/smoke/headless-sim.test.ts` §5 | 自动 |
| 7 音频解锁 | 模拟器 | E8.S3 手动：首次 `touchstart`/`click` 后 `playSfx` 不崩 | 手动 |
| 8 存储双端 | 单测+模拟器 | `tests/unit/meta/save-data.test.ts`（storage 注入桩）+ E8.S3 | 半自动 |

**"双盲"一致性法（核心）**：Web 与微信的 `RawInputProvider` 各自产出 `RawInputFrame` → 喂给**同一个** `InputAbstraction`。单测固化"等价手势 → 等价 RawInputFrame → 等价 InputState"（§4.1）；仿真确定性单测（§5）固化"同 InputState 序列 → 同最终状态"。两者结合即证明双端逻辑等价，无需在两套引擎上做端到端比对。

---

## 7. CI 质量门（lean）

- `npm test`（Vitest）在 push 触发：跑 `tests/unit/**` + `tests/smoke/**`。
- `tsc --noEmit` 类型检查。
- 静态扫描（§6 第1项）作为 CI 步骤，命中即失败。
- IP 合规扫描（control-list §3 / E8.S2）在合入门禁单独步骤。
- 不要求覆盖率阈值（lean）；重点模块（character/physics/input/damage/enemy）须有对应单测（见 §3 目录）。

---

## 8. 与 Epics 的对应关系

| Epic Story | 对应测试 |
|---|---|
| E1.S4 固定步长 | §4.2 物理单测 / §5 headless |
| E2.S1 物理 | §4.2 |
| E2.S2 输入抽象 | §4.1 / §6 |
| E2.S3 角色控制器 | §4.3（coyote/buffer/二段跳/短跳/踩踏） |
| E2.S4 受伤状态机 | `tests/unit/damage/*` |
| E2.S5 手感沙盒 | 单测（§4.3）+ SandboxScene 真机浮层（非单测） |
| E3.S1/S2 敌人 | `tests/unit/enemy/*` |
| E4.* 关卡/经济/节拍 | `tests/unit/level/*`、`economy/*`、`beat/*` |
| E5.S3 元循环 | `tests/unit/meta/*` |
| E8.S1/S3 垂直切片/双端 | §5 headless + §6 |
| E8.S2 IP 检查 | control-list §3 扫描脚本 |

> 测试骨架随 Epic 推进逐步"由骨架变真实"；本文件为 Phase 4 执行期的测试工作总纲。
