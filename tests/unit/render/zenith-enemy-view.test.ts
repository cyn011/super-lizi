/**
 * tests/unit/render/zenith-enemy-view.test.ts — zenith（破晓穹顶 3-6）敌人/气柱换皮渲染层测试。
 *
 * 契约真源：art/zenith-biome-spec.md §A5.2（逐敌处理表）/ §A5.3（判定规则五条）/ §A5.4（cyclone 暗管口径）/ §7（Reduce Motion）。
 *
 * 四组覆盖：
 *   ① 回归锁——非 zenith 主题（storm_sky / grass / 缺省 undefined）的绘制指令流与**改动前**逐值相同（golden master）。
 *   ② zenith 正向——§A5.2 / §A5.4.2 的关键 hex 与描边宽度逐项落地。
 *   ③ 0 新增 hex——zenith 分支用到的全部颜色落在「11 色锁色板 + 既有 tint 派生」白名单内。
 *   ④ Reduce Motion——cyclone 升腾粒子冻结首帧（相位不推进）。
 *
 * 做法：用 FakeGraphics 打桩收集 (method, args)，不跑真 Phaser（*-view.ts 是纯绘制指令流函数）。
 */
import { describe, it, expect } from 'vitest';
import goldenFixture from './_golden-non-zenith.json';
import { FakeGraphics, fakeEnemy } from './_fake-graphics';
import { drawEnemy } from '../../../src/game/render/enemy-view';
import { drawCyclone } from '../../../src/game/render/cyclone-view';
import { drawProjectile } from '../../../src/game/render/projectile-view';
import type { Projectile } from '../../../src/core/enemy/projectile';
import type { LevelTheme } from '../../../src/core/level/level-data';

// ── 锁色板（ADR-004 十一色）+ 项目既有 tint 派生白名单（theme-palette.ts / astral-biome-spec 已定义）。
const LOCKED_PALETTE: Record<string, number> = {
  草绿: 0x7cc242,
  阴影绿: 0x5fa82f,
  暖橙: 0xf2933c,
  暖黄: 0xffd23f,
  描边近黑棕: 0x2a1a12,
  街影暗蓝: 0x254060,
  警示红: 0xe8483b,
  经济金: 0xf2c94c,
  蓝紫: 0x6e7bf2,
  环境冷蓝: 0x4a78c0,
  天空青: 0x5bc8f5,
};
const ALLOWED_TINTS: Record<string, number> = {
  '深星紫 darken(#6E7BF2,0.5)': 0x373d79,
  '穹壳暗面 darken(#6E7BF2,0.72)': 0x1f2244,
  '星云雾 lighten(#5BC8F5,0.6)': 0xbde9fb,
};
const WHITELIST = new Set([...Object.values(LOCKED_PALETTE), ...Object.values(ALLOWED_TINTS)]);

/**
 * golden master：采集自**本任务改动前**的 origin/master(6e80e15) 源码
 * （`_golden-non-zenith.json`，含完整 (method, args) 指令流，非仅颜色）。
 * 任何非 zenith 路径的观感漂移都会让本文件 ① 组直接变红。
 */
const GOLDEN = goldenFixture as unknown as Record<
  string,
  { styles: string[]; calls: Array<{ method: string; args: number[] }> }
>;

/** golden 捕获时使用的敌人构造（必须与 _golden-non-zenith.json 的采集口径一一对应）。 */
const GOLDEN_CASES: Record<string, (g: FakeGraphics, theme?: LevelTheme) => void> = {
  cyclone_idle: (f, t) =>
    drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160, cyclonePhaseState: 1.0, cycloneInZone: false }), t),
  cyclone_inzone: (f, t) =>
    drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160, cyclonePhaseState: 2.4, cycloneInZone: true }), t),
  shi_pao: (f, t) =>
    drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32, aim: { x: 1, y: 0 }, flash: 0 }), false, t),
  shi_pao_flash: (f, t) =>
    drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32, aim: { x: 0, y: 1 }, flash: 80 }), false, t),
  ci_li: (f, t) => drawEnemy(f.g, fakeEnemy({ type: 'ci_li', width: 32, height: 24 }), false, t),
  du_fu: (f, t) => drawEnemy(f.g, fakeEnemy({ type: 'du_fu', width: 32, height: 24 }), false, t),
  gu_bao_active: (f, t) =>
    drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'ACTIVE' }), false, t),
  gu_bao_retracting: (f, t) =>
    drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'RETRACTING' }), false, t),
  chong_feng: (f, t) => drawEnemy(f.g, fakeEnemy({ type: 'chong_feng', width: 32, height: 24 }), false, t),
};

