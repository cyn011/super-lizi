// 微信小游戏入口（开发者工具导入 dist-wechat/ 后读取此文件）。
// 注意顺序：
// 1. 先注入 navigator polyfill（WAPCAdapter 真机调试路径在 weapp-adapter 加载期就会访问 navigator）。
// 2. 再加载 weapp-adapter 注入 canvas/document/window 全局。
// 3. 最后启动游戏包。

// ── R2-nineteen（前置）：上屏画布必须在最前、且仅创建一次 ─────────────────────
// 微信小游戏里只有**第一个** wx.createCanvas() 是上屏画布（screen canvas），
// 后续调用都返回离屏画布。必须在任何 stub / weapp-adapter / Phaser 之前抢占，
// 否则 R2-twenty-b 的 createElement('canvas') 或 weapp-adapter 加载期可能抢先
// 创建 canvas 吃掉第一个，导致这里拿到离屏画布 → 黑屏。
// 见下方原 R2-nineteen 位置已改为 no-op。

// ── console 静音（生产环境只保留 error，避免加载期屏幕/调试面板刷"代码"）──
// 微信端 game.js 含大量防御性 console.error（polyfill 兜底），且 Phaser 启动期
// 也会输出日志；这些在开发者工具 Console / 真机 vConsole 会刷成"代码"。
// 生产环境静音 log/warn/info/debug，仅保留 error 便于真机排查致命问题。
(function () {
  try {
    var __DEBUG__ = false; // 需要排查时改 true，恢复全部 console 输出
    if (__DEBUG__) return;
    var noop = function () {};
    if (typeof console !== 'undefined' && console) {
      console.log = noop;
      console.warn = noop;
      console.info = noop;
      console.debug = noop;
    }
  } catch (_) {}
})();

(function () {
  try {
    if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
      var screenCanvas = wx.createCanvas();
      // 上屏画布固定为游戏逻辑分辨率 512×288，让 Phaser 输入坐标与逻辑坐标 1:1。
      // 微信会自动把 canvas 拉伸到全屏；像素风游戏放大后反而更协调。
      // 若设成屏幕窗口大小（如 1170×540），Scale.NONE 模式下 Phaser 不会把触屏
      // 像素坐标换算回 512×288，导致标题页按钮等 Phaser 交互对象点不中。
      screenCanvas.width = 512;
      screenCanvas.height = 288;
      globalThis.__screenCanvas = screenCanvas;
      if (typeof window !== 'undefined') window.__screenCanvas = screenCanvas;
    } else {
    }
  } catch (e) {
    console.error('[R2] capture screenCanvas failed:', e && e.message ? e.message : e);
  }
})();

// ── 启动 Loading 页（覆盖 bundle 解析期黑屏）────────────────────────────
// 微信端 Phaser 用 CANVAS 渲染器（2d context），与下方 loading 共用同一个上屏画布，
// 互不冲突；Phaser 初始化后接管 canvas 自然覆盖本内容。
// 关键：在 require('./index')（1.79MB Phaser 包同步解析 1-3s）之前先画出，
// 避免这段时间内 screenCanvas 全空 → 黑屏。
(function () {
  try {
    var c = globalThis.__screenCanvas;
    if (!c || typeof c.getContext !== 'function') return;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    var W = c.width || 512, H = c.height || 288;
    // 品牌底色（与游戏备用背景一致，避免突兀的黑/白闪烁）
    ctx.fillStyle = '#3a7ca5';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#F4EFE6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('栗宝大冒险', W / 2, H / 2 - 16);
    ctx.font = '15px sans-serif';
    ctx.fillText('加载中...', W / 2, H / 2 + 20);
  } catch (_) {}
})();

// ── R2-twenty：navigator polyfill shim（必须最前）───────────────────────────────
// 微信小游戏的 weapp-adapter / WAPCAdapter 真机调试路径会在早期访问
// navigator.userAgent / navigator.platform 做特性检测（链路：getFixedWindowSize
// → calculateWindowConfig → adjustSystemInfo → invoke）。若不在 weapp-adapter
// 加载前注入，真机调试报 `Uncaught ReferenceError: navigator is not defined`。
// 这里给一个最小可用的 navigator stub：常用字段全部填齐。
(function () {
  try {
    if (typeof navigator === 'undefined' || navigator === null) {
      var sysInfo = {};
      try {
        if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
          sysInfo = wx.getSystemInfoSync();
        }
      } catch (_) {}
      var fakeNav = {
        userAgent: 'Mozilla/5.0 (WeChat MiniGame; ' + (sysInfo.system || 'iOS') + ') AppleWebKit/0',
        platform: (sysInfo.platform || 'wechat').toLowerCase(),
        language: sysInfo.language || 'zh-CN',
        languages: [sysInfo.language || 'zh-CN'],
        vendor: 'WeChat',
        appVersion: '5.0',
        appName: 'WeChatMiniGame',
        product: 'Gecko',
        productSub: '20030107',
        onLine: true,
        cookieEnabled: false,
        standalone: true,
        maxTouchPoints: 5,
        connection: { type: 'unknown', effectiveType: '4g' },
      };
      try { Object.defineProperty(globalThis, 'navigator', { value: fakeNav, writable: true, configurable: true }); } catch (_) { globalThis.navigator = fakeNav; }
      if (typeof window !== 'undefined' && typeof window.navigator === 'undefined') {
        try { Object.defineProperty(window, 'navigator', { value: fakeNav, writable: true, configurable: true }); } catch (_) { window.navigator = fakeNav; }
      }
    }
  } catch (e) {
    console.error('[R2] navigator polyfill failed:', e && e.message ? e.message : e);
  }
})();

