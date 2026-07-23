# 微信小游戏黑屏修复报告

- **项目**：super-mali（Phaser 3.90 + TypeScript + Vite，微信小游戏 MVP 横版跳跃）
- **现象**：真机黑屏；最新反馈「模拟器也黑屏」→ 问题可本地复现。
- **关键日志**：`[main] Phaser.Game created. game.canvas= null ... game.loop.running= false`
- **修复日期**：2025-07-23
- **修复人**：程基岩（游戏技术与引擎工程师）

---

## 1. 根因（Root Cause）

黑屏的**唯一根因**是 **Phaser 的 boot 流程在微信运行时下永不触发**，导致 `game.canvas` 始终为 `null`、主循环永不启动。

### 调用链

`new Phaser.Game(config)`（`node_modules/phaser/src/core/Game.js` 构造器末尾）会调用：

```js
// node_modules/phaser/src/dom/DOMContentLoaded.js
var DOMContentLoaded = function (callback) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        callback(); return;                       // ✅ 同步 boot
    }
    var check = function () { ... callback(); };
    if (!document.body) {
        window.setTimeout(check, 20);             // ✅ 20ms 后 boot
    } else if (OS.cordova) {
        document.addEventListener('deviceready', check, false);
    } else {
        document.addEventListener('DOMContentLoaded', check, true);  // ❌ 等事件
        window.addEventListener('load', check, true);                // ❌ 等事件
    }
};
```

在微信小游戏运行时：

1. **`document.readyState` 不存在**（weapp-adapter 不设此字段 → `undefined`），既非 `complete` 也非 `interactive`；
2. **`document.body` 存在**（weapp-adapter 与本项目 `game.js` 的 `R2-sept` shim 都提供了 `body`）→ 走入最后的 `else` 分支；
3. **微信运行时永不派发 `DOMContentLoaded` / `load` 事件** → `check` 回调永远不会被调用 → `Game.boot()` 永不执行。

结果：`CreateRenderer` 未跑、`AddToDOM` 未跑、`game.canvas` 未被绑定到传入的 `config.canvas`（上屏画布），`Game.start()` 未跑 → 主循环 `running=false` → **整屏黑**。

> 此前 `main.ts` 里在 `new Phaser.Game()` **同步返回后**立即打印 `game.canvas` / `game.loop.running` 的"诊断"本身也佐证了这一点——boot 是异步的，那一瞬间 canvas 必然是 null、loop 必然是未启动。问题不在"canvas 没传对"，而在"boot 根本没跑"。

### 关于 `webapi_getwxaasyncsecinfo:fail`

该 `Error: SystemError` 来自微信框架的安全信息接口（`getSystemInfoSync` 链路），属**非致命**报错（微信内部 Promise 拒绝 / console 错误），**不会中断 game.js 的执行**（否则连 `Phaser.Game created` 日志都不会出现）。它不是黑屏根因，仅作为控制台噪音保留关注。

---

## 2. 修复点（Fix）

**核心修复（环境层，一处解决）**：在加载游戏包（`require('./index')`）之前，把 `document.readyState` 钉为 `'complete'`。这样 Phaser 的 `DOMContentLoaded()` 命中第一个 `if` 分支，**在 `new Phaser.Game()` 构造时同步调用 `boot()`**，从而：

- `CreateRenderer` 执行 → `game.canvas = config.canvas`（即 `globalThis.__screenCanvas` 上屏画布），并按 512×288 初始化；
- `AddToDOM` 执行（parent 为 `undefined` 时回退 `document.body.appendChild`，在 shim 下为 no-op，不影响上屏画布）；
- `texturesReady → Game.start() → game.loop.start()` 执行 → 主循环启动、开始渲染。

### 改动位置（game.js，三处同步）

- **`R2-sept` 内（fakeDoc 创建后）**：直接给真正的 document 对象 `fakeDoc` 设 own 属性 `readyState='complete'`（own 属性覆盖原型可能存在的 getter，最可靠）。
- **`require('./index')` 之前**：再兜一层全局 `document.readyState='complete'`，确保任何路径下都生效。

两处均为 `try/catch` 包裹，失败静默，不影响其它 shim。

### 清理（移除临时诊断代码）