// ══════════════════════════════════════════════════════════════════
// ① 回归锁：非 zenith 路径与改动前逐值相同
// ══════════════════════════════════════════════════════════════════
describe('① 回归锁 · 非 zenith 主题的绘制指令流与改动前逐值相同（golden master）', () => {
  // golden fixture 采集自本任务改动前的 origin/master(6e80e15) 源码。
  // storm_sky = 2-3 已 live 4 个 cyclone 实例的 biome；grass = 1-1 基准关；undefined = 忘记传参的缺省退化。
  const NON_ZENITH: Array<LevelTheme | undefined> = [undefined, 'storm_sky', 'grass'];

  for (const theme of NON_ZENITH) {
    const label = theme ?? '(缺省 undefined)';
    describe(`theme=${label}`, () => {
      for (const name of Object.keys(GOLDEN_CASES)) {
        it(`${name}：颜色/描边序列逐值不变`, () => {
          const f = new FakeGraphics();
          GOLDEN_CASES[name](f, theme);
          expect(f.styleSequence()).toEqual(GOLDEN[name].styles);
        });

        it(`${name}：完整绘制指令流（含几何参数）逐值不变`, () => {
          const f = new FakeGraphics();
          GOLDEN_CASES[name](f, theme);
          expect(f.calls).toEqual(GOLDEN[name].calls);
        });
      }
    });
  }

  it('storm_sky cyclone 仍为 #5BC8F5 主柱 + 1px 半透描边 + #FFD23F 粒子（2-3 观感红线）', () => {
    const f = new FakeGraphics();
    drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160 }), 'storm_sky');
    expect(f.styleSequence()).toContain('fill:0x5bc8f5@0.280'); // 青主柱
    expect(f.styleSequence()).toContain('line:1px:0x2a1a12@0.500'); // 1px 半透描边（未被加粗）
    expect(f.styleSequence()).toContain('fill:0xffd23f@0.600'); // 暖黄粒子
    expect(f.colorsUsed()).not.toContain(0x1f2244); // 未混入 zenith 暗管
  });

  it('非 zenith 的 shi_pao 保留既有越界色（全局越界色整改不在本批范围）', () => {
    for (const theme of [undefined, 'storm_sky', 'grass'] as Array<LevelTheme | undefined>) {
      const f = new FakeGraphics();
      drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32 }), false, theme);
      expect(f.colorsUsed()).toContain(0xf4efe6); // 石白未被顺手替换
      expect(f.colorsUsed()).toContain(0x8a8276); // 炮口石灰暗未被顺手替换
      expect(f.colorsUsed()).not.toContain(0x373d79);
    }
  });

  it('非 zenith 弹丸绘制逐值不变（无拖尾）', () => {
    const mk = (): Projectile =>
      ({ dead: false, vx: 200, vy: 0, getBounds: () => ({ x: 10, y: 20, w: 8, h: 8 }) }) as unknown as Projectile;
    const base = new FakeGraphics();
    drawProjectile(base.g, mk());
    for (const theme of ['storm_sky', 'grass'] as LevelTheme[]) {
      const f = new FakeGraphics();
      drawProjectile(f.g, mk(), theme);
      expect(f.calls).toEqual(base.calls);
    }
    expect(base.countOf('fillCircle')).toBe(1); // 仅弹芯，无拖尾段
  });
});

