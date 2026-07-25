/**
 * tests/unit/enemy/dufu-silhouette.test.ts — 嘟浮剪影纯函数状态机单测（core 零平台）。
 *
 * 覆盖（GDD 16 §2/§3/§8 验收）：
 *  - 共享浮动数学 applyFloat（omega=float/amp，峰值竖直速度=float）；
 *  - mirror 反相不变量：剪影与配对光嘟浮 y 恒满足 y_sil + y_du ≈ 2·baseY；
 *  - mirror 默认可踩/危害（同 du_fu）；
 *  - decoy：IDLE 静止无害 → 邻近激活 ACTIVATED + FLOAT 浮动；
 *  - phaseghost：SOLID↔WRAITH 切换 emit GHOST_SHIFT，WRAITH 期可穿越（stompable/hazard=false）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import {
  stepDufuSilhouette,
  createDufuSilhouetteState,
  DEFAULT_DU_FU_SILHOUETTE_CFG,
  type DufuSilhouetteCfg,
} from '../../../src/core/enemy/dufu-silhouette';
import { applyFloat } from '../../../src/core/enemy/float-math';

const DT = 1 / 60;

describe('共享浮动数学 applyFloat（du_fu / 剪影同源）', () => {
  it('omega=float/amp，峰值竖直速度=float；y/vy 符合正弦', () => {
    const r = applyFloat({ baseY: 120, amp: 24, float: 60, phase: 0 }, DT, 100, 0);
    const omega = 60 / 24; // 2.5 rad/s
    expect(r.phase).toBeCloseTo(omega * DT, 9);
    expect(r.y).toBeCloseTo(120 + 24 * Math.sin(omega * DT), 9);
    expect(r.vy).toBeCloseTo(60 * Math.cos(omega * DT), 9);
    expect(r.vx).toBe(0);
    expect(r.x).toBe(100);
  });
});

describe('mirror（默认 twist）：反相成对 + 可踩/可伤', () => {
  it('默认 cfg.twist = "mirror"，初始 FLOAT / stompable / hazard 全 true', () => {
    const s = createDufuSilhouetteState(DEFAULT_DU_FU_SILHOUETTE_CFG, 176, 120);
    expect(s.twist).toBe('mirror');
    expect(s.mode).toBe('FLOAT');
    expect(s.ghost).toBe('SOLID');
    expect(s.stompable).toBe(true);
    expect(s.hazard).toBe(true);
  });

  it('反相不变量：剪影(offset=π) 与 光嘟浮(offset=0) 同 cfg 步进，y_sil + y_du ≈ 2·baseY', () => {
    const cfg = DEFAULT_DU_FU_SILHOUETTE_CFG;
    const du: DufuSilhouetteCfg = { ...cfg, twist: 'mirror', mirrorOffset: 0 }; // 光嘟浮等价
    const sil: DufuSilhouetteCfg = { ...cfg, twist: 'mirror', mirrorOffset: Math.PI }; // 剪影
    let sDu = createDufuSilhouetteState(du, 240, 120);
    let sSil = createDufuSilhouetteState(sil, 176, 120);
    for (let i = 0; i < 600; i++) {
      sDu = stepDufuSilhouette(sDu, DT).state;
      sSil = stepDufuSilhouette(sSil, DT).state;
      expect(sDu.y + sSil.y).toBeCloseTo(2 * 120, 6); // 恒反相
    }
  });

  it('mirror 步进后 vy 反号（一个升它落）', () => {
    const cfg = DEFAULT_DU_FU_SILHOUETTE_CFG;
    const du = createDufuSilhouetteState({ ...cfg, mirrorOffset: 0 }, 240, 120);
    const sil = createDufuSilhouetteState({ ...cfg, mirrorOffset: Math.PI }, 176, 120);
    const rDu = stepDufuSilhouette(du, DT);
    const rSil = stepDufuSilhouette(sil, DT);
    expect(Math.sign(rSil.state.vy)).toBe(-Math.sign(rDu.state.vy));
  });
});

describe('decoy（备选 twist）：静止→邻近唤醒', () => {
  const decoyCfg: DufuSilhouetteCfg = { ...DEFAULT_DU_FU_SILHOUETTE_CFG, twist: 'decoy' };

  it('初始 IDLE，静止于 baseY，stompable/hazard=false', () => {
    const s = createDufuSilhouetteState(decoyCfg, 100, 120);
    expect(s.mode).toBe('IDLE');
    expect(s.stompable).toBe(false);
    expect(s.hazard).toBe(false);
    const r = stepDufuSilhouette(s, DT);
    expect(r.state.mode).toBe('IDLE'); // 无邻近 → 保持静止
    expect(r.state.y).toBeCloseTo(120); // 不浮动
    expect(r.events).not.toContain('ACTIVATED');
  });

  it('playerProximity=true → 切 FLOAT + emit ACTIVATED，下一步开始浮动', () => {
    let s = createDufuSilhouetteState(decoyCfg, 100, 120);
    s.playerProximity = true;
    const r = stepDufuSilhouette(s, DT);
    expect(r.events).toContain('ACTIVATED');
    expect(r.state.mode).toBe('FLOAT');
    expect(r.state.stompable).toBe(true);
    expect(r.state.hazard).toBe(true);
    // 激活当步仅翻转 FLOAT（不浮动）；下一步 applyFloat 才改变 y
    expect(r.state.y).toBeCloseTo(120);
    const r2 = stepDufuSilhouette(r.state, DT);
    expect(r2.state.y).not.toBeCloseTo(120); // 开始浮动
  });

  it('激活后保持 FLOAT（不退回 IDLE，避免闪烁唤醒）', () => {
    let s = createDufuSilhouetteState(decoyCfg, 100, 120);
    s.playerProximity = true;
    s = stepDufuSilhouette(s, DT).state; // → FLOAT
    s.playerProximity = false; // 玩家离开
    const r = stepDufuSilhouette(s, DT);
    expect(r.state.mode).toBe('FLOAT'); // 仍 FLOAT
    expect(r.events).not.toContain('ACTIVATED');
  });
});

describe('phaseghost（备选 twist）：SOLID↔WRAITH 半透窗口', () => {
  const ghostCfg: DufuSilhouetteCfg = { ...DEFAULT_DU_FU_SILHOUETTE_CFG, twist: 'phaseghost' };

  it('周期性切换 emit GHOST_SHIFT；WRAITH 期 stompable=false 且 hazard=false（可穿越）', () => {
    let s = createDufuSilhouetteState(ghostCfg, 100, 120);
    let sawShift = false;
    let sawWraith = false;
    for (let i = 0; i < 240; i++) {
      const r = stepDufuSilhouette(s, DT);
      s = r.state;
      if (r.events.includes('GHOST_SHIFT')) sawShift = true;
      if (s.ghost === 'WRAITH') {
        sawWraith = true;
        expect(s.stompable).toBe(false);
        expect(s.hazard).toBe(false);
      } else {
        expect(s.stompable).toBe(true);
        expect(s.hazard).toBe(true);
      }
    }
    expect(sawShift).toBe(true);
    expect(sawWraith).toBe(true);
  });
});

describe('per-instance params 覆盖（关卡 JSON 镜像配对）', () => {
  it('params.mirrorOffset/pairId 烘焙进 state', () => {
    const s = createDufuSilhouetteState(DEFAULT_DU_FU_SILHOUETTE_CFG, 176, 120, {
      mirrorOffset: 3.14159,
      pairId: 3,
    });
    expect(s.mirrorOffset).toBeCloseTo(3.14159);
    expect(s.pairId).toBe(3);
    expect(s.twist).toBe('mirror');
  });
});