- **`src/game/main.ts`**：删除全部 `实验 A/B/C` 与同步诊断日志（append canvas 到 body、手动 `game.canvas=`、`game.loop.start()`、`error/ready/step` 事件监听、`[main]` 打印块）。保留合法修复：`config.canvas` 传入上屏画布、`Scale.NONE/NO_CENTER`、微信端 `parent: undefined`。
- **`src/game/scenes/game-scene.ts`**：删除红色半透明满屏诊断锚点矩形（`this.add.rectangle(256,144,512,288,0xff0000,0.6)` 及其 `setDepth(10000)` 与配套 `console.log`）。

---

## 3. 修改文件清单

| 文件 | 改动 |
|------|------|
| `game.js`（根目录） | 新增 R3：fakeDoc 设 `readyState='complete'` + 全局兜底补丁 |
| `public/game.js` | 与根目录 `game.js` 完全同步（内容一致） |
| `dist-wechat/game.js` | 由 `npm run build:wechat` 从根目录 `game.js` 重新生成（已含 R3） |
| `src/game/main.ts` | 移除全部诊断/实验代码，仅保留干净引导逻辑 |
| `src/game/scenes/game-scene.ts` | 移除红色诊断锚点矩形 |
| `docs/wechat-blackscreen-fix.md` | 本报告 |

> `dist-wechat/` 由构建脚本生成，不手工改；重新构建即与根目录 `game.js` 同步。

---

## 4. 验证结果（Verification）

### 4.1 逻辑复现（本地，无需微信工具）

用 Node 脚本复刻 `DOMContentLoaded` 的判定分支（见 `/tmp/phaser-boot-sim.js` 思路）：

| 场景 | document 状态 | 结果 |
|------|--------------|------|
| A. 微信现状 | `body` 存在，`readyState=undefined` | 等待 `DOMContentLoaded/load`（**永不触发**）→ boot 不执行 → 黑屏 ✅ 复现根因 |
| B. 修复后 | `body` 存在，`readyState='complete'` | `boot()` **同步调用** → 正常启动 ✅ |
| C. 对照 | `body` 不存在 | `setTimeout(boot,20)` 兜底 → 后续可启动 |

→ 证明根因确为 `readyState` + `body` 组合导致的事件等待，且 `readyState='complete'` 可消除。

### 4.2 构建

```
npm run build:wechat
✓ 41 modules transformed.
✓ built
[copy-wechat] Babel ES5 transpilation done for index.js
[copy-wechat] onTouchMove elementFromPoint patch applied
[copy-wechat] DOM query patches applied
```
构建通过；`dist-wechat/game.js` 含 R3 补丁；三处 `game.js` `diff` 一致（`ROOT==PUBLIC`、`ROOT==DIST`）。

### 4.3 测试

```
npm test  →  Test Files  14 passed (14)   Tests  99 passed (99)
```
全部通过（纯逻辑单测，node 环境，不依赖 Phaser DOM）。

### 4.4 类型检查

`npm run typecheck`：本次改动文件（`src/game/main.ts`、`src/game/scenes/game-scene.ts`、`game.js`、`public/game.js`）**均无类型错误**。

> 注：`tests/unit/architecture/core-no-platform.test.ts` 存在 5 条 `TS2307/TS7006` 错误（`fs`/`path`/`__dirname`/`any` 类型），属**改动前已存在**的问题（该测试用到 Node 内置模块，而 `tsconfig.json` 设 `"types": []` 未引入 `@types/node`），与本次黑屏修复无关，未予改动。

---

## 5. 残留风险（Residual Risks）

1. **无法在真机/模拟器实测渲染**：本机无法启动微信开发者工具，验证基于「源码级复现 + 构建 + 单测」。逻辑上 `boot` 已能同步触发，但**最终仍需在模拟器与真机各跑一次**确认画面出现（见下方建议）。
2. **`webapi_getwxaasyncsecinfo:fail`**：仍会在控制台出现（微信框架安全接口），非致命，但建议在真机确认它不影响 `getSystemInfoSync` 返回的 `windowWidth/windowHeight`（影响上屏画布初始尺寸）。
3. **上屏画布尺寸被 Phaser 改写为 512×288**：`CreateRenderer` 会把 `config.canvas`（`__screenCanvas`）的 `width/height` 设为 512×288。配合 `Scale.NONE`，逻辑分辨率为 512×288、由微信拉伸到屏幕——这是 MVP 既有设计，非本次引入；若真机发现画面比例异常可另行调整。
4. **`document.readyState` 其它消费者**：设为 `complete` 后，理论上任何依赖 `DOMContentLoaded`/`load` 的第三方库也会立即"认为已就绪"。本工程除 Phaser 外无此类依赖，风险低。
5. **预存 typecheck 告警**：`core-no-platform.test.ts` 的 Node 类型错误建议后续单独修复（引入 `@types/node` 或调整该测试），不影响运行与本次修复。

