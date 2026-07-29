/**
 * vitest.config — 确定性逻辑单测（testing.md §2 / E2.S2 §4.1）。
 * core 纯逻辑，Node 环境即可，无需浏览器/canvas。禁止按文件并发以防共享状态误用。
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // threads 池：纯逻辑 Node 单测无需 fork 进程；fork 池在受限 CI/沙盒下易被 SIGKILL
    pool: 'threads',
    include: ['tests/**/*.test.ts'],
    globals: true,
    fileParallelism: false,
    sequence: { hooks: 'list' },
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
    },
  },
});
