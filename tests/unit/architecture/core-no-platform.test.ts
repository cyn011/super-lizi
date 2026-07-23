/**
 * tests/unit/architecture/core-no-platform.test.ts — control-list §4 第1项铁律。
 *
 * 静态扫描 src/core 下所有 .ts 源文件，断言「真实平台 API」0 命中：
 *   wx / localStorage / AudioContext / document / window / key(board)
 * （这些是平台耦合的硬指标）。
 *
 * 关于 `touch`：core/input 抽象层用 'touch:left' 等作为「物理信号 id」字符串（逻辑边界，
 *   非平台 API 调用），且仅出现在注释与信号映射字符串中 —— 不记为违规。
 *   本测试据此豁免：仅当 touch 出现在非注释、且非 'touch:' 信号字符串时才违规。
 *
 * 目的：把「core 零平台」从人工核查变为可回归的自动化证据（QA 收口将纳入 CI）。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const CORE_DIR = join(__dirname, '../../../src/core');

/** 递归收集目录下所有 .ts 文件。 */
function collectTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectTs(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** 行是否为注释行（仅含 `//` 或 `*` 块注释续行）。 */
function isCommentOnly(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/');
}

/** 行是否仅含 'touch:' 信号字符串（输入抽象层边界，合法）。 */
function isTouchSignal(line: string): boolean {
  return /['"`]touch:/.test(line);
}

describe('core 零平台 API 铁律（control-list §4.1）', () => {
  const files = collectTs(CORE_DIR);
  const hardHits: string[] = [];
  const touchHits: string[] = [];

  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // 硬指标：wx / localStorage / AudioContext / document / window / key(board)
      if (/\b(wx|localStorage|AudioContext|document|window)\b/.test(line) || /\bkeyboard\b/.test(line)) {
        hardHits.push(`${f}:${i + 1}: ${line.trim()}`);
      }
      // touch：仅在非注释、且非 'touch:' 信号字符串时计为违规
      if (/\btouch\b/.test(line) && !isCommentOnly(line) && !isTouchSignal(line)) {
        touchHits.push(`${f}:${i + 1}: ${line.trim()}`);
      }
    });
  }

  it('src/core 下真实平台 API（wx/localStorage/AudioContext/document/window/keyboard）0 命中', () => {
    expect(hardHits).toEqual([]);
  });

  it('src/core 下 touch 仅以「信号名字符串/注释」形式存在（非平台 API 调用）', () => {
    expect(touchHits).toEqual([]);
  });

  it('扫描覆盖到核心 level 文件（回归保护：C5 新增文件须纳入）', () => {
    const names = files.map((f) => f.replace(/^.*[\\/]/, ''));
    expect(names).toContain('level-runtime.ts');
    expect(names).toContain('level-loader.ts');
    expect(names).toContain('level-data.ts');
  });
});