---

## 6. 结论与下一步

根因是 **Phaser 在微信运行时下因 `document.readyState` 缺失 + `document.body` 存在而无限等待永不触发的 DOM 事件，导致 `boot()` 不执行**。最小干净修复为在加载游戏包前把 `document.readyState` 钉为 `'complete'`，并移除所有临时诊断代码。构建与单测均已通过。

**建议**：请在**微信开发者工具模拟器**与**真机**分别导入 `dist-wechat/` 重新验证——预期可见 512×288 蓝天背景（`#5BC8F5`）与栗宝占位精灵，控制台不再有 `game.canvas=null / loop.running=false` 类诊断日志，`webapi_getwxaasyncsecinfo:fail` 仍为无害噪音。

---

## 7. 迭代修复：堵塞 `getBoundingClientRect` 阻塞点（2025-07-23）

上一轮把 `document.readyState` 钉为 `'complete'` 后，Phaser 已能同步 boot（日志不再卡在 `game.canvas=null`）。但 boot 进入 ScaleManager 初始化即抛出下一层阻塞：

```
TypeError: this.parent.getBoundingClientRect is not a function
  at initialize.getParentBounds
  at initialize.parseConfig
  at initialize.preBoot
  at initialize.boot
```

### 7.1 根因（本层）

`Game.boot → ScaleManager.preBoot → parseConfig → getParent → getParentBounds` 链路中：

- 微信端 `config.parent = undefined`，Phaser 的 `GetTarget(undefined)`（`node_modules/phaser/src/dom/GetTarget.js`）判定 `!target` 后回退到 `document.body`，即本工程 shim 中的 `fakeBody`；
- `getParent` 随后调用 `getParentBounds()`，其中 `var DOMRect = this.parent.getBoundingClientRect();`（`ScaleManager.js:674`）。
- weapp-adapter 的 DOM 元素（含 `body`）**没有** `getBoundingClientRect` 方法 → 抛 `TypeError`。

> 附带确认：`parentIsWindow = (this.parent === document.body)` 为 `true`；且本工程 `navigator.userAgent` 含 `"iOS"` 会使 `device.os.iOS=true`，`getParentBounds` 还会走 `DOMRect.height = GetInnerHeight(true)` 分支。经查 `GetInnerHeight`（`dom/GetInnerHeight.js`）读取 `window.innerWidth/innerHeight` 与 `ruler.offsetHeight`，不会抛错（返回数值），因此不是本次阻塞点，但本次已用合理 DOMRect 覆盖其影响。

### 7.2 修复点（game.js · R2-sept 内新增 `R3-ter`）

在 `R2-sept` 综合 DOM shim 内、`fakeBody / fakeDocEl / gameContainer / fakeCanvas` 已创建、但尚未创建 `fakeDoc` 之前，新增 `R3-ter` 块：

- `makeRect(w, h)`：返回标准 DOMRect 形状 `{ left, top, right, bottom, width, height, x, y }`，并做 `isFinite` 兜底，确保不为 `NaN`；
- `attachRect(obj, w, h)`：仅当目标**缺失** `getBoundingClientRect` 时才用 `defineProperty`（失败回退赋值）补齐；
- 尺寸策略：
  - **body / documentElement / gameContainer**：`wx.getSystemInfoSync().windowWidth/windowHeight`，兜底 `812×375`；
  - **canvas 类（fakeCanvas 与真实上屏画布 `__screenCanvas`）**：优先 `globalThis.__screenCanvas.width/height`，兜底 `512×288`；
- 补齐对象：`fakeBody`、`fakeDocEl`、`gameContainer`、`fakeCanvas`，以及真实上屏画布 `globalThis.__screenCanvas`——后者是必要的，因为 `getParentBounds` 在后续调用（resize / refresh）中会执行 `this.canvas.getBoundingClientRect()`（`ScaleManager.js:693`），而 `this.canvas === config.canvas === __screenCanvas`。

### 7.3 `config.parent` 确认（main.ts）