// ══════════════════════════════════════════════════════════════════
// ② zenith 正向：§A5.2 / §A5.4.2 落地
// ══════════════════════════════════════════════════════════════════
describe('② zenith 正向 · §A5.2 逐敌处理表', () => {
  it('shi_pao：石身换 #373D79，越界色 #F4EFE6/#8A8276 在本分支内清除，描边 2px', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32 }), false, 'zenith');
    const colors = f.colorsUsed();
    expect(colors).toContain(0x373d79); // 暗体（vs 破晓金天 8.06:1）
    expect(colors).not.toContain(0xf4efe6); // 越界色已清
    expect(colors).not.toContain(0x8a8276); // 越界色已清
    // 炮身首个 fill 即暗体
    expect(f.calls.find((c) => c.method === 'fillStyle')?.args[0]).toBe(0x373d79);
    // 描边加倍：所有 #2A1A12 描边均为 2px
    const outlineStrokes = f.callsOf('lineStyle').filter((c) => c.args[1] === 0x2a1a12);
    expect(outlineStrokes.length).toBeGreaterThan(0);
    for (const s of outlineStrokes) expect(s.args[0]).toBe(2);
  });

  it('shi_pao：上缘 1px #FFD23F rim + 炮口 #5BC8F5 + 缘 #E8483B', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32 }), false, 'zenith');
    expect(f.styleSequence()).toContain('line:1px:0xffd23f@1.000'); // 破晓 rim，1px
    expect(f.colorsUsed()).toContain(0x5bc8f5); // 炮口芯
    expect(f.colorsUsed()).toContain(0xe8483b); // 炮口缘（危险语义）
  });

  it('gu_bao：苞体换 #373D79，顶刺保持 #E8483B，脉纹 #5BC8F5，描边 2px', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'ACTIVE' }), false, 'zenith');
    const colors = f.colorsUsed();
    expect(colors).toContain(0x373d79); // 苞体压暗
    expect(colors).not.toContain(0xf2933c); // 原暖橙苞体已换（1.89:1 体块糊）
    expect(colors).toContain(0xe8483b); // 顶刺危险红不变（§A5.3 规则 4）
    expect(colors).toContain(0x5bc8f5); // 脉纹
    for (const s of f.callsOf('lineStyle').filter((c) => c.args[1] === 0x2a1a12)) {
      expect(s.args[0]).toBe(2);
    }
  });

  it('gu_bao RETRACTING：可踩窗口仍为 #FFD23F 暖黄环（功能语义全局不变）', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'RETRACTING' }), false, 'zenith');
    expect(f.colorsUsed()).toContain(0xffd23f);
    expect(f.colorsUsed()).not.toContain(0xe8483b); // 收起态无危险红
  });

  it('ci_li：主体换 #373D79 + #F2933C 拖尾纹；保持软顶可踩形状（不新增尖刺）', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'ci_li', width: 32, height: 24 }), false, 'zenith');
    expect(f.colorsUsed()).toContain(0x373d79);
    expect(f.colorsUsed()).toContain(0xf2933c); // 拖尾纹
    // 可踩形状语言：圆角矩形，且不出现三角（尖角 = 保留给「不可踩·危险」的形状编码）
    expect(f.countOf('fillRoundedRect')).toBeGreaterThan(0);
    expect(f.countOf('fillTriangle')).toBe(0);
  });

  it('du_fu：主体保持 #6E7BF2（跨关身份不动）+ 描边加倍 2px + 肚斑 #373D79 + 翅膜 #BDE9FB', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'du_fu', width: 32, height: 24 }), false, 'zenith');
    const colors = f.colorsUsed();
    expect(colors).toContain(0x6e7bf2); // 身份色不动
    expect(colors).toContain(0x373d79); // 肚斑
    expect(colors).toContain(0xbde9fb); // 翅膜
    const bodyStroke = f.callsOf('strokeRoundedRect');
    expect(bodyStroke.length).toBeGreaterThan(0);
    const twoPx = f.callsOf('lineStyle').filter((c) => c.args[1] === 0x2a1a12 && c.args[0] === 2);
    expect(twoPx.length).toBeGreaterThan(0); // 描边加倍至 2px
  });

  it('shi_pao 弹丸：芯 #E8483B + 1px 描边；zenith 追加 alpha 递减短拖尾，且拖尾禁用 #5BC8F5', () => {
    const p = { dead: false, vx: 200, vy: 0, getBounds: () => ({ x: 10, y: 20, w: 8, h: 8 }) } as unknown as Projectile;
    const f = new FakeGraphics();
    drawProjectile(f.g, p, 'zenith');
    expect(f.colorsUsed()).toEqual([0x2a1a12, 0xe8483b]); // 只有红芯 + 描边
    expect(f.colorsUsed()).not.toContain(0x5bc8f5); // §A5.2：拖尾严禁用青
    expect(f.countOf('fillCircle')).toBe(1 + 3); // 弹芯 + 3 段拖尾
    // alpha 严格递减（拖尾自尾向头变亮，均 < 弹芯 1.0）
    const trailAlphas = f
      .callsOf('fillStyle')
      .map((c) => c.args[1])
      .filter((a) => a < 1);
    expect(trailAlphas.length).toBe(3);
    for (let i = 1; i < trailAlphas.length; i++) expect(trailAlphas[i]).toBeGreaterThan(trailAlphas[i - 1]);
  });
});

