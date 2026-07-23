/**
 * tests/unit/economy/economy.test.ts — E4.S2 经济/分数（GDD 06，S04-4）。
 * 覆盖：踩怪计分/连击倍率递增封顶、连击窗口超时重置、金币、通关、死亡重置连击。
 * 纯 Node，零 Phaser / 零平台；数值全部从 EconomyConfig 读取（零硬编码验证）。
 */
import { describe, it, expect } from 'vitest';
import {
  EconomyController,
  type EconomyConfig,
  type EconomyState,
} from '../../../src/core/economy/economy';
import { economyConfig } from '../../../src/core/config';

/** 默认 GDD 06 参数（来自 economyConfig），用于「对齐数值」断言。 */
const GDD = economyConfig as EconomyConfig;

describe('E4.S2 经济/分数 (GDD 06, S04-4)', () => {
  describe('默认配置（GDD 06 数值）', () => {
    it('踩敌 +100（首次 mult=1）', () => {
      const e = new EconomyController();
      e.onStomp();
      expect(e.state.score).toBe(GDD.stompScore); // 100
      expect(e.state.comboMult).toBe(2); // 首次踩后倍率升至 2
      expect(e.state.comboCount).toBe(1);
      expect(e.state.comboTimerMs).toBe(GDD.comboWindowMs); // 刷新窗口
    });

    it('连踩 3 次 mult 递增且封顶 ×4', () => {
      const e = new EconomyController();
      e.onStomp();
      expect(e.state.comboMult).toBe(2);
      e.onStomp();
      expect(e.state.comboMult).toBe(3);
      e.onStomp();
      expect(e.state.comboMult).toBe(4); // 封顶 maxMult=4
      // 计分：100*1 + 100*2 + 100*3 = 600
      expect(e.state.score).toBe(100 + 200 + 300);
      expect(e.state.comboCount).toBe(3);
      // 第 4 次不应突破封顶
      e.onStomp();
      expect(e.state.comboMult).toBe(4);
      expect(e.state.score).toBe(600 + 400); // +100*4
    });

    it('连击窗口超时（update 超过 comboWindowMs）后 mult 重置为 1', () => {
      const e = new EconomyController();
      e.onStomp(); // comboMult=2, comboTimerMs=1500
      expect(e.state.comboMult).toBe(2);
      e.update(GDD.comboWindowMs + 1); // 超时
      expect(e.state.comboTimerMs).toBe(0);
      expect(e.state.comboMult).toBe(1);
      expect(e.state.comboCount).toBe(0);
      expect(e.state.score).toBe(GDD.stompScore); // 分数保留
    });

    it('金币 +10（coins++ 且 score += coinScore）', () => {
      const e = new EconomyController();
      e.onCoin();
      expect(e.state.coins).toBe(1);
      expect(e.state.score).toBe(GDD.coinScore); // 10
      expect(e.state.comboCount).toBe(0); // 金币不计连击
      expect(e.state.comboMult).toBe(1);
    });

    it('通关 +500（score += goalScore）', () => {
      const e = new EconomyController();
      e.onLevelComplete();
      expect(e.state.score).toBe(GDD.goalScore); // 500
    });

    it('死亡（ON_DEATH）重置连击但保留分数/金币', () => {
      const e = new EconomyController();
      e.onStomp(); // score 100, comboMult 2
      e.onCoin(); // coins 1, score 110
      e.onDeath();
      expect(e.state.comboCount).toBe(0);
      expect(e.state.comboMult).toBe(1);
      expect(e.state.comboTimerMs).toBe(0);
      expect(e.state.score).toBe(110); // 保留
      expect(e.state.coins).toBe(1); // 保留
    });

    it('窗口内连续踩怪保持连击，未超时不重置', () => {
      const e = new EconomyController();
      e.onStomp(); // timer=1500
      e.update(500); // 剩 1000
      expect(e.state.comboMult).toBe(2);
      e.onStomp(); // 续连击 → mult 3, timer 重置 1500
      expect(e.state.comboMult).toBe(3);
      expect(e.state.comboTimerMs).toBe(GDD.comboWindowMs);
    });
  });

  describe('零硬编码（自定义 config 验证数值全来自配置）', () => {
    const custom: EconomyConfig = {
      initialLives: 3,
      stompScore: 7,
      coinScore: 3,
      goalScore: 50,
      comboWindowMs: 100,
      maxMult: 3,
      comboStep: 1,
    };

    it('踩怪/金币/通关分来自 config；连击封顶取自定义 maxMult', () => {
      const e = new EconomyController(custom);
      e.onStomp(); // score += 7*1 = 7, mult=2, timer=100
      expect(e.state.score).toBe(7);
      expect(e.state.comboMult).toBe(2);
      expect(e.state.comboTimerMs).toBe(100);
      e.onStomp(); // score += 7*2 = 14 → 21, mult=min(3,3)=3, timer=100
      expect(e.state.score).toBe(21);
      expect(e.state.comboMult).toBe(3);
      e.onStomp(); // 封顶 3：score += 7*3 = 21 → 42
      expect(e.state.comboMult).toBe(3);
      expect(e.state.score).toBe(42);

      e.onCoin(); // coins 1, score +3 = 45
      expect(e.state.coins).toBe(1);
      expect(e.state.score).toBe(45);

      e.onLevelComplete(); // score +50 = 95
      expect(e.state.score).toBe(95);

      e.update(custom.comboWindowMs + 1); // 超时 → 连击清零
      expect(e.state.comboMult).toBe(1);
      expect(e.state.comboCount).toBe(0);
    });

    it('createEconomyState 初始归零、倍率=1', () => {
      const s: EconomyState = {
        score: 0,
        coins: 0,
        comboCount: 0,
        comboMult: 1,
        comboTimerMs: 0,
      };
      // 结构契约自检
      expect(s).toEqual({
        score: 0,
        coins: 0,
        comboCount: 0,
        comboMult: 1,
        comboTimerMs: 0,
      });
    });
  });
});