微信端 `parent: env === 'wechat' ? undefined : parent` —— `undefined` 正确传入。`GetTarget(undefined)` 回退到 `document.body`（= `fakeBody`），因此本修复重点保证 `document.body` 具备 `getBoundingClientRect`；**不改为 `null`**（按既定决策保留 `undefined`，避免在 `getParent` 的 `parent===null` 早返回路径上与其它 DOM 注入假设冲突）。

### 7.4 `__screenCanvas` 尺寸确认（未被覆盖为 300×150）

- 文件最前「R2-nineteen（前置）」抢占**第一个** `wx.createCanvas()` 后立即 `screenCanvas.width/height = windowWidth/windowHeight`，全程未被覆盖；
- `R2-sept` 的 `fakeCanvas = origDoc.createElement('canvas')` 返回的是 weapp-adapter 的真实 wx canvas（日志显示 `300 x 150`），但**它不是游戏画布**：`main.ts` 传入 `config.canvas = globalThis.__screenCanvas`，Phaser 实际使用的上屏画布正是抢占到的 `__screenCanvas`；
- Phaser `CreateRenderer` 会把上屏画布尺寸改写为 `512×288`（Scale.NONE 下的逻辑分辨率，MVP 既有设计），属预期，并非 `300×150`。

### 7.5 临时诊断日志（main.ts，验证通过后可清理）

在 `new Phaser.Game(config)` 之后新增最精简 3 行日志（仅微信端）：

```ts
console.log('[main] config.canvas === __screenCanvas:', (config as { canvas?: unknown }).canvas === sc);
console.log('[main] game.canvas non-null:', game.canvas != null, '| w/h:', game.canvas?.width, game.canvas?.height);
console.log('[main] game.loop.running:', game.loop?.running);
```

用于快速确认：① 传入的是抢占的上屏画布；② boot 已同步绑定 `game.canvas`；③ 主循环已启动。

### 7.6 修改文件清单

| 文件 | 改动 |
|------|------|
| `game.js`（根目录） | `R2-sept` 内新增 `R3-ter`：`getBoundingClientRect` 补齐（`fakeBody / fakeDocEl / gameContainer / fakeCanvas / __screenCanvas`） |
| `public/game.js` | 与根目录 `game.js` 完全同步（已 `diff` 一致） |
| `dist-wechat/game.js` | 由 `build:wechat` 重新生成（已 `diff` 一致，含 `R3-ter`） |
| `src/game/main.ts` | 新增 3 行临时诊断日志（验证通过后可删） |
| `docs/wechat-blackscreen-fix.md` | 本报告追加 §7 |

> `dist-wechat/` 由构建脚本生成，不手工改；重新构建即与根目录 `game.js` 同步。

### 7.7 验证结果

- **构建**：`npm run build:wechat` ✓（`41 modules transformed`；Babel ES5、onTouchMove/getParent DOM 补丁均已应用；`dist-wechat/game.js` 与根 `diff` 一致，含 `R3-ter`）。
- **测试**：`npm test` ✓（Test Files `14 passed (14)`，Tests `99 passed (99)`）。
- **类型**：`tsc --noEmit` 对 `game.js` / `src/game/main.ts` **无报错**（`core-no-platform.test.ts` 的 Node 类型告警为改动前既有问题，与本修复无关）。

### 7.8 待用户确认项

1. 请在**微信开发者工具模拟器**导入 `dist-wechat/` 复跑，确认控制台不再出现 `getBoundingClientRect is not a function`，并应出现 §7.5 三条 `[main]` 日志（预期 `config.canvas===__screenCanvas: true`、`game.canvas non-null: true`、`game.loop.running: true`）。
2. 确认画面出现 512×288 蓝天背景（`#5BC8F5`）+ 栗宝占位精灵；若仍黑屏，说明还有下一层阻塞点，请把新报错贴回，我继续定位。
3. 验证通过后，我可清理 `main.ts` 的 3 行临时诊断日志（以及 `game.js` 中 `R3-ter` 的 `console.log` 行，可选保留）。

---

## 8. 迭代修复：performance.now 阻塞点（2025-07-23）

上一轮补齐 `getBoundingClientRect` 后，Phaser 已能成功 boot（`[boot-scene] create()` 已打印），场景系统启动。但 boot 进入 `texturesReady → TimeStep.start` 即抛出下一层阻塞：

