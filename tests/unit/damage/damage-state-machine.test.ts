/**
 * E2.S4 受伤状态机（GDD 07）。
 * FULL → SMALL → DEAD 转移、无敌帧、重生、gameOver、重置、sizeScale 派生。
 * 纯 Node，零 Phaser / 零平台；阈值全部从 damageConfig 读取，禁止硬编码。
 */
import { describe, it, expect } from 'vitest';
import { DamageStateMachine } from '../../../src/core/damage/damage-state-machine';
import { damageConfig } from '../../../src/core/config';

describe('E2.S4 受伤状态机 (GDD 07)', () => {
  it('FULL 受击 → SMALL（sizeScale=smallScale，进入无敌帧）', () => {
    const dsm = new DamageStateMachine(3, damageConfig);
    expect(dsm.state).toBe('FULL');
    expect(dsm.sizeScale).toBe(damageConfig.fullScale);
    dsm.hit();
    expect(dsm.state).toBe('SMALL');
    expect(dsm.sizeScale).toBe(damageConfig.smallScale);
    expect(dsm.invincibleTimer).toBeGreaterThan(0);
  });

  it('无敌帧内受击被忽略', () => {
    const dsm = new DamageStateMachine(3, damageConfig);
    dsm.hit(); // → SMALL，进入无敌
    const t = dsm.invincibleTimer;
    expect(t).toBeGreaterThan(0);
    dsm.hit(); // 忽略（仍在无敌帧）
    expect(dsm.state).toBe('SMALL');
    expect(dsm.invincibleTimer).toBe(t); // 未刷新、未归零
  });

  it('SMALL 受击 → DEAD 且 lives 递减，有命则立即重生 FULL', () => {
    const dsm = new DamageStateMachine(3, damageConfig);
    dsm.hit(); // FULL→SMALL
    dsm.update(damageConfig.invincibleMs + 1); // 清无敌
    expect(dsm.invincibleTimer).toBe(0);
    dsm.hit(); // SMALL→DEAD, lives 3→2, 有命→重生 FULL
    expect(dsm.state).toBe('FULL');
    expect(dsm.lives).toBe(2);
    expect(dsm.sizeScale).toBe(damageConfig.fullScale);
    expect(dsm.invincibleTimer).toBeGreaterThan(0); // 重生带无敌帧
  });

  it('lives 耗尽 → isGameOver（DEAD 且 lives=0）', () => {
    const dsm = new DamageStateMachine(1, damageConfig);
    dsm.hit(); // FULL→SMALL
    dsm.update(damageConfig.invincibleMs + 1);
    dsm.hit(); // SMALL→DEAD, lives 1→0
    expect(dsm.state).toBe('DEAD');
    expect(dsm.lives).toBe(0);
    expect(dsm.isGameOver).toBe(true);
    // DEAD 再受击忽略
    dsm.hit();
    expect(dsm.state).toBe('DEAD');
    expect(dsm.lives).toBe(0);
    expect(dsm.isGameOver).toBe(true);
  });

  it('reset → FULL 且 form=BASE，无敌清零', () => {
    const dsm = new DamageStateMachine(3, damageConfig);
    dsm.hit(); // →SMALL
    dsm.update(damageConfig.invincibleMs + 1);
    dsm.hit(); // →DEAD/重生 或 gameOver
    dsm.reset();
    expect(dsm.state).toBe('FULL');
    expect(dsm.form).toBe('BASE');
    expect(dsm.invincibleTimer).toBe(0);
    expect(dsm.isGameOver).toBe(false);
  });
});
