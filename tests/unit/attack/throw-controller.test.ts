/**
 * tests/unit/attack/throw-controller.test.ts — 投掷/弹药控制器（GDD 17 §3.2–§3.3，core 零平台 headless 单测）。
 *
 * 覆盖：tryThrow 成功/失败（弹药 0 / 冷却中）、ammo 扣减、冷却置位与衰减、addAmmo 封顶、
 * reset 复位。全部数值来自 attack-config.json（经 attackConfig 读取），禁止硬编码。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { ThrowController } from '../../../src/core/attack/throw-controller';
import { attackConfig } from '../../../src/core/config';
import { STEP_DT } from '../_step';

describe('GDD 17 ThrowController 投掷/弹药', () => {
  it('构造：ammo = ammoStart、ammoCap = config.ammoCap、cooldown=0', () => {
    const tc = new ThrowController(attackConfig);
    expect(tc.ammo).toBe(attackConfig.ammoStart);
    expect(tc.ammoCap).toBe(attackConfig.ammoCap);
    expect(tc.cooldownTimer).toBe(0);
  });

  it('tryThrow 成功：返回弹丸、ammo 减 1、cooldown 置为 chestnutCooldownMs', () => {
    const tc = new ThrowController(attackConfig);
    const before = tc.ammo;
    const p = tc.tryThrow(1, 100, 100);
    expect(p).not.toBeNull();
    expect(tc.ammo).toBe(before - 1);
    expect(tc.cooldownTimer).toBe(attackConfig.chestnutCooldownMs);
  });

  it('冷却中 tryThrow 返回 null（不扣弹、不产弹）', () => {
    const tc = new ThrowController(attackConfig);
    tc.tryThrow(1, 100, 100); // 置冷却
    const ammoAfterFirst = tc.ammo;
    const p = tc.tryThrow(-1, 200, 100);
    expect(p).toBeNull();
    expect(tc.ammo).toBe(ammoAfterFirst);
  });

  it('update 衰减冷却：经一个步长后 cooldown 减少', () => {
    const tc = new ThrowController(attackConfig);
    tc.tryThrow(1, 100, 100);
    const cd0 = tc.cooldownTimer;
    tc.update(STEP_DT * 1000);
    expect(tc.cooldownTimer).toBeLessThan(cd0);
    expect(tc.cooldownTimer).toBeGreaterThanOrEqual(0);
  });

  it('弹药耗尽：tryThrow 返回 null', () => {
    const tc = new ThrowController(attackConfig);
    // 反复投掷直到弹药 0（含冷却衰减）
    for (let i = 0; i < attackConfig.ammoCap + 2; i++) {
      tc.cooldownTimer = 0; // 清零冷却以连续投掷
      if (tc.ammo <= 0) break;
      tc.tryThrow(1, 100, 100);
    }
    expect(tc.ammo).toBe(0);
    tc.cooldownTimer = 0;
    expect(tc.tryThrow(1, 100, 100)).toBeNull();
  });

  it('addAmmo 封顶 ammoCap（不溢出）', () => {
    const tc = new ThrowController(attackConfig);
    tc.ammo = 0;
    const gained = tc.addAmmo(attackConfig.ammoCap + 5);
    expect(tc.ammo).toBe(attackConfig.ammoCap);
    expect(gained).toBe(attackConfig.ammoCap);
  });

  it('reset 复位：ammo = 传入 startAmmo（封顶），cooldown=0', () => {
    const tc = new ThrowController(attackConfig);
    tc.tryThrow(1, 100, 100);
    tc.reset(attackConfig.ammoCap + 10);
    expect(tc.ammo).toBe(attackConfig.ammoCap);
    expect(tc.cooldownTimer).toBe(0);
  });
});