describe('② zenith 正向 · §A5.4 cyclone 逆光暗管', () => {
  const zenCyclone = (over = {}): FakeGraphics => {
    const f = new FakeGraphics();
    drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160, cyclonePhaseState: 1.0, ...over }), 'zenith');
    return f;
  };

  it('暗管填充 #1F2244（alpha ≤0.5）+ 2px #2A1A12 描边 + #F2933C 粒子 + #5BC8F5 旋纹', () => {
    const f = zenCyclone();
    const colors = f.colorsUsed();
    expect(colors).toContain(0x1f2244); // 暗管填充
    expect(colors).toContain(0x2a1a12); // 暗管描边
    expect(colors).toContain(0xf2933c); // 升腾粒子
    expect(colors).toContain(0x5bc8f5); // 中心旋纹（保留跨 biome 身份）
    expect(colors).not.toContain(0xffd23f); // 原 1.17:1 暖黄粒子已弃用
    // 描边 2px 满 alpha
    expect(f.styleSequence()).toContain('line:2px:0x2a1a12@1.000');
    // 暗管填充 alpha ≤ 0.5
    const tubeFills = f.callsOf('fillStyle').filter((c) => c.args[0] === 0x1f2244);
    expect(tubeFills.length).toBeGreaterThan(0);
    for (const c of tubeFills) expect(c.args[1]).toBeLessThanOrEqual(0.5);
  });

  it('inZone 态同样满足暗管口径（alpha ≤0.5，描边仍 2px）', () => {
    const f = zenCyclone({ cycloneInZone: true });
    for (const c of f.callsOf('fillStyle').filter((x) => x.args[0] === 0x1f2244)) {
      expect(c.args[1]).toBeLessThanOrEqual(0.5);
    }
    expect(f.styleSequence()).toContain('line:2px:0x2a1a12@1.000');
  });

  it('⚠️ 升腾粒子严格限制在暗管内（§A5.4.3 最差情形：逸出管外贴裸金天仅 1.89:1）', () => {
    const R = 2.2; // 粒子半径
    // 跨多个相位 + 多种柱体尺寸全覆盖扫描
    for (const phase of [0, 0.7, 1.5, 3.14, 4.2, 5.9, 6.28]) {
      for (const [w, h] of [[96, 160], [48, 80], [32, 40]] as Array<[number, number]>) {
        const f = new FakeGraphics();
        const e = fakeEnemy({ type: 'cyclone', width: w, height: h, cyclonePhaseState: phase });
        drawCyclone(f.g, e, 'zenith');
        const b = e.getBounds();
        for (const c of f.callsOf('fillCircle')) {
          const [px, py, pr] = c.args;
          expect(pr).toBeCloseTo(R, 6);
          // 粒子外接圆完全落在暗管 bbox 内（含描边半宽余量）
          expect(px - pr).toBeGreaterThanOrEqual(b.x);
          expect(px + pr).toBeLessThanOrEqual(b.x + b.w);
          expect(py - pr).toBeGreaterThanOrEqual(b.y);
          expect(py + pr).toBeLessThanOrEqual(b.y + b.h);
        }
      }
    }
  });

  it('气柱可发现性不依赖粒子：即便粒子被跳过，暗管 silhouette 仍成立', () => {
    // 极窄柱（内缩后无粒子安全区）→ 仍必须有暗管填充 + 2px 描边
    const f = new FakeGraphics();
    drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 4, height: 4 }), 'zenith');
    expect(f.colorsUsed()).toContain(0x1f2244);
    expect(f.styleSequence()).toContain('line:2px:0x2a1a12@1.000');
    expect(f.countOf('fillCircle')).toBe(0); // 无法安全放置则不画，绝不逸出
  });

  it('drawEnemy 对 cyclone 正确转发 theme（3-6 唯一 cyclone 走暗管而非青柱）', () => {
    const f = new FakeGraphics();
    drawEnemy(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160 }), false, 'zenith');
    expect(f.colorsUsed()).toContain(0x1f2244);
    expect(f.styleSequence()).toContain('line:2px:0x2a1a12@1.000');
  });
});

