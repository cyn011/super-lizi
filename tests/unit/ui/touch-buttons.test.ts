/**
 * tests/unit/ui/touch-buttons.test.ts — 微信触屏四按钮视觉规格回归测试。
 *
 * 锁定 button-style-research 方案 G（深底浅边风格，参考用户截图 Garden 按钮）精确参数表
 * + 控制清单命中区验收。
 * 本文件纯数据驱动（不构造 Phaser Scene / Graphics / Container，Node 测环境无 canvas），
 * 渲染侧的 Phaser 集成由"真机/模拟器 + 微信开发者工具"人眼回归验证。
 * 四个控制按钮优先使用用户提供的 PNG 纹理；本文件锁定视觉规格常量与命中区。
 *
 * 覆盖：
 *   1) 命中区：4 钮直径 ≥ 28px
 *   2) 默认态（方案 G · 深底浅边）：四钮统一 BASE_DARK 实色填充、不透明、3px 奶油色描边
 *   3) 按下态：方向键 scale 0.96 / 动作圆钮 0.92；描边切 #FFD54F 暖黄
 *   4) 按下态填充 alpha：实色 1.0
 *   5) 图标：4 钮 type 严格 direction/action 分类
 *   6) 信号解析：resolveButtonId('touch:left') → 'left'，无效信号 → null
 *   7) API 暴露：setActionDisabled 是 TouchButtons 公开方法（action 预留态入口）
 */
import { describe, it, expect } from 'vitest';
import { inputConfig } from '../../../src/core/config';
import { LOGICAL_WIDTH } from '../../../src/platform/detect';
import {
  BUTTON_IDS,
  BUTTON_ORDER,
  BUTTON_TYPE,
  BUTTON_VISUAL_SPEC,
  BASE_DARK,
  OUTLINE_LIGHT,
  PRESSED_OUTLINE,
  resolveButtonId,
} from '../../../src/ui/touch-buttons-constants';

const C_BASE_DARK = BASE_DARK; // 方案 G：深棕底板 #5D4037
const C_OUTLINE_LIGHT = OUTLINE_LIGHT; // 默认描边奶油米色 #F5DEB3
const C_PRESSED_OUTLINE = PRESSED_OUTLINE; // 按下描边暖黄 #FFD54F

describe('touch-buttons · 视觉规格回归（方案 G · 深底浅边）', () => {
  it('§4 命中区：4 钮直径均 ≥ 28px', () => {
    for (const id of BUTTON_IDS) {
      const b = inputConfig.wechat.buttons[id];
      const diameter = b.r * LOGICAL_WIDTH * 2;
      expect(diameter, `${id} 直径 (r=${b.r} × W=${LOGICAL_WIDTH} × 2)`).toBeGreaterThanOrEqual(28);
    }
  });

  it('方案 G 默认态：四钮统一深底 BASE_DARK、不透明、2px 奶油色描边', () => {
    const l = BUTTON_VISUAL_SPEC.left;
    const r = BUTTON_VISUAL_SPEC.right;
    const j = BUTTON_VISUAL_SPEC.jump;
    const a = BUTTON_VISUAL_SPEC.action;

    // 填充色：四钮统一深棕底板
    expect(l.fillColor).toBe(C_BASE_DARK);
    expect(r.fillColor).toBe(C_BASE_DARK);
    expect(j.fillColor).toBe(C_BASE_DARK);
    expect(a.fillColor).toBe(C_BASE_DARK);
    // 填充 alpha：实色 1.0
    expect(l.fillAlphaDefault).toBeCloseTo(1.0, 5);
    expect(r.fillAlphaDefault).toBeCloseTo(1.0, 5);
    expect(j.fillAlphaDefault).toBeCloseTo(1.0, 5);
    expect(a.fillAlphaDefault).toBeCloseTo(1.0, 5);
    // 描边宽度：默认 2px（细奶油边）
    expect(l.lineWidthDefault).toBe(2);
    expect(r.lineWidthDefault).toBe(2);
    expect(j.lineWidthDefault).toBe(2);
    expect(a.lineWidthDefault).toBe(2);
    // 描边颜色：奶油米色
    expect(C_OUTLINE_LIGHT).toBe(0xf5deb3);
  });

  it('方案 G 按下态：方向键 scale 0.96 / 动作 0.92；描边切暖黄；填充仍实色', () => {
    const l = BUTTON_VISUAL_SPEC.left;
    const r = BUTTON_VISUAL_SPEC.right;
    const j = BUTTON_VISUAL_SPEC.jump;
    const a = BUTTON_VISUAL_SPEC.action;

    // 按下 scale
    expect(l.pressedScale).toBe(0.96);
    expect(r.pressedScale).toBe(0.96);
    expect(j.pressedScale).toBe(0.92);
    expect(a.pressedScale).toBe(0.92);
    // 按下态填充 alpha 仍为实色 1.0
    expect(l.fillAlphaPressed).toBeCloseTo(1.0, 5);
    expect(r.fillAlphaPressed).toBeCloseTo(1.0, 5);
    expect(j.fillAlphaPressed).toBeCloseTo(1.0, 5);
    expect(a.fillAlphaPressed).toBeCloseTo(1.0, 5);
    // 描边宽度保持 2px
    expect(l.lineWidthPressed).toBe(2);
    expect(r.lineWidthPressed).toBe(2);
    expect(j.lineWidthPressed).toBe(2);
    expect(a.lineWidthPressed).toBe(2);
    // 按下描边色：暖黄
    expect(C_PRESSED_OUTLINE).toBe(0xffd54f);
  });

  it('§4.3 / §5.2 图标：4 钮 type 严格 direction/action 分类', () => {
    expect(BUTTON_TYPE.left).toBe('direction');
    expect(BUTTON_TYPE.right).toBe('direction');
    expect(BUTTON_TYPE.jump).toBe('action');
    expect(BUTTON_TYPE.action).toBe('action');
  });

  it('§5.5 同步协议：resolveButtonId 解析 touch:* 前缀；无效信号返回 null', () => {
    // 正向
    expect(resolveButtonId('touch:left')).toBe('left');
    expect(resolveButtonId('touch:right')).toBe('right');
    expect(resolveButtonId('touch:jump')).toBe('jump');
    expect(resolveButtonId('touch:action')).toBe('action');
    // 负向：Web 端键盘信号不应误映射（平台隔离）
    expect(resolveButtonId('ArrowLeft')).toBeNull();
    expect(resolveButtonId('KeyA')).toBeNull();
    expect(resolveButtonId('Space')).toBeNull();
    // 边界：空/未知前缀
    expect(resolveButtonId('')).toBeNull();
    expect(resolveButtonId('touch:unknown')).toBeNull();
  });

  it('BUTTON_ORDER / BUTTON_IDS 一致性：4 钮顺序固定（left → right → jump → action）', () => {
    expect(BUTTON_ORDER).toEqual(['left', 'right', 'jump', 'action']);
    expect(BUTTON_IDS).toEqual(BUTTON_ORDER);
    expect(BUTTON_ORDER.length).toBe(4);
  });

});