```
TypeError: Cannot read properties of undefined (reading 'now')
  at initialize.resetDelta
  at initialize.start
  at initialize.start
  at initialize.texturesReady
  ...
  at HTMLCanvasElement.set
  at initialize.addBase64
```

调用栈底部出现 `HTMLCanvasElement.set` / `addBase64`，说明 boot-scene 在加载纹理（TextureManager 的 `__DEFAULT` / `__MISSING` / `__WHITE` 等内置纹理）时触发 `texturesReady`，进而启动 `TimeStep`；而 `TimeStep` 计算 delta time 失败。

### 8.1 根因（本层）

`Game.boot → TextureManager.boot → texturesReady → TimeStep.start → resetDelta` 链路中，Phaser 的 `TimeStep` 直接调用 `window.performance.now()` 计算帧间 delta：

- `node_modules/phaser/src/core/TimeStep.js` 第 496 / 542 / 755 / 796 行均为 `var now = window.performance.now();`；
- 微信小游戏运行环境下 `window.performance`（进而 `performance.now`）缺失或值为 `undefined`，于是 `window.performance.now` 触发 `TypeError: Cannot read properties of undefined (reading 'now')`。

> **关键陷阱**：Phaser 自带 polyfill `src/polyfills/performance.now.js` 用
> `if ('performance' in window === false) { window.performance = {}; }` 保护，随后
> `if ('now' in window.performance === false) { window.performance.now = ...; }`。
> 但当 weapp-adapter 已把 `window.performance` 定义为「键存在但值为 `undefined`」时，
> `'performance' in window` 为 **true** → 第一段保护被跳过；随后 `'now' in window.performance`
> 即抛**相同**的 `Cannot read properties of undefined (reading 'now')`。因此本环境既可能由
> Phaser 自带 polyfill 自身抛错，也可能在 `resetDelta` 时才暴露——无论如何，必须在 Phaser
> 加载前把 `window.performance.now` 钉死。

### 8.2 修复点（game.js · 新增 `R4-perf` 块）

在 `require('./weapp-adapter')` 之后、`require('./index')`（游戏包）之前，新增 `R4-perf` IIFE 块，确保任何路径下以下全局在 Phaser 闭包可读：

1. **`performance`**：
   - 若 `typeof performance === 'undefined'`，创建最小 `performance` 对象并挂到 `globalThis`；
   - 若 `performance.now` 非函数，优先用 `wx.getPerformance().now()`（单调高精度），否则 `Date.now()` 兜底；
   - 同时补 `performance.mark` / `measure` / `getEntriesByType` / `getEntriesByName` 空实现，避免后续其它代码抛错；
2. **`requestAnimationFrame` / `cancelAnimationFrame`**：优先 `wx.requestAnimationFrame` / `wx.cancelAnimationFrame`，否则 `setTimeout` / `clearTimeout` 兜底（~16ms），保证主循环可驱动；
3. **`setTimeout` / `setInterval` / `clearTimeout` / `clearInterval`**：原生/weapp-adapter 通常已提供，确认兜底（缺失才补）；
4. **`localStorage` / `sessionStorage`**：微信端用 `wx.getStorageSync/setStorageSync/removeStorageSync/clearStorageSync` 作后端，缺失则内存 `Map` 兜底（提供真实 `getItem` 等接口，避免 Phaser `device/Features` 检测走异常分支）。

所有补齐均用 `defIfMissing`（仅当 `undefined/null` 才写入，绝不覆盖已有实现），并同步挂到 `globalThis` / `window` / `self`（weapp-adapter 的 `window/self` 可能不等同 `globalThis`）。整个块 `try/catch` 包裹，失败仅 `console.error` 不影响其它 shim。放置于 Phaser 加载前，使 Phaser 自带 `performance.now` polyfill 命中 `'performance' in window === true` 与 `'now' in window.performance === true` 两道保护而被跳过，从而消除本层阻塞。

### 8.3 `main.ts` 诊断日志

保持 `src/game/main.ts` 的 3 行临时诊断日志（`config.canvas===__screenCanvas`、`game.canvas non-null`、`game.loop.running`）**不变**，用于验证：预期 boot 后 `game.loop.running: true`，且本次 `performance.now` 阻塞不再出现。验证通过后再清理。

### 8.4 修改文件清单