// ══════════════════════════════════════════════════════════════════
// ③ 0 新增 hex
// ══════════════════════════════════════════════════════════════════
describe('③ 0 新增 hex · zenith 分支全部颜色落在锁色板 + tint 白名单内', () => {
  const ZEN_SUBJECTS: Array<[string, () => FakeGraphics]> = [
    ['cyclone', () => { const f = new FakeGraphics(); drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160 }), 'zenith'); return f; }],
    ['cyclone inZone', () => { const f = new FakeGraphics(); drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160, cycloneInZone: true }), 'zenith'); return f; }],
    ['shi_pao', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32 }), false, 'zenith'); return f; }],
    ['shi_pao flash', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'shi_pao', width: 32, height: 32, flash: 80 }), false, 'zenith'); return f; }],
    ['gu_bao ACTIVE', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'ACTIVE' }), false, 'zenith'); return f; }],
    ['gu_bao EMERGING', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'EMERGING' }), false, 'zenith'); return f; }],
    ['gu_bao RETRACTING', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'gu_bao', width: 28, height: 40, guBaoPhaseState: 'RETRACTING' }), false, 'zenith'); return f; }],
    ['ci_li', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'ci_li', width: 32, height: 24 }), false, 'zenith'); return f; }],
    ['du_fu', () => { const f = new FakeGraphics(); drawEnemy(f.g, fakeEnemy({ type: 'du_fu', width: 32, height: 24 }), false, 'zenith'); return f; }],
    ['projectile', () => { const f = new FakeGraphics(); drawProjectile(f.g, { dead: false, vx: 200, vy: 0, getBounds: () => ({ x: 10, y: 20, w: 8, h: 8 }) } as unknown as Projectile, 'zenith'); return f; }],
  ];

  for (const [name, mk] of ZEN_SUBJECTS) {
    it(`${name}：无锁色板外的新 hex`, () => {
      const used = mk().colorsUsed();
      const offenders = used.filter((c) => !WHITELIST.has(c)).map((c) => `0x${c.toString(16).padStart(6, '0')}`);
      expect(offenders).toEqual([]);
    });
  }

  it('zenith 全体敌种合并后仍 0 越界色（且确未混入 #F4EFE6 / #8A8276）', () => {
    const all = new Set<number>();
    for (const [, mk] of ZEN_SUBJECTS) for (const c of mk().colorsUsed()) all.add(c);
    expect([...all].filter((c) => !WHITELIST.has(c))).toEqual([]);
    expect(all.has(0xf4efe6)).toBe(false);
    expect(all.has(0x8a8276)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// ④ Reduce Motion（§7 / §3.2）
// ══════════════════════════════════════════════════════════════════
describe('④ Reduce Motion · cyclone 升腾粒子冻结首帧', () => {
  const draw = (phase: number, reduceMotion: boolean): FakeGraphics => {
    const f = new FakeGraphics();
    drawCyclone(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160, cyclonePhaseState: phase }), 'zenith', reduceMotion);
    return f;
  };

  it('reduceMotion=true：不同相位下粒子位置完全相同（冻结）', () => {
    const a = draw(0.4, true);
    const b = draw(5.1, true);
    expect(a.callsOf('fillCircle')).toEqual(b.callsOf('fillCircle'));
  });

  it('reduceMotion=true：旋纹亦冻结，整条指令流逐值一致', () => {
    expect(draw(0.4, true).calls).toEqual(draw(5.1, true).calls);
  });

  it('reduceMotion=true 冻结的是 phase=0 首帧', () => {
    expect(draw(3.3, true).calls).toEqual(draw(0, false).calls);
  });

  it('reduceMotion=false：相位推进时粒子确实移动（对照组，证明冻结非恒等实现）', () => {
    expect(draw(0.4, false).callsOf('fillCircle')).not.toEqual(draw(5.1, false).callsOf('fillCircle'));
  });

  it('reduceMotion 下暗管 silhouette 仍在（静态暗管 13.56:1 可发现）', () => {
    const f = draw(2.0, true);
    expect(f.colorsUsed()).toContain(0x1f2244);
    expect(f.styleSequence()).toContain('line:2px:0x2a1a12@1.000');
    expect(f.countOf('fillCircle')).toBe(3); // 粒子仍绘制，只是不动
  });

  it('drawEnemy 把 reduceMotion 透传给 cyclone（3-6 唯一 cyclone 走 drawEnemy 分派）', () => {
    const mk = (phase: number): FakeGraphics => {
      const f = new FakeGraphics();
      drawEnemy(f.g, fakeEnemy({ type: 'cyclone', width: 96, height: 160, cyclonePhaseState: phase }), true, 'zenith');
      return f;
    };
    expect(mk(0.4).calls).toEqual(mk(5.1).calls);
  });
});
