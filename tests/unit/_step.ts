/**
 * tests/unit/_step — 固定步长常量（禁止各测试硬编码步长，testing.md §3）。
 * 与 src/core/config 的 STEP_MS 保持一致（单一真理源）。
 */
export const STEP_MS = 1000 / 60;
export const STEP_DT = STEP_MS / 1000;