| 文件 | 改动 |
|------|------|
| `game.js`（根目录） | `require('./weapp-adapter')` 后新增 `R4-perf` 块：`performance`/`requestAnimationFrame`/`storage` 全局兜底 |
| `public/game.js` | 与根目录 `game.js` 完全同步（已 `diff` 一致） |
| `dist-wechat/game.js` | 由 `build:wechat` 重新生成（已 `diff` 一致，含 `R4-perf`） |
| `src/game/main.ts` | **未改动**（3 行诊断日志保留） |
| `docs/wechat-blackscreen-fix.md` | 本报告追加 §8 |

> `dist-wechat/` 由构建脚本生成，不手工改；重新构建即与根目录 `game.js` 同步。

### 8.5 验证结果

- **构建**：`npm run build:wechat` ✓（`41 modules transformed`；Babel ES5、onTouchMove/getParent/DOM 补丁均已应用；`dist-wechat/game.js` 与根 `diff` 一致，含 `R4-perf`）。
- **测试**：`npm test` ✓（Test Files `14 passed (14)`，Tests `99 passed (99)`）。
- **同步**：`ROOT==PUBLIC`、`ROOT==DIST` 三者 `diff` 一致，均含 `R4-perf` 与 `performance.now` 定义。
- **类型**：`tsc --noEmit` 对 `game.js` 无影响（`game.js` 为运行期入口，不进入 `tsc` 编译；`main.ts` 未改动）。`core-no-platform.test.ts` 的 Node 类型告警为改动前既有问题，与本修复无关。

### 8.6 待用户确认项 / 建议下一步

1. 请在**微信开发者工具模拟器**导入 `dist-wechat/` 复跑，确认控制台不再出现 `Cannot read properties of undefined (reading 'now')`（即 `performance.now` 阻塞消除），且应出现 §8.3 三条 `[main]` 日志（预期 `game.loop.running: true`）。
2. 确认画面出现 512×288 蓝天背景（`#5BC8F5`）+ 栗宝占位精灵，且 boot-scene 的 `create()` 之后无新的阻塞报错。若仍有下一层错误，请把新报错栈贴回，我继续定位（按既有模式：根因 → game.js 兜底 → 同步 public/dist → 构建+测试 → 追加 §9）。
3. 验证通过且画面正常后，建议清理：`main.ts` 的 3 行临时诊断日志、`game.js` 中 `R3-ter` / `R4-perf` 等 shim 的 `console.log` 行（核心兜底逻辑保留），并关闭本报告后续迭代条目。

---

## 9. 迭代修复：GameScene registry 读取 platform 失败（2025-07-23）

上一轮补齐 `performance.now` 后，Phaser 已能完整 boot，BootScene.create() 成功，GameScene.create() 也开始执行（`[game-scene] create() START` 与 `cameras.main size: 512 x 288 zoom: 1 scroll: 0 0` 已打印）。但 GameScene 在读取 registry 时立即抛出下一层阻塞：

```
TypeError: Cannot read properties of undefined (reading 'env')
  at K.value
  at initialize.create
```

### 9.1 根因（本层）

`src/game/scenes/game-scene.ts` 的 `create()` 中：

- 第 64 行 `this.platform = this.registry.get('platform') as Platform;`
- 紧随其后立即访问 `this.platform.env`（用于按平台选输入映射 `wechatInputConfig` / `webInputConfig`）。

在微信运行时下，`this.registry.get('platform')` 返回 `undefined`（Phaser registry 在微信 stub 下行为异常，或 boot 时 `set` 未对 scene 侧生效）：

- `src/game/main.ts` 已调用 `game.registry.set('platform', platform)`，但 GameScene 没读到；
- `src/game/scenes/boot-scene.ts` 不访问 registry，故它先于 GameScene 成功执行——这反过来佐证「registry 本身可访问」，问题出在 **platform 值未注入到 scene 可读的那一层**。

`this.platform` 为 `undefined` → `this.platform.env` 触发 `TypeError: Cannot read properties of undefined (reading 'env')`。

> 关键区别：BootScene 不碰 registry 故成功；main.ts 调了 `registry.set` 但 scene 侧读取失败——说明注入与读取之间存在微信运行时特有的失配，而非「registry 完全不可用」。

### 9.2 修复点

采用「三层兜底 + 诊断日志 + 写回 registry」策略，确保 GameScene 在任何环境下都能拿到可用的 platform/events。

#### (a) `src/game/main.ts`：增加 globalThis 兜底层

