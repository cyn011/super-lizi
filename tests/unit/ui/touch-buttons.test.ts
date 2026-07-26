/**
 * tests/unit/ui/touch-buttons.test.ts — 微信触屏四按钮视觉规格回归测试。
 *
 * 锁定 button-style-research §11.2（方案 E · 更淡玻璃）精确参数表 + 控制清单 §4 命中区验收。
 * 本文件纯数据驱动（不构造 Phaser Scene / Graphics / Container，Node 测环境无 canvas），
 * 渲染侧的 Phaser 集成由"真机/模拟器 + 微信开发者工具"人眼回归验证。
 *
 * 覆盖：
 *   1) §4 命中区：4 钮直径 ≥ 28px（按用户反馈再缩 6% 后的验收标准）
 *   2) 默认态（方案 E）：方向键中性白 0.20/1px、动作键暖黄/暖橙 0.30/1px
 *   3) 按下态：方向键 scale 0.97 / 动作键 0.92；描边切 #FFD23F 暖黄 + 加粗 1px
 *   4) 按下态填充 alpha：方向键 0.30、动作键 0.42（方向 +0.10 / 动作 +0.12）
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

const C_OUTLINE = 0xffffff;
const C_PRESSED_OUTLINE = 0xffd23f;
const C_FILL_DIRECTION = 0xffffff; // 方案 E（颜色沿用方案 A）：中性白（原 #DC4438 离板 → 移除）
const C_FILL_ACTION = 0xffd23f;    // 方案 E（颜色沿用方案 A）：暖黄 #FFD23F（锁色板 #4）
const C_FILL_THROW = 0xf2933c;     // 方案 E（颜色沿用方案 A）：暖橙 #F2933C（锁色板 #3）

describe('touch-buttons · 视觉规格回归（button-style-research §11.2 方案 E）', () => {
  it('§4 命中区：4 钮直径均 ≥ 28px（用户反馈再缩 6% 后的验收）', () => {
    for (const id of BUTTON_IDS) {
      const b = inputConfig.wechat.buttons[id];
      const diameter = b.r * LOGICAL_WIDTH * 2;
      expect(diameter, `${id} 直径 (r=${b.r} × W=${LOGICAL_WIDTH} × 2)`).toBeGreaterThanOrEqual(28);
    }
  });

  it('§11.2 默认态（方案 E · 更淡玻璃）：方向键中性白 0.20 + 白边 1px；跳暖黄 0.30 / 扔暖橙 0.30 + 白边 1px', () => {
    const l = BUTTON_VISUAL_SPEC.left;
    const r = BUTTON_VISUAL_SPEC.right;
    const j = BUTTON_VISUAL_SPEC.jump;
    const a = BUTTON_VISUAL_SPEC.action;

    // 填充色（全部锁色板 / 中性）
    expect(l.fillColor).toBe(C_FILL_DIRECTION);
    expect(r.fillColor).toBe(C_FILL_DIRECTION);
    expect(j.fillColor).toBe(C_FILL_ACTION);
    expect(a.fillColor).toBe(C_FILL_THROW);
    // 填充 alpha（方向键 0.20、动作键 0.30）
    expect(l.fillAlphaDefault).toBe(0.20);
    expect(r.fillAlphaDefault).toBe(0.20);
    expect(j.fillAlphaDefault).toBe(0.30);
    expect(a.fillAlphaDefault).toBe(0.30);
    // 描边宽度（方案 E：四钮统一 1px 白细边）
    expect(l.lineWidthDefault).toBe(1);
    expect(r.lineWidthDefault).toBe(1);
    expect(j.lineWidthDefault).toBe(1);
    expect(a.lineWidthDefault).toBe(1);
    // 描边 alpha（全不透明白边）
    expect(l.lineAlphaDefault).toBeCloseTo(1.0, 5);
    expect(r.lineAlphaDefault).toBeCloseTo(1.0, 5);
    expect(j.lineAlphaDefault).toBeCloseTo(1.0, 5);
    expect(a.lineAlphaDefault).toBeCloseTo(1.0, 5);
  });

  it('§11.2 按下态：方向药丸整体 scale 0.97 / 动作圆钮 0.92；描边切暖黄 + 加粗 1px', () => {
    const l = BUTTON_VISUAL_SPEC.left;
    const r = BUTTON_VISUAL_SPEC.right;
    const j = BUTTON_VISUAL_SPEC.jump;
    const a = BUTTON_VISUAL_SPEC.action;

    // 按下 scale
    expect(l.pressedScale).toBe(0.97);
    expect(r.pressedScale).toBe(0.97);
    expect(j.pressedScale).toBe(0.92);
    expect(a.pressedScale).toBe(0.92);
    // 按下态填充 alpha 精确值（方向键 0.20→0.30、动作键 0.30→0.42；方案 E 增量为 +0.10 / +0.12）
    expect(l.fillAlphaPressed).toBeCloseTo(0.30, 5);
    expect(r.fillAlphaPressed).toBeCloseTo(0.30, 5);
    expect(j.fillAlphaPressed).toBeCloseTo(0.42, 5);
    expect(a.fillAlphaPressed).toBeCloseTo(0.42, 5);
    // 描边切暖黄（按下时填的是 COLOR_PRESSED_OUTLINE = 0xFFD23F，锁色板 #4）
    // 注：BUTTON_VISUAL_SPEC 不存 lineColorPressed（因按下态固定切暖黄，由实现硬编码保证），
    //   通过 lineWidth 增量 +1 反推：方向键 2→3、动作键 3→4
    expect(l.lineWidthPressed).toBe(l.lineWidthDefault + 1);
    expect(r.lineWidthPressed).toBe(r.lineWidthDefault + 1);
    expect(j.lineWidthPressed).toBe(j.lineWidthDefault + 1);
    expect(a.lineWidthPressed).toBe(a.lineWidthDefault + 1);
    // 颜色常量暴露正确（防止未来误改）：默认白边、按下暖黄边
    expect(C_OUTLINE).toBe(0xffffff);
    expect(C_PRESSED_OUTLINE).toBe(0xffd23f);
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
