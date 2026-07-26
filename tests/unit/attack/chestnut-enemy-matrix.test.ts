/**
 * tests/unit/attack/chestnut-enemy-matrix.test.ts — 栗子 vs 敌人交互矩阵与多段跳加成（GDD 17 §7 / D2-A，core 零平台单测）。
 *
 * 覆盖（game-scene 矩阵所依赖的 core 原语）：
 *   - chong_feng.applyStun(ms) → 进入 stun 态（同撞墙）；非 chong_feng / 已死忽略。
 *   - 可踩敌人 markStomped → dead（踩杀管线）。
 *   - ChestnutProjectile.overlapsRect 对敌人 AABB 命中判定（矩阵判定基础）。
 *   - CharacterController.airJumpBonus：fruit 阶段置 1 → 落地 reset 后 airJumpsLeft = airJumps + 1（多段跳）。
 * 零 Phaser / 零平台 API。
 */
import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../../../src/core/enemy/enemy-ai';
import { ChestnutProjectile } from '../../../src/core/attack/chestnut-projectile';
import { CharacterController } from '../../../src/core/character/character-controller';
import { characterConfig } from '../../../src/core/config';
import type { InputState } from '../../../src/core/input/input-abstraction';
import { STEP_DT } from '../_step';

function mkInput(over: Partial<InputState> = {}): InputState {
  return {
    left: false,
    right: false,
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    actionPressed: false,
    actionHeld: false,
    actionReleased: false,
    jumpPressedAt: 0,
    throwPressed: false,
    throwHeld: false,
    throwReleased: false,
    ...over,
  };
}

describe('GDD 17 栗子 vs 敌人矩阵（core 原语）', () => {
  it('chong_feng.applyStun(ms) → state=stun、vx=0', () => {
    const e = new EnemyAI('chong_feng', 100, 100, 0);
    e.applyStun(800);
    expect(e.state).toBe('stun');
    expect(e.vx).toBe(0);
  });

  it('非 chong_feng（ci_li）applyStun 忽略（态/不死不变）', () => {
    const e = new EnemyAI('ci_li', 100, 100, 0);
    e.applyStun(800);
    expect(e.state).not.toBe('stun');
    expect(e.dead).toBe(false);
  });

  it('已死亡敌人 applyStun 忽略', () => {
    const e = new EnemyAI('chong_feng', 100, 100, 0);
    e.markStomped();
    e.applyStun(800);
    expect(e.state).not.toBe('stun');
  });

  it('可踩敌人（ci_li）markStomped → dead=true（踩杀管线）', () => {
    const e = new EnemyAI('ci_li', 100, 100, 0);
    expect(e.dead).toBe(false);
    e.markStomped();
    expect(e.dead).toBe(true);
  });

  it('ChestnutProjectile.overlapsRect 对齐敌人 AABB：重叠 true / 分离 false', () => {
    const e = new EnemyAI('ci_li', 200, 200, 0);
    // 与敌人 AABB 重叠放置栗子
    const hit = new ChestnutProjectile(e.x, e.y, 0, 0, 1);
    expect(hit.overlapsRect(e.x, e.y, e.width, e.height)).toBe(true);
    // 远离
    const miss = new ChestnutProjectile(e.x + 999, e.y + 999, 0, 0, 1);
    expect(miss.overlapsRect(e.x, e.y, e.width, e.height)).toBe(false);
  });
});

describe('GDD 17 §3.1 / D2-A 多段跳加成', () => {
  it('airJumpBonus=0（基线）：落地 reset 后 airJumpsLeft = airJumps', () => {
    const cc = new CharacterController(characterConfig);
    cc.airJumpBonus = 0;
    cc.state.grounded = true;
    cc.consume(mkInput(), STEP_DT);
    expect(cc.state.airJumpsLeft).toBe(characterConfig.airJumps);
  });

  it('airJumpBonus=1（fruit 阶段）：落地 reset 后 airJumpsLeft = airJumps + 1', () => {
    const cc = new CharacterController(characterConfig);
    cc.airJumpBonus = 1;
    cc.state.grounded = true;
    cc.consume(mkInput(), STEP_DT);
    expect(cc.state.airJumpsLeft).toBe(characterConfig.airJumps + 1);
  });
});