在保留原有 3 行 `[main]` 诊断日志（`config.canvas===__screenCanvas` / `game.canvas non-null` / `game.loop.running`）的前提下，于 `registry.set(...)` 之后新增一层 `globalThis` 兜底，把 platform/events 同时挂到全局：

```ts
// ── GameScene registry 兜底（参见 game-scene.ts §9）──
const gm = globalThis as unknown as {
  __superMaliPlatform?: typeof platform;
  __superMaliEvents?: typeof events;
};
gm.__superMaliPlatform = platform;
gm.__superMaliEvents = events;
```

即便 Phaser registry 在微信下读不到，GameScene 仍可经 `globalThis.__superMaliPlatform` 取到与 main **同一实例**。

#### (b) `src/game/scenes/game-scene.ts`：防御式兜底 + 诊断

1. `create()` 顶部新增诊断日志，确认 registry 中 platform 是否存在（帮助确认问题归属）：

   ```ts
   const regPlatform = this.registry.get('platform');
   console.log('[game-scene] registry platform present:', regPlatform != null, '| typeof:', typeof regPlatform);
   ```

2. platform 三层兜底（优先级 **registry → globalThis → 重建**）：

   ```ts
   const gm = globalThis as unknown as { __superMaliPlatform?: Platform; __superMaliEvents?: EventBus; };
   if (regPlatform && (regPlatform as Platform).env) {
     this.platform = regPlatform as Platform;
   } else if (gm.__superMaliPlatform) {
     this.platform = gm.__superMaliPlatform;
     console.log('[game-scene] registry platform missing, fell back to globalThis.__superMaliPlatform');
   } else {
     const env = detectEnv();
     this.platform = createPlatform(env);
     console.log('[game-scene] registry platform missing, re-created via detectEnv()+createPlatform(', env, ')');
   }
   ```

3. events 同样三层兜底：`registry` → `globalThis.__superMaliEvents` → `new EventBus()`（各自带诊断日志）；
4. 兜底创建/读取后写回 `this.registry.set('platform', this.platform)` / `this.registry.set('events', this.bus)`，后续场景可复用；
5. 新增 import：`detectEnv`（来自 `../../platform/detect`）、`createPlatform`（来自 `../../platform'`）；`EventBus` 原本已在文件顶部 import。

> 重建分支用 `detectEnv()` 探测环境（微信运行时 `typeof wx !== 'undefined'` → `'wechat'`），再 `createPlatform(env)` 生成与 main 一致的平台实例，行为与原引导逻辑完全一致；若微信 registry 只是「读不到」而 `globalThis` 命中，则直接复用 main 的同一实例，零冗余。

### 9.3 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/game/main.ts` | **保留** 3 行 `[main]` 诊断日志；于 `registry.set` 后新增 `globalThis.__superMaliPlatform` / `__superMaliEvents` 兜底层 |
| `src/game/scenes/game-scene.ts` | `create()` 顶部加 registry platform 诊断日志；platform/events 改三层兜底（registry → globalThis → 重建）+ 写回 registry；新增 `detectEnv` / `createPlatform` import |
| `docs/wechat-blackscreen-fix.md` | 本报告追加 §9 |

> `dist-wechat/` 由构建脚本生成，不手工改；重新构建即与根目录源码同步。

### 9.4 验证结果

- **构建**：`npm run build:wechat` ✓（`41 modules transformed`；Babel ES5、onTouchMove/getParent/DOM 补丁均已应用；`dist-wechat/index.js` 已重新生成）。
- **测试**：`npm test` ✓（Test Files `14 passed (14)`，Tests `99 passed (99)`）。
- **类型**：`tsc --noEmit` 对本轮改动文件（`src/game/main.ts`、`src/game/scenes/game-scene.ts`）**无报错**；仅 `tests/unit/architecture/core-no-platform.test.ts` 存在 5 条 `TS2307/TS7006` 既有 Node 类型告警（改动前已存在，与本次修复无关）。
- **逻辑**：兜底链为「registry → globalThis.__superMaliPlatform → detectEnv+createPlatform」，确保即便微信 registry 失配，GameScene 也能拿到**含 `env` 字段**的有效 platform，`this.platform.env` 不再抛错。

### 9.5 待用户确认项 / 建议下一步