// ── R2-twenty-b：minimal document/window/self stub before weapp-adapter ──
// 真机路径：weapp-adapter / WAPCAdapter 在加载期就可能访问 document / window /
// self（与 navigator 同理）。若仅在最前注入 navigator，则 weapp-adapter 加载时
// 访问 document 会爆 `ReferenceError: document is not defined`（模拟器能跑，真机炸）。
// 这里在 require('./weapp-adapter') 之前先放一个最小占位对象，weapp-adapter 随后
// 会替换/增强它们。globalThis 上的定义全部 writable+configurable 以便后续覆盖。
// 注意：不要改动 require('./weapp-adapter') 之后的 R2-sept 等 document 综合 shim。
(function () {
  try {
    // 占位元素工厂：createElement 返回的最小对象，模拟浏览器元素的方法集。
    function makeStubEl(tag) {
      return {
        tagName: (tag || 'DIV').toUpperCase(),
        style: {},
        width: 0,
        height: 0,
        clientWidth: 0,
        clientHeight: 0,
        offsetWidth: 0,
        offsetHeight: 0,
        getContext: function () { return null; },
        appendChild: function (c) { return c; },
        removeChild: function (c) { return c; },
        addEventListener: function () {},
        removeEventListener: function () {},
        setAttribute: function () {},
        getAttribute: function () { return null; },
      };
    }

    // 1. 最小 document stub（weapp-adapter 随后会替换 document 本身）
    if (typeof globalThis.document === 'undefined' || globalThis.document === null) {
      var stubDoc = {
        body: {},
        documentElement: {},
        createElement: function (tag) {
          if (tag && tag.toLowerCase() === 'canvas') {
            try {
              if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
                var c = wx.createCanvas();
                return c;
              }
            } catch (e) {
            }
          }
          return makeStubEl(tag);
        },
        getElementById: function () { return null; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        elementFromPoint: function () { return globalThis.__screenCanvas || null; },
        addEventListener: function () {},
        removeEventListener: function () {},
      };
      try { Object.defineProperty(globalThis, 'document', { value: stubDoc, writable: true, configurable: true }); }
      catch (_) { globalThis.document = stubDoc; }
      if (typeof globalThis.window !== 'undefined') {
        try { Object.defineProperty(globalThis.window, 'document', { value: stubDoc, writable: true, configurable: true }); }
        catch (_) { globalThis.window.document = stubDoc; }
      }
    }

    // 2. 最小 window stub（指向 globalThis）
    if (typeof globalThis.window === 'undefined' || globalThis.window === null) {
      try { Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true, configurable: true }); }
      catch (_) { globalThis.window = globalThis; }
    }

    // 3. 最小 self stub（指向 globalThis）
    if (typeof globalThis.self === 'undefined' || globalThis.self === null) {
      try { Object.defineProperty(globalThis, 'self', { value: globalThis, writable: true, configurable: true }); }
      catch (_) { globalThis.self = globalThis; }
    }

  } catch (e) {
    console.error('[R2] document/window/self stub failed:', e && e.message ? e.message : e);
  }
})();

// ── R2-nov：EventTarget polyfill for window/document/canvas ───────────────────
// 微信小游戏环境没有浏览器标准的 addEventListener/removeEventListener/dispatchEvent。
// Phaser 3.90 的 ScaleManager / InputManager / Audio 等会在 boot 期调用
// window.addEventListener / canvas.addEventListener；缺失则抛
// `e.addEventListener is not a function` 并中断部分初始化。
// 这里给全局对象和上屏画布补一个最小 EventTarget：允许注册/注销/派发事件。
// 后续 wx.onTouch* 再把触摸事件派发到 canvas，Phaser 的 pointer 输入即可工作。
(function () {
  try {
    function makeEventTarget(obj) {
      if (!obj || typeof obj.addEventListener === 'function') return;
      var listeners = {};
      obj.addEventListener = function (type, fn /*, options */) {
        (listeners[type] = listeners[type] || []).push(fn);
      };
      obj.removeEventListener = function (type, fn /*, options */) {
        var arr = listeners[type];
        if (!arr) return;
        var idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      };
      obj.dispatchEvent = function (event) {
        var arr = listeners[event.type] || [];
        for (var i = 0; i < arr.length; i++) {
          try { arr[i](event); } catch (_) {}
        }
        return true;
      };
    }

    makeEventTarget(globalThis);
    if (typeof window !== 'undefined' && window !== globalThis) makeEventTarget(window);
    if (typeof document !== 'undefined') makeEventTarget(document);
    if (globalThis.__screenCanvas) makeEventTarget(globalThis.__screenCanvas);
  } catch (e) {
    console.error('[R2-nov] EventTarget polyfill failed:', e && e.message ? e.message : e);
  }
})();

require('./weapp-adapter');

