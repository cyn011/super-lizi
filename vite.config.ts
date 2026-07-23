/**
 * vite.config — 双模式构建（E1.S2 / 任务交付 #6）。
 * 注：本工程既有实现（main.ts / platform.ts）采用 IS_WECHAT define 做平台裁剪，
 * 故此处沿用 IS_WECHAT（而非 import.meta.env.VITE_PLATFORM）以保持双端一致。
 * --mode web    → 入口 index.html，输出 Web 包到 dist/。
 * --mode wechat → 入口 src/game/main.ts，输出 dist-wechat/index.js（CommonJS），
 *                由根目录 game.js 加载（微信小游戏入口，require('./index')）。
 * minify + tree-shaking 启用（包体 §2）。
 */
import { defineConfig } from 'vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig(({ mode }) => {
  const isWechat = mode === 'wechat';
  return {
    base: './',
    build: {
      target: 'es2015',
      minify: 'esbuild',
      sourcemap: false,
      outDir: isWechat ? 'dist-wechat' : 'dist',
      emptyOutDir: true,
      rollupOptions: isWechat
        ? {
            input: 'src/game/main.ts',
            output: {
              format: 'cjs',
              entryFileNames: 'index.js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name][extname]',
            },
            plugins: [
              babel({
                babelHelpers: 'bundled',
                extensions: ['.js', '.ts'],
                exclude: ['node_modules/**'],
                presets: [
                  ['@babel/preset-env', { targets: { ie: '11' } }],
                  '@babel/preset-typescript',
                ],
              }),
            ],
          }
        : { input: 'index.html' },
    },
    define: {
      // 注入布尔字面量：微信构建为 true（打进 weapp-adapter），Web 为 false（死代码消除）。
      IS_WECHAT: isWechat ? 'true' : 'false',
    },
  };
});