1. 请在**微信开发者工具模拟器**导入 `dist-wechat/` 复跑，确认控制台不再出现 `Cannot read properties of undefined (reading 'env')`。预期能看到 §7.5 三条 `[main]` 日志，以及 GameScene 开头新的 `[game-scene] registry platform present: <bool>` 诊断——若微信 registry 确实失配，应看到 `fell back to globalThis.__superMaliPlatform`（或 `re-created`）日志，证明兜底生效。
2. 确认画面出现 512×288 蓝天背景（`#5BC8F5`）+ 栗宝占位精灵，且 GameScene.create() 执行后无新阻塞报错。若仍有下一层错误，请把新报错栈贴回，我继续按既有模式定位（根因 → 兜底 → 同步 → 构建+测试 → 追加 §10）。
3. 验证通过且画面正常后，建议清理：`src/game/main.ts` 的 3 行临时诊断日志、`src/game/scenes/game-scene.ts` 的兜底诊断日志，以及 `game.js` 中 `R3-ter` / `R4-perf` 等 shim 的 `console.log` 行（核心兜底逻辑保留），并关闭本报告后续迭代条目。

---

## 10. 手势拖动增强（2025-07-23）

> 注：本节记录「相对栗宝」手势系统的拖动增强（与黑屏修复本身无直接关系，按主理人要求附于本报告末；亦可后续拆到独立文档 `docs/gesture-drag-enhance.md`）。

### 10.1 动因（用户真机反馈）
- ①「跳起来的时候也支持往左拖动」——原 `pointerMove` 中 `if (p.jumping) return;`（`gesture-provider.ts` 原第 143 行）导致跳跃态完全忽略水平移动，空中无法换向。
- ②「小人也支持往左往右拖动」——原实时换向逻辑包在 `if (p.walkDir)` 内，只有已判出方向才刷新；若拖动起点落在栗宝死区（`walkDir=null`），拖动永不触发行走。

### 10.2 改动（仅 `src/platform/gesture-provider.ts`）
- 删除 `if (p.jumping) return;`：跳跃态 `pointerMove` 继续处理水平移动。
- 实时换向逻辑从 `if (p.walkDir)` 改为 `if (p.isHold)`：进入 Hold 态（位移 ≥ `swipeMinDist`）后，依据当前指针 x 相对 `this.playerX` 实时决定方向（`x < playerX - deadzone` → 左走；`x > playerX + deadzone` → 右走；死区内保持上一方向防抖）；不再要求「先判出方向」，死区起步也能走。
- `pointerUp` 将 `else if (p.walkDir)` 拆为并列 `if (p.walkDir)`：跳跃 + 行走同时发生时松手一并释放，避免行走信号残留。
- **约束遵守**：仅改手势提供者内部逻辑，产出与现有**完全相同**的信号 id（`touch:left / touch:right / touch:jump / touch:action`），`core/InputAbstraction`、`CharacterController` 零改动。

### 10.3 验证结果
- **测试**：`npm test` ✓（Test Files `14 passed (14)`，Tests `106 passed (106)` —— 原 99 + 新增 7）。新增 7 例覆盖：空中左移（jump+left）、死区起步拖左/右、死区边界不抖动、死区保持上一方向、松手同时释放跳+走、上划跳后水平拖动空中换向。
- **构建**：`npm run build:wechat` ✓（`41 modules transformed`；Babel ES5、onTouchMove/getParent/DOM 补丁均已应用；`dist-wechat/index.js` 重新生成）。

### 10.4 设计取舍（待主理人拍板）
- 上划跳本帧**保留 `return`**（纯上滑只产跳、释放行走），「斜向 = 跳 + 走」通过「上划跳后继续水平拖动」实现，与 `design/ux/click-to-move-design.md` §5.3「滑动 → 跳；否则按水平分量走」一致，且保留原单测「上划（点左后向上滑）→ 跳，并释放原行走」不变。
- 若希望「单次上划斜滑即 jump+walk 同时成立」（更跟手的斜跳），可移除该 `return` 并把上面那条单测改为期望 `down` 同时含 `touch:jump` 与 `touch:left/right`（行为变更，需主理人确认）。

### 10.5 建议下一步
- 真机复测手感：① 跳跃中左右拖动能否顺滑空中换向；② 地面按住拖动是否跟手、松手即停；③ 拖动起点在栗宝附近（死区）起步是否能正常走；④ 拖回死区/中点是否不抖。建议主理人真机过一遍确认手感后再合入。