// ── R4-perf：performance / requestAnimationFrame / storage 全局兜底 ──
// 微信小游戏运行环境下以下 Phaser 启动链路依赖的全局可能缺失或不完整：
//   1. performance / performance.now —— Phaser TimeStep.resetDelta/start（src/core/TimeStep.js:496/542/755/796）
//      直接调用 window.performance.now() 计算 delta time；缺失则
//      `TypeError: Cannot read properties of undefined (reading 'now')`（本次阻塞点）。
//      注意：Phaser 自带 polyfill（src/polyfills/performance.now.js）用
//      `if ('performance' in window === false) window.performance = {}` 保护，但当 weapp-adapter
//      已把 window.performance 定义为 undefined 值时该判断为 true 被跳过，随后
//      `'now' in window.performance` 即抛相同错误；故此处必须在 Phaser 加载前自行钉死。
//   2. requestAnimationFrame / cancelAnimationFrame —— Phaser dom/RequestAnimationFrame 主循环
//      默认走 window.requestAnimationFrame；weapp-adapter 不一定映射，缺则主循环无法驱动。
//   3. setTimeout / setInterval —— JS 运行时原生具备，weapp-adapter 也会注入；确认兜底。
//   4. localStorage / sessionStorage —— Phaser device/Features 等模块可能访问（Features.js 有 try/catch，
//      但缺失会让检测走 false 分支；提供真实后端更稳）。
//
// 策略：仅在缺失/不完整时补齐（绝不覆盖已有实现），并挂到 globalThis / window / self，
// 确保 Phaser 闭包（通过 window/globalThis）均能读到。用 wx.* 后端提升精度，缺失则内存/Date 兜底。
(function () {
  try {
    var g = globalThis;
    var targets = [g];
    try { if (typeof window !== 'undefined' && window) targets.push(window); } catch (_) {}
    try { if (typeof self !== 'undefined' && self && self !== g) targets.push(self); } catch (_) {}

    function defIfMissing(obj, prop, value) {
      try {
        if (obj[prop] === undefined || obj[prop] === null) {
          try {
            Object.defineProperty(obj, prop, { value: value, writable: true, configurable: true });
          } catch (_) { obj[prop] = value; }
        }
      } catch (_) {}
    }

    // 1) performance（含 now/mark/measure/getEntriesByType 等空实现兜底）
    var perf = (typeof performance !== 'undefined' && performance) ? performance : null;
    if (!perf) {
      perf = {};
      defIfMissing(g, 'performance', perf);
    }
    if (typeof perf.now !== 'function') {
      // 优先 wx.getPerformance().now（单调高精度），否则 Date.now() 兜底（与 Phaser 自带 polyfill 一致）。
      var nowImpl = function () { return Date.now(); };
      try {
        if (typeof wx !== 'undefined' && wx.getPerformance && typeof wx.getPerformance === 'function') {
          var wp = wx.getPerformance();
          if (wp && typeof wp.now === 'function') {
            nowImpl = function () { return wp.now(); };
          }
        }
      } catch (_) {}
      try { Object.defineProperty(perf, 'now', { value: nowImpl, writable: true, configurable: true }); }
      catch (_) { try { perf.now = nowImpl; } catch (_) {} }
    }
    if (typeof perf.mark !== 'function') {
      try { Object.defineProperty(perf, 'mark', { value: function () {}, writable: true, configurable: true }); }
      catch (_) { try { perf.mark = function () {}; } catch (_) {} }
    }
    if (typeof perf.measure !== 'function') {
      try { Object.defineProperty(perf, 'measure', { value: function () {}, writable: true, configurable: true }); }
      catch (_) { try { perf.measure = function () {}; } catch (_) {} }
    }
    if (typeof perf.getEntriesByType !== 'function') {
      try { Object.defineProperty(perf, 'getEntriesByType', { value: function () { return []; }, writable: true, configurable: true }); }
      catch (_) { try { perf.getEntriesByType = function () { return []; }; } catch (_) {} }
    }
    if (typeof perf.getEntriesByName !== 'function') {
      try { Object.defineProperty(perf, 'getEntriesByName', { value: function () { return []; }, writable: true, configurable: true }); }
      catch (_) { try { perf.getEntriesByName = function () { return []; }; } catch (_) {} }
    }
    // 同步到 window/self（weapp-adapter 的 window/self 可能不等同 globalThis）
    for (var pi = 0; pi < targets.length; pi++) {
      try { if (targets[pi].performance == null) targets[pi].performance = perf; } catch (_) {}
    }

    // 2) requestAnimationFrame / cancelAnimationFrame
    function rafShim(cb) {
      try {
        if (typeof wx !== 'undefined' && wx.requestAnimationFrame && typeof wx.requestAnimationFrame === 'function') {
          return wx.requestAnimationFrame(cb);
        }
      } catch (_) {}
      return setTimeout(function () { try { cb(Date.now()); } catch (_) {} }, 16);
    }
    function cafShim(id) {
      try {
        if (typeof wx !== 'undefined' && wx.cancelAnimationFrame && typeof wx.cancelAnimationFrame === 'function') {
          wx.cancelAnimationFrame(id); return;
        }
      } catch (_) {}
      try { clearTimeout(id); } catch (_) {}
    }
    for (var ri = 0; ri < targets.length; ri++) {
      defIfMissing(targets[ri], 'requestAnimationFrame', rafShim);
      defIfMissing(targets[ri], 'cancelAnimationFrame', cafShim);
    }

    // 3) setTimeout / setInterval / clearTimeout / clearInterval（原生/weapp-adapter 通常已提供；确认兜底）
    for (var ti = 0; ti < targets.length; ti++) {
      defIfMissing(targets[ti], 'setTimeout', setTimeout);
      defIfMissing(targets[ti], 'setInterval', setInterval);
      defIfMissing(targets[ti], 'clearTimeout', clearTimeout);
      defIfMissing(targets[ti], 'clearInterval', clearInterval);
    }

    // 4) localStorage / sessionStorage
    // 微信端用 wx.getStorageSync/setStorageSync/removeStorageSync/clearStorageSync；缺失则内存 Map 兜底。
    function makeStorage(backend) {
      var mem = {};
      var store = {
        getItem: function (k) {
          try { if (backend && backend.get) { var v = backend.get(k); return v === undefined ? null : v; } } catch (_) {}
          return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
        },
        setItem: function (k, v) {
          try { if (backend && backend.set) { backend.set(k, String(v)); return; } } catch (_) {}
          mem[k] = String(v);
        },
        removeItem: function (k) {
          try { if (backend && backend.remove) { backend.remove(k); return; } } catch (_) {}
          delete mem[k];
        },
        clear: function () {
          try { if (backend && backend.clear) { backend.clear(); return; } } catch (_) {}
          mem = {};
        },
        key: function (i) { return Object.keys(mem)[i] || null; },
      };
      try { Object.defineProperty(store, 'length', { get: function () { return Object.keys(mem).length; }, configurable: true }); } catch (_) {}
      return store;
    }
    var lsBackend = null;
    try {
      if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) {
        lsBackend = {
          get: function (k) { try { return wx.getStorageSync(k); } catch (_) { return null; } },
          set: function (k, v) { try { wx.setStorageSync(k, v); } catch (_) {} },
          remove: function (k) { try { wx.removeStorageSync(k); } catch (_) {} },
          clear: function () { try { wx.clearStorageSync(); } catch (_) {} },
        };
      }
    } catch (_) {}
    var ls = (typeof localStorage !== 'undefined' && localStorage) ? localStorage : makeStorage(lsBackend);
    var ss = (typeof sessionStorage !== 'undefined' && sessionStorage) ? sessionStorage : makeStorage(lsBackend);
    for (var li = 0; li < targets.length; li++) {
      defIfMissing(targets[li], 'localStorage', ls);
      defIfMissing(targets[li], 'sessionStorage', ss);
    }

    var perfNowType = (typeof (typeof performance !== 'undefined' && performance ? performance.now : null));
    var rafType = (typeof (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : null));
  } catch (e) {
    console.error('[R4-perf] polyfill failed:', e && e.message ? e.message : e);
  }
})();

