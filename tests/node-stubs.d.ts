/**
 * tests/node-stubs.d.ts — G7 修复 · 方案③ 配套。
 *
 * 仅为架构测试（core-no-platform.test.ts）提供最小 fs/path 模块类型，
 * 以便 `tsc --noEmit` 通过；不安装 @types/node、不污染 src/core 编译。
 *
 * 为何放 .d.ts 而非在 .ts 里 `declare module`：
 *   - 在 `.ts` 文件中 `declare module 'fs'` 会被 TypeScript 判定为「模块增强」，
 *     要求基模块存在，否则报 TS2664（找不到基模块）；
 *   - 在 `.d.ts` 中则是普通「环境模块声明」，无需基模块即可生效。
 *
 * 作用域安全性：环境模块声明只对「显式 import 'fs'/'path'」的文件可见；
 * src/core 从不 import 这两个模块，故 node 类型对 core 编译零泄漏。
 * `__dirname` 不在此声明（避免变为全局），仅由测试文件模块作用域局部 declare。
 */
declare module 'fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: string): string;
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module 'path' {
  export function join(...parts: string[]): string;
}
