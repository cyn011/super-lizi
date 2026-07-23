// 微信构建后处理：将 game.js / game.json / weapp-adapter 复制到 dist-wechat/，
// 并用 Babel 把 index.js 降到 ES5（避免微信开发者工具做 Babel 转换时缺少 runtime helpers）。
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from '@babel/core';
import presetEnv from '@babel/preset-env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const out = resolve(root, 'dist-wechat');
mkdirSync(out, { recursive: true });

// 1. 复制入口文件与适配器
copyFileSync(resolve(root, 'game.js'), resolve(out, 'game.js'));
copyFileSync(resolve(root, 'game.json'), resolve(out, 'game.json'));

// project.config.json：微信开发者工具识别小游戏入口（compileType:"game"）的必需配置。
// 缺失则直接报错中止，避免产出无法导入 dist-wechat/ 的半成品。
const projectConfigSrc = resolve(root, 'project.config.json');
if (existsSync(projectConfigSrc)) {
  copyFileSync(projectConfigSrc, resolve(out, 'project.config.json'));
  console.log('[copy-wechat] project.config.json copied to dist-wechat/');
} else {
  console.error('[copy-wechat] project.config.json NOT found at project root. ' +
    'WeChat DevTools cannot import dist-wechat/ without it (game.js not found). Aborting build.');
  process.exit(1);
}

// weapp-adapter：用 npm 包主文件；缺失则告警（微信端运行需此文件）
const adapterSrc = resolve(root, 'node_modules/weapp-adapter/weapp-adapter.js');
if (existsSync(adapterSrc)) {
  copyFileSync(adapterSrc, resolve(out, 'weapp-adapter.js'));
} else {
  console.warn('[copy-wechat] weapp-adapter not found in node_modules; ' +
    'please provide weapp-adapter.js in dist-wechat/ before importing into WeChat DevTools.');
}

// 2. Babel 后处理：把 index.js 整体降到 ES5（bundled helpers，不依赖 @babel/runtime）
const indexPath = resolve(out, 'index.js');
if (existsSync(indexPath)) {
  let src = readFileSync(indexPath, 'utf8');
  const result = transformSync(src, {
    presets: [
      [presetEnv, { targets: { ie: '11' }, modules: false }],
    ],
    babelrc: false,
    configFile: false,
    compact: true,
  });
  src = result.code;
  console.log('[copy-wechat] Babel ES5 transpilation done for index.js');

  // 2b. 固化 Phaser DOM 查询 patch（Babel 后处理会洗掉手改，故在此重新注入）
  // 2b-1. getParent（模块 74403）：document.getElementById 不可用时回退到
  //       window.__gameContainer / window.__gameBody，避免 Cannot set height。
  const getParentPatched = 'if(window.__gameContainer&&(t==="game-container"||t==="phaser-game"||t==="game-parent"))return window.__gameContainer;d=typeof document.getElementById==="function"?document.getElementById(t):null';
  src = src.replace(
    'var S=function S(t){var d;return t!==""&&(typeof t=="string"?d=document.getElementById(t):t&&t.nodeType===1&&(d=t)),d||(d=document.body),d;};p.exports=S;',
    'var S=function S(t){var d;if(t!=="")if(typeof t=="string"){if(window.__gameContainer&&(t==="game-container"||t==="phaser-game"||t==="game-parent"))return window.__gameContainer;d=typeof document.getElementById==="function"?document.getElementById(t):null}else t&&t.nodeType===1&&(d=t);return d||(d=window.__gameBody||document.body||{}),d;};p.exports=S;'
  );
  // 2b-2. AddToDOM（模块含 c.appendChild(t) 特征）：同样回退到容器/window 兜底。
  const addToDomPatched = 'if(d)typeof d=="string"?(c=typeof document.getElementById==="function"?document.getElementById(d):null,d==="game-container"||d==="phaser-game"||d==="game-parent")&&window.__gameContainer&&(c=window.__gameContainer):_typeof(d)=="object"&&d.nodeType===1&&(c=d);else if(t.parentElement||d===null)return t;return c||(c=window.__gameBody||document.body||{}),typeof c.appendChild==="function"?c.appendChild(t):t,t;';
  const addToDomOriginal = 'if(d)typeof d=="string"?c=document.getElementById(d):_typeof(d)=="object"&&d.nodeType===1&&(c=d);else if(t.parentElement||d===null)return t;return c||(c=document.body),c.appendChild(t),t;';
  if (src.includes(addToDomOriginal)) {
    src = src.replace(addToDomOriginal, addToDomPatched);
  }
  // 2b-3. InputManager.onTouchMove：微信环境无 document.elementFromPoint，
  //       直接认为触摸点在 canvas 上，避免滑动时红错。
  const touchMoveOriginal = 'var C=document.elementFromPoint(g.clientX,g.clientY),E=C===this.canvas;!this.isOver&&E?this.setCanvasOver(u):this.isOver&&!E&&this.setCanvasOut(u)';
  const touchMovePatched = 'var C=this.canvas,E=!0;!this.isOver&&E?this.setCanvasOver(u):this.isOver&&!E&&this.setCanvasOut(u)';
  if (src.includes(touchMoveOriginal)) {
    src = src.replace(touchMoveOriginal, touchMovePatched);
    console.log('[copy-wechat] onTouchMove elementFromPoint patch applied');
  }

  if (src.includes(getParentPatched)) {
    console.log('[copy-wechat] getParent patch already present (skipped)');
  } else if (!src.includes('window.__gameContainer')) {
    console.warn('[copy-wechat] getParent patch target not found; manual check may be needed');
  }
  writeFileSync(indexPath, src, 'utf8');
  console.log('[copy-wechat] DOM query patches applied');
}