// ── R2-nineteen（原位置，已前置为 no-op）─────────────────────
// screenCanvas 已在文件最前的「R2-nineteen（前置）」块抢占并挂到 globalThis.__screenCanvas，
// 第一个 wx.createCanvas() 已被消费；这里不再调用 wx.createCanvas()，否则会再吃掉一个
// 离屏画布并覆盖 __screenCanvas。仅做确认日志。
(function () {
  try {
    if (globalThis.__screenCanvas) {
    } else {
    }
  } catch (_) {}
})();

// ── R2 修复：Phaser 'in' 操作符 polyfill shim ──────────────────────
// Phaser 内部设备检测（Device/Features 模块）用 `'ontouchstart' in window`
// / `'onwheel' in document` 等模式做特性检测。微信小游戏环境下
// weapp-adapter 的 window/document 是 polyfill 对象，不支持对事件属性
// 用 `in` 查询 → TypeError: Cannot use 'in' operator to search for 'ontouchstart'
//
// 修复：在 Phaser 加载前，将常见事件属性预定义到全局对象上（值为 undefined），
// 使 `in` 返回 true、后续值判断正常走 false 分支（Phaser 的 fallback 逻辑）。
(function () {
  var evtProps = [
    // 触摸（Phaser Device 检测 ontouchstart in documentElement）
    'ontouchstart', 'ontouchend', 'ontouchmove', 'ontouchcancel',
    // 滚轮（Phaser 检测 onwheel/onmousewheel in window）
    'onwheel', 'onmousewheel',
    // 指针（Phaser 检测 pointerLockElement in document 等）
    'onpointerdown', 'onpointerup', 'onpointermove', 'onpointercancel',
    'onpointerenter', 'onpointerleave', 'onpointerover', 'onpointerout',
    // 鼠标基础
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmousemove',
    'onmouseenter', 'onmouseleave', 'onmouseover', 'onmouseout',
    'oncontextmenu', 'onselectstart', 'onselect',
    // 键盘
    'onkeydown', 'onkeyup', 'onkeypress',
    // 焦点/窗口
    'onfocus', 'onblur', 'onresize', 'onscroll', 'onload', 'onunload',
    'onbeforeunload', 'onerror', 'onhashchange', 'onpopstate',
    // 拖放/剪贴板
    'ondrag', 'ondragstart', 'ondragend', 'ondragenter', 'ondragleave',
    'ondragover', 'ondrop', 'oncopy', 'oncut', 'onpaste',
    // 触控/手势
    'ongesturestart', 'ongesturechange', 'ongestureend',
    // 设备方向/运动
    'ondeviceorientation', 'ondevicemotion',
    // 可见性
    'onvisibilitychange',
    // 全屏相关
    'onfullscreenchange', 'onfullscreenerror',
    'onwebkitfullscreenchange', 'onwebkitfullscreenerror',
    'onmozfullscreenchange', 'onmozfullscreenerror',
    'onmsfullscreenchange', 'onmsfullscreenerror',
    // 动画帧
    'onanimationstart', 'onanimationend', 'onanimationiteration',
    'ontransitionend', 'ontransitionstart', 'ontransitioncancel',
    // 媒体
    'onplay', 'onpause', 'onplaying', 'onended', 'ontimeupdate',
    'onvolumechange', 'onseeking', 'onseeked', 'onwaiting',
    'oncanplay', 'oncanplaythrough', 'onloadstart', 'onprogress',
    'onsuspend', 'onabort', 'onemptied', 'onstalled',
    // 网络状态
    'ononline', 'onoffline',
    // 存储
    'onstorage', 'onhashchange',
    // 消息
    'onmessage', 'onmessageerror',
    // 游戏/输入（Phaser 特有检测）
    'ongamepadconnected', 'ongamepaddisconnected',
  ];

  function defineIfMissing(obj, prop) {
    if (!(prop in obj)) {
      try {
        Object.defineProperty(obj, prop, {
          value: undefined,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (_) {
        // 某些属性在严格模式下可能不可写，静默忽略
        obj[prop] = undefined;
      }
    }
  }

  // ── R2-bis 修复：确保 document.documentElement / body 存在 ──
  // 微信环境下 document.documentElement 和 document.body 可能是 undefined。
  // Phaser 对它们做 'ontouchstart' in documentElement → in undefined → TypeError。
  // 若不存在则创建为空对象，使后续 'in' 操作合法（返回 false）。
  function ensureDomNode(doc, name) {
    if (!doc[name]) {
      try {
        Object.defineProperty(doc, name, {
          value: {},
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (_) {
        doc[name] = {};
      }
    }
  }
  ensureDomNode(document, 'documentElement');
  ensureDomNode(document, 'body');

  var targets = [window, document, document.documentElement, document.body];

  for (var t = 0; t < targets.length; t++) {
    for (var i = 0; i < evtProps.length; i++) {
      defineIfMissing(targets[t], evtProps[i]);
    }
  }
})();
// ── end shim ─────────────────────────────────────────────────────────

// ── R2-sex：HTMLCanvasElement 全局占位 ───────────────────────────────
if (typeof HTMLCanvasElement === 'undefined') {
  globalThis.HTMLCanvasElement = function () {};
}

// ── R2-oct：screen 全局 polyfill ──────────────────────────────────────
// Phaser ScaleManager.startListeners 访问 screen.orientation.addEventListener，
// 微信小游戏环境无 screen 全局，直接 ReferenceError。
if (typeof screen === 'undefined') {
  globalThis.screen = {
    width: 812,
    height: 375,
    availWidth: 812,
    availHeight: 375,
    orientation: {
      type: 'landscape-primary',
      angle: 0,
      addEventListener: function () {},
      removeEventListener: function () {},
    },
    lockOrientation: function () { return false; },
    unlockOrientation: function () {},
    mozLockOrientation: null,
    msLockOrientation: null,
  };
}

// ─ R2-sept：Phaser 启动 DOM 容器 shim（终极替换版）────────────────────
// weapp-adapter 的 document 是只读/特殊对象，直接 defineProperty 方法不生效。
// 策略：捕获原始 document，创建一个委托原型的新对象，替换 window.document
// 与 globalThis.document，确保 Phaser 读取时拿到的是我们可控的 DOM 模型。
(function () {
  try {
    var origDoc = document;
    if (!origDoc) return;

    // 1. 先确保 body 和 documentElement 存在（weapp-adapter 可能缺失）
    if (!origDoc.body) {
      try { Object.defineProperty(origDoc, 'body', { value: {}, writable: true, configurable: true }); } catch (_) {}
    }
    if (!origDoc.documentElement) {
      try { Object.defineProperty(origDoc, 'documentElement', { value: {}, writable: true, configurable: true }); } catch (_) {}
    }

    // 2. 创建假的 body 与 documentElement（带 style 和尺寸属性）
    var fakeBody = origDoc.body || {};
    if (!fakeBody.style) {
      try { Object.defineProperty(fakeBody, 'style', { value: {}, writable: true, configurable: true }); } catch (_) {}
    }
    if (typeof fakeBody.appendChild !== 'function') {
      try { Object.defineProperty(fakeBody, 'appendChild', { value: function () {}, configurable: true }); } catch (_) {}
    }
    if (typeof fakeBody.removeChild !== 'function') {
      try { Object.defineProperty(fakeBody, 'removeChild', { value: function () {}, configurable: true }); } catch (_) {}
    }

    var fakeDocEl = origDoc.documentElement || {};
    if (!fakeDocEl.style) {
      try { Object.defineProperty(fakeDocEl, 'style', { value: {}, writable: true, configurable: true }); } catch (_) {}
    }
    try { fakeDocEl.clientWidth = fakeDocEl.clientWidth || 512; } catch (_) {}
    try { fakeDocEl.clientHeight = fakeDocEl.clientHeight || 288; } catch (_) {}
    try {
      fakeDocEl._children = [];
      Object.defineProperty(fakeDocEl, 'appendChild', {
        value: function (child) { fakeDocEl._children.push(child); return child; },
        configurable: true
      });
      Object.defineProperty(fakeDocEl, 'removeChild', {
        value: function (child) {
          var idx = fakeDocEl._children.indexOf(child);
          if (idx >= 0) fakeDocEl._children.splice(idx, 1);
          return child;
        },
        configurable: true
      });
    } catch (_) {}

    // 3. 创建游戏容器 div
    var gameContainer = {};
    try {
      gameContainer = origDoc.createElement ? origDoc.createElement('div') : {};
    } catch (_) {}
    if (!gameContainer) gameContainer = {};
    gameContainer.id = 'game-container';
    gameContainer.tagName = 'DIV';
    try {
      Object.defineProperty(gameContainer, 'style', { value: {}, writable: true, configurable: true });
    } catch (_) {}
    try { gameContainer.clientWidth = 512; } catch (_) {}
    try { gameContainer.clientHeight = 288; } catch (_) {}
    try { gameContainer.offsetWidth = 512; } catch (_) {}
    try { gameContainer.offsetHeight = 288; } catch (_) {}
    try { gameContainer.appendChild = function () {}; } catch (_) {}
    try { gameContainer.removeChild = function () {}; } catch (_) {}
    try { gameContainer.addEventListener = function () {}; } catch (_) {}
    try { gameContainer.removeEventListener = function () {}; } catch (_) {}
    try { fakeBody.appendChild(gameContainer); } catch (_) {}

    // 4. 创建 canvas 占位或透传真实 canvas
    // 微信 weapp-adapter 的 createElement('canvas') 会返回 wx.createCanvas() 的真实画布。
    // 若把它覆盖成空 fakeCtx，Phaser 的所有绘制都会变成空气 → 黑屏。
    // 策略：有真实 canvas 就保留其 getContext；仅在拿不到真实画布时才用 fakeCtx 兜底。
    var realCanvas = null;
    try { realCanvas = origDoc.createElement ? origDoc.createElement('canvas') : null; } catch (_) {}
    var useRealCanvas = realCanvas && typeof realCanvas.getContext === 'function';
    var fakeCanvas = realCanvas || {};
    if (!fakeCanvas) fakeCanvas = {};
    fakeCanvas.tagName = 'CANVAS';
    try { Object.defineProperty(fakeCanvas, 'style', { value: {}, writable: true, configurable: true }); } catch (_) {}
    try { fakeCanvas.width = fakeCanvas.width || 512; } catch (_) {}
    try { fakeCanvas.height = fakeCanvas.height || 288; } catch (_) {}
    try { fakeCanvas.clientWidth = fakeCanvas.clientWidth || 512; } catch (_) {}
    try { fakeCanvas.clientHeight = fakeCanvas.clientHeight || 288; } catch (_) {}
    try { fakeCanvas.offsetWidth = fakeCanvas.offsetWidth || 512; } catch (_) {}
    try { fakeCanvas.offsetHeight = fakeCanvas.offsetHeight || 288; } catch (_) {}
    if (!useRealCanvas) {
      var fakeCtx = {
        drawImage: function(){}, fillRect: function(){}, clearRect: function(){},
        getImageData: function(){return{data:new Uint8ClampedArray(4)};}, putImageData: function(){},
        setTransform: function(){}, save: function(){}, restore: function(){},
        scale: function(){}, rotate: function(){}, translate: function(){},
        fillText: function(){}, measureText: function(){return{width:0};},
        createLinearGradient: function(){return{addColorStop:function(){}};},
        createPattern: function(){return null;}, arc: function(){},
        beginPath: function(){}, closePath: function(){}, moveTo: function(){},
        lineTo: function(){}, stroke: function(){}, fill: function(){}, clip: function(){}
      };
      try {
        Object.defineProperty(fakeCanvas, 'getContext', {
          value: function () { return fakeCtx; }, configurable: true
        });
      } catch (_) {}
    }
    try { fakeCanvas.toDataURL = function () { return ''; }; } catch (_) {}

    // ── R3-ter：getBoundingClientRect 补齐（Phaser ScaleManager 要件）──
    // Phaser 3.90 ScaleManager.getParent / getParentBounds 会对 this.parent 调用
    // getBoundingClientRect()。微信端 config.parent = undefined → GetTarget(undefined)
    // 回退到 document.body（即下方 fakeBody），而 weapp-adapter 的元素无此方法
    // → TypeError: this.parent.getBoundingClientRect is not a function（本次黑屏报错）。
    // 同时 getParentBounds 在后续调用里还会访问 this.canvas.getBoundingClientRect()
    // （this.canvas 即 config.canvas = __screenCanvas），故真实上屏画布也要补齐。
    // 这里给所有可能被当成 parent / canvas 的 shim 元素补该方法，返回标准 DOMRect
    // 形状（left/top/right/bottom/width/height/x/y），使 parent bounds 计算不 NaN。
    (function () {
      try {
        var _sys = {};
        try {
          if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
            _sys = wx.getSystemInfoSync() || {};
          }
        } catch (_) {}

        // body / documentElement / gameContainer 用屏幕窗口尺寸；兜底 812×375
        var _vw = (typeof _sys.windowWidth === 'number' && _sys.windowWidth > 0) ? _sys.windowWidth : 812;
        var _vh = (typeof _sys.windowHeight === 'number' && _sys.windowHeight > 0) ? _sys.windowHeight : 375;

        // canvas 优先用上屏画布尺寸；兜底 512×288
        var _cw = 512, _ch = 288;
        if (globalThis.__screenCanvas && globalThis.__screenCanvas.width) {
          _cw = globalThis.__screenCanvas.width;
          _ch = globalThis.__screenCanvas.height;
        }

        function makeRect(w, h) {
          w = (typeof w === 'number' && isFinite(w)) ? w : 0;
          h = (typeof h === 'number' && isFinite(h)) ? h : 0;
          return {
            left: 0, top: 0, right: w, bottom: h,
            x: 0, y: 0, width: w, height: h
          };
        }
        function attachRect(obj, w, h) {
          if (obj && typeof obj.getBoundingClientRect !== 'function') {
            try {
              Object.defineProperty(obj, 'getBoundingClientRect', {
                value: function () { return makeRect(w, h); },
                writable: true, configurable: true
              });
            } catch (_) {
              try { obj.getBoundingClientRect = function () { return makeRect(w, h); }; } catch (_) {}
            }
          }
        }

        // 父容器 / 文档元素用屏幕窗口尺寸
        attachRect(fakeBody, _vw, _vh);
        attachRect(fakeDocEl, _vw, _vh);
        attachRect(gameContainer, _vw, _vh);

        // canvas 类元素用画布尺寸
        attachRect(fakeCanvas, _cw, _ch);

        // 真实上屏画布（Phaser 实际使用的 config.canvas）也必须补齐，
        // 否则 getParentBounds 后续调用的 this.canvas.getBoundingClientRect() 会抛错。
        if (globalThis.__screenCanvas) {
          attachRect(globalThis.__screenCanvas,
            globalThis.__screenCanvas.width || 512,
            globalThis.__screenCanvas.height || 288);
        }

      } catch (_) {}
    })();

    // 5. 创建新 document 对象，委托原 document
    var fakeDoc = Object.create(origDoc);

    // ── R3（根因修复·前置）：钉死 readyState = 'complete' ──
    // 微信运行时不会派发 DOMContentLoaded / load，而 weapp-adapter 与上面的 shim
    // 都已提供 document.body，导致 Phaser.Core.DOMContentLoaded() 落入"注册事件后
    // 无限等待"分支而永远不调用 boot() → 黑屏。把 readyState 设为 complete，
    // 让 Phaser 在构造时同步 boot（详见文件末尾 R3 说明）。own 属性覆盖原型 getter。
    try {
      Object.defineProperty(fakeDoc, 'readyState', { value: 'complete', writable: true, configurable: true });
    } catch (_) {
      try { fakeDoc.readyState = 'complete'; } catch (_) {}
    }

    Object.defineProperty(fakeDoc, 'body', { value: fakeBody, configurable: true });
    Object.defineProperty(fakeDoc, 'documentElement', { value: fakeDocEl, configurable: true });

    Object.defineProperty(fakeDoc, 'getElementById', {
      value: function (id) {
        if (id === 'game-container' || id === 'phaser-game' || id === 'game-parent') return gameContainer;
        try { return origDoc.getElementById(id); } catch (_) {}
        return null;
      },
      configurable: true
    });
    Object.defineProperty(fakeDoc, 'querySelector', {
      value: function (sel) {
        if (sel === '#game-container' || sel === '#phaser-game' || sel === '#game-parent' || sel === 'div') return gameContainer;
        if (sel === 'body') return fakeBody;
        if (sel === 'canvas') return fakeCanvas;
        try { return origDoc.querySelector(sel); } catch (_) {}
        return null;
      },
      configurable: true
    });
    Object.defineProperty(fakeDoc, 'querySelectorAll', {
      value: function () { return []; },
      configurable: true
    });
    Object.defineProperty(fakeDoc, 'createElement', {
      value: function (tag) {
        if (tag === 'canvas') {
          // R2-dec：每次 createElement('canvas') 必须返回**新**画布。
          // 旧实现长期复用同一个 fakeCanvas，导致 Phaser.Text 多对象共享同一张
          // canvas，最后绘制的文字（版本水印）会覆盖所有文本显示。
          // 这里优先用 origDoc.createElement('canvas')（调用 wx.createCanvas()，
          // 第一次后均返回离屏画布）生成独立画布；拿不到真实画布才回退 fakeCanvas。
          try {
            var newCanvas = origDoc.createElement('canvas');
            if (newCanvas && typeof newCanvas.getContext === 'function') {
              try { if (!newCanvas.style) Object.defineProperty(newCanvas, 'style', { value: {}, writable: true, configurable: true }); } catch (_) {}
              try { if (!newCanvas.width) newCanvas.width = 512; } catch (_) {}
              try { if (!newCanvas.height) newCanvas.height = 288; } catch (_) {}
              try { newCanvas.clientWidth = newCanvas.clientWidth || 512; } catch (_) {}
              try { newCanvas.clientHeight = newCanvas.clientHeight || 288; } catch (_) {}
              try { newCanvas.offsetWidth = newCanvas.offsetWidth || 512; } catch (_) {}
              try { newCanvas.offsetHeight = newCanvas.offsetHeight || 288; } catch (_) {}
              return newCanvas;
            }
          } catch (_) {}
          return fakeCanvas;
        }
        try { return origDoc.createElement(tag); } catch (_) {}
        return {
          tagName: tag,
          style: {},
          clientWidth: 0, clientHeight: 0,
          offsetWidth: 0, offsetHeight: 0,
          appendChild: function(){}, removeChild: function(){},
          setAttribute: function(){}, getAttribute: function(){ return null; },
          addEventListener: function(){}, removeEventListener: function(){}
        };
      },
      configurable: true
    });
    Object.defineProperty(fakeDoc, 'elementFromPoint', {
      value: function (_x, _y) {
        // Phaser 触摸事件流程会用它找目标元素；微信环境无真实 DOM，直接返回画布或容器即可。
        return globalThis.__screenCanvas || fakeCanvas || gameContainer || null;
      },
      configurable: true
    });

    // 6. 替换全局 document（多种方式尝试）
    try { window.document = fakeDoc; } catch (_) {}
    try { globalThis.document = fakeDoc; } catch (_) {}
    try { self.document = fakeDoc; } catch (_) {}
    try { Object.defineProperty(window, 'document', { value: fakeDoc, configurable: true }); } catch (_) {}
    try { Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true }); } catch (_) {}

    // 6b. 兜底：把容器挂到 window 全局，index.js 被 patch 后可直接读取
    try { window.__gameContainer = gameContainer; } catch (_) {}
    try { window.__gameBody = fakeBody; } catch (_) {}

    // 7. 对后续 require 也生效：很多 CommonJS 模块会把 document 作为闭包引用，
    // 但在 IIFE 顶层替换后，全局的 document 读取会返回 fakeDoc。
  } catch (_) {}
})();

// ── R2-quater：Image 全局 polyfill（可绘制版本）───────────────────────
// 微信小游戏环境没有浏览器全局 Image。Phaser 需要 new Image() 返回的对象能被
// ctx.drawImage() 接受——CanvasRenderingContext2D.drawImage 只接受：
//   HTMLImageElement | SVGImageElement | HTMLVideoElement | HTMLCanvasElement |
//   ImageBitmap | OffscreenCanvas | VideoFrame | CSSImageValue
// 纯 JS 对象会被拒绝（上轮错误）。
//
// 策略：让 new Image() 返回一个**真实的 <canvas> 元素**（drawImage 合法类型），
// 再在上面挂载 .src / .onload / .onerror 等 Image 接口。
if (typeof Image === 'undefined') {
  globalThis.Image = function () {
    var el = null;
    try { el = document.createElement('canvas'); } catch (_) {}
    if (!el) { el = {}; }

    var _src = '';
    var _onload = null;
    var _onerror = null;

    Object.defineProperty(el, 'src', {
      configurable: true,
      set: function (val) {
        _src = val;
        var self = this;
        try {
          if (typeof wx !== 'undefined' && wx.createCanvas) {
            var c = wx.createCanvas();
            var img = c.createImage ? c.createImage() : null;
            if (img) {
              img.onload = function () {
                try {
                  self.width = img.naturalWidth || img.width || 0;
                  self.height = img.naturalHeight || img.height || 0;
                  if (self.getContext) {
                    var ctx = self.getContext('2d');
                    if (ctx) { self.width = self.width || 1; self.height = self.height || 1; ctx.drawImage(img, 0, 0); }
                  }
                } catch (_) {}
                if (_onload) _onload();
              };
              img.onerror = function () { if (_onerror) _onerror(); };
              img.src = val;
              return;
            }
          }
        } catch (_) {}

        try { if (el.getContext) { el.width = 1; el.height = 1; } } catch (_) {}
        if (_onload) _onload();
      },
      get: function () { return _src; },
    });

    Object.defineProperty(el, 'onload', {
      configurable: true,
      set: function (v) { _onload = typeof v === 'function' ? v : null; },
      get: function () { return _onload; },
    });
    Object.defineProperty(el, 'onerror', {
      configurable: true,
      set: function (v) { _onerror = typeof v === 'function' ? v : null; },
      get: function () { return _onerror; },
    });

    return el;
  };
}

// ── R3：微信黑屏根因修复（Phaser boot 不触发）───────────────────────────────────
// Phaser.Core.Game 构造器末尾调用 DOMContentLoaded(this.boot)：
//   if (document.readyState === 'complete' || 'interactive') -> 同步调用 boot()；
//   else if (!document.body) -> setTimeout(boot, 20)（也能跑起来）；
//   else -> document.addEventListener('DOMContentLoaded'/'load', boot) 并**无限等待**。
// 微信小游戏没有真实 DOM 生命周期，DOMContentLoaded / load 永不触发；
// 而 weapp-adapter 与 R2-sept 都提供了 document.body，于是落入"无限等待"分支，
// boot 永不执行 → game.canvas 始终为 null、主循环永不启动 → 黑屏。
// 上面的 R2-sept 已把 document.readyState 钉为 'complete'，此处再兜底一层，
// 确保任何路径下 document.readyState 都为 complete，使 Phaser 同步 boot。
(function () {
  try {
    if (typeof document === 'undefined' || !document) return;
    var rs = document.readyState;
    if (rs !== 'complete' && rs !== 'interactive') {
      try {
        Object.defineProperty(document, 'readyState', { value: 'complete', writable: true, configurable: true });
      } catch (_) {
        try { document.readyState = 'complete'; } catch (_) {}
      }
    }
  } catch (_) {}
})();

try {
  require('./index');
} catch (e) {
  // Phaser 启动失败：把错误信息画到 loading 页上，方便真机/模拟器排查。
  try {
    var c2 = globalThis.__screenCanvas;
    if (c2 && c2.getContext) {
      var ctx2 = c2.getContext('2d');
      if (ctx2) {
        ctx2.fillStyle = '#3a7ca5';
        ctx2.fillRect(0, 0, c2.width || 512, c2.height || 288);
        ctx2.fillStyle = '#ffcccc';
        ctx2.font = '14px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        var msg = (e && e.message ? e.message : String(e)) || 'unknown error';
        ctx2.fillText('Phaser 启动失败', c2.width / 2, c2.height / 2 - 30);
        ctx2.fillText(msg.substring(0, 60), c2.width / 2, c2.height / 2);
      }
    }
  } catch (_) {}
  // 仍把错误抛到控制台，便于 vConsole 查看。
  console.error('[game.js] require index failed:', e);
}

// ── R2-dec-touch：把微信原生触摸派发成标准 TouchEvent，驱动 Phaser 指针输入 ───
// 关键：Phaser 3 的 TouchManager 监听的是 'touchstart/touchmove/touchend/touchcancel'
// （见 node_modules/phaser/src/input/touch/TouchManager.js:332-335），**不是** 'pointerdown'。
// 旧实现只派发 pointer 事件，Phaser 不监听该事件 → 标题屏「开始游戏」按钮在真机点不动（本次阻塞点）。
// 这里把 wx.onTouch* 转换成带 touches/changedTouches/targetTouches 数组的
// TouchEvent-like 对象派发到上屏画布（Phaser 的 input.target = config.canvas =
// __screenCanvas）。Phaser 用 changedTouches[i].clientX/clientY 经 ScaleManager
// 换算到 512×288 逻辑坐标命中按钮。同时把 touchstart 派发到 window 触发音频解锁。
(function () {
  try {
    var canvas = globalThis.__screenCanvas;
    if (!canvas || typeof wx === 'undefined' || typeof canvas.dispatchEvent !== 'function') return;

    function toTouch(t) {
      var cx = (typeof t.clientX === 'number') ? t.clientX : (typeof t.x === 'number' ? t.x : 0);
      var cy = (typeof t.clientY === 'number') ? t.clientY : (typeof t.y === 'number' ? t.y : 0);
      return {
        identifier: (typeof t.identifier === 'number') ? t.identifier : 0,
        clientX: cx, clientY: cy,
        pageX: cx, pageY: cy,
        screenX: cx, screenY: cy,
        x: cx, y: cy
      };
    }

    function makeTouchEvent(type, touches) {
      return {
        type: type,
        touches: touches,
        changedTouches: touches,
        targetTouches: touches,
        target: canvas,
        currentTarget: canvas,
        cancelable: true,
        defaultPrevented: false,
        preventDefault: function () { this.defaultPrevented = true; },
        stopPropagation: function () {},
        timeStamp: Date.now()
      };
    }

    function dispatchTouch(type, wxTouches) {
      if (!wxTouches || !wxTouches.length) return;
      var touches = [];
      for (var i = 0; i < wxTouches.length; i++) {
        try { touches.push(toTouch(wxTouches[i])); } catch (_) {}
      }
      if (!touches.length) return;
      try { canvas.dispatchEvent(makeTouchEvent(type, touches)); } catch (_) {}
      if (type === 'touchstart' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try { window.dispatchEvent(makeTouchEvent('touchstart', touches)); } catch (_) {}
      }
    }

    if (typeof wx.onTouchStart === 'function') wx.onTouchStart(function (e) { dispatchTouch('touchstart', e.changedTouches); });
    if (typeof wx.onTouchMove === 'function') wx.onTouchMove(function (e) { dispatchTouch('touchmove', e.changedTouches); });
    if (typeof wx.onTouchEnd === 'function') wx.onTouchEnd(function (e) { dispatchTouch('touchend', e.changedTouches); });
    if (typeof wx.onTouchCancel === 'function') wx.onTouchCancel(function (e) { dispatchTouch('touchcancel', e.changedTouches); });
  } catch (e) {
    console.error('[R2-dec-touch] touch dispatch failed:', e && e.message ? e.message : e);
  }
})();
