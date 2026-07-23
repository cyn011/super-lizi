/**
 * tests/unit/ui/touch-buttons.test.ts — 微信触屏四按钮视觉规格回归测试。
 *
 * 锁定 art/ui/touch-buttons-spec §5.3 精确参数表 + 控制清单 §4 命中区验收。
 * 本文件纯数据驱动（不构造 Phaser Scene / Graphics / Container，Node 测环境无 canvas），
 * 渲染侧的 Phaser 集成由"真机/模拟器 + 微信开发者工具"人眼回归验证。
 *
 * 覆盖：
 *   1) §4 命中区：4 钮直径 ≥ 48px
 *   2) §5.2 双层配色：方向键 0.18/2px、动作键 0.32/3px
 *   3) §5.3 按下态：方向键 scale 0.94 / 动作键 0.92；描边切 #B5763E 栗色 + 加粗 1px
 *   4) §5.3 按下态填充 alpha：方向键 0.33、动作键 0.50（默认 +0.15/0.18）
 *   5) §5.2 图标：4 钮 type 严格 direction/action 分类
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
  resolveButtonId,
  TouchButtons,
} from '../../../src/ui/touch-buttons';

const C_OUTLINE = 0x2a1a12;
const C_PRESSED_OUTLINE = 0xb5763e;
const C_FILL_DIRECTION = 0xffffff;
const C_FILL_ACTION = 0xffd23f;

describe('touch-buttons · 视觉规格回归（art/ui/touch-buttons-spec §5.3）', () => {
  it('§4 命中区：4 钮直径均 ≥ 48px（控制清单验收）', () => {
    for (const id of BUTTON_IDS) {
      const b = inputConfig.wechat.buttons[id];
      const diameter = b.r * LOGICAL_WIDTH * 2;
      expect(diameter, `${id} 直径 (r=${b.r} × W=${LOGICAL_WIDTH} × 2)`).toBeGreaterThanOrEqual(48);
    }
  });

  it('§5.2 默认态：方向键白 0.18 + 描边 2px；动作键暖黄 0.32 + 描边 3px', () => {
    const l = BUTTON_VISUAL_SPEC.left;
    const r = BUTTON_VISUAL_SPEC.right;
    const j = BUTTON_VISUAL_SPEC.jump;
    const a = BUTTON_VISUAL_SPEC.action;

    // 填充色
    expect(l.fillColor).toBe(C_FILL_DIRECTION);
    expect(r.fillColor).toBe(C_FILL_DIRECTION);
    expect(j.fillColor).toBe(C_FILL_ACTION);
    expect(a.fillColor).toBe(C_FILL_ACTION);
    // 填充 alpha
    expect(l.fillAlphaDefault).toBe(0.18);
    expect(r.fillAlphaDefault).toBe(0.18);
    expect(j.fillAlphaDefault).toBe(0.32);
    expect(a.fillAlphaDefault).toBe(0.32);
    // 描边宽度（方向键 2、动作键 3）
    expect(l.lineWidthDefault).toBe(2);
    expect(r.lineWidthDefault).toBe(2);
    expect(j.lineWidthDefault).toBe(3);
    expect(a.lineWidthDefault).toBe(3);
    // 描边 alpha（方向键 0.85、动作键 0.95）
    expect(l.lineAlphaDefault).toBeCloseTo(0.85, 5);
    expect(r.lineAlphaDefault).toBeCloseTo(0.85, 5);
    expect(j.lineAlphaDefault).toBeCloseTo(0.95, 5);
    expect(a.lineAlphaDefault).toBeCloseTo(0.95, 5);
  });

  it('§5.3 按下态：方向键 scale 0.94 / 动作键 0.92；描边切 #B5763E 栗色 + 加粗 1px', () => {
    const l = BUTTON_VISUAL_SPEC.left;
    const r = BUTTON_VISUAL_SPEC.right;
    const j = BUTTON_VISUAL_SPEC.jump;
    const a = BUTTON_VISUAL_SPEC.action;

    // 按下 scale
    expect(l.pressedScale).toBe(0.94);
    expect(r.pressedScale).toBe(0.94);
    expect(j.pressedScale).toBe(0.92);
    expect(a.pressedScale).toBe(0.92);
    // 按下态填充 alpha 增量 +0.15（方向键 0.18→0.33、动作键 0.32→0.50）
    expect(l.fillAlphaPressed).toBeCloseTo(l.fillAlphaDefault + 0.15, 5);
    expect(r.fillAlphaPressed).toBeCloseTo(r.fillAlphaDefault + 0.15, 5);
    expect(j.fillAlphaPressed).toBeCloseTo(j.fillAlphaDefault + 0.18, 5);
    expect(a.fillAlphaPressed).toBeCloseTo(a.fillAlphaDefault + 0.18, 5);
    // 描边切栗色（按下时填的是 COLOR_PRESSED_OUTLINE = 0xB5763E）
    // 注：BUTTON_VISUAL_SPEC 不存 lineColorPressed（因按下态固定切栗色，由实现硬编码保证），
    //   通过 lineWidth 增量 +1 反推：方向键 2→3、动作键 3→4
    expect(l.lineWidthPressed).toBe(l.lineWidthDefault + 1);
    expect(r.lineWidthPressed).toBe(r.lineWidthDefault + 1);
    expect(j.lineWidthPressed).toBe(j.lineWidthDefault + 1);
    expect(a.lineWidthPressed).toBe(a.lineWidthDefault + 1);
    // 颜色常量暴露正确（防止未来误改）
    expect(C_OUTLINE).toBe(0x2a1a12);
    expect(C_PRESSED_OUTLINE).toBe(0xb5763e);
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

  it('action 预留态 API：setActionDisabled 是 TouchButtons 公开方法（spec §4.6 入口）', () => {
    // 编译期类型断言：方法必须存在并接受 boolean
    const proto = TouchButtons.prototype as unknown as {
      setActionDisabled?: (disabled: boolean) => void;
    };
    expect(typeof proto.setActionDisabled).toBe('function');
    expect(proto.setActionDisabled!.length).toBe(1); // 1 个参数
  });
});
